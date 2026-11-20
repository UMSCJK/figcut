import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/errors.js';

const API = ['figcutError', 'notImplemented'];

test('errors: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'errors 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('errors: figcutError 带 code 与上下文');
todo('errors: notImplemented 抛出的错误能定位到模块名');
