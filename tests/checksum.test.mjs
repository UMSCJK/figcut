import { test, assert } from '../tools/testkit.mjs';
import { crc32, adler32 } from '../src/core/checksum.js';

const bytes = (s) => new TextEncoder().encode(s);

test('checksum: CRC32 标准向量', () => {
  assert(crc32(bytes('123456789')) === 0xcbf43926, '实际 ' + crc32(bytes('123456789')).toString(16));
});

test('checksum: Adler32 标准向量', () => {
  assert(adler32(bytes('Wikipedia')) === 0x11e60398, '实际 ' + adler32(bytes('Wikipedia')).toString(16));
});
