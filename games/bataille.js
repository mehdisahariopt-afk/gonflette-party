/* Gonflette Party : Bataille navale (2 joueurs, chacun sur son téléphone).
   Grille 8×8, flotte 4-3-3-2-2. Ambiance salle des opérations / sonar à phosphore vert.
   - Phase 1 (ph:0) : chaque joueur place sa flotte en secret sur son téléphone puis envoie
     {seq, a:"ready", ships:[[x,y,len,h],…]} à l'hôte (la flotte est recopiée dans chaque entrée).
   - Phase 2 (ph:1) : tour par tour, un tir par tour : {seq, a:"fire", x, y, ships}.
   - L'état publié ne contient jamais les navires intacts : seulement les tirs (chaînes de 64 car.)
     et les navires coulés.
   État : {ph, r:[0|1,0|1], t, s:[tirs J1, tirs J2], k:[coulés de J1, coulés de J2], n, L:[tireur,x,y,res,id]|null, w, f}
     s[i][y*8+x] : "0" inconnu, "1" raté, "2" touché, "3" coulé (tirs du joueur i sur la flotte adverse)
     k[j] : navires coulés de la flotte du joueur j, 4 chiffres chacun « id x y h ». */
GONFLETTE.registerGame({
  id: "bataille",
  name: "Bataille navale",
  min: 2,
  max: 2,
  create(api) {
    const N = 8, FLEET = [4, 3, 3, 2, 2];
    const SHIP_NAMES = ["Cuirassé", "Croiseur", "Sous-marin", "Torpilleur", "Vedette"];
    const COLS = "ABCDEFGH";
    const el = api.el;
    const PL = api.players.slice(0, 2);
    const mySide = PL.findIndex(p => p.key === api.me);
    const isPl = mySide >= 0;
    const A = isPl ? mySide : 0, B = 1 - A;          // A : « moi » (ou joueur 1 pour un spectateur)
    const timers = [], intervals = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const esc = t => String(t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const nm = i => esc(PL[i].pseudo || api.name(PL[i].key));
    const coord = (x, y) => COLS[x] + (y + 1);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dead = false;

    /* ---------- Silhouettes SVG ---------- */
    function shipBody(id, L) {
      const W = L * 100;
      if (id === 2) { // sous-marin : capsule + kiosque
        return `<path class="bn-hull" d="M14 50 Q14 30 46 30 L${W - 50} 30 Q${W - 8} 34 ${W - 8} 50 Q${W - 8} 66 ${W - 50} 70 L46 70 Q14 70 14 50Z"/>
          <rect class="bn-deck" x="${W * .4}" y="22" width="${W * .22}" height="30" rx="8"/>
          <rect class="bn-detail" x="${W * .48}" y="10" width="6" height="16"/>
          <path class="bn-detail" d="M22 40 L8 32 L8 68 L22 60Z"/>`;
      }
      let s = `<path class="bn-hull" d="M10 34 Q4 50 10 66 L${W - 52} 74 Q${W - 12} 66 ${W - 4} 50 Q${W - 12} 34 ${W - 52} 26 Z"/>
        <path class="bn-deckline" d="M18 50 L${W - 24} 50"/>`;
      const bridgeX = W * (L >= 3 ? .42 : .34), bridgeW = W * (L >= 3 ? .16 : .26);
      s += `<rect class="bn-deck" x="${bridgeX}" y="36" width="${bridgeW}" height="28" rx="4"/>
        <rect class="bn-detail" x="${bridgeX + bridgeW * .3}" y="42" width="${bridgeW * .4}" height="16" rx="3"/>`;
      const turrets = L === 4 ? [W * .16, W * .3, W * .7, W * .82] : L === 3 ? [W * .2, W * .74] : [W * .72];
      turrets.forEach((tx, i) => {
        const dir = tx < W / 2 ? -1 : 1;
        s += `<path class="bn-detail" d="M${tx} 47 L${tx + dir * 34} 46 L${tx + dir * 34} 50 L${tx} 53Z"/><circle class="bn-turret" cx="${tx}" cy="50" r="12"/>`;
        if (i === 0 && L === 4) s += `<circle class="bn-detail" cx="${W * .62}" cy="50" r="6"/>`;
      });
      return s;
    }
    function shipSVG(id, h, cls) {
      const L = FLEET[id], W = L * 100;
      const vb = h ? `0 0 ${W} 100` : `0 0 100 ${W}`;
      const g = h ? "" : ` transform="translate(100 0) rotate(90)"`;
      return `<svg class="bn-svg ${cls || ""}" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true"><g${g}>${shipBody(id, L)}</g></svg>`;
    }
    const miniShip = id => `<svg class="bn-mini" viewBox="0 0 ${FLEET[id] * 100} 100" aria-hidden="true">${shipBody(id, FLEET[id])}</svg>`;

    /* ---------- Gabarit ---------- */
    el.innerHTML = `<style>
.bn{--navy:#04101d;--navy2:#0a2236;--ph:#45ff9a;--phd:#1e8d58;--phl:rgba(69,255,154,.18);--red:#ff4a3d;--amber:#ffb238;--ink:#d8f5e6;
  min-height:100%;box-sizing:border-box;padding:10px 16px 28px;color:var(--ink);font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
  background:radial-gradient(110% 60% at 50% 0%,#0d3150 0%,var(--navy) 62%),var(--navy);display:grid;justify-items:center;align-content:start;gap:10px;overflow-x:hidden;position:relative}
.bn::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px);opacity:.5}
.bn *{box-sizing:border-box}
.bn-hide{display:none!important}
.bn-wrap{width:min(100%,760px);display:grid;gap:10px;justify-items:center;position:relative}
.bn-h{font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--ph);text-shadow:0 0 10px rgba(69,255,154,.55);margin:0;font-size:1.45rem;line-height:1;text-align:center}
.bn-sub{margin:0;text-align:center;font-size:1.02rem;color:#a9d8c0;line-height:1.2}
.bn-tag{font-family:Anton,Impact,sans-serif;letter-spacing:.14em;font-size:.78rem;color:var(--phd);text-transform:uppercase}
/* joueurs */
.bn-head{width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
.bn-pl{display:flex;align-items:center;gap:6px;min-width:0;padding:4px 8px 4px 4px;border:2px solid rgba(69,255,154,.2);border-radius:12px;background:rgba(5,30,45,.75);opacity:.62;transition:opacity .3s,border-color .3s,box-shadow .3s}
.bn-pl.bn-r{flex-direction:row-reverse;padding:4px 4px 4px 8px;text-align:right}
.bn-pl.bn-on{opacity:1;border-color:var(--ph);box-shadow:0 0 16px rgba(69,255,154,.35),inset 0 0 12px rgba(69,255,154,.12)}
.bn-av{width:46px;height:46px;flex:none;border-radius:50%;overflow:hidden;background:radial-gradient(circle,#15466a,#071a2b);border:2px solid var(--phd)}
.bn-av svg{width:100%;height:100%;display:block}
.bn-pi{min-width:0;display:grid;gap:2px}
.bn-pi b{font-size:1.08rem;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bn-pips{display:flex;gap:3px}
.bn-pl.bn-r .bn-pips{justify-content:flex-end}
.bn-pip{width:12px;height:6px;border-radius:3px;background:var(--ph);box-shadow:0 0 5px var(--ph)}
.bn-pip.bn-x{background:#3b1b1b;box-shadow:none;border:1px solid #7a2a24}
.bn-vs{font-family:Anton,Impact,sans-serif;color:var(--amber);font-size:1.05rem;letter-spacing:.05em}
/* statut */
.bn-status{width:100%;border:1px solid rgba(69,255,154,.35);border-radius:10px;background:rgba(2,16,10,.7);padding:6px 10px;text-align:center;box-shadow:inset 0 0 18px rgba(69,255,154,.08)}
.bn-turn{font-family:Anton,Impact,sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:1.15rem;color:var(--ph);text-shadow:0 0 8px rgba(69,255,154,.5);line-height:1.15}
.bn-turn.bn-wait{color:var(--amber);text-shadow:0 0 8px rgba(255,178,56,.4)}
.bn-ev{font-size:.98rem;color:#9fcdb6;min-height:1.2em;letter-spacing:.03em}
.bn-ev::before{content:"▸ ";color:var(--phd)}
/* plateaux */
.bn-board{display:grid;grid-template-columns:16px minmax(0,1fr);grid-template-rows:16px auto;gap:2px;width:100%}
.bn-cols,.bn-rows{display:grid;font-family:Anton,Impact,sans-serif;font-size:.7rem;color:var(--phd);text-align:center;align-items:center}
.bn-cols{grid-template-columns:repeat(8,1fr)}
.bn-rows{grid-template-rows:repeat(8,1fr)}
.bn-sea{position:relative;aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border:2px solid var(--phd);border-radius:6px;overflow:hidden;
  background:radial-gradient(circle at 50% 50%,rgba(69,255,154,.07),transparent 70%),repeating-radial-gradient(circle at 50% 50%,transparent 0 23%,rgba(69,255,154,.13) 23% calc(23% + 1px)),linear-gradient(180deg,#062033,#03131f)}
.bn-fleet .bn-sea{background:repeating-linear-gradient(135deg,rgba(120,190,255,.04) 0 6px,transparent 6px 12px),linear-gradient(180deg,#0b2c48,#061a2c);border-color:#2f6d8f}
.bn-fleet .bn-cols,.bn-fleet .bn-rows{color:#5d9bc0}
.bn-cell{position:relative;z-index:2;border:0;margin:0;padding:0;background:transparent;box-shadow:inset 0 0 0 .5px rgba(69,255,154,.22);display:grid;place-items:center;cursor:default;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
.bn-fleet .bn-cell{box-shadow:inset 0 0 0 .5px rgba(130,190,240,.18)}
.bn-armed .bn-cell.bn-free{cursor:crosshair}
.bn-armed .bn-cell.bn-free:hover,.bn-armed .bn-cell.bn-free:focus-visible{background:rgba(69,255,154,.18);outline:none;box-shadow:inset 0 0 0 2px var(--ph)}
.bn-cell.bn-aim{background:rgba(255,178,56,.25);box-shadow:inset 0 0 0 2px var(--amber)}
.bn-place .bn-cell{cursor:pointer}
.bn-place .bn-cell.bn-ghost{background:rgba(69,255,154,.28)}
.bn-place .bn-cell.bn-bad{background:rgba(255,74,61,.35)}
.bn-layer{position:absolute;inset:0;z-index:1;pointer-events:none}
.bn-ship{position:absolute;padding:3%}
.bn-svg{width:100%;height:100%;display:block;overflow:visible}
.bn-hull{fill:#5f7f93;stroke:#bfe3f5;stroke-width:4}
.bn-deck{fill:#88a8bb;stroke:#20394a;stroke-width:3}
.bn-deckline{stroke:#3a5568;stroke-width:3;stroke-dasharray:10 8;fill:none}
.bn-detail{fill:#2c4556}
.bn-turret{fill:#7896a8;stroke:#20394a;stroke-width:3}
.bn-ship.bn-sel .bn-hull{stroke:var(--ph);stroke-width:7;filter:drop-shadow(0 0 6px var(--ph))}
.bn-ship.bn-pick{animation:bn-bob 1.2s ease-in-out infinite alternate}
.bn-ship.bn-sunk .bn-hull{fill:rgba(255,74,61,.2);stroke:var(--red);stroke-dasharray:14 9;stroke-width:5}
.bn-ship.bn-sunk .bn-deck,.bn-ship.bn-sunk .bn-turret{fill:#3b2326;stroke:#7a2a24}
.bn-ship.bn-sunk .bn-detail,.bn-ship.bn-sunk .bn-deckline{fill:#4b2a2a;stroke:#4b2a2a}
.bn-ship.bn-wreck .bn-hull{fill:rgba(255,74,61,.1)}
.bn-stamp{position:absolute;left:50%;top:50%;z-index:4;transform:translate(-50%,-50%) rotate(-14deg);font-family:Anton,Impact,sans-serif;letter-spacing:.12em;color:var(--red);border:3px double var(--red);border-radius:4px;padding:1px 5px 0;font-size:.9rem;line-height:1.1;background:rgba(30,6,6,.55);text-shadow:0 0 6px rgba(255,74,61,.6);white-space:nowrap;pointer-events:none;mix-blend-mode:normal}
.bn-stamp.bn-new{animation:bn-stamp .45s cubic-bezier(.2,1.6,.4,1)}
.bn-fleet-small .bn-stamp{font-size:.6rem;border-width:2px;padding:0 3px}
/* marques de tir */
.bn-m{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.bn-miss::after{content:"";width:26%;aspect-ratio:1;border-radius:50%;border:2px solid #8fd4ff;background:rgba(143,212,255,.25)}
.bn-radar .bn-miss::after{border-color:var(--ph);background:rgba(69,255,154,.2)}
.bn-miss.bn-new::before{content:"";position:absolute;width:90%;aspect-ratio:1;border-radius:50%;border:2px solid #bfe8ff;animation:bn-ring .9s ease-out forwards}
.bn-hit::before{content:"";position:absolute;width:62%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#fff6c8 0,#ffb238 32%,#ff4a3d 62%,rgba(255,74,61,0) 72%);animation:bn-flick 1.1s ease-in-out infinite alternate}
.bn-hit::after{content:"";position:absolute;width:44%;aspect-ratio:1;left:30%;top:-4%;border-radius:50%;background:radial-gradient(circle,rgba(170,175,180,.7),rgba(90,95,100,0) 70%);animation:bn-smoke 2.2s ease-out infinite}
.bn-hit.bn-new{animation:bn-boom .6s ease-out}
.bn-cell.bn-sk .bn-m::before{content:"";position:absolute;inset:27%;background:linear-gradient(45deg,transparent 42%,var(--red) 42% 58%,transparent 58%),linear-gradient(-45deg,transparent 42%,var(--red) 42% 58%,transparent 58%);border-radius:0;animation:none;width:auto}
.bn-cell.bn-sk .bn-m::after{opacity:.5}
.bn-cell.bn-last{box-shadow:inset 0 0 0 2px var(--amber)}
.bn-sweep{position:absolute;inset:-25%;z-index:3;pointer-events:none;background:conic-gradient(from 0deg,rgba(69,255,154,0) 0deg,rgba(69,255,154,0) 300deg,rgba(69,255,154,.28) 358deg,rgba(160,255,200,.6) 360deg);animation:bn-spin 4s linear infinite;mix-blend-mode:screen}
.bn-flash{position:absolute;left:50%;top:50%;z-index:6;transform:translate(-50%,-50%);font-family:Anton,Impact,sans-serif;font-size:2.6rem;letter-spacing:.06em;white-space:nowrap;pointer-events:none;padding:2px 14px;border-radius:6px;animation:bn-flash 1.4s ease-out forwards;text-shadow:0 0 14px currentColor}
.bn-flash.bn-f1{color:#8fd4ff;background:rgba(3,20,35,.75)}
.bn-flash.bn-f2{color:var(--amber);background:rgba(40,15,3,.75)}
.bn-flash.bn-f3{color:var(--red);background:rgba(35,4,4,.8);border:3px double var(--red)}
/* bataille */
.bn-grids{width:100%;display:grid;gap:10px;justify-items:center}
.bn-radar-box{width:min(100%,400px);display:grid;gap:4px}
.bn-lbl{display:flex;justify-content:space-between;align-items:baseline;gap:8px;width:100%}
.bn-lbl .bn-h{font-size:1.05rem}
.bn-lbl small{font-size:.9rem;color:#88b9a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bn-bottom{width:min(100%,400px);display:grid;grid-template-columns:minmax(0,52%) minmax(0,1fr);gap:10px;align-items:start}
.bn-bottom .bn-lbl .bn-h{color:#8fd4ff;text-shadow:0 0 8px rgba(143,212,255,.4)}
.bn-list{display:grid;gap:4px;padding-top:20px}
.bn-li{display:grid;grid-template-columns:auto 1fr;gap:1px 6px;align-items:center;padding:3px 5px;border-radius:7px;background:rgba(8,34,54,.7);border:1px solid rgba(143,212,255,.15)}
.bn-li .bn-mini{grid-row:span 2;width:auto;height:16px}
.bn-mini .bn-hull{stroke-width:6}
.bn-li b{font-size:.82rem;line-height:1;font-weight:700;color:#cde7f5;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bn-hp{display:flex;gap:2px}
.bn-hp i{width:9px;height:5px;border-radius:2px;background:#4fb3ef}
.bn-hp i.bn-x{background:var(--red)}
.bn-li.bn-dead{opacity:.6;border-color:rgba(255,74,61,.4)}
.bn-li.bn-dead b{color:var(--red);text-decoration:line-through}
/* placement */
.bn-place-box{width:min(100%,400px);display:grid;gap:10px}
.bn-dock{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.bn-dk{display:grid;justify-items:center;gap:2px;padding:6px 8px 4px;border-radius:10px;border:2px solid rgba(143,212,255,.25);background:rgba(8,34,54,.85);color:var(--ink);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.bn-dk .bn-mini{height:18px;width:auto}
.bn-dk span{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#a9cde0}
.bn-dk.bn-done{opacity:.45}
.bn-dk.bn-sel{opacity:1;border-color:var(--ph);box-shadow:0 0 12px rgba(69,255,154,.4)}
.bn-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bn-btn{font:inherit;font-weight:700;font-size:1.05rem;text-transform:uppercase;letter-spacing:.05em;padding:10px 8px;border-radius:10px;border:2px solid var(--phd);background:rgba(5,40,28,.85);color:var(--ph);cursor:pointer;-webkit-tap-highlight-color:transparent}
.bn-btn:active{transform:translateY(1px)}
.bn-go{grid-column:1/-1;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem;letter-spacing:.12em;background:linear-gradient(180deg,#43f29a,#1d9a5e);color:#03140b;border-color:#b8ffd9;box-shadow:0 0 18px rgba(69,255,154,.4)}
.bn-go:disabled{background:#173326;color:#4c7a62;border-color:#24503a;box-shadow:none;cursor:not-allowed}
.bn-opp{display:flex;align-items:center;justify-content:center;gap:8px;font-size:1rem;color:#9fcdb6}
.bn-opp .bn-av{width:34px;height:34px}
.bn-opp.bn-ok{color:var(--ph)}
.bn-wait-box{width:min(100%,400px);display:grid;gap:10px;justify-items:center}
/* fin */
.bn-end{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:16px;background:rgba(2,8,14,.72);animation:bn-fade .5s}
.bn-end-card{width:min(100%,360px);text-align:center;display:grid;gap:8px;justify-items:center;padding:18px 16px;border-radius:16px;border:2px solid var(--ph);background:linear-gradient(180deg,#082a1d,#04121f);box-shadow:0 0 40px rgba(69,255,154,.3)}
.bn-end-card.bn-lost{border-color:var(--red);box-shadow:0 0 40px rgba(255,74,61,.3);background:linear-gradient(180deg,#2a0b0b,#04121f)}
.bn-end-card .bn-av{width:110px;height:110px}
.bn-end-t{font-family:Anton,Impact,sans-serif;font-size:2.4rem;letter-spacing:.06em;color:var(--ph);text-shadow:0 0 14px rgba(69,255,154,.6);line-height:1}
.bn-lost .bn-end-t{color:var(--red);text-shadow:0 0 14px rgba(255,74,61,.6)}
.bn-end-s{font-family:Pacifico,"Brush Script MT",cursive;font-size:1.15rem;color:var(--amber)}
.bn-stats{display:flex;gap:14px;font-size:.95rem;color:#a9d8c0}
.bn-stats b{display:block;font-family:Anton,Impact,sans-serif;font-size:1.3rem;color:var(--ink);font-weight:400}
@keyframes bn-spin{to{transform:rotate(360deg)}}
@keyframes bn-ring{from{transform:scale(.2);opacity:1}to{transform:scale(1.5);opacity:0}}
@keyframes bn-flick{from{transform:scale(.9);filter:brightness(1)}to{transform:scale(1.08);filter:brightness(1.3)}}
@keyframes bn-smoke{0%{transform:translate(0,0) scale(.6);opacity:.8}100%{transform:translate(18%,-110%) scale(1.6);opacity:0}}
@keyframes bn-boom{0%{transform:scale(2.4);filter:brightness(3)}100%{transform:none}}
@keyframes bn-stamp{0%{transform:translate(-50%,-50%) rotate(-14deg) scale(2.6);opacity:0}100%{transform:translate(-50%,-50%) rotate(-14deg) scale(1);opacity:1}}
@keyframes bn-flash{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}15%{transform:translate(-50%,-50%) scale(1.1);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
@keyframes bn-bob{to{transform:translateY(-3px)}}
@keyframes bn-fade{from{opacity:0}}
@keyframes bn-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.bn-shake{animation:bn-shake .25s 2}
@media (min-width:760px){
  .bn-grids{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start}
  .bn-status{grid-column:1/-1}
  .bn-bottom{grid-template-columns:1fr;width:min(100%,360px)}
  .bn-list{grid-template-columns:1fr 1fr;padding-top:0}
}
@media (prefers-reduced-motion:reduce){
  .bn *,.bn *::before,.bn *::after{animation:none!important;transition:none!important}
  .bn-sweep{display:none}
  .bn-flash{opacity:1}
}
</style>
<div class="bn" id="bn-root">
  <div class="bn-wrap">
    <div class="bn-head" id="bn-head">
      <div class="bn-pl" id="bn-p0"><span class="bn-av">${api.avatar(PL[A].key, {view: "bust"})}</span><span class="bn-pi"><b>${nm(A)}</b><span class="bn-pips" id="bn-pips0"></span></span></div>
      <span class="bn-vs">VS</span>
      <div class="bn-pl bn-r" id="bn-p1"><span class="bn-av">${api.avatar(PL[B].key, {view: "bust"})}</span><span class="bn-pi"><b>${nm(B)}</b><span class="bn-pips" id="bn-pips1"></span></span></div>
    </div>

    <section class="bn-place-box bn-hide" id="bn-place">
      <div><h2 class="bn-h">Déploiement de la flotte</h2>
      <p class="bn-sub">Touchez un navire puis une case. Touchez un navire posé pour le reprendre.</p></div>
      <div id="bn-pboard"></div>
      <div class="bn-dock" id="bn-dock"></div>
      <div class="bn-btns">
        <button class="bn-btn" type="button" id="bn-rot">↻ Pivoter</button>
        <button class="bn-btn" type="button" id="bn-rand">Placement aléatoire</button>
        <button class="bn-btn bn-go" type="button" id="bn-ready" disabled>Prêt !</button>
      </div>
      <div class="bn-opp" id="bn-opp1"></div>
    </section>

    <section class="bn-wait-box bn-hide" id="bn-wait">
      <h2 class="bn-h">Flotte en position</h2>
      <p class="bn-sub" id="bn-wait-t"></p>
      <div id="bn-wboard" style="width:min(100%,300px)"></div>
      <div class="bn-opp" id="bn-opp2"></div>
    </section>

    <section class="bn-grids bn-hide" id="bn-battle">
      <div class="bn-status" role="status" aria-live="polite"><div class="bn-turn" id="bn-turn"></div><div class="bn-ev" id="bn-ev"></div></div>
      <div class="bn-radar-box">
        <div class="bn-lbl"><span class="bn-h">Radar</span><small id="bn-rlbl"></small></div>
        <div id="bn-rboard"></div>
      </div>
      <div class="bn-bottom">
        <div><div class="bn-lbl"><span class="bn-h" id="bn-flbl">Ma flotte</span></div><div id="bn-fboard"></div></div>
        <div class="bn-list" id="bn-list"></div>
      </div>
    </section>
  </div>
  <div id="bn-endly"></div>
</div>`;
    const $ = id => el.querySelector("#" + id);

    /* ---------- Plateaux ---------- */
    function makeBoard(kind, host) {
      const root = document.createElement("div");
      root.className = "bn-board bn-" + kind;
      root.innerHTML = `<span></span><div class="bn-cols">${[...COLS].map(c => `<span>${c}</span>`).join("")}</div>
        <div class="bn-rows">${[1, 2, 3, 4, 5, 6, 7, 8].map(r => `<span>${r}</span>`).join("")}</div><div class="bn-sea"></div>`;
      const sea = root.querySelector(".bn-sea");
      const layer = document.createElement("div"); layer.className = "bn-layer"; sea.appendChild(layer);
      const cells = [];
      for (let i = 0; i < N * N; i++) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "bn-cell"; b.dataset.i = i;
        b.setAttribute("aria-label", coord(i % N, (i / N) | 0));
        b.innerHTML = `<span class="bn-m"></span>`;
        sea.appendChild(b); cells.push(b);
      }
      if (kind === "radar") { const sw = document.createElement("div"); sw.className = "bn-sweep"; sea.appendChild(sw); }
      host.appendChild(root);
      return {root, sea, layer, cells, marks: cells.map(c => c.firstChild), mk: new Array(N * N).fill(""), lk: ""};
    }
    const boards = {
      place: makeBoard("fleet bn-place", $("bn-pboard")),
      wait: makeBoard("fleet", $("bn-wboard")),
      radar: makeBoard("radar", $("bn-rboard")),
      fleet: makeBoard("fleet bn-fleet-small", $("bn-fboard"))
    };

    function shipCells(sh) { const out = []; for (let j = 0; j < FLEET[sh.id]; j++) out.push(sh.h ? [sh.x + j, sh.y] : [sh.x, sh.y + j]); return out; }
    // layer : liste de navires {id,x,y,h,cls,stamp}
    function drawShips(bd, list) {
      const key = JSON.stringify(list);
      if (key === bd.lk) return;
      const prev = bd.lk; bd.lk = key;
      bd.layer.innerHTML = list.map(s => {
        const L = FLEET[s.id];
        const st = `left:${s.x * 12.5}%;top:${s.y * 12.5}%;width:${(s.h ? L : 1) * 12.5}%;height:${(s.h ? 1 : L) * 12.5}%`;
        const isNew = s.stamp && prev.indexOf(`"id":${s.id},"x":${s.x},"y":${s.y},"h":${s.h},"cls":"bn-sunk`) < 0 && prev !== "";
        return `<div class="bn-ship ${s.cls || ""}" style="${st}">${shipSVG(s.id, s.h)}${s.stamp ? `<span class="bn-stamp${isNew ? " bn-new" : ""}">COULÉ</span>` : ""}</div>`;
      }).join("");
    }
    // shots : chaîne de 64 ; last : index du dernier tir à animer
    function drawShots(bd, shots, last, animate) {
      for (let i = 0; i < N * N; i++) {
        const v = shots ? shots[i] : "0";
        const k = v + (i === last ? "L" : "");
        const cell = bd.cells[i];
        cell.classList.toggle("bn-free", v === "0");
        cell.classList.toggle("bn-sk", v === "3");
        cell.classList.toggle("bn-last", i === last);
        if (bd.mk[i] === k) continue;
        bd.mk[i] = k;
        const m = bd.marks[i];
        m.className = "bn-m" + (v === "1" ? " bn-miss" : v === "2" || v === "3" ? " bn-hit" : "") + (i === last && animate ? " bn-new" : "");
      }
    }
    function flash(bd, res) {
      if (reduced) return;
      const f = document.createElement("div");
      f.className = "bn-flash bn-f" + res;
      f.textContent = res === 1 ? "RATÉ" : res === 2 ? "TOUCHÉ !" : "COULÉ !";
      bd.sea.appendChild(f);
      later(() => f.remove(), 1500);
    }

    /* ---------- Son (WebAudio, après un geste) ---------- */
    let ac = null;
    function unlock() {
      if (ac) return;
      try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) { ac = null; }
    }
    el.addEventListener("pointerdown", unlock);
    function noise(dur, freq, q, vol, t0) {
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t0);
    }
    function tone(f0, f1, dur, vol, type, t0) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .05);
    }
    function sfx(kind) {
      if (!ac || dead) return;
      try {
        if (ac.state === "suspended") ac.resume();
        const t = ac.currentTime;
        if (kind === "ping") { tone(1250, 1150, .9, .12, "sine", t); tone(1250, 1150, .5, .04, "sine", t + .35); }
        else if (kind === "click") tone(600, 300, .06, .08, "square", t);
        else if (kind === "miss") { noise(.6, 1800, 1, .35, t); tone(500, 120, .3, .06, "sine", t); }
        else if (kind === "hit") { noise(.8, 500, 2, .6, t); tone(120, 40, .5, .4, "sine", t); }
        else if (kind === "sunk") { noise(1.3, 380, 3, .7, t); tone(140, 30, 1, .45, "sawtooth", t); tone(400, 90, 1.2, .08, "triangle", t + .3); }
      } catch (e) { /* son facultatif */ }
    }

    /* ---------- Logique (hôte) ---------- */
    function parseFleet(arr) {
      if (!Array.isArray(arr) || arr.length !== FLEET.length) return null;
      const occ = new Array(N * N).fill(-1), out = [];
      for (let id = 0; id < FLEET.length; id++) {
        const s = arr[id];
        if (!Array.isArray(s) || s.length < 4) return null;
        const x = s[0] | 0, y = s[1] | 0, L = s[2] | 0, h = s[3] ? 1 : 0;
        if (L !== FLEET[id]) return null;
        const sh = {id, x, y, h};
        for (const [cx, cy] of shipCells(sh)) {
          if (cx < 0 || cy < 0 || cx >= N || cy >= N || occ[cy * N + cx] >= 0) return null;
          occ[cy * N + cx] = id;
        }
        out.push(sh);
      }
      return {ships: out, occ};
    }
    let st = null;
    if (api.isHost) {
      const fleets = [null, null], seen = {};
      st = {ph: 0, r: [0, 0], t: 0, s: ["0".repeat(64), "0".repeat(64)], k: ["", ""], n: 0, L: null, w: -1, f: 0};
      api.setState(st);
      const end = (w, forfeit) => {
        st = Object.assign({}, st, {ph: 2, w, f: forfeit ? 1 : 0, n: st.n + 1});
        api.setState(st);
        const shots = st.s[w].replace(/0/g, "").length;
        const summary = forfeit
          ? `${PL[1 - w].pseudo} a quitté le poste de commandement : ${PL[w].pseudo} gagne par forfait.`
          : `${PL[w].pseudo} envoie toute la flotte de ${PL[1 - w].pseudo} par le fond en ${shots} tirs.`;
        later(() => { if (!dead) api.finish({winners: [PL[w].key], ranking: [PL[w].key, PL[1 - w].key], summary}); }, 2500);
      };
      api.onInputs(inputs => {
        if (dead || st.ph === 2) return;
        let changed = false;
        for (let i = 0; i < 2; i++) {
          const inp = inputs[PL[i].key];
          if (!inp || fleets[i] || !inp.ships) continue;
          const f = parseFleet(inp.ships);
          if (!f) continue;
          fleets[i] = f; st.r = st.r.slice(); st.r[i] = 1; changed = true;
        }
        if (st.ph === 0 && fleets[0] && fleets[1]) {
          st = Object.assign({}, st, {ph: 1, t: Math.random() < .5 ? 0 : 1, n: st.n + 1});
          // les tirs déjà en attente ne comptent pas
          for (let i = 0; i < 2; i++) { const inp = inputs[PL[i].key]; if (inp) seen[PL[i].key] = inp.seq; }
          changed = true;
        } else if (st.ph === 1) {
          for (let i = 0; i < 2; i++) {
            const key = PL[i].key, inp = inputs[key];
            if (!inp || inp.seq == null || inp.seq === seen[key]) continue;
            seen[key] = inp.seq;
            if (inp.a !== "fire" || i !== st.t) continue;
            const x = inp.x | 0, y = inp.y | 0;
            if (x < 0 || y < 0 || x >= N || y >= N) continue;
            const idx = y * N + x, o = 1 - i;
            if (st.s[i][idx] !== "0") continue;
            const sh = st.s.slice(), kk = st.k.slice();
            const occId = fleets[o].occ[idx];
            let res = 1, row = sh[i].split("");
            if (occId >= 0) {
              res = 2; row[idx] = "2";
              const ship = fleets[o].ships[occId];
              const cells = shipCells(ship);
              if (cells.every(([cx, cy]) => row[cy * N + cx] !== "0")) {
                res = 3;
                cells.forEach(([cx, cy]) => { row[cy * N + cx] = "3"; });
                kk[o] += `${ship.id}${ship.x}${ship.y}${ship.h}`;
              }
            } else row[idx] = "1";
            sh[i] = row.join("");
            st = Object.assign({}, st, {s: sh, k: kk, L: [i, x, y, res, occId], n: st.n + 1, t: 1 - i});
            changed = false;
            if (kk[o].length / 4 >= FLEET.length) { st.t = i; end(i, false); return; }
            api.setState(st);
            return;
          }
        }
        if (changed) { st = Object.assign({}, st); api.setState(st); }
      });
      // Forfait si un joueur quitte la partie
      const everSeen = [false, false], gone = [0, 0];
      intervals.push(setInterval(() => {
        if (dead || st.ph === 2) return;
        const conn = api.connected();
        for (let i = 0; i < 2; i++) {
          const here = conn.includes(PL[i].key);
          if (here) { everSeen[i] = true; gone[i] = 0; } else if (everSeen[i]) gone[i]++;
        }
        for (let i = 0; i < 2; i++) if (gone[i] >= 2 && !gone[1 - i] && everSeen[1 - i]) { end(1 - i, true); return; }
      }, 1000));
    }

    /* ---------- Placement local ---------- */
    let fleet = FLEET.map((_, id) => ({id, x: 0, y: 0, h: 1, placed: false}));
    let sel = 0, orient = 1, readySent = false, mySeq = 0, readyTimer = null;
    const dock = $("bn-dock");
    dock.innerHTML = FLEET.map((L, id) => `<button type="button" class="bn-dk" data-id="${id}">${miniShip(id)}<span>${SHIP_NAMES[id]} · ${L}</span></button>`).join("");
    function occOf(list, skip) {
      const occ = new Array(N * N).fill(-1);
      list.forEach(s => { if (s.placed && s.id !== skip) shipCells(s).forEach(([x, y]) => { occ[y * N + x] = s.id; }); });
      return occ;
    }
    function fits(sh, occ) { return shipCells(sh).every(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && occ[y * N + x] < 0); }
    function tryPlace(id, x, y, h) {
      const L = FLEET[id];
      // recale dans la grille si le navire dépasse
      if (h) x = Math.min(x, N - L); else y = Math.min(y, N - L);
      const sh = {id, x, y, h};
      if (!fits(sh, occOf(fleet, id))) return false;
      Object.assign(fleet[id], sh, {placed: true});
      return true;
    }
    function randomFleet() {
      for (let guard = 0; guard < 200; guard++) {
        const f = FLEET.map((_, id) => ({id, x: 0, y: 0, h: 1, placed: false}));
        let ok = true;
        for (let id = 0; id < FLEET.length && ok; id++) {
          let done = false;
          for (let t = 0; t < 200 && !done; t++) {
            const h = Math.random() < .5 ? 1 : 0, L = FLEET[id];
            const sh = {id, h, x: Math.floor(Math.random() * (h ? N - L + 1 : N)), y: Math.floor(Math.random() * (h ? N : N - L + 1))};
            if (fits(sh, occOf(f, -1))) { Object.assign(f[id], sh, {placed: true}); done = true; }
          }
          ok = done;
        }
        if (ok) return f;
      }
      return null;
    }
    function nextUnplaced() { const u = fleet.find(s => !s.placed); return u ? u.id : -1; }
    function renderPlace() {
      const bd = boards.place;
      drawShips(bd, fleet.filter(s => s.placed).map(s => ({id: s.id, x: s.x, y: s.y, h: s.h, cls: s.id === sel ? "bn-sel bn-pick" : ""})));
      dock.querySelectorAll(".bn-dk").forEach(b => {
        const id = +b.dataset.id;
        b.classList.toggle("bn-sel", id === sel);
        b.classList.toggle("bn-done", fleet[id].placed);
        b.setAttribute("aria-pressed", id === sel ? "true" : "false");
      });
      $("bn-rot").textContent = `↻ ${orient ? "Horizontal" : "Vertical"}`;
      $("bn-ready").disabled = !fleet.every(s => s.placed);
    }
    // aperçu au survol (souris)
    function preview(i) {
      const bd = boards.place;
      bd.cells.forEach(c => c.classList.remove("bn-ghost", "bn-bad"));
      if (i < 0 || sel < 0) return;
      const L = FLEET[sel];
      let x = i % N, y = (i / N) | 0;
      if (orient) x = Math.min(x, N - L); else y = Math.min(y, N - L);
      const sh = {id: sel, x, y, h: orient};
      const ok = fits(sh, occOf(fleet, sel));
      shipCells(sh).forEach(([cx, cy]) => { const c = bd.cells[cy * N + cx]; if (c) c.classList.add(ok ? "bn-ghost" : "bn-bad"); });
    }
    boards.place.sea.addEventListener("pointerover", e => { if (e.pointerType === "mouse") { const c = e.target.closest(".bn-cell"); preview(c ? +c.dataset.i : -1); } });
    boards.place.sea.addEventListener("pointerleave", () => preview(-1));
    boards.place.sea.addEventListener("click", e => {
      const c = e.target.closest(".bn-cell");
      if (!c || readySent) return;
      const i = +c.dataset.i, x = i % N, y = (i / N) | 0;
      const occ = occOf(fleet, -1);
      const there = occ[i];
      if (sel >= 0 && (there < 0 || there === sel)) {
        if (there === sel && fleet[sel].x === x && fleet[sel].y === y) { sel = -1; renderPlace(); return; }
        if (tryPlace(sel, x, y, orient)) { sfx("click"); sel = nextUnplaced(); }
        else { boards.place.sea.classList.remove("bn-shake"); void boards.place.sea.offsetWidth; boards.place.sea.classList.add("bn-shake"); }
      } else if (there >= 0) { sel = there; orient = fleet[there].h; sfx("click"); }
      preview(-1);
      renderPlace();
    });
    dock.addEventListener("click", e => {
      const b = e.target.closest(".bn-dk");
      if (!b || readySent) return;
      const id = +b.dataset.id;
      sel = id;
      if (sel >= 0 && fleet[sel].placed) orient = fleet[sel].h;
      renderPlace();
    });
    $("bn-rot").addEventListener("click", () => {
      if (readySent) return;
      orient = orient ? 0 : 1;
      if (sel >= 0 && fleet[sel].placed) {
        const s = fleet[sel];
        if (!tryPlace(sel, s.x, s.y, orient)) {
          // essaie de pivoter en reculant le navire
          let ok = false;
          for (let d = 1; d < FLEET[sel] && !ok; d++) ok = tryPlace(sel, orient ? s.x - d : s.x, orient ? s.y : s.y - d, orient);
          if (!ok) { orient = s.h; toast("Pas la place de pivoter ici"); }
        }
      }
      sfx("click");
      renderPlace();
    });
    $("bn-rand").addEventListener("click", () => {
      if (readySent) return;
      const f = randomFleet();
      if (f) { fleet = f; sel = -1; sfx("click"); renderPlace(); }
    });
    function sendReady() {
      api.setInput({seq: ++mySeq, a: "ready", ships: fleet.map(s => [s.x, s.y, FLEET[s.id], s.h])});
    }
    $("bn-ready").addEventListener("click", () => {
      if (readySent || !fleet.every(s => s.placed)) return;
      readySent = true; sel = -1;
      sfx("ping");
      sendReady();
      // renvoi si l'hôte n'a pas confirmé (entrée perdue)
      readyTimer = setInterval(() => { if (cur && (cur.r[mySide] || cur.ph > 0)) { clearInterval(readyTimer); readyTimer = null; } else sendReady(); }, 2000);
      intervals.push(readyTimer);
      if (cur) render(cur);
    });
    let toastAt = 0;
    function toast(m) { const t = Date.now(); if (t - toastAt > 1200) { toastAt = t; api.toast(m); } }

    /* ---------- Affichage ---------- */
    let cur = null, lastN = -1, pending = false, pendTimer = null, endShown = false, aimed = -1;
    const sunkList = str => { const out = []; for (let j = 0; j + 3 < str.length; j += 4) out.push({id: +str[j], x: +str[j + 1], y: +str[j + 2], h: +str[j + 3]}); return out; };
    function pips(n) { return FLEET.map((_, j) => `<i class="bn-pip${j < n ? "" : " bn-x"}"></i>`).join(""); }
    function myFleetDraw(bd, s, small) {
      // mes navires (connus localement) + marques des tirs adverses
      const sunk = sunkList(s ? s.k[A] : "");
      const sunkIds = new Set(sunk.map(k => k.id));
      const list = isPl ? fleet.filter(f => f.placed).map(f => ({id: f.id, x: f.x, y: f.y, h: f.h, cls: sunkIds.has(f.id) ? "bn-sunk" : "", stamp: sunkIds.has(f.id) && !small ? 1 : 0}))
        : sunk.map(k => ({id: k.id, x: k.x, y: k.y, h: k.h, cls: "bn-sunk bn-wreck", stamp: 1}));
      drawShips(bd, list);
      return small;
    }
    function render(s) {
      cur = s;
      const isNew = s.n !== lastN;
      const firstRender = lastN === -1;
      lastN = s.n;
      const placing = isPl && s.ph === 0 && !readySent && !s.r[mySide];
      const waiting = s.ph === 0 && !placing;
      $("bn-place").classList.toggle("bn-hide", !placing);
      $("bn-wait").classList.toggle("bn-hide", !waiting);
      $("bn-battle").classList.toggle("bn-hide", s.ph === 0);
      // en-tête
      const remA = FLEET.length - s.k[A].length / 4, remB = FLEET.length - s.k[B].length / 4;
      $("bn-pips0").innerHTML = pips(remA); $("bn-pips1").innerHTML = pips(remB);
      $("bn-pips0").setAttribute("aria-label", `${remA} navires restants`); $("bn-pips1").setAttribute("aria-label", `${remB} navires restants`);
      $("bn-p0").classList.toggle("bn-on", s.ph === 1 ? s.t === A : s.ph === 0 ? !!s.r[A] : s.w === A);
      $("bn-p1").classList.toggle("bn-on", s.ph === 1 ? s.t === B : s.ph === 0 ? !!s.r[B] : s.w === B);
      if (placing) {
        const o = `<span class="bn-av">${api.avatar(PL[B].key, {view: "bust"})}</span>`;
        $("bn-opp1").className = "bn-opp" + (s.r[B] ? " bn-ok" : "");
        $("bn-opp1").innerHTML = o + (s.r[B] ? `${nm(B)} est prêt·e au combat` : `${nm(B)} déploie sa flotte…`);
        renderPlace();
        return;
      }
      if (waiting) {
        myFleetDraw(boards.wait, s);
        drawShots(boards.wait, null, -1, false);
        $("bn-wait-t").textContent = isPl ? "Silence radio… on attend l'adversaire." : "Les amiraux déploient leurs flottes.";
        const both = isPl ? [B] : [0, 1];
        $("bn-opp2").innerHTML = both.map(i => `<span class="bn-av">${api.avatar(PL[i].key, {view: "bust"})}</span>${s.r[i] ? `${nm(i)} : prêt·e` : `${nm(i)} déploie…`}`).join(" &nbsp; ");
        return;
      }
      // ----- bataille -----
      const L = s.L, animate = isNew && !firstRender;
      const lastR = L && L[0] === A ? L[2] * N + L[1] : -1;   // dernier tir sur le radar
      const lastF = L && L[0] === B ? L[2] * N + L[1] : -1;   // dernier tir sur ma flotte
      drawShots(boards.radar, s.s[A], lastR, animate);
      drawShots(boards.fleet, s.s[B], lastF, animate);
      // radar : seulement les navires adverses coulés
      drawShips(boards.radar, sunkList(s.k[B]).map(k => ({id: k.id, x: k.x, y: k.y, h: k.h, cls: "bn-sunk bn-wreck", stamp: 1})));
      myFleetDraw(boards.fleet, s, true);
      $("bn-rlbl").textContent = isPl ? `Flotte de ${PL[B].pseudo}` : `Tirs de ${PL[A].pseudo} → ${PL[B].pseudo}`;
      $("bn-flbl").textContent = isPl ? "Ma flotte" : `Flotte de ${PL[A].pseudo}`;
      // liste de mes navires
      const sunkIds = new Set(sunkList(s.k[A]).map(k => k.id));
      $("bn-list").innerHTML = FLEET.map((len, id) => {
        let hits = 0;
        if (isPl) hits = shipCells(fleet[id]).filter(([x, y]) => s.s[B][y * N + x] !== "0").length;
        else if (sunkIds.has(id)) hits = len;
        return `<div class="bn-li${sunkIds.has(id) ? " bn-dead" : ""}">${miniShip(id)}<b>${SHIP_NAMES[id]}</b><span class="bn-hp">${Array.from({length: len}, (_, j) => `<i${j < hits ? ` class="bn-x"` : ""}></i>`).join("")}</span></div>`;
      }).join("");
      // statut
      const myTurn = isPl && s.ph === 1 && s.t === mySide;
      if (isNew) { pending = false; aimed = -1; boards.radar.cells.forEach(c => c.classList.remove("bn-aim")); }
      boards.radar.root.classList.toggle("bn-armed", myTurn && !pending);
      const turn = $("bn-turn"), ev = $("bn-ev");
      if (s.ph === 2) {
        turn.className = "bn-turn";
        turn.textContent = s.f ? `${PL[s.w].pseudo} gagne par forfait` : `Victoire de ${PL[s.w].pseudo} !`;
      } else if (myTurn) { turn.className = "bn-turn"; turn.textContent = "À toi de tirer ! Vise une case du radar"; }
      else if (isPl) { turn.className = "bn-turn bn-wait"; turn.textContent = `${PL[B].pseudo} vise ta flotte…`; }
      else { turn.className = "bn-turn bn-wait"; turn.textContent = `Au tour de ${PL[s.t].pseudo}`; }
      if (L) {
        const who = PL[L[0]].pseudo, res = L[3];
        const word = res === 1 ? "Raté." : res === 2 ? "Touché !" : `Coulé ! ${SHIP_NAMES[L[4]]} de ${PL[1 - L[0]].pseudo} par le fond.`;
        ev.textContent = `${isPl && L[0] === mySide ? "Tu tires" : who + " tire"} en ${coord(L[1], L[2])} : ${word}`;
      } else ev.textContent = s.ph === 1 ? `${PL[s.t].pseudo} ouvre le feu en premier.` : "";
      if (animate && L) {
        flash(L[0] === A ? boards.radar : boards.fleet, L[3]);
        sfx(L[3] === 1 ? "miss" : L[3] === 2 ? "hit" : "sunk");
        if (myTurn && s.ph === 1) later(() => sfx("ping"), 900);
      } else if (animate && myTurn) sfx("ping");
      if (s.ph === 2 && !endShown) { endShown = true; later(() => showEnd(s), reduced ? 300 : 1200); }
    }
    function showEnd(s) {
      if (dead) return;
      const w = s.w, won = isPl && w === mySide, lost = isPl && w !== mySide;
      const shots = s.s[w].replace(/0/g, "").length, hits = s.s[w].replace(/[01]/g, "").length;
      $("bn-endly").innerHTML = `<div class="bn-end"><div class="bn-end-card${lost ? " bn-lost" : ""}">
        <span class="bn-tag">${s.f ? "Fin des hostilités" : "Rapport de mission"}</span>
        <span class="bn-av">${api.avatar(PL[w].key, {view: "bust", pose: "flex"})}</span>
        <div class="bn-end-t">${won ? "VICTOIRE !" : lost ? "DÉFAITE" : "VICTOIRE"}</div>
        <div class="bn-end-s">${s.f ? `${nm(1 - w)} a déserté. ${nm(w)} gagne par forfait.` : `${nm(w)} règne sur les mers`}</div>
        <div class="bn-stats"><span><b>${shots}</b>tirs</span><span><b>${hits}</b>touchés</span><span><b>${shots ? Math.round(hits / shots * 100) : 0}%</b>précision</span></div>
      </div></div>`;
    }
    api.onState(s => { if (!dead && s && s.s) render(s); });

    boards.radar.sea.addEventListener("click", e => {
      const c = e.target.closest(".bn-cell");
      if (!c || !cur || !isPl || cur.ph !== 1 || cur.t !== mySide || pending) return;
      const i = +c.dataset.i;
      if (cur.s[mySide][i] !== "0") return;
      pending = true; aimed = i;
      c.classList.add("bn-aim");
      boards.radar.root.classList.remove("bn-armed");
      sfx("click");
      api.setInput({seq: ++mySeq, a: "fire", x: i % N, y: (i / N) | 0, ships: fleet.map(s => [s.x, s.y, FLEET[s.id], s.h])});
      clearTimeout(pendTimer);
      pendTimer = later(() => {
        if (pending && cur && cur.t === mySide && cur.ph === 1) {
          pending = false; c.classList.remove("bn-aim"); boards.radar.root.classList.add("bn-armed");
        }
      }, 3000);
    });

    // état initial avant le premier message de l'hôte
    if (!isPl) render({ph: 0, r: [0, 0], t: 0, s: ["0".repeat(64), "0".repeat(64)], k: ["", ""], n: -2, L: null, w: -1, f: 0});
    else { $("bn-place").classList.remove("bn-hide"); renderPlace(); $("bn-pips0").innerHTML = pips(5); $("bn-pips1").innerHTML = pips(5); }

    return {
      destroy() {
        dead = true;
        timers.forEach(clearTimeout); intervals.forEach(clearInterval);
        if (readyTimer) clearInterval(readyTimer);
        el.removeEventListener("pointerdown", unlock);
        if (ac) { try { ac.close(); } catch (e) { /* rien */ } ac = null; }
        el.innerHTML = "";
      }
    };
  }
});
