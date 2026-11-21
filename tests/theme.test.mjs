import { test, assert } from '../tools/testkit.mjs';
import { createTheme, cycleUi, cyclePdfPreview, resolvedUi, isInverted, applyTheme } from '../src/ui/theme.js';

test('theme: 默认浅色界面 + 浅色 PDF', () => {
  const t = createTheme();
  assert(t.ui === 'light');
  assert(t.pdf === 'normal');
});

test('theme: 界面三态循环 跟随系统→浅→深', () => {
  const t = createTheme({ ui: 'system' });
  assert(cycleUi(t) === 'light');
  assert(cycleUi(t) === 'dark');
  assert(cycleUi(t) === 'system');
});

test('theme: PDF 三态循环 跟随界面→正常→反相', () => {
  const t = createTheme({ pdf: 'auto' });
  assert(t.pdf === 'auto');
  assert(cyclePdfPreview(t) === 'normal');
  assert(cyclePdfPreview(t) === 'invert');
  assert(cyclePdfPreview(t) === 'auto');
});

test('theme: 跟随系统时按浅色/深色解析', () => {
  const t = createTheme({ ui: 'system' });
  assert(resolvedUi(t, false) === 'light');
  assert(resolvedUi(t, true) === 'dark');
});

test('theme: 两套配色互不影响', () => {
  const t = createTheme({ ui: 'dark', pdf: 'normal' });
  assert(isInverted(t, true) === false, 'PDF 选了正常就不反相');
  t.pdf = 'auto';
  assert(isInverted(t, true) === true, '跟随界面且界面深色 → 反相');

  const t2 = createTheme({ ui: 'light', pdf: 'invert' });
  assert(isInverted(t2, false) === true, 'PDF 选反相就反相，与界面无关');
});

test('theme: 写进 DOM 的 data 属性', () => {
  const root = { dataset: {} };
  const out = applyTheme(createTheme({ ui: 'dark', pdf: 'auto' }), { documentElement: root }, false);
  assert(root.dataset.ui === 'dark');
  assert(root.dataset.pdfInvert === '1');
  assert(out.inverted === true);
});
