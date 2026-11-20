// 类型选择器：自己画的九宫格（题干 / A–K / 自定义输入），不用原生 select
// 状态：已实现。

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

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
  region.kind = 'opt'; // 自定义也是"选项"，不是题干
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

export function labelOfKind(region) {
  const v = kindValue(region);
  if (v === 'stem') return '题干';
  if (v === 'custom') return region.optText ? region.optText : '自定义';
  return v;
}

export function buildControls(doc, region, onChange, opts = {}) {
  const row = doc.createElement('div');
  row.className = 'inspector';

  // ---- 类型按钮 + 九宫格弹层 ----
  const kindBtn = doc.createElement('button');
  kindBtn.type = 'button';
  kindBtn.className = 'opt-btn';
  kindBtn.title = '类型：题干 / A–K / 自定义';

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
  custom.value = region.optText || '';
  custom.title = '自定义选项名';
  menu.appendChild(custom);

  const cells = [...menu.querySelectorAll('.opt-cell[data-kind]')];

  function sync() {
    kindBtn.textContent = labelOfKind(region) + ' ▾';
    for (const c of cells) c.classList.toggle('on', c.dataset.kind === kindValue(region));
    custom.classList.toggle('on', kindValue(region) === 'custom');
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
      setKind(region, c.dataset.kind);
      sync();
      close();
      onChange(region, { structural: true });
    });
  }
  custom.addEventListener('input', () => {
    setCustomOption(region, custom.value);
    sync();
    onChange(region, { quiet: true });
  });

  // ---- 题号 / 备注 ----
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
