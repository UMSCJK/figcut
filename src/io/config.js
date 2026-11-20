// localStorage 配置 schema4 与迁移
// 状态：已实现。本模块不直接碰 localStorage，只吃一个 getItem/setItem 的容器，方便单测。

import { configKey } from '../core/naming.js';
import { figcutError } from '../core/errors.js';

export const STORAGE_KEY = 'figcut.regions';
export const SCHEMA = 4;

export function keyForFile(fileName, bytes) {
  return configKey(fileName, bytes);
}

function groupByPage(regions) {
  const pages = {};
  for (const r of regions) {
    const p = r.page || 1;
    if (!pages[p]) pages[p] = [];
    pages[p].push(r);
  }
  return pages;
}

// 把 1/2/3 版配置抬到 schema4：{version, app, files:{key:{pages}}}
export function migrate(raw) {
  if (raw && raw.version === SCHEMA && raw.files && typeof raw.files === 'object') {
    return raw; // 已经是 schema4：原样返回，迁移必须幂等
  }

  const cfg = { version: SCHEMA, app: 'figcut', files: {} };
  if (!raw) return cfg;

  if (Array.isArray(raw)) {
    cfg.files._migrated = { source: '', export: null, updatedAt: 0, pages: groupByPage(raw) };
    return cfg;
  }

  if (Array.isArray(raw.regions)) {
    const key = raw.key || '_migrated';
    cfg.files[key] = {
      source: raw.source || '',
      export: raw.export || null,
      updatedAt: raw.updatedAt || 0,
      pages: groupByPage(raw.regions),
    };
    return cfg;
  }

  if (raw.files && typeof raw.files === 'object') {
    for (const [key, entry] of Object.entries(raw.files)) {
      cfg.files[key] = {
        source: (entry && entry.source) || '',
        export: (entry && entry.export) || null,
        updatedAt: (entry && entry.updatedAt) || 0,
        pages: (entry && entry.pages) || {},
      };
    }
  }
  return cfg;
}

function readAll(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { version: SCHEMA, app: 'figcut', files: {} };
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    throw figcutError('bad-config', '配置不是合法 JSON，已放弃读取', { raw });
  }
}

export function loadConfig(storage, key) {
  const cfg = readAll(storage);
  return cfg.files[key] || null;
}

export function saveConfig(storage, key, entry) {
  const cfg = readAll(storage);
  cfg.files[key] = {
    source: entry.source || '',
    export: entry.export || null,
    updatedAt: entry.updatedAt || Date.now(),
    pages: entry.pages || {},
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  return cfg;
}
