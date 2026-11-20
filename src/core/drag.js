// 框的拖拽状态机
// 状态：已实现。只管"按下 → 移动 → 松手"这条线，不碰 DOM。

import { clampRect } from './geometry.js';

export const DRAG_THRESHOLD_PT = 2;

export function createDrag(opts = {}) {
  return {
    active: false,
    moved: false,
    threshold: opts.threshold === undefined ? DRAG_THRESHOLD_PT : opts.threshold,
    startX: 0,
    startY: 0,
    origin: null,
  };
}

export function beginDrag(d, point) {
  d.active = true;
  d.moved = false;
  d.startX = point.x;
  d.startY = point.y;
  d.origin = point.rect ? { x: point.rect.x, y: point.rect.y, w: point.rect.w, h: point.rect.h } : null;
  return d;
}

// 返回移动后的矩形；没过阈值就还是原样（不抖）。
export function applyDrag(d, point, bounds) {
  if (!d.active || !d.origin) return null;
  const dx = point.x - d.startX;
  const dy = point.y - d.startY;
  if (!d.moved && Math.hypot(dx, dy) < d.threshold) {
    return { x: d.origin.x, y: d.origin.y, w: d.origin.w, h: d.origin.h };
  }
  d.moved = true;
  const next = { x: d.origin.x + dx, y: d.origin.y + dy, w: d.origin.w, h: d.origin.h };
  return bounds ? clampRect(next, bounds.pageW, bounds.pageH) : next;
}

// 没过阈值 → null（当成点击，而不是画出一个 1pt 的框）。
export function endDrag(d) {
  d.active = false;
  if (!d.moved) return null;
  const origin = d.origin;
  d.origin = null;
  return origin;
}
