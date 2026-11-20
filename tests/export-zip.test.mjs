import { test, assert } from '../tools/testkit.mjs';
import { planExports, MASK_PPP } from '../src/app/export-zip.js';

const rect = (page, y, kind, opt) => ({ page, kind, opt, q: '', shape: 'rect', rect: { x: 10, y, w: 50, h: 40 } });

test('export-zip: 掩膜栅格是 2px/pt', () => {
  assert(MASK_PPP === 2);
});

test('export-zip: 页内按竖直位置编号，命名带页与序号', () => {
  const plan = planExports([
    rect(2, 300, 'stem'),
    rect(1, 500, 'opt', 'B'),
    rect(1, 100, 'stem'),
  ]);
  assert(plan.length === 3);
  assert(plan[0].name === 'p01-01-stem.png', plan[0].name);
  assert(plan[1].name === 'p01-02-optB.png', plan[1].name);
  assert(plan[2].name === 'p02-01-stem.png', plan[2].name);
});

test('export-zip: 多边形框也能规划', () => {
  const plan = planExports([
    { page: 1, kind: 'opt', opt: 'A', shape: 'poly', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] },
  ]);
  assert(plan[0].name === 'p01-01-optA.png');
  assert(plan[0].box.w === 10);
});
