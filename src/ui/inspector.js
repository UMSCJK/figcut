// 选中区域的就地控件：类型（题干 / A–K / 自定义）、题号、备注
// 状态：已实现。setter 是纯函数。

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
export const KINDS = ['stem', ...LETTERS, 'custom'];

export function setKind(region, kind) {
  if (kind === 'stem') {
    region.kind = 'stem';
    region.opt = null;
  } else if (kind === 'custom') {
    region.kind = 'opt';
    region.opt = 'custom';
  } else if (LETTERS.includes(kind)) {
    region.kind = 'opt';
    region.opt = kind;
  }
  return region;
}

export function setCustomOption(region, text) {
  region.opt = 'custom';
  region.optText = String(text || '').trim();
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
  if (region.kind !== 'opt') return 'stem';
  return region.opt === 'custom' ? 'custom' : region.opt || 'A';
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
    o.textContent = k === 'stem' ? '题干' : k === 'custom' ? '自定义' : k;
    kind.appendChild(o);
  }
  kind.value = kindValue(region);

  const custom = doc.createElement('input');
  custom.className = 'region-custom';
  custom.type = 'text';
  custom.placeholder = '自定义';
  custom.value = region.optText || '';
  custom.title = '自定义选项名';
  custom.hidden = kind.value !== 'custom';

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
    custom.hidden = kind.value !== 'custom';
    onChange(region);
  });
  custom.addEventListener('input', () => {
    setCustomOption(region, custom.value);
    onChange(region, { quiet: true });
  });
  q.addEventListener('input', () => {
    setQuestion(region, q.value);
    onChange(region, { quiet: true });
  });
  note.addEventListener('input', () => {
    setNote(region, note.value);
    onChange(region, { quiet: true });
  });

  row.append(kind, custom, q, note);
  return row;
}

export function renderInspector(container, region, onChange) {
  const row = buildControls(container.ownerDocument, region, onChange);
  container.textContent = '';
  container.appendChild(row);
  return row;
}
