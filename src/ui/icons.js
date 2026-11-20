// 内联 SVG 图标：统一 16x16、currentColor 描边，跟 Adwaita 符号图标一个路数。
const wrap = (body, opts = {}) =>
  '<svg width="' + (opts.size || 16) + '" height="' + (opts.size || 16) + '" viewBox="0 0 16 16" fill="none" '
  + 'stroke="currentColor" stroke-width="' + (opts.width || 1.5) + '" stroke-linecap="round" stroke-linejoin="round">'
  + body + '</svg>';

export const ICONS = {
  open: wrap('<path d="M2 5.2h4.2l1.3 1.6H14v6.4H2z"/><path d="M2 5.2V3.6h4.2"/>'),
  undo: wrap('<path d="M6.2 4.2L3 7.4l3.2 3.2"/><path d="M3.4 7.4h5.4a3.6 3.6 0 0 1 0 7.2H6"/>'),
  redo: wrap('<path d="M9.8 4.2L13 7.4l-3.2 3.2"/><path d="M12.6 7.4H7.2a3.6 3.6 0 0 0 0 7.2H10"/>'),
  export: wrap('<path d="M8 2.4v7"/><path d="M5.2 6.6L8 9.4l2.8-2.8"/><path d="M3 12.4h10"/>'),
  settings: wrap('<path d="M2.4 5h11.2M2.4 11h11.2"/><circle cx="6.2" cy="5" r="1.6"/><circle cx="10" cy="11" r="1.6"/>'),
  uiTheme: wrap('<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" stroke="none"/>'),
  invert: wrap('<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4v11.2" /><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" stroke="none"/>'),
  select: wrap('<path d="M4 2.8l7.4 4.6-3 .8-.8 3z"/>'),
  rect: wrap('<rect x="2.8" y="3.6" width="10.4" height="8.8" rx="1"/>'),
  poly: wrap('<path d="M8 2.4l5.2 3.8-2 6.2H4.8l-2-6.2z"/>'),
  trash: wrap('<path d="M3.4 4.4h9.2"/><path d="M6.4 4.4V3.2h3.2v1.2"/><path d="M4.9 4.4l.5 8.1h5.2l.5-8.1"/>'),
  minus: wrap('<path d="M3.6 8h8.8"/>'),
  plus: wrap('<path d="M8 3.6v8.8M3.6 8h8.8"/>'),
};

export function icon(name, opts) {
  return ICONS[name] || wrap('<circle cx="8" cy="8" r="5"/>', opts);
}
