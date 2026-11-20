import { test, assert } from '../tools/testkit.mjs';
import { countByPage, renderPageList, markCurrent } from '../src/ui/page-list.js';

test('page-list: 按页统计标注数', () => {
  const counts = countByPage([
    { page: 1 }, { page: 1 }, { page: 3 },
  ]);
  assert(counts[1] === 2 && counts[3] === 1);
  assert(counts[2] === undefined, '没标的页不出现');
});

test('page-list: 没有 DOM 时导出仍是函数', () => {
  assert(typeof renderPageList === 'function');
  assert(typeof markCurrent === 'function');
});
