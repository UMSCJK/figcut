// 视图布局：单双页、书式配对、适应缩放、缩放台阶
// 状态：已实现。纯计算，页尺寸与视口尺寸都由调用方给。

import { clamp } from './units.js';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

// 照 GNOME Papers：
//   单页 → 每页一行
//   双页书式（默认）→ 第 1 页单独在右，之后 2|3、4|5
//   双页 + 奇数页在左 → 1|2、3|4、5|6
export function pageCombos(pageCount, opts = {}) {
  const dual = !!opts.dual;
  const oddLeft = !!opts.oddLeft;
  const rows = [];

  if (!dual) {
    for (let p = 1; p <= pageCount; p += 1) rows.push([p]);
    return rows;
  }

  if (oddLeft) {
    for (let p = 1; p <= pageCount; p += 2) {
      rows.push(p + 1 <= pageCount ? [p, p + 1] : [p]);
    }
    return rows;
  }

  if (pageCount >= 1) rows.push([1]);
  for (let p = 2; p <= pageCount; p += 2) {
    rows.push(p + 1 <= pageCount ? [p, p + 1] : [p]);
  }
  return rows;
}

// 适应页面：整页必须完整可见，padding 按真实的上下留白算。
export function fitPageScale(opts) {
  const padX = opts.padX || 0;
  const padY = opts.padY || 0;
  const avw = Math.max(1, opts.viewportW - padX * 2);
  const avh = Math.max(1, opts.viewportH - padY * 2);
  if (!(opts.pageW > 0) || !(opts.pageH > 0)) return 1;
  const scale = Math.min(avw / opts.pageW, avh / opts.pageH);
  return clamp(Math.floor(scale * 1000) / 1000, MIN_SCALE, MAX_SCALE);
}

// 适应宽度：横向不许出滚动条，所以最后再往下抹一点余量。
export function fitWidthScale(opts) {
  const padX = opts.padX || 0;
  const avw = Math.max(1, opts.viewportW - padX * 2);
  if (!(opts.pageW > 0)) return 1;
  const scale = avw / opts.pageW;
  return clamp(Math.floor(scale * 1000) / 1000, MIN_SCALE, MAX_SCALE);
}

export function zoomPresets() {
  return [0.5, 0.7, 0.85, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
}

// 缩放按钮 / 快捷键：按 ×1.2 步进，并夹在 25%–800%。
export function stepZoom(scale, dir) {
  const factor = dir >= 0 ? 1.2 : 1 / 1.2;
  return clamp(Math.round(scale * factor * 1000) / 1000, MIN_SCALE, MAX_SCALE);
}
