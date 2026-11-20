import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/store.js';

const API = ['createStore', 'getState', 'setState', 'subscribe'];

test('store: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'store 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('store: setState 后通知所有订阅者');
todo('store: 退订后不再收到通知');
