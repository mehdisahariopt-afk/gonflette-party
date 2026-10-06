/* Gonflette Party : Duel de réflexes (2 à 8 joueurs, chacun sur son téléphone).
   Un duel « Far West » en 5 manches : attendre le signal, puis dégainer le plus vite possible.

   Équité réseau : on ne mesure JAMAIS sur l'horloge de l'hôte.
   - L'hôte publie l'ordre de manche à l'avance : {ph:"wait", r, d (délai ms), f (faux signal ms), tx, ty}.
   - Chaque téléphone lance SON minuteur local à la réception de cet ordre et affiche « TIREZ ! » après d ms
     sur SA propre horloge, puis mesure localement (performance.now / event.timeStamp) le temps entre
     l'affichage de son signal et la touche. Il envoie {r, ms}, {r, early:1} (trop tôt) ou {r, slow:1}.
   - Les écarts de latence réseau ne changent donc que le moment où la manche commence, pas le temps mesuré.
   - L'hôte attend toutes les réponses des joueurs encore connectés (ou délai max), classe et publie.
   Manche 4 : faux signal orange « TIREZ… pas encore ! » (le toucher = faux départ).
   Manche 5 : une cible-cactus apparaît à une position aléatoire, il faut la toucher précisément. */
GONFLETTE.registerGame({
  id: "reflexes",
  name: "Duel de réflexes",
  min: 2,
  max: 8,
  create(api) {
    "use strict";
    const ROUNDS = 5, SLOW_MS = 3000, NET_MARGIN = 2500, INTRO_MS = 5500, RES_MS = 5200, END_MS = 3200;
    const el = api.el, P = api.players, N = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] !== undefined ? seatOf[api.me] : -1;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const fmt = ms => (ms / 1000).toFixed(3).replace(".", ",") + " s";
    const nm = i => esc(P[i].pseudo);
    const bust = i => api.avatar(P[i].key, {view: "bust"});
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const clearAll = () => { timers.forEach(clearTimeout); timers.clear(); };
    let dead = false;
    let RM = false;
    try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* rien */ }

    const VARIANT = {
      1: {tag: "Duel classique", hint: "Touchez l'écran dès que c'est VERT"},
      2: {tag: "Duel classique", hint: "Touchez l'écran dès que c'est VERT"},
      3: {tag: "Duel classique", hint: "Touchez l'écran dès que c'est VERT"},
      4: {tag: "Faux signal !", hint: "Méfiance : seul le VERT compte"},
      5: {tag: "Tir de précision", hint: "Touchez la cible-cactus quand elle apparaît"}
    };

    /* ================= Décor & styles ================= */
    const TUMBLE = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#6b4423" stroke-width="3.2" stroke-linecap="round">
      <circle cx="50" cy="50" r="40" stroke-dasharray="18 9"/><path d="M14 46C30 20 70 18 86 48M18 66C40 40 66 44 84 70M30 84C40 56 64 30 70 14M22 28C44 40 58 64 56 90M40 12C34 40 50 70 78 82M60 50C44 52 30 62 22 76"/>
      <path d="M50 10C70 30 72 60 60 88M10 52C34 58 64 56 90 40" stroke="#8a5a2b" stroke-width="2.4"/></g></svg>`;
    const CACTUS = `<svg viewBox="0 0 120 150" aria-hidden="true">
      <path d="M50 148V30a10 10 0 0 1 20 0v118z" fill="#3f7a35" stroke="#1f3d1a" stroke-width="4"/>
      <path d="M50 80H34a10 10 0 0 1-10-10V48a7 7 0 0 1 14 0v18h12M70 92h16a10 10 0 0 0 10-10V58a7 7 0 0 0-14 0v20H70" fill="#3f7a35" stroke="#1f3d1a" stroke-width="4"/>
      <circle cx="60" cy="72" r="26" fill="#f4e6c3" stroke="#7a1f12" stroke-width="5"/><circle cx="60" cy="72" r="16" fill="none" stroke="#c0341d" stroke-width="6"/><circle cx="60" cy="72" r="5" fill="#7a1f12"/></svg>`;
    const SCENE = `<div class="rx-scene" aria-hidden="true">
      <div class="rx-sun"></div>
      <svg class="rx-mesa" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 120V70h30l8-22h46l6 22h40l10-40h70l8 40h30V60l14-6h52l10 16h40l10 16h26v34z" fill="#7a3f22" opacity=".75"/><path d="M0 120V92h60l20-10h70l10 12h90l14-14h60l20 12h56v28z" fill="#4e2614"/></svg>
      <svg class="rx-saloon" viewBox="0 0 120 110"><path d="M6 110V30h18V10h72v20h18v80z" fill="#3a1d0e"/><rect x="18" y="16" width="84" height="16" fill="#5a2f17"/><text x="60" y="28.5" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="12" fill="#e9c98a" letter-spacing="2">SALOON</text><path d="M44 110V70h32v40" fill="#1c0d05"/><path d="M46 76h13v20H46zM61 76h13v20H61z" fill="#7a4520"/><rect x="16" y="48" width="18" height="16" fill="#e8a64a" opacity=".8"/><rect x="86" y="48" width="18" height="16" fill="#e8a64a" opacity=".8"/></svg>
      <div class="rx-ground"></div>
      <div class="rx-tw">${TUMBLE}</div>
    </div>`;
    el.innerHTML = `<style>
      .rx{position:relative;min-height:100%;overflow:hidden;color:#2b1608;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;background:linear-gradient(#f2b45a 0%,#e88a3f 30%,#c9622f 55%,#8c4a2a 78%,#5a2e18 100%);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
      .rx-scene{position:absolute;inset:0;pointer-events:none;overflow:hidden;filter:sepia(.35) saturate(1.1)}
      .rx-sun{position:absolute;left:50%;top:34%;width:220px;height:220px;margin-left:-110px;border-radius:50%;background:radial-gradient(circle,#fff3c4 0%,#ffd57a 45%,#f7a440 70%,rgba(247,164,64,0) 72%);box-shadow:0 0 90px 30px rgba(255,200,110,.35)}
      .rx-mesa{position:absolute;left:0;bottom:16%;width:100%;height:20%}
      .rx-saloon{position:absolute;right:4%;bottom:15%;width:30%;max-width:170px}
      .rx-ground{position:absolute;left:0;right:0;bottom:0;height:17%;background:linear-gradient(#6e3a1d,#3d1e0d)}
      .rx-tw{position:absolute;bottom:8%;left:0;width:56px;height:56px;animation:rx-roll 11s linear infinite}
      .rx-tw svg{width:100%;height:100%;animation:rx-spin 1.6s linear infinite}
      @keyframes rx-roll{0%{transform:translate(-80px,0)}20%{transform:translate(20vw,-26px)}30%{transform:translate(30vw,0)}55%{transform:translate(55vw,-16px)}65%{transform:translate(65vw,0)}100%{transform:translate(calc(100vw + 80px),0)}}
      @keyframes rx-spin{to{transform:rotate(360deg)}}
      .rx-main{position:relative;z-index:1;min-height:100%;box-sizing:border-box;padding:14px 16px 28px;display:grid;align-content:start;justify-items:center;gap:12px}
      .rx-title{font-family:Pacifico,"Brush Script MT",cursive;font-size:2.3rem;line-height:1.1;color:#fff4d6;text-shadow:3px 3px 0 #5a2410,0 0 18px rgba(90,36,16,.5);text-align:center;margin:6px 0 0}
      .rx-sub{font-family:Anton,Impact,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;font-size:1rem;color:#fff4d6;background:#5a2410;border-radius:4px;padding:3px 12px;text-align:center}
      .rx-card{width:min(100%,520px);box-sizing:border-box;background:linear-gradient(#f1dfb4,#e2c48a);border:3px solid #4a250f;border-radius:6px;padding:12px 14px;box-shadow:0 8px 22px rgba(40,15,5,.45);font-size:1.1rem;line-height:1.3}
      .rx-card b{color:#8a2412}
      .rx-bar{width:min(100%,520px);height:8px;background:rgba(60,25,10,.35);border-radius:9px;overflow:hidden}
      .rx-bar i{display:block;height:100%;background:#fff1c9;transform-origin:left;animation:rx-bar linear forwards}
      @keyframes rx-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
      /* --- affiches WANTED --- */
      .rx-posters{width:min(100%,560px);display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px}
      .rx-wp{position:relative;background:radial-gradient(120% 90% at 50% 40%,#f3e2b8,#d9b97c 85%,#b89155);border:2px solid #6b4423;padding:6px 6px 8px;text-align:center;box-shadow:0 6px 14px rgba(40,15,5,.45);clip-path:polygon(0 2%,6% 0,40% 1.5%,70% 0,100% 1.5%,99% 40%,100% 98%,70% 100%,35% 98.5%,0 100%,1% 60%);transform:rotate(var(--rot,0deg))}
      .rx-wp h4{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.35rem;letter-spacing:.08em;color:#3b1d0b;line-height:1}
      .rx-wp .rx-av{width:70%;margin:4px auto;aspect-ratio:1;border:3px solid #3b1d0b;background:#e9d29c;overflow:hidden}
      .rx-wp .rx-av svg{width:100%;height:100%;display:block;filter:sepia(.55) contrast(1.05)}
      .rx-wp .rx-nm{font-weight:800;text-transform:uppercase;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rx-wp .rx-prime{font-family:Pacifico,cursive;font-size:.95rem;color:#8a2412;line-height:1.3}
      .rx-wp .rx-bt{font-size:.8rem;color:#5a3a1f}
      .rx-wp.me::after{content:"VOUS";position:absolute;right:4px;top:24%;font-family:Anton,Impact,sans-serif;font-size:.85rem;letter-spacing:.08em;color:#b0281a;border:2px solid #b0281a;padding:0 5px;transform:rotate(-14deg);opacity:.85;background:rgba(243,226,184,.6)}
      .rx-wp .rx-star{position:absolute;bottom:2px;right:6px;font-size:1.4rem;color:#c98a14;text-shadow:0 1px 0 #3b1d0b}
      /* --- podium de manche --- */
      .rx-pod{width:min(100%,520px);display:grid;gap:6px}
      .rx-row{display:grid;grid-template-columns:30px 46px minmax(0,1fr) auto 38px;align-items:center;gap:8px;background:rgba(243,226,184,.93);border:2px solid #4a250f;border-radius:6px;padding:4px 8px;box-shadow:0 3px 8px rgba(40,15,5,.35);animation:rx-in .35s both}
      .rx-row .rx-pl{font-family:Anton,Impact,sans-serif;font-size:1.4rem;text-align:center;color:#5a2410}
      .rx-row .rx-mini{width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid #4a250f;background:#e9d29c}
      .rx-row .rx-mini svg{width:100%;height:100%;display:block}
      .rx-row .rx-n{font-weight:800;font-size:1.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rx-row .rx-t{font-family:Anton,Impact,sans-serif;font-size:1.25rem;letter-spacing:.02em}
      .rx-row .rx-t.bad{font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:1rem;color:#9a2a14;text-transform:uppercase}
      .rx-row .rx-pts{font-family:Anton,Impact,sans-serif;font-size:1.1rem;color:#fff4d6;background:#8a2412;border-radius:50%;width:34px;height:34px;display:grid;place-items:center}
      .rx-row .rx-pts.z{background:none;color:#8a6a4a}
      .rx-row.p1{background:linear-gradient(90deg,#ffe7a0,#f3e2b8)}
      .rx-row.rec{box-shadow:0 0 0 3px #ffd54a,0 0 22px #ffd54a;position:relative}
      .rx-row.rec::after{content:"RECORD !";position:absolute;right:52px;top:-11px;font-family:Anton,Impact,sans-serif;font-size:.8rem;letter-spacing:.06em;background:#c0341d;color:#fff4d6;padding:1px 6px;transform:rotate(-4deg);border:2px solid #4a250f}
      .rx-row.mine{border-color:#c0341d}
      @keyframes rx-in{from{opacity:0;transform:translateX(-24px)}}
      .rx-rec{font-size:1rem;color:#fff4d6;text-align:center;text-shadow:0 1px 2px #3b1d0b}
      .rx-rec b{font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.03em;color:#ffe08a}
      .rx-next{font-family:Anton,Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.04em;font-size:1.05rem;color:#3b1d0b;background:#ffd54a;border:2px solid #3b1d0b;padding:4px 12px;transform:rotate(-1.5deg);text-align:center}
      /* --- écran de duel --- */
      .rx-stage{position:absolute;inset:0;z-index:2;touch-action:none;cursor:crosshair;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;padding:14px 16px 22px;box-sizing:border-box;overflow:hidden;transition:background-color .06s}
      .rx-stage[data-sig="red"]{background:rgba(150,22,12,.72)}
      .rx-stage[data-sig="fake"]{background:rgba(236,128,18,.86)}
      .rx-stage[data-sig="go"]{background:rgba(26,150,58,.88)}
      .rx-stage[data-sig="done"]{background:rgba(40,18,8,.62)}
      .rx-stage[data-sig="early"]{background:rgba(70,10,6,.8)}
      .rx-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
      .rx-pill{font-family:Anton,Impact,sans-serif;letter-spacing:.06em;font-size:1rem;color:#2b1608;background:#f3e2b8;border:2px solid #2b1608;padding:2px 10px;border-radius:3px}
      .rx-pill.v{background:#ffd54a}
      .rx-big{align-self:center;text-align:center;color:#fff4d6;pointer-events:none}
      .rx-big .w{display:block;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:clamp(3.4rem,17vw,7rem);line-height:1;text-transform:uppercase;letter-spacing:.02em;text-shadow:4px 4px 0 rgba(0,0,0,.35)}
      .rx-big .s{display:block;font-family:Pacifico,cursive;font-size:1.6rem;margin-top:8px}
      .rx-big .m{display:block;font-size:1.2rem;font-weight:700;margin-top:10px;opacity:.95}
      .rx-stage[data-sig="go"] .rx-big .w{animation:rx-pop .18s ease-out}
      @keyframes rx-pop{from{transform:scale(1.35)}}
      .rx-hint{color:#fff4d6;font-weight:700;font-size:1.05rem;text-align:center;opacity:.92;pointer-events:none}
      .rx-target{position:absolute;width:104px;height:130px;margin:-65px 0 0 -52px;display:grid;place-items:center;animation:rx-pop .18s ease-out}
      .rx-target::before{content:"";position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,244,214,.95) 60%,rgba(255,244,214,.55));border:3px dashed #2b1608}
      .rx-target svg{position:relative;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4))}
      .rx-hole{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:radial-gradient(circle,#120804 40%,#5a3a1f 60%,transparent 70%);pointer-events:none}
      .rx-miss{position:absolute;transform:translate(-50%,-140%);font-family:Anton,Impact,sans-serif;color:#fff4d6;font-size:1.2rem;text-shadow:2px 2px 0 #2b1608;pointer-events:none;animation:rx-fade .8s forwards}
      .rx-bang{position:absolute;width:190px;height:150px;margin:-75px 0 0 -95px;pointer-events:none;z-index:5;animation:rx-bang .7s ease-out forwards}
      .rx-bang svg{width:100%;height:100%}
      @keyframes rx-bang{0%{transform:scale(.2) rotate(-12deg);opacity:1}25%{transform:scale(1.1) rotate(4deg);opacity:1}70%{opacity:1}100%{transform:scale(1.2) rotate(6deg);opacity:0}}
      @keyframes rx-fade{to{opacity:0;transform:translate(-50%,-220%)}}
      .rx-flash{position:absolute;inset:0;background:#fff8e0;pointer-events:none;z-index:4;animation:rx-flash .18s forwards}
      @keyframes rx-flash{from{opacity:.85}to{opacity:0}}
      .rx-shake{animation:rx-shake .25s}
      @keyframes rx-shake{20%{transform:translate(-6px,3px)}40%{transform:translate(5px,-4px)}60%{transform:translate(-4px,2px)}80%{transform:translate(3px,-1px)}}
      .rx-crown{font-family:Pacifico,cursive;font-size:1.5rem;color:#fff4d6;text-shadow:2px 2px 0 #5a2410;text-align:center}
      .rx-hero{width:min(64%,230px);--rot:-2deg}
      .rx-hero h4{font-size:2rem}
      @media (min-width:700px){.rx-title{font-size:3rem}}
      @media (prefers-reduced-motion:reduce){.rx *,.rx *::before,.rx *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.rx-tw{display:none}.rx-bang{animation:rx-fade-rm .7s steps(1) forwards!important}}
      @keyframes rx-fade-rm{to{opacity:0}}
    </style>
    <div class="rx" id="rx-root">${SCENE}<div class="rx-main" id="rx-main"></div></div>`;
    const root = el.querySelector("#rx-root"), main = el.querySelector("#rx-main");

    /* ================= Son (WebAudio, après un geste) ================= */
    let actx = null, noiseBuf = null;
    function ensureAudio() {
      if (actx) { if (actx.state === "suspended") actx.resume().catch(() => {}); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        actx = new AC();
        noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.5), actx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { actx = null; }
    }
    function bangSound(soft) {
      if (!actx) return;
      try {
        const t = actx.currentTime;
        const src = actx.createBufferSource(); src.buffer = noiseBuf;
        const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(soft ? 900 : 2600, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.35);
        const g = actx.createGain(); g.gain.setValueAtTime(soft ? 0.25 : 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        src.connect(lp); lp.connect(g); g.connect(actx.destination); src.start(t); src.stop(t + 0.5);
        const o = actx.createOscillator(), og = actx.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
        og.gain.setValueAtTime(soft ? 0.2 : 0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(og); og.connect(actx.destination); o.start(t); o.stop(t + 0.32);
      } catch (e) { /* rien */ }
    }

    /* ================= Logique de l'hôte ================= */
    if (api.isHost) {
      let hs = {ph: "intro", r: 0, sc: P.map(() => 0), bt: P.map(() => 0), bs: null};
      let inputs = {}, resolved = 0, deadline = null;
      const pub = () => { if (!dead) api.setState(hs); };
      pub();
      later(() => startRound(1), INTRO_MS);
      function startRound(r) {
        let d = 2000 + Math.random() * 4000, f = 0, tx = 0, ty = 0;
        if (r === 4) { d = 3600 + Math.random() * 2400; f = 1300 + Math.random() * (d - 2700); }
        if (r === 5) { tx = 16 + Math.round(Math.random() * 68); ty = 26 + Math.round(Math.random() * 52); }
        hs = {ph: "wait", r, d: Math.round(d), f: Math.round(f), tx, ty, sc: hs.sc, bt: hs.bt, bs: hs.bs};
        pub();
        deadline = later(() => resolve(r), hs.d + SLOW_MS + NET_MARGIN);
        check();
      }
      function check() {
        if (hs.ph !== "wait" || resolved === hs.r) return;
        const live = api.connected();
        const waiting = live.filter(k => { const i = inputs[k]; return !(i && i.r === hs.r); });
        if (live.length && !waiting.length) resolve(hs.r);
      }
      function resolve(r) {
        if (resolved === r || hs.r !== r || hs.ph !== "wait") return;
        resolved = r;
        if (deadline) { clearTimeout(deadline); timers.delete(deadline); deadline = null; }
        const t = P.map(p => {
          const i = inputs[p.key];
          if (!i || i.r !== r) return -2;
          if (i.early) return -1;
          if (i.slow) return -2;
          const ms = +i.ms;
          if (isFinite(ms) && ms < 100) return -1; // moins de 100 ms : impossible pour un humain, c'est une anticipation
          return isFinite(ms) && ms >= 0 && ms <= SLOW_MS + 500 ? Math.round(ms) : -2;
        });
        const order = t.map((v, s) => s).filter(s => t[s] >= 0).sort((a, b) => t[a] - t[b]);
        const table = N === 2 ? [1] : [3, 2, 1];
        const pts = P.map(() => 0);
        order.forEach((s, k) => { if (k < table.length) pts[s] = table[k]; });
        const sc = hs.sc.map((v, s) => v + pts[s]);
        const bt = hs.bt.map((v, s) => (t[s] >= 0 && (!v || t[s] < v) ? t[s] : v));
        let bs = hs.bs, nb = 0;
        if (order.length && (!bs || t[order[0]] < bs.ms)) { bs = {s: order[0], ms: t[order[0]], r}; nb = 1; }
        hs = {ph: "res", r, t, p: pts, sc, bt, bs, nb};
        pub();
        later(() => (r < ROUNDS ? startRound(r + 1) : end()), RES_MS);
      }
      function finalOrder() {
        return P.map((p, s) => s).sort((a, b) => (hs.sc[b] - hs.sc[a]) || ((hs.bt[a] || 1e9) - (hs.bt[b] || 1e9)) || a - b);
      }
      function end() {
        const rk = finalOrder();
        hs = {ph: "end", r: ROUNDS, sc: hs.sc, bt: hs.bt, bs: hs.bs, rk};
        pub();
        later(() => {
          const top = rk[0], best = hs.sc[top];
          const winners = best > 0 ? rk.filter(s => hs.sc[s] === best && (hs.bt[s] || 1e9) === (hs.bt[top] || 1e9)).map(s => P[s].key) : [];
          const rec = hs.bs ? ` Record : ${P[hs.bs.s].pseudo} en ${fmt(hs.bs.ms)}.` : "";
          const summary = best > 0
            ? `${P[top].pseudo} dégaine le plus vite de l'Ouest (${best} pt${best > 1 ? "s" : ""}).${rec}`
            : "Personne n'a touché sa cible : la ville reste sans shérif.";
          api.finish({winners, ranking: rk.map(s => P[s].key), summary});
        }, END_MS);
      }
      api.onInputs(map => { inputs = map; check(); });
    }

    /* ================= Affichage (tous les téléphones) ================= */
    let cur = null, shownKey = "", rt = null, inputsSeen = {};
    const rTimers = new Set();
    const rLater = (fn, ms) => { const t = setTimeout(() => { rTimers.delete(t); fn(); }, ms); rTimers.add(t); timers.add(t); return t; };
    const clearRound = () => { rTimers.forEach(t => { clearTimeout(t); timers.delete(t); }); rTimers.clear(); };

    function posters(s, compact) {
      const order = P.map((p, i) => i).sort((a, b) => (s.sc[b] - s.sc[a]) || a - b);
      const lead = Math.max(...s.sc);
      return `<div class="rx-posters">${order.map((i, k) => `<div class="rx-wp${i === mySeat ? " me" : ""}" style="--rot:${((i * 37) % 7) - 3}deg">
        ${lead > 0 && s.sc[i] === lead ? '<span class="rx-star" title="En tête">★</span>' : ""}
        <h4>WANTED</h4><div class="rx-av">${bust(i)}</div>
        <div class="rx-nm">${nm(i)}</div>
        <div class="rx-prime">Prime : ${s.sc[i]} pt${s.sc[i] > 1 ? "s" : ""}</div>
        ${!compact ? `<div class="rx-bt">${s.bt[i] ? "Meilleur : " + fmt(s.bt[i]) : "Pas encore tiré"}</div>` : ""}
      </div>`).join("")}</div>`;
    }
    function recLine(s) {
      return s.bs ? `<div class="rx-rec">Record de la partie : <b>${nm(s.bs.s)} ${fmt(s.bs.ms)}</b> (manche ${s.bs.r})</div>` : "";
    }
    function bar(ms) { return `<div class="rx-bar"><i style="animation-duration:${ms}ms"></i></div>`; }

    function renderIntro(s) {
      main.innerHTML = `<h1 class="rx-title">Duel de réflexes</h1>
        <div class="rx-sub">5 manches · Le plus rapide de l'Ouest</div>
        <div class="rx-card">Écran <b>rouge</b> : attendez, la main sur le holster…<br>Écran <b>VERT « TIREZ ! »</b> : touchez l'écran le plus vite possible${matchMedia("(hover:hover)").matches ? " (ou barre Espace)" : ""}.<br>Tirer trop tôt = <b>faux départ</b>, zéro point.<br><small>Manche 4 : faux signal. Manche 5 : visez la cible !</small></div>
        ${bar(INTRO_MS - 400)}
        ${posters(s, true)}
        ${api.isPlayer ? "" : '<div class="rx-sub">Vous regardez le duel</div>'}`;
    }

    function stageHTML(s) {
      const v = VARIANT[s.r];
      return `<div class="rx-stage" id="rx-stage" data-sig="red" role="button" aria-label="Zone de tir">
        <div class="rx-top"><span class="rx-pill">MANCHE ${s.r}/${ROUNDS}</span><span class="rx-pill v">${v.tag}</span></div>
        <div class="rx-big" id="rx-big" role="status" aria-live="assertive"><span class="w">Attendez…</span><span class="s">la main sur le colt</span></div>
        <div class="rx-hint" id="rx-hint">${api.isPlayer ? v.hint : "Vous regardez le duel"}</div>
      </div>`;
    }
    function setBig(w, sub, more) {
      const b = el.querySelector("#rx-big"); if (!b) return;
      b.innerHTML = `<span class="w">${w}</span>${sub ? `<span class="s">${sub}</span>` : ""}${more ? `<span class="m" id="rx-more">${more}</span>` : ""}`;
    }
    function setSig(sig) { const st = el.querySelector("#rx-stage"); if (st) st.dataset.sig = sig; if (rt) rt.sig = sig; }

    function startLocalRound(s) {
      clearRound();
      main.innerHTML = "";
      root.insertAdjacentHTML("beforeend", stageHTML(s));
      const stage = el.querySelector("#rx-stage");
      stage.addEventListener("pointerdown", onPointer);
      // Minuteur LOCAL : départ à la réception de l'ordre de manche, sur l'horloge de ce téléphone.
      rt = {r: s.r, sig: "red", tSig: 0, done: false, s};
      if (s.f) {
        rLater(() => { if (rt && !rt.done && rt.sig === "red") { setSig("fake"); setBig("TIREZ…", "pas encore !"); } }, s.f);
        rLater(() => { if (rt && !rt.done && rt.sig === "fake") { setSig("red"); setBig("Attendez…", "c'était un piège"); } }, s.f + 650);
      }
      rLater(showSignal, s.d);
    }
    function showSignal() {
      if (!rt || rt.done || rt.sig === "go") return;
      const s = rt.s;
      setSig("go");
      if (s.r === 5) {
        setBig("TIREZ !", "visez la cible");
        const st = el.querySelector("#rx-stage");
        const tg = document.createElement("div");
        tg.className = "rx-target"; tg.id = "rx-target";
        tg.style.left = s.tx + "%"; tg.style.top = s.ty + "%";
        tg.innerHTML = CACTUS;
        st.appendChild(tg);
        const big = el.querySelector("#rx-big"); if (big) big.style.opacity = ".35";
      } else setBig("TIREZ !");
      rt.tSig = performance.now();
      if (api.isPlayer) rLater(() => { if (rt && !rt.done) { rt.done = true; setSig("done"); setBig("Trop lent !", "le shérif s'est endormi", waitingText()); send({r: rt.r, slow: 1}); } }, SLOW_MS);
    }
    function send(obj) { api.setInput(obj); }
    function waitingText() {
      if (!rt) return "";
      const live = api.connected().filter(k => seatOf[k] !== undefined);
      const n = live.filter(k => inputsSeen[k] && inputsSeen[k].r === rt.r).length;
      return `En attente des autres… ${Math.min(n, live.length)}/${live.length}`;
    }

    function burst(x, y, txt) {
      const st = el.querySelector("#rx-stage"); if (!st) return;
      const b = document.createElement("div");
      b.className = "rx-bang";
      b.style.left = x + "px"; b.style.top = y + "px";
      b.innerHTML = `<svg viewBox="0 0 190 150"><polygon points="95,4 112,44 150,14 140,56 186,52 150,80 184,112 134,104 140,146 106,116 86,148 76,110 34,138 50,98 4,96 44,72 10,40 58,48 52,8 82,40" fill="#ffd54a" stroke="#2b1608" stroke-width="4" stroke-linejoin="round"/><polygon points="95,30 106,56 132,40 124,66 156,68 128,84 146,104 116,98 112,124 96,104 80,126 76,100 50,110 62,86 34,78 62,66 46,44 74,54" fill="#e8501f"/><text x="95" y="88" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="34" fill="#fff4d6" stroke="#2b1608" stroke-width="2" paint-order="stroke">${txt}</text></svg>`;
      st.appendChild(b);
      later(() => b.remove(), 750);
      if (!RM) {
        const f = document.createElement("div"); f.className = "rx-flash"; st.appendChild(f); later(() => f.remove(), 200);
        const bg = el.querySelector("#rx-big"); if (bg) { bg.classList.remove("rx-shake"); void bg.offsetWidth; bg.classList.add("rx-shake"); }
      }
    }

    function shoot(x, y, evTime, onTarget) {
      ensureAudio();
      if (!api.isPlayer || !rt || rt.done || !cur || cur.ph !== "wait" || cur.r !== rt.r) return;
      if (rt.sig !== "go") {
        rt.done = true; clearRound();
        send({r: rt.r, early: 1});
        setSig("early");
        bangSound(true);
        burst(x, y, "OUPS!");
        setBig("Trop tôt !", "faux départ, pas de point", waitingText());
        return;
      }
      if (rt.r === 5 && !onTarget) {
        const st = el.querySelector("#rx-stage");
        if (st && x != null) {
          const h = document.createElement("div"); h.className = "rx-hole"; h.style.left = x + "px"; h.style.top = y + "px"; st.appendChild(h);
          const m = document.createElement("div"); m.className = "rx-miss"; m.textContent = "Raté !"; m.style.left = x + "px"; m.style.top = y + "px"; st.appendChild(m);
          later(() => m.remove(), 820);
        }
        bangSound(true);
        return;
      }
      const now = performance.now();
      const t = evTime && evTime >= rt.tSig - 5 && evTime <= now + 5 ? evTime : now;
      const ms = Math.max(0, Math.round(t - rt.tSig));
      rt.done = true; clearRound();
      send({r: rt.r, ms});
      bangSound(false);
      burst(x, y, "BANG!");
      const tg = el.querySelector("#rx-target"); if (tg) tg.style.opacity = ".5";
      const big = el.querySelector("#rx-big"); if (big) big.style.opacity = "";
      setSig("done");
      setBig(fmt(ms), ms < 250 ? "quelle gâchette !" : ms < 400 ? "joli tir" : "un peu rouillé…", waitingText());
    }
    function onPointer(e) {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      const st = el.querySelector("#rx-stage"); if (!st) return;
      const r = st.getBoundingClientRect();
      shoot(e.clientX - r.left, e.clientY - r.top, e.timeStamp, !!(e.target.closest && e.target.closest(".rx-target")));
    }
    function onKey(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      if (!cur || cur.ph !== "wait") return;
      e.preventDefault();
      if (e.repeat) return;
      if (rt && rt.r === 5 && rt.sig === "go") { ensureAudio(); api.toast("Manche 5 : visez la cible avec le doigt ou la souris !"); return; }
      const st = el.querySelector("#rx-stage"); if (!st) return;
      shoot(st.clientWidth / 2, st.clientHeight * 0.62, e.timeStamp, false);
    }
    window.addEventListener("keydown", onKey);
    const onGesture = () => ensureAudio();
    root.addEventListener("pointerdown", onGesture);

    function renderRes(s) {
      const order = P.map((p, i) => i).sort((a, b) => {
        const ta = s.t[a] >= 0 ? s.t[a] : 1e6 - s.t[a], tb = s.t[b] >= 0 ? s.t[b] : 1e6 - s.t[b];
        return ta - tb || a - b;
      });
      let place = 0;
      const rows = order.map((i, k) => {
        const v = s.t[i];
        const ok = v >= 0;
        if (ok) place++;
        const isRec = s.nb && s.bs && s.bs.s === i && s.bs.r === s.r;
        const timeTxt = ok ? fmt(v) : v === -1 ? "Trop tôt !" : "Pas tiré";
        return `<div class="rx-row${ok && place === 1 ? " p1" : ""}${isRec ? " rec" : ""}${i === mySeat ? " mine" : ""}" style="animation-delay:${k * 90}ms">
          <span class="rx-pl">${ok ? (place <= 3 ? ["🥇", "🥈", "🥉"][place - 1] : place) : "✗"}</span>
          <span class="rx-mini">${bust(i)}</span><span class="rx-n">${nm(i)}</span>
          <span class="rx-t${ok ? "" : " bad"}">${timeTxt}</span>
          <span class="rx-pts${s.p[i] ? "" : " z"}">${s.p[i] ? "+" + s.p[i] : "0"}</span></div>`;
      }).join("");
      const nx = s.r < ROUNDS ? VARIANT[s.r + 1] : null;
      main.innerHTML = `<div class="rx-sub">Manche ${s.r}/${ROUNDS} · Résultats</div>
        <div class="rx-pod">${rows}</div>
        ${recLine(s)}
        ${nx ? `<div class="rx-next">Manche ${s.r + 1} : ${nx.tag}${s.r + 1 >= 4 ? " — " + nx.hint : ""}</div>` : '<div class="rx-next">Dernière manche terminée !</div>'}
        ${bar(RES_MS - 300)}
        ${posters(s, false)}`;
    }
    function renderEnd(s) {
      const rk = s.rk, top = rk[0];
      const hasWinner = s.sc[top] > 0;
      main.innerHTML = `<h1 class="rx-title">${hasWinner ? "Le plus rapide de l'Ouest" : "Ville sans shérif"}</h1>
        ${hasWinner ? `<div class="rx-wp rx-hero"><span class="rx-star">★</span><h4>WANTED</h4><div class="rx-av">${bust(top)}</div><div class="rx-nm">${nm(top)}</div><div class="rx-prime">Prime : ${s.sc[top]} pts</div><div class="rx-bt">${s.bt[top] ? "Meilleur : " + fmt(s.bt[top]) : ""}</div></div>` : ""}
        <div class="rx-pod">${rk.map((i, k) => `<div class="rx-row${k === 0 && hasWinner ? " p1" : ""}${i === mySeat ? " mine" : ""}" style="animation-delay:${k * 90}ms">
          <span class="rx-pl">${k + 1}</span><span class="rx-mini">${bust(i)}</span><span class="rx-n">${nm(i)}</span>
          <span class="rx-t${s.bt[i] ? "" : " bad"}">${s.bt[i] ? fmt(s.bt[i]) : "—"}</span><span class="rx-pts${s.sc[i] ? "" : " z"}">${s.sc[i]}</span></div>`).join("")}</div>
        ${recLine(s)}`;
    }

    function removeStage() {
      const st = el.querySelector("#rx-stage");
      if (st) { st.removeEventListener("pointerdown", onPointer); st.remove(); }
    }
    api.onState(s => {
      if (dead || !s || !s.ph) return;
      cur = s;
      const key = s.ph + ":" + s.r;
      if (key === shownKey) return;
      shownKey = key;
      if (s.ph === "wait") {
        removeStage();
        startLocalRound(s);
        return;
      }
      clearRound(); rt = null; removeStage();
      el.scrollTop = 0;
      if (s.ph === "intro") renderIntro(s);
      else if (s.ph === "res") renderRes(s);
      else if (s.ph === "end") renderEnd(s);
    });
    api.onInputs(map => {
      inputsSeen = map;
      const m = el.querySelector("#rx-more");
      if (m && rt && rt.done) m.textContent = waitingText();
    });

    return {
      destroy() {
        dead = true;
        clearAll(); clearRound();
        window.removeEventListener("keydown", onKey);
        root.removeEventListener("pointerdown", onGesture);
        if (actx) { try { actx.close(); } catch (e) { /* rien */ } actx = null; }
        el.innerHTML = "";
      }
    };
  }
});
