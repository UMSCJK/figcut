import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/theme.js';

const API = ['createTheme', 'cycleUi', 'cyclePdfPreview', 'isInverted'];

test('theme: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'theme 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('theme: 界面与 PDF 两个三态互不影响');
todo('theme: 反相必须真的反相，纸面不是白的就说明没做');
