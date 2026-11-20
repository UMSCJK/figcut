import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/preview.js';

const API = ['renderPreview', 'drawCrop'];

test('preview: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'preview 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('preview: 未选中显示整页与所有框');
todo('preview: 选中显示导出裁切的白界框与像素尺寸');
