/* Gonflette Party : musique d'ambiance procédurale (WebAudio, aucun fichier audio).
   🏖️ plage : surf-rock (guitare « twang » pincée dans une grosse réverbe, batterie légère, vagues).
   🏋️ salle : synthwave de salle de sport (basse en arpèges, kick 4 temps, nappe).
   🥊 ring  : ambiance d'arène (murmure de foule, « ooooh » et ovations de temps en temps, orgue au lancement d'un match).
   - Démarre au premier geste (exigence des navigateurs), volume bas par défaut, 🔊/🔇 mémorisé sur l'appareil (kit).
   - Fondu enchaîné au changement de lieu ; baissée pendant l'écran « C'est parti », coupée pendant les jeux
     (ils ont leurs propres sons), reprise au retour au lobby. Suspendue quand l'onglet est caché.
   - Pour la couper complètement : retirer <script src="core/ambiance.js"> de index.html. */
(() => {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
const K = G.kit;
if (!K) return;
const VOL = .2;                      // volume de la musique (sur 1), volontairement bas
const XF = 1.4;                      // durée du fondu enchaîné (s)

let place = document.body.dataset.theme || "plage";
let inGame = false, duck = false, master = null, rev = null, cur = null, timer = null;
const log = [];
const note = (what) => { log.push([Math.round(performance.now()), what]); if (log.length > 80) log.shift(); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- briques sonores ---------- */
function impulse(c, sec, decay) {
  const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dcy); }
function kick(c, out, t, v) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
  env(g, t, .004, v, .32); o.connect(g).connect(out); o.start(t); o.stop(t + .4);
}
function noiseHit(c, out, t, v, type, f, dur, q) {
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = K.noise(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
  env(g, t, .002, v, dur); s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
function pluck(c, out, send, t, f, v, dur) {
  // guitare « twang » : scie + carré, filtre qui se referme vite, léger vibrato, beaucoup de réverbe
  const o1 = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o1.type = "sawtooth"; o2.type = "square"; o1.frequency.value = f; o2.frequency.value = f * 1.003;
  lfo.frequency.value = 5.5; lg.gain.value = f * .006; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  fl.type = "lowpass"; fl.Q.value = 7; fl.frequency.setValueAtTime(3800, t); fl.frequency.exponentialRampToValueAtTime(700, t + .25);
  env(g, t, .003, v, dur);
  o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); if (send) g.connect(send);
  for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + dur + .1); }
}
function bass(c, out, t, f, v, dur) {
  const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.value = f;
  fl.type = "lowpass"; fl.Q.value = 9; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(260, t + dur);
  env(g, t, .004, v, dur); o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
}
function pad(c, out, send, t, freqs, v, dur) {
  const fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = "lowpass"; fl.frequency.value = 1300; fl.Q.value = 1;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * .35); g.gain.setValueAtTime(v, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  fl.connect(g); g.connect(out); if (send) g.connect(send);
  for (const f of freqs) for (const det of [-8, 7]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + .05); }
}
function organ(c, out, send, t, f, v, dur) {
  const g = c.createGain(); env(g, t, .02, v, dur); g.connect(out); if (send) g.connect(send);
  [[1, 1], [2, .6], [3, .35], [4, .3], [8, .12]].forEach(([h, a]) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * h; og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + dur + .05); });
}
// boucle de bruit filtré dont le volume ondule (vagues, foule)
function noiseBed(c, out, type, f, q, v, lfoHz, depth) {
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  s.buffer = K.noise(); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.value = v; lfo.frequency.value = lfoHz; lg.gain.value = v * depth; lfo.connect(lg).connect(g.gain);
  s.connect(fl).connect(g).connect(out); s.start(); lfo.start();
  return () => { try { s.stop(); lfo.stop(); } catch (e) {} };
}

/* ---------- les trois musiques ----------
   Chaque piste : {bpm, start(c, out, send) → arrêt des boucles continues, step(c, out, send, i, t)} (i = double-croche). */
const TRACKS = {
  plage: {
    bpm: 132,
    start(c, out) { const a = noiseBed(c, out, "lowpass", 520, .7, .16, .11, .8), b = noiseBed(c, out, "bandpass", 2400, .6, .025, .17, .9); return () => { a(); b(); }; },
    step(c, out, send, i, t) {
      const bar = Math.floor(i / 16) % 4, s = i % 16;
      const roots = [52, 57, 59, 57]; // Mi, La, Si, La : surf !
      const r = roots[bar], tri = [0, 4, 7, 12, 7, 4, 0, 7];
      if (s % 2 === 0) pluck(c, out, send, t, mtof(r + tri[(s / 2) % 8]), .1, .32);
      if (bar === 3 && s >= 12) pluck(c, out, send, t, mtof(r + 12 + (s % 2 ? 3 : 0)), .07, .12); // trémolo de fin de phrase
      if (s === 0 || s === 8 || s === 10) kick(c, out, t, .32);
      if (s === 4 || s === 12) noiseHit(c, out, t, .09, "highpass", 1800, .12);
      if (s % 2 === 0) noiseHit(c, out, t, s % 4 ? .03 : .045, "highpass", 7500, .04);
    }
  },
  salle: {
    bpm: 112,
    start() { return () => {}; },
    step(c, out, send, i, t) {
      const bar = Math.floor(i / 16) % 4, s = i % 16;
      const roots = [45, 41, 48, 43]; // La m, Fa, Do, Sol
      const r = roots[bar];
      if (s % 4 === 0) kick(c, out, t, .5);
      if (s === 4 || s === 12) { noiseHit(c, out, t, .11, "bandpass", 1800, .18, .7); noiseHit(c, send, t, .06, "bandpass", 1800, .25, .7); }
      if (s % 4 === 2) noiseHit(c, out, t, .05, "highpass", 8000, .05);
      bass(c, out, t, mtof(r - 12 + (s % 2 ? 12 : 0) + (s % 8 === 6 ? 7 : 0)), .13, .16);
      if (s === 0) pad(c, out, send, t, [mtof(r + 12), mtof(r + 15 + (bar === 1 || bar === 2 ? 1 : 0)), mtof(r + 19)], .035, 60 / 112 * 4);
      if (s % 4 === 3 && bar % 2 === 1) pluck(c, out, send, t, mtof(r + 24 + [0, 7, 12, 7][s >> 2]), .03, .2); // arpège aigu
    }
  },
  ring: {
    bpm: 60,
    start(c, out) {
      const a = noiseBed(c, out, "bandpass", 420, .8, .14, .07, .5), b = noiseBed(c, out, "bandpass", 1100, 1.2, .05, .13, .7), d = noiseBed(c, out, "lowpass", 220, .7, .1, .05, .4);
      return () => { a(); b(); d(); };
    },
    // une case = une double-croche à 60 bpm (0,25 s) : de temps en temps, une clameur
    step(c, out, send, i, t) {
      if (i % 4 !== 0 || Math.random() > .09) return;
      if (Math.random() < .55) ooh(c, out, send, t); else cheer(c, out, send, t);
    }
  }
};
function ooh(c, out, send, t) {
  // « ooooh » de foule : bruit passé dans deux formants « ou », qui monte puis retombe
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .5); g.gain.exponentialRampToValueAtTime(.0001, t + 2.2);
  g.connect(out); g.connect(send);
  for (const [f, q] of [[340, 6], [820, 8]]) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter();
    s.buffer = K.noise(); fl.type = "bandpass"; fl.Q.value = q;
    fl.frequency.setValueAtTime(f * .85, t); fl.frequency.linearRampToValueAtTime(f * 1.12, t + .6); fl.frequency.linearRampToValueAtTime(f * .8, t + 2.2);
    s.connect(fl).connect(g); s.start(t, Math.random()); s.stop(t + 2.3);
  }
}
function cheer(c, out, send, t) {
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .25); g.gain.exponentialRampToValueAtTime(.0001, t + 2.6);
  g.connect(out); g.connect(send);
  const s = c.createBufferSource(), fl = c.createBiquadFilter(); s.buffer = K.noise(); fl.type = "bandpass"; fl.frequency.value = 1500; fl.Q.value = .6;
  s.connect(fl).connect(g); s.start(t, Math.random()); s.stop(t + 2.7);
  for (let k = 0; k < 2; k++) { // sifflets
    const o = c.createOscillator(), og = c.createGain(), t0 = t + .2 + Math.random() * .8, f = 1800 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(f * 1.25, t0 + .15); o.frequency.linearRampToValueAtTime(f * .9, t0 + .5);
    env(og, t0, .03, .035, .5); o.connect(og).connect(g); o.start(t0); o.stop(t0 + .6);
  }
}

/* ---------- moteur : une piste à la fois, fondu enchaîné ---------- */
function ensure() {
  const c = K.audio(); if (!c) return null;
  if (!master) {
    master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
    rev = c.createConvolver(); rev.buffer = impulse(c, 2.6, 2.4);
    const rg = c.createGain(); rg.gain.value = .5; rev.connect(rg).connect(master);
  }
  return c;
}
const wanted = () => !K.muted() && K.unlocked() && !inGame && !document.hidden;
const level = () => (duck ? VOL * .35 : VOL);
function startTrack(pl) {
  const c = ensure(), T = TRACKS[pl]; if (!c || !T) return null;
  const out = c.createGain(), send = c.createGain();
  out.gain.setValueAtTime(.0001, c.currentTime); out.gain.exponentialRampToValueAtTime(1, c.currentTime + XF);
  send.gain.value = pl === "plage" ? .9 : .5;
  out.connect(master); send.connect(rev); // départ réverbe (la réverbe revient dans le maître)
  const stopBeds = T.start(c, out, send);
  return {pl, out, send, stopBeds, step: 0, next: c.currentTime + .05, spb: 60 / T.bpm / 4, T};
}
function stopTrack(tr, fade) {
  if (!tr) return;
  const c = K.audio(); if (!c) return;
  const t = c.currentTime;
  try { tr.out.gain.cancelScheduledValues(t); tr.out.gain.setValueAtTime(Math.max(.0001, tr.out.gain.value), t); tr.out.gain.exponentialRampToValueAtTime(.0001, t + (fade || XF)); } catch (e) {}
  setTimeout(() => { try { tr.stopBeds(); tr.out.disconnect(); tr.send.disconnect(); } catch (e) {} }, ((fade || XF) + .3) * 1000);
}
function schedule() {
  const c = K.audio(); if (!c || !cur) return;
  while (cur.next < c.currentTime + .25) {
    try { cur.T.step(c, cur.out, cur.send, cur.step, cur.next); } catch (e) {}
    cur.step++; cur.next += cur.spb;
  }
  if (cur.next < c.currentTime - 1) cur.next = c.currentTime + .05; // onglet resté en pause : on ne rattrape pas
}
function setMaster(v, sec) {
  if (!master) return;
  const c = K.audio(); if (!c) return;
  const t = c.currentTime;
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + (sec || .6));
}
// Point unique de décision : joue la bonne piste (ou rien) selon lieu / partie / son coupé.
function sync() {
  if (!wanted()) {
    if (cur) { note("stop " + cur.pl); stopTrack(cur, inGame ? .5 : .8); cur = null; }
    setMaster(0, .5);
    if (timer) { clearInterval(timer); timer = null; }
    return;
  }
  if (!ensure()) return;
  if (!cur || cur.pl !== place) {
    if (cur) { note("xfade " + cur.pl + ">" + place); stopTrack(cur); }
    else note("start " + place);
    cur = startTrack(place);
  }
  setMaster(level(), 1);
  if (!timer) timer = setInterval(schedule, 60);
}

/* ---------- branchements ---------- */
K.on("unlock", sync);
K.on("mute", sync);
K.on("place", p => { if (p && TRACKS[p]) { place = p; sync(); } });
K.on("chosen", d => {
  if (!d || !d.first) return;
  duck = true; sync(); note("duck");
  // le Gala : coup d'orgue « charge ! » au lancement d'un match du ring
  if (d.place === "ring" && wanted()) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + .05, og = c.createGain(); og.gain.value = 1.6; og.connect(master);
    [[67, 0, .16], [72, .17, .16], [76, .34, .16], [79, .51, .3], [76, .85, .14], [79, 1.0, .9]].forEach(([m, dt, du]) => organ(c, og, rev, t + dt, mtof(m), .12, du));
    note("organ");
  }
});
K.on("game:start", () => { inGame = true; duck = false; sync(); });
K.on("game:end", () => { inGame = false; duck = false; setTimeout(sync, 1100); });
K.on("results", () => { duck = false; if (!inGame) sync(); });
document.addEventListener("visibilitychange", sync);
// filet de sécurité : si un événement a été manqué (match annulé…), l'état réel de l'écran fait foi
setInterval(() => {
  const layer = document.getElementById("game-layer");
  const g = !!layer && !layer.classList.contains("hidden");
  if (g !== inGame) { inGame = g; sync(); }
  if (duck && !document.getElementById("countdown")) { duck = false; sync(); } // fin de l'écran « C'est parti » (carte des règles comprise)
}, 1000);

/* ---------- bouton 🔊/🔇 ---------- */
function addButton() {
  const tools = document.querySelector(".topbar .tools"); if (!tools || tools.querySelector("[data-gk-mute]")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip gk-chip"; b.setAttribute("data-gk-mute", "");
  K.syncMuteBtn(b);
  b.addEventListener("click", () => K.setMuted(!K.muted()));
  const ref = document.getElementById("wallet");
  tools.insertBefore(b, ref ? ref.nextSibling : null);
}
addButton();

G.ambiance = {state: () => ({place, playing: !!cur, track: cur ? cur.pl : null, inGame, duck, muted: K.muted(), level: master ? +master.gain.value.toFixed(3) : 0}), log: () => log.slice(), sync};
})();
