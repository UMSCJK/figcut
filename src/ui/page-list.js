// 左栏页面列表：页码 + 每页标注数，当前页高亮并自动滚入视野
// 状态：已实现。

export function countByPage(regions) {
  const counts = {};
  for (const r of regions) counts[r.page] = (counts[r.page] || 0) + 1;
  return counts;
}

export function renderPageList(host, opts) {
  const doc = host.ownerDocument;
  const { pages, current, regions, onPick } = opts;
  const counts = countByPage(regions || []);
  host.textContent = '';

  const list = doc.createElement('div');
  list.className = 'page-list';

  for (const p of pages) {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'page-item' + (p.no === current ? ' is-current' : '');
    row.dataset.page = String(p.no);

    const num = doc.createElement('span');
    num.className = 'page-no';
    num.textContent = String(p.no);

    const badge = doc.createElement('span');
    badge.className = 'page-count';
    badge.textContent = counts[p.no] ? String(counts[p.no]) : '';

    row.append(num, badge);
    row.addEventListener('click', () => onPick && onPick(p.no));
    list.appendChild(row);
  }

  host.appendChild(list);
  return list;
}

export function markCurrent(host, no) {
  for (const row of host.querySelectorAll('.page-item')) {
    row.classList.toggle('is-current', Number(row.dataset.page) === no);
  }
  const cur = host.querySelector('.page-item.is-current');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  return no;
}
