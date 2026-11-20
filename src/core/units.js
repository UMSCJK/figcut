// 单位换算：pdf pt / css px / 输出 dpi
// 状态：骨架。接口已冻结，实现待补（core.units）。

import { notImplemented } from '../core/errors.js';

export const PT_PER_INCH = 72;

export function pxForDpi(...args) {
  throw notImplemented('core.units.pxForDpi');
}

export function ptToPx(...args) {
  throw notImplemented('core.units.ptToPx');
}

export function pxToPt(...args) {
  throw notImplemented('core.units.pxToPt');
}

export function clamp(...args) {
  throw notImplemented('core.units.clamp');
}

