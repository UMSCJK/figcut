// 单测入口：发现 tests/*.test.mjs 全部导入后统一跑。
// 另一个职责：src 下每个模块都必须有同名测试文件，否则直接失败（不许有裸模块）。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runAll } from './testkit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(SRC).filter((p) => p.endsWith('.js'));
const testFiles = fs.readdirSync(TESTS).filter((f) => f.endsWith('.test.mjs')).sort();
const covered = new Set(testFiles.map((f) => f.replace(/\.test\.mjs$/, '')));
const missing = srcFiles.filter((p) => !covered.has(path.basename(p, '.js')));

if (missing.length > 0) {
  console.error('FAIL  以下模块没有测试文件：');
  for (const p of missing) console.error('  - ' + path.relative(ROOT, p));
  process.exit(1);
}

const orphans = testFiles.filter((f) => {
  const base = f.replace(/\.test\.mjs$/, '');
  return !srcFiles.some((p) => path.basename(p, '.js') === base);
});
if (orphans.length > 0) {
  console.error('FAIL  以下测试找不到对应模块：');
  for (const f of orphans) console.error('  - tests/' + f);
  process.exit(1);
}

for (const f of testFiles) {
  await import(pathToFileURL(path.join(TESTS, f)).href);
}

console.log('模块 ' + srcFiles.length + ' 个，测试文件 ' + testFiles.length + ' 个');
const r = runAll();
process.exit(r.failed === 0 ? 0 : 1);
