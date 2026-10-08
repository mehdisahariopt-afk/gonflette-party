/* Gonflette Party : Air hockey (2 joueurs, chacun sur son téléphone, spectateurs possibles).
   Muscle Beach au coucher du soleil : table en sable bordée de néons, palet « shaker de protéine »,
   maillets en disques de fonte. Premier à 7 buts, ou le plus de buts après 3 min (égalité : but en or).

   Réseau (p2p via un téléphone relais : 50 à 300 ms de latence, avec de la gigue) :
   - L'hôte simule la physique à pas fixe (120 Hz) et publie ~30 fois/s un état compact :
     tick k, palet [x, y, vx, vy, dans-le-but], maillets, score, chrono, accusés de frappe, écho d'horloge, événements.
   - Chaque joueur envoie ~30 fois/s la position de SON maillet, qu'il affiche lui-même sans aucune latence.
   - Chaque téléphone fait tourner sa propre simulation du palet, calée sur « l'heure de l'hôte » (tick reçu
     + demi-aller-retour mesuré, horloge ajustée en douceur). À chaque état reçu, le palet est remis à l'état de
     l'hôte au tick k puis les ticks suivants sont rejoués avec l'historique local des maillets : jamais de ralenti
     ni d'arrêt, et l'écart visuel restant est lissé en ~80 ms (pas de téléportation).
   - Frappes : le téléphone qui touche le palet avec SON maillet applique la frappe tout de suite et l'envoie
     (tick, palet avant/après, maillet). L'hôte la retrouve dans son historique (±120 ms, ±48 unités), rembobine
     et rejoue : la frappe est acceptée telle que le joueur l'a vue. Tant qu'elle n'est pas confirmée, ce
     téléphone ignore les corrections du palet. L'hôte ne fait pas collisionner le palet avec le maillet (en retard)
     d'un joueur distant : pas de frappe fantôme.
   - Un but dans la cage d'un joueur distant n'est validé qu'après un court délai (latence mesurée des frappes)
     pour laisser arriver un arrêt de dernière seconde.

   Repère : table W × L (600 × 1000). Le siège 0 défend le bas (y = L), le siège 1 le haut (y = 0).
   Chacun voit son but en bas (vue tournée de 180° pour le siège 1). */
GONFLETTE.registerGame({
  id: "airhockey",
  name: "Air hockey",
  min: 2,
  max: 2,
  create(api) {
    "use strict";
    /* ================= Constantes ================= */
    const W = 600, L = 1000, PR = 30, MR = 46, GW = 118, RIM = 30, MID = 16, GOAL_D = 6;
    const TICK = 1 / 120, PUB_MS = 33, SEND_MS = 30, N = 512;
    const FRICTION = 0.2, WALL_E = 0.9, HIT_E = 0.85, MMAX = 3000, MAXV = 1750, SMASH_V = 2150, SMASH_MV = 1950;
    const TARGET = 7, MATCH_T = 180, GOAL_PAUSE = 2.1, CD0 = 3.2;
    const INK = "#1d1420";
    const COL = ["#FF3D7F", "#19C8F0"], COL_L = ["#FFB3CC", "#A6ECFF"], COL_D = ["#C2185B", "#0A84B0"];
    const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
    const SCRIPT = 'Pacifico, "Brush Script MT", cursive';
    const EXCL = ["Dans la sacoche !", "Quelle patate !", "Lucarne protéinée !", "Pur jus de biceps !", "Ça, c'est du lourd !",
      "Smash de la plage !", "Envoyé, pesé !", "Direct au vestiaire !", "Quel missile !", "Gainage parfait !"];
    const TEASES = ["Le perdant range les haltères.", "Une tournée de shakers pour le champion !", "Leçon de muscu sur sable.",
      "On dit revanche ? On dit revanche.", "Même les mouettes ont applaudi."];

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const rand = (a, b) => a + Math.random() * (b - a);
    const nowS = () => performance.now() / 1000;
    const ri = Math.round;

    const el = api.el;
    const P = api.players;
    const mySeat = api.isPlayer === false ? -1 : P.findIndex(p => p.key === api.me);
    const viewSeat = mySeat >= 0 ? mySeat : 0, topSeat = 1 - viewSeat;
    const name = s => (P[s] ? P[s].pseudo : "?");

    let RM = false, mq = null;
    const onMq = e => { RM = e.matches; };
    try { mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches; if (mq.addEventListener) mq.addEventListener("change", onMq); } catch (e) { mq = null; }

    /* ================= Avatars (buste : normal, flex, facepalm) ================= */
    const AVM = (window.GONFLETTE && window.GONFLETTE.avatar) || null;
    function bust(s, pose) { try { return api.avatar(P[s].key, {pose, view: "bust"}) || ""; } catch (e) { return ""; } }
    function palmBust(s) {
      const base = bust(s, "idle");
      if (!base) return "";
      const p = P[s] || {};
      const m = AVM && AVM.muscle ? AVM.muscle(p.xp) : 0, mc = Math.min(m, 1);
      const r = 25 - 6 * mc - 2 * Math.max(0, m - 1), hx = 100, hy = 50 + 12 * m;
      const skin = (p.look && /^#[0-9a-f]{3,8}$/i.test(p.look.skin || "")) ? p.look.skin : "#eebe98";
      const f = v => Math.round(v * 10) / 10;
      // main sur les yeux (paume), doigts vers le front, avant-bras qui remonte du bas
      const ax = hx + r * 1.7, ay = hy + r * 3.4, px = hx + r * 0.1, py = hy - r * 0.12;
      let g = `<g class="ah-palm">`;
      for (const [c, w] of [[INK, r * 0.5 + 5], [skin, r * 0.5]]) g += `<path d="M${f(ax)} ${f(ay)}Q${f(hx + r * 1.3)} ${f(hy + r * 1.2)} ${f(px + r * 0.3)} ${f(py + r * 0.3)}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
      for (let i = 0; i < 4; i++) {
        const x0 = px - r * 0.42 + i * r * 0.27, y0 = py - r * 0.05, x1 = x0 - r * 0.12 + i * r * 0.03, y1 = py - r * (0.62 - Math.abs(i - 1.5) * 0.1);
        for (const [c, w] of [[INK, r * 0.2 + 3.6], [skin, r * 0.2]]) g += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
      }
      g += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(r * 0.56)}" ry="${f(r * 0.36)}" fill="${skin}" stroke="${INK}" stroke-width="2.2"/>`;
      g += `<path d="M${f(px - r * 0.4)} ${f(py + r * 0.05)}h${f(r * 0.8)}" stroke="${INK}" stroke-width="1.2" opacity=".35"/>`;
      g += `<path d="M${f(hx - r * 1.05)} ${f(hy - r * 0.75)}q-3 6 0 9q3-3 0-9z" fill="#7fd3ff" stroke="${INK}" stroke-width="1.6"/>`;
      g += `</g>`;
      const i = base.lastIndexOf("</svg>");
      return i < 0 ? base : base.slice(0, i) + g + base.slice(i);
    }

    /* ================= DOM ================= */
    const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="#1d1420" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="#1d1420"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
    const ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="#1d1420" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="#1d1420"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
    const avBox = s => `<div class="ah-av" aria-hidden="true"><div class="ah-pose ah-p-idle">${bust(s, "idle")}</div><div class="ah-pose ah-p-flex">${bust(s, "flex")}</div><div class="ah-pose ah-p-sad">${palmBust(s)}</div></div>`;
    const bar = (s, top) => `<div class="ah-bar ${top ? "ah-top" : "ah-bot"}" style="--pc:${COL[s]};--pcd:${COL_D[s]}">
        ${avBox(s)}
        <div class="ah-who"><small></small><b></b></div>
        <div class="ah-sc" aria-label="Buts">0</div>
        ${top ? `<div class="ah-side"><span class="ah-clock" aria-label="Temps restant">3:00</span><button class="ah-btn" type="button" aria-label="Couper le son" aria-pressed="false">${ICON_SOUND}</button></div>`
        : `<div class="ah-side"><span class="ah-to">Premier à ${TARGET}</span></div>`}
      </div>`;
    el.innerHTML = `<style>
      .ah{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;color:#fff;
        font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;background:#2b1d3a;
        touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
      .ah-scene{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
      .ah-bar{position:relative;z-index:2;flex:none;display:grid;grid-template-columns:58px minmax(0,1fr) auto auto;align-items:center;column-gap:8px;
        width:100%;max-width:560px;margin:0 auto;padding:5px 10px;height:66px;box-sizing:border-box}
      .ah-bar::before{content:"";position:absolute;inset:4px 6px;border-radius:16px;background:rgba(29,20,32,.78);border:2px solid var(--pc);
        box-shadow:0 0 12px var(--pc),inset 0 0 10px rgba(0,0,0,.4);z-index:-1}
      .ah-av{position:relative;width:54px;height:54px;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 70%,var(--pc),rgba(255,255,255,.08) 70%);
        border:2px solid ${INK};box-shadow:0 2px 0 ${INK}}
      .ah-pose{position:absolute;inset:0;transition:opacity .15s}
      .ah-pose .av{width:100%;height:100%;display:block}
      .ah-p-flex,.ah-p-sad{opacity:0}
      .ah-bar.ah-flex .ah-p-idle,.ah-bar.ah-sad .ah-p-idle{opacity:0}
      .ah-bar.ah-flex .ah-p-flex{opacity:1;animation:ah-hop .45s cubic-bezier(.3,1.8,.5,1) 3}
      .ah-bar.ah-sad .ah-p-sad{opacity:1;animation:ah-sad .8s ease-out both}
      @keyframes ah-hop{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-9%) scale(1.08)}100%{transform:none}}
      @keyframes ah-sad{0%{transform:none}30%{transform:translateY(4%) rotate(-4deg)}100%{transform:translateY(5%) rotate(-6deg)}}
      .ah-who{min-width:0;line-height:1.05}
      .ah-who small{display:block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--pc)}
      .ah-who b{display:block;font-size:20px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ah-sc{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:42px;line-height:1;color:#fff;min-width:.7em;text-align:center;
        -webkit-text-stroke:2px ${INK};paint-order:stroke fill;text-shadow:0 0 10px var(--pc),0 3px 0 ${INK}}
      .ah-sc.ah-bump{animation:ah-bump .55s cubic-bezier(.3,1.8,.5,1)}
      @keyframes ah-bump{0%{transform:scale(1.8) rotate(-10deg)}100%{transform:none}}
      .ah-side{display:flex;align-items:center;gap:6px}
      .ah-clock,.ah-to{font-family:Anton,Impact,sans-serif;font-size:17px;letter-spacing:.03em;color:${INK};background:#FFD23F;border:2px solid ${INK};
        border-radius:999px;padding:1px 9px;white-space:nowrap;box-shadow:0 2px 0 ${INK}}
      .ah-to{font-size:14px;background:#FFF3DC}
      .ah-clock.ah-hurry{background:#FF6B35;color:#fff;animation:ah-pulse .5s ease-in-out infinite alternate}
      .ah-clock.ah-gold{background:linear-gradient(90deg,#FFD23F,#FFF3A0,#FFD23F);animation:ah-pulse .4s ease-in-out infinite alternate}
      @keyframes ah-pulse{to{transform:scale(1.1)}}
      .ah-btn{position:relative;width:36px;height:36px;display:grid;place-items:center;padding:0;border:2px solid ${INK};border-radius:11px;background:#FFD23F;box-shadow:0 2px 0 ${INK};cursor:pointer}
      .ah-btn:active{transform:translateY(2px);box-shadow:none}
      .ah-btn::before{content:"";position:absolute;inset:-6px} /* zone tactile ≥ 44 px (kit) */
      .ah-btn svg{width:18px;height:18px}
      .ah-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .ah-stage{position:relative;z-index:1;flex:1;min-height:0}
      .ah-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
      .ah-hint{position:absolute;left:50%;top:60%;transform:translateX(-50%);max-width:calc(100% - 48px);width:max-content;text-align:center;
        background:rgba(29,20,32,.88);border:2px solid #FFD23F;border-radius:14px;padding:6px 12px;font-weight:700;font-size:16px;line-height:1.2;
        pointer-events:none;transition:opacity .5s}
      .ah-hint b{color:#FFD23F}
      .ah-hint.ah-off{opacity:0}
      .ah-end{position:absolute;inset:0;display:grid;place-items:center;padding:16px;background:rgba(29,20,32,.35);pointer-events:none}
      .ah-end[hidden]{display:none}
      .ah-panel{width:min(100%,340px);background:#FFF6E6;color:${INK};border:3px solid ${INK};border-radius:22px;box-shadow:0 6px 0 ${INK},0 0 30px rgba(255,107,53,.6);
        padding:14px 16px 18px;text-align:center;animation:ah-pop .45s cubic-bezier(.3,1.6,.5,1)}
      @keyframes ah-pop{from{transform:scale(.8) rotate(-3deg);opacity:0}}
      .ah-panel .ah-win{width:120px;height:120px;margin:-4px auto 0}
      .ah-panel .ah-win .av{width:100%;height:100%;display:block}
      .ah-panel h2{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:30px;line-height:1.1;text-transform:uppercase}
      .ah-panel h2 span{color:var(--wc);-webkit-text-stroke:1.5px ${INK};paint-order:stroke fill}
      .ah-fin{font-family:Anton,Impact,sans-serif;font-size:40px;line-height:1.1;margin:2px 0}
      .ah-tease{margin:4px 0 0;font-family:Pacifico,"Brush Script MT",cursive;font-size:17px;line-height:1.35;color:#C2185B}
      .ah-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      @media (max-width:360px){.ah-bar{grid-template-columns:50px minmax(0,1fr) auto auto;column-gap:6px;height:60px}.ah-av{width:48px;height:48px}
        .ah-who b{font-size:17px}.ah-sc{font-size:36px}.ah-clock{font-size:15px}.ah-to{font-size:12px}.ah-btn{width:32px;height:32px}}
      @media (prefers-reduced-motion:reduce){.ah *{animation:none!important;transition:none!important}}
    </style>
    <div class="ah">
      <svg class="ah-scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="ah-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d3a"/><stop offset=".35" stop-color="#7b2d6b"/><stop offset=".62" stop-color="#ff6b35"/><stop offset=".72" stop-color="#ffd23f"/></linearGradient>
          <linearGradient id="ah-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset="1" stop-color="#ff3d7f"/></linearGradient>
          <linearGradient id="ah-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b2d6b"/><stop offset="1" stop-color="#2b1d3a"/></linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#ah-sky)"/>
        <g><circle cx="200" cy="178" r="64" fill="url(#ah-sun)"/>
          <g fill="#ff6b35" opacity=".9"><rect x="130" y="150" width="140" height="4"/><rect x="130" y="160" width="140" height="5"/><rect x="130" y="171" width="140" height="6"/></g></g>
        <rect y="200" width="400" height="100" fill="url(#ah-sea)"/>
        <g stroke="#ffd23f" stroke-width="2" opacity=".55" stroke-linecap="round"><path d="M168 210h64M178 220h44M188 230h24"/></g>
        <path d="M0 252q120-14 220-4t180-6V300H0z" fill="#e9b872" opacity=".9"/>
        <g fill="#1d1420">
          <path d="M34 300q6-90 22-150l6 2q-12 60-16 148z"/>
          <path d="M60 150q-30-16-58 0q30-6 58 2zM60 150q-8-30-40-36q26 16 40 36zM60 150q14-28 46-28q-30 10-46 28zM60 150q34 0 48 22q-24-16-48-22zM60 150q-26 6-36 34q14-24 36-34z"/>
          <path d="M366 300q-4-78-18-128l-6 2q10 52 12 126z"/>
          <path d="M344 172q26-16 54-4q-28-4-54 6zM344 172q4-28 34-36q-22 16-34 36zM344 172q-14-26-44-24q28 8 44 24zM344 172q-30 2-42 24q22-16 42-24z"/>
        </g>
      </svg>
      ${bar(topSeat, true)}
      <div class="ah-stage">
        <canvas class="ah-cv" role="img" aria-label="Table d'air hockey vue de dessus"></canvas>
        <div class="ah-hint"></div>
        <div class="ah-end" hidden><div class="ah-panel">
          <div class="ah-win"></div>
          <h2><span></span> gagne !</h2><div class="ah-fin"></div><p class="ah-tease"></p>
        </div></div>
      </div>
      ${bar(viewSeat, false)}
      <p class="ah-sr" aria-live="polite"></p>
    </div>`;
    const root = el.querySelector(".ah"), stage = el.querySelector(".ah-stage"), canvas = el.querySelector(".ah-cv");
    const ctx = canvas.getContext("2d");
    const hintEl = el.querySelector(".ah-hint"), endEl = el.querySelector(".ah-end"), liveEl = el.querySelector(".ah-sr");
    const muteBtn = el.querySelector(".ah-btn"), clockEl = el.querySelector(".ah-clock");
    const barOf = {}; barOf[topSeat] = el.querySelector(".ah-top"); barOf[viewSeat] = el.querySelector(".ah-bot");
    const scoreEl = [0, 1].map(s => barOf[s].querySelector(".ah-sc"));
    [0, 1].forEach(s => {
      barOf[s].querySelector(".ah-who b").textContent = name(s);
      barOf[s].querySelector(".ah-who small").textContent = s === mySeat ? "Toi" : (mySeat >= 0 ? "Adversaire" : (s === 0 ? "En bas" : "En haut"));
    });
    const isTouch = (() => { try { return matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } })();
    if (mySeat < 0) hintEl.textContent = "Tu regardes le match en spectateur";
    else if (isTouch) hintEl.innerHTML = "Glisse le doigt <b>n'importe où</b> : ton maillet suit, sans être caché";
    else hintEl.innerHTML = "Bouge la <b>souris</b> (ou ← ↑ → ↓) pour diriger ton maillet";
    const announce = t => { liveEl.textContent = t; };
    const reactTimers = [];
    function react(s, cls, dur) {
      const b = barOf[s]; if (!b) return;
      b.classList.remove("ah-flex", "ah-sad"); void b.offsetWidth; b.classList.add(cls);
      if (reactTimers[s]) clearTimeout(reactTimers[s]);
      reactTimers[s] = dur ? setTimeout(() => { reactTimers[s] = 0; b.classList.remove(cls); }, dur) : 0;
    }

    /* ================= Son ================= */
    let actx = null, master = null, muted = false, noiseBuf = null;
    function ensureAudio() {
      try {
        if (!actx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          actx = new AC(); master = actx.createGain(); master.gain.value = 0.35; master.connect(actx.destination);
          noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.2, actx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (actx.state === "suspended") actx.resume();
      } catch (e) { actx = null; }
    }
    const canPlay = () => actx && !muted && actx.state === "running";
    function tone(f, d, type, v, f2, delay) {
      if (!canPlay()) return;
      try {
        const t = actx.currentTime + (delay || 0);
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || "square";
        o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* ignore */ }
    }
    function noise(d, v, freq, q, delay, rise) {
      if (!canPlay() || !noiseBuf) return;
      try {
        const t = actx.currentTime + (delay || 0);
        const src = actx.createBufferSource(), flt = actx.createBiquadFilter(), g = actx.createGain();
        src.buffer = noiseBuf; flt.type = "bandpass"; flt.frequency.value = freq || 1200; flt.Q.value = q || 1;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v || 0.2, t + (rise || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        src.connect(flt); flt.connect(g); g.connect(master); src.start(t); src.stop(t + d + 0.05);
      } catch (e) { /* ignore */ }
    }
    let lastWallSound = 0, lastHitSound = 0;
    const sfx = {
      hit(sp) { const t = nowS(); if (t - lastHitSound < 0.04) return; lastHitSound = t; const f = 150 + Math.min(sp, 2500) * 0.12; tone(f, 0.07, "square", 0.17, f * 0.55); noise(0.05, 0.22, 2400, 0.8); },
      wall() { const t = nowS(); if (t - lastWallSound < 0.05) return; lastWallSound = t; tone(160, 0.05, "triangle", 0.16, 110); noise(0.03, 0.08, 900, 1); },
      smash() { noise(0.35, 0.3, 700, 0.6, 0, 0.04); tone(260, 0.3, "sawtooth", 0.1, 1300); tone(70, 0.3, "sine", 0.45, 40); },
      goal(mine) {
        if (mine) { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "square", 0.11, null, i * 0.08)); }
        else { [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.45 : 0.18, "triangle", 0.2, i === 3 ? 262 : null, i * 0.17)); }
        tone(80, 0.45, "sine", 0.5, 38); tone(220, 0.6, "sawtooth", 0.06); tone(277, 0.6, "sawtooth", 0.05); tone(330, 0.6, "sawtooth", 0.05);
        noise(1.1, 0.28, 1500, 0.4, 0.05, 0.25);
      },
      count() { tone(523, 0.12, "square", 0.12); },
      go() { tone(1046, 0.25, "square", 0.13, 1568); },
      gold() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "square", 0.1, null, i * 0.09)); },
      win() { [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.13, "square", 0.12, null, i * 0.14)); tone(262, 1, "triangle", 0.15, null, 0.84); noise(1.5, 0.2, 1500, 0.4, 0.2, 0.3); }
    };
    muteBtn.addEventListener("click", () => {
      ensureAudio(); muted = !muted;
      muteBtn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.setAttribute("aria-label", muted ? "Activer le son" : "Couper le son");
      if (!muted) tone(660, 0.1, "sine", 0.15, 990);
    });
    muteBtn.addEventListener("pointerdown", e => e.stopPropagation());

    /* ================= Physique partagée (hôte, prédiction locale, rejeu) ================= */
    const HOME = [[W / 2, L - 130], [W / 2, 130]];
    function clampM(s, x, y) {
      return [clamp(x, MR, W - MR), s === 0 ? clamp(y, L / 2 + MID, L - MR) : clamp(y, MR, L / 2 - MID)];
    }
    function moveMallet(m, tx, ty, dt) {
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), mx = MMAX * dt;
      const k = d > mx ? mx / d : 1;
      const nx = m.x + dx * k, ny = m.y + dy * k;
      m.vx += ((nx - m.x) / dt - m.vx) * 0.5; m.vy += ((ny - m.y) / dt - m.vy) * 0.5;
      m.x = nx; m.y = ny;
    }
    const capV = (pk, max) => { const sp = Math.hypot(pk.vx, pk.vy); if (sp > max) { pk.vx *= max / sp; pk.vy *= max / sp; } };
    // Un pas de palet : frottement, maillets (cols), bords, poteaux, cages. cb : {hit, wall, goal}
    function physStep(pk, dt, cols, cb) {
      if (pk.in >= 0) return;
      const fr = Math.exp(-FRICTION * dt);
      pk.vx *= fr; pk.vy *= fr;
      if (pk.vx * pk.vx + pk.vy * pk.vy < 25) { pk.vx = 0; pk.vy = 0; }
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      for (const m of cols) {
        const dx = pk.x - m.x, dy = pk.y - m.y, R = PR + MR, d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        let nx, ny;
        if (d < 0.01) { nx = 0; ny = m.s === 0 ? -1 : 1; } else { nx = dx / d; ny = dy / d; }
        // maillet adverse prédit (position incertaine) : on ne prédit que les renvois vers l'avant
        if (m.tent && ny * (m.s === 0 ? -1 : 1) < -0.2) continue;
        const bx = pk.x, by = pk.y;
        pk.x = m.x + nx * (R + 0.2); pk.y = m.y + ny * (R + 0.2);
        const vn = (pk.vx - m.vx) * nx + (pk.vy - m.vy) * ny;
        let smash = false, sp = Math.hypot(pk.vx, pk.vy);
        if (vn < 0) {
          pk.vx -= (1 + HIT_E) * vn * nx; pk.vy -= (1 + HIT_E) * vn * ny;
          smash = (m.vx * nx + m.vy * ny) > SMASH_MV;
          sp = Math.hypot(pk.vx, pk.vy);
          if (smash) { const t = Math.min(SMASH_V, sp * 1.12); if (sp > 1) { pk.vx *= t / sp; pk.vy *= t / sp; } sp = t; }
          else if (sp > MAXV) { pk.vx *= MAXV / sp; pk.vy *= MAXV / sp; sp = MAXV; }
        }
        if (cb && cb.hit) cb.hit(m, vn < 0 ? -vn : 0, smash, bx, by, sp);
      }
      // bords latéraux
      if (pk.x < PR) { pk.x = PR; if (pk.vx < 0) { pk.vx = -pk.vx * WALL_E; if (cb && cb.wall) cb.wall(pk, 0, pk.y, Math.abs(pk.vx)); } }
      else if (pk.x > W - PR) { pk.x = W - PR; if (pk.vx > 0) { pk.vx = -pk.vx * WALL_E; if (cb && cb.wall) cb.wall(pk, W, pk.y, Math.abs(pk.vx)); } }
      // bouts de table : bande pleine, poteaux, cage (end 0 = bas, défendu par le siège 0)
      const cx = W / 2;
      for (let end = 0; end < 2; end++) {
        const ly = end === 0 ? L : 0, sg = end === 0 ? 1 : -1;
        const depth = (pk.y - ly) * sg; // > 0 : au-delà de la ligne
        if (depth <= -PR) continue;
        if (Math.abs(pk.x - cx) > GW) {
          pk.y = ly - sg * PR;
          if (pk.vy * sg > 0) { pk.vy = -pk.vy * WALL_E; if (cb && cb.wall) cb.wall(pk, pk.x, ly, Math.abs(pk.vy)); }
          continue;
        }
        for (const px of [cx - GW, cx + GW]) {
          const dx = pk.x - px, dy = pk.y - ly, d2 = dx * dx + dy * dy;
          if (d2 < PR * PR && d2 > 1e-6) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
            pk.x = px + nx * PR; pk.y = ly + ny * PR;
            const vn = pk.vx * nx + pk.vy * ny;
            if (vn < 0) { pk.vx -= (1 + WALL_E) * vn * nx; pk.vy -= (1 + WALL_E) * vn * ny; if (cb && cb.wall) cb.wall(pk, px, ly, -vn); }
          }
        }
        if ((pk.y - ly) * sg > 0) {
          const lo = cx - GW + PR, hi = cx + GW - PR;
          if (pk.x < lo) { pk.x = lo; if (pk.vx < 0) pk.vx = -pk.vx * 0.5; } else if (pk.x > hi) { pk.x = hi; if (pk.vx > 0) pk.vx = -pk.vx * 0.5; }
          if ((pk.y - ly) * sg > GOAL_D) { pk.in = end; pk.vx = 0; pk.vy = 0 * pk.vy; if (cb && cb.goal) cb.goal(end, pk.x); return; }
        }
      }
    }
    const mkPuck = (x, y) => ({x, y, vx: 0, vy: 0, in: -1});
    const puckArr = p => [ri(p.x), ri(p.y), ri(p.vx), ri(p.vy), p.in];
    const puckFrom = a => ({x: +a[0] || 0, y: +a[1] || 0, vx: +a[2] || 0, vy: +a[3] || 0, in: a[4] == null ? -1 : a[4]});

    /* ================= Effets locaux (déclarés tôt : utilisés par la simulation) ================= */
    const FX = {particles: [], floats: [], rings: [], confetti: [], flash: null, shake: 0, time: 0, over: false};
    const tentFx = [0, 0], lastHitFx = [-9, -9], lastSmashFx = [-9, -9];
    function burst(x, y, color, n, speed, ang, spread) {
      if (RM) n = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const a = ang == null ? Math.random() * Math.PI * 2 : ang + rand(-(spread || 0.9), spread || 0.9), s = speed * rand(0.3, 1);
        FX.particles.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.6),
          color: Math.random() < 0.35 ? "#FFD23F" : color, size: rand(2.5, 6), star: Math.random() < 0.3});
      }
      if (FX.particles.length > 420) FX.particles.splice(0, FX.particles.length - 420);
    }
    function addFloat(x, y, text, color, size, life) { FX.floats.push({x, y, text, color, size, life: life || 1.3, t: 0}); }
    function hitFx(s, x, y, sp, smash) {
      // une poussée = plusieurs contacts de suite : un seul effet par coup
      const t = nowS();
      if (smash && t - lastSmashFx[s] < 0.9) smash = false;
      if (!smash && t - lastHitFx[s] < 0.12) return;
      lastHitFx[s] = t; if (smash) lastSmashFx[s] = t;
      const c = COL[s];
      burst(x, y, c, smash ? 30 : sp > 1000 ? 16 : 9, smash ? 700 : 260 + sp * 0.2);
      if (sp > 1250 && !RM) FX.shake = Math.max(FX.shake, Math.min(14, (sp - 1100) / 90));
      if (smash) {
        FX.rings.push({x, y, t: 0, life: 0.45, color: c});
        FX.floats = FX.floats.filter(f => !f.smash);
        addFloat(x, y, "POWER SMASH !", "#FFD23F", 0.09, 1.1); FX.floats[FX.floats.length - 1].smash = 1;
        if (!RM) FX.shake = Math.max(FX.shake, 16);
        sfx.smash();
      }
      sfx.hit(sp);
    }
    function wallFx(x, y, sp) { if (sp < 150) return; burst(x, y, "#FFD23F", sp > 900 ? 6 : 3, 140 + sp * 0.1); sfx.wall(); }

    /* ================= HÔTE : simulation autoritaire ================= */
    let H = null, hostTimer = null, finishTimer = null, lastPub = 0, lastHT = 0, acc = 0, lastConnCheck = 0;
    const stats = {pubs: 0, maxSize: 0, claims: 0, acc: 0, rej: 0, rejWhy: {}, rewindMax: 0, rejLog: [], replays: 0, corr: 0, corrMax: 0, skipped: 0, sent: 0, hold: 0};
    const seenSeat = [false, false];
    let localT = {x: HOME[viewSeat][0], y: HOME[viewSeat][1]};
    let forceGoalReq = -1;
    if (api.isHost) {
      H = {k: 0, g: 0, ph: "c", cd: CD0, gt: 0, sc: [0, 0], tl: MATCH_T, gg: 0, lh: -1, pk0: 0,
        p: mkPuck(W / 2, Math.random() < 0.5 ? L * 0.73 : L * 0.27), m: [0, 1].map(s => ({x: HOME[s][0], y: HOME[s][1], vx: 0, vy: 0})),
        R: [null, null], lastS: [0, 0], q: [0, 0], qa: [0, 0], e: [null, null], lastClaimK: [0, 0],
        pend: null, delays: [], hold: 0.3, evs: [], evId: 0, w: -1, ff: 0, tz: 0, missingSince: 0, finished: false,
        PH: new Array(N), MH: new Array(N), eo: {x: 0, y: 0}};
      api.onInputs(map => {
        if (!alive || !H) return;
        P.forEach((p, s) => {
          if (s === mySeat) return;
          const i = map[p.key];
          if (!i || typeof i !== "object" || typeof i.s !== "number") return;
          if (i.s <= H.lastS[s] && H.lastS[s] - i.s < 100000) return; // entrée déjà vue (ou arrivée dans le désordre)
          H.lastS[s] = i.s;
          if (isFinite(i.x) && isFinite(i.y)) {
            const [x, y] = clampM(s, +i.x, +i.y);
            H.R[s] = {x, y, vx: clamp(+i.vx || 0, -MMAX, MMAX), vy: clamp(+i.vy || 0, -MMAX, MMAX), k: H.k};
          }
          if (isFinite(i.ct)) H.e[s] = [i.ct, H.k];
          if (Array.isArray(i.h)) tryClaim(s, i.h);
        });
        if (P.some(p => !(p.key in map))) checkForfeit(true);
      });
    }
    function emit(code, ...args) {
      H.evs.push([++H.evId, H.k, code, ...args]);
      if (code !== 1) fireEvent(H.evs[H.evs.length - 1]);
    }
    const holdTicks = () => Math.round(H.hold / TICK);
    function hostCb(live) {
      return {
        hit(m, imp, smash, bx, by, sp) {
          if (imp < 40) return;
          H.lh = m.s;
          if (live) { emit(1, m.s, ri(sp), ri(H.p.x), ri(H.p.y), smash ? 1 : 0); hitFx(m.s, H.p.x, H.p.y, sp, smash); }
        },
        wall(pk, x, y, sp) { if (live) wallFx(x, y, sp); },
        goal(end) {
          // end = siège qui encaisse. Défenseur distant : on attend un éventuel arrêt en retard.
          const remote = end !== mySeat;
          H.pend = {def: end, k: H.cur, until: H.cur + (remote ? holdTicks() : 0)};
        }
      };
    }
    function hostCols(t) {
      if (mySeat < 0) return [];
      const m = H.MH[t % N];
      return m && m.t === t ? [{x: m.x, y: m.y, vx: m.vx, vy: m.vy, s: mySeat}] : [];
    }
    function recordPuck(t) { const p = H.p; H.PH[t % N] = {t, x: p.x, y: p.y, vx: p.vx, vy: p.vy, in: p.in}; }
    // Frappe annoncée par un joueur distant : [q, k0, g, bx, by, px, py, vx, vy, mx, my, mvx, mvy, smash, k1]
    // k0, bx, by : premier contact de l'épisode (pour vérifier) ; k1, px.. : état du palet après le dernier contact (appliqué)
    function tryClaim(s, h) {
      const q = +h[0];
      if (!(q > H.q[s])) return;
      H.q[s] = q; H.qa[s] = 0; stats.claims++;
      const rej = why => { stats.rej++; stats.rejWhy[why] = (stats.rejWhy[why] || 0) + 1; };
      if (+h[2] !== H.g || H.ph !== "p") return rej("phase");
      const k = +h[1], bx = +h[3], by = +h[4], k1 = isFinite(+h[14]) ? Math.max(+h[14], k) : k;
      let px = +h[5], py = +h[6], vx = +h[7], vy = +h[8];
      const mx = +h[9], my = +h[10];
      if (![k, bx, by, px, py, vx, vy, mx, my].every(isFinite)) return rej("nan");
      // le maillet doit être dans sa moitié, au contact du palet
      const [cmx, cmy] = clampM(s, mx, my);
      if (Math.hypot(cmx - mx, cmy - my) > 30) return rej("half");
      if (Math.hypot(px - mx, py - my) > PR + MR + 30) return rej("contact");
      // retrouver le palet de l'hôte le plus proche du « palet avant frappe » autour du tick annoncé
      // (le téléphone simule à l'heure de l'hôte : normalement t = k ; un petit écart d'horloge est toléré, pénalisé)
      const kc = Math.min(k, H.k);
      const lo = Math.max(kc - 12, H.pk0, H.lastClaimK[s], H.k - N + 8), hi = Math.min(kc + 12, H.k);
      let best = -1, bd = 1e9, bscore = 1e9;
      for (let t = lo; t <= hi; t++) {
        const e = H.PH[t % N];
        if (!e || e.t !== t || e.in >= 0) continue;
        const d = Math.hypot(e.x - bx, e.y - by), sc = d + Math.abs(t - kc) * 2.5;
        if (sc < bscore) { bscore = sc; bd = d; best = t; }
      }
      if (best < 0) return rej("window");
      if (bd > 48) { if (stats.rejLog.length < 30) stats.rejLog.push([ri(bd), k - H.k, H.k - best, ri(bx), ri(by), H.PH[best % N] && ri(H.PH[best % N].x), H.PH[best % N] && ri(H.PH[best % N].y), H.lh]); return rej("far"); }
      // accepté : on rembobine au tick trouvé, on applique la frappe et on rejoue jusqu'à maintenant
      const pk = {x: px, y: py, vx, vy, in: -1};
      capV(pk, h[13] ? SMASH_V : MAXV);
      const b0 = rawDisp(), before = {x: b0.x + H.eo.x, y: b0.y + H.eo.y};
      const wasIn = b0.in >= 0;
      const ka = Math.min(H.k, best + Math.min(k1 - k, 60)); // tick où appliquer l'état final de l'épisode
      if (H.pend) { if (H.pend.k <= best) return rej("goal"); H.pend = null; } // arrêt annoncé avant l'entrée dans la cage
      H.p = pk; H.lh = s;
      recordPuck(ka);
      const cb = hostCb(false);
      for (let t = ka + 1; t <= H.k; t++) { H.cur = t; physStep(H.p, TICK, hostCols(t), cb); recordPuck(t); }
      H.cur = H.k;
      H.lastClaimK[s] = best;
      H.qa[s] = 1; stats.acc++; stats.replays++;
      const rw = (H.k - ka) * TICK; stats.rewindMax = Math.max(stats.rewindMax, rw);
      // délai de garde des buts : ce que mettent les frappes à arriver (max récent + marge)
      H.delays.push((H.k - Math.min(k1, H.k)) * TICK); if (H.delays.length > 10) H.delays.shift();
      H.hold = clamp(Math.max(...H.delays) + 0.07, 0.15, 0.5); stats.hold = H.hold;
      const a0 = rawDisp();
      if (wasIn && a0.in < 0) { H.eo.x = 0; H.eo.y = 0; } else { H.eo.x = before.x - a0.x; H.eo.y = before.y - a0.y; limitEo(H.eo); }
      const sp = Math.hypot(vx, vy);
      if (Math.abs(+h[11] || 0) + Math.abs(+h[12] || 0) > 30 || sp > 200) {
        emit(1, s, ri(Math.min(sp, SMASH_V)), ri(px), ri(py), h[13] ? 1 : 0);
        hitFx(s, px, py, sp, !!h[13]);
      }
    }
    function limitEo(eo) { const d = Math.hypot(eo.x, eo.y); if (d > 260) { eo.x *= 260 / d; eo.y *= 260 / d; } }
    function hostStep() {
      H.k++; H.cur = H.k;
      const t = H.k;
      for (let s = 0; s < 2; s++) {
        const m = H.m[s];
        if (s === mySeat) {
          const [tx, ty] = clampM(s, localT.x, localT.y);
          moveMallet(m, tx, ty, TICK);
        } else if (H.R[s]) {
          const r = H.R[s], age = Math.min((t - r.k) * TICK, 0.1);
          const [tx, ty] = clampM(s, r.x + r.vx * age, r.y + r.vy * age);
          const a = 1 - Math.exp(-TICK * 30);
          m.x += (tx - m.x) * a; m.y += (ty - m.y) * a; m.vx = r.vx; m.vy = r.vy;
        }
      }
      if (mySeat >= 0) { const m = H.m[mySeat]; H.MH[t % N] = {t, x: m.x, y: m.y, vx: m.vx, vy: m.vy}; }
      if (H.ph === "c") {
        H.cd -= TICK;
        if (H.cd <= 0) { H.ph = "p"; H.pk0 = t; emit(6); }
      } else if (H.ph === "p") {
        if (forceGoalReq >= 0) { const s = forceGoalReq; forceGoalReq = -1; H.p.in = 1 - s; H.p.y = s === 0 ? -10 : L + 10; H.pend = {def: 1 - s, k: t, until: t}; }
        physStep(H.p, TICK, hostCols(t), hostCb(true));
        if (!H.pend || H.pend.until > t) {
          H.tl -= TICK;
          if (H.tl <= 0) {
            H.tl = 0;
            if (!H.pend) {
              if (H.sc[0] !== H.sc[1]) { emit(10); endMatch(H.sc[0] > H.sc[1] ? 0 : 1, 0); }
              else if (!H.gg) { H.gg = 1; emit(9); }
            }
          }
        }
        if (H.ph === "p" && H.pend && t >= H.pend.until) { const d = H.pend.def; H.pend = null; scoreGoal(1 - d); }
      } else if (H.ph === "g") {
        H.gt -= TICK;
        if (H.gt <= 0) {
          const s = H.lastDef;
          H.p = mkPuck(W / 2 + rand(-60, 60), s === 0 ? L * 0.73 : L * 0.27);
          H.ph = "p"; H.pk0 = t; H.lh = -1; H.eo.x = 0; H.eo.y = 0;
          emit(7, s);
        }
      }
      recordPuck(t);
      while (H.evs.length && (H.evs[0][1] < t - 120 || H.evs.length > 14)) H.evs.shift();
    }
    function scoreGoal(scorer) {
      if (H.ph !== "p") return;
      H.sc[scorer]++; H.g++; H.lastDef = 1 - scorer;
      emit(3, scorer, ri(H.p.x), (Math.random() * EXCL.length) | 0);
      if (H.sc[scorer] >= TARGET || H.gg) { endMatch(scorer, 0); return; }
      if (H.tl <= 0 && H.sc[0] !== H.sc[1]) { endMatch(H.sc[0] > H.sc[1] ? 0 : 1, 0); return; }
      H.ph = "g"; H.gt = GOAL_PAUSE;
    }
    function endMatch(w, ff) {
      if (H.ph === "o") return;
      H.ph = "o"; H.w = w; H.ff = ff ? 1 : 0; H.tz = (Math.random() * TEASES.length) | 0; H.g++;
      emit(8, w);
      if (!ff) publish();
      const wk = P[w].key, lk = P[1 - w].key, a = H.sc[w], b = H.sc[1 - w];
      const summary = ff ? `${name(w)} gagne par forfait (${a} à ${b})` : `${name(w)} gagne ${a} à ${b}${H.gg ? " (but en or)" : ""}`;
      const stop = () => { if (hostTimer) { clearInterval(hostTimer); hostTimer = null; } };
      if (ff) stop();
      finishTimer = setTimeout(() => {
        finishTimer = null; H.finished = true; stop();
        api.finish({winners: [wk], ranking: [wk, lk], summary});
      }, ff ? Math.max(0, lastPub + 50 - performance.now()) : 3200);
    }
    function snapshot() {
      const s = {k: H.k, g: H.g, ph: H.ph, sc: H.sc.slice(), t: Math.ceil(H.tl * 10), p: puckArr(H.p),
        m: H.m.map(m => [ri(m.x), ri(m.y), ri(m.vx), ri(m.vy)]), lh: H.lh, q: H.q.slice(),
        e: H.e.map(e => e ? [e[0], H.k - e[1]] : 0), v: H.evs.slice()};
      if (H.gg) s.gg = 1;
      if (H.ph === "c") s.cd = Math.round(H.cd * 100) / 100;
      if (H.ph === "o") { s.w = H.w; s.ff = H.ff; s.tz = H.tz; }
      return s;
    }
    function publish() {
      const s = snapshot();
      const size = JSON.stringify(s).length;
      stats.pubs++; if (size > stats.maxSize) stats.maxSize = size;
      api.setState(s);
    }
    function hostLoop() {
      if (!alive || !H) return;
      const now = performance.now();
      let d = lastHT ? (now - lastHT) / 1000 : 0; lastHT = now;
      if (d > 0.5) d = 0.5; // onglet en pause : on rattrape au plus 0,5 s
      acc += d;
      let n = 0;
      if (H.ph !== "o" || !H.finished) while (acc >= TICK) { acc -= TICK; hostStep(); if (++n > 70) { acc = 0; break; } }
      if (now - lastPub >= (H.ph === "o" ? 250 : PUB_MS) - 2) { lastPub = now; publish(); }
      if (now - lastConnCheck > 300) { lastConnCheck = now; checkForfeit(false); }
    }
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
      if (seenSeat[gone] ? (fromPeers || now - H.missingSince > 600) : now - H.missingSince > 10000) {
        try { api.toast(`${name(gone)} a quitté la table : victoire par forfait !`); } catch (e) { /* ignore */ }
        endMatch(here[0], 1);
      }
    }

    /* ================= CLIENTS : prédiction locale + rejeu ================= */
    const C = {has: false, k: 0, co: 0, offS: [], rttS: [], lead: 0.06, S: null, g: -1, ph: "c",
      p: mkPuck(W / 2, L / 2), eo: {x: 0, y: 0}, PH: new Array(N), MH: new Array(N), OH: [new Array(N), new Array(N)],
      me: {x: HOME[viewSeat][0], y: HOME[viewSeat][1], vx: 0, vy: 0}, q: 0, pendQ: 0, pendAt: 0, claim: null, lastEv: 0, lastEcho: -1};
    const evQueue = [];
    function minOf(arr) { let m = Infinity; for (const a of arr) if (a[1] < m) m = a[1]; return m; }
    function oppAt(s, t) {
      const S = C.S; if (!S || !S.m || !S.m[s]) return null;
      const a = S.m[s], age = clamp((t - S.k) * TICK, 0, 0.12);
      const [x, y] = clampM(s, a[0] + a[2] * age, a[1] + a[3] * age);
      return {t, x, y, vx: a[2], vy: a[3]};
    }
    function clientCols(t) {
      const cols = [];
      for (let s = 0; s < 2; s++) {
        const e = s === mySeat ? C.MH[t % N] : C.OH[s][t % N];
        if (e && e.t === t) cols.push({x: e.x, y: e.y, vx: e.vx, vy: e.vy, s, own: s === mySeat, tent: s !== mySeat});
      }
      return cols;
    }
    function clientCb(t, replay) {
      return {
        hit(m, imp, smash, bx, by, sp) {
          const p = C.p;
          if (m.own) {
            // épisode de contact : ancré sur le premier contact non confirmé, avec l'état le plus récent du palet
            const open = C.pendQ && C.claim && C.claim[2] === C.g;
            const k0 = open ? C.claim[1] : t, ax = open ? C.claim[3] : ri(bx), ay = open ? C.claim[4] : ri(by);
            C.q++;
            C.claim = [C.q, k0, C.g, ax, ay, ri(p.x), ri(p.y), ri(p.vx), ri(p.vy), ri(m.x), ri(m.y), ri(m.vx), ri(m.vy), (smash || (open && C.claim[13])) ? 1 : 0, t];
            C.pendQ = C.q; C.pendAt = nowS(); claimDirty = true;
            if (imp > 40 && (!replay || t > C.k - 6)) hitFx(m.s, p.x, p.y, sp, smash);
          } else if (!replay && imp > 40) { hitFx(m.s, p.x, p.y, sp, smash); tentFx[m.s] = nowS(); }
        },
        wall(pk, x, y, sp) { if (!replay) wallFx(x, y, sp); }
      };
    }
    function puckStepLocal(t, replay) {
      physStep(C.p, TICK, clientCols(t), clientCb(t, replay));
      const p = C.p; C.PH[t % N] = {t, x: p.x, y: p.y, vx: p.vx, vy: p.vy, in: p.in};
    }
    function localStep(t) {
      if (mySeat >= 0) {
        const [tx, ty] = clampM(mySeat, localT.x, localT.y);
        moveMallet(C.me, tx, ty, TICK);
        C.MH[t % N] = {t, x: C.me.x, y: C.me.y, vx: C.me.vx, vy: C.me.vy};
      }
      for (let s = 0; s < 2; s++) if (s !== mySeat) { const o = oppAt(s, t); if (o) C.OH[s][t % N] = o; }
      if (C.ph === "p") puckStepLocal(t, false);
    }
    function ingest(S) {
      if (!S || typeof S.k !== "number" || !Array.isArray(S.p)) return;
      if (C.S && S.k <= C.S.k) return; // état plus ancien (arrivé dans le désordre)
      const tn = nowS();
      C.S = S;
      // horloge : décalage minimal sur ~2,5 s (= horloge locale - heure de l'hôte - latence minimale)
      C.offS.push([tn, tn - S.k * TICK]);
      while (C.offS.length > 2 && C.offS[0][0] < tn - 2.5) C.offS.shift();
      // aller-retour mesuré grâce à l'écho de ma dernière entrée
      if (mySeat >= 0 && Array.isArray(S.e) && Array.isArray(S.e[mySeat])) {
        const [ct, age] = S.e[mySeat];
        if (ct !== C.lastEcho) {
          C.lastEcho = ct;
          let rtt = ((performance.now() - ct) % 1e8 + 1e8) % 1e8 - age * TICK * 1000;
          if (rtt >= 0 && rtt < 3000) { C.rttS.push([tn, rtt]); while (C.rttS.length > 2 && C.rttS[0][0] < tn - 4) C.rttS.shift(); }
        }
      }
      if (C.rttS.length) C.lead = clamp(minOf(C.rttS) / 2000, 0.01, 0.2);
      for (const e of S.v || []) if (e[0] > C.lastEv) { evQueue.push(e); C.lastEv = e[0]; }
      if (!C.has) {
        C.has = true;
        C.co = minOf(C.offS) - C.lead;
        C.k = Math.max(S.k, Math.floor((tn - C.co) / TICK));
        C.p = puckFrom(S.p); C.g = S.g; C.ph = S.ph;
        if (mySeat >= 0 && S.m && S.m[mySeat]) { C.me.x = S.m[mySeat][0]; C.me.y = S.m[mySeat][1]; localT = {x: C.me.x, y: C.me.y}; }
        return;
      }
      const newPoint = S.g !== C.g;
      if (newPoint || S.ph !== "p" || C.ph !== "p") {
        const wasPlay = C.ph === "p" && !newPoint;
        C.g = S.g; C.ph = S.ph;
        if (S.ph === "p") {
          C.pendQ = 0; C.claim = null;
          resync(S, wasPlay);
        } else { C.p = puckFrom(S.p); C.eo.x = 0; C.eo.y = 0; }
        return;
      }
      if (mySeat >= 0 && C.pendQ) {
        const ack = Array.isArray(S.q) ? +S.q[mySeat] || 0 : 0;
        if (ack < C.pendQ && tn - C.pendAt < 0.9) { stats.skipped++; return; }
        C.pendQ = 0;
      }
      resync(S, true);
    }
    // remet le palet à l'état de l'hôte au tick S.k et rejoue jusqu'au tick local
    function resync(S, smooth) {
      const b0 = rawDisp(), before = {x: b0.x + C.eo.x, y: b0.y + C.eo.y}, wasIn = b0.in;
      C.p = puckFrom(S.p);
      C.PH[S.k % N] = {t: S.k, x: C.p.x, y: C.p.y, vx: C.p.vx, vy: C.p.vy, in: C.p.in};
      if (S.k > C.k) { C.k = S.k; }
      else if (C.k - S.k < N - 8) {
        stats.replays++;
        for (let t = S.k + 1; t <= C.k; t++) puckStepLocal(t, true);
      }
      const a0 = rawDisp();
      if (smooth && !(wasIn >= 0 && a0.in < 0)) {
        C.eo.x = before.x - a0.x; C.eo.y = before.y - a0.y;
        const d = Math.hypot(C.eo.x, C.eo.y);
        stats.corr++; stats.corrSum = (stats.corrSum || 0) + d; if (d > stats.corrMax) stats.corrMax = d;
        limitEo(C.eo);
      } else { C.eo.x = 0; C.eo.y = 0; }
    }
    if (!api.isHost) api.onState(s => { if (alive) ingest(s); });
    function clientAdvance(dt) {
      if (!C.has) return;
      const want = minOf(C.offS) - C.lead;
      // horloge de simulation ajustée en douceur (±6 %), ou d'un coup si elle est très loin
      if (Math.abs(want - C.co) > 0.25) C.co = want; else C.co += clamp(want - C.co, -0.06 * dt, 0.06 * dt);
      const kt = Math.floor((nowS() - C.co) / TICK);
      if (kt - C.k > 60) { // onglet endormi : on saute, le prochain état recale le palet
        C.k = kt - 1;
      }
      let n = 0;
      while (C.k < kt && n < 60) { C.k++; n++; localStep(C.k); }
    }

    /* ================= Envoi de mon maillet (et de ma frappe en attente) ================= */
    let lastSendAt = 0, sendSeq = 0, lastSX = -1, lastSY = -1, claimDirty = false, interacted = false, matchOver = false;
    function maybeSend() {
      if (mySeat < 0 || api.isHost || !alive || matchOver || !C.has) return;
      const now = performance.now();
      if (!claimDirty && now - lastSendAt < SEND_MS) return;
      const m = C.me, x = ri(m.x), y = ri(m.y);
      if (!claimDirty && x === lastSX && y === lastSY && now - lastSendAt < 200) return;
      lastSendAt = now; lastSX = x; lastSY = y; claimDirty = false; stats.sent++;
      const inp = {s: ++sendSeq, x, y, vx: ri(m.vx), vy: ri(m.vy), ct: Math.round(now) % 1e8};
      if (C.claim && C.pendQ) inp.h = C.claim;
      api.setInput(inp);
    }

    /* ================= Entrées : doigt (décalé), souris, clavier ================= */
    const V = {rot: 0, s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0};
    function screenToSim(X, Y) {
      const x = (X - V.ox) / V.s, y = (Y - V.oy) / V.s;
      return V.rot === 2 ? [W - x, L - y] : [x, y];
    }
    function myMallet() { return api.isHost ? (H && mySeat >= 0 ? H.m[mySeat] : null) : C.me; }
    const drag = {id: null, ox: 0, oy: 0};
    function setTarget(x, y) {
      if (mySeat < 0) return;
      const [cx, cy] = clampM(mySeat, x, y);
      localT = {x: cx, y: cy};
      interacted = true;
    }
    function relXY(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function onDown(e) {
      ensureAudio();
      if (mySeat < 0) return;
      if (e.target.closest && e.target.closest(".ah-btn")) return;
      const [X, Y] = relXY(e), [fx, fy] = screenToSim(X, Y);
      if (e.pointerType === "mouse") { setTarget(fx, fy); return; }
      const m = myMallet() || {x: localT.x, y: localT.y};
      let ox = m.x - fx, oy = m.y - fy;
      // doigt posé (presque) sur le maillet : on le place un peu au-dessus du doigt pour qu'il reste visible
      if (Math.hypot(ox, oy) * V.s < 70) { ox = 0; oy = (mySeat === 0 ? -1 : 1) * 70 / V.s; }
      drag.id = e.pointerId; drag.ox = ox; drag.oy = oy;
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      dragTo(fx, fy);
      if (e.cancelable) e.preventDefault();
    }
    function dragTo(fx, fy) {
      const tx = fx + drag.ox, ty = fy + drag.oy;
      const [cx, cy] = clampM(mySeat, tx, ty);
      drag.ox += cx - tx; drag.oy += cy - ty; // bloqué au bord : le décalage suit, pas de zone morte au retour
      setTarget(cx, cy);
    }
    function onMove(e) {
      if (mySeat < 0) return;
      const [X, Y] = relXY(e), [fx, fy] = screenToSim(X, Y);
      if (e.pointerType === "mouse") { setTarget(fx, fy); return; }
      if (drag.id === e.pointerId) dragTo(fx, fy);
    }
    function onUp(e) { if (drag.id === e.pointerId) drag.id = null; }
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("lostpointercapture", onUp);
    const KEYS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyQ: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyZ: [0, -1], KeyS: [0, 1]};
    const held = new Map();
    function onKeyDown(e) {
      const tg = e.target, tag = tg && tg.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = KEYS[e.code];
      if (!k || mySeat < 0) return;
      ensureAudio();
      e.preventDefault();
      held.set(e.code, k);
    }
    function onKeyUp(e) { held.delete(e.code); }
    function onBlur() { held.clear(); drag.id = null; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    /* ================= Mise en page ================= */
    const table = document.createElement("canvas"), tctx = table.getContext("2d");
    function layout() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rot = viewSeat === 1 ? 2 : 0;
      const tw = W + 2 * RIM, th = L + 2 * RIM, pad = 4;
      const s = Math.max(0.05, Math.min((r.width - 2 * pad) / tw, (r.height - 2 * pad) / th));
      const changed = V.w !== r.width || V.h !== r.height || V.dpr !== dpr || V.rot !== rot;
      Object.assign(V, {rot, s, dpr, w: r.width, h: r.height, ox: (r.width - s * W) / 2, oy: (r.height - s * L) / 2});
      if (changed) {
        canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        table.width = canvas.width; table.height = canvas.height;
        buildTable();
      }
    }
    // transformation : coordonnées de la table -> pixels du canvas (avec tremblement sx, sy)
    function setM(c, sx, sy) {
      const k = V.dpr * V.s;
      if (V.rot === 2) c.setTransform(-k, 0, 0, -k, V.dpr * (V.ox + V.s * W + (sx || 0)), V.dpr * (V.oy + V.s * L + (sy || 0)));
      else c.setTransform(k, 0, 0, k, V.dpr * (V.ox + (sx || 0)), V.dpr * (V.oy + (sy || 0)));
    }
    function toScreen(x, y) { if (V.rot === 2) { x = W - x; y = L - y; } return [V.ox + V.s * x, V.oy + V.s * y]; }
    function setUpright(c, X, Y, k, sx, sy) { c.setTransform(V.dpr * k, 0, 0, V.dpr * k, V.dpr * (X + (sx || 0)), V.dpr * (Y + (sy || 0))); }
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(layout); ro.observe(stage); }
    window.addEventListener("resize", layout);

    /* ================= Dessin de la table (pré-rendu) ================= */
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
      const t = tctx, k = V.dpr * V.s;
      t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, table.width, table.height);
      setM(t); t.lineJoin = "round"; t.lineCap = "round";
      // ombre portée et cadre
      t.save(); t.shadowColor = "rgba(0,0,0,.55)"; t.shadowBlur = 24 * k; t.shadowOffsetY = 8 * V.dpr;
      rr(t, -RIM, -RIM, W + 2 * RIM, L + 2 * RIM, 44); t.fillStyle = "#2a1838"; t.fill(); t.restore();
      const rg = t.createLinearGradient(-RIM, 0, W + RIM, 0);
      rg.addColorStop(0, "#3a2350"); rg.addColorStop(0.5, "#4a2c63"); rg.addColorStop(1, "#3a2350");
      rr(t, -RIM, -RIM, W + 2 * RIM, L + 2 * RIM, 44); t.fillStyle = rg; t.fill();
      t.lineWidth = 4; t.strokeStyle = INK; t.stroke();
      // tubes néon (moitié de chaque joueur à sa couleur)
      for (let s = 0; s < 2; s++) {
        t.save();
        t.beginPath(); t.rect(-RIM - 5, s === 0 ? L / 2 : -RIM - 5, W + 2 * RIM + 10, L / 2 + RIM + 5); t.clip();
        rr(t, -RIM / 2, -RIM / 2, W + RIM, L + RIM, 32);
        t.shadowColor = COL[s]; t.shadowBlur = 16 * k; t.lineWidth = 6; t.strokeStyle = COL[s]; t.stroke();
        t.shadowBlur = 0; t.lineWidth = 2; t.strokeStyle = "rgba(255,255,255,.85)"; t.stroke();
        t.restore();
      }
      // fentes de but (dans le cadre)
      for (let s = 0; s < 2; s++) {
        const y0 = s === 0 ? L - 4 : -RIM - 2;
        rr(t, W / 2 - GW, y0, 2 * GW, RIM + 6, 10); t.fillStyle = "#0d0812"; t.fill();
        t.lineWidth = 3; t.strokeStyle = COL[s]; t.shadowColor = COL[s]; t.shadowBlur = 10 * k; t.stroke(); t.shadowBlur = 0;
      }
      // surface : sable chaud
      t.save(); rr(t, 0, 0, W, L, 20); t.clip();
      const sg = t.createRadialGradient(W / 2, L / 2, 60, W / 2, L / 2, L * 0.62);
      sg.addColorStop(0, "#FBE6B8"); sg.addColorStop(0.7, "#F1CF92"); sg.addColorStop(1, "#E2B572");
      t.fillStyle = sg; t.fillRect(0, 0, W, L);
      // grains de sable (pseudo-aléatoires, identiques à chaque rendu)
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 520; i++) {
        const x = rnd() * W, y = rnd() * L, r = 0.8 + rnd() * 1.8;
        t.fillStyle = rnd() < 0.5 ? "rgba(160,110,50,.22)" : "rgba(255,255,255,.4)";
        t.beginPath(); t.arc(x, y, r, 0, 7); t.fill();
      }
      // trous d'air
      t.fillStyle = "rgba(120,72,30,.28)";
      for (let y = 25; y < L; y += 37.5) for (let x = 25 + ((y / 37.5) % 2) * 18; x < W; x += 36) { t.beginPath(); t.arc(x, y, 1.7, 0, 7); t.fill(); }
      // zones de but
      for (let s = 0; s < 2; s++) {
        const cy = s === 0 ? L : 0;
        t.beginPath(); t.arc(W / 2, cy, 160, 0, Math.PI * 2);
        t.fillStyle = COL[s]; t.globalAlpha = 0.1; t.fill(); t.globalAlpha = 0.75; t.lineWidth = 5; t.strokeStyle = COL[s]; t.stroke(); t.globalAlpha = 1;
        const ly = s === 0 ? L * 0.75 : L * 0.25;
        t.fillStyle = COL[s]; t.globalAlpha = 0.3; t.fillRect(0, ly - 3, W, 6); t.globalAlpha = 1;
      }
      // ligne et rond central
      t.lineWidth = 6; t.strokeStyle = "#FF6B35";
      t.beginPath(); t.moveTo(0, L / 2); t.lineTo(W, L / 2); t.stroke();
      t.beginPath(); t.arc(W / 2, L / 2, 96, 0, Math.PI * 2); t.fillStyle = "rgba(255,210,63,.25)"; t.fill(); t.stroke();
      t.beginPath(); t.arc(W / 2, L / 2, 84, 0, Math.PI * 2); t.setLineDash([3, 11]); t.lineWidth = 4; t.strokeStyle = "#FF3D7F"; t.stroke(); t.setLineDash([]);
      // ombre intérieure
      t.shadowColor = "rgba(60,30,10,.45)"; t.shadowBlur = 18 * k; t.lineWidth = 12; t.strokeStyle = "rgba(60,30,10,.35)";
      rr(t, -6, -6, W + 12, L + 12, 24); t.stroke(); t.shadowBlur = 0;
      t.restore();
      rr(t, 0, 0, W, L, 20); t.lineWidth = 3; t.strokeStyle = INK; t.stroke();
      // texte du rond central, toujours à l'endroit
      const [cx, cy] = toScreen(W / 2, L / 2);
      t.save(); setUpright(t, cx, cy, V.s);
      t.textAlign = "center"; t.textBaseline = "middle";
      t.font = "30px " + SCRIPT; t.fillStyle = "rgba(194,24,91,.55)"; t.fillText("Muscle", 0, -16);
      t.font = "26px " + DISPLAY; t.fillStyle = "rgba(255,107,53,.75)"; t.fillText("BEACH", 0, 20);
      t.restore();
      // petites étoiles décoratives sur le cadre
      setM(t);
      t.fillStyle = "rgba(255,210,63,.8)";
      for (const [x, y] of [[-RIM / 2, L * 0.25], [W + RIM / 2, L * 0.25], [-RIM / 2, L * 0.75], [W + RIM / 2, L * 0.75]]) { star4(t, x, y, 7); t.fill(); }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive && V.w) buildTable(); }).catch(() => {});

    /* ================= Événements de l'hôte (tous les téléphones) ================= */
    let spawnAt = -9, dropAt = -9, goalSide = -1;
    function launchConfetti() {
      if (RM) return;
      const cols = ["#FF3D7F", "#19C8F0", "#FFD23F", "#FF6B35", "#B79CFF", "#7BD389", "#FFFFFF"];
      for (let i = 0; i < 150; i++) {
        FX.confetti.push({x: rand(0, V.w), y: rand(-V.h * 0.5, -10), vx: rand(-40, 40), vy: rand(60, 160), rot: rand(0, 6), vr: rand(-8, 8),
          w: rand(6, 12), h: rand(4, 7), color: cols[(Math.random() * cols.length) | 0], sway: rand(0, 6)});
      }
    }
    function fireEvent(e) {
      const code = e[2], a = e.slice(3);
      if (code === 1) { // frappe (vue des autres téléphones)
        const s = a[0];
        if (s === mySeat || nowS() - tentFx[s] < 0.35) return;
        hitFx(s, a[2], a[3], a[1], !!a[4]);
      } else if (code === 3) { // but
        const scorer = a[0], def = 1 - scorer, gy = def === 0 ? L : 0;
        burst(a[1], gy, COL[scorer], 50, 560, def === 0 ? -Math.PI / 2 : Math.PI / 2, 1.2);
        if (!RM) FX.shake = 18;
        FX.flash = {t: 0, life: 1.7, side: scorer, text: EXCL[a[2]] || EXCL[0]};
        goalSide = def;
        react(scorer, "ah-flex", 1900); react(def, "ah-sad", 1900);
        sfx.goal(mySeat < 0 || scorer === mySeat);
        announce(`But de ${name(scorer)} !`);
      } else if (code === 6) { addFloat(W / 2, L / 2, "GO !", "#FFD23F", 0.16, 0.8); sfx.go(); }
      else if (code === 7) { spawnAt = FX.time; goalSide = -1; }
      else if (code === 8) {
        const w = a[0];
        react(w, "ah-flex", 0); react(1 - w, "ah-sad", 0);
        launchConfetti(); sfx.win();
      } else if (code === 10) { addFloat(W / 2, L / 2, "TEMPS ÉCOULÉ !", "#FFD23F", 0.12, 1.6); tone(880, 0.5, "square", 0.12, 440); }
      else if (code === 9) {
        addFloat(W / 2, L / 2, "BUT EN OR !", "#FFD23F", 0.13, 2.2);
        sfx.gold(); announce("Temps écoulé, égalité : le prochain but gagne !");
      }
    }

    /* ================= Boucle d'affichage ================= */
    let raf = 0, lastFrame = 0, alive = true, prevSc = [0, 0], prevCdN = 0, endShownAt = 0, playSeen = 0, prevClock = "";
    const trail = [];
    let spin = 0, prevIn = -1;
    const disp = {p: {x: W / 2, y: L / 2, in: -1}, m: [{x: HOME[0][0], y: HOME[0][1]}, {x: HOME[1][0], y: HOME[1][1]}], om: null};
    const samples = [];
    let sampling = false;
    /* ---------- palet affiché : historique de la simulation, avec un léger retard (borné) côté adversaire ----------
       Dans ma moitié : temps présent (mes frappes sont instantanées). Dans la moitié adverse, l'affichage recule
       doucement d'au plus 80 ms (ou 60 % de la latence) : les frappes adverses, connues avec retard, corrigent
       moins la trajectoire. Le recul est limité en vitesse : le palet ne paraît jamais plus lent que ~80 %. */
    const WARP = {f: 0, D: 0.06, Dsm: null};
    function histPos(R, tk, fb) {
      const a = Math.floor(tk), fr = tk - a, A = R[((a % N) + N) % N];
      if (!A || A.t !== a) return fb;
      const B = R[(a + 1) % N];
      if (B && B.t === a + 1 && A.in < 0 && B.in < 0) return {x: A.x + (B.x - A.x) * fr, y: A.y + (B.y - A.y) * fr, vx: B.vx, vy: B.vy, in: -1};
      const ext = A.in < 0 ? fr * TICK : 0;
      return {x: A.x + A.vx * ext, y: A.y + A.vy * ext, vx: A.vx, vy: A.vy, in: A.in};
    }
    function rawDisp() {
      const R = api.isHost ? H.PH : C.PH, cur = api.isHost ? H.p : C.p;
      const tk = api.isHost ? H.k + clamp(acc, 0, TICK) / TICK : Math.min((nowS() - C.co) / TICK, C.k + 2);
      return histPos(R, tk - WARP.f * WARP.D / TICK, {x: cur.x, y: cur.y, vx: cur.vx, vy: cur.vy, in: cur.in});
    }
    function updateWarp(dt) {
      let D; // avance de l'affichage sur la dernière info sûre concernant l'adversaire
      if (api.isHost) D = H.delays.length ? H.delays.reduce((a, b) => a + b, 0) / H.delays.length : 0.08;
      else D = C.S ? clamp(nowS() - C.co - C.S.k * TICK, 0, 0.4) : 0.06;
      WARP.Dsm = WARP.Dsm == null ? D : WARP.Dsm + (D - WARP.Dsm) * Math.min(1, dt * 2);
      WARP.D = mySeat < 0 && !api.isHost ? WARP.Dsm : Math.min(0.08, WARP.Dsm * 0.6);
      const cur = api.isHost ? H.p : C.p;
      let ft = 1;
      if (mySeat >= 0) ft = clamp((mySeat === 0 ? L / 2 - cur.y : cur.y - L / 2) / (L / 2) * 1.5, 0, 1);
      WARP.f += clamp(ft - WARP.f, -2.5 * dt, 2.5 * dt);
    }
    function decayEo(eo, pk, dt) {
      // près de mon maillet, la correction se résorbe plus vite (l'image doit coller à la frappe)
      const m = mySeat >= 0 ? (api.isHost ? H.m[mySeat] : C.me) : null;
      const near = m && Math.hypot(pk.x - m.x, pk.y - m.y) < 230;
      const k = Math.exp(-dt * (near ? 24 : 11));
      eo.x *= k; eo.y *= k;
    }
    function view(dt) {
      if (api.isHost) {
        const S = H;
        updateWarp(dt);
        decayEo(H.eo, H.p, dt);
        const r = rawDisp();
        disp.p = {x: r.x + H.eo.x, y: r.y + H.eo.y, in: r.in, vx: r.vx, vy: r.vy};
        disp.m = H.m.map(m => ({x: m.x, y: m.y}));
        return {ph: S.ph, sc: S.sc, tl: S.tl, gg: S.gg, cd: S.cd, lh: S.lh, w: S.w, ff: S.ff, tz: S.tz};
      }
      const S = C.S;
      if (!S) return null;
      updateWarp(dt);
      decayEo(C.eo, C.p, dt);
      const r = rawDisp();
      disp.p = {x: r.x + C.eo.x, y: r.y + C.eo.y, in: r.in, vx: r.vx, vy: r.vy};
      for (let s = 0; s < 2; s++) {
        if (s === mySeat) disp.m[s] = {x: C.me.x, y: C.me.y};
        else {
          const o = C.OH[s][C.k % N] || oppAt(s, C.k);
          if (o) { const d = disp.m[s], a = 1 - Math.exp(-dt * 28); d.x += (o.x - d.x) * a; d.y += (o.y - d.y) * a; }
        }
      }
      const ageS = Math.max(0, nowS() - C.co - S.k * TICK);
      return {ph: S.ph, sc: S.sc, tl: Math.max(0, (S.t || 0) / 10 - (S.ph === "p" ? ageS : 0)), gg: S.gg, cd: S.ph === "c" ? Math.max(0, (S.cd || 0) - ageS) : 0,
        lh: S.lh, w: S.w, ff: S.ff, tz: S.tz};
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
      // clavier : déplace ma cible (directions à l'écran)
      if (mySeat >= 0 && held.size) {
        let dx = 0, dy = 0;
        for (const k of held.values()) { dx += k[0]; dy += k[1]; }
        if (dx || dy) { const f = (V.rot === 2 ? -1 : 1) * 950 * dt; setTarget(localT.x + clamp(dx, -1, 1) * f, localT.y + clamp(dy, -1, 1) * f); }
      }
      if (api.isHost) hostLoop(); else { clientAdvance(dt); maybeSend(); }
      while (evQueue.length) fireEvent(evQueue.shift());
      const v = view(dt);
      if (v) {
        if (sampling && samples.length < 20000) samples.push([performance.now(), Date.now(), disp.p.x, disp.p.y, v.ph, disp.p.in, api.isHost ? H.p.x : C.p.x, api.isHost ? H.p.y : C.p.y, WARP.f * WARP.D]);
        if (v.ph === "c") {
          const n = Math.max(1, Math.ceil(v.cd));
          if (n !== prevCdN && n <= 3) { prevCdN = n; sfx.count(); }
        } else prevCdN = 0;
        for (let s = 0; s < 2; s++) {
          if (v.sc[s] !== prevSc[s]) {
            scoreEl[s].textContent = String(v.sc[s]);
            if (v.sc[s] > prevSc[s]) { scoreEl[s].classList.remove("ah-bump"); void scoreEl[s].offsetWidth; scoreEl[s].classList.add("ah-bump"); }
            prevSc[s] = v.sc[s];
          }
        }
        const sec = Math.ceil(v.tl - 0.001);
        const clk = v.gg ? "BUT EN OR" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        if (clk !== prevClock) {
          prevClock = clk; clockEl.textContent = clk;
          clockEl.classList.toggle("ah-gold", !!v.gg);
          clockEl.classList.toggle("ah-hurry", !v.gg && sec <= 10 && v.ph !== "o");
        }
        if (v.ph === "p" && !playSeen) playSeen = now;
        if ((playSeen && now - playSeen > 4) || (interacted && playSeen) || v.ph === "o" || FX.flash) hintEl.classList.add("ah-off");
        if (v.ph === "o" && v.w != null && v.w >= 0 && !FX.over) {
          FX.over = true; matchOver = true; endShownAt = now + 1.4;
          const wEl = endEl.querySelector("h2 span");
          wEl.textContent = name(v.w); wEl.style.setProperty("--wc", COL[v.w]);
          endEl.querySelector(".ah-win").innerHTML = bust(v.w, "flex");
          endEl.querySelector(".ah-fin").textContent = `${v.sc[v.w]} – ${v.sc[1 - v.w]}`;
          endEl.querySelector(".ah-tease").textContent = v.ff ? `Victoire par forfait : ${name(1 - v.w)} a quitté la plage !`
            : (mySeat === v.w ? "Champion de Muscle Beach ! " : "") + (TEASES[v.tz] || TEASES[0]);
          announce(`${name(v.w)} gagne la partie !`);
        }
        if (FX.over && endEl.hidden && now >= endShownAt) endEl.hidden = false;
        // chute du palet dans la fente, traînée et rotation
        if (disp.p.in >= 0 && prevIn < 0) dropAt = FX.time;
        prevIn = disp.p.in;
        const p = disp.p, sp = Math.hypot(p.vx || 0, p.vy || 0);
        spin += dt * sp * 0.006;
        if (v.ph === "p" && p.in < 0) { trail.push(p.x, p.y, sp); if (trail.length > 42) trail.splice(0, 3); }
        else trail.length = 0;
      }
      for (const pt of FX.particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.93; pt.vy *= 0.93; }
      FX.particles = FX.particles.filter(pt => pt.t < pt.life);
      for (const f of FX.floats) f.t += dt;
      FX.floats = FX.floats.filter(f => f.t < f.life);
      for (const r of FX.rings) r.t += dt;
      FX.rings = FX.rings.filter(r => r.t < r.life);
      for (const cf of FX.confetti) { cf.vy = Math.min(cf.vy + 120 * dt, 220); cf.x += (cf.vx + Math.sin(FX.time * 3 + cf.sway) * 30) * dt; cf.y += cf.vy * dt; cf.rot += cf.vr * dt; }
      FX.confetti = FX.confetti.filter(cf => cf.y < V.h + 30);
      if (FX.flash) { FX.flash.t += dt; if (FX.flash.t > FX.flash.life) FX.flash = null; }
      FX.shake *= Math.exp(-dt * 8); if (FX.shake < 0.2) FX.shake = 0;
      draw(v);
    }
    function textOutlined(c, txt, x, y, size, fill, maxW, font) {
      c.font = size + "px " + (font || DISPLAY);
      if (maxW) { const tw = c.measureText(txt).width; if (tw > maxW) { size = Math.max(10, size * maxW / tw); c.font = size + "px " + (font || DISPLAY); } }
      c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
      c.lineWidth = Math.max(4, size * 0.16); c.strokeStyle = INK; c.strokeText(txt, x, y);
      c.fillStyle = fill; c.fillText(txt, x, y);
    }
    function drawMallet(c, s, x, y, sx, sy) {
      setM(c, sx, sy);
      const ox = V.rot === 2 ? -4 : 4, oy = V.rot === 2 ? -7 : 7;
      c.beginPath(); c.arc(x + ox, y + oy, MR, 0, 7); c.fillStyle = "rgba(40,20,10,.3)"; c.fill();
      // disque de fonte aux couleurs du joueur
      c.save(); c.shadowColor = COL[s]; c.shadowBlur = 14 * V.dpr * V.s;
      c.beginPath(); c.arc(x, y, MR, 0, 7); c.fillStyle = COL[s]; c.fill(); c.restore();
      c.beginPath(); c.arc(x, y, MR - 9, 0, 7); c.lineWidth = 5; c.strokeStyle = COL_D[s]; c.stroke();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; c.beginPath(); c.arc(x + Math.cos(a) * (MR - 18), y + Math.sin(a) * (MR - 18), 3, 0, 7); c.fillStyle = "rgba(29,20,32,.45)"; c.fill(); }
      c.beginPath(); c.arc(x, y, MR, 0, 7); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      // poignée
      c.beginPath(); c.arc(x, y, MR * 0.42, 0, 7); c.fillStyle = COL_L[s]; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
      const [X, Y] = toScreen(x, y);
      setUpright(c, X, Y, V.s, sx, sy);
      c.beginPath(); c.arc(-6, -6, 6, 0, 7); c.fillStyle = "rgba(255,255,255,.85)"; c.fill();
      c.beginPath(); c.arc(-MR * 0.55, -MR * 0.55, 5, 0, 7); c.fillStyle = "rgba(255,255,255,.45)"; c.fill();
    }
    function drawPuck(c, v, sx, sy) {
      const p = disp.p;
      let sc = 1, alpha = 1;
      if (p.in >= 0) { const k = clamp((FX.time - dropAt) / 0.35, 0, 1); sc = 1 - 0.55 * k; alpha = 1 - k; }
      const sk = clamp((FX.time - spawnAt) / 0.4, 0, 1);
      if (sk < 1) sc *= 1 - Math.pow(1 - sk, 3) * Math.cos(sk * 7);
      if (alpha <= 0.01) return;
      const hc = v.lh >= 0 ? COL[v.lh] : "#FF6B35";
      // traînée
      if (trail.length > 6 && !RM) {
        setM(c, sx, sy);
        const n = trail.length / 3;
        for (let i = 0; i < n - 1; i++) {
          const k = (i + 1) / n, sp = trail[i * 3 + 2];
          if (sp < 500) continue;
          const hot = sp > MAXV + 50;
          c.globalAlpha = Math.min(0.42, (sp - 500) / 2400) * k;
          c.fillStyle = hot ? (i % 2 ? "#FFD23F" : "#FF6B35") : hc;
          c.beginPath(); c.arc(trail[i * 3], trail[i * 3 + 1], PR * (0.35 + 0.6 * k) * (hot ? 1.15 : 1), 0, 7); c.fill();
        }
        c.globalAlpha = 1;
      }
      const [X, Y] = toScreen(p.x, p.y);
      setUpright(c, X, Y, V.s * sc, sx, sy);
      c.globalAlpha = alpha;
      c.beginPath(); c.arc(3, 5, PR, 0, 7); c.fillStyle = "rgba(40,20,10,.3)"; c.fill();
      c.beginPath(); c.arc(0, 0, PR, 0, 7); c.fillStyle = "#FFF6E6"; c.fill();
      c.lineWidth = 5; c.strokeStyle = hc; c.beginPath(); c.arc(0, 0, PR - 5, 0, 7); c.stroke();
      // tourbillon fraise-chocolat du shaker
      c.save(); c.rotate(spin); c.lineCap = "round";
      c.lineWidth = 4.5; c.strokeStyle = "#FF7EB0"; c.beginPath(); c.arc(0, 0, 13, 0.2, 2.6); c.stroke();
      c.strokeStyle = "#7A4B25"; c.beginPath(); c.arc(0, 0, 13, 3.3, 5.7); c.stroke();
      c.lineWidth = 3.5; c.strokeStyle = "#FF7EB0"; c.beginPath(); c.arc(0, 0, 6, 3.5, 5.6); c.stroke();
      c.strokeStyle = "#7A4B25"; c.beginPath(); c.arc(0, 0, 6, 0.4, 2.5); c.stroke();
      c.restore();
      c.beginPath(); c.arc(0, 0, 3.4, 0, 7); c.fillStyle = "#FFD23F"; c.fill(); c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 3.2; c.strokeStyle = INK; c.beginPath(); c.arc(0, 0, PR, 0, 7); c.stroke();
      c.beginPath(); c.ellipse(-11, -12, 7, 4, -0.7, 0, 7); c.fillStyle = "rgba(255,255,255,.9)"; c.fill();
      c.globalAlpha = 1;
    }
    function draw(v) {
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      const sh = FX.shake > 0 && !RM ? FX.shake * V.s : 0;
      const sx = sh ? rand(-1, 1) * sh : 0, sy = sh ? rand(-1, 1) * sh : 0;
      c.setTransform(1, 0, 0, 1, V.dpr * sx, V.dpr * sy);
      c.drawImage(table, 0, 0);
      const cs = V.s * W;
      const [CX, CY] = toScreen(W / 2, L / 2);
      if (!v) {
        c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
        textOutlined(c, "Connexion à l'hôte…", CX, CY - cs * 0.3, cs * 0.07, "#FFFFFF", cs * 0.9);
        return;
      }
      // la cage du but encaissé s'illumine
      if (goalSide >= 0 && FX.flash) {
        setM(c, sx, sy);
        c.globalAlpha = 0.5 + 0.5 * Math.sin(FX.time * 20);
        rr(c, W / 2 - GW, goalSide === 0 ? L - 4 : -RIM - 2, 2 * GW, RIM + 6, 10); c.fillStyle = COL[1 - goalSide]; c.fill();
        c.globalAlpha = 1;
      }
      // maillets (le mien dessiné en dernier, au-dessus)
      const order = mySeat === 0 ? [1, 0] : [0, 1];
      drawPuck(c, v, sx, sy);
      for (const s of order) drawMallet(c, s, disp.m[s].x, disp.m[s].y, sx, sy);
      setM(c, sx, sy);
      for (const r of FX.rings) {
        const k = r.t / r.life;
        c.globalAlpha = 1 - k; c.lineWidth = 10 * (1 - k) + 2; c.strokeStyle = r.color;
        c.beginPath(); c.arc(r.x, r.y, PR + k * 160, 0, 7); c.stroke();
      }
      for (const pt of FX.particles) {
        c.globalAlpha = 1 - pt.t / pt.life; c.fillStyle = pt.color;
        if (pt.star) { star4(c, pt.x, pt.y, pt.size * 1.8); c.fill(); }
        else { c.strokeStyle = pt.color; c.lineWidth = pt.size; c.lineCap = "round"; c.beginPath(); c.moveTo(pt.x, pt.y); c.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03); c.stroke(); }
      }
      c.globalAlpha = 1;
      c.setTransform(V.dpr, 0, 0, V.dpr, V.dpr * sx, V.dpr * sy);
      if (FX.flash) {
        const f = FX.flash;
        const fa = Math.max(0, (RM ? 0.15 : 0.35) * (1 - f.t / 0.3));
        if (fa > 0) { c.fillStyle = COL[f.side]; c.globalAlpha = fa; c.fillRect(-20, -20, V.w + 40, V.h + 40); c.globalAlpha = 1; }
        const k = Math.min(1, f.t / 0.3);
        const s = RM ? 1 : (k < 1 ? 0.3 + 0.7 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)) : 1 + Math.sin(f.t * 9) * 0.02);
        c.save(); c.globalAlpha = Math.max(0, f.t > f.life - 0.35 ? (f.life - f.t) / 0.35 : 1);
        c.translate(CX, CY - cs * 0.1); c.rotate(-0.08); c.scale(s, s);
        textOutlined(c, "BUT !", 0, 0, cs * 0.34, COL[f.side], Math.min(V.w, cs * 1.3) - 16);
        c.rotate(0.08);
        textOutlined(c, f.text, 0, cs * 0.22, cs * 0.085, "#FFFFFF", Math.min(V.w, cs * 1.3) - 30);
        const who = f.side === mySeat ? "Tu marques !" : (mySeat >= 0 ? "Encaissé… " + name(f.side) + " marque" : name(f.side) + " marque !");
        textOutlined(c, who, 0, cs * 0.32, cs * 0.06, "#FFD23F", Math.min(V.w, cs * 1.3) - 40);
        c.restore();
      }
      for (const fl of FX.floats) {
        const k = fl.t / fl.life, pop = Math.min(1, fl.t / 0.15), size = fl.size * cs;
        let [X, Y] = toScreen(fl.x, fl.y);
        Y -= size * 0.6;
        c.font = size + "px " + DISPLAY;
        const tw = Math.min(c.measureText(fl.text).width, V.w - 24);
        X = clamp(X, 12 + tw / 2, V.w - 12 - tw / 2);
        c.save(); c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.translate(X, Y - k * cs * 0.08); c.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
        textOutlined(c, fl.text, 0, 0, size, fl.color, V.w - 24);
        c.restore();
      }
      if (v.ph === "c") {
        const n = clamp(Math.ceil(v.cd), 1, 3);
        const frac = v.cd - Math.floor(v.cd);
        const s = RM ? 1 : 1 + Math.max(0, frac - 0.6) * 1.6;
        textOutlined(c, "Prêts ?", CX, CY - cs * 0.42, cs * 0.09, "#FFFFFF", cs * 0.9);
        textOutlined(c, `Premier à ${TARGET} buts · 3 min`, CX, CY - cs * 0.31, cs * 0.055, "#FFD23F", cs * 0.95);
        c.save(); c.translate(CX, CY); c.scale(s, s);
        textOutlined(c, String(n), 0, 0, cs * 0.3, ["#FFD23F", "#FF3D7F", "#19C8F0"][n - 1] || "#FFD23F");
        c.restore();
      } else if (v.ph === "o" && v.w != null && endEl.hidden && !FX.flash) {
        textOutlined(c, name(v.w) + " gagne !", CX, CY - cs * 0.3, cs * 0.1, COL[v.w], cs * 0.95);
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
    let sendTimer = null;
    if (!api.isHost && mySeat >= 0) sendTimer = setInterval(maybeSend, 33); // continue d'envoyer si l'affichage est ralenti

    // Petit crochet de test (inoffensif) : état, mesures et commandes pour les tests automatisés.
    const dbg = {
      seat: mySeat, isHost: api.isHost,
      stats: () => Object.assign({lead: C.lead, rtt: C.rttS.length ? minOf(C.rttS) : null, hold: H ? H.hold : null}, stats),
      view: () => ({ph: api.isHost ? H.ph : C.ph, sc: (api.isHost ? H.sc : (C.S ? C.S.sc : [0, 0])).slice(), puck: [disp.p.x, disp.p.y, disp.p.vx, disp.p.vy, disp.p.in],
        m: disp.m.map(m => [m.x, m.y]), pend: C.pendQ, k: api.isHost ? H.k : C.k}),
      host: api.isHost ? () => ({ph: H.ph, k: H.k, sc: H.sc.slice(), p: puckArr(H.p), m: H.m.map(m => [ri(m.x), ri(m.y)]), tl: H.tl, gg: H.gg}) : null,
      aim: (x, y) => setTarget(x, y),
      forceGoal: s => { if (!api.isHost) return false; forceGoalReq = s; return true; },
      setTime: t => { if (!api.isHost) return false; H.tl = t; return true; },
      sample: on => { sampling = !!on; if (on) samples.length = 0; return samples.length; },
      samples: () => samples.slice()
    };
    window.__ahDebug = dbg;

    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        if (hostTimer) clearInterval(hostTimer);
        if (sendTimer) clearInterval(sendTimer);
        if (finishTimer) clearTimeout(finishTimer);
        reactTimers.forEach(t => t && clearTimeout(t));
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("resize", layout);
        if (ro) ro.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onMq);
        if (actx) { try { actx.close(); } catch (e) { /* ignore */ } }
        if (window.__ahDebug === dbg) delete window.__ahDebug;
        el.innerHTML = "";
      }
    };
  }
});
