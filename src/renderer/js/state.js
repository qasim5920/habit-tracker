'use strict';
/* Application state, data validation/migration and persistence. */
/* ---------- state & storage ---------- */
const KEY = 'habit-tracker-v1';
const PRI = ['high', 'med', 'low'];
const PLAB = { main: 'Main', high: 'High', med: 'Med', low: 'Low' };
const RANK = { main: -1, high: 0, med: 1, low: 2 };
const CYCLE = ['low', 'med', 'high', 'main'];             // clicking the priority label steps up; after Main it wraps back to Low
let state = { habits: [], log: {}, settings: { sound: true, hideDone: false, accent: DEFAULT_ACCENT, cmp: 'month', showArchived: false } };

function clean(o) {
  if (!o || !Array.isArray(o.habits) || typeof o.log !== 'object' || !o.log) return null;
  o.habits = o.habits.filter(h => h && typeof h.id === 'string' && typeof h.name === 'string');
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  o.habits.forEach(h => {
    if (!PRI.includes(h.priority)) h.priority = 'med';          // v1.0/1.1 data has no priority
    // archiving pauses a habit: pauses = [{from, to}] ('to' null = still archived). Days in a pause are not tracked.
    const p = Array.isArray(h.pauses) ? h.pauses.filter(r => r && DATE.test(r.from) && (r.to == null || DATE.test(r.to))).sort((a, b) => a.from < b.from ? -1 : 1) : [];
    if (p.length) h.pauses = p.map(r => ({ from: r.from, to: r.to == null ? null : r.to })); else delete h.pauses;
    // Main: mains = [{from, to}] runs while this habit was the Main habit ('to' null = it is Main now)
    const m = Array.isArray(h.mains) ? h.mains.filter(r => r && DATE.test(r.from) && (r.to == null || DATE.test(r.to))).sort((a, b) => a.from < b.from ? -1 : 1) : [];
    if (m.length) h.mains = m.map(r => ({ from: r.from, to: r.to == null ? null : r.to })); else delete h.mains;
  });
  // only one habit can be Main: if data somehow has several open runs, the most recent one wins
  const open = o.habits.filter(h => h.mains && h.mains[h.mains.length - 1].to == null).sort((a, b) => a.mains[a.mains.length - 1].from < b.mains[b.mains.length - 1].from ? 1 : -1);
  open.slice(1).forEach(h => { const r = h.mains[h.mains.length - 1]; r.to = open[0].mains[open[0].mains.length - 1].from; if (r.to <= r.from) h.mains.pop(); if (!h.mains.length) delete h.mains; });
  const s = o.settings && typeof o.settings === 'object' ? o.settings : {};
  o.settings = { sound: s.sound !== false, hideDone: s.hideDone === true,
    accent: typeof s.accent === 'string' && HEXRE.test(s.accent) ? s.accent.toLowerCase() : DEFAULT_ACCENT,
    cmp: s.cmp === 'year' ? 'year' : 'month', showArchived: s.showArchived === true };
  return o;
}
try {
  const s = window.api ? window.api.load() : localStorage.getItem(KEY);
  if (s) { const o = clean(JSON.parse(s)); if (o) state = o; }
} catch (e) {}
const save = () => {
  try {
    const j = JSON.stringify(state);
    if (window.api) window.api.save(j); else localStorage.setItem(KEY, j);
  } catch (e) {}
};
