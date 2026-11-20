// 连续/分页滚动 + 单页/双页排版
// 状态：已实现（依赖浏览器 canvas）。当前页只有一页可编辑，其余页只显示。

import { figcutError } from '../core/errors.js';
import { renderPage } from '../pdf/bitmap.js';
import { pageCombos } from '../core/layout.js';

export function createPageStack(opts) {
  const container = opts.container;
  const zoom = opts.zoom;
  if (!container || !container.ownerDocument) throw figcutError('no-dom', '页栈需要 DOM 容器');

  const doc = container.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'pages';
  container.appendChild(root);

  const pages = [];
  let pdfDoc = null;
  let current = 1;
  let token = 0;
  let busy = Promise.resolve();

  // 视图状态：单/双页、奇偶、连续/分页
  const view = { dual: false, oddLeft: false, continuous: true };

  // 缩放立刻给视觉反馈（CSS transform），真正的重绘防抖，避免 trackpad 缩放时闪
  let visualScale = null;
  function setVisualScale(scale) {
    const base = pages.find((p) => p.renderedScale)?.renderedScale;
    if (!base) return;
    visualScale = scale;
    const k = scale / base;
    for (const p of pages) {
      p.wrap.style.transformOrigin = '0 0';
      p.wrap.style.transform = Math.abs(k - 1) < 0.002 ? '' : 'scale(' + k + ')';
    }
  }

  let renderTimer = null;
  function scheduleZoom() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      busy = busy.then(applyZoom);
    }, 220);
  }

  async function applyZoom() {
    if (!pdfDoc) return;
    const my = ++token;
    const scale = zoom.scale;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

    const host = container.getBoundingClientRect();
    const near = (p) => {
      const r = p.wrap.getBoundingClientRect();
      return r.bottom > host.top - 800 && r.top < host.bottom + 800;
    };

    // 先画当前页，其余页随后，避免切页后等所有页一起渲染
    const ordered = pages.slice().sort((a, b) => (b.no === current ? 1 : 0) - (a.no === current ? 1 : 0));

    for (const p of ordered) {
      if (my !== token) return;
      // 只画视口附近的页；远处的先留着旧位图，等滚回来再补（滚动手势里会再触发）
      if (!near(p) && p.renderedScale) continue;
      const vp = p.page.getViewport({ scale });
      p.wrap.style.transform = '';
      p.renderedScale = scale;
      p.canvas.style.width = Math.round(vp.width) + 'px';
      p.canvas.style.height = Math.round(vp.height) + 'px';
      p.overlay.style.width = Math.round(vp.width) + 'px';
      p.overlay.style.height = Math.round(vp.height) + 'px';
      await renderPage(p.page, { scale, dpr, canvas: p.canvas });
    }
  }

  function rowIndexOf(no) {
    const rows = pageCombos(pages.length, view);
    for (let i = 0; i < rows.length; i += 1) if (rows[i].includes(no)) return i;
    return 0;
  }

  function buildRows() {
    const rows = pageCombos(pages.length, view);
    root.textContent = '';
    rows.forEach((row, i) => {
      const rowEl = doc.createElement('div');
      rowEl.className = 'page-row';
      rowEl.dataset.row = String(i);
      // 书式：第 1 页单独在右；末页落单时在左
      if (view.dual && row.length === 1) {
        rowEl.dataset.single = row[0] === 1 ? 'right' : 'left';
      }
      for (const no of row) {
        const p = pages[no - 1];
        if (p) rowEl.appendChild(p.wrap);
      }
      root.appendChild(rowEl);
    });
    syncVisibility();
  }

  function syncVisibility() {
    const cur = rowIndexOf(current);
    for (const rowEl of root.children) {
      const isCur = Number(rowEl.dataset.row) === cur;
      rowEl.classList.toggle('is-current', isCur);
      rowEl.style.display = view.continuous || isCur ? '' : 'none';
    }
  }

  async function mount(newDoc) {
    pdfDoc = newDoc;
    root.textContent = '';
    pages.length = 0;
    token += 1;

    for (let no = 1; no <= newDoc.pages; no += 1) {
      const wrap = doc.createElement('div');
      wrap.className = 'page';
      wrap.dataset.page = String(no);

      const canvas = doc.createElement('canvas');
      const overlay = doc.createElement('div');
      overlay.className = 'page-overlay';

      wrap.append(canvas, overlay);
      pages.push({ no, wrap, canvas, overlay, page: null });
    }

    for (const p of pages) {
      p.page = await newDoc.pdf.getPage(p.no);
    }

    buildRows();
    busy = applyZoom();
    await busy;
    setCurrent(current);
    return pages.length;
  }

  function setCurrent(no) {
    current = no;
    for (const p of pages) p.wrap.classList.toggle('is-current', p.no === no);
    syncVisibility();
    const target = pages.find((p) => p.no === no);
    if (target && target.wrap.scrollIntoView) target.wrap.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return current;
  }

  function applyLayout(next) {
    if (next.dual !== undefined) view.dual = !!next.dual;
    if (next.oddLeft !== undefined) view.oddLeft = !!next.oddLeft;
    if (next.continuous !== undefined) view.continuous = !!next.continuous;
    if (view.dual && view.oddLeft === undefined) view.oddLeft = false;
    buildRows();
    return { ...view };
  }

  function visibleRects() {
    return pages.map((p) => {
      const r = p.wrap.getBoundingClientRect();
      return { no: p.no, top: r.top, height: r.height };
    });
  }

  return {
    root,
    pages,
    view,
    mount,
    setCurrent,
    applyLayout,
    visibleRects,
    applyZoom: () => {
      busy = busy.then(applyZoom);
      return busy;
    },
    setVisualScale,
    scheduleZoom,
    get current() {
      return current;
    },
  };
}

export function setCurrent(stack, no) {
  return stack.setCurrent(no);
}

export function visibleRects(stack) {
  return stack.visibleRects();
}
