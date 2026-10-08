/* Gonflette Party : Morpion géant (Ultimate Tic-Tac-Toe) en réseau, 2 joueurs, chacun sur son téléphone.
   9 petites grilles dans une grande. La case jouée envoie l'adversaire dans la petite grille au même endroit
   (si elle est gagnée ou pleine : il joue où il veut). Trois petites grilles alignées = victoire.
   S'il n'y a plus de coup possible, celui qui a le plus de petites grilles gagne (sinon match nul).

   État publié par l'hôte (compact, ~160 octets) :
     c : 81 caractères "0"/"1"/"2", case (b*9 + k) = case k (0..8, ligne par ligne) de la petite grille b (0..8)
     w : 9 caractères, gagnant de chaque petite grille "0" en cours, "1"/"2" gagnée, "3" pleine sans gagnant
     a : grille imposée (0..8) ou -1 = n'importe où      t : 1 (X, commence) ou 2 (O), joueur au trait
     l : dernière case jouée (0..80) ou -1               n : nombre de coups joués
     o : 1 si terminé ; r : siège gagnant (1/2) ou 0 = nul ; y : "line" | "count" | "ff" ; L : ligne gagnante de la grande grille
   Entrées des joueurs : {seq, b, c}. */
(function () {
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  // ---------- règles pures (testables hors navigateur) ----------
  function lineOf(get, p) {
    for (const L of LINES) if (get(L[0]) === p && get(L[1]) === p && get(L[2]) === p) return L.slice();
    return null;
  }
  function newGame() {
    return {c: "0".repeat(81), w: "0".repeat(9), a: -1, t: 1, l: -1, n: 0, o: 0, r: 0, y: "", L: null};
  }
  function canPlay(s, b, k) {
    return !!s && !s.o && b >= 0 && b < 9 && k >= 0 && k < 9 && (b | 0) === b && (k | 0) === k &&
      (s.a === -1 || s.a === b) && s.w[b] === "0" && s.c[b * 9 + k] === "0";
  }
  function legal(s) {
    const out = [];
    if (!s || s.o) return out;
    for (let b = 0; b < 9; b++) for (let k = 0; k < 9; k++) if (canPlay(s, b, k)) out.push([b, k]);
    return out;
  }
  function counts(w) {
    let x = 0, o = 0;
    for (const ch of w) { if (ch === "1") x++; else if (ch === "2") o++; }
    return [x, o];
  }
  // Joue (b, k) pour le joueur au trait. Renvoie le nouvel état, ou null si le coup est illégal.
  function play(s, b, k) {
    if (!canPlay(s, b, k)) return null;
    const p = String(s.t);
    const c = s.c.split(""), w = s.w.split("");
    c[b * 9 + k] = p;
    if (lineOf(i => c[b * 9 + i], p)) w[b] = p;
    else if (![0, 1, 2, 3, 4, 5, 6, 7, 8].some(i => c[b * 9 + i] === "0")) w[b] = "3";
    const ns = {c: c.join(""), w: w.join(""), a: -1, t: s.t, l: b * 9 + k, n: s.n + 1, o: 0, r: 0, y: "", L: null};
    const big = lineOf(i => w[i], p);
    if (big) { ns.o = 1; ns.r = s.t; ns.y = "line"; ns.L = big; return ns; }
    if (!w.includes("0")) {
      const [x, o] = counts(ns.w);
      ns.o = 1; ns.r = x > o ? 1 : o > x ? 2 : 0; ns.y = "count"; return ns;
    }
    ns.a = w[k] === "0" ? k : -1;
    ns.t = 3 - s.t;
    return ns;
  }
  const RULES = {LINES, newGame, canPlay, legal, play, counts, lineOf};

  GONFLETTE.registerGame({
    id: "morpion",
    name: "Morpion géant",
    min: 2,
    max: 2,
    resumable: true,                              // l'hôte rechargé repart de api.resume
    rules: RULES,
    create(api) {
      const [P1, P2] = api.players;               // P1 = X (commence), P2 = O
      const P = [null, P1, P2];
      const el = api.el;
      const mySide = api.me === P1.key ? 1 : api.me === P2.key ? 2 : 0;
      const RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const POS = ["en haut à gauche", "en haut au milieu", "en haut à droite", "au milieu à gauche", "du centre",
        "au milieu à droite", "en bas à gauche", "en bas au milieu", "en bas à droite"];
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      let dead = false;

      // ---------- dessin à la craie ----------
      let sd = 7;
      const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const j = a => ((rnd() - 0.5) * 2 * a).toFixed(1);
      // trait légèrement tremblé de (x1,y1) à (x2,y2)
      const wob = (x1, y1, x2, y2, a) => `M${(x1 + +j(a)).toFixed(1)} ${(y1 + +j(a)).toFixed(1)} Q${((x1 + x2) / 2 + +j(a * 1.6)).toFixed(1)} ${((y1 + y2) / 2 + +j(a * 1.6)).toFixed(1)} ${(x2 + +j(a)).toFixed(1)} ${(y2 + +j(a)).toFixed(1)}`;
      const X_PATHS = ["M25 23 C40 39 59 60 78 79", "M77 22 C61 40 43 59 23 79"];
      const O_PATH = "M53 19 C73 18 82 36 80 52 C78 70 63 82 47 80 C29 78 19 63 21 47 C23 31 35 20 58 23";
      function markSvg(p, cls, rot) {
        const paths = p === "1"
          ? X_PATHS.map((d, i) => `<path class="mo-st${i ? " mo-st2" : ""}" pathLength="1" d="${d}"/>`).join("")
          : `<path class="mo-st" pathLength="1" d="${O_PATH}"/>`;
        return `<svg class="${cls} mo-p${p}" viewBox="0 0 100 100" style="transform:rotate(${rot || 0}deg)" aria-hidden="true">${paths}</svg>`;
      }

      // grandes lignes de la grande grille (viewBox 300)
      let bigLines = "";
      for (const x of [100, 200]) bigLines += `<path d="${wob(x, 4, x, 296, 2.5)}"/><path d="${wob(4, x, 296, x, 2.5)}"/>`;
      // petites lignes (une variante par petite grille, viewBox 90)
      const smallLines = b => { sd = 31 + b * 97; let s = ""; for (const x of [30, 60]) s += `<path d="${wob(x, 4, x, 86, 1.6)}"/><path d="${wob(4, x, 86, x, 1.6)}"/>`; return s; };

      let boardsHtml = "";
      for (let b = 0; b < 9; b++) {
        let cells = "";
        for (let k = 0; k < 9; k++) cells += `<button type="button" class="mo-cell" data-i="${b * 9 + k}" aria-label="Grille ${POS[b]}, case ${POS[k]}"></button>`;
        boardsHtml += `<div class="mo-sb" data-b="${b}"><svg class="mo-sl" viewBox="0 0 90 90" preserveAspectRatio="none" aria-hidden="true">${smallLines(b)}</svg>${cells}<div class="mo-sbm"></div></div>`;
      }
      const card = (pl, side) => `<div class="mo-pl" id="mo-pl${side}">
          <div class="mo-av">${api.avatar(pl.key, {view: "bust"})}</div>
          <div class="mo-inf"><b class="mo-nm"></b>
            <span class="mo-row">${markSvg(String(side), "mo-sym", side === 1 ? -4 : 3)}<span class="mo-cnt"><i>0</i> grille</span></span></div>
        </div>`;

      el.innerHTML = `<style>
        .mo{--x:#ff9fc8;--o:#8fdcff;--chalk:#eef0e6;--glow:var(--x);position:relative;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 10px 0;color:var(--chalk);font-family:"Barlow Condensed",system-ui,sans-serif;overflow:hidden;
          background:radial-gradient(ellipse 60% 30% at 18% 12%,rgba(255,255,255,.07),transparent 70%),radial-gradient(ellipse 50% 25% at 85% 62%,rgba(255,255,255,.05),transparent 70%),radial-gradient(ellipse 40% 18% at 30% 88%,rgba(255,255,255,.04),transparent 70%),radial-gradient(120% 90% at 50% 40%,#2a5040,#1a3328 75%,#122219);-webkit-tap-highlight-color:transparent}
        .mo.mo-t2{--glow:var(--o)}
        .mo *{box-sizing:border-box}
        .mo-defs{position:absolute;width:0;height:0}
        .mo-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;width:min(100%,560px)}
        .mo-vs{font-family:Anton,Impact,sans-serif;font-size:1.1rem;opacity:.55;transform:rotate(-6deg)}
        .mo-pl{position:relative;display:flex;align-items:center;gap:6px;min-width:0;padding:4px 6px 4px 4px;border-radius:14px;border:2px dashed rgba(238,240,230,.22);opacity:.62;transition:opacity .3s,border-color .3s,transform .3s,box-shadow .3s}
        #mo-pl2{flex-direction:row-reverse;text-align:right;padding:4px 4px 4px 6px}
        #mo-pl2 .mo-row{flex-direction:row-reverse}
        .mo-pl.mo-turn{opacity:1;transform:translateY(-1px);border-style:solid}
        #mo-pl1.mo-turn{border-color:var(--x);box-shadow:0 0 14px rgba(255,159,200,.35)}
        #mo-pl2.mo-turn{border-color:var(--o);box-shadow:0 0 14px rgba(143,220,255,.35)}
        .mo-pl.mo-win{opacity:1;border-style:solid;border-color:#ffe98a;box-shadow:0 0 20px rgba(255,233,138,.45)}
        .mo-av{flex:none;width:56px;height:56px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.18),rgba(255,255,255,.03));border:2px solid rgba(238,240,230,.35)}
        .mo-av .av{width:100%;height:100%;display:block}
        .mo-inf{min-width:0;display:grid;gap:0}
        .mo-nm{font-weight:800;font-size:1.12rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mo-row{display:flex;align-items:center;gap:4px}
        .mo-sym{width:26px;height:26px;flex:none}
        .mo-cnt{font-size:.95rem;white-space:nowrap;opacity:.9}
        .mo-cnt i{font-style:normal;font-family:Anton,Impact,sans-serif;font-size:1.15rem;margin-right:2px}
        .mo-status{font-family:Pacifico,"Brush Script MT",cursive;font-size:1.15rem;line-height:1.35;text-align:center;min-height:2.7em;display:flex;align-items:center;justify-content:center;padding:0 6px;text-shadow:0 0 6px rgba(255,255,255,.18);width:min(100%,560px)}
        .mo-status.mo-me{color:#fff6c2}
        .mo-status.mo-bump{animation:mo-bump .4s}
        .mo-board{position:relative;flex:none;width:min(100%,560px,max(300px,calc(100dvh - 300px)));aspect-ratio:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:3%;padding:1.4%}
        .mo-wl{z-index:3}.mo-bl,.mo-wl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
        .mo-bl path{fill:none;stroke:var(--chalk);stroke-width:4.5;stroke-linecap:round;opacity:.85;filter:url(#mo-chalk)}
        .mo-sb{position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);border-radius:8px;transition:background-color .3s}
        .mo-sl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
        .mo-sl path{fill:none;stroke:var(--chalk);stroke-width:1.4;stroke-linecap:round;opacity:.5;vector-effect:non-scaling-stroke}
        .mo-cell{position:relative;z-index:1;display:block;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:9%;border:0;border-radius:6px;background:none;color:inherit;cursor:default;touch-action:manipulation;transition:opacity .3s,background-color .15s}
        .mo-cell .mo-mk{display:block;width:100%;height:100%;overflow:visible}
        .mo-sb.mo-on{background:color-mix(in srgb,var(--glow) 9%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--glow) 75%,transparent),0 0 16px color-mix(in srgb,var(--glow) 45%,transparent);animation:mo-pulse 1.5s ease-in-out infinite}
        .mo-sb.mo-on.mo-soft{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--glow) 50%,transparent),0 0 10px color-mix(in srgb,var(--glow) 25%,transparent);animation:none}
        .mo-mine .mo-sb.mo-on .mo-cell.mo-free{cursor:pointer}
        .mo-mine .mo-sb.mo-on .mo-cell.mo-free:active{background:color-mix(in srgb,var(--glow) 25%,transparent)}
        @media (hover:hover){.mo-mine .mo-sb.mo-on .mo-cell.mo-free:hover{background:color-mix(in srgb,var(--glow) 18%,transparent)}}
        .mo-mine .mo-sb:not(.mo-on):not(.mo-done){opacity:.5}
        .mo-sb{transition:opacity .3s,background-color .3s}
        .mo-sb.mo-done .mo-cell{opacity:.28}
        .mo-sb.mo-full .mo-cell{opacity:.45}
        .mo-cell.mo-last{background:rgba(255,255,255,.1)}
        .mo-cell.mo-pend .mo-mk{opacity:.45}
        .mo-sbm{position:absolute;inset:-3%;pointer-events:none;z-index:2}
        .mo-sbm svg{width:100%;height:100%;overflow:visible}
        .mo-sbm .mo-st{stroke-width:10}
        .mo-sb.mo-nope{animation:mo-shake .35s}
        .mo-st{fill:none;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;stroke-dashoffset:0;filter:url(#mo-chalk)}
        .mo-p1 .mo-st{stroke:var(--x)}
        .mo-p2 .mo-st{stroke:var(--o)}
        .mo-new .mo-st{animation:mo-draw .3s ease-out both}
        .mo-new .mo-st2{animation-delay:.2s}
        .mo-p2.mo-new .mo-st{animation-duration:.45s}
        .mo-sbm .mo-new .mo-st{animation-duration:.5s;animation-delay:.45s}
        .mo-sbm .mo-new .mo-st2{animation-delay:.85s}
        .mo-wl path{fill:none;stroke:#fff3a8;stroke-width:13;stroke-linecap:round;stroke-dasharray:1 2;filter:url(#mo-chalk);animation:mo-draw .7s .9s ease-out both}
        .mo-wl .mo-wls{stroke:rgba(10,25,18,.35);stroke-width:19;filter:none}
        .mo-help{width:min(100%,560px);text-align:center;font-size:1rem;line-height:1.25;opacity:.72;padding:4px 8px 0}
        .mo-help b{color:#fff6c2;font-weight:800}
        .mo-sp{flex:1}.mo-sp0{flex:.35}
        .mo-ledge{position:relative;width:calc(100% + 20px);height:26px;margin-top:6px;background:linear-gradient(#8a5a2b,#6b421c 55%,#4d2e12);box-shadow:0 -3px 6px rgba(0,0,0,.35)}
        .mo-ledge i{position:absolute;bottom:13px;height:8px;border-radius:4px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.15)}
        .mo-ledge i:nth-child(1){left:14%;width:46px;background:var(--chalk);transform:rotate(-3deg)}
        .mo-ledge i:nth-child(2){left:31%;width:30px;background:var(--x);transform:rotate(4deg)}
        .mo-ledge i:nth-child(3){left:44%;width:38px;background:var(--o)}
        .mo-ledge i:nth-child(4){left:70%;width:64px;height:16px;bottom:12px;border-radius:3px;background:linear-gradient(#3b3b46 0 45%,#c9b38a 45%);transform:rotate(-2deg)}
        @keyframes mo-draw{from{stroke-dashoffset:1;opacity:0}6%{opacity:1}to{stroke-dashoffset:0;opacity:1}}
        @keyframes mo-pulse{50%{box-shadow:0 0 0 2.5px color-mix(in srgb,var(--glow) 95%,transparent),0 0 26px color-mix(in srgb,var(--glow) 65%,transparent)}}
        @keyframes mo-shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        @keyframes mo-bump{40%{transform:scale(1.06)}}
        @media (prefers-reduced-motion:reduce){.mo *{animation:none!important;transition:none!important}}
        @media (min-width:700px){.mo-av{width:64px;height:64px}.mo-status{font-size:1.35rem}}
      </style>
      <div class="mo" id="mo-root">
        <svg class="mo-defs" aria-hidden="true" focusable="false"><defs>
          <filter id="mo-chalk" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/>
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" result="g"/>
            <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="ga"/>
            <feComposite in="d" in2="ga" operator="in"/>
          </filter></defs></svg>
        <div class="mo-sp0"></div>
        <div class="mo-head">${card(P1, 1)}<div class="mo-vs">VS</div>${card(P2, 2)}</div>
        <div class="mo-status" id="mo-status" role="status" aria-live="polite">Craie en main…</div>
        <div class="mo-board" id="mo-board">
          <svg class="mo-bl" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">${bigLines}</svg>
          ${boardsHtml}
          <svg class="mo-wl" id="mo-wl" viewBox="0 0 300 300" aria-hidden="true"></svg>
        </div>
        <div class="mo-help" id="mo-help">La case où tu joues <b>envoie l'adversaire</b> dans la grille au même endroit. Grille gagnée ou pleine : il joue où il veut. <b>3 grilles alignées</b> pour gagner !</div>
        <div class="mo-sp"></div>
        <div class="mo-ledge" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </div>`;

      const $ = s => el.querySelector(s);
      const root = $("#mo-root"), boardEl = $("#mo-board"), statusEl = $("#mo-status"), wlEl = $("#mo-wl");
      const sbs = [...el.querySelectorAll(".mo-sb")];
      const cells = [...el.querySelectorAll(".mo-cell")];
      const sbms = sbs.map(s => s.querySelector(".mo-sbm"));
      const plEls = [null, $("#mo-pl1"), $("#mo-pl2")];
      plEls[1].querySelector(".mo-nm").textContent = P1.pseudo;
      plEls[2].querySelector(".mo-nm").textContent = P2.pseudo;
      const cellRot = i => (((i * 37) % 11) - 5) * 1.4;

      // ---------- son (WebAudio, après un geste) ----------
      let ac = null;
      function unlock() {
        if (ac || dead) return;
        try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } catch (e) { ac = null; }
      }
      el.addEventListener("pointerdown", unlock);
      function chalk() {
        if (!ac) return;
        try {
          const t = ac.currentTime, len = 0.16, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 90));
          const src = ac.createBufferSource(); src.buffer = buf;
          const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600 + Math.random() * 1200; f.Q.value = 1.2;
          const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
          src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t); src.stop(t + len);
        } catch (e) { /* son facultatif */ }
      }
      function tones(freqs, step, type, vol) {
        if (!ac) return;
        try {
          freqs.forEach((fq, i) => {
            const t = ac.currentTime + i * step, o = ac.createOscillator(), g = ac.createGain();
            o.type = type || "triangle"; o.frequency.value = fq;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.4);
          });
        } catch (e) { /* son facultatif */ }
      }

      // ---------- logique (hôte) ----------
      let hs = null, finishTimer = 0;
      const seen = {};
      function hostEnd() {
        if (finishTimer) return;
        const s = hs;
        const [x, o] = counts(s.w);
        const w = s.r ? P[s.r] : null, l = s.r ? P[3 - s.r] : null;
        let res;
        if (!w) res = {winners: [], ranking: [P1.key, P2.key], summary: `Plus aucun coup possible : égalité ${x} grille${x > 1 ? "s" : ""} partout, match nul !`};
        else {
          const wc = s.r === 1 ? x : o, lc = s.r === 1 ? o : x;
          const summary = s.y === "ff" ? `${w.pseudo} gagne par forfait : ${l.pseudo} a lâché la craie.`
            : s.y === "line" ? `${w.pseudo} gagne en alignant trois grilles au tableau !`
            : `${w.pseudo} gagne aux points : ${wc} grille${wc > 1 ? "s" : ""} contre ${lc}.`;
          res = {winners: [w.key], ranking: [w.key, l.key], summary};
        }
        finishTimer = later(() => api.finish(res), 2500);
      }
      if (api.isHost) {
        hs = api.resume || newGame();                  // hôte rechargé : on repart du dernier état publié
        api.setState(hs);
        if (hs.o) hostEnd();
        api.onInputs(inputs => {
          if (!hs || hs.o) return;
          const turnKey = P[hs.t].key;
          for (const pl of [P1, P2]) {
            const inp = inputs[pl.key];
            if (!inp || inp.seq == null || inp.seq === seen[pl.key]) continue;
            seen[pl.key] = inp.seq;                       // toute entrée est consommée une seule fois
            if (pl.key !== turnKey) continue;             // hors tour : ignorée
            const ns = play(hs, +inp.b, +inp.c);
            if (!ns) continue;                            // coup illégal : ignoré
            hs = ns;
            api.setState(hs);
            if (hs.o) hostEnd();
            break;
          }
        });
        // Forfait : un joueur déjà vu qui quitte la partie.
        const seenSeat = {1: false, 2: false};
        let missSince = 0;
        const t0 = Date.now();
        const ffTimer = setInterval(() => {
          if (!hs || hs.o) return;
          let con;
          try { con = api.connected(); } catch (e) { return; }
          if (!con) return;
          const here = [1, 2].filter(s => con.includes(P[s].key));
          here.forEach(s => { seenSeat[s] = true; });
          if (here.length !== 1) { missSince = 0; return; }
          const gone = 3 - here[0], now = Date.now();
          if (!missSince) missSince = now;
          if (seenSeat[gone] ? now - missSince > 1500 : now - t0 > 12000) {
            hs = Object.assign({}, hs, {o: 1, r: here[0], y: "ff", L: null, n: hs.n + 1});
            api.setState(hs);
            api.toast(`${P[gone].pseudo} a quitté la partie : victoire par forfait !`);
            hostEnd();
          }
        }, 500);
        timers.add(ffTimer);
      }

      // ---------- affichage (tout le monde) ----------
      let cur = null, prevC = null, prevW = null, prevN = -1, mySeq = 0, pending = -1, pendTimer = 0, endShown = false;
      function render(s) {
        if (dead || !s || typeof s.c !== "string" || s.c.length !== 81) return;
        const first = prevC === null, anim = !first && !RM;
        cur = s;
        if (s.n !== prevN) { pending = -1; if (pendTimer) { clearTimeout(pendTimer); timers.delete(pendTimer); pendTimer = 0; } }
        let newMark = false, newWin = false;
        for (let i = 0; i < 81; i++) {
          const v = s.c[i];
          if (first || v !== prevC[i]) {
            cells[i].innerHTML = v === "0" ? "" : markSvg(v, "mo-mk" + (anim ? " mo-new" : ""), cellRot(i));
            if (!first && v !== "0") newMark = true;
          }
        }
        for (let b = 0; b < 9; b++) {
          const v = s.w[b];
          if (first || v !== prevW[b]) {
            sbms[b].innerHTML = v === "1" || v === "2" ? markSvg(v, anim ? "mo-new" : "", b % 2 ? 4 : -3) : "";
            if (!first && (v === "1" || v === "2")) newWin = true;
          }
        }
        prevC = s.c; prevW = s.w;
        const myTurn = !s.o && mySide === s.t;
        root.classList.toggle("mo-t2", s.t === 2);
        root.classList.toggle("mo-mine", myTurn && pending < 0);
        const n9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (let b = 0; b < 9; b++) {
          const open = s.w[b] === "0";
          const on = !s.o && open && (s.a === -1 || s.a === b);
          sbs[b].classList.toggle("mo-on", on);
          sbs[b].classList.toggle("mo-soft", on && s.a === -1);
          sbs[b].classList.toggle("mo-done", s.w[b] === "1" || s.w[b] === "2");
          sbs[b].classList.toggle("mo-full", s.w[b] === "3");
          for (const k of n9) {
            const i = b * 9 + k, free = on && s.c[i] === "0";
            const c = cells[i];
            c.classList.toggle("mo-free", free);
            c.classList.toggle("mo-last", i === s.l);
            c.classList.toggle("mo-pend", i === pending);
            c.disabled = !(myTurn && free);
          }
        }
        if (pending >= 0 && s.c[pending] === "0") cells[pending].innerHTML = markSvg(String(mySide), "mo-mk", cellRot(pending));
        const [x, o] = counts(s.w);
        [[1, x], [2, o]].forEach(([side, v]) => {
          const cnt = plEls[side].querySelector(".mo-cnt");
          cnt.innerHTML = `<i>${v}</i> grille${v > 1 ? "s" : ""}`;
          plEls[side].classList.toggle("mo-turn", !s.o && s.t === side);
          plEls[side].classList.toggle("mo-win", !!s.o && s.r === side);
        });
        // ligne gagnante de la grande grille
        if (s.L && !wlEl.firstChild) {
          const ctr = b => [50 + (b % 3) * 100, 50 + Math.floor(b / 3) * 100];
          const [ax, ay] = ctr(s.L[0]), [bx, by] = ctr(s.L[2]);
          const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ex = dx / len * 34, ey = dy / len * 34;
          sd = 99;
          const d = wob(ax - ex, ay - ey, bx + ex, by + ey, 5);
          wlEl.innerHTML = `<path class="mo-wls" pathLength="1" d="${d}"/><path pathLength="1" d="${d}"/>`;
        }
        // texte
        statusEl.classList.toggle("mo-me", myTurn);
        let txt;
        if (s.o) {
          const w = s.r ? P[s.r] : null;
          const [wc, lc] = s.r === 2 ? [o, x] : [x, o];
          if (s.y === "ff") txt = `${w.pseudo} gagne par forfait !`;
          else if (!w) txt = `Plus de coup possible : égalité ${x} à ${o}, match nul !`;
          else if (s.y === "line") txt = w.key === api.me ? "Trois grilles alignées : tu gagnes !" : `${w.pseudo} aligne trois grilles et gagne !`;
          else txt = `Plus de coup possible ! ${w.key === api.me ? "Tu gagnes" : w.pseudo + " gagne"} ${wc} à ${lc}`;
          if (!endShown) {
            endShown = true;
            if (w) { const av = plEls[s.r].querySelector(".mo-av"); av.innerHTML = api.avatar(w.key, {pose: "flex", view: "bust"}); }
            if (!first) later(() => tones(w && w.key === api.me ? [523, 659, 784, 1046] : w && mySide ? [392, 330, 262] : [440, 554, 659], 0.13), RM ? 0 : 900);
            $("#mo-help").innerHTML = w ? `${s.y === "ff" ? "Victoire par forfait." : `Score final : <b>${x}</b> grille${x > 1 ? "s" : ""} pour ${escapeHtml(P1.pseudo)}, <b>${o}</b> pour ${escapeHtml(P2.pseudo)}.`}` : "Le tableau est plein, personne ne l'emporte.";
          }
        } else if (myTurn) {
          txt = pending >= 0 ? "C'est noté…" : s.a === -1 ? (s.n === 0 ? "À toi de commencer, où tu veux !" : "À toi ! Joue où tu veux") : `À toi ! Grille ${POS[s.a]}`;
        } else {
          const nm = P[s.t].pseudo;
          txt = mySide ? `${nm} réfléchit…` : `Au tour de ${nm}`;
        }
        if (statusEl.textContent !== txt) {
          statusEl.textContent = txt;
          if (myTurn && !RM && !first) { statusEl.classList.remove("mo-bump"); void statusEl.offsetWidth; statusEl.classList.add("mo-bump"); }
        }
        if (newMark) chalk();
        if (newWin && !s.o) later(() => tones([660, 880], 0.1, "triangle", 0.1), RM ? 0 : 500);
        prevN = s.n;
      }
      function escapeHtml(t) { return String(t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[ch]); }
      api.onState(render);

      boardEl.addEventListener("click", e => {
        const btn = e.target.closest(".mo-cell");
        if (!btn || !cur || cur.o || pending >= 0) return;
        if (cur.t !== mySide) { if (mySide) api.toast(`Patience, c'est au tour de ${P[cur.t].pseudo}.`); return; }
        const i = +btn.dataset.i, b = Math.floor(i / 9), k = i % 9;
        if (!canPlay(cur, b, k)) {
          if (cur.a !== -1 && cur.a !== b) {
            const t = sbs[cur.a];
            t.classList.remove("mo-nope"); void t.offsetWidth; t.classList.add("mo-nope");
            api.toast(`Tu dois jouer dans la grille ${POS[cur.a]} !`);
            tones([150], 0, "sine", 0.1);
          }
          return;
        }
        pending = i;
        api.setInput({seq: ++mySeq, b, c: k});
        chalk();
        render(Object.assign({}, cur));   // fantôme en attendant l'hôte
        pendTimer = later(() => { pendTimer = 0; if (pending === i) { pending = -1; cells[i].innerHTML = cur.c[i] === "0" ? "" : cells[i].innerHTML; render(Object.assign({}, cur)); } }, 2500);
      });
      // la saisie « fantôme » ne doit pas ré-animer : render compare avec prevC, qui ne change pas

      return {
        destroy() {
          dead = true;
          timers.forEach(id => { clearTimeout(id); clearInterval(id); });
          timers.clear();
          el.removeEventListener("pointerdown", unlock);
          if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
          el.innerHTML = "";
        }
      };
    }
  });
})();
