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
  // 只替换列表本身，别把表头和折叠按钮一起清掉
  const old = host.querySelector('.page-list');
  if (old) old.remove();

  const list = doc.createElement('div');
  list.className = 'page-list' + (opts.cols === 2 ? ' is-double' : '');

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
    frame.appendChild(badge);

    // 看大图：鼠标悬停才出现，不影响点缩略图跳页
    const zoom = doc.createElement('span');
    zoom.className = 'page-zoom';
    zoom.textContent = '⤢';
    zoom.title = '全屏看这一页';
    zoom.addEventListener('click', (ev) => {
      ev.stopPropagation();
      opts.onZoom && opts.onZoom(p.no);
    });
    frame.appendChild(zoom);

    row.appendChild(frame);
    row.addEventListener('click', () => onPick && onPick(p.no));
    list.appendChild(row);
  }

  host.appendChild(list);

  // 中间滚到哪，左栏就把它滚进可视区（只滚左栏，不动画布）
  const active = list.querySelector('.page-item.is-current');
  if (active && active.scrollIntoView) {
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return list;
}

export function markCurrent(host, no) {
  for (const row of host.querySelectorAll('.page-item')) {
    row.classList.toggle('is-current', Number(row.dataset.page) === no);
  }
  return no;
}
