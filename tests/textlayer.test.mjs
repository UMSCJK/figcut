import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/pdf/textlayer.js';

const API = ['readTextLayer', 'textBoxesOnPage'];

test('textlayer: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'textlayer 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('textlayer: 批量读宽再批量写 transform，避免逐 span 重排');
