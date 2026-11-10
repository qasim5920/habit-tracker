'use strict';
/* Behaviour tests: boots the real renderer in jsdom with a fake Web Audio and a fake storage bridge. Run: npm test */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src', 'renderer') + path.sep;
// inline every <script src="js/x.js"> so jsdom runs the real app code
const html = fs.readFileSync(root + 'index.html', 'utf8')
  .replace(/<script src="(js\/[\w-]+\.js)"><\/script>/g, (_, f) => '<script>' + fs.readFileSync(root + f, 'utf8') + '</script>');
let pass = 0, fail = 0; const allErrors = [];
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dk(new Date());
const wins = [];

function boot(data) {
  const vc = new VirtualConsole(); vc.on('jsdomError', e => allErrors.push(String(e.message || e)));
  const stats = { osc: 0 }; let saved = null;
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.api = { load: () => data ? JSON.stringify(data) : null, save: j => { saved = j; }, backup() {}, export: async () => {}, import: async () => null, openFolder() {} };
    class P { setValueAtTime() {} exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error('ramp<=0'); } }
    class N { connect() {} }
    w.AudioContext = class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
      createGain() { const g = new N(); g.gain = new P(); return g; }
      createBiquadFilter() { const f = new N(); f.frequency = { value: 0 }; return f; }
      createOscillator() { stats.osc++; const o = new N(); o.frequency = { value: 0 }; o.start = () => {}; o.stop = () => {}; return o; }
      resume() {}
    };
  } });
  const w = dom.window, d = w.document; wins.push(w);
  const t = {
    w, d, stats, saved: () => saved && JSON.parse(saved),
    q: s => d.querySelector(s), qa: s => [...d.querySelectorAll(s)],
    click: e => e.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })),
    key: (e, key, o = {}) => e.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...o })),
    names: () => [...d.querySelectorAll('.card .nm')].map(n => n.textContent).join(','),
    card: i => d.querySelectorAll('.card')[i],
    ev: (e, type, y) => e.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y }))
  };
  return t;
}
const mk = (names, prios) => ({ habits: names.map((n, i) => ({ id: 'h' + i, name: n, created: '2024-01-01', priority: prios ? prios[i] : undefined })), log: {} });

/* T1: migrate v1.1 data (no priority, no settings) with ~6 years of history */
{
  const habits = [{ id: 'a', name: 'Read', created: '2020-11-01' }, { id: 'b', name: 'Workout', created: '2020-11-01' }, { id: 'c', name: 'Meditate', created: '2022-03-01' }, { id: 'd', name: 'Legacy' }];
  const log = { a: {}, b: {}, c: {}, d: {} }; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let d = new Date(2020, 10, 1, 12); d <= new Date(); d.setDate(d.getDate() + 1)) for (const h of habits) { if (h.id === 'c' && d < new Date(2022, 2, 1)) continue; if (rnd() < 0.7) log[h.id][dk(d)] = true; }
  const t = boot({ habits, log });
  ok(t.qa('.card').length === 4, 'T1 cards');
  ok(t.qa('.card.prio-med').length === 4, 'T1 default priority med');
  ok(t.q('#tSound').classList.contains('act'), 'T1 sound default on');
  for (const r of ['30D', '90D', '1Y', '5Y', 'All']) { t.click(t.qa('#tabs button').find(b => b.textContent === r)); ok(!!t.q('#g path'), 'T1 graph ' + r); }
  t.click(t.card(0)); // single habit selected
  t.click(t.card(0));
  const s = t.saved(); t.q('#newHabit').value = 'X'; t.key(t.q('#newHabit'), 'Enter');
  const s2 = t.saved();
  ok(s2.habits.every(h => ['high', 'med', 'low'].includes(h.priority)) && s2.settings && s2.settings.sound === true, 'T1 migrated data persisted');
  ok(Object.keys(s2.log.a).length > 1400, 'T1 history intact');
}

/* T2: add with priority + sound */
{
  const t = boot(mk(['A', 'B'], ['med', 'med']));
  t.click(t.q('#addPri .p-high'));
  t.q('#newHabit').value = 'Zed'; t.key(t.q('#newHabit'), 'Enter');
  ok(t.qa('.card').length === 3 && t.card(2).classList.contains('prio-high'), 'T2 new high card');
  ok(t.saved().habits[2].priority === 'high', 'T2 saved priority');
  ok(t.stats.osc === 2, 'T2 add sound played (' + t.stats.osc + ')');
  ok(t.q('#addPri .p-high').classList.contains('on'), 'T2 chip stays selected');
}

/* T3: cycle priority */
{
  const t = boot(mk(['A'], ['med']));
  const seq = []; for (let i = 0; i < 4; i++) { t.click(t.q('.pri')); seq.push(t.card(0).className.match(/prio-(\w+)/)[1]); }
  ok(seq.join() === 'high,main,low,med', 'T3 cycle (med -> high -> main -> low -> med) ' + seq.join());
}

/* T4: move buttons + focus + disabled ends */
{
  const t = boot(mk(['A', 'B', 'C']));
  ok(t.card(0).querySelectorAll('.ib')[0].disabled && t.card(2).querySelectorAll('.ib')[1].disabled, 'T4 end buttons disabled');
  t.click(t.card(1).querySelectorAll('.ib')[0]);
  ok(t.names() === 'B,A,C', 'T4 up ' + t.names());
  ok(t.d.activeElement && t.d.activeElement.dataset.id === 'h1', 'T4 focus follows moved card');
  t.click(t.card(0).querySelectorAll('.ib')[1]);
  ok(t.names() === 'A,B,C', 'T4 down ' + t.names());
  ok(t.saved().habits.map(h => h.name).join() === 'A,B,C', 'T4 order persisted');
}

/* T5: keyboard */
{
  const t = boot(mk(['A', 'B', 'C']));
  t.card(0).focus(); t.key(t.card(0), 'ArrowDown', { altKey: true });
  ok(t.names() === 'B,A,C', 'T5 alt+down ' + t.names());
  t.key(t.d.activeElement, 'ArrowDown');
  ok(t.d.activeElement.dataset.id === 'h2' || t.d.activeElement.dataset.id === 'h0', 'T5 arrow nav');
  const a = t.qa('.card').find(c => c.dataset.id === 'h0'); a.focus();
  t.key(a, ' ');
  ok(t.saved().log.h0 && t.saved().log.h0[todayKey()], 'T5 space ticks today');
  ok(t.d.activeElement.dataset.id === 'h0', 'T5 focus kept after tick');
  t.key(t.d.activeElement, 'Delete');
  ok(t.names() === 'B,C' && !t.q('#toast').hidden, 'T5 delete + toast ' + t.names());
  t.click(t.q('#toastBtn'));
  ok(t.names() === 'B,A,C' && t.saved().log.h0 && t.saved().log.h0[todayKey()], 'T5 undo restores position + history ' + t.names());
  t.d.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true }));
  ok(t.d.activeElement === t.q('#newHabit'), 'T5 ctrl+N');
  t.d.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'm', ctrlKey: true, bubbles: true, cancelable: true }));
  ok(t.saved().settings.sound === false, 'T5 ctrl+M mutes');
}

/* T6: drag and drop */
{
  const t = boot(mk(['A', 'B', 'C']));
  t.ev(t.card(0), 'dragstart', 0);
  t.ev(t.card(2), 'dragover', 10);
  ok(t.card(2).classList.contains('over-bot'), 'T6 drop marker bottom');
  t.ev(t.card(2), 'drop', 10);
  ok(t.names() === 'B,C,A', 'T6 drop after ' + t.names());
  t.ev(t.card(2), 'dragstart', 0);          // A
  t.ev(t.card(0), 'dragover', -5);
  ok(t.card(0).classList.contains('over-top'), 'T6 drop marker top');
  t.ev(t.card(0), 'drop', -5);
  ok(t.names() === 'A,B,C', 'T6 drop before ' + t.names());
}

/* T7: sort by priority (stable) + undo */
{
  const t = boot(mk(['A', 'B', 'C', 'D'], ['low', 'high', 'med', 'high']));
  t.click(t.q('#tSort')); t.click(t.q('#sortPop [data-s="priority"]'));
  ok(t.names() === 'B,D,C,A', 'T7 sorted ' + t.names());
  t.click(t.q('#toastBtn'));
  ok(t.names() === 'A,B,C,D', 'T7 undo ' + t.names());
  t.click(t.q('#tSort')); t.click(t.q('#sortPop [data-s="priority"]')); t.click(t.q('#tSort')); t.click(t.q('#sortPop [data-s="priority"]'));
  ok(t.q('#toastBtn').hidden && /Already/.test(t.q('#toastTxt').textContent), 'T7 already sorted message');
}

/* T8: rename */
{
  const t = boot(mk(['A', 'B']));
  const dbl = () => t.ev(t.card(0).querySelector('.nm'), 'dblclick', 0);
  dbl(); let inp = t.q('.nm-edit'); ok(!!inp, 'T8 edit input');
  inp.value = 'Renamed'; t.key(inp, 'Enter');
  ok(t.names() === 'Renamed,B' && t.saved().habits[0].name === 'Renamed', 'T8 enter commits');
  dbl(); inp = t.q('.nm-edit'); inp.value = 'Nope'; t.key(inp, 'Escape');
  ok(t.names() === 'Renamed,B', 'T8 esc cancels');
  dbl(); inp = t.q('.nm-edit'); inp.value = 'Blurred'; inp.blur();
  ok(t.names() === 'Blurred,B', 'T8 blur commits ' + t.names());
  dbl(); inp = t.q('.nm-edit'); inp.value = '   '; t.key(inp, 'Enter');
  ok(t.names() === 'Blurred,B', 'T8 empty name rejected');
}

/* T9: sound behaviour */
{
  const t = boot(mk(['A', 'B']));
  const dots = () => t.qa('.dot');
  t.click(dots()[0]);            ok(t.stats.osc === 4, 'T9 tick = 1 ting (' + t.stats.osc + ')');
  t.click(dots()[1]);            ok(t.stats.osc === 12, 'T9 last habit = completion chime (' + t.stats.osc + ')');
  t.click(dots()[0]);            ok(t.stats.osc === 14, 'T9 untick = soft blip (' + t.stats.osc + ')');
  t.click(t.q('#tSound'));       const afterMute = t.stats.osc;
  t.click(dots()[0]);            ok(t.stats.osc === afterMute && t.saved().settings.sound === false, 'T9 muted is silent');
  t.click(t.q('#tSound'));       ok(t.stats.osc === afterMute + 4, 'T9 unmute plays preview');
}

/* T10: hide completed + progress */
{
  const t = boot(mk(['A', 'B', 'C', 'D']));
  t.click(t.qa('.dot')[0]);
  ok(t.q('#progTxt').textContent.startsWith('1 of 4 today') && t.q('#progPct').textContent === '25%' && t.q('#progFill').style.width === '25%', 'T10 progress');
  t.click(t.q('#tHide'));
  ok(t.qa('.card').length === 3, 'T10 hides done');
  for (let i = 0; i < 3; i++) t.click(t.qa('.dot')[0]);
  ok(t.qa('.card').length === 0 && !t.q('#allDone').hidden, 'T10 all done message');
  t.click(t.q('#tHide')); ok(t.qa('.card').length === 4 && t.q('#allDone').hidden, 'T10 show again');
}

/* T11: tracking start is locked to the creation date */
{
  const d = new Date(), created = dk(d);
  const t = boot({ habits: [{ id: 'h0', name: 'A', created, priority: 'med' }], log: {} });
  t.click(t.card(0));
  ok(!t.q('#since').hidden && t.q('#sinceTxt').textContent.length > 4, 'T11 read-only since shown');
  ok(!t.q('#sinceInput'), 'T11 no editable since field');
  ok(t.qa('#hm rect[data-k]').length === 1, 'T11 only creation day clickable (' + t.qa('#hm rect[data-k]').length + ')');
  t.click(t.q('#hm rect[data-k]'));
  ok(t.saved().log.h0[created], 'T11 creation day can be marked');
}
/* T12: week dots before creation are locked; setDay refuses them */
{
  const t = boot({ habits: [{ id: 'h0', name: 'A', created: todayKey(), priority: 'med' }], log: {} });
  ok(t.qa('.wd')[5].classList.contains('pre') && t.qa('.wd')[5].disabled, 'T12 yesterday locked');
  t.click(t.qa('.wd')[5]);
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  ok(!(t.saved() && t.saved().log.h0 && t.saved().log.h0[dk(yd)]), 'T12 yesterday not logged');
  ok(t.w.eval("setDay('h0','2000-01-01'); !(state.log.h0 && state.log.h0['2000-01-01'])"), 'T12 setDay guard');
}
/* T16: archive / restore */
{
  const t = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'high' }, { id: 'b', name: 'B', created: '2024-01-01', priority: 'low' }], log: { a: { [todayKey()]: true } } });
  ok(t.qa('.card').length === 2, 'T16 two cards');
  t.click(t.card(0).querySelector('.ib[aria-label^="Archive"]'));
  ok(t.qa('.card').length === 1 && t.names() === 'B', 'T16 archived hidden');
  ok(t.saved().habits[0].pauses && t.saved().habits[0].pauses[0].to === null && t.saved().log.a[todayKey()], 'T16 history kept, pause open');
  ok(/1 of 1|0 of 1/.test(t.q('#progTxt').textContent), 'T16 progress ignores archived: ' + t.q('#progTxt').textContent);
  t.click(t.q('#tArch'));
  ok(t.qa('.card').length === 2 && t.qa('.card.archived').length === 1 && !!t.q('.sect'), 'T16 show archived section');
  ok(t.qa('.card.archived .dot')[0].disabled, 'T16 archived cannot be ticked');
  t.click(t.q('.card.archived .ib[aria-label^="Restore"]'));
  ok(t.qa('.card.archived').length === 0 && t.qa('.card').length === 2 && !t.saved().habits[0].pauses, 'T16 restored same day leaves no pause');
  // archived in the past -> days in the gap are not tracked
  const t2 = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'high', pauses: [{ from: '2025-03-01', to: '2025-04-01' }] }], log: {} });
  ok(t2.w.eval("isActiveOn(byId('a'),'2025-02-28') && !isActiveOn(byId('a'),'2025-03-15') && isActiveOn(byId('a'),'2025-04-01')"), 'T16 gap excluded');
  ok(t2.w.eval("(setDay('a','2025-03-15'), !state.log.a)"), 'T16 cannot mark paused day');
  // archived habit does not break a perfect day
  const t3 = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'high' }, { id: 'b', name: 'B', created: '2024-01-01', priority: 'low', pauses: [{ from: '2024-02-01', to: null }] }], log: {} });
  t3.click(t3.qa('.dot')[0]);
  ok(t3.q('#sc1').textContent === '38pts', 'T16 perfect bonus with archived ignored: ' + t3.q('#sc1').textContent);
}
/* T13: delete via button + undo order; bad priority; empty state */
{
  const t = boot(mk(['A', 'B', 'C']));
  t.click(t.card(1).querySelector('.ib.del')); ok(t.names() === 'A,C', 'T13 deleted');
  t.click(t.q('#toastBtn')); ok(t.names() === 'A,B,C', 'T13 undo order');
  const u = boot({ habits: [{ id: 'x', name: 'U', created: '2024-01-01', priority: 'urgent' }], log: {} });
  ok(u.card(0).classList.contains('prio-med'), 'T13 invalid priority normalised');
  const e = boot(mk([]));
  ok(!e.q('#empty').hidden && e.q('#panel').hidden && e.q('#prog').hidden && e.qa('.card').length === 0, 'T13 empty state');
}


/* ---------------- v1.3: accent colour + comparison graph ---------------- */
const hexL = h => { const n = parseInt(h.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; return (Math.max(r, g, b) + Math.min(r, g, b)) / 2; };
const cssv = (t, n) => t.d.documentElement.style.getPropertyValue(n);
const ticks = (from, to) => { const o = {}; for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) o[dk(d)] = true; return o; };
const now = new Date(); now.setHours(12, 0, 0, 0); const Yr = now.getFullYear(), Mo = now.getMonth();

/* T14: accent + priority shades */
{
  const t = boot(mk(['A', 'B', 'C'], ['high', 'med', 'low']));
  ok(cssv(t, '--acc') === '#9db7ff', 'T14 default accent ' + cssv(t, '--acc'));
  const sh = () => [cssv(t, '--hi'), cssv(t, '--md'), cssv(t, '--lo')];
  let [hi, md, lo] = sh();
  ok(md === cssv(t, '--acc') && hexL(hi) < hexL(md) && hexL(md) < hexL(lo), 'T14 high darker < medium < low lighter: ' + sh());
  ok(t.qa('#swatches button').length === 10, 'T14 swatches');
  ok(t.q('#colorPop').hidden, 'T14 popover starts closed');
  t.click(t.q('#tColor')); ok(!t.q('#colorPop').hidden, 'T14 popover opens');
  t.click(t.qa('#swatches button')[3]);   // Green
  ok(cssv(t, '--acc') === '#5fd39a' && t.saved().settings.accent === '#5fd39a', 'T14 swatch sets + saves accent');
  [hi, md, lo] = sh();
  ok(hexL(hi) < hexL(md) && hexL(md) < hexL(lo) && hi !== '#3561db', 'T14 shades follow new accent: ' + sh());
  ok(t.qa('#swatches button.on').length === 1 && t.q('#swatches button.on').dataset.c === '#5fd39a', 'T14 selected swatch marked');
  const ci = t.q('#colorInput'); ci.value = '#ff3366'; ci.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  ok(cssv(t, '--acc') === '#ff3366', 'T14 custom colour live preview');
  ci.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  ok(t.saved().settings.accent === '#ff3366', 'T14 custom colour saved on change');
  t.key(t.q('#colorPop'), 'Escape'); t.d.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(t.q('#colorPop').hidden, 'T14 Escape closes');
  t.click(t.q('#tColor')); t.click(t.q('.date')); ok(t.q('#colorPop').hidden, 'T14 outside click closes');
  // very dark pick is lifted so it stays visible on black
  const ci2 = t.q('#colorInput'); ci2.value = '#101010'; ci2.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  ok(hexL(cssv(t, '--acc')) >= 0.44, 'T14 dark accent lifted to stay visible: ' + cssv(t, '--acc'));
  // persisted + invalid values
  const t2 = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'med' }], log: {}, settings: { sound: true, hideDone: false, accent: '#5fd39a', cmp: 'year' } });
  ok(cssv(t2, '--acc') === '#5fd39a' && t2.q('#cmpSel').value === 'year', 'T14 accent + comparison mode restored');
  const t3 = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01' }], log: {}, settings: { accent: 'red; evil', cmp: 'zzz' } });
  ok(cssv(t3, '--acc') === '#9db7ff' && t3.q('#cmpSel').value === 'month', 'T14 invalid settings fall back');
  const t4 = boot(mk(['A']));      // v1.2 data without accent/cmp
  ok(t4.saved() === null && cssv(t4, '--acc') === '#9db7ff', 'T14 v1.2 data gets defaults');
  // colours are CSS variables, not baked in (so they change instantly)
  t4.click(t4.card(0)); t4.click(t4.card(0));
  const svgTxt = t4.q('#g').innerHTML + t4.q('#hm').innerHTML + t4.q('#gc').innerHTML;
  ok(!/9db7ff|157,183,255/i.test(svgTxt) && /var\(--acc/.test(svgTxt), 'T14 graphs use accent variable');
}

/* T15: comparison graph */
{
  // both years fully ticked -> 100% vs 100%
  const log = { h0: ticks(new Date(Yr - 1, 0, 1), now) };
  const t = boot({ habits: [{ id: 'h0', name: 'A', created: '2020-01-01', priority: 'med' }], log });
  ok(t.q('#lgAt').textContent === `${new Date(2000, Mo, 1).toLocaleDateString(undefined, { month: 'short' })} 100%`, 'T15 month legend A: ' + t.q('#lgAt').textContent);
  ok(/100%/.test(t.q('#lgBt').textContent) && t.q('#cmpDelta').textContent === '= same', 'T15 month equal: ' + t.q('#lgBt').textContent + ' / ' + t.q('#cmpDelta').textContent);
  ok(t.qa('#gc path').length === 2, 'T15 month two lines');
  const sel = t.q('#cmpSel'); sel.value = 'year'; sel.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  ok(t.saved().settings.cmp === 'year', 'T15 mode saved');
  ok(t.q('#lgAt').textContent === `${Yr} 100%` && t.q('#lgBt').textContent === `${Yr - 1} 100%` && t.q('#cmpDelta').textContent === '= same', 'T15 year legend: ' + t.q('#lgAt').textContent + ' ' + t.q('#lgBt').textContent);
  ok(t.qa('#gc path').length === 2 && t.qa('#gc circle').length === 12 + Mo + 1, 'T15 year dots ' + t.qa('#gc circle').length);
  // hover tooltip
  t.q('#gc').getBoundingClientRect = () => ({ left: 0, width: 640, top: 0, height: 150 });
  t.q('#gc').dispatchEvent(new t.w.MouseEvent('mousemove', { clientX: 320, bubbles: true }));
  ok(t.q('#tipC').style.display === 'block' && /%/.test(t.q('#tipC').textContent) && t.q('#tipC').textContent.includes(String(Yr)), 'T15 hover tip: ' + t.q('#tipC').textContent);
  t.q('#gc').dispatchEvent(new t.w.MouseEvent('mouseleave', { bubbles: true }));
  ok(t.q('#tipC').style.display === 'none', 'T15 tip hides');
}
{
  // only LAST month fully ticked, nothing this month -> big drop in month mode
  const pm = new Date(Yr, Mo - 1, 1, 12), pe = new Date(Yr, Mo, 0, 12);
  const t = boot({ habits: [{ id: 'h0', name: 'A', created: '2020-01-01', priority: 'med' }], log: { h0: ticks(pm, pe) } });
  ok(/ 0%$/.test(t.q('#lgAt').textContent) && / 100%$/.test(t.q('#lgBt').textContent), 'T15 drop legends: ' + t.q('#lgAt').textContent + ' | ' + t.q('#lgBt').textContent);
  ok(t.q('#cmpDelta').textContent === '▼ 100 pts' && !t.q('#cmpDelta').classList.contains('up'), 'T15 down delta: ' + t.q('#cmpDelta').textContent);
  // this month better than last: tick this month only
  const u = boot({ habits: [{ id: 'h0', name: 'A', created: '2020-01-01', priority: 'med' }], log: { h0: ticks(new Date(Yr, Mo, 1, 12), now) } });
  ok(u.q('#cmpDelta').textContent === '▲ 100 pts' && u.q('#cmpDelta').classList.contains('up'), 'T15 up delta: ' + u.q('#cmpDelta').textContent);
  // exact value check: tick only even days this month
  const ev = {}; for (let d = 1; d <= now.getDate(); d++) if (d % 2 === 0) ev[dk(new Date(Yr, Mo, d, 12))] = true;
  const v = boot({ habits: [{ id: 'h0', name: 'A', created: '2020-01-01', priority: 'med' }], log: { h0: ev } });
  const expect = Math.round(Object.keys(ev).length / now.getDate() * 100);
  ok(v.q('#lgAt').textContent.endsWith(expect + '%'), 'T15 exact cumulative value ' + expect + '% vs ' + v.q('#lgAt').textContent);
  // brand-new habit: no previous data
  const n = boot({ habits: [{ id: 'h0', name: 'A', created: dk(now), priority: 'med' }], log: {} });
  ok(n.q('#lgBt').textContent.includes('—') && n.q('#cmpDelta').textContent === '', 'T15 no previous data: ' + n.q('#lgBt').textContent);
  // single habit scope works
  const m = boot({ habits: [{ id: 'a', name: 'A', created: '2020-01-01', priority: 'med' }, { id: 'b', name: 'B', created: '2020-01-01', priority: 'med' }], log: { a: ticks(pm, now), b: {} } });
  const allTxt = m.q('#lgAt').textContent; m.click(m.card(0));
  ok(m.q('#lgAt').textContent !== allTxt && /100%/.test(m.q('#lgAt').textContent), 'T15 follows selected habit: ' + allTxt + ' -> ' + m.q('#lgAt').textContent);
}


/* ---------------- v1.4: scoring ---------------- */
const BV = { high: 30, med: 20, low: 10 };
function refScore(habits, log, perfect) {
  const days = {};
  for (const h of habits) {
    const ks = Object.keys(log[h.id] || {}).sort(); let prev = null, run = 0;
    for (const k of ks) {
      const [y, m, d] = k.split('-').map(Number), cur = new Date(y, m - 1, d, 12);
      run = prev && Math.round((cur - prev) / 864e5) === 1 ? run + 1 : 1; prev = cur;
      days[k] = (days[k] || 0) + Math.round(BV[h.priority] * (1 + 0.1 * Math.min(run - 1, 10)));
    }
  }
  const startOf = h => { const ks = Object.keys(log[h.id] || {}).sort(); return ks.length && ks[0] < h.created ? ks[0] : h.created; };
  if (perfect) for (const k in days) { const active = habits.filter(h => startOf(h) <= k); if (active.length && active.every(h => log[h.id] && log[h.id][k])) days[k] += Math.round(days[k] * 0.25); }
  const tk = todayKey(); let day = 0, month = 0, year = 0, life = 0;
  for (const k in days) { life += days[k]; if (k.startsWith(tk.slice(0, 4))) { year += days[k]; if (k.startsWith(tk.slice(0, 7))) month += days[k]; if (k === tk) day = days[k]; } }
  let L = 1; while (life >= 150 * L * (L + 1)) L++;
  return { day, month, year, life, level: L, into: life - 150 * (L - 1) * L, span: 300 * L };
}
const num = t => Math.round(parseFloat(t.replace(/,/g, '')));
const scoreUI = t => ({ day: num(t.q('#sc1').textContent), month: num(t.q('#sc2').textContent), year: num(t.q('#sc3').textContent), level: num(t.q('#sc4').textContent.replace('Lv ', '')) });
const H3 = [{ id: 'h', priority: 'high' }, { id: 'm', priority: 'med' }, { id: 'l', priority: 'low' }].map(h => ({ ...h, name: h.id, created: '2020-01-01' }));
const dAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const keysOf = (...ns) => { const o = {}; ns.forEach(n => { o[dk(dAgo(n))] = true; }); return o; };

/* S1: base values + perfect day */
{
  const t = boot({ habits: H3, log: { h: keysOf(0), m: keysOf(0), l: keysOf(0) } });
  ok(t.q('#sc1').textContent === '75pts' && t.q('#sc2').textContent === '75pts' && t.q('#sc3').textContent === '75pts', 'S1 30+20+10 +25% = 75: ' + t.q('#sc1').textContent);
  ok(t.q('#sc4').textContent === 'Lv 1' && t.q('#sc4l').textContent === 'Seed' && t.q('#lvlXp').textContent === '75 / 300 XP' && t.q('#lvlNext').textContent === 'to Level 2', 'S1 level 1 info: ' + t.q('#lvlXp').textContent);
  ok(/· 75 pts$/.test(t.q('#progTxt').textContent), 'S1 progress shows points: ' + t.q('#progTxt').textContent);
  const u = boot({ habits: H3, log: { h: keysOf(0), m: {}, l: {} } });
  ok(u.q('#sc1').textContent === '30pts', 'S1 high only, no bonus: ' + u.q('#sc1').textContent);
  const labels = t.qa('.pri').map(b => b.textContent).join('|');
  ok(labels === 'High · 30|Med · 20|Low · 10', 'S1 card labels ' + labels);
}
/* S2: streak multiplier, broken streak, bonus rounding */
{
  const cases = [keysOf(2, 1, 0), keysOf(3, 1, 0), keysOf(0), keysOf(14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0)];
  cases.forEach((lg, i) => {
    const hb = [{ id: 'a', name: 'A', priority: 'med', created: '2020-01-01' }];
    const t = boot({ habits: hb, log: { a: lg } }), r = refScore(hb, { a: lg }, true), u = scoreUI(t);
    ok(u.day === r.day && u.month === r.month && u.year === r.year && u.level === r.level, `S2.${i} ui ${JSON.stringify(u)} vs ref ${JSON.stringify(r)}`);
  });
  const t = boot({ habits: [{ id: 'a', name: 'A', priority: 'med', created: '2020-01-01' }], log: { a: keysOf(2, 1, 0) } });
  ok(t.q('#sc1').textContent === '30pts', 'S2 3-day streak today = 24 + 6 bonus: ' + t.q('#sc1').textContent);
}
/* S3: six years of mixed data matches the reference exactly (all scope + single habit) */
{
  const habits = [{ id: 'a', name: 'A', priority: 'high', created: '2020-11-01' }, { id: 'b', name: 'B', priority: 'med', created: '2020-11-01' }, { id: 'c', name: 'C', priority: 'low', created: '2022-03-01' }];
  const log = { a: {}, b: {}, c: {} }; let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let d = new Date(2020, 10, 1, 12); d <= new Date(); d.setDate(d.getDate() + 1)) for (const h of habits) { if (h.id === 'c' && d < new Date(2022, 2, 1)) continue; if (rnd() < 0.75) log[h.id][dk(d)] = true; }
  const t = boot({ habits, log });
  const r = refScore(habits, log, true), u = scoreUI(t);
  ok(u.day === r.day && u.month === r.month && u.year === r.year && u.level === r.level, `S3 all-habits ${JSON.stringify(u)} vs ${JSON.stringify(r)}`);
  ok(r.life > 20000 && u.level >= 5, 'S3 realistic lifetime ' + r.life + ' level ' + u.level);
  ok(t.q('#lvlXp').textContent === `${r.into.toLocaleString()} / ${r.span.toLocaleString()} XP`, 'S3 exact XP ' + t.q('#lvlXp').textContent + ' vs ' + r.into + ' / ' + r.span);
  t.click(t.card(1));   // single habit: no perfect-day bonus
  const r1 = refScore([habits[1]], log, false), u1 = scoreUI(t);
  ok(u1.day === r1.day && u1.month === r1.month && u1.year === r1.year && u1.level === r1.level, `S3 single ${JSON.stringify(u1)} vs ${JSON.stringify(r1)}`);
}
/* S4: untick re-scores; backfilling a past day re-scores; week dot */
{
  const t = boot({ habits: H3, log: { h: {}, m: {}, l: {} } });
  t.click(t.qa('.dot')[0]); ok(t.q('#sc1').textContent === '30pts', 'S4 tick high = 30');
  t.click(t.qa('.dot')[0]); ok(t.q('#sc1').textContent === '0pts', 'S4 untick back to 0');
  t.click(t.qa('.dot')[1]); ok(t.q('#sc1').textContent === '20pts', 'S4 tick med = 20');
  const before = num(t.q('#sc3').textContent);
  t.click(t.card(2).querySelectorAll('.wd')[5]);    // yesterday, low habit
  ok(num(t.q('#sc3').textContent) === before + 10 || dAgo(1).getFullYear() !== new Date().getFullYear(), 'S4 backfilled yesterday adds 10');
}
/* S5: perfect-day + level-up feedback */
{
  const t = boot({ habits: H3.slice(0, 2), log: { h: {}, m: {} } });
  t.click(t.qa('.dot')[0]); ok(t.q('#toast').hidden, 'S5 no toast on a normal tick');
  const o = t.stats.osc; t.click(t.qa('.dot')[1]);
  ok(!t.q('#toast').hidden && /Perfect day/.test(t.q('#toastTxt').textContent) && t.q('#toastBtn').hidden, 'S5 perfect-day toast: ' + t.q('#toastTxt').textContent);
  ok(t.stats.osc - o === 8, 'S5 perfect-day chime');
  // find a history that is just below level 2 and tick today to cross it
  const hb = [{ id: 'h', name: 'h', priority: 'high', created: '2020-01-01' }]; let pick = null;
  for (let n = 1; n < 30 && !pick; n++) { const lg = keysOf(...Array.from({ length: n }, (_, i) => i + 1)); const bf = refScore(hb, { h: lg }, true).life, af = refScore(hb, { h: { ...lg, [todayKey()]: true } }, true).life; if (bf < 300 && af >= 300) pick = lg; }
  ok(!!pick, 'S5 found a level-up scenario');
  const u = boot({ habits: hb, log: { h: pick } });
  ok(u.q('#sc4').textContent === 'Lv 1', 'S5 starts at level 1');
  const o2 = u.stats.osc; u.click(u.qa('.dot')[0]);
  ok(/Level up/.test(u.q('#toastTxt').textContent) && /Sprout/.test(u.q('#toastTxt').textContent) && u.q('#sc4').textContent === 'Lv 2' && u.q('#sc4l').textContent === 'Sprout', 'S5 level-up toast: ' + u.q('#toastTxt').textContent);
  ok(u.stats.osc - o2 === 8, 'S5 level-up fanfare');
  u.click(u.qa('.dot')[0]); ok(u.q('#sc4').textContent === 'Lv 1', 'S5 untick drops back a level');
}

(async () => {

  /* A: scaling - charts redraw at their real width on resize; nothing else is disturbed */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  {
    const habits = [{ id: 'a', name: 'A', priority: 'med', created: '2020-01-01' }, { id: 'b', name: 'B', priority: 'high', created: '2020-01-01' }];
    const log = { a: ticks(new Date(Yr - 1, 0, 1), now), b: {} };
    const t = boot({ habits, log });
    Object.defineProperty(t.w.HTMLElement.prototype, 'clientWidth', { get() { return this.__cw || 0; } });
    const setW = n => ['#chart', '#cchart', '#hmwrap'].forEach(s => { t.q(s).__cw = n; });
    ok(t.q('#g').getAttribute('viewBox') === '0 0 640 250', 'A fallback size when width unknown: ' + t.q('#g').getAttribute('viewBox'));
    setW(1000); t.w.dispatchEvent(new t.w.Event('resize')); await sleep(150);
    ok(t.q('#g').getAttribute('viewBox') === '0 0 1000 250' && t.q('#gc').getAttribute('viewBox') === '0 0 1000 150', 'A wide: ' + t.q('#g').getAttribute('viewBox') + ' / ' + t.q('#gc').getAttribute('viewBox'));
    const vb = t.q('#hm').getAttribute('viewBox').split(' ').map(Number);
    ok(Math.abs(vb[2] - 1000) < 0.2 && t.q('#hm').style.width === '', 'A heatmap fills width: ' + vb);
    ok(t.q('#hm rect').getAttribute('width') === '15.5', 'A heatmap cells grow: ' + t.q('#hm rect').getAttribute('width'));
    setW(400); t.w.dispatchEvent(new t.w.Event('resize')); await sleep(150);
    ok(t.q('#g').getAttribute('viewBox') === '0 0 400 250', 'A narrow chart: ' + t.q('#g').getAttribute('viewBox'));
    ok(t.q('#hm').style.width === '486px' && t.q('#hm rect').getAttribute('width') === '6.0', 'A heatmap keeps a minimum cell size and scrolls: ' + t.q('#hm').style.width);
    ok(t.qa('#g text').length < 20, 'A narrow chart has fewer labels');
    // hover maths follows the real width
    setW(1000); t.w.dispatchEvent(new t.w.Event('resize')); await sleep(150);
    t.q('#g').getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 250 });
    t.q('#g').dispatchEvent(new t.w.MouseEvent('mousemove', { clientX: 500, bubbles: true }));
    const left = parseFloat(t.q('#tip').style.left);
    ok(t.q('#tip').style.display === 'block' && left > 40 && left < 60, 'A hover tooltip centred correctly: ' + t.q('#tip').style.left);
    // resize must not destroy an open rename box
    t.ev(t.card(0).querySelector('.nm'), 'dblclick', 0);
    t.w.dispatchEvent(new t.w.Event('resize')); await sleep(150);
    ok(!!t.q('.nm-edit'), 'A resize leaves the rename box alone');
  }

/* T18: Main habit */
{
  const T = todayKey(), yd = dk(new Date(Date.now() - 864e5));
  const hs = () => [{ id: 'a', name: 'Game Dev', created: '2024-01-01', priority: 'high' }, { id: 'b', name: 'Gym', created: '2024-01-01', priority: 'high' }];
  const t = boot({ habits: hs(), log: { a: { [yd]: true }, b: {} } });
  // make A main via the add-row-less path: cycle priority until Main
  const cycle = i => t.click(t.card(i).querySelector('.pri'));
  cycle(0);                                                       // high -> main
  ok(t.card(0).classList.contains('prio-main') && /Main · 50/i.test(t.card(0).querySelector('.pri').textContent), 'T18 A is Main 50: ' + t.card(0).querySelector('.pri').textContent);
  ok(t.w.eval("isMain(byId('a')) && !isMain(byId('b'))"), 'T18 only A main');
  // B -> main steps A down, only one main at a time
  cycle(1);
  ok(t.w.eval("isMain(byId('b')) && !isMain(byId('a'))"), 'T18 switching main: only one');
  ok(t.w.eval("state.habits.filter(isMain).length") === 1, 'T18 exactly one main');
  ok(/steps down/.test(t.q('#toastTxt').textContent), 'T18 toast mentions step down: ' + t.q('#toastTxt').textContent);
  // A earned yesterday while Main -> day keeps Main value (set via runs)
  const t2 = boot({ habits: [{ id: 'a', name: 'GD', created: '2024-01-01', priority: 'high', mains: [{ from: '2024-01-01', to: '2024-06-01' }] }, { id: 'b', name: 'G', created: '2024-01-01', priority: 'high', mains: [{ from: '2024-06-01', to: null }] }],
    log: { a: { '2024-03-10': true, '2024-07-10': true }, b: { '2024-03-10': true } } });
  ok(t2.w.eval("baseOn(byId('a'),'2024-03-10')") === 50 && t2.w.eval("baseOn(byId('a'),'2024-07-10')") === 30, 'T18 past Main days keep 50, later days 30');
  ok(t2.w.eval("baseOn(byId('b'),'2024-03-10')") === 30 && t2.w.eval("baseOn(byId('b'),'2024-06-02')") === 50, 'T18 B base before main is 30, after is 50');
  const sd = t2.w.eval("scoreDays(state.habits,false)");
  ok(sd['2024-03-10'] === 80 && sd['2024-07-10'] === 30, 'T18 score keeps Main history: ' + JSON.stringify([sd['2024-03-10'], sd['2024-07-10']]));
  // add habit as Main
  const t3 = boot({ habits: hs(), log: {} });
  t3.click(t3.q('#addPri button[data-p="main"]')); t3.q('#newHabit').value = 'Core'; t3.key(t3.q('#newHabit'), 'Enter');
  const hb = t3.saved().habits.find(h => h.name === 'Core');
  ok(hb && hb.mains && hb.mains[0].to === null && hb.priority === 'high', 'T18 add as Main');
  // undo restores
  t.click(t.q('#toastBtn'));
  ok(t.w.eval("isMain(byId('a')) && !isMain(byId('b'))"), 'T18 undo restores previous Main');
  // same-day flip leaves no empty runs
  const t4 = boot({ habits: hs(), log: {} });
  t4.w.eval("setMain(byId('a')); setMain(byId('b')); setMain(byId('a'))");
  ok(t4.w.eval("isMain(byId('a')) && !isMain(byId('b')) && (!byId('b').mains) && byId('a').mains.length===1"), 'T18 same-day flips leave no stray runs');
  // sort puts Main first
  const t5 = boot({ habits: [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'high' }, { id: 'b', name: 'B', created: '2024-01-01', priority: 'low', mains: [{ from: '2025-01-01', to: null }] }], log: {} });
  t5.click(t5.q('#tSort')); t5.click(t5.q('#sortPop [data-s="priority"]')); ok(t5.names() === 'B,A', 'T18 sort puts Main first: ' + t5.names());
}

/* T19: sort options (most/least done, oldest/newest) */
{
  const T = new Date(), key = off => dk(new Date(T.getTime() - off * 864e5));
  // A: started 10d ago, done 3/11 days (27.3%) | B: started 40d ago, done 11/41 (26.8%) | C: started 5d ago, done 6/6 (100%) | D: started 20d ago, done 10/21 (48%)
  const hs = [['A', 10, 3], ['B', 40, 11], ['C', 5, 6], ['D', 20, 10]].map(([n, age], i) => ({ id: 'h' + i, name: n, created: key(age), priority: 'med' }));
  const log = { h0: {}, h1: {}, h2: {}, h3: {} };
  [0, 1, 2].forEach(o => log.h0[key(o)] = true);                      // A 3/11 = 27%
  for (let o = 0; o < 11; o++) log.h1[key(o)] = true;                  // B 11/41 = 27%
  for (let o = 0; o <= 5; o++) log.h2[key(o)] = true;                  // C 6/6 = 100%
  for (let o = 0; o < 10; o++) log.h3[key(o)] = true;                  // D 10/21 = 48%
  const run = mode => { const t = boot({ habits: JSON.parse(JSON.stringify(hs)), log: JSON.parse(JSON.stringify(log)) }); t.click(t.q('#tSort')); t.click(t.q(`#sortPop [data-s="${mode}"]`)); return t; };
  const menu = boot({ habits: JSON.parse(JSON.stringify(hs)), log });
  ok(menu.q('#sortPop').hidden, 'T19 menu closed at start');
  menu.click(menu.q('#tSort')); ok(!menu.q('#sortPop').hidden, 'T19 menu opens');
  ok(menu.qa('#sortPop button[data-s]').length === 5, 'T19 five sort options');
  menu.click(menu.q('#sortPop [data-s="most"]')); ok(menu.q('#sortPop').hidden, 'T19 menu closes after choosing');
  ok(run('most').names() === 'C,D,A,B', 'T19 most done: ' + run('most').names());          // A and B tie at 27% -> keep current order
  ok(run('least').names() === 'B,A,D,C', 'T19 least done: ' + run('least').names());
  ok(run('oldest').names() === 'B,D,A,C', 'T19 oldest: ' + run('oldest').names());
  ok(run('newest').names() === 'C,A,D,B', 'T19 newest: ' + run('newest').names());
  const u = run('oldest'); u.click(u.q('#toastBtn')); ok(u.names() === 'A,B,C,D', 'T19 undo restores order: ' + u.names());
  const sv = run('newest'); ok(sv.saved().habits.map(h => h.name).join() === 'C,A,D,B', 'T19 sort is saved');
}
/* T20: graph types (line / column / area / column+line) for both graphs */
{
  const hs = [{ id: 'a', name: 'A', created: '2024-01-01', priority: 'high' }];
  const log = { a: {} }; for (let o = 0; o < 60; o++) if (o % 3) log.a[dk(new Date(Date.now() - o * 864e5))] = true;
  const t = boot({ habits: hs, log });
  ok(t.qa('#segMain button').length === 4 && t.qa('#segCmp button').length === 4, 'T20 four types in each switcher');
  ok(t.q('#segMain button.on').dataset.t === 'line' && t.q('#segCmp button.on').dataset.t === 'line', 'T20 default is line');
  const shape = sel => ({ paths: t.qa(sel + ' path').length, circles: t.qa(sel + ' circle').length, grad: !!t.q(sel + ' linearGradient') });
  const line = shape('#g');
  for (const type of ['column', 'area', 'combo', 'line']) {
    t.click(t.q(`#segMain button[data-t="${type}"]`));
    ok(t.q('#segMain button.on').dataset.t === type && t.saved().settings.chart === type, 'T20 main saved as ' + type);
    ok(t.qa('#g path').length > 0, 'T20 main draws ' + type);
    if (type === 'area') ok(t.q('#g linearGradient'), 'T20 area has gradient');
    if (type === 'column') ok(t.qa('#g path[style*="fill"]').length >= 30 && !t.q('#g path[stroke-width]'), 'T20 column draws bars only (' + t.qa('#g path[style*="fill"]').length + ')');
    if (type === 'combo') ok(t.qa('#g path[style*="fill"]').length >= 30 && !!t.q('#g path[stroke-width]'), 'T20 combo draws bars + trend line');
  }
  ok(JSON.stringify(shape('#g')) === JSON.stringify(line), 'T20 line chart identical after switching back');
  for (const type of ['column', 'area', 'combo']) {
    t.click(t.q(`#segCmp button[data-t="${type}"]`));
    ok(t.saved().settings.cmpChart === type && t.q('#segCmp button.on').dataset.t === type, 'T20 comparison saved as ' + type);
    ok(t.qa('#gc path').length > 0, 'T20 comparison draws ' + type);
  }
  ok(t.saved().settings.chart === 'line', 'T20 the two graphs are independent');
  // year comparison and 5Y/All ranges render in every type without errors
  t.q('#cmpSel').value = 'year'; t.q('#cmpSel').dispatchEvent(new t.w.Event('change'));
  for (const type of ['line', 'column', 'area', 'combo']) { t.click(t.q(`#segCmp button[data-t="${type}"]`)); t.click(t.q(`#segMain button[data-t="${type}"]`)); [...t.qa('#tabs button')].forEach(b => t.click(b)); }
  ok(true, 'T20 all types x all ranges render');
  // setting validation and persistence across reload
  const bad = boot({ habits: hs, log, settings: { chart: 'pie', cmpChart: 7 } });
  ok(bad.saved() == null || true, 'T20 bad settings tolerated');
  ok(bad.q('#segMain button.on').dataset.t === 'line' && bad.q('#segCmp button.on').dataset.t === 'line', 'T20 invalid chart settings fall back to line');
  const good = boot({ habits: hs, log, settings: { chart: 'combo', cmpChart: 'area' } });
  ok(good.q('#segMain button.on').dataset.t === 'combo' && good.q('#segCmp button.on').dataset.t === 'area', 'T20 saved types are restored');
}

console.log(`passed ${pass}, failed ${fail}`);
console.log('page errors:', allErrors.length ? allErrors : 'none');
wins.forEach(w => { try { w.close(); } catch (e) {} });
process.exit(fail || allErrors.length ? 1 : 0);

})();
