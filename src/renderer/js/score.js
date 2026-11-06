'use strict';
/* Scoring.  Every completed habit-day earns points:
     base value by priority  (Main 50 · High 30 · Medium 20 · Low 10)
     x streak multiplier     (+10% for each consecutive day, up to x2.0)
   plus a Perfect Day bonus  (+25% of that day's points when every active habit is done).
   Only one habit can be Main at a time. Days earned while a habit was Main keep their Main value after you
   switch Main to another habit; every other priority is read from the habit's current priority. */
const BASE = { main: 50, high: 30, med: 20, low: 10 };
const STREAK_STEP = 0.1, STREAK_CAP = 10, PERFECT = 0.25;
const LEVEL_NAMES = ['Seed', 'Sprout', 'Seedling', 'Sapling', 'Shrub', 'Young Tree', 'Tree', 'Grove', 'Forest', 'Ancient Forest'];
const levelStart = L => 150 * (L - 1) * L;                 // points needed to reach level L  (L2 = 300, L3 = 900, L4 = 1,800 ...)
const fmtN = n => Math.round(n).toLocaleString();

function levelInfo(points) {
  let L = 1; while (points >= levelStart(L + 1)) L++;
  const from = levelStart(L), to = levelStart(L + 1);
  return { level: L, name: LEVEL_NAMES[Math.min(L, LEVEL_NAMES.length) - 1], into: points - from, span: to - from, pct: (points - from) / (to - from) * 100 };
}

/* points per calendar day for a set of habits */
function scoreDays(habits, withBonus) {
  const days = {};
  for (const h of habits) {
    const l = state.log[h.id]; if (!l) continue;
    const keys = Object.keys(l).filter(k => l[k] && isActiveOn(h, k)).sort();
    let prev = null, run = 0;
    for (const k of keys) {
      run = prev && dk(addD(pk(prev), 1)) === k ? run + 1 : 1; prev = k;
      days[k] = (days[k] || 0) + Math.round(baseOn(h, k) * (1 + STREAK_STEP * Math.min(run - 1, STREAK_CAP)));
    }
  }
  if (withBonus) {
    for (const k in days) { const [a, d] = dayCounts(k, state.habits); if (a > 0 && d === a) days[k] += Math.round(days[k] * PERFECT); }
  }
  return days;
}

function scoreSummary(habits, withBonus) {
  const days = scoreDays(habits, withBonus);
  const tk = dk(today()), yr = tk.slice(0, 4), mo = tk.slice(0, 7);
  let day = 0, month = 0, year = 0, life = 0;
  for (const k in days) {
    const v = days[k]; life += v;
    if (k.startsWith(yr)) { year += v; if (k.startsWith(mo)) month += v; if (k === tk) day = v; }
  }
  return { day, month, year, life, ...levelInfo(life) };
}

function renderScore() {
  const s = scoreSummary(scope(), which === 'all');
  $('sc1').innerHTML = fmtN(s.day) + '<small>pts</small>';
  $('sc2').innerHTML = fmtN(s.month) + '<small>pts</small>';
  $('sc3').innerHTML = fmtN(s.year) + '<small>pts</small>';
  $('sc4').textContent = 'Lv ' + s.level;
  $('sc4l').textContent = s.name;
  $('lvlXp').textContent = `${fmtN(s.into)} / ${fmtN(s.span)} XP`;
  $('lvlNext').textContent = 'to Level ' + (s.level + 1);
  $('lvlFill').style.width = s.pct.toFixed(1) + '%';
}
