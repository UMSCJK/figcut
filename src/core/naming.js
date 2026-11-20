// 导出文件名与配置键
// 状态：已实现。规则见 SPEC 第 6/7 节：p{页:02}-{序号:02}-{stem|optA..optD}.png

import { figcutError } from './errors.js';

const OPT_LETTERS = ['A', 'B', 'C', 'D'];

export function pad(n, width = 2) {
  return String(Math.trunc(n)).padStart(width, '0');
}

export function stemName() {
  return 'stem';
}

export function optName(which) {
  const idx = typeof which === 'number' ? which : OPT_LETTERS.indexOf(String(which).toUpperCase());
  if (idx < 0 || idx >= OPT_LETTERS.length) {
    throw figcutError('bad-option', '选项只能是 A-D 或 0-3', { which });
  }
  return 'opt' + OPT_LETTERS[idx];
}

export function regionFileName(region) {
  const page = region.page === undefined ? 1 : region.page;
  const index = region.index === undefined ? 1 : region.index;
  const kind = region.kind === undefined ? 'stem' : region.kind;
  const tail = kind === 'stem' ? stemName() : optName(region.opt);
  return 'p' + pad(page) + '-' + pad(index) + '-' + tail + '.png';
}

export function zipName(pdfName) {
  const base = String(pdfName || 'figures').replace(/\.[Pp][Dd][Ff]$/, '');
  return 'figures_' + base + '.zip';
}

// 改名等于新文件：配置键含字节数。
export function configKey(fileName, bytes) {
  return String(fileName) + '|' + Number(bytes);
}
