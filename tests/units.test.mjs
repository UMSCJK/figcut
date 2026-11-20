import { test, assert } from '../tools/testkit.mjs';
import { PT_PER_INCH, pxForDpi, ptToPx, pxToPt, clamp } from '../src/core/units.js';

function near(actual, expected, eps, msg) {
  assert(Math.abs(actual - expected) <= eps, (msg || '') + '：实际 ' + actual + '，期望 ' + expected);
}

test('units: 1 英寸永远是 72pt', () => {
  assert(PT_PER_INCH === 72);
});

test('units: 300dpi 下 1pt = 4.1667px', () => {
  near(pxForDpi(1, 300), 4.16667, 1e-4);
});

test('units: A4 宽 595.276pt 在 300dpi 下是 2480px', () => {
  near(pxForDpi(595.276, 300), 2480.3, 0.5);
  near(pxForDpi(841.89, 300), 3508.0, 1.0);
});

test('units: ptToPx 与 pxToPt 互逆', () => {
  near(pxToPt(ptToPx(123.4, 1.75), 1.75), 123.4, 1e-9);
});

test('units: 缩放倍率为 0 或非法时抛错', () => {
  for (const bad of [0, -1, NaN, undefined]) {
    let threw = false;
    try {
      pxToPt(10, bad);
    } catch (e) {
      threw = e && e.name === 'FigcutError';
    }
    assert(threw, 'scale=' + bad + ' 应抛 FigcutError');
  }
});

test('units: clamp 夹边界', () => {
  assert(clamp(5, 0, 10) === 5);
  assert(clamp(-1, 0, 10) === 0);
  assert(clamp(11, 0, 10) === 10);
});

test('units: clamp 对 NaN 返回下界', () => {
  assert(clamp(NaN, 3, 9) === 3);
  assert(clamp(Infinity, 3, 9) === 9);
  assert(clamp(-Infinity, 3, 9) === 3);
});
