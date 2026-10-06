/* Gonflette Party : Pong Délire en réseau (2 joueurs, chacun sur son téléphone).
   L'air-hockey de fête foraine, version multi-téléphones.

   Réseau :
   - L'hôte (qui peut être spectateur) simule tout à pas fixe (120 Hz) : balles, bonus, effets, score.
     Il publie ~22 fois par seconde un état compact (positions normalisées 0..1 arrondies à 3 décimales).
   - Chaque joueur envoie la position visée de SA raquette : api.setInput({x: 0.42}) (0..1 le long de
     son rail, en coordonnées de la table, avant inversion ; ~20 envois/s au plus).
   - Chaque téléphone affiche à 60 i/s en interpolant entre les états reçus (retard ~100 ms) et prédit
     localement sa propre raquette.
   - Pour compenser la latence, l'hôte accorde un court « délai de grâce » quand une balle passe
     derrière une raquette : si l'entrée du joueur (qui arrive en retard) la couvrait, la balle est sauvée.

   Repère de simulation : table verticale W × L. Le siège 0 (joueur 1) défend le bas, le siège 1 le haut.
   Chaque joueur voit sa raquette en bas (vue tournée de 180° pour le siège 1). */
GONFLETTE.registerGame({
  id: "pong",
  name: "Pong Délire",
  min: 2,
  max: 2,
  create(api) {
    "use strict";
    /* ================= Constantes ================= */
    const W = 600, L = 1000, WALL = 30, SIDE = 18;
    const PT = 40, PH = 118, PY = [L - 64, 64];
    const BALL_R = 12, SPEED0 = 420, SPEED_MAX = 1050, MAX_BALLS = 7;
    const TARGET = 5, TICK = 1 / 120, PUB_MS = 42;
    const FOLLOW = 26, FOLLOW_MAX = 2600;
    const INK = "#3B1F3A";
    const COLORS = ["#FF5A47", "#17BFB0"], COLORS_LIGHT = ["#FFB0A6", "#9CEAE2"], COLORS_D = ["#C8321F", "#0B7F75"];
    const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
    const SCRIPT = 'Pacifico, "Brush Script MT", cursive';
    const BTYPES = ["giant", "mini", "ghost", "multi", "turtle", "invert", "zigzag"];
    const BONUS = {
      giant: {label: "Raquette géante", color: "#FFC83D", dur: 8},
      mini: {label: "Mini-raquette", color: "#B79CFF", dur: 8},
      ghost: {label: "Balle fantôme", color: "#9AD7FF", dur: 4},
      multi: {label: "Multi-balles", color: "#FF8FC7", dur: 0},
      turtle: {label: "Balle tortue", color: "#7BD389", dur: 5},
      invert: {label: "Contrôles inversés", color: "#FF9F43", dur: 5},
      zigzag: {label: "Balle zigzag", color: "#F368E0", dur: 6}
    };
    const BALL_EFFECTS = ["ghost", "turtle", "zigzag", "multi"];
    const EXCL = ["BOUM !", "Quelle patate !", "Dans la lucarne !", "Oh la boulette !", "Saperlipopette !",
      "Tonnerre de Brest !", "Ça pique !", "Hop, au fond !", "Le gardien dort !", "Sacrebleu !", "Pas de pitié !",
      "Quel missile !", "Pif paf pouf !", "Sapristi !", "Et ça fait mouche !"];
    const TEASES = ["L'adversaire est parti pleurer dans la barbe à papa.", "Une pomme d'amour pour le champion !",
      "Le perdant offre les churros.", "Quelle leçon ! Même le manège en a le tournis.", "Revanche ? On dit revanche."];

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const rand = (a, b) => a + Math.random() * (b - a);
    const r3 = v => Math.round(v * 1000) / 1000;
    const nowS = () => performance.now() / 1000;

    const el = api.el;
    const P = api.players;
    const mySeat = P.findIndex(p => p.key === api.me);
    const leftSeat = mySeat >= 0 ? mySeat : 0, rightSeat = 1 - leftSeat;
    const name = s => (P[s] ? P[s].pseudo : "?");

    let RM = false, mq = null;
    const onMq = e => { RM = e.matches; };
    try { mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches; if (mq.addEventListener) mq.addEventListener("change", onMq); } catch (e) { mq = null; }

    /* ================= DOM ================= */
    const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="#3B1F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="#3B1F3A"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
    const ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="#3B1F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="#3B1F3A"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
    const card = (s, right) => `<div class="pg-card${right ? " pg-r" : ""}" style="--pc:${COLORS[s]};--pcd:${COLORS_D[s]}">
        <div class="pg-av">${api.avatar(P[s].key)}</div>
        <div class="pg-name"><small></small><b></b></div>
        <div class="pg-sc" aria-label="Score">0</div>
        <div class="pg-chips" aria-label="Effets actifs"></div>
      </div>`;
    el.innerHTML = `<style>
      .pg{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;color:#3B1F3A;
        font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;background-color:#FFF1DE;
        background-image:repeating-linear-gradient(90deg,rgba(255,126,176,.16) 0 46px,rgba(255,241,222,0) 46px 92px);
        touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
      .pg-head{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:6px;padding:8px 8px 2px;align-items:stretch;width:100%;max-width:820px;margin:0 auto}
      .pg-card{position:relative;overflow:hidden;min-width:0;background:#FFFDF7;border:3px solid #3B1F3A;border-radius:14px;box-shadow:0 3px 0 #3B1F3A;
        padding:8px 6px 4px;display:grid;grid-template-columns:36px minmax(0,1fr) auto;grid-template-areas:"av name sc" "chips chips chips";column-gap:5px;row-gap:2px;align-items:center}
      .pg-card.pg-r{grid-template-columns:auto minmax(0,1fr) 36px;grid-template-areas:"sc name av" "chips chips chips";text-align:right}
      .pg-card::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:repeating-linear-gradient(90deg,var(--pc) 0 12px,#fff 12px 24px)}
      .pg-av{grid-area:av;width:36px;height:36px}
      .pg-av .av{width:100%;height:100%;display:block}
      .pg-name{grid-area:name;min-width:0;line-height:1.05}
      .pg-name small{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--pcd)}
      .pg-name b{display:block;font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pg-sc{grid-area:sc;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:36px;line-height:1;color:var(--pc);min-width:.8em;text-align:center;
        -webkit-text-stroke:2.5px #3B1F3A;paint-order:stroke fill;text-shadow:0 3px 0 #3B1F3A}
      .pg-sc.pg-bump{animation:pg-bump .5s cubic-bezier(.3,1.8,.5,1)}
      @keyframes pg-bump{0%{transform:scale(1.7) rotate(-8deg)}100%{transform:none}}
      .pg-chips{grid-area:chips;display:flex;gap:3px;height:19px;overflow:hidden;align-items:center}
      .pg-r .pg-chips{justify-content:flex-end}
      .pg-chip{position:relative;overflow:hidden;display:inline-flex;align-items:center;flex:0 1 auto;min-width:28px;font-size:12px;font-weight:700;line-height:1;
        padding:2px 6px 4px;border:2px solid #3B1F3A;border-radius:999px;background:var(--c);white-space:nowrap;animation:pg-chip .35s cubic-bezier(.3,1.7,.5,1)}
      .pg-chip span{overflow:hidden;text-overflow:ellipsis}
      .pg-chip i{position:absolute;left:0;right:0;bottom:0;height:3px;background:#3B1F3A;transform-origin:left center}
      @keyframes pg-chip{from{transform:scale(.3)}}
      .pg-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
      .pg-btn{width:36px;height:36px;display:grid;place-items:center;padding:0;border:3px solid #3B1F3A;border-radius:11px;background:#FFC83D;box-shadow:0 3px 0 #3B1F3A;cursor:pointer}
      .pg-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #3B1F3A}
      .pg-btn svg{width:18px;height:18px}
      .pg-btn:focus-visible{outline:3px solid #3B1F3A;outline-offset:2px}
      .pg-to{font-family:Anton,Impact,sans-serif;font-size:12px;letter-spacing:.03em;background:#FFFDF7;border:2px solid #3B1F3A;border-radius:999px;padding:0 6px;white-space:nowrap}
      .pg-stage{position:relative;flex:1;min-height:0}
      .pg-cv{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
      .pg-hint{position:absolute;left:50%;top:64%;transform:translate(-50%,-50%);max-width:calc(100% - 48px);width:max-content;text-align:center;
        background:rgba(255,253,247,.94);border:3px solid #3B1F3A;border-radius:14px;box-shadow:0 3px 0 #3B1F3A;padding:6px 12px;font-weight:700;font-size:16px;line-height:1.2;
        pointer-events:none;transition:opacity .5s}
      .pg-hint b{color:#C8321F}
      .pg-hint.pg-off{opacity:0}
      .pg-end{position:absolute;inset:0;display:grid;place-items:center;padding:16px;background:rgba(255,246,230,.35);pointer-events:none}
      .pg-end[hidden]{display:none}
      .pg-panel{width:min(100%,340px);background:#FFFDF7;border:3px solid #3B1F3A;border-radius:22px;box-shadow:0 6px 0 #3B1F3A;padding:16px 16px 18px;text-align:center;
        animation:pg-pop .45s cubic-bezier(.3,1.6,.5,1)}
      @keyframes pg-pop{from{transform:scale(.8) rotate(-3deg);opacity:0}}
      .pg-panel svg{width:58px;height:58px;display:block;margin:0 auto 2px}
      .pg-panel h2{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:30px;line-height:1.1;text-transform:uppercase}
      .pg-panel h2 span{color:var(--wc);-webkit-text-stroke:2px #3B1F3A;paint-order:stroke fill}
      .pg-fin{font-family:Anton,Impact,sans-serif;font-size:40px;line-height:1.1;margin:2px 0}
      .pg-tease{margin:4px 0 0;font-family:Pacifico,"Brush Script MT",cursive;font-size:17px;line-height:1.35;color:#C8321F}
      .pg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      @media (max-width:360px){.pg-name b{font-size:15px}.pg-sc{font-size:30px}.pg-chip{font-size:11px}}
      @media (prefers-reduced-motion:reduce){.pg *{animation:none!important;transition:none!important}}
    </style>
    <div class="pg">
      <div class="pg-head">
        ${card(leftSeat, false)}
        <div class="pg-mid"><button class="pg-btn" type="button" aria-label="Couper le son" aria-pressed="false">${ICON_SOUND}</button><span class="pg-to">À ${TARGET}</span></div>
        ${card(rightSeat, true)}
      </div>
      <div class="pg-stage">
        <canvas class="pg-cv" role="img" aria-label="Table d'air-hockey vue de dessus"></canvas>
        <div class="pg-hint"></div>
        <div class="pg-end" hidden><div class="pg-panel">
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#FFC83D" stroke="#3B1F3A" stroke-width="3.5" stroke-linejoin="round"/><path d="M18 13H9a9 9 0 0 0 10 12M46 13h9a9 9 0 0 1-10 12" fill="none" stroke="#3B1F3A" stroke-width="3.5" stroke-linecap="round"/><path d="M28 35h8v9h-8z" fill="#FF7EB0" stroke="#3B1F3A" stroke-width="3.5" stroke-linejoin="round"/><rect x="19" y="44" width="26" height="10" rx="3" fill="#17BFB0" stroke="#3B1F3A" stroke-width="3.5"/><path d="M25 14v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
          <h2><span></span> gagne !</h2><div class="pg-fin"></div><p class="pg-tease"></p>
        </div></div>
      </div>
      <p class="pg-sr" aria-live="polite"></p>
    </div>`;
    const root = el.querySelector(".pg"), stage = el.querySelector(".pg-stage"), canvas = el.querySelector(".pg-cv");
    const ctx = canvas.getContext("2d");
    const hintEl = el.querySelector(".pg-hint"), endEl = el.querySelector(".pg-end"), liveEl = el.querySelector(".pg-sr");
    const muteBtn = el.querySelector(".pg-btn");
    const cards = el.querySelectorAll(".pg-card");
    const cardOf = {}; cardOf[leftSeat] = cards[0]; cardOf[rightSeat] = cards[1];
    const scoreEl = [0, 1].map(s => cardOf[s].querySelector(".pg-sc"));
    const chipsEl = [0, 1].map(s => cardOf[s].querySelector(".pg-chips"));
    [0, 1].forEach(s => {
      cardOf[s].querySelector(".pg-name b").textContent = name(s);
      cardOf[s].querySelector(".pg-name small").textContent = s === mySeat ? "Toi" : (mySeat >= 0 ? "Adversaire" : (s === 0 ? "En bas" : "En haut"));
    });
    function setHint(land) {
      if (mySeat < 0) hintEl.textContent = "Vous regardez le match en spectateur";
      else if (land) hintEl.innerHTML = "Ta raquette est <b>à gauche</b> : souris, doigt ou touches ↑ ↓ (Z / S)";
      else hintEl.innerHTML = "Ta raquette est <b>en bas</b> : glisse le doigt n'importe où pour la bouger";
    }
    const announce = t => { liveEl.textContent = t; };

    /* ================= Son ================= */
    let actx = null, master = null, muted = false;
    function ensureAudio() {
      try {
        if (!actx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          actx = new AC(); master = actx.createGain(); master.gain.value = 0.35; master.connect(actx.destination);
        }
        if (actx.state === "suspended") actx.resume();
      } catch (e) { actx = null; }
    }
    function tone(f, d, type, v, f2, delay) {
      if (!actx || muted || actx.state !== "running") return;
      try {
        const t = actx.currentTime + (delay || 0);
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || "square";
        o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* ignore */ }
    }
    let lastWallSound = 0;
    const sfx = {
      hit(sp) { const f = 240 + sp * 0.35; tone(f, 0.08, "square", 0.16, f * 1.6); tone(120, 0.06, "triangle", 0.25, 80); },
      wall() { const t = nowS(); if (t - lastWallSound < 0.05) return; lastWallSound = t; tone(200, 0.06, "triangle", 0.18, 150); },
      goal() { tone(900, 0.5, "sawtooth", 0.1, 110); tone(80, 0.45, "sine", 0.55, 38); tone(520, 0.14, "square", 0.1, 820, 0.35); tone(660, 0.2, "square", 0.1, 990, 0.5); },
      bonus(mean) { (mean ? [660, 550, 440, 330] : [523, 659, 784, 1046]).forEach((f, i) => tone(f, 0.1, mean ? "sawtooth" : "square", 0.11, mean ? f * 0.94 : null, i * 0.07)); },
      spawn() { tone(600, 0.09, "sine", 0.14, 1300); tone(1300, 0.06, "sine", 0.08, 1700, 0.08); },
      count() { tone(523, 0.13, "square", 0.12); },
      go() { tone(1046, 0.28, "square", 0.13, 1568); },
      win() { [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.13, "square", 0.12, null, i * 0.14)); tone(262, 1, "triangle", 0.15, null, 0.84); }
    };
    muteBtn.addEventListener("click", () => {
      ensureAudio(); muted = !muted;
      muteBtn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.setAttribute("aria-label", muted ? "Activer le son" : "Couper le son");
      if (!muted) tone(660, 0.1, "sine", 0.15, 990);
    });
    muteBtn.addEventListener("pointerdown", e => e.stopPropagation());

    /* ================= Raquette : physique partagée (hôte et prédiction locale) ================= */
    function padRange(h) { return [WALL + h / 2 + 2, W - WALL - h / 2 - 2]; }
    function stepPad(p, rawT, inv, h, dt) {
      const [lo, hi] = padRange(h);
      let tx = rawT * W; if (inv) tx = W - tx;
      tx = clamp(tx, lo, hi);
      const v = clamp((tx - p.x) * FOLLOW, -FOLLOW_MAX, FOLLOW_MAX);
      p.vx = v; p.x = clamp(p.x + v * dt, lo, hi);
    }

    /* ================= HÔTE : simulation ================= */
    let H = null, hostTimer = null, finishTimer = null;
    const targets = [0.5, 0.5];
    const stats = {pubs: 0, maxSize: 0, lastSize: 0, t0: 0, hits: 0, rescues: 0};
    let forceGoalReq = -1, dropReq = null;
    if (api.isHost) {
      H = {k: 0, simT: 0, ph: "c", cd: 3.6, gt: 0, sc: [0, 0], serveDir: Math.random() < 0.5 ? -1 : 1,
        pads: [{x: W / 2, vx: 0, h: PH}, {x: W / 2, vx: 0, h: PH}], balls: [], nextId: 1, effects: [],
        bonus: null, bonusTimer: rand(4, 6), evs: [], evId: 0, winner: -1, ff: 0, tz: 0, missingSince: 0, finished: false};
      H.balls = [mkBall(W / 2, L / 2, 0, 0)];
      api.onInputs(map => {
        P.forEach((p, s) => {
          if (s === mySeat) return; // ma propre entrée est lue directement
          const i = map[p.key];
          if (i && typeof i.x === "number" && isFinite(i.x)) targets[s] = clamp(i.x, 0, 1);
        });
        // un joueur a disparu de la salle : on vérifie tout de suite (sinon le lobby annulerait la partie)
        if (P.some(p => !(p.key in map))) checkForfeit(true);
      });
    }
    function mkBall(x, y, vx, vy, last) { return {id: H.nextId++ % 1000, x, y, vx, vy, r: BALL_R, last: last == null ? -1 : last, zz: rand(0, 6), miss: null, held: false}; }
    function ev(code, ...args) { H.evs.push([++H.evId, H.k, code, ...args]); }
    function hasEff(type, side) { return H.effects.some(e => e.type === type && e.side === side); }
    function hasEffAny(type) { return H.effects.some(e => e.type === type); }
    function addEff(type, side, dur) {
      if (BALL_EFFECTS.includes(type)) H.effects = H.effects.filter(e => !(e.type === type && e.side !== side));
      const ex = H.effects.find(e => e.type === type && e.side === side);
      if (ex) { ex.t = dur; ex.dur = dur; return; }
      H.effects.push({type, side, t: dur, dur});
    }
    function graceFor(s) { return s === mySeat ? 0.08 : 0.2; }
    function bounce(b, s, px, h, pvx) {
      const dir = s === 0 ? -1 : 1;
      const rel = clamp((b.x - px) / (h / 2), -1, 1);
      const ang = rel * 1.02;
      const sp = Math.min(SPEED_MAX, Math.hypot(b.vx, b.vy) * 1.065 + 10);
      b.vy = dir * Math.cos(ang) * sp;
      b.vx = Math.sin(ang) * sp + pvx * 0.14;
      if (Math.abs(b.vy) < sp * 0.5) b.vy = dir * sp * 0.5;
      b.y = PY[s] + dir * (PT / 2 + b.r + 0.5);
      b.x = clamp(b.x, WALL + b.r, W - WALL - b.r);
      b.last = s; b.miss = null; b.held = false; stats.hits++;
      ev(1, s, Math.round(sp), r3(b.x / W), r3(b.y / L));
    }
    function hitPaddle(b, s) {
      const p = H.pads[s], hw = PT / 2, hh = p.h / 2;
      const dir = s === 0 ? -1 : 1;
      if (b.vy * dir >= 0) return false;
      if (s === 0 ? b.y > PY[0] + 4 : b.y < PY[1] - 4) return false;
      const cx = clamp(b.x, p.x - hh + hw, p.x + hh - hw);
      const dx = b.x - cx, dy = b.y - PY[s], rad = b.r + hw;
      if (dx * dx + dy * dy > rad * rad) return false;
      bounce(b, s, p.x, p.h, p.vx);
      return true;
    }
    // Délai de grâce : l'entrée la plus récente du joueur couvre-t-elle le point où la balle est passée ?
    function checkRescue(b) {
      const m = b.miss; if (!m || H.simT - m.t > graceFor(m.s)) return;
      const s = m.s, p = H.pads[s];
      const [lo, hi] = padRange(p.h);
      let tx = targets[s] * W; if (hasEff("invert", s)) tx = W - tx;
      tx = clamp(tx, lo, hi);
      for (const cx of [tx, p.x]) {
        if (Math.abs(m.x - cx) <= p.h / 2 + b.r * 0.6) { b.x = m.x; stats.rescues++; bounce(b, s, cx, p.h, 0); return; }
      }
    }
    function updateBalls(dt) {
      const mult = hasEffAny("turtle") ? 0.5 : 1;
      const zz = hasEffAny("zigzag");
      for (const b of H.balls.slice()) {
        if (b.miss) checkRescue(b);
        if (b.held) {
          if (H.simT - b.miss.t >= graceFor(b.miss.s)) scoreGoal(b.miss.s === 0 ? 1 : 0, b);
          continue;
        }
        if (zz) b.zz += dt * 11;
        const sp = Math.hypot(b.vx, b.vy) * mult + (zz ? 300 : 0);
        const n = Math.max(1, Math.ceil(sp * dt / 6)), h = dt / n;
        for (let k = 0; k < n; k++) {
          const y0 = b.y;
          b.y += b.vy * mult * h;
          b.x += b.vx * mult * h + (zz ? Math.cos(b.zz) * 300 * h : 0);
          if (b.x < WALL + b.r) { b.x = WALL + b.r; b.vx = Math.abs(b.vx); ev(2, r3(WALL / W), r3(b.y / L)); }
          else if (b.x > W - WALL - b.r) { b.x = W - WALL - b.r; b.vx = -Math.abs(b.vx); ev(2, r3((W - WALL) / W), r3(b.y / L)); }
          if (!b.miss && !hitPaddle(b, 0)) hitPaddle(b, 1);
          if (!b.miss) {
            if (b.vy > 0 && y0 <= PY[0] + 4 && b.y > PY[0] + 4) b.miss = {s: 0, x: b.x, t: H.simT};
            else if (b.vy < 0 && y0 >= PY[1] - 4 && b.y < PY[1] - 4) b.miss = {s: 1, x: b.x, t: H.simT};
          }
          const bn = H.bonus;
          if (bn && b.last >= 0 && bn.t > 0.25) {
            const dx = b.x - bn.x, dy = b.y - bn.y;
            if (dx * dx + dy * dy < (b.r + bn.r) * (b.r + bn.r)) collect(bn.type, b.last, bn.x, bn.y);
          }
          const goalBottom = b.y > L - SIDE + 2, goalTop = b.y < SIDE - 2;
          if (goalBottom || goalTop) {
            const def = goalBottom ? 0 : 1;
            if (b.miss && b.miss.s === def && H.simT - b.miss.t < graceFor(def)) { b.y = goalBottom ? L - SIDE + 2 : SIDE - 2; b.held = true; }
            else scoreGoal(1 - def, b);
            break;
          }
        }
      }
    }
    function updateEffects(dt) {
      for (const e of H.effects) if (e.dur > 0) e.t -= dt;
      H.effects = H.effects.filter(e => e.type === "multi" ? H.balls.length > 1 : e.t > 0);
    }
    function spawnBonus(type) {
      H.bonus = {type: type || BTYPES[(Math.random() * BTYPES.length) | 0], x: rand(W * 0.22, W * 0.78), y: rand(L * 0.36, L * 0.64), r: 30, t: 0, life: 11};
      ev(5);
    }
    function updateBonus(dt) {
      if (H.bonus) {
        H.bonus.t += dt;
        if (H.bonus.t > H.bonus.life) { ev(7, r3(H.bonus.x / W), r3(H.bonus.y / L), BTYPES.indexOf(H.bonus.type)); H.bonus = null; H.bonusTimer = rand(5, 8); }
      } else {
        H.bonusTimer -= dt;
        if (H.bonusTimer <= 0) spawnBonus();
      }
    }
    function collect(type, side, x, y) {
      const B = BONUS[type], opp = 1 - side;
      let who = side;
      switch (type) {
        case "mini": addEff("mini", opp, B.dur); who = opp; break;
        case "invert": addEff("invert", opp, B.dur); who = opp; break;
        case "multi": {
          const dir = side === 0 ? -1 : 1;
          const base = Math.max(SPEED0, ...H.balls.map(b => Math.hypot(b.vx, b.vy) * 0.9));
          [-0.45, 0.45].forEach(a => {
            if (H.balls.length >= MAX_BALLS) return;
            const aa = a + rand(-0.15, 0.15);
            H.balls.push(mkBall(x, y, Math.sin(aa) * base, dir * Math.cos(aa) * base, side));
          });
          addEff("multi", side, 0);
          break;
        }
        default: addEff(type, side, B.dur);
      }
      ev(4, BTYPES.indexOf(type), who, side, r3(x / W), r3(y / L));
      H.bonus = null; H.bonusTimer = rand(5, 8);
    }
    function startCountdown(dur) {
      H.ph = "c"; H.cd = dur;
      H.balls = [mkBall(W / 2, L / 2, 0, 0)];
      H.effects = H.effects.filter(e => !BALL_EFFECTS.includes(e.type));
    }
    function launch() {
      const a = rand(-0.42, 0.42);
      const b = H.balls[0] || mkBall(W / 2, L / 2, 0, 0);
      b.vx = Math.sin(a) * SPEED0; b.vy = Math.cos(a) * SPEED0 * H.serveDir;
      H.balls = [b]; H.ph = "p";
      ev(6);
    }
    function scoreGoal(scorer, b) {
      const i = H.balls.indexOf(b);
      if (i >= 0) H.balls.splice(i, 1);
      if (H.ph !== "p") return;
      H.sc[scorer]++;
      ev(3, scorer, (Math.random() * EXCL.length) | 0, r3(b.x / W));
      if (H.sc[scorer] >= TARGET) { endMatch(scorer, 0); return; }
      if (!H.balls.length) {
        H.ph = "g"; H.gt = 1.6;
        H.serveDir = scorer === 0 ? -1 : 1; // la balle part vers celui qui vient d'encaisser
        H.bonus = null; H.bonusTimer = rand(5, 8);
      }
    }
    function endMatch(w, ff) {
      if (H.ph === "o") return;
      H.ph = "o"; H.winner = w; H.ff = ff ? 1 : 0; H.tz = (Math.random() * TEASES.length) | 0;
      H.balls = []; H.bonus = null; H.effects = [];
      ev(8, w);
      if (!ff) publish();
      const wk = P[w].key, lk = P[1 - w].key, a = H.sc[w], b = H.sc[1 - w];
      const summary = ff ? `${name(w)} gagne par forfait (${a} à ${b})` : `${name(w)} gagne ${a} à ${b}`;
      // Fin normale : ~2 s sur le score final. Forfait : on termine tout de suite (sinon le lobby annule la
      // partie faute de joueurs), juste après la dernière publication (évite d'écrire dans une salle quittée).
      const stop = () => { if (hostTimer) { clearInterval(hostTimer); hostTimer = null; } };
      if (ff) stop();
      const stopTimer = ff ? null : setTimeout(stop, 2100);
      finishTimer = setTimeout(() => {
        finishTimer = null; H.finished = true;
        stop(); if (stopTimer) clearTimeout(stopTimer);
        api.finish({winners: [wk], ranking: [wk, lk], summary});
      }, ff ? Math.max(0, lastPub + 50 - performance.now()) : 2200);
    }
    function hostStep(dt) {
      H.k++; H.simT += dt;
      if (mySeat >= 0) targets[mySeat] = localT;
      for (let s = 0; s < 2; s++) {
        const p = H.pads[s];
        const th = PH * (hasEff("giant", s) ? 1.65 : 1) * (hasEff("mini", s) ? 0.58 : 1);
        p.h += (th - p.h) * Math.min(1, dt * 8);
        stepPad(p, targets[s], hasEff("invert", s), p.h, dt);
      }
      if (H.ph === "c") { H.cd -= dt; if (H.cd <= 0) launch(); }
      else if (H.ph === "p") {
        if (forceGoalReq >= 0 && H.balls.length) { const s = forceGoalReq; forceGoalReq = -1; scoreGoal(s, H.balls[0]); }
        if (dropReq && H.balls.length) { const b = H.balls[0]; if (b.last < 0) b.last = b.vy < 0 ? 0 : 1; H.bonus = {type: dropReq, x: b.x, y: b.y, r: 30, t: 1, life: 11}; dropReq = null; }
        if (H.ph === "p") updateBalls(dt);
        if (H.ph === "p") { updateEffects(dt); updateBonus(dt); }
      } else if (H.ph === "g") { H.gt -= dt; if (H.gt <= 0) startCountdown(2.1); }
      const old = H.k - 84;
      while (H.evs.length && (H.evs[0][1] < old || H.evs.length > 14)) H.evs.shift();
    }
    function snapshot() {
      const s = {k: H.k, ph: H.ph, sc: H.sc.slice(),
        px: [r3(H.pads[0].x / W), r3(H.pads[1].x / W)], h: [Math.round(H.pads[0].h), Math.round(H.pads[1].h)],
        b: H.balls.map(b => [b.id, r3(b.x / W), r3(b.y / L), Math.round(b.vx), Math.round(b.vy), b.last]),
        e: H.effects.map(e => [BTYPES.indexOf(e.type), e.side, Math.max(0, Math.round(e.t * 10))]),
        v: H.evs.slice()};
      if (H.ph === "c") s.cd = Math.round(H.cd * 100) / 100;
      if (H.bonus) s.bn = [BTYPES.indexOf(H.bonus.type), r3(H.bonus.x / W), r3(H.bonus.y / L), Math.round(H.bonus.t * 10)];
      if (H.ph === "o") { s.w = H.winner; s.ff = H.ff; s.tz = H.tz; }
      return s;
    }
    let lastPub = 0, lastHT = 0, acc = 0, lastConnCheck = 0;
    const seenSeat = [false, false];
    function publish() {
      const s = snapshot();
      const size = JSON.stringify(s).length;
      stats.pubs++; stats.lastSize = size; if (size > stats.maxSize) stats.maxSize = size;
      if (!stats.t0) stats.t0 = performance.now();
      api.setState(s);
      ingest(s);
    }
    function hostLoop() {
      const now = performance.now();
      let d = lastHT ? (now - lastHT) / 1000 : 0; lastHT = now;
      if (d > 0.2) d = 0.2;
      acc += d;
      while (acc >= TICK) { acc -= TICK; hostStep(TICK); }
      if (now - lastPub >= (H.ph === "o" ? 250 : PUB_MS) - 2) { lastPub = now; publish(); }
      if (now - lastConnCheck > 300) { lastConnCheck = now; checkForfeit(false); }
    }
    // Forfait : un des deux joueurs a quitté la partie, l'autre gagne.
    function checkForfeit(fromPeers) {
      if (!H || H.ph === "o") return;
      let con = null;
      try { con = api.connected(); } catch (e) { con = null; }
      if (!con) return;
      const here = [0, 1].filter(s => con.includes(P[s].key));
      here.forEach(s => { seenSeat[s] = true; });
      if (here.length !== 1) { H.missingSince = 0; return; }
      const gone = 1 - here[0], now = performance.now();
      if (!H.missingSince) H.missingSince = now;
      // un joueur déjà vu qui disparaît : forfait ; un joueur jamais arrivé : on patiente 10 s
      if (seenSeat[gone] ? (fromPeers || now - H.missingSince > 600) : now - H.missingSince > 10000) {
        api.toast(`${name(1 - here[0])} a quitté la partie : victoire par forfait !`);
        endMatch(here[0], 1);
      }
    }

    /* ================= CLIENTS : réception et interpolation ================= */
    const DELAY = api.isHost ? 0.06 : 0.1;
    const buf = [];
    let offset = null, lastEvQueued = 0;
    const evQueue = [];
    function ingest(s) {
      if (!s || typeof s.k !== "number") return;
      const t = s.k * TICK;
      if (buf.length && s.k <= buf[buf.length - 1].s.k) {
        if (s.k < buf[buf.length - 1].s.k - 600) { buf.length = 0; offset = null; } else return;
      }
      const sample = nowS() - t;
      if (offset === null || sample < offset) offset = sample; else offset += (sample - offset) * 0.02;
      buf.push({t, s});
      if (buf.length > 60) buf.splice(0, buf.length - 60);
      for (const e of s.v || []) if (e[0] > lastEvQueued) { evQueue.push(e); lastEvQueued = e[0]; }
    }
    if (!api.isHost) api.onState(ingest);

    function computeView(now) {
      if (!buf.length) return null;
      const rt = now - offset - DELAY;
      while (buf.length > 2 && buf[1].t < rt - 0.4) buf.shift();
      let i = buf.length - 1;
      while (i > 0 && buf[i].t > rt) i--;
      const A = buf[i], B = buf[i + 1];
      let f = 0, ext = 0;
      if (B && rt > A.t) f = clamp((rt - A.t) / (B.t - A.t), 0, 1);
      else if (!B) ext = clamp(rt - A.t, 0, 0.1);
      const a = A.s, bS = B ? B.s : null;
      const balls = [];
      const bIdx = {};
      if (bS) for (const q of bS.b) bIdx[q[0]] = q;
      const aIds = {};
      for (const q of a.b) {
        aIds[q[0]] = 1;
        const nq = bIdx[q[0]];
        let x = q[1] * W, y = q[2] * L;
        if (nq) { x += (nq[1] * W - x) * f; y += (nq[2] * L - y) * f; }
        else if (bS) { if (f >= 0.5) continue; }
        else if (ext && a.ph === "p") { x = clamp(x + q[3] * ext, WALL + BALL_R, W - WALL - BALL_R); y = clamp(y + q[4] * ext, 0, L); }
        balls.push({id: q[0], x, y, vx: nq ? nq[3] : q[3], vy: nq ? nq[4] : q[4], last: f > 0.5 && nq ? nq[5] : q[5]});
      }
      if (bS && f >= 0.5) for (const q of bS.b) if (!aIds[q[0]]) balls.push({id: q[0], x: q[1] * W, y: q[2] * L, vx: q[3], vy: q[4], last: q[5]});
      const px = [0, 1].map(s => (a.px[s] + ((bS ? bS.px[s] : a.px[s]) - a.px[s]) * f) * W);
      const h = [0, 1].map(s => a.h[s] + ((bS ? bS.h[s] : a.h[s]) - a.h[s]) * f);
      const dtA = Math.max(0, rt - A.t);
      return {rt, ph: a.ph, sc: a.sc, cd: a.ph === "c" ? Math.max(0, (a.cd || 0) - dtA) : 0, balls, px, h,
        e: a.e.map(q => ({type: BTYPES[q[0]], side: q[1], t: Math.max(0, q[2] / 10 - dtA)})),
        bn: a.bn ? {type: BTYPES[a.bn[0]], x: a.bn[1] * W, y: a.bn[2] * L, t: a.bn[3] / 10 + dtA, r: 30, life: 11} : null,
        w: a.w, ff: a.ff, tz: a.tz, latestT: buf[buf.length - 1].t};
    }
    const vHas = (v, type, side) => v.e.some(e => e.type === type && (side == null || e.side === side));

    /* ================= Entrées locales ================= */
    let matchOver = false, localT = 0.5, lastSent = -1, lastSendAt = 0, sendTimer = null, interacted = false;
    function queueSend() {
      if (mySeat < 0 || !alive || matchOver) return;
      const r = r3(localT);
      if (r === lastSent) return;
      const now = performance.now();
      if (now - lastSendAt >= 50) { lastSendAt = now; lastSent = r; api.setInput({x: r}); }
      else if (!sendTimer) sendTimer = setTimeout(() => { sendTimer = null; queueSend(); }, 52 - (now - lastSendAt));
    }
    function setTarget(v) { localT = clamp(v, 0, 1); interacted = true; queueSend(); }
    // Vue : rot 0 = joueur 1 en bas (portrait), 2 = tourné de 180°, 1/3 = paysage (ma raquette à gauche)
    const V = {rot: 0, s: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1, w: 0, h: 0, M: [1, 0, 0, 1, 0, 0]};
    function screenToSimX(cx, cy) {
      const X = (cx - V.ox) / V.s, Y = (cy - V.oy) / V.s;
      return V.rot === 0 ? X : V.rot === 2 ? W - X : V.rot === 1 ? Y : W - Y;
    }
    const pointers = new Set();
    function pointerTarget(e) {
      const r = canvas.getBoundingClientRect();
      setTarget(screenToSimX(e.clientX - r.left, e.clientY - r.top) / W);
    }
    function onDown(e) {
      ensureAudio();
      if (mySeat < 0) return;
      if (e.target.closest && e.target.closest(".pg-btn")) return;
      pointers.add(e.pointerId);
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointerTarget(e);
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (mySeat < 0) return;
      if (pointers.has(e.pointerId) || e.pointerType === "mouse") pointerTarget(e);
    }
    function onUp(e) { pointers.delete(e.pointerId); }
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("lostpointercapture", onUp);
    const NEG = new Set(["ArrowLeft", "ArrowUp", "KeyW", "KeyZ", "KeyA", "KeyQ"]);
    const POS = new Set(["ArrowRight", "ArrowDown", "KeyS", "KeyD"]);
    const keyName = e => {
      const k = (e.key || "").toLowerCase();
      if (NEG.has(e.code) || ["arrowleft", "arrowup", "w", "z", "q", "a"].includes(k)) return "n";
      if (POS.has(e.code) || ["arrowright", "arrowdown", "s", "d"].includes(k)) return "p";
      return null;
    };
    const held = new Map();
    function onKeyDown(e) {
      ensureAudio();
      const tg = e.target, tag = tg && tg.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const a = keyName(e);
      if (!a || mySeat < 0) return;
      e.preventDefault();
      held.set(e.code || e.key, a);
    }
    function onKeyUp(e) { held.delete(e.code || e.key); }
    function onBlur() { held.clear(); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    /* ================= Mise en page ================= */
    const table = document.createElement("canvas"), tctx = table.getContext("2d");
    function layout() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const land = r.width > r.height * 1.1;
      const base = mySeat === 1 ? 2 : 0;
      const rot = land ? (base === 2 ? 3 : 1) : base;
      const cw = land ? L : W, chh = land ? W : L, pad = 6;
      const s = Math.max(0.05, Math.min((r.width - 2 * pad) / cw, (r.height - 2 * pad) / chh));
      const changed = V.w !== r.width || V.h !== r.height || V.dpr !== dpr || V.rot !== rot;
      Object.assign(V, {rot, s, dpr, w: r.width, h: r.height, cw, ch: chh, ox: (r.width - s * cw) / 2, oy: (r.height - s * chh) / 2,
        M: rot === 0 ? [1, 0, 0, 1, 0, 0] : rot === 2 ? [-1, 0, 0, -1, W, L] : rot === 1 ? [0, 1, -1, 0, L, 0] : [0, -1, 1, 0, 0, W]});
      if (changed) {
        setHint(land);
        canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        table.width = canvas.width; table.height = canvas.height;
        buildTable();
      }
    }
    function setM(c, sx, sy) {
      const [a, b, cc, d, e, f] = V.M, k = V.dpr * V.s;
      c.setTransform(k * a, k * b, k * cc, k * d, V.dpr * (V.s * e + V.ox + (sx || 0)), V.dpr * (V.s * f + V.oy + (sy || 0)));
    }
    function toScreen(x, y) {
      const [a, b, c, d, e, f] = V.M;
      return [V.ox + V.s * (a * x + c * y + e), V.oy + V.s * (b * x + d * y + f)];
    }
    function setUpright(c, X, Y, k, sx, sy) { c.setTransform(V.dpr * k, 0, 0, V.dpr * k, V.dpr * (X + (sx || 0)), V.dpr * (Y + (sy || 0))); }
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(layout); ro.observe(stage); }
    window.addEventListener("resize", layout);

    /* ================= Dessin ================= */
    function rr(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    function star4(c, x, y, r) {
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      c.closePath();
    }
    function buildTable() {
      const t = tctx;
      t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, table.width, table.height);
      setM(t); t.lineJoin = "round"; t.lineCap = "round";
      // cadre en sucre d'orge
      rr(t, 3, 3, W - 6, L - 6, 46); t.fillStyle = "#FF7EB0"; t.fill();
      t.save(); rr(t, 3, 3, W - 6, L - 6, 46); t.clip();
      t.strokeStyle = "rgba(255,255,255,.6)"; t.lineWidth = 13;
      for (let y = -W; y < L + W; y += 38) { t.beginPath(); t.moveTo(0, y); t.lineTo(W, y + W); t.stroke(); }
      t.restore();
      // gouttières de but (siège 0 en bas, siège 1 en haut)
      for (let s = 0; s < 2; s++) {
        const y = s === 0 ? L - SIDE - 1 : 4;
        rr(t, WALL - 4, y, W - 2 * WALL + 8, SIDE - 3, 8); t.fillStyle = INK; t.fill();
        t.fillStyle = COLORS[s]; t.globalAlpha = 0.55; rr(t, WALL + 8, y + 4, W - 2 * WALL - 16, SIDE - 11, 4); t.fill(); t.globalAlpha = 1;
      }
      // surface menthe crème
      rr(t, WALL, SIDE, W - 2 * WALL, L - 2 * SIDE, 28); t.fillStyle = "#F2FBF3"; t.fill();
      t.save(); rr(t, WALL, SIDE, W - 2 * WALL, L - 2 * SIDE, 28); t.clip();
      const k = V.dpr * V.s, ts = 70;
      const tile = document.createElement("canvas");
      tile.width = Math.max(1, Math.round(ts * k)); tile.height = tile.width;
      const pc = tile.getContext("2d"); pc.setTransform(tile.width / ts, 0, 0, tile.width / ts, 0, 0);
      pc.fillStyle = "#D3F0DC"; star4(pc, 17, 17, 7); pc.fill();
      pc.fillStyle = "#FFDCE9"; pc.beginPath(); pc.arc(52, 52, 4, 0, 7); pc.fill();
      pc.fillStyle = "#DDF1FF"; pc.beginPath(); pc.arc(52, 17, 2.2, 0, 7); pc.fill();
      pc.fillStyle = "#FFF0C2"; pc.beginPath(); pc.arc(17, 52, 2.2, 0, 7); pc.fill();
      let pat = null;
      try { pat = t.createPattern(tile, "repeat"); if (pat && pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix().scale(ts / tile.width)); } catch (e) { pat = null; }
      t.fillStyle = pat || "#F2FBF3"; t.fillRect(WALL, SIDE, W - 2 * WALL, L - 2 * SIDE);
      for (let s = 0; s < 2; s++) {
        const cy = s === 0 ? L - SIDE : SIDE;
        t.beginPath(); t.arc(W / 2, cy, 120, 0, Math.PI * 2);
        t.fillStyle = COLORS[s]; t.globalAlpha = 0.1; t.fill(); t.globalAlpha = 0.55; t.lineWidth = 4; t.strokeStyle = COLORS[s]; t.stroke(); t.globalAlpha = 1;
        const ly = s === 0 ? L * 0.7 : L * 0.3;
        t.fillStyle = COLORS[s]; t.globalAlpha = 0.28; t.fillRect(WALL, ly - 4, W - 2 * WALL, 8); t.globalAlpha = 1;
        for (const fx of [W * 0.27, W * 0.73]) {
          const fy = s === 0 ? L * 0.82 : L * 0.18;
          t.beginPath(); t.arc(fx, fy, 22, 0, 7); t.strokeStyle = COLORS[s]; t.globalAlpha = 0.4; t.lineWidth = 3; t.stroke();
          t.beginPath(); t.arc(fx, fy, 6, 0, 7); t.fillStyle = COLORS[s]; t.fill(); t.globalAlpha = 1;
        }
      }
      t.setLineDash([20, 14]); t.lineWidth = 6; t.strokeStyle = "#FF7EB0";
      t.beginPath(); t.moveTo(WALL, L / 2); t.lineTo(W - WALL, L / 2); t.stroke(); t.setLineDash([]);
      t.beginPath(); t.arc(W / 2, L / 2, 92, 0, Math.PI * 2); t.fillStyle = "#FFF4D6"; t.fill();
      t.lineWidth = 6; t.strokeStyle = "#FF7EB0"; t.stroke();
      t.beginPath(); t.arc(W / 2, L / 2, 80, 0, Math.PI * 2);
      t.setLineDash([3, 10]); t.lineWidth = 4; t.strokeStyle = "#FFC83D"; t.stroke(); t.setLineDash([]);
      t.restore();
      // texte du rond central, toujours à l'endroit
      const [cx, cy] = toScreen(W / 2, L / 2);
      t.save(); setUpright(t, cx, cy, V.s);
      t.fillStyle = "rgba(255,126,176,.5)"; t.textAlign = "center"; t.textBaseline = "middle";
      t.font = "34px " + DISPLAY; t.fillText("PONG", 0, -16);
      t.font = "26px " + DISPLAY; t.fillText("DÉLIRE", 0, 16);
      t.restore();
      // ombre intérieure et contours
      setM(t);
      t.save(); rr(t, WALL, SIDE, W - 2 * WALL, L - 2 * SIDE, 28); t.clip();
      t.shadowColor = "rgba(59,31,58,.35)"; t.shadowBlur = 18 * k; t.lineWidth = 10; t.strokeStyle = "rgba(59,31,58,.5)";
      rr(t, WALL - 5, SIDE - 5, W - 2 * WALL + 10, L - 2 * SIDE + 10, 32); t.stroke();
      t.restore();
      rr(t, WALL, SIDE, W - 2 * WALL, L - 2 * SIDE, 28); t.lineWidth = 4; t.strokeStyle = INK; t.stroke();
      rr(t, 3, 3, W - 6, L - 6, 46); t.lineWidth = 6; t.strokeStyle = INK; t.stroke();
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive && V.w) buildTable(); }).catch(() => {});

    // ---------- effets visuels locaux ----------
    const FX = {particles: [], floats: [], confetti: [], flash: null, shake: 0, time: 0, party: 0, over: false};
    const pads = [0, 1].map(() => ({sq: 0, surprised: 0, happy: 0, blinkIn: rand(1.5, 4), blinkT: 0, lx: 0, ly: 0}));
    const me = {x: W / 2, vx: 0};
    const trails = new Map();
    function burst(x, y, color, n, speed, ang) {
      if (RM) n = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const a = ang == null ? Math.random() * Math.PI * 2 : ang + rand(-0.9, 0.9), s = speed * rand(0.3, 1);
        FX.particles.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.3, 0.75),
          color: Math.random() < 0.3 ? "#FFC83D" : color, size: rand(2, 5), star: Math.random() < 0.35});
      }
      if (FX.particles.length > 400) FX.particles.splice(0, FX.particles.length - 400);
    }
    function launchConfetti() {
      if (RM) return;
      const cols = ["#FF5A47", "#17BFB0", "#FFC83D", "#FF7EB0", "#B79CFF", "#7BD389", "#FFFFFF"];
      for (let i = 0; i < 160; i++) {
        FX.confetti.push({x: rand(0, V.w), y: rand(-V.h * 0.5, -10), vx: rand(-40, 40), vy: rand(60, 160), rot: rand(0, 6), vr: rand(-8, 8),
          w: rand(6, 12), h: rand(4, 7), color: cols[(Math.random() * cols.length) | 0], sway: rand(0, 6)});
      }
    }
    function addFloat(x, y, text, color, size, life, dy) {
      FX.floats.push({x, y, text, color, size, life: life || 1.6, t: 0, dy: dy || 0});
    }
    function fireEvent(e) {
      const code = e[2], a = e.slice(3);
      if (code === 1) { // touche de raquette
        const s = a[0]; pads[s].sq = 1;
        burst(a[2] * W, a[3] * L, COLORS[s], 14, 340, s === 0 ? -Math.PI / 2 : Math.PI / 2);
        sfx.hit(a[1]);
      } else if (code === 2) { burst(a[0] * W, a[1] * L, "#FF7EB0", 5, 160); sfx.wall(); }
      else if (code === 3) { // but
        const scorer = a[0], gy = scorer === 0 ? SIDE : L - SIDE;
        burst(a[2] * W, gy, COLORS[scorer], 46, 520, scorer === 0 ? Math.PI / 2 : -Math.PI / 2);
        FX.shake = RM ? 0 : 16;
        FX.floats = FX.floats.filter(f => !f.bonus);
        FX.flash = {t: 0, life: 1.4, side: scorer, text: EXCL[a[1]] || "BOUM !"};
        pads[1 - scorer].surprised = 1.6; pads[scorer].happy = 1.6;
        sfx.goal();
      } else if (code === 4) { // bonus ramassé
        const type = BTYPES[a[0]], who = a[1], B = BONUS[type];
        const x = a[3] * W, y = a[4] * L;
        FX.floats = FX.floats.filter(f => !f.bonus);
        addFloat(x, y, B.label + " !", B.color, 0.085, 1.6); FX.floats[FX.floats.length - 1].bonus = 1;
        addFloat(x, y, who === mySeat ? "pour toi !" : "pour " + name(who), "#FFFFFF", 0.05, 1.6, 1); FX.floats[FX.floats.length - 1].bonus = 1;
        burst(x, y, B.color, 30, 380);
        sfx.bonus(type === "mini" || type === "invert");
        announce(B.label + " pour " + name(who));
      } else if (code === 5) sfx.spawn();
      else if (code === 6) { addFloat(W / 2, L / 2, "Allez !", "#FFC83D", 0.11, 0.9); sfx.go(); }
      else if (code === 7) burst(a[0] * W, a[1] * L, BONUS[BTYPES[a[2]]].color, 12, 160);
      else if (code === 8) {
        const w = a[0]; pads[w].happy = 99; pads[1 - w].surprised = 99;
        launchConfetti(); sfx.win();
      }
    }

    function drawBulbs(c, ph) {
      const step = 40, chase = Math.floor(FX.time * 7), party = FX.flash && FX.flash.t < 1;
      let i = 0;
      for (const x of [WALL / 2 + 1, W - WALL / 2 - 1]) {
        for (let y = 80; y <= L - 80; y += step, i++) {
          const lit = party ? (Math.floor(FX.time * 14) % 2 === 0) : ((i + chase) % 4 === 0 || ph === "o");
          if (lit) { c.beginPath(); c.arc(x, y, 11, 0, 7); c.fillStyle = "rgba(255,229,138,.45)"; c.fill(); }
          c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fillStyle = lit ? "#FFE58A" : "#FFF6E6"; c.fill();
          c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        }
      }
    }
    function capsuleH(c, x, y, len, th) { rr(c, x - len / 2, y - th / 2, len, th, th / 2); }
    function drawBonusIcon(c, type) {
      c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = "#FFFFFF"; c.lineJoin = "round"; c.lineCap = "round";
      const chevron = (x, y, d) => { c.beginPath(); c.moveTo(x - 5, y + 3 * d); c.lineTo(x, y - 2 * d); c.lineTo(x + 5, y + 3 * d); c.stroke(); };
      const vcap = (w, h) => rr(c, -w / 2, -h / 2, w, h, w / 2);
      switch (type) {
        case "giant": vcap(10, 22); c.fill(); c.stroke(); chevron(0, -17, 1); chevron(0, 17, -1); break;
        case "mini": vcap(10, 10); c.fill(); c.stroke(); chevron(0, -14, -1); chevron(0, 14, 1); break;
        case "ghost":
          c.beginPath(); c.moveTo(-11, 13); c.lineTo(-11, -2); c.arc(0, -2, 11, Math.PI, 0); c.lineTo(11, 13);
          c.lineTo(7, 9); c.lineTo(3.5, 13); c.lineTo(0, 9); c.lineTo(-3.5, 13); c.lineTo(-7, 9); c.closePath();
          c.fill(); c.stroke();
          c.fillStyle = INK; c.beginPath(); c.arc(-4, -2, 2.2, 0, 7); c.arc(4, -2, 2.2, 0, 7); c.fill(); break;
        case "multi":
          for (const [x, y] of [[0, -8], [-8, 6], [8, 6]]) { c.beginPath(); c.arc(x, y, 6, 0, 7); c.fillStyle = "#FFC83D"; c.fill(); c.stroke(); }
          break;
        case "turtle":
          c.beginPath(); c.arc(13, 3, 4.5, 0, 7); c.fill(); c.stroke();
          for (const x of [-8, 6]) { c.beginPath(); c.arc(x, 8, 3.5, 0, 7); c.fill(); c.stroke(); }
          c.beginPath(); c.arc(-1, 6, 12, Math.PI, 0); c.closePath(); c.fillStyle = "#3FA45B"; c.fill(); c.stroke();
          c.beginPath(); c.moveTo(-7, 0); c.lineTo(-1, -3); c.lineTo(5, 0); c.lineWidth = 2; c.stroke(); break;
        case "invert":
          c.lineWidth = 3.5;
          c.beginPath(); c.moveTo(-6, 12); c.lineTo(-6, -11); c.moveTo(-11, -6); c.lineTo(-6, -12); c.lineTo(-1, -6); c.stroke();
          c.beginPath(); c.moveTo(6, -12); c.lineTo(6, 11); c.moveTo(1, 6); c.lineTo(6, 12); c.lineTo(11, 6); c.stroke(); break;
        case "zigzag":
          c.lineWidth = 4;
          c.beginPath(); c.moveTo(-13, 6); c.lineTo(-6, -7); c.lineTo(0, 6); c.lineTo(6, -7); c.lineTo(12, 5); c.stroke();
          c.strokeStyle = "#FFFFFF"; c.lineWidth = 1.5; c.stroke(); break;
      }
    }
    function drawBonus(c, v, sx, sy) {
      const b = v.bn; if (!b) return;
      const B = BONUS[b.type];
      const appear = Math.min(1, b.t * 3.5);
      const sc = appear < 1 ? 1 - Math.pow(1 - appear, 3) * Math.cos(appear * 8) : 1;
      if (b.life - b.t < 2 && Math.floor(b.t * 10) % 2 === 0) return;
      const [X, Y] = toScreen(b.x, b.y);
      c.save(); setUpright(c, X, Y + Math.sin(FX.time * 4) * 3 * V.s, V.s * sc * 1.1, sx, sy);
      c.beginPath(); c.arc(4, 7, b.r, 0, 7); c.fillStyle = "rgba(59,31,58,.18)"; c.fill();
      c.save(); c.rotate(FX.time * 1.4); c.setLineDash([6, 8]); c.lineWidth = 3; c.strokeStyle = B.color;
      c.beginPath(); c.arc(0, 0, b.r + 9, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
      c.beginPath(); c.arc(0, 0, b.r, 0, 7); c.fillStyle = B.color; c.fill();
      c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(-8, -9, 6, 0, 7); c.fillStyle = "rgba(255,255,255,.55)"; c.fill();
      drawBonusIcon(c, b.type);
      c.restore();
    }
    function drawBalls(c, v, sx, sy) {
      const ghost = vHas(v, "ghost");
      const ghostA = ghost ? (Math.sin(FX.time * 11) > 0.2 ? 0.55 : 0.07) : 1;
      for (const b of v.balls) {
        const tr = trails.get(b.id);
        setM(c, sx, sy);
        if (!ghost && tr && tr.length > 2) {
          const n = tr.length / 2;
          for (let i = 0; i < n; i++) {
            const k = (i + 1) / n;
            c.globalAlpha = 0.28 * k; c.fillStyle = b.last >= 0 ? COLORS_LIGHT[b.last] : "#FFC9DD";
            c.beginPath(); c.arc(tr[i * 2], tr[i * 2 + 1], BALL_R * (0.35 + 0.65 * k), 0, 7); c.fill();
          }
          c.globalAlpha = 1;
        }
        const [X, Y] = toScreen(b.x, b.y);
        setUpright(c, X, Y, V.s, sx, sy);
        c.globalAlpha = ghostA;
        let r = BALL_R;
        if (v.ph === "c") r *= 1 + Math.sin(FX.time * 10) * 0.08;
        c.beginPath(); c.arc(3, 5, r, 0, 7); c.fillStyle = "rgba(59,31,58,.2)"; c.fill();
        c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = "#FFC83D"; c.fill();
        c.lineWidth = 3.5; c.strokeStyle = b.last >= 0 ? COLORS[b.last] : "#FF7EB0";
        c.beginPath(); c.arc(0, 0, r - 4, 0, 7); c.stroke();
        c.lineWidth = 3; c.strokeStyle = INK; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
        c.beginPath(); c.arc(-3.5, -3.5, 2.8, 0, 7); c.fillStyle = "#FFFFFF"; c.fill();
        c.globalAlpha = 1;
      }
    }
    function drawPaddle(c, v, s, x, h, sx, sy) {
      const p = pads[s], y = PY[s];
      // ombre décalée vers le bas de l'écran
      const [a, b, cc, d] = V.M;
      setM(c, sx, sy);
      c.fillStyle = "rgba(59,31,58,.2)"; capsuleH(c, x + (a * 4 + b * 7), y + (cc * 4 + d * 7), h, PT); c.fill();
      c.save(); c.translate(x, y); c.scale(1 - 0.16 * p.sq, 1 + 0.32 * p.sq);
      capsuleH(c, 0, 0, h, PT); c.fillStyle = COLORS[s]; c.fill();
      c.save(); capsuleH(c, 0, 0, h, PT); c.clip();
      c.fillStyle = "rgba(255,255,255,.3)"; c.fillRect(-h / 2, -PT / 2 + 5, h, 7);
      c.fillStyle = "rgba(0,0,0,.09)"; c.fillRect(-h / 2, PT / 2 - 8, h, 8);
      c.fillStyle = "rgba(255,255,255,.92)"; c.fillRect(-h / 2 + 13, -PT / 2, 5, PT); c.fillRect(h / 2 - 18, -PT / 2, 5, PT);
      c.restore();
      c.lineWidth = 4; c.strokeStyle = INK; capsuleH(c, 0, 0, h, PT); c.stroke();
      c.restore();
      // visage, toujours à l'endroit, qui regarde la balle la plus proche
      const [X, Y] = toScreen(x, y);
      setUpright(c, X, Y, V.s * 1.05, sx, sy);
      const ey = -6, ex = 9;
      const inv = vHas(v, "invert", s);
      const surprised = p.surprised > 0, happy = p.happy > 0 && !surprised;
      c.lineCap = "round"; c.lineJoin = "round";
      c.fillStyle = "rgba(255,126,176,.8)";
      c.beginPath(); c.ellipse(-17, 7, 3.6, 2.6, 0, 0, 7); c.ellipse(17, 7, 3.6, 2.6, 0, 0, 7); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2.5;
      if (happy) {
        for (const q of [-1, 1]) { c.beginPath(); c.arc(q * ex, ey + 2, 5, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        c.beginPath(); c.arc(0, 5, 7, 0, Math.PI); c.closePath(); c.fillStyle = INK; c.fill();
        c.beginPath(); c.arc(0, 9.5, 3, 0, Math.PI); c.fillStyle = "#FF7EB0"; c.fill();
      } else {
        const er = surprised ? 8 : 6.5;
        for (const q of [-1, 1]) {
          c.beginPath(); c.arc(q * ex, ey, er, 0, 7); c.fillStyle = "#FFFFFF"; c.fill(); c.stroke();
          if (p.blinkT > 0 && !surprised) {
            c.fillStyle = COLORS[s]; c.beginPath(); c.arc(q * ex, ey, er + 1, 0, 7); c.fill();
            c.beginPath(); c.moveTo(q * ex - 5, ey); c.lineTo(q * ex + 5, ey); c.stroke();
          } else if (inv) {
            c.beginPath();
            const rot = FX.time * 9 * q;
            for (let an = 0; an < Math.PI * 4; an += 0.3) { const q2 = an / (Math.PI * 4) * 5; c.lineTo(q * ex + Math.cos(an + rot) * q2, ey + Math.sin(an + rot) * q2); }
            c.lineWidth = 1.6; c.stroke(); c.lineWidth = 2.5;
          } else {
            const pr = surprised ? 2.4 : 3.2, off = surprised ? 1 : 3;
            c.beginPath(); c.arc(q * ex + p.lx * off, ey + p.ly * off, pr, 0, 7); c.fillStyle = INK; c.fill();
          }
        }
        if (surprised) {
          c.beginPath(); c.ellipse(0, 9, 4, 5, 0, 0, 7); c.fillStyle = INK; c.fill();
          for (const q of [-1, 1]) { c.beginPath(); c.moveTo(q * ex - 5, ey - 11); c.lineTo(q * ex + 5, ey - 13); c.stroke(); }
        } else if (inv) {
          c.beginPath();
          for (let xx = -7; xx <= 7; xx += 1) c.lineTo(xx, 8 + Math.sin(xx * 0.9 + FX.time * 8) * 1.8);
          c.stroke();
        } else {
          c.beginPath(); c.arc(0, 4, 5.5, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
          const threat = v.balls.some(b => (s === 0 ? b.vy > 0 : b.vy < 0) && Math.abs(b.y - y) < 320);
          if (threat) for (const q of [-1, 1]) { c.beginPath(); c.moveTo(q * ex - 5 * q, ey - 8); c.lineTo(q * ex + 5 * q, ey - 11); c.stroke(); }
        }
      }
    }
    function textOutlined(c, txt, x, y, size, fill, maxW, font) {
      c.font = size + "px " + (font || DISPLAY);
      if (maxW) { const tw = c.measureText(txt).width; if (tw > maxW) { size = Math.max(10, size * maxW / tw); c.font = size + "px " + (font || DISPLAY); } }
      c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
      c.lineWidth = Math.max(4, size * 0.16); c.strokeStyle = INK; c.strokeText(txt, x, y);
      c.fillStyle = fill; c.fillText(txt, x, y);
    }

    /* ================= Boucle d'affichage ================= */
    let raf = 0, lastFrame = 0, alive = true, prevPh = null, prevSc = [0, 0], prevCdN = 0, endShownAt = 0, playSeen = 0, chipSig = ["", ""];
    function updateChips(v) {
      for (let s = 0; s < 2; s++) {
        const list = v.e.filter(e => e.side === s);
        const sig = list.map(e => e.type).join(",");
        if (sig !== chipSig[s]) {
          chipSig[s] = sig;
          chipsEl[s].textContent = "";
          for (const e of list) {
            const ch = document.createElement("span");
            ch.className = "pg-chip"; ch.style.setProperty("--c", BONUS[e.type].color);
            const lab = document.createElement("span"); lab.textContent = BONUS[e.type].label;
            const bar = document.createElement("i");
            ch.appendChild(lab); ch.appendChild(bar); chipsEl[s].appendChild(ch);
          }
        }
        const chips = chipsEl[s].children;
        list.forEach((e, i) => {
          const ch = chips[i]; if (!ch) return;
          if (e.type === "multi") {
            const txt = "Multi-balles ×" + v.balls.length;
            if (ch.firstChild.textContent !== txt) ch.firstChild.textContent = txt;
            ch.lastChild.style.transform = "scaleX(1)";
          } else ch.lastChild.style.transform = "scaleX(" + clamp(e.t / BONUS[e.type].dur, 0, 1).toFixed(3) + ")";
        });
      }
    }
    function frame(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const now = ts / 1000;
      const dt = lastFrame ? clamp(now - lastFrame, 0, 0.05) : 0;
      lastFrame = now;
      FX.time += dt;
      if (!V.w) layout();
      if (!V.w) return;
      const v = computeView(nowS());
      // clavier : déplace ma cible
      if (mySeat >= 0 && held.size) {
        let dir = 0;
        for (const a of held.values()) dir += a === "p" ? 1 : -1;
        dir = clamp(dir, -1, 1);
        if (dir) {
          const h = v ? v.h[mySeat] : PH, [lo, hi] = padRange(h);
          const inv = v && vHas(v, "invert", mySeat);
          let cur = clamp(localT * W, inv ? W - hi : lo, inv ? W - lo : hi);
          cur += dir * (mySeat === 1 ? -1 : 1) * 950 * dt;
          setTarget(cur / W);
        }
      }
      if (v) {
        // événements ponctuels synchronisés sur l'image affichée
        const tooOld = v.latestT - 0.6;
        while (evQueue.length && (evQueue[0][1] * TICK <= v.rt || evQueue[0][1] * TICK < tooOld)) fireEvent(evQueue.shift());
        // ma raquette, prédite localement
        if (mySeat >= 0) { stepPad(me, localT, vHas(v, "invert", mySeat), v.h[mySeat], dt); v.px[mySeat] = me.x; }
        // changements discrets
        if (v.ph === "c") {
          const n = Math.max(1, Math.ceil(v.cd / (v.sc[0] + v.sc[1] === 0 ? 1.2 : 0.7)));
          if (n !== prevCdN) { prevCdN = n; sfx.count(); }
        } else prevCdN = 0;
        for (let s = 0; s < 2; s++) {
          if (v.sc[s] !== prevSc[s]) {
            scoreEl[s].textContent = String(v.sc[s]);
            if (v.sc[s] > prevSc[s]) { scoreEl[s].classList.remove("pg-bump"); void scoreEl[s].offsetWidth; scoreEl[s].classList.add("pg-bump"); announce(`${name(s)} marque ! ${v.sc[0]} à ${v.sc[1]}`); }
            prevSc[s] = v.sc[s];
          }
        }
        if (v.ph === "p" && !playSeen) playSeen = now;
        if ((playSeen && now - playSeen > 2.5) || (interacted && mySeat >= 0 && playSeen) || v.ph === "o") hintEl.classList.add("pg-off");
        if (v.ph === "o" && v.w != null && !FX.over) {
          FX.over = true; matchOver = true; endShownAt = now + 0.7;
          endEl.querySelector("h2 span").textContent = name(v.w);
          endEl.querySelector("h2 span").style.setProperty("--wc", COLORS[v.w]);
          endEl.querySelector(".pg-fin").textContent = `${v.sc[v.w]} – ${v.sc[1 - v.w]}`;
          endEl.querySelector(".pg-tease").textContent = v.ff ? `Victoire par forfait : ${name(1 - v.w)} a quitté la table !` : (mySeat === v.w ? "Bravo, champion de la fête foraine ! " : "") + (TEASES[v.tz] || TEASES[0]);
          announce(`${name(v.w)} gagne la partie !`);
        }
        if (FX.over && endEl.hidden && now >= endShownAt) endEl.hidden = false;
        prevPh = v.ph;
        updateChips(v);
        // traînées des balles
        const ids = new Set();
        for (const b of v.balls) {
          ids.add(b.id);
          let tr = trails.get(b.id); if (!tr) { tr = []; trails.set(b.id, tr); }
          if (v.ph === "p") { tr.push(b.x, b.y); if (tr.length > 28) tr.splice(0, 2); } else tr.length = 0;
        }
        for (const id of [...trails.keys()]) if (!ids.has(id)) trails.delete(id);
      }
      // animation des visages
      for (let s = 0; s < 2; s++) {
        const p = pads[s];
        p.sq = Math.max(0, p.sq - dt * 4.5); p.surprised = Math.max(0, p.surprised - dt); p.happy = Math.max(0, p.happy - dt);
        p.blinkIn -= dt; if (p.blinkIn <= 0) { p.blinkT = 0.13; p.blinkIn = rand(2, 5); }
        p.blinkT = Math.max(0, p.blinkT - dt);
        if (v) {
          const px = v.px[s];
          let tx = W / 2, ty = L / 2, bd = Infinity;
          for (const b of v.balls) { const d = Math.abs(b.y - PY[s]); if (d < bd) { bd = d; tx = b.x; ty = b.y; } }
          const [X0, Y0] = toScreen(px, PY[s]), [X1, Y1] = toScreen(tx, ty);
          const dx = X1 - X0, dy = Y1 - Y0, l = Math.hypot(dx, dy) || 1;
          p.lx += (dx / l - p.lx) * Math.min(1, dt * 12); p.ly += (dy / l - p.ly) * Math.min(1, dt * 12);
        }
      }
      for (const pt of FX.particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; }
      FX.particles = FX.particles.filter(pt => pt.t < pt.life);
      for (const f of FX.floats) f.t += dt;
      FX.floats = FX.floats.filter(f => f.t < f.life);
      for (const cf of FX.confetti) { cf.vy = Math.min(cf.vy + 120 * dt, 220); cf.x += (cf.vx + Math.sin(FX.time * 3 + cf.sway) * 30) * dt; cf.y += cf.vy * dt; cf.rot += cf.vr * dt; }
      FX.confetti = FX.confetti.filter(cf => cf.y < V.h + 30);
      if (FX.flash) { FX.flash.t += dt; if (FX.flash.t > FX.flash.life) FX.flash = null; }
      FX.shake *= Math.exp(-dt * 7); if (FX.shake < 0.2) FX.shake = 0;
      draw(v);
    }
    function draw(v) {
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      const sh = FX.shake > 0 && !RM ? FX.shake * V.s : 0;
      const sx = sh ? rand(-1, 1) * sh : 0, sy = sh ? rand(-1, 1) * sh : 0;
      c.setTransform(1, 0, 0, 1, V.dpr * sx, V.dpr * sy);
      c.drawImage(table, 0, 0);
      setM(c, sx, sy);
      drawBulbs(c, v ? v.ph : "c");
      const cs = V.s * W; // largeur de la table à l'écran (petit côté)
      const [CX, CY] = toScreen(W / 2, L / 2);
      if (!v) {
        c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
        textOutlined(c, "Connexion à l'hôte…", CX, CY - cs * 0.3, cs * 0.07, "#FFFFFF", cs * 0.9);
        return;
      }
      drawBonus(c, v, sx, sy);
      drawBalls(c, v, sx, sy);
      for (let s = 0; s < 2; s++) drawPaddle(c, v, s, v.px[s], v.h[s], sx, sy);
      setM(c, sx, sy);
      for (const pt of FX.particles) {
        c.globalAlpha = 1 - pt.t / pt.life; c.fillStyle = pt.color;
        if (pt.star) { star4(c, pt.x, pt.y, pt.size * 1.8); c.fill(); }
        else { c.strokeStyle = pt.color; c.lineWidth = pt.size; c.lineCap = "round"; c.beginPath(); c.moveTo(pt.x, pt.y); c.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03); c.stroke(); }
      }
      c.globalAlpha = 1;
      c.setTransform(V.dpr, 0, 0, V.dpr, V.dpr * sx, V.dpr * sy);
      if (FX.flash) {
        const f = FX.flash;
        const fa = Math.max(0, (RM ? 0.18 : 0.4) * (1 - f.t / 0.35));
        if (fa > 0) { c.fillStyle = COLORS[f.side]; c.globalAlpha = fa; c.fillRect(-20, -20, V.w + 40, V.h + 40); c.globalAlpha = 1; }
        const k = Math.min(1, f.t / 0.3);
        const s = RM ? 1 : (k < 1 ? 0.3 + 0.7 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)) : 1);
        c.save(); c.globalAlpha = Math.max(0, f.t > f.life - 0.35 ? (f.life - f.t) / 0.35 : 1);
        c.translate(CX, CY - cs * 0.05); c.rotate(-0.07); c.scale(s, s);
        textOutlined(c, f.text, 0, 0, cs * 0.15, "#FFFFFF", Math.min(V.w, cs * 1.4) - 24);
        textOutlined(c, (f.side === mySeat ? "Tu marques !" : name(f.side) + " marque !"), 0, cs * 0.13, cs * 0.065, COLORS[f.side], Math.min(V.w, cs * 1.4) - 40);
        c.restore();
      }
      for (const fl of FX.floats) {
        const k = fl.t / fl.life, pop = Math.min(1, fl.t / 0.15), size = fl.size * cs;
        let [X, Y] = toScreen(fl.x, fl.y);
        Y += fl.dy ? size * 1.5 : -size * 0.3;
        c.font = size + "px " + DISPLAY;
        const tw = Math.min(c.measureText(fl.text).width, V.w - 24);
        X = clamp(X, 12 + tw / 2, V.w - 12 - tw / 2);
        c.save(); c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.translate(X, Y - k * cs * 0.08); c.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
        textOutlined(c, fl.text, 0, 0, size, fl.color, V.w - 24);
        c.restore();
      }
      if (v.ph === "c") {
        const first = v.sc[0] + v.sc[1] === 0;
        const per = first ? 1.2 : 0.7;
        const n = clamp(Math.ceil(v.cd / per), 1, 3);
        const frac = v.cd / per - Math.floor(v.cd / per);
        const s = RM ? 1 : 1 + Math.max(0, frac - 0.6) * 1.6;
        textOutlined(c, first ? "Prêts ?" : "Engagement !", CX, CY - cs * 0.3, cs * 0.075, "#FFFFFF", cs * 0.9);
        if (first && mySeat >= 0) textOutlined(c, "Premier à " + TARGET + " points", CX, CY - cs * 0.21, cs * 0.05, "#FFC83D", cs * 0.9);
        c.save(); c.translate(CX, CY); c.scale(s, s);
        textOutlined(c, String(n), 0, 0, cs * 0.26, ["#FFC83D", "#FF7EB0", "#17BFB0"][n - 1] || "#FFC83D");
        c.restore();
      } else if (v.ph === "o" && v.w != null && endEl.hidden) {
        textOutlined(c, name(v.w) + " gagne !", CX, CY - cs * 0.3, cs * 0.09, COLORS[v.w], cs * 0.95);
      }
      for (const cf of FX.confetti) {
        c.save(); c.translate(cf.x, cf.y); c.rotate(cf.rot); c.scale(1, Math.cos(cf.rot * 1.7));
        c.fillStyle = cf.color; c.fillRect(-cf.w / 2, -cf.h / 2, cf.w, cf.h); c.restore();
      }
    }

    /* ================= Démarrage ================= */
    layout();
    raf = requestAnimationFrame(frame);
    if (api.isHost) { lastHT = performance.now(); publish(); hostTimer = setInterval(hostLoop, 8); }
    if (mySeat >= 0) { lastSent = -1; queueSend(); }

    // Petit crochet de test (inoffensif) : statistiques et accélérateurs pour les tests automatisés.
    const dbg = {
      seat: mySeat, isHost: api.isHost,
      stats: () => Object.assign({rate: stats.t0 ? stats.pubs / ((performance.now() - stats.t0) / 1000) : 0}, stats),
      view: () => { const v = computeView(nowS()); return v && {ph: v.ph, sc: v.sc.slice(), balls: v.balls.length, bl: v.balls.map(b => [Math.round(b.x), Math.round(b.y), b.vy]), px: v.px.map(x => Math.round(x)), e: v.e.map(e => e.type + ":" + e.side), bn: v.bn && v.bn.type}; },
      host: api.isHost ? () => ({ph: H.ph, sc: H.sc.slice(), pads: H.pads.map(p => Math.round(p.x)), balls: H.balls.map(b => [Math.round(b.x), Math.round(b.y)]), targets: targets.slice(), effects: H.effects.map(e => e.type + ":" + e.side)}) : null,
      forceGoal: s => { if (!api.isHost) return false; forceGoalReq = s; return true; },
      drop: type => { if (!api.isHost || !BONUS[type]) return false; dropReq = type; return true; },
      target: () => localT,
      aim: x => setTarget(x)
    };
    window.__pongDebug = dbg;

    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        if (hostTimer) clearInterval(hostTimer);
        if (finishTimer) clearTimeout(finishTimer);
        if (sendTimer) clearTimeout(sendTimer);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("resize", layout);
        if (ro) ro.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onMq);
        if (actx) { try { actx.close(); } catch (e) { /* ignore */ } }
        if (window.__pongDebug === dbg) delete window.__pongDebug;
        el.innerHTML = "";
      }
    };
  }
});
