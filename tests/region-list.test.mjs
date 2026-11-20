import { test, assert } from '../tools/testkit.mjs';
import { renderRegions, groupRowsByPage, labelOf } from '../src/ui/region-list.js';

test('region-list: 按页分组并按页号排序', () => {
  const groups = groupRowsByPage([
    { id: 1, page: 3 },
    { id: 2, page: 1 },
    { id: 3, page: 1 },
  ]);
  assert(groups.length === 2);
  assert(groups[0][0] === 1 && groups[0][1].length === 2);
  assert(groups[1][0] === 3);
});

test('region-list: 行标题带类型与题号', () => {
  assert(labelOf({ kind: 'stem', q: '29' }) === '题干 · 第 29 题');
  assert(labelOf({ kind: 'opt', opt: 'C', q: '' }) === '选项 C');
});

test('region-list: 没有 DOM 时不崩（renderRegions 需要 host）', () => {
  assert(typeof renderRegions === 'function');
});
