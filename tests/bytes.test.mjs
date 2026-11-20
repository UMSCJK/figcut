import { test, assert } from '../tools/testkit.mjs';
import { concatBytes, be32, le16, le32 } from '../src/core/bytes.js';

test('bytes: 拼接保序', () => {
  const out = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])]);
  assert(Array.from(out).join(',') === '1,2,3');
});

test('bytes: 大端 32 位', () => {
  assert(be32(0x01020304).join(',') === '1,2,3,4');
});

test('bytes: 小端 16/32 位', () => {
  assert(le16(0x0102).join(',') === '2,1');
  assert(le32(0x01020304).join(',') === '4,3,2,1');
});
