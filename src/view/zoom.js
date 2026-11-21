// 缩放与鼠标锚点
// 状态：已实现。状态与数学都在这，DOM 由 ui/zoom-control 负责。

import { clamp } from '../core/units.js';
import { MIN_SCALE, MAX_SCALE, fitPageScale, fitWidthScale } from '../core/layout.js';

export function createZoom(opts = {}) {
  return {
    scale: opts.scale === undefined ? 1 : opts.scale,
    mode: 'free',
    min: MIN_SCALE,
    max: MAX_SCALE,
    auto: false,
    listeners: new Set(),
  };
}

function notify(z) {
  for (const fn of z.listeners) fn(z.scale, z.mode);
}

export function subscribe(z, fn) {
  z.listeners.add(fn);
  return () => z.listeners.delete(fn);
}

export function setScale(z, value) {
  z.auto = false;
  const next = clamp(Number(value), z.min, z.max);
  if (!Number.isFinite(next)) return z.scale;
  z.mode = 'free';
  if (Math.abs(next - z.scale) < 1e-6) return z.scale;
  z.scale = next;
  notify(z);
  return z.scale;
}

// 'page' 整页可见，'width' 贴满宽度
export function setFit(z, mode, dims) {
  z.auto = false;
  const scale =
    mode === 'page'
      ? fitPageScale(dims)
      : mode === 'width'
        ? fitWidthScale(dims)
        : z.scale;
  z.mode = mode;
  if (Math.abs(scale - z.scale) > 1e-6) {
    z.scale = scale;
    notify(z);
  }
  return z.scale;
}

// 直接给定适应后的比例（调用方已按列数算好），只负责落状态 + 通知
export function setFitAt(z, mode, scale) {
  z.auto = false;
  z.mode = mode;
  const next = clamp(Number(scale), z.min, z.max);
  z.scale = next;
  notify(z);
  return next;
}

// 以指针为锚点缩放的滚动补偿：指针下的内容不许漂。
export function anchorAt(scroll, px, py, from, to) {
  if (!(from > 0) || !(to > 0)) return { x: scroll.x, y: scroll.y };
  const cx = (scroll.x + px) / from;
  const cy = (scroll.y + py) / from;
  return {
    x: Math.max(0, cx * to - px),
    y: Math.max(0, cy * to - py),
  };
}
