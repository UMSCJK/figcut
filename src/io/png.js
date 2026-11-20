// 最小 PNG 编码器：RGBA 像素 → RGB PNG（zlib 用 stored 块，不依赖 canvas / zlib）
// 状态：已实现。导出永远是白底，所以丢掉 alpha 通道。

import { crc32, adler32 } from '../core/checksum.js';

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u32(v) {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

function chunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  return [new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))];
}

// zlib 容器 + 不压缩的 deflate 块
function zlibStored(raw) {
  const out = [new Uint8Array([0x78, 0x01])];
  let at = 0;
  while (at < raw.length) {
    const n = Math.min(65535, raw.length - at);
    const final = at + n >= raw.length ? 1 : 0;
    out.push(new Uint8Array([final, n & 0xff, (n >>> 8) & 0xff, ~n & 0xff, (~n >>> 8) & 0xff]));
    out.push(raw.subarray(at, at + n));
    at += n;
  }
  out.push(new Uint8Array(u32(adler32(raw))));
  return concat(out);
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

// image: { width, height, data: RGBA }
export function encodePng(image) {
  const { width, height, data } = image;
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowAt = y * (stride + 1);
    raw[rowAt] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dst = rowAt + 1 + x * 3;
      raw[dst] = data[src];
      raw[dst + 1] = data[src + 1];
      raw[dst + 2] = data[src + 2];
    }
  }

  const ihdr = new Uint8Array([...u32(width), ...u32(height), 8, 2, 0, 0, 0]);
  return concat([
    new Uint8Array(SIG),
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}
