// 提示条与异常横幅
// 状态：已实现。

export function toast(message, opts = {}) {
  if (typeof document === 'undefined') return null;
  const host = document.getElementById('banner');
  if (!host) return null;
  host.hidden = false;
  host.textContent = String(message);
  host.dataset.kind = opts.kind || 'error';
  clearTimeout(host._timer);
  host._timer = setTimeout(() => {
    host.hidden = true;
  }, opts.ms === undefined ? 10000 : opts.ms);
  return host;
}

export function banner(message, opts = {}) {
  return toast(message, opts);
}
