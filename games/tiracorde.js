/* Gonflette Party : Tir à la corde (2 équipes, chacun sur son téléphone, spectateurs possibles).
   Au meilleur des 3 tirs. Un tempo « HO… HISSE ! » bat sur chaque téléphone (2 temps/s, un peu plus vite à chaque tir).
   La synchro compte plus que la vitesse : chaque téléphone juge lui-même ses coups par rapport au temps qu'il affiche
   (calendrier des temps = origine + tempo publiés par l'hôte, recalés sur l'horloge locale) et envoie, ~10 fois/s,
   la liste des derniers temps joués {n, h:[[temps, qualité], ...]}. L'hôte additionne par temps et par équipe
   (moyenne par membre présent × bonus de synchro quand plusieurs coéquipiers tapent pile le même temps), et la corde avance. */
GONFLETTE.registerGame({
  id: "tiracorde",
  name: "Tir à la corde",
  min: 2,
  max: 8,
  teams: true,
  create(api) {
    "use strict";
    const el = api.el;
    const P = api.players;
    const AVM = (window.GONFLETTE && window.GONFLETTE.avatar) || null;
    const muscleOf = xp => (AVM && AVM.muscle ? AVM.muscle(xp) : Math.min(1.35, Math.max(0, +xp || 0) / 1500));
    const esc = t => String(t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
    const fmt = (x, d = 2) => (+x || 0).toFixed(d).replace(".", ",");
    const f1 = n => Math.round(n * 10) / 10;
    const now = () => performance.now();

    // ---------- réglages ----------
    const BPM0 = 120, BPM_STEP = 10;     // tempo du 1er tir, accélération à chaque tir
    const PULL_MS = 30000;               // durée max d'un tir (temps comptés)
    const LEAD = 4;                      // 4 temps d'appel « 3, 2, 1, TIREZ ! » avant les temps comptés
    const GRACE = 1100;                  // l'hôte attend ce délai après la fin de la fenêtre d'un temps (+½ temps) pour recevoir les coups
                                         // (relais p2p = 2 sauts par sens, téléphones lents : plusieurs centaines de ms)
    const K = 3.5;                       // avance de la corde par temps, par point de force d'écart (ligne = 100)
    const LINE = 55;                     // distance (unités de scène) entre le centre et une ligne de victoire
    const MAX_PULLS = 5;                 // garde-fou en cas d'égalités répétées
    const PILE = 0.2, BIEN = 0.36;       // tolérances (en fraction de temps) pour PILE et BIEN
    const VAL = [0, 0.15, 0.55, 1];      // valeur d'un temps : rien, à côté / brouillon, bien, pile
    const SYNC_MAX = 0.6;                // bonus de synchro quand toute l'équipe tape pile ensemble (+60 %)
    const PUB_MS = 100, SEND_MS = 60, ROUND_PAUSE = 3400, FINISH_MS = 2800;
    // Forfait : une équipe entière doit avoir disparu de la salle de jeu (api.connected) pendant longtemps.
    // Un téléphone verrouillé une seconde, un relais p2p qui change ou un réseau lent ne doivent PAS faire perdre.
    // Le lobby gère de son côté les joueurs vraiment partis.
    const FORFEIT_MS = 15000, NEVER_MS = 30000;
    const INTRO_MIN = 2600, INTRO_MAX = 12000; // l'hôte attend que tous les téléphones aient rejoint (au plus 12 s)
    const CLOCK_WIN = 4000;              // fenêtre (ms) des échantillons pour recaler l'horloge de l'hôte (délai minimal)
    const IDLE_MAX = 2;                  // tirs de suite sans aucun coup : match nul

    // ---------- équipes ----------
    const DEF_COL = ["#e63946", "#3a86ff"];
    const srcTeams = api.teams && api.teams.length === 2 ? api.teams
      : [0, 1].map(i => ({name: i ? "Équipe bleue" : "Équipe rouge", color: DEF_COL[i], keys: P.filter((p, j) => j % 2 === i).map(p => p.key)}));
    const TEAMS = srcTeams.map((t, i) => ({
      name: String((t && t.name) || (i ? "Équipe bleue" : "Équipe rouge")).slice(0, 24),
      color: t && /^#[0-9a-f]{3,8}$/i.test(t.color || "") ? t.color : DEF_COL[i],
      keys: ((t && t.keys) || []).filter(k => P.some(p => p.key === k))
    }));
    const teamOf = k => (TEAMS[0].keys.includes(k) ? 0 : TEAMS[1].keys.includes(k) ? 1 : null);
    const myTeam = api.isPlayer ? teamOf(api.me) : null;
    const canTap = myTeam !== null;
    const LT = myTeam === 1 ? 1 : 0, RT = 1 - LT;          // équipe affichée à gauche / à droite (la mienne à gauche)
    const SIDE = [LT === 0 ? 0 : 1, LT === 1 ? 0 : 1];     // équipe -> côté (0 = gauche)
    const pIdx = {};
    P.forEach((p, i) => { pIdx[p.key] = i; });
    const MULT = {};
    P.forEach(p => { MULT[p.key] = 1 + 0.1 * Math.min(1, muscleOf(p.xp)); });
    const teamMult = t => { const ks = TEAMS[t].keys; return ks.length ? ks.reduce((a, k) => a + MULT[k], 0) / ks.length : 1; };
    const pseudo = k => { const p = P[pIdx[k]]; return (p && p.pseudo) || api.name(k); };
    const verb = name => (/^(les|des|nos|vos|ces|mes|tes|ses)\s/i.test(name) || /s$/i.test(name.trim()) ? "gagnent" : "gagne");

    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
    const intervals = [];

    let RM = false, mq = null;
    const onMq = () => { RM = !!(mq && mq.matches); };
    try {
      mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches;
      if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    } catch (e) { mq = null; }

    // ---------- scène (unités : 400 × 250) ----------
    const FEET = 222;
    const NMAX = Math.max(TEAMS[0].keys.length, TEAMS[1].keys.length, 1);
    const HGT = NMAX >= 4 ? 80 : NMAX === 3 ? 90 : 102;       // hauteur d'un avatar (unités de scène)
    const SC0 = HGT / 245;                                    // unités de scène par unité d'avatar
    const ROPE_Y = Math.round(FEET - 64 * SC0);               // à hauteur des mains (mains au repos ~ y 188, pieds ~ y 251)
    // cadrage serré de l'avatar entier (mêmes proportions que core/avatar.js)
    function frameOf(xp) {
      const m = muscleOf(xp), mc = Math.min(m, 1);
      const headR = 25 - 6 * mc - 2 * Math.max(0, m - 1), headY = 50 + 12 * m;
      const hw = Math.max(19 + 50 * m + 7 + 28 * m + 10, 58);
      const top = headY - headR - 16;
      return {m, x: 100 - hw, y: top, w: hw * 2, h: 264 - top};
    }
    function layout(t) {
      const keys = TEAMS[t].keys, n = keys.length, side = SIDE[t], dir = side === 0 ? -1 : 1;
      const sp = n > 1 ? Math.min(48, 118 / (n - 1)) : 0;
      return keys.map((k, i) => {
        const p = P[pIdx[k]] || {};
        const fr = frameOf(p.xp), sc = SC0 * (1 + 0.12 * Math.min(1, fr.m));
        const cx = 200 + dir * (62 + i * sp);
        return {k, t, i, side, dir, fr, sc, w: fr.w * sc, h: fr.h * sc, cx, top: FEET - (251 - fr.y) * sc - (i % 2 ? 5 : 0), y: i % 2 ? 5 : 0};
      });
    }
    const LAY = [layout(0), layout(1)];

    const plHtml = L => {
      const svg = api.avatar(L.k, {pose: "idle"}).replace(/viewBox="[^"]*"/, `viewBox="${f1(L.fr.x)} ${f1(L.fr.y)} ${f1(L.fr.w)} ${f1(L.fr.h)}"`);
      return `<div class="tc-pl tc-s${L.side}" data-k="${esc(L.k)}" style="left:${f1((L.cx - L.w / 2) / 4)}%;top:${f1(L.top / 2.5)}%;width:${f1(L.w / 4)}%;z-index:${20 - L.i}">
        <div class="tc-body" style="aspect-ratio:${f1(L.fr.w)}/${f1(L.fr.h)}">${svg}${L.k === api.me ? `<i class="tc-me" aria-hidden="true">TOI</i>` : ""}</div>
        <span class="tc-nm">${esc(pseudo(L.k).slice(0, 9))}</span>
      </div>`;
    };

    const bgSvg = `<svg class="tc-bg" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="tc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4cc3f5"/><stop offset=".7" stop-color="#a8e3f7"/><stop offset="1" stop-color="#ffe7b8"/></linearGradient>
        <linearGradient id="tc-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1590c0"/><stop offset="1" stop-color="#29b8c9"/></linearGradient>
        <linearGradient id="tc-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8dfa4"/><stop offset="1" stop-color="#e5b064"/></linearGradient>
        <radialGradient id="tc-mud" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#7a4b25"/><stop offset=".7" stop-color="#5a3317"/><stop offset="1" stop-color="#3e220e"/></radialGradient>
        <radialGradient id="tc-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#ffd84a"/><stop offset="1" stop-color="#ffd84a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#tc-sky)"/>
      <circle cx="338" cy="38" r="40" fill="url(#tc-sun)"/>
      <circle cx="338" cy="38" r="15" fill="#fff3a0"/>
      <g fill="#fff" opacity=".9"><path d="M40 40q6-12 18-6q8-8 18 2q10 0 8 8H38q-6-2 2-4z"/><path d="M196 24q5-9 14-5q7-6 14 2q8 0 6 6h-36q-4-1 2-3z" opacity=".8"/></g>
      <path d="M0 106h400v40H0z" fill="url(#tc-sea)"/>
      <g stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round">
        <path class="tc-wave" d="M10 116q8-4 16 0t16 0M120 124q8-4 16 0t16 0M250 114q8-4 16 0t16 0M330 128q8-4 16 0t16 0"/>
      </g>
      <path d="M0 138q100-10 200-2t200-4V250H0z" fill="url(#tc-sand)"/>
      <path d="M0 140q100-10 200-2t200-4" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
      <g stroke="#1d1420" stroke-width="3" stroke-linejoin="round">
        <path d="M30 150q-4-40 6-78" stroke="#7a4b25" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M36 72q-26-6-38 8q18-4 38-8zM36 72q-6-22-28-24q14 10 28 24zM36 72q12-22 34-20q-20 4-34 20zM36 72q26 0 32 16q-16-10-32-16z" fill="#2fa84f"/>
        <path d="M374 152q4-34-4-66" stroke="#7a4b25" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M370 86q-24-4-32 10q16-6 32-10zM370 86q-2-20-22-24q12 10 22 24zM370 86q12-18 30-14q-18 2-30 14zM370 86q20 4 26 18q-14-10-26-18z" fill="#2fa84f"/>
      </g>
      <g transform="translate(150 84) rotate(-3) scale(.82)">
        <path d="M24 30v26" stroke="#5a3317" stroke-width="4"/>
        <rect x="-6" y="0" width="64" height="32" rx="5" fill="#c98b4a" stroke="#1d1420" stroke-width="3"/>
        <text x="26" y="21" text-anchor="middle" font-family="Pacifico,'Brush Script MT',cursive" font-size="11.5" fill="#fff8e6" stroke="#1d1420" stroke-width=".6">Muscle Beach</text>
      </g>
      <g opacity=".5" fill="#c99350"><ellipse cx="80" cy="176" rx="9" ry="2"/><ellipse cx="318" cy="186" rx="11" ry="2"/><ellipse cx="150" cy="238" rx="12" ry="2.5"/><ellipse cx="270" cy="240" rx="9" ry="2"/></g>
      <ellipse cx="200" cy="${FEET - 2}" rx="46" ry="13" fill="#3e220e" opacity=".5"/>
      <ellipse cx="200" cy="${FEET - 3}" rx="42" ry="11" fill="url(#tc-mud)" stroke="#2e180a" stroke-width="2.5"/>
      <g fill="#a8794b" opacity=".75"><ellipse cx="186" cy="${FEET - 6}" rx="7" ry="1.6"/><ellipse cx="214" cy="${FEET - 1}" rx="5" ry="1.3"/></g>
      <g class="tc-bub" fill="none" stroke="#a8794b" stroke-width="1.2"><circle cx="192" cy="${FEET - 1}" r="2"/><circle cx="210" cy="${FEET - 7}" r="1.5"/></g>
      <g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9" stroke-dasharray="6 5">
        <path d="M${200 - LINE} ${FEET - 26}l-3 40"/><path d="M${200 + LINE} ${FEET - 26}l3 40"/>
      </g>
    </svg>`;

    const ropeSvg = `<svg class="tc-rope" viewBox="-200 0 800 250" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-200 ${ROPE_Y}H600" stroke="#1d1420" stroke-width="8.5" stroke-linecap="round"/>
      <path d="M-200 ${ROPE_Y}H600" stroke="#b07a3c" stroke-width="5.5"/>
      <path d="M-200 ${ROPE_Y}H600" stroke="#e2b778" stroke-width="5.5" stroke-dasharray="3 4"/>
      <g class="tc-flagg"><path d="M200 ${ROPE_Y + 2}l-11 26l22 0z" fill="#e8261e" stroke="#1d1420" stroke-width="2.5" stroke-linejoin="round"/><circle cx="200" cy="${ROPE_Y}" r="4.5" fill="#fff" stroke="#1d1420" stroke-width="2"/></g>
    </svg>`;

    const teamPill = (t, side) => `<div class="tc-tm tc-tm${side}" style="--tc-c:${TEAMS[t].color}">
        <b>${esc(TEAMS[t].name)}</b>
        <span class="tc-dots" id="tc-dots${side}"><i></i><i></i></span>
        <small>${side === 0 && canTap ? "TON ÉQUIPE" : TEAMS[t].keys.length + " joueur" + (TEAMS[t].keys.length > 1 ? "s" : "")}</small>
      </div>`;

    const myMates = canTap ? TEAMS[myTeam].keys : [];
    const myCol = canTap ? TEAMS[myTeam].color : "#888";

    el.innerHTML = `<style>
      .tc{--tc-ink:#1d1420;--tc-gold:#ffcc33;--tc-me:${myCol};height:100%;min-height:560px;box-sizing:border-box;display:flex;justify-content:center;background:linear-gradient(180deg,#123a5a,#0b1a2c 65%);color:#fff8ea;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
      .tc *{box-sizing:border-box}
      .tc-col{width:min(100%,520px);height:100%;display:flex;flex-direction:column;gap:7px;padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px))}
      .tc-head{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;flex:none}
      .tc-tm{min-width:0;display:flex;flex-direction:column;gap:2px;padding:4px 8px;border-radius:12px;background:color-mix(in srgb,var(--tc-c) 30%,transparent);border:2px solid var(--tc-c)}
      .tc-tm1{align-items:flex-end;text-align:right}
      .tc-tm b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.08rem;line-height:1.05;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-shadow:2px 2px 0 var(--tc-ink)}
      .tc-tm small{font-weight:800;font-size:.68rem;letter-spacing:.1em;opacity:.8}
      .tc-dots{display:flex;gap:4px}
      .tc-dots i{width:13px;height:13px;border-radius:50%;border:2px solid #ffffff70;background:#00000030;transition:background .3s,transform .3s}
      .tc-dots i.on{background:var(--tc-gold);border-color:#fff;transform:scale(1.15)}
      .tc-mid{display:flex;flex-direction:column;align-items:center;gap:1px}
      .tc-rnd{font-family:Anton,Impact,sans-serif;font-size:.95rem;letter-spacing:.05em;background:#ffffff18;border:2px solid #ffffff30;border-radius:999px;padding:0 9px;white-space:nowrap}
      .tc-time{font-family:Anton,Impact,sans-serif;font-size:1.35rem;line-height:1.05;color:var(--tc-gold);font-variant-numeric:tabular-nums}
      .tc-time.low{color:#ff6b5e}
      .tc-mute{position:relative;border:0;background:none;color:inherit;opacity:.7;font:inherit;font-weight:800;font-size:.75rem;letter-spacing:.08em;cursor:pointer;padding:0 4px}
      .tc-mute::before{content:"";position:absolute;inset:-14px -4px} /* zone tactile ≥ 44 px (kit) */
      .tc-stage{position:relative;width:100%;aspect-ratio:400/250;flex:none;border-radius:16px;overflow:hidden;border:3px solid var(--tc-ink);box-shadow:0 8px 22px rgba(0,0,0,.5);background:#a8e3f7}
      .tc-bg{position:absolute;inset:0;width:100%;height:100%;display:block}
      .tc-rig{position:absolute;inset:0;will-change:transform}
      .tc-rope{position:absolute;top:0;left:-50%;width:200%;height:100%;display:block;z-index:30;pointer-events:none}
      .tc-pl{position:absolute;transition:transform .3s}
      .tc-body{position:relative;width:100%;transform-origin:50% 92%;transform:rotate(var(--tc-lean,0deg));transition:transform .28s cubic-bezier(.3,1.4,.5,1)}
      .tc-body .av{width:100%;height:100%;display:block;overflow:visible}
      .tc-nm{position:absolute;left:50%;top:100%;transform:translate(-50%,-2px);font-weight:800;font-size:clamp(.5rem,2.4vw,.72rem);line-height:1;background:#1d1420cc;border-radius:5px;padding:1px 4px;white-space:nowrap;letter-spacing:.02em}
      .tc-me{position:absolute;left:50%;top:-6%;transform:translateX(-50%);font-style:normal;font-family:Anton,Impact,sans-serif;font-size:clamp(.5rem,2.4vw,.7rem);color:var(--tc-ink);background:var(--tc-gold);border:2px solid var(--tc-ink);border-radius:6px;padding:0 3px;line-height:1.1}
      .tc-pl.tc-fall0 .tc-body{animation:tc-fallL 1s cubic-bezier(.5,0,.7,1) forwards}
      .tc-pl.tc-fall1 .tc-body{animation:tc-fallR 1s cubic-bezier(.5,0,.7,1) forwards}
      @keyframes tc-fallL{0%{transform:rotate(-10deg)}35%{transform:rotate(22deg) translate(4%,-6%)}100%{transform:rotate(78deg) translate(22%,-8%)}}
      @keyframes tc-fallR{0%{transform:rotate(10deg)}35%{transform:rotate(-22deg) translate(-4%,-6%)}100%{transform:rotate(-78deg) translate(-22%,-8%)}}
      .tc-pl.tc-fall0 .tc-nm,.tc-pl.tc-fall1 .tc-nm{opacity:0;transition:opacity .3s}
      .tc-pl.tc-mud .tc-body{filter:sepia(1) saturate(2.2) hue-rotate(-12deg) brightness(.6);transition:filter .6s .5s,transform .28s}
      .tc-pl.tc-cheer .tc-body{animation:tc-hop .5s ease-in-out infinite alternate}
      @keyframes tc-hop{to{transform:rotate(var(--tc-lean,0deg)) translateY(-9%)}}
      .tc-fx{position:absolute;inset:0;pointer-events:none;z-index:40;overflow:hidden}
      .tc-dust{position:absolute;width:9%;aspect-ratio:1;margin:-4.5% 0 0 -4.5%;border-radius:50%;background:radial-gradient(circle,#fff3d6 0,#f1d6a0aa 45%,transparent 70%);animation:tc-dust .75s ease-out forwards}
      @keyframes tc-dust{0%{opacity:.95;transform:translate(0,0) scale(.3)}100%{opacity:0;transform:translate(var(--dx),-10px) scale(1.5)}}
      .tc-drop{position:absolute;width:2.4%;aspect-ratio:1;border-radius:50%;background:#5a3317;border:1px solid #2e180a;animation:tc-drop .9s cubic-bezier(.2,.6,.6,1) forwards}
      @keyframes tc-drop{0%{transform:translate(0,0)}50%{transform:translate(calc(var(--dx)*.6),var(--dy))}100%{transform:translate(var(--dx),18px);opacity:0}}
      .tc-hh{position:absolute;left:0;right:0;top:5%;text-align:center;font-family:Anton,Impact,sans-serif;font-size:clamp(2rem,12vw,3.4rem);line-height:1;color:#fff;-webkit-text-stroke:2px var(--tc-ink);text-shadow:4px 4px 0 #e8261e;pointer-events:none;z-index:45;letter-spacing:.02em}
      .tc-hh.tc-cd{color:var(--tc-gold)}
      .tc-sync{position:absolute;top:30%;font-family:Anton,Impact,sans-serif;font-size:clamp(1.05rem,6vw,1.6rem);color:var(--tc-gold);-webkit-text-stroke:1.2px var(--tc-ink);text-shadow:3px 3px 0 var(--tc-ink);white-space:nowrap;z-index:46;pointer-events:none;animation:tc-pop 1s cubic-bezier(.2,1.4,.4,1) forwards}
      .tc-sync.tc-s0{left:4%}.tc-sync.tc-s1{right:4%}
      @keyframes tc-pop{0%{opacity:0;transform:scale(.3) rotate(-6deg)}20%{opacity:1;transform:scale(1.15) rotate(-4deg)}75%{opacity:1;transform:translateY(-6px) scale(1) rotate(-4deg)}100%{opacity:0;transform:translateY(-14px) scale(.95) rotate(-4deg)}}
      .tc-ban{position:absolute;left:5%;right:5%;top:22%;text-align:center;pointer-events:none;z-index:50;opacity:0;transform:scale(.6);transition:opacity .25s,transform .35s cubic-bezier(.2,1.5,.4,1)}
      .tc-ban.on{opacity:1;transform:none}
      .tc-ban h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.6rem,9.5vw,2.7rem);line-height:1;text-transform:uppercase;color:var(--tc-gold);-webkit-text-stroke:2px var(--tc-ink);text-shadow:4px 4px 0 #e8261e}
      .tc-ban p{display:inline-block;margin:6px 0 0;background:var(--tc-ink);color:#fff;font-weight:800;font-size:clamp(.85rem,4vw,1.05rem);padding:2px 12px;border-radius:999px;max-width:100%}
      .tc-ban.tc-sm h3{font-size:clamp(1.3rem,7.5vw,2.1rem)}
      .tc-meter{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;flex:none}
      .tc-frc{display:flex;flex-direction:column;align-items:center;min-width:62px;line-height:1}
      .tc-frc b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.3rem}
      .tc-frc small{font-size:.64rem;font-weight:800;letter-spacing:.08em;opacity:.75;white-space:nowrap}
      .tc-frc .tc-sx{font-size:.72rem;font-weight:900;color:var(--tc-gold);opacity:1;letter-spacing:.02em}
      .tc-bar{position:relative;height:20px;border-radius:999px;overflow:hidden;border:2px solid #ffffff40;background:linear-gradient(90deg,var(--tc-cl) 0 10%,#ffffff12 10% 90%,var(--tc-cr) 90%)}
      .tc-bar::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff7}
      .tc-mk{position:absolute;top:50%;left:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:3px 3px 50% 50%;background:#e8261e;border:3px solid #fff;box-shadow:0 0 0 2px var(--tc-ink)}
      .tc-act{flex:1 1 auto;min-height:250px;display:flex;flex-direction:column;gap:5px}
      .tc-tap{position:relative;flex:1;width:100%;min-height:220px;border:4px solid var(--tc-ink);border-radius:26px;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--tc-me) 55%,#fff),var(--tc-me) 55%,color-mix(in srgb,var(--tc-me) 55%,#000));color:#fff;font:inherit;cursor:pointer;touch-action:none;box-shadow:0 8px 0 var(--tc-ink),inset 0 -10px 0 rgba(0,0,0,.18),inset 0 8px 0 rgba(255,255,255,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:10px;overflow:hidden;outline-offset:4px;transition:transform .05s,box-shadow .05s,filter .2s}
      .tc-tap.tc-hit{transform:translateY(6px);box-shadow:0 2px 0 var(--tc-ink),inset 0 -6px 0 rgba(0,0,0,.18),inset 0 8px 0 rgba(255,255,255,.25)}
      .tc-tap.tc-off{filter:grayscale(.7) brightness(.75)}
      .tc-target{position:relative;width:min(44vw,180px);aspect-ratio:1;display:grid;place-items:center;flex:none}
      .tc-core{width:62%;aspect-ratio:1;border-radius:50%;border:5px solid #fff;background:#1d142055;display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:clamp(1.3rem,7vw,2rem);text-shadow:2px 2px 0 var(--tc-ink);box-shadow:0 0 0 3px var(--tc-ink)}
      .tc-core.tc-flash{background:var(--tc-gold);color:var(--tc-ink);text-shadow:none}
      .tc-ring{position:absolute;left:50%;top:50%;width:62%;aspect-ratio:1;margin:-31% 0 0 -31%;border-radius:50%;border:4px solid #fff;opacity:.85;pointer-events:none}
      .tc-fb{min-height:1.15em;font-family:Anton,Impact,sans-serif;font-size:clamp(1.4rem,8vw,2.2rem);line-height:1.1;text-shadow:3px 3px 0 var(--tc-ink);letter-spacing:.03em}
      .tc-fb.g{color:#b6ff5c}.tc-fb.o{color:#fff3a0}.tc-fb.b{color:#ffb3ad}
      .tc-sub{font-weight:800;font-size:.95rem;letter-spacing:.04em;opacity:.95;text-shadow:1px 1px 0 var(--tc-ink);text-align:center}
      .tc-mates{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;max-width:100%}
      .tc-mate{font-weight:800;font-size:.8rem;padding:1px 8px;border-radius:999px;background:#1d142080;border:2px solid #ffffff50;transition:background .15s,border-color .15s,color .15s;white-space:nowrap}
      .tc-mate.c3{background:#b6ff5c;color:var(--tc-ink);border-color:#fff}
      .tc-mate.c2{background:#fff3a0;color:var(--tc-ink);border-color:#fff}
      .tc-stats{font-weight:700;font-size:.82rem;opacity:.9;text-shadow:1px 1px 0 var(--tc-ink)}
      .tc-key{text-align:center;font-size:.78rem;font-weight:700;opacity:.6}
      .tc-spec{flex:1;display:grid;place-items:center;text-align:center;border:3px dashed #ffffff30;border-radius:22px;padding:12px;font-weight:700;font-size:1.1rem}
      .tc-spec b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.8rem;color:var(--tc-gold)}
      .tc-wave{animation:tc-waves 3s ease-in-out infinite alternate}
      @keyframes tc-waves{to{transform:translateX(8px)}}
      .tc-bub{animation:tc-bub 1.6s ease-in-out infinite}
      @keyframes tc-bub{50%{opacity:.2}}
      .tc-flagg{transform-box:fill-box;transform-origin:50% 0;animation:tc-flag 1.2s ease-in-out infinite alternate}
      @keyframes tc-flag{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}
      @media (max-height:700px){.tc-col{gap:5px}.tc-act{min-height:200px}.tc-tap{min-height:180px}.tc-target{width:min(28vw,110px)}}
      @media (prefers-reduced-motion:reduce){.tc-wave,.tc-bub,.tc-flagg,.tc-pl.tc-cheer .tc-body{animation:none}.tc-pl.tc-fall0 .tc-body,.tc-pl.tc-fall1 .tc-body{animation:none;opacity:.55}.tc-dust,.tc-drop{display:none}.tc-sync{animation:tc-fade 1s forwards}.tc-ban{transition:opacity .2s;transform:none}.tc-body{transition:none}.tc-ring{display:none}}
      @keyframes tc-fade{0%,75%{opacity:1}100%{opacity:0}}
    </style>
    <div class="tc" id="tc-root"><div class="tc-col">
      <div class="tc-head">
        ${teamPill(LT, 0)}
        <div class="tc-mid"><span class="tc-rnd" id="tc-rnd">TIR 1</span><span class="tc-time" id="tc-time">30</span><button type="button" class="tc-mute" id="tc-mute" aria-pressed="false">SON : OUI</button></div>
        ${teamPill(RT, 1)}
      </div>
      <div class="tc-stage" id="tc-stage">
        ${bgSvg}
        <div class="tc-rig" id="tc-rig">${ropeSvg}${LAY[LT].map(plHtml).join("")}${LAY[RT].map(plHtml).join("")}<div class="tc-fx" id="tc-rfx"></div></div>
        <div class="tc-fx" id="tc-fx"></div>
        <div class="tc-hh" id="tc-hh" aria-hidden="true"></div>
        <div class="tc-ban on" id="tc-ban" role="status" aria-live="polite"><h3>Tir à la corde</h3><p>Tapez ensemble sur le temps !</p></div>
      </div>
      <div class="tc-meter" style="--tc-cl:${TEAMS[LT].color};--tc-cr:${TEAMS[RT].color}">
        <div class="tc-frc"><b id="tc-f0">0</b><small>FORCE</small><small class="tc-sx" id="tc-s0">&nbsp;</small></div>
        <div class="tc-bar" aria-hidden="true"><i class="tc-mk" id="tc-mk"></i></div>
        <div class="tc-frc"><b id="tc-f1">0</b><small>FORCE</small><small class="tc-sx" id="tc-s1">&nbsp;</small></div>
      </div>
      <div class="tc-act">${canTap
        ? `<button type="button" class="tc-tap tc-off" id="tc-tap" aria-label="Tirer sur la corde (tapez sur le temps)">
            <div class="tc-fb" id="tc-fb" aria-live="polite"></div>
            <div class="tc-target"><div class="tc-core" id="tc-core">TIRE</div><div class="tc-ring" id="tc-ring"></div></div>
            <div class="tc-sub" id="tc-sub">Tape pile sur « HO » et « HISSE » !</div>
            <div class="tc-mates" id="tc-mates">${myMates.map(k => `<span class="tc-mate" data-k="${esc(k)}">${esc(k === api.me ? "Toi" : pseudo(k).slice(0, 10))}</span>`).join("")}</div>
            <div class="tc-stats" id="tc-stats">La synchro bat la vitesse · muscles ×${fmt(teamMult(myTeam))}</div>
          </button><div class="tc-key">Sur ordinateur : barre Espace</div>`
        : `<div class="tc-spec"><div><b>SPECTATEUR</b>Encourage les deux équipes : HO… HISSE !</div></div>`}</div>
    </div></div>`;

    const $ = id => el.querySelector("#" + id);
    const root = $("tc-root"), rig = $("tc-rig"), fx = $("tc-fx"), rfx = $("tc-rfx"), hh = $("tc-hh"), ban = $("tc-ban");
    const rndEl = $("tc-rnd"), timeEl = $("tc-time"), mkEl = $("tc-mk"), muteBtn = $("tc-mute");
    const fEl = [$("tc-f0"), $("tc-f1")], sEl = [$("tc-s0"), $("tc-s1")];
    const dotsEl = [[...$("tc-dots0").children], [...$("tc-dots1").children]];
    const tapBtn = $("tc-tap"), fbEl = $("tc-fb"), coreEl = $("tc-core"), ringEl = $("tc-ring"), subEl = $("tc-sub"), statsEl = $("tc-stats");
    const mateEls = canTap ? [...el.querySelectorAll(".tc-mate")] : [];
    const plEls = {};
    el.querySelectorAll(".tc-pl").forEach(n => { plEls[n.dataset.k] = n; });

    // ---------- son (WebAudio, uniquement après un geste) ----------
    let ac = null, muted = false, noiseBuf = null;
    function unlockAudio() {
      if (muted || dead) return;
      try {
        if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
        if (ac && ac.state === "suspended") ac.resume().catch(() => {});
      } catch (e) { ac = null; }
    }
    function tone(f, dur, type, vol, f2) {
      if (!ac || muted || ac.state !== "running") return;
      try {
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* rien */ }
    }
    function noise(dur, vol, freq, q) {
      if (!ac || muted || ac.state !== "running") return;
      try {
        if (!noiseBuf) {
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t = ac.currentTime, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noiseBuf; fl.type = "bandpass"; fl.frequency.value = freq || 1000; fl.Q.value = q || 0.8;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(ac.destination); src.start(t); src.stop(t + dur + 0.05);
      } catch (e) { /* rien */ }
    }
    const sndKick = () => tone(130, 0.2, "sine", 0.55, 42);
    const sndSnare = () => { noise(0.14, 0.28, 1900, 0.7); tone(210, 0.08, "triangle", 0.12, 120); };
    const sndBeep = hi => tone(hi ? 990 : 660, hi ? 0.35 : 0.14, "square", 0.05);
    const sndTap = c => (c === 3 ? tone(1250, 0.07, "triangle", 0.09) : c === 2 ? tone(900, 0.06, "triangle", 0.06) : tone(220, 0.06, "sawtooth", 0.04));
    const sndSplash = () => { noise(0.6, 0.35, 380, 0.6); tone(160, 0.4, "sine", 0.25, 50); };
    const sndWin = () => [523, 659, 784, 1046].forEach((f, i) => later(() => tone(f, 0.22, "square", 0.05), i * 110));
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      muteBtn.textContent = muted ? "SON : NON" : "SON : OUI";
      muteBtn.setAttribute("aria-pressed", String(muted));
      if (!muted) unlockAudio();
    });

    // ---------- logique de l'hôte ----------
    let finished = false;
    if (api.isHost) {
      const H = {ph: "i", n: 0, sc: [0, 0], bpm: BPM0, nb: 60, e: 0, p: 0, k: LEAD - 1, f: [0, 0], s: [0, 0], hc: "", w: -1, W: -1, ff: 0, nt: 0, cn: 0, g: P.map(() => 0)};
      let origin = 0, period = 500, phT = now(), lastPub = 0, ct = [0, 0], rec = {}, dirty = true;
      let pullTaps = 0, idleRun = 0;
      let t00 = now(), lastTick = now();
      const lastSeen = [0, 0];
      const conn = () => { const c = new Set(api.connected()); return [0, 1].map(t => TEAMS[t].keys.filter(k => c.has(k))); };
      const pub = () => {
        if (H.ph === "p") H.e = Math.round(now() - origin);
        H.p = f1(H.p);
        api.setState(H);
        lastPub = now(); dirty = false;
      };
      const startPull = () => {
        H.n += 1;
        H.bpm = Math.min(150, BPM0 + BPM_STEP * (H.n - 1));
        period = 60000 / H.bpm;
        H.nb = Math.round(PULL_MS / period);
        origin = now() + 500;
        H.ph = "p"; H.p = 0; H.k = LEAD - 1; H.f = [0, 0]; H.s = [0, 0]; H.hc = ""; H.w = -1; H.nt = 0;
        ct = [0, 0]; rec = {}; pullTaps = 0;
        pub();
      };
      const endMatch = (W, ff) => {
        H.ph = "f"; H.W = W; H.ff = ff ? 1 : 0;
        pub();
        if (finished) return;
        finished = true;
        later(() => {
          const others = P.map(p => p.key).filter(k => teamOf(k) === null);
          if (W < 0) {
            const ranking = P.map(p => p.key).sort((a, b) => H.g[pIdx[b]] - H.g[pIdx[a]]);
            api.finish({winners: [], ranking, summary: H.nt ? "Match nul : personne n'a tiré sur la corde." : `Match nul : ${H.sc[0]} tir${H.sc[0] > 1 ? "s" : ""} partout, la corde n'a pas tranché.`});
            return;
          }
          const L = 1 - W, byGood = arr => arr.slice().sort((a, b) => H.g[pIdx[b]] - H.g[pIdx[a]]);
          const nm = TEAMS[W].name;
          const summary = ff ? `${nm} ${verb(nm)} par forfait : l'autre équipe a lâché la corde.`
            : `${nm} ${verb(nm)} ${H.sc[W]} tir${H.sc[W] > 1 ? "s" : ""} à ${H.sc[L]}`;
          api.finish({winners: TEAMS[W].keys.slice(), ranking: byGood(TEAMS[W].keys).concat(byGood(TEAMS[L].keys), others), summary});
        }, FINISH_MS);
      };
      const endPull = w => {
        H.w = w;
        // personne n'a tapé de tout le tir : pas de vainqueur (on rejoue ; deux fois de suite = match nul)
        H.nt = pullTaps ? 0 : 1;
        if (H.nt) { H.w = w = -1; idleRun += 1; } else idleRun = 0;
        if (H.nt && idleRun >= IDLE_MAX) { endMatch(-1, false); return; }
        if (w >= 0) H.sc[w] += 1;
        if (w >= 0 && H.sc[w] >= 2) { endMatch(w, false); return; }
        H.ph = "r"; phT = now();
        pub();
      };
      const applyBeat = k => {
        const c = conn(), hc = H.hc ? H.hc.split("") : P.map(() => "0");
        const F = [0, 0], S = [0, 0];
        for (let t = 0; t < 2; t++) {
          let sum = 0, sync = 0;
          for (const key of TEAMS[t].keys) {
            const code = (rec[key] && rec[key][k]) || 0;
            if (code >= 2) sync++;
            sum += VAL[code] * MULT[key];
            if (pIdx[key] != null) { hc[pIdx[key]] = String(code); if (code === 3) H.g[pIdx[key]] += 1; }
          }
          const N = Math.max(1, c[t].length);
          const bonus = N >= 2 && sync >= 2 ? 1 + SYNC_MAX * (Math.min(sync, N) - 1) / (N - 1) : 1;
          F[t] = sum / N * bonus;
          S[t] = sync;
        }
        for (const key in rec) delete rec[key][k];
        H.p = clamp(H.p + (F[0] - F[1]) * K, -100, 100);
        ct[0] += F[0]; ct[1] += F[1];
        H.k = k; H.f = [Math.round(F[0] * 100), Math.round(F[1] * 100)]; H.s = S; H.hc = hc.join("");
        dirty = true;
      };
      api.onInputs(map => {
        if (H.ph !== "p") return;
        for (const key in map) {
          const inp = map[key];
          if (teamOf(key) === null || !inp || inp.n !== H.n || !Array.isArray(inp.h)) continue;
          const r = rec[key] || (rec[key] = {});
          for (const it of inp.h.slice(-12)) {
            if (!Array.isArray(it)) continue;
            const k = it[0] | 0, code = it[1] | 0;
            if (k > H.k && k >= LEAD && k < LEAD + H.nb && code >= 1 && code <= 3) { if (!r[k]) pullTaps++; r[k] = code; }
          }
        }
      });
      const tick = () => {
        if (dead) return;
        const t = now();
        // forfait : une équipe entièrement absente de la salle de jeu depuis longtemps (pas « lente » : absente).
        // Si je ne vois plus personne d'autre, c'est sans doute MA connexion qui flanche : pas de forfait.
        // onglet de l'hôte endormi (écran verrouillé, onglet en arrière-plan) : ce temps-là ne compte pas comme une absence
        const gap = t - lastTick;
        lastTick = t;
        if (gap > 1000) { t00 += gap; for (let i = 0; i < 2; i++) if (lastSeen[i]) lastSeen[i] += gap; }
        const c = conn();
        for (let i = 0; i < 2; i++) if (c[i].length) lastSeen[i] = t;
        if (H.ph !== "f") {
          const othersHere = c[0].concat(c[1]).some(k => k !== api.me);
          const gone = [0, 1].map(i => !c[i].length && (lastSeen[i] ? t - lastSeen[i] > FORFEIT_MS : t - t00 > NEVER_MS));
          if (othersHere && gone[0] !== gone[1]) { endMatch(gone[0] ? 1 : 0, true); return; }
        }
        if (H.ph === "i") {
          // on attend que tous les téléphones aient rejoint la partie (ou au moins un par équipe après INTRO_MAX)
          const cn = c[0].length + c[1].length, all = cn >= TEAMS[0].keys.length + TEAMS[1].keys.length;
          if (cn !== H.cn) { H.cn = cn; dirty = true; }
          if (t - phT > INTRO_MIN && (all || (t - phT > INTRO_MAX && c[0].length && c[1].length))) startPull(); else if (dirty) pub();
          return;
        }
        if (H.ph === "p") {
          const e = t - origin, last = LEAD + H.nb - 1;
          while (H.ph === "p" && H.k < last && e > (H.k + 1.5) * period + GRACE) { // fenêtre du temps k+1 : jusqu'à (k+1,5) temps
            applyBeat(H.k + 1);
            if (Math.abs(H.p) >= 100) { endPull(H.p > 0 ? 0 : 1); return; }
          }
          if (H.k >= last) {
            const w = Math.abs(H.p) >= 1 ? (H.p > 0 ? 0 : 1) : Math.abs(ct[0] - ct[1]) > 0.01 ? (ct[0] > ct[1] ? 0 : 1) : -1;
            endPull(w);
            return;
          }
          if (dirty || t - lastPub >= PUB_MS) pub();
          return;
        }
        if (H.ph === "r") {
          if (t - phT > ROUND_PAUSE) {
            if (H.n >= MAX_PULLS) endMatch(H.sc[0] === H.sc[1] ? -1 : H.sc[0] > H.sc[1] ? 0 : 1, false);
            else startPull();
          }
          else if (dirty) pub();
        }
      };
      pub();
      intervals.push(setInterval(tick, 50));
    }

    // ---------- affichage + jeu local (tout le monde) ----------
    let S = null, curN = -1, origin = 0, period = 500, nb = 60, clk = [];
    let taps = new Map(), fin = new Set(), hist = [], good = 0, okc = 0, bad = 0, sent = "", lastSend = 0, mySeq = 0;
    let lastK = -1, lastPh = "", shownBeat = -999, dispShift = 0, lastFrame = now();
    const tgtShift = () => {
      if (!S) return 0;
      let p = S.p;
      if ((S.ph === "r" || S.ph === "f") && !S.ff) { const w = S.ph === "f" ? S.W : S.w; if (w === 0) p = 118; else if (w === 1) p = -118; }
      // p > 0 : l'équipe 0 gagne du terrain, la corde part vers son côté
      return (SIDE[0] === 0 ? -1 : 1) * p / 100 * LINE;
    };

    function setBanner(h, p, small) {
      ban.querySelector("h3").textContent = h;
      ban.querySelector("p").textContent = p;
      ban.querySelector("p").style.display = p ? "" : "none";
      ban.classList.toggle("tc-sm", !!small);
      ban.classList.add("on");
    }
    function feedback(txt, cls) {
      if (!fbEl) return;
      fbEl.textContent = txt;
      fbEl.className = "tc-fb " + (cls || "");
    }
    function setLean(t, deg) {
      for (const L of LAY[t]) { const n = plEls[L.k]; if (n) n.style.setProperty("--tc-lean", (L.side === 0 ? -deg : deg).toFixed(1) + "deg"); }
    }
    function yank(k, side) {
      const n = plEls[k];
      if (!n || RM || !n.animate) return;
      try { n.animate([{transform: "translateX(0)"}, {transform: `translateX(${side === 0 ? -5 : 5}px)`}, {transform: "translateX(0)"}], {duration: 260, easing: "ease-out"}); } catch (e) { /* rien */ }
    }
    function dust(t) {
      if (RM) return;
      for (const L of LAY[t]) {
        const d = document.createElement("i");
        d.className = "tc-dust";
        d.style.left = f1((L.cx + L.dir * -6) / 4) + "%";
        d.style.top = f1((FEET - L.y - 2) / 2.5) + "%";
        d.style.setProperty("--dx", (L.dir * -(8 + Math.random() * 10)).toFixed(0) + "px");
        rfx.appendChild(d);
        later(() => d.remove(), 800);
      }
    }
    function splash() {
      sndSplash();
      if (RM) return;
      for (let i = 0; i < 14; i++) {
        const d = document.createElement("i");
        d.className = "tc-drop";
        d.style.left = f1(50 + (Math.random() - 0.5) * 14) + "%";
        d.style.top = f1((FEET - 6) / 2.5) + "%";
        d.style.setProperty("--dx", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
        d.style.setProperty("--dy", (-(20 + Math.random() * 45)).toFixed(0) + "px");
        fx.appendChild(d);
        later(() => d.remove(), 1000);
      }
    }
    function syncPop(t, n) {
      const d = document.createElement("div");
      d.className = "tc-sync tc-s" + SIDE[t];
      d.textContent = `SYNCHRO x${n} !`;
      fx.appendChild(d);
      later(() => d.remove(), 1050);
    }
    function resetPull() {
      for (const k in plEls) plEls[k].classList.remove("tc-fall0", "tc-fall1", "tc-mud", "tc-cheer");
      setLean(0, 8); setLean(1, 8);
      taps = new Map(); fin = new Set(); hist = []; sent = ""; shownBeat = -999; lastK = LEAD - 1;
      mateEls.forEach(m => { m.className = "tc-mate"; });
    }
    function pullOver(w) {
      if (w < 0) return;
      const l = 1 - w;
      setLean(w, 30);
      for (const L of LAY[w]) plEls[L.k] && plEls[L.k].classList.add("tc-cheer");
      setLean(l, -12);
      const front = LAY[l][0];
      if (front && plEls[front.k]) {
        plEls[front.k].classList.add("tc-fall" + front.side);
        later(() => { plEls[front.k] && plEls[front.k].classList.add("tc-mud"); splash(); }, RM ? 100 : 520);
      }
      if (w === myTeam) later(sndWin, 300);
    }

    function render(s) {
      const prev = S;
      S = s;
      if (s.ph === "p" || s.ph === "r") {
        // Horloge : uniquement des durées (performance.now locale + temps écoulé « e » publié par l'hôte), jamais Date.now
        // (les horloges des téléphones peuvent différer de plusieurs secondes). L'origine du tir dans MON horloge =
        // réception − e, au délai réseau près : on garde l'échantillon le plus rapide des dernières secondes
        // (fenêtre glissante, pour suivre un onglet mis en pause ou une horloge qui dérive).
        const t = now();
        if (s.n !== curN) { curN = s.n; resetPull(); clk = []; }
        if (s.ph === "p") {
          clk.push([t, t - s.e]);
          while (clk.length > 1 && t - clk[0][0] > CLOCK_WIN) clk.shift();
          let o = Infinity;
          for (const c of clk) if (c[1] < o) o = c[1];
          origin = o;
        } else if (!clk.length) origin = t - s.e;
        period = 60000 / s.bpm; nb = s.nb;
      }
      rndEl.textContent = s.n ? `TIR ${s.n}${s.n > 3 ? "" : "/3"}` : "TIR 1/3";
      for (let side = 0; side < 2; side++) {
        const t = side === 0 ? LT : RT;
        dotsEl[side].forEach((d, i) => d.classList.toggle("on", s.sc[t] > i));
      }
      // nouveau temps compté par l'hôte
      if (s.ph === "p" && s.n === curN && s.k > lastK) {
        lastK = s.k;
        for (let t = 0; t < 2; t++) {
          const fv = s.f[t] / 100;
          setLean(t, 8 + 24 * clamp(fv / 1.4, 0, 1));
          if (fv >= 0.45) dust(t);
          if (s.s[t] >= 2) syncPop(t, s.s[t]);
          const side = SIDE[t];
          fEl[side].textContent = fmt(fv, 1);
          sEl[side].textContent = s.s[t] >= 2 ? `SYNCHRO x${s.s[t]}` : " ";
          for (const L of LAY[t]) if (s.hc[pIdx[L.k]] >= "2") yank(L.k, L.side);
        }
        mateEls.forEach(m => { const c = s.hc[pIdx[m.dataset.k]] || "0"; m.className = "tc-mate" + (c === "3" ? " c3" : c === "2" ? " c2" : ""); });
      }
      if (s.ph === "i" && lastPh === "i") {
        const tot = TEAMS[0].keys.length + TEAMS[1].keys.length;
        ban.querySelector("p").textContent = s.cn < tot ? `On attend les téléphones… (${s.cn}/${tot})` : "La synchro bat la vitesse : tapez ENSEMBLE sur le temps !";
      }
      if (s.ph !== lastPh || (prev && prev.n !== s.n)) {
        const was = lastPh;
        lastPh = s.ph;
        if (s.ph === "i") setBanner("Tir à la corde", "La synchro bat la vitesse : tapez ENSEMBLE sur le temps !", true);
        else if (s.ph === "p") { ban.classList.remove("on"); if (tapBtn) tapBtn.classList.remove("tc-off"); }
        else if (s.ph === "r") {
          if (tapBtn) tapBtn.classList.add("tc-off");
          if (coreEl) coreEl.textContent = "TIRE";
          hh.textContent = "";
          const w = s.w;
          if (s.nt) setBanner("Personne ne tire ?!", "On rejoue : tapez sur le temps !");
          else if (w < 0) setBanner("Égalité !", "On rejoue ce tir");
          else if (canTap) setBanner(w === myTeam ? "Tir gagné !" : "Tir perdu…", w === myTeam ? `${s.sc[myTeam]} – ${s.sc[1 - myTeam]} · dans la boue, les autres !` : `${s.sc[myTeam]} – ${s.sc[1 - myTeam]} · on se relève !`);
          else setBanner(`${TEAMS[w].name} prend le tir`, `${s.sc[LT]} – ${s.sc[RT]}`, true);
          pullOver(w);
          feedback(w < 0 ? "ENCORE !" : w === myTeam ? "BRAVO !" : "COURAGE !", w === myTeam ? "g" : "o");
        } else if (s.ph === "f") {
          if (tapBtn) tapBtn.classList.add("tc-off");
          hh.textContent = "";
          const W = s.W;
          if (W < 0) setBanner("Match nul !", s.nt ? "Personne n'a tiré sur la corde" : "Personne ne lâche rien");
          else {
            const nm = TEAMS[W].name, L = 1 - W;
            const sub = s.ff ? `${nm} ${verb(nm)} par forfait` : `${nm} ${verb(nm)} ${s.sc[W]} tir${s.sc[W] > 1 ? "s" : ""} à ${s.sc[L]}`;
            setBanner(canTap ? (W === myTeam ? "Victoire !" : "Défaite…") : "Fin du match", sub, !canTap);
            if (was === "p" && !s.ff) pullOver(W);
            else if (!s.ff) { setLean(W, 30); for (const Lw of LAY[W]) plEls[Lw.k] && plEls[Lw.k].classList.add("tc-cheer"); }
          }
          feedback(W === myTeam ? "VICTOIRE !" : "", "g");
        }
      }
    }
    api.onState(render);

    // ---------- coups ----------
    function judge(arr) {
      if (!arr || !arr.length) return 0;
      if (arr.length > 1) return 1;
      return arr[0] <= PILE ? 3 : arr[0] <= BIEN ? 2 : 1;
    }
    let hitT = 0;
    function tap() {
      unlockAudio();
      if (!canTap || dead) return;
      tapBtn.classList.add("tc-hit");
      clearTimeout(hitT); hitT = setTimeout(() => tapBtn && tapBtn.classList.remove("tc-hit"), 80);
      if (!S || S.ph !== "p" || S.n !== curN) { feedback("ATTENDS…", "o"); return; }
      const t = now(), x = (t - origin) / period, k = Math.round(x), dev = Math.abs(x - k);
      if (k < LEAD) { feedback(k >= LEAD - 1 ? "PAS ENCORE !" : "ATTENDS LE TOP !", "o"); return; }
      if (k >= LEAD + nb || fin.has(k)) return;
      const a = taps.get(k) || [];
      a.push(dev); taps.set(k, a);
      const c = judge(a);
      // envoyé tout de suite (provisoire : un 2e coup sur le même temps le déclasse avant que l'hôte ne compte ce temps)
      const it = hist.find(h => h[0] === k);
      if (it) it[1] = c; else { hist.push([k, c]); if (hist.length > 8) hist.shift(); }
      logic();
      if (a.length > 1) feedback("TROP VITE !", "b");
      else if (c === 3) { feedback("PILE !", "g"); yank(api.me, 0); }
      else if (c === 2) feedback("BIEN", "o");
      else feedback("À CÔTÉ", "b");
      sndTap(c);
    }
    function onDown(e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      tap();
    }
    function onKey(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      const tg = e.target;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
      e.preventDefault();
      if (e.repeat) return;
      tap();
    }
    if (tapBtn) {
      tapBtn.addEventListener("pointerdown", onDown);
      tapBtn.addEventListener("click", e => e.preventDefault());
      tapBtn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); tap(); } });
    }
    window.addEventListener("keydown", onKey);

    // finalise les temps passés et envoie ~10 fois/s
    function logic() {
      if (dead || !canTap || !S || curN < 0) return;
      const t = now();
      if (S.ph === "p" && S.n === curN) {
        for (const [k, arr] of taps) {
          if (fin.has(k) || t - origin <= (k + 0.5) * period) continue;
          fin.add(k);
          const c = judge(arr);
          if (c === 3) good++; else if (c === 2) okc++; else bad++;
          taps.delete(k);
        }
      }
      const payload = JSON.stringify([curN, hist, good, okc, bad]);
      if (payload !== sent && t - lastSend >= SEND_MS) {
        sent = payload; lastSend = t;
        api.setInput({n: curN, q: ++mySeq, h: hist.slice(), g: good, o: okc, m: bad});
        if (statsEl) statsEl.textContent = `PILE ${good} · BIEN ${okc} · RATÉS ${bad}`;
      }
    }
    intervals.push(setInterval(logic, 40));

    // ---------- animation ----------
    let raf = 0;
    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const t = now(), dt = Math.min(0.1, (t - lastFrame) / 1000);
      lastFrame = t;
      // corde
      const tg = tgtShift();
      dispShift += (tg - dispShift) * Math.min(1, dt * (S && S.ph === "p" ? 5 : 2.5));
      rig.style.transform = `translateX(${(dispShift / 4).toFixed(2)}%)`;
      mkEl.style.left = (50 + clamp(dispShift / LINE, -1.25, 1.25) * 40).toFixed(1) + "%";
      if (!S) return;
      if (S.ph === "p" && S.n === curN) {
        const x = (t - origin) / period, b = Math.floor(x);
        // texte et tambour sur le temps
        if (b !== shownBeat) {
          const first = shownBeat === -999;
          shownBeat = b;
          let txt = "PRÊTS ?", cd = true;
          if (b >= LEAD + nb) txt = "STOP !";
          else if (b >= LEAD) { txt = (b - LEAD) % 2 ? "HISSE !" : "HO…"; cd = false; }
          else if (b === LEAD - 1) txt = "TIREZ !";
          else if (b >= 0) txt = String(LEAD - 1 - b);
          hh.textContent = txt;
          hh.classList.toggle("tc-cd", cd);
          if (b >= 0 && !first) {
            if (b < LEAD) sndBeep(b === LEAD - 1);
            else if (b < LEAD + nb) ((b - LEAD) % 2 ? sndSnare : sndKick)();
            if (!RM && hh.animate) { try { hh.animate([{transform: "scale(1.35)"}, {transform: "scale(1)"}], {duration: Math.min(260, period * 0.6), easing: "cubic-bezier(.2,1.4,.4,1)"}); } catch (e) { /* rien */ } }
            if (coreEl) { coreEl.classList.add("tc-flash"); later(() => coreEl.classList.remove("tc-flash"), 110); }
          }
          if (coreEl) coreEl.textContent = b >= LEAD && b < LEAD + nb ? ((b - LEAD) % 2 ? "HISSE" : "HO") : b >= 0 && b < LEAD - 1 ? String(LEAD - 1 - b) : "TIRE";
        }
        // anneau qui se resserre jusqu'au prochain temps
        if (ringEl && !RM) {
          const ph = x - Math.floor(x);
          ringEl.style.transform = `scale(${(1 + 1.25 * (1 - ph)).toFixed(3)})`;
          ringEl.style.opacity = (0.35 + 0.6 * ph).toFixed(2);
        }
        const left = Math.max(0, ((LEAD + nb - 0.5) * period - (t - origin)) / 1000);
        const sec = Math.min(30, Math.ceil(left));
        if (timeEl.textContent !== String(sec)) { timeEl.textContent = String(sec); timeEl.classList.toggle("low", sec <= 5); }
      }
    }
    raf = requestAnimationFrame(frame);
    setLean(0, 8); setLean(1, 8);
    root.tcDebug = () => ({origin, period, nb, ph: S && S.ph, n: curN, lead: LEAD, k: S && S.k, p: S && S.p, sc: S && S.sc, f: S && S.f, s: S && S.s, hc: S && S.hc, nt: S && S.nt, ff: S && S.ff, W: S && S.W, w: S && S.w, ban: ban.classList.contains("on") ? ban.textContent.trim() : ""});

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        intervals.forEach(clearInterval);
        timers.forEach(clearTimeout); timers.clear();
        clearTimeout(hitT);
        window.removeEventListener("keydown", onKey);
        if (mq) { try { if (mq.removeEventListener) mq.removeEventListener("change", onMq); else if (mq.removeListener) mq.removeListener(onMq); } catch (e) { /* rien */ } }
        if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
        el.innerHTML = "";
      }
    };
  }
});
