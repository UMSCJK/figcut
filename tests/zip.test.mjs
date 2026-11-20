import { test, assert } from '../tools/testkit.mjs';
import { createZip, addFile, toBytes } from '../src/io/zip.js';
import { crc32 } from '../src/core/checksum.js';

const idx = (bytes, ascii) => {
  const needle = new TextEncoder().encode(ascii);
  outer: for (let i = 0; i + needle.length <= bytes.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

test('zip: 空包也有中央目录与 EOCD', () => {
  const bytes = toBytes(createZip());
  assert(bytes.length === 22, '空 ZIP 就是 22 字节，实际 ' + bytes.length);
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'PK 签名');
});

test('zip: 两个文件的头与校验和', () => {
  const zip = createZip();
  addFile(zip, 'a.txt', new TextEncoder().encode('hello'));
  addFile(zip, 'b.txt', new TextEncoder().encode('world'));
  const bytes = toBytes(zip);

  assert(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04, 'local header');
  assert(idx(bytes, 'a.txt') > 0 && idx(bytes, 'b.txt') > 0, '文件名应出现在包里');
  assert(idx(bytes, 'PK') > 0, '缺 EOCD');
  assert(zip.entries[0].crc === crc32(new TextEncoder().encode('hello')));
});
