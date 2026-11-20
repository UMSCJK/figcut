// 入口：装配并启动。构建时被内联，开发时作为 ESM 入口。
import { boot } from './app/boot.js';

export function start() {
  try {
    boot();
  } catch (e) {
    const banner = document.getElementById('banner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = '启动失败：' + (e && e.message ? e.message : e);
    }
    console.error(e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
