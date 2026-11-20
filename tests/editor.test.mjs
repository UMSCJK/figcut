import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/view/editor.js';

const API = ['createEditor', 'pointerDown', 'pointerMove', 'pointerUp', 'deleteSelection', 'nudge'];

test('editor: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'editor 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('editor: 矩形拖顶点保持矩形，对角固定不翻转');
todo('editor: 新建框后自动选中并聚焦题号');
