import { test, assert } from '../tools/testkit.mjs';
import {
  inkBounds,
  computeExportBox,
  withMargin,
  cropRect,
  findLabelSpot,
  isWhiteRow,
  isWhiteCol,
  rectToPoly,
} from '../src/core/whitemargin.js';

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

test('whitemargin: 框里全白返回 null', () => {
  const m = makeMask(100, 100);
  assert(inkBounds(m, { x: 10, y: 10, w: 20, h: 20 }) === null);
  assert(computeExportBox(m, { x: 10, y: 10, w: 20, h: 20 }) === null);
});

test('whitemargin: 外接框就是非白像素的最小范围', () => {
  const m = makeMask(200, 200);
  fill(m, 60, 80, 40, 20); // px 60..99 × 80..99 → pt 30..50 × 40..50
  const box = computeExportBox(m, { x: 10, y: 10, w: 80, h: 80 });
  assert(box.x === 30 && box.y === 40, JSON.stringify(box));
  assert(box.w === 20 && box.h === 10, JSON.stringify(box));
});

test('whitemargin: 框松了也收到内容上（白边就这么消掉的）', () => {
  const m = makeMask(200, 200);
  fill(m, 80, 80, 20, 20);
  const tight = computeExportBox(m, { x: 40, y: 40, w: 10, h: 10 }); // 只碰到一点点
  const loose = computeExportBox(m, { x: 10, y: 10, w: 180, h: 180 }); // 大松框
  assert(tight && tight.x === 40, '只碰一点也算：' + JSON.stringify(tight));
  assert(loose.x === 40 && loose.y === 40 && loose.w === 10 && loose.h === 10, JSON.stringify(loose));
});

test('whitemargin: 文字墨迹也算（人负责把字框在外面）', () => {
  const m = makeMask(200, 200);
  fill(m, 20, 20, 10, 10);  // 字
  fill(m, 100, 100, 20, 20); // 图
  const box = computeExportBox(m, { x: 5, y: 5, w: 190, h: 190 });
  assert(box.x === 10, '从字的左沿开始：' + box.x);
});

test('whitemargin: 多边形只算内部', () => {
  const m = makeMask(200, 200);
  fill(m, 10, 10, 20, 20);   // 多边形外
  fill(m, 100, 100, 20, 20); // 多边形里
  const poly = [{ x: 40, y: 40 }, { x: 90, y: 40 }, { x: 90, y: 90 }, { x: 40, y: 90 }];
  const box = computeExportBox(m, poly);
  assert(box.x === 50 && box.y === 50, JSON.stringify(box));
});

test('whitemargin: 矩形与等价多边形一致', () => {
  const m = makeMask(200, 200);
  fill(m, 80, 80, 40, 40);
  const a = computeExportBox(m, { x: 30, y: 30, w: 60, h: 60 });
  const b = computeExportBox(m, rectToPoly({ x: 30, y: 30, w: 60, h: 60 }));
  assert(JSON.stringify(a) === JSON.stringify(b));
});

test('whitemargin: 边距默认加在四边，夹在页内', () => {
  const box = { x: 10, y: 20, w: 30, h: 40 };
  const out = withMargin(box, 8, 595, 842);
  assert(out.x === 2 && out.y === 12, JSON.stringify(out));
  assert(out.w === 46 && out.h === 56, JSON.stringify(out));

  const edge = withMargin({ x: 1, y: 1, w: 10, h: 10 }, 8, 595, 842);
  assert(edge.x === 0 && edge.y === 0, '不许出页');
});

test('whitemargin: 边距 0 就是紧贴内容', () => {
  const out = withMargin({ x: 10, y: 10, w: 20, h: 20 }, 0, 100, 100);
  assert(out.x === 10 && out.w === 20);
});

test('whitemargin: cropRect 向内对齐像素网格', () => {
  const crop = cropRect({ x: 10.3, y: 10.7, w: 20.2, h: 15.1 }, 595, 842, 4.1667);
  assert(crop.px[0] >= Math.floor(10.3 * 4.1667 - 0.01));
  assert(crop.w > 0 && crop.h > 0);
});

test('whitemargin: 白/墨判定与标签落点', () => {
  const m = makeMask(100, 100);
  fill(m, 0, 0, 40, 40);
  assert(isWhiteRow(m, 50, 0, 100) === true);
  assert(isWhiteCol(m, 10, 0, 100) === false);
  const label = { w: 5, h: 3 };
  assert(findLabelSpot(m, label, [{ x: 1, y: 1 }]) === null);
  const spot = findLabelSpot(m, label, [{ x: 1, y: 1 }, { x: 30, y: 30 }]);
  assert(spot && spot.x === 30);
});
