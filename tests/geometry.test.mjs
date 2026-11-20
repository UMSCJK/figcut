import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/geometry.js';

const API = ['normRect', 'rectFromPoints', 'clampRect', 'expandRect', 'polyBounds', 'movePoly', 'hitTestRect', 'hitTestPoly', 'cornerAt'];

test('geometry: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'geometry 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('geometry: 反着拖出的矩形要归一化成正的宽高');
todo('geometry: rectFromPoints 小于 2pt 视为误触返回 null');
todo('geometry: 平移多边形保持形状且整体夹在页内');
todo('geometry: 顶点命中半径与缩放无关');
