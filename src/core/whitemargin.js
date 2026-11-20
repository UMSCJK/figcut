/* 导出框 = 手画多边形内部"非白像素"的最小外接矩形，再每边加边距。
   这就是 v2 的语义，也是这个工具真正的核心：
     - 不猜笔画归属：框里但凡有非白像素（哪怕是文字、哪怕只擦到 1pt），都会算进外接框。
       所以框要人来画准——"拖矩形会把文字圈进来"是设计前提，不是 bug。
     - 不做纯白吸附：外接框本身就是紧的；纯白四边由 margin 提供。
   坐标：进来 pt，内部 px，出去 pt。 */

export const INK_T = 246;   // 任一通道低于它就算非白
export const MIN_ALPHA = 8;

export function rectToPoly(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

// 多边形在第 yc 行命中的 x 区间（偶奇规则）
function spansAt(poly, s, yc) {
  const xs = [];
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const yi = poly[i].y * s;
    const yj = poly[j].y * s;
    if (yi > yc === yj > yc) continue;
    const xi = poly[i].x * s;
    const xj = poly[j].x * s;
    xs.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
  return out;
}

// 掩膜内非白像素的最小外接框（px）。掩膜没有则返回 null。
export function inkBounds(mask, shape) {
  const poly = Array.isArray(shape) ? shape : rectToPoly(shape);
  if (poly.length < 3) return null;
  const s = mask.pxPerPt;
  const { w, h, data } = mask;

  let top = Infinity;
  let bot = -Infinity;
  for (const p of poly) {
    if (p.y < top) top = p.y;
    if (p.y > bot) bot = p.y;
  }
  const y0 = Math.max(0, Math.floor(top * s));
  const y1 = Math.min(h - 1, Math.ceil(bot * s));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let py = y0; py <= y1; py += 1) {
    const spans = spansAt(poly, s, py + 0.5);
    if (spans.length === 0) continue;
    const base = py * w;
    let rowHit = false;
    for (const [xa, xb] of spans) {
      const a = Math.max(0, Math.ceil(xa));
      const b = Math.min(w - 1, Math.floor(xb - 0.001));
      for (let px = a; px <= b; px += 1) {
        if (!data[base + px]) continue;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        rowHit = true;
      }
    }
    if (rowHit) {
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

// 导出框（pt）：框内非白像素的外接矩形；框里全白返回 null。
export function computeExportBox(mask, shape) {
  const b = inkBounds(mask, shape);
  if (!b) return null;
  const s = mask.pxPerPt;
  return {
    x: b.minX / s,
    y: b.minY / s,
    w: (b.maxX - b.minX + 1) / s,
    h: (b.maxY - b.minY + 1) / s,
  };
}

// 每边加边距，夹在页内
export function withMargin(box, margin, pageW, pageH) {
  const m = margin > 0 ? margin : 0;
  const x0 = Math.max(0, box.x - m);
  const y0 = Math.max(0, box.y - m);
  const x1 = Math.min(pageW, box.x + box.w + m);
  const y1 = Math.min(pageH, box.y + box.h + m);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 对齐到导出像素网格：向内取整，不重采样
export function cropRect(box, pageW, pageH, scale) {
  const pxW = Math.max(1, Math.round(pageW * scale));
  const pxH = Math.max(1, Math.round(pageH * scale));
  const clampPx = (v, hi) => Math.min(hi, Math.max(0, v));

  const x0 = clampPx(Math.ceil(box.x * scale - 1e-6), pxW - 1);
  const y0 = clampPx(Math.ceil(box.y * scale - 1e-6), pxH - 1);
  const x1 = clampPx(Math.max(Math.floor((box.x + box.w) * scale + 1e-6), x0 + 1), pxW);
  const y1 = clampPx(Math.max(Math.floor((box.y + box.h) * scale + 1e-6), y0 + 1), pxH);

  return { px: [x0, y0, x1, y1], x: x0 / scale, y: y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
}

export function isWhiteRow(mask, y, x0 = 0, x1 = mask.w) {
  if (y < 0 || y >= mask.h) return true;
  const a = Math.max(0, Math.floor(x0));
  const b = Math.min(mask.w, Math.ceil(x1));
  for (let x = a; x < b; x += 1) if (mask.data[y * mask.w + x] !== 0) return false;
  return true;
}

export function isWhiteCol(mask, x, y0 = 0, y1 = mask.h) {
  if (x < 0 || x >= mask.w) return true;
  const a = Math.max(0, Math.floor(y0));
  const b = Math.min(mask.h, Math.ceil(y1));
  for (let y = a; y < b; y += 1) if (mask.data[y * mask.w + x] !== 0) return false;
  return true;
}

// 标签只能落在纯白处（导出时可选画题号/选项字母）
export function findLabelSpot(mask, labelRect, candidates) {
  const s = mask.pxPerPt;
  for (const c of candidates) {
    const x = Math.round(c.x * s);
    const y = Math.round(c.y * s);
    const w = Math.round(labelRect.w * s);
    const h = Math.round(labelRect.h * s);
    if (x < 0 || y < 0 || x + w > mask.w || y + h > mask.h) continue;
    let clear = true;
    for (let j = 0; j < h && clear; j += 1) {
      for (let i = 0; i < w; i += 1) {
        if (mask.data[(y + j) * mask.w + (x + i)] !== 0) { clear = false; break; }
      }
    }
    if (clear) return { x: c.x, y: c.y };
  }
  return null;
}
