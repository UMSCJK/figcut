import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/toast.js';

const API = ['toast', 'banner'];

test('toast: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'toast 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('toast: 未捕获异常进底部横幅，10 秒消失');
todo('toast: 横幅不覆盖空状态');
