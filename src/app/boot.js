// 启动装配与状态机
// 状态：已实现（打开 PDF、连续滚动、缩放、矩形/多边形标注、撤销重做）。

import { createShell, setTitle, setEmpty, addButton, addButtonTo } from '../ui/shell.js';
import { createZoom, subscribe, setScale, setFit, anchorAt } from '../view/zoom.js';
import { stepZoom } from '../core/layout.js';
import { bindShortcuts, nudgeVector } from '../app/shortcuts.js';
import { pageAtScroll } from '../view/navigator.js';
import { ICONS } from '../ui/icons.js';
import { renderZoomControl } from '../ui/zoom-control.js';
import { createPageStack } from '../view/page-stack.js';
import { createOverlay, drawRegions, regionsOfPage } from '../view/overlay.js';
import { createPreview, renderPreview } from '../ui/preview.js';
import { renderRegions } from '../ui/region-list.js';
import { renderPageList } from '../ui/page-list.js';
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
import { createTheme, cycleUi, cyclePdfPreview, applyTheme, loadTheme, saveTheme, isInverted } from '../ui/theme.js';
import { loadSettings, saveSettings, setDpi, setMargin } from '../app/settings.js';
import { toast } from '../ui/toast.js';



export function boot(opts = {}) {
  const shell = createShell();
  const zoom = createZoom({ scale: 1 });
  const stack = createPageStack({ container: shell.canvas, zoom });
  renderZoomControl({
    container: shell.canvas,
    zoom,
    onFitPage: () => setFit(zoom, 'page', fitDims()),
    onFitWidth: () => setFit(zoom, 'width', fitDims()),
  });

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
      toast('正在导出 ' + ed.regions.length + ' 张图…', { kind: 'info', ms: 8000 });
      const out = await exportZip({
        doc: currentDoc,
        regions: ed.regions,
        source: currentName,
        dpi: settings.dpi,
        margin: settings.margin,
        onProgress: ({ page, done, total }) => {
          if (page) toast('正在导出第 ' + page + ' 页（' + (done + 1) + '/' + total + '）…', { kind: 'info', ms: 8000 });
        },
      });
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

  // ---- 配色：界面与 PDF 两套独立三态 ----
  const theme = loadTheme(storage);
  const prefersDark = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;

  const settings = loadSettings(storage);

  function applyColors() {
    applyTheme(theme, document, prefersDark());
    saveTheme(storage, theme);
    if (typeof syncColorButtons === 'function') syncColorButtons();
    return theme;
  }

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
  let lastListSig = '';

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

  // 左栏缩略图：直接从已渲染的页位图缩一份
  function thumbFor(no) {
    const p = stack.pages.find((x) => x.no === no);
    if (!p || !p.canvas || !p.canvas.width) return null;
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 108;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 80, 108);
    const k = Math.min(80 / p.canvas.width, 108 / p.canvas.height);
    const w = p.canvas.width * k;
    const h = p.canvas.height * k;
    ctx.drawImage(p.canvas, (80 - w) / 2, (108 - h) / 2, w, h);
    return c;
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

    // 左栏：页码 + 标注数（只在签名变了才重建，画框拖动时不重排）
    const sig = stack.pages.length + ':' + ed.regions.length + ':' + ed.page;
    if (sig !== lastListSig) {
      lastListSig = sig;
      renderPageList(shell.panelLeft, {
        pages: stack.pages,
        current: ed.page,
        regions: ed.regions,
        onPick: (no) => goPage(no),
        thumbFor,
      });
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
  }, { title: '打开 PDF（Ctrl+O）', kind: 'btn', icon: ICONS.doc });

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

  addButton(shell, 'left', '撤销', undoUi, { title: '撤销 (Ctrl+Z)', ariaLabel: '撤销', icon: ICONS.undo });
  addButton(shell, 'left', '重做', redoUi, { title: '重做 (Ctrl+Y)', ariaLabel: '重做', icon: ICONS.redo });
  // 导出设置：边距 / DPI
  const settingsBox = doc.createElement('div');
  settingsBox.className = 'settings-popover';
  settingsBox.hidden = true;

  const dpiInput = doc.createElement('input');
  dpiInput.type = 'number';
  dpiInput.min = '72';
  dpiInput.max = '1200';
  dpiInput.value = String(settings.dpi);
  dpiInput.title = '导出 DPI（72–1200）';

  const marginInput = doc.createElement('input');
  marginInput.type = 'number';
  marginInput.min = '0';
  marginInput.max = '80';
  marginInput.step = '0.5';
  marginInput.value = String(settings.margin);
  marginInput.title = '边距 pt（0–80）';

  const dpiLabel = doc.createElement('label');
  dpiLabel.textContent = 'DPI';
  dpiLabel.appendChild(dpiInput);
  const marginLabel = doc.createElement('label');
  marginLabel.textContent = '边距';
  marginLabel.appendChild(marginInput);
  settingsBox.append(dpiLabel, marginLabel);
  document.body.appendChild(settingsBox);

  dpiInput.addEventListener('change', () => {
    dpiInput.value = String(setDpi(settings, dpiInput.value));
    saveSettings(storage, settings);
  });
  marginInput.addEventListener('change', () => {
    marginInput.value = String(setMargin(settings, marginInput.value));
    saveSettings(storage, settings);
  });

  addButton(shell, 'right', '设置', () => {
    settingsBox.hidden = !settingsBox.hidden;
  }, { title: '导出设置：边距 / DPI', ariaLabel: '导出设置', icon: ICONS.settings });

  const themeBtn = addButton(shell, 'right', '配色', () => {
    cycleUi(theme);
    applyColors();
  }, { title: '界面配色', ariaLabel: '界面配色', icon: ICONS.uiAuto });

  const invertBtn = addButton(shell, 'right', '反相', () => {
    cyclePdfPreview(theme);
    applyColors();
  }, { title: 'PDF 预览', ariaLabel: 'PDF 配色', icon: ICONS.invert });

  function syncColorButtons() {
    const ui = theme.ui;
    themeBtn.innerHTML = ui === 'light' ? ICONS.uiLight : ui === 'dark' ? ICONS.uiDark : ICONS.uiAuto;
    themeBtn.title = '界面配色：' + (ui === 'auto' ? '跟随系统' : ui === 'light' ? '浅色' : '深色') + '（点一下切换）';
    const inv = isInverted(theme, prefersDark());
    invertBtn.classList.toggle('on', inv);
    invertBtn.title = 'PDF 预览：' + (theme.pdf === 'auto' ? '跟随界面' : theme.pdf === 'normal' ? '正常' : '反相') + '（Ctrl+I）';
  }

  addButton(shell, 'right', '导出', () => doExport(), {
    title: '导出 ZIP (Ctrl+E)',
    ariaLabel: '导出',
    kind: 'btn',
    suggested: true,
    icon: ICONS.export,
  });

  // 浮动工具组：画布左上
  const toolGroup = doc.createElement('div');
  toolGroup.className = 'tool-group';
  shell.canvas.appendChild(toolGroup);

  const toolButtons = new Map();

  function markTool(tool) {
    for (const [name, btn] of toolButtons) btn.classList.toggle('is-active', name === tool);
  }

  const toolButton = (iconSvg, label, tool) => {
    const btn = addButtonTo(toolGroup, label, () => {
      setTool(ed, tool);
      markTool(tool);
    }, { title: label, ariaLabel: label, icon: iconSvg });
    toolButtons.set(tool, btn);
    if (tool === ed.tool) btn.classList.add('is-active');
    return btn;
  };

  toolButton(ICONS.select, '选择 (V)', 'select');
  toolButton(ICONS.rect, '矩形 (R)', 'rect');
  toolButton(ICONS.poly, '多边形 (G)', 'poly');

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
    'view.continuous': () => stack.applyLayout({ continuous: !stack.view.continuous }),
    'view.dual': () => stack.applyLayout({ dual: !stack.view.dual }),
    'view.oddLeft': () => stack.applyLayout({ oddLeft: !stack.view.oddLeft }),
    'view.invert': () => {
      theme.pdf = isInverted(theme, prefersDark()) ? 'normal' : 'invert';
      applyColors();
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

  applyColors();
  acceptDrop(shell.canvas, (file) => load(file));
  subscribe(zoom, () => stack.applyZoom());

  // ---- 侧栏拖拽 / 折叠（宽度记在 localStorage） ----
  const LAYOUT_KEY = 'figcut.layout';
  const layout = (() => {
    try {
      return JSON.parse((storage && storage.getItem(LAYOUT_KEY)) || '{}') || {};
    } catch (e) {
      return {};
    }
  })();
  const saveLayout = () => {
    try {
      storage && storage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch (e) {
      /* 存不下无所谓 */
    }
  };

  function applyLayout() {
    const root = document.documentElement;
    if (layout.side) root.style.setProperty('--w-side', layout.side + 'px');
    if (layout.panel) root.style.setProperty('--w-panel', layout.panel + 'px');
    shell.panelLeft.classList.toggle('is-collapsed', !!layout.leftCollapsed);
    shell.panelRight.classList.toggle('is-collapsed', !!layout.rightCollapsed);
  }
  applyLayout();

  function bindSplitter(el, side) {
    if (!el) return;
    let start = null;
    el.addEventListener('pointerdown', (ev) => {
      const base = side === 'left' ? shell.panelLeft.getBoundingClientRect().width : shell.panelRight.getBoundingClientRect().width;
      start = { x: ev.clientX, w: base };
      el.classList.add('is-dragging');
      if (el.setPointerCapture) el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', (ev) => {
      if (!start) return;
      const dx = ev.clientX - start.x;
      const raw = side === 'left' ? start.w + dx : start.w - dx;
      const min = side === 'left' ? 120 : 160;
      const max = side === 'left' ? 360 : 460;
      const w = Math.round(Math.max(min, Math.min(max, raw)));
      if (side === 'left') {
        layout.side = w;
        layout.leftCollapsed = false;
      } else {
        layout.panel = w;
        layout.rightCollapsed = false;
      }
      applyLayout();
      saveLayout();
    });
    const end = () => {
      start = null;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => {
      if (side === 'left') layout.leftCollapsed = !layout.leftCollapsed;
      else layout.rightCollapsed = !layout.rightCollapsed;
      applyLayout();
      saveLayout();
    });
  }

  bindSplitter(document.getElementById('split-left'), 'left');
  bindSplitter(document.getElementById('split-right'), 'right');

  // 未捕获异常进底部横幅，不覆盖空状态，10 秒后自己消失
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => {
      toast('出错了：' + (ev && ev.message ? ev.message : ev));
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev && ev.reason ? ev.reason.message || ev.reason : '未知错误';
      toast('出错了：' + reason);
    });
  }

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
