/* Gonflette Party : Totem (2 à 8 joueurs, chacun sur son téléphone).
   Le paquet (80 cartes) est distribué face cachée. Chacun son tour, on retourne la carte du dessus de sa pile
   (toucher sa pile ; sinon elle part toute seule au bout de 4 s). Deux joueurs (ou plus) montrent la MÊME FORME
   (couleur ignorée) : duel ! Ils doivent attraper le totem au centre : le plus rapide donne sa pile face visible
   aux perdants, qui la ramassent avec la leur. Totem attrapé sans duel vous concernant = faute : vous ramassez
   toutes les cartes visibles de la table. Cartes spéciales :
   - « Tous ensemble » (flèches vers l'extérieur) : au prochain tour, tout le monde retourne en même temps ;
   - « Ruée » (flèches vers le centre) : tout le monde attrape le totem, le plus rapide donne sa pile au plus lent ;
   - « Couleurs » : jusqu'à la prochaine carte spéciale, les duels se font sur la COULEUR.
   Le premier qui n'a plus aucune carte gagne ; au bout de 6 min, le moins de cartes gagne.

   Équité réseau (50 à 300 ms de latence, horloges décalées) :
   - Chaque téléphone mesure SON temps de réaction : entre l'image où IL a affiché la situation de duel
     (requestAnimationFrame) et la touche sur le totem (event.timeStamp), sur performance.now (aucune horloge partagée).
   - Il envoie {g: jeton, gv: version de l'état affiché, ms, vis: cartes visibles}. L'hôte juge la prise avec ce que
     CE téléphone montrait (instantané de la version gv, ou vis à défaut) : pas de faute injuste due au retard.
   - Après la première prise reçue, l'hôte attend une fenêtre (250 ms + aller-retour mesuré des joueurs concernés,
     entre 500 et 1100 ms) ou que tous les concernés aient pris, puis donne le totem au plus petit temps.
   - Après une carte qui crée un duel, les retournements sont gelés ~1,3 s (+ latence) pour que personne ne
     perde un duel parce qu'une carte a été recouverte pendant que son téléphone affichait encore le duel.
   - Aller-retour : chaque entrée renvoie l'heure hôte du dernier état reçu (e) et le temps écoulé depuis (ed).
   État publié : indices seulement (piles codées 1 caractère par carte), < 1 Ko. Jeu `resumable`. */
GONFLETTE.registerGame({
  id: "totem",
  name: "Totem",
  min: 2,
  max: 8,
  resumable: true,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, N = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] !== undefined ? seatOf[api.me] : -1;
    const TURN_MS = 4000, INTRO_MS = 7000, CAP_MS = 360000, FREEZE_MS = 1300, POST_MS = 1500, RUEE_MS = 6000;
    const END_MS = 3200, PING_MS = 1500, ABSENT_MS = 6000;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const nm = s => (P[s] ? esc(P[s].pseudo || api.name(P[s].key)) : "?");
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const fmt = ms => (ms / 1000).toFixed(3).replace(".", ",") + " s";
    const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
    const sfx = n => { try { if (api.sfx) api.sfx(n); } catch (e) { /* rien */ } };
    const hap = n => { try { if (api.haptic) api.haptic(n); } catch (e) { /* rien */ } };
    const timers = new Set();
    let dead = false;
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    let RM = false;
    try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* rien */ }

    /* ================= Cartes ================= */
    // Familles de formes, par paires de « jumelles » trompeuses. Moins de joueurs = moins de familles (plus de duels).
    const NF = N <= 3 ? 8 : N <= 4 ? 10 : N <= 6 ? 12 : 14;
    const TE = 1, RU = 2, CO = 3;
    const CARD = [];
    for (let i = 0; i < 72; i++) CARD.push({f: i % NF, c: Math.floor(i / NF) % 4, sp: 0});
    [TE, TE, TE, RU, RU, RU, CO, CO].forEach(sp => CARD.push({f: -1, c: -1, sp}));
    const COLS = [{n: "rouge", h: "#e5383b"}, {n: "bleu", h: "#2f6fed"}, {n: "vert", h: "#1fa34a"}, {n: "jaune", h: "#f7b801"}];
    const FAMN = ["haltère", "barre", "croix", "croix percée", "anneau", "disque", "étoile", "étoile à 6", "triangle", "triangle percé", "éclair", "zigzag", "lune", "banane", "losange", "feuille"];
    const SPN = {[TE]: "Tous ensemble", [RU]: "Ruée", [CO]: "Couleurs"}, SPL = {[TE]: "Ensemble", [RU]: "Ruée", [CO]: "Couleurs"};
    const star = (n, R, r) => { let d = ""; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; d += (i ? "L" : "M") + (Math.cos(a) * q).toFixed(1) + " " + (Math.sin(a) * q).toFixed(1); } return d + "Z"; };
    const circ = (x, y, r) => `M${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}Z`;
    const PLUS = "M-13 -42H13V-13H42V13H13V42H-13V13H-42V-13H-13Z";
    const TRI = "M0 -40L45 37H-45Z";
    const SH = [
      `<g transform="rotate(-32) scale(1.08)"><rect x="-27" y="-7" width="54" height="14" rx="3"/><circle cx="-28" cy="0" r="18"/><circle cx="28" cy="0" r="18"/></g>`,
      `<g transform="rotate(-32) scale(1.08)"><rect x="-46" y="-7" width="92" height="14" rx="3"/><rect x="-38" y="-22" width="16" height="44" rx="4"/><rect x="22" y="-22" width="16" height="44" rx="4"/></g>`,
      `<path d="${PLUS}"/>`,
      `<path fill-rule="evenodd" d="${PLUS}M-8 -8H8V8H-8Z"/>`,
      `<path fill-rule="evenodd" d="${circ(0, 0, 41)}${circ(0, 0, 18)}"/>`,
      `<path fill-rule="evenodd" d="${circ(0, 0, 41)}${circ(0, 0, 8)}${circ(0, -25, 8)}${circ(21.7, 12.5, 8)}${circ(-21.7, 12.5, 8)}"/>`,
      `<path d="${star(5, 47, 20)}" transform="translate(0 4)"/>`,
      `<path d="${star(6, 46, 24)}"/>`,
      `<path d="${TRI}" transform="translate(0 3)"/>`,
      `<path fill-rule="evenodd" d="${TRI}${circ(0, 13, 12)}" transform="translate(0 3)"/>`,
      `<path d="M12 -48L-26 -2H-4L-14 48L28 -4H6L20 -48Z"/>`,
      `<path d="M-34 -40H34V-27L-10 27H34V40H-34V27L10 -27H-34Z"/>`,
      `<path d="M20 -41A41 41 0 1 0 20 41A52 52 0 0 1 20 -41Z"/>`,
      `<path d="M-30 -44L-20 -46L-17 -35C-14 2 6 22 40 25C45 26 45 33 40 35C-2 45 -38 14 -31 -33Z"/>`,
      `<path d="M0 -46L33 0L0 46L-33 0Z"/>`,
      `<path d="M0 -46C31 -18 31 18 0 46C-31 18 -31 -18 0 -46Z"/>`
    ];
    const SPSVG = {
      [TE]: `<g fill="none" stroke="#fff8e7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M-7 0H-40M-27 -14L-41 0L-27 14M7 0H40M27 -14L41 0L27 14"/></g><circle r="5" fill="#fff8e7"/>`,
      [RU]: `<g fill="none" stroke="#fff8e7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M-44 0H-16M-29 -14L-15 0L-29 14M44 0H16M29 -14L15 0L29 14"/></g><rect x="-6" y="-14" width="12" height="28" rx="4" fill="#ffcc33" stroke="#22160f" stroke-width="3"/>`,
      [CO]: `<g stroke="#22160f" stroke-width="3.5" stroke-linejoin="round"><path d="M0 0V-40A40 40 0 0 1 40 0Z" fill="#e5383b"/><path d="M0 0H40A40 40 0 0 1 0 40Z" fill="#2f6fed"/><path d="M0 0V40A40 40 0 0 1 -40 0Z" fill="#1fa34a"/><path d="M0 0H-40A40 40 0 0 1 0 -40Z" fill="#f7b801"/></g><circle r="9" fill="#fff8e7" stroke="#22160f" stroke-width="3"/>`
    };
    const cardCache = {};
    function cardHtml(id, extra) {
      const k = id + (extra || "");
      if (cardCache[k]) return cardCache[k];
      let h;
      if (!(id >= 0 && id < CARD.length)) h = `<div class="tt-c tt-e${extra || ""}"></div>`;
      else {
        const c = CARD[id];
        if (c.sp) h = `<div class="tt-c tt-sp tt-sp${c.sp}${extra || ""}" role="img" aria-label="Carte ${SPN[c.sp]}"><svg viewBox="-50 -50 100 100" aria-hidden="true">${SPSVG[c.sp]}</svg><i>${SPL[c.sp]}</i></div>`;
        else h = `<div class="tt-c${extra || ""}" role="img" aria-label="${FAMN[c.f]} ${COLS[c.c].n}"><svg viewBox="-50 -50 100 100" aria-hidden="true"><g fill="${COLS[c.c].h}" stroke="#22160f" stroke-width="4.5" stroke-linejoin="round">${SH[c.f]}</g></svg></div>`;
      }
      return (cardCache[k] = h);
    }
    const BACK = `<div class="tt-c tt-bk" aria-hidden="true"><span></span></div>`;
    // Correspondance : même forme (ou même couleur en mode Couleurs). Les cartes spéciales ne font pas de duel.
    function inMatch(tp, cm, s) {
      const id = tp[s];
      if (!(id >= 0) || !CARD[id] || CARD[id].sp) return false;
      const a = CARD[id];
      for (let j = 0; j < tp.length; j++) {
        if (j === s || !(tp[j] >= 0) || !CARD[tp[j]] || CARD[tp[j]].sp) continue;
        if (cm ? CARD[tp[j]].c === a.c : CARD[tp[j]].f === a.f) return true;
      }
      return false;
    }
    function groupsOf(tp, cm) {
      const m = new Map();
      tp.forEach((id, s) => {
        if (!(id >= 0) || !CARD[id] || CARD[id].sp) return;
        const k = cm ? CARD[id].c : CARD[id].f;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(s);
      });
      return [...m.values()].filter(g => g.length > 1);
    }
    const enc = a => a.map(id => String.fromCharCode(40 + id)).join("");
    const dec = s => Array.from(String(s || ""), ch => ch.charCodeAt(0) - 40).filter(x => x >= 0 && x < CARD.length);
    function parsePk(pk) {
      return P.map((_, s) => {
        const str = (pk && pk[s]) || "|", k = str.indexOf("|");
        const up = k >= 0 ? str.length - k - 1 : 0;
        return {dn: Math.max(0, k), un: up, top: up ? str.charCodeAt(str.length - 1) - 40 : -1};
      });
    }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    /* ================= Décor ================= */
    const TOTEM = `<svg viewBox="0 0 160 210" aria-hidden="true" focusable="false">
      <defs><radialGradient id="tt-wd" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#e7a865"/><stop offset=".55" stop-color="#b8742f"/><stop offset="1" stop-color="#7a4520"/></radialGradient>
      <linearGradient id="tt-hd" x1="0" x2="1"><stop offset="0" stop-color="#8a4f22"/><stop offset=".5" stop-color="#c88540"/><stop offset="1" stop-color="#8a4f22"/></linearGradient></defs>
      <ellipse cx="80" cy="200" rx="60" ry="8" fill="rgba(40,20,5,.3)"/>
      <g stroke="#22160f" stroke-width="3.5" stroke-linejoin="round">
        <path d="M80 40C58 14 30 10 12 22C36 22 56 30 72 46Z" fill="#2e9e4f"/>
        <path d="M80 40C102 14 130 10 148 22C124 22 104 30 88 46Z" fill="#2e9e4f"/>
        <path d="M80 42C64 22 46 2 30 0C42 14 56 30 72 48Z" fill="#45c165"/>
        <path d="M80 42C96 22 114 2 130 0C118 14 104 30 88 48Z" fill="#45c165"/>
        <path d="M80 44C72 24 74 8 82 -2C90 12 90 28 86 44Z" fill="#3aae58"/>
      </g>
      <path d="M44 100C38 56 58 36 80 36C102 36 122 56 116 100" fill="none" stroke="#22160f" stroke-width="27" stroke-linecap="round"/>
      <path d="M44 100C38 56 58 36 80 36C102 36 122 56 116 100" fill="none" stroke="url(#tt-hd)" stroke-width="19" stroke-linecap="round"/>
      <path d="M50 92C47 62 62 46 80 46" fill="none" stroke="#f0c27f" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <path d="M34 178H126L118 196H42Z" fill="#6b3b17" stroke="#22160f" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="80" cy="134" r="60" fill="url(#tt-wd)" stroke="#22160f" stroke-width="5"/>
      <path d="M26 112Q80 96 134 112" fill="none" stroke="#7a4520" stroke-width="5" stroke-linecap="round"/>
      <path d="M27 116Q80 100 133 116" fill="none" stroke="#f0c27f" stroke-width="2" opacity=".6"/>
      <path d="M44 117L72 124M116 117L88 124" stroke="#22160f" stroke-width="7" stroke-linecap="round"/>
      <rect x="49" y="126" width="24" height="16" rx="6" fill="#fff8e7" stroke="#22160f" stroke-width="4"/>
      <rect x="87" y="126" width="24" height="16" rx="6" fill="#fff8e7" stroke="#22160f" stroke-width="4"/>
      <circle cx="64" cy="134" r="4.5" fill="#22160f"/><circle cx="96" cy="134" r="4.5" fill="#22160f"/>
      <path d="M80 136L71 156H89Z" fill="#8a4f22" stroke="#22160f" stroke-width="3.5" stroke-linejoin="round"/>
      <rect x="55" y="160" width="50" height="17" rx="7" fill="#3b1a0a" stroke="#22160f" stroke-width="4"/>
      <path d="M63 161v7M72 161v7M81 161v7M90 161v7M98 161v7" stroke="#fff8e7" stroke-width="4"/>
      <path d="M30 150C22 146 18 136 22 128M130 150C138 146 142 136 138 128" fill="none" stroke="#f0c27f" stroke-width="3" stroke-linecap="round" opacity=".55"/>
    </svg>`;
    const PALM = `<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="#2e9e4f" stroke="#1b5e2f" stroke-width="2"><path d="M0 0C40 10 80 30 110 70C80 50 40 40 0 40Z"/><path d="M0 30C30 40 60 60 80 100C60 80 30 70 0 70Z" fill="#45c165"/><path d="M20 0C50 20 70 40 90 80C70 60 50 40 10 20Z" fill="#3aae58"/></g></svg>`;

    el.innerHTML = `<style>
      .tt{--ink:#22160f;--cream:#fff8e7;--gold:#ffcc33;--wood:#b8742f;--wood2:#7a4520;--cw:60px;--tw:140px;--ty:55%;
        position:relative;height:100%;min-height:440px;overflow:hidden;color:var(--ink);font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
        background:radial-gradient(120% 40% at 50% 0%,#a5ecef 0%,rgba(165,236,239,0) 60%),linear-gradient(180deg,#5cc9d2 0%,#9fe0d6 13%,#f3d9a0 28%,#ebc785 100%);
        -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
      .tt *{box-sizing:border-box}
      .tt button{font-family:inherit;color:inherit}
      .tt button:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .tt-palm{position:absolute;width:150px;height:150px;pointer-events:none;opacity:.75}
      .tt-palm svg{width:100%;height:100%}
      .tt-palm.a{left:-30px;top:-20px}.tt-palm.b{right:-30px;top:-20px;transform:scaleX(-1)}
      .tt-in{position:relative;z-index:1;height:100%;max-width:640px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto}
      .tt-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 12px 0;min-height:36px}
      .tt-pill{font-weight:800;font-size:1rem;line-height:1.25;background:rgba(255,248,231,.92);border:2px solid var(--ink);border-radius:999px;padding:1px 10px;white-space:nowrap}
      .tt-clock{font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.04em;font-variant-numeric:tabular-nums}
      .tt-clock.hot{background:#ff5a5f;color:#fff}
      .tt-mode{background:linear-gradient(90deg,#e5383b,#f7b801,#1fa34a,#2f6fed);color:#fff;text-shadow:0 1px 2px #22160f;animation:tt-pop .35s}
      .tt-mode[hidden]{display:none}
      .tt-me-tot{font-size:.95rem}
      .tt-ar{position:relative;min-height:0}
      .tt-tab{position:absolute;left:2%;right:2%;top:4%;bottom:3%;border-radius:50%;
        background:radial-gradient(ellipse at 50% 42%,#dba15c 0 40%,#c4823d 66%,#a3642a 100%);
        border:7px solid #6b3b17;box-shadow:inset 0 0 0 5px #e7b06c,inset 0 -18px 34px rgba(60,25,5,.3),0 9px 0 #4d2a10,0 20px 28px rgba(60,30,5,.25);transition:box-shadow .4s}
      .tt-tab::before{content:"";position:absolute;inset:10%;border-radius:50%;background:repeating-radial-gradient(ellipse at 50% 50%,rgba(90,50,15,0) 0 15px,rgba(90,50,15,.13) 15px 17px)}
      .tt-tab.co{box-shadow:inset 0 0 0 5px #e7b06c,0 0 0 5px #e5383b,0 0 0 10px #f7b801,0 0 0 15px #1fa34a,0 0 0 20px #2f6fed,0 20px 28px rgba(60,30,5,.25)}
      .tt-tot{position:absolute;left:50%;top:var(--ty);width:var(--tw);height:calc(var(--tw) * 1.3125);transform:translate(-50%,-50%);border:0;padding:0;margin:0;background:none;cursor:pointer;touch-action:none;z-index:3}
      .tt-tot::before{content:"";position:absolute;inset:-10% -14%;border-radius:50%}
      .tt-tot svg{position:relative;width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 7px 0 rgba(60,30,10,.3));transition:transform .1s}
      .tt-tot.grab svg{transform:scale(.9) translateY(6px) rotate(-4deg)}
      .tt-tot.ru svg{animation:tt-ru .45s ease-in-out infinite alternate;filter:drop-shadow(0 0 14px #ff5a5f) drop-shadow(0 7px 0 rgba(60,30,10,.3))}
      .tt-tot.gone{visibility:hidden}
      .tt-tot.back svg{animation:tt-drop .45s cubic-bezier(.3,1.5,.5,1)}
      .tt-tot:disabled{cursor:default}
      .tt-tag{position:absolute;left:50%;top:calc(var(--ty) + var(--tw) * .66 + 2px);transform:translateX(-50%);z-index:4;pointer-events:none;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.05rem;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;padding:2px 12px;border-radius:8px;border:2px solid var(--ink);color:#fff8e7;background:#c81d25;box-shadow:0 3px 0 var(--ink);animation:tt-pop .3s}
      .tt-tag.te{background:#f26b1d}
      .tt-tag[hidden]{display:none}
      .tt-op{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(var(--cw) + 26px);display:grid;justify-items:center;gap:3px;z-index:2;transition:opacity .3s,filter .3s}
      .tt-nm{display:flex;align-items:center;gap:3px;max-width:100%;height:24px;background:rgba(255,248,231,.94);border:2px solid var(--ink);border-radius:999px;padding:0 7px 0 0;transition:background .2s,box-shadow .2s}
      .tt-av{flex:none;width:26px;height:26px;margin-left:-3px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#bff3f0,#5cc8c6);border:2px solid var(--ink)}
      .tt-av svg{width:100%;height:100%;display:block}
      .tt-nm b{font-size:13px;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
      .tt-slot{--w:var(--cw);position:relative;perspective:400px}
      .tt-cnt{display:flex;gap:7px;align-items:center;font-weight:800;font-size:13px;line-height:1.3;color:#fff8e7;background:rgba(34,22,15,.78);border-radius:8px;padding:0 6px;font-variant-numeric:tabular-nums;white-space:nowrap}
      .tt-mini{display:inline-block;width:8px;height:11px;border-radius:2px;margin-right:2px;vertical-align:-1px;background:#2e9e4f;border:1px solid #fff8e7}
      .tt-mini.u{background:#fff8e7}
      .tt-op.turn .tt-nm{background:var(--gold);box-shadow:0 0 0 3px rgba(255,204,51,.55),0 0 14px rgba(255,204,51,.9)}
      .tt-op.turn .tt-slot::after{content:"";position:absolute;left:50%;bottom:-3px;width:70%;height:4px;margin-left:-35%;border-radius:4px;background:var(--gold);box-shadow:0 0 8px var(--gold)}
      .tt-op.off{filter:grayscale(1);opacity:.5}
      .tt-op.off .tt-nm b::after{content:" 📡"}
      .tt-op.shake,.tt-me.shake{animation:tt-shake .45s}
      /* cartes */
      .tt-c{position:relative;width:var(--w);height:calc(var(--w) * 1.36);border-radius:calc(var(--w) * .14);background:var(--cream);border:2px solid var(--ink);display:grid;place-items:center;box-shadow:0 3px 0 rgba(34,22,15,.45);overflow:hidden}
      .tt-c::before{content:"";position:absolute;inset:5%;border-radius:calc(var(--w) * .1);border:1.5px solid rgba(34,22,15,.14)}
      .tt-c svg{position:relative;width:84%;height:auto;display:block}
      .tt-c.tt-e{background:rgba(255,248,231,.16);border:2px dashed rgba(70,35,10,.45);box-shadow:none}
      .tt-c.tt-e::before{display:none}
      .tt-sp1{background:linear-gradient(160deg,#ffb347,#f26b1d)}
      .tt-sp2{background:linear-gradient(160deg,#ff6b6b,#c81d25)}
      .tt-sp3{background:linear-gradient(160deg,#6d4fc0,#2a1b5e)}
      .tt-sp::before{border-color:rgba(255,248,231,.35)}
      .tt-sp svg{width:78%;margin-bottom:16%}
      .tt-sp i{position:absolute;left:0;right:0;bottom:6%;text-align:center;font-style:normal;font-family:Anton,Impact,sans-serif;font-size:calc(var(--w) * .155);line-height:1;color:#fff8e7;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}
      .tt-op .tt-sp i{display:none}
      .tt-op .tt-sp svg{margin-bottom:0}
      .tt-bk{background:repeating-linear-gradient(45deg,#1f7a3a 0 6px,#2e9e4f 6px 12px)}
      .tt-bk::before{border-color:rgba(255,248,231,.5)}
      .tt-bk span{width:44%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#e7a865,#8a4f22);border:2px solid var(--ink);box-shadow:0 0 0 3px #ffcc33}
      .tt-c.flip{animation:tt-flip .22s ease-out}
      .tt-slot.hl .tt-c{box-shadow:0 0 0 4px var(--gold),0 0 20px 4px var(--gold);animation:tt-hl .28s 4 alternate}
      .tt-slot.bad .tt-c{box-shadow:0 0 0 4px #ff5a5f,0 0 18px 4px #ff5a5f}
      /* ma zone */
      .tt-me{--w:78px;position:relative;z-index:3;display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:center;gap:12px;padding:8px 14px calc(10px + env(safe-area-inset-bottom,0px));background:linear-gradient(#8a4f22,#5a3214);border-top:4px solid var(--ink);color:var(--cream);box-shadow:inset 0 3px 0 rgba(255,220,160,.3)}
      .tt-me.spec{grid-template-columns:minmax(0,1fr);text-align:center;font-weight:800;font-size:1.1rem;min-height:60px}
      .tt-pile{position:relative;width:calc(var(--w) + 10px);height:calc(var(--w) * 1.36 + 26px);border:0;background:none;padding:0;cursor:pointer;touch-action:none;display:block}
      .tt-pile .tt-c{position:absolute;left:0;top:0;box-shadow:3px 3px 0 #145228,6px 6px 0 #0c3519,6px 8px 10px rgba(0,0,0,.35)}
      .tt-pile.none .tt-c{background:rgba(255,248,231,.12);border:2px dashed rgba(255,248,231,.5);box-shadow:none}
      .tt-pile.none .tt-c span,.tt-pile.none .tt-c::before{display:none}
      .tt-pn{position:absolute;right:-4px;top:-8px;min-width:30px;height:30px;padding:0 6px;border-radius:15px;display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.05rem;color:var(--ink);background:var(--cream);border:2.5px solid var(--ink);z-index:2}
      .tt-pl{position:absolute;left:0;right:6px;bottom:0;height:22px;display:grid;place-items:center;border-radius:8px;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.35);color:#f5e6c8;overflow:hidden}
      .tt-pl i{position:absolute;left:0;top:0;bottom:0;background:rgba(255,204,51,.45);transform-origin:left}
      .tt-pl span{position:relative}
      .tt-pile.my .tt-pl{background:var(--gold);color:var(--ink)}
      .tt-pile.my .tt-c{animation:tt-bob .7s ease-in-out infinite alternate}
      .tt-pile.my::after{content:"";position:absolute;left:-6px;top:-6px;width:calc(var(--w) + 12px);height:calc(var(--w) * 1.36 + 12px);border-radius:16px;border:3px solid var(--gold);box-shadow:0 0 16px var(--gold);pointer-events:none;animation:tt-glow 1s ease-in-out infinite alternate}
      .tt-pile.press .tt-c{transform:translate(3px,4px)}
      .tt-pile:disabled{cursor:default}
      .tt-myup{position:relative;--w:inherit}
      .tt-myup.hl .tt-c{box-shadow:0 0 0 4px var(--gold),0 0 20px 4px var(--gold);animation:tt-hl .28s 4 alternate}
      .tt-myup.bad .tt-c{box-shadow:0 0 0 4px #ff5a5f,0 0 18px 4px #ff5a5f}
      .tt-myi{min-width:0;display:grid;justify-items:start;gap:4px}
      .tt-myi .tt-av{width:54px;height:54px;margin:0;border-width:3px}
      .tt-myn{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%}
      .tt-myn b{font-weight:800;font-size:1.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tt-myc{font-weight:700;font-size:.98rem;line-height:1.2;color:#f5e6c8}
      .tt-myc b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.25rem;color:var(--gold);letter-spacing:.02em}
      .tt-me.turn{background:linear-gradient(#a0612c,#6b3b17)}
      .tt-me.off{filter:grayscale(.7)}
      /* bandeau d'événement */
      .tt-ban{position:absolute;left:50%;top:calc(var(--ty) - var(--tw) * .42);transform:translate(-50%,-100%);z-index:8;pointer-events:none;text-align:center;width:max-content;max-width:94%;opacity:0}
      .tt-ban.on{opacity:1;animation:tt-banin .32s cubic-bezier(.2,1.5,.4,1)}
      .tt-ban b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(1.55rem,8.4vw,2.5rem);line-height:1.02;letter-spacing:.02em;text-transform:uppercase;color:#fff8e7;-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;text-shadow:3px 3px 0 var(--ink)}
      .tt-ban b.gd{color:var(--gold)}
      .tt-ban b.bd{color:#ff8a8c}
      .tt-ban small{display:inline-block;margin-top:5px;font-weight:800;font-size:1.02rem;line-height:1.2;background:rgba(255,248,231,.96);border:2px solid var(--ink);border-radius:10px;padding:2px 10px;max-width:100%}
      /* surcouches intro / fin */
      .tt-ov{position:absolute;inset:0;z-index:10;display:grid;place-items:center;padding:10px 12px;background:rgba(34,22,15,.45);overflow:auto}
      .tt-ov[hidden]{display:none}
      .tt-sheet{width:min(100%,460px);background:var(--cream);border:3px solid var(--ink);border-radius:18px;box-shadow:0 6px 0 var(--ink);padding:12px 14px 14px;display:grid;gap:9px;animation:tt-pop .35s}
      .tt-logo{margin:0;text-align:center;font-family:Pacifico,"Brush Script MT",cursive;font-weight:400;font-size:2.3rem;line-height:1.1;color:#c4823d;text-shadow:2px 2px 0 var(--ink)}
      .tt-lead{margin:0;text-align:center;font-weight:700;font-size:1.08rem;line-height:1.25}
      .tt-lead b{color:#c81d25}
      .tt-twins{display:flex;justify-content:center;align-items:center;gap:5px;--w:min(44px,10.4vw);flex-wrap:nowrap}
      .tt-twins em{font-style:normal;font-family:Anton,Impact,sans-serif;font-size:1.1rem;padding:0 1px}
      .tt-twins .ok{color:#1b8a3c}.tt-twins .ko{color:#c81d25}
      .tt-twins .gap{width:8px;flex:none}
      .tt-leg{display:grid;gap:5px;--w:36px}
      .tt-leg div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;font-size:1rem;line-height:1.15;font-weight:600}
      .tt-leg b{font-weight:800}
      .tt-leg .tt-sp i{display:none}
      .tt-leg .tt-sp svg{margin-bottom:0}
      .tt-bar{height:7px;border-radius:9px;background:rgba(34,22,15,.15);overflow:hidden}
      .tt-bar i{display:block;height:100%;background:#c4823d;transform-origin:left;animation:tt-bar linear forwards}
      .tt-rk{display:grid;gap:5px}
      .tt-row{display:grid;grid-template-columns:28px 44px minmax(0,1fr) auto;gap:8px;align-items:center;background:#fff;border:2px solid var(--ink);border-radius:12px;padding:3px 9px 3px 5px;animation:tt-in .35s both}
      .tt-row.w{background:linear-gradient(90deg,#ffe28a,#fff8e7)}
      .tt-row.me{border-color:#c81d25}
      .tt-row .p{font-family:Anton,Impact,sans-serif;font-size:1.35rem;text-align:center}
      .tt-row .tt-av{width:44px;height:44px;margin:0}
      .tt-row .n{font-weight:800;font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tt-row .n small{display:block;white-space:normal;font-weight:600;font-size:.88rem;line-height:1.1;color:#7a4520}
      .tt-row .c{font-family:Anton,Impact,sans-serif;font-size:1.3rem;text-align:right;line-height:1}
      .tt-row .c small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.8rem;color:#7a4520}
      .tt-fly{position:fixed;left:0;top:0;z-index:300;pointer-events:none;will-change:transform}
      .tt-fly svg{width:100%;height:100%;display:block}
      .tt-hand{position:absolute;left:50%;top:var(--ty);z-index:7;pointer-events:none;font-size:2.6rem;transform:translate(-50%,-50%);animation:tt-hand .6s ease-out forwards}
      .tt-myms{position:absolute;left:50%;top:calc(var(--ty) + var(--tw) * .3);z-index:7;pointer-events:none;transform:translateX(-50%);font-family:Anton,Impact,sans-serif;font-size:1.3rem;color:#fff8e7;-webkit-text-stroke:1.5px var(--ink);paint-order:stroke fill;text-shadow:2px 2px 0 var(--ink);animation:tt-up 1.1s ease-out forwards;white-space:nowrap}
      @keyframes tt-flip{from{transform:rotateY(90deg) scale(1.12)}to{transform:none}}
      @keyframes tt-hl{to{transform:scale(1.08)}}
      @keyframes tt-ru{from{transform:rotate(-5deg) scale(1)}to{transform:rotate(5deg) scale(1.06)}}
      @keyframes tt-drop{from{transform:translateY(-40px) scale(1.15);opacity:.2}to{transform:none;opacity:1}}
      @keyframes tt-pop{from{transform:scale(.6);opacity:0}}
      @keyframes tt-banin{from{transform:translate(-50%,-100%) scale(.5);opacity:0}to{transform:translate(-50%,-100%);opacity:1}}
      @keyframes tt-bob{from{transform:translateY(0)}to{transform:translateY(-4px)}}
      @keyframes tt-glow{from{opacity:.55}to{opacity:1}}
      @keyframes tt-shake{20%{transform:translate(-50%,-50%) translateX(-7px)}40%{transform:translate(-50%,-50%) translateX(6px)}60%{transform:translate(-50%,-50%) translateX(-4px)}80%{transform:translate(-50%,-50%) translateX(3px)}}
      .tt-me.shake{animation-name:tt-shake2}
      @keyframes tt-shake2{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
      @keyframes tt-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
      @keyframes tt-in{from{opacity:0;transform:translateX(-18px)}}
      @keyframes tt-hand{0%{transform:translate(-50%,10%) scale(.6);opacity:0}40%{transform:translate(-50%,-50%) scale(1.1);opacity:1}100%{transform:translate(-50%,-60%) scale(1);opacity:0}}
      @keyframes tt-up{0%{opacity:0;transform:translate(-50%,8px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-36px)}}
      @media (max-height:700px){.tt-me{--w:66px;padding-top:6px;gap:10px}.tt-myi .tt-av{width:44px;height:44px}.tt-top{min-height:32px;padding-top:4px}}
      @media (prefers-reduced-motion:reduce){.tt *,.tt *::before,.tt *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    </style>
    <div class="tt" id="tt-root">
      <div class="tt-palm a">${PALM}</div><div class="tt-palm b">${PALM}</div>
      <div class="tt-in">
        <div class="tt-top">
          <span class="tt-pill tt-clock" id="tt-clock" aria-label="Temps restant">6:00</span>
          <span class="tt-pill tt-mode" id="tt-mode" hidden>🎨 Couleurs</span>
          <span class="tt-pill tt-me-tot" id="tt-tot-n"></span>
        </div>
        <div class="tt-ar" id="tt-ar">
          <div class="tt-tab" id="tt-tab"></div>
          <div id="tt-ops"></div>
          <button type="button" class="tt-tot" id="tt-tot" aria-label="Attraper le totem">${TOTEM}</button>
          <div class="tt-tag" id="tt-tag" hidden></div>
          <div class="tt-ban" id="tt-ban" role="status" aria-live="polite"></div>
          <div class="tt-ov" id="tt-ov" hidden></div>
        </div>
        <div class="tt-me" id="tt-me"></div>
      </div>
    </div>`;
    const $ = id => el.querySelector("#" + id);
    const root = $("tt-root"), ar = $("tt-ar"), opsEl = $("tt-ops"), totEl = $("tt-tot"), banEl = $("tt-ban"), ovEl = $("tt-ov"), meEl = $("tt-me");
    const tagEl = $("tt-tag"), tabEl = $("tt-tab"), clockEl = $("tt-clock"), modeEl = $("tt-mode"), totNEl = $("tt-tot-n");

    /* ================= Horloge de l'hôte (affichage des minuteurs seulement) ================= */
    const samples = [];
    let off = 0;
    function sampleClock(t) {
      if (typeof t !== "number" || !isFinite(t)) return;
      samples.push(Date.now() - t);
      if (samples.length > 40) samples.shift();
      off = Math.min.apply(null, samples);
    }
    const loc = T => T + off; // heure hôte -> heure locale

    /* ================= Logique de l'hôte ================= */
    let hostLoop = null, hostDbg = null;
    if (api.isHost) hostInit();
    function hostInit() {
      const now0 = Date.now();
      const hostSeat = seatOf[api.me] !== undefined ? seatOf[api.me] : -1;
      let H, down, up;
      const R = api.resume;
      if (R && R.g === 1 && Array.isArray(R.pk) && R.pk.length === N && R.nf === NF) {
        H = JSON.parse(JSON.stringify(R));
        down = []; up = [];
        H.pk.forEach((str, i) => { const k = str.indexOf("|"); down[i] = dec(str.slice(0, k)); up[i] = dec(str.slice(k + 1)); });
      } else {
        let ids = shuffle(CARD.map((c, i) => i));
        const extra = ids.length % N;
        if (extra) { let rm = 0; ids = ids.filter(id => { if (rm < extra && !CARD[id].sp) { rm++; return false; } return true; }); }
        down = P.map(() => []); up = P.map(() => []);
        ids.forEach((id, k) => down[k % N].push(id));
        H = {g: 1, nf: NF, ph: "intro", v: 1, rv: 0, t: 0, I: now0 + INTRO_MS, E: now0 + INTRO_MS + (typeof window.__ttCap === "number" ? window.__ttCap : CAP_MS), tu: Math.floor(Math.random() * N), tn: 0, td: 0,
          pk: [], cm: 0, ru: 0, rn: 0, ra: 0, al: 0, fl: [], fv: 0, ev: null, dc: [], dw: P.map(() => 0), fa: P.map(() => 0), br: P.map(() => 0)};
      }
      const snaps = new Map();
      let lastPub = 0, lastDc = "", freezeUntil = 0, pendingFlip = -1, win = null, grabs = [], fouls = [], evN = H.ev ? H.ev.i : 0;
      let conn = new Set(P.map(p => p.key));
      const lastPing = P.map(() => now0), rtt = P.map(() => []), lastJ = {}, lastF = {}, lastG = {};
      const top = s => (up[s].length ? up[s][up[s].length - 1] : -1);
      const tops = () => P.map((_, s) => top(s));
      const absent = s => !conn.has(P[s].key) || (s !== hostSeat && Date.now() - lastPing[s] > ABSENT_MS);
      const present = s => !absent(s);
      const seats = () => P.map((_, s) => s);
      const presentSeats = () => seats().filter(present);
      const rttOf = s => { const a = rtt[s].slice().sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 3)] : 300; };
      const maxRtt = list => Math.max(0, ...list.filter(s => s !== hostSeat).map(rttOf));
      const tot = s => down[s].length + up[s].length;
      function snap() { snaps.set(H.v, {tp: tops(), cm: H.cm, ru: H.ru, rv: H.rv}); while (snaps.size > 120) snaps.delete(snaps.keys().next().value); }
      const bump = () => { H.v++; snap(); };
      snap();
      function pub() {
        if (dead) return;
        H.t = Date.now();
        H.pk = P.map((_, s) => enc(down[s]) + "|" + enc(up[s]));
        H.dc = P.map((_, s) => (absent(s) ? 1 : 0));
        lastPub = H.t; lastDc = H.dc.join("");
        api.setState(H);
      }
      const setEv = a => { H.ev = {i: ++evN, a: a.slice(0, 6)}; };
      // Cartes ramassées : sous la pile cachée, mélangées.
      const take = (s, cards) => { if (cards.length) down[s].push(...shuffle(cards.slice())); };
      const matchedSet = () => { const tp = tops(); return new Set(seats().filter(s => inMatch(tp, H.cm, s))); };
      function nextSeat(from, incl) {
        for (let k = incl ? 0 : 1; k <= N; k++) { const s = (from + k) % N; if (present(s) && down[s].length) return s; }
        return -1;
      }
      function recycle() {
        let n = 0;
        presentSeats().forEach(s => { if (!down[s].length && up[s].length) { down[s] = up[s]; up[s] = []; n++; } });
        if (n) { bump(); setEv([{k: "rc"}]); }
        return n;
      }
      function advanceTurn(from, now, incl) {
        let s = nextSeat(from, incl);
        if (s < 0 && recycle()) s = nextSeat(from, incl);
        H.tu = s < 0 ? from : s; H.tn++;
        H.td = Math.max(now, freezeUntil) + TURN_MS;
        pendingFlip = -1;
      }
      function freezeMs() { return FREEZE_MS + Math.min(700, maxRtt(presentSeats())); }
      function doTurnFlip() {
        const now = Date.now(), s = H.tu;
        pendingFlip = -1;
        const before = matchedSet();
        let who;
        if (H.al) { who = presentSeats().filter(i => down[i].length); H.al = 0; } else who = down[s].length ? [s] : [];
        const fl = [], sp = [];
        let ruNew = false;
        who.forEach(i => { up[i].push(down[i].shift()); fl.push(i); });
        fl.forEach(i => {
          const c = CARD[top(i)];
          if (!c.sp) return;
          sp.push({k: "sp", s: i, sp: c.sp});
          if (c.sp === CO) H.cm = 1;
          else {
            H.cm = 0;
            if (c.sp === TE) H.al = 1;
            else { H.ru = ++H.rn; H.ra = now; ruNew = true; }
          }
        });
        H.fl = fl;
        bump(); H.fv = H.v;
        if (sp.length) setEv(sp);
        const after = matchedSet();
        if (ruNew || [...after].some(x => !before.has(x))) freezeUntil = now + freezeMs();
        advanceTurn(s, now, false);
        pub();
      }
      function eligibleNow() {
        const ps = presentSeats();
        if (H.ru) return ps;
        const tp = tops();
        return ps.filter(s => inMatch(tp, H.cm, s));
      }
      const allIn = () => eligibleNow().every(s => grabs.some(g => g.s === s) || fouls.includes(s));
      function windowMs() { return clamp(250 + maxRtt(eligibleNow()), 500, 1100); }
      function openWindow() {
        const now = Date.now();
        if (!win) win = {end: now + windowMs()};
        if (allIn()) win.end = Math.min(win.end, now);
      }
      function onGrab(s, v) {
        if (H.ph !== "play") return;
        let sn = snaps.get(v.gv);
        if (!sn && Array.isArray(v.vis) && v.vis.length === N) sn = {tp: v.vis.map(x => (Number.isInteger(x) && x >= 0 && x < CARD.length ? x : -1)), cm: v.cm ? 1 : 0, ru: v.ru | 0, rv: v.rv | 0};
        if (!sn) return;
        const ms = typeof v.ms === "number" && isFinite(v.ms) && v.ms >= 0 ? Math.min(60000, Math.round(v.ms)) : 60000;
        const ok = sn.ru ? true : inMatch(sn.tp, sn.cm, s);
        if (ok) {
          if (sn.rv !== H.rv) return;                       // déjà tranché depuis : entrée tardive, ignorée
          if (sn.ru && sn.ru !== H.ru) return;              // ruée expirée
          if (!H.ru && !inMatch(tops(), H.cm, s)) return;   // la situation a disparu : ni gain ni faute
          if (grabs.some(g => g.s === s)) return;
          grabs.push({s, ms});
        } else if (!fouls.includes(s) && !grabs.some(g => g.s === s)) fouls.push(s);
        openWindow();
      }
      function resolveWindow() {
        win = null;
        const now = Date.now(), evs = [];
        const G = grabs, F = fouls;
        grabs = []; fouls = [];
        let nextTurn = -1, winner = -1;
        if (H.ru) {
          const gs = G.filter(g => present(g.s)).sort((a, b) => a.ms - b.ms);
          if (gs.length) {
            const w = gs[0].s;
            const others = presentSeats().filter(s => s !== w);
            const non = others.filter(s => !gs.some(g => g.s === s));
            let lo = non.length ? non[Math.floor(Math.random() * non.length)] : gs.length > 1 ? gs[gs.length - 1].s : -1;
            if (lo < 0) lo = seats().find(s => s !== w);
            const n = up[w].length;
            take(lo, up[w]); up[w] = [];
            H.dw[w]++;
            if (!H.br[w] || gs[0].ms < H.br[w]) H.br[w] = gs[0].ms;
            evs.push({k: "ru", w, l: [lo], n, ms: gs[0].ms, r: gs.slice(0, 8).map(g => [g.s, g.ms])});
            H.ru = 0; nextTurn = lo; winner = w;
          }
        } else {
          const tp = tops();
          groupsOf(tp, H.cm).forEach(g => {
            const gs = G.filter(x => g.includes(x.s) && present(x.s)).sort((a, b) => a.ms - b.ms);
            if (!gs.length) return;
            const w = gs[0].s, losers = g.filter(s => s !== w);
            const pile = up[w].slice(), n = pile.length;
            up[w] = [];
            const parts = losers.map(() => []);
            pile.forEach((c, k) => parts[k % losers.length].push(c));
            losers.forEach((l, k) => { take(l, parts[k].concat(up[l])); up[l] = []; });
            H.dw[w]++;
            if (!H.br[w] || gs[0].ms < H.br[w]) H.br[w] = gs[0].ms;
            evs.push({k: "d", w, l: losers, n, ms: gs[0].ms, r: gs.slice(0, 8).map(x => [x.s, x.ms])});
            if (nextTurn < 0) nextTurn = losers[0];
            if (winner < 0) winner = w;
          });
        }
        F.forEach(s => {
          if (!present(s)) return;
          const all = [];
          seats().forEach(j => { all.push(...up[j]); up[j] = []; });
          take(s, all);
          H.fa[s]++;
          evs.push({k: "f", w: s, n: all.length});
          if (nextTurn < 0) nextTurn = s;
        });
        if (!evs.length) return;
        H.rv++; bump(); setEv(evs);
        // victoire : plus aucune carte
        const done = seats().filter(s => tot(s) === 0);
        if (done.length) { endGame("win", done.includes(winner) ? winner : done[0]); return; }
        freezeUntil = now + POST_MS;
        if (nextTurn >= 0) advanceTurn(nextTurn, now, true);
        else H.td = Math.max(H.td, freezeUntil + TURN_MS);
        pub();
      }
      function endGame(why, w) {
        if (H.ph === "end") return;
        const rk = seats().sort((a, b) => (a === w ? -1 : b === w ? 1 : 0) || tot(a) - tot(b) || H.dw[b] - H.dw[a] || a - b);
        H.ph = "end"; H.rk = rk; H.why = why; H.ru = 0; H.al = 0;
        win = null; grabs = []; fouls = [];
        bump(); pub();
        later(finishNow, END_MS);
      }
      function finishNow() {
        const rk = H.rk, n = s => down[s].length + up[s].length;
        let winners, summary;
        const first = rk[0];
        if (H.why === "cap") {
          const best = n(first);
          winners = rk.filter(s => n(s) === best).map(s => P[s].key);
          summary = winners.length > 1
            ? `Temps écoulé ! Égalité à ${plural(best, "carte")} : ${winners.map(k => api.name(k)).join(" et ")}.`
            : `Temps écoulé ! ${P[first].pseudo} gagne avec seulement ${plural(best, "carte")} en main.`;
        } else if (H.why === "solo") {
          winners = [P[first].key];
          summary = `${P[first].pseudo} reste seul à table : victoire !`;
        } else {
          winners = [P[first].key];
          summary = `${P[first].pseudo} vide ses piles et décroche le Totem (${plural(H.dw[first], "duel")} gagné${H.dw[first] > 1 ? "s" : ""}) !`;
        }
        const fast = seats().filter(s => H.br[s] > 0).sort((a, b) => H.br[a] - H.br[b])[0];
        if (fast !== undefined) summary += ` Réflexe record : ${P[fast].pseudo} en ${fmt(H.br[fast])}.`;
        api.finish({winners, ranking: rk.map(s => P[s].key), summary: summary.slice(0, 160)});
      }
      function loop() {
        if (dead) return;
        const now = Date.now();
        conn = new Set(api.connected());
        if (H.ph === "intro") {
          if (now >= H.I) {
            H.ph = "play"; H.tn = 1; H.td = now + TURN_MS + 800;
            if (!present(H.tu) || !down[H.tu].length) advanceTurn(H.tu, now, true);
            bump(); pub();
          } else if (now - lastPub > 1000) pub();
          return;
        }
        if (H.ph !== "play") { if (now - lastPub > 1000) pub(); return; }
        const live = P.filter(p => conn.has(p.key));
        if (live.length <= 1) { endGame("solo", live.length ? seatOf[live[0].key] : H.rk ? H.rk[0] : 0); return; }
        if (now >= H.E) { endGame("cap", -1); return; }
        if (win && (now >= win.end || allIn())) { resolveWindow(); return; }
        if (H.ru && !win && now - H.ra > RUEE_MS) { H.ru = 0; bump(); setEv([{k: "x"}]); pub(); return; }
        if (!win && now >= freezeUntil) {
          if (!present(H.tu) || !down[H.tu].length) {
            advanceTurn(H.tu, now, false);
            if (!present(H.tu) || !down[H.tu].length) freezeUntil = now + 1000; // personne ne peut jouer : on réessaie dans 1 s
            pub(); return;
          }
          if (pendingFlip === H.tn || now >= H.td) { doTurnFlip(); return; }
        }
        const dcNow = P.map((_, s) => (absent(s) ? 1 : 0)).join("");
        if (dcNow !== lastDc || now - lastPub > 1000) pub();
      }
      api.onInputs(map => {
        const now = Date.now();
        for (const k in map) {
          const s = seatOf[k];
          if (s === undefined) continue;
          const v = map[k];
          if (!v || typeof v !== "object") continue;
          const j = JSON.stringify(v);
          if (j === lastJ[s]) continue;
          lastJ[s] = j;
          lastPing[s] = now;
          if (typeof v.e === "number" && v.e > 0) {
            const r = now - v.e - (+v.ed || 0);
            if (r >= 0 && r < 5000) { rtt[s].push(r); if (rtt[s].length > 8) rtt[s].shift(); }
          }
          if (v.f && v.f !== lastF[s]) {
            lastF[s] = v.f;
            if (H.ph === "play" && s === H.tu && v.ft === H.tn) {
              if (win || now < freezeUntil) pendingFlip = H.tn; else doTurnFlip();
            }
          }
          if (v.g && v.g !== lastG[s]) { lastG[s] = v.g; onGrab(s, v); }
        }
      });
      if (H.ph === "end") later(finishNow, 1500);
      pub();
      hostLoop = setInterval(loop, 40);
      hostDbg = () => ({now: Date.now(), win, freezeUntil, pendingFlip, tu: H.tu, tn: H.tn, td: H.td, ru: H.ru, al: H.al, absent: seats().map(absent), conn: [...conn], ping: lastPing.map(t => Date.now() - t), rtt: seats().map(rttOf), down: down.map(d => d.length)});
    }

    /* ================= Affichage (tous les téléphones) ================= */
    const bustCache = {};
    const bust = (s, mood) => { const k = s + (mood || ""); return bustCache[k] || (bustCache[k] = api.avatar(P[s].key, mood ? {view: "bust", mood} : {view: "bust"})); };
    // Adversaires autour de la table, dans l'ordre du jeu (sens des aiguilles d'une montre depuis ma gauche).
    const opps = mySeat >= 0 ? P.map((_, k) => (mySeat + 1 + k) % N).slice(0, N - 1) : P.map((_, s) => s);
    const SLOTS = {
      1: [[50, 13]],
      2: [[26, 14], [74, 14]],
      3: [[13, 44], [50, 12], [87, 44]],
      4: [[12, 52], [31, 13], [69, 13], [88, 52]],
      5: [[12, 68], [13, 33], [50, 11], [87, 33], [88, 68]],
      6: [[11, 72], [11, 41], [31, 11], [69, 11], [89, 41], [89, 72]],
      7: [[11, 76], [11, 47], [19, 13], [50, 10], [81, 13], [89, 47], [89, 76]],
      8: [[11, 77], [11, 48], [16, 16], [39, 9], [61, 9], [84, 16], [89, 48], [89, 77]]
    };
    opsEl.innerHTML = opps.map(s => `<div class="tt-op" data-s="${s}" id="tt-op${s}">
        <div class="tt-nm"><span class="tt-av">${bust(s)}</span><b>${nm(s)}</b></div>
        <div class="tt-slot" id="tt-sl${s}">${cardHtml(-1)}</div>
        <div class="tt-cnt" id="tt-cn${s}"></div>
      </div>`).join("");
    if (mySeat >= 0) {
      meEl.innerHTML = `<button type="button" class="tt-pile" id="tt-pile" aria-label="Retourner ma carte">${BACK}<span class="tt-pn" id="tt-pn">0</span><span class="tt-pl"><i id="tt-pbar"></i><span id="tt-plt">Ma pile</span></span></button>
        <div class="tt-myup" id="tt-sl${mySeat}">${cardHtml(-1)}</div>
        <div class="tt-myi"><div class="tt-myn"><span class="tt-av">${bust(mySeat)}</span><b>${nm(mySeat)}</b></div><div class="tt-myc" id="tt-myc"></div></div>`;
    } else {
      meEl.className = "tt-me spec";
      meEl.textContent = "Vous regardez la partie 👀";
    }
    const pileEl = $("tt-pile");
    const slotEl = s => $("tt-sl" + s);
    function layout() {
      const W = ar.clientWidth, Hh = ar.clientHeight;
      if (!W || !Hh) return;
      const n = opps.length, sl = SLOTS[n] || SLOTS[8];
      const cw = Math.round(clamp(Math.min(W * (n <= 1 ? .21 : n <= 3 ? .18 : n <= 5 ? .155 : .135), Hh * (n <= 3 ? .17 : .135)), 38, 90));
      root.style.setProperty("--cw", cw + "px");
      const chipW = cw + 26, chipH = cw * 1.36 + 54;
      let topBottom = 0;
      opps.forEach((s, k) => {
        const c = $("tt-op" + s); if (!c) return;
        const [px, py] = sl[k] || [50, 50];
        const x = clamp(px / 100 * W, chipW / 2 + 2, W - chipW / 2 - 2), y = clamp(py / 100 * Hh, chipH / 2 + 2, Hh - chipH / 2 - 2);
        c.style.left = x + "px"; c.style.top = y + "px";
        if (py < 25) topBottom = Math.max(topBottom, y + chipH / 2);
      });
      let tw = clamp(Math.min(W * .4, Hh * .33), 96, 190);
      let th = tw * 1.3125;
      let ty = Math.max(Hh * .54, topBottom + th / 2 + 6);
      if (ty + th / 2 + 30 > Hh) { ty = Hh - th / 2 - 30; }
      if (ty - th / 2 < topBottom - 10) { tw = clamp((Hh - topBottom - 40) / 1.3125, 80, tw); th = tw * 1.3125; ty = topBottom + th / 2 + 4; }
      root.style.setProperty("--tw", Math.round(tw) + "px");
      root.style.setProperty("--ty", Math.round(ty) + "px");
    }
    let ro = null;
    if (typeof ResizeObserver === "function") { ro = new ResizeObserver(() => layout()); ro.observe(ar); }
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    layout();

    let S = null, PK = null, lastV = 0, lastEvI = -1, firstState = true, lastTn = -1, flippedTn = -1;
    const shownTop = {};
    // Vue réellement affichée (mise à jour à l'image suivante) : sert à juger mes prises.
    let vw = {v: 0, tp: P.map(() => -1), cm: 0, ru: 0, rv: 0, inD: false, t0: -1, ph: ""};
    let rafId = 0, rafFallback = 0, grabLock = null;
    const nonce = Math.random().toString(36).slice(2, 7);
    let cnt = 0, lastStateAt = 0;
    const inp = {f: null, ft: -1, g: null, gv: -1, ms: -1, vis: null, cm: 0, ru: 0, rv: 0, e: 0, ed: 0};
    function send() {
      if (mySeat < 0 || dead) return;
      inp.e = S ? S.t : 0;
      inp.ed = S ? Math.round(performance.now() - lastStateAt) : 0;
      api.setInput(JSON.parse(JSON.stringify(inp)));
    }
    function markPaint() {
      if (rafId) return;
      const go = ts => {
        if (!rafId) return;
        cancelAnimationFrame(rafId); clearTimeout(rafFallback); rafId = 0;
        setView(typeof ts === "number" ? ts : performance.now());
      };
      rafId = requestAnimationFrame(go);
      rafFallback = setTimeout(() => go(performance.now()), 120);
    }
    function setView(ts) {
      if (!S) return;
      const tp = PK.map(x => x.top);
      const play = S.ph === "play";
      const inD = play && mySeat >= 0 && (S.ru ? true : inMatch(tp, S.cm, mySeat));
      const same = vw.rv === S.rv && vw.ru === S.ru && vw.cm === S.cm && vw.inD;
      const t0 = inD ? (same ? vw.t0 : ts) : -1;
      vw = {v: S.v, tp, cm: S.cm, ru: S.ru, rv: S.rv, inD, t0, ph: S.ph};
    }

    function cntHtml(x) { return `<span><i class="tt-mini"></i>${x.dn}</span><span><i class="tt-mini u"></i>${x.un}</span>`; }
    function render() {
      const s = S, pk = PK;
      const flipNow = s.fv === s.v && s.v !== lastV && Array.isArray(s.fl) ? s.fl : [];
      P.forEach((p, i) => {
        const x = pk[i], sl = slotEl(i);
        if (sl && shownTop[i] !== x.top) {
          sl.innerHTML = cardHtml(x.top, !firstState && flipNow.includes(i) && x.top >= 0 && !RM ? " flip" : "");
          shownTop[i] = x.top;
        }
        if (i !== mySeat) {
          const c = $("tt-op" + i);
          if (c) {
            c.classList.toggle("turn", s.ph === "play" && s.tu === i);
            c.classList.toggle("off", !!(s.dc && s.dc[i]));
            const cn = $("tt-cn" + i), h = cntHtml(x);
            if (cn && cn._h !== h) { cn._h = h; cn.innerHTML = h; }
          }
        }
      });
      if (mySeat >= 0) {
        const x = pk[mySeat], my = s.ph === "play" && s.tu === mySeat;
        $("tt-pn").textContent = x.dn;
        pileEl.classList.toggle("none", !x.dn);
        pileEl.classList.toggle("my", my && x.dn > 0);
        meEl.classList.toggle("turn", my);
        meEl.classList.toggle("off", !!(s.dc && s.dc[mySeat]));
        $("tt-plt").textContent = my ? (s.al ? "Tous !" : "À vous !") : x.dn ? "Ma pile" : "Vide";
        const tot = x.dn + x.un;
        $("tt-myc").innerHTML = `<b>${tot}</b> carte${tot > 1 ? "s" : ""} · ${x.un} posée${x.un > 1 ? "s" : ""}${s.dw && s.dw[mySeat] ? ` · ⚡${s.dw[mySeat]}` : ""}`;
        totNEl.innerHTML = `<i class="tt-mini"></i> ${tot} carte${tot > 1 ? "s" : ""}`;
        if (my && s.tn !== lastTn && !firstState) { hap("light"); }
      } else totNEl.textContent = `${N} joueurs`;
      totNEl.hidden = false;
      lastTn = s.tn;
      modeEl.hidden = !s.cm;
      tabEl.classList.toggle("co", !!s.cm);
      totEl.classList.toggle("ru", !!s.ru);
      totEl.disabled = mySeat < 0;
      if (s.ru) { tagEl.hidden = false; tagEl.className = "tt-tag"; tagEl.textContent = "➡⬅ Ruée : attrapez-le !"; }
      else if (s.al) { tagEl.hidden = false; tagEl.className = "tt-tag te"; tagEl.textContent = "⬅➡ Tous ensemble !"; }
      else tagEl.hidden = true;
      // événements
      if (s.ev && s.ev.i !== lastEvI) {
        if (!firstState && s.ev.i > lastEvI) playEvents(s.ev.a || []);
        lastEvI = s.ev.i;
      }
      if (grabLock && grabLock.rv !== s.rv) { grabLock = null; totEl.classList.remove("grab"); }
      if (s.ph === "intro") showIntro(s); else if (s.ph === "end") showEnd(s); else if (!ovEl.hidden) { ovEl.hidden = true; ovEl.innerHTML = ""; ovKind = ""; }
      lastV = s.v;
      firstState = false;
    }
    let ovKind = "";
    function showIntro(s) {
      if (ovKind === "intro") return;
      ovKind = "intro";
      const left = Math.max(800, loc(s.I) - Date.now());
      const tw = (a, b) => `${cardHtml(a)}${cardHtml(b)}`;
      ovEl.innerHTML = `<div class="tt-sheet">
        <h2 class="tt-logo">Totem</h2>
        <p class="tt-lead">Même <b>FORME</b> qu'un adversaire (couleur ignorée)&nbsp;?<br><b>Attrapez le totem</b> avant lui&nbsp;!</p>
        <div class="tt-twins">${tw(0, NF)}<em class="ok">DUEL</em><span class="gap"></span>${tw(0, 1)}<em class="ko">PIÈGE</em></div>
        <div class="tt-leg">
          <div>${cardHtml(72)}<span><b>Tous ensemble</b> : au prochain tour, tout le monde retourne d'un coup.</span></div>
          <div>${cardHtml(75)}<span><b>Ruée</b> : TOUT LE MONDE attrape le totem ! Le plus lent ramasse.</span></div>
          <div>${cardHtml(78)}<span><b>Couleurs</b> : duels sur la même <b>couleur</b>, jusqu'à la prochaine carte spéciale.</span></div>
        </div>
        <div class="tt-bar"><i style="animation-duration:${Math.round(left)}ms"></i></div>
      </div>`;
      ovEl.hidden = false;
    }
    function showEnd(s) {
      if (ovKind === "end") return;
      ovKind = "end";
      const pk = PK, rk = s.rk || P.map((_, i) => i);
      const tot = i => pk[i].dn + pk[i].un;
      const best = tot(rk[0]);
      const isW = i => (s.why === "cap" ? tot(i) === best : i === rk[0]);
      const title = s.why === "win" ? `${nm(rk[0])} vide ses piles !` : s.why === "solo" ? "Seul à table !" : "Temps écoulé !";
      ovEl.innerHTML = `<div class="tt-sheet"><h2 class="tt-logo" style="font-size:1.9rem">${title}</h2>
        <div class="tt-rk">${rk.map((i, k) => `<div class="tt-row${isW(i) ? " w" : ""}${i === mySeat ? " me" : ""}" style="animation-delay:${k * 80}ms">
          <span class="p">${isW(i) ? "🏆" : k + 1}</span><span class="tt-av">${bust(i, isW(i) ? "win" : k === rk.length - 1 ? "lose" : "")}</span>
          <span class="n">${nm(i)}<small>⚡ ${s.dw ? s.dw[i] : 0} duel${s.dw && s.dw[i] > 1 ? "s" : ""}${s.br && s.br[i] ? " · record " + fmt(s.br[i]) : ""}${s.fa && s.fa[i] ? ` · ${s.fa[i]} faute${s.fa[i] > 1 ? "s" : ""}` : ""}</small></span>
          <span class="c">${tot(i)}<small>carte${tot(i) > 1 ? "s" : ""}</small></span></div>`).join("")}</div></div>`;
      ovEl.hidden = false;
    }

    /* ---------- animations d'événements ---------- */
    const banQ = [];
    let banBusy = false;
    function banner(big, small, cls, ms) { banQ.push({big, small, cls, ms: ms || 1500}); if (banQ.length > 4) banQ.shift(); if (!banBusy) nextBanner(); }
    function nextBanner() {
      const b = banQ.shift();
      if (!b) { banBusy = false; banEl.classList.remove("on"); banEl.innerHTML = ""; return; }
      banBusy = true;
      banEl.classList.remove("on"); void banEl.offsetWidth;
      banEl.innerHTML = `<b class="${b.cls || ""}">${b.big}</b>${b.small ? `<small>${b.small}</small>` : ""}`;
      banEl.classList.add("on");
      later(nextBanner, b.ms);
    }
    function center(node) { const r = node.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height}; }
    function seatAnchor(s, kind) {
      if (s === mySeat) {
        if (kind === "pile" && pileEl) return pileEl;
        return meEl.querySelector(".tt-myi .tt-av") || meEl;
      }
      const c = $("tt-op" + s);
      if (!c) return null;
      return kind === "pile" ? c.querySelector(".tt-slot") : c.querySelector(".tt-av");
    }
    function flyNode(html, from, to, w, h, ms, delay, endScale) {
      if (RM || !from || !to || typeof document === "undefined") return;
      const n = document.createElement("div");
      n.className = "tt-fly";
      n.style.width = w + "px"; n.style.height = h + "px";
      n.style.transform = `translate(${from.x - w / 2}px,${from.y - h / 2}px)`;
      n.innerHTML = html;
      el.appendChild(n);
      try {
        const a = n.animate([
          {transform: `translate(${from.x - w / 2}px,${from.y - h / 2}px) scale(1)`, opacity: 1},
          {transform: `translate(${(from.x + to.x) / 2 - w / 2}px,${Math.min(from.y, to.y) - h / 2 - 40}px) scale(${(1 + endScale) / 2 + .15}) rotate(-12deg)`, opacity: 1, offset: .5},
          {transform: `translate(${to.x - w / 2}px,${to.y - h / 2}px) scale(${endScale}) rotate(0deg)`, opacity: .85}
        ], {duration: ms, delay: delay || 0, easing: "cubic-bezier(.35,.1,.3,1)", fill: "both"});
        a.onfinish = () => n.remove();
      } catch (e) { /* rien */ }
      later(() => n.remove(), ms + (delay || 0) + 300);
    }
    function flash(seatsList, cls, ms) {
      seatsList.forEach(s => { const sl = slotEl(s); if (sl) { sl.classList.add(cls); later(() => sl.classList.remove(cls), ms || 1200); } });
    }
    function totemTo(s) {
      const a = seatAnchor(s, "av");
      if (RM || !a) return;
      const from = center(totEl), to = center(a);
      totEl.classList.add("gone");
      flyNode(TOTEM, from, to, from.w, from.h, 520, 0, .38);
      later(() => { totEl.classList.remove("gone"); if (!RM) { totEl.classList.remove("back"); void totEl.offsetWidth; totEl.classList.add("back"); } }, 1050);
    }
    function cardsFly(fromSeat, toSeat, n, delay) {
      if (RM || !n) return;
      const a = seatAnchor(fromSeat, "pile"), b = seatAnchor(toSeat, "pile");
      if (!a || !b) return;
      const f = center(a), t = center(b), w = Math.max(30, Math.min(60, f.w * .8));
      for (let k = 0; k < Math.min(n, 5); k++) flyNode(`<div class="tt-c tt-bk" style="--w:${w}px"><span></span></div>`, f, t, w, w * 1.36, 520, (delay || 0) + k * 70, .8);
    }
    function shake(s) {
      const node = s === mySeat ? meEl : $("tt-op" + s);
      if (!node || RM) return;
      node.classList.remove("shake"); void node.offsetWidth; node.classList.add("shake");
      later(() => node.classList.remove("shake"), 500);
    }
    function playEvents(list) {
      list.forEach(e => {
        if (e.k === "d" || e.k === "ru") {
          const mine = e.w === mySeat, lost = (e.l || []).includes(mySeat);
          const g = [e.w].concat(e.l || []);
          if (e.k === "d") flash(g, "hl", 1300);
          totemTo(e.w);
          (e.l || []).forEach((l, k) => cardsFly(e.w, l, Math.ceil(e.n / Math.max(1, e.l.length)), 420 + k * 120));
          const mineR = (e.r || []).find(x => x[0] === mySeat);
          const who = e.l && e.l.length ? e.l.map(nm).join(", ") : "";
          const head = e.k === "ru" ? (mine ? "Ruée gagnée !" : `${nm(e.w)} le plus rapide !`) : (mine ? "Totem attrapé !" : `${nm(e.w)} attrape le totem !`);
          const takes = e.n ? plural(e.n, "carte") : "";
          const many = e.l && e.l.length > 1;
          let sub = fmt(e.ms);
          if (who) sub += lost && !many ? (takes ? ` · vous prenez ${takes}` : " · vous ne prenez rien") : ` · ${who} ${takes ? (many ? "se partagent " : "prend ") + takes : many ? "ne prennent rien" : "ne prend rien"}`;
          if (mineR && !mine) sub += ` · vous : ${fmt(mineR[1])}`;
          banner(head, sub, mine ? "gd" : lost ? "bd" : "", 1900);
          if (mine) { later(() => { sfx("win"); hap("success"); }, 350); sfx("whoosh"); }
          else if (lost) { sfx("whoosh"); later(() => { sfx("lose"); hap("fail"); }, 400); }
          else sfx("whoosh");
        } else if (e.k === "f") {
          const mine = e.w === mySeat;
          flash([e.w], "bad", 1300);
          shake(e.w);
          P.forEach((_, s) => { if (s !== e.w && shownTopBefore[s] >= 0) cardsFly(s, e.w, 2, 150); });
          banner(mine ? "Faute !" : `Faute de ${nm(e.w)} !`, `${mine ? "vous ramassez" : "ramasse"} ${e.n ? plural(e.n, "carte") : "le tapis (vide)"} du tapis`, "bd", 1900);
          if (mine) { sfx("lose"); hap("fail"); } else sfx("tap");
        } else if (e.k === "sp") {
          if (e.sp === RU) { banner("Ruée !", "tout le monde attrape le totem !", "bd", 1300); sfx("go"); if (mySeat >= 0) hap("heavy"); }
          else if (e.sp === TE) { banner("Tous ensemble !", "au prochain tour, tout le monde retourne", "gd", 1500); sfx("count"); }
          else { banner("Couleurs !", "duels sur la même COULEUR jusqu'à la prochaine spéciale", "gd", 1700); sfx("count"); }
        } else if (e.k === "rc") banner("On recycle !", "plus rien à retourner : les piles visibles repartent face cachée", "", 1800);
        else if (e.k === "x") banner("Ruée ratée…", "personne n'a bougé", "", 1300);
      });
    }

    /* ---------- actions ---------- */
    let shownTopBefore = P.map(() => -1);
    function grab(evTs) {
      if (mySeat < 0 || !S || S.ph !== "play") return;
      const now = performance.now();
      if (grabLock && now < grabLock.until) return;
      const t = typeof evTs === "number" && evTs > 0 && evTs <= now + 5 && evTs >= now - 1000 ? evTs : now;
      const ms = vw.inD && vw.t0 >= 0 ? Math.max(0, Math.round(t - vw.t0)) : -1;
      inp.g = nonce + "." + (++cnt); inp.gv = vw.v; inp.ms = ms; inp.vis = vw.tp.slice(); inp.cm = vw.cm; inp.ru = vw.ru; inp.rv = vw.rv;
      send();
      grabLock = {rv: S.rv, until: now + 1600};
      later(() => { if (grabLock && performance.now() >= grabLock.until) { grabLock = null; totEl.classList.remove("grab"); } }, 1650);
      totEl.classList.add("grab");
      sfx("tap"); hap("heavy");
      if (!RM) {
        const h = document.createElement("div"); h.className = "tt-hand"; h.textContent = "✊"; ar.appendChild(h); later(() => h.remove(), 650);
        if (ms >= 0) { const m = document.createElement("div"); m.className = "tt-myms"; m.textContent = fmt(ms); ar.appendChild(m); later(() => m.remove(), 1150); }
      }
    }
    function flipTap() {
      if (mySeat < 0 || !S || S.ph !== "play" || S.tu !== mySeat || flippedTn === S.tn || !PK[mySeat].dn) return;
      flippedTn = S.tn;
      inp.f = nonce + "." + (++cnt); inp.ft = S.tn;
      send();
      sfx("tap"); hap("light");
      if (pileEl && !RM) { pileEl.classList.add("press"); later(() => pileEl.classList.remove("press"), 140); }
    }
    const onTot = e => { if (e.button !== undefined && e.button > 0) return; e.preventDefault(); grab(e.timeStamp); };
    const onPile = e => { if (e.button !== undefined && e.button > 0) return; e.preventDefault(); flipTap(); };
    totEl.addEventListener("pointerdown", onTot);
    if (pileEl) pileEl.addEventListener("pointerdown", onPile);
    const onKey = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tg = e.target && e.target.tagName;
      if (tg === "INPUT" || tg === "TEXTAREA") return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); grab(e.timeStamp); }
      else if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "f" || e.key === "F") { e.preventDefault(); flipTap(); }
    };
    window.addEventListener("keydown", onKey);

    api.onState(s => {
      if (dead || !s || s.g !== 1) return;
      sampleClock(s.t);
      lastStateAt = performance.now();
      shownTopBefore = PK ? PK.map(x => x.top) : P.map(() => -1);
      S = s; PK = parsePk(s.pk);
      render();
      markPaint();
    });

    /* ---------- minuteurs d'affichage + ping ---------- */
    let lastPing = 0;
    const tick = setInterval(() => {
      if (dead) return;
      const pnow = performance.now();
      if (mySeat >= 0 && pnow - lastPing > PING_MS) { lastPing = pnow; send(); }
      if (!S) return;
      if (S.ph === "play" || S.ph === "end") {
        const left = Math.max(0, S.ph === "end" ? 0 : loc(S.E) - Date.now()), sec = Math.ceil(left / 1000);
        const txt = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        if (clockEl.textContent !== txt) clockEl.textContent = txt;
        clockEl.classList.toggle("hot", S.ph === "play" && left < 30000);
      } else if (clockEl.textContent !== "⏱ 6:00") clockEl.textContent = "⏱ 6:00";
      if (pileEl) {
        const bar = $("tt-pbar");
        const my = S.ph === "play" && S.tu === mySeat;
        const f = my ? clamp((loc(S.td) - Date.now()) / TURN_MS, 0, 1) : 0;
        bar.style.transform = `scaleX(${f.toFixed(3)})`;
      }
      if (grabLock && pnow >= grabLock.until) { grabLock = null; totEl.classList.remove("grab"); }
    }, 100);

    // Accroche de test (robots Playwright) : lecture seule de la vue affichée.
    el.__tt = {view: () => vw, state: () => S, seat: mySeat, nf: NF, card: cardHtml, host: () => (hostDbg ? hostDbg() : null)};

    return {
      destroy() {
        dead = true;
        timers.forEach(clearTimeout); timers.clear();
        clearInterval(tick);
        if (hostLoop) clearInterval(hostLoop);
        if (rafId) cancelAnimationFrame(rafId);
        clearTimeout(rafFallback);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", onResize);
        window.removeEventListener("keydown", onKey);
        totEl.removeEventListener("pointerdown", onTot);
        if (pileEl) pileEl.removeEventListener("pointerdown", onPile);
        delete el.__tt;
        el.innerHTML = "";
      }
    };
  }
});
