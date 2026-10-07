/* Gonflette Party : Pictionary équipes (4 à 8 joueurs, 2 équipes, chacun sur son téléphone).
   À chaque round, UN dessinateur par équipe dessine le MÊME mot secret en même temps (rotation dans l'équipe).
   Chaque dessinateur diffuse ses traits par SON entrée (fenêtre glissante de morceaux numérotés, comme
   « Dessine et devine ») ; chaque téléphone n'affiche que le chevalet de SA propre équipe pendant le round.
   Les coéquipiers tapent leurs propositions ({seq, g}) ; l'hôte compare au mot (même normalisation que
   dessine.js). Première équipe qui trouve : +1 et fin du round, puis on compare les deux dessins côte à côte. */
GONFLETTE.registerGame({
  id: "pictionary",
  name: "Pictionary équipes",
  min: 4,
  max: 8,
  teams: true,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, NP = P.length;
    const mySeat = P.findIndex(p => p.key === api.me);
    // window.__pxSpeed : accélère pré-round / révélation (tests) ; window.__pxSec : durée d'un round (tests)
    const SP = () => Math.max(0.05, +window.__pxSpeed || 1);
    const ROUND_SEC = () => Math.max(3, Math.round(+window.__pxSec || 60 / SP()));
    const PRE_MS = () => 3400 / SP(), REVEAL_MS = () => 7000 / SP(), END_MS = 3400;
    const CHUNK_PTS = 12, INPUT_BUDGET = 2900, MAX_UNDO_SENT = 30;

    /* ---------- équipes ---------- */
    const DEF_COL = ["#e63946", "#3a86ff"];
    const TT = [0, 1].map(t => {
      const src = api.teams && api.teams[t];
      const keys = src ? src.keys.slice() : P.filter((p, i) => i % 2 === t).map(p => p.key);
      return {name: (src && src.name) || (t ? "Équipe bleue" : "Équipe rouge"), color: (src && src.color) || DEF_COL[t], keys,
        seats: keys.map(k => P.findIndex(p => p.key === k)).filter(i => i >= 0)};
    });
    const teamOfSeat = P.map((p, i) => (TT[0].seats.includes(i) ? 0 : TT[1].seats.includes(i) ? 1 : null));
    const myTeam = mySeat >= 0 ? teamOfSeat[mySeat] : null;
    const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16) || 0; return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

    /* ---------- mots (repris de « Dessine et devine ») ---------- */
    const WORDS = {
      facile: ["maison", "soleil", "arbre", "chat", "voiture", "fleur", "bateau", "pomme", "lune", "étoile", "nuage", "parapluie", "ballon", "gâteau d'anniversaire", "poisson", "montagne", "vélo", "avion", "clé", "livre", "lunettes", "chapeau", "chaussure", "banane", "escargot", "cœur", "train", "château fort", "fusée", "arc-en-ciel", "bonhomme de neige", "sapin", "glace", "pizza", "téléphone", "horloge", "guitare", "crayon", "ciseaux", "tortue", "papillon", "araignée", "serpent", "couronne", "ancre", "cadeau", "bougie", "champignon", "carotte", "œuf", "pont", "fantôme", "robot", "citrouille", "épée", "phare", "cerf-volant", "toboggan", "dé", "brosse à dents"],
      absurde: ["un pingouin qui fait ses impôts", "une baguette qui fait du ski", "un chat chef d'orchestre", "une girafe dans un ascenseur", "un escargot en trottinette", "un croissant qui fait du yoga", "une vache astronaute", "un requin végétarien", "une pizza en vacances", "un fromage qui pleure", "une tortue pilote de course", "un dinosaure qui tricote", "une licorne au supermarché", "un poulpe qui fait la vaisselle", "un ours en pyjama", "une banane détective", "un cactus qui fait un câlin", "un mouton DJ", "une poule qui passe le bac", "une carotte au tribunal", "un fantôme qui a peur du noir", "une baleine dans une baignoire", "un robot amoureux d'un grille-pain", "un pigeon qui prend le métro", "un camembert qui fait du surf", "une saucisse super-héros", "un éléphant sur un monocycle", "une sardine qui fait de la plongée", "un hamster qui fait de la musculation", "un crocodile chez le dentiste", "une chaussette qui cherche sa jumelle", "un vampire à la plage", "une momie qui se fait bronzer", "un lama coiffeur", "une grenouille en smoking", "un brocoli qui fait de la boxe", "un nuage qui a le rhume", "un chien qui promène son maître", "un escargot qui fait un excès de vitesse", "une patate qui fait un selfie", "un kangourou facteur", "une sirène à la piscine municipale", "un yéti qui a trop chaud", "un poisson rouge qui s'ennuie", "la tour Eiffel qui danse", "une raclette sur la Lune", "un mammouth au karaoké", "une fourmi qui déménage", "un pirate qui a le mal de mer", "un chevalier qui a peur des poules", "une abeille en retard au travail", "un manchot serveur de café", "une citrouille qui fait du jogging", "un flamant rose qui fait du patin à glace", "un castor architecte", "une pieuvre batteuse", "un panda qui fait la sieste au bureau", "un hibou qui fait une nuit blanche", "une cafetière qui court un marathon", "un kiwi qui saute en parachute", "une crêpe qui fait du trampoline", "un gorille en tutu", "un aspirateur qui a faim", "un bonhomme de neige au sauna", "une moustache qui s'envole", "un dragon qui éteint des bougies", "un hérisson qui gonfle un ballon", "un sapin de Noël à la plage"],
      objets: ["table", "chaise", "lampe", "fourchette", "cuillère", "tasse", "bouteille", "réveil", "télévision", "ordinateur", "clavier", "souris d'ordinateur", "casque audio", "appareil photo", "valise", "sac à dos", "ventilateur", "aspirateur", "réfrigérateur", "grille-pain", "bouilloire", "poêle", "casserole", "marteau", "tournevis", "scie", "échelle", "brouette", "arrosoir", "balai", "seau", "peigne", "miroir", "savon", "oreiller", "canapé", "cadenas", "enveloppe", "trombone", "agrafeuse", "règle", "gomme", "taille-crayon", "calculatrice", "boussole", "jumelles", "loupe", "sablier", "trottinette", "skateboard", "hamac", "tente", "lave-linge", "micro-ondes", "télécommande", "pince à linge", "tire-bouchon", "passoire", "fer à repasser", "baignoire"],
      animaux: ["chien", "cheval", "vache", "cochon", "mouton", "chèvre", "lapin", "souris", "hérisson", "écureuil", "renard", "loup", "ours", "lion", "tigre", "éléphant", "girafe", "zèbre", "hippopotame", "rhinocéros", "crocodile", "singe", "gorille", "kangourou", "koala", "panda", "pingouin", "phoque", "baleine", "dauphin", "requin", "pieuvre", "méduse", "crabe", "homard", "étoile de mer", "hibou", "aigle", "perroquet", "flamant rose", "autruche", "paon", "canard", "poule", "coq", "cygne", "chauve-souris", "abeille", "fourmi", "coccinelle", "libellule", "grenouille", "caméléon", "chameau", "lama", "castor", "taupe", "paresseux", "morse", "toucan"],
      metiers: ["pompier", "policier", "médecin", "infirmière", "dentiste", "vétérinaire", "boulanger", "boucher", "cuisinier", "serveur", "coiffeur", "facteur", "plombier", "électricien", "menuisier", "maçon", "jardinier", "agriculteur", "pêcheur", "astronaute", "pilote d'avion", "chauffeur de bus", "mécanicien", "professeur", "chanteur", "musicien", "peintre", "photographe", "journaliste", "magicien", "clown", "jongleur", "acrobate", "danseuse étoile", "footballeur", "arbitre", "juge", "architecte", "chirurgien", "pharmacien", "bibliothécaire", "caissière", "déménageur", "laveur de vitres", "ramoneur", "apiculteur", "berger", "maître-nageur", "plongeur", "détective", "scientifique", "archéologue", "dompteur de lions", "présentateur météo", "fleuriste", "cordonnier", "horloger", "chef d'orchestre", "sculpteur", "explorateur"],
      films: ["Le Roi Lion", "La Reine des neiges", "Toy Story", "Le Monde de Nemo", "Shrek", "Ratatouille", "Cendrillon", "Blanche-Neige", "La Belle et la Bête", "Aladdin", "Le Livre de la jungle", "Peter Pan", "Pinocchio", "Dumbo", "Bambi", "Les 101 Dalmatiens", "Astérix et Obélix", "Tintin et Milou", "Spider-Man", "Batman", "Superman", "Harry Potter", "Star Wars", "Dark Vador", "Titanic", "Jurassic Park", "King Kong", "Godzilla", "E.T. l'extra-terrestre", "Les Dents de la mer", "SOS Fantômes", "Retour vers le futur", "Indiana Jones", "Le Seigneur des anneaux", "Gandalf", "Mickey", "Donald", "Bob l'éponge", "Pikachu", "Super Mario", "Sonic", "Les Schtroumpfs", "Lucky Luke", "Le Petit Prince", "Kirikou", "Les Minions", "Cars", "Là-haut", "Wall-E", "Vice-Versa", "Coco", "Zootopie", "Madagascar", "L'Âge de glace", "Kung Fu Panda", "Dragons", "Les Indestructibles", "Monstres et Cie", "Hulk", "Wonder Woman", "Frankenstein", "Dracula", "Sherlock Holmes", "Zorro", "Robin des Bois", "Garfield", "Scooby-Doo", "Winnie l'ourson", "Babar", "Barbapapa", "Le Magicien d'Oz", "Mary Poppins", "Charlie et la chocolaterie", "Hôtel Transylvanie", "Le Chat Potté", "La Petite Sirène", "Les Tortues Ninja", "Pac-Man", "Le Grinch", "Casper"]
    };
    const uniq = list => { const seen = new Set(), out = []; for (const w of list) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } } return out; };
    const CLASSIC = uniq([].concat(WORDS.facile, WORDS.objets, WORDS.animaux, WORDS.metiers, WORDS.films));
    const ABSURDE = uniq(WORDS.absurde);

    const COLORS = [
      {n: "Noir de fusain", c: "#1f1a17"}, {n: "Rouge vermillon", c: "#d62828"}, {n: "Orange", c: "#f77f00"},
      {n: "Jaune de cadmium", c: "#f6c343"}, {n: "Vert prairie", c: "#2a9d43"}, {n: "Bleu ciel", c: "#38bdf8"},
      {n: "Bleu outremer", c: "#1d4ed8"}, {n: "Violet", c: "#7b2cbf"}, {n: "Rose bonbon", c: "#f472b6"}, {n: "Terre de Sienne", c: "#8b5a2b"}
    ];
    const ERASER = 10;
    const SIZES = [{n: "Fin", v: 0.004, d: 4}, {n: "Moyen", v: 0.009, d: 9}, {n: "Épais", v: 0.018, d: 15}, {n: "Très épais", v: 0.036, d: 24}];
    const PAPER = "#fffdf6";

    /* ---------- utilitaires ---------- */
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
    const every = (fn, ms) => { const id = setInterval(() => { if (!dead) fn(); }, ms); timers.add(id); return id; };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const enc = w => btoa(unescape(encodeURIComponent(w))).split("").reverse().join("");
    const dec = w => { try { return decodeURIComponent(escape(atob(String(w).split("").reverse().join("")))); } catch (e) { return ""; } };
    const nameOf = seat => (P[seat] ? P[seat].pseudo : "?");
    const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "a", "en", "the"]);
    function tokens(s, keepAll) {
      s = String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ").trim();
      return s ? s.split(" ").filter(t => keepAll || !ARTICLES.has(t)).map(t => (t.length > 3 ? t.replace(/[sx]$/, "") : t)) : [];
    }
    const STOP = new Set(["qui", "que", "sur", "dans", "avec", "pour", "par", "chez", "son", "sa", "ses", "se", "fait", "fai", "ne", "pas", "est"]);
    function lev(a, b) {
      if (a === b) return 0;
      const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
      let prev = Array.from({length: n + 1}, (_, i) => i), cur = new Array(n + 1);
      for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        [prev, cur] = [cur, prev];
      }
      return prev[n];
    }
    // 2 = trouvé, 1 = presque, 0 = raté (identique à dessine.js)
    function judge(guess, word) {
      let gt = tokens(guess), wt = tokens(word);
      if (!wt.length || !gt.length) { gt = tokens(guess, true); wt = tokens(word, true); }
      const g = gt.join(""), w = wt.join("");
      if (!g) return 0;
      if (g === w || g === wt.filter(t => t !== "et").join("") || gt.filter(t => t !== "et").join("") === w) return 2;
      const d = lev(g, w);
      if (w.length >= 6 && d <= 1) return 2;
      if (g.length >= 3 && d <= (w.length <= 3 ? 1 : Math.max(2, Math.floor(w.length / 3)))) return 1;
      const sig = wt.filter(t => t.length >= 3 && !STOP.has(t));
      if (sig.length >= 2) {
        const hit = sig.filter(t => gt.some(x => x === t || (t.length >= 5 && lev(x, t) <= 1))).length;
        if (hit >= Math.max(1, Math.ceil(sig.length / 3))) return 1;
      }
      return 0;
    }

    /* ---------- son (WebAudio, après un geste) ---------- */
    let actx = null;
    function ensureAudio() {
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) try { actx = new AC(); } catch (e) { actx = null; } }
      if (actx && actx.state === "suspended") try { actx.resume(); } catch (e) {}
    }
    function tone(f, start, dur, type, vol) {
      if (!actx) return;
      try {
        const t = actx.currentTime + (start || 0), o = actx.createOscillator(), g = actx.createGain();
        o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
      } catch (e) {}
    }
    const sfx = {
      win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.28, "triangle", 0.14)); },
      pop() { tone(700, 0, 0.06, "sine", 0.06); },
      tick(u) { tone(u ? 1320 : 980, 0, 0.05, "square", 0.04); },
      sad() { tone(392, 0, 0.22, "triangle", 0.1); tone(330, 0.2, 0.22, "triangle", 0.1); tone(262, 0.4, 0.4, "triangle", 0.1); },
      gong() { tone(110, 0, 1.2, "sine", 0.18); tone(220.5, 0, 0.9, "triangle", 0.07); tone(331, 0.01, 0.6, "sine", 0.04); }
    };

    /* ---------- interface ---------- */
    const ICON_ERASER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15l8-8 8 8-5 5H8z" fill="#f9a8c4" stroke="#2b2118" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 11l8 8" stroke="#2b2118" stroke-width="1.8"/><path d="M11 7l4-4 8 8-4 4" fill="#93c5fd" stroke="#2b2118" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    const ICON_UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
    const ICON_CLEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
    const ICON_PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L16 4.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="#f6c343" stroke="#2b2118" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20l1.2-4.6 3.4 3.4z" fill="#2b2118"/></svg>';
    const easelHtml = (cls, label) => `<div class="px-easel ${cls}"><div class="px-frame"><div class="px-paper"><canvas class="px-cv" role="img" aria-label="${label}"></canvas><div class="px-over" hidden></div></div></div></div>`;

    el.innerHTML = `<style>
.px{--ink:#f4efe3;--muted:#c3bba9;--paper:#fffdf6;--dark:#2b2118;--gold:#f3c74b;--gold-d:#b8891a;--wood:#a4693a;--wood-d:#5e3a1b;--green:#2fbf5b;
  --c0:${TT[0].color};--c1:${TT[1].color};--g0:${rgba(TT[0].color, .45)};--g1:${rgba(TT[1].color, .45)};
  --f-d:"Anton","Impact","Arial Narrow",sans-serif;--f-ui:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;--f-s:"Pacifico","Brush Script MT","Segoe Print",cursive;
  min-height:100%;color:var(--ink);font-family:var(--f-ui);font-size:17px;line-height:1.25;color-scheme:dark;
  background-color:#15121d;background-image:radial-gradient(110% 55% at 50% -8%,rgba(255,226,150,.16),transparent 62%),radial-gradient(70% 45% at -5% 105%,var(--g0),transparent 70%),radial-gradient(70% 45% at 105% 105%,var(--g1),transparent 70%),repeating-linear-gradient(90deg,rgba(255,255,255,.018) 0 2px,transparent 2px 9px)}
.px *,.px *::before,.px *::after{box-sizing:border-box}
.px [hidden]{display:none!important}
.px button{font:inherit;color:inherit;cursor:pointer}
.px .av{display:block}
.px-wrap{max-width:640px;margin:0 auto;padding:10px 16px 28px;display:flex;flex-direction:column;gap:10px}
/* tableau de score façon combat */
.px-score{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);border-radius:14px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.55),0 0 0 2px rgba(0,0,0,.6)}
.px-side{display:flex;align-items:center;gap:8px;padding:6px 10px;min-width:0;color:#fff}
.px-side.t0{background:linear-gradient(135deg,${rgba(TT[0].color, .75)},var(--c0) 45%,${rgba(TT[0].color, .9)});}
.px-side.t1{background:linear-gradient(225deg,${rgba(TT[1].color, .75)},var(--c1) 45%,${rgba(TT[1].color, .9)});flex-direction:row-reverse;text-align:right}
.px-side .nm{flex:1;min-width:0;font-weight:800;font-size:.95rem;line-height:1.05;text-transform:uppercase;letter-spacing:.03em;overflow-wrap:anywhere;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.px-side .pt{font-family:var(--f-d);font-size:2.3rem;line-height:1;text-shadow:0 3px 0 rgba(0,0,0,.3)}
.px-side .pt.bump{animation:px-bump .6s ease}
@keyframes px-bump{30%{transform:scale(1.5)}}
.px-rd{position:relative;background:#0d0b12;border-left:3px solid var(--gold);border-right:3px solid var(--gold);padding:3px 12px;text-align:center;display:flex;flex-direction:column;justify-content:center;min-width:86px}
.px-rd small{font-family:var(--f-d);letter-spacing:.22em;color:var(--gold);font-size:.75rem;line-height:1}
.px-rd b{font-family:var(--f-d);font-weight:400;font-size:2.1rem;line-height:1}
.px-rd i{font-style:normal;font-size:.78rem;color:var(--muted);line-height:1}
.px-timer{position:relative;height:24px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;border:2px solid rgba(255,255,255,.14)}
.px-bar{position:absolute;inset:0;transform-origin:left center;background:linear-gradient(90deg,var(--gold-d),var(--gold));transition:transform .9s linear}
.px-timer span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-d);font-size:.95rem;letter-spacing:.06em;color:#fff;text-shadow:0 1px 3px #000,0 0 6px #000}
.px-timer.hurry .px-bar{background:linear-gradient(90deg,#b3141f,#ff5a4f)}
.px-timer.hurry span{animation:px-pulse 1s ease-in-out infinite}
@keyframes px-pulse{50%{transform:scale(1.12)}}
/* post-it du mot secret */
.px-note{position:relative;margin:6px 4px 0;padding:12px 14px 8px;color:var(--dark);background:#fde68a;background-image:linear-gradient(180deg,rgba(255,255,255,.35),transparent 30%);box-shadow:0 12px 18px -12px rgba(0,0,0,.7);transform:rotate(-1deg);border-radius:2px 2px 14px 2px}
.px-note::before{content:"";position:absolute;top:-10px;left:50%;width:84px;height:20px;transform:translateX(-50%) rotate(3deg);background:rgba(196,230,255,.75)}
.px-note .lbl{display:block;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.72rem;color:#7a5a00}
.px-note .sec{display:block;font-family:var(--f-s);font-size:1.45rem;line-height:1.3;overflow-wrap:anywhere}
.px-note .sub{display:block;font-weight:700;font-size:.85rem;color:#6b5418}
.px-hint{text-align:center;min-height:1.8em;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 14px}
.px-hint .w{font-family:var(--f-d);letter-spacing:.18em;font-size:1.2rem;white-space:nowrap}
.px-hint .n{font-weight:700;color:var(--muted);font-size:.9rem;letter-spacing:0}
/* chevalets */
.px-easel{--tc:var(--c0);--tg:var(--g0);position:relative;padding:12px 0 30px}
.px-easel.t1{--tc:var(--c1);--tg:var(--g1)}
.px-easel::before,.px-easel::after{content:"";position:absolute;bottom:0;width:9px;height:60px;border-radius:3px;background:linear-gradient(90deg,#5e3a1b,#b77b47 50%,#5e3a1b)}
.px-easel::before{left:18%;transform:rotate(13deg);transform-origin:top}
.px-easel::after{right:18%;transform:rotate(-13deg);transform-origin:top}
.px-frame{position:relative;z-index:1;padding:7px;border-radius:5px;background:var(--tc);box-shadow:inset 0 0 0 2px rgba(255,255,255,.3),0 0 0 3px #0d0b12,0 0 30px var(--tg),0 16px 22px -10px rgba(0,0,0,.7)}
.px-frame::before{content:"";position:absolute;top:-12px;left:50%;width:56px;height:14px;margin-left:-28px;border-radius:3px;background:linear-gradient(180deg,#c48a52,#7a4b22);box-shadow:0 2px 3px rgba(0,0,0,.5)}
.px-frame::after{content:"";position:absolute;left:-8px;right:-8px;bottom:-14px;height:12px;border-radius:3px;background:linear-gradient(180deg,#c48a52,#6b4220);box-shadow:0 4px 6px rgba(0,0,0,.5)}
.px-paper{position:relative;width:100%;aspect-ratio:4/3;background:var(--paper);overflow:hidden;border-radius:2px}
.px-paper canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none}
.px-paper.can canvas{cursor:crosshair}
.px-over{position:absolute;inset:0;display:grid;place-items:center;padding:8px;background:rgba(13,11,18,.55);text-align:center;animation:px-in .3s ease both}
.px-poster{max-width:94%;padding:10px 14px 12px;background:#0d0b12;border:3px solid var(--gold);border-radius:6px;box-shadow:0 0 0 3px #0d0b12,0 0 0 5px var(--tc),0 14px 30px rgba(0,0,0,.6);animation:px-slam .5s cubic-bezier(.2,1.6,.4,1) both}
.px-poster small{display:block;font-family:var(--f-d);letter-spacing:.3em;color:var(--gold);font-size:.8rem}
.px-poster b{display:block;font-family:var(--f-d);font-weight:400;font-size:3rem;line-height:1;letter-spacing:.04em}
.px-poster .vs{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800;font-size:1.05rem;margin-top:4px}
.px-poster .vs i{font-family:var(--f-d);font-style:normal;color:var(--gold);font-size:.9rem}
.px-poster .r0{color:#ff8a92}.px-poster .r1{color:#8db8ff}
.px-poster p{margin:6px 0 0;font-size:.9rem;color:var(--muted)}
@keyframes px-slam{from{transform:scale(2.2) rotate(-6deg);opacity:0}}
@keyframes px-in{from{opacity:0;transform:scale(.96)}}
/* plumier (repris de dessine) */
.px-tray{display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 8px 12px;margin-top:-8px;background-color:#b57a45;background-image:repeating-linear-gradient(90deg,rgba(60,30,10,.07) 0 2px,transparent 2px 10px),linear-gradient(180deg,#c99159,#9c6333);border-radius:6px 6px 26px 26px/6px 6px 18px 18px;box-shadow:inset 0 10px 12px -8px rgba(40,20,0,.55),0 10px 16px -12px rgba(0,0,0,.8);color:var(--dark)}
.px-tray.off{opacity:.55;pointer-events:none}
.px-row{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:flex-end}
.px-tubes{gap:3px;padding-top:12px}
.px-tube{position:relative;width:29px;height:62px;padding:0;border:none;background:none;transition:transform .15s ease;border-radius:4px;flex:none}
.px-tube .cap{position:absolute;top:0;left:8px;width:13px;height:10px;border-radius:2px 2px 1px 1px;background:linear-gradient(90deg,#555,#e2e2e2 50%,#6b6b6b)}
.px-tube .neck{position:absolute;top:9px;left:4px;right:4px;height:7px;background:linear-gradient(90deg,#8d8d8d,#f3f3f3 50%,#9a9a9a);clip-path:polygon(22% 0,78% 0,100% 100%,0 100%)}
.px-tube .body{position:absolute;top:15px;left:2px;right:2px;bottom:0;background-color:var(--c);border-radius:4px 4px 1px 1px;background-image:linear-gradient(90deg,rgba(255,255,255,.4),transparent 35%,transparent 70%,rgba(0,0,0,.25)),linear-gradient(180deg,transparent 34%,rgba(255,253,246,.92) 34% 60%,transparent 60%)}
.px-tube .body::before{content:"";position:absolute;left:3px;right:3px;top:43%;height:5px;background:var(--c);border-radius:2px}
.px-tube[aria-pressed="true"]{transform:translateY(-10px) rotate(-6deg);filter:drop-shadow(0 6px 0 rgba(40,20,0,.35))}
.px-tube[aria-pressed="true"]::after{content:"";position:absolute;bottom:-8px;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px #fff8ee}
.px-size{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;padding:0;background:var(--paper);border:2px solid var(--wood-d);box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.px-size span{display:block;width:var(--d);height:var(--d);border-radius:50%;background:var(--cur,#1f1a17)}
.px-size[aria-pressed="true"]{background:var(--gold);border-color:var(--dark);box-shadow:0 0 0 3px #fff8ee}
.px-tool{display:inline-flex;align-items:center;gap:4px;min-height:42px;padding:0 8px;background:var(--paper);color:var(--dark)!important;border:2px solid var(--wood-d);border-radius:10px;font-weight:800;font-size:.95rem;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.px-tool svg{width:20px;height:20px;flex:none}
.px-tool[aria-pressed="true"]{background:var(--gold);border-color:var(--dark);box-shadow:0 0 0 3px #fff8ee}
.px-tool:disabled{opacity:.5;cursor:default}
/* propositions */
.px-guess{display:flex;gap:8px}
.px-guess input{flex:1;min-width:0;font:inherit;font-size:1.15rem;font-weight:700;padding:9px 12px;border:3px solid var(--tc,var(--gold));border-radius:12px;background:var(--paper);color:var(--dark)}
.px-guess input:focus{outline:3px solid var(--gold);outline-offset:2px}
.px .px-btn{font-family:var(--f-d);font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase;padding:6px 14px;min-height:48px;border:3px solid #0d0b12;border-radius:12px;background:var(--gold);color:#1a1408;box-shadow:0 4px 0 #7a5a10}
.px-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #7a5a10}
.px-btn:disabled{opacity:.45}
.px-shout{text-align:center;font-size:.85rem;color:var(--muted);margin-top:-4px}
.px-msg{min-height:1.5em;text-align:center;font-weight:800;font-size:1.05rem}
.px-msg .pill{display:inline-block;background:#fde68a;color:var(--dark);border:2px solid #0d0b12;border-radius:999px;padding:1px 10px;transform:rotate(-2deg)}
.px-feed{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;min-height:0}
.px-feed span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:1px 9px;font-size:.92rem;max-width:100%;overflow-wrap:anywhere}
.px-feed span b{color:var(--muted);font-weight:700;margin-right:4px}
.px-feed span s{text-decoration-color:rgba(255,90,80,.8);text-decoration-thickness:2px}
/* banc d'équipe + chevalet adverse vu de dos */
.px-bench{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:10px;align-items:end}
.px-mates{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end}
.px-mate{position:relative;width:66px;text-align:center;font-weight:800;font-size:.82rem;line-height:1.05}
.px-mate .av{width:64px;height:64px;margin:0 auto;border-radius:50% 50% 12px 12px;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.14),transparent 70%);border-bottom:4px solid var(--tc,var(--c0))}
.px-mate span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px-mate small{display:block;font-weight:700;color:var(--muted);font-size:.72rem}
.px-mate .mk{position:absolute;top:0;right:2px;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--paper);box-shadow:0 2px 4px rgba(0,0,0,.5)}
.px-mate .mk svg{width:16px;height:16px}
.px-mate.gone{opacity:.4}
.px-back{--tc:var(--c1);text-align:center;font-size:.8rem;line-height:1.1}
.px-back.t0{--tc:var(--c0)}
.px-back .bk{position:relative;aspect-ratio:4/3;border:5px solid var(--tc);border-radius:4px;background:linear-gradient(90deg,transparent 46%,#6b4220 46% 54%,transparent 54%),linear-gradient(0deg,transparent 44%,#6b4220 44% 56%,transparent 56%),repeating-linear-gradient(95deg,#c79a63 0 3px,#b88a55 3px 7px);box-shadow:0 0 18px var(--tg,rgba(0,0,0,.4)),0 8px 12px -6px rgba(0,0,0,.7)}
.px-back.t0 .bk{--tg:var(--g0)}.px-back.t1 .bk{--tg:var(--g1)}
.px-back .bk em{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;font-family:var(--f-d);font-size:1.3rem;color:#fff;background:rgba(13,11,18,.78);border-radius:8px;padding:0 7px;white-space:nowrap}
.px-back .bk em small{font-family:var(--f-ui);font-weight:700;font-size:.8rem}
.px-back .pen{position:absolute;right:-6px;top:-10px;width:26px;height:26px;opacity:0}
.px-back .pen svg{width:100%;height:100%}
.px-back.busy .pen{opacity:1;animation:px-scribble .35s ease-in-out infinite alternate}
@keyframes px-scribble{from{transform:translate(-4px,2px) rotate(-8deg)}to{transform:translate(3px,-2px) rotate(6deg)}}
.px-back b{display:block;margin-top:5px;font-size:.85rem;text-transform:uppercase;letter-spacing:.03em;overflow-wrap:anywhere}
.px-back span{color:var(--muted)}
/* comparaison */
.px-dh{margin:4px 0 0;text-align:center;font-family:var(--f-s);font-weight:400;font-size:1.7rem;line-height:1.2;color:var(--gold);text-shadow:0 3px 0 rgba(0,0,0,.45)}
.px-reveal{text-align:center}
.px-reveal .k{font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:.78rem;color:var(--muted)}
.px-reveal .w{display:block;font-family:var(--f-s);font-size:1.7rem;line-height:1.3;overflow-wrap:anywhere}
.px-reveal .w span{background:linear-gradient(transparent 62%,rgba(243,199,75,.4) 62% 92%,transparent 92%);padding:0 4px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.px-reveal .m{font-weight:800;font-size:1.05rem}
.px-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;perspective:900px}
.px-pair .px-easel{padding-top:16px;padding-bottom:40px}
.px-pair .px-easel.t0{transform:rotateY(12deg);transform-origin:left center}
.px-pair .px-easel.t1{transform:rotateY(-12deg);transform-origin:right center}
.px-pair .px-frame{padding:5px}
.px-col{position:relative;min-width:0;text-align:center}
.px-col .tn{font-weight:800;font-size:.9rem;text-transform:uppercase;letter-spacing:.03em;color:var(--tc);overflow-wrap:anywhere;line-height:1.05}
.px-col.t0{--tc:#ff8a92}.px-col.t1{--tc:#8db8ff}
.px-col .by{font-size:.95rem;font-weight:700;margin-top:-26px;position:relative;z-index:2}
.px-col .by i{font-family:var(--f-s);font-style:normal;font-size:1.05rem}
.px-col .tm{display:flex;justify-content:center;flex-wrap:wrap;gap:2px;margin-top:4px}
.px-col .tm .av{width:54px;height:54px}
.px-ko{position:absolute;z-index:3;top:46px;right:-6px;transform:rotate(8deg);background:var(--gold);color:#1a1408;font-family:var(--f-d);font-size:1.1rem;letter-spacing:.06em;padding:2px 10px;border:3px solid #0d0b12;border-radius:6px;box-shadow:0 4px 0 #0d0b12;white-space:nowrap;animation:px-slam .5s cubic-bezier(.2,1.6,.4,1) both}
/* fin */
.px-final{display:flex;flex-direction:column;gap:14px;animation:px-in .4s ease both}
.px-belt{position:relative;margin:4px 0 0;padding:14px 12px 12px;text-align:center;border-radius:20px;background:radial-gradient(circle at 50% 40%,#fff3b0,var(--gold) 38%,var(--gold-d) 80%);color:#1a1408;border:4px solid #0d0b12;box-shadow:0 0 0 4px var(--wc,var(--gold)),0 16px 30px rgba(0,0,0,.6)}
.px-belt small{display:block;font-family:var(--f-d);letter-spacing:.3em;font-size:.8rem}
.px-belt h2{margin:2px 0;font-family:var(--f-d);font-weight:400;font-size:1.9rem;line-height:1.05;text-transform:uppercase;overflow-wrap:anywhere}
.px-belt .sc{display:flex;justify-content:center;align-items:center;gap:12px;font-family:var(--f-d);font-size:3rem;line-height:1}
.px-belt .sc .a{color:${TT[0].color};-webkit-text-stroke:2px #0d0b12}.px-belt .sc .b{color:${TT[1].color};-webkit-text-stroke:2px #0d0b12}
.px-champs{display:flex;justify-content:center;flex-wrap:wrap;gap:4px}
.px-champs figure{margin:0;width:96px;text-align:center;font-weight:800;font-size:.85rem}
.px-champs .av{width:96px;height:96px;margin:0 auto;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(243,199,75,.35),transparent 70%)}
.px-champs figcaption{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px-gal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.px-gcol{min-width:0;display:flex;flex-direction:column;gap:12px}
.px-gcol h3{margin:0;text-align:center;font-family:var(--f-d);font-weight:400;font-size:1.15rem;letter-spacing:.04em;color:#fff;padding:3px 6px;border-radius:6px;background:var(--tc);overflow-wrap:anywhere}
.px-gcol.t0{--tc:var(--c0)}.px-gcol.t1{--tc:var(--c1)}
.px-gcol figure{position:relative;margin:0;text-align:center}
.px-gcol canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;background:var(--paper);border:5px solid var(--tc);border-radius:4px;box-shadow:0 8px 14px -6px rgba(0,0,0,.7)}
.px-gcol figcaption{font-size:.85rem;line-height:1.15;margin-top:3px;color:var(--muted)}
.px-gcol figcaption b{display:block;color:var(--ink);font-family:var(--f-s);font-weight:400;font-size:1rem;overflow-wrap:anywhere}
.px-gcol .one{position:absolute;top:-6px;right:-4px;background:var(--gold);color:#1a1408;font-family:var(--f-d);font-size:.9rem;padding:0 7px;border:2px solid #0d0b12;border-radius:999px;transform:rotate(10deg)}
@media (min-width:700px){.px-bench{grid-template-columns:minmax(0,1fr) 170px}}
@media (prefers-reduced-motion:reduce){.px *,.px *::before,.px *::after{animation:none!important;transition:none!important}.px-pair .px-easel.t0,.px-pair .px-easel.t1{transform:none}}
</style>
<div class="px"><div class="px-wrap">
  <header class="px-score" aria-label="Score">
    <div class="px-side t0"><span class="nm"></span><span class="pt">0</span></div>
    <div class="px-rd"><small>ROUND</small><b class="px-rn">1</b><i class="px-rof">/ 1</i></div>
    <div class="px-side t1"><span class="nm"></span><span class="pt">0</span></div>
  </header>
  <div class="px-timer" role="timer" aria-label="Temps restant"><div class="px-bar"></div><span class="px-sec">60 s</span></div>
  <section class="px-solo" style="display:flex;flex-direction:column;gap:10px">
    <div class="px-note" hidden><span class="lbl">Ton mot secret</span><span class="sec px-secret"></span><span class="sub px-nsub"></span></div>
    <div class="px-hint" hidden aria-label="Indice"></div>
    ${easelHtml("px-main", "Dessin de ton équipe en direct")}
    <div class="px-tray" hidden role="toolbar" aria-label="Plumier">
      <div class="px-row px-tubes" role="group" aria-label="Couleurs">${COLORS.map((c, i) => `<button type="button" class="px-tube" style="--c:${c.c}" data-c="${i}" aria-label="${c.n}" title="${c.n}" aria-pressed="${i ? "false" : "true"}"><span class="cap"></span><span class="neck"></span><span class="body"></span></button>`).join("")}</div>
      <div class="px-row px-sizes" role="group" aria-label="Taille du pinceau">${SIZES.map((s, i) => `<button type="button" class="px-size" data-z="${i}" aria-label="Pinceau ${s.n.toLowerCase()}" title="Pinceau ${s.n.toLowerCase()}" aria-pressed="${i === 1}"><span style="--d:${s.d}px"></span></button>`).join("")}</div>
      <div class="px-row">
        <button type="button" class="px-tool px-eraser" aria-pressed="false">${ICON_ERASER}<span>Gomme</span></button>
        <button type="button" class="px-tool px-undo">${ICON_UNDO}<span>Annuler</span></button>
        <button type="button" class="px-tool px-clear">${ICON_CLEAR}<span>Tout effacer</span></button>
      </div>
    </div>
    <form class="px-guess" hidden autocomplete="off"><input class="px-in" type="text" maxlength="40" placeholder="Ta proposition…" aria-label="Ta proposition" enterkeyhint="send" autocapitalize="off" spellcheck="false"><button class="px-btn" type="submit">Proposer</button></form>
    <div class="px-shout" hidden>Criez aussi vos idées… mais pas trop fort : l'autre équipe a des oreilles !</div>
    <div class="px-msg" aria-live="polite"></div>
    <div class="px-feed" aria-label="Propositions de ton équipe"></div>
    <div class="px-bench"><div class="px-mates"></div><div class="px-back"><div class="bk"><em><span class="px-bn">0</span> <small class="px-bu">trait</small></em><span class="pen">${ICON_PEN}</span></div><b class="px-btn-n"></b><span class="px-bw"></span></div></div>
  </section>
  <section class="px-duo" hidden style="display:flex;flex-direction:column;gap:8px">
    <h2 class="px-dh">Comparez les chefs-d'œuvre</h2>
    <div class="px-reveal" aria-live="polite"></div>
    <div class="px-pair">
      <div class="px-col t0"><div class="tn"></div>${easelHtml("t0", "Dessin de " + esc(TT[0].name))}<div class="by"></div><div class="tm"></div></div>
      <div class="px-col t1"><div class="tn"></div>${easelHtml("t1", "Dessin de " + esc(TT[1].name))}<div class="by"></div><div class="tm"></div></div>
    </div>
  </section>
  <section class="px-final" hidden></section>
</div></div>`;

    const $ = s => el.querySelector(s);
    const sides = [$(".px-side.t0"), $(".px-side.t1")];
    sides.forEach((sd, t) => { sd.querySelector(".nm").textContent = TT[t].name; });
    const cols = [$(".px-col.t0"), $(".px-col.t1")];
    cols.forEach((c, t) => {
      c.querySelector(".tn").textContent = TT[t].name;
      c.querySelector(".tm").innerHTML = TT[t].keys.map(k => api.avatar(k, {view: "bust"})).join("");
    });
    const mainEasel = $(".px-main");
    if (myTeam === 1) mainEasel.classList.add("t1");
    const back = $(".px-back");
    const oppTeam = myTeam == null ? 1 : 1 - myTeam;
    back.classList.add("t" + oppTeam);
    $(".px-btn-n").textContent = TT[oppTeam].name;
    if (myTeam != null) $(".px-guess").style.setProperty("--tc", TT[myTeam].color);

    /* ---------- tableaux (canvas) ----------
       chunk = [id, trait, couleur(0..9, 10 = gomme), taille(0..3), x0,y0,x1,y1,…] (grille 0..1000)
       Modèles par « round:siège du dessinateur ». m.gen change quand il faut tout redessiner. */
    const models = {};
    function model(id) {
      if (!models[id]) models[id] = {ch: new Map(), k: 0, u: new Set(), gen: 0, top: 0};
      return models[id];
    }
    function applyDrawInput(seat, inp) {
      if (!inp || typeof inp.t !== "number" || !Array.isArray(inp.c)) return null;
      const id = inp.t + ":" + seat, m = model(id);
      let touched = false;
      const k = inp.k | 0;
      if (k !== m.k) { m.k = k; m.gen++; touched = true; }
      if (Array.isArray(inp.u)) for (const s of inp.u) if (!m.u.has(s)) { m.u.add(s); m.gen++; touched = true; }
      for (const c of inp.c) {
        if (!Array.isArray(c) || c.length < 6) continue;
        const cid = c[0] | 0, have = m.ch.get(cid), n = c.length - 4;
        if (have && have.p.length >= n) continue;
        m.ch.set(cid, {s: c[1] | 0, c: Math.min(10, Math.max(0, c[2] | 0)), z: Math.min(3, Math.max(0, c[3] | 0)), p: c.slice(4)});
        if (cid < m.top) m.gen++; else m.top = cid;
        touched = true;
      }
      return touched ? id : null;
    }
    const visible = (m, ch) => ch.s > m.k && !m.u.has(ch.s);
    function strokeCount(m) { if (!m) return 0; const s = new Set(); for (const ch of m.ch.values()) if (visible(m, ch)) s.add(ch.s); return s.size; }
    function drawChunk(c, ch, W, H) {
      const p = ch.p, col = ch.c === ERASER ? PAPER : COLORS[ch.c].c, lw = Math.max(1, SIZES[ch.z].v * W);
      const X = i => p[i] / 1000 * W, Y = i => p[i + 1] / 1000 * H;
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
      const n = p.length / 2 | 0;
      if (n < 1) return;
      if (n === 1 || (n === 2 && p[0] === p[2] && p[1] === p[3])) { c.beginPath(); c.arc(X(0), Y(0), lw / 2, 0, Math.PI * 2); c.fill(); return; }
      c.beginPath(); c.moveTo(X(0), Y(0));
      if (n === 2) { c.lineTo(X(2), Y(2)); c.stroke(); return; }
      for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(X(i * 2), Y(i * 2), (X(i * 2) + X(i * 2 + 2)) / 2, (Y(i * 2) + Y(i * 2 + 2)) / 2);
      c.lineTo(X((n - 1) * 2), Y((n - 1) * 2)); c.stroke();
    }
    function paintModel(c, W, H, m) {
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      if (!m) return;
      const ids = [...m.ch.keys()].sort((a, b) => a - b);
      for (const id of ids) { const ch = m.ch.get(id); if (visible(m, ch)) drawChunk(c, ch, W, H); }
    }
    // Un tableau = canvas affiché + calque hors écran (tous les morceaux sauf le plus récent, qui peut encore grandir).
    function makeBoard(easel) {
      const paper = easel.querySelector(".px-paper"), cv = easel.querySelector("canvas");
      const base = document.createElement("canvas");
      return {paper, cv, cx: cv.getContext("2d"), base, bx: base.getContext("2d"), over: easel.querySelector(".px-over"), mid: null, rmid: null, gen: -1, done: 0, overHtml: ""};
    }
    const mainB = makeBoard(mainEasel);
    const duoB = [makeBoard(cols[0]), makeBoard(cols[1])];
    const boards = [mainB, duoB[0], duoB[1]];
    function drawBoard(b) {
      const W = b.cv.width, H = b.cv.height;
      if (!W || b.paper.offsetParent === null) return;
      const m = b.mid ? models[b.mid] : null;
      if (!m) { b.cx.fillStyle = PAPER; b.cx.fillRect(0, 0, W, H); b.rmid = null; return; }
      if (b.base.width !== W || b.base.height !== H) { b.base.width = W; b.base.height = H; b.rmid = null; }
      const ids = [...m.ch.keys()].sort((a, b2) => a - b2), top = ids.length ? ids[ids.length - 1] : 0;
      if (b.rmid !== b.mid || b.gen !== m.gen) {
        b.bx.fillStyle = PAPER; b.bx.fillRect(0, 0, W, H);
        b.done = 0; b.gen = m.gen; b.rmid = b.mid;
      }
      for (const id of ids) {
        if (id <= b.done || id >= top) continue;
        const ch = m.ch.get(id); if (visible(m, ch)) drawChunk(b.bx, ch, W, H);
      }
      b.done = Math.max(b.done, top - 1);
      b.cx.drawImage(b.base, 0, 0);
      const last = m.ch.get(top);
      if (last && visible(m, last)) drawChunk(b.cx, last, W, H);
    }
    let rafId = 0;
    function scheduleDraw() { if (!rafId && !dead) rafId = requestAnimationFrame(drawNow); }
    function drawNow() { rafId = 0; if (dead) return; boards.forEach(drawBoard); }
    function resizeBoards() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const b of boards) {
        const r = b.paper.getBoundingClientRect();
        if (!r.width) continue;
        const w = Math.round(b.paper.clientWidth * dpr), h = Math.round(b.paper.clientHeight * dpr);
        if (b.cv.width !== w || b.cv.height !== h) { b.cv.width = w; b.cv.height = h; b.rmid = null; }
      }
      scheduleDraw();
    }
    const ro = window.ResizeObserver ? new ResizeObserver(resizeBoards) : null;
    if (ro) boards.forEach(b => ro.observe(b.paper));
    window.addEventListener("resize", resizeBoards);

    /* ---------- état client ---------- */
    let cur = null, mySeq = 0, inflight = 0;
    const queue = [];
    let lastSentGuess = "", lastPr = 0, lastPhase = "", lastTurn = -2, lastSec = -1, feedHtml = "", benchKey = "", revealKey = "", lastSc = [0, 0];
    function pump() {
      if (!cur || mySeat < 0) return;
      if (inflight && (cur.ak[mySeat] || 0) < inflight) return;
      inflight = 0;
      if (!queue.length) return;
      const job = queue.shift();
      inflight = ++mySeq;
      lastSentGuess = job.g;
      api.setInput({seq: inflight, g: job.g});
    }

    /* ---------- dessinateur ---------- */
    const tool = {c: 0, z: 1, erase: false};
    let dTurn = -1, nextSid = 0, nextCid = 0, myChunkIds = [], strokeOrder = [], clearStack = [], active = null;
    const myMid = () => dTurn + ":" + mySeat;
    function canDraw() { return cur && cur.ph === "draw" && myTeam != null && cur.d[myTeam] === mySeat && dTurn === cur.r; }
    function resetDrawer(t) {
      dTurn = t; nextSid = 0; nextCid = 0; myChunkIds = []; strokeOrder = []; clearStack = []; active = null;
      delete models[myMid()]; model(myMid());
      tool.c = 0; tool.z = 1; tool.erase = false; syncTools();
    }
    let pushTimer = 0, lastPush = 0;
    function pushDraw(now) {
      if (dTurn < 0) return;
      const t = performance.now();
      if (!now && t - lastPush < 50) { if (!pushTimer) pushTimer = later(() => { pushTimer = 0; pushDraw(true); }, 50 - (t - lastPush)); return; }
      lastPush = t;
      const m = model(myMid());
      const inp = {seq: mySeq, t: dTurn, k: m.k, u: [...m.u].slice(-MAX_UNDO_SENT), c: []};
      let size = JSON.stringify(inp).length;
      for (let i = myChunkIds.length - 1; i >= 0; i--) {
        const id = myChunkIds[i], ch = m.ch.get(id);
        const arr = [id, ch.s, ch.c, ch.z].concat(ch.p);
        const add = JSON.stringify(arr).length + 1;
        if (size + add > INPUT_BUDGET) break;
        size += add; inp.c.unshift(arr);
      }
      api.setInput(inp);
    }
    const cv = mainB.cv;
    function q(e) {
      const r = cv.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) / r.width * 1000), y = Math.round((e.clientY - r.top) / r.height * 1000);
      return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
    }
    function newChunk(sid, pts) {
      const m = model(myMid()), id = ++nextCid;
      m.ch.set(id, {s: sid, c: tool.erase ? ERASER : tool.c, z: tool.z, p: pts});
      m.top = id;
      myChunkIds.push(id);
      if (myChunkIds.length > 400) myChunkIds.splice(0, 100);
      return id;
    }
    function onDown(e) {
      ensureAudio();
      if (!canDraw() || active) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      const sid = ++nextSid;
      strokeOrder.push(sid);
      active = {pid: e.pointerId, sid, cid: newChunk(sid, q(e))};
      scheduleDraw(); pushDraw(); syncTools();
    }
    function onMove(e) {
      if (!active || e.pointerId !== active.pid) return;
      e.preventDefault();
      const m = model(myMid());
      let evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      if (!evs.length) evs = [e];
      let changed = false;
      for (const ev of evs) {
        const pt = q(ev), ch = m.ch.get(active.cid), p = ch.p;
        const lx = p[p.length - 2], ly = p[p.length - 1];
        if (Math.hypot(pt[0] - lx, (pt[1] - ly) * 0.75) < 4) continue;
        if (p.length / 2 >= CHUNK_PTS) active.cid = newChunk(active.sid, [lx, ly, pt[0], pt[1]]);
        else p.push(pt[0], pt[1]);
        changed = true;
      }
      if (changed) { scheduleDraw(); pushDraw(); }
    }
    function onUp(e) {
      if (!active || (e && e.pointerId !== active.pid)) return;
      active = null; pushDraw(true); syncTools();
    }
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("lostpointercapture", onUp);
    cv.addEventListener("contextmenu", e => e.preventDefault());
    function visibleStrokes() { const m = model(myMid()); return strokeOrder.filter(s => s > m.k && !m.u.has(s)); }
    function undo() {
      if (!canDraw() || active) return;
      const m = model(myMid()), vis = visibleStrokes();
      if (vis.length) m.u.add(vis[vis.length - 1]);
      else if (clearStack.length) m.k = clearStack.pop();
      else return;
      m.gen++; scheduleDraw(); pushDraw(true); syncTools(); sfx.pop();
    }
    function clearAll() {
      if (!canDraw() || active) return;
      const m = model(myMid());
      if (!visibleStrokes().length) return;
      clearStack.push(m.k); m.k = nextSid; m.gen++;
      scheduleDraw(); pushDraw(true); syncTools();
    }
    function syncTools() {
      el.querySelectorAll(".px-tube").forEach(b => b.setAttribute("aria-pressed", String(!tool.erase && +b.dataset.c === tool.c)));
      el.querySelectorAll(".px-size").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.z === tool.z)));
      $(".px-eraser").setAttribute("aria-pressed", String(tool.erase));
      $(".px-sizes").style.setProperty("--cur", tool.erase ? "#f9a8c4" : COLORS[tool.c].c);
      if (dTurn >= 0) {
        $(".px-undo").disabled = !(visibleStrokes().length || clearStack.length);
        $(".px-clear").disabled = !visibleStrokes().length;
      }
    }
    $(".px-tubes").addEventListener("click", e => { const b = e.target.closest(".px-tube"); if (!b) return; tool.c = +b.dataset.c; tool.erase = false; syncTools(); });
    $(".px-sizes").addEventListener("click", e => { const b = e.target.closest(".px-size"); if (!b) return; tool.z = +b.dataset.z; syncTools(); });
    $(".px-eraser").addEventListener("click", () => { tool.erase = !tool.erase; syncTools(); });
    $(".px-undo").addEventListener("click", undo);
    $(".px-clear").addEventListener("click", clearAll);
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z") && canDraw()) { e.preventDefault(); undo(); }
    }
    document.addEventListener("keydown", onKey);

    /* ---------- devineurs ---------- */
    const form = $(".px-guess"), input = $(".px-in");
    function canGuess(s) { return s && s.ph === "draw" && myTeam != null && s.d[myTeam] !== mySeat; }
    form.addEventListener("submit", e => {
      e.preventDefault();
      ensureAudio();
      const g = input.value.trim().slice(0, 40);
      if (!g || !canGuess(cur)) return;
      input.value = "";
      queue.push({g}); pump();
    });
    el.addEventListener("pointerdown", ensureAudio);

    /* ---------- réception des traits ---------- */
    let oppBusyUntil = 0;
    function updateBack() {
      if (!cur || cur.r < 0) return;
      const m = models[cur.r + ":" + cur.d[oppTeam]];
      const nS = strokeCount(m);
      $(".px-bn").textContent = nS; $(".px-bu").textContent = nS > 1 ? "traits" : "trait";
      back.classList.toggle("busy", performance.now() < oppBusyUntil && cur.ph === "draw");
    }
    api.onInputs(map => {
      let touched = false;
      for (const k in map) {
        if (k === api.me) continue;
        const seat = P.findIndex(p => p.key === k);
        if (seat < 0) continue;
        const id = applyDrawInput(seat, map[k]);
        if (!id) continue;
        if (boards.some(b => b.mid === id)) touched = true;
        if (cur && id === cur.r + ":" + cur.d[oppTeam]) { oppBusyUntil = performance.now() + 900; updateBack(); later(updateBack, 1000); }
      }
      if (touched) scheduleDraw();
    });

    /* ---------- rendu ---------- */
    function maskOf(w) {
      return w.split(/\s+/).filter(Boolean).map(t => `<span class="w">${esc(t.replace(/[\p{L}\p{N}]/gu, "_"))}</span>`).join("");
    }
    const conn = s => new Set(s.cn || []);
    function setOver(b, html) {
      b.over.hidden = !html;
      if (html !== b.overHtml) { b.overHtml = html; b.over.innerHTML = html; }
    }
    function poster(s) {
      const d0 = s.d[0], d1 = s.d[1];
      const iDraw = myTeam != null && s.d[myTeam] === mySeat;
      const sub = myTeam == null ? "Même mot, deux pinceaux." : iDraw ? "Lis ton mot ! Ton équipe compte sur toi." : `${esc(nameOf(s.d[myTeam]))} dessine pour vous. Prêts à deviner ?`;
      return `<div class="px-poster" style="--tc:${myTeam == null ? "var(--gold)" : TT[myTeam].color}"><small>${s.r + 1 === s.n ? "DERNIER" : ""} ROUND</small><b>${s.r + 1}</b><div class="vs"><span class="r0">${esc(nameOf(d0))}</span><i>VS</i><span class="r1">${esc(nameOf(d1))}</span></div><p>${sub}</p></div>`;
    }
    function render(s) {
      cur = s;
      const word = dec(s.w);
      const turnChanged = s.r !== lastTurn, phaseChanged = s.ph !== lastPhase;
      const iDraw = myTeam != null && s.r >= 0 && s.d[myTeam] === mySeat;
      if (turnChanged && s.r >= 0) {
        if (iDraw) resetDrawer(s.r); else dTurn = -1;
        input.value = ""; feedHtml = "";
        lastPr = mySeat >= 0 ? s.pr[mySeat] || 0 : 0;
        $(".px-msg").textContent = "";
      }
      pump();
      // en-tête
      [0, 1].forEach(t => {
        const pt = sides[t].querySelector(".pt");
        if (pt.textContent !== String(s.sc[t])) { pt.textContent = s.sc[t]; if (s.sc[t] > lastSc[t]) { pt.classList.remove("bump"); void pt.offsetWidth; pt.classList.add("bump"); } }
      });
      lastSc = s.sc.slice();
      $(".px-rn").textContent = Math.max(1, Math.min(s.n, s.r + 1));
      $(".px-rof").textContent = "/ " + s.n;
      const solo = $(".px-solo"), duo = $(".px-duo"), fin = $(".px-final");
      if (s.ph === "end") {
        if (phaseChanged) { solo.hidden = true; duo.hidden = true; $(".px-timer").hidden = true; fin.hidden = false; renderFinal(s); }
        lastPhase = s.ph; lastTurn = s.r;
        return;
      }
      if (s.r < 0) { lastPhase = s.ph; return; }
      // chrono
      const total = s.tt || 60, left = s.ph === "draw" ? s.l : s.ph === "pre" ? total : 0;
      $(".px-sec").textContent = s.ph === "rv" ? "Fin du round" : left + " s";
      $(".px-bar").style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
      $(".px-timer").classList.toggle("hurry", s.ph === "draw" && left <= 10);
      if (s.ph === "draw" && left !== lastSec && left <= 5 && left > 0) sfx.tick(left <= 3);
      lastSec = left;

      const showDuo = s.ph === "rv" || myTeam == null;
      solo.hidden = showDuo; duo.hidden = !showDuo;
      mainB.mid = myTeam != null ? s.r + ":" + s.d[myTeam] : null;
      duoB[0].mid = s.r + ":" + s.d[0]; duoB[1].mid = s.r + ":" + s.d[1];
      const cs = conn(s);

      if (!showDuo) {
        // mot secret / indice
        const nGuess = TT[myTeam].seats.filter(i => i !== mySeat && cs.has(i)).length;
        $(".px-note").hidden = !iDraw;
        if (iDraw) {
          $(".px-secret").textContent = word;
          $(".px-nsub").textContent = nGuess ? "Même mot pour l'autre équipe : vite !" : "Personne pour deviner dans ton équipe… dessine pour la gloire !";
        }
        const hint = $(".px-hint");
        hint.hidden = iDraw;
        if (!iDraw) hint.innerHTML = maskOf(word) + `<span class="n">${word.replace(/[^\p{L}\p{N}]/gu, "").length} lettres</span>`;
        $(".px-tray").hidden = !iDraw;
        $(".px-tray").classList.toggle("off", !canDraw());
        mainB.paper.classList.toggle("can", canDraw());
        if (iDraw) syncTools();
        const g = canGuess(s);
        form.hidden = iDraw; $(".px-shout").hidden = iDraw;
        input.disabled = !g; form.querySelector("button").disabled = !g;
        // « presque ! » privé
        const msg = $(".px-msg");
        const pr = mySeat >= 0 ? s.pr[mySeat] || 0 : 0;
        if (pr > lastPr && s.ph === "draw") { msg.innerHTML = `<span class="pill">« ${esc(lastSentGuess)} » : presque !</span>`; sfx.pop(); }
        lastPr = pr;
        if (!cs.has(s.d[myTeam]) && s.ph === "draw") msg.textContent = `${nameOf(s.d[myTeam])} a quitté la partie…`;
        // fil des propositions de MON équipe
        const fh = (s.f[myTeam] || []).map(([i, t]) => `<span><b>${esc(nameOf(i))}</b><s>${esc(t)}</s></span>`).join("");
        if (fh !== feedHtml) { feedHtml = fh; $(".px-feed").innerHTML = fh; }
        // banc d'équipe
        const bk = s.r + "|" + [...cs].join(",");
        if (bk !== benchKey) {
          benchKey = bk;
          $(".px-mates").innerHTML = TT[myTeam].seats.map(i => {
            const dr = i === s.d[myTeam];
            return `<div class="px-mate${cs.has(i) ? "" : " gone"}" style="--tc:${TT[myTeam].color}">${api.avatar(P[i].key, {view: "bust"})}${dr ? `<span class="mk">${ICON_PEN}</span>` : ""}<span>${esc(nameOf(i))}</span><small>${i === mySeat ? "toi · " : ""}${!cs.has(i) ? "parti" : dr ? "dessine" : "devine"}</small></div>`;
          }).join("");
          $(".px-bw").textContent = `${nameOf(s.d[oppTeam])} dessine…`;
        }
        updateBack();
        setOver(mainB, s.ph === "pre" ? poster(s) : "");
      } else {
        $(".px-dh").textContent = s.ph === "rv" ? "Comparez les chefs-d'œuvre" : "En direct des deux chevalets";
        const rk = s.ph + "|" + s.r;
        if (rk !== revealKey) {
          revealKey = rk;
          let html;
          if (s.ph === "rv") {
            const why = s.y === "g" ? `<span style="color:${TT[s.win].color}">${esc(TT[s.win].name)}</span> trouve en premier ! <span style="color:var(--muted)">(${esc(nameOf(s.fd))}, ${s.ft} s)</span>`
              : s.y === "q" ? "Les pinceaux ont quitté la partie…" : s.y === "p" ? "Plus personne pour deviner…" : "Temps écoulé : personne n'a trouvé.";
            html = `<div class="k">Le mot était</div><span class="w"><span>${esc(word)}</span></span><div class="m">${why}</div>`;
          } else html = `<div class="k">Round ${s.r + 1} sur ${s.n}</div><div class="m">Même mot, deux pinceaux : qui trouvera en premier ?</div>`;
          $(".px-reveal").innerHTML = html;
          cols.forEach((c, t) => {
            c.querySelector(".by").innerHTML = `par <i>${esc(nameOf(s.d[t]))}</i>`;
            const old = c.querySelector(".px-ko"); if (old) old.remove();
            if (s.ph === "rv" && s.win === t) c.insertAdjacentHTML("afterbegin", `<span class="px-ko">+1 K.-O. !</span>`);
          });
        }
        setOver(duoB[0], ""); setOver(duoB[1], "");
      }
      // sons
      if (phaseChanged && s.ph === "pre") sfx.pop();
      if (phaseChanged && s.ph === "draw") sfx.gong();
      if (phaseChanged && s.ph === "rv") { if (s.win >= 0 && s.win === myTeam) sfx.win(); else sfx.sad(); }
      lastPhase = s.ph; lastTurn = s.r;
      scheduleDraw();
      later(resizeBoards, 30);
    }

    function renderFinal(s) {
      const fin = $(".px-final");
      const w = s.sc[0] > s.sc[1] ? 0 : s.sc[1] > s.sc[0] ? 1 : -1;
      const champs = w >= 0 ? TT[w].keys : [];
      fin.innerHTML = `<div class="px-belt" style="--wc:${w >= 0 ? TT[w].color : "var(--gold)"}"><small>${w >= 0 ? "CHAMPIONS DU PINCEAU" : "COMBAT ACHARNÉ"}</small><h2>${w >= 0 ? esc(TT[w].name) + " gagne !" : "Match nul !"}</h2><div class="sc"><span class="a">${s.sc[0]}</span><span>–</span><span class="b">${s.sc[1]}</span></div></div>
        ${champs.length ? `<div class="px-champs">${champs.map(k => `<figure>${api.avatar(k, {pose: "flex", view: "bust"})}<figcaption>${esc(api.name(k))}</figcaption></figure>`).join("")}</div>` : ""}
        <h2 class="px-dh">La galerie des équipes</h2>
        <div class="px-gal">${[0, 1].map(t => `<div class="px-gcol t${t}"><h3>${esc(TT[t].name)}</h3>${s.h.map(([r, d0, d1, wd, win]) => {
          const d = t ? d1 : d0;
          return `<figure><canvas width="240" height="180" data-m="${r}:${d}" role="img" aria-label="${esc(wd)} par ${esc(nameOf(d))}"></canvas>${win === t ? `<span class="one">+1</span>` : ""}<figcaption><b>${esc(wd)}</b>par ${esc(nameOf(d))}</figcaption></figure>`;
        }).join("")}</div>`).join("")}</div>`;
      fin.querySelectorAll("canvas[data-m]").forEach(c => paintModel(c.getContext("2d"), c.width, c.height, models[c.dataset.m] || null));
    }
    api.onState(render);

    /* ---------- logique (hôte) ---------- */
    if (api.isHost) {
      const used = new Set(), seen = {}, rot = [0, 0];
      let S = null, word = "", phaseEnd = 0, deadline = 0, finished = false;
      const now = () => performance.now();
      const connSeats = () => { const c = new Set(api.connected()); return P.map((p, i) => i).filter(i => c.has(P[i].key)); };
      const guessers = (t, cs) => TT[t].seats.filter(i => cs.includes(i) && i !== S.d[t]);
      function pick() {
        const src = Math.random() < 0.2 ? ABSURDE : CLASSIC;
        let pool = src.filter(w => !used.has(w));
        if (!pool.length) pool = src.slice();
        const w = pool[Math.floor(Math.random() * pool.length)];
        used.add(w);
        return w;
      }
      function pub() { if (!dead) api.setState(S); }
      function nextDrawer(t, cs) {
        const seats = TT[t].seats;
        for (let k = 0; k < seats.length; k++) {
          const s = seats[(rot[t] + k) % seats.length];
          if (cs.includes(s)) { rot[t] = (rot[t] + k + 1) % seats.length; return s; }
        }
        return -1;
      }
      function nextRound() {
        const cs = connSeats();
        const live = [0, 1].map(t => TT[t].seats.filter(i => cs.includes(i)));
        if (S.r + 1 >= S.n || !live[0].length || !live[1].length || (live[0].length < 2 && live[1].length < 2)) return hostEnd();
        S.r += 1;
        S.d = [nextDrawer(0, cs), nextDrawer(1, cs)];
        word = pick();
        const tt = ROUND_SEC();
        Object.assign(S, {ph: "pre", w: enc(word), win: -1, fd: -1, ft: 0, f: [[], []], l: tt, tt, y: "", cn: cs});
        phaseEnd = now() + PRE_MS();
        pub();
      }
      function endRound(why) {
        if (S.ph !== "draw" && S.ph !== "pre") return;
        S.ph = "rv"; S.y = why; S.l = 0;
        S.h.push([S.r, S.d[0], S.d[1], word, S.win]);
        phaseEnd = now() + REVEAL_MS();
        pub();
      }
      function hostEnd() {
        if (finished) return;
        finished = true;
        S.ph = "end"; S.cn = connSeats();
        pub();
        later(() => {
          const [a, b] = S.sc;
          const w = a > b ? 0 : b > a ? 1 : -1;
          const res = w >= 0
            ? {winners: TT[w].keys.slice(), ranking: TT[w].keys.concat(TT[1 - w].keys), summary: `${TT[w].name} gagne ${Math.max(a, b)} à ${Math.min(a, b)}`}
            : {winners: [], ranking: TT[0].keys.concat(TT[1].keys), summary: `Match nul ${a} partout entre ${TT[0].name} et ${TT[1].name}`};
          api.finish(res);
        }, END_MS);
      }
      function onHostInputs(map) {
        if (!S || finished) return;
        let changed = false;
        for (let i = 0; i < NP; i++) {
          const inp = map[P[i].key];
          if (!inp || inp.seq == null || inp.seq === seen[i]) continue;
          seen[i] = inp.seq; S.ak[i] = inp.seq; changed = true;
          const t = teamOfSeat[i];
          if (S.ph !== "draw" || typeof inp.g !== "string" || t == null || i === S.d[t]) continue;
          const g = inp.g.trim().slice(0, 40);
          const res = judge(g, word);
          if (res === 2) {
            S.win = t; S.fd = i; S.ft = Math.max(1, Math.round(S.tt - (deadline - now()) / 1000)); S.sc[t] += 1;
            endRound("g");
            return;
          } else if (res === 1) S.pr[i] = (S.pr[i] || 0) + 1;
          else { S.f[t].push([i, g.length > 24 ? g.slice(0, 23) + "…" : g]); while (S.f[t].length > 5) S.f[t].shift(); }
        }
        if (changed) pub();
      }
      function tick() {
        if (!S || finished) return;
        const t = now();
        const cs = connSeats();
        if (cs.join() !== S.cn.join()) { S.cn = cs; pub(); }
        if (S.ph === "pre" || S.ph === "draw") {
          if (!cs.includes(S.d[0]) && !cs.includes(S.d[1])) return endRound("q");
          if (!guessers(0, cs).length && !guessers(1, cs).length) return endRound("p");
        }
        if (S.ph === "pre" && t >= phaseEnd) { S.ph = "draw"; deadline = t + S.tt * 1000; S.l = S.tt; pub(); return; }
        if (S.ph === "draw") {
          const left = Math.max(0, Math.ceil((deadline - t) / 1000));
          if (left !== S.l) { S.l = left; pub(); }
          if (t >= deadline) endRound("t");
          return;
        }
        if (S.ph === "rv" && t >= phaseEnd) nextRound();
      }
      const n = Math.min(8, 2 * Math.max(TT[0].seats.length, TT[1].seats.length));
      S = {ph: "pre", r: -1, n, d: [-1, -1], l: 0, tt: ROUND_SEC(), w: "", sc: [0, 0], win: -1, fd: -1, ft: 0, y: "", f: [[], []], pr: Array(NP).fill(0), ak: Array(NP).fill(0), h: [], cn: []};
      api.onInputs(onHostInputs);
      later(() => { nextRound(); every(tick, 200); }, 600);
    }

    return {
      destroy() {
        dead = true;
        timers.forEach(id => { clearTimeout(id); clearInterval(id); });
        timers.clear();
        if (rafId) cancelAnimationFrame(rafId);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", resizeBoards);
        document.removeEventListener("keydown", onKey);
        if (actx) try { actx.close(); } catch (e) {}
        el.innerHTML = "";
      }
    };
  }
});
