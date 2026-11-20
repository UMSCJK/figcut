import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/view/navigator.js';

const API = ['createNavigator', 'nextPage', 'prevPage', 'gotoPage'];

test('navigator: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'navigator 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('navigator: 分页模式滚轮只在页内滚不翻页');
todo('navigator: Shift+PgDn 跳 10 页');
