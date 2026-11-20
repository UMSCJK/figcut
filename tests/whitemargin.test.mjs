import { test, assert } from '../tools/testkit.mjs';
import {
  isWhiteRow,
  isWhiteCol,
  snapToWhite,
  growToStroke,
  pushTextOut,
  findLabelSpot,
  computeExportBox,
} from '../src/core/whitemargin.js';

// ---- 合成掩膜工具 ----
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
// 四边指"框里最外那一行/列"必须是纯白（导出图的第一列像素就是它）。
function edgesWhite(mask, box) {
  const x1 = box.x + box.w - 1;
  const y1 = box.y + box.h - 1;
  return {
    top: isWhiteRow(mask, box.y, box.x, x1 + 1),
    bottom: isWhiteRow(mask, y1, box.x, x1 + 1),
    left: isWhiteCol(mask, box.x, box.y, y1 + 1),
    right: isWhiteCol(mask, x1, box.y, y1 + 1),
  };
}

test('whitemargin: 空掩膜全白，画一笔后横竖都不白', () => {
  const m = makeMask(50, 50);
  assert(isWhiteRow(m, 10, 0, 50) === true);
  fill(m, 10, 0, 4, 50); // 竖笔
  assert(isWhiteCol(m, 10, 0, 50) === false);
  assert(isWhiteRow(m, 10, 0, 9) === true, '笔画左边的行段仍是白的');
});

test('whitemargin: 笔画跨在框外时整根收进来', () => {
  const m = makeMask(200, 200);
  fill(m, 90, 40, 6, 120); // 竖笔 y=40..159
  const box = growToStroke(m, { x: 20, y: 60, w: 160, h: 80 });
  assert(box.y <= 40, '上端要收到笔画起点：' + box.y);
  assert(box.y + box.h >= 160, '下端要收到笔画末点：' + (box.y + box.h));
  assert(box.x === 20 && box.w === 160, '没碰到的边不许动');
});

test('whitemargin: 框底擦到下方图案 1pt 不得把整块吞进来', () => {
  const m = makeMask(200, 200);
  fill(m, 20, 100, 160, 80); // 80px 高的大图案
  const box = growToStroke(m, { x: 20, y: 50, w: 160, h: 52 }); // 底边 102，插进去 2px
  assert(box.y + box.h <= 100, '底边应被推回图案上沿：' + (box.y + box.h));
  assert(box.h >= 2, '框不能被压没');
});

test('whitemargin: snapToWhite 四边都落到纯白行/列', () => {
  const m = makeMask(200, 200);
  fill(m, 0, 40, 200, 5); // 横带 y=40..44
  const box = snapToWhite(m, { x: 20, y: 38, w: 100, h: 6 });
  const e = edgesWhite(m, box);
  assert(e.top && e.bottom && e.left && e.right, '四边必须全白：' + JSON.stringify(e));
  assert(isWhiteRow(m, box.y, box.x, box.x + box.w), '上边白');
});

test('whitemargin: 压到文字时文字让出框外', () => {
  const m = makeMask(200, 200);
  const text = { x: 20, y: 20, w: 40, h: 10 };
  const box = pushTextOut(m, { x: 10, y: 10, w: 100, h: 100 }, [text]);
  const overlapX = box.x < text.x + text.w && box.x + box.w > text.x;
  const overlapY = box.y < text.y + text.h && box.y + box.h > text.y;
  assert(!(overlapX && overlapY), '导出框不能压着文字：' + JSON.stringify(box));
  assert(box.w > 0 && box.h > 0);
});

test('whitemargin: 标签只落在纯白处，否则不给位置', () => {
  const m = makeMask(200, 200);
  fill(m, 0, 0, 60, 60); // 左上角一片墨
  const label = { w: 10, h: 10 };
  const dirty = findLabelSpot(m, label, [{ x: 5, y: 5 }, { x: 55, y: 55 }]);
  assert(dirty === null, '所有候选都在墨上时应返回 null');

  const clean = findLabelSpot(m, label, [{ x: 5, y: 5 }, { x: 100, y: 100 }]);
  assert(clean !== null && clean.x === 100 && clean.y === 100, '应命中空白候选：' + JSON.stringify(clean));
});

test('whitemargin: computeExportBox 出来的四边一定纯白', () => {
  const m = makeMask(200, 200, 2);
  fill(m, 60, 60, 40, 40); // 40x40px 图案
  const box = computeExportBox(m, { x: 28, y: 28, w: 22, h: 22 }); // pt，正好套住图案但边在墨上
  const e = edgesWhite(m, {
    x: Math.round(box.x * 2),
    y: Math.round(box.y * 2),
    w: Math.round(box.w * 2),
    h: Math.round(box.h * 2),
  });
  assert(e.top && e.bottom && e.left && e.right, '四边必须纯白：' + JSON.stringify(e));
  assert(box.w >= 20 && box.h >= 20, '框不能比图案还小：' + JSON.stringify(box));
});
