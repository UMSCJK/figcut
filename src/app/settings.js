// 全局设置：导出边距、DPI（与单文件标注配置分开存）
// 状态：已实现。

import { clamp } from '../core/units.js';

export const DEFAULTS = { dpi: 300, margin: 8 };
export const RANGES = { dpi: [72, 1200], margin: [0, 80] };
export const SETTINGS_KEY = 'figcut.settings';

export function clampDpi(v) {
  return Math.round(clamp(Number(v), RANGES.dpi[0], RANGES.dpi[1]));
}

export function clampMargin(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(clamp(n, RANGES.margin[0], RANGES.margin[1]) * 10) / 10 : DEFAULTS.margin;
}

export function createSettings(opts = {}) {
  return { dpi: clampDpi(opts.dpi === undefined ? DEFAULTS.dpi : opts.dpi), margin: clampMargin(opts.margin === undefined ? DEFAULTS.margin : opts.margin) };
}

export function setDpi(settings, v) {
  settings.dpi = clampDpi(v);
  return settings.dpi;
}

export function setMargin(settings, v) {
  settings.margin = clampMargin(v);
  return settings.margin;
}

export function loadSettings(storage) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    if (!raw) return createSettings();
    return createSettings(JSON.parse(raw));
  } catch (e) {
    return createSettings();
  }
}

export function saveSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ dpi: settings.dpi, margin: settings.margin }));
    return true;
  } catch (e) {
    return false;
  }
}
