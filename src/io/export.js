// 导出 300dpi 白底 PNG
// 状态：骨架。接口已冻结，实现待补（io.export）。

import { notImplemented } from '../core/errors.js';

export function computePixels(...args) {
  throw notImplemented('io.export.computePixels');
}

export function renderPng(...args) {
  throw notImplemented('io.export.renderPng');
}

export function exportRegions(...args) {
  throw notImplemented('io.export.exportRegions');
}

