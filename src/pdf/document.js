// 打开 PDF、页数、页尺寸
// 状态：骨架。接口已冻结，实现待补（pdf.document）。

import { notImplemented } from '../core/errors.js';

export function openDocument(...args) {
  throw notImplemented('pdf.document.openDocument');
}

export function pageCount(...args) {
  throw notImplemented('pdf.document.pageCount');
}

export function pageSize(...args) {
  throw notImplemented('pdf.document.pageSize');
}

