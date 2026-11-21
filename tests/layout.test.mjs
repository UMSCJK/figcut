import { test, assert } from '../tools/testkit.mjs';
import {
  pageCombos,
  fitPageScale,
  fitWidthScale,
  zoomPresets,
  stepZoom,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/core/layout.js';

const str = (rows) => rows.map((r) => r.join(',')).join(' | ');

test('layout: 单页就是每页一行', () => {
  assert(str(pageCombos(3)) === '1 | 2 | 3');
});

test('layout: 双页永远两页一行，封面不单独占行', () => {
  assert(str(pageCombos(6, { dual: true })) === '1,2 | 3,4 | 5,6');
  assert(str(pageCombos(6, { dual: true, oddLeft: true })) === '1,2 | 3,4 | 5,6');
  assert(str(pageCombos(5, { dual: true })) === '1,2 | 3,4 | 5');
});

test('layout: 适应页面整页可见（取宽高比里小的那个）', () => {
  const s = fitPageScale({ viewportW: 1000, viewportH: 800, pageW: 600, pageH: 800, padX: 0, padY: 0 });
  assert(s === 1, '高度正好，实际 ' + s);
  const s2 = fitPageScale({ viewportW: 400, viewportH: 800, pageW: 800, pageH: 800, padX: 0, padY: 0 });
  assert(s2 === 0.5, '宽度受限，实际 ' + s2);
});

test('layout: 适应页面把上下留白算进去', () => {
  const noPad = fitPageScale({ viewportW: 600, viewportH: 842, pageW: 595, pageH: 842, padX: 0, padY: 0 });
  const withPad = fitPageScale({ viewportW: 600, viewportH: 842, pageW: 595, pageH: 842, padX: 0, padY: 20 });
  assert(withPad < noPad, '留白占了高度，倍率必须更小：' + withPad + ' vs ' + noPad);
});

test('layout: 适应宽度不出横向滚动条', () => {
  const s = fitWidthScale({ viewportW: 600, pageW: 595, padX: 0 });
  assert(595 * s <= 600 + 1e-9, '缩放后宽度不能超过视口');
});

test('layout: 缩放台阶与 ×1.2 步进', () => {
  const p = zoomPresets();
  assert(p[0] === 0.5 && p[p.length - 1] === 8);
  assert(stepZoom(1, 1) === 1.2);
  assert(stepZoom(1.2, -1) === 1);
  assert(stepZoom(MAX_SCALE, 1) === MAX_SCALE, '上限夹住');
  assert(stepZoom(MIN_SCALE, -1) === MIN_SCALE, '下限夹住');
});
