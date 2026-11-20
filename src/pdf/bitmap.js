// 按 devicePixelRatio 渲染页位图并缓存
// 状态：已实现。渲染需要 DOM canvas；缓存键是纯函数，可单测。

import { figcutError } from '../core/errors.js';

// 缓存键必须含文档身份，否则换文件后读到上一份的像素。
export function cacheKey(docId, pageNo, scale, dpr) {
  return docId + ':' + pageNo + ':' + Number(scale).toFixed(4) + ':' + Number(dpr).toFixed(3);
}

export async function renderPage(page, opts = {}) {
  if (typeof document === 'undefined') {
    throw figcutError('no-dom', '离开浏览器没法渲染页位图');
  }
  const scale = opts.scale === undefined ? 1 : opts.scale;
  const dpr = opts.dpr === undefined ? 1 : opts.dpr;
  const viewport = page.getViewport({ scale });

  const canvas = opts.canvas || document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width * dpr));
  canvas.height = Math.max(1, Math.round(viewport.height * dpr));

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const transform = dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0];
  await page.render({ canvasContext: ctx, viewport, transform }).promise;
  ctx.restore();

  return canvas;
}

export function clearCache(cache) {
  if (cache && typeof cache.clear === 'function') cache.clear();
  return cache;
}
