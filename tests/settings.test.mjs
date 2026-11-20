import { test, assert } from '../tools/testkit.mjs';
import { createSettings, setDpi, setMargin, clampDpi, clampMargin, loadSettings, saveSettings, SETTINGS_KEY } from '../src/app/settings.js';

function memory(seed) {
  const map = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
}

test('settings: 默认 300dpi / 8pt', () => {
  const s = createSettings();
  assert(s.dpi === 300 && s.margin === 8);
});

test('settings: DPI 夹在 72-1200，边距夹在 0-80', () => {
  const s = createSettings();
  assert(setDpi(s, 10) === 72);
  assert(setDpi(s, 5000) === 1200);
  assert(setMargin(s, -5) === 0);
  assert(setMargin(s, 999) === 80);
  assert(clampDpi(NaN) === 72, 'NaN 落到下界');
  assert(clampMargin(NaN) === 8, 'NaN 回默认');
});

test('settings: 存读一致', () => {
  const st = memory();
  const s = createSettings({ dpi: 150, margin: 4.5 });
  assert(saveSettings(st, s) === true);
  const back = loadSettings(st);
  assert(back.dpi === 150 && back.margin === 4.5);
  assert(JSON.parse(st.getItem(SETTINGS_KEY)).dpi === 150);
});

test('settings: 没有记录时给默认值', () => {
  assert(loadSettings(memory()).dpi === 300);
  assert(loadSettings(null).margin === 8);
});
