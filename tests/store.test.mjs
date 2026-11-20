import { test, assert } from '../tools/testkit.mjs';
import { createStore, getState, setState, subscribe } from '../src/core/store.js';

test('store: setState 通知所有订阅者', () => {
  const s = createStore({ n: 0 });
  const seen = [];
  subscribe(s, (next, prev) => seen.push([prev.n, next.n]));
  setState(s, { n: 1 });
  setState(s, { n: 2 });
  assert(seen.length === 2);
  assert(seen[0][0] === 0 && seen[0][1] === 1);
});

test('store: 退订后不再通知', () => {
  const s = createStore(0);
  let calls = 0;
  const off = subscribe(s, () => { calls += 1; });
  setState(s, 1);
  off();
  setState(s, 2);
  assert(calls === 1, '退订后应只收到 1 次，实际 ' + calls);
});

test('store: 同值不触发通知，函数式更新可用', () => {
  const s = createStore(1);
  let calls = 0;
  subscribe(s, () => { calls += 1; });
  setState(s, 1);
  assert(calls === 0, '同值不该通知');
  setState(s, (prev) => prev + 1);
  assert(getState(s) === 2 && calls === 1);
});
