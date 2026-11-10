'use strict';
/* User actions that change data: add/remove/archive habits, priority and Main, ticking days, reordering. */
/* ---------- actions ---------- */
function addHabit() {
  const i = $('newHabit'), n = i.value.trim(); if (!n) return;
  const nh = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, created: dk(today()), priority: addPri === 'main' ? 'high' : addPri };
  state.habits.push(nh);
  let was = null; if (addPri === 'main') was = setMain(nh);
  i.value = ''; Snd.play('add'); save(); render();
  if (was) toast(`“${nh.name}” is now Main. “${was.name}” steps down to ${PLAB[was.priority]}.`);
}
function removeHabit(id) {
  const i = state.habits.findIndex(h => h.id === id); if (i < 0) return;
  const h = state.habits[i], log = state.log[id];
  state.habits.splice(i, 1); delete state.log[id];
  if (which === id) which = 'all';
  save(); render();
  toast(`Deleted “${h.name}”`, () => {
    state.habits.splice(Math.min(i, state.habits.length), 0, h);
    if (log) state.log[id] = log;
    save(); render();
  });
}
function setDay(id, k) {
  const h0 = byId(id);
  if (!h0 || k > dk(today()) || !isActiveOn(h0, k)) return;       // tracking starts the day the habit is created
  const before = scoreSummary(state.habits, true);
  const l = state.log[id] = state.log[id] || {};
  const nowDone = !l[k];
  if (nowDone) l[k] = true; else delete l[k];
  const tk = dk(today());
  const act = state.habits.filter(h => isActiveOn(h, tk));
  const perfect = nowDone && k === tk && act.length > 0 && act.every(h => isDone(h.id, tk));
  const after = scoreSummary(state.habits, true);
  if (nowDone && after.level > before.level) {
    Snd.play('level'); toast(`Level up!  You are now a ${after.name} · Level ${after.level}`);
  } else if (perfect) {
    Snd.play('all'); toast(`Perfect day  ·  +${Math.round(PERFECT * 100)}% bonus`);
  } else Snd.play(nowDone ? 'done' : 'undo');
  save(); render();
}
function reorder(id, targetId, after) {
  if (id === targetId) return;
  const arr = state.habits, i = arr.findIndex(h => h.id === id); if (i < 0) return;
  const [h] = arr.splice(i, 1);
  let j = arr.findIndex(x => x.id === targetId); if (j < 0) { arr.splice(i, 0, h); return; }
  if (after) j++;
  arr.splice(j, 0, h);
  save(); render();
}
function visibleHabits() {
  const tk = dk(today());
  return state.habits.filter(h => !isArchived(h) && !(state.settings.hideDone && isDone(h.id, tk)));
}
function move(id, delta) {
  const vis = visibleHabits().map(h => h.id), i = vis.indexOf(id), t = vis[i + delta];
  if (i < 0 || !t) return;
  keepFocus = id; reorder(id, t, delta > 0);
}
function endMain(h, t) {                                           // close this habit's open Main run (empty runs vanish)
  const r = h.mains && h.mains[h.mains.length - 1]; if (!r || r.to != null) return;
  if (r.from >= t) h.mains.pop(); else r.to = t;
  if (!h.mains.length) delete h.mains;
}
function setMain(h) {                                              // make h the Main habit; whoever was Main steps down
  const t = dk(today()); let was = null;
  for (const o of state.habits) if (o !== h && isMain(o)) { was = o; endMain(o, t); }
  if (isMain(h)) return was;
  const r = h.mains && h.mains[h.mains.length - 1];
  if (r && r.to === t) r.to = null; else (h.mains = h.mains || []).push({ from: t, to: null });
  return was;
}
function setPriority(id, p) {
  const h = byId(id); if (!h || curPri(h) === p) return;
  const snap = JSON.stringify(state.habits.map(x => [x.id, x.priority, x.mains || null]));
  let msg = '';
  if (p === 'main') { const was = setMain(h); msg = was ? `“${h.name}” is now Main. “${was.name}” steps down to ${PLAB[was.priority]}.` : `“${h.name}” is now your Main habit`; }
  else { endMain(h, dk(today())); h.priority = p; }
  save(); render();
  if (msg) toast(msg, () => {
    JSON.parse(snap).forEach(([hid, pr, m]) => { const x = byId(hid); if (!x) return; x.priority = pr; if (m) x.mains = m; else delete x.mains; });
    save(); render();
  });
}
function cyclePriority(id) {
  const h = byId(id); if (!h) return;
  setPriority(id, CYCLE[(CYCLE.indexOf(curPri(h)) + 1) % CYCLE.length]);
}
function archiveHabit(id) {
  const h = byId(id); if (!h || isArchived(h)) return;
  (h.pauses = h.pauses || []).push({ from: dk(today()), to: null });
  save(); render();
  toast(`Archived “${h.name}”`, () => unarchiveHabit(id, true));
}
function unarchiveHabit(id, quiet) {
  const h = byId(id); if (!h || !isArchived(h)) return;
  const t = dk(today()), r = h.pauses[h.pauses.length - 1];
  if (r.from >= t) h.pauses.pop(); else r.to = t;                 // days spent archived are skipped, not counted as misses
  if (!h.pauses.length) delete h.pauses;
  save(); render();
  if (!quiet) toast(`Restored “${h.name}”`);
}
/* Sorting is a one-time reorder (saved, with Undo); you can still drag cards afterwards. Ties keep their current order. */
function donePct(h) {                                     // completion % over the days this habit was tracked
  let a = 0, d = 0; const tk = dk(today());
  for (let day = pk(starts[h.id]), k = dk(day); k <= tk; day = addD(day, 1), k = dk(day)) if (isActiveOn(h, k)) { a++; if (isDone(h.id, k)) d++; }
  return a ? d / a * 100 : 0;
}
const SORTS = {
  priority: { name: 'priority', key: h => RANK[curPri(h)] },
  most: { name: 'most done', key: h => -donePct(h) },
  least: { name: 'least done', key: h => donePct(h) },
  oldest: { name: 'oldest habit', key: h => starts[h.id], str: true },
  newest: { name: 'newest habit', key: h => starts[h.id], str: true, desc: true }
};
function sortHabits(mode) {
  const S = SORTS[mode]; if (!S) return;
  const before = state.habits.map(h => h.id);
  const rows = state.habits.map((h, i) => ({ h, i, k: S.key(h) }));
  rows.sort((x, y) => {
    const c = S.str ? (x.k < y.k ? -1 : x.k > y.k ? 1 : 0) : x.k - y.k;
    return (S.desc ? -c : c) || x.i - y.i;
  });
  const sorted = rows.map(r => r.h);
  if (sorted.every((h, i) => h.id === before[i])) { toast('Already sorted by ' + S.name); return; }
  state.habits = sorted; save(); render();
  toast('Sorted by ' + S.name, () => {
    const rest = state.habits.filter(h => !before.includes(h.id));
    state.habits = before.map(byId).filter(Boolean).concat(rest); save(); render();
  });
}
function startRename(id) {
  const card = document.querySelector(`.card[data-id="${id}"]`), h = byId(id); if (!card || !h) return;
  const nm = card.querySelector('.nm'); if (!nm) return;
  const inp = el('input', 'nm-edit'); inp.value = h.name; inp.maxLength = 60; inp.setAttribute('aria-label', 'Rename habit');
  let finished = false;
  const finish = commit => {
    if (finished) return; finished = true;
    const v = inp.value.trim();
    if (commit && v && v !== h.name) { h.name = v; save(); }
    keepFocus = id; render();
  };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); };
  inp.onblur = () => finish(true);
  inp.onclick = e => e.stopPropagation();
  nm.replaceWith(inp); inp.focus(); inp.select();
}
