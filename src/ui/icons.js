/** Inline SVG icons (stroke-based, 1.7px, currentColor). */
const wrap = (path, extra = '') =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;

export const icons = {
  play: wrap('<path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none"/>'),
  pause: wrap('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>'),
  stop: wrap('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
  up: wrap('<path d="M12 19V5m0 0-6 6m6-6 6 6"/>'),
  down: wrap('<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>'),
  trash: wrap('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>'),
  copy: wrap('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  upload: wrap('<path d="M12 16V4m0 0-5 5m5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  download: wrap('<path d="M12 4v12m0 0 5-5m-5 5-5-5"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/>'),
  skeleton: wrap('<circle cx="12" cy="4.5" r="2"/><path d="M12 6.5v6m0-4-6 3m6-3 6 3m-6 4-4 6m4-6 4 6"/>'),
  grid: wrap('<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  wireframe: wrap('<path d="M12 3 21 8v8l-9 5-9-5V8l9-5Zm0 0v18M3 8l18 8M21 8 3 16"/>'),
  camera: wrap('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/>'),
  help: wrap('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>'),
  chevron: wrap('<path d="M9 6l6 6-6 6"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  repeat: wrap('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  link: wrap('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'),
  film: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  wand: wrap('<path d="M5 19 19 5M15 5h4v4"/><path d="M6 4v3M4.5 5.5h3M18 15v3M16.5 16.5h3"/>'),
};

export const icon = (name) => icons[name] || '';
