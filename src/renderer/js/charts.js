'use strict';
/* Shared chart drawing. Both graphs (completion graph and month/year comparison) can be shown as four chart types,
   each with its own look:
     line    crisp straight line, round markers
     column  rounded columns, shaded by value like the heatmap
     area    smooth curve over a soft accent gradient
     combo   faint columns with a smooth line on top
   Colours always come from the accent CSS variables, so changing the accent repaints every chart. */
const CHART_TYPES = ['line', 'column', 'area', 'combo'];
const CHART_LABEL = { line: 'Line', column: 'Column', area: 'Area', combo: 'Column + line' };
const isBarType = t => t === 'column' || t === 'combo';

/* x position of point i: bar types sit in the middle of equal slots (so bars never touch the axis), others run edge to edge */
const xScale = (type, L, iw, n) => isBarType(type) ? i => L + (i + 0.5) * iw / n : i => L + (n > 1 ? i * iw / (n - 1) : iw / 2);

const f1 = n => n.toFixed(1);
/* [{x,y}|null] -> runs of consecutive points (a null breaks the line) */
function runsOf(pts) { const out = []; let cur = null; pts.forEach(p => { if (!p) { cur = null; return; } if (!cur) { cur = []; out.push(cur); } cur.push(p); }); return out; }
const polyline = run => run.map((p, i) => (i ? 'L' : 'M') + f1(p.x) + ' ' + f1(p.y)).join(' ');

/* smooth curve through the points: monotone cubic (Fritsch-Carlson), so it never overshoots the 0-100 range */
function curve(run) {
  const n = run.length; if (n < 3) return polyline(run);
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = run[i + 1].x - run[i].x; m[i] = (run[i + 1].y - run[i].y) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f1(run[0].x)} ${f1(run[0].y)}`;
  for (let i = 0; i < n - 1; i++) d += ` C${f1(run[i].x + dx[i] / 3)} ${f1(run[i].y + t[i] * dx[i] / 3)} ${f1(run[i + 1].x - dx[i] / 3)} ${f1(run[i + 1].y - t[i + 1] * dx[i] / 3)} ${f1(run[i + 1].x)} ${f1(run[i + 1].y)}`;
  return d;
}
const gradient = id => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--acc);stop-opacity:.4"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>`;
const areaOf = (run, y0, id) => `<path d="${curve(run)} L${f1(run[run.length - 1].x)} ${f1(y0)} L${f1(run[0].x)} ${f1(y0)} Z" fill="url(#${id})"/>`;

/* one rounded-top column. fill is any CSS colour. */
function bar(cx, w, y, y0, fill) {
  const h = Math.max(y0 - y, 1.5), top = y0 - h, r = Math.min(3, w / 2, h);
  const x = cx - w / 2, x2 = cx + w / 2;
  return `<path d="M${f1(x)} ${f1(y0)}V${f1(top + r)}Q${f1(x)} ${f1(top)} ${f1(x + r)} ${f1(top)}H${f1(x2 - r)}Q${f1(x2)} ${f1(top)} ${f1(x2)} ${f1(top + r)}V${f1(y0)}Z" style="fill:${fill}"/>`;
}
const barShade = v => `rgba(var(--acc-rgb),${(0.28 + 0.72 * Math.max(0, Math.min(100, v)) / 100).toFixed(2)})`;   // taller = stronger, like the heatmap

/* centred moving average over the non-empty values (the trend line in the column + line chart) */
function trendOf(vals) {
  const w = Math.max(3, Math.round(vals.length / 8)), half = Math.floor(w / 2);
  return vals.map((v, i) => {
    if (v == null) return null;
    let s = 0, c = 0; for (let j = i - half; j <= i + half; j++) if (vals[j] != null) { s += vals[j]; c++; }
    return s / c;
  });
}
const lastIdx = arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };

/* ---- completion graph: one series --------------------------------------------------------------------------------
   vals: percentages (null = no data). geo: {type, X, Y, y0, iw, n, id} */
function plotSeries(vals, g) {
  const { type, X, Y, y0, iw, n } = g, pts = vals.map((v, i) => v == null ? null : { x: X(i), y: Y(v), v });
  const bw = Math.max(2, Math.min(26, iw / n * 0.62));
  let h = '';
  const endDot = (arr) => { const i = lastIdx(arr); return i < 0 ? '' : `<circle cx="${f1(X(i))}" cy="${f1(Y(arr[i]))}" r="3" style="fill:var(--acc)"/>`; };
  if (type === 'line') {
    runsOf(pts).forEach(r => { h += `<path d="${polyline(r)}" fill="none" style="stroke:var(--acc)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>`; });
    h += endDot(vals);
  } else if (type === 'area') {
    h += gradient(g.id);
    runsOf(pts).forEach(r => { if (r.length > 1) h += areaOf(r, y0, g.id); h += `<path d="${curve(r)}" fill="none" style="stroke:var(--acc)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`; });
    h += endDot(vals);
  } else if (type === 'column') {
    pts.forEach(p => { if (p) h += bar(p.x, bw, p.y, y0, barShade(p.v)); });
  } else {                                                                 // combo: faint columns + smooth trend line
    pts.forEach(p => { if (p) h += bar(p.x, bw, p.y, y0, 'rgba(var(--acc-rgb),.2)'); });
    const tr = trendOf(vals), tp = tr.map((v, i) => v == null ? null : { x: X(i), y: Y(v) });
    runsOf(tp).forEach(r => { h += `<path d="${curve(r)}" fill="none" style="stroke:var(--acc)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`; });
    h += endDot(tr);
  }
  return h;
}

/* ---- comparison graph: current period (solid) vs previous period (soft / dashed) -----------------------------------
   cur, prev: percentage arrays. dots: draw markers (year view has only 12 points). */
function plotCompare(cur, prev, g, dots) {
  const { type, X, Y, y0, iw, n } = g;
  const toPts = arr => arr.map((v, i) => v == null ? null : { x: X(i), y: Y(v), v });
  const cp = toPts(cur), pp = toPts(prev);
  const dash = (arr, w) => runsOf(arr).map(r => `<path d="${type === 'line' ? polyline(r) : curve(r)}" fill="none" style="stroke:rgba(var(--acc-rgb),.5)" stroke-width="${w}" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  let h = '';
  const marks = () => {
    if (dots) {
      pp.forEach(p => { if (p) h += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="2.4" style="fill:rgba(var(--acc-rgb),.5)"/>`; });
      cp.forEach(p => { if (p) h += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="3" style="fill:var(--acc)"/>`; });
    } else { const i = lastIdx(cur); if (i >= 0) h += `<circle cx="${f1(cp[i].x)}" cy="${f1(cp[i].y)}" r="3" style="fill:var(--acc)"/>`; }
  };
  if (type === 'line') {
    h += dash(pp, 1.5);
    runsOf(cp).forEach(r => { h += `<path d="${polyline(r)}" fill="none" style="stroke:var(--acc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; });
    marks();
  } else if (type === 'area') {
    h += gradient(g.id) + dash(pp, 1.5);
    runsOf(cp).forEach(r => { if (r.length > 1) h += areaOf(r, y0, g.id); h += `<path d="${curve(r)}" fill="none" style="stroke:var(--acc)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`; });
    marks();
  } else if (type === 'column') {                                           // side-by-side columns: previous (soft) next to current (solid)
    const bw = Math.max(2, Math.min(16, iw / n * 0.4)), gap = 0.6;
    pp.forEach(p => { if (p) h += bar(p.x - bw / 2 - gap, bw, p.y, y0, 'rgba(var(--acc-rgb),.3)'); });
    cp.forEach(p => { if (p) h += bar(p.x + bw / 2 + gap, bw, p.y, y0, 'var(--acc)'); });
  } else {                                                                  // combo: current as columns, previous period as a dashed line
    const bw = Math.max(2, Math.min(20, iw / n * 0.62));
    cp.forEach(p => { if (p) h += bar(p.x, bw, p.y, y0, 'rgba(var(--acc-rgb),.45)'); });
    h += dash(pp, 1.75);
    if (dots) pp.forEach(p => { if (p) h += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="2.4" style="fill:rgba(var(--acc-rgb),.7)"/>`; });
  }
  return h;
}

/* ---- the small type switcher above each graph ---------------------------------------------------------------------- */
const CHART_SETTING = { segMain: 'chart', segCmp: 'cmpChart' };
function initChartSwitchers() {
  for (const id in CHART_SETTING) {
    const box = $(id), key = CHART_SETTING[id]; box.innerHTML = '';
    CHART_TYPES.forEach(t => {
      const b = el('button'); b.dataset.t = t; b.innerHTML = ICON['c_' + t]; b.title = CHART_LABEL[t]; b.setAttribute('aria-label', CHART_LABEL[t] + ' chart');
      box.appendChild(b);
    });
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b || state.settings[key] === b.dataset.t) return;
      state.settings[key] = b.dataset.t; save(); syncChartSwitchers(); renderCharts();
    };
  }
  syncChartSwitchers();
}
function syncChartSwitchers() {
  for (const id in CHART_SETTING) [...$(id).children].forEach(b => { const on = b.dataset.t === state.settings[CHART_SETTING[id]]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
