// 错误类型与未实现占位
// 状态：骨架。接口已冻结，实现待补。

export function figcutError(code, message, context) {
  const err = new Error(message);
  err.name = 'FigcutError';
  err.code = code;
  err.context = context || {};
  return err;
}

export function notImplemented(name) {
  return figcutError('not-implemented', '未实现: ' + name, { name });
}

