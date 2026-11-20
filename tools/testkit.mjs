// 最小测试框架：注册 → 统一跑 → 汇总。未实现的行为用 todo() 占位，不计入通过。
const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

export function todo(name) {
  registry.push({ name, todo: true });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

export function eq(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    throw new Error((msg || '不相等') + '：实际 ' + actual + '，期望 ' + expected);
  }
}

export function thrown(fn, msg) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error(msg || '期望抛错但没抛');
}

export function runAll() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  for (const item of registry) {
    if (item.todo) {
      skipped += 1;
      continue;
    }
    try {
      item.fn();
      passed += 1;
    } catch (e) {
      failed += 1;
      failures.push('  ✗ ' + item.name + '\n    ' + (e && e.message ? e.message : e));
    }
  }

  for (const line of failures) console.error(line);
  const total = passed + failed + skipped;
  const head = failed === 0 ? 'PASS' : 'FAIL';
  console.log(
    head + '  ' + passed + ' passed, ' + skipped + ' todo, ' + failed + ' failed, 共 ' + total + ' 条'
  );
  return { passed, failed, skipped, total };
}
