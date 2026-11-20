// 选中区域的就地控件：类型（题干/A-D）、题号、备注
// 状态：已实现。setter 是纯函数，DOM 只负责把它们接上。

export const KINDS = ['stem', 'A', 'B', 'C', 'D'];

export function setKind(region, kind) {
  if (kind === 'stem') {
    region.kind = 'stem';
    region.opt = null;
  } else if (KINDS.includes(kind)) {
    region.kind = 'opt';
    region.opt = kind;
  }
  return region;
}

export function setQuestion(region, q) {
  region.q = String(q === undefined || q === null ? '' : q).trim();
  return region;
}

export function setNote(region, note) {
  region.note = String(note || '');
  return region;
}

export function kindValue(region) {
  return region.kind === 'opt' ? region.opt || 'A' : 'stem';
}

export function buildControls(doc, region, onChange) {
  const row = doc.createElement('div');
  row.className = 'inspector';

  const kind = doc.createElement('select');
  kind.className = 'region-kind';
  kind.title = '类型';
  for (const k of KINDS) {
    const o = doc.createElement('option');
    o.value = k;
    o.textContent = k === 'stem' ? '题干' : k;
    kind.appendChild(o);
  }
  kind.value = kindValue(region);

  const q = doc.createElement('input');
  q.className = 'region-q';
  q.type = 'text';
  q.placeholder = '题号';
  q.value = region.q || '';
  q.title = '题号';

  const note = doc.createElement('input');
  note.className = 'region-note';
  note.type = 'text';
  note.placeholder = '备注';
  note.value = region.note || '';
  note.title = '备注';

  kind.addEventListener('change', () => {
    setKind(region, kind.value);
    onChange(region);
  });
  q.addEventListener('input', () => {
    setQuestion(region, q.value);
    onChange(region, { quiet: true });
  });
  note.addEventListener('input', () => {
    setNote(region, note.value);
    onChange(region, { quiet: true });
  });

  row.append(kind, q, note);
  return row;
}

// 给一个容器就地渲染控件（骨架里声明的名字）
export function renderInspector(container, region, onChange) {
  const row = buildControls(container.ownerDocument, region, onChange);
  container.textContent = '';
  container.appendChild(row);
  return row;
}
