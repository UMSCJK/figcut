import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/naming.js';

const API = ['pad', 'stemName', 'optName', 'regionFileName', 'zipName', 'configKey'];

test('naming: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'naming 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('naming: 命名形如 p01-02-optC.png');
todo('naming: 长题号补零到两位');
todo('naming: configKey 用 文件名|字节数，改名等于新文件');
