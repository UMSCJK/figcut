// 全局设置：边距、DPI、配色
// 状态：骨架。接口已冻结，实现待补（app.settings）。

import { notImplemented } from '../core/errors.js';

export function loadSettings(...args) {
  throw notImplemented('app.settings.loadSettings');
}

export function saveSettings(...args) {
  throw notImplemented('app.settings.saveSettings');
}

export function setMargin(...args) {
  throw notImplemented('app.settings.setMargin');
}

export function setDpi(...args) {
  throw notImplemented('app.settings.setDpi');
}

