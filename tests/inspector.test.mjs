import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/inspector.js';

const API = ['renderInspector', 'setKind', 'setQuestion', 'setNote'];

test('inspector: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'inspector 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('inspector: 点工具栏或侧栏不丢选中');
todo('inspector: 只有点画布空白才取消选中');
