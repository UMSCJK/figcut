// SPEC 第 12 节验收 1–3 条，跑真实卷子。用法：
//   node tools/accept.mjs --ppm tmp/p9-09.ppm --text tmp/p9.xhtml --ppp 2
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
    while ([32, 10, 13, 9].includes(buf[pos])) pos += 1;
    const start = pos;
    while (pos < buf.length && ![32, 10, 13, 9].includes(buf[pos])) pos += 1;
    return buf.toString('ascii', start, pos);
  };
  const magic = token();
  if (magic !== 'P6') throw new Error('需要 P6 PPM');
  const w = Number(token());
  const h = Number(token());
  if (Number(token()) !== 255) throw new Error('需要 8bit');
  pos += 1;
  const rgb = buf.subarray(pos, pos + w * h * 3);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0, q = 0; i < w * h; i += 1, p += 3, q += 4) {
    rgba[q] = rgb[p];
    rgba[q + 1] = rgb[p + 1];
    rgba[q + 2] = rgb[p + 2];
    rgba[q + 3] = 255;
  }
  return { w, h, rgba };
}

const ppm = arg('ppm', 'tmp/p9-09.ppm');
const textPath = arg('text', 'tmp/p9.xhtml');
const ppp = Number(arg('ppp', '2'));
const DPI = 300;
const MARGIN = 8;

const { w, h, rgba } = readPPM(ppm);
const mask = buildInkMask({ data: rgba, width: w, height: h }, { pxPerPt: ppp });
const words = parseWordBoxes(fs.readFileSync(textPath, 'utf8'));
const allComps = components(mask);

const ptOf = (r) => ({ x: r.x / ppp, y: r.y / ppp, w: r.w / ppp, h: r.h / ppp });
const intersections = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function run(name, rectPt) {
  const textRects = textBoxesOnPage(words, rectPt);
  const box = computeExportBox(mask, rectPt, { maxShift: 12, textRects });

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

  const inside = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  const cut = allComps.filter((c) => {
    const cb = { x: c.minX, y: c.minY, w: c.maxX - c.minX + 1, h: c.maxY - c.minY + 1 };
    if (!intersections(cb, inside)) return false;
    const fully = cb.x >= inside.x - 1 && cb.y >= inside.y - 1 && cb.x + cb.w <= inside.x + inside.w + 1 && cb.y + cb.h <= inside.y + inside.h + 1;
    return !fully;
  });

  const textIn = words.filter((t) => intersections(t, box));

  return {
    name,
    rect: rectPt,
    box: { x: +box.x.toFixed(2), y: +box.y.toFixed(2), w: +box.w.toFixed(2), h: +box.h.toFixed(2) },
    px: { w: Math.round(pxForDpi(box.w + MARGIN * 2, DPI)), h: Math.round(pxForDpi(box.h + MARGIN * 2, DPI)) },
    edges,
    cutStrokes: cut.length,
    textInside: textIn.length,
  };
}

const cases = [];

// 验收 1：Math Test 2 第 9 页，6x6 图案，期望 728x714，四边纯白、无文字、无断笔
cases.push(run('1: 6x6 图案 300dpi/8pt', { x: 340, y: 330, w: 190, h: 170 }));

// 验收 2：框底擦到下方图案 1pt，不得把整块吞进来（图案上沿 345.5pt）
cases.push(run('2: 框底擦到图案 1pt', { x: 340, y: 330, w: 190, h: 16.5 }));

// 验收 3：框压住左侧题干文字，文字让出、图形完整
cases.push(run('3: 框压住题干文字', { x: 330, y: 335, w: 190, h: 150 }));

const checks = [];
const c1 = cases[0];
checks.push(['1 四边纯白', Object.values(c1.edges).every(Boolean)]);
checks.push(['1 无断笔', c1.cutStrokes === 0]);
checks.push(['1 无文字', c1.textInside === 0]);
checks.push(['1 尺寸 728x714 (±8px)', Math.abs(c1.px.w - 728) <= 8 && Math.abs(c1.px.h - 714) <= 8]);

const c2 = cases[1];
checks.push(['2 不吞下方图案', c2.box.y + c2.box.h <= 345.6]);
checks.push(['2 四边纯白', Object.values(c2.edges).every(Boolean)]);

const c3 = cases[2];
checks.push(['3 文字让出', c3.textInside === 0]);
checks.push(['3 图形完整（含上方文字块宽度）', c3.box.w >= 158 && c3.box.h >= 130]);
checks.push(['3 四边纯白', Object.values(c3.edges).every(Boolean)]);
checks.push(['3 无断笔', c3.cutStrokes === 0]);

console.log(JSON.stringify({ cases, checks, pass: checks.every((c) => c[1]) }, null, 2));
process.exit(checks.every((c) => c[1]) ? 0 : 1);
