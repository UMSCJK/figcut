// 类型选择器：题干 + A–K 多选 + 自定义文本（同一个 figure 可以同时是 A 和 C）
// 状态：已实现。

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export function optsOf(region) {
  if (Array.isArray(region.opts)) return region.opts.slice();
  if (region.kind === 'opt' && region.opt) {
    return region.opt === 'custom' ? (region.optText ? [region.optText] : []) : [region.opt];
  }
  return [];
}

function writeOpts(region, list) {
  region.opts = list;
  region.kind = list.length ? 'opt' : 'stem';
  // 兼容旧字段
  region.opt = list.length === 1 && LETTERS.includes(list[0]) ? list[0] : list.length ? 'custom' : null;
  region.optText = list.length ? list.filter((x) => !LETTERS.includes(x)).join(' ') : '';
  return region;
}

export function setKind(region, kind) {
  if (kind === 'stem') writeOpts(region, []);
  else if (kind === 'custom') writeOpts(region, region.optText ? [region.optText] : []);
  else if (LETTERS.includes(kind)) writeOpts(region, [kind]);
  return region;
}

export function toggleLetter(region, letter) {
  const list = optsOf(region);
  const i = list.indexOf(letter);
  if (i >= 0) list.splice(i, 1);
  else list.push(letter);
  return writeOpts(region, list);
}

export function setCustomOption(region, text) {
  const clean = String(text || '').trim();
  const letters = optsOf(region).filter((x) => LETTERS.includes(x));
  return writeOpts(region, clean ? [...letters, clean] : letters);
}

export function setQuestion(region, q) {
  region.q = String(q === undefined || q === null ? '' : q).trim();
  return region;
}

export function setNote(region, note) {
  region.note = String(note || '');
  return region;
}

export function labelOfKind(region) {
  const list = optsOf(region);
  if (!list.length) return '题干';
  return list.join(' ');
}

export function kindValue(region) {
  const list = optsOf(region);
  if (!list.length) return 'stem';
  if (list.length === 1 && LETTERS.includes(list[0])) return list[0];
  return 'custom';
}

export function buildControls(doc, region, onChange, opts = {}) {
  const row = doc.createElement('div');
  row.className = 'inspector';

  const kindBtn = doc.createElement('button');
  kindBtn.type = 'button';
  kindBtn.className = 'opt-btn';
  kindBtn.title = '类型：题干 / A–K 可多选 / 自定义';

  const menu = doc.createElement('div');
  menu.className = 'opt-menu';
  menu.hidden = true;

  const stemBtn = doc.createElement('button');
  stemBtn.type = 'button';
  stemBtn.className = 'opt-cell is-wide';
  stemBtn.textContent = '题干';
  stemBtn.dataset.kind = 'stem';
  menu.appendChild(stemBtn);

  for (const letter of LETTERS) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'opt-cell';
    b.textContent = letter;
    b.dataset.kind = letter;
    menu.appendChild(b);
  }

  const custom = doc.createElement('input');
  custom.className = 'opt-cell opt-input';
  custom.type = 'text';
  custom.placeholder = '其他';
  custom.value = optsOf(region).filter((x) => !LETTERS.includes(x)).join(' ');
  custom.title = '自定义选项名';
  menu.appendChild(custom);

  const cells = [...menu.querySelectorAll('.opt-cell[data-kind]')];

  function sync() {
    kindBtn.textContent = labelOfKind(region) + ' ▾';
    const list = optsOf(region);
    for (const c of cells) {
      if (c.dataset.kind === 'stem') c.classList.toggle('on', list.length === 0);
      else c.classList.toggle('on', list.includes(c.dataset.kind));
    }
    custom.classList.toggle('on', list.some((x) => !LETTERS.includes(x)));
  }
  sync();

  function close() {
    menu.hidden = true;
    doc.removeEventListener('pointerdown', onOutside, true);
  }
  function onOutside(ev) {
    if (menu.contains(ev.target) || kindBtn.contains(ev.target)) return;
    close();
  }
  function open() {
    const r = kindBtn.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.top = Math.round(r.bottom + 4) + 'px';
    menu.hidden = false;
    doc.addEventListener('pointerdown', onOutside, true);
    opts.onOpen && opts.onOpen();
  }
  kindBtn.addEventListener('click', () => (menu.hidden ? open() : close()));

  for (const c of cells) {
    c.addEventListener('click', () => {
      if (c.dataset.kind === 'stem') setKind(region, 'stem');
      else toggleLetter(region, c.dataset.kind);
      sync();
      onChange(region, { structural: true });
    });
  }
  custom.addEventListener('input', () => {
    setCustomOption(region, custom.value);
    sync();
    onChange(region, { quiet: true });
  });

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

  q.addEventListener('input', () => {
    setQuestion(region, q.value);
    onChange(region, { quiet: true });
  });
  note.addEventListener('input', () => {
    setNote(region, note.value);
    onChange(region, { quiet: true });
  });

  row.append(kindBtn, q, note);
  doc.body.appendChild(menu);
  row._menu = menu;
  return row;
}

export function renderInspector(container, region, onChange) {
  const row = buildControls(container.ownerDocument, region, onChange);
  container.textContent = '';
  container.appendChild(row);
  return row;
}
