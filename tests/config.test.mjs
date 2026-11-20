import { test, assert } from '../tools/testkit.mjs';
import { keyForFile, loadConfig, saveConfig, migrate, STORAGE_KEY, SCHEMA } from '../src/io/config.js';

function memoryStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    dump: () => map,
  };
}

test('config: 空存储读不到东西', () => {
  const st = memoryStorage();
  assert(loadConfig(st, keyForFile('a.pdf', 1)) === null);
});

test('config: 存了能读回来', () => {
  const st = memoryStorage();
  const key = keyForFile('Math Test 2.pdf', 98765);
  saveConfig(st, key, { pages: { 9: [{ kind: 'stem', q: 12 }] }, updatedAt: 111 });
  const back = loadConfig(st, key);
  assert(back !== null);
  assert(back.pages[9][0].q === 12);
  assert(back.updatedAt === 111);

  const raw = JSON.parse(st.getItem(STORAGE_KEY));
  assert(raw.version === SCHEMA, '写进去的必须是 schema4');
});

test('config: 改名等于新文件，不串配置', () => {
  const st = memoryStorage();
  saveConfig(st, keyForFile('a.pdf', 100), { pages: { 1: [] } });
  assert(loadConfig(st, keyForFile('b.pdf', 100)) === null);
  assert(loadConfig(st, keyForFile('a.pdf', 101)) === null);
  assert(loadConfig(st, keyForFile('a.pdf', 100)) !== null);
});

test('config: schema3 的 regions 数组能迁到 4', () => {
  const cfg = migrate({ version: 3, regions: [{ page: 1, kind: 'stem' }, { page: 2, kind: 'opt' }] });
  assert(cfg.version === SCHEMA);
  const entry = Object.values(cfg.files)[0];
  assert(Object.keys(entry.pages).length === 2, '按页分组');
});

test('config: 裸数组也能迁', () => {
  const cfg = migrate([{ page: 3 }]);
  assert(cfg.version === SCHEMA);
  assert(Object.values(cfg.files)[0].pages[3].length === 1);
});

test('config: v4 原样通过', () => {
  const v4 = { version: 4, app: 'figcut', files: { k: { pages: {} } } };
  assert(migrate(v4) === v4);
});

test('config: 坏 JSON 抛 FigcutError', () => {
  const st = memoryStorage({ [STORAGE_KEY]: '{不是 json' });
  let threw = false;
  try {
    loadConfig(st, 'x');
  } catch (e) {
    threw = e && e.name === 'FigcutError';
  }
  assert(threw);
});
