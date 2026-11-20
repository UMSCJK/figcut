import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/zoom-control.js';

const API = ['renderZoomControl', 'bindZoomInput'];

test('zoom-control: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'zoom-control 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('zoom-control: 百分比可输入');
todo('zoom-control: 下拉是缩放预设台阶');
