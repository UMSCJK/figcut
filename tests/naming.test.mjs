import { test, assert } from '../tools/testkit.mjs';
import { pad, stemName, optName, regionFileName, zipName, configKey } from '../src/core/naming.js';

test('naming: 序号补零到两位', () => {
  assert(pad(1) === '01');
  assert(pad(12) === '12');
  assert(pad(3.9) === '03');
});

test('naming: 命名形如 p01-02-optC.png', () => {
  assert(regionFileName({ page: 1, index: 2, kind: 'opt', opt: 'C' }) === 'p01-02-optC.png');
  assert(regionFileName({ page: 10, index: 3, kind: 'stem' }) === 'p10-03-stem.png');
  assert(optName(0) === 'optA');
  assert(optName('d') === 'optD');
  assert(stemName() === 'stem');
});

test('naming: 非法选项抛错', () => {
  let threw = false;
  try {
    optName('E');
  } catch (e) {
    threw = e && e.name === 'FigcutError';
  }
  assert(threw, 'E 应该抛错');
});

test('naming: ZIP 名与配置键', () => {
  assert(zipName('Math Test 2.pdf') === 'figures_Math Test 2.zip');
  assert(configKey('Math Test 2.pdf', 123456) === 'Math Test 2.pdf|123456');
});
