'use strict';
/* Window resize handling, event wiring and start-up. */
/* ---------- resize: redraw only the charts at the new real width ---------- */
function renderCharts() {
  if (!state.habits.length) return;
  calcStarts(); const list = buckets();
  renderGraph(list); renderHeat(); renderCompare();
}
let rzTimer = null;
window.addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(renderCharts, 60); });

/* ---------- events ---------- */
$('newHabit').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
$('addPri').onclick = e => { const b = e.target.closest('button'); if (b) { addPri = b.dataset.p; renderTools(); $('newHabit').focus(); } };
$('tSound').onclick = () => { state.settings.sound = !state.settings.sound; save(); renderTools(); Snd.play('done'); };
$('tHide').onclick = () => { state.settings.hideDone = !state.settings.hideDone; save(); render(); };
const sortPop = $('sortPop');
const closeSort = () => { sortPop.hidden = true; $('tSort').setAttribute('aria-expanded', 'false'); };
$('tSort').onclick = () => { const open = sortPop.hidden; closeSort(); if (open) { sortPop.hidden = false; $('tSort').setAttribute('aria-expanded', 'true'); } };
sortPop.onclick = e => { const b = e.target.closest('button[data-s]'); if (b) { closeSort(); sortHabits(b.dataset.s); } };
document.addEventListener('click', e => { if (!sortPop.hidden && !sortPop.contains(e.target) && !e.target.closest('#tSort')) closeSort(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sortPop.hidden) closeSort(); });
$('tArch').onclick = () => { state.settings.showArchived = !state.settings.showArchived; save(); render(); };
$('which').onchange = e => { which = e.target.value; render(); };
$('tabs').onclick = e => { if (e.target.tagName === 'BUTTON') { range = e.target.textContent; render(); } };
$('py').onclick = () => { year--; renderHeat(); };
$('ny').onclick = () => { year++; renderHeat(); };
$('hm').onclick = e => { const k = e.target.dataset && e.target.dataset.k; if (k && which !== 'all') setDay(which, k); };
$('g').addEventListener('mousemove', e => {
  if (!gpts.length) return;
  const r = $('g').getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * gW;
  let best = 0, bd = 1e9; gpts.forEach((p, i) => { const dd = Math.abs(p.x - vx); if (dd < bd) { bd = dd; best = i; } });
  const p = gpts[best], tip = $('tip');
  tip.style.display = 'block'; tip.style.left = (p.x / gW * 100) + '%'; tip.style.top = ((p.y == null ? gH / 2 : p.y) / gH * 100) + '%';
  tip.innerHTML = `${p.p.tip}<b>${p.p.v == null ? '—' : Math.round(p.p.v) + '%'}</b>`;
  const cx = $('cx'), cd = $('cd');
  cx.setAttribute('x1', p.x); cx.setAttribute('x2', p.x); cx.removeAttribute('display');
  if (p.y == null) cd.setAttribute('display', 'none'); else { cd.setAttribute('cx', p.x); cd.setAttribute('cy', p.y); cd.removeAttribute('display'); }
});
$('g').addEventListener('mouseleave', () => { $('tip').style.display = 'none'; const cx = $('cx'), cd = $('cd'); if (cx) cx.setAttribute('display', 'none'); if (cd) cd.setAttribute('display', 'none'); });

document.addEventListener('keydown', e => {
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    if (k === 'n' || k === 'N') { e.preventDefault(); $('newHabit').focus(); return; }
    if (k === 'm' || k === 'M') { e.preventDefault(); $('tSound').click(); return; }
  }
  const c = e.target;
  if (!c || !c.classList || !c.classList.contains('card')) return;   // card shortcuts only while a card itself has focus
  const id = c.dataset.id;
  if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); move(id, k === 'ArrowUp' ? -1 : 1); return; }
  if (k === 'ArrowDown' || k === 'ArrowUp') {
    e.preventDefault(); let s = c;
    do { s = k === 'ArrowDown' ? s.nextElementSibling : s.previousElementSibling; } while (s && !s.classList.contains('card'));
    if (s) s.focus(); return;
  }
  if (k === ' ' || k === 'Enter') { e.preventDefault(); keepFocus = id; setDay(id, dk(today())); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeHabit(id); return; }
  if (k === 'F2') { e.preventDefault(); startRename(id); }
});

if (window.api) {
  $('ex').onclick = () => window.api.export(JSON.stringify(state, null, 2));
  $('im').onclick = async () => {
    const txt = await window.api.import(); if (!txt) return;
    let o = null; try { o = clean(JSON.parse(txt)); } catch (e) {}
    if (!o) { toast('That file is not a valid Habit Tracker backup.'); return; }
    if (!confirm('Replace all current data with this backup? Your current data is saved to a backup file first.')) return;
    window.api.backup('before-import'); state = o; which = 'all'; save(); render();
  };
  $('of').onclick = () => window.api.openFolder();
} else $('foot').hidden = true;

setInterval(() => { const k = dk(today()); if (k !== curDay) { curDay = k; render(); } }, 60000);
initTheme(); initCompare(); initChartSwitchers();
render();
