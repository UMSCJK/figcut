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
  invert: wrap('<rect x="2.6" y="3" width="10.8" height="10" rx="1.2"/><path d="M8 3v10"/><path d="M8 3h4.2a1.2 1.2 0 0 1 1.2 1.2v7.6a1.2 1.2 0 0 1-1.2 1.2H8z" fill="currentColor" stroke="none"/>'),
  select: wrap('<path d="M4 2.8l7.4 4.6-3 .8-.8 3z"/>'),
  rect: wrap('<rect x="2.8" y="3.6" width="10.4" height="8.8" rx="1"/>'),
  poly: wrap('<path d="M8 2.4l5.2 3.8-2 6.2H4.8l-2-6.2z"/>'),
  trash: wrap('<path d="M3.4 4.4h9.2"/><path d="M6.4 4.4V3.2h3.2v1.2"/><path d="M4.9 4.4l.5 8.1h5.2l.5-8.1"/>'),
  minus: wrap('<path d="M3.6 8h8.8"/>'),
  plus: wrap('<path d="M8 3.6v8.8M3.6 8h8.8"/>'),
  grid: wrap('<rect x="2.6" y="2.6" width="4.6" height="4.6" rx="0.8"/><rect x="8.8" y="2.6" width="4.6" height="4.6" rx="0.8"/><rect x="2.6" y="8.8" width="4.6" height="4.6" rx="0.8"/><rect x="8.8" y="8.8" width="4.6" height="4.6" rx="0.8"/>'),
  sidebarLeft: wrap('<rect x="2" y="3" width="12" height="10" rx="1.6"/><rect x="4.2" y="5" width="3" height="6" rx="0.8" fill="currentColor" stroke="none"/>'),
  sidebarRight: wrap('<rect x="2" y="3" width="12" height="10" rx="1.6"/><rect x="8.8" y="5" width="3" height="6" rx="0.8" fill="currentColor" stroke="none"/>'),
  columns: wrap('<rect x="2.4" y="2.8" width="4.4" height="10.4" rx="1"/><rect x="9.2" y="2.8" width="4.4" height="10.4" rx="1"/>'),
  fitWidth: wrap('<rect x="2.4" y="3.2" width="4.2" height="9.6" rx="0.6"/><path d="M9 8h4.4M11.6 5.6L13.8 8l-2.2 2.4"/>'),
  fitPage: wrap('<rect x="4" y="2.6" width="8" height="10.8" rx="0.8"/><path d="M6 5.4h4M6 8h4M6 10.6h4"/>'),
  uiAuto: wrap('<circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8" stroke-dasharray="1.5 1.6"/>'),
  uiLight: wrap('<circle cx="8" cy="8" r="3"/><path d="M8 1.8v1.6M8 12.6V14.2M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/>'),
  uiDark: wrap('<path d="M13 9.2A5.4 5.4 0 0 1 6.8 3a5.4 5.4 0 1 0 6.2 6.2z"/>'),
  doc: wrap('<path d="M3.6 2.4h5.2l3.6 3.6v7.6H3.6z"/><path d="M8.8 2.4v3.6h3.6"/>'),
};

export function icon(name, opts) {
  return ICONS[name] || wrap('<circle cx="8" cy="8" r="5"/>', opts);
}
