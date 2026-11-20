// 白界框：笔画整根纳入、边界落纯白、文字让出
// 状态：已实现（纯函数，只吃墨迹掩膜，不碰 DOM / canvas / pdf.js）。
//
// 掩膜契约：{ w, h, pxPerPt, data: Uint8Array(w*h) }，data[i] !== 0 即墨迹。
// 坐标：进入本模块一律 pt（页内左上原点），内部换成像素做判定，返回仍是 pt。

import { clamp } from './units.js';

function toPx(mask, pt) {
  return Math.round(pt * mask.pxPerPt);
}

function toPt(mask, px) {
  return px / mask.pxPerPt;
}

function ink(mask, x, y) {
  if (x < 0 || y < 0 || x >= mask.w || y >= mask.h) return 0;
  return mask.data[y * mask.w + x] === 0 ? 0 : 1;
}

export function isWhiteRow(mask, y, x0 = 0, x1 = mask.w) {
  if (y < 0 || y >= mask.h) return true;
  const a = Math.max(0, Math.floor(x0));
  const b = Math.min(mask.w, Math.ceil(x1));
  for (let x = a; x < b; x += 1) {
    if (mask.data[y * mask.w + x] !== 0) return false;
  }
  return true;
}

export function isWhiteCol(mask, x, y0 = 0, y1 = mask.h) {
  if (x < 0 || x >= mask.w) return true;
  const a = Math.max(0, Math.floor(y0));
  const b = Math.min(mask.h, Math.ceil(y1));
  for (let y = a; y < b; y += 1) {
    if (mask.data[y * mask.w + x] !== 0) return false;
  }
  return true;
}

function whiteSpanRow(mask, y, x0, x1) {
  return isWhiteRow(mask, y, x0, x1);
}

function whiteSpanCol(mask, x, y0, y1) {
  return isWhiteCol(mask, x, y0, y1);
}

// 把矩形四条边挪到最近的纯白行/列。先往外找（避免切笔画），再往里找。
// 若整条边怎么挪都不白（例如框跨过一条通栏横线），就把框收进最近的干净带里：
// 宁可缩小导出图，也不能让边界压在墨上。
export function snapToWhite(mask, rect, opts = {}) {
  const maxShift = opts.maxShift === undefined ? 8 : opts.maxShift;
  let left = clamp(Math.round(rect.x), 0, mask.w - 1);
  let top = clamp(Math.round(rect.y), 0, mask.h - 1);
  let right = Math.min(mask.w - 1, left + Math.max(1, Math.round(rect.w)) - 1);
  let bottom = Math.min(mask.h - 1, top + Math.max(1, Math.round(rect.h)) - 1);

  const search = (start, dirs, test) => {
    for (let d = 0; d <= maxShift; d += 1) {
      for (const dir of dirs) {
        const v = start + d * dir;
        if (test(v)) return v;
      }
    }
    return null;
  };

  const snapAll = () => {
    const nl = search(left, [-1, 1], (v) => v >= 0 && v < mask.w && whiteSpanCol(mask, v, top, bottom + 1));
    if (nl !== null) left = nl;
    const nr = search(right, [1, -1], (v) => v >= 0 && v < mask.w && whiteSpanCol(mask, v, top, bottom + 1));
    if (nr !== null) right = nr;
    const nt = search(top, [-1, 1], (v) => v >= 0 && v < mask.h && whiteSpanRow(mask, v, left, right + 1));
    if (nt !== null) top = nt;
    const nb = search(bottom, [1, -1], (v) => v >= 0 && v < mask.h && whiteSpanRow(mask, v, left, right + 1));
    if (nb !== null) bottom = nb;
  };

  const allWhite = () =>
    whiteSpanRow(mask, top, left, right + 1) &&
    whiteSpanRow(mask, bottom, left, right + 1) &&
    whiteSpanCol(mask, left, top, bottom + 1) &&
    whiteSpanCol(mask, right, top, bottom + 1);

  snapAll();

  if (!allWhite()) {
    // 竖直方向收进干净带：在 [top,bottom] 里找最长的"整行皆白"连续段
    let bestStart = null;
    let bestLen = 0;
    let runStart = null;
    for (let y = top; y <= bottom + 1; y += 1) {
      const white = y <= bottom && whiteSpanRow(mask, y, left, right + 1);
      if (white && runStart === null) runStart = y;
      if (!white && runStart !== null) {
        const len = y - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        }
        runStart = null;
      }
    }
    if (bestStart !== null && bestLen >= 2) {
      top = bestStart;
      bottom = bestStart + bestLen - 1;
    }
    snapAll();
  }

  if (!allWhite()) {
    // 水平方向同样收一次
    let bestStart = null;
    let bestLen = 0;
    let runStart = null;
    for (let x = left; x <= right + 1; x += 1) {
      const white = x <= right && whiteSpanCol(mask, x, top, bottom + 1);
      if (white && runStart === null) runStart = x;
      if (!white && runStart !== null) {
        const len = x - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        }
        runStart = null;
      }
    }
    if (bestStart !== null && bestLen >= 2) {
      left = bestStart;
      right = bestStart + bestLen - 1;
    }
    snapAll();
  }

  if (right <= left) right = left + 1;
  if (bottom <= top) bottom = top + 1;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

// 在 rect 附近做 4 连通标注，返回落在窗口里的整根笔画。
function componentsNear(mask, rect, pad) {
  const x0 = clamp(Math.floor(rect.x) - pad, 0, mask.w);
  const y0 = clamp(Math.floor(rect.y) - pad, 0, mask.h);
  const x1 = clamp(Math.ceil(rect.x + rect.w) + pad, 0, mask.w);
  const y1 = clamp(Math.ceil(rect.y + rect.h) + pad, 0, mask.h);

  const seen = new Uint8Array(mask.w * mask.h);
  const out = [];

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const start = y * mask.w + x;
      if (seen[start] || mask.data[start] === 0) continue;

      const stack = [start];
      seen[start] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let total = 0;

      while (stack.length > 0) {
        const i = stack.pop();
        const py = Math.floor(i / mask.w);
        const px = i - py * mask.w;
        total += 1;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        const nbrs = [
          px > 0 ? i - 1 : -1,
          px + 1 < mask.w ? i + 1 : -1,
          py > 0 ? i - mask.w : -1,
          py + 1 < mask.h ? i + mask.w : -1,
        ];
        for (const n of nbrs) {
          if (n >= 0 && !seen[n] && mask.data[n] !== 0) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }

      out.push({ minX, minY, maxX, maxY, total });
    }
  }
  return out;
}

// 笔画归属判定：框里占多数 → 整根收进来；框外占多数 → 说明只是擦到，推向框外。
export function growToStroke(mask, rect, opts = {}) {
  const pad = opts.pad === undefined ? 24 : opts.pad;
  const comps = componentsNear(mask, rect, pad);

  const box = { l: rect.x, t: rect.y, r: rect.x + rect.w, b: rect.y + rect.h };
  const countInside = (c) => {
    let n = 0;
    const x1 = Math.min(c.maxX, Math.floor(box.r) - 1);
    const y1 = Math.min(c.maxY, Math.floor(box.b) - 1);
    for (let y = Math.max(c.minY, Math.ceil(box.t)); y <= y1; y += 1) {
      for (let x = Math.max(c.minX, Math.ceil(box.l)); x <= x1; x += 1) {
        n += ink(mask, x, y);
      }
    }
    return n;
  };

  let l = box.l;
  let t = box.t;
  let r = box.r;
  let b = box.b;

  for (const c of comps) {
    const insideN = countInside(c);
    const outsideN = c.total - insideN;
    if (insideN === 0) continue;

    if (insideN >= outsideN) {
      // 主体在框里：整根纳入
      l = Math.min(l, c.minX);
      t = Math.min(t, c.minY);
      r = Math.max(r, c.maxX + 1);
      b = Math.max(b, c.maxY + 1);
      continue;
    }

    // 只是擦到：把那一条边推到笔画外侧，保住框内主体
    const cx = (c.minX + c.maxX) / 2;
    const cy = (c.minY + c.maxY) / 2;
    const dTop = Math.abs(cy - t);
    const dBottom = Math.abs(b - cy);
    const dLeft = Math.abs(cx - l);
    const dRight = Math.abs(r - cx);
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop && c.maxY < t + (b - t)) t = Math.min(b - 2, c.maxY + 1);
    else if (min === dBottom) b = Math.max(t + 2, c.minY);
    else if (min === dLeft) l = Math.min(r - 2, c.maxX + 1);
    else r = Math.max(l + 2, c.minX);
  }

  if (r <= l) r = l + 2;
  if (b <= t) b = t + 2;
  return { x: l, y: t, w: r - l, h: b - t };
}

// 文字不算笔画：压到文字时优先把文字让到框外，收不进再往外让。
export function pushTextOut(mask, rect, textRects, opts = {}) {
  const gap = opts.gap === undefined ? 2 : opts.gap;
  const minSize = opts.minSize === undefined ? mask.pxPerPt * 2 : opts.minSize;
  let box = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };

  for (const tr of textRects) {
    const overlapX = box.x < tr.x + tr.w && box.x + box.w > tr.x;
    const overlapY = box.y < tr.y + tr.h && box.y + box.h > tr.y;
    if (!overlapX || !overlapY) continue;

    const candidates = [
      { edge: 'top', box: { x: box.x, y: tr.y + tr.h + gap, w: box.w, h: box.y + box.h - (tr.y + tr.h + gap) } },
      { edge: 'bottom', box: { x: box.x, y: box.y, w: box.w, h: tr.y - gap - box.y } },
      { edge: 'left', box: { x: tr.x + tr.w + gap, y: box.y, w: box.x + box.w - (tr.x + tr.w + gap), h: box.h } },
      { edge: 'right', box: { x: box.x, y: box.y, w: tr.x - gap - box.x, h: box.h } },
    ].filter((c) => c.box.w >= minSize && c.box.h >= minSize);

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
      box = candidates[0].box;
      continue;
    }

    // 收不进 → 把文字整体推到框外
    const dx = box.x + box.w / 2 - (tr.x + tr.w / 2);
    const dy = box.y + box.h / 2 - (tr.y + tr.h / 2);
    if (Math.abs(dx) > Math.abs(dy)) {
      box.x = dx > 0 ? tr.x + tr.w + gap : box.x;
      if (dx <= 0) box.w = Math.max(box.w, tr.x - gap - box.x);
      else box.w = Math.max(minSize, box.x + box.w - (tr.x + tr.w + gap));
    } else {
      const y = dy > 0 ? tr.y + tr.h + gap : box.y;
      box = { x: box.x, y, w: box.w, h: Math.max(minSize, box.y + box.h - y) };
    }
  }

  box.x = Math.max(0, box.x);
  box.y = Math.max(0, box.y);
  box.w = Math.max(minSize, Math.min(box.w, mask.w - box.x));
  box.h = Math.max(minSize, Math.min(box.h, mask.h - box.y));
  return box;
}

// 标签只能落在纯白处：所有候选位置逐个测，全白才给。
export function findLabelSpot(mask, labelRect, candidates) {
  for (const c of candidates) {
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const w = Math.round(labelRect.w);
    const h = Math.round(labelRect.h);
    if (x < 0 || y < 0 || x + w > mask.w || y + h > mask.h) continue;
    let allWhite = true;
    for (let j = 0; j < h && allWhite; j += 1) {
      for (let i = 0; i < w; i += 1) {
        if (mask.data[(y + j) * mask.w + (x + i)] !== 0) {
          allWhite = false;
          break;
        }
      }
    }
    if (allWhite) return { x, y };
  }
  return null;
}

// 导出框：先按笔画归属定框，再把四边推到纯白。
export function computeExportBox(mask, rectPt, opts = {}) {
  const rect = {
    x: toPx(mask, rectPt.x),
    y: toPx(mask, rectPt.y),
    w: Math.max(1, toPx(mask, rectPt.w)),
    h: Math.max(1, toPx(mask, rectPt.h)),
  };
  let box = growToStroke(mask, rect, opts);
  box = snapToWhite(mask, box, opts);
  return {
    x: toPt(mask, box.x),
    y: toPt(mask, box.y),
    w: toPt(mask, box.w),
    h: toPt(mask, box.h),
  };
}
