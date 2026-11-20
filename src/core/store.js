// 极简可订阅状态容器
// 状态：已实现。setState 传函数时按 (prev) => next 计算。

export function createStore(initial) {
  return {
    state: initial,
    subscribers: new Set(),
  };
}

export function getState(s) {
  return s.state;
}

export function setState(s, next) {
  const prev = s.state;
  const value = typeof next === 'function' ? next(prev) : next;
  if (Object.is(value, prev)) return prev;
  s.state = value;
  for (const fn of s.subscribers) fn(value, prev);
  return value;
}

export function subscribe(s, fn) {
  s.subscribers.add(fn);
  return () => {
    s.subscribers.delete(fn);
  };
}
