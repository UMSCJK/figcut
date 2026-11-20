import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/ui/thumbnails.js';

const API = ['renderThumbnail', 'invalidate'];

test('thumbnails: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'thumbnails 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('thumbnails: 缩略图按文档身份缓存，换文件不串');
