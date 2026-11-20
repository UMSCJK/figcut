// localStorage 配置 schema4 与迁移
// 状态：骨架。接口已冻结，实现待补（io.config）。

import { notImplemented } from '../core/errors.js';

export function keyForFile(...args) {
  throw notImplemented('io.config.keyForFile');
}

export function loadConfig(...args) {
  throw notImplemented('io.config.loadConfig');
}

export function saveConfig(...args) {
  throw notImplemented('io.config.saveConfig');
}

export function migrate(...args) {
  throw notImplemented('io.config.migrate');
}

