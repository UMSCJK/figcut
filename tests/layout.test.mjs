import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/layout.js';

const API = ['pageCombos', 'fitPageScale', 'fitWidthScale', 'zoomPresets', 'stepZoom'];

test('layout: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'layout 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('layout: 双页书式第一页单独在右');
todo('layout: 奇数页在左开关切换配对');
todo('layout: 适应页面按真实上下 padding 算，整页可见');
todo('layout: 适应宽度时 scrollWidth <= clientWidth');
