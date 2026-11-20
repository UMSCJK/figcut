import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/page-list.js';

const API = ['renderPageList', 'markCurrent'];

test('page-list: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'page-list 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('page-list: 每页显示已标注数量');
todo('page-list: 当前页高亮并自动滚入视野');
