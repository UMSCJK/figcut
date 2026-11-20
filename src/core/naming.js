// 导出文件名：p{页:02}-q{题号}-{角色}-{备注}.png
// 状态：已实现。暴力美学：文件名里带上页、题号、角色、备注，全部清洗成安全字符。

import { figcutError } from './errors.js';

const OPT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export function pad(n, width = 2) {
  return String(Math.trunc(n)).padStart(width, '0');
}

// 非法字符与空白统一压成下划线，长备注截断
export function sanitize(text, max = 24) {
  const s = String(text === undefined || text === null ? '' : text)
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s.slice(0, max);
}

export function stemName() {
  return 'stem';
}

export function optName(which) {
  const idx = typeof which === 'number' ? which : OPT_LETTERS.indexOf(String(which).toUpperCase());
  if (idx < 0 || idx >= OPT_LETTERS.length) {
    throw figcutError('bad-option', '选项只能是 A-K 或 0-10', { which });
  }
  return 'opt' + OPT_LETTERS[idx];
}

// 角色：stem / optA..optK / opt<自定义名>
export function roleOf(region) {
  if (region.kind !== 'opt') return 'stem';
  if (region.opt === 'custom') {
    const name = sanitize(region.optText, 12);
    return 'opt' + (name || 'X');
  }
  return optName(region.opt === undefined || region.opt === null ? 0 : region.opt);
}

// p09-q28-stem.png / p09-q29-optB-note.png
export function regionFileName(region) {
  const page = pad(region.page === undefined ? 1 : region.page);
  const q = sanitize(region.q, 8) || '00';
  const parts = ['p' + page, 'q' + q, roleOf(region)];
  const note = sanitize(region.note, 24);
  if (note) parts.push(note);
  return parts.join('-') + '.png';
}

export function zipName(pdfName) {
  const base = String(pdfName || 'figures').replace(/\.[Pp][Dd][Ff]$/, '');
  return 'figures_' + base + '.zip';
}

export function configKey(fileName, bytes) {
  return String(fileName) + '|' + Number(bytes);
}
