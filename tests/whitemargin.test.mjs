import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/core/whitemargin.js';

const API = ['isWhiteRow', 'isWhiteCol', 'snapToWhite', 'growToStroke', 'pushTextOut', 'findLabelSpot', 'computeExportBox'];

test('whitemargin: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'whitemargin 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('whitemargin: 框底擦到下方图案 1pt 不得把整块吞进来');
todo('whitemargin: 跨在框外的笔画整根收进导出框');
todo('whitemargin: 文字不算笔画，压到文字时把文字让到框外');
todo('whitemargin: 标签只落在纯白处，无白点就不画');
