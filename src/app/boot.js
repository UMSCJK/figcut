// 启动装配与状态机
// 状态：已实现（最小可用：打开 PDF、连续滚动、缩放）。

import { createShell, setTitle, setEmpty, addButton } from '../ui/shell.js';
import { createZoom, subscribe } from '../view/zoom.js';
import { renderZoomControl } from '../ui/zoom-control.js';
import { createPageStack } from '../view/page-stack.js';
import { openFile, acceptDrop, pickFile } from '../app/open.js';
import { toast } from '../ui/toast.js';

export function boot(opts = {}) {
  const shell = createShell();
  const zoom = createZoom({ scale: 1 });
  const stack = createPageStack({ container: shell.canvas, zoom });
  renderZoomControl({ container: shell.canvas, zoom });

  let state = 'idle';

  const load = async (file) => {
    state = 'loading';
    setEmpty(shell, false);
    setTitle(shell, file.name);
    try {
      const doc = await openFile(file, opts);
      const n = await stack.mount(doc);
      setTitle(shell, file.name + ' · ' + n + ' 页');
      state = 'ready';
    } catch (e) {
      state = 'error';
      toast('打开失败：' + (e && e.message ? e.message : e));
      setEmpty(shell, true);
    }
  };

  addButton(shell, 'left', '打开', async () => {
    const file = await pickFile();
    if (file) load(file);
  }, { title: '打开 PDF（Ctrl+O）' });

  acceptDrop(shell.canvas, (file) => load(file));
  subscribe(zoom, () => stack.applyZoom());

  // 验收用：index.html?pdf=<本地 URL> 直接打开，省一次点击（不影响正常使用）。
  if (opts.url) {
    const name = String(opts.url).split('/').pop() || 'document.pdf';
    fetch(opts.url)
      .then((res) => res.blob())
      .then((blob) => load(new File([blob], name, { type: 'application/pdf' })))
      .catch((e) => toast('打不开 ' + opts.url + '：' + e.message));
  }

  return {
    shell,
    zoom,
    stack,
    load,
    status: () => state,
  };
}

// 骨架里声明的名字：读装配后的状态
export function status(booted) {
  return booted.status();
}
