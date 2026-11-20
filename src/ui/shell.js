// 顶栏与三栏骨架
// 状态：已实现。只读 DOM 引用 + 少量写操作。

import { figcutError } from '../core/errors.js';

export function createShell(root) {
  const doc = root || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw figcutError('no-dom', '没有 DOM 就搭不出骨架');

  const el = (id) => {
    const node = doc.getElementById(id);
    if (!node) throw figcutError('missing-node', 'index.html 缺少 #' + id, { id });
    return node;
  };

  return {
    left: el('topbar-left'),
    right: el('topbar-right'),
    title: el('topbar-title'),
    canvas: el('canvas'),
    panelLeft: el('panel-left'),
    panelRight: el('panel-right'),
    empty: el('empty'),
    banner: el('banner'),
  };
}

export function setTitle(shell, text) {
  shell.title.textContent = text;
  return text;
}

export function setFileInfo(shell, text) {
  shell.title.textContent = text;
  return text;
}

export function setEmpty(shell, visible) {
  shell.empty.style.display = visible ? '' : 'none';
}

export function addButtonTo(container, label, onClick, opts = {}) {
  const doc = (container && container.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw figcutError('no-dom', '没有 DOM 就加不了按钮');
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = opts.kind === 'btn' ? 'btn' : 'icon-btn';
  if (opts.suggested) btn.classList.add('suggested');
  if (opts.icon) btn.innerHTML = opts.icon;
  else btn.textContent = label;
  if (opts.title) btn.title = opts.title;
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel);
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
  return btn;
}

export function addButton(shell, side, label, onClick, opts = {}) {
  return addButtonTo(side === 'right' ? shell.right : shell.left, label, onClick, opts);
}
