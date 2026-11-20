import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/io/config.js';

const API = ['keyForFile', 'loadConfig', 'saveConfig', 'migrate'];

test('config: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'config 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('config: schema3 配置能自动迁移到 4');
todo('config: 改动 200ms 防抖落盘');
todo('config: 打开新文件前先落上一份');
