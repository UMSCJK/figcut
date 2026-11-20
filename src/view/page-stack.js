// 连续滚动页栈与当前页事务
// 状态：骨架。接口已冻结，实现待补（view.page-stack）。

import { notImplemented } from '../core/errors.js';

export function createPageStack(...args) {
  throw notImplemented('view.page-stack.createPageStack');
}

export function setCurrent(...args) {
  throw notImplemented('view.page-stack.setCurrent');
}

export function visibleRects(...args) {
  throw notImplemented('view.page-stack.visibleRects');
}

