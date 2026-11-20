import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/region-list.js';

const API = ['renderRegions', 'groupByPage'];

test('region-list: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'region-list 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('region-list: 本页两行布局，行高约 60px');
todo('region-list: 其他页只读分组，点一下跳页');
