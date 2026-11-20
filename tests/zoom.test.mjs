import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/view/zoom.js';

const API = ['createZoom', 'setScale', 'setFit', 'anchorAt'];

test('zoom: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'zoom 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('zoom: Ctrl+滚轮以指针为锚，缩放后漂移不超过 3px');
todo('zoom: fit 模式窗口变化重算，free 模式保持倍率');
