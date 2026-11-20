// 墨迹掩膜与笔画连通域
// 状态：已实现。掩膜吃的是 RGBA 像素数组，因此不依赖 canvas，node 里能测。

export const INK_THRESHOLD = 250;

// 任一通道低于阈值就算墨迹；半透明像素按 alpha 折算。
function pixelInk(r, g, b, a, threshold) {
  if (a < 8) return 0;
  return r < threshold || g < threshold || b < threshold ? 1 : 0;
}

export function buildInkMask(image, opts = {}) {
  const data = image.data;
  const width = image.width;
  const height = image.height;
  const threshold = opts.threshold === undefined ? INK_THRESHOLD : opts.threshold;
  const pxPerPt = opts.pxPerPt === undefined ? 1 : opts.pxPerPt;

  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] = pixelInk(data[p], data[p + 1], data[p + 2], data[p + 3], threshold);
  }
  return { w: width, h: height, pxPerPt, data: out };
}

// 4 连通分量，返回整根笔画的包围盒与像素数。
export function components(mask) {
  const seen = new Uint8Array(mask.w * mask.h);
  const out = [];

  for (let start = 0; start < mask.data.length; start += 1) {
    if (seen[start] || mask.data[start] === 0) continue;
    const stack = [start];
    seen[start] = 1;
    let minX = mask.w;
    let minY = mask.h;
    let maxX = -1;
    let maxY = -1;
    let total = 0;

    while (stack.length > 0) {
      const i = stack.pop();
      const y = Math.floor(i / mask.w);
      const x = i - y * mask.w;
      total += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const n = i - 1;
        if (!seen[n] && mask.data[n] !== 0) { seen[n] = 1; stack.push(n); }
      }
      if (x + 1 < mask.w) {
        const n = i + 1;
        if (!seen[n] && mask.data[n] !== 0) { seen[n] = 1; stack.push(n); }
      }
      if (y > 0) {
        const n = i - mask.w;
        if (!seen[n] && mask.data[n] !== 0) { seen[n] = 1; stack.push(n); }
      }
      if (y + 1 < mask.h) {
        const n = i + mask.w;
        if (!seen[n] && mask.data[n] !== 0) { seen[n] = 1; stack.push(n); }
      }
    }

    out.push({ minX, minY, maxX, maxY, total });
  }
  return out;
}

// 命中某个像素时返回它所在的那根笔画，否则 null。
export function strokeAt(mask, x, y) {
  if (x < 0 || y < 0 || x >= mask.w || y >= mask.h) return null;
  if (mask.data[y * mask.w + x] === 0) return null;

  const seen = new Uint8Array(mask.w * mask.h);
  const stack = [y * mask.w + x];
  seen[stack[0]] = 1;
  let minX = x;
  let minY = y;
  let maxX = x;
  let maxY = y;
  let total = 0;

  while (stack.length > 0) {
    const i = stack.pop();
    const py = Math.floor(i / mask.w);
    const px = i - py * mask.w;
    total += 1;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    const nbrs = [px > 0 ? i - 1 : -1, px + 1 < mask.w ? i + 1 : -1, py > 0 ? i - mask.w : -1, py + 1 < mask.h ? i + mask.w : -1];
    for (const n of nbrs) {
      if (n >= 0 && !seen[n] && mask.data[n] !== 0) { seen[n] = 1; stack.push(n); }
    }
  }

  return { minX, minY, maxX, maxY, total };
}
