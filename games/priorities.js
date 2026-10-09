/* Gonflette Party : Priorities (3 à 8 joueurs, chacun sur son téléphone).
   Ambiance jeu télé du samedi soir : plateau « PRIORITIES », projecteurs, grosses cartes brillantes.
   Chaque manche, un joueur est « la Vedette ». 5 cartes sont tirées (paquet : games/priorities-deck.js, ~1700 cartes).
   La Vedette les classe en secret de « J'ADORE ❤️ » (N°1) à « JE DÉTESTE 💀 » (N°5) ; les autres essaient de deviner
   son classement sur leur téléphone (glisser-déposer, ou toucher une carte puis une place, ou ▲▼).
   Révélation carte par carte du N°1 au N°5. Points : carte pile à la bonne place = 2, à une place près = 1,
   5/5 = +3 bonus. La Vedette marque la moyenne (arrondie) des points de ses devineurs : elle a intérêt à être honnête
   et le tour de Vedette vaut une manche normale, quel que soit le nombre de joueurs.
   Manches : une par joueur (deux chacun à 3 joueurs).

   Réseau (hôte = autorité) :
   - Entrée joueur, absolue et renvoyée régulièrement : {seq, r: manche, o: "31042" (ordre courant : N°1..N°5 →
     numéro de carte 0..4), ok: 0|1 (validé)}. Les entrées d'une autre manche ou hors phase de tri sont ignorées.
   - État : ph (intro|sort|lock|rev|sum|skip|end), r, V (ordre des vedettes, sièges), v, c (5 numéros de cartes du paquet),
     t (secondes restantes), g (ordres reçus, celui de la Vedette brouillé), ok, k (avancement), puis à la révélation
     vo (ordre de la Vedette), G (ordres des devineurs), p (points de la manche), ri (cartes révélées),
     S/E/X/VA/VN (totaux, cartes exactes, 5/5, moyenne ×10 reçue comme Vedette, nb de tours de Vedette), u (cartes déjà vues).
   - resumable : l'hôte rechargé repart de api.resume (l'état publié contient toute la partie).
   - Vedette déconnectée (hors délai de grâce) sans avoir validé : manche sautée. Devineurs déconnectés : ignorés.
   Tests : window.__prioSpeed = 10 accélère les durées (lu par l'hôte et pour les animations). */
(function () {
"use strict";
const GG = window.GONFLETTE = window.GONFLETTE || {};

/* ---------- paquet ---------- */
const FALLBACK = [{id: "mix", n: "En vrac", e: "🎲", c1: "#a066ff", c2: "#5b1fd1",
  l: "🧱 Minecraft|⚡ Harry Potter|😈 L'égoïsme|🍍 L'ananas|🏋️ Le powerlifting|🗓️ Les lundis matin|🧦 Les chaussettes dans les claquettes|🎤 Le karaoké|🐦 Les pigeons|🦵 Le jour de jambes|🍕 La pizza|🏖️ La plage|💤 La sieste|🐱 Les chats|🎄 Noël|🥦 Le brocoli|📱 TikTok|🎳 Le bowling|🌧️ La pluie|🧀 Le fromage qui pue"}];
const RAWDECK = Array.isArray(GG.prioritiesDeck) && GG.prioritiesDeck.length >= 5 ? GG.prioritiesDeck : FALLBACK;
const CATS = [], DECK = [], BYCAT = [];
RAWDECK.forEach((cat, ci) => {
  CATS.push({n: cat.n, e: cat.e || "🎲", c1: cat.c1 || "#a066ff", c2: cat.c2 || "#5b1fd1"});
  BYCAT.push([]);
  String(cat.l || "").split("|").forEach(raw => {
    const it = raw.replace(/\s+/g, " ").trim(); if (!it) return;
    const sp = it.indexOf(" ");
    let e = sp > 0 ? it.slice(0, sp) : "", t = sp > 0 ? it.slice(sp + 1) : it;
    if (/[A-Za-zÀ-ÿ0-9«]/.test(e) && !/️|⃣/.test(e)) { e = cat.e || "🎲"; t = it; }
    BYCAT[ci].push(DECK.length); DECK.push({e, t, k: ci});
  });
});
const card = i => DECK[i] || {e: "❔", t: "?", k: 0};

/* ---------- réglages ---------- */
const T = {intro1: 8, intro: 5, lock: 1.4, lead: 1.2, card: 3.3, hold: 3.6, sum: 10, end: 10, skip: 4.5};
const sortTime = n => n <= 3 ? 70 : n <= 4 ? 75 : n <= 6 ? 65 : 55;
const SLOT = [
  {c: "#ff2d6f", l: "J'adore"}, {c: "#ff7a45", l: "J'aime bien"}, {c: "#f5b52e", l: "Bof"},
  {c: "#8f86b8", l: "J'aime pas"}, {c: "#4b4468", l: "Je déteste"}];
const RECENT_KEY = "gonflette-prio-recent", RECENT_MAX = 600;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const validO = o => typeof o === "string" && /^[0-4]{5}$/.test(o) && new Set(o).size === 5;
const ekey = (r, i) => (i * 2 + r * 3 + 1) % 5;
const encO = (o, r) => o.split("").map((d, i) => (+d + ekey(r, i)) % 5).join("");
const decO = (o, r) => typeof o === "string" && o.length === 5 ? o.split("").map((d, i) => (((+d - ekey(r, i)) % 5) + 5) % 5).join("") : "";
const posOf = vo => { const p = []; for (let s = 0; s < 5; s++) p[+vo[s]] = s; return p; };
function score(vo, go) {
  const pos = posOf(vo); let pts = 0, ex = 0, near = 0;
  for (let s = 0; s < 5; s++) { const d = Math.abs(pos[+go[s]] - s); if (!d) { pts += 2; ex++; } else if (d === 1) { pts += 1; near++; } }
  if (ex === 5) pts += 3;
  return {pts, ex, near};
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const andList = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1];

const CSS = `
.pri{--ink:#120a24;--b1:#241258;--b2:#0b0620;--gold:#ffc83d;--pink:#ff2d6f;--cyan:#2ee6ff;--tx:#fff7e8;--dim:#bdb2dc;--ok:#2fd27a;--near:#ffb020;--ko:#ff4d5e;
  --ch:clamp(50px,calc((100vh - 440px) / 5.25),78px);--gap:7px;
  position:relative;min-height:100%;box-sizing:border-box;padding:0 0 26px;color:var(--tx);overflow-x:clip;
  font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;font-size:17px;line-height:1.2;
  background:radial-gradient(70% 38% at 50% 0%,rgba(255,45,111,.30),transparent 70%),radial-gradient(90% 50% at 50% 105%,rgba(46,230,255,.16),transparent 70%),
    repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 2px,transparent 2px 46px),linear-gradient(180deg,var(--b1),var(--b2) 75%);background-color:var(--b2)}
@supports (height:100dvh){.pri{--ch:clamp(50px,calc((100dvh - 440px) / 5.25),78px)}}
.pri *{box-sizing:border-box}
.pri button{font-family:inherit}
/* bandeau du show */
.pri-top{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:8px;padding:6px max(12px,calc(50% - 290px));background:linear-gradient(180deg,#341a7c,#1c0d45);border-bottom:3px solid var(--gold);box-shadow:0 3px 0 var(--ink)}
.pri-logo{flex:none;position:relative;padding:3px 12px 2px;border-radius:999px;background:#0d0623;border:3px dotted #ffe7a0;font-family:"Anton",Impact,sans-serif;font-size:21px;letter-spacing:.07em;line-height:1.1;
  color:var(--gold);text-shadow:2px 2px 0 var(--pink);animation:pri-bulbs 1.2s steps(2) infinite}
.pri-rd{flex:1;min-width:0;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pri-rd b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:18px;letter-spacing:.04em;color:#fff}
.pri-clock{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-family:"Anton",Impact,sans-serif;font-size:19px;color:#fff;font-variant-numeric:tabular-nums;
  background:radial-gradient(circle,#1c0d45 56%,transparent 57%),conic-gradient(var(--gold) calc(var(--p,1) * 360deg),rgba(255,255,255,.14) 0)}
.pri-clock.pri-hot{background:radial-gradient(circle,#1c0d45 56%,transparent 57%),conic-gradient(var(--pink) calc(var(--p,1) * 360deg),rgba(255,255,255,.14) 0);animation:pri-pulse 1s ease-in-out infinite}
.pri-clock[hidden]{display:none}
.pri-page{max-width:560px;margin:0 auto;padding:10px 16px 0}
.pri-h{margin:4px 0 8px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(26px,8vw,36px);line-height:1.02;text-transform:uppercase;text-shadow:3px 3px 0 var(--ink)}
.pri-h em{font-style:normal;color:var(--gold)}
.pri-sub{margin:0 0 10px;font-weight:600;color:var(--dim);font-size:17px}
.pri-av{display:block;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#fff3c4,#ffc83d 65%,#c7901a);border:3px solid var(--ink)}
.pri-av svg,.pri-full svg{width:100%;height:100%;display:block}
.pri-gone{opacity:.42;filter:grayscale(1)}
/* Vedette */
.pri-who{display:flex;align-items:center;gap:10px;margin:0 0 6px}
.pri-who .pri-av{flex:none;width:54px;height:54px;box-shadow:0 0 0 3px var(--gold),0 0 24px rgba(255,200,61,.55)}
.pri-who div{min-width:0}
.pri-who small{display:block;font-weight:800;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.pri-who b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:24px;line-height:1.05;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pri-who em{display:block;font-style:normal;font-weight:600;color:var(--dim);font-size:15px;line-height:1.1}
/* échelle */
.pri-end{display:flex;align-items:center;gap:8px;margin:2px 0 5px 2px;font-family:"Anton",Impact,sans-serif;font-size:17px;letter-spacing:.07em;line-height:1}
.pri-end.pri-love{color:#ff6b97}.pri-end.pri-hate{color:#a79fc9;margin:5px 0 2px 2px}
.pri-end i{flex:1;height:2px;background:linear-gradient(90deg,currentColor,transparent);opacity:.6}
.pri-rail{position:relative;display:grid;gap:var(--gap)}
.pri-rail::before{content:"";position:absolute;left:16px;top:12px;bottom:12px;width:6px;border-radius:3px;background:linear-gradient(#ff2d6f,#ff7a45 30%,#f5b52e 50%,#8f86b8 75%,#4b4468)}
.pri-slot{position:relative;height:var(--ch);display:flex;align-items:center;gap:8px}
.pri-num{position:relative;flex:none;width:38px;height:38px;padding:0;border-radius:50%;display:grid;place-items:center;font-family:"Anton",Impact,sans-serif!important;font-size:20px;color:#fff;
  background:var(--sc);border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink);cursor:pointer}
.pri-num.pri-dk{color:var(--ink)}
.pri-hole{flex:1;height:100%;border-radius:14px;border:2px dashed rgba(255,255,255,.2);background:rgba(255,255,255,.04)}
.pri-layer{position:absolute;top:0;bottom:0;left:46px;right:0}
.pri-card{position:absolute;left:0;right:0;top:0;height:var(--ch);display:flex;align-items:center;gap:9px;padding:0 6px 0 6px;border-radius:14px;
  background:linear-gradient(180deg,var(--c1),var(--c2));border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.45);
  color:#fff;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;outline:none;
  transition:transform .22s cubic-bezier(.2,.9,.3,1.15),box-shadow .2s;will-change:transform;-webkit-tap-highlight-color:transparent}
.pri-card::after{content:"";position:absolute;left:4px;right:4px;top:3px;height:42%;border-radius:10px 10px 50% 50%/10px 10px 12px 12px;background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,0));pointer-events:none}
.pri-card:focus-visible{box-shadow:0 0 0 3px #fff,0 4px 0 var(--ink)}
.pri-emo{flex:none;width:calc(var(--ch) - 16px);height:calc(var(--ch) - 16px);border-radius:50%;background:#fff;border:2px solid var(--ink);display:grid;place-items:center;font-size:calc(var(--ch) * .4);line-height:1;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.pri-tx{position:relative;z-index:1;flex:1;min-width:0;display:grid;gap:1px}
.pri-tx small{font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pri-tx b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(16px,4.9vw,21px);line-height:1.04;text-transform:uppercase;letter-spacing:.01em;text-shadow:2px 2px 0 rgba(0,0,0,.35);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.pri-tx b.pri-long{font-size:clamp(14px,4.1vw,17px);-webkit-line-clamp:3}
.pri-grip{flex:none;width:16px;height:30px;background:radial-gradient(circle,rgba(255,255,255,.85) 2px,transparent 2.6px) 0 0/8px 8px;opacity:.75}
.pri-ud{display:none;flex:none;gap:4px;position:relative;z-index:2}
.pri-ud button{width:44px;height:44px;min-height:44px;padding:0;border-radius:12px;border:3px solid var(--ink);background:#fff;color:var(--ink);font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 3px 0 var(--ink)}
.pri-ud button:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.pri-ud button:disabled{opacity:.35;box-shadow:none}
.pri-card.pri-sel{z-index:3;box-shadow:0 0 0 3px var(--gold),0 0 22px rgba(255,200,61,.65),0 4px 0 var(--ink);animation:pri-wig 1.4s ease-in-out infinite}
.pri-card.pri-sel .pri-ud{display:flex}.pri-card.pri-sel .pri-grip{display:none}
.pri-card.pri-sel .pri-emo{width:calc(var(--ch) - 22px);height:calc(var(--ch) - 22px)}
.pri-card.pri-drag{transition:none;z-index:6;cursor:grabbing;box-shadow:0 18px 28px rgba(0,0,0,.55),0 4px 0 var(--ink)}
.pri-pick .pri-num{animation:pri-pulse 1s ease-in-out infinite}
.pri-locked .pri-card{cursor:default;filter:saturate(.85) brightness(.92)}
.pri-locked .pri-grip{opacity:.25}
.pri-stamp{position:absolute;z-index:7;right:-4px;top:-14px;padding:3px 12px 2px;border:3px solid var(--ink);border-radius:8px;background:var(--ok);color:var(--ink);font-family:"Anton",Impact,sans-serif;font-size:19px;letter-spacing:.06em;transform:rotate(6deg);animation:pri-pop .35s cubic-bezier(.3,1.6,.6,1);pointer-events:none}
.pri-stamp.pri-lk{background:var(--gold)}
.pri-act{display:flex;gap:8px;align-items:center;margin-top:12px}
.pri-act .gk-btn{flex:1}
.pri-act .gk-btn.alt{flex:none}
.pri-hint{margin:6px 0 0;text-align:center;font-weight:600;font-size:14px;color:var(--dim)}
.pri-chips{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:8px}
.pri-chip{display:flex;align-items:center;gap:4px;padding:2px 8px 2px 2px;border-radius:999px;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.18);font-weight:700;font-size:14px;max-width:46%}
.pri-chip .pri-av{width:24px;height:24px;border-width:2px;flex:none}
.pri-chip span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pri-chip.pri-done{background:rgba(47,210,122,.22);border-color:var(--ok)}
.pri-chip.pri-star{border-color:var(--gold)}
/* aperçu des cartes (intro, spectateur) */
.pri-deal{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:7px}
.pri-deal li{display:flex;align-items:center;gap:9px;min-height:50px;padding:4px 10px 4px 5px;border-radius:13px;background:linear-gradient(180deg,var(--c1),var(--c2));border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink);
  animation:pri-dealin .5s cubic-bezier(.2,1.3,.5,1) backwards;animation-delay:calc(var(--i) * 110ms)}
.pri-deal .pri-emo{width:38px;height:38px;font-size:21px}
.pri-deal b{flex:1;min-width:0;text-align:left;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:18px;line-height:1.05;text-transform:uppercase;text-shadow:2px 2px 0 rgba(0,0,0,.3);overflow-wrap:anywhere}
.pri-deal small{flex:none;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;max-width:34%;text-align:right}
/* intro */
.pri-intro{text-align:center}
.pri-marq{display:inline-block;margin:4px 0 0;padding:4px 14px 3px;border-radius:999px;background:var(--pink);border:3px solid var(--ink);font-family:"Anton",Impact,sans-serif;font-size:18px;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 3px 0 var(--ink);transform:rotate(-2deg)}
.pri-hero{position:relative;width:min(170px,44vw);margin:2px auto 0}
.pri-hero::before{content:"";position:absolute;left:50%;top:-30px;width:150%;height:130%;transform:translateX(-50%);background:conic-gradient(from 160deg at 50% 0%,transparent 0deg,rgba(255,240,180,.35) 20deg,transparent 40deg);pointer-events:none;animation:pri-beam 3s ease-in-out infinite alternate}
.pri-full{display:block;position:relative;aspect-ratio:290/250}
.pri-hero figcaption{position:relative;margin-top:-6px;font-family:"Anton",Impact,sans-serif;font-size:30px;line-height:1;text-transform:uppercase;color:var(--gold);text-shadow:3px 3px 0 var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pri-hero .pri-full{animation:pri-rise .6s cubic-bezier(.2,1.4,.5,1)}
.pri-lead{margin:8px 0 6px;font-weight:700;font-size:17px;line-height:1.2}
.pri-lead b{color:var(--gold)}
.pri-rules{margin:12px 0 0;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.28);border:2px dashed rgba(255,255,255,.25);font-weight:600;font-size:15px;color:var(--dim);text-align:left}
.pri-rules b{color:#fff}
/* révélation */
.pri-stage{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;margin:0 0 10px;padding:10px;border-radius:16px;
  background:radial-gradient(120% 120% at 0% 0%,rgba(255,200,61,.22),transparent 60%),rgba(0,0,0,.28);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px rgba(255,255,255,.08);overflow:hidden}
.pri-stage .pri-av{width:74px;height:74px;box-shadow:0 0 0 3px var(--gold),0 0 30px rgba(255,200,61,.6)}
.pri-cap{margin:0;font-weight:700;font-size:17px;line-height:1.15;color:var(--dim)}
.pri-cap b{color:#fff}.pri-cap em{font-style:normal;font-family:"Anton",Impact,sans-serif;font-size:22px;color:var(--gold)}
.pri-big{margin-top:4px;min-height:46px;font-family:"Anton",Impact,sans-serif;font-size:clamp(22px,7vw,30px);line-height:1.02;text-transform:uppercase;color:#fff;text-shadow:3px 3px 0 var(--ink);overflow-wrap:anywhere}
.pri-big.pri-wait{color:rgba(255,255,255,.5)}
.pri-big.pri-wait i{font-style:normal;display:inline-block;animation:pri-dot 1s infinite}
.pri-big.pri-wait i:nth-child(2){animation-delay:.15s}.pri-big.pri-wait i:nth-child(3){animation-delay:.3s}
.pri-big.pri-in{animation:pri-slam .5s cubic-bezier(.2,1.5,.5,1)}
.pri-tag{margin:4px 0 0;font-weight:800;font-size:15px;color:var(--gold);min-height:18px}
.pri-spark{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 70% 50%,rgba(255,255,255,.75),transparent 40%);opacity:0}
.pri-stage.pri-boom .pri-spark{animation:pri-flash .7s ease-out}
.pri-rows{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.pri-row{display:flex;align-items:center;gap:7px;min-height:56px}
.pri-row .pri-num{width:34px;height:34px;font-size:18px;cursor:default}
.pri-flip{flex:1;min-width:0;height:56px;perspective:700px}
.pri-fi{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.3,1.3,.5,1)}
.pri-row.pri-on .pri-fi{transform:rotateX(180deg)}
.pri-rc{position:absolute;inset:0;display:flex;align-items:center;gap:8px;padding:0 8px 0 5px;border-radius:13px;border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.pri-back{justify-content:center;background:repeating-linear-gradient(45deg,#2b1766 0 10px,#22114f 10px 20px);font-family:"Anton",Impact,sans-serif;font-size:22px;color:var(--gold);letter-spacing:.1em}
.pri-front{background:linear-gradient(180deg,var(--c1),var(--c2));transform:rotateX(180deg)}
.pri-front .pri-emo{width:40px;height:40px;font-size:22px}
.pri-front b{flex:1;min-width:0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:17px;line-height:1.04;text-transform:uppercase;text-shadow:2px 2px 0 rgba(0,0,0,.3);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pri-stk{flex:none;display:flex;align-items:center}
.pri-stk .pri-av{width:24px;height:24px;border-width:2px;margin-left:-8px;box-shadow:0 0 0 2px var(--ok)}
.pri-stk .pri-av:first-child{margin-left:0}
.pri-stk em{font-style:normal;margin-left:3px;font-weight:800;font-size:13px}
.pri-row.pri-on .pri-stk .pri-av{animation:pri-pop .4s .45s backwards cubic-bezier(.3,1.6,.6,1)}
.pri-mine{position:relative;flex:none;width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.22);font-size:24px;line-height:1}
.pri-mine small{position:absolute;left:0;right:0;bottom:-1px;font-size:11px;font-weight:800;text-align:center;color:var(--dim);line-height:1}
.pri-mine i{position:absolute;right:-7px;top:-7px;font-style:normal;font-size:13px;font-weight:900;min-width:22px;height:22px;padding:0 4px;border-radius:11px;display:grid;place-items:center;border:2px solid var(--ink);color:var(--ink)}
.pri-mine.pri-ok{background:rgba(47,210,122,.35);border-color:var(--ok)}.pri-mine.pri-ok i{background:var(--ok)}
.pri-mine.pri-near{background:rgba(255,176,32,.3);border-color:var(--near)}.pri-mine.pri-near i{background:var(--near)}
.pri-mine.pri-ko{background:rgba(255,77,94,.25);border-color:var(--ko)}.pri-mine.pri-ko i{background:var(--ko);color:#fff}
.pri-mine.pri-ct{font-family:"Anton",Impact,sans-serif;font-size:19px}
.pri-mine.pri-ct small{bottom:2px}
.pri-res .pri-mine i,.pri-res .pri-mine{animation:pri-pop .35s backwards cubic-bezier(.3,1.6,.6,1)}
.pri-react{margin:12px 0 0;padding:10px 12px;border-radius:14px;background:var(--gold);color:var(--ink);border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink);text-align:center;
  font-family:"Anton",Impact,sans-serif;font-size:clamp(20px,6vw,26px);line-height:1.1;text-transform:uppercase;animation:pri-pop .45s cubic-bezier(.3,1.6,.6,1)}
.pri-react small{display:block;margin-top:3px;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:16px;text-transform:none}
.pri-react.pri-cold{background:#7ee0ff}.pri-react.pri-hotr{background:#ff8fb3}
.pri-mypts{margin:10px 0 0;text-align:center;font-weight:700;font-size:18px}
.pri-mypts b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:24px;color:var(--gold)}
/* tableau « qui a mis quoi » */
.pri-h3{margin:16px 0 6px;font-weight:800;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.pri-bd{width:100%;border-collapse:separate;border-spacing:3px;table-layout:fixed}
.pri-bd th{width:30%;text-align:left;font-weight:700;font-size:14px;padding:0}
.pri-bd th div{display:flex;align-items:center;gap:5px;min-width:0}
.pri-bd th .pri-av{width:26px;height:26px;border-width:2px;flex:none}
.pri-bd th span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pri-bd thead th{font-size:12px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.pri-bd td{height:38px;text-align:center;font-size:21px;line-height:1;border-radius:9px;background:rgba(255,255,255,.08);border:2px solid transparent}
.pri-bd thead td{background:rgba(255,200,61,.2);border-color:var(--gold)}
.pri-bd td.pri-ok{background:rgba(47,210,122,.4);border-color:var(--ok)}
.pri-bd td.pri-near{background:rgba(255,176,32,.32);border-color:var(--near)}
.pri-bd td.pri-ko{background:rgba(255,77,94,.18)}
.pri-bd td.pri-q{color:rgba(255,255,255,.35);font-family:"Anton",Impact,sans-serif;font-size:18px}
.pri-bd tr.pri-me th{color:var(--gold)}
.pri-leg{margin:6px 0 0;font-size:13px;font-weight:600;color:var(--dim);text-align:center}
/* bilan */
.pri-pts{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}
.pri-pts li{display:flex;align-items:center;gap:9px;padding:5px 10px 5px 5px;border-radius:13px;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.16);animation:pri-slide .4s backwards;animation-delay:calc(var(--i) * 70ms)}
.pri-pts li.pri-me{border-color:var(--gold)}
.pri-pts li.pri-v{background:rgba(255,200,61,.16)}
.pri-pts .pri-av{width:40px;height:40px;flex:none}
.pri-nm{flex:1;min-width:0;font-weight:800;font-size:18px;line-height:1.05;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pri-nm small{display:block;font-weight:600;font-size:14px;color:var(--dim)}
.pri-gain{flex:none;font-family:"Pacifico",cursive;color:var(--gold);font-size:18px;transform:rotate(-6deg)}
.pri-gain.pri-z{color:var(--dim)}
.pri-tot{flex:none;min-width:34px;text-align:right;font-family:"Anton",Impact,sans-serif;font-size:24px}
.pri-know{margin:14px 0 0;padding:10px 12px 12px;border-radius:14px;background:#fff7e0;color:var(--ink);border:3px solid var(--ink);box-shadow:0 4px 0 var(--pink);transform:rotate(-.6deg)}
.pri-know h4{margin:0 0 6px;font-family:"Pacifico",cursive;font-weight:400;font-size:20px;color:var(--pink)}
.pri-know p{margin:6px 0 0;font-weight:600;font-size:17px;line-height:1.2}
.pri-know p b{font-weight:800}
.pri-next{margin:14px 0 0;text-align:center;font-weight:700;color:var(--dim)}
.pri-next b{font-family:"Anton",Impact,sans-serif;font-weight:400;color:#fff;font-size:19px}
/* fin */
.pri-pod{display:flex;justify-content:center;align-items:flex-end;gap:8px;margin:6px 0 12px}
.pri-pod figure{margin:0;width:31%;max-width:150px;display:grid;justify-items:center;gap:2px;text-align:center;animation:pri-up .6s backwards;animation-delay:var(--d)}
.pri-pod figcaption{max-width:100%;font-weight:800;font-size:17px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pri-step{width:100%;display:grid;place-items:center;border:3px solid var(--ink);border-bottom:0;border-radius:10px 10px 0 0;font-family:"Anton",Impact,sans-serif;font-size:24px;color:var(--ink);background:#fff}
.pri-p1 .pri-step{height:78px;background:var(--gold)}.pri-p2 .pri-step{height:54px;background:#d9d4ee}.pri-p3 .pri-step{height:46px;background:#e8a76a}
.pri-step small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:13px;margin-top:-6px}
.pri-crown{font-size:28px;line-height:1}
.pri-awards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:4px 0 12px}
.pri-aw{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;border:3px solid var(--ink);background:#fff7e0;color:var(--ink);box-shadow:0 3px 0 var(--ink);animation:pri-pop .4s backwards;animation-delay:var(--d)}
.pri-aw .pri-av{width:42px;height:42px;flex:none}
.pri-aw div{min-width:0}
.pri-aw small{display:block;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--pink)}
.pri-aw b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:20px;line-height:1.05;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pri-aw span{display:block;font-weight:600;font-size:14px;color:#5a4f70;line-height:1.1}
.pri-skip{text-align:center;padding-top:30px}
.pri-skip .pri-tv{font-size:72px;line-height:1;animation:pri-wig 1.4s ease-in-out infinite}
.pri-spec{margin:8px 0;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.25);font-weight:700;color:var(--dim);text-align:center}
@keyframes pri-bulbs{0%{border-color:#ffe7a0}50%{border-color:#ff8fb3}}
@keyframes pri-pulse{50%{transform:scale(1.1)}}
@keyframes pri-wig{0%,100%{rotate:0deg}25%{rotate:-.8deg}75%{rotate:.8deg}}
@keyframes pri-pop{from{opacity:0;transform:scale(.4) rotate(-8deg)}}
@keyframes pri-dealin{from{opacity:0;transform:translateY(-30px) rotate(-6deg) scale(.9)}}
@keyframes pri-rise{from{opacity:0;transform:translateY(30px) scale(.8)}}
@keyframes pri-beam{from{transform:translateX(-50%) rotate(-10deg)}to{transform:translateX(-50%) rotate(10deg)}}
@keyframes pri-dot{50%{opacity:.15}}
@keyframes pri-slam{from{opacity:0;transform:scale(1.8) rotate(-4deg)}}
@keyframes pri-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes pri-slide{from{opacity:0;transform:translateX(30px)}}
@keyframes pri-up{from{opacity:0;transform:translateY(24px)}}
@media (min-width:700px){.pri-page{padding-top:16px}}
@media (max-width:400px){.pri-logo{font-size:17px;padding:2px 8px 1px;letter-spacing:.05em}.pri-rd{font-size:12px;letter-spacing:.06em}.pri-rd b{font-size:16px}.pri-clock{width:42px;height:42px;font-size:17px}
  .pri-deal small{display:none}.pri-chip{font-size:13px}}
@media (max-height:760px){.pri-hero{width:min(128px,36vw)}.pri-hero figcaption{font-size:26px}.pri-who .pri-av{width:46px;height:46px}.pri-who b{font-size:21px}}
@media (prefers-reduced-motion:reduce){.pri *,.pri *::before,.pri *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;

GONFLETTE.registerGame({
  id: "priorities",
  name: "Priorities",
  min: 3,
  max: 8,
  resumable: true,
  create(api) {
    const el = api.el, P = api.players, NP = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] != null ? seatOf[api.me] : -1;
    const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const COARSE = !window.matchMedia || matchMedia("(pointer: coarse)").matches;
    const spd = () => Math.max(1, Math.min(50, +window.__prioSpeed || 1));
    const k = () => 1 / spd();
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const cancel = t => { if (t) { clearTimeout(t); timers.delete(t); } };
    const aliveSet = () => new Set(api.connected());
    const sfx = n => { try { if (api.sfx) api.sfx(n); } catch (e) {} };
    const haptic = n => { try { if (api.haptic) api.haptic(n); } catch (e) {} };

    el.innerHTML = `<style>${CSS}</style><div class="pri" id="pri-root">
      <header class="pri-top"><span class="pri-logo" aria-label="Priorities">PRIORITIES</span><div class="pri-rd" id="pri-rd"></div>
        <div class="pri-clock" id="pri-clock" role="timer" hidden></div></header>
      <main class="pri-page" id="pri-page" aria-live="polite"></main></div>`;
    const root = el.querySelector("#pri-root"), page = el.querySelector("#pri-page");
    const $ = id => el.querySelector("#" + id);

    /* ---------- petits rendus ---------- */
    const nm = i => esc(P[i] ? P[i].pseudo : "?");
    function avSVG(i, o) {
      const p = P[i]; if (!p) return "";
      o = o || {};
      if (o.mood && GG.avatar && GG.avatar.svg) { try { return GG.avatar.svg(p.look, p.xp, o); } catch (e) {} }
      return api.avatar(p.key, o);
    }
    const bust = (i, cls, o) => `<span class="pri-av${cls ? " " + cls : ""}">${avSVG(i, Object.assign({view: "bust"}, o || {}))}</span>`;
    const full = (i, o) => `<span class="pri-full">${avSVG(i, Object.assign({pose: "flex"}, o || {}))}</span>`;
    const catVars = d => { const c = CATS[d.k] || CATS[0]; return `--c1:${c.c1};--c2:${c.c2}`; };
    const cname = d => esc((CATS[d.k] || CATS[0]).n);
    const ctext = (ci, s) => { const d = card(s.c[ci]); return `${d.e} ${esc(d.t)}`; };
    const NR = s => (s.V || []).length;

    /* =================== HÔTE =================== */
    let H = null, lastPub = "", hostIv = null, inputs = {}, finished = false;
    const seen = {};
    const recent = (() => { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a.filter(n => Number.isInteger(n)) : []; } catch (e) { return []; } })();
    function remember(cs) {
      for (const c of cs) { const j = recent.indexOf(c); if (j >= 0) recent.splice(j, 1); recent.push(c); }
      while (recent.length > Math.min(RECENT_MAX, DECK.length - 60)) recent.shift();
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
    }
    function draw(used) {
      const avoid = new Set(used.concat(recent));
      const cats = shuffle(CATS.map((_, i) => i).filter(i => BYCAT[i].length));
      const pick = [];
      for (let n = 0; pick.length < 5 && n < cats.length * 3; n++) {
        const ci = cats[n % cats.length];
        if (n < cats.length && pick.some(x => DECK[x].k === ci)) continue;
        let pool = BYCAT[ci].filter(d => !avoid.has(d) && !pick.includes(d));
        if (!pool.length) pool = BYCAT[ci].filter(d => !used.includes(d) && !pick.includes(d));
        if (!pool.length) pool = BYCAT[ci].filter(d => !pick.includes(d));
        if (pool.length) pick.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      while (pick.length < 5) { const d = Math.floor(Math.random() * DECK.length); if (!pick.includes(d)) pick.push(d); }
      remember(pick);
      return pick;
    }
    function rotation() {
      const a = shuffle(P.map((_, i) => i));
      if (NP !== 3) return a;
      let b; do { b = shuffle(P.map((_, i) => i)); } while (b[0] === a[a.length - 1]);
      return a.concat(b);
    }
    const zeros = () => P.map(() => 0);
    function fresh() {
      return {ph: "boot", n: 0, r: 0, V: rotation(), v: 0, c: [0, 1, 2, 3, 4], u: [], tl: 0, tt: 0,
        S: zeros(), E: zeros(), X: zeros(), VA: zeros(), VN: zeros(), g: P.map(() => ""), ok: "0".repeat(NP), k: ""};
    }
    function pub() {
      const s = {ph: H.ph, n: H.n, r: H.r, V: H.V, v: H.v, c: H.c, t: Math.max(0, Math.ceil(H.tl - 1e-6)), S: H.S, E: H.E, X: H.X, VA: H.VA, VN: H.VN, u: H.u};
      if (H.ph === "intro" || H.ph === "sort" || H.ph === "lock") { s.g = H.g; s.ok = H.ok; s.k = H.k; s.tt = H.tt; }
      if (H.ph === "rev" || H.ph === "sum") { s.vo = H.vo; s.G = H.G; s.p = H.p; s.ri = H.ri; s.rz = H.rz; }
      if (H.ph === "skip") s.why = H.why;
      if (H.ph === "end") { s.o = H.o; s.fin = H.fin || 0; }
      const j = JSON.stringify(s);
      if (j === lastPub) return;
      lastPub = j; api.setState(s);
    }
    const setCh = (str, i, ch) => str.slice(0, i) + ch + str.slice(i + 1);
    function startRound(r) {
      H.n++;
      if (r > H.V.length) return goEnd();
      H.r = r; H.v = H.V[r - 1];
      H.c = draw(H.u); H.u = H.u.concat(H.c).slice(-60);
      H.g = P.map(() => ""); H.ok = "0".repeat(NP); H.k = ""; H.tt = 0;
      delete H.vo; delete H.G; delete H.p; delete H.ri; delete H.rz; delete H.why;
      if (!aliveSet().has(P[H.v].key)) { H.ph = "skip"; H.why = "gone"; H.tl = T.skip; return; }
      H.ph = "intro"; H.tl = r === 1 ? T.intro1 : T.intro;
    }
    function startSort() { H.ph = "sort"; H.n++; H.tl = H.tt = sortTime(NP); sortCheck(); }
    function sortCheck() {
      const al = aliveSet();
      H.k = P.map((p, i) => !al.has(p.key) ? "-" : i === H.v ? (H.ok[i] === "1" ? "V" : "v") : (H.ok[i] === "1" ? "1" : "0")).join("");
      if (H.ph !== "sort") return;
      if (!al.has(P[H.v].key) && H.ok[H.v] !== "1") { H.ph = "skip"; H.why = "left"; H.tl = T.skip; H.n++; return; }
      // pour finir avant le chrono : la Vedette + les devineurs dont la présence est encore là
      // (un devineur qui vient de couper le réseau ne bloque pas ; il reste compté s'il revient à temps)
      const live = new Set(Object.keys(inputs));
      const need = P.map((_, i) => i).filter(i => i === H.v || (al.has(P[i].key) && live.has(P[i].key)));
      if (need.every(i => H.ok[i] === "1")) goLock();
    }
    function goLock() { H.ph = "lock"; H.n++; H.tl = T.lock; }
    function startRev() {
      const al = aliveSet();
      let vo = decO(H.g[H.v], H.r), rz = 0;
      if (!validO(vo)) { vo = shuffle([0, 1, 2, 3, 4]).join(""); rz = 1; }
      const G = P.map(() => ""), p = zeros(), got = [];
      P.forEach((pl, i) => {
        if (i === H.v || !al.has(pl.key)) return;
        const o = validO(H.g[i]) ? H.g[i] : "01234";
        G[i] = o;
        const sc = score(vo, o);
        p[i] = sc.pts; H.E[i] += sc.ex; if (sc.ex === 5) H.X[i]++;
        got.push(sc.pts);
      });
      const avg = got.length ? got.reduce((a, b) => a + b, 0) / got.length : 0;
      p[H.v] = Math.round(avg);
      if (got.length) { H.VA[H.v] += Math.round(avg * 10); H.VN[H.v]++; }
      H.S = H.S.map((x, i) => x + p[i]);
      Object.assign(H, {ph: "rev", vo, G, p, rz, ri: 0, tl: T.lead}); H.n++;
    }
    function rankSeats() {
      const al = aliveSet(), on = i => (al.has(P[i].key) ? 1 : 0);
      return P.map((_, i) => i).sort((a, b) => (on(b) - on(a)) || (H.S[b] - H.S[a]) || (H.E[b] - H.E[a]) || a - b);
    }
    function goEnd() { H.ph = "end"; H.tl = T.end; H.o = rankSeats(); H.fin = 0; }
    function doFinish() {
      if (finished) return; finished = true;
      const al = aliveSet(), o = H.o || rankSeats(), top = Math.max(0, ...o.filter(i => al.has(P[i].key)).map(i => H.S[i]));
      const winners = top > 0 ? o.filter(i => al.has(P[i].key) && H.S[i] === top).map(i => P[i].key) : [];
      const names = winners.map(kk => api.name(kk));
      api.finish({
        winners, ranking: o.map(i => P[i].key),
        summary: (winners.length === 1 ? `${names[0]} remporte Priorities avec ${top} points : un vrai lecteur de pensées !`
          : winners.length ? `Égalité au sommet (${top} points) : ${andList(names)} !`
          : "Personne n'a rien deviné : une bande de grands mystères !").slice(0, 160)
      });
    }
    function step(d) {
      H.tl -= d;
      switch (H.ph) {
        case "boot": startRound(1); break;
        case "intro": if (H.tl <= 0) startSort(); break;
        case "sort": sortCheck(); if (H.ph === "sort" && H.tl <= 0) goLock(); break;
        case "lock": if (H.tl <= 0) startRev(); break;
        case "rev": if (H.tl <= 0) { if (H.ri < 5) { H.ri++; H.tl = H.ri < 5 ? T.card : T.card + T.hold; } else { H.ph = "sum"; H.n++; H.tl = T.sum; } } break;
        case "sum": case "skip": if (H.tl <= 0) startRound(H.r + 1); break;
        case "end": if (H.tl <= 0 && !H.fin) { H.fin = 1; H.tl = 0; pub(); doFinish(); } break;
      }
    }
    function hostInputs(map) {
      inputs = map || {};
      if (!H || (H.ph !== "sort" && H.ph !== "lock")) return;
      for (const key in inputs) {
        const inp = inputs[key], i = seatOf[key];
        if (i == null || !inp || inp.r !== H.r) continue;
        if (inp.seq != null && inp.seq === seen[key]) continue;
        seen[key] = inp.seq;
        if (!validO(inp.o)) continue;
        H.g[i] = i === H.v ? encO(inp.o, H.r) : inp.o;
        if (H.ph === "sort") H.ok = setCh(H.ok, i, inp.ok ? "1" : "0");
      }
      if (H.ph === "sort") sortCheck();
      pub();
    }
    if (api.isHost) {
      const R = api.resume;
      if (R && typeof R === "object" && R.ph && Array.isArray(R.V) && Array.isArray(R.S) && R.S.length === NP) {
        H = JSON.parse(JSON.stringify(R));
        H.tl = (+R.t || 0) + .3;
        if (!Array.isArray(H.g) || H.g.length !== NP) H.g = P.map(() => "");
        if (typeof H.ok !== "string" || H.ok.length !== NP) H.ok = "0".repeat(NP);
        delete H.t;
        if (H.ph === "end" && H.fin) { pub(); doFinish(); }
      } else H = fresh();
      pub();
      api.onInputs(hostInputs);
      let last = performance.now();
      hostIv = setInterval(() => {
        if (dead) return;
        const now = performance.now();
        let rem = Math.min(60, (now - last) / 1000) * spd(); last = now;
        while (rem > 0 && !dead) { const d = Math.min(rem, .25); rem -= d; step(d); }
        pub();
      }, 100);
    }

    /* =================== AFFICHAGE (tout le monde) =================== */
    let S = null, view = "", myRound = -1, ord = [0, 1, 2, 3, 4], myOk = 0, sel = -1, mySeq = 0, sendT = null, lastBeep = -1, drag = null;
    let shownRi = 0, revBuilt = false;
    const isV = s => mySeat >= 0 && s.v === mySeat;
    const canSort = s => mySeat >= 0 && (s.ph === "sort") && !myOk;
    function push() {
      cancel(sendT); sendT = null;
      if (!S || mySeat < 0 || (S.ph !== "sort" && S.ph !== "lock")) return;
      api.setInput({seq: ++mySeq, r: S.r, o: ord.join(""), ok: myOk ? 1 : 0});
    }
    function sendSoon() { if (!sendT) sendT = later(push, 150); }
    const beat = setInterval(() => { if (!dead && S && (S.ph === "sort" || S.ph === "lock")) push(); }, 1500);

    function setTop(s) {
      const rd = $("pri-rd"), n = NR(s);
      const lab = {intro: "Nouvelle Vedette", sort: "Classement secret", lock: "Les jeux sont faits", rev: "Révélation", sum: "Bilan", skip: "Coupure pub", end: "Grande finale"}[s.ph] || "";
      rd.innerHTML = s.ph === "end" ? `<b>Finale</b>${lab}` : s.r ? `<b>Manche ${s.r}/${n}</b>${esc(lab)}` : "";
      const c = $("pri-clock"), timed = s.ph === "sort";
      c.hidden = !timed;
      if (timed) {
        c.textContent = s.t;
        c.style.setProperty("--p", Math.max(0, Math.min(1, s.t / (s.tt || 60))).toFixed(3));
        const hot = s.t <= 10;
        c.classList.toggle("pri-hot", hot);
        if (s.t <= 5 && s.t > 0 && lastBeep !== s.t) { lastBeep = s.t; sfx("count"); }
      }
    }

    /* ---- intro : la Vedette sous les projecteurs ---- */
    function dealHTML(s) {
      return `<ul class="pri-deal">${s.c.map((d, i) => { const c = card(d); return `<li style="${catVars(c)};--i:${i}"><span class="pri-emo">${c.e}</span><b>${esc(c.t)}</b><small>${cname(c)}</small></li>`; }).join("")}</ul>`;
    }
    function buildIntro(s) {
      const me = isV(s), v = s.v;
      page.innerHTML = `<section class="pri-intro"><span class="pri-marq">⭐ La Vedette du tour ⭐</span>
        <figure class="pri-hero">${full(v, {pose: "flex"})}<figcaption>${nm(v)}${me ? " (toi !)" : ""}</figcaption></figure>
        <p class="pri-lead">${me ? "C'est <b>toi</b> ! Classe ces 5 cartes en secret, de <b>J'ADORE ❤️</b> à <b>JE DÉTESTE 💀</b>. Les autres devinent…"
          : mySeat >= 0 ? `Devine comment <b>${nm(v)}</b> classe ces 5 cartes, de ❤️ à 💀 !` : `${nm(v)} va classer ces 5 cartes, les autres devinent.`}</p>
        ${dealHTML(s)}
        ${s.r === 1 ? `<p class="pri-rules">🎯 Carte <b>pile à la bonne place = 2 pts</b> · à une place près = 1 pt · <b>5/5 = +3</b> bonus.<br>⭐ La Vedette marque <b>la moyenne de ses devineurs</b> : sois honnête, sois prévisible !</p>` : ""}</section>`;
      if (me) { haptic("heavy"); sfx("whoosh"); } else sfx("whoosh");
    }

    /* ---- tri (Vedette et devineurs) ---- */
    let cardEls = [], slotEls = [], rail = null, layer = null;
    function buildSort(s) {
      const v = s.v, me = isV(s);
      const who = `<div class="pri-who">${bust(v)}<div><small>${me ? "C'est toi la Vedette ⭐" : "La Vedette"}</small><b>${nm(v)}</b>
        <em>${me ? "Classe en secret, de ❤️ (en haut) à 💀 (en bas)." : mySeat >= 0 ? `Devine le classement de ${nm(v)} !` : "Les joueurs classent ces cartes en secret…"}</em></div></div>`;
      if (mySeat < 0) {
        page.innerHTML = `${who}${dealHTML(s)}<p class="pri-spec">👀 Tu regardes la partie : le classement sera révélé carte par carte.</p><div class="pri-chips" id="pri-chips"></div>`;
        cardEls = []; rail = null; layer = null;
        updSort(s);
        return;
      }
      page.innerHTML = `${who}
        <div class="pri-lad" id="pri-lad">
          <div class="pri-end pri-love">J'ADORE ❤️<i></i></div>
          <div class="pri-rail" id="pri-rail">
            ${SLOT.map((sl, i) => `<div class="pri-slot"><button type="button" class="pri-num${i === 2 ? " pri-dk" : ""}" data-slot="${i}" style="--sc:${sl.c}" aria-label="Place ${i + 1} : ${sl.l}">${i + 1}</button><span class="pri-hole"></span></div>`).join("")}
            <div class="pri-layer" id="pri-layer">${s.c.map((d, ci) => { const c = card(d), long = Array.from(c.t).length > 24;
              return `<div class="pri-card" data-c="${ci}" role="button" tabindex="0" style="${catVars(c)}"><span class="pri-emo" aria-hidden="true">${c.e}</span>
                <span class="pri-tx"><small>${cname(c)}</small><b class="${long ? "pri-long" : ""}">${esc(c.t)}</b></span><span class="pri-grip" aria-hidden="true"></span>
                <span class="pri-ud"><button type="button" data-mv="-1" aria-label="Monter">▲</button><button type="button" data-mv="1" aria-label="Descendre">▼</button></span></div>`; }).join("")}</div>
          </div>
          <div class="pri-end pri-hate">JE DÉTESTE 💀<i></i></div>
        </div>
        <div class="pri-act" id="pri-act"></div>
        ${s.r <= 2 ? `<p class="pri-hint">${COARSE ? "Glisse les cartes avec le doigt" : "Glisse les cartes à la souris"}, ou touche une carte puis un numéro (▲▼ pour ajuster).</p>` : ""}
        <div class="pri-chips" id="pri-chips"></div>`;
      rail = $("pri-rail"); layer = $("pri-layer");
      slotEls = Array.from(rail.querySelectorAll(".pri-slot"));
      cardEls = Array.from(layer.querySelectorAll(".pri-card"));
      layer.addEventListener("pointerdown", onDown);
      layer.addEventListener("pointermove", onMove);
      layer.addEventListener("pointerup", onUp);
      layer.addEventListener("pointercancel", onCancel);
      layer.addEventListener("lostpointercapture", onCancel);
      layer.addEventListener("click", onUdClick);
      layer.addEventListener("keydown", onKey);
      layer.addEventListener("contextmenu", e => e.preventDefault());
      rail.addEventListener("click", e => { const b = e.target.closest(".pri-num"); if (b && sel >= 0 && canSort(S)) { moveTo(sel, +b.dataset.slot); setSel(-1); } });
      layout();
      later(layout, 60); // polices chargées / mise en page finale
      updSort(s);
      sfx("go");
    }
    const tops = () => slotEls.map(x => x.offsetTop);
    function layout(preview) {
      if (!cardEls.length || !S) return;
      const tp = tops(), o = preview || ord;
      cardEls.forEach((c, ci) => {
        const slot = o.indexOf(ci);
        if (!(drag && drag.started && drag.ci === ci)) c.style.transform = `translateY(${tp[slot]}px)`;
        c.setAttribute("aria-label", `${card(S.c[ci]).t} : place ${slot + 1} sur 5 (${SLOT[slot].l})`);
        const ud = c.querySelectorAll(".pri-ud button");
        if (ud.length) { ud[0].disabled = slot === 0; ud[1].disabled = slot === 4; }
      });
    }
    function setSel(ci) {
      sel = ci;
      cardEls.forEach((c, i) => c.classList.toggle("pri-sel", i === sel));
      if (rail) rail.classList.toggle("pri-pick", sel >= 0);
    }
    function moveTo(ci, slot) {
      const from = ord.indexOf(ci); if (from < 0 || slot === from || slot < 0 || slot > 4) return;
      ord.splice(from, 1); ord.splice(slot, 0, ci);
      layout(); sfx("tap"); haptic("light"); sendSoon();
    }
    function tap(ci) {
      if (!canSort(S)) return;
      if (sel < 0) { setSel(ci); sfx("tap"); haptic("light"); }
      else if (sel === ci) setSel(-1);
      else { const t = ord.indexOf(ci); moveTo(sel, t); setSel(-1); }
    }
    function onUdClick(e) {
      const b = e.target.closest("[data-mv]"); if (!b) return;
      e.stopPropagation();
      const c = b.closest(".pri-card"); if (!c || !canSort(S)) return;
      const ci = +c.dataset.c; moveTo(ci, ord.indexOf(ci) + +b.dataset.mv);
    }
    function onKey(e) {
      const c = e.target.closest && e.target.closest(".pri-card"); if (!c || e.target.closest("[data-mv]") || !canSort(S)) return;
      const ci = +c.dataset.c;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(ci); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); moveTo(ci, ord.indexOf(ci) + (e.key === "ArrowUp" ? -1 : 1)); c.focus(); }
      else if (e.key === "Escape") setSel(-1);
    }
    function onDown(e) {
      if (drag || e.button > 0 || e.target.closest(".pri-ud")) return;
      const c = e.target.closest(".pri-card"); if (!c || !canSort(S)) return;
      const ci = +c.dataset.c, slot = ord.indexOf(ci), tp = tops();
      drag = {ci, el: c, id: e.pointerId, x0: e.clientX, y0: e.clientY, grab: e.clientY - rail.getBoundingClientRect().top - tp[slot], tgt: slot, started: false, prev: ord.slice()};
      try { c.setPointerCapture(e.pointerId); } catch (er) {}
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.started) {
        if (Math.abs(e.clientY - drag.y0) < 7 && Math.abs(e.clientX - drag.x0) < 12) return;
        if (!canSort(S)) { drag = null; return; }
        drag.started = true; drag.el.classList.add("pri-drag"); setSel(-1);
      }
      e.preventDefault();
      // défilement auto si la carte touche le bord de l'écran
      const rr = el.getBoundingClientRect();
      if (e.clientY < rr.top + 60) el.scrollTop -= 8; else if (e.clientY > rr.bottom - 40) el.scrollTop += 8;
      const tp = tops(), pitch = tp[1] - tp[0];
      let y = e.clientY - rail.getBoundingClientRect().top - drag.grab;
      y = Math.max(tp[0] - pitch * .45, Math.min(tp[4] + pitch * .45, y));
      const t = Math.max(0, Math.min(4, Math.round((y - tp[0]) / pitch)));
      drag.el.style.transform = `translateY(${y}px) rotate(-1.5deg) scale(1.04)`;
      if (t !== drag.tgt) {
        drag.tgt = t;
        const o = ord.filter(x => x !== drag.ci); o.splice(t, 0, drag.ci); drag.prev = o;
        layout(o); haptic("light");
      }
    }
    function endDrag(commit) {
      const d = drag; drag = null; if (!d) return;
      if (d.started) {
        d.el.classList.remove("pri-drag");
        // fin du chrono pendant un glisser : la carte reste où le doigt l'a lâchée (pris tel quel)
        if (commit && S && mySeat >= 0 && !myOk && (S.ph === "sort" || S.ph === "lock")) { const changed = d.prev.join("") !== ord.join(""); ord = d.prev; if (changed) { sfx("tap"); sendSoon(); } }
        layout();
      } else if (commit) tap(d.ci);
    }
    function onUp(e) { if (drag && e.pointerId === drag.id) endDrag(true); }
    function onCancel(e) { if (drag && e.pointerId === drag.id) endDrag(drag.started); }
    function drawAct(s) {
      const act = $("pri-act"); if (!act) return;
      const locked = s.ph !== "sort", key = (locked ? "L" : myOk ? "O" : "E");
      if (act.dataset.k === key) return; act.dataset.k = key;
      $("pri-lad").classList.toggle("pri-locked", locked || !!myOk);
      const old = $("pri-lad").querySelector(".pri-stamp"); if (old) old.remove();
      if (locked || myOk) $("pri-rail").insertAdjacentHTML("beforeend", `<span class="pri-stamp${locked ? " pri-lk" : ""}">${locked ? "LES JEUX SONT FAITS !" : "VALIDÉ ✓"}</span>`);
      if (locked) act.innerHTML = `<p class="pri-hint" style="flex:1;margin:0">⏳ Les jeux sont faits… place à la révélation !</p>`;
      else if (myOk) act.innerHTML = `<p class="pri-hint" style="flex:1;margin:0;text-align:left">${isV(s) ? "Classement envoyé. Chut… 🤫" : "Pronostic envoyé ! En attente des autres…"}</p><button type="button" class="gk-btn alt" id="pri-edit">Modifier</button>`;
      else act.innerHTML = `<button type="button" class="gk-btn good big" id="pri-go">${isV(s) ? "Je valide mon top ✓" : "Je valide ✓"}</button>`;
      const go = $("pri-go"), ed = $("pri-edit");
      if (go) go.addEventListener("click", () => { if (!S || S.ph !== "sort") return; endDrag(true); setSel(-1); myOk = 1; push(); sfx("tap"); haptic("success"); drawAct(S); updChips(S); });
      if (ed) ed.addEventListener("click", () => { if (!S || S.ph !== "sort") return; myOk = 0; push(); sfx("tap"); drawAct(S); updChips(S); });
    }
    function updChips(s) {
      const box = $("pri-chips"); if (!box) return;
      const kk = s.k || "";
      box.innerHTML = P.map((p, i) => {
        let f = kk[i] || (i === s.v ? "v" : "0");
        if (i === mySeat && f !== "-") f = i === s.v ? (myOk ? "V" : "v") : (myOk ? "1" : "0");
        const done = f === "1" || f === "V", star = i === s.v;
        return `<span class="pri-chip${done ? " pri-done" : ""}${star ? " pri-star" : ""}${f === "-" ? " pri-gone" : ""}">${bust(i)}<span>${star ? "⭐ " : ""}${nm(i)}</span><i>${f === "-" ? "👋" : done ? "✅" : "🤔"}</i></span>`;
      }).join("");
    }
    let lockPushed = -1;
    function updSort(s) {
      if (s.ph === "lock" && drag) endDrag(true);
      if (s.ph === "lock" && sel >= 0) setSel(-1);
      if (s.ph === "lock" && lockPushed !== s.r) { lockPushed = s.r; push(); }
      drawAct(s); updChips(s);
    }

    /* ---- révélation ---- */
    function revData(s) {
      const vo = s.vo || "01234", pos = posOf(vo), G = s.G || [];
      const gs = P.map((_, i) => i).filter(i => G[i] && validO(G[i]));
      return {vo, pos, G, gs};
    }
    function boardHTML(s, upto) {
      const {vo, pos, G, gs} = revData(s);
      if (!gs.length) return "";
      const cell = (i, sl) => {
        const ci = +G[i][sl], d = Math.abs(pos[ci] - sl), shown = sl < upto;
        return `<td class="${shown ? (d === 0 ? "pri-ok" : d === 1 ? "pri-near" : "pri-ko") : ""}" title="${esc(card(s.c[ci]).t)}">${card(s.c[ci]).e}</td>`;
      };
      return `<table class="pri-bd"><thead><tr><th>⭐ ${nm(s.v)}</th>${[0, 1, 2, 3, 4].map(sl => sl < upto ? `<td>${card(s.c[+vo[sl]]).e}</td>` : `<td class="pri-q">${sl + 1}</td>`).join("")}</tr></thead>
        <tbody>${gs.map(i => `<tr class="${i === mySeat ? "pri-me" : ""}"><th><div>${bust(i)}<span>${nm(i)}</span></div></th>${[0, 1, 2, 3, 4].map(sl => cell(i, sl)).join("")}</tr>`).join("")}</tbody></table>
        <p class="pri-leg">🟩 pile (2 pts) · 🟧 à une place (1 pt) · 🟥 raté</p>`;
    }
    function buildRev(s) {
      const v = s.v, {vo, G, gs} = revData(s);
      const mine = mySeat >= 0 && mySeat !== v && G[mySeat];
      page.innerHTML = `<section class="pri-rv">
        <div class="pri-stage" id="pri-stage"><span class="pri-spark"></span>${bust(v, "", {pose: "flex"})}
          <div><p class="pri-cap" id="pri-cap"></p><div class="pri-big" id="pri-big"></div><p class="pri-tag" id="pri-tag"></p></div></div>
        <ol class="pri-rows" id="pri-rows">${[0, 1, 2, 3, 4].map(sl => {
          const ci = +vo[sl], c = card(s.c[ci]), long = Array.from(c.t).length > 26;
          const ex = gs.filter(i => +G[i][sl] === ci);
          const stk = ex.length ? `<span class="pri-stk">${ex.slice(0, 5).map(i => bust(i)).join("")}${ex.length > 5 ? `<em>+${ex.length - 5}</em>` : ""}</span>` : "";
          const myCell = mine ? `<span class="pri-mine" id="pri-m${sl}">${card(s.c[+G[mySeat][sl]]).e}<small>toi</small></span>` : `<span class="pri-mine pri-ct" id="pri-m${sl}">?</span>`;
          return `<li class="pri-row" id="pri-r${sl}"><span class="pri-num${sl === 2 ? " pri-dk" : ""}" style="--sc:${SLOT[sl].c}">${sl + 1}</span>
            <div class="pri-flip"><div class="pri-fi"><div class="pri-rc pri-back">PRIORITIES</div>
              <div class="pri-rc pri-front" style="${catVars(c)}"><span class="pri-emo">${c.e}</span><b style="${long ? "font-size:15px" : ""}">${esc(c.t)}</b>${stk}</div></div></div>
            ${myCell}</li>`;
        }).join("")}</ol>
        <div id="pri-after"></div>
        <h3 class="pri-h3">Qui a mis quoi ?</h3><div id="pri-board">${boardHTML(s, 0)}</div></section>`;
      shownRi = 0; revBuilt = true;
      const cap = $("pri-cap"), big = $("pri-big");
      cap.innerHTML = mySeat === v ? `Ton classement secret, <b>révélé</b> !` : `Le classement secret de <b>${nm(v)}</b> !`;
      big.className = "pri-big pri-wait"; big.innerHTML = `<i>.</i><i>.</i><i>.</i>`;
      if (s.rz) $("pri-tag").textContent = "🎲 Vedette muette : classement tiré au sort !";
      const target = s.ri || 0;
      if (target > 0) { for (let i = 0; i < target; i++) revealSlot(s, i, false); shownRi = target; }
      if (target >= 5) showAfter(s, false);
    }
    function slotStats(s, sl) {
      const {vo, pos, G, gs} = revData(s), ci = +vo[sl];
      const ex = gs.filter(i => +G[i][sl] === ci);
      const near = gs.filter(i => Math.abs(G[i].indexOf(String(ci)) - sl) === 1);
      return {ci, ex, near, gs, pos};
    }
    function revealSlot(s, sl, anim) {
      const row = $("pri-r" + sl); if (!row || row.classList.contains("pri-on")) return;
      const st = slotStats(s, sl), c = card(s.c[st.ci]), v = s.v;
      const cap = $("pri-cap"), big = $("pri-big"), tag = $("pri-tag"), stage = $("pri-stage");
      const vname = mySeat === v ? "toi" : nm(v);
      const flair = sl === 0 ? (st.ex.length * 2 < st.gs.length ? " ?!" : " !") : sl === 4 ? " 💀" : " !";
      const doShow = () => {
        if (dead || !$("pri-r" + sl)) return;
        row.classList.add("pri-on");
        cap.innerHTML = `Pour <b>${vname}</b>, le <em>N°${sl + 1}</em> c'est…`;
        big.className = "pri-big" + (anim ? " pri-in" : ""); big.innerHTML = `${c.e} ${esc(c.t)}${flair}`;
        const n = st.ex.length, g = st.gs.length;
        tag.textContent = !g ? "" : n === g ? (g > 1 ? "📖 Tout le monde l'avait !" : "✅ Trouvé !") : n === 0 ? (st.near.length ? `Personne pile… ${st.near.length} à une place près` : "🙈 Personne ne l'avait !") : `✅ ${n} sur ${g} l'avai${n > 1 ? "ent" : "t"} !`;
        const m = $("pri-m" + sl);
        if (m) {
          const G = s.G || [];
          if (mySeat >= 0 && mySeat !== v && G[mySeat]) {
            const d = Math.abs(st.pos[+G[mySeat][sl]] - sl);
            m.classList.add(d === 0 ? "pri-ok" : d === 1 ? "pri-near" : "pri-ko");
            m.insertAdjacentHTML("beforeend", `<i>${d === 0 ? "+2" : d === 1 ? "+1" : "✗"}</i>`);
            if (anim) { if (d === 0) { haptic("success"); sfx("tap"); } else if (d > 1) haptic("fail"); }
          } else { m.innerHTML = `${n}/${g}<small>${g ? "trouvé" : ""}</small>`; }
          if (anim) row.classList.add("pri-res");
        }
        const b = $("pri-board"); if (b) b.innerHTML = boardHTML(s, sl + 1);
        if (anim) { stage.classList.remove("pri-boom"); void stage.offsetWidth; stage.classList.add("pri-boom"); sfx("whoosh"); }
      };
      if (!anim) { doShow(); return; }
      cap.innerHTML = `Pour <b>${vname}</b>, le <em>N°${sl + 1}</em> c'est…`;
      big.className = "pri-big pri-wait"; big.innerHTML = `<i>.</i><i>.</i><i>.</i>`; tag.textContent = "";
      later(doShow, 1100 * k());
    }
    function roundReact(s) {
      const {vo, G, gs} = revData(s), v = s.v, vn = nm(v);
      if (!gs.length) return {t: "Personne pour deviner…", sub: "", cls: ""};
      const sc = gs.map(i => [i, score(vo, G[i])]);
      const perfect = sc.filter(x => x[1].ex === 5).map(x => x[0]);
      if (perfect.length) return {t: `🔮 ${andList(perfect.map(nm))} : 5/5 !`, sub: `Lecture de pensées : +3 bonus. ${vn} n'a aucun secret !`, cls: "pri-hotr"};
      if (sc.every(x => x[1].ex === 0)) return {t: mySeat === v ? "Personne ne te connaît ! 🕵️" : `Personne ne connaît ${vn} ! 🕵️`, sub: "Zéro carte pile à sa place. Mystère total.", cls: "pri-cold"};
      if (sc.every(x => x[1].ex >= 3)) return {t: "Livre ouvert 📖", sub: `Tout le monde a lu dans ${mySeat === v ? "ton" : "le"} jeu${mySeat === v ? "" : " de " + vn} !`, cls: "pri-hotr"};
      const best = sc.slice().sort((a, b) => b[1].pts - a[1].pts)[0];
      return {t: mySeat === v ? `🔎 ${nm(best[0])} t'a percé à jour !` : best[0] === mySeat ? `🔎 Bien vu, tu as cerné ${vn} !` : `🔎 ${nm(best[0])} a cerné ${vn} !`,
        sub: `${best[1].ex} carte${best[1].ex > 1 ? "s" : ""} pile à la bonne place (+${best[1].pts})`, cls: ""};
    }
    function showAfter(s, anim) {
      const box = $("pri-after"); if (!box || box.dataset.done) return;
      box.dataset.done = "1";
      const r = roundReact(s), p = s.p || [], v = s.v;
      let me = "";
      if (mySeat === v) me = `Tu marques <b>+${p[v] || 0}</b> (la moyenne de tes devineurs)`;
      else if (mySeat >= 0 && (s.G || [])[mySeat]) me = `Tu marques <b>+${p[mySeat] || 0}</b> cette manche`;
      box.innerHTML = `<div class="pri-react ${r.cls}">${r.t}${r.sub ? `<small>${r.sub}</small>` : ""}</div>${me ? `<p class="pri-mypts">${me}</p>` : ""}`;
      if (anim && mySeat >= 0) { const sc = mySeat !== v && (s.G || [])[mySeat] ? score(s.vo, s.G[mySeat]) : null; if (sc && sc.ex === 5) { sfx("win"); haptic("success"); } }
    }
    function updRev(s) {
      if (!revBuilt) return;
      const target = Math.min(5, s.ri || 0);
      while (shownRi < target) { const sl = shownRi++; revealSlot(s, sl, !RM && target - sl === 1); }
      if (target >= 5 && s.ph === "rev" && s.t <= Math.ceil(T.hold * 1) + 1) showAfter(s, true);
    }

    /* ---- bilan de la manche ---- */
    function facts(s) {
      const {pos, G, gs} = revData(s), vn = mySeat === s.v ? "toi" : nm(s.v), out = [];
      if (!gs.length) return out;
      const C = ci => `« ${card(s.c[ci]).e} ${esc(card(s.c[ci]).t)} »`;
      const avg = [0, 1, 2, 3, 4].map(ci => gs.reduce((a, i) => a + G[i].indexOf(String(ci)), 0) / gs.length);
      let top = 0; for (let ci = 1; ci < 5; ci++) if (avg[ci] < avg[top]) top = ci;
      const nTop = gs.filter(i => +G[i][0] === top).length;
      out.push(pos[top] === 0 ? `Le groupe avait vu juste : pour ${vn}, le N°1 c'était bien ${C(top)}.`
        : `Selon le groupe, le N°1 de ${vn} aurait dû être ${C(top)}${nTop > 1 ? ` (${nTop} votes)` : ""}… en vrai : <b>N°${pos[top] + 1}</b> !`);
      let best = -1, bd = 0;
      for (let ci = 0; ci < 5; ci++) { const d = Math.abs(avg[ci] - pos[ci]); if (d > bd) { bd = d; best = ci; } }
      const una = gs.length >= 2 ? [0, 1, 2, 3, 4].find(sl => gs.every(i => G[i][sl] === G[gs[0]][sl])) : undefined;
      if (bd >= 1.5) out.push(`Plus grosse surprise : le groupe voyait ${C(best)} vers le N°${Math.round(avg[best]) + 1}… ${vn === "toi" ? "tu l'as" : vn + " l'a"} mis <b>N°${pos[best] + 1}</b> !`);
      else if (una !== undefined) { const ci = +G[gs[0]][una]; out.push(`Unanimité : tout le monde a mis ${C(ci)} en N°${una + 1}${pos[ci] === una ? " — et c'était juste !" : `… raté, c'était le N°${pos[ci] + 1} !`}`); }
      else { let hate = 0; for (let ci = 1; ci < 5; ci++) if (avg[ci] > avg[hate]) hate = ci; out.push(`Le groupe pensait que ${vn === "toi" ? "tu détestais" : vn + " détestait"} ${C(hate)}… ${pos[hate] === 4 ? "et c'est bien le cas 💀" : `en vrai : <b>N°${pos[hate] + 1}</b>.`}`); }
      return out;
    }
    function buildSum(s) {
      const v = s.v, p = s.p || [], {G} = revData(s), n = NR(s), al = aliveSet();
      const order = P.map((_, i) => i).sort((a, b) => (s.S[b] - s.S[a]) || a - b);
      const f = facts(s);
      const nextV = s.r < n ? s.V[s.r] : -1;
      page.innerHTML = `<section class="pri-sum"><h2 class="pri-h">Manche ${s.r}/${n} · <em>le bilan</em></h2>
        <ul class="pri-pts">${order.map((i, j) => {
          const role = i === v ? `⭐ Vedette · moyenne des devineurs` : G[i] ? (() => { const sc = score(s.vo, G[i]); return `🎯 ${sc.ex}/5 pile${sc.near ? ` · ${sc.near} à une place` : ""}${sc.ex === 5 ? " · PARFAIT" : ""}`; })() : al.has(P[i].key) ? "—" : "a quitté le plateau";
          return `<li class="${i === mySeat ? "pri-me " : ""}${i === v ? "pri-v " : ""}${al.has(P[i].key) ? "" : "pri-gone"}" style="--i:${j}">${bust(i)}<b class="pri-nm">${nm(i)}${i === mySeat ? " (toi)" : ""}<small>${role}</small></b>
            <span class="pri-gain${p[i] ? "" : " pri-z"}">+${p[i] || 0}</span><span class="pri-tot">${s.S[i]}</span></li>`;
        }).join("")}</ul>
        ${f.length ? `<div class="pri-know"><h4>💡 Le saviez-vous ?</h4>${f.map(x => `<p>${x}</p>`).join("")}</div>` : ""}
        <p class="pri-next" id="pri-next"></p>
        <h3 class="pri-h3">Qui a mis quoi ?</h3>${boardHTML(s, 5)}</section>`;
      updSum(s, nextV);
    }
    function updSum(s) {
      const n = NR(s), nx = $("pri-next"); if (!nx) return;
      const nextV = s.r < n ? s.V[s.r] : -1;
      nx.innerHTML = nextV >= 0 ? `Prochaine Vedette : <b>${nm(nextV)}${nextV === mySeat ? " (toi !)" : ""}</b> · dans ${s.t} s` : `Grande finale dans <b>${s.t}</b> s`;
    }
    function buildSkip(s) {
      page.innerHTML = `<section class="pri-skip"><div class="pri-tv">📺</div><h2 class="pri-h">Coupure <em>pub</em> !</h2>
        <p class="pri-sub">${nm(s.v)} a quitté le plateau : sa manche est annulée. On enchaîne…</p></section>`;
    }

    /* ---- grande finale ---- */
    function buildEnd(s) {
      const o = s.o || P.map((_, i) => i).sort((a, b) => s.S[b] - s.S[a]), al = aliveSet();
      const pod = o.slice(0, 3), slots = [1, 0, 2].filter(i => pod[i] != null), top = s.S[o[0]];
      const aw = [];
      let d = -1; P.forEach((_, i) => { if (s.E[i] > 0 && (d < 0 || s.E[i] > s.E[d])) d = i; });
      if (d >= 0) aw.push(["🔎 Meilleur détective", d, `${s.E[d]} carte${s.E[d] > 1 ? "s" : ""} pile à la bonne place`]);
      const vs = P.map((_, i) => i).filter(i => s.VN[i] > 0);
      if (vs.length) {
        const avg = i => s.VA[i] / 10 / s.VN[i];
        const lo = vs.slice().sort((a, b) => avg(a) - avg(b))[0], hi = vs.slice().sort((a, b) => avg(b) - avg(a))[0];
        aw.push(["🎭 Le plus imprévisible", lo, `ses devineurs : ${avg(lo).toFixed(1).replace(".", ",")} pts en moyenne`]);
        if (hi !== lo && avg(hi) > avg(lo)) aw.push(["📖 Livre ouvert", hi, `${avg(hi).toFixed(1).replace(".", ",")} pts en moyenne pour ses devineurs`]);
      }
      let t = -1; P.forEach((_, i) => { if (s.X[i] > 0 && (t < 0 || s.X[i] > s.X[t])) t = i; });
      if (t >= 0) aw.push(["🔮 Télépathe", t, `${s.X[t]} classement${s.X[t] > 1 ? "s" : ""} parfait${s.X[t] > 1 ? "s" : ""}`]);
      const last = o[o.length - 1];
      page.innerHTML = `<section class="pri-endv"><h2 class="pri-h" style="text-align:center">Les <em>stars</em> du show</h2>
        <div class="pri-pod">${slots.map((i, n) => { const si = pod[i], win = s.S[si] === top && top > 0;
          return `<figure class="pri-p${i + 1}" style="--d:${(n * .18).toFixed(2)}s">${win ? `<span class="pri-crown">👑</span>` : ""}${full(si, {pose: win ? "flex" : "idle", mood: win ? "win" : (si === last && NP > 2 ? "lose" : undefined)})}
            <figcaption>${nm(si)}</figcaption><div class="pri-step">${s.S[si]}<small>pts</small></div></figure>`; }).join("")}</div>
        ${aw.length ? `<div class="pri-awards">${aw.map(([ti, si, sub], n) => `<div class="pri-aw" style="--d:${(.5 + n * .15).toFixed(2)}s">${bust(si, "", {mood: "win"})}<div><small>${ti}</small><b>${nm(si)}</b><span>${sub}</span></div></div>`).join("")}</div>` : ""}
        <ul class="pri-pts">${o.map((i, j) => `<li class="${i === mySeat ? "pri-me " : ""}${al.has(P[i].key) ? "" : "pri-gone"}" style="--i:${j}"><span class="pri-tot" style="min-width:24px;text-align:center">${o.findIndex(x => s.S[x] === s.S[i]) + 1}</span>${bust(i, "", {mood: s.S[i] === top && top > 0 ? "win" : i === last && NP > 2 ? "lose" : undefined})}
          <b class="pri-nm">${nm(i)}${i === mySeat ? " (toi)" : ""}<small>${s.E[i]} pile${s.X[i] ? ` · ${s.X[i]} parfait` : ""}${s.VN[i] ? ` · Vedette ${s.VN[i]}×` : ""}</small></b><span class="pri-tot">${s.S[i]}</span></li>`).join("")}</ul></section>`;
      sfx("whoosh");
      if (mySeat >= 0 && s.S[mySeat] === top && top > 0) haptic("success");
    }

    function render(s) {
      if (dead || !s || !s.ph || s.ph === "boot") return;
      S = s;
      if (s.r !== myRound) {
        myRound = s.r; ord = [0, 1, 2, 3, 4]; myOk = 0; setSel(-1); drag = null; lastBeep = -1; revBuilt = false;
        // retour en pleine manche (rechargement) : on reprend l'ordre que l'hôte a déjà reçu
        if (mySeat >= 0 && Array.isArray(s.g)) {
          const mine = s.g[mySeat], o = mySeat === s.v ? decO(mine, s.r) : mine;
          if (validO(o)) { ord = o.split("").map(Number); if (s.ok && s.ok[mySeat] === "1") myOk = 1; }
        }
      }
      root.dataset.ph = s.ph; root.dataset.r = s.r; root.dataset.ri = s.ri != null ? s.ri : "";
      setTop(s);
      const ph = s.ph === "lock" ? "sort" : s.ph, vk = ph + ":" + s.r;
      if (vk !== view) {
        view = vk; el.scrollTop = 0; cardEls = []; rail = null; layer = null;
        ({intro: buildIntro, sort: buildSort, rev: buildRev, sum: buildSum, skip: buildSkip, end: buildEnd})[ph](s);
        if (ph === "sort") push();
      }
      if (ph === "sort") updSort(s);
      else if (ph === "rev") updRev(s);
      else if (ph === "sum") updSum(s);
    }
    api.onState(render);
    const onResize = () => { if (!drag) layout(); };
    window.addEventListener("resize", onResize);

    return {
      destroy() {
        dead = true;
        timers.forEach(t => clearTimeout(t)); timers.clear();
        clearInterval(beat); if (hostIv) clearInterval(hostIv);
        window.removeEventListener("resize", onResize);
        el.innerHTML = "";
      }
    };
  }
});
})();
