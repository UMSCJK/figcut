// 撤销重做栈与微移合并
// 状态：已实现。入参是"快照条目"，具体存什么由调用方决定；本模块只管顺序与合并。

export const COALESCE_MS = 600;

export function createHistory(opts = {}) {
  return {
    past: [],
    future: [],
    limit: opts.limit === undefined ? 200 : opts.limit,
    windowMs: opts.windowMs === undefined ? COALESCE_MS : opts.windowMs,
    now: opts.now || (() => Date.now()),
    lastKey: null,
    lastTime: 0,
  };
}

// key 相同且落在合并窗口内 → 覆盖上一条，而不是又压一条。
// 连续微移 / 一次拖动因此只留一条历史。
export function commit(h, entry, opts = {}) {
  const key = opts.key === undefined ? null : opts.key;
  const t = h.now();
  const merge = key !== null && key === h.lastKey && t - h.lastTime <= h.windowMs;

  if (merge && h.past.length > 0) {
    h.past[h.past.length - 1] = entry;
  } else {
    h.past.push(entry);
    if (h.past.length > h.limit) h.past.shift();
  }
  h.lastKey = key;
  h.lastTime = t;
  h.future.length = 0;
  return entry;
}

export function undo(h) {
  if (h.past.length === 0) return null;
  const entry = h.past.pop();
  h.future.push(entry);
  h.lastKey = null;
  return entry;
}

export function redo(h) {
  if (h.future.length === 0) return null;
  const entry = h.future.pop();
  h.past.push(entry);
  h.lastKey = null;
  return entry;
}

export function canUndo(h) {
  return h.past.length > 0;
}

export function canRedo(h) {
  return h.future.length > 0;
}
