// 按 devicePixelRatio 渲染页位图并缓存
// 状态：骨架。接口已冻结，实现待补（pdf.bitmap）。

import { notImplemented } from '../core/errors.js';

export function renderPage(...args) {
  throw notImplemented('pdf.bitmap.renderPage');
}

export function cacheKey(...args) {
  throw notImplemented('pdf.bitmap.cacheKey');
}

export function clearCache(...args) {
  throw notImplemented('pdf.bitmap.clearCache');
}

