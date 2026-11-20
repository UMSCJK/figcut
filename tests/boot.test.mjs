import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/app/boot.js';

const API = ['boot', 'status'];

test('boot: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'boot 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('boot: 页栈就绪后才置 ready');
todo('boot: ready 之前画的框不能被收尾覆盖');
