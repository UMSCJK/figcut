import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/view/page-stack.js';

const API = ['createPageStack', 'setCurrent', 'visibleRects'];

test('page-stack: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'page-stack 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('page-stack: 切页先回写旧页再换当前页');
todo('page-stack: 只有当前页可编辑');
