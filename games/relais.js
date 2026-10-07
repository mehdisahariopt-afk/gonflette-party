/* Gonflette Party : Relais muscu (jeu d'équipe, 2 à 8 joueurs, chacun sur son téléphone).
   Deux équipes courent en même temps un relais de mini-épreuves. Chaque membre court un relais à son tour
   (ordre de l'équipe) ; si les équipes sont inégales, les premiers de la petite équipe courent un relais de plus.
   Nombre de relais = taille de la plus grande équipe (3 au minimum).

   Équité réseau : chaque mini-épreuve tourne ENTIÈREMENT sur le téléphone du relayeur, chronométrée sur
   SON horloge (performance.now), compte à rebours exclu. Le téléphone envoie {leg, a, prog, done, t}
   (t = temps local + pénalités) ; l'hôte valide la séquence, additionne les temps de relais et publie ~5/s.
   Le temps d'équipe = somme des temps locaux : la latence des passages de relais ne pénalise personne.
   Les épreuves (et leurs paramètres : délais, cibles, séquences) sont les mêmes pour les deux équipes. */
GONFLETTE.registerGame({
  id: "relais",
  name: "Relais muscu",
  min: 2,
  max: 8,
  teams: true,
  create(api) {
    "use strict";
    const el = api.el, P = api.players;
    const INTRO_MS = 4200, CD_MS = 3300, END_MS = 3300, CAP_MS = 240000, BEHIND_MS = 60000;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    let TEAMS = api.teams;
    if (!TEAMS) TEAMS = [0, 1].map(i => ({index: i, name: i ? "Équipe bleue" : "Équipe rouge", color: i ? "#3a86ff" : "#e63946", keys: P.filter((p, j) => j % 2 === i).map(p => p.key)}));
    const TK = TEAMS.map(t => t.keys.filter(k => seatOf[k] !== undefined));
    const teamOf = k => (TK[0].includes(k) ? 0 : TK[1].includes(k) ? 1 : -1);
    const myTeam = api.isPlayer ? teamOf(api.me) : -1;
    const L = Math.max(3, TK[0].length, TK[1].length);
    const COL = [TEAMS[0].color || "#e63946", TEAMS[1].color || "#3a86ff"];

    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const TN = i => esc(TEAMS[i].name);
    const nameOf = seat => (P[seat] ? esc(P[seat].pseudo) : "?");
    const keyOf = seat => (P[seat] ? P[seat].key : null);
    const bust = seat => (P[seat] ? api.avatar(P[seat].key, {view: "bust"}) : "");
    const sum = a => a.reduce((x, y) => x + y, 0);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sec = ms => (ms / 1000).toFixed(1).replace(".", ",") + " s";
    const chrono = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, d = Math.floor(ms / 100) % 10; return `${m}:${String(s).padStart(2, "0")},${d}`; };
    const mmss = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

    const timers = new Set(), ivs = [];
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    let dead = false, raf = 0, ac = null;
    let RM = false;
    try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* rien */ }
    function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    const EV = [
      {n: "Sprint tapis", i: "🏃", h: "40 foulées : alterne GAUCHE / DROITE le plus vite possible"},
      {n: "Développé", i: "🏋️", h: "5 reps propres : tape quand l'aiguille est dans le vert (raté = +0,5 s)"},
      {n: "Réflexe", i: "⚡", h: "3 feux : tape dès que c'est VERT (faux départ = +1 s)"},
      {n: "Gainage", i: "🎯", h: "Garde le doigt sur la cible qui bouge, 6 s au total"},
      {n: "Haltère mémoire", i: "🧠", h: "Retiens les 4 disques puis charge-les dans l'ordre (erreur = +1 s)"}
    ];
    const CHEERS = ["💪", "🔥", "👏", "⚡", "📣"];
    const PLATES = [{w: "25", c: "#e63946"}, {w: "20", c: "#3a86ff"}, {w: "15", c: "#ffd23f"}, {w: "10", c: "#2ec27e"}, {w: "5", c: "#f2f2f2"}];
    const BATON = `<svg class="rl-baton" viewBox="0 0 44 16" aria-hidden="true"><rect x="2" y="3" width="40" height="10" rx="5" fill="#ffd23f" stroke="#5a4100" stroke-width="2"/><rect x="15" y="3" width="5" height="10" fill="#e39b00"/><rect x="25" y="3" width="5" height="10" fill="#e39b00"/></svg>`;

    /* ================= styles & squelette ================= */
    el.innerHTML = `<style>
      .rl{position:relative;min-height:100%;box-sizing:border-box;padding:10px 14px 26px;display:grid;grid-template-columns:minmax(0,620px);justify-content:center;align-content:start;gap:10px;color:#f4efe3;font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;background:radial-gradient(70% 30% at 12% 0%,rgba(255,250,210,.22),transparent 70%),radial-gradient(70% 30% at 88% 0%,rgba(255,250,210,.22),transparent 70%),linear-gradient(#0b1430 0%,#13224a 40%,#0c1a2c 100%);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;overflow-x:hidden}
      .rl *{box-sizing:border-box}
      .rl.lock{height:100%;overflow:hidden}
      .rl-hd{display:flex;align-items:baseline;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center}
      .rl-hd h2{margin:0;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.9rem;letter-spacing:.04em;line-height:1;text-shadow:3px 3px 0 #000}
      .rl-hd span{font-family:Pacifico,"Brush Script MT",cursive;color:#ffd23f;font-size:1.15rem}
      .rl-sb{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rl-tb{position:relative;border-radius:12px;padding:6px 9px 7px;background:linear-gradient(160deg,color-mix(in srgb,var(--tc) 55%,#0b1430),#0f1a36);border:2px solid var(--tc);display:grid;gap:1px;min-width:0}
      .rl-tb.me{box-shadow:0 0 0 2px #ffd23f,0 0 16px rgba(255,210,63,.35)}
      .rl-tb .tn{font-weight:800;font-size:1.05rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rl-tb .ch{font-family:Anton,Impact,sans-serif;font-size:1.7rem;letter-spacing:.03em;line-height:1.05;font-variant-numeric:tabular-nums}
      .rl-tb .lg{font-size:.95rem;opacity:.9;display:flex;justify-content:space-between;gap:4px}
      .rl-tb .you{position:absolute;right:6px;top:-9px;font-family:Anton,Impact,sans-serif;font-size:.75rem;background:#ffd23f;color:#1a1200;padding:0 6px;border-radius:4px;letter-spacing:.05em}
      .rl-msg{min-height:1.4em;text-align:center;font-weight:700;font-size:1.1rem;line-height:1.25}
      .rl-msg b{color:#ffd23f}
      .rl-stad{position:relative;border-radius:14px;overflow:hidden;background:#2c7a3a;padding:8px 0 10px;box-shadow:0 10px 26px rgba(0,0,0,.45);border:3px solid #0a0f1f}
      .rl-stad::before{content:"";display:block;height:14px;margin:0 8px 6px;border-radius:6px;background:repeating-linear-gradient(90deg,#3d4d7a 0 6px,#56679a 6px 9px,#e8b04a 9px 11px,#3d4d7a 11px 16px,#b84a4a 16px 18px);opacity:.75}
      .rl-lane{position:relative;display:grid;grid-template-columns:30px 1fr;height:88px;background:linear-gradient(#c4532f,#b44a29);border-top:3px solid #fff;margin:0}
      .rl-lane:last-child{border-bottom:3px solid #fff}
      .rl-lno{display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:1.8rem;color:#fff;background:linear-gradient(90deg,var(--tc),color-mix(in srgb,var(--tc) 60%,#b44a29));text-shadow:2px 2px 0 rgba(0,0,0,.35)}
      .rl-trk{position:relative;margin:0 22px 0 6px}
      .rl-tick{position:absolute;top:0;bottom:0;width:0;border-left:2px dashed rgba(255,255,255,.55)}
      .rl-tick span{position:absolute;bottom:2px;left:3px;font-family:Anton,Impact,sans-serif;font-size:.7rem;color:rgba(255,255,255,.8)}
      .rl-fin{position:absolute;top:0;bottom:0;right:-20px;width:12px;background:conic-gradient(#fff 25%,#111 0 50%,#fff 0 75%,#111 0) 0 0/12px 12px}
      .rl-rib{position:absolute;top:0;bottom:0;right:-6px;width:5px}
      .rl-rib::before,.rl-rib::after{content:"";position:absolute;left:0;width:5px;height:50%;background:repeating-linear-gradient(#ffd23f 0 6px,#e63946 6px 12px);transition:transform .5s ease-out,opacity .5s}
      .rl-rib::before{top:0;transform-origin:top}.rl-rib::after{bottom:0;transform-origin:bottom}
      .rl-lane.won .rl-rib::before{transform:rotate(-55deg);opacity:.6}.rl-lane.won .rl-rib::after{transform:rotate(55deg);opacity:.6}
      .rl-tok{position:absolute;bottom:5px;width:30px;height:30px;border-radius:50%;overflow:hidden;background:#f4e6c8;border:2px solid #fff;opacity:.85;transition:opacity .3s}
      .rl-tok svg,.rl-cur .av,.rl-pm svg,.rl-tav svg{width:100%;height:100%;display:block}
      .rl-tok.done{opacity:.4;filter:grayscale(1)}
      .rl-tok.done::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:1.2rem;color:#fff;text-shadow:0 0 3px #000;background:rgba(0,0,0,.25)}
      .rl-tok.now{opacity:0}
      .rl-cur{position:absolute;top:4px;width:46px;height:46px;transition:left .3s linear;z-index:2}
      .rl-cur .rl-face{width:46px;height:46px;border-radius:50%;overflow:hidden;background:#f4e6c8;border:3px solid var(--tc);box-shadow:0 0 0 2px #fff,0 4px 8px rgba(0,0,0,.4)}
      .rl-cur .rl-baton{position:absolute;width:28px;right:-16px;bottom:-4px;transform:rotate(-30deg);filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
      .rl-cur.go .rl-face{animation:rl-bob .5s ease-in-out infinite alternate}
      @keyframes rl-bob{to{transform:translateY(-3px) rotate(-4deg)}}
      .rl-cur.fin .rl-baton{display:none}
      .rl-tb .rn{font-size:.92rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ffe9a8;min-height:1.2em}
      .rl-lfl{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
      .rl-fly{position:absolute;bottom:20%;font-size:1.6rem;line-height:1;animation:rl-fly 1.6s ease-out forwards;white-space:nowrap;text-align:center;pointer-events:none}
      .rl-fly small{display:block;font-size:.72rem;font-weight:800;color:#fff;text-shadow:0 1px 2px #000;font-family:"Barlow Condensed",sans-serif}
      @keyframes rl-fly{0%{transform:translateY(20px) scale(.4);opacity:0}15%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-90px) scale(1);opacity:0}}
      .rl-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px}
      .rl-card{position:relative;background:linear-gradient(#fdf6e3,#e9dcbc);color:#1a1424;border-radius:10px;border:2px solid #0a0f1f;padding:5px 4px 4px;text-align:center;display:grid;gap:1px;box-shadow:0 3px 0 #0a0f1f}
      .rl-card .no{position:absolute;left:4px;top:2px;font-family:Anton,Impact,sans-serif;font-size:.8rem;opacity:.6}
      .rl-card .ic{font-size:1.5rem;line-height:1.1}
      .rl-card .nm{font-weight:800;font-size:.85rem;line-height:1;text-transform:uppercase;min-height:1.7em;display:grid;place-items:center}
      .rl-pips{display:flex;justify-content:center;gap:5px}
      .rl-pips i{width:13px;height:13px;border-radius:50%;border:2px solid var(--tc);display:grid;place-items:center;font-style:normal;font-size:.6rem;color:#fff;font-weight:800}
      .rl-pips i.live{background:var(--tc);animation:rl-pulse .8s infinite alternate}
      .rl-pips i.done{background:var(--tc)}
      .rl-pips i.done::after{content:"✓"}
      @keyframes rl-pulse{to{box-shadow:0 0 0 4px color-mix(in srgb,var(--tc) 40%,transparent)}}
      .rl-card small{font-size:.72rem;font-weight:700;line-height:1.1;min-height:1.1em;font-variant-numeric:tabular-nums}
      .rl-card.mine{box-shadow:0 3px 0 #0a0f1f,0 0 0 3px #ffd23f}
      .rl-cheer{display:grid;gap:6px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.12);border-radius:14px;padding:8px}
      .rl-cheer h4{margin:0;text-align:center;font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.06em;font-size:1rem;opacity:.9}
      .rl-cheer .row{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:6px}
      .rl-cb{appearance:none;border:2px solid #0a0f1f;border-radius:12px;background:linear-gradient(#ffe066,#ffb703);color:#1a1200;font-family:Anton,Impact,sans-serif;font-size:1.25rem;min-height:52px;cursor:pointer;box-shadow:0 4px 0 #0a0f1f;touch-action:manipulation}
      .rl-cb.e{background:linear-gradient(#fff,#dfe6f5);font-size:1.5rem}
      .rl-cb:active{transform:translateY(3px);box-shadow:0 1px 0 #0a0f1f}
      .rl-cb:disabled{opacity:.4}
      .rl-flash{position:absolute;left:0;right:0;top:34%;pointer-events:none;z-index:6;display:grid;gap:6px;justify-items:center}
      .rl-ban{width:100%;padding:10px 12px;text-align:center;background:linear-gradient(90deg,transparent,var(--tc) 12%,var(--tc) 88%,transparent);color:#fff;animation:rl-ban 1.7s ease-out forwards;text-shadow:2px 2px 0 rgba(0,0,0,.35)}
      .rl-ban b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2.1rem;letter-spacing:.04em;line-height:1}
      .rl-ban span{font-weight:800;font-size:1.1rem}
      @keyframes rl-ban{0%{transform:translateX(-100%) skewX(-12deg);opacity:0}15%{transform:none;opacity:1}80%{transform:none;opacity:1}100%{transform:translateX(100%) skewX(-12deg);opacity:0}}
      .rl-intro{text-align:center;font-family:Anton,Impact,sans-serif;font-size:2.2rem;color:#ffd23f;text-shadow:3px 3px 0 #000;animation:rl-zoom .6s ease-out}
      @keyframes rl-zoom{from{transform:scale(2.2);opacity:0}}
      /* ---------- écran du relayeur ---------- */
      .rl-run{position:absolute;inset:0;z-index:8;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto auto minmax(0,1fr);gap:6px;padding:8px 12px 12px;background:radial-gradient(90% 50% at 50% 0%,color-mix(in srgb,var(--tc) 45%,transparent),transparent 70%),linear-gradient(#0b1430,#101c3c);overflow:hidden;touch-action:manipulation}
      .rl-hide{display:none!important}
      .rl-rtop{display:flex;align-items:center;gap:8px}
      .rl-rtop .lg{font-family:Anton,Impact,sans-serif;background:var(--tc);padding:2px 8px;border-radius:6px;font-size:1rem;letter-spacing:.04em;white-space:nowrap}
      .rl-rtop .nm{flex:1;min-width:0;font-weight:800;font-size:1.15rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rl-rtop .ch{font-family:Anton,Impact,sans-serif;font-size:1.6rem;font-variant-numeric:tabular-nums;min-width:3.4em;text-align:right}
      .rl-mini{display:grid;gap:3px}
      .rl-mini div{position:relative;height:9px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}
      .rl-mini i{position:absolute;left:0;top:0;bottom:0;background:var(--c);border-radius:5px;transition:width .3s linear}
      .rl-rp{height:14px;border-radius:8px;background:rgba(255,255,255,.14);overflow:hidden;border:2px solid rgba(255,255,255,.25)}
      .rl-rp i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffd23f,#ff8f1f);transition:width .12s}
      .rl-rh{text-align:center;font-weight:700;font-size:1rem;opacity:.92;line-height:1.2}
      .rl-ev{position:relative;min-height:0;min-width:0;display:grid;grid-template-columns:minmax(0,1fr)}
      .rl-run>*,.rl-ev>*{min-width:0}
      .rl-fl{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:9}
      .rl-fl .rl-fly{bottom:12%;font-size:2.2rem}
      .rl-fl .rl-fly small{font-size:.9rem}
      .rl-cd{position:absolute;inset:0;z-index:10;display:grid;place-items:center;align-content:center;text-align:center;background:var(--tc);pointer-events:none}
      .rl-cd b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(2.6rem,13vw,5rem);line-height:1;text-shadow:4px 4px 0 rgba(0,0,0,.3)}
      .rl-cd span{display:block;font-family:Pacifico,cursive;font-size:1.5rem;margin-top:8px}
      .rl-cd .n{font-size:clamp(6rem,40vw,11rem);animation:rl-zoom .45s ease-out}
      .rl-cd.out{animation:rl-out .35s forwards}
      @keyframes rl-out{to{opacity:0}}
      .rl-cd.flash b{animation:rl-zoom .5s ease-out}
      .rl-pen{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-family:Anton,Impact,sans-serif;font-size:2.4rem;color:#ff5a5a;text-shadow:2px 2px 0 #000;pointer-events:none;z-index:9;animation:rl-penA 1s forwards;white-space:nowrap}
      @keyframes rl-penA{from{transform:translate(-50%,10px) scale(1.4)}to{transform:translate(-50%,-50px);opacity:0}}
      .rl-big{text-align:center;font-family:Anton,Impact,sans-serif;font-size:3rem;line-height:1;font-variant-numeric:tabular-nums}
      .rl-big small{font-size:1.4rem;opacity:.7}
      .rl-done{position:absolute;inset:0;z-index:10;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;background:linear-gradient(color-mix(in srgb,var(--tc) 70%,#0b1430),#0b1430)}
      .rl-done b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.8rem,9vw,2.4rem);padding:0 10px;line-height:1;animation:rl-zoom .5s ease-out}
      .rl-done .t{font-family:Anton,Impact,sans-serif;font-size:3.4rem;color:#ffd23f}
      .rl-done span{font-weight:700;font-size:1.15rem}
      .rl-done .rl-baton{width:90px;animation:rl-pass 1s ease-in-out infinite alternate}
      @keyframes rl-pass{from{transform:translateX(-30px) rotate(-20deg)}to{transform:translateX(30px) rotate(20deg)}}
      .shake{animation:rl-shake .3s}
      @keyframes rl-shake{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
      /* sprint */
      .rl-sp{display:grid;grid-template-rows:auto auto 1fr;gap:8px;min-height:0}
      .rl-tread{position:relative;height:120px;display:grid;justify-items:center;align-items:end}
      .rl-tav{width:92px;height:92px;border-radius:50%;overflow:hidden;background:#f4e6c8;border:3px solid var(--tc);position:relative;z-index:1;margin-bottom:12px;transition:transform .08s}
      .rl-tav.hop{transform:translateY(-6px) rotate(var(--r,4deg))}
      .rl-belt{position:absolute;left:8%;right:8%;bottom:0;height:22px;border-radius:12px;border:3px solid #0a0f1f;background:repeating-linear-gradient(90deg,#2a2f3a 0 14px,#3c4352 14px 22px);transition:background-position .1s}
      .rl-feet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-height:0}
      .rl-foot{appearance:none;border:3px solid #0a0f1f;border-radius:20px;background:linear-gradient(#3d4a6e,#26304d);color:#fff;font-family:Anton,Impact,sans-serif;font-size:1.3rem;display:grid;place-items:center;align-content:center;gap:4px;min-height:150px;cursor:pointer;touch-action:manipulation;box-shadow:0 6px 0 #0a0f1f}
      .rl-foot .f{font-size:3rem}
      .rl-foot[data-s="0"] .f{transform:scaleX(-1)}
      .rl-foot.nx{background:linear-gradient(#ffe066,#ffb703);color:#1a1200}
      .rl-foot:active{transform:translateY(4px);box-shadow:0 2px 0 #0a0f1f}
      .rl-foot.bad{animation:rl-shake .25s;background:#7a1f2b}
      /* développé */
      .rl-dv{display:grid;grid-template-rows:auto auto auto 1fr;gap:10px;min-height:0;cursor:pointer}
      .rl-lift{position:relative;height:130px;display:grid;justify-items:center;align-items:end}
      .rl-lift .rl-tav{width:84px;height:84px;margin:0}
      .rl-bar{position:absolute;left:6%;right:6%;top:52px;height:10px;background:linear-gradient(#e0e4ea,#7d8592);border:2px solid #0a0f1f;border-radius:5px;transition:top .18s ease-out;z-index:2}
      .rl-bar::before,.rl-bar::after{content:"";position:absolute;top:-22px;width:16px;height:50px;border-radius:5px;background:#e63946;border:2px solid #0a0f1f}
      .rl-bar::before{left:4px}.rl-bar::after{right:4px}
      .rl-lift.up .rl-bar{top:8px}
      .rl-gauge{position:relative;height:56px;border-radius:14px;border:3px solid #0a0f1f;background:repeating-linear-gradient(90deg,#28324e 0 10%,#222a42 10% 20%);overflow:hidden;box-shadow:inset 0 3px 8px rgba(0,0,0,.6)}
      .rl-zone{position:absolute;top:0;bottom:0;background:linear-gradient(#5ff2a8,#21a866);border-left:2px solid #c9ffe2;border-right:2px solid #c9ffe2;box-shadow:0 0 16px rgba(60,207,142,.7)}
      .rl-needle{position:absolute;top:-4px;bottom:-4px;width:6px;margin-left:-3px;background:#fff;border-radius:3px;box-shadow:0 0 8px #fff}
      .rl-gauge.hit{box-shadow:0 0 0 3px #5ff2a8,0 0 22px rgba(95,242,168,.8)}
      .rl-gauge.miss{animation:rl-shake .3s;box-shadow:0 0 0 3px #ff5a5a}
      .rl-reps{display:flex;justify-content:center;gap:8px}
      .rl-reps i{width:30px;height:30px;border-radius:50%;border:3px solid #0a0f1f;background:rgba(255,255,255,.12)}
      .rl-reps i.on{background:radial-gradient(circle,#0a0f1f 18%,#ffd23f 22%)}
      .rl-push{align-self:stretch;border-radius:20px;border:3px dashed rgba(255,255,255,.35);display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:2.4rem;letter-spacing:.05em;color:#ffd23f;min-height:120px}
      /* réflexe */
      .rl-rx{display:grid;grid-template-rows:auto 1fr auto;gap:10px;justify-items:center;border-radius:20px;padding:12px;cursor:pointer;transition:background-color .05s;min-height:0}
      .rl-rx[data-s="wait"]{background:#7a1622}
      .rl-rx[data-s="go"]{background:#1d9a45}
      .rl-rx[data-s="pause"],.rl-rx[data-s="early"]{background:#2a2f45}
      .rl-lights{display:flex;gap:12px}
      .rl-lights i{width:28px;height:28px;border-radius:50%;border:3px solid #0a0f1f;background:#3a3f55}
      .rl-lights i.ok{background:#5ff2a8;box-shadow:0 0 10px #5ff2a8}
      .rl-lamp{align-self:center;width:min(60vw,220px);aspect-ratio:1;border-radius:50%;border:8px solid #0a0f1f;background:#3a0b10;display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:2rem;text-align:center;line-height:1.05;box-shadow:inset 0 6px 18px rgba(0,0,0,.6)}
      .rl-rx[data-s="wait"] .rl-lamp{background:radial-gradient(circle at 40% 35%,#ff8a8a,#d1202f 60%,#7a0d16)}
      .rl-rx[data-s="go"] .rl-lamp{background:radial-gradient(circle at 40% 35%,#c9ffd9,#2ee06a 55%,#138a3a);color:#06210f;box-shadow:0 0 40px #2ee06a}
      .rl-rxm{font-size:1.3rem;font-weight:800;min-height:1.4em}
      /* gainage */
      .rl-gn{display:grid;grid-template-rows:auto 1fr;gap:8px;min-height:0}
      .rl-arena{position:relative;min-height:260px;border-radius:20px;border:3px solid rgba(255,255,255,.25);background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.07) 0 30%,transparent 31%),repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 32px),#151f3d;touch-action:none;overflow:hidden;cursor:pointer}
      .rl-tgt{position:absolute;left:0;top:0;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;pointer-events:none;will-change:transform}
      .rl-tgt svg{width:100%;height:100%;display:block}
      .rl-tgt .core{fill:#ff8f1f;transition:fill .1s}
      .rl-tgt.on .core{fill:#5ff2a8}
      .rl-tgt.on{filter:drop-shadow(0 0 12px #5ff2a8)}
      .rl-arena.lost{border-color:#ff5a5a}
      .rl-arena .lbl{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-weight:800;font-size:1.05rem;opacity:.85;pointer-events:none}
      /* mémoire */
      .rl-mm{display:grid;grid-template-rows:auto auto auto;align-content:space-evenly;gap:14px;min-height:0}
      .rl-mbar{position:relative;height:120px;display:flex;align-items:center;justify-content:center;gap:6px}
      .rl-mbar::before{content:"";position:absolute;left:2%;right:2%;top:50%;height:12px;margin-top:-6px;border-radius:6px;background:linear-gradient(#e0e4ea,#7d8592);border:2px solid #0a0f1f}
      .rl-slot{position:relative;width:38px;height:100px;border-radius:9px;border:3px dashed rgba(255,255,255,.45);display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:1.3rem;color:rgba(255,255,255,.7);background:rgba(10,15,31,.6)}
      .rl-slot.f{border:3px solid #0a0f1f;color:#0a0f1f;animation:rl-zoom .3s ease-out;writing-mode:vertical-rl}
      .rl-slot.cur{border-color:#ffd23f}
      .rl-mmsg{text-align:center;font-family:Anton,Impact,sans-serif;font-size:1.6rem;letter-spacing:.04em;color:#ffd23f;min-height:1.3em}
      .rl-pbs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;align-content:start}
      .rl-pb{appearance:none;aspect-ratio:1;border-radius:50%;border:4px solid #0a0f1f;font-family:Anton,Impact,sans-serif;font-size:1.25rem;color:#0a0f1f;cursor:pointer;box-shadow:0 4px 0 #0a0f1f,inset 0 0 0 7px rgba(0,0,0,.15);touch-action:manipulation;display:grid;place-items:center;padding:0}
      .rl-pb:disabled{opacity:.35}
      .rl-pb:active{transform:translateY(3px)}
      /* podium */
      .rl-pod{position:absolute;inset:0;z-index:12;display:grid;align-content:center;justify-items:center;gap:12px;padding:16px;background:radial-gradient(80% 50% at 50% 30%,rgba(255,210,63,.25),transparent 70%),rgba(8,12,28,.94);text-align:center;overflow:hidden}
      .rl-pod h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2.6rem;letter-spacing:.05em;color:#ffd23f;text-shadow:3px 3px 0 #000}
      .rl-steps{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;width:min(100%,420px)}
      .rl-step{display:grid;gap:6px;justify-items:center;min-width:0}
      .rl-step .bu{display:flex;justify-content:center;flex-wrap:wrap;gap:2px}
      .rl-pm{width:42px;height:42px;border-radius:50%;overflow:hidden;background:#f4e6c8;border:2px solid var(--tc)}
      .rl-step .tn{font-weight:800;text-transform:uppercase;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .rl-step .bl{width:100%;border-radius:10px 10px 0 0;background:linear-gradient(var(--tc),color-mix(in srgb,var(--tc) 50%,#000));display:grid;align-content:start;justify-items:center;padding-top:8px;border:3px solid #0a0f1f;border-bottom:0}
      .rl-step .bl b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2.6rem;line-height:1}
      .rl-step .bl span{font-family:Anton,Impact,sans-serif;font-size:1.25rem}
      .rl-step.p1 .bl{height:150px}.rl-step.p2 .bl{height:95px}
      .rl-pod p{margin:0;font-size:1.2rem;font-weight:700;max-width:24em}
      .rl-conf{position:absolute;top:-20px;width:9px;height:14px;animation:rl-fall linear forwards;pointer-events:none}
      @keyframes rl-fall{to{transform:translateY(110vh) rotate(720deg)}}
      @media (prefers-reduced-motion:reduce){.rl *{animation:none!important;transition:none!important}}
    </style>
    <div class="rl" id="rl-root">
      <header class="rl-hd"><h2>RELAIS MUSCU</h2><span>passe le témoin !</span></header>
      <div class="rl-sb" id="rl-sb"></div>
      <div class="rl-msg" id="rl-msg" role="status" aria-live="polite"></div>
      <div class="rl-stad" id="rl-stad"></div>
      <div class="rl-cards" id="rl-cards"></div>
      <div class="rl-cheer rl-hide" id="rl-cheer"><h4>ENCOURAGE TON ÉQUIPE</h4><div class="row">
        <button type="button" class="rl-cb" data-c="0">ALLEZ ! 💪</button>${CHEERS.slice(1).map((c, i) => `<button type="button" class="rl-cb e" data-c="${i + 1}" aria-label="Encourager ${c}">${c}</button>`).join("")}
      </div></div>
      <div class="rl-flash" id="rl-flash"></div>
      <div class="rl-run rl-hide" id="rl-run"></div>
      <div class="rl-pod rl-hide" id="rl-pod"></div>
    </div>`;
    const $ = id => el.querySelector("#" + id);
    const root = $("rl-root"), sbEl = $("rl-sb"), msgEl = $("rl-msg"), stad = $("rl-stad"), cardsEl = $("rl-cards"), cheerEl = $("rl-cheer"), flashEl = $("rl-flash"), runEl = $("rl-run"), podEl = $("rl-pod");

    /* ================= son & vibrations ================= */
    function beep(f, d, type, vol) {
      if (!ac) return;
      try {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
        o.type = type || "square"; o.frequency.value = f;
        g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (d || 0.08));
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + (d || 0.08) + 0.02);
      } catch (e) { /* rien */ }
    }
    const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* rien */ } };
    function onGesture() { if (ac) return; try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) { ac = null; } }

    /* ================= entrées (mon téléphone) ================= */
    const inp = {leg: -1, a: -1, prog: 0, done: false, t: 0, cheer: 0, ce: 0};
    let lastPush = 0;
    function push() { if (!api.isPlayer) return; lastPush = performance.now(); api.setInput(Object.assign({}, inp)); }

    /* ================= hôte ================= */
    let st = null;
    const H = {legStart: [0, 0], miss: {}, cheer: {}, inputs: {}, t0: 0, dirty: false, lastPub: 0, pubT: 0, ended: false, lastCon: 0};
    function pickEvents(n) {
      const out = [];
      while (out.length < n) {
        const b = [0, 1, 2, 3, 4];
        for (let i = 4; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
        if (out.length && b[0] === out[out.length - 1]) b.push(b.shift());
        out.push(...b);
      }
      return out.slice(0, n);
    }
    function mkTeam(i) {
      const keys = TK[i], ru = [];
      for (let j = 0; j < L; j++) ru.push(keys.length ? seatOf[keys[j % keys.length]] : -1);
      return {l: 0, a: 0, r: ru[0], ru, p: 0, x: 0, t: [], f: keys.length ? 0 : 2, k: 0, ft: 0};
    }
    function publish() {
      if (!st || dead) return;
      H.dirty = false; H.lastPub = performance.now();
      if (H.pubT) { clearTimeout(H.pubT); timers.delete(H.pubT); H.pubT = 0; }
      api.setState(JSON.parse(JSON.stringify(st)));
    }
    function schedulePub() {
      if (!H.dirty || H.pubT) return;
      const w = 200 - (performance.now() - H.lastPub);
      if (w <= 0) publish(); else H.pubT = later(() => { H.pubT = 0; if (H.dirty) publish(); }, w);
    }
    function hostInputs(m) {
      H.inputs = m || {};
      if (!st || st.ph === "end") return;
      for (const k in H.inputs) {
        const v = H.inputs[k], c = v && v.cheer | 0, prev = H.cheer[k] || 0, ti = teamOf(k);
        if (c > prev && ti >= 0) { st.tm[ti].k += Math.min(c - prev, 20); H.dirty = true; }
        if (c > prev) H.cheer[k] = c;
      }
      if (st.ph === "race") {
        const now = Date.now();
        for (let i = 0; i < 2; i++) {
          const tm = st.tm[i];
          if (tm.f) continue;
          const v = H.inputs[keyOf(tm.r)];
          if (!v || v.leg !== tm.l || v.a !== tm.a) continue;
          const x = clamp(Math.round(+v.t || 0), 0, 600000), p = clamp(Math.round((+v.prog || 0) * 100), 0, 100);
          if (v.done) {
            tm.t.push(Math.max(300, x)); tm.l++; tm.p = 0; tm.x = 0;
            if (tm.l >= L) { tm.f = 1; tm.ft = sum(tm.t); } else { tm.a++; tm.r = tm.ru[tm.l]; H.legStart[i] = now; }
            H.dirty = true;
          } else if (p !== tm.p || Math.abs(x - tm.x) >= 150) { tm.p = p; tm.x = x; H.dirty = true; }
        }
        checkEnd();
      }
      schedulePub();
    }
    function checkCon() {
      const con = new Set(api.connected());
      P.forEach(p => { H.miss[p.key] = con.has(p.key) ? 0 : (H.miss[p.key] || 0) + 1; });
      const gone = k => H.miss[k] >= 2;
      for (let i = 0; i < 2; i++) {
        const tm = st.tm[i], keys = TK[i];
        if (tm.f) continue;
        if (!keys.some(k => !gone(k))) { tm.f = 2; H.dirty = true; continue; }
        for (let j = tm.l; j < L; j++) {
          const k = keyOf(tm.ru[j]);
          if (k && !gone(k)) continue;
          const idx = Math.max(0, keys.indexOf(k));
          for (let d = 1; d <= keys.length; d++) { const c = keys[(idx + d) % keys.length]; if (!gone(c)) { tm.ru[j] = seatOf[c]; break; } }
          H.dirty = true;
        }
        if (tm.r !== tm.ru[tm.l]) { tm.r = tm.ru[tm.l]; tm.a++; tm.p = 0; tm.x = 0; H.legStart[i] = Date.now(); H.dirty = true; }
      }
    }
    function hostTick() {
      if (!st || st.ph !== "race") return;
      const now = Date.now();
      if (now - H.lastCon >= 1000) { H.lastCon = now; checkCon(); }
      checkEnd();
      schedulePub();
    }
    function checkEnd() {
      if (H.ended || st.ph !== "race") return;
      const [A, B] = st.tm, now = Date.now();
      const est = i => sum(st.tm[i].t) + Math.max(st.tm[i].x, now - H.legStart[i] - 4500);
      let why = "";
      if (A.f && B.f) why = "both";
      else if (A.f === 2 || B.f === 2) why = "ff";
      else if (A.f === 1 && est(1) > A.ft + BEHIND_MS) why = "slow";
      else if (B.f === 1 && est(0) > B.ft + BEHIND_MS) why = "slow";
      else if (now - H.t0 > CAP_MS) why = "cap";
      if (!why) return;
      H.ended = true;
      let w = -1;
      if (A.f === 1 && B.f === 1) w = A.ft < B.ft ? 0 : B.ft < A.ft ? 1 : -1;
      else if (A.f === 1 || B.f === 1) w = A.f === 1 ? 0 : 1;
      else if (A.f === 2 || B.f === 2) w = A.f === 2 && B.f === 2 ? -1 : A.f === 2 ? 1 : 0;
      else { const pa = A.l + A.p / 100, pb = B.l + B.p / 100; w = pa > pb ? 0 : pb > pa ? 1 : -1; }
      const n = i => TEAMS[i].name;
      // « Équipe rouge finit » mais « Les Protéinés finissent »
      const pl = i => !/^(équipe|team|la |le |l')/i.test(TEAMS[i].name.trim());
      const v = (i, sg, pr) => (pl(i) ? pr : sg);
      let s;
      if (w < 0) s = A.f === 2 && B.f === 2 ? "Les deux équipes abandonnent : match nul." : `Égalité parfaite entre ${n(0)} et ${n(1)} !`;
      else {
        const W = st.tm[w], Lo = st.tm[1 - w];
        if (W.f === 1 && Lo.f === 1) {
          const d = Lo.ft - W.ft;
          s = `${n(w)} ${v(w, "finit", "finissent")} en ${mmss(W.ft)}, ${d >= 10000 ? Math.round(d / 1000) + " s" : sec(d)} devant`;
        } else if (Lo.f === 2) s = `${n(1 - w)} ${v(1 - w, "abandonne", "abandonnent")} : ${n(w)} ${v(w, "l'emporte", "l'emportent")}${W.f === 1 ? " en " + mmss(W.ft) : ""}`;
        else if (W.f === 1) s = `${n(w)} ${v(w, "finit", "finissent")} en ${mmss(W.ft)}, ${n(1 - w)} à plus d'une minute`;
        else s = `Temps écoulé (4 min) : ${n(w)} ${v(w, "était", "étaient")} en tête`;
      }
      st.ph = "end"; st.end = {w, s: s.slice(0, 160), why};
      publish();
      later(() => {
        const winners = w >= 0 ? TK[w].slice() : [];
        const ranking = w >= 0 ? TK[w].concat(TK[1 - w]) : TK[0].concat(TK[1]);
        api.finish({winners, ranking, summary: st.end.s});
      }, END_MS);
    }
    if (api.isHost) {
      const forced = window.__rlTest && Array.isArray(window.__rlEv) ? window.__rlEv.slice(0, L).map(v => clamp(v | 0, 0, 4)) : [];
      st = {ph: "intro", L, ev: forced.concat(pickEvents(L)).slice(0, L), sd: Math.floor(Math.random() * 2e9), tm: [mkTeam(0), mkTeam(1)], end: null};
      publish();
      later(() => { st.ph = "race"; H.t0 = Date.now(); H.legStart = [H.t0, H.t0]; publish(); }, INTRO_MS);
      api.onInputs(hostInputs);
      ivs.push(setInterval(hostTick, 250));
    }

    /* ================= affichage commun ================= */
    let S = null, recvAt = 0, built = "", prevL = null, introShown = false, podShown = false;
    const laneRefs = [];
    function buildStatic(s) {
      sbEl.innerHTML = [0, 1].map(i => `<div class="rl-tb${i === myTeam ? " me" : ""}" style="--tc:${COL[i]}">${i === myTeam ? '<span class="you">TON ÉQUIPE</span>' : ""}
        <span class="tn">${TN(i)}</span><span class="ch" id="rl-ch${i}">0:00,0</span><span class="rn" id="rl-rn${i}"></span><span class="lg"><span id="rl-lg${i}"></span><span id="rl-ck${i}">💪 0</span></span></div>`).join("");
      cardsEl.innerHTML = s.ev.map((e, j) => `<div class="rl-card" id="rl-cd${j}"><span class="no">${j + 1}</span><span class="ic" aria-hidden="true">${EV[e].i}</span><span class="nm">${EV[e].n}</span>
        <span class="rl-pips">${[0, 1].map(i => `<i style="--tc:${COL[i]}" id="rl-pp${i}-${j}"></i>`).join("")}</span><small id="rl-ct${j}"></small></div>`).join("");
    }
    function buildLane(i, s) {
      const tm = s.tm[i];
      const ticks = Array.from({length: L - 1}, (_, j) => `<div class="rl-tick" style="left:${((j + 1) / L * 100).toFixed(2)}%"><span>${j + 2}</span></div>`).join("");
      const toks = tm.ru.map((seat, j) => `<div class="rl-tok" style="left:calc(${(j / L).toFixed(4)} * (100% - 30px))" title="${nameOf(seat)}">${bust(seat)}</div>`).join("");
      return `<div class="rl-lno">${i + 1}</div><div class="rl-trk">${ticks}<div class="rl-fin"></div><div class="rl-rib"></div>${toks}
        <div class="rl-cur" style="left:0"><div class="rl-face">${bust(tm.r)}</div>${BATON}</div></div><div class="rl-lfl"></div>`;
    }
    function ensureLanes(s) {
      for (let i = 0; i < 2; i++) {
        const sig = s.tm[i].ru.join(",");
        let ref = laneRefs[i];
        if (!ref) {
          const d = document.createElement("div");
          d.className = "rl-lane"; d.style.setProperty("--tc", COL[i]);
          stad.appendChild(d);
          ref = laneRefs[i] = {el: d, sig: "", r: -2};
        }
        if (ref.sig !== sig) {
          ref.el.innerHTML = buildLane(i, s); ref.sig = sig; ref.r = s.tm[i].r;
          ref.toks = [...ref.el.querySelectorAll(".rl-tok")]; ref.cur = ref.el.querySelector(".rl-cur"); ref.face = ref.el.querySelector(".rl-face");
          ref.fl = ref.el.querySelector(".rl-lfl");
        }
        if (ref.r !== s.tm[i].r) { ref.r = s.tm[i].r; ref.face.innerHTML = bust(s.tm[i].r); }
      }
    }
    const teamProg = tm => (tm.f === 1 ? 1 : (tm.l + tm.p / 100) / L);
    function teamTime(i, now) {
      const s = S, tm = s.tm[i];
      if (tm.f === 1) return tm.ft;
      let x = tm.x;
      if (s.ph === "race" && !tm.f && x > 0) x += Math.min(800, now - recvAt);
      return sum(tm.t) + x;
    }
    function banner(i, big, small) {
      const b = document.createElement("div");
      b.className = "rl-ban"; b.style.setProperty("--tc", COL[i]);
      b.innerHTML = `<b>${big}</b><span>${small}</span>`;
      flashEl.appendChild(b);
      later(() => b.remove(), RM ? 1300 : 1750);
    }
    function render(s) {
      if (dead || !s || !s.tm) return;
      const first = !S;
      S = s; recvAt = performance.now();
      if (first || built !== s.ev.join(",")) { buildStatic(s); built = s.ev.join(","); }
      ensureLanes(s);
      for (let i = 0; i < 2; i++) {
        const tm = s.tm[i], ref = laneRefs[i], f = teamProg(tm);
        ref.cur.style.left = `calc(${f.toFixed(4)} * (100% - 46px))`;
        ref.cur.classList.toggle("go", s.ph === "race" && !tm.f);
        ref.cur.classList.toggle("fin", tm.f === 1);
        ref.el.classList.toggle("won", tm.f === 1);
        ref.toks.forEach((t, j) => { t.className = "rl-tok" + (j < tm.l ? " done" : j === tm.l && !tm.f ? " now" : ""); });
        $("rl-rn" + i).textContent = tm.f === 1 ? "🏁 Ligne franchie" : tm.f === 2 ? "Équipe hors course" : `${EV[s.ev[tm.l]].i} ${P[tm.r] ? P[tm.r].pseudo : "?"} · ${s.ph === "race" ? tm.p + " %" : "en place"}`;
        $("rl-lg" + i).textContent = tm.f === 1 ? "🏁 Arrivée !" : tm.f === 2 ? "Abandon" : `Relais ${tm.l + 1}/${L}`;
        $("rl-ck" + i).textContent = `💪 ${tm.k}`;
        for (let j = 0; j < L; j++) {
          const pp = $(`rl-pp${i}-${j}`);
          if (pp) pp.className = j < tm.t.length ? "done" : j === tm.l && !tm.f && s.ph === "race" ? "live" : "";
        }
        if (prevL && s.ph !== "end") {
          if (tm.l > prevL[i] && tm.l < L && !tm.f) banner(i, "PASSAGE DE RELAIS", `${nameOf(tm.ru[tm.l - 1])} ➜ ${nameOf(tm.r)}`);
          else if (tm.f === 1 && prevL[i] < L) banner(i, "ARRIVÉE !", `${TN(i)} · ${chrono(tm.ft)}`);
        }
      }
      for (let j = 0; j < L; j++) {
        const c = $("rl-ct" + j);
        if (c) c.innerHTML = [0, 1].map(i => (s.tm[i].t[j] != null ? `<span style="color:${COL[i] === "#3a86ff" ? "#1f5fd1" : "#c1121f"}">${sec(s.tm[i].t[j]).replace(" s", "")}</span>` : "")).filter(Boolean).join(" · ");
        const card = $("rl-cd" + j);
        if (card && myTeam >= 0) card.classList.toggle("mine", s.tm[myTeam].ru[j] === seatOf[api.me] && j >= s.tm[myTeam].l && !s.tm[myTeam].f);
      }
      prevL = s.tm.map(t => (t.f === 1 ? L : t.l));
      // intro
      if (s.ph === "intro" && !introShown) {
        introShown = true;
        const d = document.createElement("div"); d.className = "rl-intro"; d.textContent = "À VOS MARQUES…";
        flashEl.appendChild(d); later(() => d.remove(), INTRO_MS - 200);
      }
      renderMsg(s);
      // relayeur
      if (myTeam >= 0 && s.ph === "race") {
        const tm = s.tm[myTeam];
        if (!tm.f && keyOf(tm.r) === api.me && (!run || run.key !== tm.l + ":" + tm.a)) startLeg(tm.l, tm.a, s.ev[tm.l], s.sd);
      }
      if (run) {
        const tm = myTeam >= 0 ? s.tm[myTeam] : null;
        const still = tm && s.ph === "race" && !tm.f && tm.l === run.leg && tm.a === run.a;
        if (!still) {
          if (!run.done || s.ph === "end") stopRun();
          else if (!run.closing) { run.closing = true; const R = run; later(() => { if (run === R) stopRun(); }, Math.max(0, 1700 - (performance.now() - R.doneAt))); }
        }
        if (run) updMini(s);
      }
      cheerEl.classList.toggle("rl-hide", !(api.isPlayer && myTeam >= 0 && s.ph !== "end"));
      if (s.ph === "end" && !podShown) { podShown = true; showPodium(s); }
    }
    function renderMsg(s) {
      if (s.ph === "intro") { msgEl.innerHTML = myTeam >= 0 ? (keyOf(s.tm[myTeam].r) === api.me ? "Tu pars en premier : <b>prépare-toi !</b>" : `Premier relayeur : <b>${nameOf(s.tm[myTeam].r)}</b>`) : `${L} relais, mêmes épreuves pour les deux équipes`; return; }
      if (s.ph === "end") { msgEl.textContent = "Course terminée !"; return; }
      if (myTeam < 0) { msgEl.textContent = "Course en direct"; return; }
      const tm = s.tm[myTeam], me = seatOf[api.me];
      if (tm.f === 1) { msgEl.innerHTML = `Ton équipe a franchi la ligne en <b>${chrono(tm.ft)}</b> ! Encourage… et attends.`; return; }
      if (tm.f === 2) { msgEl.textContent = "Ton équipe a abandonné."; return; }
      let nx = -1;
      for (let j = tm.l + 1; j < L; j++) if (tm.ru[j] === me) { nx = j; break; }
      if (nx === tm.l + 1) msgEl.innerHTML = `<b>Tu es le prochain !</b> Relais ${nx + 1} : ${EV[s.ev[nx]].i} ${EV[s.ev[nx]].n}`;
      else if (nx > 0) msgEl.innerHTML = `Tu cours le relais ${nx + 1} : ${EV[s.ev[nx]].i} <b>${EV[s.ev[nx]].n}</b>`;
      else msgEl.innerHTML = `Allez <b>${nameOf(tm.r)}</b> ! Envoie-lui de la force 💪`;
    }
    function showPodium(s) {
      root.scrollTop = 0; el.scrollTop = 0;
      root.classList.add("lock");
      const w = s.end.w, order = w >= 0 ? [w, 1 - w] : [0, 1];
      const step = (i, place) => {
        const tm = s.tm[i];
        const tt = tm.f === 1 ? chrono(tm.ft) : tm.f === 2 ? "Abandon" : `${Math.round(teamProg(tm) * 100)} %`;
        return `<div class="rl-step p${place}" style="--tc:${COL[i]}"><div class="bu">${TK[i].map(k => `<div class="rl-pm">${api.avatar(k, {view: "bust"})}</div>`).join("")}</div>
          <span class="tn">${TN(i)}</span><div class="bl"><b>${place}</b><span>${tt}</span></div></div>`;
      };
      const places = w >= 0 ? [1, 2] : [1, 1];
      // 2e à gauche, 1er à droite (lecture naturelle d'un podium à deux marches)
      const html = w >= 0 ? step(order[1], 2) + step(order[0], 1) : step(0, 1) + step(1, 1);
      podEl.innerHTML = `<h3>${w >= 0 ? "VICTOIRE !" : "ÉGALITÉ !"}</h3><div style="font-family:Pacifico,cursive;font-size:1.4rem;color:${w >= 0 ? COL[w] : "#fff"}">${w >= 0 ? TN(w) : "Ex æquo"}</div><div class="rl-steps">${html}</div><p>${esc(s.end.s)}</p>`;
      void places;
      podEl.classList.remove("rl-hide");
      if (!RM && w >= 0) for (let i = 0; i < 26; i++) {
        const c = document.createElement("i"); c.className = "rl-conf";
        c.style.left = (Math.random() * 100) + "%"; c.style.background = [COL[w], "#ffd23f", "#fff"][i % 3];
        c.style.animationDuration = (1.8 + Math.random() * 1.8) + "s"; c.style.animationDelay = (Math.random() * .8) + "s";
        podEl.appendChild(c);
      }
      if (myTeam >= 0) { if (w === myTeam) { beep(523, .12, "triangle", .08); later(() => beep(784, .25, "triangle", .08), 140); } buzz(w === myTeam ? [80, 60, 160] : 40); }
    }

    /* ================= encouragements ================= */
    let lastCheer = 0;
    cheerEl.addEventListener("click", e => {
      const b = e.target.closest(".rl-cb");
      if (!b || !S || S.ph === "end" || run) return;
      const now = performance.now();
      if (now - lastCheer < 220) return;
      lastCheer = now;
      inp.cheer++; inp.ce = +b.dataset.c || 0; push();
      beep(660 + 80 * inp.ce, .06, "triangle", .05);
    });
    const cheerSeen = {};
    function floatIn(layer, k, ce, leftPct) {
      if (!layer) return;
      const f = document.createElement("div"); f.className = "rl-fly";
      f.style.left = `calc(${leftPct.toFixed(1)}% - 20px)`;
      f.innerHTML = `${CHEERS[ce] || "💪"}<small>${esc(api.name(k))}</small>`;
      layer.appendChild(f); later(() => f.remove(), 1650);
      while (layer.children.length > 14) layer.firstChild.remove();
    }
    api.onInputs(m => {
      for (const k in m) {
        const v = m[k], c = v ? v.cheer | 0 : 0;
        if (c <= (cheerSeen[k] || 0)) continue;
        cheerSeen[k] = c;
        const ti = teamOf(k), ce = clamp(v.ce | 0, 0, CHEERS.length - 1);
        if (ti < 0) continue;
        if (S && laneRefs[ti]) floatIn(laneRefs[ti].fl, k, ce, 8 + teamProg(S.tm[ti]) * 80);
        if (run && ti === myTeam && k !== api.me) { floatIn(runEl.querySelector(".rl-fl"), k, ce, 10 + Math.random() * 70); beep(880, .05, "sine", .04); }
      }
    });

    /* ================= relais local (le coureur) ================= */
    let run = null;
    function stopRun() {
      if (!run) return;
      try { run.obj && run.obj.destroy && run.obj.destroy(); } catch (e) { /* rien */ }
      run.dead = true; run = null;
      runEl.classList.add("rl-hide"); runEl.innerHTML = "";
      if (!podShown) root.classList.remove("lock");
    }
    function updMini(s) {
      const m = runEl.querySelectorAll(".rl-mini i");
      m.forEach((b, i) => { b.style.width = (teamProg(s.tm[i]) * 100).toFixed(1) + "%"; });
    }
    function startLeg(leg, a, evId, sd) {
      stopRun();
      const R = run = {leg, a, ev: evId, key: leg + ":" + a, t0: 0, pen: 0, prog: 0, done: false, ph: "cd", obj: null, doneAt: 0, closing: false, dead: false};
      R.rng = mulberry((sd ^ Math.imul(leg + 1, 0x9E3779B1)) >>> 0);
      inp.leg = leg; inp.a = a; inp.prog = 0; inp.done = false; inp.t = 0; push();
      el.scrollTop = 0; root.classList.add("lock");
      const E = EV[evId];
      runEl.style.setProperty("--tc", COL[myTeam]);
      runEl.innerHTML = `<div class="rl-rtop"><span class="lg">RELAIS ${leg + 1}/${L}</span><span class="nm">${E.i} ${E.n}</span><span class="ch" id="rl-rch">0,0 s</span></div>
        <div class="rl-mini">${[0, 1].map(i => `<div title="${TN(i)}"><i style="--c:${COL[i]};width:0"></i></div>`).join("")}</div>
        <div class="rl-rp"><i id="rl-rpb"></i></div><div class="rl-rh">${E.h}</div><div class="rl-ev" id="rl-ev"></div><div class="rl-fl"></div>
        <div class="rl-cd flash" id="rl-cdl"><b>${leg ? "PRENDS LE RELAIS !" : "C'EST À TOI !"}</b><span>${E.i} ${E.n}</span></div>`;
      runEl.classList.remove("rl-hide");
      if (S) updMini(S);
      buzz(leg ? [120, 60, 120, 60, 200] : [200, 80, 200]);
      beep(440, .15, "sawtooth", .06);
      const cd = runEl.querySelector("#rl-cdl");
      if (window.__rlAuto) {
        // crochet de test : relais terminé automatiquement avec un temps imposé
        later(() => { if (run !== R) return; cd.remove(); R.ph = "play"; R.pen = Math.max(300, +window.__rlAutoT || 2000); R.prog = 1; legDone(R, true); }, 350);
        return;
      }
      const step = (txt, at, sub) => later(() => { if (run !== R) return; cd.classList.remove("flash"); cd.innerHTML = `<b class="n">${txt}</b>${sub ? `<span>${sub}</span>` : ""}`; beep(txt === "GO !" ? 880 : 520, txt === "GO !" ? .25 : .1, "square", .07); }, at);
      step("3", 1100, "Prépare-toi…"); step("2", 1800); step("1", 2500);
      later(() => {
        if (run !== R) return;
        cd.innerHTML = `<b class="n">GO !</b>`; beep(880, .25, "square", .07);
        R.ph = "play"; R.t0 = performance.now();
        R.obj = MAKERS[evId](runEl.querySelector("#rl-ev"), ctxFor(R));
        later(() => { cd.classList.add("out"); later(() => cd.remove(), 360); }, 280);
        cd.style.pointerEvents = "none";
      }, CD_MS - 100);
    }
    const elapsed = R => (R.t0 ? performance.now() - R.t0 + R.pen : 0);
    function ctxFor(R) {
      return {
        rng: R.rng,
        prog: v => { if (run === R && !R.done) R.prog = clamp(v, 0, 1); },
        pen(ms, label) {
          if (run !== R || R.done) return;
          R.pen += ms; buzz(90); beep(150, .2, "sawtooth", .07);
          const p = document.createElement("div"); p.className = "rl-pen"; p.textContent = label;
          runEl.appendChild(p); later(() => p.remove(), 1000);
        },
        done: () => legDone(R),
        later: (fn, ms) => later(() => { if (run === R && !R.done) fn(); }, ms),
        me: seatOf[api.me]
      };
    }
    function legDone(R, auto) {
      if (run !== R || R.done) return;
      R.done = true; R.doneAt = performance.now();
      const t = auto ? R.pen : elapsed(R);
      R.ft = t;
      inp.prog = 1; inp.done = true; inp.t = Math.round(t); push();
      try { R.obj && R.obj.destroy && R.obj.destroy(); } catch (e) { /* rien */ }
      R.obj = null;
      const tm = S && myTeam >= 0 ? S.tm[myTeam] : null;
      const last = R.leg >= L - 1;
      const nxt = tm && !last ? tm.ru[R.leg + 1] : -1;
      const d = document.createElement("div"); d.className = "rl-done";
      d.innerHTML = `<b>${last ? "ARRIVÉE ! 🏁" : "RELAIS TRANSMIS !"}</b><div class="t">${sec(t)}</div>${BATON}<span>${last ? "Dernier relais bouclé !" : nxt === seatOf[api.me] ? "…et c'est encore toi !" : "Témoin pour " + nameOf(nxt)}</span>`;
      runEl.appendChild(d);
      buzz([60, 40, 60]); beep(660, .1, "triangle", .07); later(() => beep(990, .18, "triangle", .07), 110);
    }

    /* ---------- mini-épreuves ---------- */
    const MAKERS = [
      // 0. Sprint tapis
      function (area, ctx) {
        const N = 40;
        area.innerHTML = `<div class="rl-sp"><div class="rl-tread"><div class="rl-tav">${bust(ctx.me)}</div><div class="rl-belt"></div></div>
          <div class="rl-big"><b>0</b><small> / ${N}</small></div>
          <div class="rl-feet"><button type="button" class="rl-foot nx" data-s="0"><span class="f">👟</span>GAUCHE</button><button type="button" class="rl-foot" data-s="1"><span class="f">👟</span>DROITE</button></div></div>`;
        const feet = [...area.querySelectorAll(".rl-foot")], cnt = area.querySelector(".rl-big b"), belt = area.querySelector(".rl-belt"), av = area.querySelector(".rl-tav");
        let n = 0, nx = 0;
        function down(e) {
          const f = e.target.closest(".rl-foot");
          if (!f) return;
          e.preventDefault();
          const s = +f.dataset.s;
          if (s !== nx) { f.classList.remove("bad"); void f.offsetWidth; f.classList.add("bad"); return; }
          n++; nx = 1 - nx;
          feet.forEach((b, i) => { b.classList.toggle("nx", i === nx); b.classList.remove("bad"); });
          cnt.textContent = n; belt.style.backgroundPosition = `${-n * 11}px 0`;
          av.style.setProperty("--r", (s ? 4 : -4) + "deg"); av.classList.add("hop"); ctx.later(() => av.classList.remove("hop"), 80);
          beep(s ? 300 : 260, .03, "square", .03);
          ctx.prog(n / N);
          if (n >= N) ctx.done();
        }
        area.addEventListener("pointerdown", down);
        return {destroy() { area.removeEventListener("pointerdown", down); }, info: () => ({kind: "sprint", n, next: nx})};
      },
      // 1. Développé (jauge)
      function (area, ctx) {
        const REPS = 5, W = 0.2, SPD = 0.75;
        const zones = []; let prev = 0.5;
        for (let i = 0; i < REPS; i++) { let c = 0.5; for (let k = 0; k < 10; k++) { c = 0.14 + ctx.rng() * 0.72; if (Math.abs(c - prev) > 0.25) break; } zones.push(c); prev = c; }
        area.innerHTML = `<div class="rl-dv"><div class="rl-lift"><div class="rl-bar"></div><div class="rl-tav">${bust(ctx.me)}</div></div>
          <div class="rl-gauge"><div class="rl-zone"></div><div class="rl-needle"></div></div>
          <div class="rl-reps">${"<i></i>".repeat(REPS)}</div><div class="rl-push">POUSSE !</div></div>`;
        const g = area.querySelector(".rl-gauge"), z = area.querySelector(".rl-zone"), nd = area.querySelector(".rl-needle"), lift = area.querySelector(".rl-lift"), reps = [...area.querySelectorAll(".rl-reps i")];
        const t0 = performance.now();
        let r = 0, lock = 0;
        const pos = now => { const f = ((now - t0) / 1000 * SPD) % 1; return f < 0.5 ? f * 2 : 2 - f * 2; };
        const setZ = () => { z.style.left = ((zones[r] - W / 2) * 100).toFixed(2) + "%"; z.style.width = (W * 100) + "%"; };
        setZ();
        function down(e) {
          if (!e.target.closest(".rl-dv")) return;
          e.preventDefault();
          const now = performance.now();
          if (now < lock || r >= REPS) return;
          const p = pos(now);
          if (Math.abs(p - zones[r]) <= W / 2) {
            reps[r].classList.add("on"); r++;
            g.classList.remove("hit", "miss"); void g.offsetWidth; g.classList.add("hit");
            lift.classList.add("up"); ctx.later(() => lift.classList.remove("up"), 260);
            beep(520 + r * 80, .08, "triangle", .06);
            ctx.prog(r / REPS);
            if (r >= REPS) { ctx.done(); return; }
            setZ();
          } else {
            lock = now + 300;
            g.classList.remove("hit", "miss"); void g.offsetWidth; g.classList.add("miss");
            ctx.pen(500, "+0,5 s");
          }
        }
        area.addEventListener("pointerdown", down);
        return {
          frame(now) { nd.style.left = (pos(now) * 100).toFixed(2) + "%"; },
          destroy() { area.removeEventListener("pointerdown", down); },
          info: () => ({kind: "dev", p: pos(performance.now()), c: zones[r], w: W, r, lock: performance.now() < lock})
        };
      },
      // 2. Réflexe
      function (area, ctx) {
        const delays = [0, 1, 2].map(() => 1100 + Math.floor(ctx.rng() * 1600));
        area.innerHTML = `<div class="rl-rx" data-s="wait"><div class="rl-lights"><i></i><i></i><i></i></div><div class="rl-lamp">ATTENDS…</div><div class="rl-rxm">Tape dès que c'est VERT</div></div>`;
        const box = area.querySelector(".rl-rx"), lamp = area.querySelector(".rl-lamp"), msg = area.querySelector(".rl-rxm"), lights = [...area.querySelectorAll(".rl-lights i")];
        let i = 0, ph = "wait", greenAt = 0, goAt = 0;
        const setPh = (p, txt) => { ph = p; box.dataset.s = p; lamp.textContent = txt; };
        const arm = () => { setPh("wait", "ATTENDS…"); greenAt = performance.now() + delays[i]; };
        arm();
        function down(e) {
          if (!e.target.closest(".rl-rx")) return;
          e.preventDefault();
          const now = performance.now();
          if (ph === "wait") {
            ctx.pen(1000, "FAUX DÉPART +1 s");
            setPh("early", "TROP TÔT !"); msg.textContent = "On recommence ce feu…";
            ctx.later(() => { if (ph === "early") arm(); }, 700);
          } else if (ph === "go") {
            const rt = Math.max(0, now - goAt);
            lights[i].classList.add("ok"); i++;
            msg.textContent = `${Math.round(rt)} ms ${rt < 300 ? "⚡ éclair !" : rt < 450 ? "👍" : "🐢"}`;
            beep(990, .06, "square", .06);
            ctx.prog(i / 3);
            if (i >= 3) { setPh("pause", "BRAVO !"); ctx.done(); return; }
            setPh("pause", "PRÊT…");
            ctx.later(() => { if (ph === "pause") arm(); }, 550);
          }
        }
        area.addEventListener("pointerdown", down);
        return {
          frame(now) { if (ph === "wait" && now >= greenAt) { setPh("go", "TOUCHE !"); goAt = now; } },
          destroy() { area.removeEventListener("pointerdown", down); },
          info: () => ({kind: "rx", ph, i})
        };
      },
      // 3. Gainage
      function (area, ctx) {
        const NEED = 6000, R = 42, TOL = 22;
        const p1 = ctx.rng() * 6.28, p2 = ctx.rng() * 6.28, w1 = 1.05 + ctx.rng() * 0.3, w2 = 1.5 + ctx.rng() * 0.3;
        area.innerHTML = `<div class="rl-gn"><div class="rl-big"><b>0,0</b><small> / 6 s</small></div><div class="rl-arena"><div class="rl-tgt"><svg viewBox="0 0 84 84">
          <circle cx="42" cy="42" r="38" fill="rgba(10,15,31,.6)" stroke="#fff" stroke-width="3"/><circle class="ring" cx="42" cy="42" r="34" fill="none" stroke="#ffd23f" stroke-width="7" stroke-dasharray="213.6" stroke-dashoffset="213.6" transform="rotate(-90 42 42)"/>
          <circle class="core" cx="42" cy="42" r="22"/><circle cx="42" cy="42" r="8" fill="#fff"/><circle cx="42" cy="42" r="3" fill="#0a0f1f"/></svg></div><div class="lbl">Pose ton doigt sur la cible et suis-la !</div></div></div>`;
        const ar = area.querySelector(".rl-arena"), tg = area.querySelector(".rl-tgt"), ring = area.querySelector(".ring"), big = area.querySelector(".rl-big b"), lbl = area.querySelector(".lbl");
        const t0 = performance.now();
        let held = 0, last = t0, down = false, px = 0, py = 0, tx = 0, ty = 0, on = false, wasOn = false;
        const rel = e => { const b = ar.getBoundingClientRect(); px = e.clientX - b.left; py = e.clientY - b.top; };
        const pd = e => { e.preventDefault(); down = true; rel(e); try { ar.setPointerCapture(e.pointerId); } catch (x) { /* rien */ } };
        const pm = e => { if (down) rel(e); };
        const pu = () => { down = false; };
        ar.addEventListener("pointerdown", pd); ar.addEventListener("pointermove", pm);
        ar.addEventListener("pointerup", pu); ar.addEventListener("pointercancel", pu); ar.addEventListener("lostpointercapture", pu);
        function place(now) {
          const s = (now - t0) / 1000, w = ar.clientWidth, h = ar.clientHeight;
          const sp = 1 + Math.min(0.5, s / 20);
          tx = R + (0.5 + 0.5 * Math.sin(w1 * s * sp + p1)) * Math.max(0, w - 2 * R);
          ty = R + (0.5 + 0.5 * Math.sin(w2 * s * sp + p2)) * Math.max(0, h - 2 * R);
          tg.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
        }
        place(t0);
        return {
          frame(now) {
            const dt = Math.min(100, now - last); last = now;
            place(now);
            on = down && Math.hypot(px - tx, py - ty) <= R + TOL;
            if (on) held += dt;
            if (on !== wasOn) { tg.classList.toggle("on", on); ar.classList.toggle("lost", !on && held > 0); lbl.textContent = on ? "Tiens bon ! 🔥" : held > 0 ? "Contact perdu : pause !" : "Pose ton doigt sur la cible et suis-la !"; wasOn = on; }
            ring.setAttribute("stroke-dashoffset", (213.6 * (1 - Math.min(1, held / NEED))).toFixed(1));
            big.textContent = (Math.min(held, NEED) / 1000).toFixed(1).replace(".", ",");
            ctx.prog(held / NEED);
            if (held >= NEED) ctx.done();
          },
          destroy() { ar.removeEventListener("pointerdown", pd); ar.removeEventListener("pointermove", pm); ar.removeEventListener("pointerup", pu); ar.removeEventListener("pointercancel", pu); ar.removeEventListener("lostpointercapture", pu); },
          info: () => { const b = ar.getBoundingClientRect(); return {kind: "gain", x: b.left + tx, y: b.top + ty, held, on}; }
        };
      },
      // 4. Haltère mémoire
      function (area, ctx) {
        const N = 4, SHOW = 800, seq = [];
        for (let i = 0; i < N; i++) { let c; do { c = Math.floor(ctx.rng() * PLATES.length); } while (seq.length && c === seq[seq.length - 1]); seq.push(c); }
        area.innerHTML = `<div class="rl-mm"><div class="rl-mbar">${"<div class='rl-slot'>?</div>".repeat(N)}</div><div class="rl-mmsg">MÉMORISE !</div>
          <div class="rl-pbs">${PLATES.map((p, i) => `<button type="button" class="rl-pb" data-c="${i}" disabled style="background:${p.c}" aria-label="Disque ${p.w} kg">${p.w}</button>`).join("")}</div></div>`;
        const slots = [...area.querySelectorAll(".rl-slot")], msg = area.querySelector(".rl-mmsg"), btns = [...area.querySelectorAll(".rl-pb")];
        let ph = "show", idx = 0;
        const fill = (j, c) => { const s = slots[j]; s.className = "rl-slot f"; s.style.background = PLATES[c].c; s.textContent = PLATES[c].w; s.style.height = (70 + (4 - c) * 8) + "px"; };
        const clear = j => { const s = slots[j]; s.className = "rl-slot"; s.style.background = ""; s.style.height = ""; s.textContent = "?"; };
        seq.forEach((c, j) => ctx.later(() => { fill(j, c); beep(400 + c * 90, .1, "triangle", .05); }, 250 + j * SHOW));
        ctx.later(() => {
          slots.forEach((_, j) => clear(j)); slots[0].classList.add("cur");
          ph = "in"; msg.textContent = "À TOI : CHARGE LA BARRE !"; btns.forEach(b => { b.disabled = false; });
        }, 250 + N * SHOW + 350);
        function down(e) {
          const b = e.target.closest(".rl-pb");
          if (!b || ph !== "in") return;
          e.preventDefault();
          const c = +b.dataset.c;
          if (c === seq[idx]) {
            fill(idx, c); idx++; beep(500 + idx * 100, .08, "triangle", .06);
            if (slots[idx]) slots[idx].classList.add("cur");
            ctx.prog(idx / N);
            if (idx >= N) { ph = "done"; msg.textContent = "BARRE CHARGÉE !"; ctx.done(); }
          } else {
            ctx.pen(1000, "+1 s");
            const bar = area.querySelector(".rl-mbar"); bar.classList.remove("shake"); void bar.offsetWidth; bar.classList.add("shake");
          }
        }
        area.addEventListener("pointerdown", down);
        return {destroy() { area.removeEventListener("pointerdown", down); }, info: () => ({kind: "mem", ph, idx, seq: ph === "in" ? seq.slice() : null})};
      }
    ];

    /* ================= boucle ================= */
    let lastUi = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const R = run;
      if (R && R.ph === "play" && !R.done && R.obj) {
        if (R.obj.frame) R.obj.frame(now);
        if (run === R && !R.done) {
          const e = elapsed(R);
          const ch = runEl.querySelector("#rl-rch"), pb = runEl.querySelector("#rl-rpb");
          if (ch) ch.textContent = sec(e);
          if (pb) pb.style.width = (R.prog * 100).toFixed(1) + "%";
          if (now - lastPush >= 200) { inp.prog = R.prog; inp.t = Math.round(e); inp.done = false; push(); }
        }
      }
      if (S && now - lastUi > 100) {
        lastUi = now;
        for (let i = 0; i < 2; i++) { const c = $("rl-ch" + i); if (c) c.textContent = chrono(teamTime(i, now)); }
      }
    }
    raf = requestAnimationFrame(frame);
    // filet de sécurité : si mon « fini » ne semble pas reçu, je le renvoie
    ivs.push(setInterval(() => {
      if (run && run.done && S && myTeam >= 0) { const tm = S.tm[myTeam]; if (tm.l === run.leg && tm.a === run.a && performance.now() - lastPush > 900) push(); }
    }, 500));
    root.addEventListener("pointerdown", onGesture, true);
    api.onState(render);

    if (window.__rlTest) window.__rl = {
      info: () => ({run: run ? {leg: run.leg, a: run.a, ev: run.ev, ph: run.ph, done: run.done, prog: run.prog, pen: run.pen, ev_info: run.obj && run.obj.info ? run.obj.info() : null} : null, S, myTeam})
    };

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        ivs.forEach(clearInterval);
        timers.forEach(clearTimeout); timers.clear();
        try { run && run.obj && run.obj.destroy && run.obj.destroy(); } catch (e) { /* rien */ }
        run = null;
        root.removeEventListener("pointerdown", onGesture, true);
        if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
        if (window.__rl) { try { delete window.__rl; } catch (e) { window.__rl = undefined; } }
        el.innerHTML = "";
      }
    };
  }
});
