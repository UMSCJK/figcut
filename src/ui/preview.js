// 右栏常驻预览：显示导出结果（缩紧框 + margin 的裁切）
// 状态：已实现。按 devicePixelRatio 给足分辨率，别糊。

export function createPreview(host) {
  const doc = host.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'preview-canvas';
  host.textContent = '';
  host.appendChild(canvas);
  return { canvas, host };
}

function sizeCanvas(canvas, w, h) {
  const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { ctx, dpr };
}

export function renderPreview(preview, opts) {
  const canvas = preview.canvas;
  const { source, regions, selectedId, pageW, pageH, crop } = opts;

  if (crop) {
    const maxW = opts.maxW || 232;
    const w = Math.max(1, Math.round(Math.min(maxW, crop.w * (opts.zoom || 1.6))));
    const h = Math.max(1, Math.round((crop.h / crop.w) * w));
    const { ctx } = sizeCanvas(canvas, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (source) {
      ctx.drawImage(
        source,
        (crop.x / pageW) * source.width,
        (crop.y / pageH) * source.height,
        (crop.w / pageW) * source.width,
        (crop.h / pageH) * source.height,
        0,
        0,
        w,
        h
      );
    }
    return { mode: 'crop', w, h };
  }

  const w = Math.max(120, Math.round(pageW / 3));
  const h = Math.max(1, Math.round((pageH / pageW) * w));
  const { ctx } = sizeCanvas(canvas, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (source) ctx.drawImage(source, 0, 0, w, h);

  const sx = w / pageW;
  const sy = h / pageH;
  ctx.lineWidth = 1;
  for (const r of regions) {
    ctx.strokeStyle = r.id === selectedId ? '#ff8c00' : '#1c6ef2';
    if (r.shape === 'poly') {
      ctx.beginPath();
      r.points.forEach((p, i) => {
        const x = p.x * sx;
        const y = p.y * sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(r.rect.x * sx, r.rect.y * sy, r.rect.w * sx, r.rect.h * sy);
    }
  }
  return { mode: 'page', w, h };
}

export function drawCrop(preview, opts) {
  return renderPreview(preview, opts);
}
