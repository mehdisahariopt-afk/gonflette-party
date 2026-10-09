/* Gonflette Party : Les Loups-garous de Muscle Beach (5 à 10 joueurs, chacun sur son téléphone, tous dans la même pièce).
   Rôles : Loup-garou (1 jusqu'à 6 joueurs, 2 ensuite), Voyante, Sorcière, Chasseur (6+), Cupidon (7+), Villageois.
   Nuit : TOUS les téléphones vivants montrent le même écran (grille des joueurs + bouton « Valider ») et tout le monde
   doit toucher quelque chose : les rôles agissent, les autres chassent un moustique 🦟. Personne ne peut deviner qui
   agit en regardant qui tapote. Étapes : Cupidon (nuit 1) → Loups (d'accord entre eux) → Voyante → Sorcière → aube.
   Jour : révélation des morts (rôle dévoilé), tir du Chasseur, débat (passable à la majorité « On vote ! »), vote
   (égalité : un second vote entre ex aequo, puis personne). Les morts deviennent des fantômes qui voient tout.
   Victoire : village si plus aucun loup ; loups si loups ≥ autres vivants ; couple mixte (loup + villageois) s'il reste
   seul. Narration vocale (core/announcer.js, bouton 🎙️) sur le téléphone hôte seulement ; texte toujours à l'écran.

   Secrets : tout l'état et toutes les entrées sont visibles de tous les téléphones (présence). Chaque téléphone tire
   une clé secrète et publie sa clé publique Diffie-Hellman (modulo le nombre de Mersenne 2^89-1, BigInt) dans son entrée ;
   l'hôte publie la sienne dans l'état. Chaque joueur reçoit son « pli » (rôle, meute, résultats de la voyante, victime
   pour la sorcière…) chiffré par XOR avec un flux pseudo-aléatoire tiré du secret partagé, tous les plis ayant la même
   longueur ; les actions de nuit des joueurs sont chiffrées de la même façon et ont toutes la même forme. Ce n'est pas de
   la cryptographie sérieuse (et le téléphone hôte voit tout) mais lire les outils développeur ne révèle plus rien.
   Les données secrètes de l'hôte sont publiées chiffrées avec sa propre clé (gardée dans sessionStorage) : partie
   `resumable` si l'hôte recharge la page.
   Tests : window.__lgSpeed = 10 accélère les durées ; en ?mock, window.__lgDbg expose l'état déchiffré du téléphone. */
(function () {
"use strict";

/* ================= RÔLES ================= */
const ROLES = [
  {n: "Villageois", pl: "Villageois", a: "un villageois", e: "🏖️", c: "#7fc4ff", k: "#1f5f99", tag: "Bronze, soulève, vote.",
    d: "Aucun pouvoir, mais une grande gueule : débats, accuse et vote pour démasquer les loups."},
  {n: "Loup-garou", pl: "Loups-garous", a: "un loup-garou", e: "🐺", c: "#ff4d5e", k: "#b3122a", tag: "Il se dope à la pleine lune",
    d: "Chaque nuit, mettez-vous d'accord avec la meute sur une victime. Le jour, joue l'innocent."},
  {n: "Voyante", pl: "Voyantes", a: "la voyante", e: "🔮", c: "#b98bff", k: "#5b2fb0", tag: "Lit l'avenir dans le fond de son shaker",
    d: "Chaque nuit, touche un joueur : ton shaker révèle son vrai rôle. Guide le village sans te faire repérer."},
  {n: "Sorcière", pl: "Sorcières", a: "la sorcière", e: "🧪", c: "#3ccf8e", k: "#127a4f", tag: "Prépare des protéines… ou du poison",
    d: "Tu vois la victime des loups. Une potion de vie pour la sauver, une potion de mort pour éliminer quelqu'un."},
  {n: "Chasseur", pl: "Chasseurs", a: "le chasseur", e: "🎯", c: "#ffb347", k: "#a35a00", tag: "Champion de javelot, ne part jamais seul",
    d: "Quand tu meurs, de nuit comme de jour, tu emportes un joueur de ton choix avec ton javelot."},
  {n: "Cupidon", pl: "Cupidons", a: "Cupidon", e: "💘", c: "#ff7ab8", k: "#b0246a", tag: "Coach en couple",
    d: "La 1re nuit, lie deux joueurs (toi compris). Si l'un meurt, l'autre meurt de chagrin. Un couple loup + villageois gagne s'il reste seul."}
];
// Composition équilibrée : 5 = L V S + 2 vil · 6 = + Chasseur · 7+ = 2 loups + Cupidon
function compo(n) {
  const r = [1, 2, 3];
  if (n >= 7) r.push(1);
  if (n >= 6) r.push(4);
  if (n >= 7) r.push(5);
  while (r.length < n) r.push(0);
  return r;
}
const CAUSE = {w: "Victime des loups", p: "Empoisonné par la sorcière", v: "Éliminé par le village", h: "Javelot du chasseur", l: "Mort de chagrin", q: "A quitté le village"};
const CAUSE_E = {w: "🐺", p: "☠️", v: "🗳️", h: "🎯", l: "💔", q: "🚪"};

/* ================= ILLUSTRATIONS (SVG) ================= */
const INK = "#1d1420";
const fr = (bg) => `<rect x="4" y="4" width="112" height="112" rx="24" fill="${bg}" stroke="${INK}" stroke-width="4"/>`;
const spark = (x, y, s, c) => `<path d="M${x} ${y - s}L${x + s * .3} ${y - s * .3}L${x + s} ${y}L${x + s * .3} ${y + s * .3}L${x} ${y + s}L${x - s * .3} ${y + s * .3}L${x - s} ${y}L${x - s * .3} ${y - s * .3}Z" fill="${c}"/>`;
const ART = [
  // Villageois : parasol, soleil, kettlebell sur le sable
  () => `${fr("#8fd3ff")}<circle cx="92" cy="28" r="12" fill="#ffd23f" stroke="${INK}" stroke-width="3"/>
    <path d="M6 84Q60 72 114 84V96Q114 114 96 114H24Q6 114 6 96Z" fill="#ffd89a"/>
    <path d="M42 34V96" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 50Q42 14 72 50Z" fill="#e63946" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 50Q42 24 52 50Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M70 76a11 10 0 0 1 22 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="81" cy="91" r="15" fill="#3a3550" stroke="${INK}" stroke-width="4"/><path d="M74 86q4-4 9-3" stroke="#8f88b5" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  // Loup-garou : tête de loup en bandeau de sport devant la pleine lune
  () => `${fr("#1b2350")}<circle cx="60" cy="50" r="38" fill="#fff3c4"/><circle cx="34" cy="34" r="4" fill="#e9dca8"/><circle cx="88" cy="40" r="5" fill="#e9dca8"/>
    <path d="M30 54L34 18L52 38H68L86 18L90 54Q92 76 76 92L64 104Q60 108 56 104L44 92Q28 76 30 54Z" fill="#5b5f7a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M37 27L40 41L48 38ZM83 27L80 41L72 38Z" fill="#ff8fa3"/>
    <path d="M33 47Q60 37 87 47L87 55Q60 45 33 55Z" fill="#e63946" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M41 63L54 67L44 72ZM79 63L66 67L76 72Z" fill="#ffd23f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M47 76Q60 70 73 76L68 94Q60 100 52 94Z" fill="#c9cbe0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="60" cy="80" rx="6" ry="4" fill="${INK}"/><path d="M53 92l2 7l2-7M63 92l2 7l2-7" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  // Voyante : shaker de protéines avec un œil dans le liquide
  () => `${fr("#3b2766")}${spark(24, 30, 7, "#fff6a8")}${spark(98, 48, 5, "#fff6a8")}${spark(96, 94, 6, "#d8c2ff")}${spark(22, 88, 4, "#d8c2ff")}
    <rect x="52" y="14" width="16" height="13" rx="3" fill="#8a5cff" stroke="${INK}" stroke-width="4"/>
    <rect x="36" y="26" width="48" height="14" rx="4" fill="#b98bff" stroke="${INK}" stroke-width="4"/>
    <path d="M38 40H82L77 100Q76 106 70 106H50Q44 106 43 100Z" fill="#e8f3ff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M41 60H79L77 99Q76 103 70 103H50Q44 103 43 99Z" fill="#8a5cff"/>
    <path d="M46 80Q60 66 74 80Q60 94 46 80Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="80" r="6" fill="${INK}"/><circle cx="62" cy="78" r="2" fill="#fff"/>
    <path d="M44 46V56" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  // Sorcière : fiole de protéine (vie) et fiole de poison (mort)
  () => `${fr("#173d33")}<circle cx="60" cy="22" r="4" fill="#3ccf8e" opacity=".6"/><circle cx="70" cy="14" r="3" fill="#9b5de5" opacity=".7"/>
    <rect x="30" y="31" width="14" height="22" fill="#e8fff4" stroke="${INK}" stroke-width="4"/><rect x="31" y="22" width="12" height="9" rx="2" fill="#b07a4a" stroke="${INK}" stroke-width="3"/>
    <circle cx="37" cy="76" r="23" fill="#3ccf8e" stroke="${INK}" stroke-width="4"/><path d="M37 86l-9-9a5.5 5.5 0 0 1 9-6a5.5 5.5 0 0 1 9 6Z" fill="#fff"/>
    <rect x="77" y="31" width="14" height="20" fill="#f4eaff" stroke="${INK}" stroke-width="4"/><rect x="78" y="22" width="12" height="9" rx="2" fill="#b07a4a" stroke="${INK}" stroke-width="3"/>
    <path d="M70 51H98L106 94Q108 106 96 106H72Q60 106 62 94Z" fill="#9b5de5" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="84" cy="78" r="10" fill="#fff"/><rect x="79" y="85" width="10" height="7" rx="2" fill="#fff"/><circle cx="80" cy="77" r="3" fill="${INK}"/><circle cx="88" cy="77" r="3" fill="${INK}"/>`,
  // Chasseur : cible et javelot
  () => `${fr("#5a3418")}<circle cx="58" cy="64" r="42" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="58" cy="64" r="31" fill="#e63946"/><circle cx="58" cy="64" r="20" fill="#fff"/><circle cx="58" cy="64" r="9" fill="#e63946"/>
    <path d="M58 64L104 18" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M58 64L104 18" stroke="#ffb347" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M58 64l14-4l-10-10Z" fill="${INK}"/><path d="M96 18l10 10M100 12l10 10" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>`,
  // Cupidon : cœur ailé traversé d'une flèche
  () => `${fr("#5a1f3d")}<path d="M34 58q-22-4-24-24q14 4 22 14q-14-4-18 4q10 0 16 4Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M86 58q22-4 24-24q-14 4-22 14q14-4 18 4q-10 0-16 4Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 100L30 68A17 17 0 0 1 60 42A17 17 0 0 1 90 68Z" fill="#ff4f8b" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M42 56q4-6 10-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M14 96L100 30" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M104 27l-14 2l7 8Z" fill="${INK}"/><path d="M14 96l-2-10M14 96l10 2" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>`
];
const art = r => `<svg class="lg-art" viewBox="0 0 120 120" aria-hidden="true">${ART[r] ? ART[r]() : ""}</svg>`;

/* Décor : Muscle Beach au clair de lune (ou au soleil), palmier, banc de muscu, loup qui hurle sur son rocher */
const SCENE = `<svg class="lg-scn" viewBox="0 40 400 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <defs><radialGradient id="lg-mg"><stop offset="0" stop-color="#fff6d6" stop-opacity=".5"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></radialGradient>
  <linearGradient id="lg-rf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
  <linearGradient id="lg-fd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
  <g class="lg-moon"><circle cx="258" cy="76" r="48" fill="url(#lg-mg)"/><circle cx="258" cy="76" r="21" fill="#fff3c4"/><circle cx="251" cy="71" r="4" fill="#e9dca8"/><circle cx="265" cy="83" r="5" fill="#e9dca8"/><circle cx="264" cy="66" r="2.5" fill="#e9dca8"/></g>
  <g class="lg-sun"><circle cx="258" cy="84" r="38" fill="#fff2b0" opacity=".45"/><circle cx="258" cy="84" r="23" fill="#ffd23f"/></g>
  <rect class="lg-sea" x="-1400" y="133" width="3200" height="40"/><path class="lg-sea" d="M0 132Q100 127 200 132T400 132V170H0Z"/>
  <path class="lg-refl" d="M247 134h22l-4 5h-14zM251 143h14l-3 4h-8zM254 151h8l-2 3h-4z" fill="url(#lg-rf)"/>
  <rect class="lg-sand" x="-1400" y="154" width="3200" height="20"/><path class="lg-sand" d="M0 154Q120 146 240 154T400 150V170H0Z"/>
  <g class="lg-sil">
    <path d="M362 158Q356 134 366 112" stroke-width="5" fill="none" stroke="currentColor" stroke-linecap="round"/>
    <path d="M366 112q-20-6-31 5q15-12 31-5q-6-18-25-20q20 2 25 20q8-17 27-15q-19 3-27 15q19-1 28 12q-16-11-28-12z" fill="currentColor"/>
    <path d="M388 160Q385 146 391 136" stroke-width="4" fill="none" stroke="currentColor" stroke-linecap="round"/>
    <path d="M391 136q-12-5-20 3q11-8 20-3q2-12 12-14q-9 3-12 14z" fill="currentColor"/>
    <g transform="translate(-112 18)"><rect x="150" y="133" width="56" height="5" rx="2"/><rect x="156" y="137" width="4" height="12"/><rect x="196" y="137" width="4" height="12"/>
    <rect x="162" y="113" width="3" height="21"/><rect x="191" y="113" width="3" height="21"/>
    <rect x="138" y="113" width="80" height="3" rx="1"/><rect x="141" y="104" width="7" height="21" rx="2"/><rect x="208" y="104" width="7" height="21" rx="2"/><rect x="134" y="107" width="5" height="15" rx="2"/><rect x="217" y="107" width="5" height="15" rx="2"/></g>
    <g transform="translate(140 72) scale(.62)"><path d="M14 156Q24 128 54 130Q82 130 94 156Z"/>
      <g class="lg-wolf"><path d="M42 133L44 114Q42 100 50 92L54 80L56 70L54 61L60 67L62 59L64 68L75 57L77 60L69 73L69 84Q73 98 70 114L72 133Z"/>
      <path d="M44 128Q28 130 30 116" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/></g></g>
  </g>
  <rect x="-1400" y="120" width="3200" height="54" fill="url(#lg-fd)"/>
  <text class="lg-aou" x="196" y="104">AOUUUH</text>
</svg>`;

/* ================= OUTILS ================= */
const MOCK = /[?&]mock\b/.test(location.search);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

/* --- « chiffrement » de fête : Diffie-Hellman modulo 2^89-1 + flux XOR (sfc32) --- */
const HAS_BIG = typeof BigInt === "function";
const M89 = HAS_BIG ? (BigInt(1) << BigInt(89)) - BigInt(1) : 0, GEN = HAS_BIG ? BigInt(3) : 0;
function mpow(b, e, m) {
  const Z = BigInt(0), O = BigInt(1);
  let r = O; b %= m;
  while (e > Z) { if (e & O) r = r * b % m; b = b * b % m; e >>= O; }
  return r;
}
function randBig() {
  const a = new Uint32Array(3);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 3; i++) a[i] = Math.floor(Math.random() * 4294967296); }
  const v = (BigInt(a[0]) << BigInt(64)) | (BigInt(a[1]) << BigInt(32)) | BigInt(a[2]);
  return v % (M89 - BigInt(3)) + BigInt(2);
}
const B36 = /^[0-9a-z]{1,20}$/;
const toS = x => x.toString(36);
function fromS(s) { if (!B36.test(s || "")) return null; let r = BigInt(0); const k = BigInt(36); for (const ch of s) r = r * k + BigInt(parseInt(ch, 36)); return r; }
function seed4(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function stream(key, nonce, bytes) {
  let [a, b, c, d] = seed4(key + "|" + nonce);
  const next = () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11); d = d + 1 | 0; t = t + d | 0; c = c + t | 0; return t >>> 0; };
  for (let i = 0; i < 15; i++) next();
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ (next() & 255);
  return out;
}
const TE = typeof TextEncoder === "function" ? new TextEncoder() : null, TD = typeof TextDecoder === "function" ? new TextDecoder() : null;
const utf8 = s => TE ? TE.encode(s) : Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
const unutf8 = u => TD ? TD.decode(u) : decodeURIComponent(escape(String.fromCharCode.apply(null, u)));
function b64(u) { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
function unb64(s) { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
function seal(key, obj, pad) {
  let j = JSON.stringify(obj);
  if (pad && j.length < pad) j += " ".repeat(pad - j.length);
  const nonce = Math.random().toString(36).slice(2, 7).padEnd(5, "0");
  return nonce + "." + b64(stream(key, nonce, utf8(j)));
}
function unseal(key, blob) {
  if (!key || typeof blob !== "string") return null;
  const k = blob.indexOf(".");
  if (k < 1) return null;
  try { return JSON.parse(unutf8(stream(key, blob.slice(0, k), unb64(blob.slice(k + 1))))); } catch (e) { return null; }
}

/* ================= SON ================= */
function makeSound() {
  let ctx = null, master = null;
  const muted = () => { try { return !!(window.GONFLETTE && GONFLETTE.kit && GONFLETTE.kit.muted && GONFLETTE.kit.muted()); } catch (e) { return false; } };
  const ok = () => ctx && ctx.state === "running" && !muted();
  function unlock() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination); } catch (e) { ctx = null; }
  }
  function tone(f, dur, o) {
    if (!ok()) return; o = o || {};
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || .2, t + (o.att || .01)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .05);
  }
  return {
    unlock,
    howl(delay) {
      if (!ok()) return;
      const t = ctx.currentTime + .05 + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 1300; f.Q.value = 5;
      o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(540, t + .7); o.frequency.setValueAtTime(540, t + 1.5); o.frequency.exponentialRampToValueAtTime(360, t + 2.5);
      lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .4); g.gain.setValueAtTime(.16, t + 1.9); g.gain.exponentialRampToValueAtTime(.0001, t + 2.6);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 2.7); lfo.stop(t + 2.7);
    },
    gong() { tone(110, 2.2, {type: "sine", vol: .3}); tone(165, 1.8, {type: "sine", vol: .12, at: .02}); tone(220, 1.2, {type: "triangle", vol: .05}); },
    dawn() { [392, 523, 659, 784].forEach((f, i) => tone(f, .9, {type: "triangle", vol: .09, at: i * .16, att: .08})); },
    thud() { tone(70, .5, {type: "triangle", to: 40, vol: .5}); tone(140, .25, {type: "square", to: 60, vol: .08}); },
    stamp() { tone(90, .25, {type: "triangle", to: 45, vol: .45}); },
    tick() { tone(1300, .04, {type: "square", vol: .05}); },
    close() { if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; } }
  };
}

/* ================= STYLE ================= */
const CSS = `
.lg{--ink:#1d1420;--gold:#ffcc33;--wolf:#ff4d5e;--txt:#f5efe6;--dim:#c3c8e6;--panel:rgba(9,12,34,.74);--line:rgba(255,255,255,.16);--sil:#04061a;
  position:relative;min-height:100%;display:flex;flex-direction:column;color:var(--txt);font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;font-size:17px;
  background:#070b22;overflow:hidden;-webkit-tap-highlight-color:transparent;isolation:isolate}
.lg *{box-sizing:border-box}
.lg button{font-family:inherit}
.lg[data-sky=day]{--sil:#3b2238;--panel:rgba(40,18,40,.66)}
.lg-bg{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.lg-bg .nt,.lg-bg .dy{position:absolute;inset:0;transition:opacity 1.8s ease}
.lg-bg .nt{background:linear-gradient(180deg,#060a20 0,#131c48 150px,#1e2d63 300px,#0b1434 100%)}
.lg-bg .dy{opacity:0;background:linear-gradient(180deg,#ff9a62 0,#ffc98a 70px,#8fd0f0 128px,#2f79ad 220px,#163a5e 100%)}
.lg-after{animation:lg-in .5s 1.6s both}
.lg[data-sky=day] .lg-lead{color:#e6ecff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.lg[data-sky=day] .lg-bg .dy{opacity:1}
.lg-stars{position:absolute;left:0;right:0;top:0;height:220px;transition:opacity 1.5s;
  background-image:radial-gradient(1.6px 1.6px at 22px 28px,#fff,transparent),radial-gradient(1.2px 1.2px at 90px 70px,#fff,transparent),radial-gradient(1.8px 1.8px at 160px 22px,#fff,transparent),radial-gradient(1.2px 1.2px at 220px 96px,#fff,transparent),radial-gradient(1.5px 1.5px at 260px 18px,#fff,transparent),radial-gradient(1.2px 1.2px at 48px 120px,#fff,transparent),radial-gradient(1.4px 1.4px at 130px 140px,#fff,transparent),radial-gradient(1.2px 1.2px at 200px 50px,#fff,transparent);
  background-size:290px 170px;animation:lg-tw 4s ease-in-out infinite alternate}
.lg[data-sky=day] .lg-stars{opacity:0}
@keyframes lg-tw{from{opacity:.55}to{opacity:1}}
.lg-scn{position:absolute;left:0;top:0;width:100%;height:130px;display:block;overflow:visible}
.lg-scn .lg-sea{fill:#0e2050;transition:fill 1.6s}.lg-scn .lg-sand{fill:#141838;transition:fill 1.6s}
.lg[data-sky=day] .lg-scn .lg-sea{fill:#2a8fd0}.lg[data-sky=day] .lg-scn .lg-sand{fill:#f0c886}
.lg-scn .lg-sil{fill:var(--sil);color:var(--sil);transition:fill 1.6s,color 1.6s}
.lg-scn .lg-moon,.lg-scn .lg-refl{transition:opacity 1.6s,transform 1.6s}
.lg-scn .lg-sun{opacity:0;transform:translateY(60px);transition:opacity 1.6s,transform 1.8s}
.lg[data-sky=day] .lg-scn .lg-moon,.lg[data-sky=day] .lg-scn .lg-refl{opacity:0;transform:translateY(40px)}
.lg[data-sky=day] .lg-scn .lg-sun{opacity:1;transform:none}
.lg-scn .lg-wolf{transform-box:fill-box;transform-origin:50% 100%}
.lg-scn .lg-aou{font:400 11px Anton,Impact,sans-serif;fill:#fff3c4;opacity:0;letter-spacing:2px}
.lg[data-howl="1"] .lg-scn .lg-wolf{animation:lg-howl 3.2s ease-in-out infinite}
.lg[data-howl="1"] .lg-scn .lg-aou{animation:lg-aou 3.2s ease-out infinite}
@keyframes lg-howl{0%,100%{transform:none}25%,60%{transform:rotate(-7deg) scale(1.04)}}
@keyframes lg-aou{0%,15%{opacity:0;transform:translate(0,6px)}35%{opacity:.95}80%{opacity:0;transform:translate(16px,-14px)}100%{opacity:0}}
.lg-top{position:relative;display:flex;align-items:flex-start;gap:10px;padding:12px 16px 0;min-height:122px}
.lg-hd{flex:1;min-width:0;line-height:1.05;text-shadow:0 2px 0 rgba(0,0,0,.55),0 0 12px rgba(0,0,0,.5)}
.lg-hd small{display:block;font-weight:800;font-size:.85rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.lg-hd b{display:block;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.5rem;letter-spacing:.02em;text-transform:uppercase;line-height:1.05;overflow-wrap:anywhere}
.lg-clock{flex:none;min-width:60px;text-align:center;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:1.55rem;line-height:1;padding:7px 8px;border-radius:14px;background:rgba(4,6,26,.8);border:2px solid rgba(255,243,196,.5);color:#fff3c4;font-variant-numeric:tabular-nums}
.lg-clock.urg{color:#fff;border-color:var(--wolf);background:#7a1020;animation:lg-pulse 1s infinite}
.lg-clock[hidden]{display:none}
@keyframes lg-pulse{50%{box-shadow:0 0 16px rgba(255,77,94,.8)}}
.lg-gb{position:relative;margin:0 16px;padding:6px 12px;border-radius:12px;background:rgba(40,46,110,.92);border:1px dashed rgba(200,210,255,.5);font-weight:700;font-size:.98rem;text-align:center}
.lg-gb[hidden]{display:none}
.lg-main{position:relative;flex:1;padding:8px 16px 16px;display:flex;flex-direction:column;gap:12px;width:100%;max-width:620px;margin:0 auto}
.lg-scene{display:flex;flex-direction:column;gap:12px;animation:lg-in .45s ease-out}
@keyframes lg-in{from{opacity:0;transform:translateY(10px)}}
.lg-h{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.02em;margin:0;line-height:1.05;font-size:2rem;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.5)}
.lg-lead{margin:0;font-size:1.12rem;line-height:1.25;color:var(--dim);text-align:center}
.lg-lead b{color:#fff}
.lg-panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.lg-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.lg-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.4);border:2px solid var(--rc,#fff);font-weight:800;font-size:.95rem;letter-spacing:.02em;white-space:nowrap}

/* ---- grille des joueurs ---- */
.lg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px}
.lg-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px 6px;min-width:0;min-height:98px;border-radius:14px;border:2px solid var(--line);background:rgba(6,9,30,.6);color:inherit;cursor:pointer;touch-action:manipulation;transition:transform .12s,border-color .2s,box-shadow .2s,opacity .3s}
.lg-tile:active{transform:scale(.95)}
.lg-tile:disabled{cursor:default}
.lg-tile:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.lg-tile .pic{position:relative;width:62px;height:62px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#3b4a8a,#111735 75%);border:2px solid rgba(255,255,255,.28)}
.lg[data-sky=day] .lg-tile .pic{background:radial-gradient(circle at 50% 30%,#ffe2b0,#c5703c 80%)}
.lg-tile .pic .av{width:100%;height:100%;display:block}
.lg[data-sky=night] .lg-tile .pic .av{filter:brightness(.82) saturate(.75)}
.lg-tile b{max-width:100%;padding:0 3px;font-size:.92rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-tile small{font-size:.75rem;line-height:1;color:var(--gold);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.lg-tile.me b{color:var(--gold)}
.lg-tile.sel{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold),0 0 24px rgba(255,204,51,.45)}
.lg-tile.sel2{border-color:#ff7ab8;box-shadow:0 0 0 2px #ff7ab8,0 0 24px rgba(255,122,184,.5)}
.lg-tile.poi{border-color:#b388ff;box-shadow:0 0 0 2px #b388ff,0 0 24px rgba(179,136,255,.55)}
.lg-tile.vic .pic{box-shadow:0 0 0 3px var(--wolf),0 0 18px rgba(255,77,94,.7)}
.lg-tile.off{opacity:.38}
.lg-tile.dead{opacity:.5}
.lg-tile.dead .pic .av{filter:grayscale(1) brightness(.7)}
.lg-tile .bdg{position:absolute;top:3px;right:3px;min-width:24px;height:24px;padding:0 5px;border-radius:12px;display:grid;place-items:center;background:var(--wolf);color:#fff;font-weight:800;font-size:.9rem;border:2px solid #0b0d22;line-height:1}
.lg-tile .bdg:empty{display:none}
.lg-tile .rl{position:absolute;top:3px;left:3px;font-size:1.05rem;line-height:1;filter:drop-shadow(0 1px 1px #000)}
.lg-tile .rl:empty{display:none}
.lg-tile .tk{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#2fae6c;color:#fff;font-weight:800;font-size:.85rem;border:2px solid #0b0d22;transform:scale(0);transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.lg-tile.done .tk{transform:scale(1)}
.lg-mq{position:absolute;left:50%;top:30%;font-size:34px;line-height:1;pointer-events:none;animation:lg-buzz .35s ease-in-out infinite alternate;filter:drop-shadow(0 2px 2px #000)}
@keyframes lg-buzz{from{transform:translate(-60%,-50%) rotate(-12deg)}to{transform:translate(-40%,-62%) rotate(10deg)}}
.lg-tile.miss{animation:lg-shake .3s}
@keyframes lg-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}

/* ---- pad de nuit (identique pour tous) ---- */
.lg-pad{position:relative;display:flex;flex-direction:column;gap:10px}
.lg-info{min-height:136px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:10px 14px;border-radius:16px;background:rgba(5,8,28,.78);border:2px solid rgba(255,243,196,.28);font-size:1.12rem;line-height:1.2}
.lg-info b{color:#fff3c4}
.lg-info .big{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.5rem;text-transform:uppercase;letter-spacing:.02em;line-height:1.05}
.lg-info .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lg-info .dots{letter-spacing:4px;font-size:1.2rem;color:var(--gold)}
.lg-info .love{color:#ff9ccc;font-weight:800}
.lg-info .seen{display:flex;align-items:center;gap:10px}
.lg-info .seen .lg-art{width:58px;height:58px;flex:none}
.lg-act{display:flex;gap:8px;flex-wrap:wrap}
.lg-act .gk-btn{flex:1;min-height:44px;padding:6px 12px;font-size:1rem}
.lg-ok{width:100%}
.lg-pad .gk-btn.on{background:#3ccf8e}
.lg-shh{position:absolute;inset:0;z-index:4;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:16px;border-radius:16px;background:rgba(4,6,22,.86);backdrop-filter:blur(2px)}
.lg-shh b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.7rem;text-transform:uppercase;color:#fff3c4}
.lg-shh span{font-size:3rem;animation:lg-float 2.4s ease-in-out infinite}
.lg-pad.done .lg-shh{display:flex}
.lg-dn{margin:0;text-align:center;color:var(--dim);font-weight:700;font-size:1rem}

/* ---- tombée de la nuit / aube ---- */
.lg-big{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:18px 6px}
.lg-big .em{font-size:4.2rem;line-height:1;animation:lg-float 2.6s ease-in-out infinite}
.lg-big h2{margin:0;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:2.3rem;line-height:1.05;text-transform:uppercase;text-shadow:0 3px 0 rgba(0,0,0,.5)}
.lg-big p{margin:0;font-size:1.15rem;color:var(--dim);max-width:30ch}
.lg-zzz{position:relative;height:40px;width:120px}
.lg-zzz i{position:absolute;bottom:0;font-style:normal;font-family:Anton,Impact,sans-serif;color:#c9d3ff;opacity:0;animation:lg-z 3s ease-out infinite}
.lg-zzz i:nth-child(1){left:20px;font-size:1rem}.lg-zzz i:nth-child(2){left:50px;font-size:1.4rem;animation-delay:1s}.lg-zzz i:nth-child(3){left:84px;font-size:1.8rem;animation-delay:2s}
@keyframes lg-z{0%{opacity:0;transform:translateY(10px)}30%{opacity:1}100%{opacity:0;transform:translateY(-34px) rotate(-12deg)}}
@keyframes lg-float{50%{transform:translateY(-8px)}}

/* ---- carte de rôle ---- */
.lg-rc{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:18px 16px 16px;border-radius:20px;background:linear-gradient(180deg,#fffaf0,#f1e3c8);color:var(--ink);border:4px solid var(--ink);box-shadow:0 6px 0 var(--ink);overflow:hidden}
.lg-rc::before{content:"";position:absolute;left:0;right:0;top:0;height:12px;background:var(--rc)}
.lg-rc .lg-art{width:122px;height:122px;margin-top:4px}
.lg-rc .nm{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:2.2rem;text-transform:uppercase;line-height:1;color:var(--rk)}
.lg-rc .tg{font-family:Pacifico,cursive;font-size:1.05rem;line-height:1.3;color:var(--rk)}
.lg-rc .ds{font-size:1.05rem;line-height:1.2;color:#3a2f3c;font-weight:600}
.lg-rc .cp{margin-top:2px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:.8rem;padding:3px 10px;border-radius:999px;background:var(--rk);color:#fff}
.lg-rc .ex{font-size:1rem;font-weight:700;color:var(--ink);background:rgba(0,0,0,.06);border-radius:10px;padding:4px 10px}
.lg-card{position:relative;display:block;width:100%;max-width:360px;margin:0 auto;padding:0;border:0;background:none;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;text-align:center;color:inherit}
.lg-card .cov{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-radius:20px;border:4px solid var(--ink);color:#fff3c4;
  background:radial-gradient(circle at 50% 34%,#fff3c4 0 34px,rgba(255,243,196,.25) 35px 46px,transparent 47px),repeating-linear-gradient(45deg,#16204d 0 12px,#121a40 12px 24px);box-shadow:0 6px 0 var(--ink);transition:transform .3s cubic-bezier(.4,0,.2,1)}
.lg-card .cov .q{margin-top:110px;font-family:Anton,Impact,sans-serif;font-size:1.6rem;text-transform:uppercase;letter-spacing:.04em}
.lg-card .cov .hint{font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:1rem;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.45)}
.lg-card .cov .hand{font-size:2rem;animation:lg-press 1.6s ease-in-out infinite}
@keyframes lg-press{50%{transform:scale(.82) translateY(4px)}}
.lg-card.open .cov{transform:translateY(calc(-100% - 10px)) rotate(-2deg)}
.lg-card:focus-visible{outline:3px solid var(--gold);outline-offset:4px}
.lg-card .in{min-height:360px}
.lg-sec{position:sticky;bottom:0;z-index:20;padding:8px 16px calc(10px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,rgba(4,6,22,.92) 40%)}
.lg-sec[hidden]{display:none}
.lg-mini{position:relative;display:block;width:100%;max-width:520px;margin:0 auto;padding:0;border:0;background:none;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;color:var(--ink)}
.lg-mini .in{display:flex;align-items:center;gap:10px;min-height:64px;padding:6px 12px;border-radius:14px;background:#fffaf0;border:3px solid var(--ink);text-align:left}
.lg-mini .in .lg-art{width:48px;height:48px;flex:none}
.lg-mini .in b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.35rem;text-transform:uppercase;line-height:1;color:var(--rk)}
.lg-mini .in em{display:block;font-style:normal;font-weight:700;font-size:.92rem;line-height:1.15;color:#3a2f3c}
.lg-mini .cov{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;border:3px solid var(--ink);background:repeating-linear-gradient(45deg,#1c2756 0 10px,#16204d 10px 20px);color:#fff3c4;font-weight:800;text-transform:uppercase;letter-spacing:.06em;transition:transform .25s}
.lg-mini.open .cov{transform:translateY(-86%)}

/* ---- jour ---- */
.lg-deaths{display:flex;flex-direction:column;gap:12px}
.lg-death{position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;background:var(--panel);border:2px solid var(--line);animation:lg-drop .6s cubic-bezier(.2,1.3,.4,1) both}
@keyframes lg-drop{from{opacity:0;transform:translateY(-30px) scale(.9)}}
.lg-death .pic{flex:none;width:86px;height:86px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#59607e,#1a1d33 75%);border:3px solid #fff3c4}
.lg-death .pic .av{width:100%;height:100%;display:block;filter:grayscale(.9)}
.lg-death .tx{flex:1;min-width:0}
.lg-death .tx b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.6rem;text-transform:uppercase;line-height:1.05;overflow-wrap:anywhere}
.lg-death .tx small{display:block;font-size:1rem;color:var(--dim);font-weight:700}
.lg-stamp{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:3px 12px;border:4px solid var(--rc);border-radius:10px;color:var(--rc);font-family:Anton,Impact,sans-serif;font-size:1.35rem;text-transform:uppercase;letter-spacing:.04em;background:rgba(0,0,0,.45);transform:rotate(-5deg);animation:lg-slam .45s cubic-bezier(.2,1.5,.4,1) both;animation-delay:inherit}
@keyframes lg-slam{0%,40%{opacity:0;transform:scale(2.6) rotate(-16deg)}100%{opacity:1;transform:scale(1) rotate(-5deg)}}
.lg-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}
.lg-hero .pic{width:170px;height:170px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#59607e,#1a1d33 75%);border:4px solid #fff3c4;animation:lg-zoom 1.2s ease-out both}
.lg-hero .pic .av{width:100%;height:100%;display:block}
.lg-hero.gone .pic .av{filter:grayscale(.9)}
.lg-hero .who{font-family:Anton,Impact,sans-serif;font-size:2rem;text-transform:uppercase;line-height:1.05;overflow-wrap:anywhere;max-width:100%}
.lg-hero .lg-stamp{font-size:1.8rem;animation-delay:.9s}
@keyframes lg-zoom{from{transform:scale(.7);filter:brightness(0)}}
.lg-aim{position:relative}
.lg-aim::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:3px dashed var(--wolf);animation:lg-spin 6s linear infinite}
@keyframes lg-spin{to{transform:rotate(360deg)}}
.lg-tally{display:flex;flex-direction:column;gap:4px;font-size:1rem;color:var(--dim)}
.lg-tally b{color:#fff}
.lg-line{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 8px}
.lg-sus{position:relative;display:flex;flex-direction:column;align-items:center;width:72px;gap:2px}
.lg-sus .pic{width:56px;height:56px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#59607e,#1a1d33 75%);border:2px solid rgba(255,255,255,.3)}
.lg[data-sky=day] .lg-sus .pic{background:radial-gradient(circle at 50% 30%,#ffe2b0,#c5703c 80%)}
.lg-sus .pic .av{width:100%;height:100%;display:block}
.lg-sus b{max-width:100%;font-size:.88rem;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-sus.dead .pic .av{filter:grayscale(1) brightness(.7)}
.lg-sus.dead b{text-decoration:line-through;opacity:.7}
.lg-sus .rl{position:absolute;top:-4px;right:4px;font-size:1.1rem;filter:drop-shadow(0 1px 1px #000)}
.lg-sus .tk{position:absolute;top:-4px;left:6px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#2fae6c;color:#fff;font-weight:800;font-size:.8rem;border:2px solid #0b0d22;transform:scale(0);transition:transform .25s}
.lg-sus.done .tk{transform:scale(1)}
.lg-skip{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.lg-skip small{text-align:center;color:var(--dim);font-weight:700}
.lg-tips{margin:0;padding:0 0 0 18px;color:var(--dim);line-height:1.3}
.lg-tips b{color:#fff}

/* ---- fin ---- */
.lg-win{text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.lg-win .em{font-size:3.6rem;line-height:1;animation:lg-float 2.4s ease-in-out infinite}
.lg-win h2{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2.2rem;line-height:1.05;text-transform:uppercase;color:var(--gold);text-shadow:0 3px 0 rgba(0,0,0,.6)}
.lg-win p{margin:0;color:#fff;font-size:1.1rem}
.lg-roster{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.lg-roster li{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:14px;background:var(--panel);border:1px solid var(--line);animation:lg-in .4s both}
.lg-roster li.w{border-color:var(--gold);background:rgba(255,204,51,.14)}
.lg-roster .pic{flex:none;width:48px;height:48px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#59607e,#1a1d33 75%)}
.lg-roster .pic .av{width:100%;height:100%;display:block}
.lg-roster li.d .pic .av{filter:grayscale(.85)}
.lg-roster .nm{flex:1;min-width:0;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-roster .nm small{display:block;font-weight:600;text-transform:none;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-roster .tag{flex:none;padding:2px 8px;border-radius:8px;border:2px solid var(--rc);color:var(--rc);font-weight:800;font-size:.9rem;white-space:nowrap}
.lg-roster .star{flex:none;color:var(--gold);font-size:1.2rem}
.lg-log{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:1rem;line-height:1.25}
.lg-log li{padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.3)}
.lg-log li b{color:var(--gold);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-right:4px}
.lg-log li.n{border-left:4px solid #6f7cff}.lg-log li.j{border-left:4px solid #ffb347}
.lg-spec{margin:0;text-align:center;color:var(--dim);font-style:italic}
@media (min-width:700px){.lg-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}.lg-tile .pic{width:72px;height:72px}}
@media (max-width:370px){.lg-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}.lg-tile .pic{width:56px;height:56px}.lg-hd b{font-size:1.45rem}.lg-top{min-height:112px}.lg-scn{height:120px}}
@media (prefers-reduced-motion:reduce){
  .lg *,.lg *::before,.lg *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
  .lg-mq{animation:none!important;transform:translate(-50%,-50%)}
}`;

/* ================= JEU ================= */
GONFLETTE.registerGame({
  id: "loupgarou",
  name: "Loup-garou",
  min: 5,
  max: 10,
  resumable: true,
  create(api) {
    const el = api.el, P = api.players, N = P.length;
    const mySeat = P.findIndex(p => p.key === api.me);
    const T = {deal: 60, fall: 5, cupid: 30, wolves: 40, seer: 30, witch: 30, dawn: 4, hunter: 30, shot: 6, debate: 150, vote: 45, verdict: 7, end: 12};
    const STEPS = ["fall", "cupid", "wolves", "seer", "witch", "dawn"];
    const ACTOR = {cupid: 5, wolves: 1, seer: 2, witch: 3};
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const spd = () => Math.max(1, Math.min(200, +window.__lgSpeed || 1));
    const snd = makeSound();
    const mid = String(api.mid || api.seed || "x");
    const ss = {get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }};
    let dead = false;

    // ma clé Diffie-Hellman (gardée pour revenir dans la partie après un rechargement)
    let myA = null, myPk = "";
    if (HAS_BIG) {
      myA = fromS(ss.get("lg-k:" + mid));
      if (!myA) { myA = randBig(); ss.set("lg-k:" + mid, toS(myA)); }
      myPk = toS(mpow(GEN, myA, M89));
    }

    /* ================= HÔTE ================= */
    let hostInt = null, H = null;
    if (api.isHost) {
      let hb = HAS_BIG ? fromS(ss.get("lg-h:" + mid)) : null;
      const R = api.resume;
      const fresh = () => ({ph: "deal", st: "", n: 1, t: T.deal, tt: T.deal, d: 0, role: [], o: P.map(() => 0), c: P.map(() => ""), ec: 0,
        lg: [], K: P.map(() => ""), lov: null, pot: [1, 1], nl: [], sh: [], a: {}, vic: -1, saved: 0, poi: -1, rdy: [], sk: [], vt: {}, vc: null, rv: 0,
        dz: [], hs: -1, ht: -1, hq: [], hshot: 0, nx: "", el: -1, how: "", win: "", g: [], ev: null});
      const SEC = ["role", "lov", "pot", "nl", "sh", "a", "vic", "saved", "poi", "hq", "hshot", "nx", "rv", "tt"];
      if (R && R.ph) {
        let sec = null;
        if (R.ph === "end" && R.R) sec = {role: R.R.split("").map(Number), lov: R.L || null, nl: R.nl || [], pot: [0, 0], sh: [], a: {}};
        else if (R.hx && hb && R.B === toS(mpow(GEN, hb, M89))) sec = unseal("hx" + toS(hb), R.hx);
        if (sec) {
          H = fresh();
          ["ph", "st", "n", "t", "d", "K", "o", "lg", "rdy", "sk", "vc", "dz", "hs", "ht", "el", "how", "win", "g", "ev"].forEach(k => { if (R[k] !== undefined) H[k] = R[k]; });
          H.c = String(R.c || "").split("").map(ch => (ch === "-" ? "" : ch));
          while (H.c.length < N) H.c.push("");
          H.vt = {}; (R.vt || []).forEach(([v, t]) => { H.vt[v] = t; });
          H.ec = Math.max(0, ...H.o);
          SEC.forEach(k => { if (sec[k] !== undefined) H[k] = sec[k]; });
          (sec.dd || []).forEach(i => { H.a[i] = [-1, -1, 1, 3, 0, -1]; });
          if (!H.tt) H.tt = H.t;
        }
      }
      if (!H && R && R.ph) {
        // l'hôte a perdu sa clé : impossible de relire les rôles
        later(() => api.finish({winners: [], ranking: P.map(p => p.key), summary: "Le conteur a perdu ses notes : partie interrompue."}), 400);
      } else {
        if (!H) {
          H = fresh();
          const roles = compo(N);
          for (let i = roles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [roles[i], roles[j]] = [roles[j], roles[i]]; }
          H.role = roles;
        }
        if (!hb && HAS_BIG) { hb = randBig(); ss.set("lg-h:" + mid, toS(hb)); }
        runHost(hb);
      }
    }

    function runHost(hb) {
      const Bs = HAS_BIG ? toS(mpow(GEN, hb, M89)) : "";
      const hxKey = HAS_BIG ? "hx" + toS(hb) : "";
      const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
      const shared = {}, ecache = {}, xcache = {};
      let hxCache = {plain: "", sealed: ""};
      let lastInputs = {};
      const seenAt = P.map(() => Date.now());
      let H_here = P.map(() => true);
      const here = () => { const c = new Set(api.connected()), now = Date.now(); H_here = P.map((p, i) => { if (c.has(p.key)) seenAt[i] = now; return now - seenAt[i] < 3000; }); return H_here; };
      const alive = () => P.map((_, i) => i).filter(i => !H.o[i]);
      const aliveRole = r => alive().filter(i => H.role[i] === r);
      const keyOf = i => {
        const pk = H.K[i]; if (!pk || !HAS_BIG) return null;
        if (shared[i] && shared[i].pk === pk) return shared[i].key;
        let key = null; const v = fromS(pk);
        if (v) key = "lg" + toS(mpow(v, hb, M89));
        shared[i] = {pk, key}; return key;
      };
      const mixed = () => !!H.lov && (H.role[H.lov[0]] === 1) !== (H.role[H.lov[1]] === 1);
      const wolfPicks = () => H.role.map((r, i) => i).filter(i => H.role[i] === 1 && !H.o[i]).map(i => { const a = H.a[i] || [-1, -1, 0]; return [i, a[0], a[2]]; });

      /* --- plis secrets --- */
      function plainOf(i) {
        const r = H.role[i], o = {r};
        if (H.lov && H.lov.includes(i)) o.lv = H.lov[0] === i ? H.lov[1] : H.lov[0];
        const night = H.ph === "night";
        if (H.o[i]) {   // fantôme : voit tout
          o.gh = 1; o.R = H.role.join(""); if (H.lov) o.L = H.lov;
          if (night) {
            if (H.st === "cupid") { const c = aliveRole(5)[0]; const a = c != null && H.a[c]; if (a) o.cp = [a[0], a[1]]; }
            if (H.st === "wolves") o.wv = wolfPicks();
            if (H.st === "seer") { const s = aliveRole(2)[0]; const a = s != null && H.a[s]; if (a) o.sv = a[0]; }
            if (H.st === "witch" || H.st === "seer") o.vi = H.vic;
            if (H.st === "witch") { const w = aliveRole(3)[0]; const a = w != null && H.a[w]; if (a) { o.ws = a[4]; o.wq = a[5]; } o.pt = H.pot; }
          }
          return o;
        }
        if (r === 1) { o.wf = H.role.map((x, j) => j).filter(j => H.role[j] === 1); if (night && H.st === "wolves") o.wv = wolfPicks(); }
        if (r === 2) o.sh = H.sh;
        if (r === 3) { o.pt = H.pot; if (night && H.st === "witch") o.vi = H.vic; }
        return o;
      }
      function blobs() {
        const plains = {};
        let L = 0;
        for (let i = 0; i < N; i++) { if (!keyOf(i)) continue; plains[i] = JSON.stringify(plainOf(i)); L = Math.max(L, plains[i].length); }
        const pad = Math.ceil((L + 1) / 16) * 16, e = {};
        for (const i in plains) {
          const p = plains[i] + " ".repeat(pad - plains[i].length), key = keyOf(+i);
          if (!ecache[i] || ecache[i].p !== p || ecache[i].k !== key) ecache[i] = {p, k: key, s: seal(key, JSON.parse(p), pad)};
          e[i] = ecache[i].s;
        }
        return e;
      }
      function hx() {
        const sec = {}; ["role", "lov", "pot", "nl", "sh", "vic", "saved", "poi", "hq", "hshot", "nx", "rv", "tt"].forEach(k => { sec[k] = H[k]; });
        // actions des rôles de la nuit en cours (les entrées déjà traitées ne sont pas redonnées après un rechargement)
        const a = {}, dd = [];
        for (const i in H.a) { if (isActor(+i)) a[i] = H.a[i]; else if (doneOf(+i)) dd.push(+i); }
        sec.a = a; sec.dd = dd;
        const plain = JSON.stringify(sec);
        if (plain !== hxCache.plain) hxCache = {plain, sealed: seal(hxKey, sec)};
        return hxCache.sealed;
      }
      const pub = () => {
        const s = {ph: H.ph, st: H.st, n: H.n, t: Math.max(0, Math.ceil(H.t)), d: H.d, B: Bs, K: H.K, o: H.o,
          c: H.c.map(x => x || "-").join(""), rv: P.map((_, i) => (H.o[i] ? H.role[i] : "-")).join(""), lg: H.lg};
        if (H.g.length) s.g = H.g;
        if (H.ev) s.ev = H.ev;
        if (H.ph === "deal") s.rdy = H.rdy;
        if (H.ph === "night") { const aw = awaited(); s.na = aw.length; s.dn = aw.filter(doneOf).length; }
        if (H.ph === "day") {
          if (H.st === "reveal" || H.st === "verdict" || H.st === "shot") s.dz = H.dz;
          if (H.st === "hunter" || H.st === "shot") { s.hs = H.hs; s.ht = H.ht; }
          if (H.st === "debate") s.sk = H.sk;
          if (H.st === "vote") { s.vt = Object.keys(H.vt).map(v => [+v, H.vt[v]]); if (H.vc) s.vc = H.vc; }
          if (H.st === "verdict") { s.el = H.el; s.how = H.how; }
        }
        if (H.ph === "end") { s.win = H.win; s.R = H.role.join(""); s.L = H.lov || 0; s.nl = H.nl; s.mx = mixed() ? 1 : 0; }
        else { s.e = blobs(); s.hx = hx(); }
        api.setState(s);
        if (MOCK) { window.__lgHost = H; window.__lgStateSize = Math.max(window.__lgStateSize || 0, JSON.stringify(s).length); }
      };

      /* --- morts --- */
      const tag = () => (H.ph === "night" ? H.d * 2 - 1 : H.d * 2);
      function kill(i, cause, dz, quit) {
        if (i < 0 || H.o[i]) return;
        H.ec++; H.o[i] = H.ec; H.c[i] = cause; H.lg.push([tag(), i, cause]); dz.push(i);
        if (H.role[i] === 4 && !quit && !H.hshot && !H.hq.includes(i)) H.hq.push(i);
        if (H.lov && H.lov.includes(i)) { const j = H.lov[0] === i ? H.lov[1] : H.lov[0]; kill(j, "l", dz, quit); }
      }
      function winner() {
        const al = alive();
        if (!al.length) return "x";
        if (H.lov && mixed() && al.length === 2 && al.includes(H.lov[0]) && al.includes(H.lov[1])) return "a";
        const w = al.filter(i => H.role[i] === 1).length;
        if (!w) return "v";
        if (w >= al.length - w) return "l";
        return "";
      }

      /* --- phases --- */
      const step = (ph, st, t) => { H.ph = ph; H.st = st; H.n++; H.t = t; H.tt = t; pub(); };
      const goNight = () => {
        H.d++; H.a = {}; H.vic = -1; H.saved = 0; H.poi = -1; H.dz = [];
        H.nl.push([H.d, -1, -1, 0, -1]);
        step("night", "fall", T.fall);
      };
      const stepOn = st => {
        if (st === "fall" || st === "dawn") return true;
        if (st === "cupid") return H.d === 1 && aliveRole(5).length > 0;
        return aliveRole(ACTOR[st]).length > 0;
      };
      const nextNight = () => {
        let k = STEPS.indexOf(H.st) + 1;
        while (k < STEPS.length && !stepOn(STEPS[k])) k++;
        const st = STEPS[k] || "dawn";
        H.a = {};
        if (st === "dawn") return dawn();
        step("night", st, T[st]);
      };
      const isActor = i => !!ACTOR[H.st] && H.role[i] === ACTOR[H.st];
      const validT = (p, self) => Number.isInteger(p) && p >= 0 && p < N && !H.o[p] && p !== self;
      function doneOf(i) {
        const a = H.a[i];
        if (!a) return false;
        if (isActor(i)) {
          if (H.st === "cupid") return a[2] === 1 && Number.isInteger(a[0]) && Number.isInteger(a[1]) && a[0] !== a[1] && !H.o[a[0]] && !H.o[a[1]] && a[0] >= 0 && a[1] >= 0;
          if (H.st === "wolves") { const ws = aliveRole(1); return ws.every(w => H.a[w] && H.a[w][2] === 1 && H.a[w][0] === a[0]) && validT(a[0]) && H.role[a[0]] !== 1; }
          if (H.st === "seer") return a[2] === 2;
          if (H.st === "witch") return a[2] === 1;
        }
        return a[2] === 1 && a[3] >= 3;
      }
      const awaited = () => (ACTOR[H.st] ? alive().filter(i => H_here[i]) : []);
      const stepDone = () => { const aw = awaited(); return aw.length > 0 && aw.every(doneOf); };
      function endStep() {
        const st = H.st;
        if (st === "cupid") {
          const c = aliveRole(5)[0], a = c != null ? H.a[c] : null;
          if (a && Number.isInteger(a[0]) && Number.isInteger(a[1]) && a[0] !== a[1] && a[0] >= 0 && a[1] >= 0 && a[0] < N && a[1] < N && !H.o[a[0]] && !H.o[a[1]]) {
            H.lov = [a[0], a[1]];
          }
        } else if (st === "wolves") {
          const cnt = {};
          aliveRole(1).forEach(w => { const p = H.a[w] ? H.a[w][0] : -1; if (validT(p) && H.role[p] !== 1) cnt[p] = (cnt[p] || 0) + 1; });
          const ks = Object.keys(cnt).map(Number), max = Math.max(0, ...ks.map(k => cnt[k])), tied = ks.filter(k => cnt[k] === max);
          H.vic = tied.length ? tied[Math.floor(Math.random() * tied.length)] : -1;
          H.nl[H.nl.length - 1][1] = H.vic;
        } else if (st === "witch") {
          const w = aliveRole(3)[0], a = w != null ? H.a[w] : null;
          if (a && a[2] === 1) {
            if (a[4] === 1 && H.pot[0] && H.vic >= 0) { H.saved = 1; H.pot[0] = 0; H.nl[H.nl.length - 1][3] = 1; }
            if (H.pot[1] && validT(a[5], w) && a[5] !== H.vic) { H.poi = a[5]; H.pot[1] = 0; H.nl[H.nl.length - 1][4] = a[5]; }
          }
        }
        nextNight();
      }
      function dawn() {
        H.dz = [];
        H.ph = "night";
        if (H.vic >= 0 && !H.saved) kill(H.vic, "w", H.dz);
        if (H.poi >= 0) kill(H.poi, "p", H.dz);
        H.a = {};
        step("night", "dawn", T.dawn);
      }
      const goReveal = () => { step("day", "reveal", 4 + 3.5 * Math.max(1, H.dz.length)); };
      function afterDeaths(next) {
        H.nx = next;
        while (H.hq.length) {
          const hs = H.hq.shift();
          if (!H.hshot && H_here[hs] && !H.g.includes(hs)) { H.hshot = 1; H.hs = hs; H.ht = -1; H.dz = []; return step("day", "hunter", T.hunter); }
        }
        const w = winner();
        if (w) return goEnd(w);
        if (next === "debate") return goDebate();
        return goNight();
      }
      const shoot = k => {
        H.ht = k; H.dz = [];
        if (k >= 0) kill(k, "h", H.dz);
        step("day", "shot", k >= 0 ? T.shot : 4);
      };
      const goDebate = () => { H.sk = []; step("day", "debate", T.debate); };
      const goVote = vc => { H.vt = {}; H.vc = vc; H.rv = vc ? 1 : 0; step("day", "vote", T.vote); };
      function tally() {
        const al = alive(), cands = (H.vc || al).filter(i => !H.o[i]), cnt = {};
        for (const v of al) { const t = H.vt[v]; if (t != null && cands.includes(t)) cnt[t] = (cnt[t] || 0) + 1; }
        const max = Math.max(0, ...cands.map(i => cnt[i] || 0)), tied = max ? cands.filter(i => (cnt[i] || 0) === max) : [];
        if (tied.length === 1) return verdict(tied[0], "v");
        if (tied.length > 1 && !H.rv) return goVote(tied);
        return verdict(-1, tied.length ? "e" : "x");
      }
      const verdict = (el, how) => {
        H.el = el; H.how = how; H.dz = [];
        if (el >= 0) kill(el, "v", H.dz);
        step("day", "verdict", T.verdict + (H.dz.length > 1 ? 3 : 0));
      };
      const goEnd = w => { H.win = w; H.hs = -1; step("end", "", T.end); };
      function finishGame() {
        H.ph = "done";
        const W = H.win, mx = mixed(), inLove = i => !!H.lov && mx && H.lov.includes(i);
        const isW = i => W === "v" ? H.role[i] !== 1 && !inLove(i) : W === "l" ? H.role[i] === 1 && !inLove(i) : W === "a" ? H.lov.includes(i) : false;
        const idx = P.map((_, i) => i);
        const later1 = (a, b) => ((H.o[a] || 999) > (H.o[b] || 999) ? -1 : (H.o[a] || 999) < (H.o[b] || 999) ? 1 : a - b);
        const win = idx.filter(isW).sort(later1), lose = idx.filter(i => !isW(i)).sort(later1);
        const names = arr => arr.map(i => P[i].pseudo).join(", ").replace(/, ([^,]*)$/, " et $1");
        const wolves = idx.filter(i => H.role[i] === 1), d = H.d;
        let summary;
        if (W === "v") summary = `Muscle Beach est sauvé ! ${wolves.length > 1 ? "Les loups" : "Le loup"} ${names(wolves)} ${wolves.length > 1 ? "sont démasqués" : "est démasqué"} en ${d} nuit${d > 1 ? "s" : ""}.`;
        else if (W === "l") summary = `La meute (${names(wolves)}) a dévoré Muscle Beach en ${d} nuit${d > 1 ? "s" : ""} 🐺`;
        else if (W === "a") summary = `L'amour plus fort que tout : ${names(H.lov)} restent seuls sur la plage 💘`;
        else summary = "Plus personne à Muscle Beach… Match nul !";
        api.finish({winners: win.map(i => P[i].key), ranking: win.concat(lose).map(i => P[i].key), summary: summary.slice(0, 160)});
      }

      /* --- entrées --- */
      function parseX(i, x) {
        if (typeof x !== "string" || x.length > 200) return null;
        const ck = i + ":" + x;
        if (xcache[ck] !== undefined) return xcache[ck];
        const v = unseal(keyOf(i), x);
        const ok = Array.isArray(v) && v.length === 6 && v.every(Number.isInteger) ? v : null;
        xcache[ck] = ok;
        return ok;
      }
      function handle(i, inp) {
        if (H.ph === "deal") {
          if (inp.a === "rdy" && !H.rdy.includes(i)) { H.rdy.push(i); return true; }
        } else if (H.ph === "night" && ACTOR[H.st]) {
          const v = parseX(i, inp.x);
          if (!v) return false;
          const prev = H.a[i];
          if (H.st === "seer" && H.role[i] === 2) {
            // la voyante ne peut pas changer de cible une fois le rôle révélé
            const rec = H.sh.find(e => e[0] === H.d);
            if (rec) v[0] = rec[1];
            else if (v[2] >= 1 && validT(v[0], i)) { H.sh.push([H.d, v[0], H.role[v[0]]]); H.nl[H.nl.length - 1][2] = v[0]; }
            else if (v[2] >= 1) v[2] = 0;
          }
          if (prev && prev.join() === v.join()) return false;
          H.a[i] = v; return true;
        } else if (H.ph === "day") {
          if (H.st === "debate" && inp.a === "sk" && !H.sk.includes(i)) { H.sk.push(i); return true; }
          if (H.st === "vote" && inp.a === "v") {
            const t = inp.k;
            if (!validT(t, i) || (H.vc && !H.vc.includes(t)) || H.vt[i] === t) return false;
            H.vt[i] = t; return true;
          }
          if (H.st === "hunter" && inp.a === "sh" && i === H.hs && H.ht < 0 && validT(inp.k, i)) { shoot(inp.k); return false; }
        }
        return false;
      }
      function apply() {
        let ch = false;
        for (const k in lastInputs) {
          const i = seatOf[k], inp = lastInputs[k];
          if (i == null || !inp || typeof inp !== "object") continue;
          if (typeof inp.pk === "string" && B36.test(inp.pk) && inp.pk !== H.K[i]) { H.K[i] = inp.pk; ch = true; }
          // un mort n'agit plus… sauf le chasseur pour son dernier lancer
          if (inp.n !== H.n || (H.o[i] && !(H.st === "hunter" && i === H.hs)) || H.ph === "end" || H.ph === "done") continue;
          if (handle(i, inp)) ch = true;
        }
        if (!ch) return;
        if (H.ph === "deal" && alive().filter(i => H_here[i]).every(i => H.rdy.includes(i))) H.t = Math.min(H.t, 1.5);
        if (H.ph === "day" && H.st === "debate" && H.sk.length > alive().length / 2) return goVote(null);
        if (H.ph === "day" && H.st === "vote" && alive().filter(i => H_here[i]).every(i => H.vt[i] != null)) H.t = Math.min(H.t, 2.5);
        pub();
      }
      api.onInputs(map => { lastInputs = map || {}; if (!dead && H.ph !== "done") apply(); });

      function onLeave(i) {
        H.g.push(i);
        H.ev = {n: (H.ev ? H.ev.n : 0) + 1, i};
        if (H.ph === "end" || H.ph === "done" || H.o[i]) { pub(); return; }
        const dz = [];
        kill(i, "q", dz, true);
        const w = winner();
        if (w) return goEnd(w);
        if (H.ph === "day" && H.st === "vote") {
          for (const v in H.vt) if (+v === i || H.vt[v] === i || H.o[H.vt[v]]) delete H.vt[v];
          if (H.vc) { H.vc = H.vc.filter(x => !H.o[x]); if (H.vc.length < 2) H.t = Math.min(H.t, 1); }
        }
        if (H.ph === "day" && H.st === "hunter" && H.hs === i && H.ht < 0) return shoot(-1);
        if (H.ph === "night" && H.st === "wolves" && H.vic === i) H.vic = -1;
        pub();
      }

      let last = Date.now();
      hostInt = setInterval(() => {
        if (dead || H.ph === "done") return;
        const now = Date.now(), dt = (now - last) / 1000 * spd(); last = now;
        const h = here();
        for (let i = 0; i < N; i++) if (!h[i] && !H.g.includes(i)) { onLeave(i); if (H.ph === "done") return; }
        const before = Math.ceil(H.t);
        H.t -= dt;
        if (H.ph === "deal") {
          if (H.t <= 0) return goNight();
        } else if (H.ph === "night") {
          if (ACTOR[H.st] && stepDone()) H.t = Math.min(H.t, Math.max(1.2, 5 - (H.tt - H.t)));
          if (H.t <= 0) {
            if (H.st === "fall") return nextNight();
            if (H.st === "dawn") return goReveal();
            return endStep();
          }
        } else if (H.ph === "day") {
          if (H.st === "hunter" && !h[H.hs]) H.t = Math.min(H.t, 1);
          if (H.t <= 0) {
            if (H.st === "reveal") return afterDeaths("debate");
            if (H.st === "hunter") return shoot(-1);
            if (H.st === "shot") return afterDeaths(H.nx || "debate");
            if (H.st === "debate") return goVote(null);
            if (H.st === "vote") return tally();
            if (H.st === "verdict") return afterDeaths("night");
          }
        } else if (H.ph === "end") {
          if (H.t <= 0) return finishGame();
        }
        if (Math.ceil(H.t) !== before) pub();
      }, 100);
      later(pub, 30);
    }

    /* ================= AFFICHAGE ================= */
    el.innerHTML = `<style>${CSS}</style><div class="lg" id="lg-root" data-sky="night">
      <div class="lg-bg" aria-hidden="true"><div class="nt"></div><div class="dy"></div><div class="lg-stars"></div>${SCENE}</div>
      <header class="lg-top"><div class="lg-hd"><small id="lg-kick">Les Loups-garous de</small><b id="lg-title">Muscle Beach</b></div>
        <div class="lg-clock" id="lg-clock" role="timer" hidden>30</div></header>
      <div class="lg-gb" id="lg-gb" hidden>👻 Tu es un fantôme : tu vois tout… mais motus !</div>
      <main class="lg-main" id="lg-main"><p class="lg-lead">Le village se réveille…</p></main>
      <div class="lg-sec" id="lg-sec" hidden></div></div>`;
    const root = el.querySelector("#lg-root"), main = el.querySelector("#lg-main"), sec = el.querySelector("#lg-sec");
    const clock = el.querySelector("#lg-clock"), kick = el.querySelector("#lg-kick"), title = el.querySelector("#lg-title"), gbar = el.querySelector("#lg-gb");
    let S = null, sceneKey = "", lastEvN = null, lastT = null, secKey = "", myKey = null, keyB = "", blobCache = {s: "", v: null};
    let ns = {n: -1, p: -1, p2: -1, ok: 0, m: 0, s: 0, q: -1}, myVote = -1, voteN = -1, hsel = -1, mq = -1, mqIv = null, spokenN = -1, sentSkip = -1;
    const avc = {};
    const name = i => (P[i] ? P[i].pseudo : "?");
    const av = (i, o) => { const k = i + "|" + (o ? JSON.stringify(o) : ""); if (!avc[k]) avc[k] = api.avatar(P[i].key, o || {view: "bust"}); return avc[k]; };
    const bust = (i, mood) => av(i, mood ? {view: "bust", mood} : {view: "bust"});

    function myBlob() {
      if (!S || mySeat < 0 || !S.e || !S.B || !HAS_BIG) return null;
      if (keyB !== S.B) { const v = fromS(S.B); myKey = v ? "lg" + toS(mpow(v, myA, M89)) : null; keyB = S.B; }
      const b = S.e[mySeat];
      if (!b) return null;
      if (blobCache.s !== b) blobCache = {s: b, v: unseal(myKey, b)};
      return blobCache.v;
    }
    const amAlive = s => mySeat >= 0 && !s.o[mySeat];
    const alive = s => P.map((_, i) => i).filter(i => !s.o[i]);
    // rôle connu de ce téléphone (public si mort, le sien, la meute, tout pour un fantôme ou à la fin)
    function knownRole(s, i, B) {
      if (s.R) return +s.R[i];
      if (s.rv && s.rv[i] && s.rv[i] !== "-") return +s.rv[i];
      if (B) {
        if (B.R) return +B.R[i];
        if (i === mySeat) return B.r;
        if (B.wf && B.wf.includes(i)) return 1;
      }
      return -1;
    }
    const send = obj => { api.setInput(Object.assign({pk: myPk}, obj)); };
    const sendX = () => {
      if (!S || !myKey) return;
      send({n: S.n, x: seal(myKey, [ns.p, ns.p2, ns.ok, ns.m, ns.s, ns.q], 32)});
    };

    /* --- cartes de rôle --- */
    function roleCard(r, B, extra) {
      const R = ROLES[r];
      let ex = "";
      if (B && r === 1 && B.wf && B.wf.length > 1) ex += `<span class="ex">🐺 Ta meute : ${B.wf.filter(i => i !== mySeat).map(i => esc(name(i))).join(", ")}</span>`;
      if (B && B.lv != null) ex += `<span class="ex">💘 Amoureux de ${esc(name(B.lv))}</span>`;
      return `<div class="lg-rc in" style="--rc:${R.c};--rk:${R.k}">${art(r)}<span class="nm">${R.n}</span><span class="tg">${R.tag}</span>
        <span class="ds">${R.d}</span><span class="cp">Camp : ${r === 1 ? "les loups" : "le village"}</span>${ex}${extra || ""}</div>`;
    }
    function bigCard(B) {
      const inside = B ? roleCard(B.r, B) : `<div class="lg-rc in" style="--rc:#888;--rk:#555"><span class="nm">…</span><span class="ds">Connexion secrète au village…</span></div>`;
      return `<button type="button" class="lg-card" aria-label="Maintenir appuyé pour voir ton rôle">${inside}
        <span class="cov" aria-hidden="true"><span class="q">Ton rôle secret</span><span class="hand">👆</span><span class="hint">Maintiens pour voir · relâche pour cacher</span></span></button>`;
    }
    function miniCard(B) {
      if (!B) return "";
      const R = ROLES[B.r];
      let em = R.tag;
      if (B.r === 1 && B.wf && B.wf.length > 1) em = "Meute : " + B.wf.filter(i => i !== mySeat).map(i => esc(name(i))).join(", ");
      if (B.lv != null) em += ` · 💘 ${esc(name(B.lv))}`;
      if (B.r === 3 && B.pt) em = `Potions : ${B.pt[0] ? "💚 vie" : "<s>vie</s>"} · ${B.pt[1] ? "☠️ mort" : "<s>mort</s>"}`;
      if (B.r === 2 && B.sh && B.sh.length) em = "Vu : " + B.sh.map(e => `${esc(name(e[1]))} ${ROLES[e[2]].e}`).join(" · ");
      return `<button type="button" class="lg-mini" style="--rk:${R.k}" aria-label="Maintenir pour revoir ton rôle"><span class="in">${art(B.r)}<span><b>${R.n}</b><em>${em}</em></span></span>
        <span class="cov" aria-hidden="true">👆 Maintenir : mon rôle${B.gh ? " · 👻" : ""}</span></button>`;
    }
    const openCard = e => {
      const c = e.target.closest && e.target.closest(".lg-card,.lg-mini");
      snd.unlock();
      if (!c) return;
      if (e.type === "pointerdown") { try { c.setPointerCapture(e.pointerId); } catch (er) {} }
      c.classList.add("open");
    };
    const closeCards = () => root.querySelectorAll(".lg-card.open,.lg-mini.open").forEach(c => c.classList.remove("open"));
    const onKeyDown = e => { const c = e.target.closest && e.target.closest(".lg-card,.lg-mini"); if (c && (e.key === " " || e.key === "Enter")) { e.preventDefault(); c.classList.add("open"); } };
    const onKeyUp = e => { if (e.key === " " || e.key === "Enter") closeCards(); };
    const noMenu = e => { if (e.target.closest && e.target.closest(".lg-card,.lg-mini")) e.preventDefault(); };
    root.addEventListener("pointerdown", openCard);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("keyup", onKeyUp);
    root.addEventListener("contextmenu", noMenu);
    window.addEventListener("pointerup", closeCards);
    window.addEventListener("pointercancel", closeCards);
    window.addEventListener("blur", closeCards);

    /* --- briques --- */
    const tile = (i, extra) => `<button type="button" class="lg-tile${i === mySeat ? " me" : ""}" data-act="tile" data-i="${i}"${extra || ""}><span class="pic">${bust(i)}</span><span class="rl"></span><span class="bdg"></span><span class="tk" aria-hidden="true">✓</span><b>${esc(name(i))}</b>${i === mySeat ? "<small>toi</small>" : ""}</button>`;
    function lineup(s, B, ticks) {
      return `<div class="lg-line">${P.map((p, i) => {
        const d = !!s.o[i], r = knownRole(s, i, B);
        return `<div class="lg-sus${d ? " dead" : ""}${ticks && ticks.includes(i) ? " done" : ""}" data-i="${i}"><span class="pic">${bust(i, d ? "lose" : null)}</span>${r >= 0 && (d || (B && B.gh) || i !== mySeat) ? `<span class="rl" title="${ROLES[r].n}">${ROLES[r].e}</span>` : ""}<span class="tk">✓</span><b>${esc(p.pseudo)}</b></div>`;
      }).join("")}</div>`;
    }
    const stepTitle = {fall: "Fermez les yeux", cupid: "Cupidon se réveille", wolves: "Les loups se réveillent", seer: "La voyante se réveille", witch: "La sorcière se réveille", dawn: "Le soleil se lève"};
    const roleName = r => (r >= 0 ? ROLES[r].e + " " + ROLES[r].n : "?");
    const stamp = r => `<span class="lg-stamp" style="--rc:${ROLES[r].c}">${ROLES[r].e} ${ROLES[r].n}</span>`;

    /* --- narration (téléphone hôte seulement, texte toujours à l'écran) --- */
    function narrate(s) {
      if (!api.isHost || spokenN === s.n) return;
      spokenN = s.n;
      const A = window.GONFLETTE && GONFLETTE.announcer;
      if (!A || !A.say || (A.on && !A.on())) return;
      const art1 = r => ROLES[r] ? ROLES[r].a : "un mystère";
      let t = "";
      if (s.ph === "deal") t = "Bienvenue à Muscle Beach. Cachez vos écrans… et découvrez votre rôle.";
      else if (s.ph === "night") t = {fall: s.d === 1 ? "La nuit tombe sur Muscle Beach. Tout le monde ferme les yeux." : "La nuit retombe sur Muscle Beach. Tout le monde ferme les yeux.",
        cupid: "Cupidon se réveille… et lie deux cœurs pour la vie.", wolves: "Les loups-garous se réveillent… et choisissent leur victime.",
        seer: "La voyante se réveille… et lit l'avenir au fond de son shaker.", witch: "La sorcière se réveille. Protéines… ou poison ?",
        dawn: "Le soleil se lève sur Muscle Beach. Tout le monde ouvre les yeux."}[s.st] || "";
      else if (s.ph === "day") {
        const dz = s.dz || [];
        if (s.st === "reveal") t = dz.length ? dz.map(i => `${name(i)} nous a quittés. C'était ${art1(+s.rv[i])}.`).join(" ") : "Miracle ! Personne n'est mort cette nuit.";
        else if (s.st === "hunter") t = `${name(s.hs)} était le chasseur ! Dans un dernier souffle… il lance son javelot.`;
        else if (s.st === "shot") t = s.ht >= 0 ? `Le javelot frappe ${name(s.ht)}, qui était ${art1(+s.rv[s.ht])}.` : "Le chasseur a raté son lancer.";
        else if (s.st === "debate") t = "Débattez ! Qui sont les loups-garous ?";
        else if (s.st === "vote") t = s.vc ? "Égalité ! On revote." : "Aux urnes ! Votez pour éliminer un suspect.";
        else if (s.st === "verdict") t = s.el >= 0 ? `Le village élimine ${name(s.el)}. C'était ${art1(+s.rv[s.el])}.` : "Le village n'a pas tranché. Personne n'est éliminé.";
      } else if (s.ph === "end") t = s.win === "v" ? "Victoire du village ! Les loups sont démasqués." : s.win === "l" ? "Victoire des loups-garous ! Muscle Beach est dévoré." : s.win === "a" ? "Les amoureux l'emportent ! L'amour est plus fort que tout." : "Plus personne à Muscle Beach. Match nul.";
      if (t) { try { A.say([{t, rate: .95, pitch: .82}], {cut: true}); } catch (e) {} }
    }

    /* --- nuit : le même écran pour tout le monde --- */
    function nightKind(s, B) {
      if (mySeat < 0) return "spec";
      if (s.o[mySeat]) return "ghost";
      if (!B) return "wait";
      return ACTOR[s.st] === B.r ? s.st : "dummy";
    }
    function buildNight(s, B) {
      const kind = nightKind(s, B);
      if (s.st === "fall" || s.st === "dawn") {
        const dawn = s.st === "dawn";
        main.innerHTML = `<section class="lg-scene"><div class="lg-big">
          <span class="em">${dawn ? "🌅" : "🌙"}</span><h2>${dawn ? "Le soleil se lève…" : "Tout le monde ferme les yeux"}</h2>
          ${dawn ? `<p>Ouvrez les yeux, Muscle Beach se réveille.</p>` : `<div class="lg-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></div>
          <p>Cache ton écran. Chaque nuit, <b>tout le monde</b> touche quelque chose : personne ne doit deviner qui agit.</p>`}</div></section>`;
        return;
      }
      const al = alive(s);
      main.innerHTML = `<section class="lg-scene lg-pad" id="lg-pad">
        <div class="lg-info" id="lg-info" aria-live="polite"></div>
        <div class="lg-grid" id="lg-grid">${al.map(i => tile(i)).join("")}</div>
        ${kind === "ghost" || kind === "spec" ? "" : `<button type="button" class="gk-btn big lg-ok" id="lg-ok" data-act="ok" disabled>Valider</button>`}
        <p class="lg-dn" id="lg-dn"></p>
        <div class="lg-shh" aria-hidden="true"><span>😴</span><b>C'est noté</b>Garde les yeux fermés…</div></section>`;
      if (kind === "dummy") startMq();
    }
    function startMq() {
      stopMq();
      hopMq();
      mqIv = setInterval(() => { if (!ns.ok) hopMq(); }, Math.max(350, 1600 / Math.min(spd(), 3)));
    }
    function stopMq() { if (mqIv) clearInterval(mqIv); mqIv = null; mq = -1; }
    function hopMq() {
      const tiles = [...main.querySelectorAll(".lg-tile")].map(t => +t.dataset.i);
      if (!tiles.length) return;
      let nx = tiles[Math.floor(Math.random() * tiles.length)];
      if (tiles.length > 1) while (nx === mq) nx = tiles[Math.floor(Math.random() * tiles.length)];
      mq = nx;
      main.querySelectorAll(".lg-mq").forEach(x => x.remove());
      const t = main.querySelector(`.lg-tile[data-i="${mq}"]`);
      if (t && !ns.ok) t.insertAdjacentHTML("beforeend", `<span class="lg-mq" aria-hidden="true">🦟</span>`);
      main.querySelectorAll(".lg-tile").forEach(x => x.classList.toggle("mq", +x.dataset.i === mq && !ns.ok));
    }
    function refreshNight(s, B) {
      const pad = main.querySelector("#lg-pad");
      if (!pad) return;
      const kind = nightKind(s, B), info = main.querySelector("#lg-info"), okb = main.querySelector("#lg-ok"), dn = main.querySelector("#lg-dn");
      if (ns.n !== s.n) {
        ns = {n: s.n, p: -1, p2: -1, ok: 0, m: 0, s: 0, q: -1};
        // reprise (rechargement) : la meute et la voyante retrouvent leur choix
        if (kind === "wolves" && B && B.wv) { const me = B.wv.find(w => w[0] === mySeat); if (me) { ns.p = me[1]; ns.ok = me[2]; } }
        if (kind === "seer" && B && B.sh) { const e = B.sh.find(x => x[0] === s.d); if (e) { ns.p = e[1]; ns.ok = 1; } }
      }
      let html = "", canOk = false, done = false, okTxt = "Valider";
      const lover = B && B.lv != null && s.d === 1 && s.st !== "cupid" ? `<span class="love">💘 Cupidon t'a lié(e) à ${esc(name(B.lv))} !</span>` : "";
      const cls = {};   // i -> {sel, sel2, vic, poi, off, bdg, rl}
      const set = (i, k, v) => { (cls[i] = cls[i] || {})[k] = v; };
      if (kind === "dummy" || kind === "wait") {
        html = `${lover}<span class="big">🦟 Un moustique rôde !</span><span>Tape-le <b>3 fois</b> pour garder les yeux bien fermés. <span class="dots">${"●".repeat(Math.min(3, ns.m))}${"○".repeat(Math.max(0, 3 - ns.m))}</span></span>`;
        canOk = ns.m >= 3 && kind === "dummy"; done = ns.ok === 1;
      } else if (kind === "cupid") {
        html = `<span class="big">💘 Choisis deux amoureux</span><span>Touche deux joueurs (toi compris si tu veux). S'il en meurt un, l'autre meurt de chagrin.</span>`;
        if (ns.p >= 0) set(ns.p, "sel2", 1);
        if (ns.p2 >= 0) set(ns.p2, "sel2", 1);
        canOk = ns.p >= 0 && ns.p2 >= 0 && ns.p !== ns.p2; done = ns.ok === 1;
      } else if (kind === "wolves") {
        const wv = (B && B.wv) || [], mates = wv.filter(w => w[0] !== mySeat);
        wv.forEach(w => { set(w[0], "rl", "🐺"); });
        const cnt = {}; wv.forEach(w => { if (w[1] >= 0) cnt[w[1]] = (cnt[w[1]] || 0) + 1; });
        Object.keys(cnt).forEach(t => set(+t, "bdg", "🐺" + (cnt[t] > 1 ? cnt[t] : "")));
        if (ns.p >= 0) set(ns.p, "sel", 1);
        const agree = ns.p >= 0 && mates.every(w => w[1] === ns.p);
        html = `${lover}<span class="big">🐺 Choisissez votre victime</span><span>${mates.length ? `Ta meute : ${mates.map(w => `<b>${esc(name(w[0]))}</b> → ${w[1] >= 0 ? esc(name(w[1])) : "?"}${w[2] ? " ✓" : ""}`).join(" · ")}<br>${agree ? "Vous êtes d'accord, validez !" : "Mettez-vous d'accord (sans un bruit) !"}` : "Tu chasses seul : touche ta victime."}</span>`;
        canOk = agree && ns.ok !== 1;
        done = ns.ok === 1 && mates.every(w => w[1] === ns.p && w[2] === 1);
        if (ns.ok === 1 && !done) okTxt = agree ? "En attente de la meute…" : "Valider";
      } else if (kind === "seer") {
        const e = B && B.sh ? B.sh.find(x => x[0] === s.d) : null;
        if (e) {
          html = `<div class="seen">${art(e[2])}<span><span>Ton shaker révèle que <b>${esc(name(e[1]))}</b> est…</span><br><span class="big" style="color:${ROLES[e[2]].c}">${ROLES[e[2]].n}</span></span></div>`;
          set(e[1], "sel", 1); set(e[1], "rl", ROLES[e[2]].e);
          canOk = ns.ok < 2; okTxt = "J'ai vu ✓"; done = ns.ok === 2;
        } else {
          html = `${lover}<span class="big">🔮 Qui veux-tu sonder ?</span><span>Touche un joueur puis valide : ton shaker révèle son vrai rôle.</span>`;
          if (ns.p >= 0) set(ns.p, "sel", 1);
          canOk = ns.p >= 0 && ns.ok === 0;
          if (ns.ok === 1) okTxt = "Le shaker tourne…";
        }
        if (B && B.sh) B.sh.forEach(x => { if (x[0] !== s.d && !s.o[x[1]]) set(x[1], "rl", ROLES[x[2]].e); });
      } else if (kind === "witch") {
        const pt = (B && B.pt) || [0, 0], vi = B ? B.vi : -1;
        if (vi >= 0) set(vi, "vic", 1);
        if (ns.q >= 0) set(ns.q, "poi", 1);
        html = `${lover}<span class="big">${vi >= 0 ? `🐺 Victime : ${esc(name(vi))}` : "🌙 Aucune victime"}</span>
          <span>${pt[1] ? (ns.q >= 0 ? `☠️ Poison sur <b>${esc(name(ns.q))}</b> (retouche pour annuler)` : "☠️ Touche un joueur pour l'empoisonner.") : "☠️ Potion de mort déjà utilisée."}</span>
          <div class="lg-act">${pt[0] && vi >= 0 ? `<button type="button" class="gk-btn${ns.s ? " on" : " alt"}" data-act="save">💚 ${ns.s ? "Sauvé !" : "Sauver " + esc(name(vi))}</button>` : `<span>${pt[0] ? "💚 Personne à sauver." : "💚 Potion de vie déjà utilisée."}</span>`}</div>`;
        canOk = ns.ok !== 1; done = ns.ok === 1;
      } else if (kind === "ghost") {
        const R = B && B.R;
        if (R) al(s).forEach(i => set(i, "rl", ROLES[+R[i]].e));
        let what = "";
        if (s.st === "cupid") what = B && B.cp ? `Cupidon vise ${B.cp.filter(x => x >= 0).map(x => esc(name(x))).join(" & ") || "…"}` : "Cupidon hésite…";
        if (s.st === "wolves") { const wv = (B && B.wv) || []; wv.forEach(w => { if (w[1] >= 0) set(w[1], "bdg", "🐺"); }); what = wv.map(w => `${esc(name(w[0]))} → ${w[1] >= 0 ? esc(name(w[1])) : "…"}`).join(" · ") || "La meute rôde…"; }
        if (s.st === "seer") { what = B && B.sv >= 0 ? `La voyante sonde ${esc(name(B.sv))}` : "La voyante hésite…"; if (B && B.sv >= 0) set(B.sv, "sel", 1); }
        if (s.st === "witch") { if (B && B.vi >= 0) set(B.vi, "vic", 1); if (B && B.wq >= 0) set(B.wq, "poi", 1); what = `Victime des loups : ${B && B.vi >= 0 ? esc(name(B.vi)) : "personne"}${B && B.ws ? " · 💚 la sorcière la sauve" : ""}${B && B.wq >= 0 ? ` · ☠️ poison sur ${esc(name(B.wq))}` : ""}`; }
        html = `<span class="big">👻 ${stepTitle[s.st] || ""}</span><span>${what}</span>`;
      } else {
        html = `<span class="big">🌙 Le village dort</span><span>Tu regardes en spectateur.</span>`;
      }
      if (info.dataset.h !== html) { info.innerHTML = html; info.dataset.h = html; nbsp(info); }
      main.querySelectorAll(".lg-tile").forEach(t => {
        const i = +t.dataset.i, c = cls[i] || {};
        ["sel", "sel2", "vic", "poi", "off"].forEach(k => t.classList.toggle(k, !!c[k]));
        const b = t.querySelector(".bdg"), r = t.querySelector(".rl");
        if (b.textContent !== (c.bdg || "")) b.textContent = c.bdg || "";
        if (r.textContent !== (c.rl || "")) r.textContent = c.rl || "";
        t.disabled = kind === "ghost" || kind === "spec" || done;
      });
      if (okb) { okb.disabled = !canOk || done; if (okb.textContent !== okTxt) okb.textContent = okTxt; }
      pad.classList.toggle("done", done);
      if (done && mqIv) { stopMq(); main.querySelectorAll(".lg-mq").forEach(x => x.remove()); }
      if (dn) { const t = s.na ? `🌙 ${s.dn || 0}/${s.na} ont les yeux bien fermés` : ""; if (dn.textContent !== t) dn.textContent = t; }
    }
    const al = s => alive(s);
    // typographie française : espace insécable avant ! ? : ; (évite un « ! » orphelin en début de ligne)
    function nbsp(node) {
      try {
        const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let t = w.nextNode(); t; t = w.nextNode()) if (/ [!?:;»]/.test(t.nodeValue)) t.nodeValue = t.nodeValue.replace(/ ([!?:;»])/g, "\u00a0$1");
      } catch (e) {}
    }

    /* --- scènes --- */
    function build(s, B) {
      stopMq();
      const me = mySeat >= 0, ghost = me && !!s.o[mySeat];
      gbar.hidden = !(ghost && s.ph !== "end");
      root.dataset.howl = s.ph === "night" && s.st === "wolves" ? "1" : "0";
      if (s.ph === "deal") {
        kick.textContent = "Les Loups-garous de"; title.textContent = "Muscle Beach";
        const c = compo(N), cnt = {}; c.forEach(r => { cnt[r] = (cnt[r] || 0) + 1; });
        main.innerHTML = `<section class="lg-scene">
          <h2 class="lg-h">${me ? "Cache ton écran !" : "Distribution des rôles"}</h2>
          ${me ? `<p class="lg-lead">Maintiens la carte pour découvrir ton rôle, <b>relâche</b> pour la cacher.</p>${bigCard(B)}
            <button type="button" class="gk-btn good big" id="lg-ready" data-act="ready">J'ai vu, je suis prêt</button>` : `<p class="lg-spec">Tu regardes la partie en spectateur.</p>`}
          <div class="lg-panel"><div class="lg-chips">${[1, 2, 3, 4, 5, 0].filter(r => cnt[r]).map(r => `<span class="lg-chip" style="--rc:${ROLES[r].c}">${ROLES[r].e} ${cnt[r] > 1 ? cnt[r] + " " + ROLES[r].pl : ROLES[r].n}</span>`).join("")}</div></div>
          <div id="lg-rdy">${lineup(s, null, s.rdy)}</div></section>`;
        if (me && (s.rdy || []).includes(mySeat)) { const b = main.querySelector("#lg-ready"); b.disabled = true; b.textContent = "Prêt ! On attend les autres…"; }
      } else if (s.ph === "night") {
        kick.textContent = `Nuit ${s.d}`; title.textContent = stepTitle[s.st] || "La nuit";
        buildNight(s, B);
        if (s.st === "fall") { snd.gong(); }
        if (s.st === "wolves") { snd.howl(); snd.howl(1.3); }
        if (s.st === "dawn") snd.dawn();
      } else if (s.ph === "day") {
        kick.textContent = `Jour ${s.d}`;
        const dz = s.dz || [];
        if (s.st === "reveal") {
          title.textContent = dz.length ? (dz.length > 1 ? "Une nuit sanglante" : "Une victime cette nuit") : "Nuit paisible";
          const step = (1.2 / Math.min(spd(), 4));
          main.innerHTML = `<section class="lg-scene">${dz.length ? `<div class="lg-deaths">${dz.map((i, k) => { const r = +s.rv[i]; return `<div class="lg-death" style="animation-delay:${(k * step + .2).toFixed(2)}s">
              <span class="pic">${bust(i, "lose")}</span><span class="tx"><b>${esc(name(i))}${i === mySeat ? " (toi)" : ""}</b><small>${CAUSE_E[s.c[i]] || ""} ${CAUSE[s.c[i]] || ""}</small>${stamp(r)}</span></div>`; }).join("")}</div>`
            : `<div class="lg-big"><span class="em">🌅</span><h2>Personne n'est mort cette nuit !</h2><p>Les loups ont fait chou blanc… ou quelqu'un a bu une bonne protéine.</p></div>`}
            ${lineup(s, B)}</section>`;
          later(() => (dz.length ? snd.thud() : snd.dawn()), 300);
        } else if (s.st === "hunter" || s.st === "shot") {
          title.textContent = s.st === "hunter" ? "Le dernier lancer" : (s.ht >= 0 ? "En plein dans le mille" : "Lancer raté");
          const mine = s.st === "hunter" && s.hs === mySeat;
          if (s.st === "hunter") {
            main.innerHTML = `<section class="lg-scene"><div class="lg-hero gone"><span class="pic lg-aim">${bust(s.hs, "fight")}</span><span class="who">${esc(name(s.hs))}</span>${stamp(4)}</div>
              ${mine ? `<p class="lg-lead"><b>Tu es mort, mais pas seul !</b> Touche un joueur puis lance ton javelot.</p><div class="lg-grid" id="lg-grid">${alive(s).map(i => tile(i)).join("")}</div>
                <button type="button" class="gk-btn red big" id="lg-ok" data-act="ok" disabled>🎯 Lancer le javelot</button>`
                : `<p class="lg-lead">Le chasseur <b>${esc(name(s.hs))}</b> vise… Il a 30 secondes pour emporter quelqu'un avec lui.</p>${lineup(s, B)}`}</section>`;
            hsel = -1;
          } else {
            main.innerHTML = `<section class="lg-scene">${s.ht >= 0 ? `<p class="lg-lead">🎯 Le javelot de <b>${esc(name(s.hs))}</b> frappe…</p><div class="lg-deaths">${dz.map((i, k) => `<div class="lg-death" style="animation-delay:${(k * .9 + .3).toFixed(2)}s"><span class="pic">${bust(i, "lose")}</span><span class="tx"><b>${esc(name(i))}${i === mySeat ? " (toi)" : ""}</b><small>${CAUSE_E[s.c[i]]} ${CAUSE[s.c[i]]}</small>${stamp(+s.rv[i])}</span></div>`).join("")}</div>`
              : `<div class="lg-big"><span class="em">🎯</span><h2>Le javelot se perd dans le sable</h2><p>Le chasseur n'a emporté personne.</p></div>`}${lineup(s, B)}</section>`;
            later(() => snd.thud(), 400);
          }
        } else if (s.st === "debate") {
          title.textContent = "Le débat";
          const can = amAlive(s), need = Math.floor(alive(s).length / 2) + 1;
          const lastNight = (s.lg || []).filter(e => e[0] === s.d * 2 - 1 || e[0] === s.d * 2);
          main.innerHTML = `<section class="lg-scene">
            <div class="lg-panel"><ul class="lg-tips"><li>Débattez <b>à voix haute</b> : qui a l'air louche ?</li><li>${lastNight.length ? `Morts : ${lastNight.map(e => `<b>${esc(name(e[1]))}</b> (${roleName(+s.rv[e[1]])})`).join(", ")}` : "Personne n'est mort cette nuit."}</li><li>Puis votez pour éliminer un suspect.</li></ul></div>
            ${lineup(s, B)}
            ${can ? `<div class="lg-skip"><button type="button" class="gk-btn red big" id="lg-skip" data-act="skip">🗳️ On vote !</button><small id="lg-skc"></small></div>` : `<p class="lg-spec" id="lg-skc"></p>`}
            </section>`;
          main.dataset.need = need;
        } else if (s.st === "vote") {
          title.textContent = s.vc ? "Égalité : on revote" : "Le vote";
          if (voteN !== s.n) { voteN = s.n; myVote = -1; }
          const can = amAlive(s), cands = s.vc || alive(s);
          main.innerHTML = `<section class="lg-scene">
            <p class="lg-lead">${s.vc ? `<b>Égalité !</b> Second vote entre ${s.vc.map(i => `<b>${esc(name(i))}</b>`).join(" et ")}.` : can ? "Touche le joueur à éliminer. Tu peux changer d'avis tant que le vote est ouvert." : "Les vivants votent…"}</p>
            <div class="lg-grid" id="lg-grid">${alive(s).map(i => tile(i, !can || i === mySeat || !cands.includes(i) ? " disabled" : "")).join("")}</div>
            <div class="lg-panel lg-tally" id="lg-tally"></div></section>`;
          main.querySelectorAll(".lg-tile").forEach(t => { if (!cands.includes(+t.dataset.i)) t.classList.add("off"); });
        } else if (s.st === "verdict") {
          title.textContent = "Le verdict";
          if (s.el >= 0) {
            const extra = dz.filter(i => i !== s.el);
            main.innerHTML = `<section class="lg-scene"><div class="lg-hero gone"><span class="pic">${bust(s.el, "lose")}</span><span class="who">${esc(name(s.el))}${s.el === mySeat ? " (toi)" : ""}</span><span class="lg-lead">était…</span>${stamp(+s.rv[s.el])}</div>
              ${extra.map(i => `<div class="lg-death" style="animation-delay:1.6s"><span class="pic">${bust(i, "lose")}</span><span class="tx"><b>${esc(name(i))}</b><small>${CAUSE_E[s.c[i]]} ${CAUSE[s.c[i]]}</small>${stamp(+s.rv[i])}</span></div>`).join("")}
              <p class="lg-lead lg-after">${+s.rv[s.el] === 1 ? "🐺 Un loup de moins à Muscle Beach !" : "😱 Un innocent tombe… les loups ricanent."}</p></section>`;
            later(() => snd.thud(), 900 / Math.min(spd(), 4));
          } else {
            main.innerHTML = `<section class="lg-scene"><div class="lg-big"><span class="em">🤷</span><h2>${s.how === "e" ? "Encore égalité !" : "Personne n'a voté"}</h2><p>Le village n'a pas tranché : personne n'est éliminé aujourd'hui.</p></div>${lineup(s, B)}</section>`;
          }
        }
      } else if (s.ph === "end") {
        kick.textContent = "Fin de partie";
        const W = s.win, mx = !!s.mx, L = s.L || null, inLove = i => !!L && mx && L.includes(i);
        const isW = i => W === "v" ? +s.R[i] !== 1 && !inLove(i) : W === "l" ? +s.R[i] === 1 && !inLove(i) : W === "a" ? !!L && L.includes(i) : false;
        title.textContent = W === "v" ? "Victoire du village" : W === "l" ? "Victoire des loups" : W === "a" ? "Victoire des amoureux" : "Match nul";
        root.dataset.sky = W === "l" ? "night" : "day";
        const order = P.map((_, i) => i).sort((a, b) => (isW(b) - isW(a)) || ((s.o[a] || 999) > (s.o[b] || 999) ? -1 : (s.o[a] || 999) < (s.o[b] || 999) ? 1 : a - b));
        main.innerHTML = `<section class="lg-scene">
          <div class="lg-win"><span class="em">${W === "v" ? "☀️" : W === "l" ? "🐺" : W === "a" ? "💘" : "🏝️"}</span><h2>${title.textContent}</h2>
            <p>${W === "v" ? "Tous les loups sont démasqués. Séance de muscu offerte&nbsp;!" : W === "l" ? "La meute est aussi nombreuse que les villageois&nbsp;: festin&nbsp;!" : W === "a" ? "Les deux amoureux restent seuls sur la plage." : "Il ne reste plus personne…"}</p></div>
          <ul class="lg-roster">${order.map((i, k) => { const r = +s.R[i]; return `<li class="${isW(i) ? "w" : ""}${s.o[i] ? " d" : ""}" style="animation-delay:${(.2 + k * .08).toFixed(2)}s"><span class="pic">${av(i, {view: "bust", mood: isW(i) ? "win" : s.o[i] ? "lose" : null})}</span>
            <span class="nm">${esc(name(i))}${i === mySeat ? " (toi)" : ""}${L && L.includes(i) ? " 💘" : ""}<small>${s.o[i] ? `${CAUSE_E[s.c[i]] || ""} ${CAUSE[s.c[i]] || ""}` : "Survivant"}</small></span>
            <span class="tag" style="--rc:${ROLES[r].c}">${ROLES[r].e} ${ROLES[r].n}</span>${isW(i) ? `<span class="star" aria-label="gagnant">★</span>` : ""}</li>`; }).join("")}</ul>
          <div class="lg-panel"><h3 class="lg-h" style="font-size:1.3rem;text-align:left;margin-bottom:8px">Journal de Muscle Beach</h3><ol class="lg-log">${logHTML(s)}</ol></div></section>`;
        const iWon = mySeat >= 0 && isW(mySeat);
        later(() => { if (W === "l") snd.howl(); else snd.dawn(); }, 300);
        if (iWon) api.haptic && api.haptic("success");
      }
      nbsp(main); nbsp(title);
      if (el.scrollTo) el.scrollTo({top: 0});
    }
    function logHTML(s) {
      const out = [], L = s.L || null, nm = i => esc(name(i));
      const deaths = tg => (s.lg || []).filter(e => e[0] === tg).map(e => `${CAUSE_E[e[2]]} ${nm(e[1])} <i>(${ROLES[+s.R[e[1]]].n})</i>`);
      const maxTag = Math.max(0, ...(s.lg || []).map(e => e[0]), s.d * 2);
      for (let k = 1; k * 2 - 1 <= maxTag; k++) {
        const e = (s.nl || []).find(x => x[0] === k), bits = [];
        if (e) {
          if (k === 1 && L) bits.push(`💘 Cupidon lie ${nm(L[0])} et ${nm(L[1])}`);
          bits.push(e[1] >= 0 ? `🐺 les loups attaquent ${nm(e[1])}` : "🐺 les loups n'attaquent personne");
          if (e[2] >= 0) bits.push(`🔮 la voyante sonde ${nm(e[2])} (${ROLES[+s.R[e[2]]].n})`);
          if (e[3]) bits.push("💚 la sorcière sauve la victime");
          if (e[4] >= 0) bits.push(`☠️ la sorcière empoisonne ${nm(e[4])}`);
        }
        const dn = deaths(k * 2 - 1);
        if (bits.length || dn.length) out.push(`<li class="n"><b>Nuit ${k}</b>${bits.join(" · ")}${dn.length ? ` → ${dn.join(", ")}` : ""}</li>`);
        const dd = deaths(k * 2);
        if (k * 2 <= maxTag && dd.length) out.push(`<li class="j"><b>Jour ${k}</b>${dd.join(", ")}</li>`);
      }
      return out.join("") || "<li>Rien à signaler.</li>";
    }

    function update(s, B) {
      const timed = s.ph === "deal" || (s.ph === "night" && !!ACTOR[s.st]) || (s.ph === "day" && ["hunter", "debate", "vote"].includes(s.st));
      clock.hidden = !timed;
      if (timed) {
        const txt = s.t >= 60 ? Math.floor(s.t / 60) + ":" + String(s.t % 60).padStart(2, "0") : String(s.t);
        if (clock.textContent !== txt) clock.textContent = txt;
        clock.classList.toggle("urg", s.t <= 5);
        if (lastT !== null && s.t !== lastT && s.t <= 5 && s.t > 0 && s.ph === "day") snd.tick();
      }
      lastT = timed ? s.t : null;
      if (s.ph === "deal") main.querySelectorAll(".lg-sus").forEach(x => x.classList.toggle("done", (s.rdy || []).includes(+x.dataset.i)));
      if (s.ph === "night") refreshNight(s, B);
      if (s.ph === "day" && s.st === "debate") {
        const c = main.querySelector("#lg-skc"), need = +main.dataset.need || 1, n = (s.sk || []).length;
        if (c) c.textContent = `${n}/${need} pour passer au vote`;
        const b = main.querySelector("#lg-skip");
        if (b && (s.sk || []).includes(mySeat)) { b.disabled = true; b.textContent = "✓ Tu veux voter"; }
      }
      if (s.ph === "day" && s.st === "vote") {
        const cnt = {}, by = {};
        (s.vt || []).forEach(([v, t]) => { cnt[t] = (cnt[t] || 0) + 1; (by[t] = by[t] || []).push(name(v)); });
        const mine = (s.vt || []).find(v => v[0] === mySeat);
        if (mine) myVote = mine[1];
        main.querySelectorAll(".lg-tile").forEach(t => {
          const i = +t.dataset.i; t.classList.toggle("sel", i === myVote);
          const b = t.querySelector(".bdg"), v = cnt[i] ? String(cnt[i]) : "";
          if (b.textContent !== v) b.textContent = v;
        });
        const tl = main.querySelector("#lg-tally");
        if (tl) {
          const voters = (s.vt || []).length, al = alive(s).length;
          const h = `<span><b>${voters}/${al}</b> ont voté</span>${Object.keys(by).sort((a, b) => cnt[b] - cnt[a]).map(t => `<span><b>${esc(name(+t))}</b> ← ${by[t].map(esc).join(", ")}</span>`).join("")}`;
          if (tl.dataset.h !== h) { tl.innerHTML = h; tl.dataset.h = h; }
        }
      }
      if (s.ph === "day" && s.st === "hunter" && s.hs === mySeat) {
        main.querySelectorAll(".lg-tile").forEach(t => t.classList.toggle("sel", +t.dataset.i === hsel));
        const b = main.querySelector("#lg-ok"); if (b) b.disabled = hsel < 0;
      }
      // carte secrète (maintenir) en bas
      const showSec = mySeat >= 0 && s.ph !== "deal" && s.ph !== "end" && !!B;
      const k = showSec ? JSON.stringify([B.r, B.lv, B.wf, B.pt, B.sh, B.gh]) : "";
      if (k !== secKey) { secKey = k; sec.innerHTML = showSec ? miniCard(B) : ""; }
      sec.hidden = !showSec;
    }

    /* --- gestes --- */
    function onClick(e) {
      const b = e.target.closest && e.target.closest("[data-act]");
      if (!b || b.disabled || !S) return;
      snd.unlock();
      const act = b.dataset.act, s = S, B = myBlob();
      if (act === "ready" && s.ph === "deal") {
        send({n: s.n, a: "rdy"}); b.disabled = true; b.textContent = "Prêt ! On attend les autres…"; api.sfx && api.sfx("tap");
        return;
      }
      if (act === "skip" && s.ph === "day" && s.st === "debate" && amAlive(s)) {
        if (sentSkip === s.n) return;
        sentSkip = s.n; send({n: s.n, a: "sk"}); b.disabled = true; b.textContent = "✓ Tu veux voter"; api.sfx && api.sfx("tap");
        return;
      }
      if (s.ph === "day" && s.st === "vote" && act === "tile") {
        const i = +b.dataset.i;
        if (!amAlive(s) || i === mySeat || i === myVote) return;
        myVote = i; send({n: s.n, a: "v", k: i}); api.sfx && api.sfx("tap"); api.haptic && api.haptic("light");
        update(s, B); return;
      }
      if (s.ph === "day" && s.st === "hunter" && s.hs === mySeat) {
        if (act === "tile") { const i = +b.dataset.i; if (i !== mySeat) { hsel = i; api.haptic && api.haptic("light"); update(s, B); } }
        if (act === "ok" && hsel >= 0) { send({n: s.n, a: "sh", k: hsel}); b.disabled = true; api.haptic && api.haptic("heavy"); }
        return;
      }
      if (s.ph !== "night" || !ACTOR[s.st] || !amAlive(s)) return;
      const kind = nightKind(s, B);
      if (ns.n !== s.n) refreshNight(s, B);
      api.haptic && api.haptic("light");   // la nuit : vibration discrète, pas de son
      if (act === "tile") {
        const i = +b.dataset.i;
        if (kind === "dummy") {
          if (ns.ok) return;
          if (i === mq) { ns.m = Math.min(9, ns.m + 1); hopMq(); sendX(); }
          else { b.classList.remove("miss"); void b.offsetWidth; b.classList.add("miss"); }
        } else if (kind === "cupid") {
          if (ns.ok) return;
          if (ns.p === i) { ns.p = ns.p2; ns.p2 = -1; }
          else if (ns.p2 === i) ns.p2 = -1;
          else if (ns.p < 0) ns.p = i;
          else if (ns.p2 < 0) ns.p2 = i;
          else { ns.p = ns.p2; ns.p2 = i; }
          sendX();
        } else if (kind === "wolves") {
          if (knownRole(s, i, B) === 1) return;
          if (ns.p === i && ns.ok !== 1) return;
          ns.p = i; ns.ok = 0; sendX();
        } else if (kind === "seer") {
          if (ns.ok || i === mySeat) return;
          ns.p = i; sendX();
        } else if (kind === "witch") {
          const pt = (B && B.pt) || [0, 0];
          if (ns.ok || !pt[1] || i === mySeat || i === (B ? B.vi : -1)) return;
          ns.q = ns.q === i ? -1 : i; sendX();
        }
      } else if (act === "save" && kind === "witch" && !ns.ok) {
        ns.s = ns.s ? 0 : 1; sendX();
      } else if (act === "ok") {
        if (kind === "dummy" && ns.m >= 3) ns.ok = 1;
        else if (kind === "cupid" && ns.p >= 0 && ns.p2 >= 0) ns.ok = 1;
        else if (kind === "wolves" && ns.p >= 0) ns.ok = 1;
        else if (kind === "seer") { if (ns.ok === 0 && ns.p >= 0) ns.ok = 1; else if (B && B.sh && B.sh.find(x => x[0] === s.d)) ns.ok = 2; }
        else if (kind === "witch") ns.ok = 1;
        sendX();
      }
      refreshNight(s, B);
    }
    main.addEventListener("click", onClick);

    function render(s) {
      if (dead || !s || !s.ph || s.ph === "done") return;
      S = s;
      const B = myBlob();
      root.dataset.ph = s.ph; root.dataset.st = s.st || ""; root.dataset.n = s.n;
      if (s.ph !== "end") root.dataset.sky = s.ph === "day" ? "day" : "night";
      if (lastEvN === null) lastEvN = s.ev ? s.ev.n : 0;
      if (s.ev && s.ev.n !== lastEvN) {
        lastEvN = s.ev.n;
        const i = s.ev.i, r = s.rv && s.rv[i] !== "-" ? +s.rv[i] : -1;
        if (P[i] && i !== mySeat) api.toast(`🚪 ${P[i].pseudo} a quitté le village${r >= 0 ? " : c'était " + ROLES[r].a : ""}`);
      }
      const key = [s.ph, s.st, s.n, s.o.filter(Boolean).length, B ? 1 : 0, mySeat >= 0 && s.o[mySeat] ? 1 : 0].join(":");
      if (key !== sceneKey) {
        const sameScene = sceneKey.split(":").slice(0, 3).join(":") === key.split(":").slice(0, 3).join(":");
        sceneKey = key;
        build(s, B);
        if (!sameScene) narrate(s);
      }
      update(s, B);
    }
    // première entrée : faire connaître ma clé publique à l'hôte
    if (mySeat >= 0 && HAS_BIG) send({});
    api.onState(render);
    if (MOCK) window.__lgDbg = {S: () => S, blob: () => myBlob(), seat: mySeat, ns: () => ns, mq: () => mq};

    return {
      destroy() {
        dead = true;
        clearInterval(hostInt); stopMq();
        timers.forEach(t => clearTimeout(t)); timers.clear();
        main.removeEventListener("click", onClick);
        root.removeEventListener("pointerdown", openCard);
        root.removeEventListener("keydown", onKeyDown);
        root.removeEventListener("keyup", onKeyUp);
        root.removeEventListener("contextmenu", noMenu);
        window.removeEventListener("pointerup", closeCards);
        window.removeEventListener("pointercancel", closeCards);
        window.removeEventListener("blur", closeCards);
        snd.close();
        if (window.__lgDbg) delete window.__lgDbg;
        el.innerHTML = "";
      }
    };
  }
});
})();
