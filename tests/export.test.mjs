import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/io/export.js';

const API = ['computePixels', 'renderPng', 'exportRegions'];

test('export: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'export 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('export: 导出图尺寸等于 (导出框+边距)xDPI，像素对齐不重采样');
todo('export: 边距只往白色里加，碰到相邻图形就停在白线');
todo('export: 边距为 0 时四边仍必须纯白');
