import { test, assert } from '../tools/testkit.mjs';
import { buildInkMask, components, strokeAt } from '../src/pdf/ink.js';

function rgba(w, h, paint) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const img = { width: w, height: h, data };
  paint((x, y, r, g, b, a = 255) => {
    const p = (y * w + x) * 4;
    data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = a;
  });
  return img;
}

test('ink: 白纸不算墨，黑线算墨，浅灰仍算墨', () => {
  const img = rgba(10, 10, (put) => {
    put(2, 2, 0, 0, 0);
    put(5, 5, 240, 240, 240);
    put(7, 7, 253, 253, 253);
  });
  const mask = buildInkMask(img, { pxPerPt: 2 });
  assert(mask.w === 10 && mask.h === 10 && mask.pxPerPt === 2);
  assert(mask.data[2 * 10 + 2] === 1, '纯黑是墨');
  assert(mask.data[5 * 10 + 5] === 1, '浅灰是墨');
  assert(mask.data[7 * 10 + 7] === 0, '接近白不算墨');
});

test('ink: 连通域按 4 邻接切分，包围盒正确', () => {
  const img = rgba(20, 20, (put) => {
    for (let x = 2; x < 8; x += 1) put(x, 3, 0, 0, 0);
    for (let x = 2; x < 8; x += 1) put(x, 4, 0, 0, 0);
    put(15, 15, 0, 0, 0);
  });
  const mask = buildInkMask(img);
  const comps = components(mask);
  assert(comps.length === 2, '应有两条笔画，实际 ' + comps.length);
  comps.sort((a, b) => b.total - a.total);
  const big = comps[0];
  assert(big.minX === 2 && big.maxX === 7 && big.minY === 3 && big.maxY === 4, JSON.stringify(big));
  assert(big.total === 12);
});

test('ink: strokeAt 命中与落空', () => {
  const img = rgba(10, 10, (put) => { put(1, 1, 0, 0, 0); put(2, 1, 0, 0, 0); });
  const mask = buildInkMask(img);
  const s = strokeAt(mask, 1, 1);
  assert(s && s.total === 2, JSON.stringify(s));
  assert(strokeAt(mask, 5, 5) === null, '空白处应返回 null');
  assert(strokeAt(mask, -1, 5) === null, '越界应返回 null');
});
