// 翻页与页码跳转
// 状态：已实现。真正的滚动由 page-stack 负责，这里只管"该去第几页"。

export function createNavigator(stack, opts = {}) {
  return {
    stack,
    total: opts.total || 0,
    current: 1,
  };
}

export function clampPage(nav, no) {
  const total = nav.total || (nav.stack && nav.stack.pages.length) || 1;
  return Math.min(Math.max(1, Math.round(no)), total);
}

export function gotoPage(nav, no) {
  const next = clampPage(nav, no);
  nav.current = next;
  if (nav.stack) nav.stack.setCurrent(next);
  return next;
}

export function nextPage(nav, delta = 1) {
  return gotoPage(nav, nav.current + delta);
}

export function prevPage(nav, delta = 1) {
  return gotoPage(nav, nav.current - delta);
}

// 滚动时按"离视口顶部最近的页"更新当前页
export function pageAtScroll(rects, viewportTop) {
  if (!rects || rects.length === 0) return 1;
  let best = rects[0];
  let bestD = Infinity;
  for (const r of rects) {
    const d = Math.abs(r.top - viewportTop);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best.no;
}
