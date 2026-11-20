// 启动装配与状态机
// 状态：已实现（打开 PDF、连续滚动、缩放、矩形/多边形标注、撤销重做）。

import { createShell, setTitle, setEmpty, addButton, addButtonTo } from '../ui/shell.js';
import { createZoom, subscribe, setScale, setFit, anchorAt } from '../view/zoom.js';
import { stepZoom } from '../core/layout.js';
import { bindShortcuts, nudgeVector } from '../app/shortcuts.js';
import { pageAtScroll } from '../view/navigator.js';
import { renderZoomControl } from '../ui/zoom-control.js';
import { createPageStack } from '../view/page-stack.js';
import { createOverlay, drawRegions, regionsOfPage } from '../view/overlay.js';
import { createPreview, renderPreview } from '../ui/preview.js';
import { renderRegions } from '../ui/region-list.js';
import { boundsOf } from '../view/editor.js';
import {
  createEditor,
  setTool,
  setPage,
  pointerDown,
  pointerMove,
  pointerUp,
  closePoly,
  deleteSelection,
  nudge,
  selected,
} from '../view/editor.js';
import { createHistory, commit, undo, redo } from '../core/history.js';
import { openFile, acceptDrop, pickFile } from '../app/open.js';
import { exportZip } from '../app/export-zip.js';
import { keyForFile, loadConfig, saveConfig, groupByPage, flattenPages } from '../io/config.js';
import { toast } from '../ui/toast.js';

const TOOL_ICONS = { select: '↖', rect: '▭', poly: '⬠' };

export function boot(opts = {}) {
  const shell = createShell();
  const zoom = createZoom({ scale: 1 });
  const stack = createPageStack({ container: shell.canvas, zoom });
  renderZoomControl({ container: shell.canvas, zoom });

  const ed = createEditor({ pageW: 595, pageH: 842 });
  const hist = createHistory(JSON.stringify(ed.regions));
  const overlays = new Map();
  let state = 'idle';
  let drawing = false;
  let currentDoc = null;
  let currentName = 'figures';

  function download(bytes, filename) {
    if (typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 5000);
    return true;
  }

  async function doExport() {
    if (!currentDoc) {
      toast('先打开一份 PDF');
      return null;
    }
    if (ed.regions.length === 0) {
      toast('还没有框，先圈几张图');
      return null;
    }
    state = 'exporting';
    try {
      const out = await exportZip({ doc: currentDoc, regions: ed.regions, source: currentName });
      download(out.bytes, out.name);
      toast('已导出 ' + out.files.length + ' 张图 → ' + out.name, { kind: 'info', ms: 5000 });
      return out;
    } catch (e) {
      toast('导出失败：' + (e && e.message ? e.message : e));
      return null;
    } finally {
      state = 'ready';
    }
  }

  const snapshot = () => JSON.stringify(ed.regions);
  const record = (key) => {
    commit(hist, snapshot(), key ? { key } : {});
    scheduleSave();
  };

  // ---- 持久化：每份 PDF 一条 localStorage 记录，键 = 文件名|字节数 ----
  const storage = (() => {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (e) {
      return null;
    }
  })();
  let currentKey = null;
  let saveTimer = null;

  function persist(force) {
    if (!storage || !currentKey) return false;
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      saveConfig(storage, currentKey, {
        source: currentName,
        export: { dpi: 300, margin: 8 },
        updatedAt: Date.now(),
        pages: groupByPage(ed.regions),
      });
      return true;
    } catch (e) {
      toast('存不下标注（localStorage 满了？），请尽快导出 ZIP');
      return false;
    }
  }

  function scheduleSave() {
    if (!storage || !currentKey) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(true), 200);
  }

  // 右栏：常驻预览 + 区域列表
  const doc = shell.canvas.ownerDocument;
  const previewHost = doc.createElement('div');
  previewHost.className = 'preview-host';
  const listHost = doc.createElement('div');
  listHost.className = 'region-list';
  shell.panelRight.append(previewHost, listHost);
  const preview = createPreview(previewHost);

  function selectRegion(region) {
    if (!region) {
      ed.selectedId = null;
    } else {
      ed.selectedId = region.id;
      if (region.page !== ed.page) setPage(ed, region.page);
      ed.pageW = overlays.get(region.page) ? overlays.get(region.page).size.w : ed.pageW;
      ed.pageH = overlays.get(region.page) ? overlays.get(region.page).size.h : ed.pageH;
      const wrap = stack.pages.find((p) => p.no === region.page);
      if (wrap && wrap.wrap.scrollIntoView) wrap.wrap.scrollIntoView({ block: 'nearest' });
    }
    refresh();
  }

  function renderPanels() {
    const ov = overlays.get(ed.page);
    const pageW = ov ? ov.size.w : ed.pageW;
    const pageH = ov ? ov.size.h : ed.pageH;
    const stackPage = stack.pages.find((p) => p.no === ed.page);
    const source = stackPage ? stackPage.canvas : null;
    const sel = ed.regions.find((r) => r.id === ed.selectedId && r.page === ed.page);

    if (sel) {
      const b = boundsOf(sel);
      renderPreview(preview, { source, pageW, pageH, selectedId: sel.id, regions: regionsOfPage(ed.regions, ed.page), crop: b });
    } else {
      renderPreview(preview, { source, pageW, pageH, selectedId: null, regions: regionsOfPage(ed.regions, ed.page) });
    }

    renderRegions(listHost, {
      regions: ed.regions,
      page: ed.page,
      selectedId: ed.selectedId,
      onSelect: selectRegion,
      onChange: (region, meta) => {
        if (!meta || !meta.quiet) record(null);
        refresh();
      },
      onDelete: (region) => {
        const idx = ed.regions.indexOf(region);
        if (idx >= 0) ed.regions.splice(idx, 1);
        if (ed.selectedId === region.id) ed.selectedId = null;
        record(null);
        refresh();
      },
    });
  }

  function render() {
    for (const [page, ov] of overlays) {
      drawRegions(ov, regionsOfPage(ed.regions, page), {
        selectedId: page === ed.page ? ed.selectedId : null,
        selected: page === ed.page ? ed.regions.find((r) => r.id === ed.selectedId) || null : null,
        draft: page === ed.page ? ed.draft : null,
        scale: zoom.scale,
      });
    }
    renderPanels();
  }

  const refresh = render;

  // 顶栏左簇：打开 → 撤销 → 重做（工具组是画布左上的浮层，不在这儿）
  addButton(shell, 'left', '打开', async () => {
    const file = await pickFile();
    if (file) load(file);
  }, { title: '打开 PDF（Ctrl+O）' });

  const undoUi = () => {
    const prev = undo(hist);
    if (prev === null) return;
    ed.regions = JSON.parse(prev);
    ed.selectedId = null;
    render();
  };
  const redoUi = () => {
    const next = redo(hist);
    if (next === null) return;
    ed.regions = JSON.parse(next);
    ed.selectedId = null;
    render();
  };

  addButton(shell, 'left', '↶', undoUi, { title: '撤销 (Ctrl+Z)', ariaLabel: '撤销' });
  addButton(shell, 'left', '↷', redoUi, { title: '重做 (Ctrl+Y)', ariaLabel: '重做' });
  addButton(shell, 'right', '导出', () => doExport(), { title: '导出 ZIP (Ctrl+E)', ariaLabel: '导出' });

  // 浮动工具组：画布左上
  const toolGroup = doc.createElement('div');
  toolGroup.className = 'tool-group';
  shell.canvas.appendChild(toolGroup);

  const toolButtons = new Map();

  function markTool(tool) {
    for (const [name, btn] of toolButtons) btn.classList.toggle('is-active', name === tool);
  }

  const toolButton = (icon, label, tool) => {
    const btn = addButtonTo(toolGroup, icon, () => {
      setTool(ed, tool);
      markTool(tool);
    }, { title: label, ariaLabel: label });
    toolButtons.set(tool, btn);
    if (tool === ed.tool) btn.classList.add('is-active');
    return btn;
  };

  toolButton(TOOL_ICONS.select, '选择 (V)', 'select');
  toolButton(TOOL_ICONS.rect, '矩形 (R)', 'rect');
  toolButton(TOOL_ICONS.poly, '多边形 (G)', 'poly');

  function pointOf(ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest('.page') : null;
    if (!el) return null;
    const canvas = el.querySelector('canvas');
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    const no = Number(el.dataset.page);
    const ov = overlays.get(no);
    const size = ov ? ov.size : { w: ed.pageW, h: ed.pageH };
    return {
      no,
      pt: {
        x: ((ev.clientX - box.left) / box.width) * size.w,
        y: ((ev.clientY - box.top) / box.height) * size.h,
      },
      size,
    };
  }

  // 中键拖拽平移
  let pan = null;
  shell.canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button === 1) {
      pan = { x: ev.clientX, y: ev.clientY, left: stack.root.scrollLeft, top: stack.root.scrollTop };
      ev.preventDefault();
    }
  });

  shell.canvas.addEventListener('pointerdown', (ev) => {
    if (state !== 'ready' || ev.button === 1) return;
    const hit = pointOf(ev);
    if (!hit) return;
    if (hit.no !== ed.page) setPage(ed, hit.no);
    ed.pageW = hit.size.w;
    ed.pageH = hit.size.h;
    drawing = true;
    pointerDown(ed, hit.pt);
    render();
  });

  shell.canvas.addEventListener('pointermove', (ev) => {
    if (pan) {
      stack.root.scrollLeft = pan.left - (ev.clientX - pan.x);
      stack.root.scrollTop = pan.top - (ev.clientY - pan.y);
      return;
    }
    if (!drawing || state !== 'ready') return;
    const hit = pointOf(ev);
    if (!hit) return;
    pointerMove(ed, hit.pt);
    render();
  });

  shell.canvas.addEventListener('pointerup', (ev) => {
    if (pan) {
      pan = null;
      return;
    }
    if (!drawing) return;
    drawing = false;
    const hit = pointOf(ev);
    if (!hit) return;
    const before = snapshot();
    pointerUp(ed, hit.pt);
    if (snapshot() !== before) record(null);
    render();
  });

  // ---- 快捷键：统一走 app/shortcuts 的键表 ----
  const fitDims = () => {
    const ov = overlays.get(ed.page);
    return {
      viewportW: shell.canvas.clientWidth || 800,
      viewportH: shell.canvas.clientHeight || 600,
      pageW: ov ? ov.size.w : ed.pageW,
      pageH: ov ? ov.size.h : ed.pageH,
      padX: 24,
      padY: 24,
    };
  };

  function goPage(no) {
    const total = stack.pages.length || 1;
    const next = Math.min(Math.max(1, no), total);
    stack.setCurrent(next);
    if (ed.page !== next) {
      ed.page = next;
      ed.selectedId = null;
      render();
    }
    return next;
  }

  const actions = {
    'tool.select': () => { setTool(ed, 'select'); markTool('select'); },
    'tool.rect': () => { setTool(ed, 'rect'); markTool('rect'); },
    'tool.poly': () => { setTool(ed, 'poly'); markTool('poly'); },
    'tool.closePoly': () => { if (closePoly(ed)) { record(null); render(); } },
    'page.next': () => goPage(stack.current + 1),
    'page.prev': () => goPage(stack.current - 1),
    'page.plus10': () => goPage(stack.current + 10),
    'page.minus10': () => goPage(stack.current - 10),
    'page.first': () => goPage(1),
    'page.last': () => goPage(stack.pages.length),
    'zoom.in': () => setScale(zoom, stepZoom(zoom.scale, 1)),
    'zoom.out': () => setScale(zoom, stepZoom(zoom.scale, -1)),
    'zoom.reset': () => setScale(zoom, 1),
    'zoom.fitPage': () => setFit(zoom, 'page', fitDims()),
    'zoom.fitWidth': () => setFit(zoom, 'width', fitDims()),
    'history.undo': undoUi,
    'history.redo': redoUi,
    'export.zip': () => doExport(),
    'config.save': () => persist(true),
    'file.open': async () => {
      const file = await pickFile();
      if (file) load(file);
    },
    'region.delete': () => {
      if (deleteSelection(ed)) { record(null); render(); }
    },
    'region.nudge': (ev) => {
      const v = nudgeVector(ev);
      if (nudge(ed, v.dx, v.dy)) { record('nudge'); render(); }
    },
    cancel: () => {
      ed.draft = null;
      ed.selectedId = null;
      render();
    },
  };

  bindShortcuts(document, actions);

  // Ctrl+滚轮：以指针为锚点缩放
  shell.canvas.addEventListener('wheel', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || state !== 'ready') return;
    ev.preventDefault();
    const root = stack.root;
    const box = root.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const from = zoom.scale;
    setScale(zoom, from * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
    const next = anchorAt({ x: root.scrollLeft, y: root.scrollTop }, px, py, from, zoom.scale);
    root.scrollLeft = next.x;
    root.scrollTop = next.y;
  }, { passive: false });

  // 滚动时当前页跟着走（右栏预览与列表要跟着变）
  stack.root.addEventListener('scroll', () => {
    if (state !== 'ready') return;
    const rects = stack.visibleRects();
    const viewportTop = shell.canvas.getBoundingClientRect().top + 8;
    const no = pageAtScroll(rects, viewportTop);
    if (no !== ed.page) {
      ed.page = no;
      ed.selectedId = null;
      render();
    }
  }, { passive: true });

  const load = async (file) => {
    persist(true); // 打开新文件前先落上一份
    state = 'loading';
    setEmpty(shell, false);
    setTitle(shell, file.name);
    try {
      const doc = await openFile(file, opts);
      currentDoc = doc;
      currentName = file.name;
      const n = await stack.mount(doc);

      overlays.clear();
      for (const p of stack.pages) {
        const vp = p.page.getViewport({ scale: 1 });
        overlays.set(p.no, createOverlay(p.wrap, { w: vp.width, h: vp.height }));
      }
      ed.page = 1;
      ed.pageW = stack.pages.length > 0 ? overlays.get(1).size.w : 595;
      ed.pageH = stack.pages.length > 0 ? overlays.get(1).size.h : 842;

      // 恢复这份 PDF 之前的标注
      currentKey = keyForFile(file.name, file.size);
      const saved = storage ? loadConfig(storage, currentKey) : null;
      if (saved && saved.pages) {
        const back = flattenPages(saved.pages);
        ed.regions = back.regions;
        ed.nextId = back.nextId;
        ed.selectedId = null;
        hist.past.length = 0;
        hist.future.length = 0;
        hist.present = snapshot();
      }

      render();
      setTitle(shell, file.name + ' · ' + n + ' 页');
      state = 'ready';
    } catch (e) {
      state = 'error';
      toast('打开失败：' + (e && e.message ? e.message : e));
      setEmpty(shell, true);
    }
  };

  acceptDrop(shell.canvas, (file) => load(file));
  subscribe(zoom, () => stack.applyZoom());

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => persist(true));
    window.addEventListener('beforeunload', () => persist(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist(true);
    });
  }

  if (opts.url) {
    const name = String(opts.url).split('/').pop() || 'document.pdf';
    fetch(opts.url)
      .then((res) => res.blob())
      .then((blob) => load(new File([blob], name, { type: 'application/pdf' })))
      .catch((e) => toast('打不开 ' + opts.url + '：' + e.message));
  }

  return {
    shell,
    zoom,
    stack,
    editor: ed,
    history: hist,
    load,
    render,
    exportZip: doExport,
    persist: () => persist(true),
    debug: () => ({ key: currentKey, hasStorage: !!storage, regions: ed.regions.length, state }),
    status: () => state,
  };
}

// 骨架里声明的名字：读装配后的状态
export function status(booted) {
  return booted.status();
}

export { selected };
