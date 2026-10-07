/* Gonflette Party : personnage qui prend du muscle avec l'expérience.
   GONFLETTE.avatar.svg(look, xp, {pose, view, m}) renvoie une chaîne SVG.
   pose : "idle" | "flex" (double biceps) | "most" (most muscular) | "kiss" (bisou au biceps) | "back" (pose de dos) | "leg" (flex de jambe) | "wave".
   look peut porter (facultatif, rétrocompatible) :
     look.mg = ancien choix de groupes musculaires : ignoré (tout le monde est équilibré)
     look.it = ["bandana", "chaine", ...] objets de la boutique équipés (un par emplacement) */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  const SKINS = ["#f6d2b8", "#eebe98", "#d9a27a", "#b97b54", "#8d5a3b", "#5e3a26"];
  const HAIR_COLORS = ["#25201f", "#6b4226", "#c8562b", "#e3bb4f", "#dcd8d0", "#d6337a", "#2f7fd6"];
  const HAIR_STYLES = [["court", "Court"], ["crete", "Crête"], ["queue", "Queue"], ["afro", "Afro"], ["chignon", "Chignon"], ["chauve", "Chauve"]];
  const CLOTH = ["#e63946", "#f4a261", "#ffd166", "#2a9d8f", "#264653", "#8338ec", "#ff006e", "#3a86ff", "#111111", "#f1faee"];
  const TOPS = [["nu", "Torse nu"], ["debardeur", "Débardeur"], ["singlet", "Justaucorps"]];
  const ACCS = [["aucun", "Rien"], ["bandeau", "Bandeau"], ["casquette", "Casquette"], ["lunettes", "Lunettes"], ["moustache", "Moustache"], ["barbe", "Barbe"], ["ceinture", "Ceinture"]];

  // Paliers d'expérience : victoire +100, 2e place +40, participation +25.
  const TIERS = [[0, "Crevette"], [100, "Brindille"], [200, "Nouille molle"], [350, "Échalas"], [500, "Sportif du dimanche"],
    [700, "Costaud"], [900, "Balèze"], [1150, "Armoire à glace"], [1500, "Montagne"], [2000, "Titan démesuré"]];
  function tier(xp) {
    let i = 0;
    for (let k = 0; k < TIERS.length; k++) if (xp >= TIERS[k][0]) i = k;
    return {index: i, name: TIERS[i][1], from: TIERS[i][0], to: TIERS[i + 1] ? TIERS[i + 1][0] : null, count: TIERS.length};
  }
  // Croissance par paliers de 100 XP : niveau L = floor(xp / 100), plafonné à 20 (2 000 XP).
  // Chaque palier fait gonfler le perso (muscles + taille à l'écran) : plus de choix de groupes musculaires.
  const LEVEL_XP = 100, MAX_LEVEL = 20;
  const level = xp => Math.max(0, Math.min(MAX_LEVEL, Math.floor(Math.max(0, +xp || 0) / LEVEL_XP)));
  // 0 = brindille, 1 = très musclé (niveau 15), jusqu'à 1.35 = démesuré (niveau 20).
  function muscle(xp) {
    const L = level(xp);
    return L <= 15 ? L / 15 : 1 + (L - 15) / 5 * 0.35;
  }
  const DEFAULT_LOOK = {skin: SKINS[1], hair: "court", hairColor: HAIR_COLORS[0], top: "debardeur", topColor: CLOTH[0], shorts: CLOTH[4], acc: "aucun"};

  // Ancien système de groupes musculaires (look.mg) : ignoré, tout le monde est équilibré (rétrocompatible).
  const groups = () => ({b: 1, p: 1, d: 1, j: 1, skip: false, tot: 0, mg: [0, 0, 0, 0]});
  const skipLegDay = () => false;

  /* ---------- boutique : objets cosmétiques ---------- */
  const RARITIES = {
    commun: {name: "Commun", color: "#a9b4c2", p: .60, price: 60, dup: 20},
    rare: {name: "Rare", color: "#3a86ff", p: .28, price: 150, dup: 50},
    epique: {name: "Épique", color: "#b14dff", p: .10, price: 350, dup: 120},
    legendaire: {name: "Légendaire", color: "#ffb703", p: .02, price: 800, dup: 300}
  };
  const SLOTS = [["tete", "Tête", "🧢"], ["visage", "Visage", "🕶️"], ["cou", "Cou", "📿"], ["main", "Main", "🏋️"], ["poignets", "Poignets", "🧽"], ["taille", "Taille", "🩲"], ["pieds", "Pieds", "🩴"], ["peau", "Peau", "🖋️"], ["dos", "Dos", "🦸"], ["aura", "Aura", "✨"]];
  const ITEMS = [
    ["bandana", "tete", "Bandana Rambo", "commun", "Pour survivre à n'importe quelle séance de jambes. Ou pas."],
    ["eponge", "tete", "Bandeau éponge", "commun", "Absorbe 2 litres de sueur à l'heure."],
    ["casqenv", "tete", "Casquette à l'envers", "commun", "Le style « je soulève, frère »."],
    ["mulet", "tete", "Mulet de légende", "rare", "Business devant, haltères derrière."],
    ["viking", "tete", "Casque viking", "epique", "Pour piller les bancs de développé couché."],
    ["couronne", "tete", "Couronne du roi de la fonte", "legendaire", "Le trône, c'est le banc de muscu."],
    ["moust70", "visage", "Moustache 70s", "commun", "Muscle Beach 1975, édition poils."],
    ["guerre", "visage", "Peintures de guerre", "commun", "Intimidation garantie au vestiaire."],
    ["aviateur", "visage", "Lunettes aviateur", "rare", "Vous êtes trop cool pour cette salle."],
    ["coeur", "visage", "Lunettes cœur", "rare", "Amoureux de son propre reflet."],
    ["dentor", "visage", "Dent en or", "epique", "Un sourire à 24 carats."],
    ["sifflet", "cou", "Sifflet de coach", "commun", "ENCORE UNE SÉRIE !"],
    ["serviette", "cou", "Serviette de vestiaire", "commun", "Jamais lavée depuis 1983."],
    ["chaine", "cou", "Chaîne en or", "rare", "Pèse plus lourd que vos haltères."],
    ["medaille", "cou", "Médaille d'or", "epique", "Champion du monde de quelque chose."],
    ["banane", "taille", "Banane fluo", "commun", "Pour ranger ses protéines en poudre."],
    ["leopard", "taille", "Slip léopard", "rare", "Sauvage. Très sauvage."],
    ["tutu", "taille", "Tutu rose", "rare", "La grâce d'un cygne de 120 kg."],
    ["ceinture", "taille", "Ceinture de champion", "epique", "Poids lourd, ego encore plus lourd."],
    ["slipor", "taille", "Slip à paillettes d'or", "legendaire", "Brille plus fort que le soleil de Venice Beach."],
    ["pognet", "poignets", "Poignets en éponge", "commun", "Le tennis de 1978 rencontre la fonte."],
    ["clous", "poignets", "Bracelets à clous", "rare", "Hard rock et curl biceps."],
    ["gants", "poignets", "Gants de boxe", "epique", "Pour frapper les records."],
    ["maman", "peau", "Tatouage « MAMAN »", "commun", "Elle est fière de vous."],
    ["tribal", "peau", "Tatouage tribal", "rare", "Ça veut dire « jour des bras » en ancien."],
    ["huile", "peau", "Huile bronzante", "epique", "Brillance de compétition, adhérence zéro."],
    ["cape", "dos", "Cape de super-héros", "epique", "Le vent souffle toujours dans le bon sens."],
    ["ailes", "dos", "Ailes d'ange", "legendaire", "Un ange descendu du rack à squat."],
    ["craie", "aura", "Nuage de magnésie", "commun", "Pouf ! Effet poudre garanti."],
    ["etoiles", "aura", "Paillettes disco", "rare", "Saturday Night Fever, Monday Leg Day."],
    ["eclairs", "aura", "Aura éclairs", "epique", "Électrisant. Littéralement."],
    ["flammes", "aura", "Aura flammes", "epique", "Ça brûle ? C'est l'acide lactique."],
    ["fumee", "aura", "Aura fumée dorée", "legendaire", "Entrée de boss final."],
    // --- nouvelle collection « Été 75 »
    ["bonnetbain", "tete", "Bonnet de bain à fleurs", "commun", "Hydrodynamique. Et très fleuri."],
    ["laurier", "tete", "Couronne de laurier", "rare", "Vainqueur olympique du curl biceps."],
    ["disco", "tete", "Perruque disco", "rare", "Volume capillaire proportionnel au volume musculaire."],
    ["cornes", "tete", "Cornes de diable", "rare", "Le démon de la séance jambes."],
    ["aureole", "tete", "Auréole", "epique", "Un saint homme. Qui ne prête jamais son banc."],
    ["plongee", "visage", "Masque de plongée", "commun", "Tuba compris. Pour plonger dans la piscine de protéines."],
    ["clown", "visage", "Nez de clown", "commun", "Pouet. Le sérieux, c'est pour les haltères."],
    ["catcheur", "visage", "Masque de catcheur", "epique", "El Gonflador, terreur du ring."],
    ["lei", "cou", "Collier hawaïen", "commun", "Aloha, les biceps !"],
    ["papillon", "cou", "Nœud pap' de gala", "commun", "Torse nu mais tenue correcte exigée."],
    ["requin", "cou", "Collier de dents de requin", "rare", "Le requin, il a perdu au bras de fer."],
    ["haltere", "main", "Mini-haltère", "commun", "Pour faire des curls même en marchant."],
    ["glace", "main", "Glace à l'italienne", "commun", "Jour de triche. Trois boules."],
    ["shakerm", "main", "Shaker XXL", "rare", "5 litres de protéines à la fraise."],
    ["trophee", "main", "Trophée de Mister Gonflette", "epique", "Gravé à votre nom. Par vous-même."],
    ["hawai", "taille", "Short à fleurs", "commun", "Le surfeur de Muscle Beach."],
    ["bouee", "taille", "Bouée canard", "epique", "Coin coin. Même les titans ont peur de l'eau."],
    ["tongs", "pieds", "Tongs", "commun", "Interdites en salle. Donc obligatoires."],
    ["palmes", "pieds", "Palmes", "rare", "Leg day aquatique."],
    ["cowboy", "pieds", "Santiags", "rare", "Yeehaw, cow-boy de la fonte."],
    ["rollers", "pieds", "Rollers disco", "epique", "Venice Beach, 1978, en marche arrière."],
    ["coupsoleil", "peau", "Coup de soleil", "commun", "Oublié la crème. Marques de débardeur garanties."],
    ["fluo", "peau", "Bronzage fluo", "rare", "Autobronzant périmé, effet néon."],
    ["doree", "peau", "Peau dorée", "legendaire", "Vous êtes littéralement une statue de champion."],
    ["marbre", "peau", "Statue grecque", "legendaire", "Sculpté par les dieux. En marbre de Carrare."],
    ["surf", "dos", "Planche de surf", "rare", "La vague ? On la soulève."],
    ["jetpack", "dos", "Jetpack protéiné", "epique", "Carburant : whey vanille."],
    ["bulles", "aura", "Bulles de savon", "commun", "Douceur, fraîcheur, gonflette."],
    ["arcenciel", "aura", "Aura arc-en-ciel", "epique", "Toutes les couleurs de la gonflette."],
    ["billets", "aura", "Pluie de billets", "epique", "Sponsorisé par la Boutique Protéines."],
    ["ombre", "aura", "Ombre infernale", "legendaire", "Votre ombre fait plus de pompes que vous."]
  ].map(([id, s, n, r, d]) => ({id, s, n, r, d, price: RARITIES[r].price}));
  const ITEM = {};
  ITEMS.forEach(i => ITEM[i.id] = i);
  function equipped(look) {
    const eq = {};
    const a = look && Array.isArray(look.it) ? look.it : [];
    for (const id of a) { const it = ITEM[id]; if (it) eq[it.s] = id; }
    return eq;
  }

  const POSES = [["flex", "Double biceps", "💪"], ["most", "Most muscular", "😤"], ["kiss", "Bisou au biceps", "😘"], ["back", "Pose de dos", "🦅"], ["leg", "Flex de jambe", "🦵"]];

  const f = n => Math.round(n * 10) / 10;
  function shade(hex, k) {
    const n = parseInt(String(hex).slice(1), 16);
    if (!isFinite(n)) return hex;
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
  }
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pt = q => f(q[0]) + " " + f(q[1]);
  const star = (x, y, r, fill) => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * .18)} ${f(y - r * .18)} ${f(x + r)} ${f(y)}Q${f(x + r * .18)} ${f(y + r * .18)} ${f(x)} ${f(y + r)}Q${f(x - r * .18)} ${f(y + r * .18)} ${f(x - r)} ${f(y)}Q${f(x - r * .18)} ${f(y - r * .18)} ${f(x)} ${f(y - r)}Z" fill="${fill}"/>`;

  function svg(look, xp, opts = {}) {
    look = Object.assign({}, DEFAULT_LOOK, look || {});
    const m = opts.m != null ? opts.m : muscle(xp);
    const mc = Math.min(m, 1);
    let pose = opts.pose || "idle";
    const back = pose === "back";
    const cx = 100;
    const gr = groups(look), eq = equipped(look);
    // peaux de la boutique : remplacent la couleur de peau
    const SKIN_FX = {doree: "#e9b824", marbre: "#ecebe4", fluo: "#ff8a1f", coupsoleil: "#f4836c"};
    const ink = "#1d1420", skin = SKIN_FX[eq.peau] || look.skin, skin2 = shade(skin, .86);
    if (eq.visage === "catcheur" || eq.tete === "bonnetbain" || eq.tete === "disco") look.hair = "chauve"; // cagoule / bonnet / perruque par-dessus
    const kb = gr.b, kp = gr.p, kd = gr.d, kj = gr.j;
    const ramp = Math.min(1, m * 4); // les groupes se voient même chez les petits gabarits

    // proportions (ancres identiques à l'ancienne version : épaules, tête, cou)
    const headR = 25 - 6 * mc - 2 * Math.max(0, m - 1);
    const yS = 100 + 2 * m;                   // ligne des épaules
    const headY = 50 + 12 * m;                // la tête s'enfonce dans les trapèzes
    const neckH = 4 + 13 * m;                 // demi-largeur du cou
    const SW = 19 + 50 * m;                   // demi-largeur des épaules
    const W = 13 + 12 * m;                    // demi-taille
    const H = 15 + 13 * m;                    // demi-hanches
    const UA0 = 7 + 28 * m;
    const UA = Math.min(60, 7 + 28 * m * kb + 8 * (kb - 1) * ramp);                   // épaisseur bras
    const FA = Math.min(54, 6 + 19 * m * Math.pow(kb, 1.3) + 8 * (kb - 1) * ramp);   // avant-bras (Popeye !)
    const kj2 = 1 + (kj - 1) * .45;
    let TW = 10 + 25 * m * kj2 + 6 * (kj - 1) * ramp, CW = 7 + 15 * m * kj2 + 5 * (kj - 1) * ramp; // cuisse / mollet
    const lat = Math.max(-8, Math.min(28, (17 * m + 5) * (kd - 1) * ramp));         // largeur du dos (V)
    const pd = Math.max(-6, Math.min(22, (17 * m + 5) * (kp - 1) * ramp));           // profondeur des pecs
    const trapTop = yS - 10 - 22 * m * (.65 + .35 * kd);

    const hw = Math.max(SW + UA0 + 10, 62);
    const vb = opts.view === "bust" ? `${f(100 - hw)} ${f(headY - headR - 18)} ${f(hw * 2)} ${f(hw * 2)}` : "-45 -12 290 280";
    let s = `<svg class="av" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    // ombre au sol (doit rester le premier élément : scene3d la retire)
    s += `<ellipse cx="100" cy="258" rx="${f(28 + 40 * m)}" ry="7" fill="rgba(0,0,0,.28)"/>`;

    const ext = Math.min(SW + 46, 138);
    // ---- aura (derrière tout)
    if (eq.aura === "fumee") {
      s += `<defs><radialGradient id="gfAuraFumee"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".95"/><stop offset=".55" stop-color="#ffc233" stop-opacity=".5"/><stop offset="1" stop-color="#ffb000" stop-opacity="0"/></radialGradient></defs>`;
      const puffs = [[0, 236, 1.25], [-.8, 210, .9], [.85, 205, .95], [-.95, 150, .8], [.95, 140, .85], [-.6, 85, .7], [.7, 70, .75], [0, 30, .8]];
      s += `<g>`;
      for (const [k, y, r] of puffs) s += `<ellipse cx="${f(cx + k * ext * .8)}" cy="${y}" rx="${f((34 + 30 * m) * r)}" ry="${f(30 * r + 6)}" fill="url(#gfAuraFumee)"/>`;
      for (let i = 0; i < 7; i++) s += star(cx + Math.cos(i * 2.4) * ext * .85, 40 + i * 30, 5 + (i % 3) * 2, "#fff6c9");
      s += `</g>`;
    }
    if (eq.aura === "eclairs") {
      s += `<ellipse cx="100" cy="140" rx="${f(ext)}" ry="128" fill="#7fd4ff" opacity=".22"/>`;
      const bolt = (x, y, k, d) => `<path d="M${f(x)} ${f(y)}l${f(d * 14 * k)} ${f(18 * k)}l${f(-d * 8 * k)} ${f(2 * k)}l${f(d * 12 * k)} ${f(20 * k)}l${f(-d * 22 * k)} ${f(-24 * k)}l${f(d * 8 * k)} ${f(-2 * k)}z" fill="#ffe14d" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
      s += `<g>${bolt(cx - ext, 40, 1.3, 1)}${bolt(cx + ext - 18, 70, 1.1, -1)}${bolt(cx - ext + 4, 160, 1, 1)}${bolt(cx + ext - 12, 175, 1.25, -1)}${bolt(cx - 16, -6, .9, 1)}<animate attributeName="opacity" values="1;.35;1;1;.6;1" dur="1.1s" repeatCount="indefinite"/></g>`;
    }
    if (eq.aura === "flammes") {
      const fl = (x, base, h, w, c) => `<path d="M${f(x - w)} ${f(base)}Q${f(x - w * 1.1)} ${f(base - h * .55)} ${f(x)} ${f(base - h)}Q${f(x + w * .2)} ${f(base - h * .55)} ${f(x + w * .45)} ${f(base - h * .62)}Q${f(x + w * 1.2)} ${f(base - h * .35)} ${f(x + w)} ${f(base)}Z" fill="${c}"/>`;
      s += `<g stroke="${ink}" stroke-width="0">`;
      const xs = [-1, -.62, -.25, .15, .55, .95];
      xs.forEach((k, i) => { const x = cx + k * ext; s += fl(x, 262, 95 + (i % 2) * 50 + 30 * m, 22 + 8 * m, "#ff5a1f"); });
      xs.forEach((k, i) => { const x = cx + k * ext + 4; s += fl(x, 262, 55 + (i % 2) * 30 + 20 * m, 12 + 5 * m, "#ffd23f"); });
      s += `</g>`;
    }
    if (eq.aura === "etoiles") {
      const cols = ["#ffd23f", "#ff6ad5", "#7fe7ff", "#ffffff"];
      for (let i = 0; i < 14; i++) { const a = i * 2.39, rr = .55 + (i % 4) * .14; s += star(cx + Math.cos(a) * ext * rr * 1.05, 130 + Math.sin(a) * 120 * rr, 5 + (i % 3) * 3, cols[i % 4]); }
    }
    if (eq.aura === "craie") {
      const puff = (x, y, r) => `<g fill="#fff" opacity=".78"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><circle cx="${f(x + r * .9)}" cy="${f(y + r * .25)}" r="${f(r * .75)}"/><circle cx="${f(x - r * .85)}" cy="${f(y + r * .3)}" r="${f(r * .7)}"/><circle cx="${f(x + r * .2)}" cy="${f(y - r * .7)}" r="${f(r * .65)}"/></g>`;
      s += puff(cx - ext * .8, 236, 16 + 6 * m) + puff(cx + ext * .8, 240, 14 + 6 * m) + puff(cx - ext * .9, 120, 12) + puff(cx + ext * .9, 100, 13) + puff(cx, 255, 12);
    }
    if (eq.aura === "arcenciel") {
      const cols = ["#ff3b3b", "#ff9f1c", "#ffe14d", "#3ccf5e", "#2fa8ff", "#8f5bff"], R0 = Math.min(ext + 22, 150);
      cols.forEach((c, i) => { const rr = R0 - i * 9; s += `<path d="M${f(cx - rr)} 236A${f(rr)} ${f(rr * 1.2)} 0 0 1 ${f(cx + rr)} 236" stroke="${c}" stroke-width="9.5" fill="none" opacity=".85"/>`; });
      for (const d of [-1, 1]) s += `<g fill="#fff" opacity=".9"><ellipse cx="${f(cx + d * (R0 - 22))}" cy="240" rx="26" ry="13"/><ellipse cx="${f(cx + d * (R0 - 6))}" cy="246" rx="20" ry="11"/><ellipse cx="${f(cx + d * (R0 - 40))}" cy="248" rx="18" ry="10"/></g>`;
    }
    if (eq.aura === "bulles") {
      for (let i = 0; i < 13; i++) {
        const a = i * 2.39, rr = .5 + (i % 4) * .16, x = cx + Math.cos(a) * ext * rr * 1.05, y = 128 + Math.sin(a) * 118 * rr, br = 6 + (i % 3) * 4;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(br)}" fill="#bfefff" fill-opacity=".35" stroke="#7fd4ff" stroke-width="2"/><path d="M${f(x - br * .5)} ${f(y - br * .1)}a${f(br * .55)} ${f(br * .55)} 0 0 1 ${f(br * .45)} ${f(-br * .45)}" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      }
    }
    if (eq.aura === "billets") {
      for (let i = 0; i < 12; i++) {
        const a = i * 2.39, rr = .55 + (i % 4) * .13, x = cx + Math.cos(a) * ext * rr * 1.08, y = 120 + Math.sin(a) * 120 * rr, rot = (i * 47) % 70 - 35;
        s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})"><rect x="-13" y="-7" width="26" height="14" rx="2" fill="#7ccf7a" stroke="${ink}" stroke-width="2"/><ellipse cx="0" cy="0" rx="5" ry="4.5" fill="#bdf0b5" stroke="#2f7a32" stroke-width="1.2"/><text x="0" y="2.6" font-size="7" font-family="Anton,Impact,sans-serif" text-anchor="middle" fill="#1f5a22">€</text></g>`;
      }
    }
    if (eq.aura === "ombre") {
      const sw = Math.min(ext + 4, 140), fl = (x, h, w, c, o) => `<path d="M${f(x - w)} 262Q${f(x - w * 1.15)} ${f(262 - h * .5)} ${f(x - w * .2)} ${f(262 - h * .8)}Q${f(x + w * .1)} ${f(262 - h * .9)} ${f(x)} ${f(262 - h)}Q${f(x + w * .35)} ${f(262 - h * .6)} ${f(x + w * .6)} ${f(262 - h * .7)}Q${f(x + w * 1.2)} ${f(262 - h * .35)} ${f(x + w)} 262Z" fill="${c}" opacity="${o}"/>`;
      s += `<defs><radialGradient id="gfOmbre" cx=".5" cy=".75" r=".7"><stop offset="0" stop-color="#ff3b1f" stop-opacity=".85"/><stop offset=".45" stop-color="#7a0d2e" stop-opacity=".8"/><stop offset="1" stop-color="#12030f" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="150" rx="${f(sw + 10)}" ry="140" fill="url(#gfOmbre)"/>`;
      [-.95, -.6, -.25, .15, .5, .9].forEach((k, i) => { s += fl(cx + k * sw, 170 + (i % 2) * 60 + 40 * m, 26 + 6 * m, "#16040f", .95); });
      [-.8, -.4, .3, .72].forEach((k, i) => { s += fl(cx + k * sw, 90 + (i % 2) * 40 + 20 * m, 12 + 4 * m, "#ff3b1f", .9); });
      for (const d of [-1, 1]) s += `<ellipse cx="${f(cx + d * (sw * .78))}" cy="${f(headY + 4)}" rx="7" ry="3.4" fill="#ffd23f" transform="rotate(${d * 16} ${f(cx + d * sw * .78)} ${f(headY + 4)})"/>`;
    }
    // ---- dos : planche de surf / jetpack (derrière le corps, sauf vue de dos : dessinés par-dessus plus bas)
    const dosItem = () => {
      let o = "";
      if (eq.dos === "surf") {
        const L2 = 128 + 10 * m, w2 = 21 + 5 * m;
        o += `<g transform="rotate(-24 ${cx} 140)"><ellipse cx="${cx}" cy="140" rx="${f(w2)}" ry="${f(L2)}" fill="#ffd23f" stroke="${ink}" stroke-width="4"/><path d="M${cx} ${f(140 - L2 + 10)}V${f(140 + L2 - 10)}" stroke="#ff6b35" stroke-width="5"/><path d="M${f(cx - w2 + 4)} 60h${f(2 * w2 - 8)}M${f(cx - w2 + 2)} 70h${f(2 * w2 - 4)}" stroke="#2fa8ff" stroke-width="4"/></g>`;
      }
      if (eq.dos === "jetpack") {
        for (const d of [-1, 1]) {
          const x = cx + d * (SW * .62 + 4), tw = 12 + 5 * m, top = trapTop - 26, bot = 168;
          o += `<path d="M${f(x - tw * .7)} ${f(bot + 2)}Q${f(x)} ${f(bot + 60 + 10 * m)} ${f(x + tw * .7)} ${f(bot + 2)}Z" fill="#ff7b00" stroke="${ink}" stroke-width="2.5"/><path d="M${f(x - tw * .35)} ${f(bot + 2)}Q${f(x)} ${f(bot + 34)} ${f(x + tw * .35)} ${f(bot + 2)}Z" fill="#ffe14d"/>`;
          o += `<rect x="${f(x - tw)}" y="${f(top)}" width="${f(tw * 2)}" height="${f(bot - top)}" rx="${f(tw)}" fill="#b9c3cc" stroke="${ink}" stroke-width="4"/><rect x="${f(x - tw * .55)}" y="${f(top + 8)}" width="${f(tw * .35)}" height="${f(bot - top - 22)}" rx="3" fill="#fff" opacity=".6"/><rect x="${f(x - tw)}" y="${f(top + 14)}" width="${f(tw * 2)}" height="8" fill="#e63946" stroke="${ink}" stroke-width="2"/><path d="M${f(x - tw * .5)} ${f(top - 3)}h${f(tw)}" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`;
        }
      }
      return o;
    };
    if (!back) s += dosItem();
    // ---- dos : cape / ailes
    if (eq.dos === "cape") {
      const L = cx - SW * .72, R = cx + SW * .72, bw = Math.min(SW + 40, 132);
      s += `<path d="M${f(L)} ${f(yS - 4)}Q${f(cx - bw)} ${f(170)} ${f(cx - bw - 6)} 252Q${f(cx - bw * .45)} 238 ${cx} 250Q${f(cx + bw * .5)} 236 ${f(cx + bw + 6)} 246Q${f(cx + bw)} ${f(170)} ${f(R)} ${f(yS - 4)}Z" fill="#d62828" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<path d="M${f(cx - bw * .55)} 200Q${f(cx - bw * .5)} 230 ${f(cx - bw * .6)} 246M${f(cx + bw * .55)} 196Q${f(cx + bw * .5)} 226 ${f(cx + bw * .62)} 240" stroke="#9b1c1c" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    }
    if (eq.dos === "ailes") {
      for (const d of [-1, 1]) {
        const x0 = cx + d * SW * .45, y0 = yS + 8, span = Math.min(SW + 34, 128);
        const tip = [cx + d * span, y0 - 70 - 10 * m];
        let p = `M${f(x0)} ${f(y0)}Q${f(cx + d * span * .55)} ${f(y0 - 95)} ${pt(tip)}`;
        const n = 4;
        for (let i = 1; i <= n; i++) { const t = i / n; const q = [tip[0] - d * span * .62 * t, tip[1] + (115 + 10 * m) * t]; const c = [q[0] + d * 16, q[1] - 6]; p += `Q${pt(c)} ${pt(q)}`; }
        p += `Z`;
        s += `<path d="${p}" fill="#fbfbff" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
        s += `<path d="M${f(x0 + d * 10)} ${f(y0 - 6)}Q${f(cx + d * span * .6)} ${f(y0 - 60)} ${f(tip[0] - d * 8)} ${f(tip[1] + 10)}M${f(x0 + d * 12)} ${f(y0 + 10)}Q${f(cx + d * span * .55)} ${f(y0 - 20)} ${f(tip[0] - d * 20)} ${f(tip[1] + 50)}" stroke="#c9cbe6" stroke-width="2.5" fill="none"/>`;
      }
    }

    // ---- coiffure arrière (afro, queue) / mulet / perruque disco
    const discoWig = () => { const R = headR + 20 + 4 * m, cy = headY - 8, cols = ["#ff2e88", "#ffd23f", "#3ccf8e", "#2fa8ff", "#b14dff"]; let o = `<circle cx="${cx}" cy="${f(cy)}" r="${f(R)}" fill="${cols[0]}" stroke="${ink}" stroke-width="4"/>`; for (let i = 1; i < 5; i++) o += `<circle cx="${cx}" cy="${f(cy)}" r="${f(R * (1 - i * .16))}" fill="${cols[i]}"/>`; for (let i = 0; i < 9; i++) o += star(cx + Math.cos(i * 2.2) * R * .78, cy + Math.sin(i * 2.2) * R * .78, 4, "#fff"); return o; };
    if (!back && eq.tete === "disco") s += discoWig();
    if (!back && look.hair === "afro") s += `<circle cx="100" cy="${f(headY - 4)}" r="${f(headR + 13)}" fill="${look.hairColor}" stroke="${ink}" stroke-width="4"/>`;
    if (!back && look.hair === "queue") s += `<path d="M${f(cx + headR * .6)} ${f(headY - headR * .4)} q 26 6 20 46 q -10 -6 -24 -28 z" fill="${look.hairColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;

    // ---- jambes
    const legs = [], spread = Math.max(0, TW - (10 + 25 * m)) * .5;
    for (const d of [-1, 1]) {
      let hip = [cx + d * (H - 9 - 3 * m + spread), 172], knee = [cx + d * (H - 7 + 2 * m + spread * 1.1), 212], ank = [cx + d * (H - 9 + spread * .8), 245], toe = false;
      if (pose === "leg" && d === 1) { knee = [hip[0] + 16 + 8 * m + TW * .15, 206]; ank = [knee[0] - 3, 240]; toe = true; }
      legs.push({d, hip, knee, ank, toe});
    }
    const calf = L => { const c = lerp(L.knee, L.ank, .32); return [c[0] + L.d * CW * .3, c[1], CW * .42 + 1]; };
    const quad = L => { const c = lerp(L.hip, L.knee, .6); return [c[0] + L.d * TW * .2, c[1], TW * .36 + 1]; };
    const bigLegs = !gr.skip && kj > 1.12 && m > .15;
    for (const L of legs) {
      s += `<path d="M${pt(L.hip)}L${pt(L.knee)}" stroke="${ink}" stroke-width="${f(TW + 6)}" stroke-linecap="round"/><path d="M${pt(L.knee)}L${pt(L.ank)}" stroke="${ink}" stroke-width="${f(CW + 6)}" stroke-linecap="round"/>`;
      if (bigLegs) { const c = calf(L), q = quad(L); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2] + 3)}" fill="${ink}"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(q[2] + 3)}" fill="${ink}"/>`; }
    }
    for (const L of legs) {
      s += `<path d="M${pt(L.hip)}L${pt(L.knee)}" stroke="${skin}" stroke-width="${f(TW)}" stroke-linecap="round"/><path d="M${pt(L.knee)}L${pt(L.ank)}" stroke="${skin}" stroke-width="${f(CW)}" stroke-linecap="round"/>`;
      if (bigLegs) { const c = calf(L), q = quad(L); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2])}" fill="${skin}"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(q[2])}" fill="${skin}"/>`; }
      if (gr.skip) {
        // jambes de poulet : genoux cagneux qui tremblent
        s += `<circle cx="${f(L.knee[0])}" cy="${f(L.knee[1])}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="2.6"/>`;
        s += `<path d="M${f(L.knee[0] + L.d * 9)} ${f(L.knee[1] - 6)}l${f(L.d * 4)} 3l${f(-L.d * 3)} 3l${f(L.d * 4)} 3" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`;
      } else {
        if (m > .35 || bigLegs) s += `<path d="M${f(L.knee[0] + L.d * CW * .2)} ${f(L.knee[1] + 8)}q${f(L.d * CW * .5)} 10 0 26" stroke="${skin2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        if (bigLegs || (pose === "leg" && m > .2)) { // goutte des quadriceps
          const q = lerp(L.hip, L.knee, .78);
          s += `<path d="M${f(q[0] - L.d * TW * .28)} ${f(q[1] - 12)}q${f(L.d * TW * .2)} 14 ${f(L.d * TW * .38)} 10M${f(q[0] + L.d * TW * .32)} ${f(q[1] - 26)}q${f(-L.d * 4)} 14 0 22" stroke="${skin2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        }
        if (m < .35 && !bigLegs) s += `<circle cx="${f(L.knee[0])}" cy="${f(L.knee[1])}" r="${f(7.5 - 6 * m)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>`;
      }
      const fy = L.toe ? L.ank[1] + 7 : 251, fx = L.ank[0] + L.d * 5, frx = 12 + 4 * m;
      let shoe = "";
      if (eq.pieds === "tongs") {
        shoe = `<ellipse cx="${f(fx)}" cy="${f(fy + 3)}" rx="${f(frx + 2)}" ry="4" fill="#2fa8ff" stroke="${ink}" stroke-width="3"/><ellipse cx="${f(fx)}" cy="${f(fy - 1)}" rx="${f(frx - 1)}" ry="5" fill="${skin}" stroke="${ink}" stroke-width="2.6"/><path d="M${f(fx - frx * .6)} ${f(fy + 1)}L${f(fx + L.d * frx * .35)} ${f(fy - 5)}L${f(fx + frx * .6)} ${f(fy + 1)}" stroke="#ffd23f" stroke-width="3.2" fill="none" stroke-linejoin="round"/>`;
      } else if (eq.pieds === "palmes") {
        const tip = fx + L.d * (frx + 30 + 6 * m);
        shoe = `<path d="M${f(fx - L.d * frx * .6)} ${f(fy - 6)}L${f(tip)} ${f(fy - 10)}Q${f(tip + L.d * 4)} ${f(fy + 2)} ${f(tip)} ${f(fy + 8)}L${f(fx - L.d * frx * .6)} ${f(fy + 6)}Z" fill="#ffd23f" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(fx + L.d * 8)} ${f(fy - 5)}L${f(tip - L.d * 4)} ${f(fy - 4)}M${f(fx + L.d * 8)} ${f(fy + 4)}L${f(tip - L.d * 4)} ${f(fy + 3)}" stroke="#e0a800" stroke-width="2.4"/><ellipse cx="${f(fx - L.d * 2)}" cy="${f(fy)}" rx="${f(frx * .8)}" ry="7" fill="#2fa8ff" stroke="${ink}" stroke-width="3"/>`;
      } else if (eq.pieds === "cowboy") {
        const kx = L.ank[0], top = L.ank[1] - 26 - 4 * m, bw = CW / 2 + 5;
        shoe = `<path d="M${f(kx - bw)} ${f(top)}L${f(kx + bw)} ${f(top)}L${f(kx + bw - 1)} ${f(fy - 4)}L${f(fx + L.d * (frx + 4))} ${f(fy - 2)}Q${f(fx + L.d * (frx + 8))} ${f(fy + 5)} ${f(fx + L.d * frx)} ${f(fy + 5)}L${f(kx - L.d * bw)} ${f(fy + 5)}L${f(kx - L.d * bw)} ${f(fy + 9)}L${f(kx - L.d * (bw - 7))} ${f(fy + 9)}L${f(kx - bw + 1)} ${f(fy - 2)}Z" fill="#8a4b20" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(kx - bw + 3)} ${f(top + 8)}q${f(bw - 3)} 8 ${f(2 * bw - 6)} 0" stroke="#f5c518" stroke-width="2.4" fill="none"/>${star(kx - L.d * bw - 2, fy + 3, 4, "#d9dde3")}`;
      } else if (eq.pieds === "rollers") {
        shoe = `<path d="M${f(fx - frx)} ${f(fy + 3)}L${f(fx - frx)} ${f(fy - 16)}Q${f(fx)} ${f(fy - 20)} ${f(fx + L.d * 2)} ${f(fy - 12)}L${f(fx + frx + 2)} ${f(fy - 4)}Q${f(fx + frx + 4)} ${f(fy + 3)} ${f(fx + frx)} ${f(fy + 3)}Z" fill="#fff" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(fx - frx)} ${f(fy - 8)}H${f(fx + 4)}" stroke="#ff2e88" stroke-width="4"/>`;
        for (let i = 0; i < 3; i++) shoe += `<circle cx="${f(fx - frx * .7 + i * frx * .7)}" cy="${f(fy + 8)}" r="5" fill="#ff2e88" stroke="${ink}" stroke-width="2.4"/><circle cx="${f(fx - frx * .7 + i * frx * .7)}" cy="${f(fy + 8)}" r="1.6" fill="#fff"/>`;
      } else shoe = `<ellipse cx="${f(fx)}" cy="${f(fy)}" rx="${f(frx)}" ry="7" fill="#f4f1ea" stroke="${ink}" stroke-width="3.5"/><path d="M${f(fx - 10)} ${f(fy + 2)}h${f(20 + 6 * m)}" stroke="#d6337a" stroke-width="2.5"/>`;
      s += L.toe ? `<g transform="rotate(${L.d * 18} ${f(fx)} ${f(fy)})">${shoe}</g>` : shoe;
    }
    // short (ou slip de la boutique)
    const shortY = 194 + 4 * m;
    const shortsCol = eq.taille === "leopard" ? "#e9a33b" : eq.taille === "slipor" ? "#f5c518" : eq.taille === "hawai" ? "#13a89e" : look.shorts;
    const SX = H + TW * .45 + 3 + spread;
    s += `<path d="M${f(cx - H - 3)} 165 L${f(cx - SX)} ${f(shortY)} L${f(cx - 3)} ${f(shortY)} L${cx} ${f(shortY - 12)} L${f(cx + 3)} ${f(shortY)} L${f(cx + SX)} ${f(shortY)} L${f(cx + H + 3)} 165 Z" fill="${shortsCol}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    if (eq.taille === "leopard") {
      let sp = "";
      for (let row = 0; row < 2; row++) for (let i = -2; i <= 2; i++) {
        const y = 172 + row * 11, x = cx + i * (H + TW * .3) / 2.3 + (row ? 6 : 0);
        if (y > shortY - 4 || (row && Math.abs(x - cx) < 9)) continue;
        sp += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.2" ry="3.2" fill="none" stroke="#3a2210" stroke-width="2.2" stroke-dasharray="5 3"/><circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="#7a4512"/>`;
      }
      s += sp;
    }
    if (eq.taille === "hawai") {
      const fcol = ["#ff2e88", "#ffd23f", "#fff"];
      for (let i = 0; i < 9; i++) { const x = cx + Math.cos(i * 2.3) * (H + TW * .3), y = 171 + (i * 9) % 22; if (y > shortY - 4 || Math.abs(x - cx) < 5) continue; const c = fcol[i % 3]; for (let k = 0; k < 5; k++) s += `<circle cx="${f(x + Math.cos(k * 1.257) * 3.2)}" cy="${f(y + Math.sin(k * 1.257) * 3.2)}" r="2.3" fill="${c}"/>`; s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#ff7b00"/>`; }
    }
    if (eq.taille === "slipor") {
      for (let i = 0; i < 10; i++) { const x = cx + Math.cos(i * 2.1) * (H + TW * .25), y = 172 + (i * 7) % 20; if (y < shortY - 3) s += star(x, y, 3.2, "#fffbe0"); }
    }

    // ---- torse
    const nkTop = yS - 12 - 8 * m;
    const tc0 = neckH + (SW - neckH) * .45;
    const torso = () => {
      const P = d => ({nk: [cx + d * neckH, nkTop], c1: [cx + d * tc0, trapTop], sh: [cx + d * SW, yS + 4],
        c2: [cx + d * (SW + 7 + 5 * m + lat + Math.max(0, pd) * .25), yS + 19], lt: [cx + d * (SW - 3 + lat * .7), yS + 34],
        c3: [cx + d * (W + 6 + 18 * m + lat * .5), yS + 50], wa: [cx + d * W, 152], hp: [cx + d * H, 172]});
      const a = P(-1), b = P(1);
      return `M${pt(a.nk)} Q${pt(a.c1)} ${pt(a.sh)} Q${pt(a.c2)} ${pt(a.lt)} Q${pt(a.c3)} ${pt(a.wa)} L${pt(a.hp)} L${pt(b.hp)} L${pt(b.wa)} Q${pt(b.c3)} ${pt(b.lt)} Q${pt(b.c2)} ${pt(b.sh)} Q${pt(b.c1)} ${pt(b.nk)} Z`;
    };
    // ---- mulet (derrière la tête, sur les trapèzes)
    if (eq.tete === "mulet" && !back) {
      const hc = look.hairColor;
      const mw = Math.max(headR + 8, neckH + 16);
      s += `<path d="M${f(cx - headR * .8)} ${f(headY - 4)}Q${f(cx - mw - 4)} ${f(headY + headR)} ${f(cx - mw)} ${f(yS + 8)}Q${f(cx - mw * .5)} ${f(yS)} ${cx} ${f(yS + 10)}Q${f(cx + mw * .5)} ${f(yS)} ${f(cx + mw)} ${f(yS + 8)}Q${f(cx + mw + 4)} ${f(headY + headR)} ${f(cx + headR * .8)} ${f(headY - 4)}Z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${f(cx - mw + 4)} ${f(yS)}l-3 8M${f(cx + mw - 4)} ${f(yS)}l3 8" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    }

    // cou
    s += `<rect x="${f(cx - neckH)}" y="${f(headY + headR * .4)}" width="${f(neckH * 2)}" height="${f(yS - headY)}" fill="${skin}" stroke="${ink}" stroke-width="4"/>`;
    s += `<path d="${torso()}" fill="${skin}" stroke="${ink}" stroke-width="4.5" stroke-linejoin="round"/>`;

    // détails musculaires sur la peau
    const det = [];
    const pw = SW * Math.min(.72, .55 + .07 * kp);
    if (back) {
      const o = Math.min(1, .35 + m);
      let b = `<g stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="${f(o)}"><path d="M${cx} ${f(yS + 2)}V166"/>`;
      for (const d of [-1, 1]) {
        b += `<path d="M${f(cx + d * 6)} ${f(yS + 14)}q${f(d * SW * .35)} -4 ${f(d * SW * .42)} ${f(24 + 6 * m)}"/>`; // omoplates
        b += `<path d="M${f(cx + d * (SW - 6 + lat * .6))} ${f(yS + 30)}Q${f(cx + d * (W + 10 + lat * .3))} ${f(yS + 58)} ${f(cx + d * (W + 1))} 150"/>`; // grands dorsaux
        if (m > .4) b += `<path d="M${f(cx + d * 4)} 138l${f(d * 8)} -6M${f(cx + d * 4)} 148l${f(d * 9)} -6"/>`; // sapin de Noël
      }
      det.push(b + `</g>`);
    } else {
      if (m < .3 && pd < 3) { // côtes
        const o = (.3 - m) / .3;
        for (let i = 0; i < 4; i++) det.push(`<path d="M${f(cx - W - 2)} ${yS + 22 + i * 9}q${f(W * .6)} 5 ${f(W - 3)} 2M${f(cx + W + 2)} ${yS + 22 + i * 9}q${f(-W * .6)} 5 ${f(-W + 3)} 2" stroke="${ink}" stroke-width="2" fill="none" opacity="${f(o * .7)}"/>`);
      }
      if (m > .25 || pd > 2) { // pectoraux (étagère quand on a mis des points)
        const o = Math.min(1, Math.max((m - .25) / .3, pd / 6));
        const low = yS + 40 + 8 * m + pd, mid = yS + 30 + 4 * m + pd * .7;
        const pec = `M${f(cx - pw)} ${f(yS + 22)}Q${f(cx - SW * .35)} ${f(low)} ${cx} ${f(mid)}Q${f(cx + SW * .35)} ${f(low)} ${f(cx + pw)} ${f(yS + 22)}`;
        if (pd > 3) {
          if (look.top === "nu") det.push(`<path d="${pec}" stroke="${shade(skin, .72)}" stroke-width="${f(3 + pd * .22)}" fill="none" stroke-linecap="round" transform="translate(0 ${f(2.5 + pd * .12)})" opacity="${f(o)}"/>`);
          if (look.top === "nu") det.push(`<path d="M${f(cx - 2)} ${f(yS + 8)}L${f(cx - pw)} ${f(yS + 14)}L${f(cx - pw)} ${f(yS + 22)}Q${f(cx - SW * .35)} ${f(low)} ${cx} ${f(mid)}ZM${f(cx + 2)} ${f(yS + 8)}L${f(cx + pw)} ${f(yS + 14)}L${f(cx + pw)} ${f(yS + 22)}Q${f(cx + SW * .35)} ${f(low)} ${cx} ${f(mid)}Z" fill="${shade(skin, 1.05)}" opacity="${f(o)}"/><ellipse cx="${f(cx - pw * .45)}" cy="${f(yS + 16 + pd * .2)}" rx="${f(pw * .22)}" ry="3" fill="#fff" opacity=".3"/><ellipse cx="${f(cx + pw * .45)}" cy="${f(yS + 16 + pd * .2)}" rx="${f(pw * .22)}" ry="3" fill="#fff" opacity=".3"/>`);
        }
        det.push(`<path d="${pec}M${cx} ${f(yS + 4)}v${f(26 + 4 * m + pd * .7)}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round" opacity="${f(o)}"/>`);
      }
      if (m > .45) { // abdos
        const o = Math.min(1, (m - .45) / .3), top = yS + 44 + 8 * m + pd * .6, bw = W * .55;
        let a = `<g stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="${f(o)}"><path d="M${cx} ${f(top)}V164"/>`;
        for (let i = 0; i < 3; i++) if (top + 4 + i * 11 < 170) a += `<path d="M${f(cx - bw)} ${f(top + 4 + i * 11)}q${f(bw)} 4 ${f(bw * 2)} 0"/>`;
        det.push(a + `</g>`);
      }
    }
    if (look.top === "nu") s += det.join("");

    // vêtement du haut
    if (look.top !== "nu") {
      const c = look.topColor, strap = look.top === "singlet" ? .32 : .5;
      const tp = `M${f(cx - neckH - 4)} ${f(nkTop + 6)} L${f(cx - SW * strap - 6)} ${f(yS - 2 - 6 * m)} Q${f(cx - SW * strap)} ${f(yS + 22)} ${f(cx - SW + 7 - lat * .7)} ${f(yS + 36)} Q${f(cx - (W + 4 + 16 * m + lat * .5))} ${f(yS + 50)} ${f(cx - W - 1)} 152 L${f(cx - H - 2)} 174 L${f(cx + H + 2)} 174 L${f(cx + W + 1)} 152 Q${f(cx + W + 4 + 16 * m + lat * .5)} ${f(yS + 50)} ${f(cx + SW - 7 + lat * .7)} ${f(yS + 36)} Q${f(cx + SW * strap)} ${f(yS + 22)} ${f(cx + SW * strap + 6)} ${f(yS - 2 - 6 * m)} L${f(cx + neckH + 4)} ${f(nkTop + 6)} Q${cx} ${f(back ? nkTop + 14 : yS + 20)} ${f(cx - neckH - 4)} ${f(nkTop + 6)} Z`;
      s += `<path d="${tp}" fill="${c}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<g opacity=".55">${det.join("")}</g>`;
      if (look.top === "singlet") s += `<path d="M${f(cx - W - 1)} 160 L${f(cx + W + 1)} 160" stroke="#fff" stroke-width="4" opacity=".7"/>`;
      if (m > 1.05 || (pd > 8 && !back)) s += `<path d="M${f(cx - SW * .3)} ${f(yS + 18)}l6 6-4 5 7 5M${f(cx + SW * .25)} ${f(yS + 40)}l-5 5 5 5" stroke="${ink}" stroke-width="2.4" fill="none"/>`; // tissu qui craque
    }
    if (eq.peau === "coupsoleil" && look.top === "nu" && !back) s += `<path d="M${f(cx - SW * .42)} ${f(yS - 4)}Q${f(cx - SW * .45)} ${f(yS + 22)} ${f(cx - SW * .62)} ${f(yS + 36)}M${f(cx + SW * .42)} ${f(yS - 4)}Q${f(cx + SW * .45)} ${f(yS + 22)} ${f(cx + SW * .62)} ${f(yS + 36)}" stroke="#fff3e6" stroke-width="${f(6 + 4 * m)}" fill="none" stroke-linecap="round" opacity=".9"/>`;
    if (eq.peau === "marbre") s += `<path d="M${f(cx - SW * .5)} ${f(yS + 8)}q10 14 4 28t12 30M${f(cx + SW * .35)} ${f(yS + 30)}q-8 10 0 22t-6 26M${f(cx - 6)} ${f(yS + 50)}q8 6 4 18" stroke="#9a9ca3" stroke-width="1.6" fill="none" opacity=".75"/>`;
    if (look.acc === "ceinture") s += `<rect x="${f(cx - W - 5)}" y="148" width="${f(W * 2 + 10)}" height="17" rx="4" fill="#5a3418" stroke="${ink}" stroke-width="3.5"/><rect x="${cx - 7}" y="150" width="14" height="13" rx="2" fill="#e3bb4f" stroke="${ink}" stroke-width="2.5"/>`;

    // ---- taille (par-dessus le torse)
    if (eq.taille === "tutu") {
      const R = H + 16 + 6 * m;
      for (const [col, dy, rr] of [["#ff8fc8", 0, 1], ["#ffc2e2", -5, .82]]) {
        let p = `M${f(cx - R * rr)} ${f(166 + dy)}`;
        const n = 9;
        for (let i = 0; i <= n; i++) { const x = cx - R * rr + (2 * R * rr) * i / n; p += `L${f(x)} ${f(184 + dy + (i % 2 ? 6 : 0))}`; }
        p += `L${f(cx + R * rr)} ${f(166 + dy)}Q${cx} ${f(160 + dy)} ${f(cx - R * rr)} ${f(166 + dy)}Z`;
        s += `<path d="${p}" fill="${col}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
      }
    }
    if (eq.taille === "ceinture") {
      const bw2 = W + 7, pr = Math.min(16, W * .55 + 6);
      s += `<rect x="${f(cx - bw2)}" y="146" width="${f(bw2 * 2)}" height="20" rx="5" fill="#1c1c24" stroke="${ink}" stroke-width="3.5"/>`;
      for (const d of [-1, 1]) s += `<rect x="${f(cx + d * (pr + 4) - (d < 0 ? 10 : 0))}" y="149" width="10" height="14" rx="2" fill="#f5c518" stroke="${ink}" stroke-width="2"/>`;
      s += `<ellipse cx="${cx}" cy="156" rx="${f(pr + 4)}" ry="15" fill="#f5c518" stroke="${ink}" stroke-width="3.5"/><ellipse cx="${cx}" cy="156" rx="${f(pr - 2)}" ry="10" fill="#ffe680" stroke="#b8860b" stroke-width="2"/><circle cx="${cx}" cy="156" r="4.5" fill="#e63946" stroke="${ink}" stroke-width="1.6"/>`;
    }
    if (eq.taille === "banane") {
      s += `<path d="M${f(cx - W - 2)} 150Q${cx} 156 ${f(cx + W + 2)} 150" stroke="#111" stroke-width="3.5" fill="none"/>`;
      s += `<rect x="${f(cx - 4)}" y="148" width="${f(18 + 6 * m)}" height="15" rx="7" fill="#39ff7a" stroke="${ink}" stroke-width="3"/><path d="M${f(cx - 1)} 155h${f(12 + 6 * m)}" stroke="#ff2e88" stroke-width="2.4"/>`;
    }

    if (eq.taille === "bouee") {
      const R = H + 22 + 10 * m, y = 172;
      s += `<ellipse cx="${cx}" cy="${y}" rx="${f(R)}" ry="17" fill="none" stroke="${ink}" stroke-width="20"/><ellipse cx="${cx}" cy="${y}" rx="${f(R)}" ry="17" fill="none" stroke="#ffd23f" stroke-width="14"/><path d="M${f(cx - R * .6)} ${f(y + 13)}q${f(R * .6)} 8 ${f(R * 1.2)} 0" stroke="#fff6b0" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      const hx2 = cx + R - 4, hy2 = y - 22;
      s += `<path d="M${f(hx2 - 8)} ${f(y - 6)}Q${f(hx2 - 10)} ${f(hy2 + 6)} ${f(hx2)} ${f(hy2 + 10)}" stroke="${ink}" stroke-width="13" fill="none"/><path d="M${f(hx2 - 8)} ${f(y - 6)}Q${f(hx2 - 10)} ${f(hy2 + 6)} ${f(hx2)} ${f(hy2 + 10)}" stroke="#ffd23f" stroke-width="8" fill="none"/><circle cx="${f(hx2)}" cy="${f(hy2)}" r="11" fill="#ffd23f" stroke="${ink}" stroke-width="3"/><path d="M${f(hx2 + 8)} ${f(hy2 + 1)}q9 -1 12 3q-5 5 -12 2z" fill="#ff7b00" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${f(hx2 + 3)}" cy="${f(hy2 - 3)}" r="2" fill="${ink}"/>`;
    }
    // ---- cou
    const chainBot = .5 * (nkTop + 10) + .5 * (yS + 38 + 4 * m);
    if (!back && eq.cou === "chaine") {
      const cp = `M${f(cx - neckH - 2)} ${f(nkTop + 10)}Q${cx} ${f(yS + 38 + 4 * m)} ${f(cx + neckH + 2)} ${f(nkTop + 10)}`;
      s += `<path d="${cp}" stroke="${ink}" stroke-width="7" fill="none"/><path d="${cp}" stroke="#f5c518" stroke-width="4" stroke-dasharray="4 2" fill="none"/>`;
      s += `<circle cx="${cx}" cy="${f(chainBot + 7)}" r="8" fill="#f5c518" stroke="${ink}" stroke-width="2.8"/><path d="M${cx} ${f(chainBot + 2)}v10M${f(cx + 2.6)} ${f(chainBot + 4)}q-5 -1.5 -5 1.4q0 2 2.6 2.3q2.6 .3 2.6 2.4q0 3 -5.4 1.6" stroke="${ink}" stroke-width="1.6" fill="none"/>`;
    }
    if (!back && eq.cou === "medaille") {
      const by = yS + 26 + 4 * m + pd * .4;
      s += `<path d="M${f(cx - neckH - 2)} ${f(nkTop + 8)}L${f(cx - 3)} ${f(by)}L${f(cx - 10)} ${f(nkTop + 8)}Z" fill="#3a86ff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/><path d="M${f(cx + neckH + 2)} ${f(nkTop + 8)}L${f(cx + 3)} ${f(by)}L${f(cx + 10)} ${f(nkTop + 8)}Z" fill="#e63946" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
      s += `<circle cx="${cx}" cy="${f(by + 8)}" r="10" fill="#f5c518" stroke="${ink}" stroke-width="3"/><path d="M${f(cx - 2)} ${f(by + 4)}l3 -2v12" stroke="#8a6200" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    }
    if (!back && eq.cou === "sifflet") {
      const wy = chainBot + 2;
      s += `<path d="M${f(cx - neckH)} ${f(nkTop + 8)}Q${f(cx - 2)} ${f(wy + 8)} ${f(cx + 2)} ${f(wy)}M${f(cx + neckH)} ${f(nkTop + 8)}Q${f(cx + 4)} ${f(wy + 4)} ${f(cx + 2)} ${f(wy)}" stroke="#e63946" stroke-width="2.4" fill="none"/>`;
      s += `<rect x="${f(cx - 3)}" y="${f(wy)}" width="15" height="9" rx="4" fill="#cfd6dd" stroke="${ink}" stroke-width="2.4"/><circle cx="${f(cx + 7)}" cy="${f(wy + 4.5)}" r="2" fill="${ink}"/>`;
    }
    if (eq.cou === "serviette") {
      const x0 = cx - neckH - 2, x1 = cx - SW + 6;
      s += `<path d="M${f(x0 + 6)} ${f(nkTop + 2)}Q${f((x0 + x1) / 2)} ${f(trapTop - 4)} ${f(x1 - 6)} ${f(yS + 2)}L${f(x1 + 4)} ${f(yS + 40)}L${f(x1 + 22)} ${f(yS + 38)}L${f(x1 + 14)} ${f(yS + 8)}Q${f((x0 + x1) / 2 + 4)} ${f(trapTop + 10)} ${f(x0 + 10)} ${f(nkTop + 14)}Z" fill="#f4f4f8" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(x1 + 5)} ${f(yS + 30)}l16 -2M${f(x1 + 4)} ${f(yS + 25)}l16 -2" stroke="#3a86ff" stroke-width="2.4"/>`;
    }
    const neckCurve = t => { const a = [cx - neckH - 2, nkTop + 10], c = [cx, yS + 38 + 4 * m], b = [cx + neckH + 2, nkTop + 10]; return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]; };
    if (!back && eq.cou === "lei") {
      const cols = ["#ff2e88", "#ffd23f", "#ff7b00", "#b14dff", "#fff"];
      for (let i = 0; i <= 12; i++) { const q = neckCurve(i / 12), c = cols[i % 5]; s += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="6.5" fill="${c}" stroke="${ink}" stroke-width="1.8"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r="2" fill="#ffe14d"/>`; }
    }
    if (!back && eq.cou === "requin") {
      const cp = `M${f(cx - neckH - 2)} ${f(nkTop + 10)}Q${cx} ${f(yS + 38 + 4 * m)} ${f(cx + neckH + 2)} ${f(nkTop + 10)}`;
      s += `<path d="${cp}" stroke="#6b3b1f" stroke-width="2.6" fill="none"/>`;
      for (let i = 1; i < 10; i++) { const q = neckCurve(i / 10), big = i === 5 ? 1.6 : 1; s += `<path d="M${f(q[0] - 3.5 * big)} ${f(q[1])}L${f(q[0])} ${f(q[1] + 10 * big)}L${f(q[0] + 3.5 * big)} ${f(q[1])}Z" fill="#fffdf2" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`; }
    }
    if (!back && eq.cou === "papillon") {
      const y = nkTop + 12, x = cx;
      s += `<path d="M${x} ${f(y)}L${f(x - 15)} ${f(y - 8)}L${f(x - 15)} ${f(y + 8)}ZM${x} ${f(y)}L${f(x + 15)} ${f(y - 8)}L${f(x + 15)} ${f(y + 8)}Z" fill="#111" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><rect x="${f(x - 4)}" y="${f(y - 5)}" width="8" height="10" rx="2" fill="#e63946" stroke="${ink}" stroke-width="2"/>`;
    }
    // ---- bras
    const arms = [];
    for (const d of [-1, 1]) {
      const J = [cx + d * (SW - 5), yS + 12];
      const hipHand = [cx + d * (W + 3 + lat * .25), 150];
      let E, Hd, fx = false;
      if (pose === "flex" || (pose === "kiss" && d === 1)) { E = [J[0] + d * (24 + 16 * m), yS + 6]; Hd = [J[0] + d * (14 + 12 * m), yS - 34 - 6 * m]; fx = true; }
      else if (pose === "wave" && d === 1) { E = [J[0] + 26 + 8 * m, yS + 4]; Hd = [J[0] + 34 + 10 * m, yS - 38]; }
      else if (pose === "most") { E = [J[0] + d * (8 + 10 * m), yS + 46 + 4 * m]; Hd = [cx + d * (7 + 3 * m), yS + 70 + 6 * m]; }
      else if (pose === "back" || pose === "leg" || pose === "kiss") { E = [J[0] + d * (22 + 14 * m + lat * .5), yS + 36]; Hd = hipHand; }
      else { E = [J[0] + d * (5 + 13 * m + lat * .6), yS + 50]; Hd = [J[0] + d * (3 + 15 * m + lat * .6), yS + 86]; }
      arms.push({d, J, E, Hd, fx});
    }
    const bulge = A => {
      const mx = (A.J[0] + A.E[0]) / 2, my = (A.J[1] + A.E[1]) / 2;
      let px = -(A.E[1] - A.J[1]), py = A.E[0] - A.J[0];
      const l = Math.hypot(px, py) || 1; px /= l; py /= l;
      if (A.fx) { if (py > 0) { px = -px; py = -py; } } else if (px * A.d < 0) { px = -px; py = -py; }
      return A.fx ? [mx + px * UA * .28, my + py * UA * .28, UA * .5 + 3 + 9 * m * kb] : [mx + px * UA * .2, my + py * UA * .2, UA * .44 + 2 + 5 * m * kb];
    };
    const popeye = kb > 1.15 && m > .12;
    const fore = A => { const c = lerp(A.E, A.Hd, .38); return [c[0], c[1], FA * .62 + 2]; };
    const handR = 8 + 6 * m + 3 * Math.max(0, kb - 1);
    for (const A of arms) {
      const b = bulge(A);
      s += `<path d="M${pt(A.J)}L${pt(A.E)}" stroke="${ink}" stroke-width="${f(UA + 6)}" stroke-linecap="round"/><path d="M${pt(A.E)}L${pt(A.Hd)}" stroke="${ink}" stroke-width="${f(FA + 6)}" stroke-linecap="round"/>`;
      if (m > .2 || kb > 1.15) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2] + 3)}" fill="${ink}"/>`;
      if (popeye) { const c = fore(A); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2] + 3)}" fill="${ink}"/>`; }
      s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR)}" fill="${ink}"/>`;
    }
    for (const A of arms) {
      const b = bulge(A);
      s += `<path d="M${pt(A.J)}L${pt(A.E)}" stroke="${skin}" stroke-width="${f(UA)}" stroke-linecap="round"/><path d="M${pt(A.E)}L${pt(A.Hd)}" stroke="${skin}" stroke-width="${f(FA)}" stroke-linecap="round"/>`;
      if (m > .2 || kb > 1.15) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2])}" fill="${skin}"/>`;
      if (popeye) { const c = fore(A); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2])}" fill="${skin}"/>`; }
      s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR - 2.5)}" fill="${skin}"/>`;
      if (m > .8 || (kb > 1.4 && m > .3)) { // veines
        const o = Math.min(1, Math.max((m - .8) / .3, (kb - 1.3) * 2));
        s += `<path d="M${f(b[0] - 4)} ${f(b[1] - b[2] * .5)}q6 6 0 12q-5 6 3 12" stroke="#6d8fd0" stroke-width="2.4" fill="none" opacity="${f(o)}" stroke-linecap="round"/>`;
        if (popeye) { const c = fore(A); s += `<path d="M${f(c[0] - 3)} ${f(c[1] - c[2] * .5)}q5 5 0 10q-4 5 2 9" stroke="#6d8fd0" stroke-width="2.2" fill="none" opacity="${f(o)}" stroke-linecap="round"/>`; }
      }
      if (look.acc === "bandeau" && !eq.poignets) s += `<rect x="${f(A.Hd[0] - FA * .55)}" y="${f((A.E[1] + A.Hd[1]) / 2 + (A.Hd[1] - A.E[1]) * .25 - 4)}" width="${f(FA * 1.1)}" height="8" rx="3" fill="${look.topColor}" stroke="${ink}" stroke-width="2"/>`;
      // tatouages
      const ang = Math.atan2(A.E[1] - A.J[1], A.E[0] - A.J[0]) * 180 / Math.PI;
      if (eq.peau === "tribal" && A.d === -1) {
        const c = lerp(A.J, A.E, .5), w = UA * .5;
        s += `<g transform="translate(${pt(c)}) rotate(${f(ang + 90)})"><path d="M${f(-w)} ${f(-w * .2)}l${f(w * .35)} ${f(-w * .5)}l${f(w * .25)} ${f(w * .45)}l${f(w * .4)} ${f(-w * .6)}l${f(w * .4)} ${f(w * .6)}l${f(w * .25)} ${f(-w * .45)}l${f(w * .35)} ${f(w * .5)}M${f(-w * .8)} ${f(w * .35)}q${f(w * .8)} ${f(-w * .5)} ${f(w * 1.6)} 0" stroke="${ink}" stroke-width="${f(2 + UA * .06)}" fill="none" stroke-linejoin="round" stroke-linecap="round"/></g>`;
      }
      if (eq.peau === "maman" && A.d === 1) {
        const c = lerp(A.J, A.E, .5), k = Math.max(.55, UA / 30);
        s += `<g transform="translate(${pt(c)}) scale(${f(k)})"><path d="M0 4C-9 -3 -8 -11 -3 -11Q0 -11 0 -7Q0 -11 3 -11C8 -11 9 -3 0 4Z" fill="#e63946" stroke="${ink}" stroke-width="1.5"/><rect x="-11" y="-6" width="22" height="7" rx="1" fill="#fff7d6" stroke="${ink}" stroke-width="1.2"/><text x="0" y="-0.6" font-size="5.4" font-family="Anton,Impact,sans-serif" text-anchor="middle" fill="${ink}">MAMAN</text></g>`;
      }
      // poignets
      const w0 = lerp(A.E, A.Hd, .68), w1 = lerp(A.E, A.Hd, .84);
      if (eq.poignets === "pognet") s += `<path d="M${pt(w0)}L${pt(w1)}" stroke="${ink}" stroke-width="${f(FA + 8)}"/><path d="M${pt(w0)}L${pt(w1)}" stroke="#fdfdfd" stroke-width="${f(FA + 3)}"/><path d="M${pt(lerp(w0, w1, .5))}L${pt(lerp(w0, w1, .62))}" stroke="#e63946" stroke-width="${f(FA + 3)}"/>`;
      if (eq.poignets === "clous") {
        s += `<path d="M${pt(w0)}L${pt(w1)}" stroke="${ink}" stroke-width="${f(FA + 8)}"/><path d="M${pt(w0)}L${pt(w1)}" stroke="#2b2b33" stroke-width="${f(FA + 3)}"/>`;
        const mid = lerp(w0, w1, .5), dx = -(w1[1] - w0[1]), dy = w1[0] - w0[0], l = Math.hypot(dx, dy) || 1;
        for (let i = -1; i <= 1; i++) s += `<circle cx="${f(mid[0] + dx / l * i * FA * .32)}" cy="${f(mid[1] + dy / l * i * FA * .32)}" r="${f(1.6 + FA * .05)}" fill="#e8ecf2" stroke="${ink}" stroke-width="1"/>`;
      }
      if (eq.poignets === "gants") {
        const gr2 = handR + 6;
        s += `<path d="M${pt(lerp(A.E, A.Hd, .72))}L${pt(A.Hd)}" stroke="${ink}" stroke-width="${f(FA + 10)}"/><path d="M${pt(lerp(A.E, A.Hd, .74))}L${pt(A.Hd)}" stroke="#fff" stroke-width="${f(FA + 5)}"/>`;
        s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(gr2)}" fill="#d62828" stroke="${ink}" stroke-width="3.5"/><ellipse cx="${f(A.Hd[0] - gr2 * .3)}" cy="${f(A.Hd[1] - gr2 * .35)}" rx="${f(gr2 * .32)}" ry="${f(gr2 * .2)}" fill="#fff" opacity=".55"/>`;
      }
      if (eq.peau === "huile") s += `<ellipse cx="${f(b[0] - b[2] * .3)}" cy="${f(b[1] - b[2] * .35)}" rx="${f(b[2] * .32)}" ry="${f(b[2] * .16)}" fill="#fff" opacity=".75" transform="rotate(-30 ${f(b[0] - b[2] * .3)} ${f(b[1] - b[2] * .35)})"/><circle cx="${f(A.J[0])}" cy="${f(A.J[1] - UA * .2)}" r="${f(2 + UA * .08)}" fill="#fff" opacity=".8"/>`;
    }
    // ---- objet tenu dans la main droite (côté d = 1)
    if (eq.main) {
      const A2 = arms[1], [hx3, hy3] = A2.Hd, k = handR / 12;
      let it = "";
      if (eq.main === "haltere") {
        const bl = handR + 16;
        it = `<path d="M${f(hx3 - bl)} ${f(hy3)}H${f(hx3 + bl)}" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><path d="M${f(hx3 - bl)} ${f(hy3)}H${f(hx3 + bl)}" stroke="#c9d1d8" stroke-width="3.4"/>`;
        for (const d of [-1, 1]) it += `<rect x="${f(hx3 + d * (bl - 4) - 6)}" y="${f(hy3 - 11 - 2 * k)}" width="12" height="${f(22 + 4 * k)}" rx="3" fill="#2b2b33" stroke="${ink}" stroke-width="2.6"/><rect x="${f(hx3 + d * (bl + 5) - 3.5)}" y="${f(hy3 - 7 - k)}" width="7" height="${f(14 + 2 * k)}" rx="2" fill="#e63946" stroke="${ink}" stroke-width="2.2"/>`;
      } else if (eq.main === "glace") {
        it = `<path d="M${f(hx3 - 9 * k)} ${f(hy3 - handR * .4)}L${f(hx3)} ${f(hy3 + handR + 10)}L${f(hx3 + 9 * k)} ${f(hy3 - handR * .4)}Z" fill="#e3a857" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(hx3 - 6 * k)} ${f(hy3 - handR * .1)}l${f(10 * k)} ${f(8 * k)}M${f(hx3 + 6 * k)} ${f(hy3 - handR * .1)}l${f(-10 * k)} ${f(8 * k)}" stroke="#b07a35" stroke-width="1.6"/>`;
        [["#ff8fc8", 0], ["#fff3d6", 1], ["#7a4a22", 2]].forEach(([c, i]) => { it += `<circle cx="${f(hx3 + (i % 2 ? 2 : -1))}" cy="${f(hy3 - handR * .5 - 8 * k - i * 11 * k)}" r="${f(9 * k + 1)}" fill="${c}" stroke="${ink}" stroke-width="2.6"/>`; });
        it += `<circle cx="${f(hx3 + 2)}" cy="${f(hy3 - handR * .5 - 38 * k)}" r="3.2" fill="#e63946" stroke="${ink}" stroke-width="1.6"/>`;
      } else if (eq.main === "shakerm") {
        const sw2 = 11 * k + 4, top = hy3 - handR - 46 * k;
        it = `<path d="M${f(hx3 - sw2)} ${f(top + 12)}H${f(hx3 + sw2)}L${f(hx3 + sw2 * .85)} ${f(hy3 + handR * .6)}H${f(hx3 - sw2 * .85)}Z" fill="#ff8fc8" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round"/><rect x="${f(hx3 - sw2 - 2)}" y="${f(top)}" width="${f(sw2 * 2 + 4)}" height="13" rx="4" fill="#2b2b33" stroke="${ink}" stroke-width="2.6"/><rect x="${f(hx3 - 3)}" y="${f(top - 8)}" width="6" height="9" rx="2" fill="#2b2b33" stroke="${ink}" stroke-width="2"/><text x="${f(hx3)}" y="${f(top + 30 * k)}" font-size="${f(7 * k + 2)}" font-family="Anton,Impact,sans-serif" text-anchor="middle" fill="${ink}">XXL</text>`;
      } else if (eq.main === "trophee") {
        const cw = 13 * k + 4, top = hy3 - handR - 40 * k;
        it = `<path d="M${f(hx3 - 3)} ${f(top + 26 * k)}V${f(hy3 + handR)}M${f(hx3 + 3)} ${f(top + 26 * k)}V${f(hy3 + handR)}" stroke="${ink}" stroke-width="3"/><rect x="${f(hx3 - 3)}" y="${f(top + 24 * k)}" width="6" height="${f(hy3 + handR - top - 24 * k)}" fill="#f5c518"/>`;
        it += `<path d="M${f(hx3 - cw)} ${f(top)}H${f(hx3 + cw)}Q${f(hx3 + cw)} ${f(top + 28 * k)} ${f(hx3)} ${f(top + 28 * k)}Q${f(hx3 - cw)} ${f(top + 28 * k)} ${f(hx3 - cw)} ${f(top)}Z" fill="#f5c518" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(hx3 - cw)} ${f(top + 4)}q${f(-9 * k)} 2 ${f(-6 * k)} ${f(12 * k)}q2 4 ${f(7 * k)} 3M${f(hx3 + cw)} ${f(top + 4)}q${f(9 * k)} 2 ${f(6 * k)} ${f(12 * k)}q-2 4 ${f(-7 * k)} 3" stroke="${ink}" stroke-width="2.6" fill="none"/>${star(hx3 - cw * .3, top + 9 * k, 3.5, "#fff8c2")}<text x="${f(hx3 + 1)}" y="${f(top + 15 * k)}" font-size="${f(9 * k)}" font-family="Anton,Impact,sans-serif" text-anchor="middle" fill="#8a6200">1</text>`;
      }
      s += it;
      // le poing par-dessus (sauf gants de boxe, déjà par-dessus)
      if (eq.poignets === "gants") s += `<circle cx="${f(hx3)}" cy="${f(hy3)}" r="${f(handR + 6)}" fill="#d62828" stroke="${ink}" stroke-width="3.5"/>`;
      else s += `<circle cx="${f(hx3)}" cy="${f(hy3)}" r="${f(handR - .5)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>`;
    }
    if (eq.peau === "marbre") for (const A of arms) { const c = lerp(A.J, A.E, .45); s += `<path d="M${f(c[0] - 4)} ${f(c[1] - UA * .3)}q6 6 1 12t5 12" stroke="#9a9ca3" stroke-width="1.5" fill="none" opacity=".75"/>`; }
    if (eq.peau === "doree") for (const A of arms) { const c = lerp(A.J, A.E, .5); s += star(c[0] - UA * .15, c[1] - UA * .2, 4 + UA * .08, "#fff8c2"); }
    if (back) s += dosItem();
    if (eq.peau === "huile" && !back) s += `<ellipse cx="${f(cx - SW * .32)}" cy="${f(yS + 20 + pd * .4)}" rx="${f(4 + SW * .1)}" ry="3" fill="#fff" opacity=".6"/><ellipse cx="${f(cx + SW * .32)}" cy="${f(yS + 20 + pd * .4)}" rx="${f(4 + SW * .1)}" ry="3" fill="#fff" opacity=".6"/>`;

    // ---- tête
    const hx = cx, hy = headY, r = headR;
    s += `<circle cx="${f(hx - r + 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/><circle cx="${f(hx + r - 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/>`;
    s += `<circle cx="${hx}" cy="${f(hy)}" r="${f(r)}" fill="${skin}" stroke="${ink}" stroke-width="4.5"/>`;
    if (eq.visage === "catcheur") {
      s += `<path d="M${f(hx - r - 1)} ${f(hy + r * .35)}A${f(r + 1)} ${f(r + 1)} 0 1 1 ${f(hx + r + 1)} ${f(hy + r * .35)}Q${hx} ${f(hy + r * .15)} ${f(hx - r - 1)} ${f(hy + r * .35)}Z" fill="#8338ec" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (back) s += `<path d="M${hx} ${f(hy - r * .7)}V${f(hy + r * .3)}" stroke="#ffd23f" stroke-width="3" stroke-dasharray="4 3"/>`;
      else {
        s += `<path d="M${hx} ${f(hy - r)}L${f(hx - 5)} ${f(hy - r * .55)}H${f(hx + 5)}Z" fill="#ffd23f" stroke="${ink}" stroke-width="2"/>`;
        for (const d of [-1, 1]) s += `<path d="M${f(hx + d * 2)} ${f(hy - r * .2)}Q${f(hx + d * r * .75)} ${f(hy - r * .55)} ${f(hx + d * r * .78)} ${f(hy + r * .05)}Q${f(hx + d * r * .4)} ${f(hy + r * .22)} ${f(hx + d * 2)} ${f(hy - r * .2)}Z" fill="#fff" stroke="#ffd23f" stroke-width="2.6" stroke-linejoin="round"/>`;
      }
    }
    const hc = look.hairColor;
    if (back) {
      // vue de dos : cheveux à l'arrière du crâne, pas de visage
      if (look.hair === "afro") s += `<circle cx="100" cy="${f(headY - 4)}" r="${f(headR + 13)}" fill="${hc}" stroke="${ink}" stroke-width="4"/>`;
      else if (look.hair !== "chauve" && look.hair !== "crete") s += `<path d="M${f(hx - r - 1)} ${f(hy + r * .3)}Q${f(hx - r - 2)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r + 2)} ${f(hy - r - 8)} ${f(hx + r + 1)} ${f(hy + r * .3)}Q${hx} ${f(hy + r * .6)} ${f(hx - r - 1)} ${f(hy + r * .3)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (look.hair === "queue") s += `<path d="M${f(hx - 5)} ${f(hy - r * .2)}q-6 30 0 50q10 -16 10 -50z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
      if (look.hair === "chignon") s += `<circle cx="${hx}" cy="${f(hy - r * .2)}" r="11" fill="${hc}" stroke="${ink}" stroke-width="4"/>`;
      if (look.hair === "crete") s += `<path d="M${f(hx - 9)} ${f(hy - r + 4)}l-4 -20 9 8 4 -22 6 21 8 -16 -2 29z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${hx} ${f(hy - r)}V${f(hy + r * .8)}" stroke="${hc}" stroke-width="7"/>`;
      if (look.hair === "chauve") s += `<ellipse cx="${f(hx + r * .3)}" cy="${f(hy - r * .55)}" rx="${f(r * .3)}" ry="${f(r * .13)}" fill="#fff" opacity=".5"/>`;
      if (eq.tete === "mulet") s += `<path d="M${f(hx - r * .9)} ${f(hy + r * .2)}Q${f(hx - r - 6)} ${f(hy + r + 16)} ${f(hx - neckH - 10)} ${f(yS + 6)}L${f(hx + neckH + 10)} ${f(yS + 6)}Q${f(hx + r + 6)} ${f(hy + r + 16)} ${f(hx + r * .9)} ${f(hy + r * .2)}Z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
      if (look.acc === "bandeau" || eq.tete === "bandana" || eq.tete === "eponge") {
        const col = eq.tete === "eponge" ? "#fdfdfd" : eq.tete === "bandana" ? "#d62828" : look.topColor;
        s += `<path d="M${f(hx - r - 1)} ${f(hy - r * .42)}Q${hx} ${f(hy - r * .2)} ${f(hx + r + 1)} ${f(hy - r * .42)}" stroke="${col}" stroke-width="8" fill="none"/>`;
        if (eq.tete === "bandana") s += `<path d="M${hx} ${f(hy - r * .3)}l-12 22 7 2zM${hx} ${f(hy - r * .3)}l10 24 6 -4z" fill="#d62828" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
      }
    } else {
      if (look.acc === "barbe") s += `<path d="M${f(hx - r + 3)} ${f(hy + 2)}Q${f(hx - r + 4)} ${f(hy + r + 8)} ${hx} ${f(hy + r + 10)}Q${f(hx + r - 4)} ${f(hy + r + 8)} ${f(hx + r - 3)} ${f(hy + 2)}Q${hx} ${f(hy + r * .6)} ${f(hx - r + 3)} ${f(hy + 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="3.5"/>`;
      // visage
      const ey = hy - r * .05, ex = r * .38;
      const flush = m > 1.05 || pose === "most";
      if (flush) s += `<circle cx="${f(hx - r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity="${pose === "most" ? ".7" : ".45"}"/><circle cx="${f(hx + r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity="${pose === "most" ? ".7" : ".45"}"/>`;
      if (look.acc === "lunettes" && !eq.visage) s += `<path d="M${f(hx - r * .82)} ${f(ey - 4)}h${f(r * 1.64)}" stroke="${ink}" stroke-width="3"/><rect x="${f(hx - r * .78)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/><rect x="${f(hx + r * .12)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/>`;
      else if (eq.visage === "aviateur") {
        s += `<path d="M${f(hx - r * .9)} ${f(ey - 5)}h${f(r * 1.8)}" stroke="#c99a1e" stroke-width="2.4"/>`;
        for (const d of [-1, 1]) { const x = hx + d * r * .42; s += `<path d="M${f(x - r * .34)} ${f(ey - 6)}h${f(r * .68)}q0 ${f(r * .48)} ${f(-r * .34)} ${f(r * .48)}q${f(-r * .34)} 0 ${f(-r * .34)} ${f(-r * .48)}z" fill="#3b2d55" stroke="#c99a1e" stroke-width="2.4" stroke-linejoin="round"/><path d="M${f(x - r * .22)} ${f(ey - 3)}l${f(r * .14)} ${f(r * .2)}" stroke="#ffb3e6" stroke-width="2" opacity=".8"/>`; }
      } else if (eq.visage === "coeur") {
        s += `<path d="M${f(hx - r * .9)} ${f(ey - 3)}h${f(r * 1.8)}" stroke="${ink}" stroke-width="2.4"/>`;
        for (const d of [-1, 1]) { const x = hx + d * r * .42, k = r / 22; s += `<path transform="translate(${f(x)} ${f(ey + 1)}) scale(${f(k)})" d="M0 7C-12 -1 -10 -10 -4 -10Q0 -10 0 -5Q0 -10 4 -10C10 -10 12 -1 0 7Z" fill="#ff2e63" stroke="${ink}" stroke-width="2.4"/>`; }
      } else if (pose === "kiss") {
        s += `<path d="M${f(hx - ex - 4)} ${f(ey)}q4 -4 8 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="${f(hx + ex)}" cy="${f(ey)}" r="3.4" fill="${ink}"/>`;
      } else s += `<circle cx="${f(hx - ex)}" cy="${f(ey)}" r="${f(m < .3 ? 4.2 : 3.4)}" fill="${ink}"/><circle cx="${f(hx + ex)}" cy="${f(ey)}" r="${f(m < .3 ? 4.2 : 3.4)}" fill="${ink}"/><circle cx="${f(hx - ex + 1.2)}" cy="${f(ey - 1.3)}" r="1.2" fill="#fff"/><circle cx="${f(hx + ex + 1.2)}" cy="${f(ey - 1.3)}" r="1.2" fill="#fff"/>`;
      // sourcils : inquiets quand maigre, froncés quand énorme (ou en plein effort)
      const bt = pose === "most" ? -5 : m < .3 ? 4 : m > .9 ? -4 : 0;
      const gOff = eq.visage === "aviateur" || eq.visage === "coeur" ? 3 : 0;
      s += `<path d="M${f(hx - ex - 6)} ${f(ey - 9 + bt - gOff)}L${f(hx - ex + 5)} ${f(ey - 9 - bt - gOff)}M${f(hx + ex + 6)} ${f(ey - 9 + bt - gOff)}L${f(hx + ex - 5)} ${f(ey - 9 - bt - gOff)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
      if (eq.visage === "guerre") s += `<path d="M${f(hx - ex - 6)} ${f(ey + 6)}h11M${f(hx - ex - 6)} ${f(ey + 10)}h11M${f(hx + ex - 5)} ${f(ey + 6)}h11M${f(hx + ex - 5)} ${f(ey + 10)}h11" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M${hx} ${f(ey - r * .55)}v${f(r * .35)}" stroke="#d62828" stroke-width="3.4" stroke-linecap="round"/>`;
      const my = hy + r * .45;
      const grin = pose === "most" || eq.visage === "dentor" || (m >= .9 && pose !== "kiss");
      if (pose === "kiss") s += `<ellipse cx="${f(hx + 2)}" cy="${f(my)}" rx="4.6" ry="5.2" fill="#ff5d8a" stroke="${ink}" stroke-width="2.4"/><path d="M${f(hx + 1)} ${f(my - 2)}q3 2 0 4" stroke="${ink}" stroke-width="1.6" fill="none"/>`;
      else if (grin) {
        s += `<path d="M${f(hx - 10)} ${f(my - 3)}h20q-2 10 -10 10t-10 -10z" fill="#fff" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(hx - 9)} ${f(my + 1)}h18" stroke="${ink}" stroke-width="1.5"/>`;
        if (eq.visage === "dentor") s += `<rect x="${f(hx + 1)}" y="${f(my - 2.2)}" width="5" height="3.6" fill="#f5c518" stroke="${ink}" stroke-width="1"/>${star(hx + 7, my - 5, 3, "#fff6a8")}`;
      } else if (m < .3) s += `<path d="M${f(hx - 6)} ${f(my + 2)}q3 -4 6 0t6 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      else s += `<path d="M${f(hx - 8)} ${f(my - 1)}q8 8 16 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      if (look.acc === "moustache" && eq.visage !== "moust70") s += `<path d="M${f(hx - 12)} ${f(my - 2)}q6 -8 12 -3q6 -5 12 3q-6 4 -12 0q-6 4 -12 0z" fill="${hc}" stroke="${ink}" stroke-width="2.5"/>`;
      if (eq.visage === "moust70") s += `<path d="M${hx} ${f(my - 7)}q-9 -4 -14 2q-2 3 -2 14q0 4 3 4q2 0 2 -6q0 -7 4 -9q4 -2 7 -1q3 -1 7 1q4 2 4 9q0 6 2 6q3 0 3 -4q0 -11 -2 -14q-5 -6 -14 -2z" fill="${hc}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (eq.visage === "clown") s += `<circle cx="${hx}" cy="${f(hy + r * .2)}" r="${f(r * .24 + 1)}" fill="#ff1f3d" stroke="${ink}" stroke-width="2.6"/><circle cx="${f(hx - r * .07)}" cy="${f(hy + r * .13)}" r="${f(r * .07)}" fill="#fff" opacity=".8"/>`;
      if (eq.visage === "plongee") {
        s += `<path d="M${f(hx - r - 1)} ${f(ey - 2)}H${f(hx + r + 1)}" stroke="#111" stroke-width="5"/><rect x="${f(hx - r * .8)}" y="${f(ey - r * .38)}" width="${f(r * 1.6)}" height="${f(r * .66)}" rx="${f(r * .3)}" fill="#8fe3ff" fill-opacity=".45" stroke="#ff7b00" stroke-width="4"/><path d="M${f(hx - r * .55)} ${f(ey - r * .22)}l${f(r * .2)} ${f(r * .3)}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
        s += `<path d="M${f(hx + r * .55)} ${f(my + 2)}H${f(hx + r + 6)}V${f(hy - r - 14)}" stroke="${ink}" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M${f(hx + r * .55)} ${f(my + 2)}H${f(hx + r + 6)}V${f(hy - r - 14)}" stroke="#ffd23f" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (m < .15) s += `<path d="M${f(hx + r * .85)} ${f(hy - r * .5)}q5 8 0 11q-5 -3 0 -11z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.8"/>`; // goutte de sueur
      if (pose === "most") s += `<path d="M${f(hx - r * .45)} ${f(hy - r * .72)}q4 3 2 7q4 -2 6 2" stroke="#6d8fd0" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; // veine du front

      // ---- coiffure avant
      if (look.hair === "court" || look.hair === "queue") s += `<path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r)} ${f(hy - r - 8)} ${f(hx + r + 1)} ${f(hy - 2)}Q${f(hx + r * .4)} ${f(hy - r * .55)} ${f(hx - r * .2)} ${f(hy - r * .45)}Q${f(hx - r * .7)} ${f(hy - r * .3)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (look.hair === "crete") s += `<path d="M${f(hx - 9)} ${f(hy - r + 4)}l-4 -20 9 8 4 -22 6 21 8 -16 -2 29z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
      if (look.hair === "chignon") s += `<circle cx="${hx}" cy="${f(hy - r - 8)}" r="11" fill="${hc}" stroke="${ink}" stroke-width="4"/><path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 6)} ${hx} ${f(hy - r - 4)}Q${f(hx + r)} ${f(hy - r - 6)} ${f(hx + r + 1)} ${f(hy - 2)}Q${hx} ${f(hy - r * .5)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (look.hair === "afro") s += `<path d="M${f(hx - r)} ${f(hy - 4)}Q${hx} ${f(hy - r * .55)} ${f(hx + r)} ${f(hy - 4)}" stroke="${hc}" stroke-width="6" fill="none"/>`;
      if (look.hair === "chauve") s += `<ellipse cx="${f(hx - r * .35)}" cy="${f(hy - r * .6)}" rx="${f(r * .3)}" ry="${f(r * .13)}" fill="#fff" opacity=".5" transform="rotate(-25 ${f(hx - r * .35)} ${f(hy - r * .6)})"/>`;
      if (look.acc === "bandeau" && eq.tete !== "bandana" && eq.tete !== "eponge") s += `<path d="M${f(hx - r - 1)} ${f(hy - r * .42)}Q${hx} ${f(hy - r * .72)} ${f(hx + r + 1)} ${f(hy - r * .42)}" stroke="${look.topColor}" stroke-width="7" fill="none"/><path d="M${f(hx + r - 2)} ${f(hy - r * .45)}l14 -2 -4 9z" fill="${look.topColor}" stroke="${ink}" stroke-width="2"/>`;
      if (look.acc === "casquette" && !eq.tete) s += `<path d="M${f(hx - r - 1)} ${f(hy - 3)}Q${f(hx - r)} ${f(hy - r - 9)} ${hx} ${f(hy - r - 7)}Q${f(hx + r)} ${f(hy - r - 9)} ${f(hx + r + 1)} ${f(hy - 3)}Z" fill="${look.topColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M${f(hx - r - 2)} ${f(hy - 4)}q-14 -2 -18 4q12 4 20 0z" fill="${shade(look.topColor, .75)}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
      if (eq.tete === "bandana") s += `<path d="M${f(hx - r - 1)} ${f(hy - r * .4)}Q${hx} ${f(hy - r * .75)} ${f(hx + r + 1)} ${f(hy - r * .4)}" stroke="${ink}" stroke-width="11" fill="none"/><path d="M${f(hx - r - 1)} ${f(hy - r * .4)}Q${hx} ${f(hy - r * .75)} ${f(hx + r + 1)} ${f(hy - r * .4)}" stroke="#d62828" stroke-width="7" fill="none"/><path d="M${f(hx + r - 1)} ${f(hy - r * .42)}q14 2 22 14q-8 0 -14 -6q2 10 -4 18q-2 -12 -6 -20z" fill="#d62828" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (eq.tete === "eponge") s += `<path d="M${f(hx - r - 1)} ${f(hy - r * .45)}Q${hx} ${f(hy - r * .8)} ${f(hx + r + 1)} ${f(hy - r * .45)}" stroke="${ink}" stroke-width="13" fill="none"/><path d="M${f(hx - r - 1)} ${f(hy - r * .45)}Q${hx} ${f(hy - r * .8)} ${f(hx + r + 1)} ${f(hy - r * .45)}" stroke="#fdfdfd" stroke-width="9" fill="none" stroke-dasharray="2 1.5"/><path d="M${f(hx - r)} ${f(hy - r * .45)}Q${hx} ${f(hy - r * .8)} ${f(hx + r)} ${f(hy - r * .45)}" stroke="#3a86ff" stroke-width="2.2" fill="none"/>`;
    }
    // couvre-chefs visibles de face comme de dos
    if (eq.tete === "casqenv") {
      s += `<path d="M${f(hx - r - 1)} ${f(hy - 3)}Q${f(hx - r)} ${f(hy - r - 9)} ${hx} ${f(hy - r - 7)}Q${f(hx + r)} ${f(hy - r - 9)} ${f(hx + r + 1)} ${f(hy - 3)}Z" fill="#3a86ff" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (back) s += `<path d="M${f(hx - r * .6)} ${f(hy - 4)}q${f(r * .6)} 14 ${f(r * 1.2)} 0z" fill="#2563c9" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
      else s += `<path d="M${f(hx - r * .25)} ${f(hy - r * .7)}h${f(r * .5)}v${f(r * .3)}h${f(-r * .5)}z" fill="#ffd23f" stroke="${ink}" stroke-width="2"/><path d="M${f(hx + r * .55)} ${f(hy - r - 2)}q8 -12 22 -10q-4 8 -16 14z" fill="#2563c9" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    if (eq.tete === "viking") {
      s += `<path d="M${f(hx - r - 3)} ${f(hy - r * .2)}Q${f(hx - r - 2)} ${f(hy - r - 10)} ${hx} ${f(hy - r - 9)}Q${f(hx + r + 2)} ${f(hy - r - 10)} ${f(hx + r + 3)} ${f(hy - r * .2)}Z" fill="#9aa5b1" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M${f(hx - r - 3)} ${f(hy - r * .3)}h${f(2 * r + 6)}" stroke="#c99a1e" stroke-width="6"/><path d="M${hx} ${f(hy - r - 8)}V${f(hy - r * .3)}" stroke="#c99a1e" stroke-width="4"/>`;
      for (const d of [-1, 1]) s += `<path d="M${f(hx + d * (r - 2))} ${f(hy - r * .55)}q${f(d * 14)} -2 ${f(d * 18)} -24q${f(d * 3)} 16 ${f(-d * 6)} 30z" fill="#fff6dc" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    if (eq.tete === "couronne") {
      const y0 = hy - r * .62, w = r * .9;
      s += `<path d="M${f(hx - w)} ${f(y0)}L${f(hx - w - 3)} ${f(y0 - 16)}L${f(hx - w * .5)} ${f(y0 - 7)}L${hx} ${f(y0 - 19)}L${f(hx + w * .5)} ${f(y0 - 7)}L${f(hx + w + 3)} ${f(y0 - 16)}L${f(hx + w)} ${f(y0)}Z" fill="#f5c518" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="${hx}" cy="${f(y0 - 5)}" r="3.4" fill="#e63946" stroke="${ink}" stroke-width="1.5"/><circle cx="${f(hx - w * .55)}" cy="${f(y0 - 3)}" r="2.4" fill="#3a86ff"/><circle cx="${f(hx + w * .55)}" cy="${f(y0 - 3)}" r="2.4" fill="#2ec27e"/>${star(hx + w + 4, y0 - 20, 4, "#fffbe0")}`;
    }

    if (eq.tete === "disco" && back) s += discoWig();
    if (eq.tete === "bonnetbain") {
      s += `<path d="M${f(hx - r - 2)} ${f(hy + 2)}Q${f(hx - r - 2)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r + 2)} ${f(hy - r - 8)} ${f(hx + r + 2)} ${f(hy + 2)}Q${hx} ${f(hy - r * .5)} ${f(hx - r - 2)} ${f(hy + 2)}Z" fill="#fff" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      [[-.45, -.55, "#ff2e88"], [.2, -.8, "#ffd23f"], [.55, -.35, "#2fa8ff"], [-.1, -.3, "#3ccf8e"]].forEach(([a, b, c]) => { const x = hx + a * r, y = hy + b * r; for (let k = 0; k < 5; k++) s += `<circle cx="${f(x + Math.cos(k * 1.257) * 4)}" cy="${f(y + Math.sin(k * 1.257) * 4)}" r="3.4" fill="${c}" stroke="${ink}" stroke-width="1.2"/>`; s += `<circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="#ffe14d"/>`; });
    }
    if (eq.tete === "laurier") {
      for (const d of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = Math.PI * (.95 - i * .085), x = hx + d * Math.cos(a) * -(r + 2), y = hy - r * .25 - Math.sin(a) * r * .1 - i * r * .13;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="6.5" ry="3.2" fill="${i % 2 ? "#5cb85c" : "#3f9b3f"}" stroke="${ink}" stroke-width="1.6" transform="rotate(${f(d * (-30 - i * 12))} ${f(x)} ${f(y)})"/>`;
      }
      s += `<circle cx="${hx}" cy="${f(hy - r * .98)}" r="3" fill="#f5c518" stroke="${ink}" stroke-width="1.4"/>`;
    }
    if (eq.tete === "cornes") for (const d of [-1, 1]) s += `<path d="M${f(hx + d * r * .35)} ${f(hy - r * .88)}Q${f(hx + d * r * .55)} ${f(hy - r - 16)} ${f(hx + d * r * .9)} ${f(hy - r - 22)}Q${f(hx + d * r * .8)} ${f(hy - r - 6)} ${f(hx + d * r * .75)} ${f(hy - r * .62)}Z" fill="#d62828" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
    if (eq.tete === "aureole") {
      const ay = hy - r - 14;
      s += `<ellipse cx="${hx}" cy="${f(ay)}" rx="${f(r * .95)}" ry="${f(r * .28)}" fill="none" stroke="#fff3a0" stroke-width="12" opacity=".35"/><ellipse cx="${hx}" cy="${f(ay)}" rx="${f(r * .9)}" ry="${f(r * .25)}" fill="none" stroke="${ink}" stroke-width="7"/><ellipse cx="${hx}" cy="${f(ay)}" rx="${f(r * .9)}" ry="${f(r * .25)}" fill="none" stroke="#ffd23f" stroke-width="4"/>`;
    }
    if (eq.peau === "doree") s += star(hx - r * .45, hy - r * .55, 4, "#fff8c2") + star(cx + SW * .3, yS + 22, 5, "#fff8c2");
    // ---- extras de pose
    if (pose === "kiss") {
      const A = arms[1], b = bulge(A);
      s += `<path transform="translate(${f(b[0] + 6)} ${f(b[1] - b[2] - 12)}) scale(1.1)" d="M0 7C-12 -1 -10 -10 -4 -10Q0 -10 0 -5Q0 -10 4 -10C10 -10 12 -1 0 7Z" fill="#ff2e63" stroke="${ink}" stroke-width="2.2"/>`;
      s += `<path transform="translate(${f(b[0] - 2)} ${f(b[1] - 2)}) rotate(-15)" d="M-5 0q2.5 -3 5 0q2.5 -3 5 0q-2.5 4 -5 1q-2.5 3 -5 -1z" fill="#ff5d8a" opacity=".85"/>`;
    }
    s += `</svg>`;
    return s;
  }

  // Plus il est musclé, plus le perso prend de place à l'écran : ×1 (0 XP) → ×8 (2 000 XP et plus).
  // Un cran tous les 100 XP, progression géométrique : ×8^(L/20), soit ≈ +11 % par palier, ×8 au niveau 20.
  const size = xp => Math.pow(8, level(xp) / MAX_LEVEL);
  G.avatar = {svg, tier, muscle, size, SKINS, HAIR_COLORS, HAIR_STYLES, CLOTH, TOPS, ACCS, TIERS, DEFAULT_LOOK,
    LEVEL_XP, MAX_LEVEL, level, groups, skipLegDay, RARITIES, SLOTS, ITEMS, ITEM, equipped, POSES};
})();
