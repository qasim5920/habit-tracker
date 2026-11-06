'use strict';
/* Tiny synthesized chimes (Web Audio) - no audio files. */
/* ---------- sound: tiny synthesized chimes, no audio files ---------- */
const Snd = {
  ctx: null,
  get() {
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ctx = new AC(); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  tone(f, t, dur, vol) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3600;           // takes the edge off, keeps it soft
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);      // gentle attack, no click
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);     // smooth decay
    g.connect(lp); lp.connect(c.destination);
    [[1, 1], [2.01, 0.16]].forEach(([m, a]) => {             // fundamental + faint bell partial
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.value = f * m; og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
  },
  play(kind) {
    if (!state.settings.sound) return;
    const c = this.get(); if (!c) return;
    const t = c.currentTime + 0.005;
    if (kind === 'done') { this.tone(1318.5, t, 0.5, 0.11); this.tone(1975.5, t + 0.06, 0.4, 0.05); }       // soft "ting"
    else if (kind === 'all') [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, t + i * 0.07, 0.55, 0.08)); // all done today
    else if (kind === 'level') [1318.5, 1568, 1975.5, 2637].forEach((f, i) => this.tone(f, t + i * 0.09, 0.7, 0.085));   // level up
    else if (kind === 'undo') this.tone(784, t, 0.16, 0.05);
    else if (kind === 'add') this.tone(988, t, 0.22, 0.06);
  }
};
