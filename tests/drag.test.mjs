import { test, assert } from '../tools/testkit.mjs';
import { createDrag, beginDrag, applyDrag, endDrag } from '../src/core/drag.js';

const R = { x: 10, y: 10, w: 20, h: 20 };

test('drag: 没过阈值当成点击，endDrag 返回 null', () => {
  const d = createDrag();
  beginDrag(d, { x: 100, y: 100, rect: R });
  const moved = applyDrag(d, { x: 101, y: 101 });
  assert(moved.x === 10 && moved.y === 10, '没过阈值不许动');
  assert(endDrag(d) === null, '点击不该留下框');
});

test('drag: 过阈值后整体平移', () => {
  const d = createDrag();
  beginDrag(d, { x: 100, y: 100, rect: R });
  const moved = applyDrag(d, { x: 130, y: 140 });
  assert(moved.x === 40 && moved.y === 50, '实际 ' + JSON.stringify(moved));
  assert(moved.w === 20 && moved.h === 20, '大小不变');
  assert(endDrag(d) !== null, '真拖动才算一次');
});

test('drag: 越界时按页夹住，形状不变', () => {
  const d = createDrag();
  beginDrag(d, { x: 100, y: 100, rect: R });
  const moved = applyDrag(d, { x: -500, y: -500 }, { pageW: 100, pageH: 100 });
  assert(moved.x === 0 && moved.y === 0, '贴左上');
  assert(moved.w === 20 && moved.h === 20, '形状不变');
});

test('drag: 没按下时 applyDrag 返回 null', () => {
  const d = createDrag();
  assert(applyDrag(d, { x: 1, y: 1 }) === null);
});
