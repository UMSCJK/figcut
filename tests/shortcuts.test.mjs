import { test, assert } from '../tools/testkit.mjs';
import { resolveKey, nudgeVector, bindShortcuts } from '../src/app/shortcuts.js';

const ev = (key, extra = {}) => ({ key, target: { tagName: 'BODY' }, ...extra });

test('shortcuts: 基础键位', () => {
  assert(resolveKey(ev('n')) === 'page.next');
  assert(resolveKey(ev('p')) === 'page.prev');
  assert(resolveKey(ev('f')) === 'zoom.fitPage');
  assert(resolveKey(ev('s')) === 'zoom.fitWidth');
  assert(resolveKey(ev('+')) === 'zoom.in');
  assert(resolveKey(ev('-')) === 'zoom.out');
  assert(resolveKey(ev('q')) === 'tool.select');
  assert(resolveKey(ev('w')) === 'tool.rect');
  assert(resolveKey(ev('e')) === 'tool.poly');
});

test('shortcuts: Ctrl 组合', () => {
  assert(resolveKey(ev('z', { ctrlKey: true })) === 'history.undo');
  assert(resolveKey(ev('y', { metaKey: true })) === 'history.redo');
  assert(resolveKey(ev('e', { ctrlKey: true })) === 'export.zip');
  assert(resolveKey(ev('0', { ctrlKey: true })) === 'zoom.reset');
  assert(resolveKey(ev('End', { ctrlKey: true })) === 'page.last');
  assert(resolveKey(ev('i', { ctrlKey: true })) === 'view.invert');
});

test('shortcuts: 焦点在输入框时只有 Esc 放行', () => {
  const inInput = (key) => ({ key, target: { tagName: 'INPUT' }, ctrlKey: false });
  assert(resolveKey(inInput('n')) === null, '打字母不能被拦截');
  assert(resolveKey(inInput('z')) === null);
  assert(resolveKey(inInput('Escape')) === 'cancel');
});

test('shortcuts: 微移方向与步长', () => {
  assert(JSON.stringify(nudgeVector({ key: 'ArrowRight', altKey: false })) === '{"dx":1,"dy":0}');
  assert(JSON.stringify(nudgeVector({ key: 'ArrowUp', altKey: true })) === '{"dx":0,"dy":-10}');
});

test('shortcuts: bindShortcuts 分发并 preventDefault', () => {
  const listeners = [];
  const target = { addEventListener: (t, fn) => listeners.push(fn), removeEventListener: () => {} };
  let got = null;
  let prevented = false;
  bindShortcuts(target, { 'page.next': () => { got = 'page.next'; } });
  listeners[0]({ key: 'n', target: { tagName: 'BODY' }, preventDefault: () => { prevented = true; } });
  assert(got === 'page.next' && prevented);
});
