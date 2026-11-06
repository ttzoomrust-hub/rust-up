/* RUST UP icon set (2026-11-06): own line glyphs instead of emoji stickers.
   badge(name, cls) — a glossy tile in the icon's colors with a white glyph (banners, heroes, lists);
   glyph(name, cls) — the bare glyph in its color, sized like the text around it (numbers, chips, toasts). */
(() => {
  'use strict';
  const G = {
    upgrade: '<path d="M12 18.5V7M6.5 11.5L12 6l5.5 5.5"/><path d="M7 20h10"/>',
    case: '<path d="M3.5 9h17v10.5h-17z"/><path d="M3.5 9l2-4.5h13l2 4.5"/><path d="M10 13h4"/>',
    crash: '<path d="M12 2.8c3 2 4.5 5.6 4.5 9.6L14 16h-4l-2.5-3.6C7.5 8.4 9 4.8 12 2.8z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M10 16l-2 4M14 16l2 4M12 17v4"/>',
    mines: '<circle cx="10.5" cy="14.5" r="6.3"/><path d="M14.4 9.8l1.9-1.9 1.8 1.8-1.9 1.9"/><path d="M17.2 7c.9-1.7 2.4-2.3 3.8-1.6"/><path d="M7.6 12.6a3.2 3.2 0 0 1 2.4-1.8"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5M6 6l4.6 4.6M13.4 13.4L18 18"/>',
    plinko: '<circle cx="12" cy="5" r="1.3"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/><circle cx="5" cy="15" r="1.3"/><circle cx="12" cy="15" r="1.3"/><circle cx="19" cy="15" r="1.3"/><path d="M4 20h16"/>',
    contract: '<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
    battle: '<path d="M4 4l9.5 9.5M4 4h3.8M4 4v3.8M20 4l-9.5 9.5M20 4h-3.8M20 4v3.8"/><path d="M8.5 15.5L5 19M15.5 15.5L19 19M7 13.5l3.5 3.5M17 13.5L13.5 17"/>',
    trophy: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0z"/><path d="M8 6H4.8v1.4A3.6 3.6 0 0 0 8.6 11M16 6h3.2v1.4A3.6 3.6 0 0 1 15.4 11"/><path d="M12 13.3V17M9.5 17h5v3h-5zM8 20.5h8"/>',
    snow: '<path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2"/><path d="M9.6 4.3L12 6.6l2.4-2.3M9.6 19.7L12 17.4l2.4 2.3M4.6 10.4l3.2-.9-.8-3.2M19.4 13.6l-3.2.9.8 3.2M7 17.7l.8-3.2-3.2-.9M17 6.3l-.8 3.2 3.2.9"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 12l6-6M16 4.5V8h3.5"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.6 2.8-5.6 5.5-5.6s4.9 2 5.5 5.6"/><path d="M15.5 5.5a3 3 0 0 1 0 6M17.2 14c2 .7 3.1 2.5 3.4 5.5"/>',
    shield: '<path d="M12 2.8l7.5 3V11.4c0 4.7-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5.1-7.5-9.8V5.8z"/><path d="M8.5 12l2.5 2.5 4.6-5"/>',
    bolt: '<path d="M13.5 2.5L5 13.5h6.2L10 21.5l9-11.5h-6.4z"/>',
    fire: '<path d="M12 21.5c-4.1 0-6.8-2.8-6.8-6.4 0-3.4 2.4-5.2 3.6-7.6.6 1.7 1.5 2.6 2.5 3 .1-3.3 1.4-5.9 3.6-7.6.2 3.1 1.9 4.8 3.1 6.6 1 1.6 1.6 3.1 1.6 5 0 4.1-3 7-7.6 7z"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/>',
    trend: '<path d="M3.5 17.5l5.5-5.5 3.6 3.6L20.5 7.7"/><path d="M15 7.5h5.5V13"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.2"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.6M12 14.5v2.2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.2 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    game: '<path d="M7.2 7.5h9.6a4 4 0 0 1 4 4.6l-.6 4.1a2.5 2.5 0 0 1-4.3 1.3L14.4 15.5H9.6l-1.5 2a2.5 2.5 0 0 1-4.3-1.3l-.6-4.1a4 4 0 0 1 4-4.6z"/><path d="M8 10.5v3.2M6.4 12.1h3.2M15.5 11h.01M17.5 13h.01"/>',
    gift: '<path d="M4 9h16v4.2H4zM5.5 13.2h13V20.5h-13zM12 9v11.5"/><path d="M12 9C10.6 5.6 7.4 5 7 7.2S9.6 9 12 9c2.4 0 5.4.4 5-1.8s-3.6-1.6-5 1.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.6"/><path d="M4 10.2h16M8.5 3.5v4M15.5 3.5v4M8 14h2M14 14h2M8 17h2"/>',
    check: '<path d="M5.5 12.5l4.2 4.2 8.8-9"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17"/>',
    camera: '<path d="M4 8.5h3.2l1.6-2.2h6.4l1.6 2.2H20V19H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.6"/><path d="M9 9h.01M15 15h.01M12 12h.01M15 9h.01M9 15h.01"/>',
    bot: '<rect x="5" y="8" width="14" height="11" rx="3.2"/><path d="M12 4.8V8M9.5 12.8h.01M14.5 12.8h.01M9.5 16h5M3 12.3v3.2M21 12.3v3.2"/><circle cx="12" cy="3.8" r="1"/>',
    crown: '<path d="M3.8 8.2l4.4 4 3.8-6.4 3.8 6.4 4.4-4-1.6 10.3H5.4z"/>',
    boom: '<path d="M12 2.8l1.9 4.7 4.6-2-1.6 4.9 4.9 1.6-4.7 2 2.1 4.7-5-1.5L12 21.2l-2.2-4.8-5 1.5 2.1-4.7-4.7-2 4.9-1.6-1.6-4.9 4.6 2z"/>',
    wave: '<path d="M8.5 11.5V6.2a1.5 1.5 0 0 1 3 0v4.5M11.5 10V4.7a1.5 1.5 0 0 1 3 0V10M14.5 10V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.7 7-6.5 7-2.6 0-4.4-1.3-5.8-3.6L3.7 14a1.5 1.5 0 0 1 2.5-1.6l2.3 2.6V8.5"/><path d="M19.5 3.5c.9.7 1.5 1.7 1.7 2.8M3 5.2c.4-1 1.1-1.9 2-2.4"/>'
  };
  // filled glyphs (solid shapes look better than outlines)
  const FILLED = new Set(['bolt', 'fire', 'star', 'crown', 'boom']);
  const C = {
    upgrade: ['#ff7a6b', '#c42a2d'], case: ['#ffbf5e', '#e0742a'], crash: ['#6cb6ff', '#3550d4'], mines: ['#9a9aa6', '#3a3a44'], wheel: ['#be8cff', '#6a3fd1'],
    plinko: ['#ff86cc', '#c2338a'], contract: ['#5be0d2', '#1d8a80'], battle: ['#ff9a4d', '#d03a26'], trophy: ['#ffd875', '#dd8a1f'], snow: ['#a8e8ff', '#3f97db'],
    target: ['#ff7a6b', '#c42a2d'], users: ['#6cb6ff', '#7b4dff'], shield: ['#5fd68a', '#1d8048'], bolt: ['#ffd875', '#ff7f2a'], fire: ['#ffc061', '#ff3a2a'],
    star: ['#ffd875', '#e0962a'], trend: ['#5fd68a', '#1d8048'], lock: ['#9a9aa6', '#45454f'], unlock: ['#5fd68a', '#1d8048'], clock: ['#9a9aa6', '#45454f'],
    link: ['#6cb6ff', '#3550d4'], game: ['#ff7a6b', '#c42a2d'], gift: ['#ff7a6b', '#c42a2d'], sun: ['#ffd875', '#ff9a2a'], calendar: ['#be8cff', '#6a3fd1'],
    check: ['#5fd68a', '#1d8048'], cross: ['#ff7a6b', '#c42a2d'], camera: ['#ff86cc', '#c2338a'], dice: ['#be8cff', '#6a3fd1'], wave: ['#ffd875', '#ff9a2a'], bot: ['#6cb6ff', '#3550d4'], crown: ['#ffd875', '#dd8a1f'], boom: ['#ffc061', '#ff3a2a']
  };
  const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true"${FILLED.has(n) ? ' class="f"' : ''}>${G[n] || G.dice}</svg>`;
  const vars = n => { const [a, b] = C[n] || C.dice; return `--c1:${a};--c2:${b}`; };
  window.RUSTUP_ICONS = {
    badge: (n, cls = '') => `<span class="xi ${cls}" style="${vars(n)}">${svg(n)}</span>`,
    glyph: (n, cls = '') => `<span class="xg ${cls}" style="${vars(n)}">${svg(n)}</span>`,
    svg
  };
})();
