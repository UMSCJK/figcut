import { test, assert } from '../tools/testkit.mjs';
import { createNavigator, gotoPage, nextPage, prevPage, clampPage, pageAtScroll } from '../src/view/navigator.js';

function fakeStack(total) {
  return {
    pages: Array.from({ length: total }, (_, i) => ({ no: i + 1 })),
    setCurrent(no) { this.current = no; },
  };
}

test('navigator: 跳页夹在 1..总页数', () => {
  const nav = createNavigator(fakeStack(12), { total: 12 });
  assert(gotoPage(nav, 0) === 1);
  assert(gotoPage(nav, 99) === 12);
  assert(gotoPage(nav, 5) === 5);
});

test('navigator: 上一页下一页与 ±10', () => {
  const nav = createNavigator(fakeStack(12), { total: 12 });
  gotoPage(nav, 3);
  assert(nextPage(nav) === 4);
  assert(prevPage(nav) === 3);
  assert(prevPage(nav, 10) === 1, '别越界成负数');
});

test('navigator: 滚动取最近的页', () => {
  const rects = [{ no: 1, top: -400 }, { no: 2, top: 100 }, { no: 3, top: 600 }];
  assert(pageAtScroll(rects, 0) === 2);
  assert(pageAtScroll(rects, 700) === 3);
  assert(pageAtScroll([], 0) === 1);
});

test('navigator: clampPage 用 stack 页数兜底', () => {
  const nav = createNavigator(fakeStack(5));
  assert(clampPage(nav, 9) === 5);
});
