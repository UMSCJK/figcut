// 撤销重做栈与微移合并
// 状态：骨架。接口已冻结，实现待补（core.history）。

import { notImplemented } from '../core/errors.js';

export function createHistory(...args) {
  throw notImplemented('core.history.createHistory');
}

export function commit(...args) {
  throw notImplemented('core.history.commit');
}

export function undo(...args) {
  throw notImplemented('core.history.undo');
}

export function redo(...args) {
  throw notImplemented('core.history.redo');
}

export function canUndo(...args) {
  throw notImplemented('core.history.canUndo');
}

export function canRedo(...args) {
  throw notImplemented('core.history.canRedo');
}

