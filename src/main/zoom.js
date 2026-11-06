'use strict';
/* Auto-fit: the UI is designed for a ~1180x720 window. Whatever size the window is
   (small, maximised, full screen, 4K) it is scaled so that same layout fills it. */
const BASE_W = 1180, BASE_H = 720;
const MIN_FIT = 0.75, MAX_FIT = 2.6;          // automatic scale limits
const MIN_USER = 0.6, MAX_USER = 1.8;         // Ctrl +/- limits

function fitZoom(w, h, user) {
  const fit = Math.min(MAX_FIT, Math.max(MIN_FIT, Math.min(w / BASE_W, h / BASE_H)));
  return Math.min(3, Math.max(0.5, fit * (user || 1)));
}
function stepUser(user, dir) {
  if (dir === 0) return 1;
  return Math.min(MAX_USER, Math.max(MIN_USER, Math.round(user * (dir > 0 ? 1.1 : 1 / 1.1) * 100) / 100));
}
module.exports = { fitZoom, stepUser, BASE_W, BASE_H };
