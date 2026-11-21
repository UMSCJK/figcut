// 启动装配与状态机
// 状态：已实现（打开 PDF、连续滚动、缩放、矩形/多边形标注、撤销重做）。

import { createShell, setTitle, setEmpty, addButton, addButtonTo } from '../ui/shell.js';
import { createZoom, subscribe, setScale, setFit, anchorAt } from '../view/zoom.js';
import { fitPageScale, fitWidthScale } from '../core/layout.js';
import { bindShortcuts, nudgeVector } from '../app/shortcuts.js';
import { pageAtScroll } from '../view/navigator.js';
import { ICONS } from '../ui/icons.js';
import { stepList, stepIndex } from '../ui/zoom-control.js';
import { labelOfKind } from '../ui/inspector.js';
import { renderZoomControl } from '../ui/zoom-control.js';
import { createPageStack } from '../view/page-stack.js';
import { createOverlay, drawRegions, regionsOfPage } from '../view/overlay.js';
import { createPreview, renderPreview } from '../ui/preview.js';
import { renderRegions } from '../ui/region-list.js';
import { renderPageList } from '../ui/page-list.js';
import { boundsOf } from '../view/editor.js';
import { cornerAt } from '../core/geometry.js';
import { renderPage } from '../pdf/bitmap.js';
import { buildInkMask } from '../pdf/ink.js';
import { computeExportBox, growWhite } from '../core/whitemargin.js';
import {
  createEditor,
  setTool,
  setPage,
  edgeAt,
  vertexAt,
  regionAt,
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
import { pickWithHandle, saveHandle, openRecent, cacheBytes, forgetFile, hasPickHandle } from '../io/filehandles.js';
import { exportZip } from '../app/export-zip.js';
import { keyForFile, loadConfig, saveConfig, groupByPage, flattenPages } from '../io/config.js';
import { createTheme, applyTheme, loadTheme, saveTheme, isInverted, resolvedUi } from '../ui/theme.js';
import { loadSettings, saveSettings, setDpi, setMargin } from '../app/settings.js';
import { toast } from '../ui/toast.js';



export function boot(opts = {}) {
  const shell = createShell();
  const zoom = createZoom({ scale: 1 });
  const stack = createPageStack({ container: shell.canvas, zoom });
  renderZoomControl({
    container: shell.canvas,
    zoom,
    onFitWidth: () => setFit(zoom, 'width', fitDims()),
    fitPcts: () => {
      const d = fitDims();
      return { page: fitPageScale(d), width: fitWidthScale(d) };
    },
  });

  const ed = createEditor({ pageW: 595, pageH: 842 });
  const hist = createHistory(JSON.stringify(ed.regions));
  const overlays = new Map();
  let state = 'idle';
  let drawing = false;
  let currentDoc = null;
  let currentName = 'figures';
  let lastPt = null;
  let liveRaf = 0;
  let refreshTextTimer = 0;

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

  // 拖动排序：把 from 插到 to 的位置，然后重排同页的 order 字段
  function reorderRegion(fromId, toId) {
    const from = ed.regions.findIndex((r) => r.id === fromId);
    const to = ed.regions.findIndex((r) => r.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = ed.regions.splice(from, 1);
    ed.regions.splice(to, 0, moved);
    const page = moved.page;
    let n = 0;
    for (const r of ed.regions) {
      if (r.page === page) r.order = n++;
    }
    record(null);
    lastListSig = '';
    refresh();
  }

  function selectRegion(region) {
    if (!region) {
      ed.selectedId = null;
    } else {
      ed.selectedId = region.id;
      if (!region.ink) measureRegion(region);
      if (region.page !== ed.page) setPage(ed, region.page);
      ed.pageW = overlays.get(region.page) ? overlays.get(region.page).size.w : ed.pageW;
      ed.pageH = overlays.get(region.page) ? overlays.get(region.page).size.h : ed.pageH;
      const wrap = stack.pages.find((p) => p.no === region.page);
      if (wrap && wrap.wrap.scrollIntoView) wrap.wrap.scrollIntoView({ block: 'nearest' });
    }
    refresh();
  }

  // ---- 缩紧：画完/改完立刻量出导出框（2px/pt 掩膜，一页缓存一份） ----
  const maskCache = new Map();

  async function pageMask(pageNo) {
    if (maskCache.has(pageNo)) return maskCache.get(pageNo);
    const p = stack.pages.find((x) => x.no === pageNo);
    if (!p) return null;
    // 2px/pt 的整页位图：既用来量墨迹，也当右栏预览的高清源
    const canvas = await renderPage(p.page, { scale: 3, dpr: 1 });
    const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const entry = { mask: buildInkMask(img, { pxPerPt: 3 }), canvas };
    maskCache.set(pageNo, entry);
    return entry;
  }

  function applyMeasure(region, entry) {
    const shape = region.shape === 'poly' ? region.points : region.rect;
    region.ink = computeExportBox(entry.mask, shape) || null;
    region.box = region.ink
      ? growWhite(entry.mask, region.ink, settings.margin, entry.mask.w / 2, entry.mask.h / 2)
      : null;
  }

  function measureRegion(region) {
    if (!region) return;
    // 掩膜已经就绪就同步量，画完立刻能看到虚线框；否则后台补
    const cached = maskCache.get(region.page);
    if (cached) {
      applyMeasure(region, cached);
      return;
    }
    pageMask(region.page).then((entry) => {
      if (!entry) return;
      applyMeasure(region, entry);
      render();
    });
  }

  function remeasureAll() {
    for (const region of ed.regions) {
      const cached = maskCache.get(region.page);
      if (cached) applyMeasure(region, cached);
      else {
        region.box = null;
        measureRegion(region);
      }
    }
    render();
  }

  // 右栏每个 figure 的缩略图：从 3px/pt 高清页位图裁好，多边形选区会按蒙版涂白
  function regionThumb(region) {
    const box = region.box || region.ink;
    if (!box) {
      if (!maskCache.has(region.page)) {
        pageMask(region.page).then(() => render());
      }
      return null;
    }
    const entry = maskCache.get(region.page);
    if (!entry) {
      pageMask(region.page).then(() => render());
      return null;
    }
    const src = entry.canvas;
    const s = 3; // 与 pageMask 的栅格一致
    const W = 96;
    const H = Math.max(1, Math.round((W * box.h) / box.w));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (region.shape === 'poly' && region.points) {
      ctx.beginPath();
      region.points.forEach((p, i) => {
        const x = ((p.x - box.x) / box.w) * W;
        const y = ((p.y - box.y) / box.h) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(src, box.x * s, box.y * s, box.w * s, box.h * s, 0, 0, W, H);
    ctx.restore();
    return c;
  }

  // 左栏缩略图：直接从已渲染的页位图缩一份
  const thumbPending = new Set();

  function thumbFor(no) {
    const p = stack.pages.find((x) => x.no === no);
    if (!p || !p.canvas || !p.canvas.width) {
      // 位图还没画好：等它好了强制重建一次列表，否则缩略图会一直空着
      if (!thumbPending.has(no)) {
        thumbPending.add(no);
        setTimeout(() => {
          thumbPending.delete(no);
          lastListSig = '';
          render();
        }, 250);
      }
      return null;
    }
    const W = 300;
    const H = Math.round((W * 842) / 595);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const k = Math.min(W / p.canvas.width, H / p.canvas.height);
    const w = p.canvas.width * k;
    const h = p.canvas.height * k;
    ctx.drawImage(p.canvas, (W - w) / 2, (H - h) / 2, w, h);
    return c;
  }

  function renderPanels() {
    const ov = overlays.get(ed.page);
    const pageW = ov ? ov.size.w : ed.pageW;
    const pageH = ov ? ov.size.h : ed.pageH;
    // 预览用 2px/pt 的高清源，别拿屏幕上的小图放大
    const hi = maskCache.get(ed.page);
    const stackPage = stack.pages.find((p) => p.no === ed.page);
    const source = hi ? hi.canvas : stackPage ? stackPage.canvas : null;
    const sel = ed.regions.find((r) => r.id === ed.selectedId && r.page === ed.page);

    // 没选中时右栏不放大缩略图（那是左栏的活），只留区域列表
    if (sel) {
      previewHost.hidden = false;
      // 预览显示的就是导出结果：缩紧后的框再扩 margin
      const b = sel.box || sel.ink || boundsOf(sel);
      renderPreview(preview, {
        source,
        pageW,
        pageH,
        selectedId: sel.id,
        regions: regionsOfPage(ed.regions, ed.page),
        crop: b,
        poly: sel.shape === 'poly' ? sel.points : null,
        // 预览宽度永远跟着右栏走，别再写死 232 把栏撑出去
        maxW: Math.max(80, Math.floor(previewHost.clientWidth - 14)),
      });
    } else {
      previewHost.hidden = true;
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
        onZoom: (no) => openLightbox(no),
        thumbFor,
        cols: effectiveCols(),
      });
    }

    renderRegions(listHost, {
      regions: ed.regions,
      page: ed.page,
      selectedId: ed.selectedId,
      onSelect: selectRegion,
      onChange: (region, meta) => {
        // 打字时不重建列表，否则每敲一个字输入框就丢焦点
        if (meta && meta.quiet) return;
        record(null);
        refresh();
      },
      onThumb: regionThumb,
      onThumbClick: (region) => openFigureLightbox(region),
      onReorder: (fromId, toId) => reorderRegion(fromId, toId),
      onDelete: (region) => {
        const idx = ed.regions.indexOf(region);
        if (idx >= 0) ed.regions.splice(idx, 1);
        if (ed.selectedId === region.id) ed.selectedId = null;
        record(null);
        refresh();
      },
    });
  }

  function clampScrollX() {
    const root = stack.root;
    const max = Math.max(0, root.scrollWidth - root.clientWidth);
    if (root.scrollLeft > max + 1) root.scrollLeft = max;
  }

  function render() {
    clampScrollX();
    for (const [page, ov] of overlays) {
      drawRegions(ov, regionsOfPage(ed.regions, page), {
        selectedId: page === ed.page ? ed.selectedId : null,
        selected: page === ed.page ? ed.regions.find((r) => r.id === ed.selectedId) || null : null,
        draft: page === ed.page ? ed.draft : null,
        cursor: page === ed.page ? lastPt : null,
        scale: zoom.scale,
        margin: settings.margin,
      });
    }
    renderPanels();
  }

  const refresh = render;

  // 顶栏左簇：打开 → 撤销 → 重做（工具组是画布左上的浮层，不在这儿）
  // 优先用文件句柄打开：这样「最近打开」才能真的直接打开
  let pendingHandle = null;

  async function chooseFile() {
    if (hasPickHandle()) {
      const picked = await pickWithHandle();
      if (picked) {
        pendingHandle = picked.handle;
        return picked.file;
      }
      return null;
    }
    return pickFile();
  }

  addButton(shell, 'left', '打开', async () => {
    const file = await chooseFile();
    if (file) load(file);
  }, { title: '打开 PDF（Ctrl+O）', kind: 'btn' });

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
  dpiLabel.textContent = '分辨率 (DPI)';
  dpiLabel.appendChild(dpiInput);
  const marginLabel = doc.createElement('label');
  marginLabel.textContent = '边距 (pt)';
  marginLabel.appendChild(marginInput);
  settingsBox.append(dpiLabel, marginLabel);
  settingsBox.className = 'settings-inline';
  settingsBox.hidden = true;
  shell.right.insertBefore(settingsBox, shell.right.firstChild);

  dpiInput.addEventListener('change', () => {
    dpiInput.value = String(setDpi(settings, dpiInput.value));
    saveSettings(storage, settings);
  });
  marginInput.addEventListener('change', () => {
    marginInput.value = String(setMargin(settings, marginInput.value));
    saveSettings(storage, settings);
    remeasureAll();
  });

  let appearanceAnchor = null;
  const settingsBtn = addButton(shell, 'right', '设置', () => {
    settingsBox.hidden = !settingsBox.hidden;
  }, { title: '导出设置：边距 / DPI', ariaLabel: '导出设置', icon: ICONS.settings });
  appearanceAnchor = settingsBtn;

  // 配色：三个连体按钮（浅UI浅PDF / 深UI浅PDF / 深UI深PDF）
  const APPEARANCES = [
    { ui: 'light', pdf: 'normal', icon: ICONS.uiLight, title: '浅色界面 + 浅色 PDF' },
    { ui: 'dark', pdf: 'normal', icon: ICONS.uiAuto, title: '深色界面 + 浅色 PDF' },
    { ui: 'dark', pdf: 'invert', icon: ICONS.uiDark, title: '深色界面 + 深色 PDF' },
  ];

  const appearanceGroup = doc.createElement('div');
  appearanceGroup.className = 'seg';
  const appearanceBtns = APPEARANCES.map((item) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.innerHTML = item.icon;
    btn.title = item.title;
    btn.setAttribute('aria-label', item.title);
    btn.addEventListener('click', () => {
      theme.ui = item.ui;
      theme.pdf = item.pdf;
      applyColors();
    });
    appearanceGroup.appendChild(btn);
    return { btn, item };
  });
  // 配色组放在设置按钮右边
  if (appearanceAnchor && appearanceAnchor.nextSibling) {
    shell.right.insertBefore(appearanceGroup, appearanceAnchor.nextSibling);
  } else {
    shell.right.appendChild(appearanceGroup);
  }

  function syncColorButtons() {
    const ui = resolvedUi(theme, prefersDark());
    const inv = isInverted(theme, prefersDark());
    for (const { btn, item } of appearanceBtns) {
      const on = item.ui === ui && (item.pdf === 'invert') === inv;
      btn.classList.toggle('on', on);
    }
  }

  addButton(shell, 'right', '导出', () => doExport(), {
    title: '导出 ZIP (Ctrl+E)',
    ariaLabel: '导出',
    kind: 'btn',
    suggested: true,
    icon: ICONS.export,
  });

  // 浮动工具组：画布左上
  // 工具组放进顶栏（撤销/重做右边），不跟画布一起滚
  const toolGroup = doc.createElement('div');
  toolGroup.className = 'tool-group';
  shell.left.appendChild(toolGroup);

  const toolButtons = new Map();

  function markTool(tool) {
    for (const [name, btn] of toolButtons) btn.classList.toggle('is-active', name === tool);
    shell.canvas.dataset.tool = tool;
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

  toolButton(ICONS.select, '选择 (Q)', 'select');
  toolButton(ICONS.rect, '矩形 (W)', 'rect');
  toolButton(ICONS.poly, '多边形 (E)', 'poly');
  markTool(ed.tool);

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
    lastPt = hit.pt;
    pointerDown(ed, hit.pt);
    render();
  });

  // hover 反馈：手柄/顶点用 pointer，框体用 move，空白看工具
  // hover 反馈：手柄/顶点用 pointer，框体用 move，空白看工具
  function hoverCursor(ev) {
    if (state !== 'ready') return '';
    const hit = pointOf(ev);
    if (!hit) return '';
    const sel = ed.regions.find((r) => r.id === ed.selectedId && r.page === hit.no);
    if (sel) {
      if (sel.shape === 'rect') {
        if (cornerAt(sel.rect, hit.pt.x, hit.pt.y, 10)) return 'pointer';
        if (edgeAt(sel.rect, hit.pt.x, hit.pt.y, 10)) return 'pointer';
      } else if (vertexAt(sel.points, hit.pt.x, hit.pt.y, 10) >= 0) {
        return 'pointer';
      }
    }
    if (regionAt(ed, hit.pt)) return 'move';
    return 'default';
  }

  shell.canvas.addEventListener('pointermove', (ev) => {
    if (pan) {
      stack.root.scrollLeft = pan.left - (ev.clientX - pan.x);
      stack.root.scrollTop = pan.top - (ev.clientY - pan.y);
      return;
    }
    if (!drawing) {
      const cur = hoverCursor(ev);
      shell.canvas.style.cursor = cur;
      stack.root.style.cursor = cur;
      // 正在画多边形/矩形（还没松手）时，鼠标移动也要实时预览
      if (ed.draft) {
        const hit = pointOf(ev);
        if (hit && hit.no === ed.page) {
          lastPt = hit.pt;
          if (ed.draft.shape === 'rect') {
            ed.draft.x1 = hit.pt.x;
            ed.draft.y1 = hit.pt.y;
          }
          render();
        }
      }
      return;
    }
    if (state !== 'ready') return;
    const hit = pointOf(ev);
    if (!hit) return;
    lastPt = hit.pt;
    pointerMove(ed, hit.pt);
    // 拖动/改形状时橙框也要跟着变，不能等松手
    const live = ed.regions.find((r) => r.id === ed.selectedId);
    if (live && maskCache.has(live.page)) {
      if (!liveRaf) {
        liveRaf = requestAnimationFrame(() => {
          liveRaf = 0;
          const r2 = ed.regions.find((r) => r.id === ed.selectedId);
          if (r2 && maskCache.has(r2.page)) applyMeasure(r2, maskCache.get(r2.page));
          render();
        });
      }
    }
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
    if (snapshot() !== before) {
      record(null);
      measureRegion(ed.regions.find((r) => r.id === ed.selectedId));
    }
    render();
  });

  // 键盘缩放和滚轮/按钮共用同一张表（预设 + 实时页宽）
  function stepZoomTo(dir) {
    const list = stepList(fitWidthScale(fitDims()));
    const i = stepIndex(zoom.scale, list);
    setScale(zoom, list[Math.min(list.length - 1, Math.max(0, i + dir))]);
  }

  // ---- 快捷键：统一走 app/shortcuts 的键表 ----
  const fitDims = () => {
    const ov = overlays.get(ed.page);
    const el = stack.root;
    const cs = getComputedStyle(el);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    // 扣掉 padding 与滚动条，这样"适应宽度"不会撑出横向滚动条
    const scrollX = el.offsetWidth - el.clientWidth;
    const scrollY = el.offsetHeight - el.clientHeight;
    let vw = Math.max(1, el.clientWidth - padX - scrollX);
    // 双页并排时「适应页宽」要按半宽算，否则两页加起来必定溢出
    if (stack.view.dual) vw = Math.max(60, vw - 20) / 2;
    return {
      viewportW: Math.max(1, vw),
      viewportH: Math.max(1, el.clientHeight - padY - scrollY),
      pageW: ov ? ov.size.w : ed.pageW,
      pageH: ov ? ov.size.h : ed.pageH,
      padX: 0,
      padY: 0,
    };
  };

  // ---- 缩略图全屏查看 ----
  const lb = document.getElementById('lightbox');
  const lbCanvas = document.getElementById('lightbox-canvas');
  const lbNo = document.getElementById('lb-no');
  let lbPage = 1;
  let lbMode = 'page'; // 'page' = PDF 页预览，'figure' = 单个 figure 预览
  let lbFigures = [];
  let lbFigureIndex = 0;
  const lbView = { scale: 1, x: 0, y: 0 };
  const lbStage = document.getElementById('lightbox-stage');
  const lbZoomBtn = document.getElementById('lb-zoom');

  function lbApply() {
    lbCanvas.style.transform =
      'translate(' + lbView.x + 'px,' + lbView.y + 'px) scale(' + lbView.scale + ')';
    if (lbZoomBtn) lbZoomBtn.textContent = Math.round(lbView.scale * 100) + '%';
  }

  // 适应窗口：等比缩到刚好放下并居中
  function lbFit() {
    if (!lbStage || !lbCanvas.width) return;
    const sw = lbStage.clientWidth;
    const sh = lbStage.clientHeight;
    if (sw < 8 || sh < 8) {
      requestAnimationFrame(lbFit); // 布局还没算完
      return;
    }
    const fit = Math.min(sw / lbCanvas.width, sh / lbCanvas.height);
    lbView.scale = Math.min(1, fit) || 1;
    lbView.x = (sw - lbCanvas.width * lbView.scale) / 2;
    lbView.y = (sh - lbCanvas.height * lbView.scale) / 2;
    lbApply();
  }

  // 以某个屏幕点为锚缩放（滚轮/双击都走这里）
  function lbZoomAt(factor, clientX, clientY) {
    if (!lbStage) return;
    const rect = lbStage.getBoundingClientRect();
    const mx = (clientX === undefined ? rect.left + rect.width / 2 : clientX) - rect.left;
    const my = (clientY === undefined ? rect.top + rect.height / 2 : clientY) - rect.top;
    const next = Math.min(12, Math.max(0.05, lbView.scale * factor));
    const k = next / lbView.scale;
    lbView.x = mx - (mx - lbView.x) * k;
    lbView.y = my - (my - lbView.y) * k;
    lbView.scale = next;
    lbApply();
  }

  async function drawLightbox() {
    const p = stack.pages.find((x) => x.no === lbPage);
    if (!p) return;
    const vp1 = p.page.getViewport({ scale: 1 });
    const maxW = Math.min(window.innerWidth * 0.94, 1800);
    const scale = Math.min(4, maxW / vp1.width);
    const vp = p.page.getViewport({ scale });
    lbCanvas.width = Math.round(vp.width);
    lbCanvas.height = Math.round(vp.height);
    const ctx = lbCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lbCanvas.width, lbCanvas.height);
    await p.page.render({ canvasContext: ctx, viewport: vp }).promise;
    lbNo.textContent = lbPage + ' / ' + stack.pages.length;
    lbFit();
    syncLbArrows();
  }

  function syncLbArrows() {
    const prev = document.getElementById('lb-prev');
    const next = document.getElementById('lb-next');
    if (!prev || !next) return;
    const total = lbMode === 'figure' ? lbFigures.length : stack.pages.length;
    const idx = lbMode === 'figure' ? lbFigureIndex + 1 : lbPage;
    const atStart = idx <= 1;
    const atEnd = idx >= total;
    prev.classList.toggle('is-disabled', atStart);
    next.classList.toggle('is-disabled', atEnd);
  }

  function lbStep(dir) {
    if (lbMode === 'figure') {
      const next = lbFigureIndex + dir;
      if (next < 0 || next >= lbFigures.length) return;
      lbFigureIndex = next;
      openFigureLightbox(lbFigures[next]);
      return;
    }
    const next = lbPage + dir;
    if (next < 1 || next > stack.pages.length) return; // 到头就不重绘，避免闪
    lbPage = next;
    drawLightbox();
  }

  function openLightbox(no) {
    if (!lb) return;
    lbMode = 'page';
    lbPage = no;
    lb.hidden = false;
    const bar = document.querySelector('.lightbox-bar');
    if (bar) bar.style.display = '';
    drawLightbox();
    syncLbArrows();
  }

  // 右栏某个 figure 的全屏预览：按导出框裁好、按多边形蒙版涂白
  async function openFigureLightbox(region) {
    if (!lb || !region) return;
    const p = stack.pages.find((x) => x.no === region.page);
    const box = region.box || region.ink || (region.shape === 'poly' ? null : region.rect);
    if (!p || !box) {
      openLightbox(region.page);
      return;
    }
    lbMode = 'figure';
    lb.hidden = false;
    // 单图模式也能在 figure 之间翻
    lbFigures = ed.regions
      .slice()
      .sort((a, b) => a.page - b.page || (a.order || 0) - (b.order || 0));
    const idx = lbFigures.findIndex((r) => r.id === region.id);
    lbFigureIndex = idx >= 0 ? idx : 0;
    const bar = document.querySelector('.lightbox-bar');
    if (bar) bar.style.display = '';

    // 整页渲染到离屏画布（限制总像素），再裁出这块并放大到 ~1100px
    const vp1 = p.page.getViewport({ scale: 1 });
    const pageScale = Math.min(6, Math.max(1.5, 3200 / vp1.width));
    const vp = p.page.getViewport({ scale: pageScale });
    const off = doc.createElement('canvas');
    off.width = Math.round(vp.width);
    off.height = Math.round(vp.height);
    const offCtx = off.getContext('2d');
    offCtx.fillStyle = '#fff';
    offCtx.fillRect(0, 0, off.width, off.height);
    await p.page.render({ canvasContext: offCtx, viewport: vp }).promise;

    const w = Math.max(1, Math.round(Math.min(1600, Math.max(320, box.w * 3))));
    const h = Math.max(1, Math.round((box.h / box.w) * w));
    lbCanvas.width = w;
    lbCanvas.height = h;
    const ctx = lbCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (region.shape === 'poly' && region.points) {
      ctx.beginPath();
      region.points.forEach((pt, i) => {
        const x = ((pt.x - box.x) / box.w) * w;
        const y = ((pt.y - box.y) / box.h) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      off,
      box.x * pageScale,
      box.y * pageScale,
      box.w * pageScale,
      box.h * pageScale,
      0, 0, w, h
    );
    ctx.restore();
    lbNo.textContent = (lbFigureIndex + 1) + '/' + lbFigures.length + ' · ' + labelOfKind(region);
    lbFit();
    syncLbArrows();
  }



  function closeLightbox() {
    if (lb) lb.hidden = true;
  }

  if (lb) {
    // 滚轮：以光标为锚缩放
    lb.addEventListener('wheel', (ev) => {
      if (lb.hidden) return;
      ev.preventDefault();
      lbZoomAt(Math.exp(-ev.deltaY * 0.0018), ev.clientX, ev.clientY);
    }, { passive: false });

    // 拖动平移（任意缩放级别都能拖）
    let pan = null;
    lbStage.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      pan = { x: ev.clientX, y: ev.clientY, ox: lbView.x, oy: lbView.y };
      lbStage.classList.add('is-panning');
      if (lbStage.setPointerCapture) lbStage.setPointerCapture(ev.pointerId);
    });
    lbStage.addEventListener('pointermove', (ev) => {
      if (!pan) return;
      lbView.x = pan.ox + (ev.clientX - pan.x);
      lbView.y = pan.oy + (ev.clientY - pan.y);
      lbApply();
    });
    const endPan = () => {
      pan = null;
      lbStage.classList.remove('is-panning');
    };
    lbStage.addEventListener('pointerup', endPan);
    lbStage.addEventListener('pointercancel', endPan);

    // 双击：100% ↔ 适应窗口
    lbStage.addEventListener('dblclick', (ev) => {
      if (Math.abs(lbView.scale - 1) < 0.01) lbFit();
      else lbZoomAt(1 / lbView.scale, ev.clientX, ev.clientY);
    });

    lb.addEventListener('click', (ev) => {
      if (ev.target === lb || ev.target === lbStage) closeLightbox();
    });
    document.addEventListener('keydown', (ev) => {
      if (lb.hidden) return;
      if (ev.key === 'Escape') {
        closeLightbox();
        ev.preventDefault();
        return;
      }
      if (ev.key === 'ArrowLeft') lbStep(-1);
      else if (ev.key === 'ArrowRight') lbStep(1);
      else if (ev.key === '+' || ev.key === '=') lbZoomAt(1.15);
      else if (ev.key === '-' || ev.key === '_') lbZoomAt(1 / 1.15);
      else if (ev.key === '0') lbFit();
      else return;
      ev.preventDefault();
    });
    document.getElementById('lb-prev').addEventListener('click', () => lbStep(-1));
    document.getElementById('lb-next').addEventListener('click', () => lbStep(1));
    document.getElementById('lb-zoom-in').addEventListener('click', () => lbZoomAt(1.2));
    document.getElementById('lb-zoom-out').addEventListener('click', () => lbZoomAt(1 / 1.2));
    document.getElementById('lb-zoom').addEventListener('click', () => lbZoomAt(1 / lbView.scale));
    document.getElementById('lb-fit').addEventListener('click', () => lbFit());
    document.getElementById('lb-close').addEventListener('click', () => closeLightbox());
  }

  function goPage(no) {
    const total = stack.pages.length || 1;
    const next = Math.min(Math.max(1, no), total);
    stack.setCurrent(next);
    pageMask(next); // 预热，画框时能同步缩紧
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
    'zoom.in': () => stepZoomTo(1),
    'zoom.out': () => stepZoomTo(-1),
    'zoom.reset': () => setScale(zoom, 1),
    'zoom.fitPage': () => setFit(zoom, 'width', fitDims()),
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
      if (nudge(ed, v.dx, v.dy)) {
        record('nudge');
        measureRegion(ed.regions.find((r) => r.id === ed.selectedId));
        render();
      }
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

  // Ctrl+滚轮：以指针为锚点缩放。事件按帧合并，trackpad 再密也只算一次。
  let wheelAcc = 0;
  let wheelPoint = null;
  let wheelRaf = 0;

  function applyWheel() {
    wheelRaf = 0;
    if (!wheelPoint || Math.abs(wheelAcc) < 10 || state !== 'ready') return;
    const root = stack.root;
    const from = zoom.scale;
    const dir = wheelAcc < 0 ? 1 : -1;
    wheelAcc = 0;
    // 档位表 = 预设 + 实时页宽比例，绝不会停在 143% 这种半吊子值
    const list = stepList(fitWidthScale(fitDims()));
    const i = stepIndex(from, list);
    const to = list[Math.min(list.length - 1, Math.max(0, i + dir))];
    if (Math.abs(to - from) < 1e-6) return;
    setScale(zoom, to);
    stack.setVisualScale(zoom.scale);
    stack.scheduleZoom();
    const next = anchorAt({ x: root.scrollLeft, y: root.scrollTop }, wheelPoint.x, wheelPoint.y, from, zoom.scale);
    root.scrollLeft = next.x;
    root.scrollTop = next.y;
  }

  shell.canvas.addEventListener('wheel', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || state !== 'ready') return;
    ev.preventDefault();
    const root = stack.root;
    const box = root.getBoundingClientRect();
    wheelPoint = { x: ev.clientX - box.left, y: ev.clientY - box.top };
    wheelAcc += ev.deltaY;
    if (!wheelRaf) wheelRaf = requestAnimationFrame(applyWheel);
  }, { passive: false });

  // 滚动时当前页跟着走（右栏预览与列表要跟着变）
  stack.root.addEventListener('scroll', () => {
    if (state !== 'ready') return;
    const rects = stack.visibleRects();
    const viewportTop = shell.canvas.getBoundingClientRect().top + 8;
    stack.scheduleZoom(); // 滚到的新页需要补渲染
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

      // 换文件：所有按文档缓存的东西必须清掉，否则新文件会显示上一份的掩膜/预览
      maskCache.clear();
      ed.regions = [];
      ed.selectedId = null;
      ed.nextId = 1;
      ed.draft = null;
      ed.page = 1;
      hist.past.length = 0;
      hist.future.length = 0;
      hist.present = snapshot();

      // 恢复这份 PDF 之前的标注
      currentKey = keyForFile(file.name, file.size);
      const saved = storage ? loadConfig(storage, currentKey) : null;
      if (saved && saved.pages) {
        const back = flattenPages(saved.pages);
        ed.regions = back.regions;
        ed.nextId = back.nextId;
        hist.present = snapshot();
      }

      // 手机上先给「适应页宽」，不然 A4 一屏放不下还得左右拖
      if (typeof window !== 'undefined' && window.innerWidth < 720 && zoom.mode === 'free') {
        setFit(zoom, 'width', fitDims());
      }
      render();
      pageMask(1); // 预热首页掩膜
      setTitle(shell, file.name + ' · ' + n + ' 页');
      pushRecent({ name: file.name, size: file.size, pages: n, ts: Date.now() });
      if (pendingHandle) {
        saveHandle(file.name, file.size, pendingHandle);
        pendingHandle = null;
      }
      // 顺手缓存原字节，下次不依赖句柄权限
      if (file && file.arrayBuffer) {
        file.arrayBuffer().then((buf) => cacheBytes(file.name, file.size, buf)).catch(() => {});
      }
      state = 'ready';
    } catch (e) {
      state = 'error';
      toast('打开失败：' + (e && e.message ? e.message : e));
      setEmpty(shell, true);
    }
  };

  // 适应页面/适应页宽/自动：窗口或侧栏一变就重新算，别等用户再点一次
  function refitIfNeeded() {
    if (!(zoom.auto || zoom.mode === 'width')) return;
    const auto = zoom.auto;
    setFit(zoom, 'width', fitDims());
    zoom.auto = auto;
  }

  let refitTimer = 0;
  const scheduleRefit = () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refitIfNeeded, 60);
  };

  window.addEventListener('resize', scheduleRefit);

  applyColors();
  acceptDrop(shell.canvas, (file) => load(file));
  subscribe(zoom, () => {
    stack.setVisualScale(zoom.scale);
    stack.scheduleZoom();
    // 缩放停稳后把文本层重排，保证透明文字始终贴在字上
    clearTimeout(refreshTextTimer);
    refreshTextTimer = setTimeout(() => stack.refreshTextLayers(), 320);
  });

  // ---- 最近打开（启动时在中间列出来） ----
  const RECENT_KEY = 'figcut.recent';

  function readRecent() {
    try {
      const raw = storage && storage.getItem(RECENT_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function pushRecent(entry) {
    const list = readRecent().filter((x) => !(x.name === entry.name && x.size === entry.size));
    list.unshift(entry);
    const keep = list.slice(0, 8);
    const dropped = list.slice(8);
    try {
      storage && storage.setItem(RECENT_KEY, JSON.stringify(keep));
    } catch (e) {
      /* 存不下无所谓 */
    }
    // 被挤出最近列表的，缓存字节也一起清掉（40MB×N 不能无限攒）
    for (const old of dropped) forgetFile(old.name, old.size);
    renderRecent();
  }

  function renderRecent() {
    const host = document.getElementById('recent');
    if (!host) return;
    const list = readRecent();
    host.textContent = '';
    if (list.length === 0) return;

    const head = doc.createElement('div');
    head.className = 'recent-head';
    head.textContent = '最近打开';
    host.appendChild(head);

    for (const item of list) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'recent-item';

      const name = doc.createElement('span');
      name.className = 'name';
      name.textContent = item.name;

      const meta = doc.createElement('span');
      meta.className = 'meta';
      meta.textContent = (item.pages || '?') + ' 页';

      btn.append(name, meta);
      btn.addEventListener('click', async () => {
        // 句柄或缓存字节都能直接开；都没有才让用户再选一次
        const direct = await openRecent(item);
        if (direct) {
          load(direct);
          return;
        }
        toast('这一份需要重新选择一次（浏览器不允许静默读取）');
        const file = await chooseFile();
        if (file) load(file);
      });
      host.appendChild(btn);
    }
  }

  renderRecent();

  // ---- 侧栏拖拽 / 折叠（宽度记在 localStorage） ----
  const LAYOUT_KEY = 'figcut.layout';
  const layout = (() => {
    let saved = null;
    try {
      saved = storage && storage.getItem(LAYOUT_KEY);
      const parsed = JSON.parse(saved || '{}') || {};
      // 第一次在小屏打开：默认收起侧栏，先把页面给出来
      if (!saved && typeof window !== 'undefined') {
        const vw = window.innerWidth;
        if (vw < 900) parsed.leftCollapsed = true;
        if (vw < 720) parsed.rightCollapsed = true;
        if (vw < 720) parsed.sideCols = 1;
      }
      return parsed;
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

  const COLLAPSED_W = 48;
  let leftFoot = null;
  let rightFoot = null;
  let railTools = null;

  function applyLayout() {
    const root = document.documentElement;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1400;
    // 保证中间画布至少 420px，侧栏再大也不许把画布挤没
    const minCanvas = 420;
    const wantSide = layout.side || 210;
    const wantPanel = layout.panel || 210;
    const avail = Math.max(240, vw - minCanvas - 10);
    let side = wantSide;
    let panel = wantPanel;
    if (side + panel > avail) {
      const k = avail / (side + panel);
      side = Math.max(120, Math.floor(side * k));
      panel = Math.max(160, Math.floor(panel * k));
    }
    root.style.setProperty('--w-side', (layout.leftCollapsed ? COLLAPSED_W : side) + 'px');
    // 收起时把 QWE 工具竖排到窄条里
    if (railTools && toolGroup) {
      if (layout.leftCollapsed) {
        railTools.hidden = false;
        railTools.appendChild(toolGroup);
      } else {
        railTools.hidden = true;
        shell.left.appendChild(toolGroup);
      }
    }
    paintFoot(leftFoot, !!layout.leftCollapsed, 'left');
    paintFoot(rightFoot, !!layout.rightCollapsed, 'right');
    root.style.setProperty('--w-panel', (layout.rightCollapsed ? COLLAPSED_W : panel) + 'px');
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
      const vw = window.innerWidth;
      const min = side === 'left' ? 120 : 180;
      const max = side === 'left' ? 360 : Math.max(240, Math.min(560, Math.floor(vw * 0.45)));
      const w = Math.round(Math.max(min, Math.min(max, raw)));
      if (side === 'left') {
        layout.side = w;
        layout.leftCollapsed = false;
      } else {
        layout.panel = w;
        layout.rightCollapsed = false;
      }
      applyLayout();
      updateColsBtn && updateColsBtn();
      lastListSig = '';
      render();
      scheduleRefit();
      saveLayout();
    });
    const end = () => {
      start = null;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 双击 = 恢复默认宽度（不再切折叠，折叠交给栏底按钮）
    el.addEventListener('dblclick', () => {
      if (side === 'left') {
        layout.side = 210;
        layout.leftCollapsed = false;
      } else {
        layout.panel = 210;
        layout.rightCollapsed = false;
      }
      applyLayout();
      lastListSig = '';
      render();
      scheduleRefit();
      saveLayout();
    });
  }

  bindSplitter(document.getElementById('split-left'), 'left');
  bindSplitter(document.getElementById('split-right'), 'right');

  // 左栏页头：全览 + 单/双列
  const sideHead = document.getElementById('side-head');
  let colsBtn = null;
  if (sideHead) {
    const gallery = doc.createElement('button');
    gallery.type = 'button';
    gallery.className = 'icon-btn';
    gallery.innerHTML = ICONS.grid;
    gallery.title = '预览全部页面';
    gallery.addEventListener('click', () => openLightbox(ed.page));
    sideHead.appendChild(gallery);

    colsBtn = doc.createElement('button');
    colsBtn.type = 'button';
    colsBtn.className = 'icon-btn';
    colsBtn.innerHTML = ICONS.columns;
    sideHead.appendChild(colsBtn);
    colsBtn.addEventListener('click', () => {
      // 只切列数，绝不改左栏宽度
      layout.sideCols = layout.sideCols === 2 ? 1 : 2;
      applyLayout();
      updateColsBtn();
      lastListSig = ''; // 列表结构变了，强制重建
      refresh();
      scheduleRefit();
      saveLayout();
    });
  }

  const DOUBLE_MIN = 288;

  function effectiveCols() {
    return layout.sideCols === 2 ? 2 : 1;
  }

  function updateColsBtn() {
    if (!colsBtn) return;
    const double = layout.sideCols === 2;
    colsBtn.disabled = false;
    colsBtn.classList.toggle('is-active', double);
    colsBtn.title = double ? '切回单列' : '切到双列';
  }

  // 折叠按钮固定在栏底：展开时「|← 收起侧边栏」，收起时只留图标
  leftFoot = document.getElementById('toggle-left');
  rightFoot = document.getElementById('toggle-right');
  railTools = document.getElementById('rail-tools');

  function paintFoot(btn, collapsed, side) {
    if (!btn) return;
    const icon = side === 'left'
      ? collapsed ? ICONS.sidebarRight : ICONS.sidebarLeft
      : collapsed ? ICONS.sidebarLeft : ICONS.sidebarRight;
    const iconEl = btn.querySelector('.foot-icon');
    const labelEl = btn.querySelector('.foot-label');
    if (iconEl) iconEl.innerHTML = icon;
    if (labelEl) labelEl.textContent = '收起侧边栏';
    btn.title = collapsed ? '展开侧边栏' : '收起侧边栏';
  }

  const flipLeft = () => {
    layout.leftCollapsed = !layout.leftCollapsed;
    applyLayout();
    saveLayout();
    scheduleRefit();
  };
  const flipRight = () => {
    layout.rightCollapsed = !layout.rightCollapsed;
    applyLayout();
    saveLayout();
    scheduleRefit();
  };
  if (leftFoot) leftFoot.addEventListener('click', flipLeft);
  if (rightFoot) rightFoot.addEventListener('click', flipRight);

  // 首次 applyLayout 时这些按钮还没建好，这里补刷一次
  applyLayout();

  updateColsBtn && updateColsBtn();



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
