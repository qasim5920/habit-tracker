'use strict';
/* Derived statistics: tracking starts, streaks, completion, graph buckets. */
/* ---------- stats ---------- */
function calcStarts() {
  starts = {}; const t = dk(today());
  for (const h of state.habits) {
    let s = h.created || t; const l = state.log[h.id];
    if (l) for (const k in l) if (k < s) s = k;
    starts[h.id] = s;
  }
}
const scope = () => which === 'all' ? state.habits : state.habits.filter(h => h.id === which);
function dayCounts(k, sc) { let a = 0, d = 0; for (const h of sc) if (isActiveOn(h, k)) { a++; if (isDone(h.id, k)) d++; } return [a, d]; }
const complete = (k, sc) => { const [a, d] = dayCounts(k, sc); return a > 0 && d === a; };
function streakOf(sc) {
  let d = today(); if (!complete(dk(d), sc)) d = addD(d, -1);
  let n = 0; while (complete(dk(d), sc)) { n++; d = addD(d, -1); }
  return n;
}
/* Ambient glow behind a card, 0..1. Nothing before a 3-day streak, then it grows on a log scale to full strength at 30 days
   (3d .15, 7d .46, 14d .72, 30d 1). It is dimmer while today is still unticked, so ticking the habit makes the card brighten. */
function glowOf(streak, doneToday) {
  if (streak < 3) return 0;
  const g = Math.min(1, (Math.log2(streak) - 1) / (Math.log2(30) - 1));
  return g * (doneToday ? 1 : 0.65);
}
function bestOf(sc) {
  if (!sc.length) return 0;
  const first = pk(sc.map(h => starts[h.id]).sort()[0]), t = today(); let best = 0, cur = 0;
  for (let d = first; d <= t; d = addD(d, 1)) { if (complete(dk(d), sc)) { cur++; if (cur > best) best = cur; } else cur = 0; }
  return best;
}
function buckets() {
  const t = today(), sc = scope(), list = [];
  const add = (a, b, lab, tip) => { let A = 0, D = 0; for (let d = new Date(a); d <= b; d = addD(d, 1)) { const [x, y] = dayCounts(dk(d), sc); A += x; D += y; } list.push({ lab, tip, A, D, v: A ? D / A * 100 : null }); };
  const stepped = (n, step) => { for (let i = 0; i < n; i++) { const b = addD(t, -(n - 1 - i) * step), a = addD(b, -(step - 1)); add(a, b, fmt(b, F1), step === 1 ? fmt(b, { weekday: 'short', ...F2 }) : fmt(a, F1) + ' – ' + fmt(b, F2)); } };
  const monthly = from => { let y = from.getFullYear(), m = from.getMonth(); while (new Date(y, m, 1, 12) <= t) { const a = new Date(y, m, 1, 12), e = new Date(y, m + 1, 0, 12); add(a, e > t ? t : e, fmt(a, FM), fmt(a, FML)); if (++m > 11) { m = 0; y++; } } };
  if (range === '30D') stepped(30, 1);
  else if (range === '90D') stepped(30, 3);
  else if (range === '1Y') stepped(52, 7);
  else if (range === '5Y') monthly(new Date(t.getFullYear(), t.getMonth() - 59, 1, 12));
  else {
    const first = sc.length ? pk(sc.map(h => starts[h.id]).sort()[0]) : t, span = (t - first) / 864e5;
    if (span <= 120) stepped(Math.max(2, Math.ceil(span / 7) + 1), 7); else monthly(first);
  }
  return list;
}
