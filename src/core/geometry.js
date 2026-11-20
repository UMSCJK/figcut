// 矩形与多边形的纯几何运算
// 状态：已实现。不碰 DOM、不碰 PDF，输入输出都是普通对象与数组。

import { clamp } from './units.js';

export const MIN_REGION_PT = 2;

export function normRect(x0, y0, x1, y1) {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

// 反着拖出的框也归一化；任一边小于 minSize 视为误触，返回 null。
export function rectFromPoints(x0, y0, x1, y1, minSize = MIN_REGION_PT) {
  const r = normRect(x0, y0, x1, y1);
  if (!(r.w >= minSize) || !(r.h >= minSize)) return null;
  if (!Number.isFinite(r.w) || !Number.isFinite(r.h)) return null;
  return r;
}

// 整块塞进页内：先夹尺寸，再夹位置，形状不变。
export function clampRect(rect, pageW, pageH) {
  const w = clamp(Math.min(rect.w, pageW), 0, pageW);
  const h = clamp(Math.min(rect.h, pageH), 0, pageH);
  const x = clamp(rect.x, 0, pageW - w);
  const y = clamp(rect.y, 0, pageH - h);
  return { x, y, w, h };
}

export function expandRect(rect, dx, dy) {
  return { x: rect.x - dx, y: rect.y - dy, w: rect.w + dx * 2, h: rect.h + dy * 2 };
}

export function polyBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// 整体平移：按外接框夹边，形状一点不变。
export function movePoly(points, dx, dy, pageW, pageH) {
  const b = polyBounds(points);
  let mx = dx;
  let my = dy;
  if (b.x + mx < 0) mx = -b.x;
  if (b.x + b.w + mx > pageW) mx = pageW - (b.x + b.w);
  if (b.y + my < 0) my = -b.y;
  if (b.y + b.h + my > pageH) my = pageH - (b.y + b.h);
  if (mx !== dx || my !== dy) {
    const nb = { x: b.x + mx, y: b.y + my, w: b.w, h: b.h };
    if (nb.x < 0 || nb.y < 0 || nb.x + nb.w > pageW || nb.y + nb.h > pageH) {
      return points.map((p) => ({ x: p.x, y: p.y }));
    }
  }
  return points.map((p) => ({ x: p.x + mx, y: p.y + my }));
}

export function hitTestRect(rect, x, y, tol = 0) {
  return (
    x >= rect.x - tol &&
    x <= rect.x + rect.w + tol &&
    y >= rect.y - tol &&
    y <= rect.y + rect.h + tol
  );
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  const cx = ax + t * vx;
  const cy = ay + t * vy;
  return Math.hypot(px - cx, py - cy);
}

export function hitTestPoly(points, x, y, tol = 0) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  if (inside) return true;
  if (tol <= 0) return false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j];
    const b = points[i];
    if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= tol) return true;
  }
  return false;
}

const CORNERS = [
  ['nw', 0, 0],
  ['ne', 1, 0],
  ['sw', 0, 1],
  ['se', 1, 1],
];

export function cornerAt(rect, x, y, tol = 8) {
  for (const [name, fx, fy] of CORNERS) {
    const cx = rect.x + rect.w * fx;
    const cy = rect.y + rect.h * fy;
    if (Math.abs(x - cx) <= tol && Math.abs(y - cy) <= tol) return name;
  }
  return null;
}
