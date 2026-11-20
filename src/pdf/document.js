// 打开 PDF、页数、页尺寸
// 状态：已实现。pdf.js 由 index.html 以 classic script 外部引入，本模块只包一层。

import { figcutError } from '../core/errors.js';

export async function openDocument(source, opts = {}) {
  const lib = opts.lib || (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);
  if (!lib) throw figcutError('no-pdfjs', 'pdf.js 没加载（vendor/pdfjs/pdf.min.js）');

  if (opts.workerSrc) lib.GlobalWorkerOptions.workerSrc = opts.workerSrc;

  const task = lib.getDocument(source);
  const pdf = await task.promise;
  return {
    pdf,
    id: opts.id || 'doc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    pages: pdf.numPages,
  };
}

export function pageCount(doc) {
  return doc.pages;
}

export async function pageSize(doc, pageNo) {
  const page = await doc.pdf.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height, rotation: vp.rotation };
}
