// 快捷键表与输入框豁免
// 状态：已实现。resolveKey 是纯函数，绑定时只负责 preventDefault + 分发。

export const KEYMAP = {
  v: 'tool.select',
  r: 'tool.rect',
  g: 'tool.poly',
  n: 'page.next',
  p: 'page.prev',
  f: 'zoom.fitPage',
  w: 'zoom.fitWidth',
  '+': 'zoom.in',
  '=': 'zoom.in',
  '-': 'zoom.out',
  c: 'view.continuous',
  d: 'view.dual',
  o: 'view.oddLeft',
};

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

function isTyping(ev) {
  const t = ev.target;
  if (!t) return false;
  if (t.isContentEditable) return true;
  return TYPING_TAGS.includes(String(t.tagName || '').toUpperCase());
}

// 焦点在输入框时不拦截（Esc 除外），否则用户打不出字母 n。
export function resolveKey(ev) {
  const key = ev.key;
  if (!key) return null;
  const ctrl = !!(ev.ctrlKey || ev.metaKey);

  if (isTyping(ev)) return key === 'Escape' ? 'cancel' : null;

  if (ctrl) {
    const lower = key.toLowerCase();
    if (lower === 'z') return 'history.undo';
    if (lower === 'y') return 'history.redo';
    if (lower === 'e') return 'export.zip';
    if (lower === 's') return 'config.save';
    if (lower === 'o') return 'file.open';
    if (lower === 'i') return 'view.invert';
    if (key === '0') return 'zoom.reset';
    if (key === 'Home') return 'page.first';
    if (key === 'End') return 'page.last';
    return null;
  }

  if (key === 'Escape') return 'cancel';
  if (key === 'Enter') return 'tool.closePoly';
  if (key === 'Delete' || key === 'Backspace') return 'region.delete';
  if (key === 'PageDown') return ev.shiftKey ? 'page.plus10' : 'page.next';
  if (key === 'PageUp') return ev.shiftKey ? 'page.minus10' : 'page.prev';

  if (key.startsWith('Arrow')) {
    if (!ev.shiftKey) return null;
    return 'region.nudge';
  }

  const mapped = KEYMAP[key.toLowerCase()];
  return mapped || null;
}

// nudge 需要方向信息，单独给一个纯函数，方便单测。
export function nudgeVector(ev) {
  const step = ev.altKey ? 10 : 1;
  switch (ev.key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return { dx: 0, dy: 0 };
  }
}

export function bindShortcuts(target, handlers, opts = {}) {
  const onKey = (ev) => {
    const action = resolveKey(ev);
    if (!action) return;
    const fn = handlers[action];
    if (!fn) return;
    ev.preventDefault();
    fn(ev, action);
  };
  const el = target || (typeof document !== 'undefined' ? document : null);
  if (!el) return () => {};
  el.addEventListener('keydown', onKey);
  return () => el.removeEventListener('keydown', onKey);
}
