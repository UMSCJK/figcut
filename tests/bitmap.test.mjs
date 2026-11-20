import { test, assert } from '../tools/testkit.mjs';
import { cacheKey, renderPage, clearCache } from '../src/pdf/bitmap.js';

test('bitmap: 缓存键带文档身份，换文件不复用', () => {
  const a = cacheKey('doc-a', 9, 2, 1);
  const b = cacheKey('doc-b', 9, 2, 1);
  assert(a !== b, '不同文档必须不同键');
  assert(a === cacheKey('doc-a', 9, 2, 1), '同参必须同键');
  assert(a !== cacheKey('doc-a', 9, 2.5, 1), '缩放不同不同键');
  assert(a !== cacheKey('doc-a', 9, 2, 2), 'dpr 不同不同键');
});

test('bitmap: 不在浏览器里渲染要明确报错', async () => {
  let threw = false;
  try {
    await renderPage({ getViewport: () => ({ width: 10, height: 10 }) }, { scale: 1 });
  } catch (e) {
    threw = e && e.code === 'no-dom';
  }
  assert(threw, 'node 里应抛 no-dom');
});

test('bitmap: clearCache 会清空缓存', () => {
  const cache = new Map([['a', 1]]);
  clearCache(cache);
  assert(cache.size === 0);
});
