'use strict';
/* Right column: habit picker, stats, line graph, heatmap. */
/* ---------- rendering: right panel ---------- */
function renderSel() {
  const s = $('which'); s.innerHTML = '';
  const a = el('option', null, 'All habits'); a.value = 'all'; s.appendChild(a);
  for (const h of state.habits.filter(h => !isArchived(h))) { const o = el('option', null, h.name); o.value = h.id; s.appendChild(o); }
  const old = state.habits.filter(isArchived);
  if (old.length) { const g = document.createElement('optgroup'); g.label = 'Archived'; old.forEach(h => { const o = el('option', null, h.name); o.value = h.id; g.appendChild(o); }); s.appendChild(g); }
  s.value = which;
}
function renderGraph(list) {
  const W = chartW($('chart')), H = 250, L = 34, R = 10, T = 10, B = 26, iw = W - L - R, ih = H - T - B, n = list.length;
  gW = W; gH = H; $('g').setAttribute('viewBox', `0 0 ${W} ${H}`);
  const X = i => L + (n > 1 ? i * iw / (n - 1) : iw / 2), Y = v => T + ih * (1 - v / 100);
  let h = '';
  [0, 50, 100].forEach(v => { h += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1b1d23"/><text x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`; });
  const marks = Math.min(Math.max(3, Math.floor(W / 120)), n);
  for (let j = 0; j < marks; j++) { const i = marks > 1 ? Math.round(j * (n - 1) / (marks - 1)) : 0; h += `<text x="${X(i)}" y="${H - 8}" text-anchor="${j === 0 ? 'start' : j === marks - 1 ? 'end' : 'middle'}">${list[i].lab}</text>`; }
  let d = '', pen = false, last = -1;
  list.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)} `; pen = true; last = i; });
  if (d) h += `<path d="${d}" fill="none" style="stroke:var(--acc)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (last >= 0) h += `<circle cx="${X(last)}" cy="${Y(list[last].v)}" r="3" style="fill:var(--acc)"/>`;
  else h += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle">No data in this range</text>`;
  h += `<line id="cx" y1="${T}" y2="${T + ih}" stroke="#2a2d35" display="none"/><circle id="cd" r="4" fill="#0b0c0f" style="stroke:var(--acc)" stroke-width="1.75" display="none"/>`;
  $('g').innerHTML = h;
  gpts = list.map((p, i) => ({ x: X(i), y: p.v == null ? null : Y(p.v), p }));
}
function renderStats(list) {
  const sc = scope(), A = list.reduce((s, p) => s + p.A, 0), D = list.reduce((s, p) => s + p.D, 0);
  $('s1').innerHTML = streakOf(sc) + '<small>days</small>';
  $('s2').innerHTML = bestOf(sc) + '<small>days</small>';
  $('s3').innerHTML = (A ? Math.round(D / A * 100) : 0) + '<small>%</small>';
  $('s3l').textContent = 'Completion · ' + (range === 'All' ? 'all time' : range);
}
function renderHeat() {
  const Y = year, sc = scope(), single = which !== 'all', tk = dk(today());
  const jan = new Date(Y, 0, 1, 12), off = (jan.getDay() + 6) % 7;
  const cw = chartW($('hmwrap')), P = Math.max(9, cw / 54), C = P - 3;   // 54 week columns fill the available width
  $('hm').setAttribute('viewBox', `0 0 ${(54 * P).toFixed(1)} ${(16 + 7 * P).toFixed(1)}`);
  $('hm').style.width = 54 * P > cw + 1 ? (54 * P).toFixed(0) + 'px' : '';
  let h = '', i = 0;
  for (let d = new Date(jan); d.getFullYear() === Y; d = addD(d, 1), i++) {
    const col = Math.floor((i + off) / 7), row = (i + off) % 7, k = dk(d), x = (col * P).toFixed(1), y = (16 + row * P).toFixed(1);
    if (d.getDate() === 1) h += `<text x="${x}" y="9">${fmt(d, { month: 'short' })}</text>`;
    let fill, attr = '', cur = '';
    if (k > tk) fill = '#0e1013';
    else {
      const [a, dn] = dayCounts(k, sc);
      if (single) { const can = isActiveOn(sc[0], k); fill = dn ? 'var(--acc)' : can ? '#1c1f26' : '#101216'; if (can) { attr = ` data-k="${k}"`; cur = ';cursor:pointer'; } } // only days since the habit was created
      else if (!a) fill = '#101216';
      else fill = dn ? `rgba(var(--acc-rgb),${(0.2 + 0.8 * dn / a).toFixed(2)})` : '#1c1f26';
    }
    h += `<rect x="${x}" y="${y}" width="${C.toFixed(1)}" height="${C.toFixed(1)}" rx="${(C * 0.23).toFixed(1)}" style="fill:${fill}${cur}"${attr}><title>${fmt(d, { weekday: 'short', ...F2 })}</title></rect>`;
  }
  $('hm').innerHTML = h;
  $('yv').textContent = Y;
  $('ny').disabled = Y >= today().getFullYear();
  $('py').disabled = Y <= today().getFullYear() - 10;
  $('hint').textContent = single ? 'Click a day to mark or unmark it' : 'Select a habit to edit its days';
  const since = $('since'); since.hidden = !single;
  if (single && starts[which]) $('sinceTxt').textContent = fmt(pk(starts[which]), F2);   // read-only: tracking starts when the habit is created
}
function render() {
  calcStarts();
  const t = today();
  $('wd').textContent = fmt(t, { weekday: 'long' });
  $('dt').textContent = fmt(t, { day: 'numeric', month: 'long' });
  renderTools(); renderProgress(); renderList();
  if (keepFocus) { const c = document.querySelector(`.card[data-id="${keepFocus}"]`); if (c) c.focus(); keepFocus = null; }
  const has = state.habits.length > 0;
  $('panel').hidden = !has; $('empty').hidden = has;
  if (!has) return;
  renderSel();
  [...$('tabs').children].forEach(b => b.classList.toggle('on', b.textContent === range));
  const list = buckets();
  renderStats(list); renderScore(); renderGraph(list); renderHeat(); renderCompare();
}
