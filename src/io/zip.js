// ZIP 打包与清单 JSON
// 状态：已实现。只用 store（不压缩），因此 node 里能跑、能真解开。

import { crc32 } from '../core/checksum.js';
import { concatBytes, le16, le32 } from '../core/bytes.js';

// 固定时间戳（1980-01-01 00:00），保证同样输入产出同样字节。
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

export function createZip() {
  return { entries: [] };
}

export function addFile(zip, name, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  zip.entries.push({ name: String(name), data, crc: crc32(data) });
  return zip;
}

export function toBytes(zip) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of zip.entries) {
    const name = new TextEncoder().encode(entry.name);
    const local = [
      ...le32(0x04034b50),
      ...le16(20),
      ...le16(0),
      ...le16(0),
      ...le16(DOS_TIME),
      ...le16(DOS_DATE),
      ...le32(entry.crc),
      ...le32(entry.data.length),
      ...le32(entry.data.length),
      ...le16(name.length),
      ...le16(0),
    ];
    locals.push(new Uint8Array(local), name, entry.data);

    const central = [
      ...le32(0x02014b50),
      ...le16(20),
      ...le16(20),
      ...le16(0),
      ...le16(0),
      ...le16(DOS_TIME),
      ...le16(DOS_DATE),
      ...le32(entry.crc),
      ...le32(entry.data.length),
      ...le32(entry.data.length),
      ...le16(name.length),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le32(0),
      ...le32(offset),
    ];
    centrals.push(new Uint8Array(central), name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralBytes = concatBytes(centrals);
  const end = new Uint8Array([
    ...le32(0x06054b50),
    ...le16(0),
    ...le16(0),
    ...le16(zip.entries.length),
    ...le16(zip.entries.length),
    ...le32(centralBytes.length),
    ...le32(offset),
    ...le16(0),
  ]);

  return concatBytes([...locals, centralBytes, end]);
}

export function toBlob(zip) {
  const bytes = toBytes(zip);
  if (typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: 'application/zip' });
  }
  return bytes;
}


