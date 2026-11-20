// 导出 300dpi 白底 PNG
// 状态：已实现。像素搬运与编码都不依赖 canvas，浏览器里只要先拿到 ImageData。

import { pxForDpi } from '../core/units.js';
import { encodePng } from './png.js';
import { regionFileName } from '../core/naming.js';
import { figcutError } from '../core/errors.js';

// 导出尺寸 = (导出框 + 边距) × DPI，像素对齐不重采样。
export function computePixels(box, opts = {}) {
  const dpi = opts.dpi === undefined ? 300 : opts.dpi;
  const margin = opts.margin === undefined ? 8 : opts.margin;
  return {
    w: Math.round(pxForDpi(box.w + margin * 2, dpi)),
    h: Math.round(pxForDpi(box.h + margin * 2, dpi)),
    dpi,
    margin,
  };
}

// 从整页像素里裁一块，四周补纯白。image: {width,height,data:RGBA}
export function cropRgba(image, boxPx, marginPx = 0) {
  const w = Math.max(1, Math.round(boxPx.w + marginPx * 2));
  const h = Math.max(1, Math.round(boxPx.h + marginPx * 2));
  const out = new Uint8ClampedArray(w * h * 4);
  out.fill(255);

  const left = Math.round(boxPx.x - marginPx);
  const top = Math.round(boxPx.y - marginPx);

  for (let y = 0; y < h; y += 1) {
    const sy = top + y;
    if (sy < 0 || sy >= image.height) continue;
    for (let x = 0; x < w; x += 1) {
      const sx = left + x;
      if (sx < 0 || sx >= image.width) continue;
      const s = (sy * image.width + sx) * 4;
      const d = (y * w + x) * 4;
      out[d] = image.data[s];
      out[d + 1] = image.data[s + 1];
      out[d + 2] = image.data[s + 2];
      out[d + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

// 按导出像素矩形精确裁切（白界框 + 边距已经算好，四边保证纯白）。
export function renderPngPx(image, pxRect) {
  const [x0, y0, x1, y1] = pxRect;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const out = new Uint8ClampedArray(w * h * 4);
  out.fill(255);
  for (let y = 0; y < h; y += 1) {
    const sy = y0 + y;
    if (sy < 0 || sy >= image.height) continue;
    for (let x = 0; x < w; x += 1) {
      const sx = x0 + x;
      if (sx < 0 || sx >= image.width) continue;
      const s = (sy * image.width + sx) * 4;
      const d = (y * w + x) * 4;
      out[d] = image.data[s];
      out[d + 1] = image.data[s + 1];
      out[d + 2] = image.data[s + 2];
      out[d + 3] = 255;
    }
  }
  return encodePng({ width: w, height: h, data: out });
}

// 不重采样：页面位图必须恰好是 dpi/72 px/pt 渲出来的，否则直接报错。
export function renderPng(image, boxPt, opts = {}) {
  const dpi = opts.dpi === undefined ? 300 : opts.dpi;
  const margin = opts.margin === undefined ? 8 : opts.margin;
  const want = dpi / 72;
  const scale = opts.scale === undefined ? want : opts.scale;
  if (Math.abs(scale - want) > 1e-6) {
    throw figcutError('scale-mismatch', '导出必须按 dpi/72 渲染，不重采样', { scale, want, dpi });
  }
  return encodePng(
    cropRgba(image, { x: boxPt.x * scale, y: boxPt.y * scale, w: boxPt.w * scale, h: boxPt.h * scale }, margin * scale)
  );
}

// 一批区域 → [{name, bytes}]
export function exportRegions(input) {
  const { image, regions } = input;
  const dpi = input.dpi === undefined ? 300 : input.dpi;
  const margin = input.margin === undefined ? 8 : input.margin;
  const scale = input.scale === undefined ? dpi / 72 : input.scale;
  return regions.map((r) => ({
    name: regionFileName(r),
    bytes: renderPng(image, r.box, { scale, dpi, margin }),
  }));
}
