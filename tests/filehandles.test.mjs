import { test, assert } from '../tools/testkit.mjs';
import { handleKey, loadHandle, reopenRecent, hasPickHandle } from '../src/io/filehandles.js';

test('filehandles: 键包含文件名与字节数', () => {
  assert(handleKey('a.pdf', 123) === 'a.pdf|123');
  assert(handleKey('a.pdf', 123) === handleKey('a.pdf', 123));
  assert(handleKey('a.pdf', 123) !== handleKey('b.pdf', 123));
});

test('filehandles: 没有 IndexedDB 时安全降级', async () => {
  const handle = await loadHandle('a.pdf', 1);
  assert(handle === null);
});

test('filehandles: 没有句柄时 reopenRecent 返回 null', async () => {
  const file = await reopenRecent({ name: 'a.pdf', size: 1 });
  assert(file === null);
});

test('filehandles: hasPickHandle 在无 window 环境为 false', () => {
  assert(hasPickHandle() === false);
});
