// 导出全链路：白界框 → 300dpi PNG → ZIP
// 状态：已实现（浏览器侧，需要 pdf.js 渲染）。

import { renderPage } from '../pdf/bitmap.js';
import { buildInkMask } from '../pdf/ink.js';
import { readTextLayer, textBoxesOnPage } from '../pdf/textlayer.js';
import { computeExportBox } from '../core/whitemargin.js';
import { renderPng } from '../io/export.js';
import { createZip, addFile, toBytes } from '../io/zip.js';
import { regionFileName, zipName, pad } from '../core/naming.js';
import { boundsOf } from '../view/editor.js';

export const MASK_PPP = 2;

// 按页分组、页内按竖直位置排序，给出 p{页}-{序号}-{类型}.png
export function planExports(regions) {
  const sorted = [...regions].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return boundsOf(a).y - boundsOf(b).y;
  });

  const counters = new Map();
  return sorted.map((r) => {
    const n = (counters.get(r.page) || 0) + 1;
    counters.set(r.page, n);
    return {
      region: r,
      page: r.page,
      index: n,
      name: regionFileName({ page: r.page, index: n, kind: r.kind, opt: r.opt }),
      box: boundsOf(r),
    };
  });
}

async function imageOf(page, scale) {
  const canvas = await renderPage(page, { scale, dpr: 1 });
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: img.width, height: img.height, data: img.data };
}

export async function exportZip(input) {
  const { doc, regions } = input;
  const dpi = input.dpi === undefined ? 300 : input.dpi;
  const margin = input.margin === undefined ? 8 : input.margin;
  const onProgress = input.onProgress || (() => {});
  const scale = dpi / 72;

  const plan = planExports(regions);
  const pages = [...new Set(plan.map((p) => p.page))].sort((a, b) => a - b);
  const zip = createZip();
  const manifest = [];

  for (let i = 0; i < pages.length; i += 1) {
    const pageNo = pages[i];
    onProgress({ page: pageNo, done: i, total: pages.length });

    const page = await doc.pdf.getPage(pageNo);
    const maskImage = await imageOf(page, MASK_PPP);
    const mask = buildInkMask(maskImage, { pxPerPt: MASK_PPP });
    const words = await readTextLayer(page);

    const hires = await imageOf(page, scale);

    for (const item of plan.filter((p) => p.page === pageNo)) {
      const textRects = textBoxesOnPage(words, item.box);
      const exportBox = computeExportBox(mask, item.box, { textRects, maxShift: 12 });
      const bytes = renderPng(hires, exportBox, { dpi, margin, scale });
      addFile(zip, item.name, bytes);
      manifest.push({
        name: item.name,
        page: item.page,
        index: item.index,
        kind: item.region.kind,
        opt: item.region.opt,
        q: item.region.q,
        box: {
          x: +exportBox.x.toFixed(2),
          y: +exportBox.y.toFixed(2),
          w: +exportBox.w.toFixed(2),
          h: +exportBox.h.toFixed(2),
        },
      });
    }
  }

  const key = doc.id || 'document.pdf|0';
  addFile(
    zip,
    'figure-regions.json',
    new TextEncoder().encode(
      JSON.stringify(
        {
          version: 4,
          app: 'figcut',
          files: {
            [key]: {
              source: input.source || '',
              export: { dpi, margin },
              updatedAt: Date.now(),
              regions: manifest,
            },
          },
        },
        null,
        2
      )
    )
  );

  onProgress({ page: null, done: pages.length, total: pages.length });
  return {
    bytes: toBytes(zip),
    name: zipName(input.source || 'figures'),
    files: manifest,
  };
}

export { pad };
