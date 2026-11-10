'use strict';
/* Small shared helpers: DOM shortcuts, date maths, icons. */
/* ---------- helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pk = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const fmt = (d, o) => d.toLocaleDateString(undefined, o);
const F1 = { day: 'numeric', month: 'short' }, F2 = { day: 'numeric', month: 'short', year: 'numeric' };
const FM = { month: 'short', year: '2-digit' }, FML = { month: 'long', year: 'numeric' };
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const svg = (vb, inner, extra) => `<svg viewBox="${vb}" ${extra || 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'}>${inner}</svg>`;
const ICON = {
  check: svg('0 0 12 12', '<path d="M2.5 6.5l2.5 2.5 4.5-5.5"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'),
  grip: svg('0 0 10 14', '<circle cx="2.5" cy="2.5" r="1.2"/><circle cx="7.5" cy="2.5" r="1.2"/><circle cx="2.5" cy="7" r="1.2"/><circle cx="7.5" cy="7" r="1.2"/><circle cx="2.5" cy="11.5" r="1.2"/><circle cx="7.5" cy="11.5" r="1.2"/>', 'fill="currentColor"'),
  up: svg('0 0 12 12', '<path d="M2.5 7.5L6 4l3.5 3.5"/>'),
  down: svg('0 0 12 12', '<path d="M2.5 4.5L6 8l3.5-3.5"/>'),
  x: svg('0 0 12 12', '<path d="M3 3l6 6M9 3l-6 6"/>'),
  sndOn: svg('0 0 16 16', '<path d="M2.5 6v4h2.6L8.5 12.8V3.2L5.1 6z"/><path d="M11 5.5a3.8 3.8 0 010 5M12.8 3.7a6.3 6.3 0 010 8.6"/>'),
  sndOff: svg('0 0 16 16', '<path d="M2.5 6v4h2.6L8.5 12.8V3.2L5.1 6z"/><path d="M11.3 6l3 4M14.3 6l-3 4"/>'),
  eye: svg('0 0 16 16', '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/>'),
  eyeOff: svg('0 0 16 16', '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/><path d="M2.5 13.5l11-11"/>'),
  sort: svg('0 0 16 16', '<path d="M3 4h10M3 8h7M3 12h4"/>'),
  palette: svg('0 0 16 16', '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 010 11.6z" fill="currentColor"/>'),
  c_line: svg('0 0 16 16', '<path d="M2 12l3.5-4.5 3 2.5L14 3.5"/>'),
  c_column: svg('0 0 16 16', '<path d="M3.5 13V8.5M8 13V3.5M12.5 13V6.5" stroke-width="2.6"/>'),
  c_area: svg('0 0 16 16', '<path d="M2 12.5l3.5-4.5 3 2 5.5-6.5v7z" fill="currentColor" fill-opacity=".28"/><path d="M2 12.5l3.5-4.5 3 2 5.5-6.5"/>'),
  c_combo: svg('0 0 16 16', '<path d="M4 13V9M8 13V6M12 13V8" stroke-width="2.4" stroke-opacity=".4"/><path d="M2 9.5l3-3 3 1.5 6-4.5"/>'),
  archive: svg('0 0 16 16', '<rect x="2" y="3" width="12" height="3.2" rx=".8"/><path d="M3.2 6.2V12a1 1 0 001 1h7.6a1 1 0 001-1V6.2M6.5 9h3"/>'),
  unarchive: svg('0 0 16 16', '<rect x="2" y="3" width="12" height="3.2" rx=".8"/><path d="M3.2 6.2V12a1 1 0 001 1h7.6a1 1 0 001-1V6.2M8 11.2V8M6.4 9.5L8 7.9l1.6 1.6"/>')
};

let which = 'all', range = '1Y', year = today().getFullYear(), starts = {}, gpts = [], gW = 640, gH = 250;
let curDay = dk(today()), addPri = 'med', keepFocus = null, dragId = null;
const isDone = (id, k) => !!(state.log[id] && state.log[id][k]);
const byId = id => state.habits.find(h => h.id === id);
// Main = the one habit you care about most (worth 50). A habit's past Main days keep their Main value after Main moves on.
const isMain = h => !!(h.mains && h.mains.length && h.mains[h.mains.length - 1].to == null);
const curPri = h => isMain(h) ? 'main' : h.priority;
const inMain = (h, k) => (h.mains || []).some(r => k >= r.from && (r.to == null || k < r.to));
const baseOn = (h, k) => BASE[inMain(h, k) ? 'main' : h.priority];
const isArchived = h => !!(h.pauses && h.pauses.length && h.pauses[h.pauses.length - 1].to == null);
// A day is tracked only from the day the habit was created, and not while it is archived.
const isActiveOn = (h, k) => k >= starts[h.id] && !(h.pauses || []).some(r => k >= r.from && (r.to == null || k < r.to));
const chartW = e => Math.max(300, Math.round(e && e.clientWidth) || 640);   // charts are drawn at their real pixel width
