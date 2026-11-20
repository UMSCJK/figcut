// 真导出：把 300dpi 的页面 PPM 导出成 PNG + ZIP（node 里跑，不依赖浏览器）
// 用法：node tools/export-page.mjs --ppm tmp/p9-300.ppm --box 356.5,345,159,156.5 --out tmp/out
import fs from 'node:fs';
import path from 'node:path';
import { renderPng } from '../src/io/export.js';
import { createZip, addFile, toBytes } from '../src/io/zip.js';
import { zipName } from '../src/core/naming.js';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
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
  for (let i = 0, p = 0, q = 0; i < w * h; i += 1, p += 3, q += 4) {
    data[q] = rgb[p];
    data[q + 1] = rgb[p + 1];
    data[q + 2] = rgb[p + 2];
    data[q + 3] = 255;
  }
  return { width: w, height: h, data };
}

const ppm = arg('ppm');
const outDir = arg('out', 'tmp/out');
const dpi = Number(arg('dpi', '300'));
const margin = Number(arg('margin', '8'));
const [bx, by, bw, bh] = arg('box').split(',').map(Number);

fs.mkdirSync(outDir, { recursive: true });
const image = readPPM(ppm);
const box = { x: bx, y: by, w: bw, h: bh };
const bytes = renderPng(image, box, { dpi, margin });

const pngPath = path.join(outDir, 'p09-01-stem.png');
fs.writeFileSync(pngPath, bytes);

const zip = createZip();
addFile(zip, 'p09-01-stem.png', bytes);
addFile(zip, 'figure-regions.json', new TextEncoder().encode(JSON.stringify({
  version: 4,
  app: 'figcut',
  files: {
    'm.pdf|258909': {
      source: 'm.pdf',
      export: { dpi, margin },
      updatedAt: 0,
      pages: { 9: [{ kind: 'stem', q: 28, shape: 'rect', box }] },
    },
  },
}, null, 2)));

const zipPath = path.join(outDir, zipName('m.pdf'));
fs.writeFileSync(zipPath, toBytes(zip));

console.log(JSON.stringify({ pngPath, zipPath, pngBytes: bytes.length, pagePx: [image.width, image.height] }));
