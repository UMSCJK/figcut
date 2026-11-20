// 界面配色与 PDF 预览配色
// 状态：已实现。界面与 PDF 是两套独立的三态，互不影响。

export const UI_MODES = ['system', 'light', 'dark'];
export const PDF_MODES = ['auto', 'normal', 'invert'];

export function createTheme(opts = {}) {
  return {
    ui: UI_MODES.includes(opts.ui) ? opts.ui : 'system',
    pdf: PDF_MODES.includes(opts.pdf) ? opts.pdf : 'auto',
  };
}

function nextOf(list, cur) {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}

export function cycleUi(theme) {
  theme.ui = nextOf(UI_MODES, theme.ui);
  return theme.ui;
}

export function cyclePdfPreview(theme) {
  theme.pdf = nextOf(PDF_MODES, theme.pdf);
  return theme.pdf;
}

// 界面最终是浅还是深（跟随系统时看 prefersDark）
export function resolvedUi(theme, prefersDark) {
  if (theme.ui === 'dark') return 'dark';
  if (theme.ui === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

// PDF 预览要不要反相：跟随界面 → 深色界面就反相；正常 → 永不；反相 → 永远
export function isInverted(theme, prefersDark) {
  if (theme.pdf === 'invert') return true;
  if (theme.pdf === 'normal') return false;
  return resolvedUi(theme, prefersDark) === 'dark';
}

export function applyTheme(theme, doc, prefersDark) {
  const root = doc.documentElement;
  root.dataset.ui = resolvedUi(theme, prefersDark);
  root.dataset.pdfInvert = isInverted(theme, prefersDark) ? '1' : '0';
  root.dataset.pdfMode = theme.pdf;
  root.dataset.uiMode = theme.ui;
  return { ui: root.dataset.ui, inverted: root.dataset.pdfInvert === '1' };
}

export function loadTheme(storage) {
  try {
    const raw = storage && storage.getItem('figcut.theme');
    if (!raw) return createTheme();
    const j = JSON.parse(raw);
    return createTheme({ ui: j.ui, pdf: j.pdf });
  } catch (e) {
    return createTheme();
  }
}

export function saveTheme(storage, theme) {
  try {
    storage.setItem('figcut.theme', JSON.stringify({ ui: theme.ui, pdf: theme.pdf }));
  } catch (e) {
    // 存不下就算了，不影响本次使用
  }
}
