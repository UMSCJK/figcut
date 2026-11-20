/* 白界框（white box）：导出边界必须落在纯白行列上，且不切断任何笔画。

   算法（全部在二进制墨迹掩膜上做，按连通域处理）：
     1. 先把文字像素从掩膜里挖掉（文字不算笔画），剩下的是"笔画掩膜"。
     2. 8 连通标注笔画；面积 < 12px 或长宽 < 3px 的碎点不算笔画（字形残渣）。
     3. 用扫描线求多边形命中的笔画：某笔画的墨迹有 >=10% 落在多边形内才算
        "用户要的这根笔画"。所以框底擦到下方图案 1pt（~1%）不会整块吞进来，
        而跨进框里的笔画（~25%）算整根。
     4. 这些笔画的**完整**外接框出发，四条边逐像素调整，直到：
        a. 每条边所在的行/列上没有笔画墨迹；
        b. 每条边没有压到文字——压到就优先往框里收（把字让到框外），
           收不进笔画范围再往外让。
     5. 框里一根笔画都没有（只压到文字或空白）时，退回"多边形外接框 + 推到纯白"。
     6. 边距只往白色里长：加边距时逐像素检查，碰到任何墨迹就停。

   坐标：入口 pt，内部 px，出口 pt。出口框包含最后一条白线。 */

import { clamp } from './units.js';

export const MIN_AREA = 12;        // 碎点阈值（字号残渣）；细线（虚线、短横）只要够长就算笔画
export const HIT_RATIO = 0.1;      // 命中比例：10%
export const MAX_GROW = 4096;      // 单边外扩上限，防病态页面把框撑爆
export const TEXT_PAD = 2;         // 文字掩膜外扩像素，吃掉抗锯齿

function idx(mask, x, y) {
  return y * mask.w + x;
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

// 文字像素图：1 = 这里是文字，不参与笔画归属
export function textMask(mask, textRectsPt, pad = TEXT_PAD) {
  const t = new Uint8Array(mask.w * mask.h);
  if (!textRectsPt || textRectsPt.length === 0) return t;
  const s = mask.pxPerPt;
  for (const b of textRectsPt) {
    const x0 = Math.max(0, Math.floor(b.x * s) - pad);
    const x1 = Math.min(mask.w - 1, Math.ceil((b.x + b.w) * s) + pad);
    const y0 = Math.max(0, Math.floor(b.y * s) - pad);
    const y1 = Math.min(mask.h - 1, Math.ceil((b.y + b.h) * s) + pad);
    for (let y = y0; y <= y1; y += 1) {
      const base = y * mask.w;
      for (let x = x0; x <= x1; x += 1) t[base + x] = 1;
    }
  }
  return t;
}

// 8 连通标注。返回 { lab, comps }，comps[0] 是占位。
export function labelComponents(mask, textPx) {
  const { w, h, data } = mask;
  const lab = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const comps = [null];
  let id = 0;

  for (let p = 0; p < lab.length; p += 1) {
    if (lab[p] || (textPx && textPx[p]) || !data[p]) continue;
    id += 1;
    let sp = 0;
    stack[sp++] = p;
    lab[p] = id;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    let area = 0;

    while (sp) {
      const q = stack[--sp];
      const x = q % w;
      const y = (q / w) | 0;
      area += 1;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nq = ny * w + nx;
          if (!lab[nq] && !(textPx && textPx[nq]) && data[nq]) {
            lab[nq] = id;
            stack[sp++] = nq;
          }
        }
      }
    }
    comps.push({ id, x0, y0, x1, y1, area });
  }
  return { lab, comps };
}

// 只把像样的笔画当内容
function solidOf(mask, lab, comps) {
  const solid = new Uint8Array(mask.w * mask.h);
  for (const c of comps) {
    if (!c || c.area < MIN_AREA) continue;
    for (let y = c.y0; y <= c.y1; y += 1) {
      const base = y * mask.w;
      for (let x = c.x0; x <= c.x1; x += 1) if (lab[base + x] === c.id) solid[base + x] = 1;
    }
  }
  return solid;
}

// 扫描线：多边形每行命中的 x 区间
function polySpans(poly, s, yc) {
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
  const spans = [];
  for (let k = 0; k + 1 < xs.length; k += 2) spans.push([xs[k], xs[k + 1]]);
  return spans;
}

// 多边形命中的笔画（>=10% 墨迹落在框内）
export function hitComponents(mask, lab, comps, poly) {
  const s = mask.pxPerPt;
  const { w, h } = mask;
  let yTop = Infinity;
  let yBot = -Infinity;
  for (const p of poly) {
    if (p.y < yTop) yTop = p.y;
    if (p.y > yBot) yBot = p.y;
  }
  const ry0 = Math.max(0, Math.floor(yTop * s));
  const ry1 = Math.min(h - 1, Math.ceil(yBot * s));
  const hits = new Map();

  for (let py = ry0; py <= ry1; py += 1) {
    const spans = polySpans(poly, s, py + 0.5);
    if (spans.length === 0) continue;
    const base = py * w;
    for (const [xa, xb] of spans) {
      const a = Math.max(0, Math.ceil(xa));
      const b = Math.min(w - 1, Math.floor(xb - 0.001));
      for (let px = a; px <= b; px += 1) {
        const id = lab[base + px];
        if (!id) continue;
        const c = comps[id];
        if (c && c.area >= MIN_AREA) {
          hits.set(id, (hits.get(id) || 0) + 1);
        }
      }
    }
  }

  const ids = new Set();
  for (const [id, n] of hits) {
    if (n * (1 / HIT_RATIO) >= comps[id].area) ids.add(id);
  }
  return ids;
}

export function rectToPoly(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

// 主函数：给一个多边形/矩形，返回白界框（pt）。框里没笔画时返回 null。
export function whiteBox(mask, shape, textRectsPt) {
  const poly = Array.isArray(shape) ? shape : rectToPoly(shape);
  if (poly.length < 3) return null;

  const t = textMask(mask, textRectsPt);
  const { lab, comps } = labelComponents(mask, t);
  const ids = hitComponents(mask, lab, comps, poly);
  if (ids.size === 0) return null;

  const solid = solidOf(mask, lab, comps);

  let x0 = mask.w;
  let y0 = mask.h;
  let x1 = -1;
  let y1 = -1;
  for (const id of ids) {
    const c = comps[id];
    if (c.x0 < x0) x0 = c.x0;
    if (c.y0 < y0) y0 = c.y0;
    if (c.x1 > x1) x1 = c.x1;
    if (c.y1 > y1) y1 = c.y1;
  }

  // 文字盒（像素），用于"边界压到文字就把字让出去"
  const s = mask.pxPerPt;
  const tboxes = (textRectsPt || []).map((b) => ({
    x0: Math.max(0, Math.floor(b.x * s)),
    x1: Math.min(mask.w - 1, Math.ceil((b.x + b.w) * s)),
    y0: Math.max(0, Math.floor(b.y * s)),
    y1: Math.min(mask.h - 1, Math.ceil((b.y + b.h) * s)),
  }));

  const fx0 = x0;
  const fy0 = y0;
  const fx1 = x1;
  const fy1 = y1;

  // 边界避让只看笔画墨迹；文字单独处理，否则往外找白线会穿过整段题干
  const colInk = (x, yA = y0, yB = y1) => {
    for (let y = yA; y <= yB; y += 1) if (solid[y * mask.w + x] === 1) return true;
    return false;
  };
  const rowInk = (y, xA = x0, xB = x1) => {
    for (let x = xA; x <= xB; x += 1) if (solid[y * mask.w + x] === 1) return true;
    return false;
  };
  const rowTexts = (y) => tboxes.filter((b) => y >= b.y0 - 1 && y <= b.y1 + 1 && b.x1 >= x0 && b.x0 <= x1);
  const colTexts = (x) => tboxes.filter((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && b.y1 >= y0 && b.y0 <= y1);

  let changed = true;
  let guard = 0;
  while (changed && guard < 128) {
    changed = false;
    guard += 1;

    // 4.1 边界不压笔画
    while (x0 > 0 && colInk(x0)) { x0 -= 1; changed = true; }
    while (x1 < mask.w - 1 && colInk(x1)) { x1 += 1; changed = true; }
    while (y0 > 0 && rowInk(y0)) { y0 -= 1; changed = true; }
    while (y1 < mask.h - 1 && rowInk(y1)) { y1 += 1; changed = true; }

    // 4.2 边界压到文字：优先往框里收，收不进笔画再往外让
    if (colTexts(x0).length > 0) {
      const inner = Math.max(...colTexts(x0).map((b) => b.x1 + 2));
      if (inner <= fx0) x0 = inner;
      else {
        let t2 = x0 - 1;
        while (t2 > 0 && colTexts(t2).length > 0) t2 -= 1;
        x0 = Math.max(0, t2);
      }
      changed = true;
    }
    if (colTexts(x1).length > 0) {
      const inner = Math.min(...colTexts(x1).map((b) => b.x0 - 2));
      if (inner >= fx1) x1 = inner;
      else {
        let t2 = x1 + 1;
        while (t2 < mask.w - 1 && colTexts(t2).length > 0) t2 += 1;
        x1 = Math.min(mask.w - 1, t2);
      }
      changed = true;
    }
    if (rowTexts(y0).length > 0) {
      const inner = Math.max(...rowTexts(y0).map((b) => b.y1 + 2));
      if (inner <= fy0) y0 = inner;
      else {
        let t2 = y0 - 1;
        while (t2 > 0 && rowTexts(t2).length > 0) t2 -= 1;
        y0 = Math.max(0, t2);
      }
      changed = true;
    }
    if (rowTexts(y1).length > 0) {
      const inner = Math.min(...rowTexts(y1).map((b) => b.y0 - 2));
      if (inner >= fy1) y1 = inner;
      else {
        let t2 = y1 + 1;
        while (t2 < mask.h - 1 && rowTexts(t2).length > 0) t2 += 1;
        y1 = Math.min(mask.h - 1, t2);
      }
      changed = true;
    }

    if (x1 - x0 > MAX_GROW || y1 - y0 > MAX_GROW) return null;
  }

  // 最后一道：边必须在这张掩膜上是白的（碎点、抗锯齿残渣也算墨）。
  // 上一步只看"像样的笔画"，这一步看原始墨迹，保证导出图四边 255。
  guard = 0;
  const rawCol = (x) => {
    for (let y = y0; y <= y1; y += 1) if (mask.data[y * mask.w + x]) return true;
    return false;
  };
  const rawRow = (y) => {
    for (let x = x0; x <= x1; x += 1) if (mask.data[y * mask.w + x]) return true;
    return false;
  };
  let raw = true;
  while (raw && guard < 4096) {
    raw = false;
    guard += 1;
    if (x0 > 0 && rawCol(x0)) { x0 -= 1; raw = true; }
    if (x1 < mask.w - 1 && rawCol(x1)) { x1 += 1; raw = true; }
    if (y0 > 0 && rawRow(y0)) { y0 -= 1; raw = true; }
    if (y1 < mask.h - 1 && rawRow(y1)) { y1 += 1; raw = true; }
    if (x1 - x0 > MAX_GROW || y1 - y0 > MAX_GROW) return null;
  }

  return { x: x0 / s, y: y0 / s, w: (x1 - x0 + 1) / s, h: (y1 - y0 + 1) / s };
}

// 框里没笔画时：从外接框出发，四边推到纯白
export function whiteEdges(mask, shape) {
  const poly = Array.isArray(shape) ? shape : rectToPoly(shape);
  const s = mask.pxPerPt;
  let x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x)) * s));
  let y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.y)) * s));
  let x1 = Math.min(mask.w - 1, Math.ceil(Math.max(...poly.map((p) => p.x)) * s));
  let y1 = Math.min(mask.h - 1, Math.ceil(Math.max(...poly.map((p) => p.y)) * s));

  const colInk = (x) => {
    for (let y = y0; y <= y1; y += 1) if (mask.data[y * mask.w + x]) return true;
    return false;
  };
  const rowInk = (y) => {
    for (let x = x0; x <= x1; x += 1) if (mask.data[y * mask.w + x]) return true;
    return false;
  };

  // 框里没有任何笔画时没有"不能切断"的负担，所以四条边往**里**收到最近的白线，
  // 这样"框底擦到下方图案 1pt"只会导出框里那点，不会把整块图案吞进来。
  // 收没了就退回手画框。
  const ox0 = x0;
  const oy0 = y0;
  const ox1 = x1;
  const oy1 = y1;

  let guard = 0;
  while (guard < 4096 && x0 < x1 && colInk(x0)) { x0 += 1; guard += 1; }
  while (guard < 4096 && x1 > x0 && colInk(x1)) { x1 -= 1; guard += 1; }
  while (guard < 4096 && y0 < y1 && rowInk(y0)) { y0 += 1; guard += 1; }
  while (guard < 4096 && y1 > y0 && rowInk(y1)) { y1 -= 1; guard += 1; }

  if (x1 <= x0 || y1 <= y0) {
    return { x: ox0 / s, y: oy0 / s, w: (ox1 - ox0 + 1) / s, h: (oy1 - oy0 + 1) / s };
  }

  return { x: x0 / s, y: y0 / s, w: (x1 - x0 + 1) / s, h: (y1 - y0 + 1) / s };
}

// 导出边界：有笔画走 whiteBox，没笔画走 whiteEdges
export function computeExportBox(mask, shape, opts = {}) {
  const box = whiteBox(mask, shape, opts.textRects);
  if (box) return box;
  return whiteEdges(mask, shape);
}

// 边距只往白色里长：碰到墨迹就停
export function growToWhite(mask, box, margin, pageW, pageH) {
  if (!(margin > 0)) return box;
  const s = mask.pxPerPt;
  const maxPx = Math.max(0, Math.round(margin * s));
  if (!maxPx) return box;
  const clampPx = (v, hi) => Math.min(hi, Math.max(0, v));

  let l = clampPx(Math.floor(box.x * s), mask.w - 1);
  let t = clampPx(Math.floor(box.y * s), mask.h - 1);
  let r = clampPx(Math.ceil((box.x + box.w) * s) - 1, mask.w - 1);
  let b = clampPx(Math.ceil((box.y + box.h) * s) - 1, mask.h - 1);

  const colWhite = (x) => {
    for (let y = t; y <= b; y += 1) if (mask.data[y * mask.w + x]) return false;
    return true;
  };
  const rowWhite = (y) => {
    for (let x = l; x <= r; x += 1) if (mask.data[y * mask.w + x]) return false;
    return true;
  };

  for (let n = 0; n < maxPx && l > 0 && colWhite(l - 1); n += 1) l -= 1;
  for (let n = 0; n < maxPx && r < mask.w - 1 && colWhite(r + 1); n += 1) r += 1;
  for (let n = 0; n < maxPx && t > 0 && rowWhite(t - 1); n += 1) t -= 1;
  for (let n = 0; n < maxPx && b < mask.h - 1 && rowWhite(b + 1); n += 1) b += 1;

  return { x: l / s, y: t / s, w: (r - l + 1) / s, h: (b - t + 1) / s };
}

// 对内对齐到导出像素网格（不重采样）
export function cropRect(box, pageW, pageH, scale) {
  const pxW = Math.max(1, Math.round(pageW * scale));
  const pxH = Math.max(1, Math.round(pageH * scale));
  const clampPx = (v, hi) => Math.min(hi, Math.max(0, v));

  let x0 = clampPx(Math.ceil(box.x * scale - 1e-6), pxW - 1);
  let y0 = clampPx(Math.ceil(box.y * scale - 1e-6), pxH - 1);
  let x1 = clampPx(Math.max(Math.floor((box.x + box.w) * scale + 1e-6), x0 + 1), pxW);
  let y1 = clampPx(Math.max(Math.floor((box.y + box.h) * scale + 1e-6), y0 + 1), pxH);

  return { px: [x0, y0, x1, y1], x: x0 / scale, y: y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
}

// 标签只能落在纯白处
export function findLabelSpot(mask, labelRect, candidates) {
  for (const c of candidates) {
    const x = Math.round(c.x * mask.pxPerPt);
    const y = Math.round(c.y * mask.pxPerPt);
    const w = Math.round(labelRect.w * mask.pxPerPt);
    const h = Math.round(labelRect.h * mask.pxPerPt);
    if (x < 0 || y < 0 || x + w > mask.w || y + h > mask.h) continue;
    let clear = true;
    for (let j = 0; j < h && clear; j += 1) {
      for (let i = 0; i < w; i += 1) {
        if (mask.data[(y + j) * mask.w + (x + i)] !== 0) {
          clear = false;
          break;
        }
      }
    }
    if (clear) return { x: c.x, y: c.y };
  }
  return null;
}
