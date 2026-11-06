'use strict';
/* One accent colour drives the whole app. Priorities are shades of it:
   High = darker, Medium = the accent itself, Low = lighter. */
const DEFAULT_ACCENT = '#9db7ff';
const HEXRE = /^#[0-9a-f]{6}$/i;
const ACCENTS = [
  ['Periwinkle', '#9db7ff'], ['Sky', '#6cb6ff'], ['Mint', '#5fd3c4'], ['Green', '#5fd39a'], ['Lime', '#b5e56a'],
  ['Amber', '#f2c879'], ['Coral', '#ff8f84'], ['Rose', '#f59ac0'], ['Lavender', '#b9a5ff'], ['Silver', '#d0d3da']
];
let ACC = null;

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
function computeAccent(hex) {
  const [h, s, l0] = hexToHsl(hex);
  const l = Math.min(0.9, Math.max(0.45, l0));            // keep it visible on the black background
  const main = hslToHex(h, s, l), n = parseInt(main.slice(1), 16);
  return {
    main,
    hi: hslToHex(h, s * 0.7, l * 0.66),                    // darker shade  -> high priority (slightly muted so it stays readable)
    mn: hslToHex(h, Math.min(1, s * 1.1), l * 0.5),                    // deepest shade -> the Main habit
    md: main,                                               // the accent    -> medium priority
    lo: hslToHex(h, s, l + (1 - l) * 0.62),                 // lighter shade -> low priority
    rgb: `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`
  };
}
function applyAccent(hex) {
  ACC = computeAccent(HEXRE.test(hex) ? hex : DEFAULT_ACCENT);
  const st = document.documentElement.style;
  st.setProperty('--acc', ACC.main); st.setProperty('--acc-rgb', ACC.rgb);
  st.setProperty('--mn', ACC.mn); st.setProperty('--hi', ACC.hi); st.setProperty('--md', ACC.md); st.setProperty('--lo', ACC.lo);
}

function markSwatches() {
  const cur = String(state.settings.accent).toLowerCase();
  document.querySelectorAll('#swatches button').forEach(b => {
    const on = b.dataset.c === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
  $('colorInput').value = cur;
}
function setAccent(hex, persist) {
  if (!HEXRE.test(hex)) return;
  state.settings.accent = hex.toLowerCase();
  applyAccent(state.settings.accent); markSwatches();
  if (persist) save();
}
function closePop() { $('colorPop').hidden = true; $('tColor').setAttribute('aria-expanded', 'false'); }

function initTheme() {
  applyAccent(state.settings.accent);
  const box = $('swatches'); box.innerHTML = '';
  for (const [name, hex] of ACCENTS) {
    const b = el('button'); b.dataset.c = hex; b.title = name; b.setAttribute('aria-label', name);
    b.style.background = hex; b.onclick = () => setAccent(hex, true);
    box.appendChild(b);
  }
  $('tColor').onclick = e => {
    e.stopPropagation();
    const open = $('colorPop').hidden; $('colorPop').hidden = !open; $('tColor').setAttribute('aria-expanded', open);
  };
  $('colorPop').onclick = e => e.stopPropagation();
  $('colorInput').addEventListener('input', e => setAccent(e.target.value, false));   // live preview, no disk write
  $('colorInput').addEventListener('change', e => setAccent(e.target.value, true));
  document.addEventListener('click', closePop);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('colorPop').hidden) { closePop(); $('tColor').focus(); } });
  markSwatches();
}
