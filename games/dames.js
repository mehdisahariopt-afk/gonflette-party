/* Gonflette Party : Dames (8×8, règles françaises) en réseau, 2 joueurs, chacun sur son téléphone.
   Les pions sont des disques de fonte (rouges/craie contre bleus/noirs), la dame est une pile de disques couronnée.
   Règles : pions en diagonale vers l'avant, prise obligatoire (avant ET arrière), prise majoritaire (la rafle qui
   prend le plus de pièces), rafles en plusieurs sauts, pièces prises retirées en fin de rafle (on ne saute pas deux
   fois la même), promotion seulement si le pion TERMINE son coup sur la dernière rangée, dames volantes.
   Fin : plus de pièce ou plus de coup = perdu. Nul : 25 coups de dames de chaque côté sans prise ni pion, finales
   « 16 coups / 5 coups » (une dame seule contre 3 pièces ou moins dont une dame), position répétée 3 fois, ou accord.
   60 s par coup : passé ce délai l'hôte joue un coup légal au hasard (on ne perd pas au temps, c'est convivial).

   Cases : 32 cases foncées numérotées 0..31, ligne r = i>>2 (0 en haut, camp bleu), colonne c = 2*(i&3) + (r pair ? 1 : 0).
   État publié par l'hôte (~150 octets) :
     b : 32 caractères "0" vide, "1" pion rouge, "2" pion bleu, "3" dame rouge, "4" dame bleue
     t : camp au trait (1 rouge, commence ; 2 bleu)      n : nombre de coups joués
     l : chemin du dernier coup [départ, sauts…]         x : cases prises au dernier coup
     k : demi-coups consécutifs de dames sans prise      e : demi-coups dans une finale à limite (0 sinon)
     g : [kg pris par rouge, kg pris par bleu]           a : 1 si le dernier coup a été joué au temps
     d : camp qui propose le nul (0 = aucun)             q : [n à partir duquel rouge / bleu peut reproposer]
     o : 1 si terminé ; r : camp gagnant (0 = nul) ; y : "nop" | "blk" | "25" | "fin" | "rep" | "agr"
   Entrées : {seq, m: [chemin]} pour jouer, {seq, a: "offer" | "accept" | "decline"} pour le nul. */
(function () {
  // ---------- règles pures (testables hors navigateur) ----------
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const KING_DRAW = 50;                      // 25 coups de dames de chaque côté
  const START = "2".repeat(12) + "0".repeat(8) + "1".repeat(12);
  const rc = i => { const r = i >> 2; return [r, ((i & 3) << 1) + (r % 2 === 0 ? 1 : 0)]; };
  const sq = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 && ((r + c) & 1)) ? (r << 2) + (c >> 1) : -1;
  const sideOf = ch => ch === "1" || ch === "3" ? 1 : ch === "2" || ch === "4" ? 2 : 0;
  const isKing = ch => ch === "3" || ch === "4";
  const promoRow = side => side === 1 ? 0 : 7;
  const name = i => { const [r, c] = rc(i); return "abcdefgh"[c] + (8 - r); };

  // Toutes les rafles complètes de la pièce en `from` (sans filtre majoritaire).
  function capturesFrom(b, from) {
    const pc = b[from], me = sideOf(pc), king = isKing(pc), out = [];
    if (!me) return out;
    const g = b.split("");
    g[from] = "0";                           // la pièce a quitté sa case pendant la rafle
    const taken = [], path = [from];
    (function dfs(i) {
      const [r, c] = rc(i);
      let ext = false;
      for (const [dr, dc] of DIRS) {
        if (king) {
          let rr = r + dr, cc = c + dc, k;
          while ((k = sq(rr, cc)) >= 0 && g[k] === "0") { rr += dr; cc += dc; }
          // pièce adverse pas encore prise (les pièces prises restent sur le plateau jusqu'à la fin et bloquent)
          if (k < 0 || sideOf(g[k]) !== 3 - me || taken.includes(k)) continue;
          rr += dr; cc += dc;
          let land;
          while ((land = sq(rr, cc)) >= 0 && g[land] === "0") {
            ext = true; taken.push(k); path.push(land); dfs(land); path.pop(); taken.pop();
            rr += dr; cc += dc;
          }
        } else {
          const k = sq(r + dr, c + dc), land = sq(r + 2 * dr, c + 2 * dc);
          if (k < 0 || land < 0 || sideOf(g[k]) !== 3 - me || taken.includes(k) || g[land] !== "0") continue;
          ext = true; taken.push(k); path.push(land); dfs(land); path.pop(); taken.pop();
        }
      }
      if (!ext && taken.length) out.push({p: path.slice(), x: taken.slice()});
    })(from);
    return out;
  }
  function simpleFrom(b, from) {
    const pc = b[from], me = sideOf(pc), out = [];
    if (!me) return out;
    const [r, c] = rc(from);
    for (const [dr, dc] of DIRS) {
      if (isKing(pc)) {
        let rr = r + dr, cc = c + dc, k;
        while ((k = sq(rr, cc)) >= 0 && b[k] === "0") { out.push({p: [from, k], x: []}); rr += dr; cc += dc; }
      } else if (dr === (me === 1 ? -1 : 1)) {
        const k = sq(r + dr, c + dc);
        if (k >= 0 && b[k] === "0") out.push({p: [from, k], x: []});
      }
    }
    return out;
  }
  // Coups légaux du camp `side` : prise obligatoire + majoritaire, sinon déplacements simples.
  function legalMoves(b, side) {
    let caps = [];
    for (let i = 0; i < 32; i++) if (sideOf(b[i]) === side) caps = caps.concat(capturesFrom(b, i));
    if (caps.length) {
      const m = Math.max(...caps.map(v => v.x.length));
      return caps.filter(v => v.x.length === m);
    }
    let out = [];
    for (let i = 0; i < 32; i++) if (sideOf(b[i]) === side) out = out.concat(simpleFrom(b, i));
    return out;
  }
  function applyMove(b, mv) {
    const g = b.split(""), from = mv.p[0], to = mv.p[mv.p.length - 1];
    let pc = g[from];
    g[from] = "0";
    mv.x.forEach(k => { g[k] = "0"; });
    if (!isKing(pc) && rc(to)[0] === promoRow(sideOf(pc))) pc = pc === "1" ? "3" : "4";
    g[to] = pc;
    return g.join("");
  }
  function counts(b) {
    const n = {1: 0, 2: 0, 3: 0, 4: 0};
    for (const ch of b) if (ch !== "0") n[ch]++;
    return n;
  }
  // Finales à limite (règle française) : une dame seule contre au plus 3 pièces dont au moins une dame.
  // 3 pièces : 16 coups chacun (32 demi-coups) ; 2 pièces ou moins : 5 coups chacun (10 demi-coups).
  function endLimit(b) {
    const n = counts(b);
    for (const [weak, wm, wk] of [[1, 2, 4], [2, 1, 3]]) {
      const lone = weak === 1 ? n[1] === 0 && n[3] === 1 : n[2] === 0 && n[4] === 1;
      const strong = n[wm] + n[wk];
      if (lone && n[wk] >= 1 && strong <= 3) return strong === 3 ? 32 : 10;
    }
    return 0;
  }
  const cfg = b => { const n = counts(b); return `${n[1]}.${n[2]}.${n[3]}.${n[4]}`; };
  function newGame() {
    return {b: START, t: 1, n: 0, l: [], x: [], k: 0, e: 0, g: [0, 0], a: 0, d: 0, q: [0, 0], o: 0, r: 0, y: ""};
  }
  function findMove(s, path) {
    if (!s || s.o || !Array.isArray(path) || path.length < 2 || path.length > 16) return null;
    if (!path.every(v => Number.isInteger(v) && v >= 0 && v < 32)) return null;
    return legalMoves(s.b, s.t).find(m => m.p.length === path.length && m.p.every((v, i) => v === path[i])) || null;
  }
  // Joue `path` pour le camp au trait. `rep` (Map facultative) compte les positions pour la triple répétition.
  // Renvoie le nouvel état, ou null si le coup est illégal.
  function play(s, path, rep) {
    const mv = findMove(s, path);
    if (!mv) return null;
    const pc = s.b[mv.p[0]];
    const b = applyMove(s.b, mv);
    const kg = mv.x.reduce((a, k) => a + (isKing(s.b[k]) ? 20 : 10), 0);
    const g = s.g.slice(); g[s.t - 1] += kg;
    const q = s.q.slice();
    let d = s.d;
    if (d && d !== s.t) { d = 0; q[s.d - 1] = s.n + 3; }   // jouer = refuser le nul proposé
    const quiet = isKing(pc) && !mv.x.length;
    const lim = endLimit(b);
    const ns = {b, t: 3 - s.t, n: s.n + 1, l: mv.p.slice(), x: mv.x.slice(), k: quiet ? s.k + 1 : 0,
      e: lim && !mv.x.length && cfg(b) === cfg(s.b) && endLimit(s.b) === lim ? s.e + 1 : 0,
      g, a: 0, d, q, o: 0, r: 0, y: ""};
    if (!legalMoves(b, ns.t).length) {
      ns.o = 1; ns.r = s.t; ns.y = /[1-4]/.test(b.replace(new RegExp(`[${s.t}${s.t + 2}]`, "g"), "")) ? "blk" : "nop";
    } else if (ns.k >= KING_DRAW) { ns.o = 1; ns.y = "25"; }
    else if (lim && ns.e >= lim) { ns.o = 1; ns.y = "fin"; }
    else if (rep) {
      if (!quiet) rep.clear();                // coup irréversible : les anciennes positions ne peuvent plus revenir
      const key = b + ns.t, c = (rep.get(key) || 0) + 1;
      rep.set(key, c);
      if (c >= 3) { ns.o = 1; ns.y = "rep"; }
    }
    if (ns.o) ns.d = 0;
    return ns;
  }
  const RULES = {START, KING_DRAW, rc, sq, name, sideOf, isKing, capturesFrom, simpleFrom, legalMoves, applyMove, endLimit, newGame, findMove, play};

  GONFLETTE.registerGame({
    id: "dames",
    name: "Dames",
    min: 2,
    max: 2,
    rules: RULES,
    create(api) {
      const TL = 60;                              // secondes par coup
      const el = api.el;
      // Qui a les rouges (et commence) : tiré au sort, identique sur tous les téléphones.
      const swap = api.rng() < 0.5;
      const S = [null, api.players[swap ? 1 : 0], api.players[swap ? 0 : 1]];
      const mySide = api.me === S[1].key ? 1 : api.me === S[2].key ? 2 : 0;
      const flip = mySide === 2;                 // chacun voit ses pièces en bas
      const RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const stopT = id => { if (id) { clearTimeout(id); clearInterval(id); timers.delete(id); } };
      let dead = false;
      const esc = t => String(t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[ch]);
      const topSide = mySide ? 3 - mySide : 2, botSide = 3 - topSide;
      const COL = [null, "rouges", "bleus"];

      // ---------- dessins (disques de fonte) ----------
      const plate = (s, cy, r) => `<circle cx="50" cy="${cy}" r="${r}" fill="url(#dm-g${s})"/>
        <circle cx="50" cy="${cy}" r="${r - 5.5}" fill="none" stroke="${s === 1 ? "#f6efe2" : "#4d94ff"}" stroke-width="2.6" opacity=".92"/>
        <circle cx="50" cy="${cy}" r="${r - 15}" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="2.2"/>
        <circle cx="50" cy="${cy}" r="${r - 15}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" transform="translate(0 1.4)"/>`;
      const hub = cy => `<circle cx="50" cy="${cy}" r="13" fill="url(#dm-hub)"/><circle cx="50" cy="${cy}" r="5.6" fill="#1b1d22"/>`;
      const chalk = cy => `<path d="M29 ${cy - 18} q8 -7 17 -6 M60 ${cy + 21} q9 -2 13 -9" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none" opacity=".28"/>`;
      const label = (s, cy) => `<text x="50" y="${cy - 25.5}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="9.5" fill="${s === 1 ? "#fff5ea" : "#8fbaff"}" opacity=".9">10</text>`;
      const crown = cy => `<circle cx="50" cy="${cy}" r="21" fill="url(#dm-gold)" stroke="#6b3f00" stroke-width="1.8"/>
        <path d="M35.5 ${cy + 8} L33 ${cy - 7} L42 ${cy - 1} L50 ${cy - 12} L58 ${cy - 1} L67 ${cy - 7} L64.5 ${cy + 8} Z" fill="#fff6cf" stroke="#6b3f00" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="33" cy="${cy - 8}" r="2.4" fill="#fff6cf" stroke="#6b3f00" stroke-width="1.4"/><circle cx="50" cy="${cy - 13}" r="2.6" fill="#fff6cf" stroke="#6b3f00" stroke-width="1.4"/><circle cx="67" cy="${cy - 8}" r="2.4" fill="#fff6cf" stroke="#6b3f00" stroke-width="1.4"/>`;
      const sym = (s, k) => k
        ? `<symbol id="dm-k${s}" viewBox="0 0 100 100"><circle cx="50" cy="55" r="44" fill="${s === 1 ? "#7d141e" : "#0b0c10"}"/><circle cx="50" cy="55" r="44" fill="none" stroke="${s === 1 ? "#f6efe2" : "#3a86ff"}" stroke-width="2" opacity=".55"/>${plate(s, 46, 44)}<circle cx="50" cy="46" r="43" fill="none" stroke="#ffcc33" stroke-width="3.2"/>${chalk(46)}${crown(46)}</symbol>`
        : `<symbol id="dm-m${s}" viewBox="0 0 100 100">${plate(s, 50, 46)}${label(s, 50)}${chalk(50)}${hub(50)}</symbol>`;
      const pieceSvg = ch => `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#dm-${isKing(ch) ? "k" : "m"}${sideOf(ch)}"/></svg>`;

      let cells = "";
      for (let R = 0; R < 8; R++) for (let C = 0; C < 8; C++) {
        const r = flip ? 7 - R : R, c = flip ? 7 - C : C, i = sq(r, c);
        cells += i < 0 ? `<span class="dm-sq dm-lt"></span>` : `<button type="button" class="dm-sq dm-dk" data-i="${i}" aria-label="Case ${name(i)}"></button>`;
      }
      const card = side => `<div class="dm-card dm-c${side}" id="dm-card${side}">
          <div class="dm-av">${api.avatar(S[side].key, {view: "bust"})}</div>
          <div class="dm-who"><span class="dm-nmr"><b class="dm-nm"></b><span class="dm-tag"></span></span><span class="dm-sub"><svg class="dm-chip" viewBox="0 0 100 100" aria-hidden="true"><use href="#dm-m${side}"/></svg><span class="dm-cnt">12 pièces</span></span></div>
          <div class="dm-stack" aria-label="Fonte prise"><div class="dm-sleeve"></div><span class="dm-kg">0 kg</span></div>
          <div class="dm-clock" aria-hidden="true"><span>${TL}</span></div>
        </div>`;

      el.innerHTML = `<style>
        .dm{--red:#e63946;--blue:#3a86ff;--chalk:#f6efe2;--gold:#ffcc33;--ink:#15171c;position:relative;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(6px,1.3vh,14px);padding:8px 8px 10px;color:#f1ece2;font-family:"Barlow Condensed",system-ui,sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent;
          background:radial-gradient(90% 50% at 50% 0%,rgba(255,204,51,.10),transparent 70%),radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.6px) 0 0/9px 9px,radial-gradient(rgba(255,204,51,.08) 1px,transparent 1.6px) 4px 5px/13px 13px,linear-gradient(#262a32,#15171b)}
        .dm *{box-sizing:border-box}
        .dm-defs{position:absolute;width:0;height:0;overflow:hidden}
        .dm-card{position:relative;width:min(100%,640px);display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:5px 8px 5px 5px;border-radius:16px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.12);opacity:.72;transition:opacity .3s,border-color .3s,box-shadow .3s}
        .dm-card.dm-on{opacity:1}
        .dm-c1.dm-on{border-color:var(--red);box-shadow:0 0 18px rgba(230,57,70,.35)}
        .dm-c2.dm-on{border-color:var(--blue);box-shadow:0 0 18px rgba(58,134,255,.35)}
        .dm-card.dm-win{opacity:1;border-color:var(--gold);box-shadow:0 0 22px rgba(255,204,51,.5)}
        .dm-av{width:50px;height:50px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.2),rgba(255,255,255,.03));border:2px solid rgba(255,255,255,.3)}
        .dm-c1 .dm-av{border-color:rgba(230,57,70,.8)}.dm-c2 .dm-av{border-color:rgba(58,134,255,.8)}
        .dm-av .av{width:100%;height:100%;display:block}
        .dm-who{min-width:0;display:grid;line-height:1.05}
        .dm-nm{font-weight:800;font-size:1.18rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dm-sub{display:flex;align-items:center;gap:4px;min-width:0;font-size:.95rem;opacity:.85;white-space:nowrap}
        .dm-cnt{min-width:0;overflow:hidden;text-overflow:ellipsis}
        .dm-chip{width:18px;height:18px;flex:none}
        .dm-off .dm-nm::after{content:" · hors ligne";font-weight:600;font-size:.85rem;color:#ff9d9d}
        .dm-stack{display:grid;justify-items:center;gap:1px;min-width:44px}
        .dm-sleeve{position:relative;display:flex;align-items:center;gap:1px;height:30px;padding:0 6px 0 4px;min-width:34px}
        .dm-sleeve::before{content:"";position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:linear-gradient(#e9edf2,#8a929c 60%,#5d646d)}
        .dm-sleeve::after{content:"";position:absolute;left:0;top:50%;width:5px;height:14px;margin-top:-7px;border-radius:2px;background:linear-gradient(#cfd5dc,#6b727b)}
        .dm-sleeve i{position:relative;z-index:1;width:5px;height:24px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
        .dm-sleeve i.dm-pk{height:30px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35),0 0 0 1px var(--gold)}
        .dm-sleeve i.dm-p1{background:linear-gradient(90deg,#ff6b76,#c41e2c)}
        .dm-sleeve i.dm-p2{background:linear-gradient(90deg,#4b5160,#15171c);border-top:2px solid var(--blue);border-bottom:2px solid var(--blue)}
        .dm-sleeve i.dm-new{animation:dm-slide .45s cubic-bezier(.3,1.6,.5,1)}
        .dm-kg{font-family:Anton,Impact,sans-serif;font-size:.92rem;letter-spacing:.02em;line-height:1;color:#cfd3da}
        .dm-kg.dm-has{color:var(--gold)}
        .dm-clock{--f:1;--c:#9fe870;position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--f) * 360deg),rgba(255,255,255,.1) 0);opacity:.35;transition:opacity .3s}
        .dm-clock::before{content:"";position:absolute;inset:4px;border-radius:50%;background:#1d2027}
        .dm-clock span{position:relative;font-family:Anton,Impact,sans-serif;font-size:1rem}
        .dm-on .dm-clock{opacity:1}
        .dm-clock.dm-low{--c:#ff5a5a}
        .dm-clock.dm-low span{color:#ff8a8a}
        .dm-nmr{display:flex;align-items:center;gap:6px;min-width:0}
        .dm-nmr .dm-nm{flex:0 1 auto;min-width:0}
        .dm-tag{display:none;flex:none;font-family:Pacifico,"Brush Script MT",cursive;font-size:.86rem;line-height:1.35;padding:0 9px;border-radius:999px;border:2px solid var(--ink);background:var(--gold);color:var(--ink);transform:rotate(-4deg);white-space:nowrap;pointer-events:none}
        .dm-on .dm-tag{display:inline-block;animation:dm-pop .3s cubic-bezier(.3,1.6,.5,1)}
        .dm-tag.dm-wait{background:#2c3039;color:#e8e4da;border-color:rgba(255,255,255,.3)}
        .dm-me.dm-on .dm-tag{animation:dm-pop .3s cubic-bezier(.3,1.6,.5,1),dm-bob 1.4s .3s ease-in-out infinite}
        .dm-status{width:min(100%,640px);min-height:1.5em;font-family:Pacifico,"Brush Script MT",cursive;font-size:1.12rem;line-height:1.35;text-align:center;padding:0 6px;text-shadow:0 1px 0 rgba(0,0,0,.4)}
        .dm-status.dm-me{color:#fff3c0}
        .dm-status.dm-warn{color:#ffb547}
        .dm-status.dm-bump{animation:dm-bump .4s}
        .dm-wrap{position:relative;flex:none;width:min(100%,640px,max(260px,calc(100dvh - 380px)));aspect-ratio:1}
        .dm-board{position:absolute;inset:0;padding:3.2%;border-radius:14px;background:linear-gradient(135deg,#6d4220,#3f2410);box-shadow:0 16px 40px rgba(0,0,0,.55),inset 0 0 0 2px rgba(255,255,255,.08)}
        .dm-board::before{content:"";position:absolute;inset:1.4%;border:2px solid rgba(255,204,51,.75);border-radius:9px;pointer-events:none}
        .dm-in{position:relative;width:100%;height:100%;border-radius:4px;overflow:hidden;box-shadow:0 0 0 2px rgba(0,0,0,.45)}
        .dm-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr)}
        .dm-sq{position:relative;display:block;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:0;color:inherit;font:inherit}
        .dm-lt{background:repeating-linear-gradient(0deg,rgba(150,95,40,.13) 0 1px,transparent 1px 5px),linear-gradient(160deg,#f1d4a2,#ddb47a)}
        .dm-dk{cursor:default;touch-action:manipulation;background:repeating-linear-gradient(90deg,rgba(40,18,4,.18) 0 1px,transparent 1px 6px),linear-gradient(160deg,#a0683a,#7d4b24)}
        .dm-dk:focus-visible{outline:3px solid var(--gold);outline-offset:-3px}
        .dm-dk.dm-last{background:linear-gradient(rgba(255,214,60,.32),rgba(255,214,60,.32)),repeating-linear-gradient(90deg,rgba(40,18,4,.18) 0 1px,transparent 1px 6px),linear-gradient(160deg,#a0683a,#7d4b24)}
        .dm-dk.dm-trail::after{content:"";position:absolute;left:50%;top:50%;width:16%;height:16%;margin:-8% 0 0 -8%;border-radius:50%;background:rgba(255,214,60,.75)}
        .dm-dk.dm-tgt{cursor:pointer}
        .dm-dk.dm-tgt::after{content:"";position:absolute;left:50%;top:50%;width:34%;height:34%;margin:-17% 0 0 -17%;border-radius:50%;background:rgba(150,255,120,.85);box-shadow:0 0 0 3px rgba(20,60,10,.35),0 0 14px rgba(150,255,120,.8);animation:dm-pulse 1.1s ease-in-out infinite}
        .dm-dk.dm-tgt.dm-cap::after{background:rgba(255,170,50,.9);box-shadow:0 0 0 3px rgba(80,30,0,.35),0 0 14px rgba(255,170,50,.9)}
        .dm-mine .dm-dk.dm-can{cursor:pointer}
        .dm-pcs{position:absolute;inset:0;pointer-events:none}
        .dm-pc{position:absolute;left:0;top:0;width:12.5%;height:12.5%;transition:transform .2s ease-out,opacity .3s;will-change:transform}
        .dm-pc svg{position:absolute;left:7%;top:7%;width:86%;height:86%;filter:drop-shadow(0 3px 2px rgba(0,0,0,.55));transition:transform .15s}
        .dm-pc::after{content:"";position:absolute;inset:5%;border-radius:50%;pointer-events:none;transition:box-shadow .2s}
        .dm-pc.dm-can::after{box-shadow:0 0 0 2px rgba(255,255,255,.75)}
        .dm-pc.dm-must::after{box-shadow:0 0 0 3px #ffa62b,0 0 16px #ffa62b;animation:dm-glow 1s ease-in-out infinite}
        .dm-pc.dm-sel{z-index:3}
        .dm-pc.dm-sel svg{transform:scale(1.1) translateY(-4%)}
        .dm-pc.dm-sel::after{box-shadow:0 0 0 3px var(--gold),0 0 20px var(--gold);animation:none}
        .dm-pc.dm-fly{z-index:4;transition:transform .26s cubic-bezier(.35,0,.25,1)}
        .dm-pc.dm-fly svg{transform:scale(1.12)}
        .dm-pc.dm-ghost{opacity:.38}
        .dm-pc.dm-ghost svg{filter:grayscale(.8)}
        .dm-pc.dm-out{opacity:0;transition:opacity .3s}
        .dm-pc.dm-out svg{transform:scale(.4) translateY(-60%)}
        .dm-pc.dm-in0{opacity:0}
        .dm-pc.dm-promo svg{animation:dm-crown .7s cubic-bezier(.3,1.6,.5,1)}
        .dm-pc.dm-nope svg{animation:dm-shake .35s}
        .dm-ovl{position:absolute;inset:0;z-index:6;display:grid;place-items:center;padding:8%;pointer-events:none}
        .dm-box{pointer-events:auto;width:100%;max-width:320px;display:grid;justify-items:center;gap:8px;text-align:center;padding:14px 14px 12px;border-radius:18px;background:rgba(21,23,28,.94);border:3px solid var(--gold);box-shadow:0 12px 40px rgba(0,0,0,.6);animation:dm-pop .35s cubic-bezier(.3,1.5,.5,1)}
        .dm-box p{margin:0;font-size:1.12rem;line-height:1.2}
        .dm-box .dm-big{font-family:Anton,Impact,sans-serif;font-size:2.3rem;line-height:1;letter-spacing:.02em;text-transform:uppercase;color:var(--gold)}
        .dm-box .dm-big.dm-lose{color:#c9ccd3}
        .dm-box .dm-eav{width:96px;height:96px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(255,204,51,.35),rgba(255,255,255,.04));border:3px solid var(--gold)}
        .dm-box .dm-eav .av{width:100%;height:100%;display:block}
        .dm-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
        .dm-btn{min-height:44px;padding:6px 16px;border-radius:12px;border:2px solid var(--ink);background:var(--gold);color:var(--ink);font:800 1.05rem "Barlow Condensed",system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 var(--ink);touch-action:manipulation}
        .dm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
        .dm-btn.dm-alt{background:#2c3039;color:#f1ece2;border-color:rgba(255,255,255,.25);box-shadow:0 3px 0 rgba(0,0,0,.5)}
        .dm-btn:disabled{opacity:.45;cursor:default;transform:none}
        .dm-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
        .dm-acts{width:min(100%,640px);display:flex;gap:8px;justify-content:center;align-items:center}
        .dm-acts .dm-btn{flex:1 1 0;max-width:200px;min-height:40px;font-size:1rem;padding:4px 10px}
        .dm-hint{width:min(100%,640px);min-height:1.2em;text-align:center;font-size:.98rem;line-height:1.2;opacity:.8;padding:0 6px}
        .dm-hint b{color:var(--gold)}
        .dm-sheet{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:rgba(10,11,14,.72);backdrop-filter:blur(3px)}
        .dm-sheet[hidden]{display:none}
        .dm-sheet .dm-box{max-width:440px;max-height:100%;overflow:auto;justify-items:stretch;text-align:left}
        .dm-sheet h3{margin:0;font:400 1.5rem Anton,Impact,sans-serif;text-transform:uppercase;color:var(--gold);text-align:center}
        .dm-sheet ul{margin:0;padding-left:18px;display:grid;gap:5px;font-size:1.04rem;line-height:1.25}
        .dm-sheet li b{color:var(--gold)}
        .dm-sheet .dm-btn{justify-self:center}
        @keyframes dm-pulse{50%{transform:scale(1.18)}}
        @keyframes dm-glow{50%{box-shadow:0 0 0 4px #ffc46b,0 0 24px #ffa62b}}
        @keyframes dm-bob{50%{transform:rotate(-4deg) scale(1.08)}}
        @keyframes dm-bump{40%{transform:scale(1.06)}}
        @keyframes dm-pop{from{transform:scale(.6);opacity:0}}
        @keyframes dm-crown{0%{transform:scale(1)}40%{transform:scale(1.45) rotate(-12deg)}100%{transform:scale(1)}}
        @keyframes dm-shake{25%{transform:translateX(-10%)}75%{transform:translateX(10%)}}
        @keyframes dm-slide{from{transform:translateX(-14px);opacity:0}}
        @media (prefers-reduced-motion:reduce){.dm *,.dm *::after{animation:none!important;transition:none!important}}
        @media (max-height:700px){.dm-av{width:44px;height:44px}.dm-card{padding:3px 6px 3px 3px}.dm-clock{width:36px;height:36px}.dm-status{font-size:1.02rem}.dm-acts .dm-btn{min-height:36px}}
        @media (min-width:700px){.dm-av{width:60px;height:60px}.dm-status{font-size:1.3rem}.dm-nm{font-size:1.3rem}}
        @media (max-height:540px) and (min-aspect-ratio:4/3){
          .dm{display:grid;grid-template-columns:auto minmax(0,400px);grid-auto-rows:auto;align-content:center;justify-content:center;column-gap:16px;row-gap:8px;padding:8px 12px}
          .dm-wrap{grid-column:1;grid-row:1 / span 5;width:max(220px,calc(100dvh - 80px))}
          .dm-card,.dm-status,.dm-hint,.dm-acts{grid-column:2;width:100%}
          .dm-av{width:42px;height:42px}}
      </style>
      <div class="dm" id="dm-root">
        <svg class="dm-defs" aria-hidden="true" focusable="false"><defs>
          <radialGradient id="dm-g1" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ff7a83"/><stop offset=".45" stop-color="#e3303f"/><stop offset="1" stop-color="#8e1420"/></radialGradient>
          <radialGradient id="dm-g2" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#5b6272"/><stop offset=".45" stop-color="#262a33"/><stop offset="1" stop-color="#0b0c10"/></radialGradient>
          <radialGradient id="dm-hub" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c3c9d1"/><stop offset="1" stop-color="#6f7782"/></radialGradient>
          <radialGradient id="dm-gold" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#ffc533"/><stop offset="1" stop-color="#b87600"/></radialGradient>
          ${sym(1, 0)}${sym(2, 0)}${sym(1, 1)}${sym(2, 1)}
        </defs></svg>
        ${card(topSide)}
        <div class="dm-status" id="dm-status" role="status" aria-live="polite">On charge la barre…</div>
        <div class="dm-wrap" id="dm-wrap">
          <div class="dm-board"><div class="dm-in">
            <div class="dm-grid" id="dm-grid">${cells}</div>
            <div class="dm-pcs" id="dm-pcs"></div>
          </div></div>
          <div class="dm-ovl" id="dm-ovl"></div>
        </div>
        ${card(botSide)}
        <div class="dm-hint" id="dm-hint"></div>
        <div class="dm-acts">
          ${mySide ? `<button type="button" class="dm-btn dm-alt" id="dm-draw">🤝 Proposer nul</button>` : ""}
          <button type="button" class="dm-btn dm-alt" id="dm-help">📖 Règles</button>
        </div>
        <div class="dm-sheet" id="dm-sheet" hidden><div class="dm-box" role="dialog" aria-label="Règles des dames">
          <h3>Règles des dames</h3>
          <ul>
            <li>Les <b>pions</b> avancent d'une case en diagonale, vers l'avant.</li>
            <li>La <b>prise est obligatoire</b>, vers l'avant comme vers l'arrière, en sautant par-dessus la pièce adverse. On enchaîne les sauts : c'est une <b>rafle</b>.</li>
            <li><b>Prise majoritaire</b> : il faut choisir la rafle qui prend le plus de pièces.</li>
            <li>Un pion qui <b>termine</b> son coup sur la dernière rangée devient <b>dame</b> (disques empilés et couronnés). S'il ne fait qu'y passer pendant une rafle, il reste pion.</li>
            <li>La <b>dame vole</b> : elle se déplace et prend à n'importe quelle distance en diagonale.</li>
            <li><b>Victoire</b> : l'adversaire n'a plus de pièce ou plus aucun coup.</li>
            <li><b>Nul</b> : 25 coups de dames de chaque côté sans prise, une dame seule en finale (16 ou 5 coups), même position 3 fois, ou d'un commun accord.</li>
            <li><b>${TL} s par coup</b> : passé ce délai, un coup est joué au hasard pour toi !</li>
          </ul>
          <button type="button" class="dm-btn" id="dm-close">C'est parti !</button>
        </div></div>
      </div>`;

      const $ = s => el.querySelector(s);
      const root = $("#dm-root"), grid = $("#dm-grid"), pcsEl = $("#dm-pcs"), statusEl = $("#dm-status"), hintEl = $("#dm-hint"), ovl = $("#dm-ovl");
      const sqEls = {};
      grid.querySelectorAll(".dm-dk").forEach(b => { sqEls[+b.dataset.i] = b; });
      const cardEl = [null, $("#dm-card1"), $("#dm-card2")];
      [1, 2].forEach(s => {
        cardEl[s].querySelector(".dm-nm").textContent = S[s].pseudo;
        if (s === mySide) cardEl[s].classList.add("dm-me");
      });
      const drawBtn = $("#dm-draw"), sheet = $("#dm-sheet");

      // ---------- son (WebAudio, après un geste) ----------
      let ac = null;
      function unlock() {
        if (ac || dead) return;
        try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } catch (e) { ac = null; }
      }
      el.addEventListener("pointerdown", unlock);
      function clank(heavy) {
        if (!ac) return;
        try {
          const t = ac.currentTime, out = ac.createGain();
          out.gain.value = heavy ? 0.16 : 0.09; out.connect(ac.destination);
          (heavy ? [196, 471, 1043, 1690] : [310, 742]).forEach((f, j) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = "sine"; o.frequency.value = f * (0.98 + Math.random() * 0.04);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1 / (j + 1), t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.55 : 0.16) / (1 + j * 0.4));
            o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6);
          });
          const len = 0.06, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
          const src = ac.createBufferSource(), f = ac.createBiquadFilter();
          src.buffer = buf; f.type = "lowpass"; f.frequency.value = heavy ? 1800 : 900;
          src.connect(f); f.connect(out); src.start(t);
        } catch (e) { /* son facultatif */ }
      }
      function tones(freqs, step, type, vol) {
        if (!ac) return;
        try {
          freqs.forEach((fq, i) => {
            const t = ac.currentTime + i * step, o = ac.createOscillator(), g = ac.createGain();
            o.type = type || "triangle"; o.frequency.value = fq;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.35);
          });
        } catch (e) { /* son facultatif */ }
      }

      // ---------- logique (hôte) ----------
      let hs = null, rep = null, clk = 0, finishTimer = 0;
      const seen = {};
      function hostEnd() {
        if (finishTimer) return;
        const s = hs, W = s.r ? S[s.r] : null, L = s.r ? S[3 - s.r] : null;
        const summary = s.y === "nop" ? `${W.pseudo} a raflé toute la fonte de ${L.pseudo} : plus une seule pièce !`
          : s.y === "blk" ? `${W.pseudo} gagne : ${L.pseudo} est coincé, plus aucun coup possible.`
          : s.y === "25" ? "Match nul : 25 coups de dames de chaque côté sans prise."
          : s.y === "fin" ? "Match nul : une dame seule tient la finale."
          : s.y === "rep" ? "Match nul : la même position trois fois de suite."
          : "Match nul d'un commun accord : poignée de main virile.";
        const res = W ? {winners: [W.key], ranking: [W.key, L.key], summary} : {winners: [], ranking: [S[1].key, S[2].key], summary};
        finishTimer = later(() => api.finish(res), 3600 + (s.l.length - 1) * 300);
      }
      function commit(ns) {
        hs = ns;
        api.setState(hs);
        if (hs.o) { stopT(clk); clk = 0; hostEnd(); } else armClock();
      }
      function armClock() {
        stopT(clk);
        const n = hs.n;
        clk = later(() => {
          clk = 0;
          if (!hs || hs.o || hs.n !== n) return;
          const L = legalMoves(hs.b, hs.t);
          if (!L.length) return;
          const ns = play(hs, L[Math.floor(Math.random() * L.length)].p, rep);
          if (ns) { ns.a = 1; commit(ns); }
        }, TL * 1000 + 1500);
      }
      if (api.isHost) {
        hs = newGame();
        rep = new Map([[hs.b + hs.t, 1]]);
        api.setState(hs);
        armClock();
        api.onInputs(inputs => {
          if (!hs || dead) return;
          for (const side of [1, 2]) {
            const key = S[side].key, inp = inputs[key];
            if (!inp || inp.seq == null || inp.seq === seen[key]) continue;
            seen[key] = inp.seq;                         // chaque entrée n'est traitée qu'une fois
            if (hs.o) continue;
            if (inp.a === "offer") {
              if (!hs.d && hs.n >= hs.q[side - 1]) { hs = Object.assign({}, hs, {d: side}); api.setState(hs); }
            } else if (inp.a === "accept") {
              if (hs.d === 3 - side) commit(Object.assign({}, hs, {o: 1, r: 0, y: "agr", d: 0}));
            } else if (inp.a === "decline") {
              if (hs.d === 3 - side) { const q = hs.q.slice(); q[hs.d - 1] = hs.n + 4; hs = Object.assign({}, hs, {d: 0, q}); api.setState(hs); }
            } else if (Array.isArray(inp.m) && side === hs.t) {
              const ns = play(hs, inp.m.map(Number), rep);   // l'hôte revalide tout : coup illégal = ignoré
              if (ns) commit(ns);
            }
          }
        });
      }

      // ---------- affichage (tout le monde) ----------
      const pieceEls = {};          // case -> élément pièce affiché
      function setPos(p, i) {
        const [r, c] = rc(i), R = flip ? 7 - r : r, C = flip ? 7 - c : c;
        p.style.transform = `translate(${C * 100}%,${R * 100}%)`;
      }
      function makePiece(ch) {
        const p = document.createElement("div");
        p.className = "dm-pc";
        p.dataset.ch = ch;
        p.innerHTML = pieceSvg(ch);
        return p;
      }
      // Met le plateau affiché en conformité avec `b` (réutilise les éléments présents, fondu pour les pièces retirées).
      function paint(b, instant) {
        for (let i = 0; i < 32; i++) {
          const ch = b[i];
          let p = pieceEls[i];
          if (ch === "0") {
            if (p) {
              delete pieceEls[i];
              if (instant || RM) p.remove();
              else { p.classList.add("dm-out"); p.classList.remove("dm-ghost"); later(() => p.remove(), 320); }
            }
            continue;
          }
          if (!p) {
            p = makePiece(ch); pieceEls[i] = p;
            p.style.transition = "none"; setPos(p, i);
            pcsEl.appendChild(p);
            if (!instant && !RM) { p.classList.add("dm-in0"); void p.offsetWidth; p.style.transition = ""; p.classList.remove("dm-in0"); }
            else { void p.offsetWidth; p.style.transition = ""; }
          } else {
            if (p.dataset.ch !== ch) {
              const promo = !isKing(p.dataset.ch) && isKing(ch) && sideOf(p.dataset.ch) === sideOf(ch);
              p.dataset.ch = ch; p.innerHTML = pieceSvg(ch);
              if (promo && !instant && !RM) { p.classList.remove("dm-promo"); void p.offsetWidth; p.classList.add("dm-promo"); later(() => p.classList.remove("dm-promo"), 800); }
            }
            p.classList.remove("dm-ghost", "dm-fly", "dm-out");
            if (instant) { p.style.transition = "none"; setPos(p, i); void p.offsetWidth; p.style.transition = ""; }
            else setPos(p, i);
          }
        }
      }
      const between = (a, b, k) => {
        const [ra, ca] = rc(a), [rb, cb] = rc(b), [rk, ck] = rc(k);
        const n = Math.abs(rb - ra);
        if (!n || Math.abs(cb - ca) !== n) return false;
        const t = (rk - ra) / (rb - ra);
        return t > 0 && t < 1 && (ck - ca) === t * (cb - ca);
      };

      let cur = null, shownN = -1, sel = null, pending = null, pendTimer = 0, deadline = 0, animTok = 0, animEnd = null;
      let mySeq = Math.floor(Math.random() * 1e6), endShown = false, lastTick = -1, nagged = 0, prevG = [0, 0];

      // Anime un coup reçu (sauts successifs, pièces prises grisées puis retirées).
      function animateMove(fromB, path, caps, toB) {
        const tok = ++animTok;
        paint(fromB, true);
        const p = pieceEls[path[0]];
        if (!p) { paint(toB); return 0; }
        p.classList.add("dm-fly");
        const hop = caps.length ? 300 : 240;
        for (let h = 1; h < path.length; h++) {
          later(() => {
            if (tok !== animTok) return;
            setPos(p, path[h]);
            const k = caps.find(c => between(path[h - 1], path[h], c));
            if (k != null && pieceEls[k]) { const q = pieceEls[k]; later(() => { if (tok === animTok) q.classList.add("dm-ghost"); }, hop * 0.5); }
            later(() => { if (tok === animTok) clank(k != null); }, hop * 0.8);
          }, 40 + (h - 1) * hop);
        }
        const total = 40 + (path.length - 1) * hop + 60;
        animEnd = () => {
          animEnd = null;
          if (tok !== animTok) return;
          animTok++;
          delete pieceEls[path[0]]; pieceEls[path[path.length - 1]] = p;
          paint(toB);
          ui();
        };
        later(() => { if (animEnd && tok === animTok) animEnd(); }, total);
        return total;
      }
      function finishAnim() { if (animEnd) animEnd(); }

      function onState(s) {
        if (dead || !s || typeof s.b !== "string" || s.b.length !== 32 || !Array.isArray(s.l)) return;
        const prev = cur;
        cur = s;
        let animMs = 0;
        if (s.n !== shownN) {
          const mine = pending && s.l.join() === pending.join();
          if (pendTimer) { stopT(pendTimer); pendTimer = 0; }
          pending = null;
          if (animEnd) { animTok++; animEnd = null; }
          if (mine) {
            sel = null;
            paint(s.b);                              // la pièce est déjà arrivée : on retire les prises
            clank(s.x.length > 0);
          } else {
            if (sel) sel = null;
            if (prev && s.n === prev.n + 1 && s.l.length > 1 && !RM && shownN >= 0) animMs = animateMove(prev.b, s.l, s.x, s.b);
            else { paint(s.b, shownN < 0); if (shownN >= 0 && s.l.length) clank(s.x.length > 0); }
          }
          if (shownN >= 0 && s.l.length) {
            const to = s.l[s.l.length - 1];
            if (isKing(s.b[to]) && !isKing(prev ? prev.b[s.l[0]] : "3")) later(() => tones([523, 659, 784, 1046], 0.09, "triangle", 0.1), animMs);
          }
          if (s.a && shownN >= 0) {
            const who = S[3 - s.t];
            api.toast(who.key === api.me ? "Temps écoulé : un coup a été joué au hasard pour toi !" : `Temps écoulé pour ${who.pseudo} : coup joué au hasard.`);
          }
          if (!s.o && s.t === mySide && shownN >= 0) later(() => { if (!dead && cur === s) tones([660, 880], 0.08, "sine", 0.06); }, animMs + 100);
          shownN = s.n;
          deadline = Date.now() + TL * 1000;
          nagged = 0;
        }
        if (s.d && (!prev || prev.d !== s.d) && mySide && s.d !== mySide) tones([440, 554], 0.12, "sine", 0.08);
        if (prev && prev.d === mySide && !s.d && !s.o && prev.n === s.n) api.toast(`${S[3 - mySide].pseudo} refuse le nul : on continue !`);
        if (animEnd) return;                         // l'interface suivra quand la pièce adverse aura atterri
        ui(animMs);
      }

      function myLegal() { return cur && !cur.o && mySide && cur.t === mySide ? legalMoves(cur.b, mySide) : []; }
      function ui(animMs) {
        const s = cur;
        if (!s) return;
        const myTurn = !s.o && mySide === s.t && !pending;
        const L = myTurn ? myLegal() : [];
        const must = L.length > 0 && L[0].x.length > 0;
        const depth = sel ? sel.path.length : 0;
        const opts = sel ? L.filter(m => sel.path.every((v, i) => m.p[i] === v)) : [];
        const tg = new Set(), capT = new Set();
        opts.forEach(m => { if (m.p.length > depth) { tg.add(m.p[depth]); if (m.x.length) capT.add(m.p[depth]); } });
        const movable = new Set(sel ? [] : L.map(m => m.p[0]));
        root.classList.toggle("dm-mine", myTurn);
        const lastSet = new Set(s.l.length ? [s.l[0], s.l[s.l.length - 1]] : []);
        const trail = new Set(s.l.slice(1, -1));
        for (let i = 0; i < 32; i++) {
          const q = sqEls[i];
          q.classList.toggle("dm-last", !sel && lastSet.has(i));
          q.classList.toggle("dm-trail", !sel && trail.has(i));
          q.classList.toggle("dm-tgt", tg.has(i));
          q.classList.toggle("dm-cap", capT.has(i));
          q.classList.toggle("dm-can", movable.has(i) || tg.has(i) || (myTurn && sideOf(s.b[i]) === mySide));
          q.setAttribute("aria-label", `Case ${name(i)}${tg.has(i) ? ", destination possible" : movable.has(i) ? ", pièce jouable" : ""}`);
        }
        const selSq = sel ? sel.path[depth - 1] : -1;
        for (const k in pieceEls) {
          const p = pieceEls[k], i = +k;
          p.classList.toggle("dm-can", movable.has(i) && !must);
          p.classList.toggle("dm-must", movable.has(i) && must);
          p.classList.toggle("dm-sel", i === selSq);
        }
        // cartes joueurs
        const n = counts(s.b);
        [1, 2].forEach(side => {
          const c = cardEl[side], on = !s.o && s.t === side;
          c.classList.toggle("dm-on", on);
          c.classList.toggle("dm-win", !!s.o && s.r === side);
          const left = side === 1 ? n[1] + n[3] : n[2] + n[4];
          const kings = side === 1 ? n[3] : n[4];
          const men = left - kings;
          c.querySelector(".dm-cnt").textContent = !kings ? `${left} pièce${left > 1 ? "s" : ""}` : `${men ? `${men} pion${men > 1 ? "s" : ""} · ` : ""}${kings} dame${kings > 1 ? "s" : ""}`;
          const tag = c.querySelector(".dm-tag");
          tag.textContent = side === mySide ? "À toi !" : mySide ? "Réfléchit…" : "Au trait";
          tag.classList.toggle("dm-wait", side !== mySide && !!mySide);
          // pile de fonte prise : disques de la couleur adverse
          const opp = 3 - side, taken = 12 - (opp === 1 ? n[1] + n[3] : n[2] + n[4]);
          const kg = s.g[side - 1], kingsTaken = Math.max(0, Math.min(taken, (kg - taken * 10) / 10));
          const sl = c.querySelector(".dm-sleeve");
          if (sl.childElementCount !== taken) {
            let h = "";
            for (let j = 0; j < taken; j++) h += `<i class="dm-p${opp}${j < kingsTaken ? " dm-pk" : ""}${j >= sl.childElementCount && prevG[side - 1] !== kg ? " dm-new" : ""}"></i>`;
            sl.innerHTML = h;
          }
          const kgEl = c.querySelector(".dm-kg");
          kgEl.textContent = kg ? `+${kg} kg` : "0 kg";
          kgEl.classList.toggle("dm-has", kg > 0);
        });
        prevG = s.g.slice();
        tickClock();
        // texte d'état
        let txt, cls = "";
        if (s.o) txt = endText(s);
        else if (pending) txt = "Coup envoyé…";
        else if (myTurn) {
          cls = must ? "dm-warn" : "dm-me";
          const nx = L[0] ? L[0].x.length : 0;
          if (sel && depth > 1) txt = "Encore une prise ! Continue la rafle.";
          else if (must) txt = nx > 1 ? `Prise obligatoire : rafle de ${nx} pièces !` : "Prise obligatoire !";
          else txt = s.n === 0 ? "À toi de commencer !" : "À toi ! Choisis une pièce.";
        } else {
          const nm = S[s.t].pseudo;
          txt = mySide ? `${nm} réfléchit…` : `Au tour de ${nm} (${COL[s.t]})`;
        }
        if (statusEl.textContent !== txt) {
          statusEl.textContent = txt;
          if (myTurn && !RM && shownN > 0) { statusEl.classList.remove("dm-bump"); void statusEl.offsetWidth; statusEl.classList.add("dm-bump"); }
        }
        statusEl.classList.toggle("dm-me", cls === "dm-me");
        statusEl.classList.toggle("dm-warn", cls === "dm-warn");
        // ligne d'aide
        let hint = "";
        if (!s.o) {
          if (s.e) { const left = Math.ceil((endLimit(s.b) - s.e) / 2); hint = `Finale : nul dans <b>${left}</b> coup${left > 1 ? "s" : ""} sans prise.`; }
          else if (s.k >= 20) { const left = Math.ceil((KING_DRAW - s.k) / 2); hint = `Que des dames : nul dans <b>${left}</b> coup${left > 1 ? "s" : ""} sans prise.`; }
          else if (myTurn && must && !sel) hint = L[0].x.length > 1 ? "Prise majoritaire : prends le <b>maximum</b> de pièces. Pièces en orange = celles qui doivent prendre." : "Les pièces en orange <b>doivent</b> prendre.";
          else if (myTurn && sel) hint = depth > 1 ? "Touche la case suivante de la rafle (ou ta pièce pour recommencer)." : must ? "Touche une case orange pour prendre." : "Touche une case verte pour jouer.";
          else if (s.n === 0) hint = `Les <b>rouges</b> commencent. ${S[1].key === api.me ? "C'est toi !" : esc(S[1].pseudo) + " a les rouges."}`;
          else if (s.d === mySide) hint = "Proposition de nul envoyée…";
        }
        if (hintEl.innerHTML !== hint) hintEl.innerHTML = hint;
        // bouton nul
        if (drawBtn) {
          drawBtn.disabled = !!s.o || !!s.d || s.n < s.q[mySide - 1] || s.n < 2;
          drawBtn.textContent = s.d === mySide ? "🤝 Nul proposé…" : "🤝 Proposer nul";
        }
        // calques sur le plateau
        overlays(animMs || 0);
      }
      function endText(s) {
        const W = s.r ? S[s.r] : null;
        if (!W) return s.y === "agr" ? "Nul d'un commun accord." : s.y === "rep" ? "Nul : position répétée 3 fois." : s.y === "fin" ? "Nul : la dame seule a tenu !" : "Nul : 25 coups de dames sans prise.";
        const me = W.key === api.me;
        if (s.y === "nop") return me ? "Tu as raflé toutes ses pièces !" : `${W.pseudo} a raflé toutes les pièces !`;
        return me ? "Adversaire bloqué : tu gagnes !" : `${S[3 - s.r].pseudo} est bloqué : ${W.pseudo} gagne !`;
      }
      let ovlKey = "";
      function overlays(animMs) {
        const s = cur;
        let key = "", html = "";
        if (s.o) {
          key = "end";
          if (!endShown) {
            endShown = true;
            const W = s.r ? S[s.r] : null;
            later(() => {
              if (dead) return;
              const big = !W ? "Match nul" : W.key === api.me ? "Victoire !" : mySide ? "Défaite" : `${esc(W.pseudo)} gagne`;
              ovl.innerHTML = `<div class="dm-box">${W ? `<div class="dm-eav">${api.avatar(W.key, {pose: "flex", view: "bust"})}</div>` : `<div class="dm-row"><div class="dm-eav">${api.avatar(S[1].key, {view: "bust"})}</div><div class="dm-eav">${api.avatar(S[2].key, {view: "bust"})}</div></div>`}
                <div class="dm-big${W && mySide && W.key !== api.me ? " dm-lose" : ""}">${big}</div><p>${esc(endText(s))}</p>
                <p style="opacity:.8;font-size:1rem">Fonte soulevée : ${esc(S[1].pseudo)} +${s.g[0]} kg · ${esc(S[2].pseudo)} +${s.g[1]} kg</p></div>`;
              if (W) cardEl[s.r].querySelector(".dm-av").innerHTML = api.avatar(W.key, {pose: "flex", view: "bust"});
              tones(W && W.key === api.me ? [523, 659, 784, 1046, 1318] : W && mySide ? [392, 330, 262] : [440, 554, 659], 0.12);
            }, RM ? 0 : animMs + 450);
          }
        } else if (s.d && mySide && s.d !== mySide) {
          key = "offer" + s.n;
          html = `<div class="dm-box"><p><b>${esc(S[s.d].pseudo)}</b> propose le <b>match nul</b>.</p><div class="dm-row"><button type="button" class="dm-btn" data-a="accept">Accepter</button><button type="button" class="dm-btn dm-alt" data-a="decline">Refuser</button></div></div>`;
        }
        if (key === ovlKey) return;
        ovlKey = key;
        if (key !== "end") ovl.innerHTML = html;
      }
      function tickClock() {
        if (!cur) return;
        [1, 2].forEach(side => {
          const c = cardEl[side].querySelector(".dm-clock"), on = !cur.o && cur.t === side;
          const left = on ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : TL;
          const sp = c.firstElementChild;
          if (sp.textContent !== String(left)) sp.textContent = left;
          c.style.setProperty("--f", on ? Math.max(0, (deadline - Date.now()) / (TL * 1000)).toFixed(3) : 1);
          c.classList.toggle("dm-low", on && left <= 10);
          if (on && side === mySide && left <= 5 && left > 0 && left !== lastTick) { lastTick = left; tones([1200], 0, "square", 0.03); }
          if (on && side === mySide && left === 15 && !nagged) { nagged = 1; api.toast("Plus que 15 s pour jouer !"); }
        });
      }
      const clockTimer = setInterval(() => { if (!dead) tickClock(); }, 250);
      timers.add(clockTimer);
      // présence de l'adversaire (le lobby gère le forfait, on l'affiche seulement)
      const presTimer = setInterval(() => {
        if (dead) return;
        let con;
        try { con = api.connected(); } catch (e) { return; }
        if (!Array.isArray(con)) return;
        [1, 2].forEach(s => cardEl[s].classList.toggle("dm-off", !con.includes(S[s].key)));
      }, 1500);
      timers.add(presTimer);

      api.onState(onState);

      // ---------- saisie ----------
      function send(path) {
        pending = path.slice();
        const inp = {seq: ++mySeq, m: pending};
        api.setInput(inp);
        ui();
        // renvoi si l'hôte n'a pas confirmé (entrée perdue), puis abandon pour laisser rejouer
        pendTimer = later(() => {
          if (!pending || dead) return;
          api.setInput({seq: ++mySeq, m: pending});
          pendTimer = later(() => {
            pendTimer = 0;
            if (!pending || dead) return;
            pending = null; sel = null; paint(cur.b, true); ui();
          }, 3000);
        }, 2500);
      }
      function resetSel() {
        if (sel && sel.path.length > 1) {
          const last = sel.path[sel.path.length - 1], p = pieceEls[last];
          if (p) { delete pieceEls[last]; pieceEls[sel.path[0]] = p; }
        }
        sel = null;
        if (cur) paint(cur.b);
      }
      function nope(sqs) {
        if (RM) return;
        sqs.forEach(i => { const p = pieceEls[i]; if (p) { p.classList.remove("dm-nope"); void p.offsetWidth; p.classList.add("dm-nope"); } });
      }
      function tapSquare(i) {
        if (!cur || cur.o || !mySide) return;
        finishAnim();
        if (cur.t !== mySide) { if (sideOf(cur.b[i]) === mySide) api.toast(`Patience, c'est au tour de ${S[cur.t].pseudo}.`); return; }
        if (pending) return;
        const L = myLegal();
        if (sel) {
          const depth = sel.path.length;
          const opts = L.filter(m => sel.path.every((v, j) => m.p[j] === v) && m.p[depth] === i);
          if (opts.length) {
            const a = sel.path[depth - 1];
            sel.path.push(i);
            const p = pieceEls[a];
            if (p) { delete pieceEls[a]; pieceEls[i] = p; setPos(p, i); }
            const cap = opts[0].x[depth - 1];
            if (cap != null && pieceEls[cap]) pieceEls[cap].classList.add("dm-ghost");
            clank(cap != null);
            const full = opts.find(m => m.p.length === sel.path.length);
            if (full) send(full.p);
            else ui();
            return;
          }
          if (depth > 1) {
            if (i === sel.path[0] || i === sel.path[depth - 1]) { resetSel(); ui(); return; }
            api.toast("Termine ta rafle : touche une case orange !");
            return;
          }
          if (i === sel.path[0]) { sel = null; ui(); return; }
          sel = null;
        }
        if (sideOf(cur.b[i]) !== mySide) { ui(); return; }
        const mine = L.filter(m => m.p[0] === i);
        if (!mine.length) {
          const movable = [...new Set(L.map(m => m.p[0]))];
          if (L.length && L[0].x.length) {
            const own = capturesFrom(cur.b, i);
            if (own.length) api.toast(`Prise majoritaire : il faut prendre ${L[0].x.length} pièces, pas ${Math.max(...own.map(m => m.x.length))} !`);
            else api.toast("Prise obligatoire ! Joue une pièce qui peut prendre (en orange).");
            nope(movable);
            tones([150], 0, "sine", 0.1);
          } else api.toast("Cette pièce est bloquée.");
          nope([i]);
          ui();
          return;
        }
        sel = {path: [i]};
        tones([520], 0, "sine", 0.05);
        ui();
      }
      grid.addEventListener("click", e => {
        unlock();
        const b = e.target.closest(".dm-dk");
        if (b) tapSquare(+b.dataset.i);
      });
      ovl.addEventListener("click", e => {
        const b = e.target.closest("[data-a]");
        if (!b || !cur || cur.o || !mySide) return;
        api.setInput({seq: ++mySeq, a: b.dataset.a});
        ovl.innerHTML = ""; ovlKey = "sent" + cur.n;
      });
      if (drawBtn) drawBtn.addEventListener("click", () => {
        if (!cur || cur.o || cur.d || pending) return;
        api.setInput({seq: ++mySeq, a: "offer"});
        drawBtn.disabled = true;
        api.toast("Proposition de nul envoyée.");
      });
      $("#dm-help").addEventListener("click", () => { sheet.hidden = false; $("#dm-close").focus(); });
      $("#dm-close").addEventListener("click", () => { sheet.hidden = true; });
      sheet.addEventListener("click", e => { if (e.target === sheet) sheet.hidden = true; });

      return {
        destroy() {
          dead = true;
          animTok++;
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
