// 打开文件与拖放
// 状态：已实现。

import { figcutError } from '../core/errors.js';
import { openDocument } from '../pdf/document.js';

// pdf.js 走 CDN，worker 跟同一个版本
const PDFJS_VERSION = '3.11.174';
const WORKER_SRC = 'https://unpkg.com/pdfjs-dist@' + PDFJS_VERSION + '/build/pdf.worker.min.js';

export async function openFile(file, opts = {}) {
  if (!file) throw figcutError('no-file', '没有文件');
  const buffer = await file.arrayBuffer();
  return openDocument(
    { data: new Uint8Array(buffer) },
    { workerSrc: opts.workerSrc || WORKER_SRC, id: file.name + '|' + file.size }
  );
}

// 拖放：只认第一个 PDF，一次只处理一个文件。
export function acceptDrop(element, onFile) {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const over = (e) => {
    stop(e);
    element.classList.add('is-dragover');
  };
  const leave = (e) => {
    stop(e);
    element.classList.remove('is-dragover');
  };
  const drop = (e) => {
    stop(e);
    element.classList.remove('is-dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  element.addEventListener('dragenter', over);
  element.addEventListener('dragover', over);
  element.addEventListener('dragleave', leave);
  element.addEventListener('drop', drop);
  return () => {
    element.removeEventListener('dragenter', over);
    element.removeEventListener('dragover', over);
    element.removeEventListener('dragleave', leave);
    element.removeEventListener('drop', drop);
  };
}

// 系统文件选择框
export function pickFile() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file || null);
    });
    input.click();
  });
}
