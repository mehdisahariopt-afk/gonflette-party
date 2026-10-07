/* Gonflette Party : Le Spotteur (2 à 8 joueurs, chacun sur son téléphone).
   Jeu de confiance : dans chaque duo, un joueur soulève (développé couché), l'autre le pare (le « spotteur »).
   - 2 joueurs : un duo coopératif qui vise la médaille d'argent. 3 joueurs : un trio coopératif.
   - 4 joueurs et plus : des duos (plus un trio si nombre impair) qui s'affrontent au score.
   Les rôles tournent à chaque série (4 séries) : tout le monde soulève et pare.

   Le soulevé : on tape vite pour pousser la barre ; +10 kg à chaque rep, la fatigue monte, la barre tremble et
   finit par redescendre. La « tension » (0 → 1) mesure le danger ; à 1, le soulevé est écrasé (crêpe de muscu).
   Le spotteur voit cette tension FLOUE (bruit) : il faut se parler à voix haute. Il attrape la barre :
   trop tôt (< 0,6) = rep volée (pénalité), 0,6–0,8 = bon spot, 0,8–1 = SPOT PARFAIT, trop tard = écrasé.

   Réseau (hôte = arbitre, peut être spectateur) :
   - Le téléphone du soulevé simule SA barre (pas de latence) et envoie ~10 fois/s
     setInput({n, k, T, y, r, a, x}) : n° de série, n° d'échantillon, tension, hauteur, reps, appels à l'aide, écrasé.
   - L'hôte relaie la tension (échantillon k) dans l'état. Le spotteur juge son geste sur SON écran avec
     l'échantillon qu'il affiche, et envoie setInput({n, g, k}) ; l'hôte vérifie que cet échantillon existe
     (récent) et rend le verdict. Si le soulevé signale « écrasé », l'hôte attend un court délai de grâce les
     prises basées sur un échantillon antérieur (elles étaient déjà en route).
   - Partenaire parti : un robot-pareur prend le relais ; soulevé parti : la série s'arrête (kilos gardés).
   Test : window.__spRounds = 1 (sur l'hôte, avant le lancement) raccourcit la partie. */
GONFLETTE.registerGame({
  id: "spotteur",
  name: "Le Spotteur",
  min: 2,
  max: 8,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, A = (window.GONFLETTE && window.GONFLETTE.avatar) || null;
    const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
    const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
    const now = () => performance.now();
    const ease = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const pIdx = {};
    P.forEach((p, i) => { pIdx[p.key] = i; });
    const mySeat = api.isPlayer && pIdx[api.me] != null ? pIdx[api.me] : -1;
    const pseudo = s => (s < 0 ? "Gégé" : (P[s] && P[s].pseudo) || api.name(P[s] && P[s].key) || "?");
    const muscleOf = xp => (A && A.muscle ? A.muscle(xp) : Math.min(1.35, Math.max(0, +xp || 0) / 1500));

    let RM = false, mq = null;
    const onMq = () => { RM = !!(mq && mq.matches); };
    try {
      mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches;
      if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    } catch (e) { mq = null; }

    /* ---------- règles ---------- */
    const INTRO_MS = 4800, COUNT_MS = 3000, SET_MS = 24000, SET_CAP = 45000, RES_MS = 5600, FINAL_MS = 6500;
    const GRACE = 650, STEAL_CD = 1100, PUB_MS = 90, SEND_MS = 90;
    const Z_OK = 0.6, Z_PERF = 0.8;                 // < 0,6 : trop tôt ; 0,6–0,8 : bon spot ; 0,8–1 : parfait
    const W0 = 60, DW = 10;                         // 60 kg au départ, +10 kg par rep
    const kgOf = r => W0 * r + DW * r * (r - 1) / 2;
    const B_OK = 30, B_PERF = 60, PEN = 20;
    const MED = [["bronze", "BRONZE", 1200], ["argent", "ARGENT", 1800], ["or", "OR", 2300]];
    let RR = 4;                                     // nombre de séries (seuils de médailles au prorata)
    const thr = i => Math.round(MED[i][2] * RR / 4 / 10) * 10;
    const TCOL = ["#ff5d8f", "#3ab0ff", "#ffd166", "#7ae582"];
    const BOT_LOOK = {skin: "#c9d3dd", hair: "chauve", hairColor: "#25201f", top: "singlet", topColor: "#5a6270", shorts: "#2a2f36", acc: "lunettes"};

    const SPOT_TALK = ["JE TOUCHE PAS, JE TOUCHE PAS…", "C'EST TOUT TOI !", "PAS DE PANIQUE !", "ENCORE UNE !", "POUSSE, POUSSE !", "RESPIRE !", "ELLE EST LÉGÈRE !"];
    const STEAL_TXT = ["Tu m'as volé ma rep !", "Lâche ma barre !", "Elle comptait pas, celle-là !"];
    const CRUSH_TXT = ["CRÊPE DE MUSCU !", "APPELEZ LE KINÉ !", "ÉCRASÉ !"];

    /* ---------- scène (unités 360 × 300, vue depuis les pieds du banc) ---------- */
    const VW = 360, VH = 300, CX = 180;
    const POST = [66, 294], COLLAR = [52, 308];
    const PLATES = [[25, "#e63946", 74, 11], [20, "#3a86ff", 66, 10], [15, "#ffd166", 57, 9], [10, "#2bb673", 48, 8], [5, "#e9e4ea", 34, 6]];
    const platesFor = kg => { let side = (kg - 20) / 2; const out = []; for (const pl of PLATES) while (side >= pl[0] && out.length < 9) { out.push(pl); side -= pl[0]; } return out; };
    const prop = m => {
      const mc = Math.min(m, 1);
      return {m, headR: 25 - 6 * mc - 2 * Math.max(0, m - 1), headY: 50 + 12 * m, yS: 100 + 2 * m, SW: 19 + 50 * m, W: 13 + 12 * m, H: 15 + 13 * m, UA: 7 + 28 * m, FA: 6 + 19 * m};
    };
    // polygone qui garde tête, épaules et torse mais coupe les bras qui pendent (on dessine nos propres bras)
    const clipPts = q => [[-60, -40], [260, -40], [260, q.yS + 4], [100 + q.SW + 4, q.yS + 4], [100 + q.SW, q.yS + 28], [100 + q.W + 8, 152], [100 + q.H + 6, 176], [100 + q.H + 6, 320],
      [100 - q.H - 6, 320], [100 - q.H - 6, 176], [100 - q.W - 8, 152], [100 - q.SW, q.yS + 28], [100 - q.SW - 4, q.yS + 4], [-60, q.yS + 4]].map(p => p.map(f1).join(",")).join(" ");
    let clipN = 0;
    function cropAv(svg, vb, box, q, cls) {
      const id = "sp-clip" + (++clipN);
      return svg.replace(/class="av"/, `class="${cls}"`)
        .replace(/viewBox="[^"]*"/, `viewBox="${vb.map(f1).join(" ")}" x="${f1(box[0])}" y="${f1(box[1])}" width="${f1(box[2])}" height="${f1(box[3])}" preserveAspectRatio="xMidYMid meet"`)
        .replace(/<svg([^>]*)>/, `<svg$1><defs><clipPath id="${id}"><polygon points="${clipPts(q)}"/></clipPath></defs><g clip-path="url(#${id})">`)
        .replace(/<\/svg>\s*$/, "</g></svg>");
    }
    const avOf = (seat, pose) => (seat >= 0 ? api.avatar(P[seat].key, {pose: pose || "idle"}) : A ? A.svg(BOT_LOOK, 900, {pose: pose || "idle"}) : "");
    const lookOf = seat => (seat >= 0 ? (P[seat] && P[seat].look) || {} : BOT_LOOK);
    const xpOf = seat => (seat >= 0 ? (P[seat] && P[seat].xp) || 0 : 900);

    function geom(L, S) {
      const g = {};
      // soulevé : buste en bas de la scène
      const q = prop(muscleOf(xpOf(L)));
      const hw = Math.max(q.SW + q.UA + 10, 62);
      const vbx = 100 - hw, vby = q.headY - q.headR - 18, cw = hw * 2, ch = 172 - vby;
      const k = Math.min(132 / ch, 250 / cw);
      const W = cw * k, Hh = ch * k, X = CX - W / 2, Y = VH - Hh;
      const sx = ax => X + (ax - vbx) * k, sy = ay => Y + (ay - vby) * k;
      g.L = {q, k, vb: [vbx, vby, cw, ch], box: [X, Y, W, Hh], sh: [[sx(100 - (q.SW - 5)), sy(q.yS + 12)], [sx(100 + (q.SW - 5)), sy(q.yS + 12)]],
        head: [sx(100), sy(q.headY)], hr: q.headR * k, arm: q.UA * k * 0.9, fist: (5.5 + 6 * q.m) * k + 2};
      g.grip = (q.SW - 5) * k + 20 + 6 * k;
      g.down = Math.min(g.L.sh[0][1] + 12, 236);
      g.up = Math.max(84, Math.min(sy(q.headY - q.headR) - 22, g.down - 86));
      // spotteur : debout derrière la tête du banc
      const q2 = prop(muscleOf(xpOf(S)));
      const hw2 = Math.max(q2.SW + 14, 58);
      const vbx2 = 100 - hw2, vby2 = q2.headY - q2.headR - 20, cw2 = hw2 * 2, ch2 = 182 - vby2;
      const k2 = Math.min(150 / ch2, 210 / cw2);
      const W2 = cw2 * k2, H2 = ch2 * k2, X2 = CX - W2 / 2, Y2 = 14;
      const sx2 = ax => X2 + (ax - vbx2) * k2, sy2 = ay => Y2 + (ay - vby2) * k2;
      g.S = {q: q2, k: k2, vb: [vbx2, vby2, cw2, ch2], box: [X2, Y2, W2, H2], sh: [[sx2(100 - (q2.SW - 5)), sy2(q2.yS + 12)], [sx2(100 + (q2.SW - 5)), sy2(q2.yS + 12)]],
        head: [sx2(100), sy2(q2.headY)], hr: q2.headR * k2, arm: q2.UA * k2 * 0.9, fist: (5.5 + 6 * q2.m) * k2 + 2};
      g.hx = Math.max(g.L.hr + 12, 30);   // les mains du spotteur, de part et d'autre de la tête du soulevé
      return g;
    }

    const bgSvg = `
      <defs>
        <linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b2a86"/><stop offset=".45" stop-color="#ff6f61"/><stop offset=".8" stop-color="#ffb86b"/><stop offset="1" stop-color="#ffd89a"/></linearGradient>
        <linearGradient id="sp-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6fa3"/><stop offset="1" stop-color="#4fb3c8"/></linearGradient>
        <linearGradient id="sp-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3cf8e"/><stop offset="1" stop-color="#d79e57"/></linearGradient>
        <linearGradient id="sp-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6470"/><stop offset=".45" stop-color="#d4d9e0"/><stop offset="1" stop-color="#4a505a"/></linearGradient>
        <linearGradient id="sp-barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f7f9"/><stop offset=".5" stop-color="#9aa1ab"/><stop offset="1" stop-color="#5c626b"/></linearGradient>
        <radialGradient id="sp-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c4"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#ffd84a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect x="-200" y="-400" width="${VW + 400}" height="${VH + 400}" fill="url(#sp-sky)"/>
      <circle cx="292" cy="112" r="46" fill="url(#sp-sun)"/><circle cx="292" cy="112" r="20" fill="#fff0a8"/>
      <rect x="-200" y="118" width="${VW + 400}" height="34" fill="url(#sp-sea)"/>
      <g stroke="#fff" stroke-width="1.5" fill="none" opacity=".5" stroke-linecap="round"><path class="sp-wave" d="M14 128q7-4 14 0t14 0M118 138q7-4 14 0t14 0M232 126q7-4 14 0t14 0M318 142q7-4 14 0t14 0"/></g>
      <path d="M-200 150Q90 140 180 146T560 148V400H-200z" fill="url(#sp-sand)"/>
      <g stroke="#1d1420" stroke-width="2.5" stroke-linejoin="round">
        <path d="M20 170q-6-50 8-96" stroke="#6b3d1c" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M28 74q-28-6-40 8q20-4 40-8zM28 74q-6-24-30-26q16 10 30 26zM28 74q14-24 36-20q-22 4-36 20zM28 74q28 0 34 18q-18-12-34-18z" fill="#2f8f4f"/>
        <path d="M342 172q6-44-6-84" stroke="#6b3d1c" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M336 88q-26-4-34 10q18-6 34-10zM336 88q-2-22-24-26q14 10 24 26zM336 88q14-20 32-14q-20 2-32 14zM336 88q22 4 28 20q-16-10-28-20z" fill="#2f8f4f"/>
      </g>
      <g transform="translate(256 26) rotate(4)">
        <rect x="-2" y="0" width="74" height="26" rx="5" fill="#c98b4a" stroke="#1d1420" stroke-width="2.6"/>
        <text x="35" y="18" text-anchor="middle" font-family="Pacifico,'Brush Script MT',cursive" font-size="11" fill="#fff8e6" stroke="#1d1420" stroke-width=".5">Muscle Beach</text>
        <path d="M14 26v14M56 26v14" stroke="#6b3d1c" stroke-width="3"/>
      </g>
      <g transform="translate(20 236)"><path d="M-8 0h30l-4 26h-22z" fill="#e9e4ea" stroke="#1d1420" stroke-width="2.5"/><text x="7" y="17" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="8" fill="#1d1420">CRAIE</text><ellipse cx="7" cy="0" rx="15" ry="3" fill="#fff" stroke="#1d1420" stroke-width="2"/></g>
      <g transform="translate(318 266)" stroke="#1d1420" stroke-width="2.5"><rect x="-4" y="-4" width="34" height="8" rx="3" fill="#7c838d"/><rect x="-10" y="-11" width="10" height="22" rx="3" fill="#e63946"/><rect x="26" y="-11" width="10" height="22" rx="3" fill="#e63946"/></g>
      ${POST.map(x => `<g transform="translate(${x} 0)"><rect x="-6" y="96" width="12" height="${VH - 96}" fill="url(#sp-steel)" stroke="#1d1420" stroke-width="2"/><rect x="-14" y="${VH - 10}" width="28" height="10" rx="2" fill="#2a2f36" stroke="#1d1420" stroke-width="2"/></g>`).join("")}`;

    /* ---------- DOM ---------- */
    el.innerHTML = `<style>
      .sp{--ink:#1d1420;--gold:#ffcc33;--g:#3ccf8e;--o:#ff9f1c;--r:#ff4d5e;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:7px;padding:8px 12px calc(12px + env(safe-area-inset-bottom,0px));max-width:540px;margin:0 auto;color:#fff6ea;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .sp *{box-sizing:border-box}
      .sp-top{display:flex;align-items:center;gap:8px;flex:none}
      .sp-rnd{font-family:Anton,Impact,sans-serif;font-size:.95rem;letter-spacing:.03em;background:#ffffff18;border:2px solid #ffffff30;border-radius:999px;padding:1px 10px;white-space:nowrap}
      .sp-goal{flex:1;min-width:0;font-weight:800;font-size:.8rem;line-height:1.05;color:#d9cbe6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sp-goal b{color:var(--gold);font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.05rem;letter-spacing:.02em}
      .sp-clock{font-family:Anton,Impact,sans-serif;font-size:1.25rem;min-width:2.2em;text-align:right;color:var(--gold);font-variant-numeric:tabular-nums}
      .sp-clock.low{color:var(--r)}
      .sp-mute{border:2px solid #ffffff30;background:none;color:inherit;opacity:.75;font:inherit;font-weight:800;font-size:.68rem;letter-spacing:.04em;cursor:pointer;padding:1px 5px;border-radius:8px;flex:none}
      .sp-mute.off{text-decoration:line-through}
      .sp-board{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:5px;flex:none}
      .sp-chip{min-width:0;border-radius:10px;padding:3px 7px;background:#231b2b;border:2px solid color-mix(in srgb,var(--c) 60%,transparent);display:flex;flex-direction:column;line-height:1.05;cursor:pointer;font:inherit;color:inherit;text-align:left}
      .sp-chip.mine{background:color-mix(in srgb,var(--c) 28%,#231b2b);border-color:var(--c)}
      .sp-chip.view{box-shadow:0 0 0 2px #fff}
      .sp-chip .nm{font-weight:800;font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e6dbef}
      .sp-chip .pt{font-family:Anton,Impact,sans-serif;font-size:1rem;white-space:nowrap}
      .sp-chip .pt small{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.7em;opacity:.75}
      .sp-chip .stt{font-size:.66rem;font-weight:800;letter-spacing:.04em;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sp-stage{position:relative;width:100%;aspect-ratio:360/300;flex:none;border-radius:16px;overflow:hidden;border:3px solid var(--ink);box-shadow:0 8px 22px rgba(0,0,0,.45);background:#ff9a6b}
      .sp-stage.sp-shake{animation:sp-quake .45s}
      @keyframes sp-quake{20%{transform:translate(-5px,3px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-3px,2px)}80%{transform:translate(2px,-1px)}}
      .sp-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
      .sp-wave{animation:sp-waves 3s ease-in-out infinite alternate}
      @keyframes sp-waves{to{transform:translateX(7px)}}
      .sp-lif{transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
      .sp-puff{transform-box:fill-box;transform-origin:center;animation:sp-puff .8s ease-out forwards}
      @keyframes sp-puff{to{transform:translate(var(--dx),var(--dy)) scale(2.6);opacity:0}}
      .sp-drop{transform-box:fill-box;transform-origin:center;animation:sp-drop .9s cubic-bezier(.3,.2,.7,1) forwards}
      @keyframes sp-drop{40%{transform:translate(calc(var(--dx)*.6),-10px)}100%{transform:translate(var(--dx),34px);opacity:0}}
      .sp-plate.new{transform-box:fill-box;transform-origin:center;animation:sp-plate .45s cubic-bezier(.3,1.6,.5,1)}
      @keyframes sp-plate{from{transform:scaleY(.2) translateY(-50px);opacity:0}}
      .sp-stars{transform-box:fill-box;transform-origin:center;animation:sp-spin 1.1s linear infinite}
      @keyframes sp-spin{to{transform:rotate(360deg)}}
      .sp-eyes{transform-box:fill-box;transform-origin:50% 100%;animation:sp-boing .5s cubic-bezier(.2,1.8,.4,1)}
      @keyframes sp-boing{from{transform:scale(.2)}}
      .sp-ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
      .sp-bub{position:absolute;max-width:46%;padding:4px 8px;border-radius:12px;background:#fff;color:var(--ink);border:2.5px solid var(--ink);font-weight:800;font-size:clamp(.72rem,3.4vw,.95rem);line-height:1.05;text-align:center;opacity:0;transform:scale(.6);transition:opacity .2s,transform .3s cubic-bezier(.2,1.6,.4,1);z-index:3}
      .sp-bub.on{opacity:1;transform:none}
      .sp-bub.hot{background:var(--r);color:#fff}
      .sp-bub.gold{background:var(--gold)}
      .sp-bub::after{content:"";position:absolute;width:10px;height:10px;background:inherit;border:inherit;border-width:0 2.5px 2.5px 0;bottom:-7px;transform:rotate(45deg)}
      .sp-bub.l::after{left:12px}.sp-bub.r::after{right:12px}
      .sp-tag{position:absolute;transform:translateX(-50%);font-weight:800;font-size:clamp(.62rem,2.8vw,.8rem);line-height:1;background:#1d1420cc;border-radius:6px;padding:2px 6px;white-space:nowrap;z-index:2}
      .sp-tag i{font-style:normal;font-family:Anton,Impact,sans-serif;color:var(--ink);background:var(--gold);border-radius:4px;padding:0 3px;margin-left:4px;font-size:.9em}
      .sp-float{position:absolute;transform:translate(-50%,0);font-family:Anton,Impact,sans-serif;font-size:clamp(1.1rem,6vw,1.6rem);color:#fff;-webkit-text-stroke:1px var(--ink);text-shadow:2px 2px 0 var(--ink);white-space:nowrap;animation:sp-float 1s ease-out forwards;z-index:4}
      .sp-float.g{color:#b6ff5c}.sp-float.y{color:var(--gold)}.sp-float.r{color:#ff8a94}
      @keyframes sp-float{from{opacity:0;transform:translate(-50%,10px) scale(.6)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}to{opacity:0;transform:translate(-50%,-40px)}}
      .sp-big{position:absolute;left:0;right:0;top:34%;text-align:center;font-family:Anton,Impact,sans-serif;font-size:clamp(3rem,18vw,5rem);line-height:1;color:var(--gold);-webkit-text-stroke:2px var(--ink);text-shadow:4px 4px 0 var(--ink);z-index:5}
      .sp-big:empty{display:none}
      .sp-stamp{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) rotate(-10deg);text-align:center;border:5px solid currentColor;border-radius:14px;padding:3px 14px 6px;background:rgba(29,20,32,.86);font-family:Anton,Impact,sans-serif;line-height:.95;animation:sp-stamp .45s cubic-bezier(.2,1.6,.4,1);z-index:6;max-width:92%}
      .sp-stamp b{display:block;font-weight:400;font-size:clamp(1.7rem,10vw,2.8rem);letter-spacing:.02em;white-space:nowrap}
      .sp-stamp span{display:block;font-size:clamp(.85rem,4.2vw,1.15rem);color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sp-stamp.g{color:#b6ff5c}.sp-stamp.y{color:var(--gold)}.sp-stamp.r{color:var(--r)}.sp-stamp.o{color:var(--o)}
      @keyframes sp-stamp{from{transform:translate(-50%,-50%) rotate(-10deg) scale(2.6);opacity:0}}
      .sp-ban{position:absolute;left:4%;right:4%;top:6%;text-align:center;z-index:7;opacity:0;transform:scale(.7);transition:opacity .25s,transform .35s cubic-bezier(.2,1.5,.4,1)}
      .sp-ban.on{opacity:1;transform:none}
      .sp-ban h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.6rem,9vw,2.5rem);line-height:1;text-transform:uppercase;color:var(--gold);-webkit-text-stroke:1.5px var(--ink);text-shadow:3px 3px 0 #e8261e}
      .sp-ban p{display:inline-block;margin:6px 0 0;background:var(--ink);color:#fff;font-weight:800;font-size:clamp(.85rem,4vw,1.05rem);padding:3px 12px;border-radius:12px;max-width:100%;line-height:1.15}
      .sp-panel{flex:1 1 auto;min-height:300px;display:flex;flex-direction:column;gap:7px}
      .sp-role{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex:none}
      .sp-role b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.45rem;letter-spacing:.02em;color:var(--gold);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sp-role span{font-weight:800;font-size:.95rem;color:#d9cbe6;white-space:nowrap}
      .sp-gauge{position:relative;height:46px;border-radius:12px;border:3px solid var(--ink);overflow:hidden;flex:none;background:linear-gradient(90deg,#2a6b4a 0 60%,#a8641a 60% 80%,#a32035 80% 100%)}
      .sp-gauge .zl{position:absolute;top:0;bottom:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;font-weight:800;font-size:.66rem;letter-spacing:.06em;color:#fff;opacity:.85;text-shadow:1px 1px 0 var(--ink)}
      .sp-gauge .z0{left:0;width:60%}.sp-gauge .z1{left:60%;width:20%}.sp-gauge .z2{left:80%;width:20%}
      .sp-gauge .ndl{position:absolute;top:-2px;bottom:-2px;width:8px;margin-left:-4px;left:0;background:#fff;border:2px solid var(--ink);border-radius:4px;box-shadow:0 0 8px #fff}
      .sp-gauge .fog{position:absolute;top:2px;bottom:12px;width:26%;margin-left:-13%;left:0;border-radius:50%;background:radial-gradient(ellipse at center,#fffbe0 0,#fff6c0cc 30%,#ffffff55 55%,transparent 72%);filter:blur(1.5px)}
      .sp-gauge .q{position:absolute;top:3px;font-family:Anton,Impact,sans-serif;font-size:.9rem;color:var(--ink);transform:translateX(-50%)}
      .sp-glab{display:flex;justify-content:space-between;font-weight:800;font-size:.78rem;letter-spacing:.05em;color:#cdbedb;margin-top:-4px;flex:none}
      .sp-row{display:flex;gap:8px;flex:1 1 auto;min-height:170px}
      .sp-btn{position:relative;flex:1;border:4px solid var(--ink);border-radius:24px;color:#fff;font:inherit;cursor:pointer;touch-action:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px;overflow:hidden;outline-offset:4px;box-shadow:0 7px 0 var(--ink),inset 0 -9px 0 rgba(0,0,0,.18),inset 0 7px 0 rgba(255,255,255,.25);transition:transform .05s,box-shadow .05s,filter .2s}
      .sp-btn b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.9rem,11vw,2.8rem);line-height:1;letter-spacing:.02em;text-shadow:3px 3px 0 var(--ink)}
      .sp-btn small{font-weight:800;font-size:.9rem;letter-spacing:.04em;text-shadow:1px 1px 0 var(--ink)}
      .sp-btn.hit{transform:translateY(5px);box-shadow:0 2px 0 var(--ink),inset 0 -6px 0 rgba(0,0,0,.18),inset 0 7px 0 rgba(255,255,255,.25)}
      .sp-btn.off{filter:grayscale(.75) brightness(.7)}
      .sp-push{background:radial-gradient(circle at 50% 30%,#ffe08a,#ff9f1c 55%,#c96a00)}
      .sp-aide{flex:0 0 32%;background:radial-gradient(circle at 50% 30%,#ff8a94,#e63946 55%,#9b1d2a)}
      .sp-aide b{font-size:clamp(1.4rem,7.4vw,2rem);white-space:nowrap}
      .sp-grab{background:radial-gradient(circle at 50% 30%,#c8ff8a,#3ccf8e 55%,#1d8a58)}
      .sp-cheer{background:radial-gradient(circle at 50% 30%,#b8d8ff,#3a86ff 55%,#1f4fa8)}
      .sp-alert{position:absolute;inset:0;display:grid;place-items:center;background:#e63946;font-family:Anton,Impact,sans-serif;font-size:clamp(2.6rem,16vw,4rem);color:#fff;text-shadow:3px 3px 0 var(--ink);opacity:0;pointer-events:none}
      .sp-alert.on{animation:sp-alert 1.3s ease-out}
      @keyframes sp-alert{0%,30%,60%{opacity:1}15%,45%{opacity:.35}100%{opacity:0}}
      .sp-fb{min-height:1.2em;text-align:center;font-family:Anton,Impact,sans-serif;font-size:clamp(1.15rem,6vw,1.6rem);line-height:1.1;text-shadow:2px 2px 0 var(--ink);flex:none}
      .sp-fb.g{color:#b6ff5c}.sp-fb.y{color:var(--gold)}.sp-fb.r{color:#ff8a94}.sp-fb.o{color:#ffd28a}
      .sp-hint{text-align:center;font-weight:700;font-size:.82rem;color:#cdbedb;flex:none;line-height:1.15}
      .sp-card{flex:1;border-radius:18px;background:#231b2b;border:2px solid #ffffff20;padding:10px 12px;display:flex;flex-direction:column;gap:6px;overflow:auto}
      .sp-card h4{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.25rem;letter-spacing:.03em;color:var(--gold);text-transform:uppercase}
      .sp-line{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.98rem;line-height:1.15;padding:4px 0;border-bottom:1px dashed #ffffff22}
      .sp-line:last-child{border-bottom:0}
      .sp-line .d{width:12px;height:12px;border-radius:50%;flex:none;background:var(--c);border:2px solid var(--ink)}
      .sp-line .t{flex:1;min-width:0}
      .sp-line .t small{display:block;font-weight:700;font-size:.8rem;color:#cdbedb}
      .sp-line .v{font-family:Anton,Impact,sans-serif;font-size:1.15rem;white-space:nowrap}
      .sp-pod{display:flex;align-items:flex-end;justify-content:center;gap:8px;min-height:170px}
      .sp-pcol{flex:1;max-width:160px;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
      .sp-pav{display:flex;justify-content:center;width:100%}
      .sp-pav svg{width:50%;height:auto;max-height:110px;overflow:hidden}
      .sp-pav.one svg{width:62%}
      .sp-pnm{font-weight:800;font-size:.86rem;text-align:center;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis}
      .sp-step{width:100%;border-radius:10px 10px 0 0;border:3px solid var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:4px;font-family:Anton,Impact,sans-serif;background:color-mix(in srgb,var(--c) 70%,#231b2b)}
      .sp-step b{font-weight:400;font-size:1.4rem;line-height:1;text-shadow:2px 2px 0 var(--ink)}
      .sp-step small{font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:.85rem}
      .sp-med{display:inline-grid;place-items:center;min-width:54px;height:24px;padding:0 7px;border-radius:999px;border:2px solid var(--ink);font-family:Anton,Impact,sans-serif;font-size:.8rem;letter-spacing:.05em;color:var(--ink);box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
      .sp-med.or{background:linear-gradient(#ffe680,#e0a800)}.sp-med.argent{background:linear-gradient(#ffffff,#a9b3bf)}.sp-med.bronze{background:linear-gradient(#f0b27a,#a8642b)}.sp-med.rien{background:#4a3f55;color:#cdbedb}
      .sp-prog{position:relative;height:14px;border-radius:999px;background:#ffffff14;border:2px solid #ffffff30;overflow:hidden;flex:none}
      .sp-prog i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ff9f1c,#ffcc33);border-radius:999px;transition:width .6s}
      .sp-prog u{position:absolute;top:0;bottom:0;width:2px;background:#fff9}
      .sp-key{text-align:center;font-size:.76rem;font-weight:700;opacity:.55;flex:none}
      @media (max-height:740px){.sp-row{min-height:140px}.sp-panel{min-height:250px}.sp-gauge{height:40px}}
      @media (min-width:700px){.sp-panel{min-height:280px}}
      @media (prefers-reduced-motion:reduce){.sp-wave,.sp-stars,.sp-stage.sp-shake{animation:none}.sp-float,.sp-stamp,.sp-eyes{animation:none}.sp-ban,.sp-bub{transition:opacity .2s;transform:none}.sp-lif{transition:none}.sp-alert.on{animation:none;opacity:.9}}
    </style>
    <div class="sp" id="sp-root">
      <div class="sp-top"><span class="sp-rnd" id="sp-rnd">SÉRIE 1</span><div class="sp-goal" id="sp-goal"></div><span class="sp-clock" id="sp-clock"></span><button type="button" class="sp-mute" id="sp-mute" aria-pressed="false" aria-label="Couper le son">SON</button></div>
      <div class="sp-board" id="sp-board" hidden></div>
      <div class="sp-stage" id="sp-stage">
        <svg class="sp-svg" id="sp-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${bgSvg}<g id="sp-scene"></g></svg>
        <div class="sp-ov" id="sp-ov">
          <div class="sp-tag" id="sp-tagS"></div><div class="sp-tag" id="sp-tagL"></div>
          <div class="sp-bub l" id="sp-bubS"></div><div class="sp-bub r" id="sp-bubL"></div>
          <div class="sp-big" id="sp-big" aria-hidden="true"></div>
          <div class="sp-ban on" id="sp-ban" role="status" aria-live="polite"><h3>Le Spotteur</h3><p>Un soulève, l'autre pare. Parlez-vous !</p></div>
        </div>
      </div>
      <div class="sp-panel" id="sp-panel"></div>
    </div>`;

    const $ = id => el.querySelector("#" + id);
    const root = $("sp-root"), stage = $("sp-stage"), sceneG = $("sp-scene"), ov = $("sp-ov"), panel = $("sp-panel");
    const rndEl = $("sp-rnd"), goalEl = $("sp-goal"), clockEl = $("sp-clock"), boardEl = $("sp-board"), muteBtn = $("sp-mute");
    const bubS = $("sp-bubS"), bubL = $("sp-bubL"), tagS = $("sp-tagS"), tagL = $("sp-tagL"), bigEl = $("sp-big"), ban = $("sp-ban");

    const timers = new Set(), intervals = [];
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    let dead = false, raf = 0;

    /* ---------- son ---------- */
    let ac = null, muted = false, noiseBuf = null;
    function audioOn() {
      if (muted || dead) return;
      try {
        if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
        if (ac && ac.state === "suspended") ac.resume().catch(() => {});
      } catch (e) { ac = null; }
    }
    function tone(f, d, type, v, f2, delay) {
      if (!ac || muted || ac.state !== "running") return;
      try {
        const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(v || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* son facultatif */ }
    }
    function noise(d, v, freq) {
      if (!ac || muted || ac.state !== "running") return;
      try {
        if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
        const t = ac.currentTime, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noiseBuf; fl.type = "bandpass"; fl.frequency.value = freq || 800;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(fl); fl.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + d + 0.05);
      } catch (e) { /* son facultatif */ }
    }
    const sfx = {
      tap: () => tone(110, 0.06, "sine", 0.18, 60),
      rep: () => { tone(220, 0.08, "square", 0.04, 140); tone(988, 0.12, "triangle", 0.06, null, 0.05); },
      beep: hi => tone(hi ? 990 : 660, hi ? 0.3 : 0.12, "square", 0.05),
      aide: () => { tone(880, 0.12, "square", 0.06); tone(660, 0.12, "square", 0.06, null, 0.14); tone(880, 0.12, "square", 0.06, null, 0.28); },
      grab: () => noise(0.18, 0.2, 1400),
      perfect: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, "triangle", 0.07, null, i * 0.08)),
      ok: () => [523, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.06, null, i * 0.09)),
      steal: () => { tone(300, 0.22, "sawtooth", 0.05, 200); tone(200, 0.4, "sawtooth", 0.05, 120, 0.22); },
      crush: () => { noise(0.5, 0.4, 300); tone(160, 0.5, "sine", 0.3, 40); tone(700, 0.4, "triangle", 0.05, 1400, 0.25); },
      cheer: () => noise(0.25, 0.08, 2400)
    };
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      muteBtn.classList.toggle("off", muted);
      muteBtn.setAttribute("aria-pressed", String(muted));
      if (!muted) audioOn();
    });
    const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* rien */ } };

    /* ==================================================================
       HÔTE : arbitre
       ================================================================== */
    let finished = false;
    if (api.isHost) {
      const R = clamp(Math.round(+window.__spRounds || 4), 1, 6);
      RR = R;
      const seats = P.map((p, i) => i);
      for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
      const tm = [];
      if (seats.length <= 3) tm.push(seats.slice());
      else {
        for (let i = 0; i + 1 < seats.length; i += 2) tm.push([seats[i], seats[i + 1]]);
        if (seats.length % 2) tm[tm.length - 1].push(seats[seats.length - 1]);
      }
      const H = {ph: "i", n: 0, R, e: 0, tm, t: tm.map(() => ({L: -1, S: -1, st: "w", k: 0, T: 0, y: 0, r: 0, a: 0, c: 0, ev: 0, sc: 0, tot: 0, pf: 0, ok: 0, cr: 0, sl: 0})), ip: P.map(() => 0)};
      const X = tm.map(() => ({hist: new Map(), pend: null, lastSteal: -1e9, pen: 0, botTh: 0.8, lastA: 0}));
      const lastG = {}, lastC = {};
      let origin = 0, phT = now(), lastPub = 0, dirty = true;
      const keyOf = s => (s >= 0 && P[s] ? P[s].key : null);
      const connSet = () => { try { return new Set(api.connected()); } catch (e) { return new Set(P.map(p => p.key)); } };
      const pub = () => {
        if (H.ph === "s") H.e = Math.round(now() - origin);
        api.setState(H);
        lastPub = now(); dirty = false;
      };
      function roles(i, c) {
        const m = tm[i], n = m.length, r0 = H.n - 1;
        const on = s => c.has(keyOf(s));
        let L = -1;
        for (let j = 0; j < n; j++) { const s = m[(r0 + j) % n]; if (on(s)) { L = s; break; } }
        if (L < 0) return [-1, -1];
        const li = m.indexOf(L);
        let S = -1;
        for (let j = 1; j < n; j++) { const s = m[(li + j) % n]; if (on(s)) { S = s; break; } }
        return [L, S];
      }
      { // rôles de la 1re série affichés dès l'échauffement
        H.n = 1;
        const c0 = connSet();
        H.t.forEach((t, i) => { const r = roles(i, c0); t.L = r[0]; t.S = r[1]; });
        H.n = 0;
      }
      function startSet() {
        H.n += 1; H.ph = "s";
        origin = now() + COUNT_MS;
        const c = connSet();
        H.t.forEach((t, i) => {
          const [L, S] = roles(i, c);
          Object.assign(t, {L, S, st: L < 0 ? "x" : "go", k: 0, T: 15, y: 0, r: 0, a: 0, c: 0, ev: 0, sc: 0});
          Object.assign(X[i], {hist: new Map(), pend: null, lastSteal: -1e9, pen: 0, botTh: 0.64 + Math.random() * 0.3, lastA: 0});
        });
        pub();
      }
      function endSet(i, st) {
        const t = H.t[i], x = X[i];
        if (t.st !== "go") return;
        const base = kgOf(t.r);
        const lift = st === "crush" ? Math.round(base * 0.5 / 5) * 5 : base;
        const bon = st === "save2" ? B_PERF : st === "save1" ? B_OK : 0;
        t.st = st;
        t.sc = Math.max(0, lift + bon - x.pen);
        t.tot += t.sc;
        if (t.L >= 0) H.ip[t.L] += lift;
        if (t.S >= 0) H.ip[t.S] += bon;
        if (st === "save2") t.pf++; else if (st === "save1") t.ok++; else if (st === "crush") t.cr++;
        if (st === "crush") t.T = 100;
        x.pend = null;
        dirty = true;
      }
      // verdict d'une prise (spotteur humain ou robot) basée sur l'échantillon k
      function grab(i, k, by) {
        const t = H.t[i], x = X[i];
        if (t.st !== "go" || now() < origin) return;
        let T = null;
        if (k != null && x.hist.has(k) && k >= t.k - 30) T = x.hist.get(k);
        if (T == null) { T = t.T / 100; k = t.k; }
        if (x.pend) {
          if (k < x.pend.k) endSet(i, T >= Z_PERF ? "save2" : "save1");
          return; // sinon : trop tard, l'écrasement suit
        }
        if (T >= 1) return;
        if (T < Z_OK) {
          if (now() - x.lastSteal < STEAL_CD) return;
          x.lastSteal = now();
          t.ev++; t.sl++; x.pen += PEN;
          if (by >= 0) H.ip[by] -= PEN;
          dirty = true;
          return;
        }
        endSet(i, T >= Z_PERF ? "save2" : "save1");
      }
      api.onInputs(map => {
        if (H.ph !== "s") return;
        for (const key in map) {
          const inp = map[key], s = pIdx[key];
          if (!inp || inp.n !== H.n || s == null) continue;
          H.t.forEach((t, i) => {
            if (t.st !== "go") return;
            if (t.L === s && inp.k > t.k) {
              const el2 = now() - origin;
              const maxR = Math.max(0, Math.floor((el2 + 600) / 1300) + 1);
              t.k = inp.k | 0;
              t.T = clamp(Math.round((+inp.T || 0) * 100), 0, 100);
              t.y = clamp(Math.round((+inp.y || 0) * 100), 0, 100);
              t.r = clamp(Math.max(t.r, inp.r | 0), 0, Math.min(maxR, 40));
              if ((inp.a | 0) > t.a) t.a = inp.a | 0;
              const x = X[i];
              x.hist.set(t.k, t.T / 100);
              if (x.hist.size > 40) x.hist.delete(x.hist.keys().next().value);
              if (inp.x && !x.pend) { x.pend = {at: now(), k: t.k}; t.T = 100; }
              dirty = true;
            }
            if (t.S === s && (inp.g | 0) > (lastG[key] || 0)) {
              lastG[key] = inp.g | 0;
              grab(i, inp.k, s);
            }
            if (t.S !== s && t.L !== s && tm[i].includes(s) && (inp.c | 0) > (lastC[key] || 0)) {
              lastC[key] = inp.c | 0; t.c++; dirty = true;
            }
          });
        }
      });
      function tick() {
        if (dead) return;
        const t0 = now();
        if (H.ph === "i") { if (t0 - phT > INTRO_MS) startSet(); else if (dirty) pub(); return; }
        if (H.ph === "s") {
          const c = connSet(), el2 = t0 - origin;
          H.t.forEach((t, i) => {
            if (t.st !== "go") return;
            const x = X[i];
            if (!c.has(keyOf(t.L))) { endSet(i, "ab"); return; }
            if (t.S >= 0 && !c.has(keyOf(t.S))) { t.S = -1; dirty = true; }
            if (x.pend && t0 - x.pend.at > GRACE) { endSet(i, "crush"); return; }
            if (t.S < 0 && el2 > 400) {
              const T = t.T / 100;
              if (!x.pend && T >= x.botTh && T < 1) grab(i, t.k, -1);
            }
            if (el2 > SET_CAP) endSet(i, "ab");
          });
          if (H.t.every(t => t.st !== "go")) { H.ph = "r"; phT = t0; pub(); return; }
          if (dirty || t0 - lastPub >= PUB_MS) pub();
          return;
        }
        if (H.ph === "r") {
          if (t0 - phT > RES_MS) {
            if (H.n >= H.R) finalize(); else startSet();
          } else if (dirty) pub();
        }
      }
      function finalize() {
        H.ph = "f"; phT = now();
        pub();
        if (finished) return;
        finished = true;
        later(() => {
          const ord = H.t.map((t, i) => i).sort((a, b) => H.t[b].tot - H.t[a].tot);
          const ranking = [];
          ord.forEach(i => tm[i].slice().sort((a, b) => H.ip[b] - H.ip[a]).forEach(s => ranking.push(P[s].key)));
          const tn = i => tm[i].map(s => P[s].pseudo).join(" & ");
          const med = tot => { let m = null; MED.forEach((x, i) => { if (tot >= thr(i)) m = x; }); return m; };
          const best = H.t[ord[0]];
          let winners = [], summary;
          const stats = t => `${t.pf} spot${t.pf > 1 ? "s" : ""} parfait${t.pf > 1 ? "s" : ""}, ${t.cr} crêpe${t.cr > 1 ? "s" : ""}`;
          if (tm.length === 1) {
            const m = med(best.tot), ok = best.tot >= thr(1);
            if (ok) winners = tm[0].map(s => P[s].key);
            summary = ok ? `${tn(0)} décrochent l'${m[0] === "or" ? "or" : "argent"} avec ${fmt(best.tot)} pts (${stats(best)}) : objectif atteint !`
              : `${tn(0)} : ${fmt(best.tot)} pts, ${m ? "médaille de bronze" : "pas de médaille"}… l'argent (${fmt(thr(1))}) leur échappe.`;
          } else {
            const top = ord.filter(i => H.t[i].tot === best.tot);
            if (best.tot > 0) top.forEach(i => tm[i].forEach(s => winners.push(P[s].key)));
            summary = top.length > 1 ? `Égalité au sommet à ${fmt(best.tot)} pts : ${top.map(tn).join(" et ")} !`
              : `${tn(ord[0])} gagnent avec ${fmt(best.tot)} pts (${stats(best)}).`;
          }
          api.finish({winners, ranking, summary});
        }, FINAL_MS);
      }
      pub();
      intervals.push(setInterval(tick, 50));
    }

    /* ==================================================================
       TOUS LES TÉLÉPHONES : affichage + jeu local
       ================================================================== */
    let S = null, curN = -1, origin = 0, lastPh = "";
    let myTeam = -1, viewT = 0, viewKey = "", G = null, role = "V";
    const teamOfSeat = s => (S ? S.tm.findIndex(m => m.includes(s)) : -1);
    const teamName = i => (S ? S.tm[i].map(s => pseudo(s)).join(" & ") : "");
    const medOf = tot => { let m = null; MED.forEach((x, i) => { if (tot >= thr(i)) m = x; }); return m; };

    // ----- simulation locale du soulevé -----
    const sim = {on: false, n: -1, ph: "wait", y: 0, T: 0.15, f: 0, r: 0, a: 0, x: 0, k: 0, ev: 0, tPh: 0, y0: 0, taps: [], fin: ""};
    let lastSend = 0, lastSimT = 0, sentPin = false;
    function simReset(n) {
      Object.assign(sim, {on: true, n, ph: "up", y: 0, T: 0.15, f: 0, r: 0, a: 0, x: 0, k: 0, ev: 0, tPh: 0, y0: 0, taps: [], fin: ""});
      lastSend = 0; lastSimT = 0; sentPin = false;
    }
    function simStep(dt, t) {
      const L = 0.3 + 0.08 * sim.r;
      if (sim.ph === "up") {
        while (sim.taps.length && sim.taps[0] < t - 700) sim.taps.shift();
        const rn = Math.min(sim.taps.length / 0.7 / 6.5, 1.15);
        let st = 1 - 0.8 * sim.f;
        if (t > SET_MS) st *= Math.max(0, 1 - (t - SET_MS) / 2500);
        const net = rn * st - L;
        sim.y = clamp(sim.y + (net > 0 ? net * 1.6 : net * 0.45) * dt, 0, 1);
        sim.f = Math.min(1, sim.f + dt * (0.006 + 0.02 * rn * L + (net < 0.15 ? 0.035 : 0)));
        if (net < 0) sim.T += dt * (0.13 + 0.35 * Math.min(-net, 0.6) + (sim.y < 0.03 ? 0.1 : 0));
        else { const tau = clamp(0.58 - net * 0.9, 0.05, 0.58); sim.T += (tau - sim.T) * Math.min(1, dt * 1.2); }
        if (sim.y >= 1) { sim.r++; sim.ph = "down"; sim.tPh = t; onRep(true); }
        else if (sim.T >= 1) { sim.T = 1; sim.ph = "pin"; sim.x = 1; onPin(); }
      } else if (sim.ph === "down") {
        const u = clamp((t - sim.tPh) / 600, 0, 1);
        sim.y = 1 - ease(u);
        sim.T += (0.12 - sim.T) * Math.min(1, dt * 3);
        sim.f = Math.min(1, sim.f + dt * 0.004);
        if (u >= 1) { sim.ph = "up"; sim.y = 0; }
      } else if (sim.ph === "steal") {
        const u = clamp((t - sim.tPh) / 900, 0, 1);
        sim.y = sim.y0 + (1 - sim.y0) * ease(u);
        sim.T += (0.15 - sim.T) * Math.min(1, dt * 3);
        if (u >= 1) { sim.ph = "down"; sim.tPh = t; }
      } else if (sim.ph === "pin") {
        sim.y = Math.max(0, sim.y - dt * 1.5);
      }
    }
    function lifterLoop() {
      if (dead || !S || S.ph !== "s" || role !== "L" || !sim.on || sim.n !== S.n) return;
      const tn = now(), t = tn - origin;
      const tt = S.t[myTeam];
      if (tt && tt.st !== "go") { sim.on = false; return; }
      if (tt && tt.ev > sim.ev) {
        sim.ev = tt.ev;
        if (sim.ph === "up" || sim.ph === "down") { sim.ph = "steal"; sim.tPh = Math.max(0, t); sim.y0 = sim.y; }
      }
      if (t >= 0) {
        const dt = lastSimT ? Math.min(0.1, (tn - lastSimT) / 1000) : 0.033;
        lastSimT = tn;
        simStep(dt, t);
      }
      if (tn - lastSend >= SEND_MS || (sim.x && !sentPin)) {
        lastSend = tn;
        if (sim.x) sentPin = true;
        api.setInput({n: sim.n, k: ++sim.k, T: Math.round(sim.T * 100) / 100, y: Math.round(sim.y * 100) / 100, r: sim.r, a: sim.a, x: sim.x});
      }
    }
    intervals.push(setInterval(lifterLoop, 33));

    // ----- spotteur / coach -----
    let gSeq = 0, cSeq = 0, grabLock = 0, myGrabN = -1;
    let noiseP = [Math.random() * 6, Math.random() * 6];

    /* ---------- scène ---------- */
    let barG, lifArmsP, lifFists, spArmsP, spFists, lifG, fxG, eyesG, plateKg = -1;
    function buildScene() {
      const t = S.t[viewT];
      const L = t.L >= 0 ? t.L : S.tm[viewT][0], Sp = t.S;
      G = geom(L, Sp);
      const skinL = esc(lookOf(L).skin || "#eebe98"), skinS = esc(lookOf(Sp).skin || "#eebe98");
      const spAv = cropAv(avOf(Sp), G.S.vb, G.S.box, G.S.q, "sp-avS");
      const lAv = cropAv(avOf(L), G.L.vb, G.L.box, G.L.q, "sp-avL");
      const hy = G.L.head[1];
      const arms = (n, a, skin) => `<g>${[0, 1].map(() => `<path stroke="#1d1420" stroke-width="${f1(a + 6)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}${[0, 1].map(() => `<path stroke="${skin}" stroke-width="${f1(a)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</g>`;
      sceneG.innerHTML = `
        ${spAv}
        <path d="M${CX - 44} ${f1(hy - 10)}L${CX + 44} ${f1(hy - 10)}L${CX + 74} ${VH}L${CX - 74} ${VH}Z" fill="#b8263a" stroke="#1d1420" stroke-width="3"/>
        <path d="M${CX - 34} ${f1(hy - 4)}L${CX - 56} ${VH}" stroke="#fff" stroke-opacity=".18" stroke-width="5"/>
        ${POST.map((x, i) => `<path d="M${x + (i ? -6 : 6)} ${f1(G.up + 10)}h${i ? -9 : 9}v-13" stroke="#20242a" stroke-width="5" fill="none" stroke-linejoin="round"/>`).join("")}
        <g id="sp-lif" class="sp-lif">${lAv}</g>
        <g id="sp-larms">${arms(2, G.L.arm, skinL)}</g>
        <g id="sp-bar"><g id="sp-barin"></g></g>
        <g id="sp-lfists">${[0, 1].map(() => `<circle r="${f1(G.L.fist)}" fill="${skinL}" stroke="#1d1420" stroke-width="3"/>`).join("")}</g>
        <g id="sp-sarms">${arms(2, G.S.arm, skinS)}</g>
        <g id="sp-sfists">${[0, 1].map(() => `<circle r="${f1(G.S.fist)}" fill="${skinS}" stroke="#1d1420" stroke-width="3"/>`).join("")}</g>
        <g id="sp-fx"></g><g id="sp-eyes"></g>`;
      lifG = $("sp-lif"); barG = $("sp-bar"); fxG = $("sp-fx"); eyesG = $("sp-eyes");
      lifArmsP = [...$("sp-larms").querySelectorAll("path")]; lifFists = [...$("sp-lfists").querySelectorAll("circle")];
      spArmsP = [...$("sp-sarms").querySelectorAll("path")]; spFists = [...$("sp-sfists").querySelectorAll("circle")];
      plateKg = -1;
      // étiquettes de noms
      const meL = L === mySeat, meS = Sp >= 0 && Sp === mySeat;
      tagL.innerHTML = `${esc(pseudo(L).slice(0, 12))}${meL ? "<i>TOI</i>" : ""}`;
      tagL.style.left = (CX / VW * 100) + "%"; tagL.style.top = "auto"; tagL.style.bottom = "2%";
      tagS.innerHTML = `${esc(Sp >= 0 ? pseudo(Sp).slice(0, 12) : "Gégé (robot)")}${meS ? "<i>TOI</i>" : ""}`;
      tagS.style.left = (G.S.head[0] / VW * 100) + "%"; tagS.style.top = ((G.S.head[1] - G.S.hr - 22) / VH * 100) + "%";
      bubS.style.left = "3%"; bubS.style.right = "auto"; bubS.style.top = ((G.S.head[1] - 20) / VH * 100) + "%";
      bubL.style.right = "3%"; bubL.style.left = "auto"; bubL.style.top = ((G.L.head[1] - 34) / VH * 100) + "%";
      squash = 0; eyesG.innerHTML = "";
      lifG.setAttribute("transform", "");
    }
    function drawPlates(kg, fresh) {
      if (kg === plateKg) return;
      plateKg = kg;
      const pl = platesFor(kg);
      let Ls = "", Rs = "", xl = COLLAR[0] - 4, xr = COLLAR[1] + 4;
      pl.forEach((p, i) => {
        const [, c, h, w] = p, cls = fresh && i === pl.length - 1 ? "sp-plate new" : "sp-plate";
        Ls += `<rect class="${cls}" x="${xl - w}" y="${-h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" stroke="#1d1420" stroke-width="2.2"/>`;
        Rs += `<rect class="${cls}" x="${xr}" y="${-h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" stroke="#1d1420" stroke-width="2.2"/>`;
        xl -= w + 1; xr += w + 1;
      });
      $("sp-barin").innerHTML = `<rect x="2" y="-3.5" width="${VW - 4}" height="7" rx="3" fill="url(#sp-barg)" stroke="#1d1420" stroke-width="1.6"/>
        <rect x="${COLLAR[0] - 4}" y="-9" width="8" height="18" rx="2" fill="#7c838d" stroke="#1d1420" stroke-width="2"/><rect x="${COLLAR[1] - 4}" y="-9" width="8" height="18" rx="2" fill="#7c838d" stroke="#1d1420" stroke-width="2"/>${Ls}${Rs}
        <text x="${CX}" y="-8" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="13" fill="#fff" stroke="#1d1420" stroke-width="3" paint-order="stroke">${kg} kg</text>`;
    }
    let squash = 0;
    function placeRig(barY, dx, hands, sq) {
      if (!G) return;
      barG.setAttribute("transform", `translate(${f1(dx)} ${f1(barY)})`);
      const yb = v => VH - (VH - v) * (1 - 0.3 * sq);
      if (sq !== squash) {
        squash = sq;
        lifG.setAttribute("transform", sq ? `translate(${CX} ${VH}) scale(${f1(1 + 0.14 * sq)} ${(1 - 0.3 * sq).toFixed(3)}) translate(${-CX} ${-VH})` : "");
      }
      const ext = clamp((G.down - barY) / (G.down - G.up), 0, 1);
      G.L.sh.forEach((sh, i) => {
        const d = i ? 1 : -1, shy = yb(sh[1]);
        const fx_ = CX + d * G.grip + dx, ex = (sh[0] + fx_) / 2 + d * (1 - ext) * 22, ey = (shy + barY) / 2 + (1 - ext) * 14;
        const dd = `M${f1(sh[0])} ${f1(shy)}L${f1(ex)} ${f1(ey)}L${f1(fx_)} ${f1(barY)}`;
        lifArmsP[i].setAttribute("d", dd); lifArmsP[i + 2].setAttribute("d", dd);
        lifFists[i].setAttribute("cx", f1(fx_)); lifFists[i].setAttribute("cy", f1(barY));
      });
      // spotteur : mains qui « planent » sous la barre, ou qui la tiennent
      const hy = hands === "grab" ? barY : hands === "hover" ? barY + 14 + G.S.fist : G.S.sh[0][1] + 34;
      G.S.sh.forEach((sh, i) => {
        const d = i ? 1 : -1;
        const hx = hands === "rest" ? sh[0] + d * 6 : CX + d * G.hx + dx;
        const ex = (sh[0] + hx) / 2 + d * 16, ey = (sh[1] + hy) / 2 - 2;
        const dd = `M${f1(sh[0])} ${f1(sh[1])}L${f1(ex)} ${f1(ey)}L${f1(hx)} ${f1(hy)}`;
        spArmsP[i].setAttribute("d", dd); spArmsP[i + 2].setAttribute("d", dd);
        spFists[i].setAttribute("cx", f1(hx)); spFists[i].setAttribute("cy", f1(hy));
      });
    }
    function chalk(barY) {
      if (RM || !fxG) return;
      let s = "";
      for (const d of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 16;
        s += `<circle class="sp-puff" cx="${f1(CX + d * G.grip)}" cy="${f1(barY + 3)}" r="${f1(2.5 + Math.random() * 3)}" fill="#fff" fill-opacity=".85" style="--dx:${f1(Math.cos(a) * r)}px;--dy:${f1(Math.sin(a) * r - 8)}px"/>`;
      }
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = s; fxG.appendChild(g);
      later(() => g.remove(), 850);
    }
    function sweat() {
      if (RM || !fxG || !G) return;
      const d = Math.random() < 0.5 ? -1 : 1;
      const x = G.L.head[0] + d * G.L.hr * (0.6 + Math.random() * 0.4), y = G.L.head[1] - G.L.hr * 0.4;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = `<path class="sp-drop" style="--dx:${f1(d * (8 + Math.random() * 14))}px" d="M${f1(x)} ${f1(y - 6)}q5 7 0 10q-5-3 0-10z" fill="#8fd3ff" stroke="#1d1420" stroke-width="1.4"/>`;
      fxG.appendChild(g);
      later(() => g.remove(), 950);
    }
    function crushFx() {
      if (!G || !eyesG) return;
      const hx = G.L.head[0], hy = VH - (VH - G.L.head[1]) * 0.7, r = G.L.hr;
      const eye = d => `<g><path d="M${f1(hx + d * r * 0.38)} ${f1(hy)}l${f1(d * 4)} -14" stroke="#1d1420" stroke-width="2.5"/><circle cx="${f1(hx + d * (r * 0.38 + 5))}" cy="${f1(hy - 20)}" r="10" fill="#fff" stroke="#1d1420" stroke-width="2.5"/><circle cx="${f1(hx + d * (r * 0.38 + 7))}" cy="${f1(hy - 19)}" r="3.6" fill="#1d1420"/></g>`;
      const star = (a) => `<text x="${f1(Math.cos(a) * r * 1.3)}" y="${f1(Math.sin(a) * r * 0.45 + 4)}" text-anchor="middle" font-size="15" fill="#ffd84a" stroke="#1d1420" stroke-width="1.2">★</text>`;
      eyesG.innerHTML = `<g class="sp-eyes">${eye(-1)}${eye(1)}</g><g transform="translate(${f1(hx)} ${f1(hy - r - 14)})"><g class="sp-stars">${[0, 2.1, 4.2].map(star).join("")}</g></g>`;
    }

    /* ---------- overlays ---------- */
    function floatAt(txt, cls, xPct, yPct) {
      if (RM && cls !== "y") return;
      const d = document.createElement("div");
      d.className = "sp-float " + (cls || "");
      d.textContent = txt;
      d.style.left = xPct + "%"; d.style.top = yPct + "%";
      ov.appendChild(d);
      later(() => d.remove(), 1050);
    }
    let stampEl = null;
    function stamp(big, sub, cls) {
      if (stampEl) stampEl.remove();
      const d = document.createElement("div");
      d.className = "sp-stamp " + cls;
      d.innerHTML = `<b>${esc(big)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}`;
      ov.appendChild(d); stampEl = d;
    }
    const clearStamp = () => { if (stampEl) { stampEl.remove(); stampEl = null; } };
    const bubT = {S: 0, L: 0};
    function bubble(who, txt, cls, ms) {
      const b = who === "S" ? bubS : bubL;
      b.textContent = txt;
      b.className = "sp-bub " + (who === "S" ? "l" : "r") + " on " + (cls || "");
      bubT[who] = now() + (ms || 1800);
    }
    function setBanner(h, p) {
      ban.querySelector("h3").textContent = h;
      const pe = ban.querySelector("p");
      pe.textContent = p || ""; pe.style.display = p ? "" : "none";
      ban.classList.add("on");
    }
    const hideBanner = () => ban.classList.remove("on");
    function shakeStage() {
      if (RM) return;
      stage.classList.remove("sp-shake"); void stage.offsetWidth; stage.classList.add("sp-shake");
    }

    /* ---------- panneau selon le rôle ---------- */
    let fbEl = null, gaugeNdl = null, gaugeFog = null, gaugeQ = null, alertEl = null, roleInfo = null, panelKey = "";
    function gaugeHtml(fuzzy) {
      return `<div class="sp-gauge" aria-hidden="true">
          <span class="zl z0">${fuzzy ? "TROP TÔT" : "ÇA VA"}</span><span class="zl z1">${fuzzy ? "BON SPOT" : "ÇA TIRE"}</span><span class="zl z2">PARFAIT</span>
          ${fuzzy ? `<i class="fog" id="sp-fog"></i><b class="q" id="sp-q">?</b>` : `<i class="ndl" id="sp-ndl"></i>`}
        </div>
        <div class="sp-glab"><span>${fuzzy ? "DANGER (APPROXIMATIF !)" : "TA TENSION (EXACTE)"}</span><span>${fuzzy ? "écoute ton soulevé" : "crie quand c'est le moment"}</span></div>`;
    }
    function buildPanel() {
      const t = S.t[viewT];
      const key = [S.ph, S.n, role, viewT, t.L, t.S].join("|");
      if (key === panelKey) return;
      panelKey = key;
      fbEl = gaugeNdl = gaugeFog = gaugeQ = alertEl = roleInfo = null;
      if (S.ph === "f") { panel.innerHTML = podiumHtml(); return; }
      if (S.ph === "r") { panel.innerHTML = recapHtml(); return; }
      if (S.ph === "i") { panel.innerHTML = introHtml(); return; }
      if (role === "L") {
        panel.innerHTML = `<div class="sp-role"><b>Tu soulèves</b><span id="sp-ri"></span></div>
          ${gaugeHtml(false)}
          <div class="sp-fb" id="sp-fb" aria-live="polite"></div>
          <div class="sp-row">
            <button type="button" class="sp-btn sp-push" id="sp-push" aria-label="Pousser la barre (tape vite)"><b>POUSSE !</b><small>tape vite, tape fort</small></button>
            <button type="button" class="sp-btn sp-aide" id="sp-aide" aria-label="Appeler à l'aide"><b>AIDE&nbsp;!</b><small>${esc(t.S >= 0 ? pseudo(t.S).slice(0, 10) : "Gégé")}</small></button>
          </div>
          <div class="sp-hint">+10 kg à chaque rep. Quand ça casse, crie « MAINTENANT ! » à ${esc(t.S >= 0 ? pseudo(t.S) : "Gégé le robot")}.</div>
          <div class="sp-key">Ordinateur : Espace = pousser · A = aide</div>`;
        $("sp-push").addEventListener("pointerdown", onPush);
        $("sp-aide").addEventListener("pointerdown", onAide);
      } else if (role === "S") {
        panel.innerHTML = `<div class="sp-role"><b>Tu pares ${esc(pseudo(t.L).slice(0, 12))}</b><span id="sp-ri"></span></div>
          ${gaugeHtml(true)}
          <div class="sp-fb" id="sp-fb" aria-live="polite"></div>
          <div class="sp-row">
            <button type="button" class="sp-btn sp-grab" id="sp-grab" aria-label="Attraper la barre"><b>J'ATTRAPE !</b><small>au bon moment…</small><span class="sp-alert" id="sp-alert">AIDE !</span></button>
          </div>
          <div class="sp-hint">Trop tôt : rep volée (−${PEN}). Zone orange : sauvé (+${B_OK}). Zone rouge : SPOT PARFAIT (+${B_PERF}). Trop tard : crêpe (kilos ÷ 2).</div>
          <div class="sp-key">Ordinateur : Espace = attraper</div>`;
        $("sp-grab").addEventListener("pointerdown", onGrab);
      } else {
        const coach = role === "C";
        panel.innerHTML = `<div class="sp-role"><b>${coach ? "Tu coaches" : "Tu regardes"}</b><span id="sp-ri"></span></div>
          ${gaugeHtml(true)}
          <div class="sp-fb" id="sp-fb" aria-live="polite"></div>
          ${coach ? `<div class="sp-row"><button type="button" class="sp-btn sp-cheer" id="sp-cheer" aria-label="Encourager"><b>ALLEZ !</b><small>hurle avec eux</small></button></div>
          <div class="sp-hint">Ton équipe joue à deux cette série : aide le spotteur à sentir le bon moment !</div>`
          : `<div class="sp-card"><h4>En direct</h4>${S.tm.map((m, i) => `<div class="sp-line" style="--c:${TCOL[i % 4]}"><i class="d"></i><span class="t">${esc(teamName(i))}<small id="sp-ls${i}"></small></span><span class="v" id="sp-lv${i}"></span></div>`).join("")}</div>`}`;
        const cb = $("sp-cheer");
        if (cb) cb.addEventListener("pointerdown", onCheer);
      }
      fbEl = $("sp-fb"); gaugeNdl = $("sp-ndl"); gaugeFog = $("sp-fog"); gaugeQ = $("sp-q"); alertEl = $("sp-alert"); roleInfo = $("sp-ri");
    }
    function feedback(txt, cls) { if (fbEl) { fbEl.textContent = txt; fbEl.className = "sp-fb " + (cls || ""); } }
    function introHtml() {
      const coop = S.tm.length === 1;
      return `<div class="sp-card"><h4>${coop ? "Mission coopérative" : "Les duos"}</h4>
        ${S.tm.map((m, i) => `<div class="sp-line" style="--c:${TCOL[i % 4]}"><i class="d"></i><span class="t">${esc(teamName(i))}${i === myTeam ? " <b>(toi)</b>" : ""}<small>Série 1 : ${esc(pseudo(m[0]))} soulève, ${esc(pseudo(m[1]))} pare</small></span></div>`).join("")}
        <div class="sp-line"><span class="t">Le soulevé tape pour pousser (+10 kg par rep). Le spotteur attrape la barre quand ça casse : ni trop tôt, ni trop tard !<small>${coop ? `Objectif : médaille d'argent (${fmt(thr(1))} pts) en ${S.R} séries.` : `${S.R} séries, les rôles tournent. Meilleur score total = victoire.`}</small></span></div></div>`;
    }
    const stTxt = t => (t.st === "save2" ? "SPOT PARFAIT" : t.st === "save1" ? "Bon spot" : t.st === "crush" ? "Écrasé !" : t.st === "ab" ? "Abandon" : t.st === "x" ? "Forfait" : t.st === "go" ? `${t.r} rep${t.r > 1 ? "s" : ""}…` : "");
    function recapHtml() {
      const nxt = S.n < S.R;
      return `<div class="sp-card"><h4>Série ${S.n}/${S.R} : bilan</h4>
        ${S.t.map((t, i) => `<div class="sp-line" style="--c:${TCOL[i % 4]}"><i class="d"></i><span class="t">${esc(teamName(i))}<small>${t.L >= 0 ? `${esc(pseudo(t.L))} : ${t.r} rep${t.r > 1 ? "s" : ""} · ${stTxt(t)}${t.sl ? ` · ${t.sl} rep${t.sl > 1 ? "s" : ""} volée${t.sl > 1 ? "s" : ""} en tout` : ""}` : "Forfait"}</small></span><span class="v">+${fmt(t.sc)}</span></div>`).join("")}
        <div class="sp-line"><span class="t">${nxt ? "Prochaine série : on échange les rôles !" : "Dernière série terminée…"}</span></div></div>`;
    }
    function podiumHtml() {
      const ord = S.t.map((t, i) => i).sort((a, b) => S.t[b].tot - S.t[a].tot);
      const coop = S.tm.length === 1;
      const col = (i, place) => {
        const t = S.t[i], m = medOf(t.tot), win = coop ? t.tot >= thr(1) : t.tot === S.t[ord[0]].tot && t.tot > 0;
        const avs = S.tm[i].map(s => api.avatar(P[s].key, {pose: win ? "flex" : "idle", view: "bust"})).join("");
        const h = coop ? 78 : [96, 72, 54, 40][place] || 40;
        return `<div class="sp-pcol" style="--c:${TCOL[i % 4]}"><div class="sp-pav${S.tm[i].length === 1 ? " one" : ""}">${avs}</div>
          <div class="sp-pnm">${esc(teamName(i))}</div><span class="sp-med ${m ? m[0] : "rien"}">${m ? m[1] : "—"}</span>
          <div class="sp-step" style="height:${h}px"><b>${coop ? fmt(t.tot) : place + 1}</b><small>${coop ? "pts" : fmt(t.tot) + " pts"}</small></div></div>`;
      };
      const show = coop ? [0] : ord.length >= 3 ? [ord[1], ord[0], ord[2]] : ord.slice();
      const rest = coop ? [] : ord.slice(3);
      let goalTxt = "";
      if (coop) { const ok = S.t[0].tot >= thr(1); goalTxt = ok ? "OBJECTIF ATTEINT : bravo le duo !" : `Objectif raté : il fallait ${fmt(thr(1))} pts pour l'argent.`; }
      return `<div class="sp-card"><h4>Podium final</h4>
        <div class="sp-pod">${show.map(i => col(i, ord.indexOf(i))).join("")}</div>
        ${rest.map(i => `<div class="sp-line" style="--c:${TCOL[i % 4]}"><i class="d"></i><span class="t">${ord.indexOf(i) + 1}. ${esc(teamName(i))}</span><span class="v">${fmt(S.t[i].tot)}</span></div>`).join("")}
        ${goalTxt ? `<div class="sp-line"><span class="t"><b>${esc(goalTxt)}</b></span></div>` : ""}
        <div class="sp-line"><span class="t"><small>Médailles : bronze ${fmt(thr(0))} · argent ${fmt(thr(1))} · or ${fmt(thr(2))} pts</small></span></div></div>`;
    }
    function boardHtml() {
      if (!S || S.tm.length < 2) { boardEl.hidden = true; return; }
      boardEl.hidden = false;
      boardEl.style.setProperty("--n", Math.min(4, S.tm.length));
      boardEl.innerHTML = S.tm.map((m, i) => `<button type="button" class="sp-chip${i === myTeam ? " mine" : ""}${i === viewT ? " view" : ""}" data-i="${i}" style="--c:${TCOL[i % 4]}">
        <span class="nm">${esc(teamName(i))}</span><span class="pt" id="sp-cp${i}">0 <small>pts</small></span><span class="stt" id="sp-cs${i}"></span></button>`).join("");
    }
    boardEl.addEventListener("click", e => {
      const b = e.target.closest(".sp-chip");
      if (!b || myTeam >= 0) return;
      viewT = +b.dataset.i;
      boardEl.querySelectorAll(".sp-chip").forEach(c => c.classList.toggle("view", +c.dataset.i === viewT));
      viewKey = ""; panelKey = "";
      if (S) render(S, true);
    });

    /* ---------- actions ---------- */
    let hitT = 0;
    function press(btn) {
      if (!btn) return;
      btn.classList.add("hit");
      clearTimeout(hitT); hitT = setTimeout(() => btn && btn.classList.remove("hit"), 80);
    }
    function pushTap() {
      audioOn();
      press($("sp-push"));
      if (role !== "L" || !S || S.ph !== "s") return;
      const t = now() - origin;
      if (t < 0) { feedback("ATTENDS LE TOP…", "o"); return; }
      if (!sim.on) return;
      sim.taps.push(t);
      sfx.tap();
    }
    function onPush(e) { if (e.button != null && e.button > 0) return; e.preventDefault(); pushTap(); }
    function aide() {
      audioOn();
      press($("sp-aide"));
      if (role !== "L" || !sim.on || now() < origin) return;
      sim.a++;
      bubble("L", "AIDE !!!", "hot", 1400);
      sfx.aide();
    }
    function onAide(e) { if (e.button != null && e.button > 0) return; e.preventDefault(); aide(); }
    function grabNow() {
      audioOn();
      press($("sp-grab"));
      if (role !== "S" || !S || S.ph !== "s") return;
      const t = S.t[myTeam];
      if (!t || t.st !== "go") return;
      if (now() < origin) { feedback("PAS ENCORE, IL N'A RIEN TOUCHÉ !", "o"); return; }
      if (now() < grabLock) { feedback("JE TOUCHE PAS, JE TOUCHE PAS…", "o"); return; }
      const T = t.T / 100;
      gSeq++;
      api.setInput({n: S.n, g: gSeq, k: t.k});
      sfx.grab();
      if (T >= 1) { feedback("TROP TARD !", "r"); grabLock = now() + 5000; return; }
      if (T < Z_OK) { feedback("TROP TÔT ! « Tu m'as volé ma rep ! »", "r"); grabLock = now() + STEAL_CD + 300; return; }
      feedback(T >= Z_PERF ? "SPOT PARFAIT !" : "SAUVÉ !", T >= Z_PERF ? "y" : "g");
      grabLock = now() + 5000; myGrabN = S.n;
    }
    function onGrab(e) { if (e.button != null && e.button > 0) return; e.preventDefault(); grabNow(); }
    function cheerNow() {
      audioOn();
      press($("sp-cheer"));
      if (role !== "C" || !S || S.ph !== "s") return;
      cSeq++;
      api.setInput({n: S.n, c: cSeq});
      sfx.cheer();
      floatAt("ALLEZ !", "y", 20 + Math.random() * 60, 40 + Math.random() * 20);
    }
    function onCheer(e) { if (e.button != null && e.button > 0) return; e.preventDefault(); cheerNow(); }
    function onKey(e) {
      const tg = e.target;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (role === "L") pushTap();
        else if (!e.repeat) { if (role === "S") grabNow(); else if (role === "C") cheerNow(); }
      } else if ((e.key === "a" || e.key === "A") && !e.repeat && role === "L") aide();
    }
    window.addEventListener("keydown", onKey);

    /* ---------- réception de l'état ---------- */
    const seen = {};   // par équipe : st, ev, r, a, c déjà affichés
    function onRep(local) {
      if (!G) return;
      const yb = G.down - (G.down - G.up);
      chalk(yb);
      floatAt("+10 kg", "y", 50, (yb / VH) * 100 - 14);
      sfx.rep();
      if (local) feedback(pick(["REP !", "ET UNE !", "PROPRE !", "ÇA MONTE !"]), "g");
    }
    function onPin() { feedback("JE… VAIS… MOURIR…", "r"); bubble("L", "AIIIDE !", "hot", 2500); }
    function render(s, force) {
      S = s;
      RR = s.R || 4;
      if (s.ph === "s" && s.n !== curN) {
        curN = s.n; origin = now() - s.e;
        for (const k in seen) delete seen[k];
        grabLock = 0; clearStamp();
        noiseP = [Math.random() * 6, Math.random() * 6];
      } else if (s.ph === "s") origin = Math.min(origin, now() - s.e);
      myTeam = mySeat >= 0 ? s.tm.findIndex(m => m.includes(mySeat)) : -1;
      if (myTeam >= 0) viewT = myTeam;
      viewT = clamp(viewT, 0, s.tm.length - 1);
      const t = s.t[viewT];
      // rôle
      role = "V";
      if (myTeam >= 0) {
        const mt = s.t[myTeam];
        role = mt.L === mySeat ? "L" : mt.S === mySeat ? "S" : "C";
        if (s.ph === "i") role = s.tm[myTeam][0] === mySeat ? "L" : s.tm[myTeam][1] === mySeat ? "S" : "C";
      }
      if (role === "L" && s.ph === "s" && sim.n !== s.n && s.t[myTeam].st === "go") simReset(s.n);
      // en-tête
      rndEl.textContent = s.ph === "i" ? "ÉCHAUFFEMENT" : s.ph === "f" ? "FINI" : `SÉRIE ${s.n}/${s.R}`;
      const coop = s.tm.length === 1;
      if (coop) {
        const tot = s.t[0].tot, m = medOf(tot);
        goalEl.innerHTML = `ARGENT : <b>${fmt(tot)}</b>/${fmt(thr(1))}${m ? ` · <span style="color:${m[0] === "or" ? "#ffd84a" : m[0] === "argent" ? "#e6ecf2" : "#f0b27a"}">${m[1]}</span>` : ""}`;
      } else {
        const mt = myTeam >= 0 ? s.t[myTeam] : null;
        goalEl.innerHTML = mt ? `${s.tm[myTeam].length > 2 ? "Ton trio" : "Ton duo"} : <b>${fmt(mt.tot)}</b> pts` : `Spectateur · ${s.tm.length} équipes`;
      }
      if (boardEl.children.length !== (s.tm.length >= 2 ? s.tm.length : 0)) boardHtml();
      s.t.forEach((tt, i) => {
        const cp = $("sp-cp" + i), cs = $("sp-cs" + i);
        if (cp) cp.innerHTML = `${fmt(tt.tot)} <small>pts</small>`;
        if (cs) cs.textContent = s.ph === "s" ? stTxt(tt) : s.ph === "r" ? `+${fmt(tt.sc)}` : "";
        const ls = $("sp-ls" + i), lv = $("sp-lv" + i);
        if (ls) ls.textContent = `${tt.L >= 0 ? pseudo(tt.L) + " soulève" : ""} · ${stTxt(tt)}`;
        if (lv) lv.textContent = fmt(tt.tot);
      });
      // scène
      const vk = [viewT, t.L, t.S, s.n].join("|");
      if (vk !== viewKey || force) {
        viewKey = vk;
        buildScene();
        dispY = 0; dispT = 0.15; mode = "go"; modeT = now(); seenSt = t.st;
        if (t.st !== "go" && t.st !== "w" && s.ph !== "i") { mode = t.st === "crush" ? "crush" : t.st.startsWith("save") ? "save" : "idle"; modeT = now() - 2000; if (mode === "crush") crushFx(); }
      }
      buildPanel();
      // phases
      if (s.ph !== lastPh) {
        lastPh = s.ph;
        if (s.ph === "i") setBanner("Le Spotteur", coop ? `Mission : la médaille d'argent (${fmt(thr(1))} pts) !` : "Un soulève, l'autre pare. Parlez-vous !");
        else if (s.ph === "s") { hideBanner(); feedback("", ""); }
        else if (s.ph === "r") {
          const nn = s.n;
          later(() => { if (S && S.ph === "r" && S.n === nn) { clearStamp(); setBanner(`Série ${nn} terminée`, nn < S.R ? "On échange les rôles !" : "Et c'est la fin…"); } }, 2300);
        }
        else if (s.ph === "f") {
          clearStamp();
          if (coop) { const ok = s.t[0].tot >= thr(1); setBanner(ok ? "OBJECTIF ATTEINT !" : "Raté de peu…", `${fmt(s.t[0].tot)} pts`); if (ok) sfx.perfect(); }
          else { const best = Math.max(...s.t.map(x => x.tot)); const w = s.t.findIndex(x => x.tot === best); setBanner(myTeam >= 0 && s.t[myTeam].tot === best ? "VICTOIRE !" : "Fin de l'entraînement", `${teamName(w)} : ${fmt(best)} pts`); if (myTeam >= 0 && s.t[myTeam].tot === best) sfx.perfect(); }
        }
      }
      // événements de l'équipe affichée
      if (s.ph === "s" || s.ph === "r") events(s);
    }
    let seenSt = "";
    function events(s) {
      const t = s.t[viewT], sv = seen[viewT] || (seen[viewT] = {ev: 0, r: 0, a: 0, c: 0, st: "go"});
      const amL = role === "L", amS = role === "S";
      if (t.ev > sv.ev) {
        sv.ev = t.ev;
        mode = "steal"; modeT = now();
        bubble("L", pick(STEAL_TXT), "hot", 2200);
        bubble("S", "Oups… pardon !", "", 1600);
        floatAt(`−${PEN}`, "r", 30, 30);
        sfx.steal();
        if (amL) { feedback("REP VOLÉE ! Elle ne compte pas.", "r"); buzz(120); }
        else if (amS) feedback("TROP TÔT ! Rep volée (−" + PEN + ")", "r");
      }
      if (!amL && t.r > sv.r && t.st === "go") onRep(false);
      sv.r = Math.max(sv.r, t.r);
      if (t.a > sv.a) {
        sv.a = t.a;
        if (!amL) bubble("L", "AIDE !!!", "hot", 1400);
        if (amS) { if (alertEl) { alertEl.classList.remove("on"); void alertEl.offsetWidth; alertEl.classList.add("on"); } sfx.aide(); buzz([80, 40, 80]); }
      }
      if (t.c > sv.c) { sv.c = t.c; if (role !== "C") floatAt("ALLEZ !", "y", 15 + Math.random() * 70, 40 + Math.random() * 25); }
      if (t.st !== sv.st) {
        const was = sv.st;
        sv.st = t.st;
        if (was === "go") verdictFx(t);
      }
    }
    function verdictFx(t) {
      const amL = role === "L", amS = role === "S";
      const pts = `+${fmt(t.sc)} pts · ${t.r} rep${t.r > 1 ? "s" : ""}`;
      if (t.st === "save2" || t.st === "save1") {
        const perf = t.st === "save2";
        mode = "save"; modeT = now();
        stamp(perf ? "SPOT PARFAIT" : "BON SPOT", pts, perf ? "y" : "g");
        bubble("S", perf ? "JE L'AI ! PILE POIL !" : "JE L'AI !", "gold", 2600);
        bubble("L", perf ? "MON HÉROS !" : "Ouf… merci !", "", 2600);
        perf ? sfx.perfect() : sfx.ok();
        if (amL || amS) feedback(perf ? `SPOT PARFAIT ! +${B_PERF}` : `BON SPOT ! +${B_OK}`, perf ? "y" : "g");
        if (perf) floatAt(`+${B_PERF}`, "y", 50, 30);
      } else if (t.st === "crush") {
        mode = "crush"; modeT = now();
        stamp(pick(CRUSH_TXT), `kilos ÷ 2 · +${fmt(t.sc)} pts`, "r");
        bubble("S", "OUPS…", "", 2600);
        bubble("L", "Mmmmpf !!", "hot", 2600);
        sfx.crush(); shakeStage(); crushFx();
        if (amL) { feedback("ÉCRASÉ ! (kilos ÷ 2)", "r"); buzz(300); }
        else if (amS) feedback("TROP TARD ! Il est tout plat…", "r");
      } else if (t.st === "ab") {
        mode = "idle"; modeT = now();
        stamp("ABANDON", `série arrêtée · ${pts}`, "o");
      }
      if (myTeam >= 0 && viewT === myTeam && role !== "V") later(() => { if (S && S.ph === "s" && S.t[myTeam].st !== "go") feedback(`${S.t.some(x => x.st === "go") ? "Les autres soulèvent encore…" : ""}`, "o"); }, 2600);
    }
    api.onState(s => render(s, false));

    /* ---------- animation ---------- */
    let dispY = 0, dispT = 0.15, mode = "go", modeT = 0, lastFrame = now(), nextSweat = 0, nextTalk = 0, shownCd = "", lastLifTxt = "";
    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const tn = now(), dt = Math.min(0.1, (tn - lastFrame) / 1000);
      lastFrame = tn;
      if (!S || !G) return;
      const t = S.t[viewT];
      const local = role === "L" && viewT === myTeam && sim.n === S.n && S.ph === "s";
      let y, T;
      if (local) { y = sim.y; T = sim.T; dispY = y; dispT = T; }
      else {
        dispY += (t.y / 100 - dispY) * Math.min(1, dt * 9);
        dispT += (t.T / 100 - dispT) * Math.min(1, dt * 7);
        y = dispY; T = dispT;
      }
      const e = tn - origin;
      // compte à rebours
      let cd = "";
      if (S.ph === "s" && t.st === "go") {
        if (e < 0) cd = String(Math.ceil(-e / 1000));
        else if (e < 700) cd = role === "S" ? "PARE !" : "POUSSE !";
      }
      if (cd !== shownCd) {
        shownCd = cd; bigEl.textContent = cd;
        if (cd) sfx.beep(cd.length > 1);
      }
      // horloge de la série
      if (S.ph === "s") {
        const left = Math.ceil(Math.max(0, SET_MS - Math.max(0, e)) / 1000);
        const txt = e < 0 ? "" : left > 0 ? left + " s" : "À FOND";
        if (clockEl.textContent !== txt) { clockEl.textContent = txt; clockEl.classList.toggle("low", left <= 5); }
      } else if (clockEl.textContent) clockEl.textContent = "";
      // barre
      const kgNow = W0 + DW * (local ? sim.r : t.r);
      drawPlates(Math.min(kgNow, 300), true);
      let barY = G.down - (G.down - G.up) * clamp(y, 0, 1), hands = S.ph === "s" && t.st === "go" ? "hover" : "rest", sq = 0;
      const mt = tn - modeT;
      if (mode === "save") { const u = clamp(mt / 900, 0, 1); barY = barY + (G.up - 6 - barY) * ease(u); hands = "grab"; }
      else if (mode === "crush") { const u = clamp(mt / 220, 0, 1); barY = G.down + (VH - (VH - G.down) * 0.7 + 6 - G.down) * u; sq = u; hands = "rest"; }
      else if (mode === "steal") { hands = mt < 900 ? "grab" : "hover"; if (mt >= 900) mode = "go"; }
      if (S.ph !== "s" && mode !== "crush" && mode !== "save") { barY = G.up - 6; hands = "rest"; }
      if (mode === "save" && mt > 900) barY = G.up - 6;
      const live = S.ph === "s" && t.st === "go" && e >= 0;
      const amp = RM || !live ? 0 : 4.5 * clamp((T - 0.35) / 0.65, 0, 1) + (local ? 1.2 * sim.f : 0);
      const dx = amp ? amp * Math.sin(tn / 1000 * 38) * (0.6 + 0.4 * Math.sin(tn / 1000 * 7.3)) : 0;
      const dy = amp ? amp * 0.4 * Math.sin(tn / 1000 * 29) : 0;
      placeRig(barY + dy, dx, hands, mode === "crush" ? sq : 0);
      // sueur
      if (live && T > 0.45 && tn > nextSweat) { nextSweat = tn + 650 - 450 * clamp((T - 0.45) / 0.55, 0, 1); sweat(); }
      // bulles
      if (bubT.S && tn > bubT.S) { bubT.S = 0; bubS.classList.remove("on"); }
      if (bubT.L && tn > bubT.L) { bubT.L = 0; bubL.classList.remove("on"); }
      if (live && tn > nextTalk && !bubT.S) { nextTalk = tn + 2600 + Math.random() * 1500; bubble("S", T > 0.7 ? pick(["PAS DE PANIQUE !", "JE SUIS LÀ !", "C'EST TOUT TOI !"]) : pick(SPOT_TALK), "", 1700); }
      if (live && !bubT.L) {
        const lt = T >= 0.98 ? "AAARGH !" : T > 0.8 ? "Ça… casse…" : T > 0.6 ? "Hnnnngh…" : T > 0.35 ? "Ça tire…" : "";
        if (lt !== lastLifTxt) { lastLifTxt = lt; if (lt) { bubL.textContent = lt; bubL.className = "sp-bub r on" + (T > 0.8 ? " hot" : ""); } else bubL.classList.remove("on"); }
      } else lastLifTxt = "~";
      // jauges
      if (gaugeNdl) gaugeNdl.style.left = (clamp(T, 0, 1) * 100).toFixed(1) + "%";
      if (gaugeFog) {
        const ph = tn / 1000;
        const nz = 0.1 * (0.6 * Math.sin(ph * 1.9 + noiseP[0]) + 0.4 * Math.sin(ph * 4.7 + noiseP[1]));
        const v = live ? clamp(T + nz, 0, 1.02) : t.st === "crush" ? 1 : clamp(T, 0, 1);
        gaugeFog.style.left = (v * 100).toFixed(1) + "%";
        if (gaugeQ) gaugeQ.style.left = (v * 100).toFixed(1) + "%";
      }
      if (roleInfo && S.ph === "s") {
        const txt = `${kgNow} kg · ${local ? sim.r : t.r} rep${(local ? sim.r : t.r) > 1 ? "s" : ""}`;
        if (roleInfo.textContent !== txt) roleInfo.textContent = txt;
      }
      // bouton du soulevé grisé hors série
      const pb = $("sp-push");
      if (pb) pb.classList.toggle("off", !(live && local && sim.on));
      const gb = $("sp-grab");
      if (gb) gb.classList.toggle("off", !(live && role === "S" && tn >= grabLock));
    }
    raf = requestAnimationFrame(frame);
    root.spDebug = () => ({role, myTeam, viewT, ph: S && S.ph, n: S && S.n, sim: {ph: sim.ph, y: sim.y, T: sim.T, f: sim.f, r: sim.r, on: sim.on}, team: S && S.t[viewT], tot: S && S.t.map(t => t.tot), e: now() - origin});

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
