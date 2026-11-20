import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/history.js';

const API = ['createHistory', 'commit', 'undo', 'redo', 'canUndo', 'canRedo'];

test('history: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'history 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('history: 连续微移 600ms 内合并成一条历史');
todo('history: 撤销到底后 canUndo 为 false');
