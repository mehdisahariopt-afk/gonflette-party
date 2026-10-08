/* Gonflette Party : kit partagé.
   - Bus d'événements du lobby : GONFLETTE.kit.on("chosen" | "count" | "game:start" | "game:end" | "results" | "place" | "unlock" | "mute", fn)
     (index.html appelle kit.emit aux moments clés ; ambiance.js, announcer.js et rules.js s'y abonnent).
   - Sons courts (WebAudio, aucun fichier) : kit.sfx("tap" | "win" | "lose" | "count" | "go" | "whoosh").
   - Vibrations : kit.haptic("light" | "heavy" | "success" | "fail").
   - Style commun des jeux : variables CSS sur .game-root, classes .gk-btn / .gk-title, bandeau de jeu harmonisé
     (emoji du lieu + bouton « ? » des règles), écran « FIN ! » d'une seconde avant les résultats du lobby.
   - Son coupé (🔇) : réglage de l'appareil (localStorage « gonflette-mute »), partagé avec la musique d'ambiance.
   Tout est facultatif : si ce fichier manque, le lobby et les jeux fonctionnent comme avant. */
(() => {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};

/* ---------- bus d'événements ---------- */
const hooks = {};
function on(ev, fn) { (hooks[ev] = hooks[ev] || []).push(fn); return () => { hooks[ev] = (hooks[ev] || []).filter(f => f !== fn); }; }
function emit(ev, d) { for (const fn of (hooks[ev] || []).slice()) { try { fn(d); } catch (e) { console.warn("Gonflette kit :", ev, e); } } }

/* ---------- réglages de l'appareil ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
let muted = store.get("gonflette-mute") === "1";

/* ---------- audio partagé (créé au premier geste : exigence iOS / Chrome) ---------- */
let ctx = null, sfxBus = null, unlocked = false, noiseBuf = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !unlocked) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    sfxBus = ctx.createGain(); sfxBus.gain.value = muted ? 0 : .5; sfxBus.connect(ctx.destination);
  }
  if (ctx.state === "suspended" && unlocked && !document.hidden) { try { ctx.resume().catch(() => {}); } catch (e) {} }
  return ctx;
}
function noise() {
  const c = audio(); if (!c) return null;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function onGesture() {
  const first = !unlocked;
  unlocked = true;
  audio();
  if (first) emit("unlock");
}
for (const t of ["pointerdown", "touchend", "keydown", "click"]) addEventListener(t, onGesture, {capture: true, passive: true});
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  try { if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume(); } catch (e) {}
});

function setMuted(v) {
  muted = !!v; store.set("gonflette-mute", muted ? "1" : "0");
  if (sfxBus) sfxBus.gain.setTargetAtTime(muted ? 0 : .5, ctx.currentTime, .05);
  document.querySelectorAll("[data-gk-mute]").forEach(syncMuteBtn);
  emit("mute", muted);
}
function syncMuteBtn(b) { b.textContent = muted ? "🔇" : "🔊"; b.setAttribute("aria-pressed", String(!muted)); b.title = muted ? "Son coupé (touchez pour remettre la musique)" : "Musique et sons (touchez pour couper)"; b.setAttribute("aria-label", b.title); }

/* ---------- petits sons ---------- */
function tone(c, t, f, dur, type, vol, f2) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  tap(c, t) { tone(c, t, 880, .07, "sine", .35, 520); },
  count(c, t) { tone(c, t, 660, .14, "square", .12); },
  go(c, t) { tone(c, t, 880, .1, "square", .14); tone(c, t + .09, 1320, .35, "square", .14); },
  win(c, t) { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * .09, f, .22, "triangle", .3)); [523, 659, 784].forEach(f => tone(c, t + .4, f * 2, .7, "triangle", .14)); },
  lose(c, t) { [[392, 370], [370, 349], [349, 330], [330, 220]].forEach(([a, b], i) => tone(c, t + i * .32, a, i === 3 ? .8 : .3, "sawtooth", .12, b)); },
  whoosh(c, t) {
    const buf = noise(); if (!buf) return;
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + .35);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .12); g.gain.exponentialRampToValueAtTime(.0001, t + .4);
    s.connect(bp).connect(g).connect(sfxBus); s.start(t); s.stop(t + .45);
  }
};
let sfxCount = 0;
function sfx(name) {
  sfxCount++;
  if (muted) return false;
  const c = audio(), fn = SFX[name];
  if (!c || !fn) return false;
  try { fn(c, c.currentTime + .01); return true; } catch (e) { return false; }
}

/* ---------- vibrations ---------- */
const HAPTIC = {light: 15, heavy: 70, success: [30, 60, 30, 60, 120], fail: [140, 80, 140]};
let hapticLog = [];
function haptic(kind) {
  const p = HAPTIC[kind] || HAPTIC.light;
  hapticLog.push(kind); if (hapticLog.length > 50) hapticLog.shift();
  try { if (navigator.vibrate) return navigator.vibrate(p); } catch (e) {}
  return false;
}

/* ---------- style commun ---------- */
const css = `
.game-root{--gk-ink:#1d1420;--gk-gold:var(--gold,#ffcc33);--gk-accent:var(--accent,#e63946);--gk-good:#3ccf8e;--gk-bad:#ff5a5f;--gk-panel:var(--panel,#231b2b);--gk-text:var(--text,#f5efe6);--gk-dim:var(--dim,#b9aec6);
  --gk-display:"Anton","Impact","Arial Narrow",sans-serif;--gk-ui:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;--gk-radius:14px;--gk-tap:48px;font-family:var(--gk-ui)}
.gk-title{font-family:var(--gk-display,"Anton",Impact,sans-serif);font-weight:400;text-transform:uppercase;letter-spacing:.02em;line-height:1}
.gk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;min-width:48px;padding:10px 18px;font-family:var(--gk-ui,"Barlow Condensed",sans-serif);font-weight:800;font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase;line-height:1.05;color:#1d1420;background:var(--gk-gold,var(--gold,#ffcc33));border:3px solid #1d1420;border-radius:14px;box-shadow:0 4px 0 #1d1420;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .08s,box-shadow .08s,filter .15s;user-select:none;-webkit-user-select:none}
.gk-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #1d1420}
.gk-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
.gk-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:0 4px 0 #1d1420}
.gk-btn.red{background:var(--gk-accent,var(--accent,#e63946));color:#fff}
.gk-btn.good{background:var(--gk-good,#3ccf8e);color:#1d1420}
.gk-btn.alt{background:#ffffff14;color:var(--gk-text,var(--text,#fff));border-color:#ffffff40;box-shadow:none}
.gk-btn.big{min-height:64px;font-size:1.5rem;padding:12px 26px;border-radius:18px}
/* bandeau de jeu harmonisé : emoji du lieu, liseré à la couleur du lieu, boutons ronds de même taille */
.game-top{box-shadow:inset 0 -3px 0 var(--accent)}
.game-top .gk-pe{flex:none;font-size:1.15rem;line-height:1}
.game-top .gk-hb{position:relative;flex:none;width:34px;height:34px;border-radius:10px;border:2px solid var(--line);background:#ffffff14;color:var(--text);font-family:var(--f-display);font-size:1.15rem;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}
.game-top .gk-hb::after,.game-top .game-fs::after{content:"";position:absolute;inset:-6px}
.game-top .game-fs{position:relative}
.game-top .gk-hb:active,.game-top .game-fs:active{transform:scale(.92)}
@media (max-width:860px){.game-top .gk-hb,.game-top .game-fs{width:32px;height:32px;font-size:1.05rem;border-radius:9px}.game-top .gk-pe{font-size:1rem}}
/* « FIN ! » : une seconde entre le jeu et l'écran des résultats */
.gk-fin{position:fixed;inset:0;z-index:260;display:grid;place-items:center;pointer-events:none;background:radial-gradient(circle at 50% 45%,#000a,#000d 70%);animation:gkfin 1s ease-in both}
.gk-fin b{font-family:"Anton","Impact",sans-serif;font-weight:400;font-size:clamp(5rem,30vw,12rem);line-height:1;color:var(--gold,#ffcc33);text-shadow:5px 5px 0 var(--accent,#e63946),10px 10px 0 #1d1420;transform:rotate(-6deg);animation:gkfinb 1s cubic-bezier(.2,1.6,.4,1) both}
.gk-fin small{position:absolute;left:0;right:0;top:calc(50% + clamp(3rem,16vw,6.5rem));text-align:center;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:.2em;text-transform:uppercase;color:#fff}
@keyframes gkfin{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes gkfinb{0%{transform:scale(3) rotate(-20deg);opacity:0}25%{transform:scale(1) rotate(-6deg);opacity:1}85%{transform:scale(1.06) rotate(-6deg)}100%{transform:scale(.9) rotate(-6deg);opacity:0}}
/* boutons du lobby ajoutés par les modules (son, présentateur) */
.chip.gk-chip{min-width:40px;min-height:34px;text-align:center;padding:4px 9px;background:var(--panel);color:var(--text);border-color:var(--line)}
.chip.gk-chip[aria-pressed="false"]{opacity:.65}
`;
function injectCss() {
  if (document.getElementById("gk-css")) return;
  const s = document.createElement("style"); s.id = "gk-css"; s.textContent = css; document.head.appendChild(s);
}
injectCss();

function splash(text, sub, ms) {
  const d = document.createElement("div");
  d.className = "gk-fin"; d.setAttribute("aria-hidden", "true");
  d.innerHTML = `<b>${String(text || "FIN !").replace(/[&<>]/g, "")}</b>${sub ? `<small>${String(sub).replace(/[&<>]/g, "")}</small>` : ""}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms || 1000);
  return d;
}

/* ---------- bandeau de jeu : emoji du lieu + bouton « ? » ---------- */
let curGame = null, lastGameEnd = 0;
function headerInit() {
  const top = document.querySelector(".game-top"); if (!top || top.querySelector(".gk-hb")) return;
  const pe = document.createElement("span"); pe.className = "gk-pe"; pe.setAttribute("aria-hidden", "true");
  top.insertBefore(pe, top.firstChild);
  const hb = document.createElement("button");
  hb.type = "button"; hb.className = "gk-hb"; hb.id = "gk-help"; hb.textContent = "?";
  hb.setAttribute("aria-label", "Règles du jeu"); hb.title = "Règles du jeu";
  hb.addEventListener("click", () => { if (curGame && G.rules) G.rules.open(curGame); });
  const fs = top.querySelector(".game-fs");
  top.insertBefore(hb, fs || null);
}
// Ajoute au `api` de chaque jeu : sfx, haptic, rules (appelé par le lobby juste avant create(api)).
function extendApi(api, def, M) {
  api.sfx = sfx; api.haptic = haptic;
  api.rules = () => { if (G.rules) G.rules.open(def.id); };
  curGame = def.id;
  headerInit();
  const info = G.lobby && G.lobby.game ? G.lobby.game(def.id) : null;
  const pe = document.querySelector(".game-top .gk-pe"); if (pe) pe.textContent = info ? info.emoji : "";
  const hb = document.getElementById("gk-help"); if (hb) hb.hidden = !(G.rules && G.rules.has(def.id));
  emit("game:start", {M, def, api});
  return api;
}

/* ---------- réactions communes du lobby ---------- */
on("game:end", () => { lastGameEnd = Date.now(); curGame = null; });
on("chosen", d => { if (d && d.first) { haptic("light"); sfx("whoosh"); } });
on("count", k => { if (k === "go") sfx("go"); else if (/^[123]$/.test(k)) sfx("count"); });
on("results", d => {
  if (!d) return;
  // la partie vient de se terminer sous nos yeux : « FIN ! » 1 s, puis le verdict (son + vibration)
  const fromGame = Date.now() - lastGameEnd < 1500, delay = fromGame ? 950 : 0;
  if (fromGame) { splash("FIN !"); sfx("whoosh"); haptic("heavy"); }
  if (!d.mine || d.int) return;
  setTimeout(() => {
    if (d.won) { sfx("win"); haptic("success"); }
    else if (d.draw) sfx("tap");
    else { sfx("lose"); haptic("fail"); }
    if (d.up > 0) setTimeout(() => haptic("success"), 1300);
  }, delay);
});

G.kit = {on, emit, sfx, haptic, splash, audio, noise, extendApi, store,
  muted: () => muted, setMuted, syncMuteBtn, unlocked: () => unlocked,
  debug: () => ({sfx: sfxCount, haptics: hapticLog.slice(), unlocked, muted, ctx: ctx ? ctx.state : null})};
})();
