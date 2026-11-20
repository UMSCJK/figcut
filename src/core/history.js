// 撤销重做栈与微移合并
// 状态：已实现。存的是"整份快照"，合并窗口内同 key 的动作只留一条。

export const COALESCE_MS = 600;

export function createHistory(initial, opts = {}) {
  return {
    present: initial === undefined ? null : initial,
    past: [],
    future: [],
    limit: opts.limit === undefined ? 200 : opts.limit,
    windowMs: opts.windowMs === undefined ? COALESCE_MS : opts.windowMs,
    now: opts.now || (() => Date.now()),
    lastKey: null,
    lastTime: 0,
  };
}

export function current(h) {
  return h.present;
}

// key 相同且落在合并窗口内 → 只更新 present，不再压一条历史。
export function commit(h, next, opts = {}) {
  const key = opts.key === undefined ? null : opts.key;
  const t = h.now();
  const merge = key !== null && key === h.lastKey && t - h.lastTime <= h.windowMs && h.past.length > 0;

  if (!merge) {
    h.past.push(h.present);
    if (h.past.length > h.limit) h.past.shift();
  }
  h.present = next;
  h.lastKey = key;
  h.lastTime = t;
  h.future.length = 0;
  return next;
}

export function undo(h) {
  if (h.past.length === 0) return null;
  h.future.push(h.present);
  h.present = h.past.pop();
  h.lastKey = null;
  return h.present;
}

export function redo(h) {
  if (h.future.length === 0) return null;
  h.past.push(h.present);
  h.present = h.future.pop();
  h.lastKey = null;
  return h.present;
}

export function canUndo(h) {
  return h.past.length > 0;
}

export function canRedo(h) {
  return h.future.length > 0;
}
