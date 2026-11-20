import { test, assert } from '../tools/testkit.mjs';
import { createShell, setTitle, addButton } from '../src/ui/shell.js';

test('shell: 没有 DOM 时明确报错', () => {
  let threw = false;
  try {
    createShell();
  } catch (e) {
    threw = e && e.code === 'no-dom';
  }
  assert(threw, 'node 里应抛 no-dom');
});

test('shell: 用假 DOM 读写标题与按钮', () => {
  const make = (id) => ({ id, textContent: '', children: [], appendChild(n) { this.children.push(n); }, addEventListener() {}, style: {} });
  const nodes = {
    'topbar-left': make('topbar-left'),
    'topbar-right': make('topbar-right'),
    'topbar-title': make('topbar-title'),
    canvas: make('canvas'),
    'panel-left': make('panel-left'),
    'panel-right': make('panel-right'),
    empty: make('empty'),
    banner: make('banner'),
  };
  const doc = {
    getElementById: (id) => nodes[id] || null,
    createElement: () => ({ ...make('btn'), setAttribute() {}, addEventListener() {} }),
  };
  nodes.canvas.ownerDocument = doc;
  nodes['topbar-left'].ownerDocument = doc;

  const shell = createShell({ getElementById: doc.getElementById });
  assert(shell.title === nodes['topbar-title']);
  setTitle(shell, 'a.pdf · 12 页');
  assert(nodes['topbar-title'].textContent === 'a.pdf · 12 页');

  const btn = addButton(shell, 'left', '打开', () => {});
  assert(btn.textContent === '打开');
  assert(nodes['topbar-left'].children.length === 1);
});
