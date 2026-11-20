import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/app/open.js';

const API = ['openFile', 'acceptDrop'];

test('open: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'open 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('open: 一次只处理一个 PDF');
todo('open: 打开新文件前先保存旧文件标注');
