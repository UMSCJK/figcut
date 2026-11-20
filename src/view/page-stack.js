// 连续滚动页栈：所有页从上到下，当前页可编辑
// 状态：已实现（依赖浏览器 canvas）。

import { figcutError } from '../core/errors.js';
import { renderPage } from '../pdf/bitmap.js';

export function createPageStack(opts) {
  const container = opts.container;
  const zoom = opts.zoom;
  if (!container || !container.ownerDocument) throw figcutError('no-dom', '页栈需要 DOM 容器');

  const doc = container.ownerDocument;
  // 页都放进自己的滚动根里，别碰容器里别的东西（缩放控件就挂在容器上）
  const root = doc.createElement('div');
  root.className = 'pages';
  container.appendChild(root);
  const pages = [];
  let pdfDoc = null;
  let current = 1;
  let token = 0;
  let busy = Promise.resolve();

  async function applyZoom() {
    if (!pdfDoc) return;
    const my = ++token;
    const scale = zoom.scale;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

    for (const p of pages) {
      if (my !== token) return; // 有更新的缩放，丢弃这一轮
      const vp = p.page.getViewport({ scale });
      p.canvas.style.width = Math.round(vp.width) + 'px';
      p.canvas.style.height = Math.round(vp.height) + 'px';
      p.overlay.style.width = Math.round(vp.width) + 'px';
      p.overlay.style.height = Math.round(vp.height) + 'px';
      await renderPage(p.page, { scale, dpr, canvas: p.canvas });
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
      root.appendChild(wrap);

      const page = await newDoc.pdf.getPage(no);
      pages.push({ no, wrap, canvas, overlay, page });
    }

    busy = applyZoom();
    await busy;
    setCurrent(current);
    return pages.length;
  }

  function setCurrent(no) {
    current = no;
    for (const p of pages) p.wrap.classList.toggle('is-current', p.no === no);
    const target = pages.find((p) => p.no === no);
    if (target && target.wrap.scrollIntoView) target.wrap.scrollIntoView({ block: 'start', inline: 'nearest' });
    return current;
  }

  function visibleRects() {
    return pages.map((p) => {
      const r = p.wrap.getBoundingClientRect();
      return { no: p.no, top: r.top, height: r.height };
    });
  }

  return {
    pages,
    mount,
    setCurrent,
    visibleRects,
    applyZoom: () => {
      busy = busy.then(applyZoom);
      return busy;
    },
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
