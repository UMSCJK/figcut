// ZIP 打包与清单 JSON
// 状态：已实现。只用 store（不压缩），因此 node 里能跑、能真解开。

import { crc32 } from '../core/checksum.js';

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

function u16(v) {
  return [v & 0xff, (v >>> 8) & 0xff];
}

function u32(v) {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

export function toBytes(zip) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of zip.entries) {
    const name = new TextEncoder().encode(entry.name);
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(DOS_TIME),
      ...u16(DOS_DATE),
      ...u32(entry.crc),
      ...u32(entry.data.length),
      ...u32(entry.data.length),
      ...u16(name.length),
      ...u16(0),
    ];
    locals.push(new Uint8Array(local), name, entry.data);

    const central = [
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(DOS_TIME),
      ...u16(DOS_DATE),
      ...u32(entry.crc),
      ...u32(entry.data.length),
      ...u32(entry.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ];
    centrals.push(new Uint8Array(central), name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralBytes = concat(centrals);
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(zip.entries.length),
    ...u16(zip.entries.length),
    ...u32(centralBytes.length),
    ...u32(offset),
    ...u16(0),
  ]);

  return concat([...locals, centralBytes, end]);
}

export function toBlob(zip) {
  const bytes = toBytes(zip);
  if (typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: 'application/zip' });
  }
  return bytes;
}

function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
