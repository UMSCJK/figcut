import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/pdf/ink.js';

const API = ['buildInkMask', 'components', 'strokeAt'];

test('ink: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'ink 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('ink: 2px/pt 栅格下白线判定稳定');
todo('ink: 笔画按连通域整根返回');
