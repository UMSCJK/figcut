// 左栏页面列表：大缩略图（Papers 那种）+ 页码 + 标注数
// 状态：已实现。

export function countByPage(regions) {
  const counts = {};
  for (const r of regions) counts[r.page] = (counts[r.page] || 0) + 1;
  return counts;
}

export function renderPageList(host, opts) {
  const doc = host.ownerDocument;
  const { pages, current, regions, onPick, thumbFor } = opts;
  const counts = countByPage(regions || []);
  const head = host.querySelector('.side-head');
  host.textContent = '';
  if (head) host.appendChild(head);

  const list = doc.createElement('div');
  list.className = 'page-list';

  for (const p of pages) {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'page-item' + (p.no === current ? ' is-current' : '');
    row.dataset.page = String(p.no);
    row.title = '第 ' + p.no + ' 页';

    const frame = doc.createElement('div');
    frame.className = 'page-frame';

    const thumb = thumbFor ? thumbFor(p.no) : null;
    if (thumb) {
      thumb.className = 'page-thumb';
      frame.appendChild(thumb);
    }

    const num = doc.createElement('span');
    num.className = 'page-no';
    num.textContent = String(p.no);
    frame.appendChild(num);

    const badge = doc.createElement('span');
    badge.className = 'page-count';
    badge.textContent = counts[p.no] ? String(counts[p.no]) : '';

    row.append(frame, badge);
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
  return no;
}
