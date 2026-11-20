import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/pdf/bitmap.js';

const API = ['renderPage', 'cacheKey', 'clearCache'];

test('bitmap: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'bitmap 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('bitmap: 缓存键含文档身份，换文件不复用');
todo('bitmap: 缩放后重绘，不拉伸旧位图');
