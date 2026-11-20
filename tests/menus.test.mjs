import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/menus.js';

const API = ['openMenu', 'closeMenu', 'menuItems'];

test('menus: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'menus 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('menus: Esc 关菜单');
todo('menus: 同一时刻只有一个菜单打开');
