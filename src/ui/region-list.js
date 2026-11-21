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
  const { regions, page, selectedId, onSelect, onChange, onDelete, onThumb, onThumbClick, onReorder } = opts;
  // 清掉上一轮挂在 body 上的类型弹层
  for (const old of doc.querySelectorAll('.opt-menu')) old.remove();
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
        // 点控件（类型按钮/输入框）时不算"选中这一行"，否则列表重建会把弹层关掉
        if (ev.target && ev.target.closest && ev.target.closest('.inspector')) return;
        if (ev.target && ev.target.closest && ev.target.closest('.region-thumb')) {
          onThumbClick && onThumbClick(r);
          return;
        }
        onSelect(r);
      });

      // 拖动抓手：只在同一页内换顺序
      const grip = doc.createElement('span');
      grip.className = 'region-grip';
      grip.textContent = '⋮⋮';
      grip.title = '拖动调整顺序';
      grip.draggable = true;
      grip.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(r.id));
        row.classList.add('is-dragging');
      });
      grip.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (ev) => {
        if (r.page !== page) return;
        ev.preventDefault();
        row.classList.add('is-drop');
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-drop'));
      row.addEventListener('drop', (ev) => {
        ev.preventDefault();
        row.classList.remove('is-drop');
        const id = Number(ev.dataTransfer.getData('text/plain'));
        if (id && id !== r.id && onReorder) onReorder(id, r.id);
      });
      row.appendChild(grip);

      const thumb = onThumb ? onThumb(r) : null;
      if (thumb) {
        thumb.className = 'region-thumb';
        row.appendChild(thumb);
      } else {
        const ph = doc.createElement('div');
        ph.className = 'region-thumb is-empty';
        row.appendChild(ph);
      }

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
