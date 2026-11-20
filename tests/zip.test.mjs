import { test, todo, assert } from '../tools/testkit.mjs';
import * as m from '../src/io/zip.js';

const API = ['createZip', 'addFile', 'toBlob'];

test('zip: 导出签名齐备', () => {
  for (const n of API) assert(typeof m[n] === 'function', 'zip 缺少导出 ' + n);
});

// 以下是实现前必须覆盖的行为，写成 todo 而不是假绿
todo('zip: ZIP 平铺不建子目录');
todo('zip: 文件名是 figures_<PDF名>.zip，内含 figure-regions.json');
