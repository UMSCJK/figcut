import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/shell.js';

const API = ['createShell', 'setTitle', 'setFileInfo'];

test('shell: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'shell 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('shell: 标题绝对居中');
todo('shell: 两侧栏可拖宽 120-360 / 160-420');
