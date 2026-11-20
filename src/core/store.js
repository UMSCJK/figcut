// 极简可订阅状态容器
// 状态：骨架。接口已冻结，实现待补（core.store）。

import { notImplemented } from '../core/errors.js';

export function createStore(...args) {
  throw notImplemented('core.store.createStore');
}

export function getState(...args) {
  throw notImplemented('core.store.getState');
}

export function setState(...args) {
  throw notImplemented('core.store.setState');
}

export function subscribe(...args) {
  throw notImplemented('core.store.subscribe');
}

