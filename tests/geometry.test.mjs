import { test, assert } from '../tools/testkit.mjs';
import {
  normRect,
  rectFromPoints,
  clampRect,
  expandRect,
  polyBounds,
  movePoly,
  hitTestRect,
  hitTestPoly,
  cornerAt,
} from '../src/core/geometry.js';

function nearR(actual, expected, msg) {
  const keys = ['x', 'y', 'w', 'h'];
  for (const k of keys) {
    assert(Math.abs(actual[k] - expected[k]) < 1e-9, (msg || '') + '.' + k + '：' + actual[k] + ' != ' + expected[k]);
  }
}

test('geometry: 反着拖出的矩形归一化成正的宽高', () => {
  nearR(normRect(50, 60, 10, 20), { x: 10, y: 20, w: 40, h: 40 }, '反向');
  nearR(normRect(10, 20, 50, 60), { x: 10, y: 20, w: 40, h: 40 }, '正向');
});

test('geometry: rectFromPoints 小于 2pt 视为误触返回 null', () => {
  assert(rectFromPoints(0, 0, 1, 40) === null, '宽 1pt 应为误触');
  assert(rectFromPoints(0, 0, 40, 1.9) === null, '高 1.9pt 应为误触');
  assert(rectFromPoints(0, 0, 2, 2) !== null, '2x2 应成立');
  assert(rectFromPoints(0, 0, NaN, 10) === null, 'NaN 不应成框');
});

test('geometry: clampRect 把越界框整块塞回页内且不变形', () => {
  nearR(clampRect({ x: -5, y: -5, w: 20, h: 30 }, 100, 100), { x: 0, y: 0, w: 20, h: 30 }, '左上越界');
  nearR(clampRect({ x: 95, y: 95, w: 20, h: 30 }, 100, 100), { x: 80, y: 70, w: 20, h: 30 }, '右下越界');
  nearR(clampRect({ x: 0, y: 0, w: 200, h: 200 }, 100, 100), { x: 0, y: 0, w: 100, h: 100 }, '比页还大');
});

test('geometry: expandRect 向两侧长', () => {
  nearR(expandRect({ x: 10, y: 10, w: 20, h: 20 }, 5, 3), { x: 5, y: 7, w: 30, h: 26 });
});

test('geometry: polyBounds 取外接框', () => {
  nearR(polyBounds([{ x: 10, y: 40 }, { x: 30, y: 10 }, { x: 20, y: 60 }]), { x: 10, y: 10, w: 20, h: 50 });
});

test('geometry: 平移多边形保持形状，越界时贴页边', () => {
  const tri = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 20, y: 40 }];
  const moved = movePoly(tri, 5, 5, 100, 100);
  nearR(polyBounds(moved), { x: 15, y: 15, w: 20, h: 30 }, '普通平移');

  const pinned = movePoly(tri, -50, -50, 100, 100);
  nearR(polyBounds(pinned), { x: 0, y: 0, w: 20, h: 30 }, '贴左上');
  const shapes = (pts) => pts.map((p, i) => ({ dx: +(p.x - pts[0].x).toFixed(9), dy: +(p.y - pts[0].y).toFixed(9) }));
  assert(JSON.stringify(shapes(pinned)) === JSON.stringify(shapes(tri)), '形状不能变');
});

test('geometry: hitTestRect 带容差', () => {
  const r = { x: 10, y: 10, w: 20, h: 20 };
  assert(hitTestRect(r, 20, 20) === true);
  assert(hitTestRect(r, 31, 20) === false);
  assert(hitTestRect(r, 31, 20, 2) === true);
});

test('geometry: hitTestPoly 点在三角形内外与边容差', () => {
  const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  assert(hitTestPoly(tri, 2, 2) === true, '内点');
  assert(hitTestPoly(tri, 8, 8) === false, '外点');
  assert(hitTestPoly(tri, 10.5, 0) === false, '无边容差时不命中');
  assert(hitTestPoly(tri, 10.5, 0, 1) === true, '边容差 1pt 命中');
});

test('geometry: cornerAt 认出四个角', () => {
  const r = { x: 10, y: 20, w: 100, h: 50 };
  assert(cornerAt(r, 10, 20) === 'nw');
  assert(cornerAt(r, 110, 20) === 'ne');
  assert(cornerAt(r, 10, 70) === 'sw');
  assert(cornerAt(r, 110, 70) === 'se');
  assert(cornerAt(r, 60, 45) === null, '中心不是角');
  assert(cornerAt(r, 14, 20, 8) === 'nw', '容差内算角');
});
