// 画布右下角缩放控件：− 100% + ▾
// 状态：已实现。

import { setScale, setFit } from '../view/zoom.js';
import { zoomPresets } from '../core/layout.js';
import { ICONS } from './icons.js';

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

  const input = doc.createElement('input');
  input.className = 'zoom-input';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', '缩放百分比');

  const plus = doc.createElement('button');
  plus.type = 'button';
  plus.className = 'icon-btn';
  plus.innerHTML = ICONS.plus;
  plus.setAttribute('aria-label', '放大');

  const fitPage = doc.createElement('button');
  fitPage.type = 'button';
  fitPage.className = 'icon-btn';
  fitPage.innerHTML = ICONS.fitPage;
  fitPage.title = '适应页高 (f)';
  fitPage.setAttribute('aria-label', '适应页高');

  const fitWidth = doc.createElement('button');
  fitWidth.type = 'button';
  fitWidth.className = 'icon-btn';
  fitWidth.innerHTML = ICONS.fitWidth;
  fitWidth.title = '适应页宽 (w)';
  fitWidth.setAttribute('aria-label', '适应页宽');

  const sep = doc.createElement('span');
  sep.className = 'zoom-sep';

  const menu = doc.createElement('select');
  menu.className = 'zoom-presets';
  menu.setAttribute('aria-label', '缩放预设');
  for (const p of zoomPresets()) {
    const o = doc.createElement('option');
    o.value = String(p);
    o.textContent = Math.round(p * 100) + '%';
    menu.appendChild(o);
  }

  box.append(minus, input, plus, sep, fitPage, fitWidth, menu);
  container.appendChild(box);

  const sync = () => {
    input.value = Math.round(z.scale * 100) + '%';
    const want = String(Number(z.scale.toFixed(4)));
    const has = Array.prototype.some.call(menu.options, (o) => o.value === want);
    // 不在预设台阶上（比如适应页宽算出 157%）就清空，别显示一个假的 100%
    menu.value = has ? want : '';
  };
  sync();

  minus.addEventListener('click', () => setScale(z, z.scale / 1.2));
  plus.addEventListener('click', () => setScale(z, z.scale * 1.2));
  fitPage.addEventListener('click', () => opts.onFitPage && opts.onFitPage());
  fitWidth.addEventListener('click', () => opts.onFitWidth && opts.onFitWidth());
  input.addEventListener('change', () => {
    const n = parseFloat(String(input.value).replace('%', ''));
    if (Number.isFinite(n) && n > 0) setScale(z, n / 100);
    else sync();
  });
  menu.addEventListener('change', () => setScale(z, Number(menu.value)));

  if (typeof z.listeners !== 'undefined') z.listeners.add(sync);

  return { box, sync };
}

// 兼容骨架里声明的名字
export function bindZoomInput(control, zoom) {
  control.sync = () => {
    control.input.value = Math.round(zoom.scale * 100) + '%';
  };
  return control;
}
