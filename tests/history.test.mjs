import { test, assert } from '../tools/testkit.mjs';
import { createHistory, commit, undo, redo, canUndo, canRedo } from '../src/core/history.js';

function clock() {
  let t = 0;
  return { now: () => t, tick: (d) => { t += d; } };
}

test('history: 同 key 在合并窗口内只留一条', () => {
  const c = clock();
  const h = createHistory({ now: c.now });
  commit(h, 1, { key: 'nudge' });
  c.tick(100);
  commit(h, 2, { key: 'nudge' });
  c.tick(100);
  commit(h, 3, { key: 'nudge' });
  assert(h.past.length === 1, '应合并成一条，实际 ' + h.past.length);
  assert(h.past[0] === 3, '留下的是最后一条');
});

test('history: 超窗口或换 key 就另起一条', () => {
  const c = clock();
  const h = createHistory({ now: c.now, windowMs: 600 });
  commit(h, 1, { key: 'nudge' });
  c.tick(601);
  commit(h, 2, { key: 'nudge' });
  assert(h.past.length === 2, '超窗口应另起');

  c.tick(10);
  commit(h, 3, { key: 'drag' });
  assert(h.past.length === 3, '换 key 应另起');
});

test('history: 撤销重做走栈，新提交清空重做', () => {
  const h = createHistory({ now: () => 0 });
  commit(h, 1);
  commit(h, 2);
  assert(canUndo(h) && !canRedo(h));
  assert(undo(h) === 2);
  assert(undo(h) === 1);
  assert(undo(h) === null, '到底返回 null');
  assert(canRedo(h));
  assert(redo(h) === 1);
  commit(h, 9);
  assert(!canRedo(h), '新提交后重做栈应清空');
});

test('history: 超过上限丢掉最旧的', () => {
  const h = createHistory({ now: () => 0, limit: 3 });
  for (const v of [1, 2, 3, 4, 5]) commit(h, v);
  assert(h.past.length === 3);
  assert(h.past[0] === 3 && h.past[2] === 5);
});
