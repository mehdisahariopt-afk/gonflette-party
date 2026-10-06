/* Gonflette Party : Développé couché (2 à 8 joueurs, chacun sur son téléphone).
   Course de rythme : une jauge oscille, on tape quand le curseur est dans la zone verte.

   Réseau :
   - Chaque téléphone fait tourner SA jauge localement (pas de latence, équitable) et envoie
     api.setInput({seq, reps, kg, fails}) (valeurs absolues, au plus ~7 fois par seconde).
   - L'hôte (qui peut être spectateur) gère le chrono, recalcule les kilos à partir des reps
     (pas de triche sur les kg), publie ~5 fois par seconde :
       {ph: "cd"|"go"|"end"|"fin", r: dixièmes de seconde restants dans la phase, s: [[kg, reps, fails], …] par siège}
   - "end" = temps écoulé (on n'accepte plus de tap, petite grâce réseau), "fin" = classement final ~3 s,
     puis api.finish.
   Test : window.__dcSpeed = 3 (avant le lancement, sur l'hôte) raccourcit le chrono. */
GONFLETTE.registerGame({
  id: "developpe",
  name: "Développé couché",
  min: 2,
  max: 8,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, A = GONFLETTE.avatar;
    const SP = Math.max(1, Math.min(20, +window.__dcSpeed || 1));
    const CD_MS = 3000 / SP, DUR_MS = 45000 / SP, GRACE_MS = 700, FINAL_MS = 3200;
    const mySeat = P.findIndex(p => p.key === api.me);
    const me = mySeat >= 0 ? P[mySeat] : null;
    const playing = !!(api.isPlayer && me);
    let RM = false;
    try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { RM = false; }

    const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

    /* ---------- règles (communes à tous) ---------- */
    const weightAt = lvl => 40 + 10 * lvl;                    // barre 20 kg + disques
    const kgFor = reps => { let s = 0; for (let i = 0; i < reps; i++) s += weightAt(Math.floor(i / 3)); return s; };
    const speedFor = lvl => Math.min(1.55, 0.5 + 0.085 * lvl); // allers-retours par seconde
    const muscleOf = p => (A && A.muscle ? A.muscle(p ? p.xp : 0) : 0);
    const bonus = me ? 0.15 * clamp(muscleOf(me) / 1.35, 0, 1) : 0;
    const zoneFor = lvl => Math.max(0.075, 0.30 * Math.pow(0.88, lvl)) * (1 + bonus);
    const PLATES = [[25, "#e63946", 76, 11], [20, "#3a86ff", 67, 10], [15, "#ffd166", 58, 9], [10, "#2bb673", 48, 8], [5, "#e9e4ea", 32, 6]];
    const platesFor = kg => { let side = (kg - 20) / 2; const out = []; for (const pl of PLATES) while (side >= pl[0] && out.length < 9) { out.push(pl); side -= pl[0]; } return out; };

    /* ---------- géométrie de la scène (vue depuis les pieds du banc) ---------- */
    const VW = 360, VH = 290, CX = 180;
    const m = muscleOf(me || P[0]), mc = Math.min(m, 1);
    const hw = Math.max(19 + 50 * m + 7 + 28 * m + 10, 62);
    const headY = 50 + 12 * m, headR = 25 - 6 * mc - 2 * Math.max(0, m - 1);
    // recadrage « buste » : de la tête à la taille, aligné en bas de la scène (le banc est dessous)
    const vbx = 100 - hw, vby = headY - headR - 18, cw = hw * 2, ch = Math.min(cw, 165 - vby);
    const k = Math.min(170 / ch, 300 / cw), AVW = cw * k, AVH = ch * k, AVX = CX - AVW / 2, AVY = VH - AVH;
    const sx = ax => AVX + (ax - vbx) * k, sy = ay => AVY + (ay - vby) * k;
    const SW = 19 + 50 * m, yS = 100 + 2 * m;
    const shL = [sx(100 - (SW - 5)), sy(yS + 12)], shR = [sx(100 + (SW - 5)), sy(yS + 12)];
    const ARM = (7 + 28 * m) * k * 0.9, FIST = (5.5 + 6 * m) * k + 2;
    const gripX = (SW - 5) * k + 18 + 6 * k;
    const BAR_DOWN = Math.min(shL[1] + 14, 226);
    const BAR_UP = Math.max(64, Math.min(sy(headY - headR) - 16, BAR_DOWN - 70));
    const POST = [66, 294], COLLAR = [52, 308];

    let avatarSvg = "";
    if (playing) avatarSvg = api.avatar(api.me, {view: "bust"}).replace(/viewBox="[^"]*"/, `viewBox="${vbx.toFixed(1)} ${vby.toFixed(1)} ${cw.toFixed(1)} ${ch.toFixed(1)}" x="${AVX.toFixed(1)}" y="${AVY.toFixed(1)}" width="${AVW.toFixed(1)}" height="${AVH.toFixed(1)}"`).replace(/class="av"/, 'class="dc-me"');

    const fans = [[14, 252, "#3a86ff"], [44, 262, "#ff006e"], [24, 278, "#ffd166"], [346, 250, "#2bb673"], [316, 262, "#ff7b00"], [336, 280, "#8338ec"]]
      .map(([x, y, c], i) => `<g class="dc-fan" style="--d:${(i % 3) * 60}ms"><path d="M${x - 15} ${y + 30}q0-18 15-18t15 18z" fill="${c}" opacity=".55"/><circle cx="${x}" cy="${y}" r="9" fill="#0c0910"/><path d="M${x - 12} ${y - 2}l-4-14M${x + 12} ${y - 2}l4-14" stroke="#0c0910" stroke-width="5" stroke-linecap="round" class="dc-hands"/></g>`).join("");
    const holes = y0 => { let s = ""; for (let y = y0; y < VH; y += 16) s += `<circle cx="0" cy="${y}" r="1.6" fill="#0c0910"/>`; return s; };

    const sceneSvg = `<svg class="dc-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="dc-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c1f37"/><stop offset="1" stop-color="#171019"/></linearGradient>
        <pattern id="dc-brick" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 0.5h40M0 10.5h40M20 0v10M0 10v10M40 10v10" stroke="#ffffff" stroke-opacity=".045" fill="none"/></pattern>
        <linearGradient id="dc-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6470"/><stop offset=".45" stop-color="#c9ced6"/><stop offset="1" stop-color="#4a505a"/></linearGradient>
        <linearGradient id="dc-barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f4f7"/><stop offset=".5" stop-color="#9aa1ab"/><stop offset="1" stop-color="#5c626b"/></linearGradient>
        <filter id="dc-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="-200" y="-600" width="${VW + 400}" height="${VH + 600}" fill="#2c1f37"/><rect x="-200" width="${VW + 400}" height="${VH}" fill="url(#dc-wall)"/><rect x="-200" y="-600" width="${VW + 400}" height="${VH + 600}" fill="url(#dc-brick)"/>
      <text x="${CX}" y="42" text-anchor="middle" class="dc-neon" filter="url(#dc-glow)">Gonflette Gym</text>
      <text x="${CX}" y="60" text-anchor="middle" class="dc-neon2">NO PAIN · NO GAIN</text>
      <rect x="-200" y="${VH - 34}" width="${VW + 400}" height="34" fill="#0f0c12"/><path d="M-200 ${VH - 34}h${VW + 400}" stroke="#ffcc33" stroke-opacity=".25" stroke-width="2" stroke-dasharray="14 10"/>
      <g class="dc-crowd" id="dc-crowd">${fans}</g>
      ${POST.map(x => `<g transform="translate(${x} 0)"><rect x="-6" y="70" width="12" height="${VH - 70}" fill="url(#dc-steel)" stroke="#0c0910" stroke-width="2"/>${holes(84)}<rect x="-14" y="${VH - 10}" width="28" height="10" rx="2" fill="#2a2f36" stroke="#0c0910" stroke-width="2"/></g>`).join("")}
      ${POST.map((x, i) => `<path d="M${x + (i ? -6 : 6)} ${BAR_UP + 10}h${i ? -9 : 9}v-13" stroke="#20242a" stroke-width="5" fill="none" stroke-linejoin="round"/>`).join("")}
      <path d="M${CX - 50} 175 L${CX + 50} 175 L${CX + 70} ${VH} L${CX - 70} ${VH} Z" fill="#8c1f30" stroke="#0c0910" stroke-width="3"/><path d="M${CX - 40} 182 L${CX - 56} ${VH}" stroke="#ffffff" stroke-opacity=".15" stroke-width="5"/>
      ${avatarSvg}
      <g id="dc-arms"></g>
      <g id="dc-bar"></g>
      <g id="dc-fists"></g>
      <g id="dc-chalk"></g>
    </svg>`;

    el.innerHTML = `<style>
      .dc{--ink:#1d1420;--g:#3ccf8e;--gold:#ffcc33;--red:#ff4d5e;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:8px 12px calc(12px + env(safe-area-inset-bottom,0px));max-width:560px;margin:0 auto;color:#f5efe6;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .dc *{box-sizing:border-box}
      .dc-board{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:5px}
      .dc-chip{position:relative;display:flex;align-items:center;gap:4px;min-width:0;padding:3px 6px 3px 3px;border-radius:10px;background:#231b2b;border:2px solid rgba(255,255,255,.12);transition:transform .25s}
      .dc-chip.me{border-color:var(--gold);box-shadow:0 0 12px rgba(255,204,51,.3)}
      .dc-chip.off{opacity:.4}
      .dc-chip .rk{position:absolute;left:-3px;top:-5px;font-family:Anton,Impact,sans-serif;font-size:.72rem;background:var(--gold);color:var(--ink);border-radius:999px;min-width:17px;height:17px;display:grid;place-items:center;border:2px solid var(--ink);line-height:1}
      .dc-chip .mini{flex:none;width:32px;height:32px;border-radius:8px;overflow:hidden;background:#3a2d44}
      .dc-chip .mini svg{width:100%;height:100%;display:block}
      .dc-chip .tx{min-width:0;display:flex;flex-direction:column;line-height:1}
      .dc-chip .nm{font-weight:700;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d8cde3}
      .dc-chip .kg{font-family:Anton,Impact,sans-serif;font-size:1.05rem;letter-spacing:.01em;white-space:nowrap}
      .dc-chip .kg small{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.7em;color:#b9aec6;margin-left:1px}
      .dc-chip.bump .kg{animation:dc-bump .35s}
      @keyframes dc-bump{40%{transform:scale(1.25);color:var(--gold)}}
      .dc-hud{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .dc-time{font-family:Anton,Impact,sans-serif;font-size:2.1rem;line-height:1;min-width:2.6em;display:flex;align-items:baseline;gap:3px}
      .dc-time small{font-family:"Barlow Condensed",sans-serif;font-size:.45em;font-weight:800;color:#b9aec6;letter-spacing:.08em}
      .dc-time.hot{color:var(--red);animation:dc-pulse .5s infinite alternate}
      @keyframes dc-pulse{to{transform:scale(1.08)}}
      .dc-stat{text-align:right;line-height:1.05}
      .dc-stat b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem;letter-spacing:.01em}
      .dc-stat span{display:block;font-weight:800;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#b9aec6}
      .dc-load{text-align:center;line-height:1.05}
      .dc-load b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem;color:var(--gold)}
      .dc-load span{display:block;font-weight:800;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#b9aec6}
      .dc-stage{position:relative;flex:1 1 auto;min-height:210px;border-radius:16px;overflow:hidden;border:3px solid var(--ink);background:#2c1f37}
      .dc-led{position:absolute;left:50%;top:8px;transform:translateX(-50%);max-width:calc(100% - 20px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 12px;border-radius:8px;background:#0b080d;border:2px solid #3a2d44;font-family:Anton,Impact,sans-serif;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase;color:#ffb347;text-shadow:0 0 6px #ff7b00,0 0 14px rgba(255,123,0,.5)}
      .dc-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
      .dc-neon{font-family:Pacifico,"Brush Script MT",cursive;font-size:26px;fill:#fff;stroke:#ff2e88;stroke-width:1.2px;paint-order:stroke}
      .dc-neon2{font-family:Anton,Impact,sans-serif;font-size:11px;letter-spacing:3px;fill:#7fe7ff;opacity:.75}
      .dc-fan{transform-box:fill-box;transform-origin:50% 100%}
      .dc-fan .dc-hands{opacity:0}
      .dc-crowd.cheer .dc-fan{animation:dc-jump .45s ease-out var(--d) 1}
      .dc-crowd.cheer .dc-hands{opacity:1}
      @keyframes dc-jump{35%{transform:translateY(-9px)}}
      .dc-puff{transform-box:fill-box;transform-origin:center;animation:dc-puff .7s ease-out forwards}
      @keyframes dc-puff{to{transform:translate(var(--dx),var(--dy)) scale(2.6);opacity:0}}
      .dc-plate.new{transform-box:fill-box;transform-origin:center;animation:dc-plate .45s cubic-bezier(.3,1.6,.5,1)}
      @keyframes dc-plate{from{transform:scaleY(.2) translateY(-60px);opacity:0}}
      .dc-float{position:absolute;left:50%;top:22%;transform:translateX(-50%);pointer-events:none;font-family:Anton,Impact,sans-serif;font-size:2.4rem;color:var(--g);text-shadow:3px 3px 0 var(--ink);white-space:nowrap;animation:dc-float .9s ease-out forwards}
      .dc-float.kg{font-size:1.3rem;color:#fff;top:34%}
      .dc-float.lvl{color:var(--gold);font-size:1.9rem;top:12%}
      .dc-float.bad{color:var(--red)}
      @keyframes dc-float{from{transform:translate(-50%,10px) scale(.7);opacity:0}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}to{transform:translate(-50%,-40px);opacity:0}}
      .dc-big{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font-family:Anton,Impact,sans-serif;font-size:5rem;color:#fff;text-shadow:4px 4px 0 var(--ink),0 0 30px rgba(255,204,51,.6)}
      .dc-big:empty{display:none}
      .dc-big.go{color:var(--gold);font-size:3.6rem}
      .dc-stamp{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) rotate(-12deg);pointer-events:none;text-align:center;border:6px solid var(--red);border-radius:14px;padding:4px 18px 8px;color:var(--red);background:rgba(23,16,25,.82);font-family:Anton,Impact,sans-serif;line-height:.95;animation:dc-stamp .45s cubic-bezier(.2,1.6,.4,1)}
      .dc-stamp b{display:block;white-space:nowrap;font-weight:400;font-size:4.2rem;letter-spacing:.02em}
      .dc-stamp span{display:block;white-space:nowrap;font-size:1.25rem;color:#fff}
      @keyframes dc-stamp{from{transform:translate(-50%,-50%) rotate(-12deg) scale(3);opacity:0}}
      .dc-ctl{display:flex;flex-direction:column;gap:8px}
      .dc-bonus{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:.9rem;letter-spacing:.04em;color:#b9aec6}
      .dc-bonus b{color:var(--g)}
      .dc-gauge{position:relative;height:58px;border-radius:14px;border:3px solid var(--ink);background:repeating-linear-gradient(90deg,#2a2232 0 10%,#251d2c 10% 20%);overflow:hidden;box-shadow:inset 0 3px 8px rgba(0,0,0,.6)}
      .dc-zone{position:absolute;top:0;bottom:0;background:linear-gradient(#5ff2a8,#21a866);box-shadow:0 0 18px rgba(60,207,142,.7);border-left:2px solid #c9ffe2;border-right:2px solid #c9ffe2;transition:left .25s,width .25s}
      .dc-track{position:absolute;inset:0;pointer-events:none;will-change:transform}
      .dc-needle{position:absolute;left:-4px;top:-2px;bottom:-2px;width:8px;border-radius:4px;background:#fff;box-shadow:0 0 0 2px var(--ink),0 0 12px #fff}
      .dc-gauge.stun{animation:dc-shake .3s 2}
      .dc-gauge.stun .dc-zone{background:#5a2a31;box-shadow:none}
      .dc-gauge.flash{box-shadow:0 0 0 3px var(--g),0 0 24px rgba(60,207,142,.8)}
      .dc-gauge.idle .dc-zone{opacity:.45}
      @keyframes dc-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      .dc-push{display:block;width:100%;min-height:96px;border:3px solid var(--ink);border-radius:18px;background:linear-gradient(#ff5a6b,#c8102e);color:#fff;font-family:Anton,Impact,sans-serif;font-size:2.3rem;letter-spacing:.04em;text-shadow:3px 3px 0 var(--ink);box-shadow:0 6px 0 var(--ink);cursor:pointer;touch-action:manipulation;line-height:1}
      .dc-push small{display:block;font-family:"Barlow Condensed",sans-serif;font-size:.85rem;font-weight:800;letter-spacing:.12em;text-shadow:none;opacity:.85;margin-top:4px}
      .dc-push:active,.dc-push.down{transform:translateY(4px);box-shadow:0 2px 0 var(--ink)}
      .dc-push[disabled]{background:#4a3f52;color:#b9aec6;cursor:default}
      .dc-push.stun{background:#5a2a31}
      .dc-spec{text-align:center;font-weight:800;color:#b9aec6;padding:14px;border:2px dashed rgba(255,255,255,.2);border-radius:14px}
      .dc-final{display:flex;flex-direction:column;gap:5px}
      .dc-final h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem;color:var(--gold);text-transform:uppercase;letter-spacing:.02em;text-align:center}
      .dc-row{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border-radius:12px;background:#231b2b;border:2px solid rgba(255,255,255,.1);animation:dc-in .35s both}
      .dc-row.me{border-color:var(--gold)}
      .dc-row.first{background:linear-gradient(90deg,#4a3a10,#231b2b)}
      .dc-row .pos{font-family:Anton,Impact,sans-serif;font-size:1.4rem;width:1.4em;text-align:center;color:var(--gold)}
      .dc-row .mini{flex:none;width:40px;height:40px;border-radius:9px;overflow:hidden;background:#3a2d44}
      .dc-row .mini svg{width:100%;height:100%;display:block}
      .dc-row .nm{flex:1;min-width:0;font-weight:800;font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dc-row .nm small{display:block;font-weight:700;font-size:.8rem;color:#b9aec6}
      .dc-row .kg{font-family:Anton,Impact,sans-serif;font-size:1.4rem;white-space:nowrap}
      @keyframes dc-in{from{transform:translateX(30px);opacity:0}}
      .dc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
      @media (min-height:900px){.dc-stage{min-height:300px}}
      @media (prefers-reduced-motion:reduce){.dc *{animation:none!important;transition:none!important}.dc-puff{display:none}}
    </style>
    <div class="dc" id="dc-root">
      <div class="dc-board" id="dc-board" style="--cols:${Math.min(P.length, 4)}" aria-label="Classement en direct"></div>
      <div class="dc-hud">
        <div class="dc-time" id="dc-time">45<small>S</small></div>
        <div class="dc-load"><b id="dc-weight">40 kg</b><span>sur la barre</span></div>
        <div class="dc-stat"><b id="dc-total">0 kg</b><span id="dc-reps">0 rep</span></div>
      </div>
      <div class="dc-stage" id="dc-stage">${sceneSvg}<div class="dc-led" id="dc-led">45 secondes au banc</div><div class="dc-big" id="dc-big"></div><div id="dc-fx"></div></div>
      <div class="dc-ctl" id="dc-ctl">${playing ? `
        <div class="dc-bonus"><span>Bonus muscles : <b>+${Math.round(bonus * 100)}&nbsp;%</b></span><span id="dc-fails">0 raté</span></div>
        <div class="dc-gauge idle" id="dc-gauge"><div class="dc-zone" id="dc-zone"></div><div class="dc-track" id="dc-track"><div class="dc-needle"></div></div></div>
        <button class="dc-push" id="dc-push" type="button" disabled>POUSSE !<small>Tape dans le vert · ou barre Espace</small></button>`
        : `<div class="dc-spec">Vous êtes spectateur : admirez la séance.</div>`}
      </div>
      <div class="dc-sr" role="status" aria-live="polite" id="dc-live"></div>
    </div>`;

    const $ = id => el.querySelector("#" + id);
    const root = $("dc-root"), board = $("dc-board"), stage = $("dc-stage"), fx = $("dc-fx"), big = $("dc-big");
    const barG = $("dc-bar"), armsG = $("dc-arms"), fistsG = $("dc-fists"), chalkG = $("dc-chalk"), crowd = $("dc-crowd");
    const gauge = $("dc-gauge"), zoneEl = $("dc-zone"), track = $("dc-track"), push = $("dc-push");
    const timeEl = $("dc-time"), live = $("dc-live");

    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const intervals = [];
    let raf = 0, dead = false;

    /* ---------- son (WebAudio, après un geste) ---------- */
    let ac = null;
    function audioOn() {
      if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return; }
      try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) { ac = null; }
    }
    function tone(f, d, type, v, f2, delay) {
      if (!ac) return;
      try {
        const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(v || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* son facultatif */ }
    }
    const sfx = {
      rep() { tone(220, 0.09, "square", 0.05, 120); tone(1046, 0.12, "triangle", 0.06, null, 0.04); },
      fail() { tone(140, 0.35, "sawtooth", 0.06, 70); },
      level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.06, null, i * 0.07)); },
      end() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, "square", 0.04, null, i * 0.12)); }
    };

    /* ---------- barre ---------- */
    function platesSvg(kg, fresh) {
      const pl = platesFor(kg);
      let L = "", R = "", xl = COLLAR[0] - 4, xr = COLLAR[1] + 4;
      pl.forEach((p, i) => {
        const [, c, h, w] = p, cls = fresh && i === pl.length - 1 ? "dc-plate new" : "dc-plate";
        L += `<rect class="${cls}" x="${xl - w}" y="${-h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" stroke="#0c0910" stroke-width="2.2"/>`;
        R += `<rect class="${cls}" x="${xr}" y="${-h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" stroke="#0c0910" stroke-width="2.2"/>`;
        xl -= w + 1; xr += w + 1;
      });
      return L + R;
    }
    let shownKg = -1;
    function drawBar(kg, fresh) {
      if (kg === shownKg) return;
      shownKg = kg;
      barG.innerHTML = `<rect x="2" y="-3.5" width="${VW - 4}" height="7" rx="3" fill="url(#dc-barg)" stroke="#0c0910" stroke-width="1.6"/>
        <rect x="${COLLAR[0] - 4}" y="-9" width="8" height="18" rx="2" fill="#7c838d" stroke="#0c0910" stroke-width="2"/><rect x="${COLLAR[1] - 4}" y="-9" width="8" height="18" rx="2" fill="#7c838d" stroke="#0c0910" stroke-width="2"/>
        ${platesSvg(kg, fresh)}
        <path d="M${CX - gripX - 6} 0h-14M${CX + gripX + 6} 0h14" stroke="#0c0910" stroke-opacity=".35" stroke-width="7" stroke-dasharray="2 2"/>`;
    }
    const skin = me && me.look && me.look.skin ? me.look.skin : (A && A.DEFAULT_LOOK ? A.DEFAULT_LOOK.skin : "#eebe98");
    let armPaths = null, fistEls = null;
    if (playing) {
      armsG.innerHTML = [0, 1].map(() => `<path stroke="#1d1420" stroke-width="${(ARM + 6).toFixed(1)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("") +
        [0, 1].map(() => `<path stroke="${esc(skin)}" stroke-width="${ARM.toFixed(1)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      armPaths = [...armsG.querySelectorAll("path")];
      fistsG.innerHTML = [0, 1].map(() => `<circle r="${FIST.toFixed(1)}" fill="${esc(skin)}" stroke="#1d1420" stroke-width="3"/>`).join("");
      fistEls = [...fistsG.querySelectorAll("circle")];
    }
    function placeBar(y, dx) {
      barG.setAttribute("transform", `translate(${dx.toFixed(1)} ${y.toFixed(1)})`);
      if (!playing) return;
      const ext = clamp((BAR_DOWN - y) / (BAR_DOWN - BAR_UP), 0, 1);
      [[shL, -1], [shR, 1]].forEach(([sh, d], i) => {
        const fx_ = CX + d * gripX + dx, ex = (sh[0] + fx_) / 2 + d * (1 - ext) * 20, ey = (sh[1] + y) / 2 + (1 - ext) * 14;
        const dd = `M${sh[0].toFixed(1)} ${sh[1].toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${fx_.toFixed(1)} ${y.toFixed(1)}`;
        armPaths[i].setAttribute("d", dd); armPaths[i + 2].setAttribute("d", dd);
        fistEls[i].setAttribute("cx", fx_.toFixed(1)); fistEls[i].setAttribute("cy", y.toFixed(1));
      });
    }

    /* ---------- effets ---------- */
    function floatText(txt, cls) {
      if (RM && cls !== "lvl") return;
      const d = document.createElement("div");
      d.className = "dc-float" + (cls ? " " + cls : ""); d.textContent = txt;
      fx.appendChild(d); later(() => d.remove(), 950);
    }
    function chalk(y) {
      if (RM) return;
      let s = "";
      for (const d of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 16;
        s += `<circle class="dc-puff" cx="${(CX + d * gripX).toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="${(2.5 + Math.random() * 3).toFixed(1)}" fill="#fff" fill-opacity=".8" style="--dx:${(Math.cos(a) * r).toFixed(1)}px;--dy:${(Math.sin(a) * r - 8).toFixed(1)}px"/>`;
      }
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = s; chalkG.appendChild(g);
      later(() => g.remove(), 750);
    }
    let cheerT = 0;
    function cheer() {
      if (RM) return;
      crowd.classList.remove("cheer");
      void crowd.getBoundingClientRect(); // relance l'animation
      crowd.classList.add("cheer");
      clearTimeout(cheerT); timers.delete(cheerT);
      cheerT = later(() => crowd.classList.remove("cheer"), 700);
    }

    /* ---------- jeu local (mon téléphone) ---------- */
    let reps = 0, fails = 0, kg = 0, level = 0;
    let active = false, started = false, deadline = 0, ph = "", lastState = null;
    let anchorT = 0, anchorPh = 0, spd = speedFor(0), zoneW = zoneFor(0), zoneC = 0.5;
    let stunUntil = 0, lockUntil = 0, liftT = -1e9, failT = -1e9;
    const phaseAt = t => anchorPh + spd * (t - anchorT) / 1000;
    const posAt = t => { const f = phaseAt(t) % 1; return f < 0.5 ? f * 2 : 2 - f * 2; };
    function setZone() {
      zoneEl.style.left = ((zoneC - zoneW / 2) * 100).toFixed(2) + "%";
      zoneEl.style.width = (zoneW * 100).toFixed(2) + "%";
    }
    function newZone(now) {
      const p = posAt(now), lo = zoneW / 2 + 0.03, hi = 1 - zoneW / 2 - 0.03;
      let c = 0.5;
      for (let i = 0; i < 8; i++) { c = lo + Math.random() * Math.max(0, hi - lo); if (Math.abs(c - p) > 0.28) break; }
      zoneC = c;
    }
    if (playing) { zoneC = 0.62; setZone(); }

    // envoi de mon entrée (valeurs absolues, limité à ~7/s)
    let mySeq = 0, lastSent = 0, sendT = 0;
    function send(force) {
      if (!playing) return;
      if (sendT) { if (!force) return; clearTimeout(sendT); timers.delete(sendT); sendT = 0; }
      const wait = force ? 0 : Math.max(0, 150 - (performance.now() - lastSent));
      sendT = later(() => { sendT = 0; lastSent = performance.now(); api.setInput({seq: ++mySeq, reps, kg, fails}); }, wait);
    }

    function tap() {
      if (!playing || dead) return;
      const now = performance.now();
      if (push) { push.classList.add("down"); later(() => push && push.classList.remove("down"), 90); }
      if (!active || now >= deadline || now < stunUntil || now < lockUntil) return;
      audioOn();
      const p = posAt(now);
      if (Math.abs(p - zoneC) <= zoneW / 2) {
        const w = weightAt(level);
        reps++; kg += w; lockUntil = now + 160; liftT = now;
        floatText("+1"); floatText("+" + w + " kg", "kg");
        chalk(BAR_DOWN); cheer(); sfx.rep();
        gauge.classList.add("flash"); later(() => gauge && gauge.classList.remove("flash"), 160);
        if (reps % 3 === 0) {
          const ph0 = phaseAt(now);
          level++; anchorPh = ph0; anchorT = now; spd = speedFor(level); zoneW = zoneFor(level);
          newZone(now); setZone();
          later(() => { if (!dead) { drawBar(weightAt(level), true); floatText("+10 kg !", "lvl"); sfx.level(); } }, 260);
          live.textContent = `Charge : ${weightAt(level)} kg`;
        }
      } else {
        fails++; stunUntil = now + 600; failT = now;
        floatText("RATÉ !", "bad"); sfx.fail();
        gauge.classList.remove("stun"); void gauge.offsetWidth; gauge.classList.add("stun");
        push.classList.add("stun"); push.disabled = true;
        later(() => { if (!dead) { gauge.classList.remove("stun"); push.classList.remove("stun"); push.disabled = !active; } }, 600);
      }
      renderMine();
      send();
    }
    function renderMine() {
      if (!playing) return;
      $("dc-total").textContent = fmt(kg) + " kg";
      $("dc-reps").textContent = reps + (reps > 1 ? " reps" : " rep");
      $("dc-weight").textContent = weightAt(level) + " kg";
      $("dc-fails").textContent = fails + (fails > 1 ? " ratés" : " raté");
      renderBoard();
    }

    /* ---------- classement ---------- */
    const minis = P.map(p => api.avatar(p.key, {view: "bust"}));
    board.innerHTML = P.map((p, i) => `<div class="dc-chip${i === mySeat ? " me" : ""}" data-i="${i}"><span class="rk">${i + 1}</span><span class="mini">${minis[i]}</span><span class="tx"><span class="nm">${esc(p.pseudo)}</span><span class="kg">0<small>kg</small></span></span></div>`).join("");
    const chips = [...board.querySelectorAll(".dc-chip")];
    const shownChip = P.map(() => -1);
    function scores() {
      const s = (lastState && lastState.s) || [];
      return P.map((p, i) => {
        const v = s[i] || [0, 0, 0];
        if (i === mySeat && ph !== "fin") return [Math.max(v[0], kg), Math.max(v[1], reps), Math.max(v[2], fails)];
        return [v[0] | 0, v[1] | 0, v[2] | 0];
      });
    }
    const order = sc => P.map((p, i) => i).sort((a, b) => sc[b][0] - sc[a][0] || sc[a][2] - sc[b][2] || a - b);
    const led = $("dc-led");
    let ledTxt = "";
    function renderBoard() {
      const sc = scores(), ord = order(sc);
      const lead = sc[ord[0]][0] > 0 ? `Record · ${P[ord[0]].pseudo} ${fmt(sc[ord[0]][0])} kg` : "45 secondes au banc";
      if (lead !== ledTxt) { ledTxt = lead; led.textContent = lead; }
      let conn = null;
      try { conn = new Set(api.connected()); } catch (e) { conn = null; }
      ord.forEach((i, r) => {
        const c = chips[i];
        c.style.order = r;
        c.querySelector(".rk").textContent = r + 1;
        if (shownChip[i] !== sc[i][0]) {
          if (shownChip[i] >= 0 && sc[i][0] > shownChip[i] && !RM) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
          shownChip[i] = sc[i][0];
          c.querySelector(".kg").innerHTML = fmt(sc[i][0]) + "<small>kg</small>";
        }
        c.classList.toggle("off", !!conn && !conn.has(P[i].key));
      });
    }

    /* ---------- fin ---------- */
    let finalShown = false;
    function showFinal() {
      if (finalShown) return;
      finalShown = true;
      const sc = scores(), ord = order(sc);
      const ctl = $("dc-ctl");
      ctl.innerHTML = `<div class="dc-final"><h3>Classement final</h3>${ord.map((i, r) => `<div class="dc-row${i === mySeat ? " me" : ""}${r === 0 ? " first" : ""}" style="animation-delay:${r * 90}ms"><span class="pos">${r + 1}</span><span class="mini">${minis[i]}</span><span class="nm">${esc(P[i].pseudo)}<small>${sc[i][1]} reps · ${sc[i][2]} ratés</small></span><span class="kg">${fmt(sc[i][0])} kg</span></div>`).join("")}</div>`;
      const myRank = playing ? ord.indexOf(mySeat) : -1;
      if (playing) {
        const d = document.createElement("div");
        d.className = "dc-stamp";
        d.innerHTML = kg > 0 ? `<b>PR !</b><span>${fmt(sc[mySeat][0])} kg · ${myRank + 1}<sup>${myRank ? "e" : "er"}</sup></span>` : `<b>0 KG</b><span>Échauffement…</span>`;
        stage.appendChild(d);
      } else {
        const w = ord[0];
        const d = document.createElement("div");
        d.className = "dc-stamp"; d.innerHTML = `<b>PR !</b><span>${esc(P[w].pseudo)} · ${fmt(sc[w][0])} kg</span>`;
        stage.appendChild(d);
      }
      live.textContent = `Classement final : ${ord.map((i, r) => `${r + 1}. ${P[i].pseudo} ${sc[i][0]} kg`).join(", ")}`;
    }

    /* ---------- état de l'hôte ---------- */
    api.onState(s => {
      if (!s || dead) return;
      lastState = s;
      const now = performance.now();
      if (s.ph !== ph) {
        const prev = ph; ph = s.ph;
        if (ph === "cd") big.className = "dc-big";
        if (ph === "go") {
          if (!started) {
            started = true; anchorT = now; anchorPh = 0;
            big.className = "dc-big go"; big.textContent = "ALLEZ !";
            later(() => { if (big.textContent === "ALLEZ !") big.textContent = ""; }, 800);
          }
          deadline = now + s.r * 100;
          active = playing;
          if (gauge) gauge.classList.remove("idle");
          if (push) push.disabled = false;
          live.textContent = "C'est parti ! Tape quand le curseur est dans le vert.";
        }
        if (ph === "end" || ph === "fin") {
          active = false; deadline = 0;
          if (gauge) gauge.classList.add("idle");
          if (push) { push.disabled = true; push.firstChild.textContent = "TERMINÉ !"; }
          if (prev !== "end") { big.className = "dc-big go"; big.textContent = "TEMPS !"; sfx.end(); send(true); }
          if (ph === "fin") { big.textContent = ""; showFinal(); }
        }
      }
      if (ph === "cd") big.textContent = String(Math.max(1, Math.ceil(s.r / 10)));
      if (ph === "go") {
        const d2 = now + s.r * 100;
        if (Math.abs(d2 - deadline) > 250) deadline = d2;
      }
      renderBoard();
    });

    /* ---------- boucle d'affichage ---------- */
    let barY = playing ? BAR_DOWN : BAR_UP + 2;
    drawBar(playing ? weightAt(0) : 60, false);
    placeBar(barY, 0);
    let lastSec = -1;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      // chrono
      let sec = 45;
      if (ph === "go") sec = Math.max(0, Math.ceil((deadline - now) / 1000));
      else if (ph === "end" || ph === "fin") sec = 0;
      if (sec !== lastSec) {
        lastSec = sec;
        timeEl.firstChild.textContent = String(sec);
        timeEl.classList.toggle("hot", ph === "go" && sec <= 10);
      }
      if (active && now >= deadline) { active = false; if (push) push.disabled = true; if (gauge) gauge.classList.add("idle"); send(true); }
      if (!playing) return;
      // curseur
      const p = started ? posAt(ph === "go" ? Math.min(now, deadline || now) : now) : 0;
      track.style.transform = `translateX(${(p * 100).toFixed(2)}%)`;
      // barre : montée rapide, retour en douceur ; tremblement après un raté
      let y = BAR_DOWN, dx = 0;
      const tl = now - liftT, tf = now - failT;
      if (tl < 520) {
        const u = RM ? (tl < 300 ? 1 : 0) : tl < 160 ? 1 - Math.pow(1 - tl / 160, 3) : tl < 260 ? 1 : 1 - (tl - 260) / 260;
        y = BAR_DOWN - (BAR_DOWN - BAR_UP) * clamp(u, 0, 1);
      } else if (tf < 600) {
        const u = Math.sin(Math.min(1, tf / 600) * Math.PI) * 0.28;
        y = BAR_DOWN - (BAR_DOWN - BAR_UP) * u;
        if (!RM) dx = Math.sin(tf / 22) * 5 * (1 - tf / 600);
      }
      if (Math.abs(y - barY) > 0.05 || dx) { barY = y; placeBar(y, dx); }
    }
    raf = requestAnimationFrame(frame);

    // renvoi de sécurité si l'hôte n'a pas encore vu mes derniers chiffres
    intervals.push(setInterval(() => {
      if (!playing || dead || !lastState || !lastState.s) return;
      const v = lastState.s[mySeat];
      if (v && (v[1] < reps || v[2] < fails) && performance.now() - lastSent > 450) send();
    }, 250));

    /* ---------- contrôles ---------- */
    function onDown(e) {
      if (e.button != null && e.button > 0) return;
      if (e.target.closest && e.target.closest(".dc-final")) return;
      if (e.cancelable && e.pointerType !== "mouse") e.preventDefault();
      tap();
    }
    function onKey(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (!e.repeat) tap();
    }
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);

    /* ---------- logique (hôte) ---------- */
    if (api.isHost) {
      const t0 = performance.now();
      const sc = P.map(() => [0, 0, 0]);
      const seen = {};
      let hph = "", finT = 0;
      api.onInputs(inputs => {
        if (hph === "fin") return;
        const el_ = Math.max(0, performance.now() - t0 - CD_MS);
        for (const p of P) {
          const inp = inputs[p.key];
          if (!inp || inp.seq == null || inp.seq === seen[p.key]) continue;
          seen[p.key] = inp.seq;
          const cap = Math.ceil(el_ / 1000 * 5) + 3;             // au plus ~5 reps par seconde
          const r = clamp(Math.floor(+inp.reps || 0), 0, cap);
          const s = sc[p.seat];
          if (r > s[1]) { s[1] = r; s[0] = kgFor(r); }
          s[2] = Math.max(s[2], clamp(Math.floor(+inp.fails || 0), 0, 9999));
        }
      });
      const publish = (r) => api.setState({ph: hph, r, s: sc});
      let ticks = 0;
      const tick = () => {
        if (dead) return;
        const e = performance.now() - t0;
        let nph, r = 0;
        if (e < CD_MS) { nph = "cd"; r = Math.ceil((CD_MS - e) / 100); }
        else if (e < CD_MS + DUR_MS) { nph = "go"; r = Math.ceil((CD_MS + DUR_MS - e) / 100); }
        else if (e < CD_MS + DUR_MS + GRACE_MS) nph = "end";
        else nph = "fin";
        const changed = nph !== hph;
        hph = nph;
        ticks++;
        if (changed || ticks % 2 === 0) publish(r);
        if (changed && nph === "fin" && !finT) {
          finT = later(() => {
            const ord = order(sc);
            const top = ord[0], best = sc[top];
            const winners = best[0] > 0 ? ord.filter(i => sc[i][0] === best[0] && sc[i][2] === best[2]).map(i => P[i].key) : [];
            const summary = best[0] > 0
              ? `${P[top].pseudo} soulève ${fmt(best[0])} kg au total`
              : "Personne n'a décollé la barre. Retour à l'échauffement !";
            api.finish({winners, ranking: ord.map(i => P[i].key), summary});
          }, FINAL_MS);
        }
      };
      tick();
      intervals.push(setInterval(tick, 100));
    }

    renderBoard();
    if (playing) renderMine();
    if (window.__dcTest) window.__dc = {
      info: () => ({p: posAt(performance.now()), c: zoneC, w: zoneW, active, stun: performance.now() < stunUntil, lock: performance.now() < lockUntil, reps, kg, fails, level, ph, bonus})
    };

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        intervals.forEach(clearInterval);
        timers.forEach(clearTimeout); timers.clear();
        window.removeEventListener("keydown", onKey);
        root.removeEventListener("pointerdown", onDown);
        if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
        if (window.__dc) try { delete window.__dc; } catch (e) { window.__dc = undefined; }
        el.innerHTML = "";
      }
    };
  }
});
