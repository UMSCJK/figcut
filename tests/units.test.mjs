import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/units.js';

const API = ['PT_PER_INCH', 'pxForDpi', 'ptToPx', 'pxToPt', 'clamp'];

test('units: 导出签名齐备', () => {
  assert(typeof m.PT_PER_INCH === 'number', 'PT_PER_INCH 应是数字常量');
  for (const n of API.filter((x) => x !== 'PT_PER_INCH')) {
    assert(typeof m[n] === 'function', 'units 缺少导出 ' + n);
  }
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('units: 300dpi 下 1pt = 4.1667px');
todo('units: clamp 对 NaN 返回下界');
