// ZIP 打包与清单 JSON
// 状态：骨架。接口已冻结，实现待补（io.zip）。

import { notImplemented } from '../core/errors.js';

export function createZip(...args) {
  throw notImplemented('io.zip.createZip');
}

export function addFile(...args) {
  throw notImplemented('io.zip.addFile');
}

export function toBlob(...args) {
  throw notImplemented('io.zip.toBlob');
}

