'use strict';
/* Movable panels. The right column is a stack of windows (overview, graph, comparison, heatmap). Each one can be dragged by
   its grip (or moved with Alt+↑/↓ while the grip has focus) and collapsed by clicking its title. The order and the collapsed
   set are saved in settings.layout. The habit picker and range tabs stay on top because they control every window. */
const WIDGETS = [
  { id: 'stats', title: 'Overview' },
  { id: 'graph', title: 'Completion' },
  { id: 'compare', title: 'Comparison' },
  { id: 'heat', title: 'Heatmap' }
];
const WIDGET_IDS = WIDGETS.map(w => w.id);
const WTITLE = Object.fromEntries(WIDGETS.map(w => [w.id, w.title]));

/* Always returns a complete, valid layout: unknown ids dropped, duplicates removed, missing windows appended in default order. */
function cleanLayout(l) {
  const order = [], seen = new Set();
  const add = id => { if (WIDGET_IDS.includes(id) && !seen.has(id)) { seen.add(id); order.push(id); } };
  if (l && Array.isArray(l.order)) l.order.forEach(add);
  WIDGET_IDS.forEach(add);
  const collapsed = l && Array.isArray(l.collapsed) ? [...new Set(l.collapsed.filter(id => WIDGET_IDS.includes(id)))] : [];
  return { order, collapsed };
}
const isDefaultLayout = l => l.collapsed.length === 0 && l.order.every((id, i) => id === WIDGET_IDS[i]);

/* ---- actions (every change saves, then repaints) ---- */
function placeWidget(id, targetId, after) {
  if (id === targetId) return;
  const order = state.settings.layout.order.filter(x => x !== id), at = order.indexOf(targetId);
  if (at < 0) return;
  order.splice(at + (after ? 1 : 0), 0, id);
  if (order.join() === state.settings.layout.order.join()) return;
  state.settings.layout.order = order; save(); applyLayout();
}
function shiftWidget(id, dir) {
  const order = state.settings.layout.order, i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return false;
  [order[i], order[j]] = [order[j], order[i]]; save(); applyLayout(); return true;
}
function toggleWidget(id) {
  const c = state.settings.layout.collapsed, i = c.indexOf(id);
  if (i < 0) c.push(id); else c.splice(i, 1);
  save(); applyLayout(); renderCharts();                 // an expanded window may have a new width: redraw the charts
}
function resetLayout() {
  const before = JSON.stringify(state.settings.layout);
  if (isDefaultLayout(state.settings.layout)) return;
  state.settings.layout = cleanLayout(null); save(); applyLayout(); renderCharts();
  toast('Layout reset', () => { state.settings.layout = cleanLayout(JSON.parse(before)); save(); applyLayout(); renderCharts(); });
}

/* ---- DOM ---- */
const widgetEl = id => document.querySelector(`#widgets > .w[data-w="${id}"]`);
function applyLayout() {
  const box = $('widgets'), L = state.settings.layout;
  L.order.forEach(id => { const w = widgetEl(id); if (w) box.appendChild(w); });          // appendChild moves the existing node
  WIDGET_IDS.forEach(id => {
    const w = widgetEl(id), folded = L.collapsed.includes(id), i = L.order.indexOf(id);
    if (!w) return;
    w.classList.toggle('collapsed', folded);
    const fold = w.querySelector('.w-t'); fold.setAttribute('aria-expanded', String(!folded));
    fold.title = folded ? 'Show ' + WTITLE[id] : 'Hide ' + WTITLE[id];
    const g = w.querySelector('.w-grip'); g.dataset.pos = i + 1;
  });
  const rl = $('rl'); if (rl) rl.hidden = isDefaultLayout(L);
}

let wDrag = null;
const clearWMarks = () => document.querySelectorAll('#widgets > .w').forEach(w => w.classList.remove('over-top', 'over-bot'));
function initLayout() {
  state.settings.layout = cleanLayout(state.settings.layout);
  WIDGETS.forEach(({ id, title }) => {
    const w = widgetEl(id); if (!w || w.querySelector('.w-h')) return;
    const head = el('div', 'w-h');
    const grip = el('button', 'w-grip'); grip.innerHTML = ICON.grip; grip.title = 'Drag to move · Alt+↑/↓ with this focused'; grip.setAttribute('aria-label', 'Move ' + title + ' panel');
    const t = el('button', 'w-t', title); t.setAttribute('aria-expanded', 'true');
    const chev = el('span', 'w-chev'); chev.innerHTML = ICON.down; t.appendChild(chev);
    head.append(grip, t); w.insertBefore(head, w.firstChild);

    t.onclick = () => toggleWidget(id);
    grip.onmousedown = () => { w.draggable = true; };
    grip.onmouseup = () => { if (!wDrag) w.draggable = false; };
    grip.onkeydown = e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        if (shiftWidget(id, e.key === 'ArrowUp' ? -1 : 1)) grip.focus();                 // moving the node drops focus: put it back
      }
    };
    w.addEventListener('dragstart', e => {
      if (!w.draggable) return;
      wDrag = id; w.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (x) {} }
    });
    w.addEventListener('dragend', () => { wDrag = null; w.draggable = false; w.classList.remove('dragging'); clearWMarks(); });
    w.addEventListener('dragover', e => {
      if (!wDrag || wDrag === id) return;
      e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const r = w.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
      clearWMarks(); w.classList.add(after ? 'over-bot' : 'over-top');
    });
    w.addEventListener('dragleave', e => { if (!w.contains(e.relatedTarget)) w.classList.remove('over-top', 'over-bot'); });
    w.addEventListener('drop', e => {
      if (!wDrag) return; e.preventDefault();
      const r = w.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2, from = wDrag;
      wDrag = null; clearWMarks(); placeWidget(from, id, after);
    });
  });
  const rl = $('rl'); if (rl) rl.onclick = resetLayout;
  applyLayout();
}
