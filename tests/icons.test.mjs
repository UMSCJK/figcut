import { test, assert } from '../tools/testkit.mjs';
import { ICONS, icon } from '../src/ui/icons.js';

test('icons: 每个图标都是 16x16 的 svg 字符串', () => {
  const names = Object.keys(ICONS);
  assert(names.length >= 8, '图标数量：' + names.length);
  for (const n of names) {
    assert(ICONS[n].startsWith('<svg'), n + ' 不是 svg');
    assert(ICONS[n].includes('currentColor'), n + ' 没用 currentColor');
  }
});

test('icons: 未知名字有兜底', () => {
  assert(icon('nope').startsWith('<svg'));
});
