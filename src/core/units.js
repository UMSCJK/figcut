// 单位换算：pdf pt / css px / 输出 dpi
// 状态：已实现。PDF 坐标一律 pt，页内左上原点、y 向下。

export const PT_PER_INCH = 72;

// pt → 导出像素：dpi 是每英寸像素，pt 是 1/72 英寸。
export function pxForDpi(pt, dpi) {
  return (pt / PT_PER_INCH) * dpi;
}

// pt → css 像素：scale 是当前缩放倍率（100% = 1）。
export function ptToPx(pt, scale) {
  return pt * scale;
}

export function pxToPt(px, scale) {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw figcutError('bad-scale', '缩放倍率必须是正有限数', { scale });
  }
  return px / scale;
}

// NaN 返回下界（坐标计算里出现 NaN 时宁可贴边也不要写进模型）；
// 正无穷贴上限、负无穷贴下限，符合夹取直觉。
export function clamp(value, lo, hi) {
  if (!Number.isFinite(value)) return value === Infinity ? hi : lo;
  if (lo > hi) return lo;
  return value < lo ? lo : value > hi ? hi : value;
}

import { figcutError } from './errors.js';
