/* 导出框 = 手画选区（钢笔或矩形）**填充成矩形**后，取该矩形内非白像素的最小外接框，
   再每边加边距。这是需求里写死的链路：
     钢笔框选 → 填充为矩形 → 收缩背景至非白色像素 → 扩展 margin
   三条硬约束：
     - 多边形只用来定"看哪一块"，导出永远是一个完整的矩形图，不做多边形蒙版
       （蒙版会把跨边的墨迹切掉，图就不完整了）。
     - 不做纯白吸附：外接框本身就是紧的；纯白四边由 margin 提供。
     - 不猜笔画归属：框里有什么非白像素就算什么，框要人画准。
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

// 8 连通标注（只标墨迹，不区分文字）
export function labelInk(mask, minArea = 4) {
  const { w, h, data } = mask;
  const lab = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const comps = [];
  let id = 0;

  for (let p = 0; p < lab.length; p += 1) {
    if (lab[p] || !data[p]) continue;
    id += 1;
    let sp = 0;
    stack[sp++] = p;
    lab[p] = id;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let total = 0;

    while (sp) {
      const q = stack[--sp];
      const x = q % w;
      const y = (q / w) | 0;
      total += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nq = ny * w + nx;
          if (!lab[nq] && data[nq]) {
            lab[nq] = id;
            stack[sp++] = nq;
          }
        }
      }
    }

    if (total >= minArea) comps.push({ id, minX, minY, maxX, maxY, total });
  }
  return comps;
}

// 与选区相交的笔画整根纳入（跨出框的线不会被切断），返回并集外接框
export function contentBounds(mask, rect) {
  const s = mask.pxPerPt;
  const x0 = Math.max(0, Math.floor(rect.x * s));
  const y0 = Math.max(0, Math.floor(rect.y * s));
  const x1 = Math.min(mask.w - 1, Math.ceil((rect.x + rect.w) * s) - 1);
  const y1 = Math.min(mask.h - 1, Math.ceil((rect.y + rect.h) * s) - 1);
  if (x1 < x0 || y1 < y0) return null;

  const comps = labelInk(mask);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hit = 0;

  for (const c of comps) {
    if (c.maxX < x0 || c.minX > x1 || c.maxY < y0 || c.minY > y1) continue;
    // 只在框边擦过 1px 的碎屑不算（避免页眉横线把整页拉进来）
    const ox = Math.min(c.maxX, x1) - Math.max(c.minX, x0) + 1;
    const oy = Math.min(c.maxY, y1) - Math.max(c.minY, y0) + 1;
    if (ox * oy < 2) continue;
    hit += 1;
    if (c.minX < minX) minX = c.minX;
    if (c.minY < minY) minY = c.minY;
    if (c.maxX > maxX) maxX = c.maxX;
    if (c.maxY > maxY) maxY = c.maxY;
  }

  if (hit === 0) return null;
  return { minX, minY, maxX, maxY };
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
// 选区 → 外接矩形（"填充为矩形"这一步）
export function fillToRect(shape) {
  const poly = Array.isArray(shape) ? shape : rectToPoly(shape);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function computeExportBox(mask, shape) {
  // 先填成矩形，再把与矩形相交的笔画整根纳入：跨边的线不会被切断
  const rect = fillToRect(shape);
  const b = contentBounds(mask, rect) || inkBounds(mask, rect);
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
