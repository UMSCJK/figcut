import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/drag.js';

const API = ['createDrag', 'beginDrag', 'applyDrag', 'endDrag'];

test('drag: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'drag 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('drag: 拖动超过阈值才算拖，否则是点击');
todo('drag: 整体平移按外接框夹边，形状不变');
