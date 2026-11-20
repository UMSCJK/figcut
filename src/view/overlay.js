// 每页选框覆盖层绘制与命中
// 状态：骨架。接口已冻结，实现待补（view.overlay）。

import { notImplemented } from '../core/errors.js';

export function createOverlay(...args) {
  throw notImplemented('view.overlay.createOverlay');
}

export function drawRegions(...args) {
  throw notImplemented('view.overlay.drawRegions');
}

export function hitTest(...args) {
  throw notImplemented('view.overlay.hitTest');
}

