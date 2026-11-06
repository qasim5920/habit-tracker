'use strict';
/* Left column: habit cards, progress bar, toolbar, add row. */
/* ---------- rendering: cards ---------- */
function buildCard(h, idx, count) {
  const tk = dk(today()), on = isDone(h.id, tk);
  const arch = isArchived(h);
  const c = el('div', `card prio-${curPri(h)}${on ? ' done' : ''}${which === h.id ? ' sel' : ''}${arch ? ' archived' : ''}`);
  c.dataset.id = h.id; c.tabIndex = 0; c.setAttribute('role', 'listitem');
  c.setAttribute('aria-label', `${h.name}, ${PLAB[curPri(h)]} priority, ${BASE[curPri(h)]} points, ${arch ? 'archived' : on ? 'done today' : 'not done today'}`);

  const grip = el('button', 'grip'); grip.innerHTML = ICON.grip; grip.tabIndex = -1; grip.title = 'Drag to reorder'; grip.setAttribute('aria-label', 'Drag to reorder');
  if (arch) { grip.style.visibility = 'hidden'; grip.disabled = true; } else grip.onmousedown = () => { c.draggable = true; };
  grip.onclick = e => e.stopPropagation();

  const dot = el('button', 'dot' + (on ? ' on' : '')); dot.innerHTML = ICON.check; dot.setAttribute('aria-label', 'Toggle ' + h.name + ' today');
  dot.onclick = e => { e.stopPropagation(); setDay(h.id, tk); };
  if (arch) dot.disabled = true;

  const main = el('div', 'main'), top = el('div', 'top');
  const nm = el('span', 'nm', h.name); nm.title = 'Double-click to rename';
  nm.ondblclick = e => { e.stopPropagation(); startRename(h.id); };
  const s = streakOf([h]);
  top.append(nm, el('span', 'st', arch ? 'archived' : s > 1 ? s + 'd' : ''));

  const sub = el('div', 'sub'), week = el('div', 'week');
  for (let i = 6; i >= 0; i--) {
    const d = addD(today(), -i), k = dk(d);
    const can = isActiveOn(h, k);                       // days before the habit existed (or while archived) are locked
    const b = el('button', 'wd' + (isDone(h.id, k) ? ' on' : !can ? ' pre' : '') + (i === 0 ? ' today' : ''));
    b.disabled = !can;
    b.title = fmt(d, { weekday: 'long', day: 'numeric', month: 'short' });
    b.setAttribute('aria-label', b.title + (isDone(h.id, k) ? ', done' : ''));
    b.tabIndex = -1;
    b.onclick = e => { e.stopPropagation(); setDay(h.id, k); };
    week.appendChild(b);
  }
  const pri = el('button', 'pri', `${PLAB[curPri(h)]} · ${BASE[curPri(h)]}`); pri.title = `Worth ${BASE[curPri(h)]} points a day (+10% per streak day, up to x2). Click to change priority`; pri.tabIndex = -1;
  pri.onclick = e => { e.stopPropagation(); cyclePriority(h.id); };
  sub.append(week, pri);
  main.append(top, sub);

  const acts = el('div', 'acts');
  const up = el('button', 'ib'); up.innerHTML = ICON.up; up.title = 'Move up (Alt+↑)'; up.setAttribute('aria-label', 'Move up'); up.disabled = arch || idx === 0; up.tabIndex = -1;
  const dn = el('button', 'ib'); dn.innerHTML = ICON.down; dn.title = 'Move down (Alt+↓)'; dn.setAttribute('aria-label', 'Move down'); dn.disabled = arch || idx === count - 1; dn.tabIndex = -1;
  const x = el('button', 'ib del'); x.innerHTML = ICON.x; x.title = 'Delete (Del)'; x.setAttribute('aria-label', 'Delete ' + h.name); x.tabIndex = -1;
  up.onclick = e => { e.stopPropagation(); move(h.id, -1); };
  dn.onclick = e => { e.stopPropagation(); move(h.id, 1); };
  x.onclick = e => { e.stopPropagation(); removeHabit(h.id); };
  const ar = el('button', 'ib'); ar.innerHTML = arch ? ICON.unarchive : ICON.archive; ar.tabIndex = -1;
  ar.title = arch ? 'Restore from archive' : 'Archive'; ar.setAttribute('aria-label', (arch ? 'Restore ' : 'Archive ') + h.name);
  ar.onclick = e => { e.stopPropagation(); if (arch) unarchiveHabit(h.id); else archiveHabit(h.id); };
  acts.append(up, dn, ar, x);

  c.append(grip, dot, main, acts);
  c.onclick = () => { which = which === h.id ? 'all' : h.id; render(); };

  // drag & drop reordering (drag starts from the grip)
  c.addEventListener('dragstart', e => {
    dragId = h.id; c.classList.add('dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', h.id); } catch (_) {} }
  });
  c.addEventListener('dragend', () => { dragId = null; c.draggable = false; clearDragMarks(); c.classList.remove('dragging'); });
  c.addEventListener('dragover', e => {
    if (!dragId || arch || dragId === h.id) return;
    e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const r = c.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    clearDragMarks(); c.classList.add(after ? 'over-bot' : 'over-top');
  });
  c.addEventListener('dragleave', e => { if (!c.contains(e.relatedTarget)) c.classList.remove('over-top', 'over-bot'); });
  c.addEventListener('drop', e => {
    if (!dragId || arch) return; e.preventDefault();
    const r = c.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2, id = dragId;
    dragId = null; clearDragMarks(); keepFocus = id; reorder(id, h.id, after);
  });
  return c;
}
function clearDragMarks() { document.querySelectorAll('.card.over-top,.card.over-bot').forEach(n => n.classList.remove('over-top', 'over-bot')); }

function renderList() {
  const box = $('list'); box.innerHTML = '';
  const vis = visibleHabits();
  vis.forEach((h, i) => box.appendChild(buildCard(h, i, vis.length)));
  const arch = state.settings.showArchived ? state.habits.filter(isArchived) : [];
  if (arch.length) { box.appendChild(el('div', 'sect', 'Archived')); arch.forEach(h => box.appendChild(buildCard(h, 0, 1))); }
  $('allDone').hidden = !(state.settings.hideDone && state.habits.some(h => !isArchived(h)) && !vis.length);
}
function renderProgress() {
  const live = state.habits.filter(h => !isArchived(h)), n = live.length, k = dk(today()), d = live.filter(h => isDone(h.id, k)).length;
  $('prog').hidden = !n;
  $('progTxt').textContent = `${d} of ${n} today · ${fmtN(scoreSummary(state.habits, true).day)} pts`;
  $('progPct').textContent = (n ? Math.round(d / n * 100) : 0) + '%';
  $('progFill').style.width = (n ? d / n * 100 : 0) + '%';
}
function renderTools() {
  const s = state.settings;
  $('tSound').innerHTML = s.sound ? ICON.sndOn : ICON.sndOff;
  $('tSound').classList.toggle('act', s.sound); $('tSound').title = (s.sound ? 'Sound on' : 'Sound off') + ' (Ctrl+M)';
  $('tHide').innerHTML = s.hideDone ? ICON.eyeOff : ICON.eye;
  $('tHide').classList.toggle('act', s.hideDone); $('tHide').title = s.hideDone ? 'Show completed habits' : 'Hide completed habits';
  $('tSort').innerHTML = ICON.sort; $('tColor').innerHTML = ICON.palette;
  const na = state.habits.filter(isArchived).length;
  $('tArch').innerHTML = ICON.archive; $('tArch').classList.toggle('act', !!s.showArchived);
  $('tArch').title = (s.showArchived ? 'Hide archived habits' : 'Show archived habits') + (na ? ` (${na})` : '');
  document.querySelectorAll('#addPri button').forEach(b => { const on = b.dataset.p === addPri; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}
