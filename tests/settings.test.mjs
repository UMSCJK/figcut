import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/app/settings.js';

const API = ['loadSettings', 'saveSettings', 'setMargin', 'setDpi'];

test('settings: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'settings 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('settings: 边距范围 0-80，DPI 范围 72-1200');
todo('settings: 设置全局记住，与单文件配置分开');
