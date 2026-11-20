// 开发验收台：真 PDF → 位图 → 墨迹掩膜 → 白界框。结果写进 window.__RESULT__。
import { openDocument, pageSize } from '../src/pdf/document.js';
import { renderPage } from '../src/pdf/bitmap.js';
import { buildInkMask, components } from '../src/pdf/ink.js';
import { computeExportBox, isWhiteRow, isWhiteCol } from '../src/core/whitemargin.js';
import { pxForDpi } from '../src/core/units.js';

const params = new URLSearchParams(location.search);
const file = params.get('file') || '../tmp/corpus/m.pdf';
const pageNo = Number(params.get('page') || 9);
const PX_PER_PT = Number(params.get('ppp') || 2);
const DPI = Number(params.get('dpi') || 300);
const MARGIN = Number(params.get('margin') || 8);

const out = document.getElementById('out');
const view = document.getElementById('view');

function log(line) {
  out.textContent += '\n' + line;
}

function boxEdgesWhite(mask, box) {
  const x0 = Math.round(box.x * mask.pxPerPt);
  const y0 = Math.round(box.y * mask.pxPerPt);
  const x1 = Math.round((box.x + box.w) * mask.pxPerPt) - 1;
  const y1 = Math.round((box.y + box.h) * mask.pxPerPt) - 1;
  return {
    top: isWhiteRow(mask, y0, x0, x1 + 1),
    bottom: isWhiteRow(mask, y1, x0, x1 + 1),
    left: isWhiteCol(mask, x0, y0, y1 + 1),
    right: isWhiteCol(mask, x1, y0, y1 + 1),
  };
}

async function main() {
  const t0 = performance.now();
  const doc = await openDocument({ url: file }, { workerSrc: '../vendor/pdfjs/pdf.worker.min.js' });
  const size = await pageSize(doc, pageNo);
  const page = await doc.pdf.getPage(pageNo);
  const canvas = await renderPage(page, { scale: PX_PER_PT, dpr: 1, canvas: view });

  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = buildInkMask(img, { pxPerPt: PX_PER_PT });

  let inkCount = 0;
  for (let i = 0; i < mask.data.length; i += 1) inkCount += mask.data[i];

  const comps = components(mask).sort((a, b) => b.total - a.total);
  const big = comps.slice(0, 8).map((c) => ({
    pt: {
      x: +(c.minX / PX_PER_PT).toFixed(1),
      y: +(c.minY / PX_PER_PT).toFixed(1),
      w: +((c.maxX - c.minX + 1) / PX_PER_PT).toFixed(1),
      h: +((c.maxY - c.minY + 1) / PX_PER_PT).toFixed(1),
    },
    px: c.total,
  }));

  // 拿最大的一块笔画当样本，看白界框把它变成什么
  const rect = params.get('rect')
    ? (() => {
        const [x, y, w, h] = params.get('rect').split(',').map(Number);
        return { x, y, w, h };
      })()
    : big[0].pt;

  const exportBox = computeExportBox(mask, rect, { maxShift: 12 });
  const edges = boxEdgesWhite(mask, exportBox);
  const pxW = Math.round(pxForDpi(exportBox.w + MARGIN * 2, DPI));
  const pxH = Math.round(pxForDpi(exportBox.h + MARGIN * 2, DPI));

  const result = {
    file,
    page: pageNo,
    pageSize: { w: +size.w.toFixed(2), h: +size.h.toFixed(2) },
    canvas: { w: canvas.width, h: canvas.height },
    pxPerPt: PX_PER_PT,
    inkPixels: inkCount,
    inkRatio: +(inkCount / mask.data.length).toFixed(4),
    components: comps.length,
    biggest: big,
    rect,
    exportBox,
    edgesWhite: edges,
    exportPx: { w: pxW, h: pxH, dpi: DPI, margin: MARGIN },
    elapsedMs: Math.round(performance.now() - t0),
  };

  window.__RESULT__ = result;
  document.body.dataset.state = 'done';
  log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  window.__RESULT__ = { error: String(e && e.stack ? e.stack : e) };
  document.body.dataset.state = 'error';
  log('ERROR: ' + e);
});
