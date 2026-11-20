import { test, assert } from '../tools/testkit.mjs';
import { encodePng } from '../src/io/png.js';

function solid(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

test('png: 签名与 IHDR 尺寸正确', () => {
  const out = encodePng(solid(3, 2, 255, 0, 0));
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i += 1) assert(out[i] === sig[i], '签名第 ' + i + ' 字节');
  assert(String.fromCharCode(out[12], out[13], out[14], out[15]) === 'IHDR');
  const u32 = (at) => (out[at] << 24) | (out[at + 1] << 16) | (out[at + 2] << 8) | out[at + 3];
  assert(u32(16) === 3, '宽');
  assert(u32(20) === 2, '高');
  assert(out[24] === 8 && out[25] === 2, '8bit RGB');
});

const idx = (bytes, ascii) => {
  const needle = new TextEncoder().encode(ascii);
  outer: for (let i = 0; i + needle.length <= bytes.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

test('png: 有 IDAT 和 IEND', () => {
  const out = encodePng(solid(1, 1, 0, 0, 0));
  assert(idx(out, 'IDAT') > 0, '缺 IDAT');
  assert(idx(out, 'IEND') > 0, '缺 IEND');
  assert(idx(out, 'IHDR') === 12, 'IHDR 位置不对');
});
