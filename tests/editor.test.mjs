import { test, assert } from '../tools/testkit.mjs';
import {
  createEditor,
  setTool,
  setPage,
  pointerDown,
  pointerMove,
  pointerUp,
  deleteSelection,
  nudge,
  regionAt,
  addRegion,
  boundsOf,
} from '../src/view/editor.js';

function drag(ed, a, b) {
  pointerDown(ed, a);
  pointerMove(ed, b);
  return pointerUp(ed, b);
}

test('editor: 矩形拖出来就成框并选中', () => {
  const ed = createEditor();
  const r = drag(ed, { x: 10, y: 20 }, { x: 60, y: 80 });
  assert(r !== null, '应建出一个框');
  assert(r.rect.x === 10 && r.rect.y === 20 && r.rect.w === 50 && r.rect.h === 60);
  assert(ed.selectedId === r.id);
  assert(ed.draft === null, '松开后草稿必须清掉');
});

test('editor: 小于 2pt 视为误触不建框', () => {
  const ed = createEditor();
  const r = drag(ed, { x: 10, y: 10 }, { x: 11, y: 10.5 });
  assert(r === null);
  assert(ed.regions.length === 0);
});

test('editor: 选择模式点中与点空', () => {
  const ed = createEditor();
  const r = drag(ed, { x: 10, y: 10 }, { x: 40, y: 40 });
  setTool(ed, 'select');
  pointerDown(ed, { x: 20, y: 20 });
  assert(ed.selectedId === r.id, '点框里应选中');
  pointerDown(ed, { x: 300, y: 300 });
  assert(ed.selectedId === null, '点空白应取消选中');
});

test('editor: 拖动整体平移并夹在页内', () => {
  const ed = createEditor({ pageW: 100, pageH: 100 });
  const r = addRegion(ed, { shape: 'rect', rect: { x: 10, y: 10, w: 20, h: 20 } });
  setTool(ed, 'select');
  pointerDown(ed, { x: 20, y: 20 });
  pointerMove(ed, { x: -100, y: -100 });
  pointerUp(ed, { x: -100, y: -100 });
  assert(r.rect.x === 0 && r.rect.y === 0, JSON.stringify(r.rect));
  assert(r.rect.w === 20 && r.rect.h === 20, '形状不许变');
});

test('editor: 拖角点改大小，最小 2pt', () => {
  const ed = createEditor();
  const r = addRegion(ed, { shape: 'rect', rect: { x: 10, y: 10, w: 40, h: 40 } });
  setTool(ed, 'select');
  const res = pointerDown(ed, { x: 50, y: 50 });
  assert(res.mode === 'resize', '右下角应进入 resize');
  pointerMove(ed, { x: 80, y: 90 });
  pointerUp(ed, { x: 80, y: 90 });
  assert(r.rect.w === 70 && r.rect.h === 80, JSON.stringify(r.rect));
});

test('editor: 删除选中', () => {
  const ed = createEditor();
  const r = drag(ed, { x: 1, y: 1 }, { x: 30, y: 30 });
  assert(deleteSelection(ed) === r);
  assert(ed.regions.length === 0 && ed.selectedId === null);
});

test('editor: 方向键微移不越界', () => {
  const ed = createEditor({ pageW: 100, pageH: 100 });
  addRegion(ed, { shape: 'rect', rect: { x: 95, y: 5, w: 5, h: 5 } });
  nudge(ed, 10, 0);
  assert(ed.regions[0].rect.x === 95, '贴右边就不该再往右');
  nudge(ed, -10, 0);
  assert(ed.regions[0].rect.x === 85);
});

test('editor: 笔画命中用外接框', () => {
  const ed = createEditor();
  const r = addRegion(ed, { shape: 'poly', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }] });
  assert(boundsOf(r).w === 20 && boundsOf(r).h === 20);
  assert(regionAt(ed, { x: 5, y: 5 }) === r);
  assert(regionAt(ed, { x: 15, y: 15 }) === null);
});
