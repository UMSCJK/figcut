// 右栏区域列表：本页可编辑，其他页只读分组
// 状态：已实现。

import { buildControls, kindValue } from './inspector.js';
import { ICONS } from './icons.js';

// 按页分组给列表用；真正的分组逻辑在 io/config（存盘也要用同一份）
export function groupRowsByPage(regions) {
  const map = new Map();
  for (const r of regions) {
    if (!map.has(r.page)) map.set(r.page, []);
    map.get(r.page).push(r);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function labelOf(region) {
  const kind = region.kind === 'opt' ? '选项 ' + (region.opt || 'A') : '题干';
  const q = region.q ? ' · 第 ' + region.q + ' 题' : '';
  return kind + q;
}

export function renderRegions(host, opts) {
  const doc = host.ownerDocument;
  const { regions, page, selectedId, onSelect, onChange, onDelete } = opts;
  host.textContent = '';

  const groups = groupRowsByPage(regions);
  if (groups.length === 0) {
    const empty = doc.createElement('div');
    empty.className = 'region-empty';
    empty.textContent = '还没有框。用左上角的矩形/多边形圈一张图。';
    host.appendChild(empty);
    return 0;
  }

  let rows = 0;
  for (const [pageNo, list] of groups) {
    const head = doc.createElement('div');
    head.className = 'region-group' + (pageNo === page ? ' is-current' : '');
    head.textContent = '第 ' + pageNo + ' 页 · ' + list.length + ' 个';
    host.appendChild(head);

    for (const r of list) {
      const row = doc.createElement('div');
      row.className = 'region-row' + (r.id === selectedId ? ' is-selected' : '');
      row.dataset.id = String(r.id);
      row.addEventListener('click', (ev) => {
        if (ev.target && ev.target.tagName === 'SELECT') return;
        onSelect(r);
      });

      if (pageNo === page) {
        row.appendChild(buildControls(doc, r, (region, meta) => onChange(region, meta)));
      } else {
        const label = doc.createElement('div');
        label.className = 'region-label';
        label.textContent = labelOf(r);
        row.appendChild(label);
      }

      const del = doc.createElement('button');
      del.type = 'button';
      del.className = 'region-del';
      del.innerHTML = ICONS.trash;
      del.title = '删除';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onDelete(r);
      });
      row.appendChild(del);

      host.appendChild(row);
      rows += 1;
    }
  }
  return rows;
}

export { kindValue };
