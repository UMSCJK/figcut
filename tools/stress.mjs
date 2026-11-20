// 收紧算法压力测试：真卷子、真渲染。
// 对若干页取最大的一根笔画，画一个"松 10pt"的框，看收紧结果是否等于该笔画的外接框、
// 四边是否纯白、框里有没有混进文字。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildInkMask, components } from '../src/pdf/ink.js';
import { parseWordBoxes, textBoxesOnPage } from '../src/pdf/textlayer.js';
import { computeExportBox, growToWhite, cropRect, isWhiteRow, isWhiteCol } from '../src/core/whitemargin.js';
import { renderPngPx } from '../src/io/export.js';

const PDF = process.argv[2] || 'tmp/corpus/m.pdf';
const PAGES = (process.argv[3] || '1,2,5,9,10,12').split(',').map(Number);
const OUT = 'tmp/stress';
const DPI = 300;
const MARGIN = 8;
fs.mkdirSync(OUT, { recursive: true });

function ppm(p, dpi, page) {
  const base = path.join(OUT, 'p' + page + '-' + dpi);
  execFileSync('pdftoppm', ['-r', String(dpi), '-f', String(page), '-l', String(page), PDF, base], { stdio: 'ignore' });
  const dir = path.dirname(path.resolve(base));
  const file = fs.readdirSync(dir).filter((f) => f.startsWith('p' + page + '-' + dpi) && f.endsWith('.ppm')).pop();
  return path.join(dir, file);
}

function readPPM(p) {
  const buf = fs.readFileSync(p);
  let pos = 0;
  const token = () => {
    while ([32, 10, 13, 9].includes(buf[pos])) pos += 1;
    const start = pos;
    while (pos < buf.length && ![32, 10, 13, 9].includes(buf[pos])) pos += 1;
    return buf.toString('ascii', start, pos);
  };
  if (token() !== 'P6') throw new Error('需要 P6 PPM');
  const w = Number(token());
  const h = Number(token());
  token();
  pos += 1;
  const rgb = buf.subarray(pos, pos + w * h * 3);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p2 = 0, q = 0; i < w * h; i += 1, p2 += 3, q += 4) {
    data[q] = rgb[p2];
    data[q + 1] = rgb[p2 + 1];
    data[q + 2] = rgb[p2 + 2];
    data[q + 3] = 255;
  }
  return { width: w, height: h, data };
}

const rows = [];
for (const page of PAGES) {
  const maskImg = readPPM(ppm('mask', 144, page));
  const hiImg = readPPM(ppm('hires', DPI, page));
  const mask = buildInkMask(maskImg, { pxPerPt: 2 });
  const hiMask = buildInkMask(hiImg, { pxPerPt: DPI / 72 });

  const comps = components(mask).sort((a, b) => b.total - a.total);
  const target = comps[0];
  const box = {
    x: target.minX / 2,
    y: target.minY / 2,
    w: (target.maxX - target.minX + 1) / 2,
    h: (target.maxY - target.minY + 1) / 2,
  };
  // 用户会画得松一点
  const loose = { x: box.x - 10, y: box.y - 10, w: box.w + 20, h: box.h + 20 };

  const words = parseWordBoxes(execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-bbox', PDF, '-']).toString());
  const pageW = maskImg.width / 2;
  const pageH = maskImg.height / 2;

  const ink = computeExportBox(mask, loose, { textRects: words });
  const grown = growToWhite(hiMask, ink, MARGIN, pageW, pageH);
  const crop = cropRect(grown, pageW, pageH, DPI / 72);
  const png = renderPngPx(hiImg, crop.px);
  const file = path.join(OUT, 'p' + page + '.png');
  fs.writeFileSync(file, png);

  const [x0, y0, x1, y1] = crop.px;
  const edges = {
    top: isWhiteRow(hiMask, y0, x0, x1),
    bottom: isWhiteRow(hiMask, y1 - 1, x0, x1),
    left: isWhiteCol(hiMask, x0, y0, y1),
    right: isWhiteCol(hiMask, x1 - 1, y0, y1),
  };
  const textIn = words.filter((t) => t.x < ink.x + ink.w && t.x + t.w > ink.x && t.y < ink.y + ink.h && t.y + t.h > ink.y);
  const drift = {
    dx: +(ink.x - box.x).toFixed(2),
    dy: +(ink.y - box.y).toFixed(2),
    dw: +(ink.w - box.w).toFixed(2),
    dh: +(ink.h - box.h).toFixed(2),
  };

  rows.push({
    page,
    target: { x: +box.x.toFixed(1), y: +box.y.toFixed(1), w: +box.w.toFixed(1), h: +box.h.toFixed(1) },
    ink: { x: +ink.x.toFixed(1), y: +ink.y.toFixed(1), w: +ink.w.toFixed(1), h: +ink.h.toFixed(1) },
    drift,
    edges,
    textInside: textIn.length,
    px: [x1 - x0, y1 - y0],
    file,
  });
}

console.log(JSON.stringify(rows, null, 1));
