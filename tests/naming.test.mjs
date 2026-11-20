import { test, assert } from '../tools/testkit.mjs';
import { pad, sanitize, stemName, optName, roleOf, regionFileName, zipName, configKey } from '../src/core/naming.js';

test('naming: 序号补零', () => {
  assert(pad(1) === '01');
  assert(pad(12) === '12');
});

test('naming: 文件名带页、题号、角色、备注', () => {
  assert(regionFileName({ page: 9, q: '28', kind: 'stem' }) === 'p09-q28-stem.png');
  assert(regionFileName({ page: 9, q: '29', kind: 'opt', opt: 'B', note: '第二行' }) === 'p09-q29-optB-第二行.png');
  assert(regionFileName({ page: 1, kind: 'opt', opt: 'A' }) === 'p01-q00-optA.png', '没题号用 00');
});

test('naming: A-K 全支持，自定义选项进文件名', () => {
  assert(optName('K') === 'optK');
  assert(optName(10) === 'optK');
  assert(roleOf({ kind: 'opt', opt: 'custom', optText: '甲' }) === 'opt甲');
  assert(roleOf({ kind: 'opt', opt: 'custom', optText: '' }) === 'optX');
});

test('naming: 非法字符清洗', () => {
  assert(sanitize(' a/b:c*? ' ) === 'a_b_c', sanitize(' a/b:c*? '));
  assert(regionFileName({ page: 2, q: '3', kind: 'stem', note: 'x y' }) === 'p02-q3-stem-x_y.png');
});

test('naming: 超出 A-K 抛错', () => {
  let threw = false;
  try {
    optName('Z');
  } catch (e) {
    threw = e && e.name === 'FigcutError';
  }
  assert(threw);
});

test('naming: ZIP 名与配置键', () => {
  assert(zipName('Math Test 2.pdf') === 'figures_Math Test 2.zip');
  assert(configKey('a.pdf', 123) === 'a.pdf|123');
});
