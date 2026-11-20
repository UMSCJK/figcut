// 画布右下角缩放控件：− [110% ▾] +，点中间弹出 Firefox/Okular 那种菜单
// 状态：已实现。

import { setScale, setFit } from '../view/zoom.js';
import { zoomPresets } from '../core/layout.js';
import { ICONS } from './icons.js';

const PRESETS = [0.12, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16, 25, 50, 100];

const pct = (v) => {
  const p = v * 100;
  return (p >= 100 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
};

export function renderZoomControl(opts) {
  const { container, zoom: z } = opts;
  const doc = container.ownerDocument;

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

  // ---- 弹出菜单 ----
  const menu = doc.createElement('div');
  menu.className = 'zoom-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const items = [
    { action: 'auto', label: '自动缩放' },
    { action: 'actual', label: '实际大小' },
    { action: 'fit-page', label: '适合页面' },
    { action: 'fit-width', label: '适合页宽' },
    { action: 'sep' },
    ...PRESETS.map((v) => ({ action: 'set', value: v, label: pct(v) })),
  ];

  const itemEls = [];
  for (const it of items) {
    if (it.action === 'sep') {
      const hr = doc.createElement('hr');
      menu.appendChild(hr);
      continue;
    }
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'zoom-item';
    btn.dataset.action = it.action;
    if (it.value !== undefined) btn.dataset.value = String(it.value);
    btn.textContent = it.label;
    btn.addEventListener('click', () => {
      close();
      z.auto = it.action === 'auto';
      if (it.action === 'set') setScale(z, it.value);
      else if (it.action === 'actual') setScale(z, 1);
      else if (it.action === 'fit-page') opts.onFitPage && opts.onFitPage();
      else if (it.action === 'fit-width') opts.onFitWidth && opts.onFitWidth();
      else if (it.action === 'auto') opts.onFitPage && opts.onFitPage();
    });
    itemEls.push(btn);
    menu.appendChild(btn);
  }
  doc.body.appendChild(menu);

  function place() {
    const r = box.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
  }

  function open() {
    place();
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

  const sync = () => {
    let label = pct(z.scale);
    if (z.auto) label = '自动缩放';
    else if (z.mode === 'fit-page') label = '适合页面';
    else if (z.mode === 'fit-width') label = '适合页宽';
    entry.textContent = label + ' ▾';
    entry.title = '缩放：' + label;
    const active = z.auto
      ? 'auto'
      : z.mode === 'fit-page'
        ? 'fit-page'
        : z.mode === 'fit-width'
          ? 'fit-width'
          : Math.abs(z.scale - 1) < 1e-6
            ? 'actual'
            : 'set';
    for (const btn of itemEls) {
      const hit = btn.dataset.action === active
        && (active !== 'set' || Math.abs(Number(btn.dataset.value) - z.scale) < 1e-6);
      btn.classList.toggle('on', hit);
    }
  };
  sync();
  z.listeners.add(sync);

  minus.addEventListener('click', () => setScale(z, z.scale / 1.2));
  plus.addEventListener('click', () => setScale(z, z.scale * 1.2));

  return { box, sync, menu };
}

export function bindZoomInput(control, zoom) {
  return control;
}
