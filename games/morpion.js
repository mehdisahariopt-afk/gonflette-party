/* Gonflette Party : Morpion à la craie, 2 joueurs, chacun sur son téléphone.
   Une seule grille 3×3, au meilleur des 3 manches : le premier à 2 manches gagnées remporte la partie.
   Manche nulle (grille pleine) : elle ne compte pas, on rejoue. Au plus 5 manches : ensuite, le plus de manches
   gagnées l'emporte (sinon match nul). Le perdant de la manche commence la suivante (après un nul : l'autre).
   P1 a toujours les ✕, P2 les ○.

   État publié par l'hôte (compact, ~150 octets) :
     R : numéro de manche (1..5)            c : 9 caractères "0"/"1"/"2" (case k ligne par ligne)
     t : siège au trait (1/2)               st : siège qui a commencé la manche
     l : dernière case jouée ou -1          n : nombre de coups dans la manche
     w : [manches de P1, manches de P2]     h : historique des manches ("1", "2" ou "d" pour nulle)
     o : 0 en jeu, 1 manche finie (pause), 2 partie finie
     rw : vainqueur de la manche (0 = nulle)   L : ligne gagnante de la manche ou null
     m : vainqueur de la partie (0 = nul)      y : "ff" si forfait
   Entrées des joueurs : {seq, R, c}. */
(function () {
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const WIN = 2, MAXR = 5;

  // ---------- règles pures (testables hors navigateur) ----------
  function lineOf(c, p) {
    for (const L of LINES) if (c[L[0]] === p && c[L[1]] === p && c[L[2]] === p) return L.slice();
    return null;
  }
  function newGame() {
    return {R: 1, c: "000000000", t: 1, st: 1, l: -1, n: 0, w: [0, 0], h: "", o: 0, rw: 0, L: null, m: 0, y: ""};
  }
  function canPlay(s, k) {
    return !!s && !s.o && (k | 0) === k && k >= 0 && k < 9 && s.c[k] === "0";
  }
  // Joue la case k pour le joueur au trait. Renvoie le nouvel état, ou null si le coup est illégal.
  function play(s, k) {
    if (!canPlay(s, k)) return null;
    const p = String(s.t), c = s.c.split("");
    c[k] = p;
    const ns = Object.assign({}, s, {c: c.join(""), l: k, n: s.n + 1, w: s.w.slice()});
    const L = lineOf(c, p);
    if (L) { ns.o = 1; ns.rw = s.t; ns.L = L; ns.w[s.t - 1]++; ns.h = s.h + p; }
    else if (!c.includes("0")) { ns.o = 1; ns.rw = 0; ns.h = s.h + "d"; }
    else { ns.t = 3 - s.t; return ns; }
    if (ns.w[0] >= WIN || ns.w[1] >= WIN) { ns.o = 2; ns.m = ns.w[0] >= WIN ? 1 : 2; }
    else if (ns.R >= MAXR) { ns.o = 2; ns.m = ns.w[0] > ns.w[1] ? 1 : ns.w[1] > ns.w[0] ? 2 : 0; }
    return ns;
  }
  // Manche suivante : le perdant commence (après une nulle, celui qui n'avait pas commencé).
  function nextRound(s) {
    if (!s || s.o !== 1) return s;
    const st = s.rw ? 3 - s.rw : 3 - s.st;
    return {R: s.R + 1, c: "000000000", t: st, st, l: -1, n: 0, w: s.w.slice(), h: s.h, o: 0, rw: 0, L: null, m: 0, y: ""};
  }
  const RULES = {LINES, WIN, MAXR, newGame, canPlay, play, nextRound, lineOf};

  GONFLETTE.registerGame({
    id: "morpion",
    name: "Morpion",
    min: 2,
    max: 2,
    resumable: true,                              // l'hôte rechargé repart de api.resume
    rules: RULES,
    create(api) {
      const [P1, P2] = api.players;               // P1 = ✕, P2 = ○
      const P = [null, P1, P2];
      const el = api.el;
      const mySide = api.me === P1.key ? 1 : api.me === P2.key ? 2 : 0;
      const RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const POS = ["en haut à gauche", "en haut au milieu", "en haut à droite", "au milieu à gauche", "au centre",
        "au milieu à droite", "en bas à gauche", "en bas au milieu", "en bas à droite"];
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
      const sfx = n => { try { if (api.sfx) api.sfx(n); } catch (e) { /* facultatif */ } };
      const haptic = n => { try { if (api.haptic) api.haptic(n); } catch (e) { /* facultatif */ } };
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

      // lignes de la grille (viewBox 300)
      let gridLines = "";
      for (const x of [100, 200]) gridLines += `<path d="${wob(x, 8, x, 292, 3)}"/><path d="${wob(8, x, 292, x, 3)}"/>`;
      let cellsHtml = "";
      for (let k = 0; k < 9; k++) cellsHtml += `<button type="button" class="mo-cell" data-i="${k}" aria-label="Case ${POS[k]}"></button>`;
      const pips = () => `<span class="mo-pips" aria-label="Manches gagnées">${"<i></i>".repeat(WIN)}</span>`;
      const card = (pl, side) => `<div class="mo-pl" id="mo-pl${side}">
          <div class="mo-av">${api.avatar(pl.key, {view: "bust"})}</div>
          <div class="mo-inf"><b class="mo-nm"></b>
            <span class="mo-row">${markSvg(String(side), "mo-sym", side === 1 ? -4 : 3)}${pips()}</span></div>
        </div>`;

      el.innerHTML = `<style>
        .mo{--x:#ff9fc8;--o:#8fdcff;--chalk:#eef0e6;--glow:var(--x);position:relative;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 12px 0;color:var(--chalk);font-family:"Barlow Condensed",system-ui,sans-serif;overflow:hidden;
          background:radial-gradient(ellipse 60% 30% at 18% 12%,rgba(255,255,255,.07),transparent 70%),radial-gradient(ellipse 50% 25% at 85% 62%,rgba(255,255,255,.05),transparent 70%),radial-gradient(ellipse 40% 18% at 30% 88%,rgba(255,255,255,.04),transparent 70%),radial-gradient(120% 90% at 50% 40%,#2a5040,#1a3328 75%,#122219);-webkit-tap-highlight-color:transparent}
        .mo.mo-t2{--glow:var(--o)}
        .mo *{box-sizing:border-box}
        .mo-defs{position:absolute;width:0;height:0}
        .mo-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;width:min(100%,560px)}
        .mo-rd{display:grid;justify-items:center;line-height:1;transform:rotate(-4deg);min-width:40px}
        .mo-rd small{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
        .mo-rd b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.9rem}
        .mo-pl{position:relative;display:flex;align-items:center;gap:6px;min-width:0;padding:4px 6px 4px 4px;border-radius:14px;border:2px dashed rgba(238,240,230,.22);opacity:.62;transition:opacity .3s,border-color .3s,transform .3s,box-shadow .3s}
        #mo-pl2{flex-direction:row-reverse;text-align:right;padding:4px 4px 4px 6px}
        #mo-pl2 .mo-row{flex-direction:row-reverse}
        .mo-pl.mo-turn{opacity:1;transform:translateY(-1px);border-style:solid}
        #mo-pl1.mo-turn{border-color:var(--x);box-shadow:0 0 14px rgba(255,159,200,.35)}
        #mo-pl2.mo-turn{border-color:var(--o);box-shadow:0 0 14px rgba(143,220,255,.35)}
        .mo-pl.mo-win{opacity:1;border-style:solid;border-color:#ffe98a;box-shadow:0 0 20px rgba(255,233,138,.45)}
        .mo-av{flex:none;width:52px;height:52px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.18),rgba(255,255,255,.03));border:2px solid rgba(238,240,230,.35)}
        .mo-av .av,.mo-av svg{width:100%;height:100%;display:block}
        .mo-inf{min-width:0;display:grid;gap:2px}
        .mo-nm{font-weight:800;font-size:1.12rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mo-row{display:flex;align-items:center;gap:6px}
        .mo-sym{width:26px;height:26px;flex:none}
        .mo-pips{display:flex;gap:5px}
        #mo-pl2 .mo-pips{flex-direction:row-reverse}
        .mo-pips i{width:17px;height:17px;border-radius:50%;border:2px solid rgba(238,240,230,.5);transition:background-color .3s,border-color .3s}
        #mo-pl1 .mo-pips i.on{background:var(--x);border-color:var(--x);box-shadow:0 0 8px rgba(255,159,200,.6)}
        #mo-pl2 .mo-pips i.on{background:var(--o);border-color:var(--o);box-shadow:0 0 8px rgba(143,220,255,.6)}
        .mo-pips i.pop{animation:mo-pip .6s 1s both}
        .mo-status{font-family:Pacifico,"Brush Script MT",cursive;font-size:1.2rem;line-height:1.35;text-align:center;min-height:2.7em;display:flex;align-items:center;justify-content:center;padding:0 6px;text-shadow:0 0 6px rgba(255,255,255,.18);width:min(100%,560px)}
        .mo-status.mo-me{color:#fff6c2}
        .mo-status.mo-bump{animation:mo-bump .4s}
        .mo-board{position:relative;flex:none;width:min(100%,540px,max(270px,calc(100dvh - 330px)));aspect-ratio:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:0;padding:0}
        .mo-gl,.mo-wl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
        .mo-wl{z-index:3}
        .mo-gl path{fill:none;stroke:var(--chalk);stroke-width:5;stroke-linecap:round;opacity:.85;filter:url(#mo-chalk)}
        .mo-cell{position:relative;z-index:1;display:block;width:auto;height:auto;min-width:0;min-height:0;margin:4%;padding:0;border:0;border-radius:12px;background:none;color:inherit;cursor:default;touch-action:manipulation;transition:opacity .3s,background-color .15s}
        .mo-cell .mo-mk{position:absolute;left:10%;top:10%;width:80%;height:80%;display:block;overflow:visible}
        .mo-mine .mo-cell.mo-free{cursor:pointer}
        .mo-mine .mo-cell.mo-free:active{background:color-mix(in srgb,var(--glow) 25%,transparent)}
        @media (hover:hover){.mo-mine .mo-cell.mo-free:hover{background:color-mix(in srgb,var(--glow) 16%,transparent)}}
        .mo-mine .mo-cell.mo-free::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:var(--glow);opacity:.18;animation:mo-dot 1.6s ease-in-out infinite}
        .mo-cell.mo-last{background:rgba(255,255,255,.08)}
        .mo-cell.mo-pend .mo-mk{opacity:.45}
        .mo-over .mo-cell .mo-mk{opacity:.42;transition:opacity .4s .6s}
        .mo-over .mo-cell.mo-in .mo-mk{opacity:1}
        .mo-st{fill:none;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;stroke-dashoffset:0;filter:url(#mo-chalk)}
        .mo-p1 .mo-st{stroke:var(--x)}
        .mo-p2 .mo-st{stroke:var(--o)}
        .mo-new .mo-st{animation:mo-draw .3s ease-out both}
        .mo-new .mo-st2{animation-delay:.2s}
        .mo-p2.mo-new .mo-st{animation-duration:.45s}
        .mo-mk.mo-erase{animation:mo-erase .5s ease-in both}
        .mo-wl path{fill:none;stroke:#fff3a8;stroke-width:13;stroke-linecap:round;stroke-dasharray:1 2;filter:url(#mo-chalk);animation:mo-draw .6s .35s ease-out both}
        .mo-wl .mo-wls{stroke:rgba(10,25,18,.35);stroke-width:19;filter:none}
        .mo-sponge{position:absolute;z-index:4;top:-2%;left:-30%;width:30%;height:104%;pointer-events:none;opacity:0;background:linear-gradient(90deg,transparent,rgba(238,240,230,.14) 45%,rgba(238,240,230,.06))}
        .mo-sponge::before{content:"";position:absolute;right:0;top:50%;width:42px;height:96px;margin-top:-48px;border-radius:6px;background:linear-gradient(90deg,#3b3b46 0 42%,#c9b38a 42%);box-shadow:0 6px 14px rgba(0,0,0,.4)}
        .mo-wipe .mo-sponge{animation:mo-sponge .55s ease-in-out both}
        .mo-ban{position:absolute;z-index:5;left:50%;top:50%;min-width:62%;max-width:92%;padding:10px 16px 12px;border-radius:14px;text-align:center;pointer-events:none;
          background:rgba(18,34,25,.92);border:3px solid var(--chalk);box-shadow:0 10px 30px rgba(0,0,0,.45);transform:translate(-50%,-50%) rotate(-3deg);opacity:0;visibility:hidden}
        .mo-ban.on{visibility:visible;animation:mo-ban .45s var(--bd,1s) cubic-bezier(.3,1.5,.6,1) both}
        .mo-ban.c1{border-color:var(--x)}.mo-ban.c2{border-color:var(--o)}.mo-ban.fin{border-color:#ffe98a}
        .mo-ban b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.5rem,7vw,2.2rem);line-height:1.1;letter-spacing:.02em;text-transform:uppercase}
        .mo-ban small{display:block;margin-top:4px;font-family:Pacifico,"Brush Script MT",cursive;font-size:1.05rem;line-height:1.3;opacity:.92}
        .mo-ban.c1 b{color:var(--x)}.mo-ban.c2 b{color:var(--o)}.mo-ban.fin b{color:#ffe98a}
        .mo-foot{width:min(100%,560px);display:grid;justify-items:center;gap:6px;padding:2px 8px 0}
        .mo-hist{display:flex;gap:6px;align-items:center;min-height:30px}
        .mo-hist span{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;border:2px dashed rgba(238,240,230,.3);font-weight:800;font-size:.8rem;opacity:.9}
        .mo-hist span svg{width:22px;height:22px}
        .mo-hist span.cur{border-style:solid;border-color:rgba(238,240,230,.75)}
        .mo-hist span.nul{font-family:Pacifico,cursive;font-weight:400;font-size:.7rem;opacity:.6}
        .mo-help{text-align:center;font-size:1rem;line-height:1.25;opacity:.72}
        .mo-help b{color:#fff6c2;font-weight:800}
        .mo-help span{display:inline-block}
        .mo-sp{flex:1}.mo-sp0{flex:.5}
        .mo-ledge{position:relative;width:calc(100% + 24px);height:26px;margin-top:6px;background:linear-gradient(#8a5a2b,#6b421c 55%,#4d2e12);box-shadow:0 -3px 6px rgba(0,0,0,.35)}
        .mo-ledge i{position:absolute;bottom:13px;height:8px;border-radius:4px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.15)}
        .mo-ledge i:nth-child(1){left:14%;width:46px;background:var(--chalk);transform:rotate(-3deg)}
        .mo-ledge i:nth-child(2){left:31%;width:30px;background:var(--x);transform:rotate(4deg)}
        .mo-ledge i:nth-child(3){left:44%;width:38px;background:var(--o)}
        .mo-ledge i:nth-child(4){left:70%;width:64px;height:16px;bottom:12px;border-radius:3px;background:linear-gradient(#3b3b46 0 45%,#c9b38a 45%);transform:rotate(-2deg)}
        .mo-wipe ~ .mo-ledge i:nth-child(4){visibility:hidden}
        @keyframes mo-draw{from{stroke-dashoffset:1;opacity:0}6%{opacity:1}to{stroke-dashoffset:0;opacity:1}}
        @keyframes mo-erase{to{opacity:0;filter:blur(4px);transform:scale(1.08)}}
        @keyframes mo-sponge{0%{left:-30%;opacity:1;transform:rotate(-8deg)}50%{transform:rotate(6deg)}100%{left:104%;opacity:1;transform:rotate(-4deg)}}
        @keyframes mo-ban{from{opacity:0;transform:translate(-50%,-50%) rotate(-3deg) scale(1.8)}to{opacity:1;transform:translate(-50%,-50%) rotate(-3deg) scale(1)}}
        @keyframes mo-pip{0%{transform:scale(1)}40%{transform:scale(1.7)}100%{transform:scale(1)}}
        @keyframes mo-dot{50%{transform:scale(1.5);opacity:.3}}
        @keyframes mo-bump{40%{transform:scale(1.06)}}
        @media (prefers-reduced-motion:reduce){.mo *{animation:none!important;transition:none!important}.mo-ban.on{opacity:1}}
        @media (min-width:700px){.mo-av{width:64px;height:64px}.mo-status{font-size:1.4rem}}
        @media (max-width:370px){.mo-av{width:44px;height:44px}.mo-nm{font-size:1rem}.mo-pips i{width:15px;height:15px}.mo-sym{width:22px;height:22px}}
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
        <div class="mo-head">${card(P1, 1)}<div class="mo-rd"><small>Manche</small><b id="mo-rn">1</b></div>${card(P2, 2)}</div>
        <div class="mo-status" id="mo-status" role="status" aria-live="polite">Craie en main…</div>
        <div class="mo-board" id="mo-board">
          <svg class="mo-gl" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">${gridLines}</svg>
          ${cellsHtml}
          <svg class="mo-wl" id="mo-wl" viewBox="0 0 300 300" aria-hidden="true"></svg>
          <div class="mo-sponge" aria-hidden="true"></div>
          <div class="mo-ban" id="mo-ban" aria-hidden="true"><b></b><small></small></div>
        </div>
        <div class="mo-foot">
          <div class="mo-hist" id="mo-hist" aria-label="Manches jouées"></div>
          <div class="mo-help" id="mo-help"><span><b>3 alignés</b> = la manche.</span> <span><b>2 manches</b> = la victoire !</span></div>
        </div>
        <div class="mo-sp"></div>
        <div class="mo-ledge" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </div>`;

      const $ = s => el.querySelector(s);
      const root = $("#mo-root"), boardEl = $("#mo-board"), statusEl = $("#mo-status"), wlEl = $("#mo-wl");
      const banEl = $("#mo-ban"), histEl = $("#mo-hist"), rnEl = $("#mo-rn"), helpEl = $("#mo-help");
      const cells = [...el.querySelectorAll(".mo-cell")];
      const plEls = [null, $("#mo-pl1"), $("#mo-pl2")];
      plEls[1].querySelector(".mo-nm").textContent = P1.pseudo;
      plEls[2].querySelector(".mo-nm").textContent = P2.pseudo;
      const cellRot = i => (((i * 37 + 5) % 11) - 5) * 1.6;

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
      const ROUND_PAUSE = 3200, END_PAUSE = 3000;
      let hs = null, finishTimer = 0, nextTimer = 0;
      const seen = {};
      const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
      function hostEnd() {
        if (finishTimer) return;
        const s = hs, [a, b] = s.w;
        const w = s.m ? P[s.m] : null, l = s.m ? P[3 - s.m] : null;
        let res;
        if (!w) res = {winners: [], ranking: [P1.key, P2.key], summary: `${plural(a, "manche")} partout après ${s.R} manches : match nul !`};
        else {
          const wc = s.w[s.m - 1], lc = s.w[2 - s.m];
          const summary = s.y === "ff" ? `${w.pseudo} gagne par forfait : ${l.pseudo} a lâché la craie.`
            : `${w.pseudo} gagne le morpion ${wc} manche${wc > 1 ? "s" : ""} à ${lc} !`;
          res = {winners: [w.key], ranking: [w.key, l.key], summary};
        }
        finishTimer = later(() => api.finish(res), END_PAUSE);
      }
      function hostAfter() {
        if (hs.o === 2) hostEnd();
        else if (hs.o === 1 && !nextTimer) {
          nextTimer = later(() => { nextTimer = 0; if (hs.o !== 1) return; hs = nextRound(hs); api.setState(hs); }, ROUND_PAUSE);
        }
      }
      if (api.isHost) {
        const r0 = api.resume;
        hs = r0 && typeof r0.c === "string" && r0.c.length === 9 && Array.isArray(r0.w) ? r0 : newGame();   // hôte rechargé : on repart du dernier état publié
        api.setState(hs);
        hostAfter();
        api.onInputs(inputs => {
          if (!hs || hs.o) return;
          const turnKey = P[hs.t].key;
          for (const pl of [P1, P2]) {
            const inp = inputs[pl.key];
            if (!inp || inp.seq == null || inp.seq === seen[pl.key]) continue;
            seen[pl.key] = inp.seq;                       // toute entrée est consommée une seule fois
            if (pl.key !== turnKey || +inp.R !== hs.R) continue;   // hors tour ou manche passée : ignorée
            const ns = play(hs, +inp.c);
            if (!ns) continue;                            // coup illégal : ignoré
            hs = ns;
            api.setState(hs);
            hostAfter();
            break;
          }
        });
        // Forfait : un joueur déjà vu qui quitte la partie.
        const seenSeat = {1: false, 2: false};
        let missSince = 0;
        const t0 = Date.now();
        const ffTimer = setInterval(() => {
          if (!hs || hs.o === 2) return;
          let con;
          try { con = api.connected(); } catch (e) { return; }
          if (!con) return;
          const here = [1, 2].filter(s => con.includes(P[s].key));
          here.forEach(s => { seenSeat[s] = true; });
          if (here.length !== 1) { missSince = 0; return; }
          const gone = 3 - here[0], now = Date.now();
          if (!missSince) missSince = now;
          if (seenSeat[gone] ? now - missSince > 1500 : now - t0 > 12000) {
            hs = Object.assign({}, hs, {o: 2, m: here[0], y: "ff"});
            api.setState(hs);
            api.toast(`${P[gone].pseudo} a quitté la partie : victoire par forfait !`);
            hostEnd();
          }
        }, 500);
        timers.add(ffTimer);
      }

      // ---------- affichage (tout le monde) ----------
      let cur = null, prevC = null, prevR = 0, prevN = -1, prevO = -1, mySeq = 0, pending = -1, pendTimer = 0, wiping = false;
      const EMPTY = "000000000";
      function drawLine(L, animate) {
        const ctr = k => [50 + (k % 3) * 100, 50 + Math.floor(k / 3) * 100];
        const [ax, ay] = ctr(L[0]), [bx, by] = ctr(L[2]);
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ex = dx / len * 38, ey = dy / len * 38;
        sd = 99 + L[0] * 7 + L[2];
        const d = wob(ax - ex, ay - ey, bx + ex, by + ey, 5);
        wlEl.innerHTML = `<path class="mo-wls" pathLength="1" d="${d}"/><path pathLength="1" d="${d}"${animate ? "" : ' style="animation:none"'}/>`;
      }
      function showBanner(s, animate) {
        const w = s.o === 2 ? s.m : s.rw;
        let big, small, cls;
        if (s.o === 2) {
          cls = "fin";
          if (s.y === "ff") { big = `${P[s.m].pseudo} gagne !`; small = "par forfait"; }
          else if (!w) { big = "Match nul !"; small = `${plural(s.w[0], "manche")} partout`; }
          else { big = w === mySide ? "Tu gagnes !" : `${P[w].pseudo} gagne !`; small = `${s.w[w - 1]} manche${s.w[w - 1] > 1 ? "s" : ""} à ${s.w[2 - w]}`; }
        } else if (!w) { cls = ""; big = "Manche nulle"; small = "Elle ne compte pas : on rejoue !"; }
        else {
          cls = "c" + w;
          big = w === mySide ? "Manche pour toi !" : `Manche pour ${P[w].pseudo}`;
          small = `${s.w[0]} – ${s.w[1]} · prochaine manche…`;
        }
        banEl.className = "mo-ban on " + cls;
        banEl.style.setProperty("--bd", animate ? (s.L ? "1s" : ".35s") : "0s");
        banEl.querySelector("b").textContent = big;
        banEl.querySelector("small").textContent = small;
        banEl.style.animation = animate ? "" : "none";
        banEl.style.opacity = animate ? "" : "1";
      }
      function hideBanner() { banEl.className = "mo-ban"; banEl.style.animation = ""; banEl.style.opacity = ""; }
      function renderHist(s) {
        let html = "";
        for (let i = 0; i < s.h.length; i++) {
          const ch = s.h[i];
          html += ch === "d" ? `<span class="nul" title="Manche ${i + 1} : nulle">nul</span>` : `<span title="Manche ${i + 1} : ${esc(P[+ch].pseudo)}">${markSvg(ch, "", 0)}</span>`;
        }
        if (!s.o) html += `<span class="cur" title="Manche en cours">${s.R}</span>`;
        histEl.innerHTML = html;
      }
      function esc(t) { return String(t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[ch]); }

      function render(s) {
        if (dead || !s || typeof s.c !== "string" || s.c.length !== 9 || !Array.isArray(s.w)) return;
        const first = prevC === null, anim = !first && !RM;
        const newRound = !first && s.R !== prevR;
        cur = s;
        if (s.n !== prevN || newRound) { pending = -1; if (pendTimer) { clearTimeout(pendTimer); timers.delete(pendTimer); pendTimer = 0; } }
        // nouvelle manche : coup d'éponge sur le tableau
        if (newRound) {
          hideBanner();
          wlEl.innerHTML = "";
          if (anim) {
            wiping = true;
            cells.forEach(c => { const m = c.querySelector(".mo-mk"); if (m) m.classList.add("mo-erase"); });
            boardEl.classList.remove("mo-wipe"); void boardEl.offsetWidth; boardEl.classList.add("mo-wipe");
            sfx("whoosh");
            later(() => { wiping = false; boardEl.classList.remove("mo-wipe"); cells.forEach(c => { c.innerHTML = ""; }); prevC = EMPTY; render(cur); }, 520);
          } else { cells.forEach(c => { c.innerHTML = ""; }); prevC = EMPTY; }
        }
        let newMark = false;
        if (!wiping) {
          for (let i = 0; i < 9; i++) {
            const v = s.c[i];
            if (first || v !== prevC[i]) {
              cells[i].innerHTML = v === "0" ? "" : markSvg(v, "mo-mk" + (anim ? " mo-new" : ""), cellRot(i));
              if (!first && v !== "0") newMark = true;
            }
          }
          prevC = s.c;
        }
        const myTurn = !s.o && mySide === s.t && !wiping;
        root.classList.toggle("mo-t2", s.t === 2);
        root.classList.toggle("mo-mine", myTurn && pending < 0);
        boardEl.classList.toggle("mo-over", !!s.o && !!s.L);
        for (let i = 0; i < 9; i++) {
          const c = cells[i], free = !s.o && s.c[i] === "0";
          c.classList.toggle("mo-free", free);
          c.classList.toggle("mo-last", !s.o && i === s.l);
          c.classList.toggle("mo-pend", i === pending);
          c.classList.toggle("mo-in", !!s.L && s.L.includes(i));
          c.disabled = !(myTurn && free);
          c.setAttribute("aria-label", `Case ${POS[i]}${s.c[i] === "1" ? " : ✕" : s.c[i] === "2" ? " : ○" : ""}`);
        }
        if (pending >= 0 && s.c[pending] === "0" && !wiping) cells[pending].innerHTML = markSvg(String(mySide), "mo-mk", cellRot(pending));
        // manches gagnées
        [1, 2].forEach(side => {
          const won = s.w[side - 1];
          plEls[side].querySelectorAll(".mo-pips i").forEach((pip, i) => {
            const on = i < won;
            if (on && !pip.classList.contains("on") && anim) { pip.classList.remove("pop"); void pip.offsetWidth; pip.classList.add("pop"); }
            pip.classList.toggle("on", on);
          });
          plEls[side].classList.toggle("mo-turn", !s.o && s.t === side);
          plEls[side].classList.toggle("mo-win", s.o === 2 && s.m === side);
        });
        rnEl.textContent = s.R;
        renderHist(s);
        // fin de manche / de partie
        if (s.o && s.o !== prevO) {
          if (s.L) drawLine(s.L, anim);
          showBanner(s, anim);
          if (s.o === 2 && s.m) { const av = plEls[s.m].querySelector(".mo-av"); av.innerHTML = api.avatar(P[s.m].key, {pose: "flex", view: "bust"}); }
          if (!first) {
            const w = s.o === 2 ? s.m : s.rw;
            later(() => {
              if (s.o === 2) {
                tones(w && w === mySide ? [523, 659, 784, 1046] : w && mySide ? [392, 330, 262] : [440, 554, 659], 0.13);
              } else if (w) {
                tones(w === mySide ? [660, 880] : mySide ? [330, 262] : [660, 880], 0.1, "triangle", 0.11);
                if (mySide) haptic(w === mySide ? "success" : "fail");
              } else tones([440, 440], 0.12, "sine", 0.08);
            }, RM ? 0 : (s.L ? 900 : 300));
          }
          if (s.o === 2) {
            helpEl.innerHTML = s.y === "ff" ? "Victoire par forfait."
              : s.m ? `Score final : <b>${s.w[0]}</b> manche${s.w[0] > 1 ? "s" : ""} pour ${esc(P1.pseudo)}, <b>${s.w[1]}</b> pour ${esc(P2.pseudo)}.`
              : `Après ${s.R} manches, personne ne l'emporte.`;
          }
        }
        if (!s.o && prevO > 0) hideBanner();
        if (!s.o && !s.L && wlEl.firstChild && !newRound) wlEl.innerHTML = "";
        // texte
        statusEl.classList.toggle("mo-me", myTurn);
        let txt;
        if (s.o === 2) {
          const w = s.m ? P[s.m] : null;
          if (s.y === "ff") txt = `${w.pseudo} gagne par forfait !`;
          else if (!w) txt = "Match nul ! Personne ne lâche rien.";
          else txt = w.key === api.me ? "Bravo, tu remportes le match !" : `${w.pseudo} remporte le match !`;
        } else if (s.o === 1) {
          const w = s.rw ? P[s.rw] : null;
          txt = !w ? "Grille pleine : manche nulle, on rejoue !" : w.key === api.me ? "Trois alignés : manche pour toi !" : `${w.pseudo} aligne trois et prend la manche !`;
        } else if (myTurn) {
          txt = pending >= 0 ? "C'est noté…" : s.n === 0 ? (s.R === 1 ? "À toi de commencer !" : `Manche ${s.R} : à toi de commencer !`) : "À toi de jouer !";
        } else {
          const nm = P[s.t].pseudo;
          txt = s.n === 0 ? `Manche ${s.R} : ${nm} commence` : mySide ? `${nm} réfléchit…` : `Au tour de ${nm}`;
        }
        if (statusEl.textContent !== txt) {
          statusEl.textContent = txt;
          if (myTurn && !RM && !first) { statusEl.classList.remove("mo-bump"); void statusEl.offsetWidth; statusEl.classList.add("mo-bump"); }
        }
        if (newMark) chalk();
        prevN = s.n; prevR = s.R; prevO = s.o;
      }
      api.onState(render);

      boardEl.addEventListener("click", e => {
        const btn = e.target.closest(".mo-cell");
        if (!btn || !cur || cur.o || pending >= 0 || wiping) return;
        if (cur.t !== mySide) { if (mySide) api.toast(`Patience, c'est au tour de ${P[cur.t].pseudo}.`); return; }
        const k = +btn.dataset.i;
        if (!canPlay(cur, k)) return;
        pending = k;
        api.setInput({seq: ++mySeq, R: cur.R, c: k});
        chalk();
        haptic("light");
        render(Object.assign({}, cur));   // fantôme en attendant l'hôte
        pendTimer = later(() => {
          pendTimer = 0;
          if (pending === k) { pending = -1; if (cur.c[k] === "0") cells[k].innerHTML = ""; render(Object.assign({}, cur)); }
        }, 2500);
      });

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
