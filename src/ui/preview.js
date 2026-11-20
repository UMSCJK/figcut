// 右栏常驻预览：整页 + 所有框；选中时画导出裁切
// 状态：已实现（canvas 2D）。

export function createPreview(host) {
  const doc = host.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'preview-canvas';
  host.textContent = '';
  host.appendChild(canvas);
  return { canvas, host };
}

export function renderPreview(preview, opts) {
  const canvas = preview.canvas;
  const ctx = canvas.getContext('2d');
  const { source, regions, selectedId, pageW, pageH, crop } = opts;

  if (crop) {
    const w = Math.min(240, Math.max(80, Math.round(crop.w * 2)));
    const h = Math.max(1, Math.round((crop.h / crop.w) * w));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (source) {
      const sx = (crop.x / pageW) * source.width;
      const sy = (crop.y / pageH) * source.height;
      const sw = (crop.w / pageW) * source.width;
      const sh = (crop.h / pageH) * source.height;
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    }
    return { mode: 'crop', w, h };
  }

  const w = Math.min(240, Math.max(120, Math.round(pageW / 3)));
  const h = Math.max(1, Math.round((pageH / pageW) * w));
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

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
