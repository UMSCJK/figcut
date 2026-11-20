import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/pdf/document.js';

const API = ['openDocument', 'pageCount', 'pageSize'];

test('document: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'document 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('document: A4 卷子读出的页尺寸是 595x842 pt');
