'use strict';
/* Compact comparison graph: this month vs last month, or this year vs last year.
   Uses the same scope (all habits / selected habit) as the rest of the right-hand panel. */
const MONTH_SHORT = i => new Date(2000, i, 1, 12).toLocaleDateString(undefined, { month: 'short' });
let cpts = [], cinfo = null, cW = 640, cH = 150;

function cmpData(mode) {
  const t = today(), sc = scope(), Y = t.getFullYear(), M = t.getMonth(), D = t.getDate();
  const span = (a, b) => { let A = 0, Dn = 0; for (let d = new Date(a); d <= b; d = addD(d, 1)) { const [x, y] = dayCounts(dk(d), sc); A += x; Dn += y; } return A ? Dn / A * 100 : null; };
  if (mode === 'month') {
    const pStart = new Date(Y, M - 1, 1, 12), pDays = new Date(Y, M, 0).getDate(), cDays = new Date(Y, M + 1, 0).getDate();
    const cum = (start, days) => {                         // running completion % from day 1 of the month
      let A = 0, Dn = 0; const out = [];
      for (let i = 0; i < days; i++) { const [x, y] = dayCounts(dk(addD(start, i)), sc); A += x; Dn += y; out.push(A ? Dn / A * 100 : null); }
      return out;
    };
    const cur = cum(new Date(Y, M, 1, 12), D), prev = cum(pStart, pDays);
    return {
      n: Math.max(cDays, pDays), cur, prev, dots: false,
      labA: MONTH_SHORT(M), labB: MONTH_SHORT(pStart.getMonth()),
      valA: cur[D - 1], valB: prev[Math.min(D, pDays) - 1],             // same number of days elapsed in both months
      xl: i => String(i + 1), ticks: [0, 7, 14, 21, Math.max(cDays, pDays) - 1], head: i => 'Day ' + (i + 1)
    };
  }
  const monthly = (yr, lastM, lastD) => {
    const out = [];
    for (let m = 0; m <= lastM; m++) out.push(span(new Date(yr, m, 1, 12), m === lastM && lastD ? new Date(yr, m, lastD, 12) : new Date(yr, m + 1, 0, 12)));
    return out;
  };
  const pd = Math.min(D, new Date(Y - 1, M + 1, 0).getDate());
  return {
    n: 12, cur: monthly(Y, M, D), prev: monthly(Y - 1, 11, 0), dots: true,
    labA: String(Y), labB: String(Y - 1),
    valA: span(new Date(Y, 0, 1, 12), t), valB: span(new Date(Y - 1, 0, 1, 12), new Date(Y - 1, M, pd, 12)),  // year to date, same period
    xl: i => MONTH_SHORT(i), ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], head: i => MONTH_SHORT(i)
  };
}

function renderCompare() {
  const mode = state.settings.cmp, c = cmpData(mode); cinfo = c;
  $('cmpSel').value = mode;
  const W = chartW($('cchart')), H = 150, L = 34, R = 10, T = 8, B = 20, iw = W - L - R, ih = H - T - B, n = c.n;
  cW = W; cH = H; $('gc').setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ticks = W < 460 ? c.ticks.filter((_, j) => j % 2 === 0) : c.ticks;   // fewer labels when narrow
  const X = i => L + (n > 1 ? i * iw / (n - 1) : iw / 2), Y = v => T + ih * (1 - v / 100);
  let h = '';
  [0, 50, 100].forEach(v => { h += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1b1d23"/><text x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`; });
  ticks.forEach(i => { h += `<text x="${X(i)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${c.xl(i)}</text>`; });
  const path = arr => { let d = '', pen = false; arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; pen = true; }); return d; };
  const dB = path(c.prev), dA = path(c.cur);
  if (dB) h += `<path d="${dB}" fill="none" style="stroke:rgba(var(--acc-rgb),.5)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (dA) h += `<path d="${dA}" fill="none" style="stroke:var(--acc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (c.dots) {
    c.prev.forEach((v, i) => { if (v != null) h += `<circle cx="${X(i)}" cy="${Y(v)}" r="2.4" style="fill:rgba(var(--acc-rgb),.5)"/>`; });
    c.cur.forEach((v, i) => { if (v != null) h += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" style="fill:var(--acc)"/>`; });
  } else {
    for (let i = c.cur.length - 1; i >= 0; i--) if (c.cur[i] != null) { h += `<circle cx="${X(i)}" cy="${Y(c.cur[i])}" r="3" style="fill:var(--acc)"/>`; break; }
  }
  if (!dA && !dB) h += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle">No data yet</text>`;
  h += `<line id="cxc" y1="${T}" y2="${T + ih}" stroke="#2a2d35" display="none"/>`;
  $('gc').innerHTML = h;
  cpts = Array.from({ length: n }, (_, i) => ({ x: X(i), a: c.cur[i], b: c.prev[i], y: c.cur[i] != null ? Y(c.cur[i]) : c.prev[i] != null ? Y(c.prev[i]) : null }));

  const pct = v => v == null ? '—' : Math.round(v) + '%';
  $('lgAt').textContent = `${c.labA} ${pct(c.valA)}`;
  $('lgBt').textContent = `${c.labB} ${pct(c.valB)}`;
  const dl = $('cmpDelta');
  if (c.valA == null || c.valB == null) { dl.textContent = ''; dl.className = ''; }
  else {
    const d = Math.round(c.valA) - Math.round(c.valB);
    dl.textContent = d > 0 ? `▲ ${d} pts` : d < 0 ? `▼ ${-d} pts` : '= same';
    dl.className = d > 0 ? 'up' : '';
  }
}

function initCompare() {
  $('cmpSel').onchange = e => { state.settings.cmp = e.target.value === 'year' ? 'year' : 'month'; save(); renderCompare(); };
  const g = $('gc');
  g.addEventListener('mousemove', e => {
    if (!cpts.length || !cinfo) return;
    const r = g.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * cW;
    let best = 0, bd = 1e9; cpts.forEach((p, i) => { const dd = Math.abs(p.x - vx); if (dd < bd) { bd = dd; best = i; } });
    const p = cpts[best], tip = $('tipC'), pct = v => v == null ? '—' : Math.round(v) + '%';
    tip.style.display = 'block'; tip.style.left = (p.x / cW * 100) + '%'; tip.style.top = ((p.y == null ? cH / 2 : p.y) / cH * 100) + '%';
    tip.innerHTML = `${cinfo.head(best)}<b>${cinfo.labA} ${pct(p.a)}</b><b class="prev">${cinfo.labB} ${pct(p.b)}</b>`;
    const cx = $('cxc'); if (cx) { cx.setAttribute('x1', p.x); cx.setAttribute('x2', p.x); cx.removeAttribute('display'); }
  });
  g.addEventListener('mouseleave', () => { $('tipC').style.display = 'none'; const cx = $('cxc'); if (cx) cx.setAttribute('display', 'none'); });
}
