'use strict';
/* Movable panels. The right side is a grid of windows (overview, graph, comparison, heatmap) that all fit on one screen.
   The order decides the slot: 1 and 2 share the top row, 3 and 4 each get a full-width row. Drag a panel by its grip onto
   another to swap places (or press the arrow keys on a focused grip to move it one slot), and click a title to collapse it.
   The order and the collapsed set are saved in settings.layout. The habit picker and range tabs stay on top because they
   control every panel. */
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
function swapWidgets(a, b) {
  const order = state.settings.layout.order, i = order.indexOf(a), j = order.indexOf(b);
  if (a === b || i < 0 || j < 0) return false;
  [order[i], order[j]] = [order[j], order[i]]; save(); applyLayout(); renderCharts(); return true;
}
function shiftWidget(id, dir) {
  const order = state.settings.layout.order, i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return false;
  [order[i], order[j]] = [order[j], order[i]]; save(); applyLayout(); renderCharts(); return true;
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
  box.style.gridTemplateRows = rowSizes(L);
}
/* Row heights: the top row (slots 1+2) and the two full-width rows share the space by weight. A row whose panels are all
   collapsed shrinks to its title bar and gives its space to the others. */
const ROW_WEIGHT = [1.38, 0.95, 0.92];
function rowSizes(L) {
  const slots = [[0, 1], [2], [3]];
  return slots.map((s, r) => s.every(i => L.collapsed.includes(L.order[i])) ? '34px' : `minmax(0,${ROW_WEIGHT[r]}fr)`).join(' ');
}

let wDrag = null;
const clearWMarks = () => document.querySelectorAll('#widgets > .w').forEach(w => w.classList.remove('drop'));
function initLayout() {
  state.settings.layout = cleanLayout(state.settings.layout);
  WIDGETS.forEach(({ id, title }) => {
    const w = widgetEl(id); if (!w || w.querySelector('.w-h')) return;
    const head = el('div', 'w-h');
    const grip = el('button', 'w-grip'); grip.innerHTML = ICON.grip; grip.title = 'Drag onto another panel to swap · arrow keys when focused'; grip.setAttribute('aria-label', 'Move ' + title + ' panel');
    const t = el('button', 'w-t', title); t.setAttribute('aria-expanded', 'true');
    const chev = el('span', 'w-chev'); chev.innerHTML = ICON.down; t.appendChild(chev);
    head.append(grip, t); w.insertBefore(head, w.firstChild);

    t.onclick = () => toggleWidget(id);
    grip.onmousedown = () => { w.draggable = true; };
    grip.onmouseup = () => { if (!wDrag) w.draggable = false; };
    grip.onkeydown = e => {
      const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft', fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      if (back || fwd) {
        e.preventDefault(); e.stopPropagation();
        if (shiftWidget(id, back ? -1 : 1)) grip.focus();                                // moving the node drops focus: put it back
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
      clearWMarks(); w.classList.add('drop');
    });
    w.addEventListener('dragleave', e => { if (!w.contains(e.relatedTarget)) w.classList.remove('drop'); });
    w.addEventListener('drop', e => {
      if (!wDrag) return; e.preventDefault();
      const from = wDrag; wDrag = null; clearWMarks(); swapWidgets(from, id);
    });
  });
  const rl = $('rl'); if (rl) rl.onclick = resetLayout;
  applyLayout();
  // charts are drawn at their real size, so redraw when the grid changes size (window resize, zoom, collapse)
  if (typeof ResizeObserver !== 'undefined') {
    let queued = false;
    new ResizeObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; renderCharts(); }); }).observe($('widgets'));
  }
}
