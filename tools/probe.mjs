// 无头验收：把 poppler 栅格化出来的 PPM 喂给真实模块，跑墨迹掩膜与白界框。
// 用法：node tools/probe.mjs --ppm tmp/p9-09.ppm --ppp 2 [--rect x,y,w,h] [--top 5]
import fs from 'node:fs';
import { buildInkMask, components } from '../src/pdf/ink.js';
import { computeExportBox, isWhiteRow, isWhiteCol } from '../src/core/whitemargin.js';
import { parseWordBoxes, textBoxesOnPage } from '../src/pdf/textlayer.js';
import { pxForDpi } from '../src/core/units.js';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function readPPM(path) {
  const buf = fs.readFileSync(path);
  let pos = 0;
  const token = () => {
    while (buf[pos] === 32 || buf[pos] === 10 || buf[pos] === 13 || buf[pos] === 9) pos += 1;
    if (buf[pos] === 35) { while (buf[pos] !== 10) pos += 1; return token(); }
    const start = pos;
    while (pos < buf.length && buf[pos] !== 32 && buf[pos] !== 10 && buf[pos] !== 13 && buf[pos] !== 9) pos += 1;
    return buf.toString('ascii', start, pos);
  };
  const magic = token();
  if (magic !== 'P6') throw new Error('只支持 P6 PPM，实际 ' + magic);
  const w = Number(token());
  const h = Number(token());
  const maxv = Number(token());
  pos += 1;
  if (maxv !== 255) throw new Error('只支持 8bit PPM');
  const need = w * h * 3;
  const rgb = buf.subarray(pos, pos + need);
  return { w, h, rgb };
}

const ppmPath = arg('ppm', 'tmp/p9-09.ppm');
const ppp = Number(arg('ppp', '2'));
const topN = Number(arg('top', '6'));
const dpi = Number(arg('dpi', '300'));
const margin = Number(arg('margin', '8'));

const { w, h, rgb } = readPPM(ppmPath);
const rgba = new Uint8ClampedArray(w * h * 4);
for (let i = 0, p = 0, q = 0; i < w * h; i += 1, p += 3, q += 4) {
  rgba[q] = rgb[p];
  rgba[q + 1] = rgb[p + 1];
  rgba[q + 2] = rgb[p + 2];
  rgba[q + 3] = 255;
}

const mask = buildInkMask({ data: rgba, width: w, height: h }, { pxPerPt: ppp });
let ink = 0;
for (let i = 0; i < mask.data.length; i += 1) ink += mask.data[i];

const comps = components(mask).sort((a, b) => b.total - a.total);
const toPt = (v) => +(v / ppp).toFixed(2);
const describe = (c) => ({
  x: toPt(c.minX),
  y: toPt(c.minY),
  w: toPt(c.maxX - c.minX + 1),
  h: toPt(c.maxY - c.minY + 1),
  px: c.total,
});

const rectArg = arg('rect', null);
const dump = process.argv.includes('--dump');
const rect = rectArg
  ? (() => { const [x, y, rw, rh] = rectArg.split(',').map(Number); return { x, y, w: rw, h: rh }; })()
  : comps[0] && describe(comps[0]);

if (dump) {
  const hit = comps
    .filter((c) => {
      const cx0 = c.minX / ppp, cy0 = c.minY / ppp;
      const cx1 = (c.maxX + 1) / ppp, cy1 = (c.maxY + 1) / ppp;
      return cx0 < rect.x + rect.w && cx1 > rect.x && cy0 < rect.y + rect.h && cy1 > rect.y;
    })
    .sort((a, b) => b.total - a.total);
  console.log(JSON.stringify({ rect, count: hit.length, comps: hit.slice(0, 40).map(describe) }, null, 2));
  process.exit(0);
}

const textPath = arg('text', null);
const words = textPath ? parseWordBoxes(fs.readFileSync(textPath, 'utf8')) : [];
const textRects = textBoxesOnPage(words, rect);
const box = computeExportBox(mask, rect);
const x0 = Math.round(box.x * ppp);
const y0 = Math.round(box.y * ppp);
const x1 = Math.round((box.x + box.w) * ppp) - 1;
const y1 = Math.round((box.y + box.h) * ppp) - 1;
const edges = {
  top: isWhiteRow(mask, y0, x0, x1 + 1),
  bottom: isWhiteRow(mask, y1, x0, x1 + 1),
  left: isWhiteCol(mask, x0, y0, y1 + 1),
  right: isWhiteCol(mask, x1, y0, y1 + 1),
};

const out = {
  ppm: ppmPath,
  pagePx: { w, h },
  pagePt: { w: toPt(w), h: toPt(h) },
  pxPerPt: ppp,
  inkPixels: ink,
  inkRatio: +(ink / mask.data.length).toFixed(4),
  components: comps.length,
  biggest: comps.slice(0, topN).map(describe),
  wordsOnPage: words.length,
  wordsInRect: textRects.length,
  rect,
  exportBox: { x: +box.x.toFixed(2), y: +box.y.toFixed(2), w: +box.w.toFixed(2), h: +box.h.toFixed(2) },
  edgesWhite: edges,
  exportPx: {
    w: Math.round(pxForDpi(box.w + margin * 2, dpi)),
    h: Math.round(pxForDpi(box.h + margin * 2, dpi)),
    dpi,
    margin,
  },
};
console.log(JSON.stringify(out, null, 2));
