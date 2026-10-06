/* Gonflette Party : Bras de fer (2 joueurs, chacun sur son téléphone, spectateurs possibles).
   Manches au meilleur des 3 : « 3, 2, 1, FORCE ! » puis chacun martèle son gros bouton (ou Espace).
   Chaque téléphone envoie son total de coups de la manche ({r, n}, ~15 envois/s max) ; l'hôte en déduit
   une cadence (plafonnée à ~14 coups/s), fait pencher le bras avec de l'inertie et publie ~20 états/s. */
GONFLETTE.registerGame({
  id: "brasdefer",
  name: "Bras de fer",
  min: 2,
  max: 2,
  create(api) {
    "use strict";
    const el = api.el;
    const P = api.players;
    const mySeat = api.isPlayer ? P.findIndex(p => p.key === api.me) : -1;
    const isPl = mySeat === 0 || mySeat === 1;
    const SEAT = mySeat === 1 ? [1, 0] : [0, 1];        // côté écran (0 = gauche) -> place ; je suis toujours à gauche
    const AVM = (window.GONFLETTE && window.GONFLETTE.avatar) || null;
    const muscleOf = xp => (AVM && AVM.muscle ? AVM.muscle(xp) : Math.min(1.35, Math.max(0, +xp || 0) / 1500));
    const MULT = P.map(p => 1 + Math.min(Math.max(+p.xp || 0, 0), 2000) / 8000);
    const name = s => (P[s] ? P[s].pseudo || api.name(P[s].key) : "?");
    const esc = t => String(t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const fmt = (x, d = 1) => (+x || 0).toFixed(d).replace(".", ",");
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
    const f1 = n => Math.round(n * 10) / 10;

    // ---------- réglages ----------
    const CAP = 14;            // coups/s maximum crédités (anti-triche)
    const BURST = 3;           // petite réserve pour absorber la gigue réseau
    const WIN = 800;           // fenêtre de calcul de la cadence (ms)
    const GAIN = 6;            // unités d'angle par seconde, par coup/s d'écart (angle de -100 à 100)
    const INERTIA = 2.6;       // plus c'est petit, plus le bras est lourd
    const PUSH = 20;           // gros coup de rein : 20 unités gagnées en 0,8 s -> l'autre a +10 % pendant 1 s
    const CD_MS = 800, ROUND_PAUSE = 2700, FINISH_MS = 2500, PUB_MS = 50, SEND_MS = 66;
    const CHEERS = ["ALLEZ !", "IL CRAQUE !", "TIENS BON !", "SECOND SOUFFLE !", "RETOURNEMENT !", "POUSSE !", "ÇA CHAUFFE !", "QUELLE BÊTE !", "ENCORE !"];
    const RANDOM_CHEERS = [0, 2, 5, 6, 7, 8];

    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };

    let RM = false, mq = null;
    const onMq = () => { RM = !!(mq && mq.matches); };
    try {
      mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches;
      if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    } catch (e) { mq = null; }

    // ---------- géométrie de la scène (viewBox 400 x 330) ----------
    const PIV = [200, 226], RAD = 104, TMAX = 1.45;
    const SH = [[114, 158], [286, 158]], ELB = [[160, 222], [240, 222]];
    const INK = "#1d1420";
    function geo(side) {
      const seat = SEAT[side], p = P[seat] || {};
      const m = muscleOf(p.xp), mc = Math.min(m, 1);
      const K = 1.1 - 0.25 * Math.min(m, 1.35) / 1.35;   // pixels de scène par unité d'avatar (les crevettes sont zoomées)
      // mêmes proportions que core/avatar.js, pour poser l'épaule de l'avatar sur celle du bras dessiné
      const headR = 25 - 6 * mc - 2 * Math.max(0, m - 1), yS = 100 + 2 * m, headY = 50 + 12 * m;
      const SW = 19 + 50 * m, UA = 7 + 28 * m, FA = 6 + 19 * m;
      const hw = Math.max(SW + UA + 10, 62), top = headY - headR - 18, S = 2 * hw * K;
      const dir = side === 0 ? 1 : -1, [sx, sy] = SH[side];
      const cx = sx - dir * (SW - 5) * K;
      const bx = cx - S / 2, by = sy - (yS + 12 - top) * K;
      const ua = (UA + 6) * K;
      // on masque le bras intérieur de l'avatar (remplacé par le bras dessiné)
      const yc = (sy - by - ua * 0.45) / S * 100;
      const xc = (sx - bx - dir * ua * 0.25) / S * 100;
      const clip = side === 0
        ? `polygon(0 0,100% 0,100% ${yc}%,${xc}% ${yc}%,${xc}% 100%,0 100%)`
        : `polygon(0 0,100% 0,100% 100%,${xc}% 100%,${xc}% ${yc}%,0 ${yc}%)`;
      return {seat, m, S, bx, by, dir, clip, head: {x: cx, y: by + (headY - top) * K, r: headR * K},
        ua, fe: (FA + 12) * K, fw: (FA + 5) * K * 0.8, fr: (8 + 6 * m) * K * 1.3 + 2,
        skin: (p.look && p.look.skin) || "#eebe98"};
    }
    const G = [geo(0), geo(1)];
    const pct = (v, tot) => (v / tot * 100).toFixed(3) + "%";
    const shade = (hex, k) => {
      const n = parseInt(String(hex).slice(1), 16);
      if (!isFinite(n)) return hex;
      return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
    };

    // ---------- décor : public ----------
    let seedv = 7;
    const rnd = () => { seedv = (seedv * 9301 + 49297) % 233280; return seedv / 233280; };
    let crowd = "";
    const CROWD_COL = ["#3b2550", "#4a2b5e", "#2d1d40", "#57306a", "#352247"];
    for (let row = 0; row < 3; row++) {
      const y = 92 + row * 26, n = 11 + row;
      for (let i = 0; i < n; i++) {
        const x = (i + (row % 2) * 0.5) * (400 / (n - 0.5)) + (rnd() - 0.5) * 8 - 8;
        const r = 9 + rnd() * 3 + row * 1.5, c = CROWD_COL[(i + row * 2) % CROWD_COL.length];
        crowd += `<g class="bf-fan" style="animation-delay:${(-rnd() * 0.6).toFixed(2)}s"><path d="M${f1(x - r * 1.9)} ${f1(y + r * 3.2)}q0 ${f1(-r * 2.2)} ${f1(r * 1.9)} ${f1(-r * 2.2)}t${f1(r * 1.9)} ${f1(r * 2.2)}z" fill="${c}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${c}"/>${rnd() < 0.35 ? `<path d="M${f1(x + r * 1.2)} ${f1(y + r * 1.4)}l${f1(r * 0.9)} ${f1(-r * 2.6)}" stroke="${c}" stroke-width="${f1(r * 0.7)}" stroke-linecap="round"/>` : ""}</g>`;
      }
    }
    const bgSvg = `<svg class="bf-bg" viewBox="0 0 400 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="bf-spot" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff6c8" stop-opacity=".32"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="330" fill="#1a0f26"/>
      <rect y="0" width="400" height="80" fill="#24143a"/>
      <path d="M150 0h100l110 330H40z" fill="url(#bf-spot)"/>
      <g class="bf-crowd" id="bf-crowd">${crowd}</g>
    </svg>`;

    // ---------- table + bras (dessinés une fois, mis à jour à chaque image) ----------
    const tableSvg = `
      <defs><linearGradient id="bf-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a36"/><stop offset="1" stop-color="#0d0714"/></linearGradient></defs>
      <rect x="-20" y="236" width="440" height="110" fill="url(#bf-floor)"/>
      <ellipse cx="200" cy="318" rx="150" ry="9" fill="#000" opacity=".35"/>
      <path d="M34 236 L366 236 L366 264 L34 264Z" fill="#6b3d1c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M44 264h20v66h-20zM336 264h20v66h-20z" fill="#4e2a12" stroke="${INK}" stroke-width="4"/>
      <path d="M62 212 L338 212 L366 236 L34 236Z" fill="#c98b4a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M70 218 L330 218" stroke="#e7b072" stroke-width="3" opacity=".7"/>
      <path d="M40 248h320" stroke="#4e2a12" stroke-width="2" opacity=".6"/>
      <ellipse cx="79" cy="226" rx="26" ry="7" fill="#d23b3b" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="321" cy="226" rx="26" ry="7" fill="#d23b3b" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="160" cy="226" rx="20" ry="5.5" fill="#2a2140" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="240" cy="226" rx="20" ry="5.5" fill="#2a2140" stroke="${INK}" stroke-width="2.5"/>
      <rect x="168" y="242" width="64" height="16" rx="3" fill="#ffcc33" stroke="${INK}" stroke-width="2.5"/>
      <text x="200" y="254.5" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="11" fill="${INK}" letter-spacing=".5">GONFLETTE</text>`;
    const armSvg = side => {
      const g = G[side], sk = g.skin;
      return `<g id="bf-arm${side}">
        <path class="bf-uo" stroke="${INK}" stroke-width="${f1(g.ua + 5)}" stroke-linecap="round" fill="none"/>
        <circle class="bf-bo" fill="${INK}"/>
        <path class="bf-ui" stroke="${sk}" stroke-width="${f1(g.ua)}" stroke-linecap="round" fill="none"/>
        <circle class="bf-bi" fill="${sk}"/>
        <circle class="bf-el" r="${f1(g.fe * 0.55)}" fill="${sk}" stroke="${INK}" stroke-width="3.5"/>
        <path class="bf-fa" fill="${sk}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <path class="bf-sh" fill="none" stroke="${shade(sk, 0.82)}" stroke-width="2.4" stroke-linecap="round"/>
        <path class="bf-vn" fill="none" stroke="#6d8fd0" stroke-width="2.4" stroke-linecap="round"/>
      </g>`;
    };
    const fistSvg = side => {
      const g = G[side];
      return `<g id="bf-fist${side}"><circle class="bf-fo" r="${f1(g.fr)}" fill="${g.skin}" stroke="${INK}" stroke-width="3.5"/><path class="bf-kn" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></g>`;
    };
    const faceSvg = side => `<g id="bf-face${side}"><circle class="bf-flush" fill="#ff2a2a"/><g class="bf-angry" stroke="#e0201a" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M-7 -2q5 0 5 -5M2 -7q0 5 5 5M7 2q-5 0 -5 5M-2 7q0 -5 -5 -5"/></g></g>`;

    const avHtml = side => {
      const g = G[side];
      return `<div class="bf-av" id="bf-av${side}" style="left:${pct(g.bx, 400)};top:${pct(g.by, 330)};width:${pct(g.S, 400)};height:${pct(g.S, 330)};clip-path:${g.clip};-webkit-clip-path:${g.clip}">${api.avatar(P[g.seat].key, {view: "bust", pose: "idle"})}</div>`;
    };

    const nmL = name(SEAT[0]), nmR = name(SEAT[1]);
    el.innerHTML = `<style>
      .bf{--bf-ink:#1d1420;--bf-gold:#ffcc33;--bf-red:#ff3d3d;--bf-blue:#4fc3ff;height:100%;min-height:540px;box-sizing:border-box;display:flex;justify-content:center;background:radial-gradient(120% 70% at 50% 15%,#3a1f4a,#120a1c 72%);color:#f3ece0;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
      .bf *{box-sizing:border-box}
      .bf-col{width:min(100%,520px);height:100%;display:flex;flex-direction:column;gap:8px;padding:8px 12px calc(12px + env(safe-area-inset-bottom,0px))}
      .bf-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;flex:none}
      .bf-pl{min-width:0;display:flex;flex-direction:column;gap:3px}
      .bf-pl.bf-r{align-items:flex-end;text-align:right}
      .bf-pl b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.25rem;line-height:1;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .bf-pl.bf-l b{color:var(--bf-gold)}.bf-pl.bf-r b{color:var(--bf-blue)}
      .bf-pl small{font-weight:800;font-size:.72rem;letter-spacing:.12em;opacity:.7}
      .bf-dots{display:flex;gap:5px}
      .bf-dots i{width:14px;height:14px;border-radius:50%;border:2px solid #ffffff55;background:#ffffff10;transition:background .3s,transform .3s}
      .bf-l .bf-dots i.on{background:var(--bf-gold);border-color:#fff;transform:scale(1.15)}
      .bf-r .bf-dots i.on{background:var(--bf-blue);border-color:#fff;transform:scale(1.15)}
      .bf-mid{display:flex;flex-direction:column;align-items:center;gap:2px}
      .bf-rnd{font-family:Anton,Impact,sans-serif;font-size:1rem;letter-spacing:.06em;background:#ffffff14;border:2px solid #ffffff2a;border-radius:999px;padding:1px 10px;white-space:nowrap}
      .bf-mute{border:0;background:none;color:#f3ece0;opacity:.7;font-weight:800;font-size:.75rem;letter-spacing:.08em;cursor:pointer;padding:2px 6px}
      .bf-stage{position:relative;width:100%;aspect-ratio:400/330;flex:none;border-radius:16px;overflow:hidden;border:3px solid var(--bf-ink);box-shadow:0 8px 24px rgba(0,0,0,.5);background:#1a0f26}
      .bf-shake{position:absolute;inset:0;will-change:transform}
      .bf-bg,.bf-fg{position:absolute;inset:0;width:100%;height:100%;display:block}
      .bf-av{position:absolute}
      .bf-av .av{width:100%;height:100%;display:block;overflow:visible}
      .bf-neon{position:absolute;left:50%;top:3%;transform:translateX(-50%) rotate(-3deg);font-family:Pacifico,"Brush Script MT",cursive;font-size:clamp(.9rem,5vw,1.5rem);color:#fff;white-space:nowrap;text-shadow:0 0 5px #ff2e88,0 0 12px #ff2e88,0 0 24px #ff2e88;pointer-events:none}
      .bf-fan{animation:bf-bob 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
      .bf-crowd.bf-jump .bf-fan{animation:bf-jump .45s ease-out 2}
      @keyframes bf-bob{50%{transform:translateY(1.5px)}}
      @keyframes bf-jump{40%{transform:translateY(-7px)}}
      .bf-stage.bf-slow .bf-shake{filter:saturate(.55) contrast(1.15)}
      .bf-bars::before,.bf-bars::after{content:"";position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s;z-index:5}
      .bf-bars::before{top:0}.bf-bars::after{bottom:0}
      .bf-stage.bf-slow.bf-bars::before,.bf-stage.bf-slow.bf-bars::after{height:9%}
      .bf-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4}
      .bf-flash.go{animation:bf-flash .5s ease-out}
      @keyframes bf-flash{0%{opacity:.85}100%{opacity:0}}
      .bf-cheers{position:absolute;inset:0;pointer-events:none;z-index:6}
      .bf-ch{position:absolute;font-family:Anton,Impact,sans-serif;font-size:clamp(1.2rem,7vw,2rem);color:#fff;-webkit-text-stroke:1.5px var(--bf-ink);text-shadow:3px 3px 0 var(--bf-red);white-space:nowrap;animation:bf-pop 1.2s cubic-bezier(.2,1.4,.4,1) forwards}
      .bf-ch.bf-big{font-size:clamp(1.5rem,9vw,2.6rem);color:var(--bf-gold)}
      @keyframes bf-pop{0%{opacity:0;transform:translate(-50%,10px) scale(.3) rotate(var(--bf-rot,0deg))}18%{opacity:1;transform:translate(-50%,0) scale(1.15) rotate(var(--bf-rot,0deg))}75%{opacity:1;transform:translate(-50%,-10px) scale(1) rotate(var(--bf-rot,0deg))}100%{opacity:0;transform:translate(-50%,-22px) scale(.95) rotate(var(--bf-rot,0deg))}}
      .bf-cd{position:absolute;left:0;right:0;top:30%;text-align:center;font-family:Anton,Impact,sans-serif;font-size:clamp(3.6rem,22vw,6.5rem);line-height:1;color:var(--bf-gold);-webkit-text-stroke:3px var(--bf-ink);text-shadow:5px 5px 0 var(--bf-red);pointer-events:none;z-index:7;opacity:0}
      .bf-cd.go{animation:bf-cd .8s ease-out forwards}
      .bf-cd.bf-force{color:#fff;text-shadow:5px 5px 0 var(--bf-red),0 0 30px #ff7a2e}
      @keyframes bf-cd{0%{opacity:0;transform:scale(2.2)}20%{opacity:1;transform:scale(1)}80%{opacity:1;transform:scale(.96)}100%{opacity:0;transform:scale(.9)}}
      .bf-ban{position:absolute;left:4%;right:4%;top:16%;text-align:center;pointer-events:none;z-index:7;opacity:0;transform:scale(.6);transition:opacity .25s,transform .35s cubic-bezier(.2,1.5,.4,1)}
      .bf-ban.on{opacity:1;transform:none}
      .bf-ban h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.6rem,9vw,2.6rem);line-height:1;text-transform:uppercase;color:var(--bf-gold);-webkit-text-stroke:2px var(--bf-ink);text-shadow:4px 4px 0 var(--bf-red)}
      .bf-ban p{display:inline-block;margin:6px 0 0;background:var(--bf-ink);color:#fff;font-weight:800;font-size:1.05rem;padding:2px 12px;border-radius:999px}
      .bf-wait{position:absolute;left:0;right:0;bottom:6%;text-align:center;font-weight:800;font-size:1.05rem;z-index:6;text-shadow:0 2px 4px #000}
      .bf-meter{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;flex:none}
      .bf-rate{display:flex;flex-direction:column;align-items:center;min-width:58px;line-height:1}
      .bf-rate b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem}
      .bf-rl b{color:var(--bf-gold)}.bf-rr b{color:var(--bf-blue)}
      .bf-rate small{font-size:.7rem;font-weight:800;letter-spacing:.06em;opacity:.75}
      .bf-rate .bf-mu{font-size:.66rem;letter-spacing:.02em;opacity:.55;margin-top:1px;white-space:nowrap}
      .bf-boost{font-size:.7rem;font-weight:900;background:#ff7a2e;color:var(--bf-ink);border-radius:999px;padding:1px 6px;margin-top:2px;visibility:hidden}
      .bf-boost.on{visibility:visible;animation:bf-blink .25s steps(2) infinite}
      @keyframes bf-blink{50%{opacity:.55}}
      .bf-bar{position:relative;height:22px;border-radius:999px;background:#ffffff14;border:2px solid #ffffff30;overflow:hidden}
      .bf-bar::after{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:#fff8}
      .bf-fill{position:absolute;top:0;bottom:0;left:50%;width:0}
      .bf-mark{position:absolute;top:50%;left:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;border:3px solid var(--bf-ink)}
      .bf-note{position:relative;flex:none;display:flex;justify-content:center}
      .bf-info{display:inline-flex;align-items:center;gap:6px;border:2px dashed #ffffff40;background:#ffffff0c;color:#f3ece0;border-radius:999px;padding:2px 10px 2px 3px;font:inherit;font-weight:700;font-size:.92rem;cursor:pointer;max-width:100%}
      .bf-info i{flex:none;width:18px;height:18px;border-radius:50%;background:var(--bf-gold);color:var(--bf-ink);font-style:normal;font-weight:900;font-size:.8rem;display:grid;place-items:center;font-family:Georgia,serif}
      .bf-info span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bf-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:min(320px,94vw);background:#fff7e0;color:var(--bf-ink);border:3px solid var(--bf-ink);border-radius:12px;padding:8px 10px;font-weight:600;font-size:.92rem;line-height:1.25;z-index:20;box-shadow:0 6px 0 var(--bf-ink)}
      .bf-tip b{font-weight:800}
      .bf-act{flex:1 1 auto;min-height:118px;display:flex;flex-direction:column;gap:4px}
      .bf-btn{flex:1;min-height:110px;max-height:330px;width:100%;border:4px solid var(--bf-ink);border-radius:28px;background:radial-gradient(circle at 50% 30%,#ff8a6a,#e8261e 55%,#8a0d0d);color:#fff;font-family:Anton,Impact,sans-serif;font-size:clamp(2.2rem,13vw,3.8rem);letter-spacing:.03em;line-height:1;text-shadow:3px 3px 0 var(--bf-ink);box-shadow:0 9px 0 var(--bf-ink),inset 0 -10px 0 rgba(0,0,0,.18),inset 0 8px 0 rgba(255,255,255,.25);cursor:pointer;touch-action:none;transition:transform .05s,box-shadow .05s,filter .2s;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;outline-offset:4px}
      .bf-btn small{font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:1rem;letter-spacing:.1em;text-shadow:none;opacity:.9}
      .bf-btn.bf-hit{transform:translateY(7px) scale(.985);box-shadow:0 2px 0 var(--bf-ink),inset 0 -6px 0 rgba(0,0,0,.18),inset 0 8px 0 rgba(255,255,255,.25)}
      .bf-btn.bf-off{filter:grayscale(.75) brightness(.75)}
      .bf-btn.bf-live{animation:bf-throb .5s ease-in-out infinite alternate}
      @keyframes bf-throb{to{filter:brightness(1.12)}}
      .bf-btn.bf-nope{animation:bf-nope .3s}
      @keyframes bf-nope{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      .bf-key{text-align:center;font-size:.8rem;font-weight:700;opacity:.6}
      .bf-spec{flex:1;display:grid;place-items:center;text-align:center;border:3px dashed #ffffff30;border-radius:22px;padding:12px;font-weight:700;font-size:1.15rem}
      .bf-spec b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.8rem;color:var(--bf-gold);letter-spacing:.03em}
      @media (max-height:640px){.bf-col{gap:5px}.bf-note{display:none}}
      @media (prefers-reduced-motion:reduce){.bf-fan,.bf-crowd.bf-jump .bf-fan,.bf-btn.bf-live,.bf-btn.bf-nope,.bf-boost.on{animation:none}.bf-ch{animation:bf-fade 1.2s forwards}.bf-cd.go{animation:bf-fade2 .8s forwards}.bf-ban{transition:opacity .2s;transform:none}.bf-flash.go{animation:none}}
      @keyframes bf-fade{0%,80%{opacity:1;transform:translateX(-50%)}100%{opacity:0;transform:translateX(-50%)}}
      @keyframes bf-fade2{0%,80%{opacity:1}100%{opacity:0}}
    </style>
    <div class="bf" id="bf-root"><div class="bf-col">
      <div class="bf-head">
        <div class="bf-pl bf-l"><b>${esc(nmL)}</b><small>${isPl ? "TOI" : "&nbsp;"}</small><span class="bf-dots" id="bf-dl"><i></i><i></i></span></div>
        <div class="bf-mid"><span class="bf-rnd" id="bf-rnd">MANCHE 1</span><button type="button" class="bf-mute" id="bf-mute" aria-pressed="false">SON : OUI</button></div>
        <div class="bf-pl bf-r"><b>${esc(nmR)}</b><small>&nbsp;</small><span class="bf-dots" id="bf-dr"><i></i><i></i></span></div>
      </div>
      <div class="bf-stage bf-bars" id="bf-stage">
        <div class="bf-shake" id="bf-shake">
          ${bgSvg}
          <div class="bf-neon">Bras de fer</div>
          ${avHtml(0)}${avHtml(1)}
          <svg class="bf-fg" viewBox="0 0 400 330" aria-hidden="true">
            ${tableSvg}
            ${armSvg(1)}${armSvg(0)}${fistSvg(1)}${fistSvg(0)}
            ${faceSvg(0)}${faceSvg(1)}
            <g id="bf-drops"></g>
          </svg>
        </div>
        <div class="bf-flash" id="bf-flash"></div>
        <div class="bf-cheers" id="bf-cheers"></div>
        <div class="bf-cd" id="bf-cd" aria-live="assertive"></div>
        <div class="bf-ban" id="bf-ban" role="status" aria-live="polite"><h3></h3><p></p></div>
        <div class="bf-wait" id="bf-wait">On s'installe à la table…</div>
      </div>
      <div class="bf-meter">
        <div class="bf-rate bf-rl"><b id="bf-rtl">0</b><small>COUPS/S</small><small class="bf-mu">force ×${fmt(MULT[SEAT[0]], 2)}</small><span class="bf-boost" id="bf-bol">+10 %</span></div>
        <div class="bf-bar" aria-hidden="true"><i class="bf-fill" id="bf-fill"></i><i class="bf-mark" id="bf-mark"></i></div>
        <div class="bf-rate bf-rr"><b id="bf-rtr">0</b><small>COUPS/S</small><small class="bf-mu">force ×${fmt(MULT[SEAT[1]], 2)}</small><span class="bf-boost" id="bf-bor">+10 %</span></div>
      </div>
      <div class="bf-note">
        <button type="button" class="bf-info" id="bf-info" aria-expanded="false" aria-describedby="bf-tip"><i>i</i><span>Les muscles comptent un peu !</span></button>
        <div class="bf-tip" id="bf-tip" role="tooltip" hidden>Plus on a d'XP, plus on pousse fort : force × (1 + XP / 8000), plafonné à 2000 XP.<br><b>${esc(nmL)}</b> ×${fmt(MULT[SEAT[0]], 3)} · <b>${esc(nmR)}</b> ×${fmt(MULT[SEAT[1]], 3)}<br>Celui qui vient de se faire enfoncer gagne +10 % pendant 1 s : rien n'est jamais perdu !</div>
      </div>
      <div class="bf-act">${isPl
        ? `<button type="button" class="bf-btn bf-off" id="bf-btn"><span id="bf-btxt">PRÊT…</span><small id="bf-bsub">attends le top départ</small></button><div class="bf-key">Sur ordinateur : barre Espace</div>`
        : `<div class="bf-spec"><div><b>SPECTATEUR</b>Encourage-les, ça va craquer !</div></div>`}</div>
    </div></div>`;

    const $ = id => el.querySelector("#" + id);
    const root = $("bf-root"), stage = $("bf-stage"), shakeEl = $("bf-shake"), cheersEl = $("bf-cheers"), cdEl = $("bf-cd"), banEl = $("bf-ban"), waitEl = $("bf-wait");
    const btn = $("bf-btn"), btxt = $("bf-btxt"), bsub = $("bf-bsub"), flashEl = $("bf-flash"), crowdEl = $("bf-crowd");
    const avEl = [$("bf-av0"), $("bf-av1")];
    const fillEl = $("bf-fill"), markEl = $("bf-mark"), rtEl = [$("bf-rtl"), $("bf-rtr")], boEl = [$("bf-bol"), $("bf-bor")];
    const dotsEl = [[...$("bf-dl").children], [...$("bf-dr").children]];
    const ARM = [0, 1].map(s => {
      const g = $("bf-arm" + s), q = c => g.querySelector("." + c);
      const fg = $("bf-fist" + s), face = $("bf-face" + s);
      return {uo: q("bf-uo"), ui: q("bf-ui"), bo: q("bf-bo"), bi: q("bf-bi"), el: q("bf-el"), fa: q("bf-fa"), sh: q("bf-sh"), vn: q("bf-vn"),
        fist: fg, kn: fg.querySelector(".bf-kn"), flush: face.querySelector(".bf-flush"), angry: face.querySelector(".bf-angry")};
    });
    const dropsG = $("bf-drops");
    for (let s = 0; s < 2; s++) {
      const h = G[s].head;
      ARM[s].flush.setAttribute("cx", f1(h.x)); ARM[s].flush.setAttribute("cy", f1(h.y + h.r * 0.15)); ARM[s].flush.setAttribute("r", f1(h.r * 0.95));
      ARM[s].flush.setAttribute("opacity", "0"); ARM[s].flush.style.mixBlendMode = "multiply";
      ARM[s].angry.setAttribute("opacity", "0");
    }

    // ---------- son (WebAudio, uniquement après un geste) ----------
    let ac = null, muted = false, noiseBuf = null, lastTapSnd = 0;
    function unlockAudio() {
      if (muted || dead) return;
      try {
        if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
        if (ac && ac.state === "suspended") ac.resume().catch(() => {});
      } catch (e) { ac = null; }
    }
    function tone(f, dur, type, vol, f2, delay) {
      if (!ac || muted) return;
      try {
        const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* rien */ }
    }
    function noise(dur, vol, freq, q, attack) {
      if (!ac || muted) return;
      try {
        if (!noiseBuf) {
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t = ac.currentTime, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noiseBuf; src.loop = true; fl.type = "bandpass"; fl.frequency.value = freq || 1000; fl.Q.value = q || 0.8;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(ac.destination); src.start(t); src.stop(t + dur + 0.05);
      } catch (e) { /* rien */ }
    }
    const sndTap = () => { const t = performance.now(); if (t - lastTapSnd < 45) return; lastTapSnd = t; tone(150 + Math.random() * 40, 0.07, "triangle", 0.09, 70); };
    const sndBeep = hi => tone(hi ? 880 : 440, hi ? 0.45 : 0.18, "square", 0.06);
    const sndCheer = big => noise(big ? 1.4 : 0.8, big ? 0.22 : 0.1, 900, 0.5, big ? 0.15 : 0.25);
    const sndSlam = big => { noise(0.35, 0.5, 160, 0.7); tone(90, big ? 0.6 : 0.35, "sine", 0.5, 35); if (big) later(() => sndCheer(true), 120); };

    // ---------- logique de l'hôte ----------
    let hostTimer = 0;
    if (api.isHost) {
      const t0 = performance.now();
      const H = {ph: "w", r: 1, a: 0, v: 0, sc: [0, 0], cd: 3, w: -1, bo: -1, ch: [0, 0, -1], ff: 0, mw: -1};
      let phT = t0, fT = t0, lastT = t0, lastPub = 0, lastConn = 0, boUntil = 0, boCool = 0, lastCheerT = 0, nextCheer = 0, finished = false;
      let inputs = {}, lastN = [0, 0], bucket = [BURST, BURST], refT = [t0, t0], taps = [[], []], rt = [0, 0], hist = [];
      let crack = [false, false], down = [false, false], wph = 0, missingSince = 0;
      const seen = [false, false];

      const publish = () => api.setState({ph: H.ph, r: H.r, a: f1(H.a), sc: H.sc.slice(), rt: rt.map(f1), cd: H.cd, w: H.w, bo: H.bo, ch: H.ch.slice(), ff: H.ff, mw: H.mw});
      const cheer = (idx, seat, force) => {
        const now = performance.now();
        if (!force && now - lastCheerT < 650) return;
        lastCheerT = now; H.ch = [H.ch[0] + 1, idx, seat];
      };
      const conSeats = () => {
        let con = null;
        try { con = api.connected(); } catch (e) { con = null; }
        return con ? [0, 1].filter(s => con.includes(P[s].key)) : null;
      };
      const startCountdown = now => {
        H.ph = "c"; H.cd = 3; H.w = -1; H.a = 0; H.v = 0; H.bo = -1; rt = [0, 0]; phT = now;
      };
      const startFight = now => {
        H.ph = "f"; H.cd = 0; phT = now; fT = now;
        lastN = [0, 0]; bucket = [BURST, BURST]; refT = [now, now]; taps = [[], []]; rt = [0, 0]; hist = [];
        boUntil = 0; boCool = now + 1500; crack = [false, false]; down = [false, false]; wph = Math.random() * 6;
        nextCheer = now + 1500 + Math.random() * 1200;
        ingest(now);
      };
      const endMatch = (w, ff) => {
        if (H.ph === "o") return;
        H.ph = "o"; H.mw = w; H.ff = ff ? 1 : 0; if (ff) H.w = -1; H.bo = -1; phT = performance.now();
        publish();
        if (finished) return;
        finished = true;
        const l = 1 - w;
        later(() => api.finish({
          winners: [P[w].key], ranking: [P[w].key, P[l].key],
          summary: ff ? `${name(w)} gagne par forfait (${H.sc[w]} à ${H.sc[l]})` : `${name(w)} gagne 2 manches à ${H.sc[l]}`
        }), ff ? 2200 : FINISH_MS);
      };
      function ingest(now) {
        if (H.ph !== "f") return;
        for (let s = 0; s < 2; s++) {
          const inp = inputs[P[s].key];
          if (!inp || typeof inp !== "object" || inp.r !== H.r) continue;
          const n = Math.floor(+inp.n);
          if (!isFinite(n)) continue;
          const d = n - lastN[s];
          if (d <= 0) continue;
          lastN[s] = n;
          bucket[s] = Math.min(BURST, bucket[s] + (now - refT[s]) * CAP / 1000); refT[s] = now;
          const ok = Math.min(d, Math.floor(bucket[s]));          // le surplus (au-delà de ~14/s) est jeté
          if (ok > 0) { bucket[s] -= ok; taps[s].push([now, ok]); }
        }
      }
      api.onInputs(map => { inputs = map || {}; ingest(performance.now()); });

      function checkForfeit(now) {
        if (H.ph === "o") return;
        const here = conSeats();
        if (!here) return;
        here.forEach(s => { seen[s] = true; });
        if (here.length !== 1) { missingSince = 0; return; }
        const gone = 1 - here[0];
        if (!missingSince) missingSince = now;
        // un joueur déjà vu qui disparaît : forfait ; un joueur jamais arrivé : on patiente 10 s
        if (seen[gone] ? now - missingSince > 700 : now - missingSince > 10000) {
          api.toast(`${name(gone)} a quitté la table : victoire par forfait !`);
          endMatch(here[0], true);
        }
      }

      function physics(now, dt) {
        for (let s = 0; s < 2; s++) {
          const q = taps[s];
          while (q.length && now - q[0][0] > WIN) q.shift();
          let sum = 0; for (const e of q) sum += e[1];
          rt[s] = Math.min(CAP, sum / (WIN / 1000));
        }
        if (H.bo >= 0 && now >= boUntil) H.bo = -1;
        const F = [0, 1].map(s => rt[s] * MULT[s] * (H.bo === s ? 1.1 : 1));
        const tf = (now - fT) / 1000;
        const esc2 = 1 + Math.max(0, tf - 15) / 6;                     // au bout de 15 s, ça s'emballe
        let tgt = (F[0] - F[1]) * GAIN * esc2 + (Math.sin(tf * 2.1 + wph) + Math.sin(tf * 3.4 + wph * 2)) * 1.3;
        if (tf > 25) tgt += (H.a >= 0 ? 1 : -1) * (tf - 25) * 8;        // match nul impossible
        H.v += (tgt - H.v) * Math.min(1, dt * INERTIA);
        H.a = clamp(H.a + H.v * dt, -100, 100);

        // remontada : celui qui vient de perdre beaucoup de terrain a +10 % pendant 1 s
        hist.push([now, H.a]);
        while (hist.length && now - hist[0][0] > 800) hist.shift();
        if (now > boCool && hist.length > 8) {
          const d = H.a - hist[0][1];
          if (Math.abs(d) >= PUSH && Math.abs(H.a) < 92) {
            const s = d > 0 ? 1 : 0;
            H.bo = s; boUntil = now + 1000; boCool = now + 2600;
            cheer(3, s, true);
          }
        }
        // cris du public
        for (let s = 0; s < 2; s++) {
          const lose = s === 0 ? -H.a : H.a;                            // > 0 : la place s perd du terrain
          if (lose >= 65 && !crack[s]) { crack[s] = true; cheer(1, s, true); }
          if (lose < 45) crack[s] = false;
          if (lose >= 40) down[s] = true;
          if (down[s] && lose <= -5) { down[s] = false; cheer(4, s, true); }
        }
        if (now > nextCheer) {
          nextCheer = now + 1900 + Math.random() * 1700;
          const lead = Math.abs(H.a) > 15 ? (H.a > 0 ? 1 : 0) : -1;     // on encourage celui qui souffre
          cheer(RANDOM_CHEERS[Math.floor(Math.random() * RANDOM_CHEERS.length)], lead);
        }
        if (Math.abs(H.a) >= 100) {
          const w = H.a > 0 ? 0 : 1;
          H.a = w === 0 ? 100 : -100; H.v = 0; H.sc[w]++; H.w = w; H.bo = -1;
          if (H.sc[w] >= 2) endMatch(w, false);
          else { H.ph = "r"; phT = now; }
        }
      }

      function hostLoop() {
        if (dead) return;
        const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
        lastT = now;
        if (now - lastConn > 300) { lastConn = now; checkForfeit(now); }
        if (H.ph === "w") {
          const here = conSeats();
          if (here && here.length === 2 && now - phT > 1400) startCountdown(now);
        } else if (H.ph === "c") {
          const c = 3 - Math.floor((now - phT) / CD_MS);
          if (c <= 0) startFight(now); else H.cd = c;
        } else if (H.ph === "f") {
          physics(now, dt);
        } else if (H.ph === "r") {
          if (now - phT > ROUND_PAUSE) { H.r++; startCountdown(now); }
        }
        if (now - lastPub >= PUB_MS - 3) { lastPub = now; publish(); }
      }
      publish();
      hostTimer = setInterval(hostLoop, 20);
    }

    // ---------- entrées du joueur ----------
    let S = null, myR = 0, myN = 0, sentKey = "", lastSend = 0, sendTimer = 0, hitUntil = 0;
    function doSend() {
      sendTimer = 0;
      if (dead) return;
      const k = myR + ":" + myN;
      if (k === sentKey) return;
      sentKey = k; lastSend = performance.now();
      api.setInput({r: myR, n: myN});
    }
    function queueSend() {
      if (sendTimer) return;
      const wait = SEND_MS - (performance.now() - lastSend);
      if (wait <= 0) doSend();
      else { sendTimer = later(doSend, wait); }
    }
    let kick = 0;
    function tap() {
      if (!isPl || dead) return;
      if (!S || S.ph !== "f") {
        if (S && S.ph === "c" && btn) { btn.classList.remove("bf-nope"); void btn.offsetWidth; btn.classList.add("bf-nope"); }
        return;
      }
      if (myR !== S.r) { myR = S.r; myN = 0; }
      myN++;
      hitUntil = performance.now() + 70;
      kick = 1;
      sndTap();
      queueSend();
    }
    const onBtnDown = e => { e.preventDefault(); unlockAudio(); tap(); };
    const onKey = e => {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (e.repeat) return;
      unlockAudio(); tap();
    };
    const onRootDown = () => unlockAudio();
    if (btn) {
      btn.addEventListener("pointerdown", onBtnDown);
      btn.addEventListener("contextmenu", e => e.preventDefault());
    }
    root.addEventListener("pointerdown", onRootDown);
    window.addEventListener("keydown", onKey);
    const muteBtn = $("bf-mute");
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      muteBtn.textContent = muted ? "SON : NON" : "SON : OUI";
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    });
    const infoBtn = $("bf-info"), tipEl = $("bf-tip");
    let tipTimer = 0;
    const toggleTip = show => {
      tipEl.hidden = !show; infoBtn.setAttribute("aria-expanded", show ? "true" : "false");
      if (tipTimer) { clearTimeout(tipTimer); timers.delete(tipTimer); tipTimer = 0; }
      if (show) tipTimer = later(() => { tipTimer = 0; toggleTip(false); }, 5000);
    };
    infoBtn.addEventListener("click", () => toggleTip(tipEl.hidden));

    // ---------- affichage ----------
    const sideOfSeat = seat => (seat === SEAT[0] ? 0 : 1);
    let da = 0, slam = null, shakeAmp = 0, zoom = 1, slowUntil = 0, cdHideAt = 0, lastCheerId = null, lastCdKey = "", banShown = "";
    const strain = [0, 0];
    function showCd(txt, force) {
      cdEl.textContent = txt;
      cdEl.classList.toggle("bf-force", !!force);
      cdEl.classList.remove("go"); void cdEl.offsetWidth; cdEl.classList.add("go");
    }
    function spawnCheer(txt, side, big, top) {
      const d = document.createElement("div");
      d.className = "bf-ch" + (big ? " bf-big" : "");
      d.textContent = txt;
      const x = side === 0 ? 22 + Math.random() * 14 : side === 1 ? 64 + Math.random() * 14 : 40 + Math.random() * 20;
      d.style.left = x + "%";
      d.style.top = (top != null ? top : 6 + Math.random() * 24) + "%";
      d.style.setProperty("--bf-rot", ((Math.random() - 0.5) * 16).toFixed(1) + "deg");
      cheersEl.appendChild(d);
      while (cheersEl.children.length > 4) cheersEl.firstChild.remove();
      later(() => d.remove(), 1300);
      if (!RM && crowdEl) { crowdEl.classList.remove("bf-jump"); void crowdEl.getBoundingClientRect(); crowdEl.classList.add("bf-jump"); }
    }
    function showBanner(title, sub) {
      const key = title + "|" + sub;
      if (banShown === key) return;
      banShown = key;
      banEl.querySelector("h3").textContent = title;
      banEl.querySelector("p").textContent = sub;
      banEl.querySelector("p").style.display = sub ? "" : "none";
      banEl.classList.add("on");
    }
    function hideBanner() { banShown = ""; banEl.classList.remove("on"); }
    const winTitle = seat => (isPl && seat === mySeat ? "TU GAGNES" : name(seat) + " GAGNE");
    function impact(final) {
      if (!RM) shakeAmp = final ? 13 : 6;
      flashEl.classList.remove("go"); void flashEl.offsetWidth; if (!RM) flashEl.classList.add("go");
      sndSlam(final);
      spawnCheer(final ? "BAM !" : "PAF !", -1, true, 50);
      if (navigator.vibrate && isPl) { try { navigator.vibrate(final ? [60, 40, 120] : 50); } catch (e) { /* rien */ } }
      if (S) roundBanner(S);
      if (final) slowUntil = performance.now() + 700;
    }
    function roundBanner(s) {
      if (s.ph === "o") {
        if (s.ff) showBanner(winTitle(s.mw) + " !", "Victoire par forfait");
        else showBanner(winTitle(s.mw) + " !", `${s.sc[s.mw]} manches à ${s.sc[1 - s.mw]}`);
      } else if (s.ph === "r" && s.w >= 0) {
        showBanner(isPl && s.w === mySeat ? "MANCHE POUR TOI !" : `MANCHE POUR ${name(s.w)} !`, `${name(SEAT[0])} ${s.sc[SEAT[0]]} – ${s.sc[SEAT[1]]} ${name(SEAT[1])}`);
      }
    }
    function onState(s) {
      if (!s || typeof s !== "object" || dead) return;
      const prev = S;
      S = s;
      const now = performance.now();
      const toLeft = a => (SEAT[0] === 0 ? a : -a);
      // compte à rebours / départ
      const cdKey = s.r + ":" + s.ph + ":" + (s.ph === "c" ? s.cd : "");
      if (cdKey !== lastCdKey) {
        lastCdKey = cdKey;
        if (s.ph === "c") {
          showCd(String(s.cd)); sndBeep(false); hideBanner(); slam = null; slowUntil = 0;
          stage.classList.remove("bf-slow");
          if (isPl && myR !== s.r) { myR = s.r; myN = 0; queueSend(); }
        } else if (s.ph === "f") {
          if (isPl && myR !== s.r) { myR = s.r; myN = 0; }
          showCd("FORCE !", true); sndBeep(true); cdHideAt = now + 800;
        } else if (s.ph === "r" || s.ph === "o") {
          const final = s.ph === "o" && !s.ff;
          if (prev && (prev.ph === "f" || prev.ph === "c") && (s.w >= 0 || final)) {
            const ws = s.ph === "o" ? s.mw : s.w;
            const to = sideOfSeat(ws) === 0 ? 100 : -100;
            slam = {from: da, to, t0: now, dur: final && !RM ? 1500 : RM ? 1 : 380, final, hit: false};
            if (final && !RM) stage.classList.add("bf-slow");
          } else {
            if (s.ph === "o" && !s.ff) da = toLeft(s.a);
            roundBanner(s);
          }
          if (s.ph === "o" && s.ff) roundBanner(s);
        }
      }
      // cris
      if (Array.isArray(s.ch)) {
        if (lastCheerId === null) lastCheerId = s.ch[0];
        else if (s.ch[0] !== lastCheerId) {
          lastCheerId = s.ch[0];
          const txt = CHEERS[s.ch[1]] || CHEERS[0];
          const side = s.ch[2] === 0 || s.ch[2] === 1 ? sideOfSeat(s.ch[2]) : -1;
          spawnCheer(txt, side, s.ch[1] === 1 || s.ch[1] === 3 || s.ch[1] === 4);
          sndCheer(false);
        }
      }
      renderHud(s);
    }
    function renderHud(s) {
      waitEl.style.display = s.ph === "w" ? "" : "none";
      $("bf-rnd").textContent = s.ph === "o" ? "FIN DU MATCH" : "MANCHE " + Math.min(3, s.r || 1) + " / 3";
      for (let side = 0; side < 2; side++) {
        const seat = SEAT[side], sc = (s.sc && s.sc[seat]) || 0;
        dotsEl[side].forEach((d, i) => d.classList.toggle("on", i < sc));
        const r = s.rt ? s.rt[seat] || 0 : 0;
        rtEl[side].textContent = fmt(s.ph === "f" ? r : 0);
        boEl[side].classList.toggle("on", s.ph === "f" && s.bo === seat);
      }
      if (btn) {
        const live = s.ph === "f";
        btn.classList.toggle("bf-off", !live);
        btn.classList.toggle("bf-live", live && !RM);
        let t = "PRÊT…", sub = "attends le top départ";
        if (s.ph === "w") { t = "PRÊT…"; sub = "on s'installe"; }
        else if (s.ph === "c") { t = String(s.cd); sub = "ne tape pas encore !"; }
        else if (live) { t = "TAPE !"; sub = "le plus vite possible"; }
        else if (s.ph === "r") { t = s.w === mySeat ? "BIEN JOUÉ !" : "RESPIRE…"; sub = "manche suivante"; }
        else if (s.ph === "o") { t = s.mw === mySeat ? "VICTOIRE !" : "PERDU…"; sub = s.mw === mySeat ? "quels bras !" : "retourne à la salle"; }
        if (btxt.textContent !== t) btxt.textContent = t;
        if (bsub.textContent !== sub) bsub.textContent = sub;
      }
    }

    // ---------- boucle d'animation ----------
    const drops = [];
    function spawnDrop(side) {
      if (drops.length > 14) return;
      const h = G[side].head;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M0 -5Q4 1 0 4Q-4 1 0 -5Z");
      p.setAttribute("fill", "#8fd3ff"); p.setAttribute("stroke", INK); p.setAttribute("stroke-width", "1.4");
      dropsG.appendChild(p);
      const sgn = Math.random() < 0.5 ? -1 : 1;
      drops.push({p, x: h.x + sgn * h.r * (0.75 + Math.random() * 0.3), y: h.y - h.r * (0.2 + Math.random() * 0.4), vx: sgn * (8 + Math.random() * 14), vy: -20 - Math.random() * 15, life: 1});
    }
    const P2 = (a, b) => `${f1(a)} ${f1(b)}`;
    function drawArm(side, H, t, jit) {
      const g = G[side], A = ARM[side], [sx, sy] = SH[side], [ex, ey] = ELB[side];
      const st = strain[side];
      // poing
      const fx = H[0] + t[0] * g.fr * 0.45 * (side === 0 ? -1 : 1) + jit[0], fy = H[1] + t[1] * g.fr * 0.45 * (side === 0 ? -1 : 1) + jit[1];
      A.fist.setAttribute("transform", `translate(${f1(fx)} ${f1(fy)})`);
      const kd = side === 0 ? 1 : -1, kr = g.fr * 0.55;
      A.kn.setAttribute("d", `M${P2(kd * kr * 0.2, -kr)}q${f1(kd * kr * 0.5)} ${f1(kr * 0.25)} 0 ${f1(kr * 0.66)}M${P2(kd * kr * 0.2, -kr * 0.33)}q${f1(kd * kr * 0.5)} ${f1(kr * 0.25)} 0 ${f1(kr * 0.66)}M${P2(kd * kr * 0.2, kr * 0.33)}q${f1(kd * kr * 0.5)} ${f1(kr * 0.25)} 0 ${f1(kr * 0.6)}`);
      // bras
      A.uo.setAttribute("d", `M${P2(sx, sy)}L${P2(ex, ey)}`);
      A.ui.setAttribute("d", `M${P2(sx, sy)}L${P2(ex, ey)}`);
      let ux = ex - sx, uy = ey - sy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      let nx = -uy, ny = ux; if (ny > 0) { nx = -nx; ny = -ny; }
      const pump = g.ua * (0.5 + 0.12 * st) + 1;
      const bx = sx + ux * ul * 0.42 + nx * g.ua * 0.28, by = sy + uy * ul * 0.42 + ny * g.ua * 0.28;
      A.bo.setAttribute("cx", f1(bx)); A.bo.setAttribute("cy", f1(by)); A.bo.setAttribute("r", f1(pump + 2.5));
      A.bi.setAttribute("cx", f1(bx)); A.bi.setAttribute("cy", f1(by)); A.bi.setAttribute("r", f1(pump));
      A.el.setAttribute("cx", f1(ex)); A.el.setAttribute("cy", f1(ey));
      // avant-bras effilé du coude au poignet
      let vx = fx - ex, vy = fy - ey; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
      const wx = fx - vx * g.fr * 0.55, wy = fy - vy * g.fr * 0.55;
      const qx = -vy, qy = vx, we = g.fe / 2, ww = g.fw / 2;
      const mx = ex + (wx - ex) * 0.35, my = ey + (wy - ey) * 0.35, bulge = we * (1.12 + 0.1 * st);
      A.fa.setAttribute("d", `M${P2(ex + qx * we, ey + qy * we)}Q${P2(mx + qx * bulge, my + qy * bulge)} ${P2(wx + qx * ww, wy + qy * ww)}L${P2(wx - qx * ww, wy - qy * ww)}Q${P2(mx - qx * bulge, my - qy * bulge)} ${P2(ex - qx * we, ey - qy * we)}Z`);
      const ox = qx * (side === 0 ? -1 : 1), oy = qy * (side === 0 ? -1 : 1);
      A.sh.setAttribute("d", `M${P2(ex + (wx - ex) * 0.2 + ox * we * 0.35, ey + (wy - ey) * 0.2 + oy * we * 0.35)}L${P2(ex + (wx - ex) * 0.7 + ox * ww * 0.35, ey + (wy - ey) * 0.7 + oy * ww * 0.35)}`);
      // veines qui gonflent sous l'effort
      if (st > 0.35) {
        const amp = Math.max(2, we * 0.35), o = clamp((st - 0.35) / 0.4, 0, 1);
        let d = "";
        const n = 4;
        for (let i = 0; i <= n; i++) {
          const k = 0.22 + 0.55 * i / n, px = ex + (wx - ex) * k + qx * amp * (i % 2 ? 1 : -1) * 0.6, py = ey + (wy - ey) * k + qy * amp * (i % 2 ? 1 : -1) * 0.6;
          d += (i ? "L" : "M") + P2(px, py);
        }
        A.vn.setAttribute("d", d);
        A.vn.setAttribute("opacity", f1(o));
        A.vn.setAttribute("stroke-width", f1(2 + 1.6 * o + (RM ? 0 : Math.sin(performance.now() / 70) * 0.6 * o)));
      } else A.vn.setAttribute("opacity", "0");
    }
    let raf = 0, lastF = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (dead) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastF) / 1000));
      lastF = now;
      const s = S;
      const target = s ? (SEAT[0] === 0 ? s.a : -s.a) : 0;
      if (slam) {
        const p = clamp((now - slam.t0) / slam.dur, 0, 1);
        let e;
        if (slam.final && !RM) e = p < 0.8 ? (p / 0.8) * 0.3 : 0.3 + Math.pow((p - 0.8) / 0.2, 2) * 0.7;   // ralenti puis claque
        else e = p * p;
        da = slam.from + (slam.to - slam.from) * e;
        if (slam.final && !RM) zoom = 1 + 0.2 * Math.min(1, p / 0.8);
        if (p >= 1 && !slam.hit) { slam.hit = true; impact(slam.final); }
      } else {
        da += (target - da) * (1 - Math.exp(-dt * 11));
      }
      if (slam && slam.hit && slowUntil && now > slowUntil) { stage.classList.remove("bf-slow"); slowUntil = 0; }
      if (!(slam && slam.final && !slam.hit)) zoom += (1 - zoom) * (1 - Math.exp(-dt * (slam && slam.hit ? 2.5 : 6)));
      if (cdHideAt && now > cdHideAt) cdHideAt = 0;

      const live = s && s.ph === "f";
      for (let side = 0; side < 2; side++) {
        const seat = SEAT[side];
        const rate = s && s.rt ? s.rt[seat] || 0 : 0;
        const lose = Math.max(0, side === 0 ? -da : da) / 100;
        const tgt = live ? clamp(rate / 12 * 0.6 + lose * 0.75 + 0.08, 0, 1) : 0;
        strain[side] += (tgt - strain[side]) * (1 - Math.exp(-dt * 4));
      }
      kick *= Math.exp(-dt * 18);

      // position des poings
      const th = da / 100 * TMAX;
      const close = live && Math.abs(da) > 65;
      const tr = close && !RM ? 1.4 + (Math.abs(da) - 65) / 35 * 1.6 : 0;
      const jit = [(Math.random() - 0.5) * 2 * tr, (Math.random() - 0.5) * 2 * tr - (isPl ? kick * 2 : 0)];
      const H = [PIV[0] + Math.sin(th) * RAD, PIV[1] - Math.cos(th) * RAD];
      const tan = [Math.cos(th), Math.sin(th)];
      drawArm(1, H, tan, jit);
      drawArm(0, H, tan, jit);

      // visages : rougeur, veine de colère, sueur, tremblement
      for (let side = 0; side < 2; side++) {
        const st = strain[side], A = ARM[side], h = G[side].head;
        A.flush.setAttribute("opacity", f1(st * 0.4));
        const ang = st > 0.55 ? clamp((st - 0.55) / 0.25, 0, 1) : 0;
        const pul = RM ? 1 : 1 + 0.18 * Math.sin(now / 90);
        A.angry.setAttribute("opacity", f1(ang));
        A.angry.setAttribute("transform", `translate(${f1(h.x + G[side].dir * -h.r * 0.55)} ${f1(h.y - h.r * 0.75)}) scale(${f1(Math.max(0.6, h.r / 16) * pul)})`);
        if (live && st > 0.3 && Math.random() < dt * st * (RM ? 1.2 : 3.5)) spawnDrop(side);
        const loseSide = side === 0 ? da < -65 : da > 65;
        const sh = live && loseSide && !RM ? 1.2 + st * 1.5 : 0;
        const lean = clamp(side === 0 ? da : -da, -100, 100) * 0.04;
        avEl[side].style.transform = `translate(${f1(G[side].dir * lean + (Math.random() - 0.5) * 2 * sh)}px,${f1((Math.random() - 0.5) * 2 * sh)}px)`;
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 160 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.2;
        if (d.life <= 0 || d.y > 330) { d.p.remove(); drops.splice(i, 1); continue; }
        d.p.setAttribute("transform", `translate(${f1(d.x)} ${f1(d.y)})`);
        d.p.setAttribute("opacity", f1(Math.min(1, d.life * 2)));
      }

      // secousse de l'écran + zoom au ralenti
      shakeAmp *= Math.exp(-dt * 5.5);
      if (shakeAmp < 0.2) shakeAmp = 0;
      const sx = (Math.random() - 0.5) * 2 * shakeAmp, sy = (Math.random() - 0.5) * 2 * shakeAmp;
      const oxp = clamp(H[0] / 4, 10, 90), oyp = clamp(H[1] / 3.3, 10, 90);
      shakeEl.style.transformOrigin = `${f1(oxp)}% ${f1(oyp)}%`;
      shakeEl.style.transform = (sx || sy || zoom > 1.001) ? `translate(${f1(sx)}px,${f1(sy)}px) scale(${zoom.toFixed(3)})` : "";

      // jauge
      const pos = clamp(50 + da / 2, 0, 100);
      markEl.style.left = pos.toFixed(2) + "%";
      if (da >= 0) { fillEl.style.left = "50%"; fillEl.style.width = (pos - 50).toFixed(2) + "%"; fillEl.style.background = "var(--bf-gold)"; }
      else { fillEl.style.left = pos.toFixed(2) + "%"; fillEl.style.width = (50 - pos).toFixed(2) + "%"; fillEl.style.background = "var(--bf-blue)"; }
      if (btn) btn.classList.toggle("bf-hit", now < hitUntil);
    }
    raf = requestAnimationFrame(frame);
    api.onState(onState);

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        if (hostTimer) clearInterval(hostTimer);
        timers.forEach(id => clearTimeout(id)); timers.clear();
        window.removeEventListener("keydown", onKey);
        root.removeEventListener("pointerdown", onRootDown);
        if (btn) btn.removeEventListener("pointerdown", onBtnDown);
        if (mq) { try { if (mq.removeEventListener) mq.removeEventListener("change", onMq); else if (mq.removeListener) mq.removeListener(onMq); } catch (e) { /* rien */ } }
        if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
        el.innerHTML = "";
      }
    };
  }
});
