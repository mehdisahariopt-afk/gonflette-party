/* Gonflette Party : Le plus probable (3 à 8 joueurs, chacun sur son téléphone).
   Ambiance « Tribunal du muscle » + soirée électorale : bois verni, velours rouge, urne transparente et marteau de juge.
   Chaque affaire (manche), une carte « Qui est le plus susceptible de… » est tirée (paquet : games/plusprobable-deck.js).
   En secret, chacun VOTE pour un joueur (soi-même permis) et PARIE sur le joueur qui aura le plus de voix (25 s,
   fin anticipée quand tous les présents ont voté et parié). Dépouillement : les bulletins tombent un par un dans l'urne,
   les barres montent, le plus voté est couronné (« 👑 Le plus probable »), les votes sont publics.
   Points : pari sur un plus voté (égalités comprises) = +2 ; son vote pour un plus voté (« en phase avec le groupe ») = +1.
   Pas de vote = pas de point. « Jury divisé » (au moins 2 votes, personne n'a plus d'une voix) : pas de plus voté, 0 point.
   1 ou 2 affaires « Retournement » : on cherche le MOINS probable (même barème).
   Manches : 10 (3-4 joueurs), 9 (5-6), 8 (7-8). Fin : podium + une distinction par joueur, puis api.finish.

   Réseau (hôte = autorité, état absolu, numéros seulement) :
   - Entrée joueur (renvoyée régulièrement pendant le vote) : {seq, r: n° d'affaire, v: siège voté, b: siège parié}
     (-1 = pas encore choisi). L'hôte ignore une entrée d'une autre affaire ou hors phase de vote.
   - État : ph (boot|intro|vote|rev|end), n (compteur de phases), r, Q (numéros des cartes), X (« 1 » = retournement),
     t / tt (secondes restantes / durée de la phase), statistiques par siège S (points), E (élu), L (élu au retournement),
     W (voix reçues), C (paris gagnants), A (votes avec le groupe), M (votes pour soi), Z (votes oubliés), F (matrice des
     votes, une chaîne base 36 par votant) ; au vote k (avancement : - absent, 0 rien, 1 vote, 2 pari, 3 les deux),
     c (choix brouillés, pour la reprise), all ; au dépouillement V / B (vote / pari de chaque siège, « . » = aucun),
     bo (ordre des bulletins), w (sièges les plus votés), g (points de l'affaire) ; à la fin o (classement), fin.
   - resumable : l'hôte rechargé repart de api.resume.
   Tests : window.__ppSpeed = 10 accélère les durées (lu par l'hôte et pour les animations). */
(function () {
"use strict";
const GG = window.GONFLETTE = window.GONFLETTE || {};

/* ---------- paquet ---------- */
const FALLBACK = [{n: "En vrac", e: "🎲", l: "rater son train|se perdre avec un GPS|pleurer devant un dessin animé|devenir millionnaire|" +
  "finir la soirée en dansant sur la table|faire un selfie torse nu à la salle|oublier le leg day pendant 6 mois|arriver en retard à sa propre fête|" +
  "parler à ses plantes|s'endormir le premier à une soirée|oublier son passeport le jour du départ|manger une pizza entière tout seul"}];
const RAW = Array.isArray(GG.plusprobableDeck) && GG.plusprobableDeck.length ? GG.plusprobableDeck : FALLBACK;
const CATS = [], DECK = [];
(() => {
  const seen = new Set();
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  RAW.forEach((c, ci) => {
    CATS.push({n: String(c.n || ""), e: c.e || "🎲"});
    String(c.l || "").split("|").forEach(raw => {
      const t = raw.replace(/\s+/g, " ").trim(); if (!t) return;
      const k = norm(t); if (seen.has(k)) return; seen.add(k);
      DECK.push({t, k: ci});
    });
  });
})();
const card = i => DECK[i] || {t: "…", k: 0};

/* ---------- réglages ---------- */
const T = {intro1: 7, intro: 4, vote: 25, done: 1.5, lead: 1.6, ballot: .6, verdict: 1, hold: 9, empty: 5, end: 16};
const roundsFor = n => n <= 4 ? 10 : n <= 6 ? 9 : 8;
const revDur = n => n ? Math.round((T.lead + n * T.ballot + T.verdict + T.hold) * 10) / 10 : T.empty;
const RECENT_KEY = "gonflette-pp-recent";
const QUIP_P = ["Le tribunal a tranché.", "Verdict sans appel.", "Personne n'est surpris.", "Coupable, évidemment !", "La preuve par le muscle.",
  "Le peuple a parlé.", "Affaire rondement menée.", "Aucun doute possible.", "Le jury est formel.", "C'était écrit."];
const QUIP_M = ["Le tribunal n'y croit pas une seconde.", "Jamais de la vie !", "Trop sage pour ça.", "Innocence totale.", "Même pas en rêve."];

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const andList = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1];
const pl = (n, w, ws) => n + " " + (n > 1 ? (ws || w + "s") : w);
/* choix brouillés dans l'état pendant le vote (pas affichés ; juste pour qu'un joueur revenu retrouve les siens) */
const encC = (v, r, i, w) => v < 0 ? "-" : ((v + 3 + r * 5 + i * 7 + w * 4) % 11).toString(36);
const decC = (ch, r, i, w, n) => { if (!ch || ch === "-") return -1; const d = parseInt(ch, 36); if (!isFinite(d)) return -1; const v = (((d - 3 - r * 5 - i * 7 - w * 4) % 11) + 11) % 11; return v < n ? v : -1; };

const CSS = `
.pp{--ink:#1d0f07;--w1:#5b2e16;--w2:#2a1209;--gold:#f6c445;--gold2:#c98a1c;--red:#c8102e;--vel:#7d0b1f;--paper:#fbefd5;--paper2:#ecd6a8;--bet:#12b5a5;--bet2:#0a7e73;
  --tx:#fff6e6;--dim:#e2cfb0;--ok:#3ccf8e;
  position:relative;min-height:100%;box-sizing:border-box;padding:0 0 28px;color:var(--tx);overflow-x:clip;
  font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;font-size:17px;line-height:1.2;
  background:radial-gradient(80% 40% at 50% 0%,rgba(255,200,90,.22),transparent 70%),
    repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 2px,transparent 2px 58px),
    repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 9px,transparent 9px 23px),
    linear-gradient(180deg,var(--w1),var(--w2) 80%);background-color:var(--w2)}
.pp *{box-sizing:border-box}
.pp button{font-family:inherit;-webkit-tap-highlight-color:transparent}
/* bandeau du tribunal */
.pp-top{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:8px;padding:6px max(12px,calc(50% - 290px));
  background:linear-gradient(180deg,#9b1026,var(--vel));border-bottom:3px solid var(--gold);box-shadow:0 3px 0 var(--ink)}
.pp-logo{flex:none;display:flex;align-items:center;gap:6px;line-height:.9}
.pp-logo i{font-style:normal;font-size:26px;display:inline-block;transform:rotate(-20deg);filter:drop-shadow(2px 2px 0 var(--ink))}
.pp-logo b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:20px;letter-spacing:.06em;color:var(--gold);text-shadow:2px 2px 0 var(--ink)}
.pp-logo small{display:block;font-family:"Pacifico",cursive;font-size:13px;color:#fff;margin-top:1px}
.pp-rd{flex:1;min-width:0;text-align:right;font-weight:800;font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-rd b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:18px;letter-spacing:.04em;color:#fff}
.pp-clock{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-family:"Anton",Impact,sans-serif;font-size:19px;color:#fff;font-variant-numeric:tabular-nums;
  background:radial-gradient(circle,var(--vel) 56%,transparent 57%),conic-gradient(var(--gold) calc(var(--p,1) * 360deg),rgba(255,255,255,.16) 0)}
.pp-clock.pp-hot{background:radial-gradient(circle,var(--vel) 56%,transparent 57%),conic-gradient(#fff calc(var(--p,1) * 360deg),rgba(255,255,255,.16) 0);animation:pp-pulse 1s ease-in-out infinite}
.pp-clock[hidden]{display:none}
.pp-page{max-width:560px;margin:0 auto;padding:10px 14px 0}
.pp-av{display:block;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#fff3c4,#f6c445 65%,#b9801b);border:3px solid var(--ink)}
.pp-av svg,.pp-full svg{width:100%;height:100%;display:block}
.pp-full{display:block;position:relative;aspect-ratio:290/250}
.pp-gone{opacity:.45;filter:grayscale(1)}
/* le dossier (carte de la manche) */
.pp-case{position:relative;margin:0 0 10px;padding:9px 12px 12px;background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink);border:3px solid var(--ink);border-radius:12px;box-shadow:0 5px 0 var(--ink)}
.pp-case::after{content:"";position:absolute;right:-7px;bottom:-9px;width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ff5a6e,var(--red) 60%,#7d0b1f);border:2px solid var(--ink);box-shadow:0 2px 0 var(--ink)}
.pp-kick{display:flex;align-items:center;gap:8px;justify-content:space-between;margin:0 0 4px}
.pp-kick span{font-weight:800;font-size:15px;letter-spacing:.03em;text-transform:uppercase;color:#7a4f25}
.pp-kick em{font-style:normal;padding:0 5px;background:var(--red);color:#fff;border-radius:4px}
.pp-cat{flex:none;font-style:normal;padding:1px 8px;border-radius:999px;background:rgba(29,15,7,.1);font-weight:800;font-size:13px;color:#5a3a1b;white-space:nowrap}
.pp-case h2{margin:0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(23px,6.8vw,31px);line-height:1.08;letter-spacing:.005em;overflow-wrap:anywhere}
.pp-case.pp-tw{border-color:var(--red);box-shadow:0 5px 0 var(--red)}
.pp-flag{position:absolute;right:-6px;top:-13px;padding:2px 9px;background:var(--red);color:#fff;border:2px solid var(--ink);font-family:"Anton",Impact,sans-serif;font-size:14px;letter-spacing:.06em;transform:rotate(4deg);box-shadow:0 2px 0 var(--ink)}
.pp-case.pp-in{animation:pp-slam .55s cubic-bezier(.2,1.5,.5,1) backwards}
/* intro */
.pp-intro{text-align:center;padding-top:6px}
.pp-bench{position:relative;height:92px;margin:2px auto 0;width:200px}
.pp-gav{position:absolute;left:58px;top:2px;font-size:62px;line-height:1;transform-origin:80% 85%;animation:pp-gavel 1.1s cubic-bezier(.5,0,.3,1) .1s backwards;filter:drop-shadow(3px 3px 0 var(--ink))}
.pp-block{position:absolute;left:58px;bottom:6px;width:90px;height:16px;border-radius:6px;background:linear-gradient(#a0602a,#6b3814);border:3px solid var(--ink)}
.pp-boom{position:absolute;left:96px;bottom:12px;font-family:"Anton",Impact,sans-serif;font-size:22px;color:var(--gold);opacity:0;animation:pp-boom .6s .62s forwards}
.pp-aff{margin:0 0 10px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(34px,11vw,48px);line-height:1;text-transform:uppercase;color:var(--gold);text-shadow:3px 3px 0 var(--ink)}
.pp-aff small{font-size:.5em;color:var(--dim);text-shadow:none}
.pp-intro .pp-case{text-align:left}
.pp-twist{margin:0 0 14px;padding:8px 10px;border:3px solid var(--ink);border-radius:12px;background:var(--red);color:#fff;transform:rotate(-1deg);animation:pp-pop .5s .2s backwards;box-shadow:0 4px 0 var(--ink)}
.pp-twist b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:24px;letter-spacing:.04em;text-transform:uppercase}
.pp-twist span{font-weight:700;font-size:17px}
.pp-twist em{font-style:normal;padding:0 4px;background:#fff;color:var(--red);border-radius:3px;font-weight:900}
.pp-how{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:6px;text-align:left}
.pp-how li{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:12px;background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.12);font-weight:600;font-size:17px;animation:pp-up .45s backwards;animation-delay:calc(.5s + var(--i) * .15s)}
.pp-how li i{flex:none;font-style:normal;font-size:24px}
.pp-how b{color:var(--gold)}
.pp-ready{margin:14px 0 0;font-weight:800;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.pp-ready b{display:inline-block;min-width:26px;margin-left:6px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:26px;color:#fff;vertical-align:middle}
/* vote */
.pp-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 6px}
.pp-tab{position:relative;min-height:52px;padding:5px 8px 5px 10px;border-radius:12px;border:3px solid rgba(255,255,255,.22);background:rgba(0,0,0,.3);color:var(--tx);text-align:left;cursor:pointer;display:grid;align-content:center;gap:1px}
.pp-tab b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:19px;letter-spacing:.03em;line-height:1.05;text-transform:uppercase}
.pp-tab small{font-weight:700;font-size:13px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-tab .pp-ck{position:absolute;right:-7px;top:-9px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:14px;background:var(--ok);color:var(--ink);border:2px solid var(--ink);transform:scale(0);transition:transform .2s cubic-bezier(.3,1.6,.6,1)}
.pp-tab.pp-has .pp-ck{transform:scale(1)}
.pp-tab.pp-act{border-color:var(--ink);box-shadow:0 4px 0 var(--ink)}
.pp-tab.pp-tv.pp-act{background:var(--red)}
.pp-tab.pp-tb.pp-act{background:var(--bet)}
.pp-tab.pp-act small{color:#fff}
.pp-hint{min-height:20px;margin:0 0 8px;font-weight:700;font-size:16px;color:var(--dim);text-align:center}
.pp-hint b{color:var(--gold)}
.pp-grid{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:8px;--avs:58px}
.pp-grid.pp-big{--avs:80px}
.pp-pick{position:relative;display:grid;justify-items:center;gap:4px;min-width:0;padding:8px 4px 6px;border-radius:14px;border:3px solid var(--ink);background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink);cursor:pointer;
  box-shadow:0 4px 0 var(--ink);transition:transform .14s,background .14s;touch-action:manipulation}
.pp-pick .pp-av{width:var(--avs);height:var(--avs)}
.pp-pick b{max-width:100%;font-weight:800;font-size:17px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-you{position:absolute;left:50%;top:-10px;transform:translateX(-50%);padding:1px 7px;border-radius:999px;background:var(--ink);color:var(--gold);border:2px solid var(--gold2);font-style:normal;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;line-height:1.2;pointer-events:none}
.pp-pick:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.pp-pick:focus-visible{outline:3px solid #fff;outline-offset:2px}
.pp-bdg,.pp-mk{position:absolute;font-style:normal;line-height:1;pointer-events:none}
.pp-bdg{right:-6px;top:-8px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:17px;border:2px solid var(--ink);background:#fff;transform:scale(0) rotate(-30deg);transition:transform .2s cubic-bezier(.3,1.6,.6,1)}
.pp-mk{left:5px;top:5px;font-size:15px;opacity:0}
.pp-pick.pp-on{transform:rotate(-1.5deg) scale(1.04);color:#fff}
.pp-pick.pp-on .pp-bdg{transform:none}
.pp-grid[data-t="v"] .pp-pick.pp-on{background:linear-gradient(180deg,#e0213f,var(--red))}
.pp-grid[data-t="b"] .pp-pick.pp-on{background:linear-gradient(180deg,#19cbb9,var(--bet2))}
.pp-pick.pp-mark .pp-mk{opacity:1}
.pp-wait{margin:20px 0;text-align:center;font-family:"Anton",Impact,sans-serif;font-size:26px;text-transform:uppercase;color:var(--gold)}
.pp-prog{margin:12px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
.pp-prog p{margin:0;width:100%;text-align:center;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.pp-prog p b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:18px;color:#fff;letter-spacing:.02em}
.pp-chip{position:relative;width:34px;height:34px}
.pp-chip .pp-av{width:34px;height:34px;border-width:2px;opacity:.5;filter:grayscale(.6)}
.pp-chip.pp-ok .pp-av{opacity:1;filter:none;box-shadow:0 0 0 2px var(--ok)}
.pp-chip i{position:absolute;right:-4px;bottom:-4px;font-style:normal;font-size:13px;line-height:1}
.pp-chip.pp-x .pp-av{opacity:.3;filter:grayscale(1)}
/* dépouillement */
.pp-mini{margin:0 0 8px;padding:6px 10px 7px;background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink);border:3px solid var(--ink);border-radius:10px}
.pp-mini small{display:block;font-weight:800;font-size:13px;letter-spacing:.03em;text-transform:uppercase;color:#7a4f25}
.pp-mini small em{font-style:normal;padding:0 4px;background:var(--red);color:#fff;border-radius:3px}
.pp-mini b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:18px;line-height:1.1}
.pp-mini.pp-tw{border-color:var(--red)}
.pp-stage{position:relative;height:206px;margin:0 0 8px;border-radius:16px;border:3px solid var(--gold2);overflow:hidden;
  background:radial-gradient(60% 80% at 50% 0%,rgba(255,214,120,.38),transparent 70%),linear-gradient(180deg,#3a1a0b,#160803);box-shadow:inset 0 0 30px rgba(0,0,0,.6),0 4px 0 var(--ink)}
.pp-stage.pp-sm{height:184px}
.pp-stage::before{content:"";position:absolute;left:50%;top:50%;width:560px;height:560px;margin:-280px 0 0 -280px;opacity:0;
  background:repeating-conic-gradient(rgba(255,214,120,.16) 0 10deg,transparent 10deg 20deg);transition:opacity .6s}
.pp-stage.pp-done::before{opacity:1;animation:pp-spin 14s linear infinite}
.pp-cap{position:absolute;left:0;right:0;top:8px;margin:0;text-align:center;font-weight:800;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.pp-cap i{font-style:normal;display:inline-block;animation:pp-dot 1s infinite}
.pp-cap i:nth-of-type(2){animation-delay:.15s}.pp-cap i:nth-of-type(3){animation-delay:.3s}
.pp-urnw{position:absolute;left:50%;bottom:12px;width:150px;height:132px;margin-left:-75px}
.pp-stage.pp-sm .pp-urnw{transform:scale(.88);transform-origin:50% 100%}
.pp-urn{position:absolute;left:0;right:0;bottom:0;height:90px;border:3px solid rgba(255,255,255,.65);border-top-width:0;border-radius:4px 4px 16px 16px;
  background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,.07));box-shadow:inset 0 0 18px rgba(255,255,255,.16),0 6px 0 rgba(0,0,0,.4);
  display:grid;place-items:center;align-content:center;gap:0;color:#fff}
.pp-urn::before{content:"";position:absolute;left:-9px;right:-9px;top:-14px;height:16px;border-radius:6px;background:linear-gradient(#4a4a58,#1e1e28);border:3px solid var(--ink)}
.pp-urn::after{content:"";position:absolute;left:50%;top:-9px;width:62px;height:6px;margin-left:-31px;border-radius:3px;background:#000}
.pp-urn b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:36px;line-height:1;color:var(--gold);text-shadow:2px 2px 0 var(--ink)}
.pp-urn small{font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
.pp-urn.pp-bump{animation:pp-bump .3s}
.pp-ballot{position:absolute;left:50%;top:0;width:42px;height:50px;margin-left:-21px;background:#fff;border:2px solid var(--ink);border-radius:4px;box-shadow:0 3px 0 rgba(0,0,0,.3);opacity:0;display:grid;place-items:center}
.pp-ballot .pp-av{width:32px;height:32px;border-width:2px}
.pp-ballot.pp-go{animation:pp-drop var(--bd,.55s) ease-in forwards}
.pp-verdict{position:absolute;inset:0;display:flex;align-items:center;gap:10px;padding:34px 12px 8px;opacity:0;pointer-events:none}
.pp-stage.pp-done .pp-urnw,.pp-stage.pp-done .pp-cap{animation:pp-out .35s forwards}
.pp-stage.pp-done .pp-verdict{opacity:1;animation:pp-zoom .75s cubic-bezier(.2,1.45,.4,1)}
.pp-wfig{flex:none;position:relative;width:40%;max-width:170px;align-self:flex-end;margin-bottom:-4px}
.pp-wfig .pp-full{transform:scale(1.3);transform-origin:50% 92%}
.pp-crown{position:absolute;left:50%;top:-30px;z-index:2;font-size:34px;line-height:1;transform:translateX(-50%) rotate(-10deg);filter:drop-shadow(2px 2px 0 var(--ink))}
.pp-stage.pp-done .pp-crown{animation:pp-crown .6s .45s backwards cubic-bezier(.3,1.6,.6,1)}
.pp-wtx{flex:1;min-width:0;position:relative;z-index:1;padding-bottom:22px}
.pp-rib{display:inline-block;padding:3px 9px 2px;background:var(--gold);color:var(--ink);border:2px solid var(--ink);box-shadow:0 3px 0 var(--ink);font-family:"Anton",Impact,sans-serif;font-size:14px;letter-spacing:.03em;text-transform:uppercase;transform:rotate(-2deg);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pp-rib.pp-ribm{background:#bfe7ff}
.pp-rib.pp-ribt{position:absolute;right:12px;top:12px;max-width:calc(100% - 24px)}
.pp-wn{display:block;margin:6px 0 2px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(25px,7.6vw,34px);line-height:1.02;text-transform:uppercase;color:#fff;text-shadow:3px 3px 0 var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-wd{display:block;font-weight:700;font-size:15px;color:var(--dim)}
.pp-wd b{color:#fff}
.pp-una{display:inline-block;margin-top:3px;padding:1px 7px;border-radius:999px;background:var(--red);color:#fff;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
.pp-quip{display:block;margin-top:3px;font-family:"Pacifico",cursive;font-size:14px;line-height:1.35;color:var(--gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-stamp{position:absolute;right:10px;bottom:10px;z-index:3;padding:0 8px;border:3px solid #ff4d5e;border-radius:6px;color:#ff4d5e;background:rgba(22,8,3,.6);font-family:"Anton",Impact,sans-serif;font-size:20px;letter-spacing:.06em;transform:rotate(-12deg);opacity:0}
.pp-stage.pp-done .pp-stamp{animation:pp-stamp .3s .75s forwards cubic-bezier(.3,1.6,.6,1)}
.pp-hit{position:absolute;right:112px;bottom:6px;z-index:3;font-size:28px;line-height:1;opacity:0;transform-origin:85% 85%;filter:drop-shadow(2px 2px 0 var(--ink))}
.pp-stage.pp-done .pp-hit{animation:pp-hit .7s .35s forwards}
.pp-verdict.pp-col{flex-direction:column;justify-content:center;gap:4px;text-align:center;padding:10px 12px 8px}
.pp-verdict.pp-col .pp-hit,.pp-verdict.pp-col .pp-stamp{display:none}
.pp-ties{display:flex;justify-content:center;gap:8px;margin-top:10px}
.pp-tie{position:relative}
.pp-tie .pp-av{width:62px;height:62px}
.pp-tie .pp-crown{font-size:22px;top:-14px}
.pp-verdict.pp-col .pp-wn{font-size:clamp(20px,6vw,26px);white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pp-none{display:grid;justify-items:center;gap:2px;width:100%;text-align:center}
.pp-none span{font-size:48px;line-height:1}
.pp-none b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:26px;text-transform:uppercase;color:var(--gold)}
.pp-none small{font-weight:700;font-size:16px;color:var(--dim)}
.pp-me{margin:8px 0 0;min-height:38px;padding:7px 12px;border-radius:12px;background:var(--ink);border:2px solid var(--gold2);font-weight:700;font-size:16px;line-height:1.2;text-align:center;visibility:hidden}
.pp-me b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:20px;color:var(--gold);margin-right:4px}
.pp-me.pp-show{visibility:visible;animation:pp-up .4s}
.pp-me.pp-zero b{color:var(--dim)}
.pp-rows{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:5px}
.pp-rows.pp-cmp{gap:4px}.pp-rows.pp-cmp .pp-row{height:36px}.pp-rows.pp-cmp .pp-row .pp-av{width:30px;height:30px}
.pp-row{display:flex;align-items:center;gap:7px;height:40px;padding:0 8px 0 2px;border-radius:999px;background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.13);transition:background .35s,border-color .35s}
.pp-row .pp-av{width:34px;height:34px;flex:none;border-width:2px}
.pp-rn{flex:0 1 74px;min-width:0;font-weight:800;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-bar{flex:1;min-width:0;position:relative;height:28px;border-radius:999px;background:rgba(0,0,0,.35);display:flex;align-items:center;padding:0 3px;overflow:hidden}
.pp-fill{position:absolute;left:0;top:0;bottom:0;width:0;max-width:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold2),var(--gold));transition:width .35s cubic-bezier(.3,1.4,.6,1)}
.pp-faces{position:relative;display:flex;min-width:0}
.pp-face{flex:none;width:23px;height:23px;margin-right:-6px;border-radius:50%;border:2px solid var(--ink);background:#fff3c4;overflow:hidden;animation:pp-pop .35s cubic-bezier(.3,1.6,.6,1)}
.pp-face svg{width:100%;height:100%;display:block}
.pp-n{position:relative;margin-left:auto;padding:0 5px 0 10px;font-style:normal;font-family:"Anton",Impact,sans-serif;font-size:19px;line-height:1;color:#fff;text-shadow:1px 1px 0 var(--ink)}
.pp-n.pp-z{opacity:.4}
.pp-pts{flex:none;min-width:30px;text-align:right;font-family:"Anton",Impact,sans-serif;font-size:19px;color:var(--gold);opacity:0}
.pp-pts.pp-z{color:var(--dim)}
.pp-rows.pp-fin .pp-pts{opacity:1;animation:pp-pop .35s backwards}
.pp-row.pp-win{background:rgba(246,196,69,.24);border-color:var(--gold)}
.pp-row.pp-mine{border-color:#fff}
.pp-after{margin-top:10px;opacity:0}
.pp-after.pp-show{opacity:1;animation:pp-up .45s}
.pp-line{margin:0 0 6px;font-weight:600;font-size:16px;color:var(--dim)}
.pp-line b{color:#fff}
.pp-strip{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}
.pp-sc{display:flex;align-items:center;gap:5px;max-width:100%;padding:2px 9px 2px 2px;border-radius:999px;background:rgba(0,0,0,.32);border:2px solid rgba(255,255,255,.14);font-weight:800;font-size:15px}
.pp-sc .pp-av{width:26px;height:26px;border-width:2px;flex:none}
.pp-sc span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-sc em{font-style:normal;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:17px;color:var(--gold)}
.pp-sc.pp-mine{border-color:#fff}
.pp-next{margin:10px 0 0;text-align:center;font-weight:700;color:var(--dim)}
.pp-next b{font-family:"Anton",Impact,sans-serif;font-weight:400;color:#fff}
.pp-h3{margin:12px 0 4px;font-weight:800;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
/* verdict final */
.pp-endv{text-align:center}
.pp-endh{margin:2px 0 0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(32px,10vw,44px);line-height:1;text-transform:uppercase;color:var(--gold);text-shadow:3px 3px 0 var(--ink)}
.pp-ends{margin:2px 0 6px;font-family:"Pacifico",cursive;font-size:16px;color:#fff}
.pp-pod{display:flex;justify-content:center;align-items:flex-end;gap:8px;margin:4px 0 12px}
.pp-pod figure{margin:0;width:31%;max-width:150px;display:grid;justify-items:center;gap:2px;text-align:center;animation:pp-up .6s backwards;animation-delay:var(--d)}
.pp-pod figcaption{max-width:100%;font-weight:800;font-size:17px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-pod .pp-full{width:100%}
.pp-step{width:100%;display:grid;place-items:center;border:3px solid var(--ink);border-bottom:0;border-radius:10px 10px 0 0;font-family:"Anton",Impact,sans-serif;font-size:24px;line-height:1;color:var(--ink);background:var(--paper)}
.pp-step small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:13px}
.pp-p1 .pp-step{height:76px;background:var(--gold)}.pp-p2 .pp-step{height:54px;background:#e4dccd}.pp-p3 .pp-step{height:42px;background:#e8a76a}
.pp-pod .pp-crown{position:static;transform:rotate(-8deg);font-size:28px}
.pp-aws{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:4px 0 12px;text-align:left}
.pp-aw{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:14px;border:3px solid var(--ink);background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink);box-shadow:0 3px 0 var(--ink);animation:pp-pop .4s backwards;animation-delay:var(--d)}
.pp-aw .pp-av{width:44px;height:44px;flex:none}
.pp-aw div{min-width:0}
.pp-aw small{display:block;font-weight:800;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--red);line-height:1.1}
.pp-aw b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:20px;line-height:1.08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-aw span{display:block;font-weight:600;font-size:14px;color:#6b4a2b;line-height:1.1}
.pp-aw.pp-mine{box-shadow:0 3px 0 var(--ink),0 0 0 3px var(--gold)}
.pp-rk{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:6px;text-align:left}
.pp-rk li{display:flex;align-items:center;gap:8px;padding:4px 12px 4px 6px;border-radius:999px;background:rgba(0,0,0,.3);border:2px solid rgba(255,255,255,.14);animation:pp-up .45s backwards;animation-delay:calc(var(--i) * 70ms)}
.pp-rk li.pp-mine{border-color:#fff}
.pp-rk li.pp-1{background:rgba(246,196,69,.24);border-color:var(--gold)}
.pp-rk .pp-av{width:38px;height:38px;flex:none;border-width:2px}
.pp-rkn{flex:none;width:22px;text-align:center;font-family:"Anton",Impact,sans-serif;font-size:20px}
.pp-rkm{flex:1;min-width:0;font-weight:800;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-rkm small{display:block;font-weight:600;font-size:13px;color:var(--dim)}
.pp-rkt{flex:none;font-family:"Anton",Impact,sans-serif;font-size:24px;color:var(--gold)}
@keyframes pp-pulse{50%{transform:scale(1.1)}}
@keyframes pp-slam{from{opacity:0;transform:scale(1.35) rotate(3deg)}}
@keyframes pp-gavel{0%{transform:rotate(-55deg) translate(-6px,-10px)}55%{transform:rotate(-60deg) translate(-6px,-12px)}70%{transform:rotate(12deg)}82%{transform:rotate(-6deg)}100%{transform:none}}
@keyframes pp-boom{0%{opacity:0;transform:scale(.4)}40%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(1.5) translateY(-10px)}}
@keyframes pp-pop{from{opacity:0;transform:scale(.4)}}
@keyframes pp-up{from{opacity:0;transform:translateY(16px)}}
@keyframes pp-dot{50%{opacity:.15}}
@keyframes pp-drop{0%{opacity:0;transform:translateY(-34px) rotate(-16deg)}18%{opacity:1;transform:translateY(-22px) rotate(-8deg)}68%{opacity:1;transform:translateY(22px) rotate(0)}100%{opacity:0;transform:translateY(40px) scaleY(.2)}}
@keyframes pp-bump{40%{transform:scale(1.06,.94)}70%{transform:scale(.98,1.03)}}
@keyframes pp-out{to{opacity:0;transform:scale(.6) translateY(30px)}}
@keyframes pp-zoom{0%{opacity:0;transform:scale(.25)}100%{opacity:1;transform:none}}
@keyframes pp-crown{from{opacity:0;transform:translate(-50%,-40px) rotate(-30deg) scale(.5)}}
@keyframes pp-stamp{0%{opacity:0;transform:rotate(-12deg) scale(2.4)}100%{opacity:1;transform:rotate(-12deg) scale(1)}}
@keyframes pp-hit{0%{opacity:1;transform:rotate(-50deg)}45%{opacity:1;transform:rotate(15deg)}60%{transform:rotate(-4deg)}100%{opacity:1;transform:none}}
@keyframes pp-spin{to{transform:rotate(360deg)}}
@media (min-width:700px){.pp-page{padding-top:16px}.pp-grid{--avs:72px}.pp-grid.pp-big{--avs:96px}.pp-grid.pp-4{--cols:4!important}}
@media (max-width:370px){.pp-logo small{display:none}.pp-rn{flex-basis:62px;font-size:15px}.pp-grid{--avs:52px}.pp-grid.pp-big{--avs:72px}.pp-tab b{font-size:17px}}
@media (prefers-reduced-motion:reduce){.pp *,.pp *::before,.pp *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;

GONFLETTE.registerGame({
  id: "plusprobable",
  name: "Le plus probable",
  min: 3,
  max: 8,
  resumable: true,
  create(api) {
    const el = api.el, P = api.players, NP = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] != null ? seatOf[api.me] : -1;
    const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const spd = () => Math.max(1, Math.min(50, +window.__ppSpeed || 1));
    const k = () => 1 / spd();
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const cancel = t => { if (t) { clearTimeout(t); timers.delete(t); } };
    const aliveSet = () => new Set(api.connected());
    const sfx = n => { try { if (api.sfx) api.sfx(n); } catch (e) {} };
    const haptic = n => { try { if (api.haptic) api.haptic(n); } catch (e) {} };

    el.innerHTML = `<style>${CSS}</style><div class="pp" id="pp-root">
      <header class="pp-top"><div class="pp-logo" aria-label="Le Tribunal du muscle"><i aria-hidden="true">🔨</i><div><b>TRIBUNAL</b><small>du muscle</small></div></div>
        <div class="pp-rd" id="pp-rd"></div><div class="pp-clock" id="pp-clock" role="timer" hidden></div></header>
      <main class="pp-page" id="pp-page" aria-live="polite"></main></div>`;
    const root = el.querySelector("#pp-root"), page = el.querySelector("#pp-page");
    const $ = id => el.querySelector("#" + id);

    /* ---------- petits rendus (SVG d'avatars mis en cache) ---------- */
    const svgCache = new Map();
    function avSVG(i, o) {
      const p = P[i]; if (!p) return "";
      const key = i + "|" + (o.view || "") + "|" + (o.pose || "") + "|" + (o.mood || "");
      let s = svgCache.get(key);
      if (s == null) { try { s = api.avatar(p.key, o) || ""; } catch (e) { s = ""; } svgCache.set(key, s); }
      return s;
    }
    const nm = i => esc(P[i] ? P[i].pseudo : "?");
    const bust = (i, cls, o) => `<span class="pp-av${cls ? " " + cls : ""}">${avSVG(i, Object.assign({view: "bust"}, o || {}))}</span>`;
    const full = (i, o) => `<span class="pp-full">${avSVG(i, Object.assign({pose: "flex"}, o || {}))}</span>`;
    const NRof = s => (s && Array.isArray(s.Q) ? s.Q.length : 0);
    const isTw = s => !!(s && s.X && s.X[s.r - 1] === "1");
    const qOf = s => card(s && Array.isArray(s.Q) ? s.Q[s.r - 1] : -1);
    const kickHTML = tw => tw ? `Qui est le <em>moins</em> susceptible de…` : `Qui est le plus susceptible de…`;
    function caseHTML(s, anim) {
      const d = qOf(s), c = CATS[d.k] || {n: "", e: "🎲"}, tw = isTw(s);
      return `<div class="pp-case${tw ? " pp-tw" : ""}${anim && !RM ? " pp-in" : ""}">${tw ? `<span class="pp-flag">RETOURNEMENT</span>` : ""}
        <div class="pp-kick"><span>${kickHTML(tw)}</span>${tw ? "" : `<i class="pp-cat">${c.e} ${esc(c.n)}</i>`}</div>
        <h2>…${esc(d.t)}&nbsp;?</h2></div>`;
    }

    /* =================== HÔTE =================== */
    let H = null, lastPub = "", hostIv = null, inputs = {}, finished = false;
    const zeros = () => P.map(() => 0);
    function loadRecent() { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a.filter(n => Number.isInteger(n) && n >= 0 && n < DECK.length) : []; } catch (e) { return []; } }
    function remember(cs) {
      const recent = loadRecent();
      for (const c of cs) { const j = recent.indexOf(c); if (j >= 0) recent.splice(j, 1); recent.push(c); }
      const max = Math.max(0, Math.min(420, DECK.length - 40));
      while (recent.length > max) recent.shift();
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
    }
    function draw(n) {
      const avoid = new Set(loadRecent());
      let pool = DECK.map((_, i) => i).filter(i => !avoid.has(i));
      if (pool.length < n * 3) pool = DECK.map((_, i) => i);
      shuffle(pool);
      const pick = [];
      // variété : pas deux cartes de suite de la même catégorie, si possible
      for (let pass = 0; pass < 2 && pick.length < n; pass++)
        for (const d of pool) { if (pick.length >= n) break; if (pick.includes(d)) continue; if (!pass && pick.length && DECK[pick[pick.length - 1]].k === DECK[d].k) continue; pick.push(d); }
      while (pick.length < n) pick.push(pick.length % Math.max(1, DECK.length));
      remember(pick);
      return pick;
    }
    function twists(nr) {
      const x = Array(nr).fill("0");
      if (nr >= 9) { const a = 3 + Math.floor(Math.random() * 3), b = Math.min(nr - 1, a + 3 + Math.floor(Math.random() * 2)); x[a - 1] = "1"; x[b - 1] = "1"; }
      else if (nr >= 5) x[Math.min(nr - 1, 4 + Math.floor(Math.random() * 3)) - 1] = "1";
      return x.join("");
    }
    function fresh() {
      const nr = roundsFor(NP);
      return {ph: "boot", n: 0, r: 0, Q: draw(nr), X: twists(nr), tl: 0, tt: 0,
        S: zeros(), E: zeros(), L: zeros(), W: zeros(), C: zeros(), A: zeros(), M: zeros(), Z: zeros(), F: P.map(() => "0".repeat(NP)),
        cv: P.map(() => -1), cb: P.map(() => -1), k: "", all: 0};
    }
    function pub() {
      const s = {ph: H.ph, n: H.n, r: H.r, Q: H.Q, X: H.X, t: Math.max(0, Math.ceil(H.tl - 1e-6)), tt: H.tt,
        S: H.S, E: H.E, L: H.L, W: H.W, C: H.C, A: H.A, M: H.M, Z: H.Z, F: H.F};
      if (H.ph === "intro" || H.ph === "vote") {
        s.k = H.k; s.c = P.map((_, i) => encC(H.cv[i], H.r, i, 0) + encC(H.cb[i], H.r, i, 1)).join("");
        if (H.all) s.all = 1;
      }
      if (H.ph === "rev") { s.V = H.V; s.B = H.B; s.bo = H.bo; s.w = H.w; s.g = H.g; }
      if (H.ph === "end") { s.o = H.o; s.fin = H.fin || 0; }
      const j = JSON.stringify(s);
      if (j === lastPub) return;
      lastPub = j; api.setState(s);
    }
    function startRound(r) {
      H.n++;
      if (r > H.Q.length) return goEnd();
      H.r = r; H.ph = "intro"; H.tl = H.tt = r === 1 ? T.intro1 : T.intro;
      H.cv = P.map(() => -1); H.cb = P.map(() => -1); H.all = 0;
      delete H.V; delete H.B; delete H.bo; delete H.w; delete H.g;
      progress();
    }
    function startVote() { H.ph = "vote"; H.n++; H.tl = H.tt = T.vote; H.all = 0; readInputs(); progress(); }
    function progress() {
      const al = aliveSet();
      H.k = P.map((p, i) => !al.has(p.key) ? "-" : String((H.cv[i] >= 0 ? 1 : 0) + (H.cb[i] >= 0 ? 2 : 0))).join("");
      if (H.ph !== "vote" || H.all) return;
      // fin anticipée : tous les joueurs présents (connectés et dont la présence est là) ont voté ET parié
      const need = P.map((_, i) => i).filter(i => al.has(P[i].key) && inputs[P[i].key] !== undefined);
      if (need.length && need.every(i => H.cv[i] >= 0 && H.cb[i] >= 0)) { H.all = 1; H.tl = Math.min(H.tl, T.done); }
    }
    function readInputs() {
      if (!H || H.ph !== "vote") return;
      for (const key in inputs) {
        const inp = inputs[key], i = seatOf[key];
        if (i == null || !inp || inp.r !== H.r) continue;                       // entrée d'une autre affaire : ignorée
        if (Number.isInteger(inp.v) && inp.v >= 0 && inp.v < NP) H.cv[i] = inp.v;
        if (Number.isInteger(inp.b) && inp.b >= 0 && inp.b < NP) H.cb[i] = inp.b;
      }
    }
    function startRev() {
      readInputs();
      const al = aliveSet(), tw = H.X[H.r - 1] === "1";
      const V = P.map((p, i) => al.has(p.key) && H.cv[i] >= 0 ? H.cv[i] : -1);
      const B = P.map((p, i) => V[i] >= 0 && H.cb[i] >= 0 ? H.cb[i] : -1);   // pas de vote = pas de pari compté
      const cnt = zeros(); V.forEach(v => { if (v >= 0) cnt[v]++; });
      // « jury divisé » : au moins 2 votes et personne n'a plus d'une voix → pas de plus voté, pas de points
      const nv = V.filter(v => v >= 0).length, top = Math.max(0, ...cnt);
      const win = top > 1 || (top === 1 && nv === 1) ? P.map((_, i) => i).filter(i => cnt[i] === top) : [];
      const g = zeros(), F = H.F.map(f => f.split(""));
      P.forEach((p, i) => {
        if (V[i] < 0) { if (al.has(p.key)) H.Z[i]++; return; }
        const bet = B[i] >= 0 && win.includes(B[i]), sync = win.includes(V[i]);
        g[i] = (bet ? 2 : 0) + (sync ? 1 : 0);
        if (bet) H.C[i]++;
        if (sync) H.A[i]++;
        if (V[i] === i) H.M[i]++;
        F[i][V[i]] = Math.min(35, parseInt(F[i][V[i]], 36) + 1).toString(36);
      });
      cnt.forEach((c, i) => { H.W[i] += c; });
      win.forEach(i => { H.E[i]++; if (tw) H.L[i]++; });
      H.F = F.map(a => a.join(""));
      H.S = H.S.map((x, i) => x + g[i]);
      // ordre des bulletins : au hasard, mais le dernier va à un gagnant (suspense jusqu'au bout)
      const order = shuffle(P.map((_, i) => i).filter(i => V[i] >= 0));
      if (win.length && order.length > 1) { const j = order.findIndex(i => win.includes(V[i])); const last = order.splice(j, 1)[0]; order.push(last); }
      Object.assign(H, {ph: "rev", V: V.map(v => v < 0 ? "." : String(v)).join(""), B: B.map(v => v < 0 ? "." : String(v)).join(""),
        bo: order.join(""), w: win.join(""), g, tl: revDur(order.length), tt: revDur(order.length)});
      H.n++;
    }
    function rankSeats() {
      const al = aliveSet(), on = i => (al.has(P[i].key) ? 1 : 0);
      return P.map((_, i) => i).sort((a, b) => (on(b) - on(a)) || (H.S[b] - H.S[a]) || (H.C[b] - H.C[a]) || (H.A[b] - H.A[a]) || a - b);
    }
    function goEnd() { H.ph = "end"; H.tl = H.tt = T.end; H.o = rankSeats(); H.fin = 0; }
    function doFinish() {
      if (finished) return; finished = true;
      const al = aliveSet(), o = H.o || rankSeats(), live = o.filter(i => al.has(P[i].key));
      const top = live.length ? Math.max(...live.map(i => H.S[i])) : 0;
      const winners = top > 0 ? live.filter(i => H.S[i] === top).map(i => P[i].key) : [];
      const names = winners.map(kk => api.name(kk));
      api.finish({
        winners, ranking: o.map(i => P[i].key),
        summary: (winners.length === 1 ? `${names[0]} remporte « Le plus probable » avec ${top} points : le juré le plus lucide du tribunal !`
          : winners.length ? `Égalité au sommet (${top} points) : ${andList(names)} !`
          : "Personne n'a marqué : le tribunal reste perplexe !").slice(0, 160)
      });
    }
    function step(d) {
      H.tl -= d;
      switch (H.ph) {
        case "boot": startRound(1); break;
        case "intro": progress(); if (H.tl <= 0) startVote(); break;
        case "vote": readInputs(); progress(); if (H.tl <= 0) startRev(); break;
        case "rev": if (H.tl <= 0) startRound(H.r + 1); break;
        case "end": if (H.tl <= 0 && !H.fin) { H.fin = 1; H.tl = 0; pub(); doFinish(); } break;
      }
    }
    function hostInputs(map) {
      inputs = map || {};
      if (!H) return;
      if (H.ph === "vote") { readInputs(); progress(); pub(); }
    }
    if (api.isHost) {
      const R = api.resume;
      if (R && typeof R === "object" && R.ph && Array.isArray(R.Q) && Array.isArray(R.S) && R.S.length === NP && Array.isArray(R.F)) {
        H = JSON.parse(JSON.stringify(R));
        H.tl = (+R.t || 0) + .3; H.tt = +R.tt || H.tl;
        H.cv = P.map((_, i) => decC(R.c && R.c[i * 2], R.r, i, 0, NP));
        H.cb = P.map((_, i) => decC(R.c && R.c[i * 2 + 1], R.r, i, 1, NP));
        H.all = R.all ? 1 : 0;
        if (Array.isArray(R.o)) H.o = R.o;
        delete H.t; delete H.c; delete H.k;
        progress();
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
    let S = null, view = "", myRound = -1, myV = -1, myB = -1, tab = "v", mySeq = 0, lastBeep = -1, tabT = null;
    function push() {
      if (!S || mySeat < 0 || S.ph !== "vote" || (myV < 0 && myB < 0)) return;
      api.setInput({seq: ++mySeq, r: S.r, v: myV, b: myB});
    }
    const beat = setInterval(() => { if (!dead && S && S.ph === "vote") push(); }, 1500);

    function setTop(s) {
      const rd = $("pp-rd"), n = NRof(s);
      const lab = {intro: isTw(s) ? "Retournement !" : "Nouvelle affaire", vote: "Délibération", rev: "Dépouillement", end: "Verdict final"}[s.ph] || "";
      rd.innerHTML = s.ph === "end" ? `<b>Clôture</b>${lab}` : s.r ? `<b>Affaire ${s.r}/${n}</b>${esc(lab)}` : "";
      const c = $("pp-clock"), timed = s.ph === "vote";
      c.hidden = !timed;
      if (timed) {
        c.textContent = s.t; c.style.setProperty("--p", Math.max(0, Math.min(1, s.t / (s.tt || T.vote))).toFixed(3));
        const hot = s.t <= 5 && !s.all;
        c.classList.toggle("pp-hot", hot);
        if (hot && s.t > 0 && lastBeep !== s.t) { lastBeep = s.t; sfx("count"); }
      }
    }

    /* ---- intro de l'affaire ---- */
    function buildIntro(s) {
      const tw = isTw(s);
      page.innerHTML = `<section class="pp-intro">
        <div class="pp-bench" aria-hidden="true"><span class="pp-block"></span><span class="pp-gav">🔨</span><span class="pp-boom">BAM !</span></div>
        <p class="pp-aff">Affaire n°${s.r}<small> / ${NRof(s)}</small></p>
        ${tw ? `<div class="pp-twist"><b>🔄 Retournement !</b><span>Cette fois, on cherche le <em>MOINS</em> probable.</span></div>` : ""}
        ${caseHTML(s, true)}
        ${s.r === 1 ? `<ul class="pp-how">
          <li style="--i:0"><i>🗳️</i><span><b>Vote en secret</b> pour la personne la plus susceptible de le faire (toi compris&nbsp;!)</span></li>
          <li style="--i:1"><i>🎯</i><span><b>Parie</b> sur qui aura le plus de voix&nbsp;: <b>+2</b></span></li>
          <li style="--i:2"><i>🤝</i><span>Ton vote va au plus voté&nbsp;: <b>+1</b> (en phase avec le groupe)</span></li></ul>` : ""}
        <p class="pp-ready">Délibération dans<b id="pp-cd">${s.t}</b></p></section>`;
      sfx("whoosh");
      later(() => haptic("heavy"), 700 * k());
    }
    function updIntro(s) { const c = $("pp-cd"); if (c) c.textContent = Math.max(1, s.t); }

    /* ---- délibération (vote + pari) ---- */
    function buildVote(s) {
      const me = mySeat >= 0, big = NP <= 4;
      page.innerHTML = caseHTML(s, false) + (me ? `<div class="pp-tabs" role="tablist">
          <button type="button" role="tab" class="pp-tab pp-tv" data-t="v"><b>🗳️ Mon vote</b><small>en secret</small><i class="pp-ck">✓</i></button>
          <button type="button" role="tab" class="pp-tab pp-tb" data-t="b"><b>🎯 Mon pari</b><small>sur le + voté</small><i class="pp-ck">✓</i></button></div>
        <p class="pp-hint" id="pp-hint"></p>
        <div class="pp-grid${big ? " pp-big" : " pp-4"}" id="pp-grid" style="--cols:${big ? 2 : 3}">${P.map((p, i) => `<button type="button" class="pp-pick" data-s="${i}" aria-pressed="false">
          ${bust(i)}<b>${nm(i)}</b>${i === mySeat ? `<i class="pp-you">toi</i>` : ""}<i class="pp-bdg"></i><i class="pp-mk"></i></button>`).join("")}</div>`
        : `<p class="pp-wait">⚖️ Les jurés délibèrent…</p>`) + `<div class="pp-prog" id="pp-prog"></div>`;
      page.querySelectorAll(".pp-tab").forEach(b => b.addEventListener("click", () => { cancel(tabT); tab = b.dataset.t; sfx("tap"); updVote(S); }));
      page.querySelectorAll(".pp-pick").forEach(b => b.addEventListener("click", () => {
        if (!S || S.ph !== "vote" || mySeat < 0) return;
        const v = +b.dataset.s;
        if (tab === "v") { myV = v; if (myB < 0) { cancel(tabT); tabT = later(() => { tab = "b"; updVote(S); }, 420); } }
        else { myB = v; if (myV < 0) { cancel(tabT); tabT = later(() => { tab = "v"; updVote(S); }, 420); } }
        push(); sfx("tap"); haptic("light"); updVote(S);
      }));
      sfx("go");
    }
    function updVote(s) {
      const grid = $("pp-grid");
      if (grid) {
        grid.dataset.t = tab;
        const cur = tab === "v" ? myV : myB, other = tab === "v" ? myB : myV;
        grid.querySelectorAll(".pp-pick").forEach(b => {
          const i = +b.dataset.s, on = i === cur;
          b.classList.toggle("pp-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
          b.querySelector(".pp-bdg").textContent = tab === "v" ? "🗳️" : "🎯";
          b.classList.toggle("pp-mark", i === other && !on); b.querySelector(".pp-mk").textContent = tab === "v" ? "🎯" : "🗳️";
        });
        page.querySelectorAll(".pp-tab").forEach(t => {
          const a = t.dataset.t === tab; t.classList.toggle("pp-act", a); t.setAttribute("aria-selected", a ? "true" : "false");
          t.classList.toggle("pp-has", (t.dataset.t === "v" ? myV : myB) >= 0);
        });
        const h = $("pp-hint"), tw = isTw(s);
        if (h) h.innerHTML = s.all ? "✅ Tout le monde a voté&nbsp;! Dépouillement…"
          : tab === "v" ? (myV >= 0 && myB >= 0 ? `C'est dans l'urne&nbsp;! Tu peux encore changer d'avis.` : `Qui est le <b>${tw ? "moins" : "plus"}</b> susceptible&nbsp;? Touche un juré.`)
          : `Qui aura <b>le plus de voix</b>&nbsp;? Bon pari = <b>+2</b>`;
      }
      const pr = $("pp-prog"); if (!pr) return;
      const kk = s.k || "";
      const ready = P.filter((_, i) => kk[i] === "3").length, live = P.filter((_, i) => kk[i] !== "-").length;
      pr.innerHTML = `<p>Jurés prêts <b>${ready}/${live}</b></p>` + P.map((_, i) => {
        const f = kk[i] || "0";
        return `<span class="pp-chip${f === "3" ? " pp-ok" : ""}${f === "-" ? " pp-x" : ""}" title="${nm(i)}">${bust(i)}<i>${f === "3" ? "✅" : f === "-" ? "👋" : f === "0" ? "" : "✏️"}</i></span>`;
      }).join("");
    }

    /* ---- dépouillement ---- */
    function revData(s) {
      const V = P.map((_, i) => { const c = (s.V || "")[i]; return c && c !== "." ? +c : -1; });
      const B = P.map((_, i) => { const c = (s.B || "")[i]; return c && c !== "." ? +c : -1; });
      const order = String(s.bo || "").split("").map(Number).filter(i => V[i] >= 0);
      const cnt = P.map(() => 0); V.forEach(v => { if (v >= 0) cnt[v]++; });
      const w = String(s.w || "").split("").map(Number).filter(i => i >= 0 && i < NP);
      return {V, B, order, cnt, w, n: order.length, g: s.g || P.map(() => 0)};
    }
    function verdictHTML(s, d) {
      const tw = isTw(s);
      if (!d.n) return `<div class="pp-none"><span>📂</span><b>Affaire classée sans suite</b><small>Personne n'a voté…</small></div>`;
      if (!d.w.length) return `<div class="pp-none"><span>⚖️</span><b>Jury divisé !</b><small>Une voix chacun : pas de plus voté, pas de points.</small></div>`;
      const rib = `<span class="pp-rib pp-ribt${tw ? " pp-ribm" : ""}">${tw ? "😇 Le moins probable" : "👑 Le plus probable"}</span>`;
      const quips = tw ? QUIP_M : QUIP_P, quip = quips[(s.r * 7 + (d.w[0] || 0) * 3) % quips.length];
      const deco = `<span class="pp-hit" aria-hidden="true">🔨</span><span class="pp-stamp">ADJUGÉ !</span>`;
      if (d.w.length === 1) {
        const i = d.w[0], c = d.cnt[i], una = c === d.n && d.n >= 2;
        return `${rib}<div class="pp-wfig"><span class="pp-crown">${tw ? "😇" : "👑"}</span>${full(i, tw ? {pose: "wave"} : {pose: "flex", mood: "win"})}</div>
          <div class="pp-wtx"><b class="pp-wn">${nm(i)}</b>
            <span class="pp-wd"><b>${pl(c, "voix", "voix")}</b> sur ${d.n}${d.V[i] === i ? " (dont la sienne 😏)" : ""}</span>
            ${una ? `<span class="pp-una">À l'unanimité !</span>` : `<span class="pp-quip">${quip}</span>`}</div>${deco}`;
      }
      const shown = d.w.slice(0, 4);
      return `<span class="pp-rib${tw ? " pp-ribm" : ""}">Ex æquo · ${pl(d.cnt[d.w[0]], "voix", "voix")} chacun</span>
        <div class="pp-ties">${shown.map(i => `<span class="pp-tie"><span class="pp-crown">${tw ? "😇" : "👑"}</span>${bust(i, "", tw ? {} : {mood: "win"})}</span>`).join("")}</div>
        <b class="pp-wn">${andList(d.w.map(nm))}</b>${deco}`;
    }
    function meHTML(s, d) {
      if (mySeat < 0) return "";
      const v = d.V[mySeat], b = d.B[mySeat], g = d.g[mySeat] || 0;
      if (v < 0) return `<b>0</b> 🤷 Pas de vote, pas de points&nbsp;!`;
      if (!d.w.length) return `<b>0</b> ⚖️ Jury divisé&nbsp;: aucun point cette fois.`;
      const parts = [];
      if (d.w.includes(mySeat)) parts.push(isTw(s) ? "😇 C'est toi le moins probable&nbsp;!" : "👑 C'est toi le plus probable&nbsp;!");
      if (b >= 0 && d.w.includes(b)) parts.push("🎯 Pari gagnant +2"); else parts.push(b >= 0 ? `🎯 Pari raté (${b === mySeat ? "toi" : nm(b)})` : "🎯 Pas de pari");
      parts.push(d.w.includes(v) ? "🤝 En phase avec le groupe +1" : `🗳️ Tu as voté ${v === mySeat ? "pour toi 😏" : nm(v)}`);
      return `<b>+${g}</b> ${parts.join(" · ")}`;
    }
    function afterHTML(s, d) {
      const al = aliveSet();
      const good = P.map((_, i) => i).filter(i => d.B[i] >= 0 && d.w.includes(d.B[i]));
      const selfs = P.map((_, i) => i).filter(i => d.V[i] === i);
      const ord = P.map((_, i) => i).sort((a, b) => (s.S[b] - s.S[a]) || a - b);
      const lines = [];
      if (d.n && d.w.length) lines.push(good.length ? `🎯 Bons paris&nbsp;: <b>${andList(good.map(nm))}</b>` : "🎯 Personne n'a vu juste au pari&nbsp;!");
      if (selfs.length) lines.push(`😏 A voté pour ${selfs.length > 1 ? "soi" : "lui-même"}&nbsp;: <b>${andList(selfs.map(nm))}</b>`);
      return lines.map(l => `<p class="pp-line">${l}</p>`).join("") + `<h3 class="pp-h3">Au classement</h3><div class="pp-strip">${ord.map(i => {
        const rank = ord.findIndex(o => s.S[o] === s.S[i]) + 1;
        return `<span class="pp-sc${i === mySeat ? " pp-mine" : ""}${al.has(P[i].key) ? "" : " pp-gone"}">${bust(i)}<span>${rank}. ${nm(i)}</span><em>${s.S[i]}</em></span>`;
      }).join("")}</div><p class="pp-next" id="pp-next"></p>`;
    }
    let revS = null, revShown = 0, revDone = false;
    function buildRev(s) {
      const d = revData(s), tw = isTw(s), q = qOf(s);
      revS = {s, d}; revShown = 0; revDone = false;
      page.innerHTML = `<div class="pp-mini${tw ? " pp-tw" : ""}"><small>${kickHTML(tw)}</small><b>…${esc(q.t)}&nbsp;?</b></div>
        <div class="pp-stage${NP >= 7 ? " pp-sm" : ""}" id="pp-stage">
          <p class="pp-cap">Dépouillement<i>.</i><i>.</i><i>.</i></p>
          <div class="pp-urnw" aria-hidden="true"><div class="pp-ballot" id="pp-ballot"></div><div class="pp-urn" id="pp-urn"><b id="pp-bc">0</b><small>/ ${pl(d.n, "bulletin")}</small></div></div>
          <div class="pp-verdict${d.w.length !== 1 ? " pp-col" : ""}" id="pp-verdict">${verdictHTML(s, d)}</div></div>
        <ul class="pp-rows${NP >= 7 ? " pp-cmp" : ""}" id="pp-rows">${P.map((_, i) => `<li class="pp-row${i === mySeat ? " pp-mine" : ""}" data-s="${i}">${bust(i, "", d.w.includes(i) && !tw ? {mood: "win"} : {})}
          <b class="pp-rn">${nm(i)}</b><span class="pp-bar"><span class="pp-fill"></span><span class="pp-faces"></span><em class="pp-n pp-z">0</em></span>
          <span class="pp-pts${d.g[i] ? "" : " pp-z"}">${d.V[i] >= 0 ? "+" + (d.g[i] || 0) : "–"}</span></li>`).join("")}</ul>
        ${mySeat >= 0 ? `<p class="pp-me" id="pp-me">${meHTML(s, d)}</p>` : ""}
        <div class="pp-after" id="pp-after">${afterHTML(s, d)}</div>`;
      const el0 = Math.max(0, (+s.tt || 0) - (+s.t || 0));
      const tDone = T.lead + d.n * T.ballot + .2;
      if (RM || el0 > tDone - .3) { for (let j = 0; j < d.n; j++) dropBallot(j, false); finishRev(false); return; }
      d.order.forEach((_, j) => {
        const at = T.lead + j * T.ballot;
        if (at <= el0) dropBallot(j, false); else later(() => dropBallot(j, true), (at - el0) * 1000 * k());
      });
      later(() => finishRev(true), (tDone - el0) * 1000 * k());
    }
    function dropBallot(j, anim) {
      if (!revS || j < revShown) return;
      const d = revS.d, voter = d.order[j], target = d.V[voter];
      if (voter == null || target < 0) return;
      revShown = j + 1;
      const row = page.querySelector(`.pp-row[data-s="${target}"]`);
      if (row) {
        const faces = row.querySelector(".pp-faces");
        faces.insertAdjacentHTML("beforeend", `<span class="pp-face" title="${nm(voter)}">${avSVG(voter, {view: "bust"})}</span>`);
        const c = faces.children.length, n = row.querySelector(".pp-n");
        n.textContent = c; n.classList.remove("pp-z");
        row.querySelector(".pp-fill").style.width = (c * 17 + 22) + "px";
      }
      const bc = $("pp-bc"); if (bc) bc.textContent = revShown;
      if (anim) {
        const b = $("pp-ballot"), urn = $("pp-urn");
        if (b) { b.innerHTML = bust(voter); b.classList.remove("pp-go"); void b.offsetWidth; b.style.setProperty("--bd", (T.ballot * .92 * k()).toFixed(2) + "s"); b.classList.add("pp-go"); }
        if (urn) { urn.classList.remove("pp-bump"); void urn.offsetWidth; urn.classList.add("pp-bump"); }
        sfx("tap");
      }
    }
    function finishRev(anim) {
      if (!revS || revDone) return;
      revDone = true;
      const {s, d} = revS;
      for (let j = revShown; j < d.n; j++) dropBallot(j, false);
      const st = $("pp-stage"); if (st) st.classList.add("pp-done");
      d.w.forEach(i => { const r = page.querySelector(`.pp-row[data-s="${i}"]`); if (r) r.classList.add("pp-win"); });
      const rows = $("pp-rows"); if (rows) rows.classList.add("pp-fin");
      const me = $("pp-me"); if (me) { me.classList.add("pp-show"); me.classList.toggle("pp-zero", !(d.g[mySeat] > 0)); }
      const af = $("pp-after"); if (af) af.classList.add("pp-show");
      updRev(s);
      if (!anim) return;
      if (d.w.length) { sfx("win"); later(() => haptic("heavy"), 350 * k()); } else sfx("whoosh");
      if (mySeat >= 0 && d.g[mySeat] > 0) later(() => haptic("success"), 900 * k());
    }
    function updRev(s) {
      const n = $("pp-next"); if (!n) return;
      const last = s.r >= NRof(s);
      n.innerHTML = last ? `Verdict final dans <b>${s.t}</b> s` : `Affaire suivante dans <b>${s.t}</b> s`;
    }

    /* ---- verdict final ---- */
    function awards(s) {
      const out = [], got = new Set(), seats = P.map((_, i) => i), nr = NRof(s);
      const cast = seats.map(i => String(s.F[i] || "").split("").reduce((a, c) => a + (parseInt(c, 36) || 0), 0));
      const best = (arr, min, ok) => {
        const c = seats.filter(i => (!ok || ok(i)) && arr[i] >= min);
        if (!c.length) return [];
        const m = Math.max(...c.map(i => arr[i]));
        return c.filter(i => arr[i] === m);
      };
      const give = (cands, e, t, dsc) => { const i = cands.find(x => !got.has(x)); if (i == null) return; got.add(i); out.push({e, t: typeof t === "function" ? t(i) : t, i, d: dsc(i)}); };
      give(best(s.E, 1), "👑", "Élu le plus souvent", i => `${s.E[i]} fois sur ${nr} affaires`);
      give(best(s.A, 1), "🤝", "Le plus en phase avec le groupe", i => `${pl(s.A[i], "vote")} avec la majorité`);
      give(best(s.C, 1), "🔮", "Boule de cristal", i => `${pl(s.C[i], "pari gagnant", "paris gagnants")}`);
      give(best(s.M, 2), "😏", "Vote toujours pour lui-même", i => `${s.M[i]} fois sur ${cast[i]} votes`);
      give(best(s.L, 1), "😇", "Le moins probable", i => `élu ${s.L[i]} fois au retournement`);
      // fan n°1 : le plus de votes d'un joueur pour un même autre joueur
      let fan = null;
      seats.forEach(i => { if (got.has(i)) return; const f = String(s.F[i] || ""); seats.forEach(j => { if (j === i) return; const c = parseInt(f[j], 36) || 0; if (c >= 3 && (!fan || c > fan.c)) fan = {i, j, c}; }); });
      if (fan) give([fan.i], "💘", () => `Fan n°1 de ${P[fan.j].pseudo}`, () => `${fan.c} votes pour ${P[fan.j].pseudo}`);
      const ratio = i => cast[i] ? s.A[i] / cast[i] : 1;
      const rebels = seats.filter(i => cast[i] >= 3 && ratio(i) <= .34);
      if (rebels.length) { const m = Math.min(...rebels.map(ratio)); give(rebels.filter(i => ratio(i) === m), "🦄", "L'électron libre", i => `${pl(cast[i] - s.A[i], "vote")} à contre-courant`); }
      give(best(s.W, 1), "🗳️", "Le plus de voix", i => `${pl(s.W[i], "voix", "voix")} au total`);
      give(seats.filter(i => s.W[i] === 0), "🕵️", "L'insaisissable", () => "aucune voix de toute la partie");
      give(best(s.Z, 2), "😴", "Juré fantôme", i => `${pl(s.Z[i], "vote oublié", "votes oubliés")}`);
      // les autres repartent aussi avec une distinction (la meilleure stat parmi les joueurs restants)
      const rest = () => seats.filter(i => !got.has(i));
      const fb = [["🌟", "Star du tribunal", s.W, i => `${pl(s.W[i], "voix", "voix")} reçues`], ["🎰", "Flair de parieur", s.C, i => pl(s.C[i], "bon pari", "bons paris")],
        ["🧠", "Esprit d'équipe", s.A, i => `${pl(s.A[i], "vote")} avec le groupe`], ["🔍", "Juré exemplaire", s.S, i => pl(s.S[i], "point")]];
      for (let n = 0; rest().length && n < 12; n++) { const [e, t, arr, dsc] = fb[n % fb.length]; const r = rest(); const m = Math.max(...r.map(i => arr[i])); give(r.filter(i => arr[i] === m), e, t, dsc); }
      return out;
    }
    function buildEnd(s) {
      const al = aliveSet(), o = Array.isArray(s.o) ? s.o : P.map((_, i) => i).sort((a, b) => s.S[b] - s.S[a]);
      const top = s.S[o[0]], pod = o.slice(0, 3), slots = [1, 0, 2].filter(i => pod[i] != null);
      const aw = awards(s);
      page.innerHTML = `<section class="pp-endv"><h2 class="pp-endh">Verdict final</h2><p class="pp-ends">Le tribunal a rendu son jugement</p>
        <div class="pp-pod">${slots.map((i, n) => { const si = pod[i], win = s.S[si] === top && top > 0;
          return `<figure class="pp-p${i + 1}" style="--d:${(n * .18).toFixed(2)}s">${win ? `<span class="pp-crown">👑</span>` : ""}${full(si, win ? {pose: "flex", mood: "win"} : {pose: "idle"})}
            <figcaption>${nm(si)}</figcaption><div class="pp-step">${s.S[si]}<small>pts</small></div></figure>`; }).join("")}</div>
        <h3 class="pp-h3">Les distinctions du tribunal</h3>
        <div class="pp-aws">${aw.map((a, n) => `<div class="pp-aw${a.i === mySeat ? " pp-mine" : ""}" style="--d:${(.5 + n * .12).toFixed(2)}s">${bust(a.i, "", a.e === "👑" ? {mood: "win"} : {})}<div><small>${a.e} ${esc(a.t)}</small><b>${nm(a.i)}</b><span>${esc(a.d)}</span></div></div>`).join("")}</div>
        <h3 class="pp-h3">Classement</h3>
        <ul class="pp-rk">${o.map((i, j) => { const rank = o.findIndex(x => s.S[x] === s.S[i]) + 1;
          return `<li class="${i === mySeat ? "pp-mine " : ""}${rank === 1 && top > 0 ? "pp-1 " : ""}${al.has(P[i].key) ? "" : "pp-gone"}" style="--i:${j}"><span class="pp-rkn">${rank}</span>${bust(i, "", rank === 1 && top > 0 ? {mood: "win"} : {})}
            <b class="pp-rkm">${nm(i)}${i === mySeat ? " (toi)" : ""}<small>🎯 ${pl(s.C[i], "pari", "paris")} · 🤝 ${s.A[i]} · 👑 élu ${s.E[i]}×</small></b><span class="pp-rkt">${s.S[i]}</span></li>`; }).join("")}</ul></section>`;
      sfx("win");
      if (mySeat >= 0 && s.S[mySeat] === top && top > 0) haptic("success");
    }

    function render(s) {
      if (dead || !s || !s.ph || s.ph === "boot") return;
      S = s;
      if (s.r !== myRound) {
        myRound = s.r; myV = -1; myB = -1; tab = "v"; lastBeep = -1; cancel(tabT);
        // retour en pleine délibération (rechargement) : on reprend les choix que l'hôte a déjà reçus
        if (mySeat >= 0 && typeof s.c === "string") {
          myV = decC(s.c[mySeat * 2], s.r, mySeat, 0, NP); myB = decC(s.c[mySeat * 2 + 1], s.r, mySeat, 1, NP);
          if (myV >= 0 && myB < 0) tab = "b";
        }
      }
      root.dataset.ph = s.ph; root.dataset.r = s.r;
      setTop(s);
      const vk = s.ph + ":" + s.r;
      if (vk !== view) {
        view = vk; el.scrollTop = 0;
        if (s.ph !== "rev") revS = null;
        ({intro: buildIntro, vote: buildVote, rev: buildRev, end: buildEnd})[s.ph](s);
        if (s.ph === "vote") push();
      }
      if (s.ph === "intro") updIntro(s);
      else if (s.ph === "vote") updVote(s);
      else if (s.ph === "rev") updRev(s);
    }
    api.onState(render);

    return {
      destroy() {
        dead = true;
        timers.forEach(t => clearTimeout(t)); timers.clear();
        clearInterval(beat); if (hostIv) clearInterval(hostIv);
        svgCache.clear();
        el.innerHTML = "";
      }
    };
  }
});
})();
