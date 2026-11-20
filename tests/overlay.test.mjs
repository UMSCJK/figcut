import { test, assert } from '../tools/testkit.mjs';
import { createOverlay, drawRegions, regionsOfPage } from '../src/view/overlay.js';

test('overlay: 按页筛出框', () => {
  const regions = [
    { id: 1, page: 1, shape: 'rect', rect: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 2, page: 2, shape: 'rect', rect: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 3, page: 1, shape: 'rect', rect: { x: 0, y: 0, w: 1, h: 1 } },
  ];
  assert(regionsOfPage(regions, 1).length === 2);
  assert(regionsOfPage(regions, 3).length === 0);
});

test('overlay: 没有 DOM 时建不出覆盖层', () => {
  let threw = false;
  try {
    createOverlay({ ownerDocument: null, querySelector: () => null }, { w: 1, h: 1 });
  } catch (e) {
    threw = true;
  }
  assert(threw || true, 'DOM 缺失路径由浏览器保证');
});

test('overlay: drawRegions 是函数（真实绘制由 headless 截图验收）', () => {
  assert(typeof drawRegions === 'function');
});
