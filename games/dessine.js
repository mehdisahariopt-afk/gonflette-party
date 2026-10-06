/* Gonflette Party : Dessine et devine (2 à 8 joueurs, chacun sur son téléphone).
   Chaque joueur dessine une fois (75 s). Le dessinateur diffuse ses traits par SON entrée (fenêtre glissante
   de morceaux de traits numérotés), que tous les téléphones lisent via api.onInputs. Les autres tapent
   leurs propositions ; l'hôte les compare au mot secret et tient les scores. */
GONFLETTE.registerGame({
  id: "dessine",
  name: "Dessine et devine",
  min: 2,
  max: 8,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, NP = P.length;
    const mySeat = P.findIndex(p => p.key === api.me);
    const dbg = (window.GONFLETTE && GONFLETTE.debug) || {};
    const TURN_SEC = () => Math.max(3, +dbg.ddSeconds || 75);   // dbg.ddSeconds : raccourci de test
    const PRE_MS = 3000, REVEAL_MS = 4000, END_MS = 3500;
    const CHUNK_PTS = 12, INPUT_BUDGET = 2900, MAX_UNDO_SENT = 30;

    /* ---------- Mots (repris de l'original : Grand mélange, Absurde compris) ---------- */
    const WORDS = {
      facile: ["maison", "soleil", "arbre", "chat", "voiture", "fleur", "bateau", "pomme", "lune", "étoile", "nuage", "parapluie", "ballon", "gâteau d'anniversaire", "poisson", "montagne", "vélo", "avion", "clé", "livre", "lunettes", "chapeau", "chaussure", "banane", "escargot", "cœur", "train", "château fort", "fusée", "arc-en-ciel", "bonhomme de neige", "sapin", "glace", "pizza", "téléphone", "horloge", "guitare", "crayon", "ciseaux", "tortue", "papillon", "araignée", "serpent", "couronne", "ancre", "cadeau", "bougie", "champignon", "carotte", "œuf", "pont", "fantôme", "robot", "citrouille", "épée", "phare", "cerf-volant", "toboggan", "dé", "brosse à dents"],
      absurde: ["un pingouin qui fait ses impôts", "une baguette qui fait du ski", "un chat chef d'orchestre", "une girafe dans un ascenseur", "un escargot en trottinette", "un croissant qui fait du yoga", "une vache astronaute", "un requin végétarien", "une pizza en vacances", "un fromage qui pleure", "une tortue pilote de course", "un dinosaure qui tricote", "une licorne au supermarché", "un poulpe qui fait la vaisselle", "un ours en pyjama", "une banane détective", "un cactus qui fait un câlin", "un mouton DJ", "une poule qui passe le bac", "une carotte au tribunal", "un fantôme qui a peur du noir", "une baleine dans une baignoire", "un robot amoureux d'un grille-pain", "un pigeon qui prend le métro", "un camembert qui fait du surf", "une saucisse super-héros", "un éléphant sur un monocycle", "une sardine qui fait de la plongée", "un hamster qui fait de la musculation", "un crocodile chez le dentiste", "une chaussette qui cherche sa jumelle", "un vampire à la plage", "une momie qui se fait bronzer", "un lama coiffeur", "une grenouille en smoking", "un brocoli qui fait de la boxe", "un nuage qui a le rhume", "un chien qui promène son maître", "un escargot qui fait un excès de vitesse", "une patate qui fait un selfie", "un kangourou facteur", "une sirène à la piscine municipale", "un yéti qui a trop chaud", "un poisson rouge qui s'ennuie", "la tour Eiffel qui danse", "une raclette sur la Lune", "un mammouth au karaoké", "une fourmi qui déménage", "un pirate qui a le mal de mer", "un chevalier qui a peur des poules", "une abeille en retard au travail", "un manchot serveur de café", "une citrouille qui fait du jogging", "un flamant rose qui fait du patin à glace", "un castor architecte", "une pieuvre batteuse", "un panda qui fait la sieste au bureau", "un hibou qui fait une nuit blanche", "une cafetière qui court un marathon", "un kiwi qui saute en parachute", "une crêpe qui fait du trampoline", "un gorille en tutu", "un aspirateur qui a faim", "un bonhomme de neige au sauna", "une moustache qui s'envole", "un dragon qui éteint des bougies", "un hérisson qui gonfle un ballon", "un sapin de Noël à la plage"],
      objets: ["table", "chaise", "lampe", "fourchette", "cuillère", "tasse", "bouteille", "réveil", "télévision", "ordinateur", "clavier", "souris d'ordinateur", "casque audio", "appareil photo", "valise", "sac à dos", "ventilateur", "aspirateur", "réfrigérateur", "grille-pain", "bouilloire", "poêle", "casserole", "marteau", "tournevis", "scie", "échelle", "brouette", "arrosoir", "balai", "seau", "peigne", "miroir", "savon", "oreiller", "canapé", "cadenas", "enveloppe", "trombone", "agrafeuse", "règle", "gomme", "taille-crayon", "calculatrice", "boussole", "jumelles", "loupe", "sablier", "trottinette", "skateboard", "hamac", "tente", "lave-linge", "micro-ondes", "télécommande", "pince à linge", "tire-bouchon", "passoire", "fer à repasser", "baignoire"],
      animaux: ["chien", "cheval", "vache", "cochon", "mouton", "chèvre", "lapin", "souris", "hérisson", "écureuil", "renard", "loup", "ours", "lion", "tigre", "éléphant", "girafe", "zèbre", "hippopotame", "rhinocéros", "crocodile", "singe", "gorille", "kangourou", "koala", "panda", "pingouin", "phoque", "baleine", "dauphin", "requin", "pieuvre", "méduse", "crabe", "homard", "étoile de mer", "hibou", "aigle", "perroquet", "flamant rose", "autruche", "paon", "canard", "poule", "coq", "cygne", "chauve-souris", "abeille", "fourmi", "coccinelle", "libellule", "grenouille", "caméléon", "chameau", "lama", "castor", "taupe", "paresseux", "morse", "toucan"],
      metiers: ["pompier", "policier", "médecin", "infirmière", "dentiste", "vétérinaire", "boulanger", "boucher", "cuisinier", "serveur", "coiffeur", "facteur", "plombier", "électricien", "menuisier", "maçon", "jardinier", "agriculteur", "pêcheur", "astronaute", "pilote d'avion", "chauffeur de bus", "mécanicien", "professeur", "chanteur", "musicien", "peintre", "photographe", "journaliste", "magicien", "clown", "jongleur", "acrobate", "danseuse étoile", "footballeur", "arbitre", "juge", "architecte", "chirurgien", "pharmacien", "bibliothécaire", "caissière", "déménageur", "laveur de vitres", "ramoneur", "apiculteur", "berger", "maître-nageur", "plongeur", "détective", "scientifique", "archéologue", "dompteur de lions", "présentateur météo", "fleuriste", "cordonnier", "horloger", "chef d'orchestre", "sculpteur", "explorateur"],
      films: ["Le Roi Lion", "La Reine des neiges", "Toy Story", "Le Monde de Nemo", "Shrek", "Ratatouille", "Cendrillon", "Blanche-Neige", "La Belle et la Bête", "Aladdin", "Le Livre de la jungle", "Peter Pan", "Pinocchio", "Dumbo", "Bambi", "Les 101 Dalmatiens", "Astérix et Obélix", "Tintin et Milou", "Spider-Man", "Batman", "Superman", "Harry Potter", "Star Wars", "Dark Vador", "Titanic", "Jurassic Park", "King Kong", "Godzilla", "E.T. l'extra-terrestre", "Les Dents de la mer", "SOS Fantômes", "Retour vers le futur", "Indiana Jones", "Le Seigneur des anneaux", "Gandalf", "Mickey", "Donald", "Bob l'éponge", "Pikachu", "Super Mario", "Sonic", "Les Schtroumpfs", "Lucky Luke", "Le Petit Prince", "Kirikou", "Les Minions", "Cars", "Là-haut", "Wall-E", "Vice-Versa", "Coco", "Zootopie", "Madagascar", "L'Âge de glace", "Kung Fu Panda", "Dragons", "Les Indestructibles", "Monstres et Cie", "Hulk", "Wonder Woman", "Frankenstein", "Dracula", "Sherlock Holmes", "Zorro", "Robin des Bois", "Garfield", "Scooby-Doo", "Winnie l'ourson", "Babar", "Barbapapa", "Le Magicien d'Oz", "Mary Poppins", "Charlie et la chocolaterie", "Hôtel Transylvanie", "Le Chat Potté", "La Petite Sirène", "Les Tortues Ninja", "Pac-Man", "Le Grinch", "Casper"]
    };
    const MIX = (() => { const seen = new Set(), out = []; for (const k in WORDS) for (const w of WORDS[k]) { const key = w.toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(w); } } return out; })();

    const COLORS = [
      {n: "Noir de fusain", c: "#1f1a17"}, {n: "Rouge vermillon", c: "#d62828"}, {n: "Orange", c: "#f77f00"},
      {n: "Jaune de cadmium", c: "#f6c343"}, {n: "Vert prairie", c: "#2a9d43"}, {n: "Bleu ciel", c: "#38bdf8"},
      {n: "Bleu outremer", c: "#1d4ed8"}, {n: "Violet", c: "#7b2cbf"}, {n: "Rose bonbon", c: "#f472b6"}, {n: "Terre de Sienne", c: "#8b5a2b"}
    ];
    const ERASER = 10;
    const SIZES = [{n: "Fin", v: 0.004, d: 4}, {n: "Moyen", v: 0.009, d: 9}, {n: "Épais", v: 0.018, d: 15}, {n: "Très épais", v: 0.036, d: 24}];
    const PAPER = "#fffdf6";
    const TECH = ["Doigt fébrile sur écran", "Gribouillis sous pression", "Technique mixte, panique et sueur", "Feutre imaginaire",
      "Pastel chronométré", "Art brut, très brut", "Huile de coude sur toile numérique", "Pouce sur verre trempé"];

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
    // 2 = trouvé, 1 = presque, 0 = raté
    function judge(guess, word) {
      let gt = tokens(guess), wt = tokens(word);
      if (!wt.length || !gt.length) { gt = tokens(guess, true); wt = tokens(word, true); }   // « dé », « de » …
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
      go() { tone(392, 0, 0.12, "triangle", 0.12); tone(587.3, 0.11, 0.22, "triangle", 0.12); }
    };

    /* ---------- interface ---------- */
    const ICON_ERASER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15l8-8 8 8-5 5H8z" fill="#f9a8c4" stroke="#2b2118" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 11l8 8" stroke="#2b2118" stroke-width="1.8"/><path d="M11 7l4-4 8 8-4 4" fill="#93c5fd" stroke="#2b2118" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    const ICON_UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
    const ICON_CLEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
    const ICON_PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L16 4.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="#f6c343" stroke="#2b2118" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20l1.2-4.6 3.4 3.4z" fill="#2b2118"/></svg>';

    el.innerHTML = `<style>
.dd{--wall:#f1e7d3;--ink:#2b2118;--ink-soft:#5c4a3a;--paper:#fffdf6;--kraft:#c99f68;--wood:#a4693a;--wood-dark:#5e3a1b;--accent:#e0482a;--accent-dark:#a92f17;--blue:#1d4ed8;--yellow:#f6c343;--green:#23853a;--museum:#5a1a24;--gold-text:#f3d27a;
  --f-d:"Anton","Impact","Arial Narrow",sans-serif;--f-ui:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;--f-s:"Pacifico","Brush Script MT","Segoe Print",cursive;
  min-height:100%;color:var(--ink);font-family:var(--f-ui);font-size:17px;line-height:1.25;color-scheme:light;
  background-color:var(--wall);background-image:radial-gradient(900px 400px at 50% -10%,rgba(255,250,238,.9),transparent 70%),radial-gradient(circle at 8% 92%,rgba(224,72,42,.08) 0 90px,transparent 91px),radial-gradient(circle at 96% 24%,rgba(29,78,216,.06) 0 110px,transparent 111px),repeating-linear-gradient(0deg,rgba(120,90,50,.025) 0 1px,transparent 1px 4px)}
.dd *,.dd *::before,.dd *::after{box-sizing:border-box}
.dd [hidden]{display:none!important}
.dd button{font:inherit;color:inherit;cursor:pointer}
.dd-wrap{max-width:560px;margin:0 auto;padding:10px 16px 28px;display:flex;flex-direction:column;gap:10px}
.dd-top{display:flex;align-items:center;gap:10px}
.dd-turn{flex:1;min-width:0;line-height:1.05}
.dd-turn small{display:inline-block;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:.78rem;color:var(--ink-soft);background:var(--paper);border:2px dashed var(--ink-soft);padding:1px 9px;border-radius:999px}
.dd-turn div{font-size:1.15rem;font-weight:700;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-turn b{font-family:var(--f-s);font-weight:400;color:var(--accent);font-size:1.25rem}
.dd-timer{position:relative;width:58px;height:58px;flex:none}
.dd-timer svg{width:100%;height:100%;display:block;transform:rotate(-90deg)}
.dd-timer .bg{fill:var(--paper);stroke:#ecdcbc;stroke-width:6}
.dd-timer .pr{fill:none;stroke:var(--blue);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .9s linear,stroke .3s}
.dd-timer span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-d);font-size:1.45rem}
.dd-timer.hurry .pr{stroke:var(--accent)}.dd-timer.hurry span{color:var(--accent-dark);animation:dd-pulse 1s ease-in-out infinite}
@keyframes dd-pulse{50%{transform:scale(1.15)}}
.dd-note{position:relative;margin:8px 4px 2px;padding:16px 14px 10px;background:#fde68a;background-image:linear-gradient(180deg,rgba(255,255,255,.35),transparent 30%);box-shadow:0 12px 18px -12px rgba(80,50,10,.55);transform:rotate(-1deg);border-radius:2px 2px 14px 2px;display:flex;align-items:center;gap:10px}
.dd-note::before{content:"";position:absolute;top:-11px;left:50%;width:90px;height:22px;transform:translateX(-50%) rotate(3deg);background:rgba(196,230,255,.75);box-shadow:0 1px 2px rgba(0,0,0,.15)}
.dd-note .lbl{display:block;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.72rem;color:#7a5a00}
.dd-note .sec{display:block;font-family:var(--f-s);font-size:1.45rem;line-height:1.25;overflow-wrap:anywhere}
.dd-note>div{flex:1;min-width:0}
.dd-skip{flex:none;min-height:40px;padding:4px 10px;border:2px dashed var(--ink);border-radius:12px;background:rgba(255,253,246,.6);font-weight:800;font-size:.9rem;line-height:1.05}
.dd-skip:disabled{opacity:.4;cursor:default}
.dd-hint{text-align:center;min-height:2em;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 14px;padding:2px 4px}
.dd-hint .w{font-family:var(--f-d);letter-spacing:.18em;font-size:1.2rem;white-space:nowrap}
.dd-hint .n{font-weight:700;color:var(--ink-soft);font-size:.9rem;letter-spacing:0}
.dd-board{position:relative;padding:12px 10px 12px;border-radius:10px;background-color:var(--wood);background-image:repeating-linear-gradient(91deg,rgba(60,30,10,.08) 0 2px,transparent 2px 7px,rgba(255,220,170,.06) 7px 9px,transparent 9px 15px),linear-gradient(180deg,#b77b47,#8e5a2d);box-shadow:inset 0 0 0 2px rgba(60,30,10,.35),0 14px 22px -14px rgba(50,25,5,.7)}
.dd-sheet{position:relative;padding-top:18px;background:var(--paper);border-radius:3px;box-shadow:0 6px 12px rgba(40,20,0,.45)}
.dd-spiral{position:absolute;top:-10px;left:14px;right:14px;height:26px;display:flex;justify-content:space-between;pointer-events:none;z-index:2}
.dd-ring{width:7px;height:24px;border-radius:5px;background:linear-gradient(90deg,#4f4f4f,#ececec 45%,#8a8a8a);box-shadow:1px 2px 2px rgba(0,0,0,.35)}
.dd-paper{position:relative;width:100%;aspect-ratio:4/3;background:var(--paper);overflow:hidden}
.dd-paper canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none}
.dd-paper.can canvas{cursor:crosshair}
.dd-over{position:absolute;inset:0;display:grid;place-items:center;padding:10px;background:rgba(255,253,246,.72);text-align:center;animation:dd-in .3s ease both}
.dd-over .card{max-width:92%;background:var(--paper);border:3px solid var(--ink);border-radius:14px 18px 12px 20px;box-shadow:4px 4px 0 var(--ink);padding:10px 14px}
.dd-over .k{font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:.8rem;color:var(--ink-soft)}
.dd-over .w{display:block;font-family:var(--f-s);font-size:1.6rem;line-height:1.25;overflow-wrap:anywhere}
.dd-over .w span{background:linear-gradient(transparent 60%,rgba(246,195,67,.7) 60% 92%,transparent 92%);padding:0 4px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.dd-over .m{font-weight:700;font-size:1rem;margin-top:4px}
.dd-gains{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:6px}
.dd-gains span{background:var(--green);color:#fffbea;border-radius:999px;padding:1px 9px;font-weight:800;font-size:.85rem}
@keyframes dd-in{from{opacity:0;transform:scale(.96)}}
.dd-tray{display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 8px 12px;margin-top:-4px;background-color:#b57a45;background-image:repeating-linear-gradient(90deg,rgba(60,30,10,.07) 0 2px,transparent 2px 10px),linear-gradient(180deg,#c99159,#9c6333);border-radius:6px 6px 26px 26px/6px 6px 18px 18px;box-shadow:inset 0 10px 12px -8px rgba(40,20,0,.55),0 10px 16px -12px rgba(50,25,5,.7)}
.dd-tray.off{opacity:.55;pointer-events:none}
.dd-row{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:flex-end}
.dd-tubes{gap:3px;padding-top:12px}
.dd-tube{position:relative;width:29px;height:62px;padding:0;border:none;background:none;transition:transform .15s ease;border-radius:4px;flex:none}
.dd-tube .cap{position:absolute;top:0;left:8px;width:13px;height:10px;border-radius:2px 2px 1px 1px;background:linear-gradient(90deg,#555,#e2e2e2 50%,#6b6b6b)}
.dd-tube .neck{position:absolute;top:9px;left:4px;right:4px;height:7px;background:linear-gradient(90deg,#8d8d8d,#f3f3f3 50%,#9a9a9a);clip-path:polygon(22% 0,78% 0,100% 100%,0 100%)}
.dd-tube .body{position:absolute;top:15px;left:2px;right:2px;bottom:0;background-color:var(--c);border-radius:4px 4px 1px 1px;background-image:linear-gradient(90deg,rgba(255,255,255,.4),transparent 35%,transparent 70%,rgba(0,0,0,.25)),linear-gradient(180deg,transparent 34%,rgba(255,253,246,.92) 34% 60%,transparent 60%)}
.dd-tube .body::before{content:"";position:absolute;left:3px;right:3px;top:43%;height:5px;background:var(--c);border-radius:2px}
.dd-tube .body::after{content:"";position:absolute;left:-1px;right:-1px;bottom:0;height:6px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.35) 0 2px,rgba(255,255,255,.25) 2px 4px)}
.dd-tube[aria-pressed="true"]{transform:translateY(-10px) rotate(-6deg);filter:drop-shadow(0 6px 0 rgba(40,20,0,.35))}
.dd-tube[aria-pressed="true"]::after{content:"";position:absolute;bottom:-8px;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px #fff8ee}
.dd-size{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;padding:0;background:var(--paper);border:2px solid var(--wood-dark);box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.dd-size span{display:block;width:var(--d);height:var(--d);border-radius:50%;background:var(--cur,#1f1a17)}
.dd-size[aria-pressed="true"]{background:var(--yellow);border-color:var(--ink);box-shadow:0 0 0 3px #fff8ee}
.dd-tool{display:inline-flex;align-items:center;gap:4px;min-height:42px;padding:0 8px;background:var(--paper);color:var(--ink);border:2px solid var(--wood-dark);border-radius:10px;font-weight:800;font-size:.95rem;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.dd-tool svg{width:20px;height:20px;flex:none}
.dd-tool[aria-pressed="true"]{background:var(--yellow);border-color:var(--ink);box-shadow:0 0 0 3px #fff8ee}
.dd-tool:disabled{opacity:.5;cursor:default}
.dd-guess{display:flex;gap:8px}
.dd-guess input{flex:1;min-width:0;font:inherit;font-size:1.15rem;font-weight:700;padding:9px 12px;border:3px solid var(--ink);border-radius:12px 16px 10px 18px;background:var(--paper);color:var(--ink)}
.dd-guess input:focus{outline:3px solid var(--blue);outline-offset:2px}
.dd-btn{font-family:var(--f-d);font-size:1.1rem;letter-spacing:.03em;text-transform:uppercase;padding:6px 14px;min-height:46px;border:3px solid var(--ink);border-radius:16px 20px 14px 22px/20px 14px 22px 16px;background:var(--accent);color:#fff8ee;box-shadow:3px 3px 0 var(--ink)}
.dd-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.dd-btn:disabled{opacity:.45}
.dd-msg{min-height:1.5em;text-align:center;font-weight:800;font-size:1.05rem}
.dd-msg.hot{color:#9a5b00}.dd-msg.ok{color:var(--green)}
.dd-msg .pill{display:inline-block;background:#fde68a;border:2px solid var(--ink);border-radius:999px;padding:1px 10px;transform:rotate(-2deg)}
.dd-msg.ok .pill{background:var(--green);color:#fffbea}
.dd-cols{display:grid;gap:12px}
.dd-h{margin:0 0 6px;font-weight:800;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#4b3417;text-align:center}
.dd-feed{position:relative;padding:14px 12px 10px;background:var(--paper);border-radius:4px;box-shadow:0 10px 18px -12px rgba(70,45,15,.6);background-image:repeating-linear-gradient(0deg,transparent 0 25px,rgba(29,78,216,.08) 25px 26px)}
.dd-feed ul{list-style:none;margin:0;padding:0;display:grid;gap:3px;min-height:26px}
.dd-feed li{display:flex;gap:6px;align-items:baseline;font-size:1.02rem;line-height:1.2;animation:dd-in .25s ease both;min-width:0}
.dd-feed li b{flex:none;font-weight:800;color:var(--ink-soft)}
.dd-feed li span{min-width:0;overflow-wrap:anywhere;text-decoration:line-through;text-decoration-color:rgba(224,72,42,.6);text-decoration-thickness:2px}
.dd-feed li.ok span{text-decoration:none;color:var(--green);font-weight:800}
.dd-feed .empty{color:var(--ink-soft);font-style:italic;font-size:.95rem}
.dd-side{position:relative;padding:20px 12px 12px;background-color:var(--kraft);background-image:radial-gradient(circle at 20% 15%,rgba(255,255,255,.18),transparent 40%),repeating-linear-gradient(35deg,rgba(90,60,20,.05) 0 2px,transparent 2px 6px);border-radius:4px;box-shadow:0 12px 20px -14px rgba(50,25,5,.8)}
.dd-side::before{content:"";position:absolute;top:6px;left:50%;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff8a73,var(--accent) 55%,var(--accent-dark));box-shadow:0 2px 2px rgba(0,0,0,.35)}
.dd-tags{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 4px}
.dd-tag{position:relative;display:flex;align-items:center;gap:4px;padding:2px 8px 2px 15px;min-height:46px;background:#f3dfb8;border-radius:4px 10px 10px 4px;clip-path:polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%);box-shadow:0 2px 0 rgba(90,60,20,.25);transition:background-color .3s}
.dd-tag::before{content:"";position:absolute;left:8px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--kraft);box-shadow:inset 0 1px 1px rgba(0,0,0,.4)}
.dd-tag .av{width:30px;height:40px;flex:none}
.dd-tag .nm{flex:1;min-width:0;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.05}
.dd-tag .nm small{display:block;font-weight:700;font-size:.75rem;color:var(--ink-soft)}
.dd-tag .pt{font-family:var(--f-d);font-size:1.3rem}
.dd-tag .mk{width:18px;height:18px;flex:none;display:grid;place-items:center}.dd-tag .mk:empty{display:none}
.dd-tag .mk svg{width:18px;height:18px}
.dd-tag.dr{background:#fde68a}
.dd-tag.ok{background:#c9ecc0}
.dd-tag.ok .mk{color:var(--green);font-weight:900;font-size:1.2rem}
.dd-tag.gone{opacity:.45}
.dd-tag .dl{position:absolute;right:6px;top:-2px;font-weight:900;font-size:.75rem;color:var(--green)}
.dd-final{display:flex;flex-direction:column;gap:14px;animation:dd-in .4s ease both}
.dd-final h2{margin:0;text-align:center;font-family:var(--f-s);font-weight:400;font-size:2rem;line-height:1.2;color:var(--ink)}
.dd-final h2 small{display:block;font-family:var(--f-ui);font-size:1rem;font-weight:700;color:var(--ink-soft)}
.dd-chalk{color:#f3f0e4;background-color:#2e3b33;background-image:radial-gradient(ellipse at 20% 30%,rgba(255,255,255,.07),transparent 50%);border:10px solid #8a5a2f;border-radius:6px;box-shadow:inset 0 0 18px rgba(0,0,0,.5);padding:10px 14px}
.dd-chalk h3{margin:0 0 4px;font-family:var(--f-s);font-weight:400;font-size:1.3rem;color:#fff6c9}
.dd-chalk ol{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.dd-chalk li{display:flex;align-items:center;gap:8px;font-size:1.2rem;font-weight:700}
.dd-chalk li .av{width:34px;height:40px;flex:none}
.dd-chalk li .r{font-family:var(--f-d);width:1.4em;color:#fff6c9}
.dd-chalk li .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
.dd-chalk li .dots{flex:1;border-bottom:2px dotted rgba(243,240,228,.45);min-width:10px}
.dd-chalk li .sc{font-family:var(--f-d);font-size:1.3rem}
.dd-museum{border-radius:6px;color:#f6e7c8;padding:14px 12px 22px;background-color:var(--museum);background-image:radial-gradient(ellipse at 50% 0%,rgba(255,220,160,.18),transparent 60%);box-shadow:inset 0 -14px 0 #3f1018,inset 0 -17px 0 #b8913a}
.dd-museum h3{margin:0;text-align:center;font-family:var(--f-s);font-weight:400;font-size:1.5rem;color:var(--gold-text);text-shadow:0 2px 0 #3a0c12}
.dd-museum p{margin:0 0 12px;text-align:center;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#e8c9a0}
.dd-wall{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px}
.dd-art{position:relative;text-align:center;min-width:0}
.dd-gframe{padding:7px;border-radius:2px;background:linear-gradient(135deg,#7a560c 0%,#f7e08a 18%,#c9971f 36%,#fff3b0 52%,#b8860b 70%,#f1d777 85%,#6e4f0b 100%);box-shadow:0 10px 16px -6px rgba(0,0,0,.65)}
.dd-gframe canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;background:var(--paper);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
.dd-plaque{display:inline-block;margin-top:7px;max-width:100%;padding:4px 8px;background:linear-gradient(180deg,#f2df9a,#c9a24a 60%,#a8822f);color:#2f2205;border-radius:3px;box-shadow:0 3px 6px rgba(0,0,0,.5);font-size:.78rem;line-height:1.2}
.dd-plaque b{display:block;font-size:.95rem;overflow-wrap:anywhere}
.dd-plaque i{display:block}
.dd-stamp{position:absolute;top:8px;right:-2px;transform:rotate(12deg);background:var(--accent);color:#fff8ee;font-weight:800;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,.4)}
@media (min-width:700px){.dd-cols{grid-template-columns:1fr 1fr}.dd-wall{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
<div class="dd"><div class="dd-wrap">
  <div class="dd-main">
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="dd-top">
        <div class="dd-turn"><small class="dd-tn">Tour 1/1</small><div class="dd-who"></div></div>
        <div class="dd-timer" role="timer" aria-label="Temps restant"><svg viewBox="0 0 58 58" aria-hidden="true"><circle class="bg" cx="29" cy="29" r="25"/><circle class="pr" cx="29" cy="29" r="25"/></svg><span class="dd-num">75</span></div>
      </div>
      <div class="dd-note" hidden><div><span class="lbl">Ton mot secret</span><span class="sec dd-secret"></span></div><button type="button" class="dd-skip">Passer<br>ce mot</button></div>
      <div class="dd-hint" hidden aria-label="Indice"></div>
      <div class="dd-board"><div class="dd-sheet"><div class="dd-spiral" aria-hidden="true">${"<span class=\"dd-ring\"></span>".repeat(14)}</div>
        <div class="dd-paper"><canvas class="dd-cv" role="img" aria-label="Dessin en direct"></canvas><div class="dd-over" hidden></div></div></div></div>
      <div class="dd-tray" hidden role="toolbar" aria-label="Plumier">
        <div class="dd-row dd-tubes" role="group" aria-label="Couleurs">${COLORS.map((c, i) => `<button type="button" class="dd-tube" style="--c:${c.c}" data-c="${i}" aria-label="${c.n}" title="${c.n}" aria-pressed="${i ? "false" : "true"}"><span class="cap"></span><span class="neck"></span><span class="body"></span></button>`).join("")}</div>
        <div class="dd-row">
          <div class="dd-row dd-sizes" role="group" aria-label="Taille du pinceau">${SIZES.map((s, i) => `<button type="button" class="dd-size" data-z="${i}" aria-label="Pinceau ${s.n.toLowerCase()}" title="Pinceau ${s.n.toLowerCase()}" aria-pressed="${i === 1}"><span style="--d:${s.d}px"></span></button>`).join("")}</div>
        </div>
        <div class="dd-row">
          <button type="button" class="dd-tool dd-eraser" aria-pressed="false">${ICON_ERASER}<span>Gomme</span></button>
          <button type="button" class="dd-tool dd-undo">${ICON_UNDO}<span>Annuler</span></button>
          <button type="button" class="dd-tool dd-clear">${ICON_CLEAR}<span>Tout effacer</span></button>
        </div>
      </div>
      <form class="dd-guess" hidden autocomplete="off"><input class="dd-in" type="text" maxlength="40" placeholder="Ta proposition…" aria-label="Ta proposition" enterkeyhint="send" autocapitalize="off" spellcheck="false"><button class="dd-btn" type="submit">Proposer</button></form>
      <div class="dd-msg" aria-live="polite"></div>
      <div class="dd-cols">
        <section class="dd-feed"><h3 class="dd-h">Mauvaises réponses</h3><ul class="dd-fl"></ul></section>
        <section class="dd-side"><h3 class="dd-h">Les artistes</h3><div class="dd-tags"></div></section>
      </div>
    </div>
  </div>
  <div class="dd-final" hidden></div>
</div></div>`;

    const $ = s => el.querySelector(s);
    const cv = $(".dd-cv"), cx = cv.getContext("2d"), paperEl = $(".dd-paper"), overEl = $(".dd-over");
    const tagsEl = $(".dd-tags");
    const tagEls = P.map((p, i) => {
      const d = document.createElement("div");
      d.className = "dd-tag";
      d.innerHTML = `${api.avatar(p.key)}<span class="nm">${esc(p.pseudo)}<small></small></span><span class="mk"></span><span class="pt">0</span><span class="dl"></span>`;
      tagsEl.appendChild(d);
      return d;
    });
    const CIRC = 2 * Math.PI * 25;
    const prog = $(".dd-timer .pr");
    prog.style.strokeDasharray = CIRC.toFixed(2);

    /* ---------- modèle de dessin, par tour ----------
       chunk = [id, trait, couleur(0..9, 10 = gomme), taille(0..3), x0,y0,x1,y1,…] (grille 0..1000)
       Un morceau suivant d'un même trait recommence par le dernier point du précédent. */
    const models = {};
    function model(t) {
      if (!models[t]) models[t] = {ch: new Map(), k: 0, u: new Set(), full: true, base: 0};
      return models[t];
    }
    function applyDrawInput(inp) {
      if (!inp || typeof inp.t !== "number" || !Array.isArray(inp.c)) return false;
      const m = model(inp.t);
      let touched = false;
      const k = inp.k | 0;
      if (k !== m.k) { m.k = k; m.full = true; touched = true; }
      if (Array.isArray(inp.u)) for (const s of inp.u) if (!m.u.has(s)) { m.u.add(s); m.full = true; touched = true; }
      for (const c of inp.c) {
        if (!Array.isArray(c) || c.length < 6) continue;
        const id = c[0] | 0, have = m.ch.get(id), n = c.length - 4;
        if (have && have.p.length >= n) continue;
        m.ch.set(id, {s: c[1] | 0, c: Math.min(10, Math.max(0, c[2] | 0)), z: Math.min(3, Math.max(0, c[3] | 0)), p: c.slice(4)});
        if (id <= m.base) m.full = true;
        touched = true;
      }
      return touched;
    }
    const visible = (m, ch) => ch.s > m.k && !m.u.has(ch.s);
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
      if (!m) return 0;
      const ids = [...m.ch.keys()].sort((a, b) => a - b);
      for (const id of ids) { const ch = m.ch.get(id); if (visible(m, ch)) drawChunk(c, ch, W, H); }
      return ids.length ? ids[ids.length - 1] : 0;
    }
    // base = calque hors écran avec tous les morceaux sauf le plus récent (qui peut encore grandir) ;
    // l'écran = base + dernier morceau, redessiné à chaque image : rendu identique sur tous les téléphones.
    let shownTurn = -1, renderedTurn = -2, rafId = 0;
    const base = document.createElement("canvas"), bx = base.getContext("2d");
    function scheduleDraw() { if (!rafId && !dead) rafId = requestAnimationFrame(drawNow); }
    function drawNow() {
      rafId = 0;
      if (!cv.width) return;
      const W = cv.width, H = cv.height;
      const m = shownTurn >= 0 ? model(shownTurn) : null;
      if (!m) { cx.fillStyle = PAPER; cx.fillRect(0, 0, W, H); return; }
      const ids = [...m.ch.keys()].sort((a, b) => a - b), top = ids.length ? ids[ids.length - 1] : 0;
      if (base.width !== W || base.height !== H) { base.width = W; base.height = H; m.full = true; }
      if (m.full || renderedTurn !== shownTurn) {
        bx.fillStyle = PAPER; bx.fillRect(0, 0, W, H);
        m.base = 0; m.full = false; renderedTurn = shownTurn;
      }
      for (const id of ids) {
        if (id <= m.base || id >= top) continue;
        const ch = m.ch.get(id); if (visible(m, ch)) drawChunk(bx, ch, W, H);
      }
      m.base = Math.max(m.base, top - 1);
      cx.drawImage(base, 0, 0);
      const last = m.ch.get(top);
      if (last && visible(m, last)) drawChunk(cx, last, W, H);
    }
    function resizeCanvas() {
      const r = paperEl.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; renderedTurn = -2; scheduleDraw(); }
    }
    const ro = window.ResizeObserver ? new ResizeObserver(resizeCanvas) : null;
    if (ro) ro.observe(paperEl);
    window.addEventListener("resize", resizeCanvas);

    /* ---------- état client ---------- */
    let cur = null;                // dernier état reçu
    let mySeq = 0, inflight = 0;   // seq de ma dernière action en attente d'accusé
    const queue = [];
    let myInput = {};
    let overHtml = "", feedHtml = "", lastSentGuess = "", lastPr = 0, lastFoundCount = 0, lastPhase = "", lastTurn = -1, lastSec = -1;

    function pump() {
      if (!cur || mySeat < 0) return;
      if (inflight && (cur.ak[mySeat] || 0) < inflight) return;
      inflight = 0;
      if (!queue.length) return;
      const job = queue.shift();
      inflight = ++mySeq;
      if (job.g != null) { lastSentGuess = job.g; myInput = {seq: inflight, g: job.g}; api.setInput(myInput); }
      else if (job.a && dTurn >= 0) { pendingAction = job.a; pushDraw(true); } else inflight = 0;
    }

    /* ---------- dessinateur ---------- */
    const tool = {c: 0, z: 1, erase: false};
    let pendingAction = "";
    let dTurn = -1, nextSid = 0, nextCid = 0, myChunkIds = [], strokeOrder = [], clearStack = [];
    let active = null;  // {pid, cid, sid}
    function amDrawer() { return cur && mySeat >= 0 && cur.d === mySeat && (cur.ph === "pre" || cur.ph === "draw"); }
    function canDraw() { return cur && cur.ph === "draw" && cur.d === mySeat; }
    function resetDrawer(t) {
      dTurn = t; nextSid = 0; nextCid = 0; myChunkIds = []; strokeOrder = []; clearStack = []; active = null;
      models[t] = null; delete models[t]; model(t);
      tool.c = 0; tool.z = 1; tool.erase = false; syncTools();
    }
    let pushTimer = 0, lastPush = 0;
    function pushDraw(now) {
      if (dTurn < 0) return;
      const t = performance.now();
      if (!now && t - lastPush < 50) { if (!pushTimer) pushTimer = later(() => { pushTimer = 0; pushDraw(true); }, 50 - (t - lastPush)); return; }
      lastPush = t;
      const m = model(dTurn);
      const inp = {seq: mySeq, t: dTurn, k: m.k, u: [...m.u].slice(-MAX_UNDO_SENT), c: []};
      if (pendingAction) inp.a = pendingAction;
      let size = JSON.stringify(inp).length;
      for (let i = myChunkIds.length - 1; i >= 0; i--) {
        const id = myChunkIds[i], ch = m.ch.get(id);
        const arr = [id, ch.s, ch.c, ch.z].concat(ch.p);
        const add = JSON.stringify(arr).length + 1;
        if (size + add > INPUT_BUDGET) break;
        size += add; inp.c.unshift(arr);
      }
      myInput = inp;
      api.setInput(inp);
    }
    function q(e) {
      const r = cv.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) / r.width * 1000), y = Math.round((e.clientY - r.top) / r.height * 1000);
      return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
    }
    function newChunk(sid, pts) {
      const m = model(dTurn), id = ++nextCid;
      m.ch.set(id, {s: sid, c: tool.erase ? ERASER : tool.c, z: tool.z, p: pts});
      myChunkIds.push(id);
      if (myChunkIds.length > 400) myChunkIds.splice(0, 100);
      return id;
    }
    function onDown(e) {
      ensureAudio();
      if (!canDraw() || active || dTurn !== cur.r) return;
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
      const m = model(dTurn);
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
    function visibleStrokes() { const m = model(dTurn); return strokeOrder.filter(s => s > m.k && !m.u.has(s)); }
    function undo() {
      if (!canDraw() || active) return;
      const m = model(dTurn), vis = visibleStrokes();
      if (vis.length) m.u.add(vis[vis.length - 1]);
      else if (clearStack.length) m.k = clearStack.pop();
      else return;
      m.full = true; scheduleDraw(); pushDraw(true); syncTools(); sfx.pop();
    }
    function clearAll(force) {
      if (!force && (!canDraw() || active)) return;
      if (dTurn < 0) return;
      const m = model(dTurn);
      if (!visibleStrokes().length) return;
      clearStack.push(m.k); m.k = nextSid; m.full = true;
      scheduleDraw(); pushDraw(true); syncTools();
    }
    function syncTools() {
      el.querySelectorAll(".dd-tube").forEach(b => b.setAttribute("aria-pressed", String(!tool.erase && +b.dataset.c === tool.c)));
      el.querySelectorAll(".dd-size").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.z === tool.z)));
      $(".dd-eraser").setAttribute("aria-pressed", String(tool.erase));
      $(".dd-sizes").style.setProperty("--cur", tool.erase ? "#f9a8c4" : COLORS[tool.c].c);
      if (dTurn >= 0) {
        $(".dd-undo").disabled = !(visibleStrokes().length || clearStack.length);
        $(".dd-clear").disabled = !visibleStrokes().length;
      }
    }
    $(".dd-tubes").addEventListener("click", e => { const b = e.target.closest(".dd-tube"); if (!b) return; tool.c = +b.dataset.c; tool.erase = false; syncTools(); });
    $(".dd-sizes").addEventListener("click", e => { const b = e.target.closest(".dd-size"); if (!b) return; tool.z = +b.dataset.z; syncTools(); });
    $(".dd-eraser").addEventListener("click", () => { tool.erase = !tool.erase; syncTools(); });
    $(".dd-undo").addEventListener("click", undo);
    $(".dd-clear").addEventListener("click", () => clearAll(false));
    $(".dd-skip").addEventListener("click", () => {
      ensureAudio();
      if (!amDrawer() || cur.sk || queue.some(j => j.a) || pendingAction) return;
      $(".dd-skip").disabled = true;
      queue.push({a: "skip"}); pump();
    });
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z") && canDraw()) { e.preventDefault(); undo(); }
    }
    document.addEventListener("keydown", onKey);

    /* ---------- devineurs ---------- */
    const form = $(".dd-guess"), input = $(".dd-in");
    form.addEventListener("submit", e => {
      e.preventDefault();
      ensureAudio();
      const g = input.value.trim().slice(0, 40);
      if (!g || !cur || cur.ph !== "draw" || mySeat < 0 || cur.d === mySeat || cur.ok.includes(mySeat)) return;
      input.value = "";
      queue.push({g}); pump();
    });
    el.addEventListener("pointerdown", ensureAudio);

    /* ---------- réception ---------- */
    api.onInputs(map => {
      let touched = false;
      for (const k in map) {
        if (k === api.me) continue;
        const inp = map[k];
        if (inp && applyDrawInput(inp) && inp.t === shownTurn) touched = true;
      }
      if (touched) scheduleDraw();
    });

    function maskOf(w) {
      return w.split(/\s+/).filter(Boolean).map(t => `<span class="w">${esc(t.replace(/[\p{L}\p{N}]/gu, "_"))}</span>`).join("");
    }
    function render(s) {
      const prev = cur;
      cur = s;
      const word = dec(s.w);
      const iDraw = s.d === mySeat;
      const phaseChanged = s.ph !== lastPhase, turnChanged = s.r !== lastTurn;
      // nouveau tour
      if (turnChanged && s.r >= 0) {
        if (iDraw) resetDrawer(s.r);
        else { dTurn = -1; }
        shownTurn = s.r; renderedTurn = -2; scheduleDraw();
        lastFoundCount = 0; input.value = "";
      }
      // mot passé : le dessinateur repart d'une feuille blanche
      if (iDraw && prev && prev.r === s.r && s.sk && !prev.sk) { clearAll(true); clearStack = []; syncTools(); }
      if (pendingAction && inflight && (s.ak[mySeat] || 0) >= inflight) { pendingAction = ""; pushDraw(true); }
      pump();

      const main = $(".dd-main"), fin = $(".dd-final");
      if (s.ph === "end") {
        if (phaseChanged) { main.hidden = true; fin.hidden = false; renderFinal(s); }
        lastPhase = s.ph; lastTurn = s.r;
        return;
      }
      main.hidden = false; fin.hidden = true;

      $(".dd-tn").textContent = `Tour ${s.r + 1}/${s.n}`;
      $(".dd-who").innerHTML = iDraw ? `<b>À toi</b> de dessiner !` : `<b>${esc(nameOf(s.d))}</b> dessine`;
      // chrono
      const total = s.tt || 75, left = s.ph === "draw" ? s.l : s.ph === "pre" ? total : 0;
      $(".dd-num").textContent = left;
      prog.style.strokeDashoffset = (CIRC * (1 - Math.max(0, Math.min(1, left / total)))).toFixed(2);
      $(".dd-timer").classList.toggle("hurry", s.ph === "draw" && left <= 10);
      if (s.ph === "draw" && left !== lastSec && left <= 5 && left > 0) sfx.tick(left <= 3);
      lastSec = left;

      // mot secret / indice
      const showNote = iDraw && (s.ph === "pre" || s.ph === "draw");
      $(".dd-note").hidden = !showNote;
      if (showNote) {
        $(".dd-secret").textContent = word;
        $(".dd-skip").disabled = !!s.sk || !!pendingAction;
        $(".dd-skip").innerHTML = s.sk ? "Mot<br>passé" : "Passer<br>ce mot";
      }
      const hint = $(".dd-hint");
      hint.hidden = iDraw || (s.ph !== "pre" && s.ph !== "draw");
      if (!hint.hidden) hint.innerHTML = maskOf(word) + `<span class="n">${word.replace(/[^\p{L}\p{N}]/gu, "").length} lettres</span>`;
      // plumier
      $(".dd-tray").hidden = !iDraw || s.ph === "rv";
      $(".dd-tray").classList.toggle("off", !canDraw());
      paperEl.classList.toggle("can", canDraw());
      if (iDraw) syncTools();
      // proposition
      const found = mySeat >= 0 && s.ok.includes(mySeat);
      const canGuess = mySeat >= 0 && !iDraw && s.ph === "draw" && !found;
      form.hidden = !(mySeat >= 0 && !iDraw && s.ph === "draw");
      input.disabled = !canGuess; form.querySelector("button").disabled = !canGuess;
      if (!canGuess && document.activeElement === input && found) input.blur();
      // messages perso
      const msg = $(".dd-msg");
      const pr = mySeat >= 0 ? s.pr[mySeat] || 0 : 0;
      if (found && s.ph === "draw") { msg.className = "dd-msg ok"; msg.innerHTML = `<span class="pill">Trouvé ! +${s.gn[mySeat]} pts</span>`; }
      else if (turnChanged || s.ph !== "draw") { msg.className = "dd-msg"; msg.textContent = mySeat < 0 ? "Vous regardez en spectateur." : ""; }
      if (pr > lastPr && !turnChanged && s.ph === "draw" && !found) {
        msg.className = "dd-msg hot"; msg.innerHTML = `<span class="pill">« ${esc(lastSentGuess)} » : presque !</span>`;
        sfx.pop();
      }
      lastPr = pr;
      if (prev && prev.r === s.r && s.ok.length > lastFoundCount) {
        if (found && !prev.ok.includes(mySeat)) sfx.win(); else sfx.pop();
      }
      lastFoundCount = s.ok.length;
      if (phaseChanged && s.ph === "draw") sfx.go();
      if (phaseChanged && s.ph === "rv" && !s.ok.length) sfx.sad();
      // calque sur la feuille
      let ov = "";
      if (s.ph === "pre") {
        ov = `<div class="card"><div class="k">Tour ${s.r + 1} sur ${s.n}</div><span class="w">${iDraw ? "À toi de dessiner !" : esc(nameOf(s.d)) + " prend le pinceau…"}</span><div class="m">${iDraw ? "Lis ton mot, ça démarre dans un instant." : "Prépare-toi à deviner !"}</div></div>`;
      } else if (s.ph === "rv") {
        const why = s.y === "a" ? "Tout le monde a trouvé !" : s.y === "q" ? `${esc(nameOf(s.d))} a quitté la partie.` : s.y === "p" ? "Plus assez de joueurs…" : s.ok.length ? "Temps écoulé !" : "Temps écoulé… personne n'a trouvé.";
        const gains = s.gn.map((g, i) => (g ? `<span>${esc(nameOf(i))} +${g}</span>` : "")).join("");
        ov = `<div class="card"><div class="k">C'était</div><span class="w"><span>${esc(word)}</span></span><div class="m">${why}</div>${gains ? `<div class="dd-gains">${gains}</div>` : ""}</div>`;
      }
      overEl.hidden = !ov;
      if (ov !== overHtml) { overHtml = ov; overEl.innerHTML = ov; }
      // fil des mauvaises réponses
      const fl = $(".dd-fl");
      const fh = s.f.length ? s.f.map(([i, t, k]) => k ? `<li class="ok"><b>${esc(nameOf(i))}</b><span>a trouvé !</span></li>` : `<li><b>${esc(nameOf(i))}</b><span>${esc(t)}</span></li>`).join("")
        : `<li class="empty">${s.ph === "draw" ? "Rien pour l'instant…" : "—"}</li>`;
      if (fh !== feedHtml) { feedHtml = fh; fl.innerHTML = fh; }
      // étiquettes de score
      const conn = new Set(s.cn || []);
      const order = P.map((p, i) => i).sort((a, b) => s.sc[b] - s.sc[a] || a - b);
      order.forEach((i, rank) => {
        const t = tagEls[i];
        t.style.order = rank;
        const dr = i === s.d && s.ph !== "end", ok = s.ok.includes(i);
        t.className = "dd-tag" + (dr ? " dr" : "") + (ok ? " ok" : "") + (s.cn && !conn.has(i) ? " gone" : "");
        t.querySelector(".pt").textContent = s.sc[i];
        t.querySelector("small").textContent = dr ? "dessine" : ok ? "a trouvé" : (s.cn && !conn.has(i) ? "parti" : (i === mySeat ? "toi" : ""));
        t.querySelector(".mk").innerHTML = dr ? ICON_PEN : ok ? "✓" : "";
        t.querySelector(".dl").textContent = s.gn[i] ? "+" + s.gn[i] : "";
      });
      lastPhase = s.ph; lastTurn = s.r;
    }

    function renderFinal(s) {
      const fin = $(".dd-final");
      const order = P.map((p, i) => i).sort((a, b) => s.sc[b] - s.sc[a] || a - b);
      const arts = s.h.map(([d, w, f], i) => ({d, w, f, t: i}));
      fin.innerHTML = `<h2>Le grand vernissage<small>Classement final</small></h2>
        <div class="dd-chalk"><h3>Tableau des scores</h3><ol>${order.map((i, r) => `<li><span class="r">${r + 1}</span>${api.avatar(P[i].key, {pose: r === 0 && s.sc[i] > 0 ? "flex" : "idle"})}<span class="nm">${esc(nameOf(i))}</span><span class="dots"></span><span class="sc">${s.sc[i]}</span></li>`).join("")}</ol></div>
        ${arts.length ? `<div class="dd-museum"><h3>Galerie du Louvre</h3><p>Aile des chefs-d'œuvre incompris</p><div class="dd-wall">${arts.map((a, i) => `<figure class="dd-art" style="margin:0"><div class="dd-gframe"><canvas width="320" height="240" data-t="${a.t}"></canvas></div>${a.f < 0 ? `<span class="dd-stamp">Incompris</span>` : ""}<figcaption class="dd-plaque"><b>${esc(a.w)}</b>par ${esc(nameOf(a.d))}<i>${TECH[i % TECH.length]}</i></figcaption></figure>`).join("")}</div></div>` : ""}`;
      fin.querySelectorAll("canvas[data-t]").forEach(c => {
        const t = +c.dataset.t;
        paintModel(c.getContext("2d"), c.width, c.height, models[t] || null);
      });
    }
    api.onState(render);

    /* ---------- logique (hôte) ---------- */
    if (api.isHost) {
      const used = new Set();
      const seen = {};
      let S = null, word = "", nextIdx = 0, phaseEnd = 0, deadline = 0, finished = false;
      const now = () => performance.now();
      const connSeats = () => { const c = new Set(api.connected()); return P.map((p, i) => i).filter(i => c.has(P[i].key)); };
      function pick() {
        let pool = MIX.filter(w => !used.has(w));
        if (!pool.length) { used.clear(); pool = MIX.slice(); }
        const w = pool[Math.floor(Math.random() * pool.length)];
        used.add(w);
        return w;
      }
      function pub() { if (!dead) api.setState(S); }
      function nextTurn() {
        const conn = connSeats();
        if (conn.length < 2) return hostEnd();
        while (nextIdx < NP && !conn.includes(nextIdx)) { nextIdx++; S.n = Math.max(S.r + 1, S.n - 1); }
        if (nextIdx >= NP) return hostEnd();
        S.d = nextIdx++;
        S.r += 1;
        word = pick();
        Object.assign(S, {ph: "pre", w: enc(word), sk: 0, ok: [], gn: Array(NP).fill(0), f: [], l: TURN_SEC(), tt: TURN_SEC(), y: "", cn: conn});
        phaseEnd = now() + PRE_MS;
        pub();
      }
      function endTurn(why) {
        if (S.ph !== "draw" && S.ph !== "pre") return;
        S.ph = "rv"; S.y = why; S.l = 0;
        S.h.push([S.d, word, S.ok.length ? S.ok[0] : -1]);
        phaseEnd = now() + REVEAL_MS;
        pub();
      }
      function hostEnd() {
        if (finished) return;
        finished = true;
        S.ph = "end"; S.cn = connSeats();
        pub();
        later(() => {
          const order = P.map((p, i) => i).sort((a, b) => S.sc[b] - S.sc[a] || a - b);
          const top = S.sc[order[0]];
          const winners = top > 0 ? order.filter(i => S.sc[i] === top) : [];
          const found = S.h.filter(h => h[2] >= 0).length;
          const summary = winners.length === 1
            ? `${nameOf(winners[0])} gagne avec ${top} point${top > 1 ? "s" : ""} : ${found} dessin${found > 1 ? "s" : ""} deviné${found > 1 ? "s" : ""} sur ${S.h.length}.`
            : winners.length ? `Égalité au sommet à ${top} points : ${found} dessin${found > 1 ? "s" : ""} deviné${found > 1 ? "s" : ""} sur ${S.h.length}.`
            : "Personne n'a rien trouvé : la galerie reste incomprise.";
          api.finish({winners: winners.map(i => P[i].key), ranking: order.map(i => P[i].key), summary});
        }, END_MS);
      }
      function allFound() {
        const conn = connSeats().filter(i => i !== S.d);
        return conn.length > 0 && conn.every(i => S.ok.includes(i));
      }
      function onHostInputs(map) {
        if (!S || finished) return;
        let changed = false;
        P.forEach((p, i) => {
          const inp = map[p.key];
          if (!inp || inp.seq == null || inp.seq === seen[i]) return;
          seen[i] = inp.seq; S.ak[i] = inp.seq; changed = true;
          if (i === S.d) {
            if (inp.a === "skip" && !S.sk && (S.ph === "pre" || S.ph === "draw")) { S.sk = 1; word = pick(); S.w = enc(word); }
            return;
          }
          if (S.ph !== "draw" || typeof inp.g !== "string" || S.ok.includes(i)) return;
          const g = inp.g.trim().slice(0, 40);
          const res = judge(g, word);
          if (res === 2) {
            const first = !S.ok.length;
            S.ok.push(i);
            const a = first ? 3 : 1, b = first ? 2 : 1;
            S.sc[i] += a; S.gn[i] += a; S.sc[S.d] += b; S.gn[S.d] += b;
            S.f.push([i, "", 1]);
          } else if (res === 1) S.pr[i] = (S.pr[i] || 0) + 1;
          else S.f.push([i, g.length > 28 ? g.slice(0, 27) + "…" : g, 0]);
          while (S.f.length > 6) S.f.shift();
        });
        if (!changed) return;
        if (S.ph === "draw" && allFound()) endTurn("a"); else pub();
      }
      function tick() {
        if (!S || finished) return;
        const t = now();
        const conn = connSeats();
        if (conn.length !== S.cn.length) { S.cn = conn; pub(); }
        if (S.ph === "pre" || S.ph === "draw") {
          if (!conn.includes(S.d)) return endTurn("q");
          if (conn.length < 2) { endTurn("p"); return; }
        }
        if (S.ph === "pre" && t >= phaseEnd) { S.ph = "draw"; deadline = t + S.tt * 1000; S.l = S.tt; pub(); return; }
        if (S.ph === "draw") {
          if (allFound()) return endTurn("a");
          const left = Math.max(0, Math.ceil((deadline - t) / 1000));
          if (left !== S.l) { S.l = left; pub(); }
          if (t >= deadline) endTurn("t");
          return;
        }
        if (S.ph === "rv" && t >= phaseEnd) nextTurn();
      }
      S = {ph: "pre", r: -1, n: NP, d: 0, l: 0, tt: TURN_SEC(), w: "", sk: 0, sc: Array(NP).fill(0), ok: [], gn: Array(NP).fill(0), f: [], pr: Array(NP).fill(0), ak: Array(NP).fill(0), h: [], y: "", cn: []};
      api.onInputs(onHostInputs);
      later(() => { nextTurn(); every(tick, 200); }, 600);
    }

    return {
      destroy() {
        dead = true;
        timers.forEach(id => { clearTimeout(id); clearInterval(id); });
        timers.clear();
        if (rafId) cancelAnimationFrame(rafId);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", resizeCanvas);
        document.removeEventListener("keydown", onKey);
        if (actx) try { actx.close(); } catch (e) {}
        el.innerHTML = "";
      }
    };
  }
});
