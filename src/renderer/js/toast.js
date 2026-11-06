'use strict';
/* Bottom toast with an optional Undo action. */
/* ---------- toast with undo ---------- */
let toastTimer = null;
function toast(msg, undo) {
  $('toastTxt').textContent = msg;
  const b = $('toastBtn'); b.hidden = !undo;
  b.onclick = () => { clearTimeout(toastTimer); $('toast').hidden = true; if (undo) undo(); };
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
}
