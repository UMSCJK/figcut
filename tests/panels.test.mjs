import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/panels.js';

const API = ['togglePanel', 'setWidth', 'clampWidth'];

test('panels: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'panels 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('panels: 折叠后分隔条隐藏');
todo('panels: 宽度写进 localStorage');
