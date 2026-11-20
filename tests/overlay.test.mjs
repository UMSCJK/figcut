import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/view/overlay.js';

const API = ['createOverlay', 'drawRegions', 'hitTest'];

test('overlay: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'overlay 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('overlay: 所有页的框始终可见');
todo('overlay: 点其他页的框直接跳过去');
