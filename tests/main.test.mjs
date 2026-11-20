import { test, assert } from '../tools/testkit.mjs';
import { start } from '../src/main.js';

// 入口模块：只保证装配函数存在；真实启动在浏览器里跑。
test('main: 导出 start', () => {
  assert(typeof start === 'function', '缺少 start');
});
