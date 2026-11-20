// 画布右下角缩放控件：− [100% ▾] +，菜单是两列五行的紧凑版
// 状态：已实现。+/- 只在预设档位里走；整页/页宽显示实时算出的百分比。

import { setScale } from '../view/zoom.js';
import { ICONS } from './icons.js';

// 按钮步进用的档位
export const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

// 菜单：两列五行
const MENU = [
  [0.5, 5],
  [0.67, 2],
  [0.75, 1.5],
  [1, 1.25],
  ['fit-width'],
];

const pct = (v) => {
  const p = v * 100;
  return (p >= 100 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
};

export function stepIndex(scale) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < STEPS.length; i += 1) {
    const d = Math.abs(STEPS[i] - scale);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function renderZoomControl(opts) {
  const { container, zoom: z } = opts;
  const doc = container.ownerDocument;
  const fitPcts = opts.fitPcts || (() => ({ page: null, width: null }));

  const box = doc.createElement('div');
  box.className = 'zoom-control';

  const minus = doc.createElement('button');
  minus.type = 'button';
  minus.className = 'icon-btn';
  minus.innerHTML = ICONS.minus;
  minus.setAttribute('aria-label', '缩小');

  const plus = doc.createElement('button');
  plus.type = 'button';
  plus.className = 'icon-btn';
  plus.innerHTML = ICONS.plus;
  plus.setAttribute('aria-label', '放大');

  const entry = doc.createElement('button');
  entry.type = 'button';
  entry.className = 'zoom-entry';
  entry.setAttribute('aria-haspopup', 'menu');

  box.append(minus, entry, plus);
  container.appendChild(box);

  const menu = doc.createElement('div');
  menu.className = 'zoom-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const cells = [];
  for (const row of MENU) {
    for (const item of row) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'zoom-cell';
      btn.dataset.action = typeof item === 'string' ? item : 'set';
      if (typeof item === 'number') btn.dataset.value = String(item);
      btn.addEventListener('click', () => {
        close();
        if (typeof item === 'number') setScale(z, item);
        else if (item === 'fit-width') opts.onFitWidth && opts.onFitWidth();
      });
      cells.push(btn);
      menu.appendChild(btn);
    }
  }
  doc.body.appendChild(menu);

  function place() {
    const r = box.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
    menu.style.top = 'auto';
  }

  function open() {
    place();
    syncCells();
    menu.hidden = false;
    entry.classList.add('is-open');
    doc.addEventListener('pointerdown', onOutside, true);
    doc.addEventListener('keydown', onKey, true);
  }

  function close() {
    menu.hidden = true;
    entry.classList.remove('is-open');
    doc.removeEventListener('pointerdown', onOutside, true);
    doc.removeEventListener('keydown', onKey, true);
  }

  function onOutside(ev) {
    if (menu.contains(ev.target) || box.contains(ev.target)) return;
    close();
  }

  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }

  entry.addEventListener('click', () => (menu.hidden ? open() : close()));

  function syncCells() {
    const fits = fitPcts();
    for (const btn of cells) {
      const action = btn.dataset.action;
      if (action === 'set') {
        const v = Number(btn.dataset.value);
        btn.textContent = pct(v);
        btn.classList.toggle('on', !z.auto && z.mode === 'free' && Math.abs(z.scale - v) < 1e-6);
      } else {
        btn.textContent = fits.width ? '页宽 ' + pct(fits.width) : '页宽';
        btn.classList.toggle('on', z.mode === 'width');
        btn.classList.add('is-wide');
      }
    }
  }

  function sync() {
    let label = pct(z.scale);
    if (z.auto) label = '自动';
    else if (z.mode === 'width') label = '页宽';
    else if (z.mode === 'page') label = pct(z.scale);
    entry.textContent = label + ' ▾';
    entry.title = '缩放：' + label;
    if (!menu.hidden) syncCells();
  }
  sync();
  z.listeners.add(sync);

  minus.addEventListener('click', () => {
    const i = stepIndex(z.scale);
    setScale(z, STEPS[Math.max(0, i - 1)]);
  });
  plus.addEventListener('click', () => {
    const i = stepIndex(z.scale);
    setScale(z, STEPS[Math.min(STEPS.length - 1, i + 1)]);
  });

  return { box, sync, menu };
}

export function bindZoomInput(control) {
  return control;
}
