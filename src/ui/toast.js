// 提示条与异常横幅
// 状态：骨架。接口已冻结，实现待补（ui.toast）。

import { notImplemented } from '../core/errors.js';

export function toast(...args) {
  throw notImplemented('ui.toast.toast');
}

export function banner(...args) {
  throw notImplemented('ui.toast.banner');
}

