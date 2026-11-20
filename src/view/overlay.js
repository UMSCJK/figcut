// 每页选框覆盖层：SVG 画框，editor 负责逻辑，这里只画。
// 状态：已实现。

import { boundsOf } from './editor.js';

const NS = 'http://www.w3.org/2000/svg';

export function createOverlay(pageEl, size) {
  const doc = pageEl.ownerDocument;
  const host = pageEl.querySelector('.page-overlay');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'regions');
  svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
  svg.setAttribute('preserveAspectRatio', 'none');
  host.appendChild(svg);
  return { svg, size };
}

function put(parent, node) {
  parent.appendChild(node);
  return node;
}

// 手柄按屏幕像素算大小：pt 尺寸 = 像素 / 当前倍率，缩放到多大都一个手感。
function addHandle(doc, parent, x, y, size, cls) {
  const h = doc.createElementNS(NS, 'rect');
  h.setAttribute('x', x - size / 2);
  h.setAttribute('y', y - size / 2);
  h.setAttribute('width', size);
  h.setAttribute('height', size);
  h.setAttribute('class', 'handle ' + cls);
  parent.appendChild(h);
  return h;
}

function addHandles(doc, parent, sel, scale) {
  const size = 8 / Math.max(0.05, scale);
  if (sel.shape === 'poly') {
    for (const p of sel.points) addHandle(doc, parent, p.x, p.y, size * 0.8, 'is-poly');
    return;
  }
  const r = sel.rect;
  addHandle(doc, parent, r.x, r.y, size, 'is-nw');
  addHandle(doc, parent, r.x + r.w, r.y, size, 'is-ne');
  addHandle(doc, parent, r.x, r.y + r.h, size, 'is-sw');
  addHandle(doc, parent, r.x + r.w, r.y + r.h, size, 'is-se');
}

export function drawRegions(overlay, regions, opts = {}) {
  const doc = overlay.svg.ownerDocument;
  while (overlay.svg.firstChild) overlay.svg.removeChild(overlay.svg.firstChild);

  for (const r of regions) {
    const cls = 'region' + (r.id === opts.selectedId ? ' is-selected' : '');
    if (r.shape === 'poly') {
      const poly = doc.createElementNS(NS, 'polygon');
      poly.setAttribute('points', r.points.map((p) => p.x + ',' + p.y).join(' '));
      poly.setAttribute('class', cls);
      put(overlay.svg, poly);
    } else {
      const rect = doc.createElementNS(NS, 'rect');
      rect.setAttribute('x', r.rect.x);
      rect.setAttribute('y', r.rect.y);
      rect.setAttribute('width', r.rect.w);
      rect.setAttribute('height', r.rect.h);
      rect.setAttribute('class', cls);
      put(overlay.svg, rect);
    }
  }

  // 选中态画手柄，能拖哪儿一眼看得出
  if (opts.selected) addHandles(doc, overlay.svg, opts.selected, opts.scale || 1);

  // 真正会导出的框：缩紧到墨迹后再扩 margin，虚线画出来
  const box = opts.selected && (opts.selected.box || opts.selected.ink);
  if (box) {
    const crop = doc.createElementNS(NS, 'rect');
    crop.setAttribute('x', box.x);
    crop.setAttribute('y', box.y);
    crop.setAttribute('width', box.w);
    crop.setAttribute('height', box.h);
    crop.setAttribute('class', 'cropbox');
    overlay.svg.appendChild(crop);
  }

  const draft = opts.draft;
  if (draft && draft.shape === 'rect') {
    const x = Math.min(draft.x0, draft.x1);
    const y = Math.min(draft.y0, draft.y1);
    const rect = doc.createElementNS(NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', Math.abs(draft.x1 - draft.x0));
    rect.setAttribute('height', Math.abs(draft.y1 - draft.y0));
    rect.setAttribute('class', 'draft-rect');
    put(overlay.svg, rect);
  } else if (draft && draft.shape === 'poly' && draft.points.length > 0) {
    // 已落下的点 + 折线 + 到光标的橡皮筋
    const pts = draft.points;
    if (pts.length > 1) {
      const line = doc.createElementNS(NS, 'polyline');
      line.setAttribute('points', pts.map((p) => p.x + ',' + p.y).join(' '));
      line.setAttribute('class', 'draft-line');
      put(overlay.svg, line);
    }
    if (opts.cursor) {
      const last = pts[pts.length - 1];
      const band = doc.createElementNS(NS, 'line');
      band.setAttribute('x1', last.x);
      band.setAttribute('y1', last.y);
      band.setAttribute('x2', opts.cursor.x);
      band.setAttribute('y2', opts.cursor.y);
      band.setAttribute('class', 'draft-line');
      band.setAttribute('opacity', '0.7');
      put(overlay.svg, band);
    }
    for (const p of pts) {
      const dot = doc.createElementNS(NS, 'circle');
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      dot.setAttribute('r', 8 / Math.max(0.05, opts.scale || 1));
      dot.setAttribute('class', 'draft-dot');
      put(overlay.svg, dot);
    }
  }
}

// 命中测试交给 editor；这里只把当前页的框挑出来画。
export function regionsOfPage(regions, page) {
  return regions.filter((r) => r.page === page);
}

export function hitTest(ed, pt, regionAtFn) {
  return regionAtFn(ed, pt);
}

export { boundsOf };
