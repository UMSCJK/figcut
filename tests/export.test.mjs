import { test, assert } from '../tools/testkit.mjs';
import { computePixels, cropRgba, renderPng, exportRegions } from '../src/io/export.js';

function solid(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

test('export: 尺寸 = (导出框 + 边距) x DPI', () => {
  const px = computePixels({ w: 159, h: 156.5 }, { dpi: 300, margin: 8 });
  assert(px.w === 729, '宽 ' + px.w);
  assert(px.h === 719, '高 ' + px.h);
});

test('export: 裁切四周补纯白', () => {
  const img = solid(6, 6, 0, 0, 0);
  const crop = cropRgba(img, { x: 1, y: 1, w: 4, h: 4 }, 2);
  assert(crop.width === 8 && crop.height === 8);
  const px = (x, y) => {
    const p = (y * crop.width + x) * 4;
    return [crop.data[p], crop.data[p + 1], crop.data[p + 2]];
  };
  assert(JSON.stringify(px(0, 0)) === JSON.stringify([255, 255, 255]), '左上角是白的');
  assert(JSON.stringify(px(4, 4)) === JSON.stringify([0, 0, 0]), '中间是内容');
});

test('export: 缩放与 dpi 不匹配要报错（不重采样）', () => {
  let threw = false;
  try {
    renderPng(solid(4, 4, 0, 0, 0), { x: 1, y: 1, w: 2, h: 2 }, { dpi: 300, scale: 1 });
  } catch (e) {
    threw = e && e.code === 'scale-mismatch';
  }
  assert(threw, '应抛 scale-mismatch');
});

test('export: 按 dpi/72 渲染时产出合法 PNG 字节', () => {
  const img = solid(20, 20, 0, 0, 0);
  const bytes = renderPng(img, { x: 2, y: 2, w: 4, h: 4 }, { dpi: 72, margin: 0 });
  assert(bytes[0] === 0x89 && bytes[1] === 0x50, 'PNG 签名');
});

test('export: exportRegions 带出正确文件名', () => {
  const img = solid(20, 20, 0, 0, 0);
  const out = exportRegions({
    image: img,
    dpi: 72,
    margin: 0,
    regions: [{ page: 3, index: 2, kind: 'opt', opt: 'B', box: { x: 1, y: 1, w: 4, h: 4 } }],
  });
  assert(out.length === 1);
  assert(out[0].name === 'p03-02-optB.png', out[0].name);
  assert(out[0].bytes[0] === 0x89);
});

import { cropPxRgba, polySpansAt } from '../src/io/export.js';

test('export: 多边形外的像素被涂白（v2 的 destination-in）', () => {
  const img = solid(40, 40, 0, 0, 0); // 全黑
  const poly = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 20 },
    { x: 0, y: 20 },
  ];
  // 1px/pt：裁 0..20pt 的方块，左半边在多边形里
  const out = cropPxRgba(img, [0, 0, 20, 20], { poly, scale: 1 });
  const px = (x, y) => {
    const p = (y * out.width + x) * 4;
    return [out.data[p], out.data[p + 1], out.data[p + 2]];
  };
  assert(JSON.stringify(px(2, 5)) === JSON.stringify([0, 0, 0]), '多边形内保持原样');
  assert(JSON.stringify(px(15, 5)) === JSON.stringify([255, 255, 255]), '多边形外涂白');
});

test('export: 多边形跨度与偶奇规则', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const spans = polySpansAt(poly, 5);
  assert(spans.length === 1);
  assert(spans[0][0] === 0 && spans[0][1] === 10, JSON.stringify(spans));
  assert(polySpansAt(poly, 50).length === 0, '在外面就是空的');
});
