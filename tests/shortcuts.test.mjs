import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/app/shortcuts.js';

const API = ['bindShortcuts', 'resolveKey'];

test('shortcuts: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'shortcuts 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('shortcuts: 焦点在输入框时不拦截');
todo('shortcuts: Shift+PgDn 是跳 10 页');
