/* Gonflette Party : Tron duel (2 à 4 joueurs, chacun sur son téléphone).
   Motos de lumière sur la promenade de Muscle Beach, la nuit : chaque moto laisse un mur de néon,
   le dernier encore en selle gagne la manche. Premier à 3 manches.

   Réseau (hôte = autorité, pas fixe de 15 ticks/s) :
   - Grille 40 × 60. Chaque moto avance de spd(t) millièmes de case par tick (accélère pendant la manche,
     ×1,7 pendant un BOOST). Elle choisit sa direction en arrivant au centre d'une case : un virage
     s'applique à la première arrivée dont le tick est ≥ au tick visé.
   - Les joueurs envoient leurs actions tout de suite : api.setInput({e: [[seq, code, tick visé, manche], ...]})
     (les 8 dernières, code 0..3 = haut/droite/bas/gauche, 4 = boost, 9 = ping de mesure). L'hôte ignore
     les seq déjà vus. Si un virage arrive un peu en retard (≤ 3 ticks) et que réécrire les dernières cases de
     la moto ne change rien pour personne (cases libres, aucun crash depuis), l'hôte le replace là où le joueur
     l'a vu ; sinon il l'applique à la prochaine case.
   - État publié à chaque tick, petit et absolu : par joueur tête, direction, avancement, crash, boost,
     accusés de réception, et la trace codée par ses seuls virages (1 caractère par coin : la coordonnée
     sur l'axe du segment), qui suffit à reconstruire tout le mur. Mort subite à 40 s : l'arène rétrécit,
     donc une manche dure au plus ~65 s, et le nombre de coins par joueur est plafonné (état < 3,5 Ko).
   - Chaque téléphone affiche à 60 i/s : les adversaires un poil dans le passé (interpolés le long de leur
     trace connue), sa propre moto prédite « en avance » (de la latence mesurée) avec ses virages appliqués
     tout de suite, puis recalée en douceur sur l'hôte. */
GONFLETTE.registerGame({
  id: "tron",
  name: "Tron duel",
  min: 2,
  max: 4,
  create(api) {
    "use strict";
    /* ================= Constantes ================= */
    const W = 40, GH = 60, TICK = 1 / 15;
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    const SPD0 = 540, SPD_INC = 0.45, SPD_MAX = 820;     // millièmes de case par tick (8 → 12,3 cases/s)
    const BOOST_MUL = 1.7, BOOST_T = 12, BOOST_N = 2;
    const SD_T = 600, SD_EVERY = 15, SD_MAX = 19;        // mort subite à 40 s, un anneau par seconde
    const CD1 = 66, CD = 45, X_TICKS = 44;               // comptes à rebours, pause entre manches
    const TARGET = 3, MAX_ROUNDS = 9, REWIND = 3, MAXPRED = 14;
    const ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const COLORS = ["#FF3EA5", "#22E4FF", "#FFD23F", "#7CFF6B"];
    const INK = "#12061f";
    const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
    const UI = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
    const SCRIPT = 'Pacifico, "Brush Script MT", cursive';
    const CRASH_TXT = ["CRASH !", "BOUM !", "AÏE !", "CRAMPE !", "SPLATCH !"];
    const TEASES = ["Le perdant paie les shakers protéinés.", "Néons, sueur et gloire sur la promenade.",
      "Même les palmiers ont applaudi.", "Retour à la salle pour les autres : jour des jambes !",
      "Une moto de lumière, des biceps de lumière."];

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const rand = (a, b) => a + Math.random() * (b - a);
    const nowS = () => performance.now() / 1000;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

    const el = api.el;
    const P = api.players, N = P.length;
    const mySeat = api.isPlayer ? P.findIndex(p => p.key === api.me) : -1;
    const name = s => (P[s] ? P[s].pseudo : "?");
    const CAP = Math.floor(2700 / N);                     // coins max par joueur et par manche

    let RM = false, mq = null;
    const onMq = e => { RM = e.matches; };
    try { mq = matchMedia("(prefers-reduced-motion: reduce)"); RM = mq.matches; if (mq.addEventListener) mq.addEventListener("change", onMq); } catch (e) { mq = null; }

    /* ================= Simulation partagée ================= */
    const spd = mt => Math.min(SPD_MAX, SPD0 + Math.floor(mt * SPD_INC));
    const inRing = (x, y, sd) => x < sd || y < sd || x >= W - sd || y >= GH - sd;
    const START = N === 2
      ? [{x: 13, y: 47, dir: 0}, {x: 26, y: 12, dir: 2}]
      : [{x: 14, y: 54, dir: 0}, {x: 25, y: 5, dir: 2}, {x: 4, y: 18, dir: 1}, {x: 35, y: 41, dir: 3}].slice(0, N);
    function buildPath(seat, str, hx, hy) {
      const st = START[seat], pts = [st.x, st.y];
      let x = st.x, y = st.y, hz = st.dir % 2 === 1;
      for (let i = 0; i < str.length; i++) {
        const c = ALPH.indexOf(str[i]);
        if (hz) x = c; else y = c;
        pts.push(x, y); hz = !hz;
      }
      if (pts[pts.length - 2] !== hx || pts[pts.length - 1] !== hy) pts.push(hx, hy);
      return pts;
    }
    function pathLen(pts) {
      let l = 0;
      for (let i = 2; i < pts.length; i += 2) l += Math.abs(pts[i] - pts[i - 2]) + Math.abs(pts[i + 1] - pts[i - 1]);
      return l;
    }
    function fillGrid(g, pts, v) {
      g[pts[1] * W + pts[0]] = v;
      for (let i = 2; i < pts.length; i += 2) {
        let x = pts[i - 2], y = pts[i - 1];
        const tx = pts[i], ty = pts[i + 1], sx = Math.sign(tx - x), sy = Math.sign(ty - y);
        let n = 0;
        while ((x !== tx || y !== ty) && n++ < 200) { x += sx; y += sy; if (x >= 0 && y >= 0 && x < W && y < GH) g[y * W + x] = v; }
      }
    }
    // point à la distance d (en cases) le long de la trace ; renvoie [x, y, direction du segment]
    function pointAt(pts, d) {
      if (pts.length < 4 || d <= 0) return [pts[0], pts[1], -1];
      for (let i = 2; i < pts.length; i += 2) {
        const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
        const l = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (d <= l && l > 0) { const f = d / l; return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, x1 > x0 ? 1 : x1 < x0 ? 3 : y1 > y0 ? 2 : 0]; }
        d -= l;
      }
      return [pts[pts.length - 2], pts[pts.length - 1], -1];
    }

    /* ================= DOM ================= */
    const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="currentColor"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
    const ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
    const SHAKE = '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M8 9h16l-2 27a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" fill="#fff" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M9.2 19h13.6l-1.2 17H10.4z" fill="currentColor" opacity=".55"/><rect x="6" y="4" width="20" height="6" rx="2" fill="currentColor"/><path d="M18 4l3-3.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
    const ARROW = d => `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${d * 90}deg)"><path d="M12 4l8 10h-5v6H9v-6H4z" fill="currentColor"/></svg>`;
    const chip = s => `<div class="tr-chip${s === mySeat ? " tr-mine" : ""}" style="--c:${COLORS[s]}">
        <div class="tr-cav">${api.avatar(P[s].key, {view: "bust"})}</div>
        <div class="tr-cnm"><b></b><span class="tr-dots">${"<i></i>".repeat(TARGET)}</span></div>
      </div>`;
    el.innerHTML = `<style>
      .tr{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;color:#F4ECFF;font-family:${UI};
        background:#0b0418 radial-gradient(120% 60% at 50% 0%,#2a0b4a 0%,#12062a 55%,#0b0418 100%);
        touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
      .tr-head{display:flex;gap:6px;padding:7px 8px 4px;align-items:stretch;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}
      .tr-chips{flex:1;min-width:0;display:grid;grid-template-columns:repeat(${N},minmax(0,1fr));gap:6px}
      .tr-chip{position:relative;min-width:0;display:flex;align-items:center;gap:6px;padding:4px 7px 4px 4px;border-radius:12px;
        background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:2px solid var(--c);
        box-shadow:0 0 10px color-mix(in srgb,var(--c) 45%,transparent),inset 0 0 8px color-mix(in srgb,var(--c) 20%,transparent);transition:opacity .3s,filter .3s}
      .tr-chip.tr-out{opacity:.45;filter:grayscale(.8)}
      .tr-mine::after{content:"TOI";position:absolute;top:-8px;right:6px;font:400 10px/1 ${DISPLAY};letter-spacing:.08em;background:var(--c);color:${INK};padding:2px 5px 1px;border-radius:5px}
      .tr-cav{flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden;background:#1d0b33;border:2px solid var(--c)}
      .tr-cav .av{width:100%;height:100%;display:block}
      .tr-cnm{min-width:0;flex:1;line-height:1.05}
      .tr-cnm b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
      .tr-dots{display:flex;gap:4px;margin-top:3px}
      .tr-dots i{flex:none;width:9px;height:9px;border-radius:50%;border:2px solid var(--c);box-sizing:border-box}
      .tr-dots i.tr-on{background:var(--c);box-shadow:0 0 7px var(--c)}
      .tr-dots i.tr-pop{animation:tr-pop .6s cubic-bezier(.3,1.8,.5,1)}
      @keyframes tr-pop{0%{transform:scale(2.4)}100%{transform:none}}
      .tr-mute{position:relative;flex:none;width:38px;align-self:center;height:38px;display:grid;place-items:center;padding:0;border-radius:11px;border:2px solid #b04dff;background:rgba(176,77,255,.15);color:#fff;cursor:pointer}
      .tr-mute::before{content:"";position:absolute;inset:-6px} /* zone tactile ≥ 44 px (kit) */
      .tr-mute svg{width:18px;height:18px}
      .tr-mute:focus-visible,.tr-btn:focus-visible,.tr-boost:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .tr-stage{position:relative;flex:1;min-height:0}
      .tr-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
      .tr-ctl{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px calc(8px + env(safe-area-inset-bottom,0px));width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}
      .tr-ctl[hidden]{display:none}
      .tr-boost{flex:none;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:92px;height:84px;padding:0;border-radius:18px;cursor:pointer;
        border:3px solid #FFD23F;color:#FFD23F;background:radial-gradient(circle at 50% 30%,rgba(255,210,63,.28),rgba(255,62,165,.12));box-shadow:0 0 14px rgba(255,210,63,.45);font:400 15px/1 ${DISPLAY};letter-spacing:.06em}
      .tr-boost svg{width:26px;height:32px}
      .tr-boost:active{transform:translateY(2px)}
      .tr-boost[disabled]{opacity:.38;filter:grayscale(.7);cursor:default;box-shadow:none}
      .tr-boost.tr-on{animation:tr-glow .25s ease-in-out infinite alternate}
      @keyframes tr-glow{to{box-shadow:0 0 26px #FFD23F,0 0 4px #fff inset}}
      .tr-pips{display:flex;gap:4px}
      .tr-pips i{width:8px;height:8px;border-radius:50%;background:#FFD23F}
      .tr-pips i.tr-used{background:transparent;border:1.5px solid #FFD23F;box-sizing:border-box}
      .tr-tip{flex:1;min-width:0;text-align:center;font-size:15px;font-weight:700;line-height:1.2;color:#d9c8ff}
      .tr-tip b{color:#22E4FF}
      .tr-pad{flex:none;display:grid;grid-template-columns:repeat(3,42px);grid-template-rows:repeat(2,40px);gap:4px}
      .tr-btn{display:grid;place-items:center;padding:0;border-radius:10px;border:2px solid #22E4FF;background:rgba(34,228,255,.1);color:#22E4FF;cursor:pointer}
      .tr-btn svg{width:22px;height:22px}
      .tr-btn:active,.tr-btn.tr-hit{background:rgba(34,228,255,.4);color:#fff}
      .tr-b0{grid-column:2;grid-row:1}.tr-b3{grid-column:1;grid-row:2}.tr-b2{grid-column:2;grid-row:2}.tr-b1{grid-column:3;grid-row:2}
      .tr-keys{display:none;flex:none;font-size:14px;color:#bba6e6;text-align:right;line-height:1.25}
      .tr-keys kbd{font:700 12px/1 ${UI};border:1.5px solid #8e6cd8;border-radius:5px;padding:1px 4px;color:#fff}
      .tr-tk{display:none}
      @media (hover:hover) and (pointer:fine){.tr-pad{display:none}.tr-keys{display:block}.tr-tt{display:none}.tr-tk{display:inline}}
      .tr-end{position:absolute;inset:0;display:grid;place-items:center;padding:16px;background:rgba(8,2,20,.55);pointer-events:none}
      .tr-end[hidden]{display:none}
      .tr-panel{width:min(100%,340px);box-sizing:border-box;background:linear-gradient(180deg,#2a0b4a,#140628);border:3px solid var(--wc,#FF3EA5);border-radius:22px;
        box-shadow:0 0 30px color-mix(in srgb,var(--wc,#FF3EA5) 60%,transparent);padding:10px 16px 16px;text-align:center;animation:tr-in .5s cubic-bezier(.3,1.6,.5,1)}
      @keyframes tr-in{from{transform:scale(.8) rotate(-3deg);opacity:0}}
      .tr-pav{width:130px;height:130px;margin:0 auto -6px}
      .tr-pav .av{width:100%;height:100%}
      .tr-panel h2{margin:0;font:400 30px/1.1 ${DISPLAY};text-transform:uppercase;color:#fff;text-shadow:0 0 12px var(--wc)}
      .tr-panel h2 span{color:var(--wc)}
      .tr-fin{font:400 38px/1.1 ${DISPLAY};margin:2px 0;color:#fff}
      .tr-rk{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px;text-align:left}
      .tr-rk li{display:flex;align-items:center;gap:8px;font-weight:800;font-size:17px;border-left:4px solid var(--c);padding:1px 8px;background:rgba(255,255,255,.05);border-radius:6px}
      .tr-rk li b{margin-left:auto;font:400 18px/1 ${DISPLAY};color:var(--c)}
      .tr-tease{margin:6px 0 0;font-family:${SCRIPT};font-size:16px;line-height:1.4;color:#FFD23F}
      .tr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      @media (max-width:370px){.tr-cnm b{font-size:14px}.tr-cav{width:28px;height:28px}.tr-boost{width:80px;height:76px}.tr-pad{grid-template-columns:repeat(3,38px);grid-template-rows:repeat(2,36px)}.tr-tip{font-size:14px}}
      @media (max-width:440px){.tr-many .tr-cav{display:none}.tr-many .tr-chip{padding:4px 6px;justify-content:center}.tr-many .tr-cnm b{font-size:14px}.tr-many .tr-chips{gap:5px}.tr-many .tr-mute{width:32px;height:32px}.tr-many .tr-dots i{width:8px;height:8px}}
      @media (max-height:640px){.tr-boost{height:64px}.tr-pad{grid-template-rows:repeat(2,32px)}}
      @media (prefers-reduced-motion:reduce){.tr *{animation:none!important;transition:none!important}}
    </style>
    <div class="tr${N > 2 ? " tr-many" : ""}">
      <div class="tr-head">
        <div class="tr-chips">${P.map((p, s) => chip(s)).join("")}</div>
        <button class="tr-mute" type="button" aria-label="Couper le son" aria-pressed="false">${ICON_SOUND}</button>
      </div>
      <div class="tr-stage">
        <canvas class="tr-cv" role="img" aria-label="Arène de motos de lumière vue de dessus"></canvas>
        <div class="tr-end" hidden><div class="tr-panel"><div class="tr-pav"></div><h2></h2><div class="tr-fin"></div><ol class="tr-rk"></ol><p class="tr-tease"></p></div></div>
      </div>
      <div class="tr-ctl"${mySeat < 0 ? " hidden" : ""}>
        <button class="tr-boost" type="button" aria-label="Boost protéiné">${SHAKE}<span>BOOST</span><span class="tr-pips">${"<i></i>".repeat(BOOST_N)}</span></button>
        <div class="tr-tip"><span class="tr-tt">Glisse <b>n'importe où</b> pour tourner</span><span class="tr-tk">Ne touche aucun mur de <b>néon</b> !</span></div>
        <div class="tr-keys"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> ou <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd><br><kbd>Espace</kbd> : boost</div>
        <div class="tr-pad" role="group" aria-label="Flèches de direction">${[0, 3, 2, 1].map(d => `<button class="tr-btn tr-b${d}" type="button" data-d="${d}" aria-label="${["Haut", "Droite", "Bas", "Gauche"][d]}">${ARROW(d)}</button>`).join("")}</div>
      </div>
      <p class="tr-sr" aria-live="polite"></p>
    </div>`;
    const root = el.querySelector(".tr"), stage = el.querySelector(".tr-stage"), canvas = el.querySelector(".tr-cv");
    const ctx = canvas.getContext("2d");
    const endEl = el.querySelector(".tr-end"), liveEl = el.querySelector(".tr-sr"), muteBtn = el.querySelector(".tr-mute");
    const boostBtn = el.querySelector(".tr-boost"), pipsEl = el.querySelectorAll(".tr-pips i");
    const chipEls = [...el.querySelectorAll(".tr-chip")];
    chipEls.forEach((c, s) => { c.querySelector("b").textContent = name(s); });
    const announce = t => { liveEl.textContent = t; };

    // Avatars des têtes : bulle ronde pré-rendue (SVG → image → canvas)
    const bubbles = P.map((p, s) => {
      const c = document.createElement("canvas"); c.width = c.height = 96;
      const g = c.getContext("2d");
      const paint = img => {
        g.clearRect(0, 0, 96, 96);
        g.save(); g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fillStyle = "#1d0b33"; g.fill(); g.clip();
        if (img) g.drawImage(img, 8, 8, 80, 80);
        else { g.fillStyle = COLORS[s]; g.font = "44px " + DISPLAY; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((p.pseudo || "?").slice(0, 1).toUpperCase(), 48, 52); }
        g.restore();
        g.beginPath(); g.arc(48, 48, 41, 0, 7); g.lineWidth = 8; g.strokeStyle = COLORS[s]; g.stroke();
        g.beginPath(); g.arc(48, 48, 44, 0, 7); g.lineWidth = 2; g.strokeStyle = "#fff"; g.globalAlpha = .7; g.stroke(); g.globalAlpha = 1;
      };
      paint(null);
      try {
        const svg = api.avatar(p.key, {view: "bust"});
        if (svg) { const img = new Image(); img.onload = () => paint(img); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
      } catch (e) { /* bulle avec initiale */ }
      return c;
    });

    /* ================= Son ================= */
    let actx = null, master = null, muted = false, noiseBuf = null;
    function ensureAudio() {
      try {
        if (!actx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          actx = new AC(); master = actx.createGain(); master.gain.value = 0.3; master.connect(actx.destination);
          noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
          const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        }
        if (actx.state === "suspended") actx.resume();
      } catch (e) { actx = null; }
    }
    const audioOk = () => actx && !muted && actx.state === "running";
    function tone(f, d, type, v, f2, delay) {
      if (!audioOk()) return;
      try {
        const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* ignore */ }
    }
    function noise(d, v, freq) {
      if (!audioOk() || !noiseBuf) return;
      try {
        const t = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
        s.buffer = noiseBuf; f.type = "lowpass"; f.frequency.setValueAtTime(freq || 2400, t); f.frequency.exponentialRampToValueAtTime(120, t + d);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d);
      } catch (e) { /* ignore */ }
    }
    const sfx = {
      count() { tone(440, 0.12, "square", 0.12); },
      go() { tone(880, 0.3, "sawtooth", 0.12, 1760); },
      turn() { tone(660, 0.04, "square", 0.05, 520); },
      crash(mine) { noise(mine ? 0.55 : 0.4, mine ? 0.7 : 0.45); tone(160, 0.45, "sawtooth", mine ? 0.18 : 0.1, 40); },
      boost() { tone(220, 0.5, "sawtooth", 0.1, 880); noise(0.35, 0.15, 6000); },
      round(win) { (win ? [523, 659, 784, 1046] : [392, 330, 262]).forEach((f, i) => tone(f, 0.14, "square", 0.1, null, i * 0.1)); },
      win() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.13, "square", 0.11, null, i * 0.13)); },
      warn() { tone(300, 0.25, "sawtooth", 0.1, 200); tone(300, 0.25, "sawtooth", 0.1, 200, 0.3); }
    };
    muteBtn.addEventListener("click", () => {
      ensureAudio(); muted = !muted;
      muteBtn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.setAttribute("aria-label", muted ? "Activer le son" : "Couper le son");
      if (!muted) tone(660, 0.1, "sine", 0.15, 990);
    });

    /* ================= HÔTE : simulation ================= */
    let H = null, hostTimer = null, finishTimer = null, lastPub = 0;
    const stats = {pubs: 0, maxSize: 0, lastSize: 0, sizeAtMax: null, rewinds: 0, late: 0, queued: 0, maxCorners: 0, ticks: 0, maxGap: 0, fixOwn: [0, 0, 0], fixOther: [0, 0, 0], snaps: 0, maxFix: 0};
    if (api.isHost) {
      H = {k: 0, ph: "c", r: 0, t0: 0, mt: 0, sd: 0, sc: P.map(() => 0), pts: P.map(() => 0), grid: new Uint8Array(W * GH),
        xk: 0, xEnd: 0, rw: -2, w: -2, ff: 0, tz: 0, pa: 0, hiddenAt: 0, resumeAt: 0, lastCrashK: -1, finished: false,
        pl: P.map(() => ({x: 0, y: 0, dir: 0, acc: 0, dk: 0, ck: 0, bt: 0, bc: BOOST_N, q: [], corners: [], hist: [],
          lastSeq: 0, rs: 0, lt: 0, gone: false, seen: false, missSince: 0}))};
      setupRound();
      api.onInputs(map => {
        P.forEach((p, s) => {
          if (s === mySeat) return; // ma propre entrée est traitée directement
          const i = map[p.key];
          if (i && Array.isArray(i.e)) handleEvents(s, i.e);
        });
        if (P.some(p => !(p.key in map))) checkConn();
      });
    }
    function setupRound() {
      H.r++; H.ph = "c"; H.t0 = H.k + (H.r === 1 ? CD1 : CD); H.mt = 0; H.sd = 0; H.grid.fill(0);
      H.rw = -2; H.lastCrashK = -1;
      H.pl.forEach((p, s) => {
        const st = START[s];
        Object.assign(p, {x: st.x, y: st.y, dir: st.dir, acc: 0, dk: 0, ck: 0, bt: 0, bc: BOOST_N, q: [], corners: [], hist: []});
        if (p.gone) { p.dk = H.k; p.ck = 4; } else H.grid[st.y * W + st.x] = s + 1;
      });
    }
    const horiz = d => d % 2 === 1;
    function consumeTurn(p) {
      while (p.q.length && p.q[0].k <= H.k) {
        const e = p.q.shift();
        if (e.dir === p.dir || e.dir === (p.dir + 2) % 4 || p.corners.length >= CAP) continue;
        p.corners.push(horiz(p.dir) ? p.x : p.y); p.dir = e.dir;
        if (p.corners.length > stats.maxCorners) stats.maxCorners = p.corners.length;
        return true;
      }
      return false;
    }
    function handleEvents(s, list) {
      const p = H.pl[s];
      const evs = list.filter(e => Array.isArray(e) && e.length >= 4 && e[0] > p.lastSeq).sort((a, b) => a[0] - b[0]);
      for (const e of evs) {
        const seq = e[0] | 0, code = e[1] | 0, k = +e[2] || 0, r = e[3] | 0;
        p.lastSeq = seq; p.rs = seq; p.lt = clamp(H.k + 1 - k, -99, 99);
        if (code === 9 || r !== H.r || p.dk || (H.ph !== "c" && H.ph !== "p")) continue;
        if (code === 4) {
          if (H.ph === "p" && p.bc > 0 && p.bt === 0) { p.bt = BOOST_T; p.bc--; }
          continue;
        }
        if (code < 0 || code > 3 || p.q.length >= 3) continue;
        if (H.ph === "p" && k <= H.k && !p.q.length) {
          stats.late++;
          if (tryRewind(p, s, code, k)) continue;
        }
        p.q.push({dir: code, k, seq});
        stats.queued++;
      }
    }
    // Virage arrivé en retard : on réécrit les dernières cases de la moto si c'est sans conséquence pour quiconque.
    function tryRewind(p, s, dir, k) {
      const hs = p.hist;
      const i = hs.findIndex(h => h.tick >= k);
      if (i < 0) return false;                       // pas encore passé de case depuis le tick visé
      const h = hs[i];
      if (H.k - h.tick > REWIND || H.lastCrashK >= h.tick) return false;
      for (let j = i; j < hs.length; j++) if (hs[j].turned) return false;
      if (dir === h.dir || dir === (h.dir + 2) % 4) return true; // virage impossible : ignoré
      if (p.corners.length >= CAP) return true;
      const m = hs.length - 1 - i;
      for (let j = i + 1; j < hs.length; j++) H.grid[hs[j].y * W + hs[j].x] = 0;
      let x = h.x, y = h.y, ok = true;
      const cells = [];
      for (let j = 0; j < m; j++) {
        x += DX[dir]; y += DY[dir];
        if (x < 0 || y < 0 || x >= W || y >= GH || inRing(x, y, H.sd) || H.grid[y * W + x]) { ok = false; break; }
        cells.push([x, y]); H.grid[y * W + x] = s + 1;
      }
      if (!ok) {
        for (const c of cells) H.grid[c[1] * W + c[0]] = 0;
        for (let j = i + 1; j < hs.length; j++) H.grid[hs[j].y * W + hs[j].x] = s + 1;
        return false;
      }
      p.corners.push(horiz(h.dir) ? h.x : h.y);
      h.turned = true; h.dir = dir;
      for (let j = 0; j < m; j++) { const e = hs[i + 1 + j]; e.x = cells[j][0]; e.y = cells[j][1]; e.dir = dir; }
      p.x = x; p.y = y; p.dir = dir;
      stats.rewinds++;
      return true;
    }
    function crash(p, code) {
      if (p.dk) return;
      p.dk = H.k; p.ck = code; p.acc = 0; p.bt = 0; p.q = [];
      H.lastCrashK = H.k;
    }
    function startPlay() {
      H.ph = "p"; H.mt = 0;
      H.pl.forEach(p => { if (!p.dk) { const t = consumeTurn(p); p.hist = [{tick: H.k, x: p.x, y: p.y, dir: p.dir, turned: t}]; } });
      checkRoundEnd();
    }
    function stepPlay() {
      H.mt++;
      if (H.mt >= SD_T && (H.mt - SD_T) % SD_EVERY === 0 && H.sd < SD_MAX) {
        H.sd++;
        H.pl.forEach(p => { if (!p.dk && inRing(p.x, p.y, H.sd)) crash(p, 3); });
      }
      const steps = H.pl.map(p => {
        if (p.dk) return 0;
        let v = spd(H.mt);
        if (p.bt > 0) { v = (v * BOOST_MUL) | 0; p.bt--; }
        p.acc += v;
        const n = (p.acc / 1000) | 0; p.acc %= 1000;
        return n;
      });
      const maxS = Math.max(0, ...steps);
      for (let sub = 0; sub < maxS; sub++) {
        const mv = [];
        H.pl.forEach((p, s) => { if (!p.dk && steps[s] > sub) mv.push({p, s, x: p.x + DX[p.dir], y: p.y + DY[p.dir], bad: 0}); });
        for (const a of mv) {
          if (a.x < 0 || a.y < 0 || a.x >= W || a.y >= GH || inRing(a.x, a.y, H.sd)) { a.bad = 3; continue; }
          const occ = H.grid[a.y * W + a.x];
          if (occ) {
            const o = mv.find(b => b.s === occ - 1 && b.p.x === a.x && b.p.y === a.y && b.x === a.p.x && b.y === a.p.y);
            a.bad = o ? 1 : 3;
          }
          for (const b of mv) if (b !== a && b.x === a.x && b.y === a.y) a.bad = 1;
        }
        for (const a of mv) if (a.bad) crash(a.p, a.bad === 1 ? 1 : 0);
        for (const a of mv) {
          if (a.bad) continue;
          const p = a.p;
          p.x = a.x; p.y = a.y; H.grid[a.y * W + a.x] = a.s + 1;
          const t = consumeTurn(p);
          p.hist.push({tick: H.k, x: p.x, y: p.y, dir: p.dir, turned: t});
          if (p.hist.length > 10) p.hist.shift();
        }
      }
      checkRoundEnd();
    }
    function checkRoundEnd() {
      const alive = H.pl.filter(p => !p.dk);
      if (alive.length > 1) return;
      const rw = alive.length === 1 ? H.pl.indexOf(alive[0]) : -1;
      H.rw = rw;
      if (rw >= 0) H.sc[rw]++;
      H.pl.forEach((p, s) => { H.pts[s] += H.pl.filter((q, t) => t !== s && q.dk && (!p.dk || q.dk < p.dk)).length; });
      H.ph = "x"; H.xk = H.k; H.xEnd = H.k + X_TICKS;
    }
    function rankSeats() {
      return P.map((p, s) => s).sort((a, b) => (H.sc[b] - H.sc[a]) || (H.pts[b] - H.pts[a]) || (a - b));
    }
    function endMatch(ffSeat) {
      if (H.ph === "o") return;
      const rk = rankSeats();
      let w = rk[0];
      if (ffSeat != null) w = ffSeat;
      else if (rk.length > 1 && H.sc[rk[0]] === H.sc[rk[1]]) w = -1;
      H.ph = "o"; H.w = w; H.ff = ffSeat != null ? 1 : 0; H.tz = (Math.random() * TEASES.length) | 0; H.xk = H.k;
      if (ffSeat != null) { const i = rk.indexOf(ffSeat); if (i > 0) { rk.splice(i, 1); rk.unshift(ffSeat); } }
      publish();
      const keys = rk.map(s => P[s].key);
      const scoreTxt = N === 2 ? `${H.sc[rk[0]]} à ${H.sc[rk[1]]}` : `${H.sc[rk[0]]} manche${H.sc[rk[0]] > 1 ? "s" : ""}`;
      const summary = w < 0 ? `Égalité parfaite au Tron duel (${scoreTxt})`
        : H.ff ? `${name(w)} gagne le Tron duel par forfait`
        : `${name(w)} gagne le Tron duel ${N === 2 ? scoreTxt : "avec " + scoreTxt}`;
      finishTimer = setTimeout(() => {
        finishTimer = null; H.finished = true;
        if (hostTimer) { clearInterval(hostTimer); hostTimer = null; }
        api.finish({winners: w >= 0 ? [P[w].key] : [], ranking: keys, summary});
      }, H.ff ? 900 : 2700);
    }
    function hostTick() {
      H.k++; stats.ticks++;
      const paused = H.pa || H.k < H.resumeAt;
      if (H.ph === "c") { if (paused) H.t0++; else if (H.k >= H.t0) startPlay(); }
      else if (H.ph === "p") { if (!paused) stepPlay(); }
      else if (H.ph === "x") {
        if (paused) H.xEnd++;
        else if (H.k >= H.xEnd) {
          const best = Math.max(...H.sc), here = H.pl.filter(p => !p.gone).length;
          if (best >= TARGET || H.r >= MAX_ROUNDS || here < 2) endMatch(here === 1 && best < TARGET ? H.pl.findIndex(p => !p.gone) : null);
          else setupRound();
        }
      }
    }
    function snapshot() {
      const s = {k: H.k, ph: H.ph, r: H.r, t0: H.t0, m: H.mt, sd: H.sd, sc: H.sc.slice(),
        p: H.pl.map(p => [p.x, p.y, p.dir, p.acc, p.dk, p.ck, p.bt, p.bc, p.q.length ? p.q[0].seq - 1 : p.lastSeq, p.rs, p.lt]),
        c: H.pl.map(p => { let t = ""; for (const v of p.corners) t += ALPH[v]; return t; })};
      if (H.pa || H.k < H.resumeAt) s.pa = 1;
      if (H.ph === "x" || H.ph === "o") { s.rw = H.rw; s.xk = H.xk; }
      if (H.ph === "o") { s.w = H.w; s.ff = H.ff; s.tz = H.tz; s.pt = H.pts.slice(); }
      return s;
    }
    function publish() {
      const s = snapshot();
      const size = JSON.stringify(s).length;
      stats.pubs++; stats.lastSize = size;
      if (size > stats.maxSize) { stats.maxSize = size; stats.sizeAtMax = {k: s.k, corners: H.pl.map(p => p.corners.length)}; }
      api.setState(s);
      ingest(s);
      lastPub = performance.now();
    }
    let lastHT = 0, acc = 0, lastConn = 0;
    function hostLoop() {
      if (!H || H.finished) return;
      const now = performance.now();
      let d = lastHT ? (now - lastHT) / 1000 : 0; lastHT = now;
      if (d > 1.2) d = 1.2;
      // l'hôte quitte l'écran (téléphone verrouillé, autre appli) : pause, ses minuteurs sont bridés
      if (document.hidden) { if (!H.hiddenAt) H.hiddenAt = now; H.pa = now - H.hiddenAt < 15000 ? 1 : 0; }
      else if (H.hiddenAt) { H.hiddenAt = 0; if (H.pa) { H.pa = 0; H.resumeAt = H.k + 25; } }
      acc += d;
      let n = 0;
      while (acc >= TICK && H.ph !== "o") { acc -= TICK; hostTick(); n++; }
      if (H.ph === "o") acc = 0;
      if (n) publish();
      else if (now - lastPub > 400) publish();
      if (now - lastConn > 300) { lastConn = now; checkConn(); }
    }
    // Déconnexions : un joueur absent de la salle plus de 2,5 s se crashe (et ne revient plus) ; jamais de blocage.
    function checkConn() {
      if (!H || H.ph === "o") return;
      let con = null;
      try { con = api.connected(); } catch (e) { con = null; }
      if (!con) return;
      const now = performance.now();
      H.pl.forEach((p, s) => {
        if (p.gone) return;
        if (s === mySeat || con.includes(P[s].key)) { p.seen = true; p.missSince = 0; return; }
        if (!p.missSince) p.missSince = now;
        if (now - p.missSince > (p.seen ? 2500 : 10000)) {
          p.gone = true;
          if (H.ph === "c") { p.dk = H.k; p.ck = 4; H.grid.fill(0); H.pl.forEach((q, t) => { if (!q.gone) H.grid[q.y * W + q.x] = t + 1; }); }
          else if (H.ph === "p") { crash(p, 2); checkRoundEnd(); }
          api.toast(`${name(s)} a quitté la piste`);
        }
      });
      const here = H.pl.filter(p => !p.gone);
      if (here.length <= 1 && H.ph !== "x") endMatch(here.length === 1 ? H.pl.indexOf(here[0]) : null);
    }

    /* ================= CLIENTS : réception, horloge, interpolation ================= */
    const buf = [];               // [{k, s, paths, od, grid}]
    const offWin = [];            // [temps local, échantillon de décalage en ticks]
    const latWin = [];
    let offT = null, offRaw = null, Dt = api.isHost ? 1 : 2.2, DtGoal = Dt, lead = api.isHost ? 0 : 3, leadUsed = lead, lastRs = 0;
    function ingest(s) {
      if (!s || typeof s.k !== "number" || !Array.isArray(s.p)) return;
      const last = buf[buf.length - 1];
      if (last && s.k <= last.k) { if (s.k < last.k - 300) { buf.length = 0; offWin.length = 0; offT = null; } else return; }
      const t = nowS();
      const paths = [], od = [], grid = new Uint8Array(W * GH);
      for (let i = 0; i < N; i++) {
        const pe = s.p[i];
        const pts = buildPath(i, (s.c && s.c[i]) || "", pe[0], pe[1]);
        paths.push(pts);
        od.push(pathLen(pts) * 1000 + (pe[4] ? 0 : pe[3]));
        if (pe[5] !== 4) fillGrid(grid, pts, i + 1);
      }
      buf.push({k: s.k, s, paths, od, grid});
      if (buf.length > 45) buf.splice(0, buf.length - 45);
      // horloge : décalage = minimum glissant sur 4 s (le paquet le plus rapide)
      const sample = t / TICK - s.k;
      offWin.push([t, sample]);
      while (offWin.length && offWin[0][0] < t - 4) offWin.shift();
      offRaw = Math.min(...offWin.map(o => o[1]));
      if (offT === null || offRaw < offT - 4 || offRaw > offT + 15) offT = offRaw;
      if (!api.isHost) {
        latWin.push(sample - offRaw); if (latWin.length > 40) latWin.shift();
        const sorted = latWin.slice().sort((a, b) => a - b);
        const p85 = sorted[Math.floor(sorted.length * 0.85)] || 0;
        DtGoal = clamp(p85 + 0.8, 1.2, 6);
      }
      // retour de l'hôte sur ma dernière action : avance (en ticks) de ma prédiction
      if (mySeat >= 0 && !api.isHost) {
        const pe = s.p[mySeat];
        if (pe[9] && pe[9] !== lastRs && myEvents.some(e => e.seq === pe[9])) {
          lastRs = pe[9];
          const err = pe[10] + 1;           // on vise une marge d'un tick
          lead = clamp(lead + (err > 0 ? err * 0.7 : err * 0.15), 0, 12);
        }
      }
    }
    if (!api.isHost) api.onState(ingest);

    /* ================= Mes actions ================= */
    const myEvents = [];
    let seq = 0, lastSendAt = 0, lastPingRound = 0, pred = null, rot = false, matchOver = false;
    function sendEvent(code, k, r) {
      const e = {seq: ++seq, code, k, r};
      myEvents.push(e);
      if (myEvents.length > 12) myEvents.shift();
      lastSendAt = performance.now();
      if (api.isHost) handleEvents(mySeat, [[e.seq, code, k, r]]);
      else api.setInput({e: myEvents.slice(-8).map(x => [x.seq, x.code, x.k, x.r])});
      return e;
    }
    function curT() { return offT === null ? null : nowS() / TICK - offT; }
    function turnSim(dir) {
      if (mySeat < 0 || matchOver || !buf.length || offT === null) return false;
      const S = buf[buf.length - 1].s, T = curT();
      if (S.ph !== "c" && S.ph !== "p") return false;
      const pr = predict(buf[buf.length - 1], T + leadUsed);
      if (!pr || pr.dead) return false;
      if (pr.queued.length >= 2) return false;
      const last = pr.queued.length ? pr.queued[pr.queued.length - 1].dir : pr.dir;
      if (dir === last || dir === (last + 2) % 4) return false;
      sendEvent(dir, Math.floor(T + leadUsed) + 1, S.r);
      sfx.turn();
      return true;
    }
    const turnScreen = d => turnSim(rot ? (d + 2) % 4 : d);
    function boost() {
      if (mySeat < 0 || matchOver || !buf.length || offT === null) return;
      const S = buf[buf.length - 1].s, pe = S.p[mySeat];
      if (S.ph !== "p" || pe[4] || pe[7] <= 0 || pe[6] > 0) return;
      if (myEvents.some(e => e.code === 4 && e.r === S.r && e.seq > pe[8])) return;
      sendEvent(4, Math.floor(curT() + leadUsed) + 1, S.r);
      sfx.boost();
    }
    // Prédiction de ma moto au temps T (ticks hôte) à partir du dernier état reçu.
    function predict(E, T) {
      const S = E.s, pe = S.p[mySeat];
      const res = {pts: E.paths[mySeat].slice(), x: pe[0], y: pe[1], dir: pe[2], acc: pe[3], dead: !!pe[4], queued: [], stopped: false, boosting: pe[6] > 0};
      const pend = myEvents.filter(e => e.seq > pe[8] && e.r === S.r && e.code < 4).map(e => ({dir: e.code, k: e.k}));
      res.queued = pend;
      if (res.dead || (S.ph !== "c" && S.ph !== "p") || S.pa || T == null) return res;
      let bt = pe[6];
      if (!bt && myEvents.some(e => e.code === 4 && e.seq > pe[8] && e.r === S.r) && pe[7] > 0) bt = BOOST_T;
      let ph = S.ph, mt = S.m, acc = pe[3], x = pe[0], y = pe[1], dir = pe[2], ncorner = ((S.c && S.c[mySeat]) || "").length;
      const own = new Set();
      const consume = j => {
        while (pend.length && pend[0].k <= j) {
          const q = pend.shift();
          if (q.dir === dir || q.dir === (dir + 2) % 4 || ncorner >= CAP) continue;
          dir = q.dir; ncorner++;
          return;
        }
      };
      const step = j => {
        const nx = x + DX[dir], ny = y + DY[dir];
        if (nx < 0 || ny < 0 || nx >= W || ny >= GH || inRing(nx, ny, S.sd) || E.grid[ny * W + nx] || own.has(ny * W + nx)) return false;
        x = nx; y = ny; own.add(ny * W + nx);
        const d0 = dir; consume(j);
        if (dir !== d0) res.pts.push(x, y);
        return true;
      };
      const kEnd = Math.min(Math.floor(T), S.k + MAXPRED);
      let stopped = false;
      for (let j = S.k + 1; j <= kEnd && !stopped; j++) {
        if (ph === "c") { if (j >= S.t0) { ph = "p"; mt = 0; const d0 = dir; consume(j); if (dir !== d0) res.pts.push(x, y); } continue; }
        mt++;
        let v = spd(mt);
        if (bt > 0) { v = (v * BOOST_MUL) | 0; bt--; }
        acc += v;
        while (acc >= 1000) { acc -= 1000; if (!step(j)) { stopped = true; acc = 0; break; } }
      }
      // fraction de tick
      if (!stopped && ph === "p" && kEnd === Math.floor(T)) {
        let a2 = acc + spd(mt + 1) * (bt > 0 ? BOOST_MUL : 1) * (T - kEnd);
        if (a2 >= 1000) { if (step(kEnd + 1)) a2 -= 1000; else { a2 = 0; stopped = true; } }
        acc = Math.min(a2, 999);
      }
      if (res.pts[res.pts.length - 2] !== x || res.pts[res.pts.length - 1] !== y) res.pts.push(x, y);
      Object.assign(res, {x, y, dir, acc, stopped, queued: pend, boosting: bt > 0});
      return res;
    }

    /* ================= Entrées : glisser, flèches, clavier ================= */
    let sw = null;
    function onDown(e) {
      ensureAudio();
      if (mySeat < 0 || (e.target.closest && e.target.closest("button"))) return;
      sw = {id: e.pointerId, x: e.clientX, y: e.clientY};
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = Math.max(16, Math.min(V.w || 400, V.h || 400) * 0.035);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
      const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      turnScreen(d);
      sw.x = e.clientX; sw.y = e.clientY; // on peut enchaîner les virages sans lever le doigt
    }
    function onUp(e) { if (sw && e.pointerId === sw.id) sw = null; }
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    el.querySelectorAll(".tr-btn").forEach(b => {
      b.addEventListener("pointerdown", e => {
        ensureAudio(); e.preventDefault(); e.stopPropagation();
        turnScreen(+b.dataset.d);
        b.classList.add("tr-hit"); setTimeout(() => b.classList.remove("tr-hit"), 120);
      });
      b.addEventListener("click", e => { if (e.detail === 0) turnScreen(+b.dataset.d); }); // clavier / lecteur d'écran
    });
    boostBtn.addEventListener("pointerdown", e => { ensureAudio(); e.preventDefault(); e.stopPropagation(); boost(); });
    boostBtn.addEventListener("click", e => { if (e.detail === 0) boost(); });
    const KEYS = {ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3};
    const KEYCH = {z: 0, w: 0, d: 1, s: 2, q: 3, a: 3};
    function onKey(e) {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      ensureAudio();
      if (mySeat < 0) return;
      if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") { e.preventDefault(); if (!e.repeat) boost(); return; }
      let d = KEYS[e.code];
      if (d === undefined) d = KEYCH[(e.key || "").toLowerCase()];
      if (d === undefined) return;
      e.preventDefault();
      if (!e.repeat) turnScreen(d);
    }
    window.addEventListener("keydown", onKey);

    /* ================= Mise en page ================= */
    const V = {w: 0, h: 0, dpr: 1, cs: 10, ox: 0, oy: 0};
    const bg = document.createElement("canvas"), bctx = bg.getContext("2d");
    function layout() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cs = Math.max(2, Math.min((r.width - 10) / W, (r.height - 10) / GH));
      const changed = V.w !== r.width || V.h !== r.height || V.dpr !== dpr;
      Object.assign(V, {w: r.width, h: r.height, dpr, cs, ox: (r.width - cs * W) / 2, oy: (r.height - cs * GH) / 2});
      if (changed) {
        canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        bg.width = canvas.width; bg.height = canvas.height;
        buildBg();
      }
    }
    // cellule (centre) → écran
    const sx = x => rot ? V.ox + (W - x - 0.5) * V.cs : V.ox + (x + 0.5) * V.cs;
    const sy = y => rot ? V.oy + (GH - y - 0.5) * V.cs : V.oy + (y + 0.5) * V.cs;
    function simTransform(c, ox, oy) {
      const k = V.dpr * V.cs * (rot ? -1 : 1);
      c.setTransform(k, 0, 0, k, V.dpr * ((rot ? V.ox + W * V.cs - 0.5 * V.cs : V.ox + 0.5 * V.cs) + (ox || 0)), V.dpr * ((rot ? V.oy + GH * V.cs - 0.5 * V.cs : V.oy + 0.5 * V.cs) + (oy || 0)));
    }
    function buildBg() {
      const c = bctx, d = V.dpr, cs = V.cs, aw = cs * W, ah = cs * GH;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bg.width, bg.height);
      c.setTransform(d, 0, 0, d, 0, 0);
      // étoiles autour
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      c.fillStyle = "#fff";
      for (let i = 0; i < 70; i++) { c.globalAlpha = 0.2 + rnd() * 0.5; c.fillRect(rnd() * V.w, rnd() * V.h, 1.4, 1.4); }
      c.globalAlpha = 1;
      // sol de l'arène : nuit violette
      const x0 = V.ox, y0 = V.oy;
      const g = c.createLinearGradient(0, y0, 0, y0 + ah);
      g.addColorStop(0, "#1e0838"); g.addColorStop(0.55, "#120526"); g.addColorStop(1, "#1a0630");
      c.fillStyle = g; c.fillRect(x0, y0, aw, ah);
      c.save(); c.beginPath(); c.rect(x0, y0, aw, ah); c.clip();
      // soleil synthwave
      const sr = aw * 0.34, scx = x0 + aw / 2, scy = y0 + ah * 0.36;
      const sg = c.createLinearGradient(0, scy - sr, 0, scy + sr);
      sg.addColorStop(0, "#FFD23F"); sg.addColorStop(0.5, "#FF6B6B"); sg.addColorStop(1, "#FF3EA5");
      c.globalAlpha = 0.16; c.fillStyle = sg; c.beginPath(); c.arc(scx, scy, sr, 0, 7); c.fill();
      c.globalCompositeOperation = "destination-out"; c.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { const yy = scy + sr * (0.1 + i * 0.13), hh = 1.5 + i * 1.3; c.fillRect(scx - sr, yy, sr * 2, hh); }
      c.globalCompositeOperation = "source-over";
      // palmiers en silhouette
      const palm = (px, py, s, flip) => {
        c.save(); c.translate(px, py); c.scale(flip ? -s : s, s);
        c.fillStyle = "rgba(255,62,165,.13)";
        c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(6, -60, 18, -118); c.lineTo(24, -116); c.quadraticCurveTo(12, -60, 5, 0); c.fill();
        for (const [a, l] of [[-2.6, 62], [-2.0, 70], [-1.2, 66], [-0.5, 58], [0.2, 50], [-3.1, 46]]) {
          c.beginPath(); c.moveTo(21, -117);
          const ex = 21 + Math.cos(a) * l, ey = -117 + Math.sin(a) * l + l * 0.35;
          c.quadraticCurveTo(21 + Math.cos(a) * l * 0.5, -117 + Math.sin(a) * l * 0.5 - 14, ex, ey);
          c.quadraticCurveTo(21 + Math.cos(a) * l * 0.55, -117 + Math.sin(a) * l * 0.55 - 2, 21, -113); c.fill();
        }
        c.restore();
      };
      palm(x0 + aw * 0.08, y0 + ah, aw / 260, false);
      palm(x0 + aw * 0.93, y0 + ah, aw / 300, true);
      palm(x0 + aw * 0.82, y0 + ah, aw / 420, false);
      // grille : fine à chaque case, plus vive toutes les 5 cases
      c.lineWidth = 1;
      c.strokeStyle = "rgba(34,228,255,.07)"; c.beginPath();
      for (let i = 1; i < W; i++) if (i % 5) { const x = Math.round(x0 + i * cs) + 0.5; c.moveTo(x, y0); c.lineTo(x, y0 + ah); }
      for (let j = 1; j < GH; j++) if (j % 5) { const y = Math.round(y0 + j * cs) + 0.5; c.moveTo(x0, y); c.lineTo(x0 + aw, y); }
      c.stroke();
      c.strokeStyle = "rgba(176,77,255,.28)"; c.beginPath();
      for (let i = 5; i < W; i += 5) { const x = Math.round(x0 + i * cs) + 0.5; c.moveTo(x, y0); c.lineTo(x, y0 + ah); }
      for (let j = 5; j < GH; j += 5) { const y = Math.round(y0 + j * cs) + 0.5; c.moveTo(x0, y); c.lineTo(x0 + aw, y); }
      c.stroke();
      // enseigne en filigrane
      c.save(); c.translate(scx, y0 + ah * 0.6); c.rotate(-0.08);
      c.textAlign = "center"; c.textBaseline = "middle";
      c.font = Math.round(aw * 0.13) + "px " + SCRIPT; c.fillStyle = "rgba(255,62,165,.10)"; c.fillText("Muscle Beach", 0, 0);
      c.font = Math.round(aw * 0.05) + "px " + DISPLAY; c.fillStyle = "rgba(34,228,255,.12)"; c.fillText("LIGHT CYCLE CLUB", 0, aw * 0.1);
      c.restore();
      c.restore();
      // bordure néon
      c.shadowColor = "#FF3EA5"; c.shadowBlur = 14; c.lineWidth = 3; c.strokeStyle = "#FF3EA5";
      c.strokeRect(x0 - 1.5, y0 - 1.5, aw + 3, ah + 3); c.shadowBlur = 0;
      c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,.7)"; c.strokeRect(x0 - 1.5, y0 - 1.5, aw + 3, ah + 3);
    }
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(layout); ro.observe(stage); }
    window.addEventListener("resize", layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive && V.w) buildBg(); }).catch(() => {});

    /* ================= Effets ================= */
    const FX = {parts: [], rings: [], texts: [], shake: 0, time: 0, banner: null, go: 0, sdWarn: 0, confetti: []};
    function explode(X, Y, color, big, ck) {
      const n = RM ? 14 : big ? 70 : 46;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(40, big ? 300 : 230);
        FX.parts.push({x: X, y: Y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.4, 1.0), c: Math.random() < 0.3 ? "#fff" : color, w: rand(1.5, 3.5)});
      }
      if (FX.parts.length > 500) FX.parts.splice(0, FX.parts.length - 500);
      FX.rings.push({x: X, y: Y, t: 0, c: color});
      FX.texts.push({x: X, y: Y, t: 0, txt: ck === 1 ? "FACE À FACE !" : ck === 2 ? "DÉCONNECTÉ" : CRASH_TXT[(Math.random() * CRASH_TXT.length) | 0], c: color});
      if (!RM) FX.shake = Math.max(FX.shake, big ? 12 : 6);
    }
    function confetti() {
      if (RM) return;
      for (let i = 0; i < 140; i++) FX.confetti.push({x: rand(0, V.w), y: rand(-V.h * 0.6, -10), vx: rand(-30, 30), vy: rand(60, 170), rot: rand(0, 6), vr: rand(-8, 8), w: rand(5, 10), h: rand(3, 6), c: COLORS[(Math.random() * 4) | 0], sw: rand(0, 6)});
    }

    /* ================= Boucle d'affichage ================= */
    let raf = 0, lastFrame = 0, alive = true, seenRound = 0, lastCdN = 0, endShown = false, bannerKey = "";
    const disp = P.map(() => ({tx: null, ty: null, ox: 0, oy: 0, dead: false, round: 0}));
    const scoreSeen = P.map(() => 0);
    function smoothHead(s, nx, ny, dt, speedCells, gap) {
      const d = disp[s];
      if (d.tx === null) { d.tx = nx; d.ty = ny; d.ox = d.oy = 0; return [nx, ny]; }
      const m = Math.hypot(nx - d.tx, ny - d.ty), allow = speedCells * gap * 1.6 + 0.08;
      if (m > 6) { d.ox = d.oy = 0; stats.snaps++; }
      else if (m > allow) {
        d.ox = d.tx + d.ox - nx; d.oy = d.ty + d.oy - ny;
        const b = s === mySeat ? stats.fixOwn : stats.fixOther; b[m < 1 ? 0 : m < 3 ? 1 : 2]++;
        if (m > stats.maxFix) stats.maxFix = m;
      }
      const k = Math.exp(-dt * 13);
      d.ox *= k; d.oy *= k;
      if (Math.abs(d.ox) < 0.01) d.ox = 0;
      if (Math.abs(d.oy) < 0.01) d.oy = 0;
      d.tx = nx; d.ty = ny;
      return [nx + d.ox, ny + d.oy];
    }
    function computeView(dt) {
      if (!buf.length || offT === null) return null;
      const E = buf[buf.length - 1], S = E.s;
      const T = curT(), Tr = T - Dt;
      leadUsed += clamp(lead - leadUsed, -dt * 1.5, dt * 1.5);
      Dt += clamp(DtGoal - Dt, -dt * 1.5, dt * 1.5);
      const pl = [];
      // trouver A, B autour de Tr pour les autres
      let A = buf[0], B = null;
      for (let i = buf.length - 1; i >= 0; i--) { if (buf[i].k <= Tr) { A = buf[i]; B = buf[i + 1] || null; break; } }
      if (A.s.r !== S.r) { A = E; B = null; }
      for (let s = 0; s < N; s++) {
        const pe = S.p[s];
        if (pe[5] === 4) { pl.push(null); continue; }
        if (s === mySeat) {
          const pr = predict(E, T + leadUsed);
          pred = pr;
          const still = pr.dead || pr.stopped;
          const hx = pr.x + (still ? 0 : DX[pr.dir] * pr.acc / 1000), hy = pr.y + (still ? 0 : DY[pr.dir] * pr.acc / 1000);
          const tp = pr.pts.slice();
          if (hx !== pr.x || hy !== pr.y) tp.push(hx, hy);
          pl.push({s, tp, hx, hy, dir: pr.dir, dead: pr.dead, dk: pe[4], boost: pr.boosting, own: true});
          continue;
        }
        const dkS = pe[4];
        let od;
        if (B && A !== B) { const f = clamp((Tr - A.k) / (B.k - A.k), 0, 1); od = A.od[s] + (B.od[s] - A.od[s]) * f; }
        else {
          od = A.od[s];
          if (!A.s.p[s][4] && A.s.ph === "p" && !A.s.pa) od += clamp(Tr - A.k, 0, 6) * spd(A.s.m) * (A.s.p[s][6] > 0 ? BOOST_MUL : 1);
        }
        const full = E.od[s], deadNow = dkS && Tr >= dkS;
        if (deadNow) od = full;
        const len = od / 1000, pts = E.paths[s], L = pathLen(pts);
        let hx, hy, dir;
        if (len <= L) { [hx, hy, dir] = pointAt(pts, len); if (dir < 0) dir = pe[2]; }
        else { const ex = Math.min(len - L, 0.6); dir = pe[2]; hx = pe[0] + DX[dir] * ex; hy = pe[1] + DY[dir] * ex; }
        // trace tronquée à la distance affichée, puis la tête
        let rem = Math.min(len, L), n = 2;
        for (let i = 2; i < pts.length; i += 2) { const l = Math.abs(pts[i] - pts[i - 2]) + Math.abs(pts[i + 1] - pts[i - 1]); if (rem < l) break; rem -= l; n = i + 2; }
        const tp = pts.slice(0, n);
        if (tp[n - 2] !== hx || tp[n - 1] !== hy) tp.push(hx, hy);
        pl.push({s, tp, hx, hy, dir, dead: deadNow, dk: dkS, boost: pe[6] > 0, own: false, ck: pe[5]});
      }
      return {S, T, Tr, pl, E};
    }
    function frame(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const now = ts / 1000, gap = lastFrame ? clamp(now - lastFrame, 0, 1) : 0, dt = Math.min(gap, 0.05);
      if (gap > stats.maxGap) stats.maxGap = gap;
      lastFrame = now; FX.time += dt;
      if (!V.w) layout();
      if (!V.w) return;
      if (offT !== null && offRaw !== null) offT += clamp(offRaw - offT, -dt * 2, dt * 2);
      const v = computeView(dt);
      if (v) react(v, now, dt);
      // pings de mesure de latence
      if (v && mySeat >= 0 && !api.isHost && !matchOver) {
        const S = v.S, since = performance.now() - lastSendAt;
        if ((S.ph === "c" && (lastPingRound !== S.r || since > 900)) || (S.ph === "p" && since > 2200)) { lastPingRound = S.r; sendEvent(9, Math.floor(curT() + leadUsed) + 1, S.r); }
      }
      for (const p of FX.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; }
      FX.parts = FX.parts.filter(p => p.t < p.life);
      for (const r of FX.rings) r.t += dt;
      FX.rings = FX.rings.filter(r => r.t < 0.6);
      for (const t of FX.texts) t.t += dt;
      FX.texts = FX.texts.filter(t => t.t < 1.3);
      for (const c of FX.confetti) { c.vy = Math.min(c.vy + 120 * dt, 220); c.x += (c.vx + Math.sin(FX.time * 3 + c.sw) * 30) * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
      FX.confetti = FX.confetti.filter(c => c.y < V.h + 30);
      FX.shake *= Math.exp(-dt * 8); if (FX.shake < 0.3) FX.shake = 0;
      draw(v, dt, gap);
    }
    // événements visibles : comptes à rebours, crashs, manches, fin
    function react(v, now, dt) {
      const S = v.S;
      if (S.r !== seenRound) {
        seenRound = S.r; lastCdN = 0; FX.banner = null; FX.sdWarn = 0;
        disp.forEach(d => { d.tx = null; d.dead = false; });
      }
      if (S.ph === "c") {
        const n = Math.ceil((S.t0 - v.T) * TICK);
        if (n !== lastCdN && n >= 1 && n <= 3) { lastCdN = n; sfx.count(); }
      }
      if (S.ph === "p" && lastCdN > 0 && v.T >= S.t0) { lastCdN = 0; FX.go = 1; sfx.go(); }
      if (S.ph === "p" && S.sd > 0 && !FX.sdWarn) { FX.sdWarn = 1; sfx.warn(); announce("Mort subite : l'arène rétrécit !"); }
      for (const p of v.pl) {
        if (!p) continue;
        const d = disp[p.s];
        if (p.dead && !d.dead) {
          d.dead = true;
          explode(sx(p.hx), sy(p.hy), COLORS[p.s], p.s === mySeat, S.p[p.s][5]);
          sfx.crash(p.s === mySeat);
          announce(`${name(p.s)} s'est crashé !`);
          if (p.s === mySeat && navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* ignore */ } }
        }
      }
      if ((S.ph === "x" || S.ph === "o") && v.Tr >= (S.xk || 0) - 0.5) {
        const key = S.r + ":" + S.rw;
        if (bannerKey !== key) {
          bannerKey = key;
          FX.banner = {t: 0, rw: S.rw};
          sfx.round(S.rw === mySeat);
          announce(S.rw >= 0 ? `${name(S.rw)} remporte la manche` : "Manche nulle");
        }
        for (let s = 0; s < N; s++) {
          if (S.sc[s] !== scoreSeen[s]) {
            const dots = chipEls[s].querySelectorAll(".tr-dots i");
            for (let i = 0; i < dots.length; i++) {
              const on = i < S.sc[s];
              if (on && !dots[i].classList.contains("tr-on")) { dots[i].classList.add("tr-on", "tr-pop"); }
              else if (!on) dots[i].classList.remove("tr-on", "tr-pop");
            }
            scoreSeen[s] = S.sc[s];
          }
        }
      }
      if (FX.banner) FX.banner.t += dt;
      if (FX.go) { FX.go -= dt * 1.4; if (FX.go < 0) FX.go = 0; }
      // chips : joueurs éliminés de la manche
      for (let s = 0; s < N; s++) chipEls[s].classList.toggle("tr-out", !!(v.pl[s] ? v.pl[s].dead : true) && S.ph !== "c");
      // bouton boost
      if (mySeat >= 0) {
        const pe = S.p[mySeat];
        const can = S.ph === "p" && !pe[4] && pe[7] > 0 && pe[6] === 0;
        boostBtn.disabled = !can && !(pe[6] > 0);
        boostBtn.classList.toggle("tr-on", pe[6] > 0);
        pipsEl.forEach((pp, i) => pp.classList.toggle("tr-used", i >= pe[7]));
      }
      if (S.ph === "o" && !endShown && v.Tr >= (S.xk || 0)) {
        endShown = true; matchOver = true;
        const w = S.w;
        setTimeout(() => { if (alive) endEl.hidden = false; }, RM ? 200 : 900);
        const panel = endEl.querySelector(".tr-panel");
        panel.style.setProperty("--wc", w >= 0 ? COLORS[w] : "#b04dff");
        endEl.querySelector(".tr-pav").innerHTML = w >= 0 ? api.avatar(P[w].key, {pose: "flex"}) : "";
        endEl.querySelector("h2").innerHTML = w >= 0 ? `<span>${esc(name(w))}</span> gagne !` : "Égalité !";
        const rk = P.map((p, s) => s).sort((a, b) => (S.sc[b] - S.sc[a]) || ((S.pt || [])[b] - (S.pt || [])[a]) || (a - b));
        if (N === 2) {
          endEl.querySelector(".tr-fin").textContent = `${S.sc[rk[0]]} – ${S.sc[rk[1]]}`;
          endEl.querySelector(".tr-rk").hidden = true;
        } else {
          endEl.querySelector(".tr-fin").hidden = true;
          endEl.querySelector(".tr-rk").innerHTML = rk.map((s, i) => `<li style="--c:${COLORS[s]}">${i + 1}. ${esc(name(s))}<b>${S.sc[s]}</b></li>`).join("");
        }
        endEl.querySelector(".tr-tease").textContent = S.ff ? "Victoire par forfait : la piste est à toi !" : (w === mySeat ? "Champion de la promenade ! " : "") + (TEASES[S.tz] || TEASES[0]);
        if (w >= 0) { confetti(); sfx.win(); }
        announce(w >= 0 ? `${name(w)} gagne la partie !` : "Égalité !");
      }
    }
    function textNeon(c, txt, x, y, size, color, maxW, font) {
      c.font = size + "px " + (font || DISPLAY);
      if (maxW) { const tw = c.measureText(txt).width; if (tw > maxW) { size = Math.max(9, size * maxW / tw); c.font = size + "px " + (font || DISPLAY); } }
      c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
      c.lineWidth = Math.max(3, size * 0.14); c.strokeStyle = INK; c.strokeText(txt, x, y);
      if (!RM) { c.shadowColor = color; c.shadowBlur = size * 0.35; }
      c.fillStyle = color; c.fillText(txt, x, y);
      c.shadowBlur = 0;
    }
    function strokePath(c, pts) {
      c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      if (pts.length === 2) c.lineTo(pts[0] + 0.001, pts[1]);
    }
    function draw(v, dt, gap) {
      const c = ctx, d = V.dpr;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
      const sh = FX.shake, ox = sh ? rand(-1, 1) * sh : 0, oy = sh ? rand(-1, 1) * sh : 0;
      c.setTransform(1, 0, 0, 1, d * ox, d * oy);
      c.drawImage(bg, 0, 0);
      const aw = V.cs * W, ah = V.cs * GH, CX = V.ox + aw / 2, CY = V.oy + ah / 2;
      if (!v) {
        c.setTransform(d, 0, 0, d, 0, 0);
        textNeon(c, "Connexion à l'hôte…", CX, CY, Math.min(30, aw * 0.08), "#22E4FF", aw * 0.9);
        return;
      }
      const S = v.S;
      // zone de mort subite
      if (S.sd > 0) {
        const z = S.sd * V.cs;
        c.setTransform(d, 0, 0, d, d * ox, d * oy);
        c.fillStyle = "rgba(255,40,80,.22)";
        c.beginPath(); c.rect(V.ox, V.oy, aw, ah); c.rect(V.ox + z, V.oy + z, aw - 2 * z, ah - 2 * z); c.fill("evenodd");
        c.strokeStyle = "#FF2850"; c.lineWidth = 2.5;
        if (!RM) { c.shadowColor = "#FF2850"; c.shadowBlur = 12 + Math.sin(FX.time * 8) * 6; }
        c.strokeRect(V.ox + z, V.oy + z, aw - 2 * z, ah - 2 * z); c.shadowBlur = 0;
      }
      // murs de lumière
      simTransform(c, ox, oy);
      c.lineJoin = "miter"; c.lineCap = "square";
      for (const p of v.pl) {
        if (!p) continue;
        const col = COLORS[p.s];
        c.strokeStyle = col; c.globalAlpha = p.dead ? 0.08 : 0.22; c.lineWidth = 1.05; strokePath(c, p.tp); c.stroke();
        c.globalAlpha = p.dead ? 0.4 : 1; c.lineWidth = 0.5; c.stroke();
        c.strokeStyle = "#fff"; c.lineWidth = 0.16; c.globalAlpha = p.dead ? 0.2 : 0.85; c.stroke();
        c.globalAlpha = 1;
      }
      // têtes : moto lumineuse + bulle avatar qui la suit
      c.setTransform(d, 0, 0, d, d * ox, d * oy);
      const showNames = S.ph === "c" || (S.ph === "p" && v.T - S.t0 < 40);
      for (const p of v.pl) {
        if (!p) continue;
        const [hx, hy] = smoothHead(p.s, p.hx, p.hy, dt, spd(S.m) * 15 / 1000 * (p.boost ? BOOST_MUL : 1), gap);
        const X = sx(hx), Y = sy(hy), col = COLORS[p.s], cs = V.cs;
        const sdir = rot && p.dir >= 0 ? (p.dir + 2) % 4 : p.dir;
        if (!p.dead) {
          // halo
          const gr = c.createRadialGradient(X, Y, 0, X, Y, cs * (p.boost ? 2.6 : 1.8));
          gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.25, col); gr.addColorStop(1, "rgba(0,0,0,0)");
          c.globalAlpha = 0.65; c.fillStyle = gr; c.beginPath(); c.arc(X, Y, cs * (p.boost ? 2.6 : 1.8), 0, 7); c.fill(); c.globalAlpha = 1;
          // pointe de moto
          if (sdir >= 0) {
            c.save(); c.translate(X, Y); c.rotate(sdir * Math.PI / 2);
            c.beginPath(); c.moveTo(0, -cs * 0.95); c.lineTo(cs * 0.5, cs * 0.25); c.lineTo(-cs * 0.5, cs * 0.25); c.closePath();
            c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = col; c.stroke();
            c.restore();
          }
          if (p.boost && !RM) {
            for (let i = 0; i < 2; i++) FX.parts.push({x: X + rand(-2, 2), y: Y + rand(-2, 2), vx: rand(-30, 30), vy: rand(-30, 30), t: 0, life: 0.35, c: i ? "#FFD23F" : col, w: 2});
          }
        }
        // bulle avatar : un peu derrière la tête, sur la trace
        let bx = X, by = Y;
        if (!p.dead) {
          const [ax, ay] = pointAt(p.tp, Math.max(0, pathLen(p.tp) - 1.9));
          bx = sx(ax) + (X - sx(p.hx)); by = sy(ay) + (Y - sy(p.hy));
        }
        const br = Math.max(11, cs * 1.45);
        c.globalAlpha = p.dead ? 0.55 : 1;
        if (p.dead) c.filter = "grayscale(1)";
        c.drawImage(bubbles[p.s], bx - br, by - br, br * 2, br * 2);
        c.filter = "none"; c.globalAlpha = 1;
        if (p.dead) {
          c.strokeStyle = "#FF2850"; c.lineWidth = 3; c.lineCap = "round";
          c.beginPath(); c.moveTo(bx - br * 0.5, by - br * 0.5); c.lineTo(bx + br * 0.5, by + br * 0.5); c.moveTo(bx + br * 0.5, by - br * 0.5); c.lineTo(bx - br * 0.5, by + br * 0.5); c.stroke();
        }
        if (showNames || (p.dead && S.ph !== "c")) {
          const lbl = p.s === mySeat ? "TOI" : name(p.s);
          c.font = "700 " + Math.max(12, cs * 1.35) + "px " + UI;
          const tw = Math.min(c.measureText(lbl).width, aw * 0.4), lh = Math.max(15, cs * 1.7);
          let lx = clamp(bx, V.ox + tw / 2 + 6, V.ox + aw - tw / 2 - 6), ly = by - br - lh * 0.75;
          if (ly < V.oy + lh * 0.6) ly = by + br + lh * 0.75;
          c.fillStyle = "rgba(18,6,31,.82)"; c.beginPath(); c.roundRect ? c.roundRect(lx - tw / 2 - 5, ly - lh / 2, tw + 10, lh, 6) : c.rect(lx - tw / 2 - 5, ly - lh / 2, tw + 10, lh); c.fill();
          c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
          c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(lbl, lx, ly + 1, aw * 0.4);
        }
      }
      // particules, ondes, CRASH !
      for (const r of FX.rings) {
        const k = r.t / 0.6;
        c.globalAlpha = 1 - k; c.strokeStyle = r.c; c.lineWidth = 4 * (1 - k) + 1;
        c.beginPath(); c.arc(r.x, r.y, V.cs * (1 + k * 7), 0, 7); c.stroke();
      }
      for (const p of FX.parts) {
        c.globalAlpha = 1 - p.t / p.life; c.strokeStyle = p.c; c.lineWidth = p.w; c.lineCap = "round";
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke();
      }
      c.globalAlpha = 1;
      for (const t of FX.texts) {
        const k = t.t / 1.3, pop = RM ? 1 : Math.min(1, t.t / 0.12) * (1 + 0.25 * Math.max(0, 1 - t.t / 0.25));
        c.save(); c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        const X = clamp(t.x, V.ox + aw * 0.22, V.ox + aw * 0.78), Y = clamp(t.y - V.cs * 3 - k * V.cs * 3, V.oy + 30, V.oy + ah - 20);
        c.translate(X, Y); c.rotate(-0.1); c.scale(pop, pop);
        textNeon(c, t.txt, 0, 0, Math.max(22, aw * 0.1), "#fff", aw * 0.6);
        c.restore();
      }
      c.globalAlpha = 1;
      const big = Math.min(aw, ah * 0.7);
      // compte à rebours
      if (S.ph === "c") {
        const rem = (S.t0 - v.T) * TICK, n = clamp(Math.ceil(rem), 1, 3);
        c.fillStyle = "rgba(11,4,24,.45)"; c.fillRect(V.ox, CY - big * 0.36, aw, big * 0.62);
        textNeon(c, S.r === 1 ? (N === 2 ? "DUEL DE MOTOS DE LUMIÈRE" : "MÊLÉE DE MOTOS DE LUMIÈRE") : "MANCHE " + S.r, CX, CY - big * 0.25, big * 0.075, "#22E4FF", aw * 0.92);
        if (rem <= 3.05) {
          const fr = rem - Math.floor(rem), s = RM ? 1 : 1 + Math.max(0, fr - 0.7) * 1.8;
          c.save(); c.translate(CX, CY); c.scale(s, s);
          textNeon(c, String(n), 0, 0, big * 0.3, ["#7CFF6B", "#FFD23F", "#FF3EA5"][n - 1], aw);
          c.restore();
        }
        textNeon(c, S.r === 1 ? `Premier à ${TARGET} manches` : scoreLine(S), CX, CY + big * 0.2, big * 0.055, "#FFD23F", aw * 0.9, S.r === 1 ? SCRIPT : DISPLAY);
      }
      if (FX.go > 0 && S.ph === "p") {
        c.save(); c.globalAlpha = Math.min(1, FX.go * 2); c.translate(CX, CY); const s = RM ? 1 : 1 + (1 - FX.go) * 0.6; c.scale(s, s);
        textNeon(c, "GO !", 0, 0, big * 0.26, "#7CFF6B", aw); c.restore();
      }
      if (S.ph === "p" && S.m >= SD_T - 75 && S.m < SD_T + 45) {
        c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(FX.time * 10);
        textNeon(c, S.m < SD_T ? "Les murs vont se refermer…" : "MORT SUBITE !", CX, V.oy + ah * 0.12, big * (S.m < SD_T ? 0.06 : 0.1), "#FF2850", aw * 0.9);
        c.restore();
      }
      if (S.pa) textNeon(c, "PAUSE : l'hôte a quitté l'écran", CX, CY, big * 0.06, "#FFD23F", aw * 0.92);
      if (FX.banner && (S.ph === "x" || (S.ph === "o" && endEl.hidden))) {
        const b = FX.banner, k = Math.min(1, b.t / 0.35), s = RM ? 1 : 0.4 + 0.6 * (1 - Math.pow(1 - k, 3));
        c.save(); c.translate(CX, CY); c.scale(s, s);
        c.fillStyle = "rgba(11,4,24,.62)"; c.fillRect(-aw / 2, -big * 0.2, aw, big * 0.4);
        if (b.rw >= 0) {
          const br = big * 0.09;
          c.drawImage(bubbles[b.rw], -br, -big * 0.2 - br * 0.6, br * 2, br * 2);
          textNeon(c, b.rw === mySeat ? "Tu gagnes la manche !" : name(b.rw) + " gagne la manche !", 0, big * 0.02, big * 0.075, COLORS[b.rw], aw * 0.92);
        } else textNeon(c, "Manche nulle !", 0, big * 0.02, big * 0.085, "#fff", aw * 0.92);
        textNeon(c, scoreLine(S), 0, big * 0.12, big * 0.055, "#FFD23F", aw * 0.9);
        c.restore();
      }
      for (const cf of FX.confetti) {
        c.save(); c.translate(cf.x, cf.y); c.rotate(cf.rot); c.scale(1, Math.cos(cf.rot * 1.7));
        c.fillStyle = cf.c; c.fillRect(-cf.w / 2, -cf.h / 2, cf.w, cf.h); c.restore();
      }
    }
    function scoreLine(S) {
      if (N === 2) return `${S.sc[0]} – ${S.sc[1]}`;
      return P.map((p, s) => `${name(s).slice(0, 8)} ${S.sc[s]}`).join(" · ");
    }

    /* ================= Démarrage ================= */
    rot = mySeat >= 0 && START[mySeat].y < GH / 2;
    layout();
    raf = requestAnimationFrame(frame);
    if (api.isHost) { lastHT = performance.now(); publish(); hostTimer = setInterval(hostLoop, 10); }

    // Crochet de test (inoffensif) : statistiques, état, pilote automatique simple.
    let botTimer = null;
    function botStep() {
      if (!buf.length || mySeat < 0 || matchOver) return;
      const E = buf[buf.length - 1], S = E.s;
      if (S.ph !== "p" && S.ph !== "c") return;
      const pr = predict(E, curT() + leadUsed);
      if (!pr || pr.dead || pr.queued.length) return;
      const occ = (x, y) => x < 0 || y < 0 || x >= W || y >= GH || inRing(x, y, S.sd + (S.m > SD_T - 30 ? 1 : 0)) || E.grid[y * W + x];
      const own = new Set(); { const g = new Uint8Array(W * GH); fillGrid(g, pr.pts, 1); for (let i = 0; i < g.length; i++) if (g[i]) own.add(i); }
      const blocked = (x, y) => occ(x, y) || own.has(y * W + x);
      const space = (x, y) => { // remplissage limité
        if (blocked(x, y)) return 0;
        const seen = new Set([y * W + x]), q = [[x, y]]; let n = 0;
        while (q.length && n < 260) { const [a, b] = q.shift(); n++; for (let d = 0; d < 4; d++) { const nx = a + DX[d], ny = b + DY[d], id = ny * W + nx; if (!seen.has(id) && !blocked(nx, ny)) { seen.add(id); q.push([nx, ny]); } } }
        return n;
      };
      const opts = [pr.dir, (pr.dir + 1) % 4, (pr.dir + 3) % 4].map(d => {
        const nx = pr.x + DX[d], ny = pr.y + DY[d];
        let run = 0; for (let i = 1; i < 8; i++) { if (blocked(pr.x + DX[d] * i, pr.y + DY[d] * i)) break; run++; }
        return {d, sc: space(nx, ny) + run * 3 + (d === pr.dir ? 6 : 0) + Math.random() * 25};
      });
      opts.sort((a, b) => b.sc - a.sc);
      if (opts[0].d !== pr.dir) turnSim(opts[0].d);
      else if (Math.random() < 0.01) boost();
    }
    const dbg = {
      seat: mySeat, isHost: api.isHost,
      stats: () => Object.assign({lead, leadUsed, Dt, buf: buf.length}, stats),
      view: () => { const E = buf[buf.length - 1]; return E && {k: E.k, ph: E.s.ph, r: E.s.r, sc: E.s.sc.slice(), sd: E.s.sd, m: E.s.m, alive: E.s.p.map(p => !p[4]), corners: E.s.c.map(t => t.length), size: JSON.stringify(E.s).length, pred: pred && {x: pred.x, y: pred.y, dir: pred.dir, q: pred.queued.length}}; },
      host: api.isHost ? () => ({k: H.k, ph: H.ph, r: H.r, sc: H.sc.slice(), pl: H.pl.map(p => ({x: p.x, y: p.y, dir: p.dir, dk: p.dk, ck: p.ck, q: p.q.length, c: p.corners.length, gone: p.gone}))}) : null,
      turn: d => turnSim(d), turnScreen: d => turnScreen(d), boost: () => boost(),
      // avance le chrono de manche (tester la mort subite) ; taille d'état au pire (coins au plafond)
      skip: n => { if (!H || H.ph !== "p") return false; H.mt += n; return true; },
      worstSize: () => {
        if (!H) return null;
        const saved = H.pl.map(p => p.corners), sk = H.k;
        H.pl.forEach(p => { p.corners = Array.from({length: CAP}, (_, i) => 30 + (i % 30)); });
        H.k = 99999; const o = {ph: H.ph, rw: H.rw, w: H.w}; H.ph = "o"; H.rw = -1; H.w = -1;
        const len = JSON.stringify(snapshot()).length;
        H.pl.forEach((p, i) => { p.corners = saved[i]; }); H.k = sk; Object.assign(H, o);
        return {cap: CAP, len};
      },
      bot: on => { if (botTimer) { clearInterval(botTimer); botTimer = null; } if (on) botTimer = setInterval(botStep, 35); return !!on; }
    };
    window.__tronDebug = dbg;

    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        if (hostTimer) clearInterval(hostTimer);
        if (finishTimer) clearTimeout(finishTimer);
        if (botTimer) clearInterval(botTimer);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", layout);
        if (ro) ro.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onMq);
        if (actx) { try { actx.close(); } catch (e) { /* ignore */ } }
        if (window.__tronDebug === dbg) delete window.__tronDebug;
        el.innerHTML = "";
      }
    };
  }
});
