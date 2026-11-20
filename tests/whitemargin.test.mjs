import { test, assert } from '../tools/testkit.mjs';
import {
  isWhiteRow,
  isWhiteCol,
  textMask,
  labelComponents,
  hitComponents,
  whiteBox,
  whiteEdges,
  computeExportBox,
  growToWhite,
  cropRect,
  findLabelSpot,
  rectToPoly,
  MIN_AREA,
} from '../src/core/whitemargin.js';

// ---- 合成掩膜 ----
function makeMask(w, h, pxPerPt = 2) {
  return { w, h, pxPerPt, data: new Uint8Array(w * h) };
}
function fill(mask, x, y, w, h) {
  for (let j = y; j < y + h; j += 1) {
    for (let i = x; i < x + w; i += 1) {
      if (i >= 0 && j >= 0 && i < mask.w && j < mask.h) mask.data[j * mask.w + i] = 255;
    }
  }
}
const px = (mask, box) => ({ x: box.x * 2, y: box.y * 2, w: box.w * 2, h: box.h * 2 });

test('whitemargin: 空掩膜算白，画一笔就不白', () => {
  const m = makeMask(50, 50);
  assert(isWhiteRow(m, 10, 0, 50) === true);
  fill(m, 10, 0, 4, 50);
  assert(isWhiteCol(m, 10, 0, 50) === false);
  assert(isWhiteRow(m, 10, 0, 9) === true, '笔画左边仍是白的');
});

test('whitemargin: 笔画跨在框外也整根收进来', () => {
  const m = makeMask(200, 200);
  fill(m, 90, 40, 6, 120);
  const box = whiteBox(m, { x: 10, y: 30, w: 80, h: 40 });
  assert(box !== null, '应命中那根竖笔');
  assert(box.x <= 90 / 2 && box.y <= 20, '整根纳入：' + JSON.stringify(box));
  assert(box.h >= 60, '高度应覆盖笔画全长：' + box.h);
});

test('whitemargin: 擦到下方图案 1pt 不算（10% 规则）', () => {
  const m = makeMask(200, 200);
  fill(m, 20, 100, 160, 80); // 80px 高的大块
  // 框底只插进图案 2px（约 1pt），框里其余是空白
  const box = whiteBox(m, { x: 10, y: 40, w: 90, h: 12 });
  assert(box === null, '不到 10% 命中就不该吞进来：' + JSON.stringify(box));

  // 退回纯白边界：往里收到白处，结果不许压墨，也不许跑出原框
  const edges = whiteEdges(m, { x: 10, y: 40, w: 90, h: 12 });
  assert(edges.y + edges.h <= 52.6 && edges.x >= 9.4, '不许跑出原框（±1px 取整）：' + JSON.stringify(edges));
  const col = Math.round(edges.x * 2);
  const row = Math.round((edges.y + edges.h) * 2) - 1;
  assert(isWhiteCol(m, col, Math.round(edges.y * 2), Math.round((edges.y + edges.h) * 2)), '左边界要白');
  assert(isWhiteRow(m, row, Math.round(edges.x * 2), Math.round((edges.x + edges.w) * 2)), '下边界要白');
});

test('whitemargin: 碎点不算笔画', () => {
  const m = makeMask(100, 100);
  fill(m, 40, 40, 2, 2); // 4px，远小于 MIN_AREA
  assert(MIN_AREA === 12);
  assert(whiteBox(m, { x: 10, y: 10, w: 30, h: 30 }) === null, '碎点不该被当成内容');
});

test('whitemargin: 文字不参与笔画归属', () => {
  const m = makeMask(200, 200);
  fill(m, 60, 60, 30, 30); // 图形
  const textRect = { x: 10, y: 55, w: 20, h: 10 };
  fill(m, 20, 110, 40, 20); // 文字墨迹（像素坐标）
  const t = textMask(m, [textRect]);
  const { lab, comps } = labelComponents(m, t);
  const ids = hitComponents(m, lab, comps, rectToPoly({ x: 0, y: 0, w: 60, h: 60 }));
  for (const id of ids) {
    const c = comps[id];
    assert(!(c.y0 >= 110 && c.y1 <= 130), '文字区域不该出现在命中笔画里');
  }
});

test('whitemargin: 框边的文字不会被圈进导出框', () => {
  const m = makeMask(200, 200);
  fill(m, 80, 80, 40, 40); // 图形 40..60pt
  fill(m, 50, 40, 20, 8); // 左侧一段文字墨迹 25..35pt
  const text = { x: 25, y: 20, w: 10, h: 4 };
  const box = whiteBox(m, { x: 20, y: 18, w: 70, h: 50 }, [text]);
  assert(box !== null);
  assert(box.x >= 39.5, '左边界落在图形左沿的白线上：' + JSON.stringify(box));
  assert(box.x > 35, '不许越过去吃掉左侧文字：' + box.x);
});

test('whitemargin: 边距只往白色里长', () => {
  const m = makeMask(200, 200);
  fill(m, 80, 80, 40, 40); // 40..60pt 的块
  const box = whiteBox(m, { x: 35, y: 35, w: 30, h: 30 });
  const grown = growToWhite(m, box, 20, 100, 100);
  assert(grown.x <= box.x && grown.w >= box.w, '边距只会变大');
  const edgeX = Math.floor(grown.x * 2);
  assert(isWhiteCol(m, edgeX, Math.floor(grown.y * 2), Math.ceil((grown.y + grown.h) * 2)), '加完边距边还在白处');
});

test('whitemargin: 边距碰到墨迹就停', () => {
  const m = makeMask(200, 200);
  fill(m, 80, 80, 40, 40);
  fill(m, 40, 80, 4, 40); // 左侧 20pt 处一根竖笔
  const box = whiteBox(m, { x: 38, y: 35, w: 25, h: 25 });
  const grown = growToWhite(m, box, 30, 100, 100);
  assert(grown.x * 2 >= 44, '左边距必须停在竖笔右侧（x=44px）：' + grown.x * 2);
  assert(grown.x * 2 <= 46, '也不该多长一截：' + grown.x * 2);
});

test('whitemargin: cropRect 向内对齐像素网格且不越页', () => {
  const box = { x: 10.3, y: 10.7, w: 20.2, h: 15.1 };
  const crop = cropRect(box, 595, 842, 4.1667);
  assert(crop.px[0] >= Math.floor(10.3 * 4.1667 - 0.001), '左边界不能往外');
  assert(crop.px[2] <= Math.ceil((10.3 + 20.2) * 4.1667 + 0.001), '右边界不能往外');
  assert(crop.w > 0 && crop.h > 0);
});

test('whitemargin: 标签只落在纯白处', () => {
  const m = makeMask(100, 100);
  fill(m, 0, 0, 40, 40);
  const label = { w: 5, h: 3 };
  assert(findLabelSpot(m, label, [{ x: 1, y: 1 }]) === null, '压墨不给位置');
  const spot = findLabelSpot(m, label, [{ x: 1, y: 1 }, { x: 30, y: 30 }]);
  assert(spot && spot.x === 30 && spot.y === 30, JSON.stringify(spot));
});

test('whitemargin: computeExportBox 先笔画后纯白', () => {
  const m = makeMask(200, 200);
  fill(m, 60, 60, 40, 40);
  const box = computeExportBox(m, { x: 28, y: 28, w: 30, h: 30 });
  assert(box.w >= 20 && box.h >= 20, JSON.stringify(box));
});
