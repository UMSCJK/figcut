import { test, assert } from '../tools/testkit.mjs';
import { createZoom, setScale, setFit, anchorAt, subscribe } from '../src/view/zoom.js';

test('zoom: 缩放夹在 25%-800%', () => {
  const z = createZoom();
  setScale(z, 100);
  assert(z.scale === 8, '上限 ' + z.scale);
  setScale(z, 0.001);
  assert(z.scale === 0.25, '下限 ' + z.scale);
});

test('zoom: 缩放会通知订阅者，同值不重复通知', () => {
  const z = createZoom({ scale: 1 });
  let calls = 0;
  subscribe(z, () => { calls += 1; });
  setScale(z, 2);
  assert(calls === 1);
  setScale(z, 2);
  assert(calls === 1, '同值不该再通知');
});

test('zoom: 适应宽度按视口算', () => {
  const z = createZoom();
  setFit(z, 'width', { viewportW: 600, pageW: 595, padX: 0 });
  assert(Math.abs(z.scale - 1.008) < 0.002, '实际 ' + z.scale);
  assert(z.mode === 'width');
});

test('zoom: 指针锚点缩放后内容不漂', () => {
  const next = anchorAt({ x: 0, y: 0 }, 100, 100, 1, 2);
  assert(next.x === 100 && next.y === 100, JSON.stringify(next));

  const back = anchorAt({ x: 100, y: 100 }, 100, 100, 2, 1);
  assert(back.x === 0 && back.y === 0, JSON.stringify(back));
});
