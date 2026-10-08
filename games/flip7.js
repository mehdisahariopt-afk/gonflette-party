/* Gonflette Party : Flip 7 en réseau (2 à 8 joueurs, chacun sur son téléphone).
   L'hôte fait tourner tout le moteur (pioche, défausse, résolution des cartes) ; la pioche reste
   dans sa mémoire. L'état publié est compact : cartes de la manche, totaux, statuts, choix en attente.
   Fin de partie : un joueur atteint 200 en fin de manche (meneur unique), ou après 6 manches. */
GONFLETTE.registerGame({
  id: "flip7",
  name: "Flip 7",
  min: 2,
  max: 8,
  create(api) {
    const el = api.el, P = api.players, N = P.length;
    const GOAL = 200, MAXR = 6;
    const SPEED = typeof window.__f7speed === "number" ? window.__f7speed : 1;
    const seatOf = k => P.findIndex(p => p.key === k);
    const mySeat = api.isPlayer ? seatOf(api.me) : -1;
    const clean = s => String(s).replace(/\*/g, "");
    const esc = t => String(t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };

    const ACT = {
      F: {label: "Gel", cls: "freeze", svg: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M20 3v34M5 11.5l30 17M5 28.5l30-17"/><path d="M15 6l5 4 5-4M15 34l5-4 5 4M6 17.5l6.5-1-2.2-6M33.7 22.5l-6.5 1 2.2 6M6 22.5l6.5 1-2.2 6M33.7 17.5l-6.5-1 2.2-6"/></svg>'},
      T: {label: "Pioche 3", cls: "flip3", svg: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M33 14A15 15 0 0 0 8 10M7 26a15 15 0 0 0 25 4"/><path d="M8 4v6h6M32 36v-6h-6"/><text x="20" y="27" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="17" fill="currentColor" stroke="none">3</text></svg>'},
      S: {label: "Seconde chance", cls: "second", svg: '<svg viewBox="0 0 40 40"><path d="M20 35S4 25 4 14a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 11-16 21-16 21z" fill="currentColor"/><path d="M14 18h12M20 12v12" stroke="#e3ffef" stroke-width="3.4" stroke-linecap="round"/></svg>'}
    };
    const NCOL = ["#8b8794", "#b08d14", "#3f9e48", "#d6407e", "#178f87", "#3561c9", "#d23a2f", "#7a3fd0", "#6f9c12", "#e0700f", "#c2185b", "#1f7fb8", "#4a3f57"];

    /* ================= Interface ================= */
    el.innerHTML = `<style>
      .f7{--gold:#ffcf3f;--pink:#ff4f8b;--ice:#7fd8ff;--mint:#4be0a0;--paper:#fff6e3;--ink:#1d0b26;--text:#fbefff;--dim:#c3a9d1;--panel:rgba(55,18,76,.78);--line:rgba(255,207,63,.28);
        position:relative;min-height:100%;overflow:hidden;background:#240a33;color:var(--text);font-family:"Barlow Condensed",system-ui,sans-serif;font-size:17px;line-height:1.2;
        display:flex;flex-direction:column;gap:10px;padding:10px 12px 0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      .f7 *{box-sizing:border-box}
      .f7-rays{position:absolute;left:50%;top:150px;width:1400px;height:1400px;margin:-700px 0 0 -700px;pointer-events:none;z-index:0;
        background:repeating-conic-gradient(from 0deg,#2f0f44 0 7.5deg,#240a33 7.5deg 15deg);animation:f7spin 160s linear infinite;
        -webkit-mask:radial-gradient(circle,#000 0 12%,transparent 42%);mask:radial-gradient(circle,#000 0 12%,transparent 42%)}
      .f7>*:not(.f7-rays):not(.f7-ov):not(.f7-banner){position:relative;z-index:1}
      .f7-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .f7-logo{font-family:Anton,Impact,sans-serif;font-size:1.7rem;line-height:1;color:var(--gold);text-shadow:0 3px 0 #b5370f,0 5px 14px rgba(255,80,40,.4);letter-spacing:.02em;display:flex;align-items:center}
      .f7-logo i{font-style:normal;display:inline-grid;place-items:center;width:1.05em;height:1.4em;margin-left:.22em;border-radius:.16em;background:var(--paper);color:#7a3fd0;text-shadow:none;transform:rotate(8deg);box-shadow:0 4px 0 rgba(0,0,0,.25),0 0 0 3px var(--gold);font-size:.9em}
      .f7-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .f7-chip{font-weight:800;font-size:.9rem;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1.5px solid var(--line);white-space:nowrap}
      .f7-chip b{font-family:Anton,Impact,sans-serif;font-weight:400;color:var(--gold);letter-spacing:.02em}
      /* scène */
      .f7-stage{border-radius:22px;padding:14px 12px;background:radial-gradient(120% 90% at 30% 0%,#5a1a6e,#3a0f4d 55%,#2b0b3b);border:2px solid rgba(255,207,63,.45);
        display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center}
      .f7-bulb{position:absolute;width:7px;height:7px;border-radius:50%;background:#ffe9a6;box-shadow:0 0 7px 2px rgba(255,207,63,.7);transform:translate(-50%,-50%);animation:f7bulb 1.2s steps(1) infinite;pointer-events:none}
      .f7-bulb.odd{animation-delay:.6s}
      .f7-spot{--cw:78px;position:relative;width:96px;display:grid;justify-items:center;gap:4px}
      .f7-spot::before{content:"";position:absolute;inset:-24px -30px;background:radial-gradient(closest-side,rgba(255,230,160,.33),transparent);pointer-events:none}
      .f7-spot .f7-c{transform:rotate(-4deg);box-shadow:0 10px 26px rgba(0,0,0,.45)}
      .f7-for{font-size:.8rem;font-weight:700;color:var(--dim);max-width:96px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1em}
      .f7-info{display:grid;gap:8px;min-width:0}
      .f7-cap{font-size:1.08rem;font-weight:600;min-height:2.5em;text-wrap:balance}
      .f7-cap b{color:var(--gold);font-weight:800}
      .f7-gauge{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:center}
      .f7-gauge svg{width:96px;height:auto;display:block}
      .f7-needle{transition:transform .6s cubic-bezier(.3,1.5,.5,1);transform-origin:100px 100px}
      .f7-pct{font-family:Anton,Impact,sans-serif;font-size:1.6rem;line-height:1}
      .f7-gwho{font-size:.82rem;color:var(--dim);line-height:1.1}
      .f7-gauge.off{opacity:.35}
      /* sièges */
      .f7-seats{display:grid;gap:6px}
      .f7-seats.many{gap:4px}.f7-seats.many .f7-seat{padding-top:4px;padding-bottom:7px}.f7-seats.many .f7-row{--cw:21px}.f7-seats.many .f7-av{width:34px;height:34px}.f7-seats.many .f7-seat{grid-template-columns:34px minmax(0,1fr) auto}
      .f7-seat{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 10px 9px 6px;border-radius:14px;background:var(--panel);border:2px solid var(--line);transition:border-color .25s,box-shadow .25s;overflow:hidden}
      .f7-seat.me{border-color:rgba(255,207,63,.55)}
      .f7-seat.cur{border-color:var(--gold);box-shadow:0 0 0 3px rgba(255,207,63,.25),0 10px 30px -12px rgba(255,207,63,.5)}
      .f7-seat.tg{border-color:var(--pink);animation:f7beckon 1s ease-in-out infinite}
      .f7-seat.off{opacity:.5}
      .f7-av{position:relative;width:40px;height:40px;border-radius:12px;background:radial-gradient(circle at 50% 30%,rgba(255,207,63,.25),rgba(255,255,255,.05));overflow:hidden}
      .f7-av svg{position:absolute;left:50%;top:-2px;width:100px;height:auto;transform:translateX(-50%)}
      .f7-mid{min-width:0;display:grid;gap:4px}
      .f7-nm{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:1.02rem}
      .f7-nm b{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .f7-tag{flex:none;font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,.1);color:var(--dim)}
      .f7-tag.you{background:var(--gold);color:var(--ink)}
      .f7-row{--cw:24px;display:flex;flex-wrap:wrap;gap:3px;min-height:calc(var(--cw)*1.38)}
      .f7-none{font-size:.82rem;color:var(--dim);align-self:center}
      .f7-tot{text-align:right;display:grid;justify-items:end;gap:2px}
      .f7-tot span:first-child{white-space:nowrap}
      .f7-tot b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.45rem;line-height:1;font-variant-numeric:tabular-nums}
      .f7-tot small{font-size:.75rem;color:var(--dim)}
      .f7-rs{font-weight:800;font-size:.85rem;color:var(--gold);font-variant-numeric:tabular-nums}
      .f7-meter{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.08)}
      .f7-meter i{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(90deg,var(--gold),var(--pink));transition:width .5s}
      .f7-meter i.pd{background:rgba(255,207,63,.35);transition:left .5s,width .5s}
      .f7-stamp{position:absolute;right:62px;top:50%;transform:translateY(-50%) rotate(-12deg);font-family:Anton,Impact,sans-serif;font-size:1.15rem;letter-spacing:.04em;padding:0 8px;border:3px solid currentColor;border-radius:8px;pointer-events:none;background:rgba(36,10,51,.55);white-space:nowrap}
      .f7-stamp.new{animation:f7stamp .35s cubic-bezier(.2,1.6,.4,1)}
      .f7-seat.st-b .f7-stamp{color:var(--pink)}
      .f7-seat.st-f .f7-stamp{color:var(--ice)}
      .f7-seat.st-s .f7-stamp{color:var(--mint)}
      .f7-stamp.f7s{color:var(--gold)!important}
      .f7-seat.st-b .f7-row{filter:grayscale(.9) brightness(.7)}
      .f7-seat.st-f .f7-row{filter:saturate(.6) hue-rotate(160deg) brightness(1.05)}
      .f7-seat.shake{animation:f7shake .45s}
      .f7-flash{position:absolute;left:50%;top:2px;transform:translateX(-50%);background:var(--mint);color:var(--ink);font-weight:800;font-size:.8rem;padding:0 10px;border-radius:999px;animation:f7pop .4s;z-index:2}
      /* cartes */
      .f7-c{position:relative;flex:none;width:var(--cw);height:calc(var(--cw)*1.38);border-radius:calc(var(--cw)*.16);background:var(--paper);color:var(--ink);display:grid;place-items:center;overflow:hidden;
        box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 0 0 calc(var(--cw)*.04) rgba(29,11,38,.08)}
      .f7-c.num{color:var(--k);background:repeating-conic-gradient(from 0deg at 50% 50%,color-mix(in srgb,var(--k) 10%,var(--paper)) 0 10deg,var(--paper) 10deg 20deg)}
      .f7-c.num::after{content:"";position:absolute;inset:7%;border-radius:calc(var(--cw)*.1);border:max(1px,calc(var(--cw)*.025)) solid var(--k);opacity:.35}
      .f7-big{font-family:Anton,Impact,sans-serif;font-size:calc(var(--cw)*.66);line-height:1;text-shadow:0 calc(var(--cw)*.03) 0 rgba(0,0,0,.18)}
      .f7-cn{position:absolute;top:5%;left:10%;font-family:Anton,Impact,sans-serif;font-size:calc(var(--cw)*.2);line-height:1}
      .f7-cn.b{top:auto;left:auto;bottom:5%;right:10%;transform:rotate(180deg)}
      .f7-row .f7-cn,.f7-row .f7-lab{display:none}
      .f7-c.mod{background:linear-gradient(160deg,#fff1b8,#ffd44f 55%,#f0a91c);color:#6b3a00}
      .f7-c.mod .f7-big{font-size:calc(var(--cw)*.44)}
      .f7-c.x2{background:linear-gradient(160deg,#ffd1e2,#ff6fa3 60%,#d6246a);color:#fff}
      .f7-lab{position:absolute;bottom:6%;left:0;right:0;text-align:center;font-weight:800;font-size:calc(var(--cw)*.14);letter-spacing:.03em;text-transform:uppercase;line-height:1.05;padding:0 4%}
      .f7-c.act svg{width:66%;height:auto}
      .f7-spot .f7-c.act svg{margin-bottom:20%}
      .f7-c.freeze{background:linear-gradient(170deg,#e9f9ff,#9fe2ff 60%,#4fb6e8);color:#0b4b6e}
      .f7-c.flip3{background:linear-gradient(170deg,#ffe0f0,#ff8fc0 60%,#e83f86);color:#5c0a33}
      .f7-c.second{background:linear-gradient(170deg,#e3ffef,#8df0bf 60%,#2fbf7c);color:#0b4a2d}
      .f7-c.dup{box-shadow:0 0 0 2px var(--pink),0 2px 0 rgba(0,0,0,.3)}
      .f7-c.fresh{animation:f7flip .5s cubic-bezier(.2,.9,.3,1.2)}
      .f7-back{width:var(--cw);height:calc(var(--cw)*1.38);border-radius:calc(var(--cw)*.16);border:3px solid var(--paper);position:relative;
        background:repeating-conic-gradient(from 0deg at 50% 50%,var(--pink) 0 15deg,#ff8a3d 15deg 30deg);box-shadow:3px 3px 0 #c22d6a,6px 6px 0 #8f1f4f}
      .f7-back::after{content:"7";position:absolute;inset:24% 18%;display:grid;place-items:center;border-radius:50%;background:var(--paper);color:var(--pink);font-family:Anton,Impact,sans-serif;font-size:1.5rem}
      /* barre d'action */
      .f7-bar{position:sticky;bottom:0;z-index:5!important;margin:0 -12px;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top,#240a33 70%,rgba(36,10,51,0));display:grid;gap:8px;min-height:64px;align-content:end}
      .f7-msg{text-align:center;font-weight:700;font-size:1.1rem;color:var(--dim)}
      .f7-msg b{color:var(--text)}
      .f7-yt{text-align:center;font-family:Pacifico,cursive;font-size:1.6rem;line-height:1.1;color:var(--gold);text-shadow:0 3px 0 #b5370f}
      .f7-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .f7-btns.tg{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
      .f7-btn{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.6rem;letter-spacing:.03em;text-transform:uppercase;border:0;border-radius:16px;padding:12px 10px;cursor:pointer;color:var(--ink);transition:transform .1s,filter .15s;min-height:68px;line-height:1.05;touch-action:manipulation}
      .f7-btn small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:.9rem;letter-spacing:.02em;opacity:.8;text-transform:none}
      .f7-btn:active{transform:translateY(3px)}
      .f7-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
      .f7-btn.hit{background:var(--gold);box-shadow:0 5px 0 #b5800a}
      .f7-btn.stay{background:var(--mint);box-shadow:0 5px 0 #17885a}
      .f7-btn.tgt{background:var(--pink);color:#fff;box-shadow:0 5px 0 #a3134e;font-size:1.25rem;min-height:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .f7-dots::after{content:"";animation:f7dots 1.4s steps(4) infinite}
      /* bilan */
      .f7-ov{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(20,5,28,.74);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      .f7-sheet{width:min(100%,420px);max-height:calc(100% - 20px);overflow:auto;background:linear-gradient(170deg,#4a1660,#2e0c3f);border:2px solid var(--gold);border-radius:22px;padding:18px 16px;display:grid;gap:10px;animation:f7pop .35s cubic-bezier(.2,1.4,.4,1)}
      .f7-sheet h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.55rem;line-height:1.05;color:var(--gold);text-align:center;text-transform:uppercase;text-shadow:0 3px 0 #b5370f}
      .f7-sheet p{margin:0;text-align:center;color:var(--dim);font-weight:600}
      .f7-sc{display:grid;gap:4px}
      .f7-sr{display:grid;grid-template-columns:30px minmax(0,1fr) auto 52px;gap:8px;align-items:center;padding:4px 8px;border-radius:10px;background:rgba(255,255,255,.06)}
      .f7-sr.lead{background:rgba(255,207,63,.16);color:var(--gold)}
      .f7-sr .f7-av{width:30px;height:30px;border-radius:8px}
      .f7-sr .f7-av svg{width:76px;top:-2px}
      .f7-sr b{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .f7-sr .g{font-weight:800;font-size:.95rem;text-align:right;font-variant-numeric:tabular-nums}
      .f7-sr .g.bust{color:var(--pink)}
      .f7-sr .t{font-family:Anton,Impact,sans-serif;font-size:1.25rem;text-align:right;font-variant-numeric:tabular-nums}
      .f7-timer{height:5px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}
      .f7-timer i{display:block;height:100%;background:var(--gold);animation:f7timer 4.4s linear forwards}
      .f7-banner{position:fixed;left:50%;top:42%;z-index:70;transform:translate(-50%,-50%);font-family:Anton,Impact,sans-serif;font-size:min(22vw,7rem);color:var(--gold);text-shadow:0 6px 0 #b5370f,0 12px 40px rgba(255,80,40,.6);pointer-events:none;animation:f7banner 1.9s cubic-bezier(.2,1.3,.4,1) forwards;white-space:nowrap}
      @keyframes f7spin{to{transform:rotate(360deg)}}
      @keyframes f7flip{0%{transform:perspective(400px) rotateY(90deg) scale(.7);opacity:.3}100%{opacity:1}}
      @keyframes f7shake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
      @keyframes f7stamp{from{transform:translateY(-50%) rotate(-12deg) scale(2.2);opacity:0}}
      @keyframes f7pop{from{transform:scale(.6);opacity:0}}
      @keyframes f7bulb{0%{opacity:1}50%{opacity:.25}}
      @keyframes f7beckon{50%{box-shadow:0 0 0 6px rgba(255,79,139,.2)}}
      @keyframes f7timer{from{width:100%}to{width:0}}
      @keyframes f7dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
      @keyframes f7banner{0%{transform:translate(-50%,-50%) scale(.2) rotate(-20deg);opacity:0}25%{transform:translate(-50%,-50%) scale(1.1) rotate(-4deg);opacity:1}80%{opacity:1}100%{transform:translate(-50%,-70%) scale(1) rotate(-4deg);opacity:0}}
      @media (min-width:700px){.f7{max-width:640px;margin:0 auto}.f7-stage{grid-template-columns:auto minmax(0,1fr)}.f7-spot{--cw:96px;width:120px}}
      @media (prefers-reduced-motion:reduce){.f7 *,.f7 *::before,.f7 *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    </style>
    <div class="f7">
      <div class="f7-rays" aria-hidden="true"></div>
      <div class="f7-top"><span class="f7-logo" aria-label="Flip 7">FLIP<i>7</i></span>
        <div class="f7-chips"><span class="f7-chip" id="f7-round">Manche <b>1</b> / ${MAXR}</span><span class="f7-chip" id="f7-deck">Pioche <b>94</b></span></div></div>
      <section class="f7-stage" id="f7-stage" aria-label="Scène">
        <div class="f7-spot"><div id="f7-spot"><div class="f7-back"></div></div><div class="f7-for" id="f7-for"></div></div>
        <div class="f7-info">
          <div class="f7-cap" id="f7-cap" role="status" aria-live="polite">Les candidats entrent en scène…</div>
          <div class="f7-gauge off" id="f7-gauge" aria-label="Risque de doublon">
            <svg viewBox="0 0 200 112" aria-hidden="true">
              <defs><linearGradient id="f7-arc" x1="0" x2="1"><stop offset="0" stop-color="#4be0a0"/><stop offset=".5" stop-color="#ffcf3f"/><stop offset="1" stop-color="#ff4f8b"/></linearGradient></defs>
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#f7-arc)" stroke-width="18" stroke-linecap="round"/>
              <g class="f7-needle" id="f7-needle" style="transform:rotate(-90deg)"><line x1="100" y1="100" x2="100" y2="32" stroke="#fbefff" stroke-width="7" stroke-linecap="round"/></g>
              <circle cx="100" cy="100" r="11" fill="#ffcf3f"/>
            </svg>
            <div><div class="f7-pct" id="f7-pct">–</div><div class="f7-gwho" id="f7-gwho">Risque de doublon</div></div>
          </div>
        </div>
      </section>
      <div class="f7-seats${N >= 6 ? " many" : ""}" id="f7-seats"></div>
      <div class="f7-bar" id="f7-bar"></div>
      <div id="f7-ovw"></div>
    </div>`;
    const $ = id => el.querySelector("#" + id);
    const root = el.querySelector(".f7");
    (function bulbs() {
      const st = $("f7-stage"), n = 10, m = 3;
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([i / n * 100, 0], [i / n * 100, 100]);
      for (let j = 1; j < m; j++) pts.push([0, j / m * 100], [100, j / m * 100]);
      pts.forEach(([x, y], i) => { const b = document.createElement("span"); b.className = "f7-bulb" + (i % 2 ? " odd" : ""); b.style.left = x + "%"; b.style.top = y + "%"; st.appendChild(b); });
    })();

    /* ---------- Son (après un geste) ---------- */
    let actx = null;
    function unlock() {
      if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
      if (actx && actx.state === "suspended") actx.resume();
    }
    el.addEventListener("pointerdown", unlock);
    function tone(f, at, dur, type = "triangle", vol = .1, slide) {
      if (!actx || actx.state !== "running") return;
      const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + .05);
    }
    const sfx = {
      flip: v => { tone(300 + (v || 0) * 40, 0, .12, "triangle", .08); tone(900, 0, .04, "square", .02); },
      bust: () => tone(220, 0, .5, "sawtooth", .07, 70),
      stay: () => { tone(523, 0, .15, "sine", .08); tone(784, .09, .25, "sine", .08); },
      freeze: () => [1568, 2093, 2637].forEach((f, i) => tone(f, i * .06, .3, "sine", .04)),
      save: () => { tone(660, 0, .15, "sine", .08); tone(990, .1, .3, "sine", .08); },
      f7: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * .1, .35, "square", .05)),
      turn: () => { tone(880, 0, .1, "sine", .06); tone(1320, .08, .16, "sine", .06); }
    };

    /* ---------- Cartes (affichage) ---------- */
    function cardHTML(code, extra = "") {
      const f = extra ? " " + extra : "";
      if (/^!?\d+$/.test(code)) {
        const dup = code[0] === "!", v = +code.replace("!", "");
        return `<div class="f7-c num${dup ? " dup" : ""}${f}" style="--k:${NCOL[v]}" aria-label="${v}"><span class="f7-cn">${v}</span><span class="f7-big">${v}</span><span class="f7-cn b">${v}</span></div>`;
      }
      if (code[0] === "+") return `<div class="f7-c mod${f}" aria-label="Bonus ${code}"><span class="f7-big">${code}</span><span class="f7-lab">bonus</span></div>`;
      if (code === "x") return `<div class="f7-c mod x2${f}" aria-label="Fois 2"><span class="f7-big">×2</span><span class="f7-lab">numéros</span></div>`;
      const a = ACT[code];
      return a ? `<div class="f7-c act ${a.cls}${f}" aria-label="${a.label}">${a.svg}<span class="f7-lab">${a.label}</span></div>` : "";
    }

    /* ================= Moteur (hôte) ================= */
    if (api.isHost) {
      const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      function buildDeck() {
        const d = [{t: "n", v: 0}];
        for (let v = 1; v <= 12; v++) for (let k = 0; k < v; k++) d.push({t: "n", v});
        for (const v of [2, 4, 6, 8, 10]) d.push({t: "m", v});
        d.push({t: "x2"});
        for (const a of ["F", "T", "S"]) for (let k = 0; k < 3; k++) d.push({t: "a", a});
        return shuffle(d);
      }
      const enc = c => c.t === "n" ? (c.dup ? "!" : "") + c.v : c.t === "m" ? "+" + c.v : c.t === "x2" ? "x" : c.a;
      const H = {deck: buildDeck(), disc: [], round: 0, dealer: Math.floor(Math.random() * N), cur: -1, aw: -1, ch: null, lc: "", lp: -1, ev: "", n: 0, d: 0, ph: "deal", fx: null, fxn: 0, w: null, roundOver: false,
        pl: P.map(() => ({cards: [], tot: 0, st: "a", f7: 0, off: 0, g: null, fl: ""}))};
      const nm = s => "*" + clean(P[s].pseudo) + "*";
      const nums = p => p.cards.filter(c => c.t === "n" && !c.dup).map(c => c.v);
      const hasSecond = p => p.cards.some(c => c.t === "a" && c.a === "S");
      const activeSeats = () => H.pl.map((p, i) => i).filter(i => H.pl[i].st === "a");
      function roundScore(p) {
        if (p.st === "b") return 0;
        let s = nums(p).reduce((a, b) => a + b, 0);
        if (p.cards.some(c => c.t === "x2")) s *= 2;
        s += p.cards.filter(c => c.t === "m").reduce((a, c) => a + c.v, 0);
        if (p.f7) s += 15;
        return s;
      }
      function risk(seat) {
        if (seat < 0 || H.pl[seat].st !== "a") return -1;
        const pool = H.deck.length ? H.deck : H.disc;
        if (!pool.length) return 0;
        const mine = new Set(nums(H.pl[seat]));
        return Math.round(pool.filter(c => c.t === "n" && mine.has(c.v)).length / pool.length * 1000) / 10;
      }
      window.__f7maxState = window.__f7maxState || 0;
      function publish() {
        if (!alive) return;
        H.n++;
        const rs = H.aw >= 0 ? H.aw : H.cur;
        const s = {r: H.round, mr: MAXR, ph: H.ph, dk: H.deck.length, dl: H.dealer, cur: H.cur, aw: H.aw, ch: H.ch, lc: H.lc, lp: H.lp, d: H.d, ev: H.ev, n: H.n,
          rk: risk(rs), sc: rs >= 0 && hasSecond(H.pl[rs]) ? 1 : 0,
          p: H.pl.map(p => [p.cards.map(enc).join("."), p.tot, p.st, p.f7, roundScore(p), p.g == null ? "" : p.g, p.off, p.fl])};
        if (H.fx) { s.fx = H.fx; s.fxn = H.fxn; }
        if (H.w) s.w = H.w;
        const len = JSON.stringify(s).length;
        if (len > window.__f7maxState) window.__f7maxState = len;
        api.setState(s);
      }
      const fx = (s, k) => { H.fx = {s, k}; H.fxn++; };
      function wait(ms) { return new Promise(res => later(res, ms * SPEED)); }

      /* entrées : seule la personne attendue, avec un seq neuf */
      let want = null, inputs = {};
      const seen = {};
      function ask(seat, kind, cands) {
        const key = P[seat].key, cur = inputs[key];
        seen[key] = cur ? cur.seq : undefined;
        return new Promise(res => {
          want = {seat, key, kind, cands, res};
          if (H.pl[seat].off) autoAnswer();
        });
      }
      function settle(v) { const w = want; want = null; w.res(v); }
      function autoAnswer() {
        if (!want) return;
        if (want.kind === "hs") return settle("stay");
        const others = want.cands.filter(s => s !== want.seat && !H.pl[s].off);
        settle(others.length ? others[Math.floor(Math.random() * others.length)] : want.cands[0]);
      }
      function check() {
        if (!want) return;
        const i = inputs[want.key];
        if (!i || i.seq == null || i.seq === seen[want.key]) return;
        seen[want.key] = i.seq;
        if (want.kind === "hs" && (i.a === "hit" || i.a === "stay")) settle(i.a);
        else if (want.kind === "tg" && i.a === "target") { const s = seatOf(i.t); if (want.cands.includes(s)) settle(s); }
      }
      api.onInputs(m => { inputs = m || {}; check(); });

      /* déconnexions : le joueur absent est considéré comme restant */
      const pollConn = setInterval(() => {
        if (!alive) return;
        const on = new Set(api.connected());
        let ch = false;
        H.pl.forEach((p, i) => {
          const off = on.has(P[i].key) ? 0 : 1;
          if (off === p.off) return;
          p.off = off; ch = true;
          if (off) {
            if (p.st === "a" && H.ph !== "end" && H.ph !== "over") { p.st = "s"; H.ev = `${nm(i)} a quitté la scène : ses points de la manche sont gardés.`; }
            if (want && want.seat === i) autoAnswer();
          }
        });
        if (ch && H.ph !== "over") publish();
      }, 1000);
      timers.add(pollConn);

      function draw() {
        if (!H.deck.length) {
          if (!H.disc.length) return null;
          H.deck = shuffle(H.disc); H.disc = [];
        }
        H.d++;
        return H.deck.pop();
      }
      async function chooseTarget(chooser, cands, kind) {
        if (cands.length === 1) return cands[0];
        H.ch = {w: chooser, k: kind, c: cands}; H.aw = -1;
        H.ev = `${nm(chooser)} a tiré *${ACT[kind].label}* et choisit une cible.`;
        publish();
        const t = await ask(chooser, "tg", cands);
        H.ch = null;
        return t;
      }
      async function give(seat, card, ctx) {
        const p = H.pl[seat];
        H.lc = enc(card); H.lp = seat; H.cur = seat; H.fx = null;
        if (card.t === "n") {
          if (nums(p).includes(card.v)) {
            if (hasSecond(p)) {
              const sc = p.cards.find(c => c.t === "a" && c.a === "S");
              p.cards.splice(p.cards.indexOf(sc), 1);
              H.disc.push(card, sc);
              p.fl = "Sauvé !"; fx(seat, "save");
              H.ev = `${nm(seat)} tire un second *${card.v}*… la seconde chance fait son effet !`;
              publish(); await wait(1300); p.fl = ""; return;
            }
            card.dup = true; p.cards.push(card); p.st = "b"; fx(seat, "bust");
            H.ev = `Aïe ! ${nm(seat)} tire un deuxième *${card.v}* : sauté !`;
            publish(); await wait(1500); return;
          }
          p.cards.push(card);
          if (nums(p).length === 7) {
            p.f7 = 1; H.roundOver = true; fx(seat, "f7");
            H.ev = `${nm(seat)} réussit un *FLIP 7* ! +15 points et fin de manche.`;
            publish(); await wait(2300); return;
          }
          fx(seat, "flip");
          H.ev = `${nm(seat)} retourne un *${card.v}*.`;
        } else if (card.t === "m" || card.t === "x2") {
          p.cards.push(card); fx(seat, "flip");
          H.ev = `${nm(seat)} gagne un bonus *${card.t === "x2" ? "×2" : "+" + card.v}*.`;
        } else if (card.a === "S") {
          fx(seat, "flip");
          if (!hasSecond(p)) { p.cards.push(card); H.ev = `${nm(seat)} obtient une *seconde chance*.`; }
          else {
            const cands = activeSeats().filter(o => o !== seat && !hasSecond(H.pl[o]));
            if (!cands.length) { H.disc.push(card); H.ev = "Seconde chance en trop : personne ne peut la recevoir, elle part à la défausse."; }
            else {
              H.ev = `${nm(seat)} a déjà une seconde chance : elle doit être offerte.`;
              publish(); await wait(900);
              const t = await chooseTarget(seat, cands, "S");
              H.lc = "S"; H.lp = t; H.fx = null;
              if (H.pl[t].st === "a" && !hasSecond(H.pl[t])) { H.pl[t].cards.push(card); H.ev = `${nm(seat)} offre une seconde chance à ${nm(t)}.`; }
              else { H.disc.push(card); H.ev = "La seconde chance part à la défausse."; }
            }
          }
        } else if (ctx) {
          ctx.pending.push(card); p.cards.push(card); fx(seat, "flip");
          H.ev = `${nm(seat)} tire *${ACT[card.a].label}* : elle sera jouée après les 3 cartes.`;
        } else {
          p.cards.push(card); fx(seat, "flip");
          H.ev = `${nm(seat)} tire *${ACT[card.a].label}*…`;
          publish(); await wait(900);
          await resolveAction(seat, card);
          return;
        }
        publish(); await wait(1000);
      }
      async function resolveAction(seat, card) {
        const cands = activeSeats();
        if (!cands.length || H.roundOver) return;
        const t = await chooseTarget(seat, cands, card.a);
        H.fx = null; H.cur = seat;
        const self = t === seat;
        if (card.a === "F") {
          if (H.pl[t].st === "a") H.pl[t].st = "f";
          fx(t, "freeze");
          H.ev = self ? `${nm(seat)} se gèle : ${roundScore(H.pl[t])} pts encaissés.` : `${nm(seat)} gèle ${nm(t)} : ${roundScore(H.pl[t])} pts encaissés.`;
          publish(); await wait(1300);
        } else {
          H.ev = self ? `${nm(seat)} s'impose *Pioche 3* !` : `${nm(seat)} impose *Pioche 3* à ${nm(t)} !`;
          publish(); await wait(1100);
          const ctx = {pending: []};
          for (let i = 0; i < 3; i++) {
            if (H.pl[t].st !== "a" || H.roundOver) break;
            const c = draw(); if (!c) break;
            await give(t, c, ctx);
          }
          for (const pc of ctx.pending) {
            if (H.pl[t].st !== "a" || H.roundOver) break;
            await resolveAction(t, pc);
          }
        }
      }
      async function turnOf(seat) {
        const p = H.pl[seat];
        H.cur = seat; H.aw = seat; H.fx = null;
        H.ev = `Au tour de ${nm(seat)} : piocher ou rester ?`;
        publish();
        const choice = await ask(seat, "hs");
        H.aw = -1;
        if (p.st !== "a") { publish(); await wait(400); return; }
        if (choice === "stay") {
          p.st = "s"; fx(seat, "stay");
          H.ev = `${nm(seat)} reste et encaisse *${roundScore(p)} pts*.`;
          publish(); await wait(1000);
        } else {
          const c = draw();
          if (!c) { p.st = "s"; publish(); return; }
          await give(seat, c, null);
        }
      }
      async function playRound() {
        H.round++; H.roundOver = false; H.lc = ""; H.lp = -1; H.ph = "deal"; H.fx = null; H.cur = -1; H.aw = -1;
        H.pl.forEach(p => { p.cards = []; p.st = p.off ? "s" : "a"; p.f7 = 0; p.g = null; p.fl = ""; });
        const order = Array.from({length: N}, (_, i) => (H.dealer + 1 + i) % N);
        H.ev = `Manche *${H.round}* : ${nm(H.dealer)} distribue une carte à chacun.`;
        publish(); await wait(1500);
        for (const s of order) {
          if (H.roundOver) break;
          if (H.pl[s].st !== "a") continue;
          const c = draw(); if (!c) break;
          await give(s, c, null);
        }
        H.ph = "play";
        while (!H.roundOver && activeSeats().length) {
          for (const s of order) {
            if (H.roundOver) break;
            if (H.pl[s].st !== "a") continue;
            await turnOf(s);
          }
        }
        await endRound();
      }
      async function endRound() {
        H.cur = -1; H.aw = -1; H.ch = null; H.fx = null;
        H.pl.forEach(p => { p.g = p.st === "b" ? -1 : roundScore(p); p.tot += Math.max(0, p.g); });
        H.pl.forEach(p => { H.disc.push(...p.cards.map(c => { delete c.dup; return c; })); });
        const best = Math.max(...H.pl.map(p => p.tot));
        const leaders = H.pl.map((p, i) => i).filter(i => H.pl[i].tot === best);
        const over = (best >= GOAL && leaders.length === 1) || H.round >= MAXR;
        H.ph = over ? "over" : "end";
        if (over) H.w = leaders;
        H.ev = over ? (leaders.length === 1 ? `${nm(leaders[0])} remporte le show avec *${best} points* !` : "Égalité au sommet : victoire partagée !") : `Fin de la manche ${H.round}.`;
        publish();
        await wait(over ? 4500 : 4600);
        H.pl.forEach(p => { p.cards = []; });
        if (over) {
          const ranking = H.pl.map((p, i) => i).sort((a, b) => H.pl[b].tot - H.pl[a].tot || a - b).map(i => P[i].key);
          const wn = leaders.map(i => P[i].pseudo);
          const reason = best >= GOAL ? `${best} points` : `${best} points après ${H.round} manches`;
          api.finish({winners: leaders.map(i => P[i].key), ranking,
            summary: leaders.length === 1 ? `${wn[0]} remporte le show Flip 7 avec ${reason}.` : `${wn.join(" et ")} se partagent la victoire avec ${reason}.`});
          return;
        }
        H.dealer = (H.dealer + 1) % N;
        await playRound();
      }
      publish();
      later(() => playRound().catch(e => console.error(e)), 900);
    }

    /* ================= Affichage (tout le monde) ================= */
    const STAMP = {b: "SAUTÉ", f: "GELÉ", s: "RESTE"};
    const KIND = {F: "Qui doit geler ?", T: "Qui pioche 3 cartes ?", S: "À qui offrir la seconde chance ?"};
    let S = null, mySeq = 0, sentN = -1, lastD = -1, lastFx = -1, prevCards = [], prevSt = [], sheetKey = "", lastTurnN = -1;
    const bold = t => esc(t).replace(/\*([^*]+)\*/g, "<b>$1</b>");
    const nameOf = s => esc(P[s].pseudo);
    const avs = P.map(p => api.avatar(p.key));

    function renderSeats(s) {
      const cands = s.ch ? s.ch.c : [];
      const html = s.p.map((q, i) => {
        const [cards, tot, st, f7, rs, , off, fl] = q;
        const codes = cards ? cards.split(".") : [];
        const prev = prevCards[i] || [];
        const keep = codes.length >= prev.length && prev.every((c, k) => c === codes[k]) ? prev.length : codes.length;
        const cls = ["f7-seat", "st-" + st, i === mySeat ? "me" : "", i === s.cur && s.ph !== "end" && s.ph !== "over" ? "cur" : "", cands.includes(i) ? "tg" : "", off ? "off" : "",
          s.fx && s.fxn !== lastFx && s.fx.s === i && s.fx.k === "bust" ? "shake" : ""].join(" ");
        const stTxt = f7 ? "FLIP 7" : STAMP[st];
        const stamp = stTxt ? `<span class="f7-stamp${f7 ? " f7s" : ""}${prevSt[i] !== st + f7 ? " new" : ""}">${stTxt}</span>` : "";
        const base = Math.min(100, tot / GOAL * 100), pend = Math.max(0, Math.min(100 - base, rs / GOAL * 100));
        return `<div class="${cls}" data-seat="${i}">
          ${fl ? `<span class="f7-flash">${esc(fl)}</span>` : ""}
          <div class="f7-av">${avs[i]}</div>
          <div class="f7-mid"><div class="f7-nm"><b>${nameOf(i)}</b>${i === mySeat ? '<span class="f7-tag you">toi</span>' : ""}${i === s.dl ? '<span class="f7-tag">donne</span>' : ""}${off ? '<span class="f7-tag">absent</span>' : ""}</div>
            <div class="f7-row">${codes.length ? codes.map((c, k) => cardHTML(c, k >= keep ? "fresh" : "")).join("") : '<span class="f7-none">Pas encore de carte</span>'}</div></div>
          <div class="f7-tot"><span><b>${tot}</b><small>/${GOAL}</small></span><span class="f7-rs">${st === "b" ? "0" : "+" + rs}</span></div>
          ${stamp}
          <div class="f7-meter"><i style="width:${base}%"></i><i class="pd" style="left:${base}%;width:${st === "b" ? 0 : pend}%"></i></div>
        </div>`;
      }).join("");
      $("f7-seats").innerHTML = html;
      prevCards = s.p.map(q => q[0] ? q[0].split(".") : []);
      prevSt = s.p.map(q => q[2] + q[3]);
    }
    function renderBar(s) {
      const bar = $("f7-bar");
      if (s.ph === "end" || s.ph === "over") { bar.innerHTML = ""; return; }
      const waiting = sentN === s.n;
      if (s.aw >= 0 && s.aw === mySeat && !s.ch) {
        if (waiting) { bar.innerHTML = `<div class="f7-msg f7-dots">C'est noté</div>`; return; }
        const rs = s.p[mySeat][4];
        bar.innerHTML = `<div class="f7-yt">À toi !</div><div class="f7-btns">
          <button class="f7-btn hit" type="button" data-a="hit">Piocher<small>risque ${s.rk >= 0 ? Math.round(s.rk) : 0} %${s.sc ? " · protégé" : ""}</small></button>
          <button class="f7-btn stay" type="button" data-a="stay">Rester<small>+${rs} pts</small></button></div>`;
        return;
      }
      if (s.ch && s.ch.w === mySeat) {
        if (waiting) { bar.innerHTML = `<div class="f7-msg f7-dots">C'est noté</div>`; return; }
        bar.innerHTML = `<div class="f7-yt">${KIND[s.ch.k]}</div><div class="f7-btns tg">${s.ch.c.map(i =>
          `<button class="f7-btn tgt" type="button" data-a="target" data-t="${i}">${i === mySeat ? "Moi" : nameOf(i)}</button>`).join("")}</div>`;
        return;
      }
      let msg = "";
      if (s.ch) msg = `<b>${nameOf(s.ch.w)}</b> choisit une cible`;
      else if (s.aw >= 0) msg = `<b>${nameOf(s.aw)}</b> réfléchit`;
      else if (s.ph === "deal") msg = "Distribution";
      else msg = "Le show continue";
      bar.innerHTML = `<div class="f7-msg f7-dots">${msg}</div>`;
    }
    function renderSheet(s) {
      const box = $("f7-ovw");
      if (s.ph !== "end" && s.ph !== "over") { box.innerHTML = ""; sheetKey = ""; return; }
      const key = s.ph + s.r;
      if (sheetKey === key) return;
      sheetKey = key;
      const best = Math.max(...s.p.map(q => q[1]));
      const leaders = s.p.map((q, i) => i).filter(i => s.p[i][1] === best);
      const order = s.p.map((q, i) => i).sort((a, b) => s.p[b][1] - s.p[a][1] || a - b);
      let title, sub;
      if (s.ph === "over") {
        title = leaders.length === 1 ? (leaders[0] === mySeat ? "Tu gagnes le show !" : `${nameOf(leaders[0])} gagne le show !`) : "Victoire partagée !";
        sub = best >= GOAL ? `${best} points : rideau !` : `Fin des ${s.mr} manches : rideau !`;
      } else {
        title = `Fin de la manche ${s.r}`;
        sub = (best >= GOAL ? "Égalité au sommet : manche décisive !" : `Encore ${GOAL - best} points pour le meneur.`) + ` Manche ${s.r} sur ${s.mr}.`;
      }
      box.innerHTML = `<div class="f7-ov"><div class="f7-sheet" role="dialog" aria-label="Bilan">
        <h3>${title}</h3><p>${esc(sub)}</p>
        <div class="f7-sc">${order.map(i => {
          const g = s.p[i][5], f7 = s.p[i][3];
          return `<div class="f7-sr${s.p[i][1] === best ? " lead" : ""}"><div class="f7-av">${avs[i]}</div><b>${nameOf(i)}${i === mySeat ? " (toi)" : ""}</b>
            <span class="g${g === -1 ? " bust" : ""}">${g === -1 ? "sauté" : "+" + g}${f7 ? " · FLIP 7" : ""}</span><span class="t">${s.p[i][1]}</span></div>`;
        }).join("")}</div>
        ${s.ph === "end" ? `<p>Manche suivante dans un instant…</p><div class="f7-timer"><i></i></div>` : ""}
      </div></div>`;
      if (s.ph === "over" && leaders.length === 1) banner(leaders[0] === mySeat ? "BRAVO !" : "RIDEAU !");
    }
    function banner(txt) {
      const b = document.createElement("div"); b.className = "f7-banner"; b.textContent = txt;
      root.appendChild(b); later(() => b.remove(), 1950);
    }
    function render(s) {
      S = s;
      $("f7-round").innerHTML = `Manche <b>${Math.max(1, s.r)}</b> / ${s.mr}`;
      $("f7-deck").innerHTML = `Pioche <b>${s.dk}</b>`;
      // projecteur
      if (s.lc) {
        if (s.d !== lastD || !$("f7-spot").firstChild || $("f7-spot").dataset.c !== s.lc + s.lp) {
          $("f7-spot").innerHTML = cardHTML(s.lc, s.d !== lastD ? "fresh" : "");
          $("f7-spot").dataset.c = s.lc + s.lp;
        }
        $("f7-for").textContent = s.lp >= 0 ? "pour " + P[s.lp].pseudo : "";
      } else { $("f7-spot").innerHTML = '<div class="f7-back"></div>'; $("f7-spot").dataset.c = ""; $("f7-for").textContent = ""; }
      lastD = s.d;
      $("f7-cap").innerHTML = bold(s.ev || "");
      // jauge
      const who = s.aw >= 0 ? s.aw : s.cur;
      const g = $("f7-gauge");
      if (s.rk >= 0 && who >= 0 && s.ph !== "end" && s.ph !== "over") {
        g.classList.remove("off");
        $("f7-needle").style.transform = `rotate(${-90 + Math.min(100, s.rk) * 1.8}deg)`;
        $("f7-pct").textContent = (Math.round(s.rk * 10) / 10).toString().replace(".", ",") + " %";
        $("f7-gwho").textContent = `Risque de doublon ${who === mySeat ? "pour toi" : "pour " + P[who].pseudo}${s.sc ? " (seconde chance en poche)" : ""}`;
      } else {
        g.classList.add("off");
        $("f7-needle").style.transform = "rotate(-90deg)";
        $("f7-pct").textContent = "–";
        $("f7-gwho").textContent = "Risque de doublon";
      }
      renderSeats(s);
      renderBar(s);
      renderSheet(s);
      // effets
      if (s.fx && s.fxn !== lastFx) {
        lastFx = s.fxn;
        const k = s.fx.k;
        if (k === "flip") sfx.flip(parseInt(s.lc, 10) || 0);
        else if (sfx[k]) sfx[k]();
        if (k === "f7") banner("FLIP 7 !");
      }
      const mine = (s.aw === mySeat && mySeat >= 0 && !s.ch) || (s.ch && s.ch.w === mySeat);
      if (mine && lastTurnN < 0) { sfx.turn(); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
      lastTurnN = mine ? s.n : -1;
    }
    api.onState(render);
    $("f7-bar").addEventListener("click", e => {
      const b = e.target.closest("[data-a]");
      if (!b || !S || mySeat < 0) return;
      unlock();
      const a = b.dataset.a;
      if (a === "target") {
        if (!S.ch || S.ch.w !== mySeat) return;
        const t = +b.dataset.t;
        if (!S.ch.c.includes(t)) return;
        api.setInput({seq: ++mySeq, a: "target", t: P[t].key});
      } else {
        if (S.aw !== mySeat || S.ch) return;
        api.setInput({seq: ++mySeq, a});
      }
      sentN = S.n;
      renderBar(S);
    });

    return {
      destroy() {
        alive = false;
        timers.forEach(t => { clearTimeout(t); clearInterval(t); });
        timers.clear();
        el.removeEventListener("pointerdown", unlock);
        if (actx) { try { actx.close(); } catch (e) {} }
        el.innerHTML = "";
      }
    };
  }
});
