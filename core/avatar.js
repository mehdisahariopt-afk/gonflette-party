/* Gonflette Party : personnage qui prend du muscle avec l'expérience.
   GONFLETTE.avatar.svg(look, xp, {pose, view, m}) renvoie une chaîne SVG.
   pose : "idle" | "flex" (double biceps) | "most" (most muscular) | "kiss" (bisou au biceps) | "back" (pose de dos) | "leg" (flex de jambe) | "wave".
   look peut porter (facultatif, rétrocompatible) :
     look.mg = ancien choix de groupes musculaires : ignoré (tout le monde est équilibré)
     look.it = ["bandana", "chaine", ...] objets de la boutique équipés (un par emplacement ; « arme » = main gauche)
   opts.fx = true : dessine aussi l'effet de l'arme (pose dans le lobby) ; opts.out = {} reçoit out.fx (onomatopée, position du bout de l'arme). */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  const SKINS = ["#f6d2b8", "#eebe98", "#d9a27a", "#b97b54", "#8d5a3b", "#5e3a26"];
  const HAIR_COLORS = ["#25201f", "#6b4226", "#c8562b", "#e3bb4f", "#dcd8d0", "#d6337a", "#2f7fd6"];
  const HAIR_STYLES = [["court", "Court"], ["crete", "Crête"], ["queue", "Queue"], ["afro", "Afro"], ["chignon", "Chignon"], ["chauve", "Chauve"], ["dreads", "Dreads"], ["manbun", "Man bun"], ["degrade", "Afro dégradée"]];
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
  // Continu : chaque XP compte, une victoire (+100 XP) se voit un peu à chaque fois.
  function muscle(xp) {
    xp = Math.max(0, Math.min(MAX_LEVEL * LEVEL_XP, +xp || 0));
    return xp <= 1500 ? xp / 1500 : 1 + (xp - 1500) / 500 * 0.35;
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
  const SLOTS = [["tete", "Tête", "🧢"], ["animal", "Compagnons", "🐾"], ["haut", "Tenues", "👕"], ["taille", "Taille", "🩳"], ["pieds", "Chaussures", "👟"], ["visage", "Visage", "🕶️"], ["cou", "Cou", "📿"], ["main", "Main", "🏋️"], ["arme", "Armes", "🔫"], ["poignets", "Poignets", "⌚"], ["peau", "Peau", "🖋️"], ["dos", "Dos", "🦸"], ["aura", "Aura", "✨"]];
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
    ["ombre", "aura", "Ombre infernale", "legendaire", "Votre ombre fait plus de pompes que vous."],
    // --- collection « Trucs de fou » : armes de dessin animé (jouets, mousse et paillettes), tenues dans la main gauche
    ["pistolet", "arme", "Pistolet à bouchon", "commun", "Pop ! Le bouchon revient toujours, ficelle comprise."],
    ["grenade", "arme", "Grenade-ananas", "commun", "Explose de vitamines. Ne pas dégoupiller dans le shaker."],
    ["poele", "arme", "Poêle à frire", "commun", "Œuf au plat compris. Le petit-déj des champions."],
    ["boomerang", "arme", "Boomerang", "commun", "Comme vos courbatures : il revient toujours."],
    ["fouet", "arme", "Fouet", "commun", "Clac ! Le coach version dompteur de lions."],
    ["laserchat", "arme", "Laser pointeur de chat", "commun", "L'arme absolue contre les chats. Et les félins du vestiaire."],
    ["bang", "arme", "Revolver « BANG ! »", "rare", "Le drapeau sort tout seul. Effet garanti au vestiaire."],
    ["pistoeau", "arme", "Pistolet à eau XXL", "rare", "10 litres de fraîcheur. Brushing ruiné offert."],
    ["couteau", "arme", "Couteau de boucher géant", "rare", "Pour découper les steaks de la prise de masse."],
    ["suisse", "arme", "Couteau suisse géant", "rare", "37 fonctions, dont un tire-bouchon à whey."],
    ["batte", "arme", "Batte à clous en mousse", "rare", "Clous en caoutchouc : bonk garanti, bobo jamais."],
    ["arc", "arme", "Arc à ventouses", "rare", "Tchak ! La flèche colle partout, surtout sur le front des rivaux."],
    ["nunchaku", "arme", "Nunchaku", "rare", "Watâââ ! La vitesse de Bruce, les biceps en plus."],
    ["massue", "arme", "Haltère-massue", "rare", "L'haltère des cavernes. Ouga ouga, curl."],
    ["hache", "arme", "Hache de viking", "rare", "Pour fendre les bûches et les records."],
    ["fleau", "arme", "Fléau d'arme en mousse", "rare", "Une boule à pics toute douce. Bonk !"],
    ["katana", "arme", "Katana", "epique", "Tranche les excuses en deux. Shling !"],
    ["tronco", "arme", "Tronçonneuse en carton", "epique", "Vrrrr ! 100 % carton, 100 % menaçante."],
    ["flamme", "arme", "Lance-flammes à paillettes", "epique", "Des flammes de paillettes arc-en-ciel : ça ne brûle pas, ça brille."],
    ["bouclier", "arme", "Bouclier étoilé", "epique", "Renvoie toutes les blagues sur vos mollets."],
    ["trident", "arme", "Trident", "epique", "Le dieu des mers ne saute jamais la séance dos."],
    ["canontshirt", "arme", "Canon à T-shirts", "epique", "Pompf ! Un T-shirt GONFLETTE pour le public."],
    ["thor", "arme", "Marteau de Thor", "legendaire", "Seuls les dignes (et les gros biceps) peuvent le soulever."],
    ["laser", "arme", "Sabre laser", "legendaire", "Vzzzoum. Le côté obscur de la gonflette."],
    ["minigun", "arme", "Minigun à confettis", "legendaire", "Ratatata ! 6 000 confettis à la minute."],
    ["carquois", "dos", "Carquois à ventouses", "commun", "Plein de flèches qui font pouic."],
    ["fourreau", "dos", "Katana dans le dos", "rare", "Le style ninja, version fin de séance."],
    ["roquette", "dos", "Lance-roquettes", "legendaire", "Sur l'épaule, comme un sac de sport. Boum !"],
    // --- collection « Swag » : tenues complètes, bas, chaussures, bling-bling
    ["hoodie", "haut", "Sweat à capuche", "commun", "Capuche, cordons, poche kangourou : la panoplie Rocky."],
    ["maillot", "haut", "Maillot de foot n°10", "commun", "Le numéro des artistes. Et des gros mollets."],
    ["crop", "haut", "Crop top « GAINS »", "commun", "Pour montrer des abdos. Les vôtres, de préférence."],
    ["chemhaw", "haut", "Chemise hawaïenne", "rare", "Ouverte jusqu'au nombril, évidemment."],
    ["surv80", "haut", "Survêtement 80s", "rare", "Bruissant, brillant, fluo : l'aérobic n'est jamais mort."],
    ["kimono", "haut", "Kimono de judo", "rare", "Ceinture noire de développé couché."],
    ["filet", "haut", "Débardeur filet", "rare", "Aération maximale, pudeur minimale."],
    ["smoking", "haut", "Smoking et nœud pap'", "epique", "Tenue de gala obligatoire pour la remise du trophée."],
    ["luchador", "haut", "Tenue de luchador", "epique", "Masque, collants à flammes et prise du suplex."],
    ["jogging", "taille", "Jogging gris", "commun", "Le pantalon officiel du jour de jambes (et du canapé)."],
    ["shortbain", "taille", "Short de bain pastèque", "commun", "Juteux, frais, et très, très voyant."],
    ["legging", "taille", "Legging léopard", "rare", "Rugissement garanti à la presse à cuisses."],
    ["kilt", "taille", "Kilt écossais", "epique", "Highland Games, catégorie lancer de tronc."],
    ["retro", "pieds", "Baskets montantes rétro", "commun", "Style 1985, maintien de cheville béton."],
    ["fluos", "pieds", "Baskets fluo", "commun", "Visibles depuis l'espace."],
    ["claquettes", "pieds", "Claquettes-chaussettes", "commun", "Le summum du confort. Et du style, selon vous."],
    ["crampons", "pieds", "Crampons de foot", "commun", "Chaussettes hautes et protège-tibias compris."],
    ["mocassins", "pieds", "Mocassins et chaussettes blanches", "commun", "Le style tonton au mariage de la cousine."],
    ["powerlift", "pieds", "Chaussures d'haltéro", "rare", "Talon en bois, squat de légende."],
    ["crocs", "pieds", "Crocs à breloques", "rare", "Douze breloques, zéro honte."],
    ["boxe", "pieds", "Bottines de boxe", "rare", "Légères comme un papillon, lourdes comme une enclume."],
    ["talons", "pieds", "Talons aiguilles", "rare", "12 cm de talon, 120 kg de muscles."],
    ["pantoufles", "pieds", "Pantoufles lapin", "rare", "Séance du dimanche matin, en peignoir."],
    ["moonboot", "pieds", "Moon boots", "rare", "Un petit pas pour l'homme, un grand pas pour la gonflette."],
    ["led", "pieds", "Baskets lumineuses", "epique", "Chaque pas est une boîte de nuit."],
    ["cowboyor", "pieds", "Santiags en or", "epique", "Yeehaw, version lingot."],
    ["bob", "tete", "Bob de pêcheur", "commun", "Pêche aux gains, été comme hiver."],
    ["bonnet", "tete", "Bonnet à pompon", "commun", "Pour la séance en extérieur. En décembre."],
    ["durag", "tete", "Durag", "commun", "Les vagues, c'est dans les cheveux."],
    ["snapback", "tete", "Snapback dorée", "rare", "L'étiquette reste sur la visière. Obligatoire."],
    ["cretefluo", "tete", "Crête fluo", "rare", "Punk's not dead. Vos biceps non plus."],
    ["lunstar", "visage", "Lunettes étoiles", "commun", "La star de la salle, c'est vous."],
    ["grillz", "visage", "Grillz en diamant", "epique", "Un sourire à 100 000 carats."],
    ["casque", "cou", "Casque audio", "rare", "Playlist « PR ou hôpital »."],
    ["chainexxl", "cou", "Chaîne XXL « GAINS »", "legendaire", "Plus lourde qu'un disque de 20. C'est le but."],
    ["bagues", "poignets", "Bagues bling", "rare", "Un diamant par phalange."],
    ["montre", "poignets", "Montre en or", "epique", "Toujours l'heure de la séance."],
    ["sacsport", "dos", "Sac de sport", "commun", "Contient : serviette, shaker et trois chaussettes orphelines."],
    ["boombox", "main", "Boombox", "rare", "Le son à fond, comme vos séries."],
    // --- compagnons : ils suivent leur maître partout (à côté des pieds, ou sur l'épaule)
    ["chihua", "animal", "Chihuahua en survêtement", "commun", "Tremble de rage. Ou de froid. Personne ne sait."],
    ["chatjuge", "animal", "Chat qui juge", "commun", "Il a vu votre squat. Il n'a rien dit. C'est pire."],
    ["tortue", "animal", "Tortue haltérophile", "commun", "Lentement mais sûrement. Surtout lentement."],
    ["poulet", "animal", "Poulet « skip leg day »", "commun", "Pecs en béton, pilons en allumettes."],
    ["pigeon", "animal", "Pigeon de la plage", "commun", "Lunettes de soleil, frite volée : le roi de Muscle Beach."],
    ["crabe", "animal", "Crabe culturiste", "commun", "Que des pinces, jamais de jambes."],
    ["lapin", "animal", "Lapin pliométrique", "commun", "Box jumps toute la journée."],
    ["bulldog", "animal", "Bulldog bodybuildé", "rare", "Bandana, mâchoire carrée, jamais sauté un jour de bras."],
    ["perroquet", "animal", "Perroquet coach", "rare", "Perché sur l'épaule, il ne connaît qu'un mot : GAINS !"],
    ["hamster", "animal", "Hamster dans sa roue", "rare", "Cardio illimité, zéro jour de repos."],
    ["pingouin", "animal", "Pingouin du vestiaire", "rare", "Toujours en tenue de soirée, même sous la douche."],
    ["alpaga", "animal", "Alpaga zen", "rare", "Crache sur ceux qui ne rangent pas leurs poids."],
    ["golden", "animal", "Golden retriever au frisbee", "rare", "Le meilleur partenaire : il rapporte tout, même vos haltères."],
    ["raton", "animal", "Raton laveur voleur de barres", "rare", "Votre barre protéinée ? Quelle barre protéinée ?"],
    ["panda", "animal", "Panda en prise de masse", "epique", "Bambou au petit-déj, bambou au goûter, bambou au dîner."],
    ["requinl", "animal", "Requin en laisse", "epique", "Il a sa bouée, vous avez vos bras : chacun ses flotteurs."],
    ["poulpe", "animal", "Poulpe aux 8 haltères", "epique", "Huit bras, huit curls. Record de la salle."],
    ["dragon", "animal", "Mini-dragon", "legendaire", "Crache du feu sur les échauffements bâclés."],
    ["licorne", "animal", "Licorne arc-en-ciel", "legendaire", "Aussi rare qu'un jour de jambes réussi."],
    ["trex", "animal", "T-rex aux petits bras", "legendaire", "Roi des dinosaures, incapable de faire une pompe."]
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
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pt = q => f(q[0]) + " " + f(q[1]);
  const star = (x, y, r, fill) => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * .18)} ${f(y - r * .18)} ${f(x + r)} ${f(y)}Q${f(x + r * .18)} ${f(y + r * .18)} ${f(x)} ${f(y + r)}Q${f(x - r * .18)} ${f(y + r * .18)} ${f(x - r)} ${f(y)}Q${f(x - r * .18)} ${f(y - r * .18)} ${f(x)} ${f(y - r)}Z" fill="${fill}"/>`;

  /* ---------- finitions : ombres douces, reflets et traits effilés ----------
     Tout ce qui se pose sur la peau est NEUTRE (noir ou blanc translucide), jamais une teinte dérivée de la peau :
     les formes de prestige recolorent la peau en remplaçant la couleur exacte look.skin. Chaque famille (encre,
     ombre, reflet) est regroupée en un seul <path> à plusieurs sous-chemins pour garder la chaîne SVG légère. */
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const rot = (v, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  // fuseau de a à b galbé par le point c, épaisseur w au milieu (trait « à la plume » qui s'affine aux bouts)
  const tap = (a, c, b, w) => { const [ux, uy] = nrm(a, b), nx = -uy * w, ny = ux * w; return `M${pt(a)}Q${f(c[0] + nx)} ${f(c[1] + ny)} ${pt(b)}Q${f(c[0] - nx)} ${f(c[1] - ny)} ${pt(a)}Z`; };
  // ombre collée au bord d'un membre (segment a→b, demi-largeur R) du côté n (normale unitaire), épaisseur w au milieu
  const rim = (a, b, R, w, n) => { const a1 = add(a, n, R), b1 = add(b, n, R), mid = add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n, R - 2 * w); return `M${pt(a1)}L${pt(b1)}Q${pt(mid)} ${pt(a1)}Z`; };
  // croissant dans un disque (centre c, rayon R) du côté de l'angle ang (degrés), épaisseur t·R
  const moon = (c, R, ang, t) => { const a = ang * Math.PI / 180, v = [Math.sin(a), -Math.cos(a)], A = add(c, v, R), B = add(c, v, -R);
    return `M${pt(A)}A${f(R)} ${f(R)} 0 0 1 ${pt(B)}A${f(R)} ${f(R * (1 - t))} ${f(Math.atan2(v[1], v[0]) * 180 / Math.PI)} 0 0 ${pt(A)}Z`; };
  // ombres et reflets arrondis à l'unité, traits d'encre au demi-point : la chaîne reste compacte
  // compacte un chemin (M L Q A Z absolus, a q l relatifs) : coordonnées arrondies (unité, ou demi-point si fine)
  // puis réécrites en relatif à partir des valeurs arrondies (pas de dérive)
  const compact = (d, k) => {
    const tk = String(d).match(/[A-Za-z]|-?\d*\.?\d+/g) || [], R = v => Math.round(v * k) / k;
    const nb = v => { const s2 = String(Math.round(v * k) / k || 0); return s2.charCodeAt(0) === 48 && s2.length > 1 ? s2.slice(1) : s2.startsWith("-0.") ? "-" + s2.slice(2) : s2; };
    let o = "", x = 0, y = 0, sx = 0, sy = 0, i = 0, c = "";
    const put = (cmd, arr) => { o += cmd; arr.forEach((v, j) => { const s2 = nb(v); o += (j && s2[0] !== "-" ? " " : "") + s2; }); };
    while (i < tk.length) {
      if (tk[i].charCodeAt(0) > 64) { c = tk[i++]; if (c === "Z" || c === "z") { o += "z"; x = sx; y = sy; continue; } }
      const n = j => +tk[i + j];
      if (c === "M") { x = sx = R(n(0)); y = sy = R(n(1)); put("M", [x, y]); i += 2; c = "L"; }
      else if (c === "L") { const X = R(n(0)), Y = R(n(1)); put("l", [X - x, Y - y]); x = X; y = Y; i += 2; }
      else if (c === "Q") { const X = R(n(2)), Y = R(n(3)); put("q", [R(n(0)) - x, R(n(1)) - y, X - x, Y - y]); x = X; y = Y; i += 4; }
      else if (c === "A") { const X = R(n(5)), Y = R(n(6)); put("a", [n(0), n(1), Math.round(n(2)), n(3), n(4), X - x, Y - y]); x = X; y = Y; i += 7; }
      else if (c === "a") { put("a", [n(0), n(1), Math.round(n(2)), n(3), n(4), n(5), n(6)]); x += R(n(5)); y += R(n(6)); i += 7; }
      else if (c === "q") { put("q", [n(0), n(1), n(2), n(3)]); x += R(n(2)); y += R(n(3)); i += 4; }
      else if (c === "l") { put("l", [n(0), n(1)]); x += R(n(0)); y += R(n(1)); i += 2; }
      else return String(d).replace(/-?\d*\.\d+/g, v => R(+v));
    }
    return o;
  };
  const paint = (d, col, op, fine) => d ? `<path d="${compact(d, fine ? 2 : 1)}" fill="${col}"${op != null ? ` opacity="${String(op).replace(/^0\./, ".")}"` : ""}/>` : "";
  // côté « ombre » d'un segment : la normale qui regarde vers l'intérieur du corps et vers le bas
  const shadeN = (a, b, d) => { const [ux, uy] = nrm(a, b), n = [-uy, ux]; return n[0] * -d + n[1] * .8 >= 0 ? n : [uy, -ux]; };

  /* ---------- armes rigolotes (jouets, mousse, paillettes : rien de sanglant) ----------
     Emplacement « arme » : tenue dans la main gauche (à gauche de l'image) ; « dos » : lance-roquettes sur l'épaule,
     katana dans le dos, carquois. Chaque arme est dessinée dans un repère local : poignée à l'origine (sous le poing),
     l'arme pointe vers +x, unités prévues pour un poing de rayon 12. Le repère est tourné selon la pose, mis à
     l'échelle de la main (grandit avec le perso) et réduit si besoin pour rester dans le cadre du SVG. */
  const INK = "#1d1420";
  function wtools(sw) {
    const st = m => ` stroke="${INK}" stroke-width="${f(sw * (m == null ? 1 : m))}"`;
    const T = {
      P: (d, fill, m) => `<path d="${d}" fill="${fill}"${m === 0 ? "" : st(m)} stroke-linejoin="round" stroke-linecap="round"/>`,
      R: (x, y, w, h, r, fill, m) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"${m === 0 ? "" : st(m)}/>`,
      C: (x, y, r, fill, m) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${m === 0 ? "" : st(m)}/>`,
      E: (x, y, rx, ry, fill, m) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${m === 0 ? "" : st(m)}/>`,
      L: (d, col, w, ex) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${ex || ""}/>`,
      // ligne épaisse cernée d'encre
      LI: (d, col, w) => T.L(d, INK, w + sw * 2) + T.L(d, col, w),
      S5: (x, y, r, fill, m) => { let d = ""; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; d += (i ? "L" : "M") + f(x + Math.cos(a) * rr) + " " + f(y + Math.sin(a) * rr); } return T.P(d + "Z", fill, m); },
      grip: (col) => T.P("M-7 -3L7 -3L11 19Q11 24 6 24H-2Q-7 24 -7 19Z", col)
    };
    return T;
  }
  // c : classe d'angles (gun = pointé devant, long = lame levée, up = toujours droit) ; bb : boîte englobante locale ;
  // tip : bout de l'arme (effets) ; fx : [onomatopée, couleur, type d'effet]
  // boîte englobante d'une arme dont une partie pend (nunchaku, fléau) : dépend de l'angle de la main
  const hangBB = (r, hx, L, x1) => { const a = r * Math.PI / 180, ex = hx + L * Math.sin(a), ey = L * Math.cos(a); return [Math.min(-14, ex - 22), Math.min(-7, ey - 22), Math.max(x1, ex + 22), Math.max(7, ey + 22)]; };
  const WEAPONS = {
    pistolet: {c: "gun", k: 1.2, bb: [-20, -24, 56, 25], tip: [54, -12], fx: ["POP !", "#ffd23f", "gun"], draw: (T) =>
      T.grip("#8a4b20") + T.P("M-12 -16l-7 -6l5 -3l7 5z", "#5c5466") + T.R(-13, -19, 31, 14, 5, "#ff6b35") + T.R(16, -17, 28, 10, 3, "#ffd23f") + T.R(39, -18, 6, 12, 2, "#e63946")
      + T.L("M51 -9Q40 6 22 -4", "#fff", 1.4, ` stroke-dasharray="3 2"`) + T.R(45, -16, 9, 8, 2, "#d9a066") + T.S5(2, -12, 4, "#fff", .5)},
    bang: {c: "gun", k: 1.1, bb: [-14, -50, 106, 28], tip: [74, -15], fx: ["BANG !", "#ff2e63", "gun"], draw: (T, o) =>
      T.grip("#6b3b1f") + T.E(2, 11, 3, 6, "#f1e6d0", .5) + T.P("M-15 -22H18V-6H-10Z", "#9aa5b1") + T.R(-3, -25, 19, 19, 6, "#7c8794") + T.L("M3 -24V-8M9 -24V-8", INK, 1.6)
      + T.R(16, -20, 42, 9, 2, "#c9d1d8") + T.R(52, -24, 4, 5, 1, "#c9d1d8", .6) + T.L("M58 -15H74", INK, 2.6)
      + o.up(74, -15, T.R(-26, 2, 52, 26, 3, "#fff8e7") + T.R(-26, 2, 52, 5, 1, "#ff2e63", .5) + `<text x="0" y="22" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="14" fill="#ff2e63" stroke="${INK}" stroke-width=".6">BANG !</text>`)},
    pistoeau: {c: "gun", bb: [-24, -42, 74, 26], tip: [72, -8], fx: ["SPLASH !", "#5fc6ff", "splash"], draw: (T) =>
      T.grip("#ffd23f") + T.E(-4, -27, 17, 11, "#5fc6ff") + T.E(-9, -30, 7, 3, "#e9f9ff", 0) + T.R(-8, -42, 7, 6, 2, "#ff6b35")
      + T.P("M-22 -16H52Q58 -16 58 -10V-4Q58 2 52 2H-16Q-22 2 -22 -4Z", "#39d353") + T.L("M-14 -10H44", "#b6ffc2", 2.4)
      + T.R(26, 2, 22, 8, 3, "#ff6b35") + T.R(58, -13, 11, 10, 2, "#ff6b35") + T.R(68, -10, 4, 5, 1, "#ffd23f", .6)},
    couteau: {c: "long", bb: [-22, -12, 76, 36], tip: [64, 20], fx: ["SHLING !", "#e9f6ff", "blade"], draw: (T) =>
      T.R(-20, -6, 32, 12, 5, "#7a4a22") + T.C(-12, 0, 1.8, "#e8ecf2", .4) + T.C(0, 0, 1.8, "#e8ecf2", .4) + T.R(10, -8, 6, 16, 2, "#b9c3cc")
      + T.P("M15 -10H70Q75 -10 75 -5V29Q75 34 70 34H20Q15 34 15 29Z", "#d6dde5") + T.L("M20 30H70", "#fff", 3) + T.C(65, -2, 3.6, "#4a4452", .6) + T.L("M26 2L34 22", "#fff", 3, ` opacity=".7"`)},
    suisse: {c: "gun", bb: [-20, -36, 90, 11], tip: [84, -7], fx: ["CLIC-CLIC !", "#ff5a5f", "blade"], draw: (T) =>
      T.L("M-10 -8q-4 -4 0 -7q4 -3 0 -7q-4 -4 0 -7", "#b9c3cc", 3) + T.P("M22 -8L28 -32L33 -31L30 -8Z", "#dfe5ec") + T.L("M25 -16l3 1M26 -22l3 1M27 -27l3 1", INK, 1.2)
      + T.P("M36 -5L84 -12Q90 -6 84 -1L36 3Z", "#e6ebf1") + T.L("M40 0L82 -4", "#fff", 1.8)
      + T.R(-17, -8, 57, 16, 8, "#d62828") + T.P("M9 -5h4v3h3v4h-3v3h-4v-3h-3v-4h3z", "#fff", 0) + T.C(36, 0, 2.6, "#c9d1d8", .5)},
    katana: {c: "long", bb: [-24, -14, 138, 12], tip: [134, -9], fx: ["SHLING !", "#e9f6ff", "blade"], draw: (T) => {
      let w = T.R(-19, -5, 36, 10, 4, INK, 0);
      for (let i = 0; i < 5; i++) w += T.P(`M${-15 + i * 7} -5l3.5 5l-3.5 5l-3.5 -5z`, "#f1f1f1", 0);
      return T.R(-22, -4.5, 5, 9, 1.5, "#f5c518") + w + T.P("M21 -4H120Q131 -6 136 -12Q131 2 120 4H21Z", "#e6ebf1") + T.L("M24 2H118Q127 1 133 -8", "#fff", 1.8)
        + T.L("M26 -1q5 -2 10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0", "#a9b4c2", 1.1) + T.E(18, 0, 4, 11, "#f5c518");
    }},
    tronco: {c: "gun", bb: [-16, -42, 106, 10], tip: [102, -7], fx: ["VRRRR !", "#ff7b00", "blade"], draw: (T) =>
      T.R(31, -15, 72, 16, 8, "#c9d1d8") + `<rect x="29" y="-17" width="76" height="20" rx="10" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="3 2.5"/>`
      + T.R(-11, -26, 44, 32, 9, "#ff7b00") + T.LI("M0 -26Q8 -40 24 -26", "#2b2b33", 4) + T.L("M6 -16h20M6 -10h20", "#c45500", 2.5)
      + T.R(-6, -4, 22, 8, 2, "#e8d3a8", .6) + T.C(-9, -14, 3.2, "#ffd23f", .6)},
    batte: {c: "long", bb: [-26, -28, 114, 28], tip: [100, 0], fx: ["BONK !", "#b14dff", "blunt"], draw: (T) => {
      let w = "";
      for (const x of [48, 66, 84, 100]) { const e = 5 + (x - 10) * .095; for (const d of [-1, 1]) w += T.P(`M${x - 5} ${f(d * (e - 1))}L${x} ${f(d * (e + 10))}L${x + 5} ${f(d * (e - 1))}Z`, "#ffd23f", .7); }
      return w + T.P("M-16 -4L10 -5Q60 -8 100 -14Q112 -14 112 0Q112 14 100 14Q60 8 10 5L-16 4Q-20 0 -16 -4Z", "#b14dff") + T.L("M14 -2Q60 -4 100 -9", "#d9a3ff", 3)
        + T.R(-19, -5, 26, 10, 4, INK, 0) + T.L("M-15 -5l4 10M-9 -5l4 10M-3 -5l4 10", "#5c5466", 1.4) + T.E(-21, 0, 3, 7, "#b14dff");
    }},
    thor: {c: "long", k: 1.05, bb: [-36, -36, 72, 36], tip: [41, 0], fx: ["KRAKOOM !", "#7fe7ff", "zap"], draw: (T) =>
      T.L("M-22 0q-11 -2 -13 8q4 8 13 0", "#6b3b1f", 2.6) + T.R(-23, -4.5, 50, 9, 3, "#8a4b20") + T.L("M-16 -4l4 9M-8 -4l4 9M0 -4l4 9M8 -4l4 9", "#5a3418", 1.6)
      + T.R(24, -31, 35, 62, 6, "#9aa5b1") + T.R(28, -27, 27, 54, 4, "#c4ccd4", 0) + T.C(41.5, 0, 9, "none") + T.L("M34 -20h15M34 20h15", "#6b7480", 2)
      + T.L("M60 -24l8 4-5 3 9 5M60 22l9 -3-4 -3 9 -6", "#7fe7ff", 2.4)},
    laser: {c: "long", bb: [-20, -11, 150, 11], tip: [140, 0], fx: ["VZZOUM !", "#3ae0ff", "zap"], draw: (T) =>
      T.L("M20 0H138", "#3ae0ff", 19, ` opacity=".3"`) + T.L("M20 0H138", "#3ae0ff", 12) + T.L("M20 0H136", "#ffffff", 5)
      + T.R(-19, -6, 38, 12, 3, "#3b3f47") + T.R(-19, -7, 8, 14, 2, "#c9d1d8") + T.R(9, -7, 9, 14, 2, "#c9d1d8") + T.C(0, -6, 2.6, "#e63946", .5)},
    arc: {c: "gun", bb: [-28, -60, 64, 60], tip: [61, 0], fx: ["TCHAK !", "#e63946", "gun"], draw: (T) =>
      T.L("M-4 -56L-16 0L-4 56", "#f4f1ea", 1.5) + T.LI("M-4 -56Q32 -40 6 0Q32 40 -4 56", "#8a4b20", 4.5)
      + T.LI("M-16 0H50", "#ffd23f", 3) + T.P("M-16 0l-9 -7h9zM-16 0l-9 7h9z", "#e63946", .7) + T.R(48, -1.5, 6, 3, 1, "#e63946", 0) + T.P("M53 -8Q62 -8 62 0Q62 8 53 8Z", "#e63946")
      + T.R(-1, -8, 13, 16, 3, "#e63946")},
    grenade: {c: "up", k: 1.2, bb: [-17, -62, 27, 4], tip: [-10, -39], fx: ["BOUM ?", "#ffb703", "spark"], draw: (T) =>
      T.P("M4 -37L-5 -57L2 -45L4 -62L8 -45L14 -56L10 -37Z", "#3fae5a") + T.E(4, -20, 15, 19, "#e8a52a")
      + T.L("M-9 -29H17M-11 -21H19M-9 -13H17M-3 -37V-3M4 -39V-1M11 -37V-3", "#a86a10", 2) + T.E(-1, -27, 3, 5, "#ffe3a3", 0)
      + T.P("M14 -36Q25 -34 23 -13L18 -13Q19 -30 12 -32Z", "#9aa5b1") + T.L("M-6 -37H6", "#c9d1d8", 2.2) + T.C(-10, -39, 5, "none", .9)},
    flamme: {c: "gun", bb: [-24, -38, 78, 25], tip: [64, -9], fx: ["FWOOSH !", "#ff2e88", "fire"], draw: (T) =>
      T.grip("#ff2e88") + T.E(-6, -25, 16, 8, "#ffd23f") + T.R(-10, -35, 7, 5, 2, "#c9d1d8")
      + T.R(-22, -17, 66, 14, 7, "#ff8fc8") + T.S5(-8, -10, 3.2, "#fff", 0) + T.S5(8, -11, 2.5, "#ffd23f", 0) + T.S5(24, -9, 3, "#7fe7ff", 0)
      + T.P("M42 -19L60 -25V6L42 0Z", "#b14dff") + T.P("M61 -10q9 -10 4 -18q11 8 7 20q-5 5 -11 -2z", "#ffd23f", .7)},
    poele: {c: "long", bb: [-20, -30, 92, 30], tip: [62, 0], fx: ["BONG !", "#ffd23f", "blunt"], draw: (T) =>
      T.R(-19, -5, 54, 10, 5, "#2b2b33") + T.L("M-12 -2H28", "#5c5466", 2) + T.C(-12, 0, 2.4, "#5c5466", 0)
      + T.E(62, 0, 28, 27, "#2b2b33") + T.E(62, 0, 22, 21, "#4a4a55", 0) + T.P("M51 -10q10 -9 19 0q10 4 4 14q-6 8 -17 4q-12 -3 -6 -18z", "#fff", .7)
      + T.C(61, -1, 6, "#ffb703", .6) + T.C(59, -3, 2, "#fff", 0)},
    nunchaku: {c: "gun", k: 1.1, bb: r => hangBB(r, 42, 58, 44), tip: (r) => { const a = -r * Math.PI / 180; return [42 - Math.sin(a) * 50, Math.cos(a) * 50]; }, fx: ["WATAAA !", "#ffd23f", "blunt"], draw: (T, o) =>
      o.hang(42, 0, `<g transform="rotate(16)">${T.L("M0 0q4 7 0 14", "#9aa5b1", 2.6, ` stroke-dasharray="2.5 1.5"`)}${T.R(-5.5, 14, 11, 44, 4.5, INK, 0)}${T.R(-5.5, 20, 11, 3.5, 0, "#f5c518", 0)}${T.R(-5.5, 50, 11, 3.5, 0, "#f5c518", 0)}</g>`)
      + T.R(-12, -5.5, 54, 11, 4.5, INK, 0) + T.R(-6, -5.5, 3.5, 11, 0, "#f5c518", 0) + T.R(35, -5.5, 3.5, 11, 0, "#f5c518", 0) + T.L("M16 -3H32", "#5c5466", 1.6)},
    bouclier: {c: "up", front: true, bb: [-36, -36, 36, 36], tip: [0, 0], fx: ["DING !", "#7fe7ff", "blunt"], draw: (T) =>
      T.C(0, 0, 34, "#d62828", 1.2) + T.C(0, 0, 26, "#f4f4f4", 0) + T.C(0, 0, 18, "#d62828", 0) + T.C(0, 0, 11, "#2f6fdc", 0) + T.S5(0, .5, 9.5, "#fff", 0)
      + T.L("M-24 -18A30 30 0 0 1 -6 -29", "#fff", 3, ` opacity=".55"`)},
    minigun: {c: "gun", bb: [-24, -44, 94, 25], tip: [92, -9], fx: ["RATATATA !", "#ff2e88", "confetti"], draw: (T) => {
      let cf = "";
      const cols = ["#ff2e88", "#ffd23f", "#3ccf8e", "#2fa8ff", "#b14dff"];
      for (let i = 0; i < 9; i++) cf += T.R(-17 + (i * 7) % 22, -38 + (i * 5) % 13, 3.4, 2.2, .5, cols[i % 5], 0);
      return T.grip("#3b3f47") + T.R(-20, -41, 26, 19, 3, "#e9f6ff", .8) + cf + T.R(-19, -23, 47, 27, 8, "#8338ec") + T.LI("M-4 -23Q10 -36 22 -23", "#3b3f47", 3.5)
        + T.R(28, -20, 58, 21, 4, "#f5c518") + T.L("M30 -14H86M30 -9H86M30 -4H86", "#b8860b", 1.8) + T.R(84, -22, 7, 25, 2, "#3b3f47") + T.R(26, -22, 6, 25, 2, "#3b3f47") + T.S5(2, -10, 5, "#ffd23f", .5);
    }},
    massue: {c: "long", bb: [-22, -28, 106, 28], tip: [80, 0], fx: ["BONK !", "#ff2e88", "blunt"], draw: (T) =>
      T.R(-20, -4, 120, 8, 3, "#c9d1d8") + T.R(46, -14, 8, 28, 3, "#2b2b33") + T.R(55, -19, 9, 38, 3, "#e63946") + T.R(65, -23, 10, 46, 3, "#2b2b33")
      + T.R(76, -26, 11, 52, 4, "#2f6fdc") + T.R(88, -23, 9, 46, 3, "#2b2b33") + T.R(98, -8, 6, 16, 2, "#c9d1d8") + T.L("M79 -22V-4", "#8fbaff", 2)},
    hache: {c: "long", bb: [-22, -44, 108, 33], tip: [104, -6], fx: ["SHLAK !", "#e9f6ff", "blade"], draw: (T) =>
      T.P("M-17 -4L86 -4Q90 0 86 4L-17 4Q-21 0 -17 -4Z", "#8a4b20") + T.R(-15, -5, 22, 10, 2, "#3b2414", .6)
      + T.P("M70 -6Q78 -41 105 -41Q96 -8 105 30Q78 27 70 6Z", "#d6dde5") + T.L("M103 -38Q95 -6 103 27", "#fff", 2.6) + T.C(78, 0, 4, "#f5c518", .6)
      + T.L("M80 -22q6 4 4 10M80 18q6 -4 4 -10", "#9aa5b1", 1.6)},
    trident: {c: "long", k: .95, bb: [-50, -22, 144, 22], tip: [140, 0], fx: ["TCHAC !", "#ffd23f", "blade"], draw: (T) =>
      T.R(-42, -3.5, 144, 7, 3, "#f5c518") + T.C(-44, 0, 5, "#f5c518") + T.R(96, -17, 7, 34, 2, "#f5c518")
      + T.P("M102 -3H128L141 0L128 3H102Z", "#f5c518") + T.P("M100 -16H121L133 -20L123 -10H100Z", "#f5c518") + T.P("M100 16H121L133 20L123 10H100Z", "#f5c518")
      + T.L("M-8 -2H90", "#fff3a0", 1.6)},
    boomerang: {c: "long", bb: [-14, -48, 60, 48], tip: [50, -38], fx: ["WHOUUU !", "#ffd23f", "blunt"], draw: (T) =>
      T.P("M-6 -8L44 -40Q53 -45 55 -36L14 0L55 36Q53 45 44 40L-6 8Q-12 0 -6 -8Z", "#e3a857") + T.L("M22 -22l5 7M32 -28l5 7M42 -34l5 7M22 22l5 -7M32 28l5 -7M42 34l5 -7", "#e63946", 3)},
    fleau: {c: "gun", k: 1.1, bb: r => hangBB(r, 41, 64, 44), tip: (r) => { const a = -r * Math.PI / 180; return [41 - Math.sin(a) * 42, Math.cos(a) * 42]; }, fx: ["BONK !", "#ff8fc8", "blunt"], draw: (T, o) => {
      let b = "";
      for (let i = 0; i < 4; i++) b += T.E(0, 6 + i * 7, 2.6, 4, "none", .8);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = Math.cos(a), y = Math.sin(a); b += T.P(`M${f(x * 12 - y * 4)} ${f(42 + y * 12 + x * 4)}L${f(x * 21)} ${f(42 + y * 21)}L${f(x * 12 + y * 4)} ${f(42 + y * 12 - x * 4)}Z`, "#ffd23f", .7); }
      b += T.C(0, 42, 14, "#ff8fc8") + T.C(-4, 37, 4, "#ffd1ea", 0);
      return o.hang(41, 0, `<g transform="rotate(10)">${b}</g>`) + T.R(-12, -5, 50, 10, 4, "#8a4b20") + T.L("M14 -2H32", "#c98a4b", 2) + T.R(35, -6, 7, 12, 2, "#9aa5b1");
    }},
    canontshirt: {c: "gun", bb: [-28, -40, 86, 25], tip: [80, -13], fx: ["POMPF !", "#3ccf8e", "tshirt"], draw: (T) =>
      T.grip("#3b3f47") + T.R(-22, -38, 31, 10, 5, "#c9d1d8") + T.C(13, -33, 5, "#fff", .7) + T.L("M13 -33l2 -3", "#e63946", 1.4)
      + T.R(-26, -25, 96, 23, 10, "#e63946") + T.L("M-16 -19H60", "#ff8a8f", 2.6) + T.R(68, -28, 8, 29, 3, "#f5c518") + T.E(79, -13, 6, 9, "#3ccf8e", .8)},
    fouet: {c: "gun", bb: [-16, -12, 124, 24], tip: [118, 8], fx: ["CLAC !", "#ffd23f", "blade"], draw: (T) =>
      T.LI("M16 0C40 -4 52 18 76 14S104 -10 114 6", "#8a4b20", 3.4) + T.L("M114 6l7 4", "#c9a46a", 2.2) + T.R(-14, -5, 32, 10, 4, "#6b3b1f") + T.L("M-9 -5l3 10M-3 -5l3 10M3 -5l3 10M9 -5l3 10", "#3b2414", 1.4)},
    laserchat: {c: "gun", bb: [-16, -12, 132, 10], tip: [122, 0], fx: ["MIAOU ?", "#ff1f3d", "laser"], draw: (T) =>
      T.L("M26 0H120", "#ff1f3d", 7, ` opacity=".25"`) + T.L("M26 0H120", "#ff1f3d", 2) + T.C(122, 0, 9, "#ff1f3d", 0).replace("/>", ` opacity=".3"/>`) + T.C(122, 0, 4, "#ff1f3d", 0)
      + T.P("M-14 -4l3 -7l3 7zM-7 -4l3 -7l3 7z", "#9aa5b1", .7) + T.R(-15, -4.5, 42, 9, 4.5, "#9aa5b1") + T.C(6, -4, 2.6, "#e63946", .5)}
  };
  // angles (degrés) par classe et famille de pose : 0 = vers l'extérieur, -90 = vers le haut
  // (plusieurs angles possibles : on garde le premier où l'arme garde presque sa taille dans le cadre du SVG)
  const WANG = {gun: {idle: [-20, -5, 15], flex: [-52, -75, -30, -100], most: [-28, -50, 10], hip: [52, 30, 75]},
    long: {idle: [-62, -45, -80], flex: [-40, -62, -85, -115, -135], most: [-42, -60, -25], hip: [64, 45, 80]}, up: {idle: [0], flex: [0], most: [0], hip: [0]}};
  function bestAngle(def, fam, hx, hy, mx, k, box) {
    const s0 = k * (def.k || 1);
    let best = null, bs = -1;
    for (const a of WANG[def.c][fam]) { const sc = fitScale(def.bb, hx, hy, a, mx, s0, 0, box); if (sc >= s0 * .92) return a; if (sc > bs) { bs = sc; best = a; } }
    return best;
  }
  const poseFam = p => p === "flex" ? "flex" : p === "most" ? "most" : p === "kiss" || p === "back" || p === "leg" ? "hip" : "idle";
  const VBOX0 = [-43, -10, 243, 266];
  function fitScale(bb, hx, hy, rho, mx, s0, smin, box) {
    if (typeof bb === "function") bb = bb(rho);
    const VBOX = box || VBOX0;
    const c = Math.cos(rho * Math.PI / 180), sn = Math.sin(rho * Math.PI / 180);
    let s = s0;
    for (const [px, py] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]]) {
      const qx = mx * (px * c - py * sn), qy = px * sn + py * c;
      if (qx > .01) s = Math.min(s, (VBOX[2] - hx) / qx); else if (qx < -.01) s = Math.min(s, (VBOX[0] - hx) / qx);
      if (qy > .01) s = Math.min(s, (VBOX[3] - hy) / qy); else if (qy < -.01) s = Math.min(s, (VBOX[1] - hy) / qy);
    }
    return Math.max(smin, s);
  }
  // place une arme (repère local) : main en (hx, hy), angle rho, miroir (main gauche), échelle de base k
  function placeLocal(def, hx, hy, rho, mirror, k, fixedS, fx, box) {
    const mx = mirror ? -1 : 1, s = fixedS || fitScale(def.bb, hx, hy, rho, mx, k * (def.k || 1), k * .5, box);
    const o = {rho, fx: !!fx, up: (x, y, inner) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(-rho)})${mirror ? " scale(-1 1)" : ""}">${inner}</g>`,
      hang: (x, y, inner) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(-rho)})">${inner}</g>`};
    const T = wtools(3 / s);
    const c = Math.cos(rho * Math.PI / 180), sn = Math.sin(rho * Math.PI / 180);
    const toG = p => [hx + mx * s * (p[0] * c - p[1] * sn), hy + s * (p[0] * sn + p[1] * c)];
    const tl = typeof def.tip === "function" ? def.tip(rho) : def.tip;
    return {svg: `<g transform="translate(${f(hx)} ${f(hy)}) scale(${f(mx * s)} ${f(s)}) rotate(${f(rho)})">${def.draw(T, o)}</g>`, tip: toG(tl), toG, s,
      ang: Math.atan2(sn, mx * c) * 180 / Math.PI};
  }
  // effets dessinés quand on prend la pose avec une arme (éclair de tir, étincelles, confettis…)
  function weaponFxSvg(kind, x, y, ang, s) {
    const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), T = wtools(2.4);
    const at = d => [x + dx * d * s, y + dy * d * s];
    const burst = (cx, cy, r1, r2, n, fill, m) => { let d = ""; for (let i = 0; i < n * 2; i++) { const b = i * Math.PI / n + .2, r = i % 2 ? r2 : r1; d += (i ? "L" : "M") + f(cx + Math.cos(b) * r) + " " + f(cy + Math.sin(b) * r); } return T.P(d + "Z", fill, m); };
    const cols = ["#ff2e88", "#ffd23f", "#3ccf8e", "#2fa8ff", "#b14dff", "#ff7b00"];
    let o = "";
    if (kind === "gun" || kind === "spark") {
      const [bx, by] = at(kind === "spark" ? 2 : 12), r = (kind === "spark" ? 10 : 17) * s;
      o += burst(bx, by, r, r * .5, 7, "#ffd23f") + burst(bx, by, r * .55, r * .28, 7, "#fff6c9", 0);
      for (let i = 0; i < 7; i++) { const b = a + (i - 3) * .45, d = (22 + (i % 3) * 7) * s; o += `<rect x="${f(bx + Math.cos(b) * d - 2.5)}" y="${f(by + Math.sin(b) * d - 1.5)}" width="5" height="3" rx="1" fill="${cols[i % 6]}" transform="rotate(${i * 37} ${f(bx + Math.cos(b) * d)} ${f(by + Math.sin(b) * d)})"/>`; }
    } else if (kind === "splash") {
      for (let i = 0; i < 8; i++) { const b = a + (i - 3.5) * .16, d = (10 + i * 5) * s, r = (4 + (i % 3)) * s * .8; o += T.C(x + Math.cos(b) * d, y + Math.sin(b) * d, r, "#7fd4ff", .6); }
      o += burst(...at(46), 12 * s, 6 * s, 6, "#bfefff");
    } else if (kind === "confetti") {
      for (let i = 0; i < 22; i++) { const b = a + ((i * 7) % 11 - 5) * .07, d = (8 + i * 3.4) * s, px = x + Math.cos(b) * d, py = y + Math.sin(b) * d; o += `<rect x="${f(px - 2.5)}" y="${f(py - 1.6)}" width="5" height="3.2" rx="1" fill="${cols[i % 6]}" transform="rotate(${(i * 53) % 180} ${f(px)} ${f(py)})"/>`; }
      o += burst(...at(4), 10 * s, 5 * s, 6, "#fff6c9");
    } else if (kind === "fire") {
      const fl = (d, w, c) => { const [px, py] = at(d), nx = -dy, ny = dx; return T.P(`M${f(x + nx * w * .3 * s)} ${f(y + ny * w * .3 * s)}Q${f(px + nx * w * s)} ${f(py + ny * w * s)} ${f(x + dx * d * 1.25 * s)} ${f(y + dy * d * 1.25 * s)}Q${f(px - nx * w * s)} ${f(py - ny * w * s)} ${f(x - nx * w * .3 * s)} ${f(y - ny * w * .3 * s)}Z`, c, .8); };
      o += fl(34, 16, "#ff2e88") + fl(26, 10, "#ffd23f") + fl(18, 5, "#fff6c9");
      for (let i = 0; i < 5; i++) o += star(x + dx * (16 + i * 8) * s + Math.sin(i * 2.1) * 12 * s, y + dy * (16 + i * 8) * s + Math.cos(i * 2.1) * 12 * s, 3.5 * s, cols[i % 6]);
    } else if (kind === "tshirt") {
      const [px, py] = at(30), k = s * 1.1;
      o += `<g transform="translate(${f(px)} ${f(py)}) rotate(${f(ang + 20)}) scale(${f(k)})">${T.P("M-12 -12L-4 -14Q0 -10 4 -14L12 -12L18 -4L12 0L10 -4V14H-10V-4L-12 0L-18 -4Z", "#3ccf8e")}${T.S5(0, 2, 4, "#fff", 0)}</g>`;
      for (let i = 0; i < 3; i++) o += T.C(x + dx * (4 + i * 5) * s + (i - 1) * 4, y + dy * (4 + i * 5) * s - i * 3, (5 - i) * s, "#f4f4f4", .5);
    } else if (kind === "laser") {
      for (let i = 1; i <= 3; i++) o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(i * 6 * s)}" fill="none" stroke="#ff1f3d" stroke-width="2" opacity="${f(1 - i * .25)}"/>`;
      o += star(x, y - 14 * s, 4 * s, "#fff");
    } else if (kind === "blade") {
      for (let i = 0; i < 3; i++) { const [px, py] = at(-i * 34); o += `<g opacity="${f(1 - i * .22)}">${star(px, py, (11 - i * 2.5) * s, "#fff")}${star(px, py, (6 - i) * s, "#bfefff")}</g>`; }
      o += T.L(`M${f(x - dy * 14 * s)} ${f(y + dx * 14 * s)}l${f(-dy * 8 * s)} ${f(dx * 8 * s)}M${f(x + dy * 14 * s)} ${f(y - dx * 14 * s)}l${f(dy * 8 * s)} ${f(-dx * 8 * s)}`, "#fff", 2.4);
    } else if (kind === "blunt") {
      for (let i = 0; i < 8; i++) { const b = i * Math.PI / 4 + .3, r1 = 22 * s, r2 = 32 * s; o += T.L(`M${f(x + Math.cos(b) * r1)} ${f(y + Math.sin(b) * r1)}L${f(x + Math.cos(b) * r2)} ${f(y + Math.sin(b) * r2)}`, "#fff", 3); }
      o += star(x + 26 * s, y - 22 * s, 6 * s, "#ffd23f") + star(x - 24 * s, y - 18 * s, 5 * s, "#fff6c9") + star(x + 4 * s, y - 34 * s, 4 * s, "#ffd23f");
    } else if (kind === "zap") {
      const bolt = (bx, by, k2, d) => T.P(`M${f(bx)} ${f(by)}l${f(d * 9 * k2)} ${f(12 * k2)}l${f(-d * 5 * k2)} ${f(1.5 * k2)}l${f(d * 8 * k2)} ${f(13 * k2)}l${f(-d * 15 * k2)} ${f(-16 * k2)}l${f(d * 5 * k2)} ${f(-1.5 * k2)}z`, "#fff36b", .9);
      o += bolt(x - 26 * s, y - 30 * s, 1.3 * s, 1) + bolt(x + 18 * s, y - 34 * s, 1.1 * s, -1) + bolt(x + 26 * s, y + 4 * s, 1 * s, -1);
      o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(26 * s)}" fill="#7fe7ff" opacity=".22"/>`;
    }
    return o;
  }
  // objets de dos « armes » : repère local, l'axe +x part de l'épaule / de la garde
  const BACKW = {
    roquette: {bb: [-56, -40, 102, 18], tip: [100, -13], rear: [-54, -13], fx: ["BOUM !", "#ff7b00", "rocket"], draw: (T, o) =>
      T.P("M-44 -25L-55 -32V6L-44 -1Z", "#3d5a1a") + T.R(-45, -26, 125, 26, 11, "#5f8a2c") + T.L("M-38 -20H74", "#8fbf55", 3)
      + T.R(-28, -26, 15, 26, 0, "#ffd23f", .8) + T.L("M-26 -2l8 -22M-20 -2l8 -22", INK, 2.6) + T.R(8, -36, 13, 11, 2, "#2b2b33") + T.C(14.5, -30.5, 2.8, "#33d6ff", .5)
      + T.R(26, -1, 9, 17, 3, "#2b2b33") + T.R(74, -29, 9, 32, 3, "#3d5a1a")
      + (o.fx ? T.E(83, -13, 3, 11, "#1d1420", 0) : T.P("M83 -23H92Q112 -13 92 -3H83Z", "#e63946") + T.L("M88 -21V-5", "#fff", 2.4) + T.S5(98, -13, 3, "#ffd23f", 0))},
    fourreau: {bb: [-40, -13, 126, 13], tip: [-30, 0], fx: ["SHLING !", "#e9f6ff", "blade"], draw: (T) => {
      let w = T.R(-36, -5, 34, 10, 4, INK, 0);
      for (let i = 0; i < 5; i++) w += T.P(`M${-33 + i * 6.5} -5l3.2 5l-3.2 5l-3.2 -5z`, "#f1f1f1", 0);
      return T.P("M2 -6H120Q128 0 120 6H2Z", "#1d1420") + T.L("M6 -3H118", "#5c3a7a", 2) + T.R(30, -7, 5, 14, 1, "#f5c518", .6) + T.R(96, -7, 5, 14, 1, "#f5c518", .6)
        + T.L("M12 6q6 12 16 4", "#d62828", 3) + w + T.R(-39, -4.5, 4, 9, 1.5, "#f5c518", .6) + T.E(0, 0, 4, 11, "#f5c518") + T.L("M-39 0q-8 6 -6 14", "#d62828", 2.6);
    }},
    carquois: {bb: [-48, -26, 94, 14], tip: [-44, -8], fx: ["TCHAK !", "#e63946", "gun"], draw: (T) => {
      let w = "";
      [[-12, -2], [-6, 4], [0, -6], [6, 2]].forEach(([y, l], i) => { w += T.LI(`M6 ${y}L${-34 - l} ${y - 4 + i * 2}`, "#ffd23f", 2.6) + T.P(`M${-34 - l} ${y - 10 + i * 2}Q${-43 - l} ${y - 10 + i * 2} ${-43 - l} ${y - 4 + i * 2}Q${-43 - l} ${y + 2 + i * 2} ${-34 - l} ${y + 2 + i * 2}Z`, "#e63946", .8); });
      return w + T.R(0, -15, 92, 30, 12, "#8a4b20") + T.L("M6 -10H86M6 10H86", "#c98a4b", 2, ` stroke-dasharray="4 3"`) + T.R(-2, -16, 10, 32, 4, "#6b3b1f") + T.S5(48, 0, 6, "#ffd23f", .6);
    }}
  };

  /* ---------- collection « Swag » : outils de motifs ----------
     Pas de clipPath ni de <pattern> (les id se marchent dessus entre avatars, et l'avatar finit aussi en <img>, en canvas
     et en texture 3D) : on échantillonne la forme en polygone et on ne garde que les motifs qui tombent dedans. */
  function polyOf(d) {
    const tk = String(d).match(/[MLQZ]|-?\d*\.?\d+/g) || [], P = [];
    let i = 0, cmd = "M", cur = [0, 0];
    while (i < tk.length) {
      const t = tk[i];
      if (/[MLQZ]/.test(t)) { cmd = t; i++; continue; }
      if (cmd === "Q") {
        const c = [+tk[i], +tk[i + 1]], e = [+tk[i + 2], +tk[i + 3]];
        for (let k = 1; k <= 8; k++) { const u = k / 8; P.push([(1 - u) * (1 - u) * cur[0] + 2 * (1 - u) * u * c[0] + u * u * e[0], (1 - u) * (1 - u) * cur[1] + 2 * (1 - u) * u * c[1] + u * u * e[1]]); }
        cur = e; i += 4;
      } else { cur = [+tk[i], +tk[i + 1]]; P.push(cur); i += 2; }
    }
    return P;
  }
  function inPoly(P, x, y) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    return c;
  }
  // segments de droites (x0,y0)->(x1,y1) gardés seulement à l'intérieur du polygone (marge mg)
  function clipLines(P, lines, mg) {
    let d = "";
    const ok = (x, y) => inPoly(P, x, y) && (!mg || (inPoly(P, x + mg, y) && inPoly(P, x - mg, y) && inPoly(P, x, y + mg) && inPoly(P, x, y - mg)));
    for (const [x0, y0, x1, y1] of lines) {
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
      let run = null;
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        if (ok(x, y)) { if (!run) { d += `M${f(x)} ${f(y)}`; run = 1; } else if (k === n || !ok(x0 + (x1 - x0) * (k + 1) / n, y0 + (y1 - y0) * (k + 1) / n)) d += `L${f(x)} ${f(y)}`; }
        else run = null;
      }
    }
    return d;
  }
  // points d'une grille (décalée une ligne sur deux) qui tombent dans le polygone
  function gridIn(P, step, mg) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const out = [];
    for (let y = y0 + step * .5, r = 0; y < y1; y += step, r++) for (let x = x0 + (r % 2 ? step * .5 : 0); x < x1; x += step)
      if (inPoly(P, x, y) && inPoly(P, x + mg, y) && inPoly(P, x - mg, y) && inPoly(P, x, y + mg) && inPoly(P, x, y - mg)) out.push([x, y, r]);
    return out;
  }
  // rosette de léopard (centre fauve + deux arcs sombres)
  // pts = [[x, y, k], …] → deux chemins (centres fauves + arcs sombres) pour rester léger
  const leoSpots = pts => { let a = "", b = ""; for (const [x, y, k] of pts) { a += `M${f(x - 2 * k)} ${f(y)}a${f(2 * k)} ${f(1.6 * k)} 0 1 0 ${f(4 * k)} 0a${f(2 * k)} ${f(1.6 * k)} 0 1 0 ${f(-4 * k)} 0`; b += `M${f(x - 3.4 * k)} ${f(y - .4 * k)}q${f(.6 * k)} ${f(-3 * k)} ${f(4 * k)} ${f(-2.8 * k)}M${f(x + 3.6 * k)} ${f(y + .2 * k)}q${f(-.2 * k)} ${f(3 * k)} ${f(-3.8 * k)} ${f(2.8 * k)}`; }
    return pts.length ? `<path d="${a}" fill="#b5651d"/><path d="${b}" stroke="#3a2210" stroke-width="1.7" fill="none" stroke-linecap="round"/>` : ""; };
  const bz = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  // animations SMIL discrètes (figées sur la 1re image en canvas / 3D)
  const AN = {
    rot: (vals, x, y, dur, inner, kt) => `<g><animateTransform attributeName="transform" type="rotate" values="${vals.map(v => v + " " + f(x) + " " + f(y)).join(";")}"${kt ? ` keyTimes="${kt}"` : ""} dur="${dur}s" repeatCount="indefinite"/>${inner}</g>`,
    tr: (vals, dur, inner, kt) => `<g><animateTransform attributeName="transform" type="translate" values="${vals.join(";")}"${kt ? ` keyTimes="${kt}"` : ""} dur="${dur}s" repeatCount="indefinite"/>${inner}</g>`,
    op: (vals, dur, inner, kt) => `<g opacity="${vals.split(";")[0]}"><animate attributeName="opacity" values="${vals}"${kt ? ` keyTimes="${kt}"` : ""} dur="${dur}s" repeatCount="indefinite"/>${inner}</g>`,
    // œil qui cligne (pupille + reflet)
    eye: (x, y, r, dur, col) => `<g transform="translate(${f(x)} ${f(y)})"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 .12;1 1" keyTimes="0;.93;.965;1" dur="${dur || 4.2}s" repeatCount="indefinite"/><circle r="${f(r)}" fill="${col || INK}"/><circle cx="${f(r * .32)}" cy="${f(-r * .34)}" r="${f(r * .4)}" fill="#fff"/></g></g>`
  };

  /* ---------- tenues (emplacement « haut ») : elles remplacent le haut choisi dans l'éditeur ----------
     Priorité : tenue de la boutique > haut de l'éditeur (look.top / topColor).
     Bas : objet « bas » de l'emplacement taille (jogging, kilt, slips…) > pantalon de la tenue > short de l'éditeur. */
  const HAUTS = {
    hoodie: {c: "#6b7380", c2: "#4b525d", sl: "long", neck: "crew", hood: 1},
    maillot: {c: "#2f6fdc", c2: "#fff", sl: "short", neck: "v", tight: 1},
    crop: {c: "#ff5fa2", c2: "#fff", sl: "short", neck: "crew", crop: 1, tight: 1},
    chemhaw: {c: "#ff7b54", c2: "#c94f2c", sl: "short", open: 1},
    surv80: {c: "#7b2fd6", c2: "#19c6b8", sl: "long", neck: "col", pants: {c: "#7b2fd6", st: "#19c6b8", full: 1}},
    kimono: {c: "#fbfbf6", c2: "#dcdcd2", sl: "wide", wrap: 1, pants: {c: "#fbfbf6", end: .74, full: 1}},
    filet: {c: "#1d1420", strap: .45, mesh: 1},
    smoking: {c: "#2b2f5c", c2: "#fff", sl: "long", tux: 1, pants: {c: "#2b2f5c", st: "#4f558f", full: 1}},
    luchador: {nu: 1, mask: 1, pants: {c: "#14a35a", luc: 1, tight: 1, full: 1}}
  };
  // bas de l'emplacement « taille » (remplacent le short, et le pantalon d'une tenue)
  const BOTTOMS = {leopard: {}, slipor: {}, hawai: {}, jogging: {c: "#9aa1aa", full: 1, baggy: 1, cuff: "#7f8690"},
    shortbain: {c: "#86e3b5", melon: 1}, legging: {c: "#eaa53c", full: 1, tight: 1, leo: 1}, kilt: {kilt: 1}};

  /* ---------- compagnons (emplacement « animal ») ----------
     Repère local : sol en y = 0, l'animal monte vers les y négatifs, centré en x = 0 (largeur w, hauteur h).
     Ils restent à côté des pieds (à droite) avec une taille presque fixe à l'écran : quand le maître grossit, la bête
     rapetisse dans le cadre du SVG. Le perroquet se pose sur l'épaule. */
  const PET_FUR = {tan: "#d9a066", gris: "#8d99ae"};
  const PETS = {
    chihua: {w: 54, h: 60, draw: (T, u) => u.tr(["0 0", ".6 0", "0 0", "-.6 0", "0 0"], .28,
      T.LI("M9 -8q13 -1 11 -14", PET_FUR.tan, 3)
      + T.P("M-12 -2Q-15 -22 -6 -27H6Q15 -22 12 -2Z", "#ff5fa2") + T.L("M0 -25V-3", "#fff", 1.4) + T.L("M-11 -15q-2 6 -1 12M11 -15q2 6 1 12", "#fff", 2)
      + T.E(-5, -1.8, 4.2, 3, PET_FUR.tan) + T.E(5, -1.8, 4.2, 3, PET_FUR.tan)
      + T.P("M-8 -41L-25 -59L-3 -46Z", PET_FUR.tan) + T.P("M-9 -43L-20 -54L-6 -46Z", "#ffb3c7", 0) + T.P("M8 -41L25 -59L3 -46Z", PET_FUR.tan) + T.P("M9 -43L20 -54L6 -46Z", "#ffb3c7", 0)
      + T.P("M-9 -26Q0 -21 9 -26L8 -22Q0 -18 -8 -22Z", "#d63c80", .6)
      + T.E(0, -36, 12.5, 11, PET_FUR.tan) + T.E(0, -29.8, 6, 4.2, "#f0c896", 0)
      + T.C(-5.2, -37.5, 4.6, "#fff", .6) + T.C(5.2, -37.5, 4.6, "#fff", .6) + u.eye(-4.6, -37.3, 2.7, 3.7) + u.eye(4.6, -37.3, 2.7, 3.7)
      + T.E(0, -31.6, 2, 1.5, INK, 0) + T.L("M-2.2 -28.4q2.2 1.6 4.4 0", INK, 1.1))},
    bulldog: {w: 64, h: 52, draw: (T, u) =>
      u.rot([-18, 18, -18], 18, -8, .45, T.E(21, -9, 4.5, 3.4, "#c8a27c"))
      + T.P("M-20 -2Q-24 -24 -12 -30H12Q24 -24 20 -2Z", "#c8a27c") + T.P("M-9 -4Q-10 -20 0 -24Q10 -20 9 -4Z", "#f4ede1", 0)
      + [-1, 1].map(d => T.E(d * 14, -13, 8, 11.5, "#c8a27c") + T.L(`M${d * 9} -16q${d * 5} -5 ${d * 10} 0`, "#9b7552", 1.3) + T.E(d * 14, -2.4, 7.5, 3.6, "#f4ede1")).join("")
      + T.P("M-15 -26Q0 -19 15 -26L0 -12Z", "#e63946") + T.C(-6, -23, 1.2, "#fff", 0) + T.C(3, -21, 1.2, "#fff", 0) + T.C(0, -16, 1.2, "#fff", 0) + T.C(7, -24, 1.2, "#fff", 0)
      + T.P("M-14 -44q-9 -6 -12 2q4 3 9 3z", "#8a6a4a") + T.P("M14 -44q9 -6 12 2q-4 3 -9 3z", "#8a6a4a")
      + T.E(0, -36, 17, 12.5, "#c8a27c") + T.E(0, -29.5, 10.5, 6.6, "#f4ede1", 0) + T.L("M-6 -44.5q6 -3 12 0", "#8a6a4a", 1.3)
      + u.eye(-7, -38, 2.3) + u.eye(7, -38, 2.3) + T.L("M-11.5 -42.5l7 2.2M11.5 -42.5l-7 2.2", INK, 2)
      + T.E(0, -33.5, 3.6, 2.3, INK, 0) + T.P("M-8.5 -28Q0 -21 8.5 -28Q0 -25 -8.5 -28Z", "#a8805c", .8)
      + T.P("M-6.5 -27.6l1.6 -3.6l1.6 3.6Z", "#fff", .5) + T.P("M6.5 -27.6l-1.6 -3.6l-1.6 3.6Z", "#fff", .5)},
    chatjuge: {w: 52, h: 58, draw: (T, u) =>
      u.rot([-5, 9, -5], 12, -4, 2.8, T.LI("M11 -4q15 -1 15 -15q0 -10 -6 -13", PET_FUR.gris, 5))
      + T.P("M-13 -1Q-17 -27 -7 -31H7Q17 -27 13 -1Z", PET_FUR.gris) + T.E(0, -12, 6.5, 9, "#d5dbe5", 0)
      + T.E(-5, -1.8, 4, 2.8, "#d5dbe5") + T.E(5, -1.8, 4, 2.8, "#d5dbe5")
      + T.P("M-12 -41L-13 -57L-3 -47Z", PET_FUR.gris) + T.P("M-11 -43L-11.5 -53L-5 -47Z", "#ffb3c7", 0) + T.P("M12 -41L13 -57L3 -47Z", PET_FUR.gris) + T.P("M11 -43L11.5 -53L5 -47Z", "#ffb3c7", 0)
      + T.E(0, -38, 13.5, 11.5, PET_FUR.gris) + T.E(0, -32.6, 5.6, 3.6, "#d5dbe5", 0)
      + [-1, 1].map(d => T.E(d * 5.5, -38.6, 3.9, 3.1, "#ffd23f", .6) + T.R(d * 5.5 - .9, -40.5, 1.8, 4, .9, INK, 0)
        + AN.tr(["0 0", "0 0", "0 1.2", "0 0"], 5.2, T.P(`M${d * 5.5 - 4.8} -38.8H${d * 5.5 + 4.8}V-43H${d * 5.5 - 4.8}Z`, PET_FUR.gris, 0) + T.L(`M${d * 5.5 - 4.6} -38.8H${d * 5.5 + 4.6}`, INK, 1.5), "0;.8;.88;1")).join("")
      + T.L("M-9.5 -45l7 1.2M2.5 -44.6l7 -2.2", INK, 1.4)
      + T.P("M-1.6 -34.6h3.2l-1.6 1.8z", "#ff8fb0", .5) + T.L("M-3 -31h6", INK, 1.2) + T.L("M-6 -33l-9 -1M-6 -31.5l-9 1.5M6 -33l9 -1M6 -31.5l9 1.5", INK, .7)},
    perroquet: {w: 34, h: 40, perch: 1, draw: (T, u) =>
      T.P("M-3 -7L-7 15L-1 13L2 17L5 -5Z", "#2f6fdc") + T.L("M1 -4L1 14", "#e63946", 1.6)
      + T.P("M-8 -6Q-11 -24 0 -28Q11 -24 8 -6Q0 0 -8 -6Z", "#e63946")
      + T.P("M2 -22Q12 -16 8 -2Q1 -6 0 -14Z", "#2f6fdc") + T.P("M2.6 -20Q8 -17 8.2 -12L2.4 -14Z", "#ffd23f", 0)
      + T.L("M-4 -1v3M3 -1v3", "#7a7a85", 2.2) + T.L("M-6 2.4h4M1 2.4h4", "#7a7a85", 1.6)
      + AN.rot([0, -9, 0, 0], -1, -24, 1.6, T.C(-1, -31, 8.5, "#e63946") + T.E(-4, -31, 4.4, 4, "#fff", 0) + u.eye(-4, -31.5, 1.8, 3.4)
        + T.P("M-8 -34Q-15.5 -34 -14.5 -24Q-12.5 -28 -7.5 -27.6Z", "#f1e6d0") + T.P("M-8 -27.6Q-12 -25 -10 -23Q-7 -24 -6.2 -27.6Z", INK, 0), "0;.3;.6;1")
      + AN.op("0;0;1;1;0", 5, T.R(1, -63, 42, 15, 6, "#fff", .8) + T.P("M6 -48.6L3 -42L12 -48.6Z", "#fff", .8) + T.R(5.5, -49.6, 7, 2, 0, "#fff", 0)
        + `<text x="22" y="-52.4" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="10" fill="#e63946">GAINS !</text>`, "0;.42;.46;.92;1")},
    hamster: {w: 58, h: 58, draw: (T, u) => {
      let sp = "";
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; sp += `M${f(Math.cos(a) * 19)} ${f(-28 + Math.sin(a) * 19)}L${f(Math.cos(a) * 23.5)} ${f(-28 + Math.sin(a) * 23.5)}`; }
      return T.R(-21, -3.5, 42, 4, 2, "#6b7480") + T.LI("M-15 -1L0 -28L15 -1", "#9aa5b1", 3.2) + T.C(0, -28, 24, "#fff4dd", 1.1)
        + AN.rot([0, -360], 0, -28, 1.4, T.L(sp, "#c9a46a", 2.2) + T.L("M-23.5 -28H23.5M0 -51.5V-4.5", "#ff9f1c", 1.4, ` opacity=".55"`))
        + T.C(0, -28, 24, "none", 1.1) + T.C(0, -28, 3, "#9aa5b1")
        + AN.tr(["0 0", "0 -1.2", "0 0"], .2, T.L("M-4 -6l-3 2M3 -6l-3 2", "#e88a9a", 1.6)
          + T.E(0, -12.5, 10.5, 7.8, "#f2a65a") + T.E(-2, -10.4, 6.4, 4.6, "#fff2dc", 0) + T.C(3.6, -19.4, 2.7, "#f2a65a") + T.C(-3.6, -19.8, 2.7, "#f2a65a")
          + T.C(-6.8, -11.4, 2.4, "#ffb3c7", 0) + u.eye(-5, -14.5, 1.6, 3) + T.C(-10, -13, 1, INK, 0))
        + T.L("M12 -10h6M13 -15h5", "#fff", 1.4);
    }},
    tortue: {w: 58, h: 60, draw: (T, u) =>
      T.E(-7, -2.2, 5.5, 3, "#5cb85c") + T.E(7, -2.2, 5.5, 3, "#5cb85c")
      + T.E(0, -17, 16.5, 15.5, "#3f8f3f") + T.L("M-15 -22l4 3M15 -22l-4 3M-15 -11l4 -1M15 -11l-4 -1", "#2d6b2d", 1.6)
      + T.E(0, -16, 11, 13.5, "#f4d35e") + T.L("M-10 -20h20M-11 -13h22M0 -29V-3", "#c9a227", 1.2)
      + AN.tr(["0 0", "0 -3.5", "0 0"], 1.7, T.LI("M-9 -25L-14 -45M9 -25L14 -45", "#5cb85c", 3.4) + T.LI("M-23 -47H23", "#c9d1d8", 2)
        + T.R(-26, -53, 5.5, 12, 1.6, "#2b2b33") + T.R(20.5, -53, 5.5, 12, 1.6, "#2b2b33") + T.R(-21, -51, 3, 8, 1, "#e63946", .5) + T.R(18, -51, 3, 8, 1, "#e63946", .5))
      + T.C(0, -35, 8, "#5cb85c") + u.eye(-3, -36, 1.6) + u.eye(3, -36, 1.6) + T.L("M-2.4 -31.6q2.4 1.6 4.8 0", INK, 1.1) + T.L("M-7.6 -38.6q7.6 -3.4 15.2 0", "#e63946", 2.4)
      + T.P("M9 -40q2.4 3.4 0 4.6q-2.4 -1.2 0 -4.6z", "#8fd3ff", .6)},
    poulet: {w: 50, h: 62, draw: (T, u) =>
      AN.tr(["0 0", ".5 0", "0 0", "-.5 0", "0 0"], .22, T.L("M-4 -19V-1M4 -19V-1", "#f2a33a", 1.7)) + T.L("M-4 -1l-4 1.4M-4 -1v1.8M-4 -1l3.4 1.4M4 -1l-3.4 1.4M4 -1v1.8M4 -1l4 1.4", "#f2a33a", 1.3)
      + T.P("M12 -28q9 -6 7 -15q-4 4 -9 6z", "#fff")
      + [-1, 1].map(d => AN.rot([0, d * 8, 0], d * 12, -37, 1.1, T.P(`M${d * 11} -35Q${d * 25} -38 ${d * 23} -51Q${d * 18} -50 ${d * 15} -45Q${d * 15} -41 ${d * 10} -41Z`, "#fff") + T.L(`M${d * 20} -49l${d * -2} 4`, "#c9cbd1", 1.2))).join("")
      + T.P("M-14 -22Q-18 -41 -6 -44H6Q18 -41 14 -22Q0 -13 -14 -22Z", "#fff") + T.L("M-9 -36q4.5 4 9 1q4.5 3 9 -1M-3 -28h6M-3 -24h6", "#c9cbd1", 1.3)
      + T.C(0, -50, 7.5, "#fff") + T.P("M-4 -56q-2 -6 2 -5q1 -5 4 -2q3 -3 3 2q2 2 -1 5Z", "#e63946") + T.L("M-7 -53.4q7 -2.4 14 0", "#2fa8ff", 2)
      + T.P("M-3 -49L0 -45.2L3 -49Z", "#f2a33a") + T.E(0, -43.6, 1.8, 2.6, "#e63946", .6) + u.eye(-3, -51.2, 1.4) + u.eye(3, -51.2, 1.4) + T.L("M-5.4 -54.2l3.4 1.2M5.4 -54.2l-3.4 1.2", INK, 1.2)},
    pigeon: {w: 50, h: 44, draw: (T, u) =>
      T.L("M-2 -7v7M5 -7v7", "#e88a9a", 1.7) + T.L("M-2 0l-3 .6M5 0l-3 .6", "#e88a9a", 1.3)
      + T.P("M13 -16L26 -11L24 -5L11 -10Z", "#6f7584") + T.E(3, -14, 14, 9.5, "#a7adba")
      + T.P("M0 -18Q12 -22 20 -12Q10 -8 2 -11Z", "#8a90a0") + T.L("M8 -17l3 5M13 -17l3 5", INK, 1.3)
      + AN.tr(["0 0", "-2.6 0", "0 0", "0 0"], .9, T.E(-7, -20, 6, 7, "#7c8a9e") + T.P("M-12.4 -20q4 -4 9 -1q-2 5 -8 5z", "#3ccf8e", 0) + T.P("M-11 -16.6q3 -2 7 0q-3 3 -7 0z", "#b14dff", 0)
        + T.C(-9, -28, 6.5, "#a7adba") + T.P("M-15 -28.4L-20.4 -26.6L-15 -25.4Z", "#3b3f47") + T.E(-14.2, -28.6, 1.4, 1, "#fff", 0)
        + T.R(-15.4, -31.4, 7.6, 3.6, 1.2, INK, 0) + T.L("M-8 -30.4h3", INK, 1) + T.L("M-17 -30.6l1 -.2", "#fff", .6)
        + `<g transform="rotate(-18 -21 -26)">${T.R(-30, -27.4, 11, 2.8, .6, "#ffd23f", .6)}</g>`, "0;.25;.5;1")},
    crabe: {w: 72, h: 46, draw: (T, u) =>
      [-1, 1].map(d => [0, 1, 2].map(i => T.LI(`M${d * 10} ${-9 + i * 3}l${d * 8} ${3 + i}l${d * 3} 4`, "#e63946", 1.8)).join("")
        + T.LI(`M${d * 14} -14Q${d * 24} -15 ${d * 24} -26`, "#e63946", 4) + T.E(d * 21.5, -20, 4.6, 5.6, "#e63946")
        + T.P(`M${d * 20} -28Q${d * 31} -30 ${d * 33} -38Q${d * 26} -34 ${d * 21} -33Z`, "#e63946")
        + AN.rot([0, d * -16, 0, 0], d * 22, -31, 1.1, T.P(`M${d * 21} -31Q${d * 19} -45 ${d * 30} -47Q${d * 35} -41 ${d * 31.5} -37Q${d * 27} -36 ${d * 24} -32Z`, "#e63946"), "0;.15;.3;1")).join("")
      + T.E(0, -11, 17, 9.5, "#e63946") + T.E(-5, -14.5, 6, 2.4, "#ff8a8f", 0)
      + T.L("M-5 -19v-6M5 -19v-6", INK, 1.5) + T.C(-5, -27, 3.4, "#fff", .7) + T.C(5, -27, 3.4, "#fff", .7) + u.eye(-4.6, -27, 1.6) + u.eye(5.4, -27, 1.6)
      + T.L("M-4 -9q4 3 8 0", INK, 1.2)},
    lapin: {w: 46, h: 66, draw: (T, u) => u.tr(["0 0", "0 0", "0 -7", "0 0"],
      1.8, T.C(12, -9, 4.2, "#fff") + T.E(-8, -2.6, 7, 3.2, "#f4f4f8") + T.E(8, -2.6, 7, 3.2, "#f4f4f8")
      + T.E(0, -15, 12.5, 13, "#f4f4f8") + T.E(0, -13, 7, 8, "#fff", 0)
      + [-1, 1].map(d => AN.rot([0, d * 7, 0], d * 4, -42, 2.6, T.P(`M${d * 1.6} -42Q${d * 0} -66 ${d * 6.5} -66Q${d * 12} -64 ${d * 8.4} -42Z`, "#f4f4f8") + T.P(`M${d * 3.6} -45Q${d * 3} -61 ${d * 6.4} -61Q${d * 9} -60 ${d * 7} -45Z`, "#ffb3c7", 0))).join("")
      + T.C(0, -36, 10.5, "#f4f4f8") + u.eye(-4, -37, 1.8) + u.eye(4, -37, 1.8) + T.C(-6.6, -33.4, 2, "#ffc7d9", 0) + T.C(6.6, -33.4, 2, "#ffc7d9", 0)
      + T.P("M-1.5 -33.4h3l-1.5 1.6z", "#ff8fb0", .5) + T.R(-1.5, -31, 3, 2.4, .5, "#fff", .5) + T.L("M-10 -40.6q10 -3.4 20 0", "#ff2e88", 2.6)
      + T.P("M-7 -21L6 -17L-1 -12Z", "#ff8c1a", .8) + T.L("M-7 -21l-3 -3M-7 -21l-1 -4", "#3fae5a", 1.6), "0;.6;.75;1")},
    alpaga: {w: 50, h: 68, draw: (T, u) =>
      T.R(-10, -16, 5, 16, 2, "#e2cfa9") + T.R(10, -16, 5, 16, 2, "#e2cfa9") + T.R(-4, -16, 5, 16, 2, "#f3e3c3") + T.R(15, -16, 5, 16, 2, "#f3e3c3")
      + T.C(19, -25, 3.6, "#f3e3c3") + T.C(-6, -22, 8, "#f3e3c3") + T.C(4, -25, 9, "#f3e3c3") + T.C(13, -21, 8, "#f3e3c3") + T.E(4, -19.5, 15, 6.5, "#f3e3c3")
      + T.E(4, -21, 13, 7, "#f3e3c3", 0) + T.P("M-5 -29Q4 -33 14 -29L13 -19Q4 -17 -4 -19Z", "#e63946") + T.L("M-4.6 -25Q4 -28 13.4 -25M-4.4 -21.4Q4 -24 13.2 -21.4", "#ffd23f", 1.5)
      + T.R(-15, -51, 9, 27, 4.5, "#f3e3c3")
      + AN.rot([0, 3, 0], -10, -46, 3.2, T.P("M-9 -59l1.5 -7l3 6z", "#f3e3c3") + T.P("M-14 -59l.5 -7l3.5 6z", "#f3e3c3") + T.E(-12, -52, 7.5, 6.5, "#f3e3c3")
        + T.C(-11, -59, 4.6, "#fff8e6") + T.C(-15, -58, 3.6, "#fff8e6") + T.C(-7.5, -57.5, 3.4, "#fff8e6")
        + AN.tr(["0 0", "0 .8", "0 0"], .5, T.E(-17, -48.8, 4.6, 3.6, "#e8d2a8")) + u.eye(-14, -53, 1.5) + T.L("M-16 -54.6l-1 -1.2M-14 -55l0 -1.6", INK, .8) + T.L("M-20.4 -47.6q2 1 4 0", INK, 1))},
    panda: {w: 56, h: 58, draw: (T, u) =>
      T.E(-11, -5, 7, 5.5, "#2b2b33") + T.E(11, -5, 7, 5.5, "#2b2b33") + T.C(-11, -5, 2.4, "#6b6b77", 0) + T.C(11, -5, 2.4, "#6b6b77", 0)
      + T.E(0, -19, 16.5, 15, "#fafafa")
      + `<g transform="rotate(25 -14 -22)">${T.E(-14, -22, 5.6, 8.6, "#2b2b33")}</g>`
      + T.R(14, -50, 5, 36, 2.2, "#6cbf4a") + T.L("M14.4 -40h4.2M14.4 -28h4.2", "#3f8f3f", 1.4) + T.P("M19 -46q8 -4 10 -10q-7 1 -10 6z", "#6cbf4a", .8)
      + `<g transform="rotate(-25 12 -24)">${T.E(12, -24, 5.6, 8.6, "#2b2b33")}</g>`
      + T.C(-10, -49, 4.6, "#2b2b33") + T.C(10, -49, 4.6, "#2b2b33")
      + T.C(0, -38, 13.5, "#fafafa")
      + `<g transform="rotate(-20 -5.5 -38.6)">${T.E(-5.5, -38.6, 3.8, 5, "#2b2b33", 0)}</g><g transform="rotate(20 5.5 -38.6)">${T.E(5.5, -38.6, 3.8, 5, "#2b2b33", 0)}</g>`
      + u.eye(-5.2, -39, 1.7, 4, "#fff") + u.eye(5.2, -39, 1.7, 4, "#fff")
      + T.E(0, -33, 2.4, 1.6, "#2b2b33", 0) + AN.tr(["0 0", "0 .9", "0 0"], .6, T.L("M-2.4 -30.4q2.4 1.6 4.8 0", INK, 1.1))},
    pingouin: {w: 44, h: 56, draw: (T, u) => AN.rot([-4, 4, -4], 0, 0, 1.3,
      T.E(-5, -1.6, 5, 2.4, "#ff9f1c") + T.E(5, -1.6, 5, 2.4, "#ff9f1c")
      + T.P("M-12 -32Q-20 -22 -17 -12Q-12 -20 -11 -26Z", "#2b2b33")
      + AN.rot([0, -32, 0, 0], 11, -30, 1.3, T.P("M12 -32Q20 -22 17 -12Q12 -20 11 -26Z", "#2b2b33"), "0;.25;.5;1")
      + T.E(0, -24, 13.5, 22, "#2b2b33") + T.E(0, -20, 9.5, 16.5, "#fafafa", 0)
      + T.C(-4.2, -38, 3.2, "#fff", 0) + T.C(4.2, -38, 3.2, "#fff", 0) + u.eye(-4, -38, 1.8) + u.eye(4, -38, 1.8)
      + T.C(-7.6, -34, 1.8, "#ff8fb0", 0) + T.C(7.6, -34, 1.8, "#ff8fb0", 0) + T.P("M-3.5 -34L0 -29.6L3.5 -34Z", "#ff9f1c", .8)
      + T.P("M-10 -29Q0 -25 10 -29L10 -25Q0 -21 -10 -25Z", "#e63946", .8) + T.P("M5 -26l3 10l4 -2l-3 -9z", "#e63946", .8))},
    requinl: {w: 64, h: 54, leash: [9, -13.5], draw: (T, u) => {
      const ring = (arc, w2, col, ex) => `<path d="${arc}" fill="none" stroke="${col}" stroke-width="${w2}"${ex || ""}/>`;
      const full = "M-27 -10A27 9.5 0 1 0 27 -10A27 9.5 0 1 0 -27 -10", front = "M-27 -10A27 9.5 0 0 0 27 -10";
      return AN.tr(["0 0", "0 -2", "0 0"], 1.9, ring(full, 14, INK) + ring(full, 9, "#ff7b00") + ring(full, 9, "#fff", ` stroke-dasharray="10 12"`)
        + T.P("M-12 -10Q-14 -40 0 -44Q14 -40 12 -10Z", "#7d8fa6") + T.P("M-7 -10Q-8 -28 0 -30Q8 -28 7 -10Z", "#eef2f6", 0)
        + T.P("M-3 -42L2 -55L6 -41Z", "#7d8fa6") + T.P("M-12 -20L-21 -13L-11 -14Z", "#7d8fa6") + T.P("M12 -20L21 -13L11 -14Z", "#7d8fa6")
        + u.eye(-5, -33, 1.9) + u.eye(5, -33, 1.9) + T.L("M-8.4 -37.4l5 1.6M8.4 -37.4l-5 1.6", INK, 1.5)
        + T.P("M-8 -26Q0 -18 8 -26Q0 -23 -8 -26Z", "#fff", .9) + T.L("M-6.4 -25.2l1.6 2l1.6 -1.8l1.6 2.2l1.6 -2.2l1.6 2.2l1.6 -1.8l1.6 2", INK, .7)
        + T.L("M-11 -14q11 4 22 0", "#e63946", 2.6) + T.C(9, -13.5, 2, "#c9d1d8", .6)
        + ring(front, 14, INK) + ring(front, 9, "#ff7b00") + ring(front, 9, "#fff", ` stroke-dasharray="10 12"`));
    }},
    dragon: {w: 64, h: 64, draw: (T, u) => AN.tr(["0 0", "0 -3.4", "0 0"], 1.6,
      T.LI("M7 -6Q24 -4 22 -17", "#8f5bff", 4) + T.P("M20 -16l1.4 -8l5.6 5.4z", "#8f5bff")
      + [-1, 1].map(d => AN.rot([0, d * -20, 0], d * 6, -28, .6, T.P(`M${d * 5} -30Q${d * 16} -50 ${d * 29} -47Q${d * 24} -41 ${d * 26} -34Q${d * 20} -35 ${d * 18} -28Q${d * 12} -30 ${d * 7} -24Z`, "#c4a6ff") + T.L(`M${d * 8} -29L${d * 26} -44M${d * 10} -27L${d * 19} -30`, "#8f5bff", 1.2))).join("")
      + T.E(-6, -3, 4.6, 3, "#8f5bff") + T.E(6, -3, 4.6, 3, "#8f5bff") + T.E(0, -17, 11, 13, "#8f5bff") + T.E(0, -15, 6.5, 9.4, "#ffd23f", 0) + T.L("M-5 -19h10M-5.6 -14h11.2M-5 -9h10", "#e0a800", 1)
      + T.L("M-9 -22l-4 5M9 -22l4 5", "#8f5bff", 3)
      + T.P("M-3 -44l-2.6 -9l6 6.6z", "#ffd23f") + T.P("M5 -45l1 -9l4 7.4z", "#ffd23f") + T.E(1, -37, 11, 9.5, "#8f5bff") + T.E(-6, -33.6, 6.4, 4.6, "#8f5bff")
      + T.E(-5, -33.6, 5, 3.2, "#8f5bff", 0) + u.eye(-1, -39.6, 2.1) + T.C(-10, -35, .9, INK, 0) + T.L("M-9 -31q4 2 8 0", INK, 1.1) + T.P("M-3 -30.6l1 2.4l1 -2.4z", "#fff", .5)
      + AN.op("0;0;1;0", 3, T.P("M-12 -35q-8 -5 -13 1q4 -1 6 2q-5 2 -2.6 5.4q5 -4 9.6 -6.6z", "#ff7b00", .8) + T.P("M-13 -34q-4 -2 -7 1q3 0 4 2z", "#ffd23f", 0), "0;.6;.7;1")
      + star(17, -54, 3.2, "#fff6a8"))},
    licorne: {w: 66, h: 72, draw: (T, u) => {
      const rb = ["#ff3b3b", "#ff9f1c", "#ffe14d", "#3ccf5e", "#2fa8ff", "#8f5bff"];
      return rb.map((c, i) => T.LI(`M${f(18 + i * .6)} ${f(-31 + i * 1.8)}Q${f(31 + i * 2.2)} ${f(-26 + i * 2.4)} ${f(25 + i * 2.6)} ${f(-9 + i * .6)}`, c, 2.6)).join("")
        + [-10, -3, 11, 18].map((x, i) => T.R(x, -18, 5, 18, 2, i % 2 ? "#f2f2fa" : "#fff") + T.R(x, -4.4, 5, 4.4, 1, "#f5c518")).join("")
        + T.E(5, -24, 18, 10.5, "#fff") + T.P("M-12 -28Q-14 -44 -10 -51L-2 -49Q-4 -38 0 -28Z", "#fff")
        + rb.map((c, i) => T.C(-3 + i * .7, -54 + i * 4.4, 3.4, c, .6)).join("")
        + `<g transform="rotate(-24 -12 -50)">${T.E(-13, -50, 8.6, 6.6, "#fff")}</g>` + T.E(-19.5, -46.4, 4.6, 4, "#ffeef7")
        + T.P("M-11 -56L-8.4 -71L-5.6 -56Z", "#f5c518") + T.L("M-10.4 -59.4l4 -1M-9.8 -63.4l3 -1M-9.2 -67l2 -.8", "#c99a1e", .9)
        + T.P("M-6 -55l1 -6.4l3.4 5z", "#fff") + u.eye(-12.6, -51, 1.7) + T.L("M-14.6 -52.6l-1.2 -1.2M-13 -53l-.6 -1.6", INK, .8) + T.C(-21, -46.6, .8, INK, 0) + T.L("M-21.4 -44q1.6 1 3.2 0", INK, .9)
        + AN.op("1;.15;1", 1.5, star(-26, -60, 3.4, "#ffe14d") + star(24, -44, 2.8, "#fff6a8")) + AN.op(".15;1;.15", 1.5, star(-24, -30, 2.6, "#fff6a8") + star(14, -54, 3, "#ffe14d"));
    }},
    poulpe: {w: 66, h: 56, draw: (T, u) => {
      let t = "";
      for (let i = 0; i < 6; i++) { const x0 = -11 + i * 4.4, k = (i - 2.5); t += T.LI(`M${f(x0)} -22Q${f(x0 + k * 4)} -10 ${f(x0 + k * 7)} -4q${f(k * 1.6)} 2.6 ${f(k * 3)} 0`, "#ff6ad5", 4.4); }
      const db = d => T.LI(`M${d * 21} -46V-38`, "#c9d1d8", 1.4) + T.R(d * 21 - 4, -49, 8, 4, 1.2, "#2b2b33", .7) + T.R(d * 21 - 4, -38, 8, 4, 1.2, "#2b2b33", .7);
      return AN.rot([-3, 3, -3], 0, -22, 1.6, t)
        + [-1, 1].map(d => AN.rot([0, d * 22, 0], d * 12, -27, 1.4, T.LI(`M${d * 12} -27Q${d * 24} -27 ${d * 23} -40`, "#ff6ad5", 4.4) + db(d), d < 0 ? "" : "")).join("")
        + T.P("M-15 -23Q-18 -51 0 -51Q18 -51 15 -23Q0 -17 -15 -23Z", "#ff6ad5") + T.C(-7, -44, 2, "#ffb0ec", 0) + T.C(6, -46, 2.6, "#ffb0ec", 0) + T.C(9, -38, 1.6, "#ffb0ec", 0)
        + T.L("M-15 -38.6q15 -5 30 0", "#3ccf8e", 2.6)
        + T.C(-5.5, -31.5, 4, "#fff", .7) + T.C(5.5, -31.5, 4, "#fff", .7) + u.eye(-5, -31.2, 2.2) + u.eye(6, -31.2, 2.2) + T.L("M-3 -25.4q3 2 6 0", INK, 1.2);
    }},
    golden: {w: 60, h: 58, draw: (T, u) =>
      u.rot([-22, 22, -22], 12, -9, .42, T.LI("M12 -9q13 -4 17 -18", "#e8a24a", 5))
      + T.P("M-13 -1Q-17 -25 -7 -29H7Q17 -25 13 -1Z", "#e8a24a") + T.P("M-7 -26Q0 -14 7 -26Q4 -15 0 -11Q-4 -15 -7 -26Z", "#f6c879", 0)
      + T.E(-6, -2, 4.6, 3, "#f6c879") + T.E(6, -2, 4.6, 3, "#f6c879")
      + T.E(0, -37, 11.5, 10.5, "#e8a24a") + T.P("M-8 -45Q-18 -42 -15.6 -27Q-10.4 -29 -7.6 -37Z", "#c98232") + T.P("M8 -45Q18 -42 15.6 -27Q10.4 -29 7.6 -37Z", "#c98232")
      + T.E(0, -31, 6.6, 4.6, "#f6c879") + T.E(0, -34, 2.3, 1.7, INK, 0) + u.eye(-4.5, -39, 1.8) + u.eye(4.5, -39, 1.8)
      + T.E(0, -26.6, 13, 3.6, "#ff2e63") + T.E(0, -27.2, 9, 1.8, "#ff7a96", 0)},
    raton: {w: 58, h: 54, draw: (T, u) => {
      const tl = "M11 -6q14 0 16 -14q1 -8 -4 -10";
      return AN.rot([-7, 8, -7], 12, -6, 1.5, T.L(tl, INK, 9) + T.L(tl, "#8d8f96", 6) + T.L(tl, "#2b2b33", 6, ` stroke-dasharray="3 4"`))
        + T.P("M-12 -1Q-16 -25 -6 -29H6Q16 -25 12 -1Z", "#8d8f96") + T.E(0, -12, 6, 8, "#c9cbd1", 0) + T.E(-5, -2, 4, 2.6, "#3b3f47") + T.E(5, -2, 4, 2.6, "#3b3f47")
        + T.R(-10, -21, 20, 7.4, 1.6, "#e63946", .8) + `<text x="0" y="-15.4" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="5" fill="#fff">PROT</text>` + T.C(-10, -17.4, 3, "#3b3f47", .7) + T.C(10, -17.4, 3, "#3b3f47", .7)
        + T.P("M-11 -42l-2 -9l7.4 4z", "#8d8f96") + T.P("M11 -42l2 -9l-7.4 4z", "#8d8f96")
        + T.E(0, -36, 12.5, 10.5, "#8d8f96") + T.E(0, -30.6, 6, 4.4, "#f1f1f4", 0)
        + T.P("M-12 -38Q-6 -43 0 -38.4Q6 -43 12 -38Q10 -33 5 -34Q0 -36 -5 -34Q-10 -33 -12 -38Z", "#2b2b33", 0) + T.L("M-9 -42.4q4 -2 7 0M2 -42.4q4 -2 7 0", "#f1f1f4", 1.5)
        + T.C(-5, -37.6, 2.3, "#fff", 0) + T.C(5, -37.6, 2.3, "#fff", 0)
        + AN.tr(["-.8 0", "-.8 0", ".8 0", ".8 0", "-.8 0"], 3.4, T.C(-5, -37.6, 1.3, INK, 0) + T.C(5, -37.6, 1.3, INK, 0), "0;.4;.5;.9;1")
        + T.E(0, -32.4, 2, 1.4, INK, 0) + T.L("M-2 -29.4q3 1 5 -1", INK, 1);
    }},
    trex: {w: 70, h: 70, draw: (T, u) =>
      T.LI("M-31 -4H-15", "#c9d1d8", 2) + T.R(-35, -11, 6, 13, 1.6, "#2b2b33") + T.R(-17, -11, 6, 13, 1.6, "#2b2b33")
      + T.P("M8 -24Q30 -18 35 -2Q24 -8 6 -10Z", "#5cb85c")
      + T.P("M-2 -19Q-6 -6 -7 -1H4Q6 -10 7 -19Z", "#4a9d4a") + T.P("M6 -21Q13 -8 9 -1H20Q21 -12 17 -23Z", "#5cb85c")
      + T.E(4, -28, 13, 14, "#5cb85c") + T.E(-1, -26, 7, 10, "#c8e6a0", 0) + T.P("M12 -40l3 -4l1 5zM16 -35l4 -3l0 5zM19 -29l4 -2l-1 4z", "#3f8f3f", .6)
      + T.P("M-4 -48L7 -48L11 -36L-2 -36Z", "#5cb85c", 0)
      + T.R(-22, -63, 29, 16, 7, "#5cb85c") + T.R(-21, -50.4, 22, 6.4, 3, "#5cb85c") + T.L("M-19 -50.2l1.4 2l1.4 -2l1.4 2l1.4 -2l1.4 2l1.4 -2l1.4 2l1.4 -2l1.4 2", "#fff", 1.1)
      + u.eye(-6, -57.6, 2.1) + T.L("M-9.6 -61.6l6.4 1.4", INK, 1.5) + T.C(-19, -58, .9, INK, 0) + T.L("M-8 -53l5 -.6", INK, .8)
      + AN.rot([0, -28, 0], -5, -35, .45, T.LI("M-5 -35l-5 3l-1.6 -2.4", "#5cb85c", 2.2)) + AN.rot([0, 24, 0], -2, -33, .5, T.LI("M-2 -33l-4.4 3.6l-1 -2.6", "#4a9d4a", 2.2))}
  };


  /* ---------- chaussures « Swag » : profil, talon côté intérieur, pointe vers l'extérieur ----------
     o = {L, fx, fy (semelle), frx (demi-longueur du pied), m, CW (mollet), skin, d (côté), kx (cheville), cw} */
  const SW_INK = 3;
  const shoePath = (d, w) => `<path d="${d}" fill="${w}" stroke="${INK}" stroke-width="${SW_INK}" stroke-linejoin="round"/>`;
  function sneaker(o, top, up, sole, solH, soleInner) {
    const {d, kx, cw, fx, fy, frx} = o, hx = kx - d * (cw + 3), tx = fx + d * (frx + 2), sy = fy + 5;
    return shoePath(`M${f(hx)} ${f(top)}L${f(kx + d * (cw + 2))} ${f(top)}Q${f(kx + d * (cw + 3))} ${f(fy - 7)} ${f(fx + d * frx * .3)} ${f(fy - 8)}Q${f(tx + d * 2)} ${f(fy - 7)} ${f(tx)} ${f(sy - solH)}L${f(hx)} ${f(sy - solH)}Z`, up)
      + `<path d="M${f(hx - d)} ${f(sy - solH)}L${f(tx + d * 1.5)} ${f(sy - solH)}Q${f(tx + d * 3.5)} ${f(sy - solH * .4)} ${f(tx)} ${f(sy + 1)}L${f(hx - d)} ${f(sy + 1)}Z" fill="${sole}" stroke="${INK}" stroke-width="${SW_INK}" stroke-linejoin="round">${soleInner || ""}</path>`;
  }
  // tige de botte / chaussette : du point t (entre genou et cheville) jusqu'à la cheville
  function shaft(o, t, extra, col, cap) {
    const a = lerp(o.L.knee, o.L.ank, t), b = [o.L.ank[0], o.L.ank[1] + 2], w = o.CW + extra, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    return `<path d="M${pt(a)}L${pt(b)}" stroke="${INK}" stroke-width="${f(w + 6)}"/><path d="M${pt(a)}L${pt(b)}" stroke="${col}" stroke-width="${f(w)}"/>`
      + `<path d="M${f(a[0] + nx * (w / 2 + 3))} ${f(a[1] + ny * (w / 2 + 3))}L${f(a[0] - nx * (w / 2 + 3))} ${f(a[1] - ny * (w / 2 + 3))}" stroke="${cap || INK}" stroke-width="${cap ? 4 : 2.6}"/>`;
  }
  const along = (o, t, k) => { const a = lerp(o.L.knee, o.L.ank, t); return [a[0], a[1] + (k || 0)]; };
  const SHOES2 = {
    fluos: o => sneaker(o, o.fy - 10, "#d7ff1f", "#ff2e88", 4.5)
      + `<path d="M${f(o.kx - o.d * o.cw)} ${f(o.fy - 3)}Q${f(o.fx)} ${f(o.fy - 9)} ${f(o.fx + o.d * o.frx * .9)} ${f(o.fy - 2)}" stroke="#ff2e88" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M${f(o.kx + o.d * (o.cw * .4 + 2))} ${f(o.fy - 9)}l${f(o.d * 4)} 2.4M${f(o.kx + o.d * (o.cw * .4 + 5))} ${f(o.fy - 7.6)}l${f(o.d * 4)} 2.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
    retro: o => { const top = o.L.ank[1] - 10 - 3 * o.m;
      return sneaker(o, top, "#fbfbf7", "#e9e1cf", 4) + `<path d="M${f(o.kx - o.d * (o.cw + 3))} ${f(top + 1.4)}L${f(o.kx + o.d * (o.cw + 2))} ${f(top + 1.4)}" stroke="#e63946" stroke-width="3.4"/>`
        + `<path d="M${f(o.kx - o.d * (o.cw + 1))} ${f(o.fy - 1)}Q${f(o.kx + o.d * o.cw * .3)} ${f(o.fy - 2)} ${f(o.fx + o.d * o.frx * .7)} ${f(o.fy - 9)}Q${f(o.kx + o.d * o.cw * .2)} ${f(o.fy - 6)} ${f(o.kx - o.d * (o.cw + 1))} ${f(o.fy - 6)}Z" fill="#e63946" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<path d="M${f(o.kx + o.d * o.cw * .2)} ${f(top + 6)}h${f(o.d * 4)}M${f(o.kx + o.d * o.cw * .3)} ${f(top + 10)}h${f(o.d * 4)}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`; },
    claquettes: o => [shaft(o, .5, 4, "#fbfbf7")
      + `<path d="M${f(along(o, .6)[0] - (o.CW / 2 + 2))} ${f(along(o, .6)[1])}h${f(o.CW + 4)}M${f(along(o, .68)[0] - (o.CW / 2 + 2))} ${f(along(o, .68)[1])}h${f(o.CW + 4)}" stroke="#2f6fdc" stroke-width="2.4"/>`,
      `<ellipse cx="${f(o.fx)}" cy="${f(o.fy - 1)}" rx="${f(o.frx)}" ry="6" fill="#fbfbf7" stroke="${INK}" stroke-width="2.8"/><ellipse cx="${f(o.fx)}" cy="${f(o.fy + 4.4)}" rx="${f(o.frx + 3)}" ry="3.4" fill="#2b2b33" stroke="${INK}" stroke-width="2.6"/>`
      + `<path d="M${f(o.fx - o.frx * .55)} ${f(o.fy + 3)}L${f(o.fx - o.frx * .5)} ${f(o.fy - 6)}L${f(o.fx + o.frx * .5)} ${f(o.fy - 6)}L${f(o.fx + o.frx * .55)} ${f(o.fy + 3)}Z" fill="#2b2b33" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M${f(o.fx - 4)} ${f(o.fy - 5)}l-1 7M${f(o.fx)} ${f(o.fy - 5)}v7M${f(o.fx + 4)} ${f(o.fy - 5)}l1 7" stroke="#fff" stroke-width="1.6"/>`],
    crampons: o => [shaft(o, .1, 4, "#e63946", "#fff") + [.22, .3].map(t => `<path d="M${f(along(o, t)[0] - o.CW / 2 - 2)} ${f(along(o, t)[1])}h${f(o.CW + 4)}" stroke="#fff" stroke-width="2.2"/>`).join(""),
      sneaker(o, o.fy - 10, "#1d1d29", "#1d1d29", 3)
      + `<path d="M${f(o.kx - o.d * o.cw)} ${f(o.fy - 2)}Q${f(o.fx)} ${f(o.fy - 8)} ${f(o.fx + o.d * o.frx)} ${f(o.fy - 3)}" stroke="#b6ff3b" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      + [-.6, 0, .6].map(k => `<rect x="${f(o.fx + k * o.frx - 1.6)}" y="${f(o.fy + 5)}" width="3.2" height="3.4" rx="1" fill="#e6e6ea" stroke="${INK}" stroke-width="1.2"/>`).join("")],
    mocassins: o => [shaft(o, .48, 3, "#fbfbf7"), sneaker(o, o.fy - 7, "#7a3f1d", "#3b2414", 2.6)
      + `<path d="M${f(o.kx + o.d * (o.cw * .2))} ${f(o.fy - 6)}q${f(o.d * 6)} 2.4 ${f(o.d * 11)} -1" stroke="#3b2414" stroke-width="2.2" fill="none"/><circle cx="${f(o.kx + o.d * (o.cw * .2 + 6))}" cy="${f(o.fy - 3.6)}" r="1.8" fill="#f5c518" stroke="${INK}" stroke-width=".8"/>`],
    powerlift: o => { const {d, kx, cw, fx, fy, frx} = o, hx = kx - d * (cw + 3), tx = fx + d * (frx + 2);
      return sneaker(o, fy - 12, "#2f6fdc", "#2f6fdc", 3) + shoePath(`M${f(hx - d)} ${f(fy + 1)}L${f(kx + d * (cw + 2))} ${f(fy + 3)}L${f(tx)} ${f(fy + 4)}L${f(tx)} ${f(fy + 6)}L${f(hx - d)} ${f(fy + 6)}Z`, "#c98a4b")
        + `<path d="M${f(hx)} ${f(fy + 3.4)}L${f(kx + d * cw)} ${f(fy + 4.6)}" stroke="#8a5a2b" stroke-width="1.2"/><path d="M${f(kx - d * (cw + 2))} ${f(fy - 8)}L${f(kx + d * (cw + 6))} ${f(fy - 6)}" stroke="#fbfbf7" stroke-width="4.2"/><path d="M${f(kx - d * (cw + 2))} ${f(fy - 8)}L${f(kx + d * (cw + 6))} ${f(fy - 6)}" stroke="${INK}" stroke-width="1" stroke-dasharray="2 1.4"/>`; },
    crocs: o => { const {d, kx, cw, fx, fy, frx} = o, hx = kx - d * (cw + 2.5), tx = fx + d * (frx + 3), cols = ["#ff2e88", "#ffd23f", "#2fa8ff"];
      let c = shoePath(`M${f(hx)} ${f(fy - 9)}Q${f(kx)} ${f(fy - 15)} ${f(fx + d * frx * .4)} ${f(fy - 11)}Q${f(tx + d * 5)} ${f(fy - 8)} ${f(tx + d)} ${f(fy + 4)}L${f(hx)} ${f(fy + 4)}Z`, "#7bd389")
        + `<path d="M${f(hx - d)} ${f(fy + 2)}H${f(tx + d)}" stroke="#4fa765" stroke-width="2.4"/><path d="M${f(hx + d * 1.5)} ${f(fy - 8)}Q${f(hx - d * 5)} ${f(fy - 2)} ${f(hx + d * 2)} ${f(fy + 1)}" stroke="${INK}" stroke-width="2.4" fill="none"/>`;
      for (let i = 0; i < 4; i++) c += `<circle cx="${f(fx - d * 2 + d * i * frx * .32)}" cy="${f(fy - 9 + i * 1.4)}" r="1.1" fill="#3e8a54"/>`;
      for (let i = 0; i < 3; i++) c += `<circle cx="${f(kx + d * (cw * .3 + i * 4.6))}" cy="${f(fy - 4 + (i % 2) * 2.4)}" r="2.3" fill="${cols[i]}" stroke="${INK}" stroke-width="1.1"/>`;
      return c; },
    boxe: o => { const top = along(o, .4);
      let c = shaft(o, .4, 6, "#d62828", "#fff");
      for (let i = 0; i < 4; i++) { const q = lerp(top, o.L.ank, .15 + i * .2); c += `<path d="M${f(q[0] - o.CW * .22)} ${f(q[1] - 2)}L${f(q[0] + o.CW * .22)} ${f(q[1] + 2)}M${f(q[0] + o.CW * .22)} ${f(q[1] - 2)}L${f(q[0] - o.CW * .22)} ${f(q[1] + 2)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`; }
      return [c, sneaker(o, o.L.ank[1] - 4, "#d62828", "#fbfbf7", 2.6)]; },
    talons: o => { const {d, kx, cw, fx, fy, frx} = o, bx = kx - d * (cw + 1), tx = fx + d * (frx + 3), sx = bx + d * 3;
      return `<ellipse cx="${f(fx)}" cy="${f(fy - 5)}" rx="${f(frx * .8)}" ry="4.6" fill="${o.skin}" stroke="${INK}" stroke-width="2.6" transform="rotate(${d * 14} ${f(fx)} ${f(fy - 5)})"/>`
        + shoePath(`M${f(bx)} ${f(fy - 15)}Q${f(kx + d * cw * .4)} ${f(fy - 6)} ${f(fx + d * frx * .5)} ${f(fy - 3)}Q${f(tx + d * 2)} ${f(fy - 1)} ${f(tx)} ${f(fy + 6)}L${f(fx + d * frx * .3)} ${f(fy + 6)}Q${f(kx + d * cw * .3)} ${f(fy + 2)} ${f(bx)} ${f(fy - 6)}Z`, "#e63946")
        + `<path d="M${f(sx)} ${f(fy - 6)}L${f(sx + d * 1.4)} ${f(fy + 6)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${f(sx)} ${f(fy - 6)}L${f(sx + d * 1.4)} ${f(fy + 6)}" stroke="#e63946" stroke-width="2" stroke-linecap="round"/>`
        + `<path d="M${f(fx + d * frx * .4)} ${f(fy)}q${f(d * 4)} 0 ${f(d * 8)} 3" stroke="#ff8a8f" stroke-width="1.6" fill="none"/>`; },
    pantoufles: o => { const {d, fx, fy, frx} = o, ex = fx + d * frx * .45;
      return `<path d="M${f(ex - d * 2)} ${f(fy - 6)}Q${f(ex - d * 6)} ${f(fy - 24)} ${f(ex - d * 1)} ${f(fy - 25)}Q${f(ex + d * 3)} ${f(fy - 18)} ${f(ex + d * 2)} ${f(fy - 6)}Z" fill="#ffc2dc" stroke="${INK}" stroke-width="2.4"/><path d="M${f(ex + d * 2)} ${f(fy - 6)}Q${f(ex + d * 5)} ${f(fy - 22)} ${f(ex + d * 10)} ${f(fy - 22)}Q${f(ex + d * 11)} ${f(fy - 14)} ${f(ex + d * 6)} ${f(fy - 5)}Z" fill="#ffc2dc" stroke="${INK}" stroke-width="2.4"/>`
        + `<ellipse cx="${f(fx + d * 2)}" cy="${f(fy)}" rx="${f(frx + 5)}" ry="8.5" fill="#ffc2dc" stroke="${INK}" stroke-width="3"/><ellipse cx="${f(fx - d * frx * .4)}" cy="${f(fy - 4)}" rx="${f(frx * .5)}" ry="3.6" fill="#fff" stroke="${INK}" stroke-width="1.8"/>`
        + `<circle cx="${f(ex + d * 2)}" cy="${f(fy - 2)}" r="1.5" fill="${INK}"/><circle cx="${f(ex + d * 7)}" cy="${f(fy - 2)}" r="1.5" fill="${INK}"/><circle cx="${f(ex + d * 5.4)}" cy="${f(fy + 1.6)}" r="1.6" fill="#ff5d8a"/>`; },
    moonboot: o => { const {d, fx, fy, frx} = o, t0 = along(o, .5);
      let c = `<ellipse cx="${f(fx + d * 1)}" cy="${f(fy - 2)}" rx="${f(frx + 5)}" ry="9" fill="#dfe3ea" stroke="${INK}" stroke-width="3"/><path d="M${f(fx - frx - 6)} ${f(fy + 4)}H${f(fx + frx + 7)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${f(fx - frx - 6)} ${f(fy + 4)}H${f(fx + frx + 7)}" stroke="#ff7b00" stroke-width="2.6" stroke-linecap="round"/>`;
      let sh = shaft(o, .5, 12, "#dfe3ea");
      for (let i = 1; i < 4; i++) { const q = lerp(t0, o.L.ank, i / 4); sh += `<path d="M${f(q[0] - o.CW / 2 - 5)} ${f(q[1])}q${f(o.CW / 2 + 5)} 3 ${f(o.CW + 10)} 0" stroke="#a9b0bc" stroke-width="1.6" fill="none"/>`; }
      return [sh, c + `<path d="M${f(o.kx + d * 2)} ${f(fy - 9)}l${f(d * 6)} 3M${f(o.kx + d * 2)} ${f(fy - 5)}l${f(d * 6)} -3" stroke="#e63946" stroke-width="1.8" stroke-linecap="round"/>`]; },
    led: o => sneaker(o, o.fy - 10, "#fbfbf7", "#ff2e88", 5.5, `<animate attributeName="fill" values="#ff2e88;#3ae0ff;#39ff7a;#ffd23f;#ff2e88" dur="1.4s" repeatCount="indefinite"/>`)
      + `<ellipse cx="${f(o.fx)}" cy="${f(o.fy + 6)}" rx="${f(o.frx + 8)}" ry="3.2" fill="#ff2e88" opacity=".45"><animate attributeName="fill" values="#ff2e88;#3ae0ff;#39ff7a;#ffd23f;#ff2e88" dur="1.4s" repeatCount="indefinite"/></ellipse>`
      + `<path d="M${f(o.kx - o.d * o.cw)} ${f(o.fy - 4)}Q${f(o.fx)} ${f(o.fy - 9)} ${f(o.fx + o.d * o.frx * .8)} ${f(o.fy - 4)}" stroke="#2fa8ff" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  };

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
    // tenue (boutique) > haut de l'éditeur ; bas de la boutique > pantalon de la tenue > short de l'éditeur
    const HT = HAUTS[eq.haut] || null, topK = HT ? (HT.nu ? "nu" : "shop") : look.top;
    const PT = BOTTOMS[eq.taille] || (HT && HT.pants) || null;
    const lucha = !!(HT && HT.mask) && eq.visage !== "catcheur";
    // sous un chapeau, l'afro dégradée (high-top) devient une coupe courte
    if (look.hair === "degrade" && (["casqenv", "viking", "bonnetbain", "disco", "bob", "bonnet", "snapback"].includes(eq.tete) || look.acc === "casquette")) look.hair = "court";
    if (eq.visage === "catcheur" || eq.tete === "bonnetbain" || eq.tete === "disco" || eq.tete === "durag" || eq.tete === "cretefluo" || lucha) look.hair = "chauve"; // cagoule / bonnet / perruque par-dessus
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
    const bust = opts.view === "bust";
    const vb = bust ? `${f(100 - hw)} ${f(headY - headR - 18)} ${f(hw * 2)} ${f(hw * 2)}` : "-45 -12 290 280";
    let vbOut = vb;
    // cadre utile pour les armes (le buste coupe sous les pectoraux : l'arme y est brandie, poing levé)
    const wbox = bust ? [100 - hw + 2, headY - headR - 16, 100 + hw - 2, headY - headR - 20 + hw * 2] : null;
    const bustArm = bust && pose === "idle" && !!(eq.arme && WEAPONS[eq.arme]);
    // en vue buste, le bas du corps sort souvent du cadre : on n'y dessine pas les finitions invisibles
    const lowVis = !bust || headY - headR - 18 + hw * 2 > 166;
    let s = "";
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
    let dosFx = null;
    const dosItem = () => {
      let o = "";
      if (eq.dos === "surf") {
        const L2 = 128 + 10 * m, w2 = 21 + 5 * m;
        o += `<g transform="rotate(-24 ${cx} 140)"><ellipse cx="${cx}" cy="140" rx="${f(w2)}" ry="${f(L2)}" fill="#ffd23f" stroke="${ink}" stroke-width="4"/><path d="M${cx} ${f(140 - L2 + 10)}V${f(140 + L2 - 10)}" stroke="#ff6b35" stroke-width="5"/><path d="M${f(cx - w2 + 4)} 60h${f(2 * w2 - 8)}M${f(cx - w2 + 2)} 70h${f(2 * w2 - 4)}" stroke="#2fa8ff" stroke-width="4"/></g>`;
      }
      if (eq.dos === "fourreau" || eq.dos === "carquois") {
        // katana / carquois en bandoulière dans le dos : on voit dépasser la poignée (ou les flèches) au-dessus d'une épaule
        const q = eq.dos === "fourreau", p0 = q ? [cx - SW * .55 - 4, trapTop - 6] : [cx + SW * .5 + 2, trapTop - 4], p1 = q ? [cx + SW * .62 + 8, 196] : [cx - SW * .4 - 6, 178];
        const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const pl = placeLocal(BACKW[eq.dos], p0[0], p0[1], ang, false, 1, Math.max(.7, len / (q ? 124 : 92)));
        o += pl.svg;
        dosFx = {def: BACKW[eq.dos], pl};
      }
      if (eq.dos === "sacsport") {
        const d = back ? -1 : 1, bw2 = 40 + 12 * m, bh2 = 24 + 5 * m, x0 = cx + d * (W + 10 + 8 * m), y0 = 150;
        if (back) o += `<path d="M${f(cx + SW * .55)} ${f(trapTop + 6)}L${f(x0)} ${f(y0)}" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M${f(cx + SW * .55)} ${f(trapTop + 6)}L${f(x0)} ${f(y0)}" stroke="#2f6fdc" stroke-width="5.4" stroke-linecap="round"/>`;
        o += `<rect x="${f(x0 - bw2 / 2)}" y="${f(y0)}" width="${f(bw2)}" height="${f(bh2)}" rx="${f(bh2 * .45)}" fill="#2f6fdc" stroke="${ink}" stroke-width="3.4"/><path d="M${f(x0 - bw2 / 2 + 6)} ${f(y0 + 3)}V${f(y0 + bh2 - 3)}M${f(x0 + bw2 / 2 - 6)} ${f(y0 + 3)}V${f(y0 + bh2 - 3)}" stroke="#1f4fa8" stroke-width="3"/><path d="M${f(x0 - bw2 * .25)} ${f(y0 + bh2 * .62)}q${f(bw2 * .25)} ${f(-bh2 * .5)} ${f(bw2 * .5)} ${f(-bh2 * .2)}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${f(x0 - bw2 * .35)} ${f(y0 + 4)}H${f(x0 + bw2 * .35)}" stroke="${ink}" stroke-width="1.6" stroke-dasharray="2 2"/>`;
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

    // dreads : mèches qui tombent derrière la tête (de face) ou sur la nuque (de dos)
    const dreadLocs = bk => {
      const hc0 = look.hairColor, r0 = headR, out = [];
      if (bk) for (let i = -3; i <= 3; i++) out.push([[cx + i * r0 * .24, headY - r0 * .2], [cx + i * r0 * .3, yS - 6 + Math.abs(i) * 2 + (i % 2 ? 6 : 0)]]);
      else for (const d of [-1, 1]) for (let j = 0; j < 4; j++) out.push([[cx + d * r0 * (.45 + j * .15), headY - r0 * (.75 - j * .22)], [cx + d * (r0 * .8 + j * 4 + 4), headY + r0 + 8 + j * 5 - (j === 3 ? 6 : 0)]]);
      let o = "";
      for (const w of [7.5, 4.6]) for (const [a, b] of out) o += `<path d="M${pt(a)}Q${f((a[0] + b[0]) / 2 + (b[0] - a[0]) * .3)} ${f((a[1] + b[1]) / 2)} ${pt(b)}" stroke="${w > 5 ? ink : hc0}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
      for (const [a, b] of out) o += `<path d="M${pt(a)}Q${f((a[0] + b[0]) / 2 + (b[0] - a[0]) * .3)} ${f((a[1] + b[1]) / 2)} ${pt(b)}" stroke="${shade(hc0, 1.6)}" stroke-width="4.6" fill="none" stroke-dasharray="1.4 5" opacity=".55"/>`;
      return o;
    };
    const duragTails = bk => { const x0 = bk ? cx - 3 : cx + headR * .55, y0 = headY - headR * .1; let o = ""; for (const [dx, l] of [[0, 1], [7, .85]]) o += `<path d="M${f(x0 + dx)} ${f(y0)}Q${f(x0 + dx + (bk ? 2 : 8))} ${f(y0 + 30)} ${f(x0 + dx + (bk ? -2 : 6))} ${f(y0 + (yS - y0 + 14) * l)}l6 -2Q${f(x0 + dx + (bk ? 6 : 14))} ${f(y0 + 30)} ${f(x0 + dx + 6)} ${f(y0)}Z" fill="#2c2f7a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`; return o; };
    // ---- coiffure arrière (afro, queue) / mulet / perruque disco
    const discoWig = () => { const R = headR + 20 + 4 * m, cy = headY - 8, cols = ["#ff2e88", "#ffd23f", "#3ccf8e", "#2fa8ff", "#b14dff"]; let o = `<circle cx="${cx}" cy="${f(cy)}" r="${f(R)}" fill="${cols[0]}" stroke="${ink}" stroke-width="4"/>`; for (let i = 1; i < 5; i++) o += `<circle cx="${cx}" cy="${f(cy)}" r="${f(R * (1 - i * .16))}" fill="${cols[i]}"/>`; for (let i = 0; i < 9; i++) o += star(cx + Math.cos(i * 2.2) * R * .78, cy + Math.sin(i * 2.2) * R * .78, 4, "#fff"); return o; };
    if (!back && eq.tete === "disco") s += discoWig();
    // afro : boucles en couronne (ombre) et reflet sur le dessus
    const afroFx = (cy0, R) => { let c = ""; for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7 + .2, p = [cx + Math.cos(a) * R * .8, cy0 + Math.sin(a) * R * .8], v = [Math.cos(a), Math.sin(a)]; c += tap(add(p, rot(v, 90), 3.2), add(p, v, 3), add(p, rot(v, -90), 3.2), 1.6); }
      return paint(c, "#000", ".22") + paint(moon([cx, cy0], R - 3, -125, .2), "#fff", ".16"); };
    if (!back && look.hair === "afro") s += `<circle cx="100" cy="${f(headY - 4)}" r="${f(headR + 13)}" fill="${look.hairColor}" stroke="${ink}" stroke-width="4"/>` + afroFx(headY - 4, headR + 13);
    if (!back && look.hair === "queue") s += `<path d="M${f(cx + headR * .6)} ${f(headY - headR * .4)} q 26 6 20 46 q -10 -6 -24 -28 z" fill="${look.hairColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
      + paint(tap([cx + headR * .6 + 6, headY - headR * .4 + 4], [cx + headR * .6 + 19, headY - headR * .4 + 14], [cx + headR * .6 + 18, headY - headR * .4 + 38], 2.2), "#000", ".25") + paint(tap([cx + headR * .6 + 9, headY - headR * .4 + 2], [cx + headR * .6 + 22, headY - headR * .4 + 8], [cx + headR * .6 + 22, headY - headR * .4 + 24], 2), "#fff", ".3");
    if (!back && look.hair === "dreads") s += dreadLocs(false);
    if (!back && look.hair === "manbun") { const bx = cx + headR * .12, by = headY - headR - 3, br = 8 + headR * .08; s += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(br)}" fill="${look.hairColor}" stroke="${ink}" stroke-width="3.5"/>`
      + paint(tap([bx - br * .7, by + br * .1], [bx - br * .1, by - br * .55], [bx + br * .7, by - br * .1], 1.8) + tap([bx - br * .6, by + br * .45], [bx + br * .1, by + br * .05], [bx + br * .75, by + br * .35], 1.6), "#000", ".28") + paint(tap([bx - br * .55, by - br * .35], [bx - br * .3, by - br * .8], [bx + br * .1, by - br * .72], 1.6), "#fff", ".35"); }
    if (!back && eq.tete === "durag") s += duragTails(false);

    // ---- jambes
    const legs = [], spread = Math.max(0, TW - (10 + 25 * m)) * .5, shoes = [], footX = {}, feet = {};
    for (const d of [-1, 1]) {
      let hip = [cx + d * (H - 9 - 3 * m + spread), 172], knee = [cx + d * (H - 7 + 2 * m + spread * 1.1), 212], ank = [cx + d * (H - 9 + spread * .8), 245], toe = false;
      if (pose === "leg" && d === 1) { knee = [hip[0] + 16 + 8 * m + TW * .15, 206]; ank = [knee[0] - 3, 240]; toe = true; }
      legs.push({d, hip, knee, ank, toe});
    }
    const calf = L => { const c = lerp(L.knee, L.ank, .32); return [c[0] + L.d * CW * .3, c[1], CW * .42 + 1]; };
    const quad = L => { const c = lerp(L.hip, L.knee, .6); return [c[0] + L.d * TW * .2, c[1], TW * .36 + 1]; };
    const bigLegs = !gr.skip && kj > 1.12 && m > .15;
    const LG = {sh: "", hl: "", ik: "", ro: "", kn: "", ks: "", kh: ""}; // modelé des deux jambes, peint en une passe après la boucle
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
        // modelé de la jambe : ombre côté intérieur, reflet sur le tibia, goutte du quadriceps, mollet, rotule
        const nT = shadeN(L.hip, L.knee, L.d), nC = shadeN(L.knee, L.ank, L.d), uC = nrm(L.knee, L.ank), mm = Math.min(1, m);
        let sh = rim(L.hip, L.knee, TW / 2, TW * .2, nT) + rim(L.knee, L.ank, CW / 2, CW * .2 + 1, nC), hl = "", ik = "";
        if (m > .3) { // goutte du quadriceps (au-dessus du genou, côté intérieur) et galbe du mollet
          const q0 = lerp(L.hip, L.knee, .6), k1 = add(L.knee, uC, -TW * .1);
          ik += tap(add(q0, nT, TW * .3), add(lerp(q0, k1, .55), nT, TW * .42), add(k1, nT, TW * .08), 2.2);
          const c0 = lerp(L.knee, L.ank, .14), c1 = lerp(L.knee, L.ank, .62);
          ik += tap(add(c0, nC, -CW * .3), add(lerp(c0, c1, .45), nC, -CW * .62), add(c1, nC, -CW * .12), 2 + mm);
          sh += tap(add(c0, nC, CW * .18), add(lerp(c0, c1, .5), nC, CW * .05), add(c1, nC, CW * .3), CW * .16);
        }
        LG.sh += sh; LG.hl += hl; LG.ik += ik;
        if (m < .35 && !bigLegs) { // genoux cagneux de la crevette : rotule ronde, ombre et reflet
          const kr = 7.5 - 6 * m;
          LG.kn += `<circle cx="${f(L.knee[0])}" cy="${f(L.knee[1])}" r="${f(kr)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>`;
          LG.ks += moon(L.knee, kr - 1, 90 - 30 * L.d, .4); LG.kh += tap([L.knee[0] - kr * .5, L.knee[1] - kr * .25], [L.knee[0] - kr * .25, L.knee[1] - kr * .62], [L.knee[0] + kr * .2, L.knee[1] - kr * .55], 1.4);
        } else LG.ro += tap(add(L.knee, nC, CW * .3), add(L.knee, uC, 6 + 2 * mm), add(L.knee, nC, -CW * .3), 2); // rotule
      }
      const fy = L.toe ? L.ank[1] + 7 : 251, fx = L.ank[0] + L.d * 5, frx = 12 + 4 * m;
      let shoe = "", shoePre = "";
      if (eq.pieds === "tongs") {
        shoe = `<ellipse cx="${f(fx)}" cy="${f(fy + 3)}" rx="${f(frx + 2)}" ry="4" fill="#2fa8ff" stroke="${ink}" stroke-width="3"/><ellipse cx="${f(fx)}" cy="${f(fy - 1)}" rx="${f(frx - 1)}" ry="5" fill="${skin}" stroke="${ink}" stroke-width="2.6"/><path d="M${f(fx - frx * .6)} ${f(fy + 1)}L${f(fx + L.d * frx * .35)} ${f(fy - 5)}L${f(fx + frx * .6)} ${f(fy + 1)}" stroke="#ffd23f" stroke-width="3.2" fill="none" stroke-linejoin="round"/>`;
      } else if (eq.pieds === "palmes") {
        const tip = fx + L.d * (frx + 30 + 6 * m);
        shoe = `<path d="M${f(fx - L.d * frx * .6)} ${f(fy - 6)}L${f(tip)} ${f(fy - 10)}Q${f(tip + L.d * 4)} ${f(fy + 2)} ${f(tip)} ${f(fy + 8)}L${f(fx - L.d * frx * .6)} ${f(fy + 6)}Z" fill="#ffd23f" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(fx + L.d * 8)} ${f(fy - 5)}L${f(tip - L.d * 4)} ${f(fy - 4)}M${f(fx + L.d * 8)} ${f(fy + 4)}L${f(tip - L.d * 4)} ${f(fy + 3)}" stroke="#e0a800" stroke-width="2.4"/><ellipse cx="${f(fx - L.d * 2)}" cy="${f(fy)}" rx="${f(frx * .8)}" ry="7" fill="#2fa8ff" stroke="${ink}" stroke-width="3"/>`;
      } else if (eq.pieds === "cowboy" || eq.pieds === "cowboyor") {
        const kx = L.ank[0], top = L.ank[1] - 26 - 4 * m, bw = CW / 2 + 5, gold = eq.pieds === "cowboyor";
        shoe = `<path d="M${f(kx - bw)} ${f(top)}L${f(kx + bw)} ${f(top)}L${f(kx + bw - 1)} ${f(fy - 4)}L${f(fx + L.d * (frx + 4))} ${f(fy - 2)}Q${f(fx + L.d * (frx + 8))} ${f(fy + 5)} ${f(fx + L.d * frx)} ${f(fy + 5)}L${f(kx - L.d * bw)} ${f(fy + 5)}L${f(kx - L.d * bw)} ${f(fy + 9)}L${f(kx - L.d * (bw - 7))} ${f(fy + 9)}L${f(kx - bw + 1)} ${f(fy - 2)}Z" fill="${gold ? "#f5c518" : "#8a4b20"}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(kx - bw + 3)} ${f(top + 8)}q${f(bw - 3)} 8 ${f(2 * bw - 6)} 0" stroke="${gold ? "#fff3a0" : "#f5c518"}" stroke-width="2.4" fill="none"/>${star(kx - L.d * bw - 2, fy + 3, 4, gold ? "#fff" : "#d9dde3")}`;
        if (gold) shoe += `<path d="M${f(kx - bw * .5)} ${f(top + 14)}q${f(bw * .5)} 6 ${f(bw)} 0" stroke="#b8860b" stroke-width="1.8" fill="none"/>` + star(kx + bw * .35, top + 6, 3.2, "#fff") + star(fx + L.d * frx * .5, fy - 1, 2.6, "#fff");
      } else if (eq.pieds === "rollers") {
        shoe = `<path d="M${f(fx - frx)} ${f(fy + 3)}L${f(fx - frx)} ${f(fy - 16)}Q${f(fx)} ${f(fy - 20)} ${f(fx + L.d * 2)} ${f(fy - 12)}L${f(fx + frx + 2)} ${f(fy - 4)}Q${f(fx + frx + 4)} ${f(fy + 3)} ${f(fx + frx)} ${f(fy + 3)}Z" fill="#fff" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="M${f(fx - frx)} ${f(fy - 8)}H${f(fx + 4)}" stroke="#ff2e88" stroke-width="4"/>`;
        for (let i = 0; i < 3; i++) shoe += `<circle cx="${f(fx - frx * .7 + i * frx * .7)}" cy="${f(fy + 8)}" r="5" fill="#ff2e88" stroke="${ink}" stroke-width="2.4"/><circle cx="${f(fx - frx * .7 + i * frx * .7)}" cy="${f(fy + 8)}" r="1.6" fill="#fff"/>`;
      } else if (SHOES2[eq.pieds]) { const r = SHOES2[eq.pieds]({L, fx, fy, frx, m, CW, skin, d: L.d, kx: L.ank[0], cw: CW / 2}); if (Array.isArray(r)) { shoePre = r[0]; shoe = r[1]; } else shoe = r; }
      else { // basket par défaut : semelle, bout renforcé, lacets, liseré rose et reflet
        const d = L.d, lx = fx - d * frx * .3;
        shoe = `<ellipse cx="${f(fx)}" cy="${f(fy)}" rx="${f(frx)}" ry="7" fill="#f4f1ea" stroke="${ink}" stroke-width="3.5"/>`;
        if (lowVis) shoe += `<path d="M${f(fx - frx + .6)} ${f(fy + 1.6)}A${f(frx)} 7 0 0 0 ${f(fx + frx - .6)} ${f(fy + 1.6)}Q${f(fx)} ${f(fy + 4.2)} ${f(fx - frx + .6)} ${f(fy + 1.6)}Z" fill="#d6337a"/>`
          + `<path d="M${f(fx - frx + 1)} ${f(fy + 1.4)}Q${f(fx)} ${f(fy + 4)} ${f(fx + frx - 1)} ${f(fy + 1.4)}M${f(fx + d * frx * .35)} ${f(fy - 6)}q${f(d * frx * .5)} 1.6 ${f(d * frx * .58)} 6.4M${f(lx - 3.2)} ${f(fy - 5.6)}l6.4 2.6M${f(lx - 3.2)} ${f(fy - 3)}l6.4 -2.6" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
;
      }
      feet[L.d] = [fx, fy];
      footX[L.d] = fx + L.d * (frx + 8 + (eq.pieds === "palmes" ? 30 + 6 * m : eq.pieds === "pantoufles" || eq.pieds === "moonboot" ? 5 : 0));
      shoes.push(shoePre + (L.toe ? `<g transform="rotate(${L.d * 18} ${f(fx)} ${f(fy)})">${shoe}</g>` : shoe));
    }
    if (lowVis) s += paint(LG.sh, "#000", f(.11 + .03 * Math.min(1, m))) + paint(LG.hl, "#fff", ".28") + paint(LG.ik, ink, f(.35 + .3 * Math.min(1, m))) + paint(LG.ro, ink, ".45")
      + LG.kn + paint(LG.ks, "#000", ".14") + paint(LG.kh, "#fff", ".6", 1);
    else s += LG.kn;
    // pantalon (tenue ou bas de la boutique) : par-dessus les jambes, sous les chaussures
    const pantsW = PT && PT.full ? [TW + (PT.baggy ? 8 : PT.tight ? 1.5 : 4), CW + (PT.baggy ? 9 : PT.tight ? 1.5 : 4)] : null;
    if (pantsW) {
      const [wT, wC] = pantsW, end = PT.end || .86, segs = legs.map(L => ({L, a: L.hip, b: L.knee, c: lerp(L.knee, L.ank, end)}));
      for (const g of segs) s += `<path d="M${pt(g.a)}L${pt(g.b)}" stroke="${ink}" stroke-width="${f(wT + 6)}" stroke-linecap="round"/><path d="M${pt(g.b)}L${pt(g.c)}" stroke="${ink}" stroke-width="${f(wC + 6)}"/>`;
      for (const g of segs) s += `<path d="M${pt(g.a)}L${pt(g.b)}" stroke="${PT.c}" stroke-width="${f(wT)}" stroke-linecap="round"/><path d="M${pt(g.b)}L${pt(g.c)}" stroke="${PT.c}" stroke-width="${f(wC)}"/>`;
      for (const g of segs) {
        const d = g.L.d, dx = g.c[0] - g.b[0], dy = g.c[1] - g.b[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const hem = (q, w) => `<path d="M${f(q[0] + nx * w)} ${f(q[1] + ny * w)}L${f(q[0] - nx * w)} ${f(q[1] - ny * w)}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
        if (PT.st) s += `<path d="M${f(g.a[0] + d * (wT / 2 - 3.5))} ${f(g.a[1] + 4)}L${f(g.b[0] + d * (wT / 2 - 3.5))} ${f(g.b[1])}L${f(g.c[0] + d * (wC / 2 - 3))} ${f(g.c[1])}" stroke="${PT.st}" stroke-width="3.2" fill="none" stroke-linejoin="round"/>`;
        if (PT.leo) { const L2 = []; [[g.a, g.b, wT, [.22, .46, .7, .93]], [g.b, g.c, wC, [.2, .55, .88]]].forEach(([p0, p1, w, ts]) => ts.forEach((t, i) => {
          for (const o of i % 2 ? [-.22, .18] : [-.05, .3]) { const q = lerp(p0, p1, t); L2.push([q[0] + o * w * d, q[1] + (o > 0 ? 2 : -1), Math.min(1.25, .7 + w / 60)]); }
        })); s += leoSpots(L2); }
        if (PT.cuff) { const q0 = lerp(g.b, g.c, .8); s += `<path d="M${pt(q0)}L${pt(g.c)}" stroke="${ink}" stroke-width="${f(wC + 9)}"/><path d="M${pt(q0)}L${pt(g.c)}" stroke="${PT.cuff}" stroke-width="${f(wC + 3)}"/>` + hem(q0, wC / 2 + 4.5) + hem(g.c, wC / 2 + 4.5); }
        else s += hem(g.c, wC / 2 + 3);
        if (PT.luc) { // flammes dorées en bas des collants
          let fl = "";
          const n = 3, w0 = wC + 1;
          for (let i = 0; i < n; i++) { const t = (i + .5) / n, bx = g.c[0] - nx * (w0 / 2) + nx * w0 * t, by = g.c[1] - ny * (w0 / 2) + ny * w0 * t, h = (i % 2 ? 10 : 15) + 4 * m; fl += `M${f(bx - w0 / n / 2)} ${f(by - 1)}Q${f(bx - 1)} ${f(by - h * .5)} ${f(bx + 1)} ${f(by - h)}Q${f(bx + 1)} ${f(by - h * .4)} ${f(bx + w0 / n / 2)} ${f(by - 1)}Z`; }
          s += `<path d="${fl}" fill="#ffd23f" stroke="#e85d04" stroke-width="1.6" stroke-linejoin="round"/>`;
        }
      }
    }
    // ombres de contact sous les pieds (l'ombre portée globale reste le 1er élément du SVG)
    if (lowVis) s += paint(legs.filter(L => !L.toe).map(L => { const x = L.ank[0] + L.d * 5, rx = 14 + 5 * m; return `M${f(x - rx)} 256.5a${f(rx)} 3.2 0 1 0 ${f(2 * rx)} 0a${f(rx)} 3.2 0 1 0 ${f(-2 * rx)} 0`; }).join(""), "#000", ".22");
    s += shoes.join("");
    // short (ou slip de la boutique)
    const shortY = 194 + 4 * m;
    const shortsCol = eq.taille === "leopard" ? "#e9a33b" : eq.taille === "slipor" ? "#f5c518" : eq.taille === "hawai" ? "#13a89e" : PT && PT.c ? PT.c : look.shorts;
    const SX = H + TW * .45 + 3 + spread;
    const shortD = `M${f(cx - H - 3)} 165 L${f(cx - SX)} ${f(shortY)} L${f(cx - 3)} ${f(shortY)} L${cx} ${f(shortY - 12)} L${f(cx + 3)} ${f(shortY)} L${f(cx + SX)} ${f(shortY)} L${f(cx + H + 3)} 165 Z`;
    if (PT && PT.kilt) {
      // kilt écossais : jupe plissée à carreaux (motif découpé dans la forme) + sporran devant
      const hem = Math.max(shortY + 12, 206 + 2 * m), KX = SX + 9, kd = `M${f(cx - H - 4)} 162 L${f(cx - KX)} ${f(hem)} L${f(cx + KX)} ${f(hem)} L${f(cx + H + 4)} 162 Z`, P = polyOf(kd);
      const ln = (c, w, lines) => `<path d="${clipLines(P, lines)}" stroke="${c}" stroke-width="${w}" fill="none" opacity=".85"/>`;
      const V = [], Hh = [], V2 = [], H2 = [];
      for (let x = cx - KX; x <= cx + KX; x += 11) { V.push([x, 158, x, hem + 2]); V2.push([x + 5, 158, x + 5, hem + 2]); }
      for (let y = 168; y <= hem; y += 11) { Hh.push([cx - KX - 4, y, cx + KX + 4, y]); H2.push([cx - KX - 4, y + 5, cx + KX + 4, y + 5]); }
      s += `<path d="${kd}" fill="#b3202a" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>` + ln("#1f4d2b", 4, V) + ln("#1f4d2b", 4, Hh) + ln("#ffd23f", 1, V2) + ln("#ffd23f", 1, H2);
      for (let i = 1; i < 6; i++) { const t = i / 6; s += `<path d="M${f(cx - H - 4 + (2 * H + 8) * t)} 170L${f(cx - KX + 2 * KX * t)} ${f(hem)}" stroke="${ink}" stroke-width="1.4" opacity=".45"/>`; }
      s += `<path d="M${f(cx - H - 4)} 163H${f(cx + H + 4)}" stroke="${ink}" stroke-width="8"/><path d="M${f(cx - H - 4)} 163H${f(cx + H + 4)}" stroke="#3b2414" stroke-width="5"/>`;
      if (!back) s += `<path d="M${f(cx - 8 - 2 * m)} 168h${f(16 + 4 * m)}v${f(10 + 2 * m)}q${f(-8 - 2 * m)} 8 ${f(-16 - 4 * m)} 0z" fill="#f4ecdc" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(cx - 4)} ${f(180 + 2 * m)}v6M${cx} ${f(181 + 2 * m)}v7M${f(cx + 4)} ${f(180 + 2 * m)}v6" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${cx}" cy="171.5" r="2" fill="#f5c518" stroke="${ink}" stroke-width="1"/>`;
    } else {
      s += `<path d="${shortD}" fill="${shortsCol}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      // finitions du short : ombre de l'entrejambe et des flancs, plis, surpiqûres d'ourlet, bandes latérales (short de l'éditeur)
      if (!pantsW && lowVis) {
        let sh = "", ik = "", st = "";
        for (const d of [-1, 1]) {
          const top = [cx + d * (H + 3), 165], bot = [cx + d * SX, shortY], k = 3 + 2 * m;
          sh += `M${pt(add(top, [-d, 0], 1))}L${pt(add(bot, [-d, 0], 1.5))}L${f(bot[0] - d * (k + 4))} ${f(shortY)}Q${f(cx + d * (H + 1 - k))} ${f(180)} ${f(top[0] - d * 2)} 165Z`;
          sh += tap([cx + d * 1.5, shortY - 11], [cx + d * 3, shortY - 5], [cx + d * 4, shortY - .5], 4);
          ik += tap([cx + d * 2, shortY - 11], [cx + d * (5 + 2 * m), shortY - 9], [cx + d * (11 + 4 * m), shortY - 5], 1.6);
          st += `M${f(cx + d * 6)} ${f(shortY - 3.4)}L${f(bot[0] - d * 3.4)} ${f(shortY - 3.4)}`;
        }
        s += paint(sh, "#000", ".16") + paint(ik, ink, ".45") + `<path d="${compact(st, 1)}" stroke="#fff" stroke-width="1.2" stroke-dasharray="2.4 2" opacity=".45"/>`;
        if (!PT && !eq.taille) s += `<path d="${[-1, 1].map(d => `M${f(cx + d * (H + 1))} 168L${f(cx + d * (SX - 2.6))} ${f(shortY - 1.6)}`).join("")}" stroke="#fff" stroke-width="2.4" opacity=".8"/>`;
      }
    }
    if (pantsW) for (const L of legs) { // on efface l'ourlet du short sur le pantalon
      const k0 = L.knee[1] - L.hip[1] || 1, a = lerp(L.hip, L.knee, (shortY - 5 - L.hip[1]) / k0), b = lerp(L.hip, L.knee, (shortY + 5 - L.hip[1]) / k0);
      s += `<path d="M${pt(a)}L${pt(b)}" stroke="${PT.c}" stroke-width="${f(pantsW[0] - 1)}"/>`;
    }
    if (PT && PT.leo) s += leoSpots(gridIn(polyOf(shortD), 9, 3).map(([x, y]) => [x, y, 1]));
    if (PT && PT.melon) {
      for (const [x, y] of gridIn(polyOf(shortD), 11, 4.5)) s += `<path d="M${f(x - 4.4)} ${f(y - 1.6)}a4.4 4.4 0 0 0 8.8 0z" fill="#ff4d6d" stroke="#2f9e44" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${f(x - 1.4)}" cy="${f(y)}" r=".8" fill="${ink}"/><circle cx="${f(x + 1.6)}" cy="${f(y + .2)}" r=".8" fill="${ink}"/>`;
    }
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
    const torsoP = d => ({nk: [cx + d * neckH, nkTop], c1: [cx + d * tc0, trapTop], sh: [cx + d * SW, yS + 4],
      c2: [cx + d * (SW + 7 + 5 * m + lat + Math.max(0, pd) * .25), yS + 19], lt: [cx + d * (SW - 3 + lat * .7), yS + 34],
      c3: [cx + d * (W + 6 + 18 * m + lat * .5), yS + 50], wa: [cx + d * W, 152], hp: [cx + d * H, 172]});
    const torso = () => {
      const a = torsoP(-1), b = torsoP(1);
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
    { // cou : arrondi (ombres sur les côtés) ; pomme d'Adam de la crevette
      const n0 = [cx, headY + headR * .4], n1 = [cx, yS];
      let sh = "";
      for (const d of [-1, 1]) sh += rim(add(n0, [d, 0], 0), add(n1, [d, 0], 0), neckH - 1, Math.max(1.4, neckH * .28), [d, 0]);
      s += paint(sh, "#000", ".13");
      if (!back && m < .45) s += paint(tap([cx - 1.6, headY + headR + 3], [cx + 2.2, headY + headR + 5.5], [cx - 1, headY + headR + 8], 1.4), ink, ".45", 1);
    }
    s += `<path d="${torso()}" fill="${skin}" stroke="${ink}" stroke-width="4.5" stroke-linejoin="round"/>`;

    // détails musculaires sur la peau (traits effilés à l'encre + ombres et reflets neutres)
    const det = [];
    const pw = SW * Math.min(.72, .55 + .07 * kp);
    if (back) {
      const o = Math.min(1, .35 + m);
      let ik = tap([cx, yS + 2], [cx, 135], [cx, 166], 2.8), sh = tap([cx + 1, yS + 16], [cx + 2.5, 140], [cx + 1, 163], 3 + 3 * m), hl = "";
      for (const d of [-1, 1]) {
        const a = [cx + d * 6, yS + 14], c = [cx + d * (6 + SW * .35), yS + 10], b = [cx + d * (6 + SW * .42), yS + 38 + 6 * m];
        ik += tap(a, c, b, 2.8); // omoplates
        sh += `M${pt(a)}Q${pt(c)} ${pt(b)}Q${f(c[0] - d * 4)} ${f(c[1] + 12 + 6 * m)} ${pt(a)}Z`;
        hl += tap([cx + d * 9, yS + 10], [cx + d * (8 + SW * .22), yS + 3], [cx + d * (6 + SW * .4), yS + 10], 2.4 + 2 * m);
        hl += tap([cx + d * (neckH + 2), nkTop + 6], [cx + d * (neckH + 4 + SW * .15), trapTop + 3 + 4 * m], [cx + d * SW * .62, yS + 2], 2 + 2 * m); // trapèzes
        const l0 = [cx + d * (SW - 6 + lat * .6), yS + 30], l1 = [cx + d * (W + 1), 150], lc = [cx + d * (W + 10 + lat * .3), yS + 58];
        ik += tap(l0, lc, l1, 2.6); // grands dorsaux
        sh += `M${pt(l0)}Q${pt(lc)} ${pt(l1)}Q${f(lc[0] - d * (5 + 4 * m))} ${f(lc[1] - 4)} ${pt(l0)}Z`;
        if (m > .4) ik += tap([cx + d * 4, 138], [cx + d * 8, 136], [cx + d * 12, 132], 2) + tap([cx + d * 4, 148], [cx + d * 8.5, 146], [cx + d * 13, 142], 2); // sapin de Noël
      }
      det.push(paint(sh, "#000", f(.1 + .05 * Math.min(1, m))) + paint(hl, "#fff", ".22") + paint(ik, ink, f(o * .85)));
    } else {
      const mm = Math.min(1, m), TS = {sh: "", hl: "", o: 1};
      // clavicules : saillantes chez la crevette, frontière pec / trapèze chez le costaud
      let cl = "";
      for (const d of [-1, 1]) cl += tap([cx + d * (neckH + 2), nkTop + 10 + 3 * m], [cx + d * (neckH + SW * .25), nkTop + 13 + 6 * m], [cx + d * SW * .62, yS + 4 + 2 * m], 2.2);
      cl += tap([cx - 2.2, m > .45 ? 160 : 159], [cx, m > .45 ? 163 : 162], [cx + 2.2, m > .45 ? 160 : 159], 1.8); // nombril
      det.push(paint(cl, ink, f(m < .3 ? .5 : .4)));
      if (m < .3 && pd < 3) { // côtes et sternum de la crevette
        const o = (.3 - m) / .3;
        let rb = tap([cx, yS + 12], [cx, yS + 24], [cx, yS + 36], 1.8);
        for (let i = 0; i < 4; i++) for (const d of [-1, 1]) { const y = yS + 22 + i * 9; rb += tap([cx + d * (W + 2), y], [cx + d * (W * .4 + 2), y + 5], [cx + d * 5, y + 2], 2.2 - i * .2); }
        det.push(paint(rb, ink, f(o * .6)));
        det.push(paint(tap([cx - W * .7, yS + 18], [cx - W * .4, yS + 15], [cx - W * .1, yS + 18], 1.6) + tap([cx + W * .1, yS + 18], [cx + W * .4, yS + 15], [cx + W * .7, yS + 18], 1.6), "#fff", f(o * .35)));
      }
      if (m > .25 || pd > 2) { // pectoraux : trait galbé, ombre portée dessous, reflet sur le haut
        const o = Math.min(1, Math.max((m - .25) / .3, pd / 6));
        const low = yS + 40 + 8 * m + pd, mid = yS + 30 + 4 * m + pd * .7;
        const pec = `M${f(cx - pw)} ${f(yS + 22)}Q${f(cx - SW * .35)} ${f(low)} ${cx} ${f(mid)}Q${f(cx + SW * .35)} ${f(low)} ${f(cx + pw)} ${f(yS + 22)}`;
        if (pd > 3) {
          if (look.top === "nu") det.push(`<path d="${pec}" stroke="${shade(skin, .72)}" stroke-width="${f(3 + pd * .22)}" fill="none" stroke-linecap="round" transform="translate(0 ${f(2.5 + pd * .12)})" opacity="${f(o)}"/>`);
          if (look.top === "nu") det.push(`<path d="M${f(cx - 2)} ${f(yS + 8)}L${f(cx - pw)} ${f(yS + 14)}L${f(cx - pw)} ${f(yS + 22)}Q${f(cx - SW * .35)} ${f(low)} ${cx} ${f(mid)}ZM${f(cx + 2)} ${f(yS + 8)}L${f(cx + pw)} ${f(yS + 14)}L${f(cx + pw)} ${f(yS + 22)}Q${f(cx + SW * .35)} ${f(low)} ${cx} ${f(mid)}Z" fill="${shade(skin, 1.05)}" opacity="${f(o)}"/><ellipse cx="${f(cx - pw * .45)}" cy="${f(yS + 16 + pd * .2)}" rx="${f(pw * .22)}" ry="3" fill="#fff" opacity=".3"/><ellipse cx="${f(cx + pw * .45)}" cy="${f(yS + 16 + pd * .2)}" rx="${f(pw * .22)}" ry="3" fill="#fff" opacity=".3"/>`);
        }
        let ik = tap([cx, yS + 6], [cx, yS + 18], [cx, mid - 1], 2.6), sh = "", hl = "";
        for (const d of [-1, 1]) {
          const A = [cx + d * pw, yS + 22], C = [cx + d * SW * .35, low], M = [cx, mid];
          ik += tap(A, C, M, 3.4);
          sh += `M${pt(A)}Q${pt(C)} ${pt(M)}Q${f(C[0] - d * 2)} ${f(C[1] + 6 + 7 * m)} ${f(A[0] - d * 2)} ${f(A[1] + 3)}Z`;
          hl += tap([cx + d * pw * .86, yS + 15 + 2 * m], [cx + d * pw * .5, yS + 8 + 2 * m], [cx + d * pw * .14, yS + 14 + 3 * m], 2.6 + 3 * mm);
          if (m > .6) for (let i = 0; i < 3; i++) ik += tap([cx + d * (pw + 9 + 2 * m), yS + 30 + i * 6.5], [cx + d * (pw + 6), yS + 33 + i * 6.5], [cx + d * (pw + 1), yS + 35 + i * 6.5], 2); // dentelés
        }
        TS.sh += sh; TS.hl += hl; TS.o = o;
        det.push(paint(ik, ink, f(o)));
      }
      if (m > .45) { // abdos : tablette dessinée (contours, ombre sous chaque rangée, reflets)
        const o = Math.min(1, (m - .45) / .3), top = yS + 44 + 8 * m + pd * .6, bw = W * .55;
        let ik = tap([cx, top - 2], [cx, (top + 156) / 2], [cx, 156], 2.6), sh = "", hl = "";
        let y0 = top - 2;
        for (let i = 0; i < 3; i++) {
          const y = top + 4 + i * 11;
          if (y >= 166) break;
          ik += tap([cx - bw, y], [cx, y + 4], [cx + bw, y], 2.4);
          sh += `M${f(cx - bw)} ${f(y)}Q${cx} ${f(y + 4)} ${f(cx + bw)} ${f(y)}Q${cx} ${f(y + 10)} ${f(cx - bw)} ${f(y)}Z`;
          for (const d of [-1, 1]) hl += tap([cx + d * bw * .2, y0 + 3.4], [cx + d * bw * .55, y0 + 1.6], [cx + d * bw * .9, y0 + 3.2], 1.8);
          y0 = y + 2;
        }
        for (const d of [-1, 1]) ik += tap([cx + d * bw * 1.08, top - 1], [cx + d * bw * 1.3, top + 14], [cx + d * bw * .8, 164], 2.2) // contour de la tablette
          + tap([cx + d * (W + 1), 141], [cx + d * W * .8, 158], [cx + d * W * .38, 171], 2.4); // obliques (ligne du V)
        TS.sh += sh; TS.hl += hl;
        det.push(paint(ik, ink, f(o)));
      }
      if (TS.sh) det.unshift(paint(TS.sh, "#000", f(TS.o * .15)) + paint(TS.hl, "#fff", f(TS.o * .31)));
    }
    const openTop = !!(HT && (HT.crop || HT.mesh || HT.open));
    if (topK === "nu" || openTop) s += det.join("");

    // vêtement du haut
    if (topK !== "nu" && !HT) {
      const c = look.topColor, strap = look.top === "singlet" ? .32 : .5;
      const tp = `M${f(cx - neckH - 4)} ${f(nkTop + 6)} L${f(cx - SW * strap - 6)} ${f(yS - 2 - 6 * m)} Q${f(cx - SW * strap)} ${f(yS + 22)} ${f(cx - SW + 7 - lat * .7)} ${f(yS + 36)} Q${f(cx - (W + 4 + 16 * m + lat * .5))} ${f(yS + 50)} ${f(cx - W - 1)} 152 L${f(cx - H - 2)} 174 L${f(cx + H + 2)} 174 L${f(cx + W + 1)} 152 Q${f(cx + W + 4 + 16 * m + lat * .5)} ${f(yS + 50)} ${f(cx + SW - 7 + lat * .7)} ${f(yS + 36)} Q${f(cx + SW * strap)} ${f(yS + 22)} ${f(cx + SW * strap + 6)} ${f(yS - 2 - 6 * m)} L${f(cx + neckH + 4)} ${f(nkTop + 6)} Q${cx} ${f(back ? nkTop + 14 : yS + 20)} ${f(cx - neckH - 4)} ${f(nkTop + 6)} Z`;
      s += `<path d="${tp}" fill="${c}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<g opacity=".55">${det.join("")}</g>`;
      { // finitions du débardeur : bord-côte à l'encolure et aux emmanchures, surpiqûre d'ourlet, plis à la taille
        const rib = shade(c, c === "#111111" ? 2.6 : .78);
        let r1 = `M${f(cx - neckH - 1)} ${f(nkTop + 9)}Q${cx} ${f(back ? nkTop + 16 : yS + 16)} ${f(cx + neckH + 1)} ${f(nkTop + 9)}`, fo = "";
        for (const d of [-1, 1]) {
          r1 += `M${f(cx + d * (SW * strap + 2))} ${f(yS - 1 - 6 * m)}Q${f(cx + d * (SW * strap - 3.5))} ${f(yS + 21)} ${f(cx + d * (SW - 10 - lat * .7))} ${f(yS + 33)}`;
          fo += tap([cx + d * (W - 1), 158], [cx + d * W * .7, 163], [cx + d * W * .3, 165], 1.8) + tap([cx + d * (W + 1), 149], [cx + d * W * .78, 153], [cx + d * W * .45, 153], 1.4);
        }
        s += `<path d="${compact(r1, 1)}" stroke="${rib}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${f(cx - H + 1)} 169.6H${f(cx + H - 1)}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="2.4 2" opacity=".4"/>` + paint(fo, ink, ".3");
      }
      if (look.top === "singlet") s += `<path d="M${f(cx - W - 1)} 160 L${f(cx + W + 1)} 160" stroke="#fff" stroke-width="4" opacity=".7"/>`;
      if (m > 1.05 || (pd > 8 && !back)) s += `<path d="M${f(cx - SW * .3)} ${f(yS + 18)}l6 6-4 5 7 5M${f(cx + SW * .25)} ${f(yS + 40)}l-5 5 5 5" stroke="${ink}" stroke-width="2.4" fill="none"/>`; // tissu qui craque
    }
    if (HT && !HT.nu) {
      // ---- tenue de la boutique (remplace le haut de l'éditeur)
      const c = HT.c, c2 = HT.c2 || shade(c, .8);
      const side = d => ({nk: [cx + d * (neckH + 4), nkTop + 6], sh: [cx + d * (SW * (HT.strap || 1) + 6), yS - 2 - 6 * m], sc: [cx + d * SW * (HT.strap || 1), yS + 22], ap: [cx + d * (SW - 7 + lat * .7), yS + 36], c3: [cx + d * (W + 4 + 16 * m + lat * .5), yS + 50], wa: [cx + d * (W + 1), 152], hp: [cx + d * (H + 2), 174]});
      const a = side(-1), b = side(1);
      // forme du haut : encolure ronde (crew), en V (vY), ou ourlet court (crop)
      const shirtD = (neckY, vNeck, hemY) => {
        let low;
        if (hemY) {
          let lo = 0, hi = 1;
          for (let i = 0; i < 20; i++) { const t = (lo + hi) / 2; if (bz(a.ap, a.c3, a.wa, t)[1] < hemY) lo = t; else hi = t; }
          low = `Q${pt(lerp(a.ap, a.c3, lo))} ${pt(bz(a.ap, a.c3, a.wa, lo))} Q${cx} ${f(hemY + 4)} ${pt(bz(b.ap, b.c3, b.wa, lo))} Q${pt(lerp(b.ap, b.c3, lo))} ${pt(b.ap)}`;
        } else low = `Q${pt(a.c3)} ${pt(a.wa)} L${pt(a.hp)} L${pt(b.hp)} L${pt(b.wa)} Q${pt(b.c3)} ${pt(b.ap)}`;
        return `M${pt(a.nk)} L${pt(a.sh)} Q${pt(a.sc)} ${pt(a.ap)} ${low} Q${pt(b.sc)} ${pt(b.sh)} L${pt(b.nk)} ${vNeck && !back ? `L${cx} ${f(neckY)} L${pt(a.nk)}` : `Q${cx} ${f(back ? nkTop + 14 : neckY)} ${pt(a.nk)}`} Z`;
      };
      const fill = (d, col, sw) => `<path d="${d}" fill="${col}" stroke="${ink}" stroke-width="${sw || 4}" stroke-linejoin="round"/>`;
      const txt = (t, x, y, fs, col) => `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="${f(fs)}" fill="${col}" stroke="${ink}" stroke-width="${f(1.4 + fs * .05)}" paint-order="stroke" stroke-linejoin="round">${t}</text>`;
      const crack = () => m > 1.05 && !back ? `<path d="M${f(cx - SW * .3)} ${f(yS + 18)}l6 6-4 5 7 5M${f(cx + SW * .25)} ${f(yS + 40)}l-5 5 5 5" stroke="${ink}" stroke-width="2.4" fill="none"/>` : "";
      const vB = yS + 50 + 8 * m; // bas du décolleté (chemise ouverte, smoking)
      if (eq.haut === "hoodie") {
        s += fill(shirtD(nkTop + 14), c) + `<g opacity=".4">${det.join("")}</g>`;
        if (!back) {
          const pw = W * .75 + 6;
          s += `<path d="M${f(cx - pw)} 166L${f(cx - pw * .78)} 140Q${cx} 135 ${f(cx + pw * .78)} 140L${f(cx + pw)} 166Z" fill="${c}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(cx - pw * .78)} 141L${f(cx - pw * .92)} 162M${f(cx + pw * .78)} 141L${f(cx + pw * .92)} 162" stroke="${c2}" stroke-width="3"/>`;
          for (const d of [-1, 1]) s += `<path d="M${f(cx + d * 5)} ${f(nkTop + 12)}q${f(d * 2)} ${f(9 + 2 * m)} ${f(d * 1)} ${f(17 + 4 * m)}" stroke="#f4f4f8" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="${f(cx + d * 6 - 1.6)}" y="${f(nkTop + 28 + 4 * m)}" width="3.2" height="5" rx="1" fill="#c9d1d8" stroke="${ink}" stroke-width="1"/>`;
        }
        s += `<path d="M${f(cx - H - 2)} 168H${f(cx + H + 2)}" stroke="${c2}" stroke-width="3"/>`;
      } else if (eq.haut === "maillot" || eq.haut === "crop") {
        const crop = eq.haut === "crop", hemY = crop ? Math.min(yS + 38 + 6 * m, 146) : 0;
        s += fill(shirtD(crop ? nkTop + 14 : yS + 14, !crop, hemY), c) + `<g opacity=".5">${det.join("")}</g>`;
        if (!back && !crop) s += `<path d="M${pt(a.nk)}L${cx} ${f(yS + 14)}L${pt(b.nk)}" stroke="${c2}" stroke-width="3.4" fill="none" stroke-linejoin="round"/>`;
        if (crop) s += (!back ? txt("GAINS", cx, yS + 30 + 6 * m, Math.min(9 + 7 * m, SW * .3), c2) : "");
        else s += txt("10", cx, back ? yS + 38 + 4 * m : yS + 42 + 8 * m, back ? 18 + 12 * m : 13 + 9 * m, c2);
        s += crack();
      } else if (eq.haut === "chemhaw") {
        const half = d => { const q = side(d), o = side(-d); return `M${pt(q.nk)} L${pt(q.sh)} Q${pt(q.sc)} ${pt(q.ap)} Q${pt(q.c3)} ${pt(q.wa)} L${pt(q.hp)} L${f(cx - d * 2)} 174 L${f(cx - d * 2)} ${f(vB)} Q${f(cx + d * SW * .26)} ${f(yS + 26)} ${pt(q.nk)} Z`; };
        const parts = back ? [shirtD(nkTop + 14)] : [half(-1), half(1)], fcol = ["#ffd23f", "#fff", "#ff2e88"];
        for (const d of parts) {
          s += fill(d, c);
          const byCol = ["", "", ""]; let leaf = "";
          for (const [x, y, r] of gridIn(polyOf(d), 15, 4.5)) { byCol[(r + Math.round(x / 15)) % 3] += `M${f(x - 2.7)} ${f(y)}a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0`; leaf += `M${f(x + 4)} ${f(y + 2)}q4 1 6 5`; }
          byCol.forEach((p2, i) => { if (p2) s += `<path d="${p2}" fill="#c94f2c" stroke="${fcol[i]}" stroke-width="4" stroke-dasharray="2.6 1"/>`; });
          if (leaf) s += `<path d="${leaf}" stroke="#2f9e44" stroke-width="1.6" fill="none"/>`;
        }
        if (!back) {
          for (const d of [-1, 1]) s += `<path d="M${pt(side(d).nk)}L${f(cx + d * (neckH + 13 + 4 * m))} ${f(nkTop + 17)}L${f(cx + d * SW * .25)} ${f(yS + 26)}Z" fill="${c2}" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/>`;
          for (let y = vB + 6; y < 170; y += 9) s += `<circle cx="${f(cx + 1)}" cy="${f(y)}" r="1.8" fill="#fff6dc" stroke="${ink}" stroke-width="1"/>`;
        }
      } else if (eq.haut === "surv80") {
        const d0 = shirtD(nkTop + 14), P = polyOf(d0);
        s += fill(d0, c) + `<g opacity=".35">${det.join("")}</g>`;
        s += `<path d="${clipLines(P, [[cx - SW - 20, yS + 40, cx + SW + 20, yS + 16]], 5)}" stroke="${c2}" stroke-width="9" fill="none"/><path d="${clipLines(P, [[cx - SW - 20, yS + 50, cx + SW + 20, yS + 26]], 3)}" stroke="#ff2e88" stroke-width="3" fill="none"/>`;
        s += `<path d="M${f(cx - neckH - 6)} ${f(nkTop + 3)}Q${cx} ${f(nkTop + 12)} ${f(cx + neckH + 6)} ${f(nkTop + 3)}" stroke="${ink}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M${f(cx - neckH - 6)} ${f(nkTop + 3)}Q${cx} ${f(nkTop + 12)} ${f(cx + neckH + 6)} ${f(nkTop + 3)}" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        if (!back) s += `<path d="M${cx} ${f(nkTop + 12)}V173" stroke="${ink}" stroke-width="2" stroke-dasharray="2 1.6"/><rect x="${f(cx - 2)}" y="${f(nkTop + 13)}" width="4" height="7" rx="1.4" fill="#c9d1d8" stroke="${ink}" stroke-width="1.2"/>`;
        s += `<path d="M${f(cx - H - 2)} 168H${f(cx + H + 2)}" stroke="${c2}" stroke-width="3.4"/>`;
      } else if (eq.haut === "kimono") {
        const vy = yS + 40 + 8 * m;
        s += fill(shirtD(vy, true), c) + `<g opacity=".3">${det.join("")}</g>`;
        if (!back) s += `<path d="M${pt(a.nk)}L${f(cx + 4)} ${f(vy + 3)}" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M${pt(a.nk)}L${f(cx + 4)} ${f(vy + 3)}" stroke="${c2}" stroke-width="6" stroke-linecap="round"/><path d="M${pt(b.nk)}L${f(cx - 7)} ${f(vy + 10)}L${f(cx - 10)} 150" stroke="${ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M${pt(b.nk)}L${f(cx - 7)} ${f(vy + 10)}L${f(cx - 10)} 150" stroke="${c2}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        s += `<rect x="${f(cx - W - 5)}" y="146" width="${f(2 * W + 10)}" height="10" rx="3" fill="#1d1d24" stroke="${ink}" stroke-width="2.6"/>`;
        if (!back) s += `<path d="M${f(cx - 3)} 154l-7 18l6 1zM${f(cx + 3)} 154l6 17l6 -2z" fill="#1d1d24" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><rect x="${f(cx - 6)}" y="144.5" width="12" height="13" rx="3" fill="#1d1d24" stroke="#5c5466" stroke-width="1.6"/>`;
      } else if (eq.haut === "filet") {
        const d0 = shirtD(yS + 20), P = polyOf(d0), L1 = [], L2 = [];
        for (let k = -260; k < 260; k += 8) { L1.push([cx + k - 80, yS - 40, cx + k + 80, yS + 120]); L2.push([cx + k + 80, yS - 40, cx + k - 80, yS + 120]); }
        s += `<path d="${d0}" fill="${c}" fill-opacity=".12"/><path d="${clipLines(P, L1)}${clipLines(P, L2)}" stroke="${c}" stroke-width="1.8" fill="none"/><path d="${d0}" fill="none" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/><path d="${d0}" fill="none" stroke="#3b3346" stroke-width="2" stroke-linejoin="round"/>`;
      } else if (eq.haut === "smoking") {
        s += fill(shirtD(nkTop + 14), "#fbfbf7") + `<g opacity=".35">${det.join("")}</g>`;
        if (back) s += fill(shirtD(nkTop + 14), c);
        else {
          const half = d => { const q = side(d); return `M${pt(q.nk)} L${pt(q.sh)} Q${pt(q.sc)} ${pt(q.ap)} Q${pt(q.c3)} ${pt(q.wa)} L${pt(q.hp)} L${f(cx - d * 3)} 176 L${f(cx - d * 2)} ${f(vB)} Q${f(cx + d * SW * .22)} ${f(yS + 30)} ${pt(q.nk)} Z`; };
          for (const d of [-1, 1]) s += fill(half(d), c) + `<path d="M${pt(side(d).nk)}Q${f(cx + d * SW * .22)} ${f(yS + 30)} ${f(cx + d * 1)} ${f(vB)}" stroke="#4f558f" stroke-width="5" fill="none"/><path d="M${pt(side(d).nk)}Q${f(cx + d * SW * .22)} ${f(yS + 30)} ${f(cx + d * 1)} ${f(vB)}" stroke="${ink}" stroke-width="1.4" fill="none" transform="translate(${-d * 2.4} 0)"/>`;
          for (let i = 0; i < 3; i++) s += `<circle cx="${cx}" cy="${f(nkTop + 24 + i * (vB - nkTop - 28) / 3)}" r="1.8" fill="${ink}"/>`;
          s += `<path d="M${f(cx - SW * .52)} ${f(yS + 26)}l${f(4 + 2 * m)} -6l${f(3 + 2 * m)} 6z" fill="#fff" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
          const y = nkTop + 12, k = 1 + m * .3;
          s += `<path d="M${cx} ${f(y)}L${f(cx - 12 * k)} ${f(y - 6 * k)}L${f(cx - 12 * k)} ${f(y + 6 * k)}ZM${cx} ${f(y)}L${f(cx + 12 * k)} ${f(y - 6 * k)}L${f(cx + 12 * k)} ${f(y + 6 * k)}Z" fill="#111" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><rect x="${f(cx - 3.5)}" y="${f(y - 4)}" width="7" height="8" rx="2" fill="#111" stroke="#4a4a5e" stroke-width="1.4"/>`;
        }
      }
    }
    { // modelé du buste (peau ou tissu) : ombre le long des flancs et sous les trapèzes, reflet sur le haut du torse
      let sh = "", hl = "";
      for (const d of [-1, 1]) {
        const q = torsoP(d), k = 4 + 5 * Math.min(1, m), i = (p, s2) => [p[0] - d * k * s2, p[1]];
        sh += `M${pt(q.sh)}Q${pt(q.c2)} ${pt(q.lt)}Q${pt(q.c3)} ${pt(q.wa)}L${pt(q.hp)}L${pt(i(q.hp, .6))}L${pt(i(q.wa, 1))}Q${pt(i(q.c3, 1.25))} ${pt(i(q.lt, 1.1))}Q${pt(i(q.c2, .9))} ${pt(i(q.sh, .2))}Z`;
        if (m > .3 && !back) hl += tap([cx + d * (neckH + 3), nkTop + 5 + 2 * m], [cx + d * (neckH + SW * .2), trapTop + 4 + 5 * m], [cx + d * SW * .7, yS - 1 + m], 1.6 + 2 * m);
      }
      s += paint(sh, "#000", ".12") + paint(hl, "#fff", ".22");
    }
    if (eq.peau === "coupsoleil" && topK === "nu" && !back) s += `<path d="M${f(cx - SW * .42)} ${f(yS - 4)}Q${f(cx - SW * .45)} ${f(yS + 22)} ${f(cx - SW * .62)} ${f(yS + 36)}M${f(cx + SW * .42)} ${f(yS - 4)}Q${f(cx + SW * .45)} ${f(yS + 22)} ${f(cx + SW * .62)} ${f(yS + 36)}" stroke="#fff3e6" stroke-width="${f(6 + 4 * m)}" fill="none" stroke-linecap="round" opacity=".9"/>`;
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
    if (!back && eq.cou === "chainexxl") {
      const cy2 = yS + 52 + 8 * m, cp = `M${f(cx - neckH - 3)} ${f(nkTop + 10)}Q${cx} ${f(cy2)} ${f(cx + neckH + 3)} ${f(nkTop + 10)}`, by = .5 * (nkTop + 10) + .5 * cy2;
      const pw = 30 + 14 * m, ph = 13 + 5 * m;
      s += `<path d="${cp}" stroke="${ink}" stroke-width="11" fill="none"/><path d="${cp}" stroke="#f5c518" stroke-width="7.4" fill="none"/><path d="${cp}" stroke="#b8860b" stroke-width="7.4" fill="none" stroke-dasharray="2.2 3.2"/>`;
      s += `<rect x="${f(cx - pw / 2)}" y="${f(by)}" width="${f(pw)}" height="${f(ph)}" rx="3" fill="#f5c518" stroke="${ink}" stroke-width="3"/><rect x="${f(cx - pw / 2 + 2.6)}" y="${f(by + 2.6)}" width="${f(pw - 5.2)}" height="${f(ph - 5.2)}" rx="1.6" fill="none" stroke="#fff6c9" stroke-width="1.4" stroke-dasharray="1.6 1.6"/>`
        + `<text x="${cx}" y="${f(by + ph * .78)}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="${f(ph * .72)}" fill="#8a6200">GAINS</text>` + star(cx + pw / 2 - 1, by + 1, 4, "#fff") + AN.op("0;1;0", 1.8, star(cx - pw / 2 + 3, by + ph - 2, 3.4, "#fff"));
    }
    if (eq.cou === "casque") {
      const ox = neckH + 8 + 2 * m, cy3 = nkTop + 11, cw2 = 10 + 3 * m, ch = 15 + 3 * m;
      s += `<path d="M${f(cx - ox)} ${f(cy3)}Q${cx} ${f(back ? nkTop + 22 : nkTop - 2)} ${f(cx + ox)} ${f(cy3)}" stroke="${ink}" stroke-width="7" fill="none"/><path d="M${f(cx - ox)} ${f(cy3)}Q${cx} ${f(back ? nkTop + 22 : nkTop - 2)} ${f(cx + ox)} ${f(cy3)}" stroke="#f4f4f8" stroke-width="4" fill="none"/>`;
      for (const d of [-1, 1]) s += `<rect x="${f(cx + d * ox - cw2 / 2)}" y="${f(cy3 - ch / 2)}" width="${f(cw2)}" height="${f(ch)}" rx="${f(cw2 * .45)}" fill="#3ae0ff" stroke="${ink}" stroke-width="3" transform="rotate(${d * -18} ${f(cx + d * ox)} ${f(cy3)})"/><circle cx="${f(cx + d * ox)}" cy="${f(cy3)}" r="${f(cw2 * .22)}" fill="#fff" opacity=".8"/>`;
      if (!back) s += `<path d="M${f(cx + ox)} ${f(cy3 + ch / 2)}q4 14 -6 ${f(24 + 6 * m)}" stroke="${ink}" stroke-width="1.8" fill="none"/>`;
    }
    // sac de sport : bandoulière en travers du torse (le sac est derrière, voir dosItem)
    if (!back && eq.dos === "sacsport") s += `<path d="M${f(cx - SW * .55)} ${f(trapTop + 6)}L${f(cx + W + 4)} 160" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M${f(cx - SW * .55)} ${f(trapTop + 6)}L${f(cx + W + 4)} 160" stroke="#2f6fdc" stroke-width="5.4" stroke-linecap="round"/><rect x="${f(cx - SW * .2 - 4)}" y="${f(trapTop + 6 + (160 - trapTop) * .25 - 4)}" width="8" height="8" rx="1.6" fill="#c9d1d8" stroke="${ink}" stroke-width="1.6"/>`;
    // ---- bras
    const arms = [];
    for (const d of [-1, 1]) {
      const J = [cx + d * (SW - 5), yS + 12];
      const hipHand = [cx + d * (W + 3 + lat * .25), 150];
      let E, Hd, fx = false;
      if (pose === "flex" || (pose === "kiss" && d === 1) || (bustArm && d === -1)) { E = [J[0] + d * (24 + 16 * m), yS + 6]; Hd = [J[0] + d * (14 + 12 * m), yS - 34 - 6 * m]; fx = true; }
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
    // mains : poing (doigts repliés, pouce, reflet) ; main ouverte pour le salut (pose « wave », main droite libre)
    const openHand = A => pose === "wave" && A.d === 1 && !eq.main && eq.poignets !== "gants";
    const fingers = A => { const u = nrm(A.E, A.Hd), R = handR - 2.5;
      return [[-36, 1.5], [-12, 1.75], [12, 1.7], [36, 1.45], [-82, 1.3]].map(([a, l]) => [add(A.Hd, rot(u, a), R * .3), add(A.Hd, rot(u, a + (a < -60 ? 16 : 0)), R * l)]); };
    const fingW = Math.max(3.6, (handR - 2.5) * .52);
    const fistR = (Hd, E, d) => {
      const u = nrm(E, Hd), R = handR - 2.5, n = shadeN(E, Hd, d);
      let ik = "", hl = "";
      ik += tap(add(Hd, rot(u, -62), R * .72), add(Hd, u, R * 1.02), add(Hd, rot(u, 62), R * .72), 1.4 + R * .05); // pli des phalanges
      for (const k of [-1, 1]) ik += tap(add(Hd, rot(u, k * 21), R * .62), add(Hd, rot(u, k * 21), R * .8), add(Hd, rot(u, k * 23), R * .98), 1.2 + R * .04);
      ik += tap(add(add(Hd, n, R * .95), u, -R * .3), add(add(Hd, n, R * .3), u, R * .02), add(add(Hd, n, -R * .25), u, R * .45), 1.8 + R * .05); // pouce
      hl += tap(add(Hd, [-.87, -.5], R * .62), add(Hd, [-.6, -.8], R * .92), add(Hd, [-.17, -.98], R * .6), 1.4 + R * .1);
      return [ik, hl];
    };
    const fistD = (Hd, E, d) => { const [ik, hl] = fistR(Hd, E, d); return paint(ik, ink, ".72", 1) + paint(hl, "#fff", ".4", 1); };
    const handD = A => openHand(A) ? fingers(A).map(([p, q]) => `<path d="M${pt(p)}L${pt(q)}" stroke="${skin}" stroke-width="${f(fingW)}" stroke-linecap="round"/>`).join("")
      + paint(tap(add(A.Hd, [-.7, .2], handR * .5), add(A.Hd, [0, .9], handR * .35), add(A.Hd, [.6, .3], handR * .5), 1.6), ink, ".5", 1) : fistD(A.Hd, A.E, A.d);
    for (const A of arms) {
      const b = bulge(A);
      s += `<path d="M${pt(A.J)}L${pt(A.E)}" stroke="${ink}" stroke-width="${f(UA + 6)}" stroke-linecap="round"/><path d="M${pt(A.E)}L${pt(A.Hd)}" stroke="${ink}" stroke-width="${f(FA + 6)}" stroke-linecap="round"/>`;
      if (m > .2 || kb > 1.15) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2] + 3)}" fill="${ink}"/>`;
      if (popeye) { const c = fore(A); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2] + 3)}" fill="${ink}"/>`; }
      s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR)}" fill="${ink}"/>`;
      if (openHand(A)) s += fingers(A).map(([p, q]) => `<path d="M${pt(p)}L${pt(q)}" stroke="${ink}" stroke-width="${f(fingW + 5)}" stroke-linecap="round"/>`).join("");
    }
    { // peau des bras puis modelé des deux bras en une passe (ombre côté intérieur / dessous, croissant sous le biceps,
      // deltoïde, sillon biceps / triceps, avant-bras, coude pointu de la crevette), mains par-dessus
      let sh = "", hl = "", ik = "", kn = "", hd = "";
      const mm = Math.min(1, m), o = Math.min(1, (m - .25) / .3);
      for (const A of arms) {
        const b = bulge(A);
        s += `<path d="M${pt(A.J)}L${pt(A.E)}" stroke="${skin}" stroke-width="${f(UA)}" stroke-linecap="round"/><path d="M${pt(A.E)}L${pt(A.Hd)}" stroke="${skin}" stroke-width="${f(FA)}" stroke-linecap="round"/>`;
        if (m > .2 || kb > 1.15) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2])}" fill="${skin}"/>`;
        if (popeye) { const c = fore(A); s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(c[2])}" fill="${skin}"/>`; }
        s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR - 2.5)}" fill="${skin}"/>`;
        const nU = shadeN(A.J, A.E, A.d), nF = shadeN(A.E, A.Hd, A.d), uU = nrm(A.J, A.E);
        sh += rim(A.J, A.E, UA / 2, UA * .18 + 1, nU) + rim(A.E, A.Hd, FA / 2, FA * .2 + 1, nF);
        if (m > .2 || kb > 1.15) {
          hl += tap(add([b[0], b[1]], rot(nU, 140), b[2] * .62), add([b[0], b[1]], rot(nU, 180), b[2] * .92), add([b[0], b[1]], rot(nU, 220), b[2] * .62), 2 + b[2] * .12);
        }
        if (m > .25) {
          const nO = [-nU[0], -nU[1]];
          ik += tap(add(add(A.J, uU, UA * .2), nO, UA * .48), add(A.J, uU, UA * .95), add(add(A.J, uU, UA * .45), nU, UA * .42), 2.6);
          hl += tap(add(A.J, nO, UA * .3), add(add(A.J, uU, -UA * .12), nO, UA * .02), add(A.J, nU, UA * .25), 2 + UA * .08);
          ik += tap(add(lerp(A.J, A.E, .45), nU, UA * .16), add(lerp(A.J, A.E, .68), nU, UA * .26), add(lerp(A.J, A.E, .92), nU, UA * .1), 2.2);
          ik += tap(add(lerp(A.E, A.Hd, .08), nF, -FA * .3), add(lerp(A.E, A.Hd, .3), nF, -FA * .5), add(lerp(A.E, A.Hd, .72), nF, -FA * .12), 2.2);
        }
        if (m < .16) { kn += `<circle cx="${f(A.E[0])}" cy="${f(A.E[1])}" r="${f(FA / 2 + 1.6)}" fill="${skin}" stroke="${ink}" stroke-width="2.4"/>`; hd += tap(add(A.E, [-.8, -.6], 2), add(A.E, [-.2, -1], 3), add(A.E, [.6, -.8], 2), 1.1); }
      }
      s += paint(sh, "#000", f(.11 + .04 * mm)) + paint(hl, "#fff", ".3") + (m > .25 ? paint(ik, ink, f(o * .5)) : "") + kn + paint(hd, "#fff", ".6", 1);
      let fi = "", fl = "";
      for (const A of arms) if (openHand(A)) s += handD(A); else { const [a, c] = fistR(A.Hd, A.E, A.d); fi += a; fl += c; }
      s += paint(fi, ink, ".72", 1) + paint(fl, "#fff", ".4", 1);
    }
    for (const A of arms) {
      const b = bulge(A);
      if (m > .8 || (kb > 1.4 && m > .3)) { // veines
        const o = Math.min(1, Math.max((m - .8) / .3, (kb - 1.3) * 2));
        s += `<path d="M${f(b[0] - 4)} ${f(b[1] - b[2] * .5)}q6 6 0 12q-5 6 3 12" stroke="#6d8fd0" stroke-width="2.4" fill="none" opacity="${f(o)}" stroke-linecap="round"/>`;
        if (popeye) { const c = fore(A); s += `<path d="M${f(c[0] - 3)} ${f(c[1] - c[2] * .5)}q5 5 0 10q-4 5 2 9" stroke="#6d8fd0" stroke-width="2.2" fill="none" opacity="${f(o)}" stroke-linecap="round"/>`; }
      }
      if (look.acc === "bandeau" && !eq.poignets && !(HT && HT.sl && HT.sl !== "short")) s += `<rect x="${f(A.Hd[0] - FA * .55)}" y="${f((A.E[1] + A.Hd[1]) / 2 + (A.Hd[1] - A.E[1]) * .25 - 4)}" width="${f(FA * 1.1)}" height="8" rx="3" fill="${look.topColor}" stroke="${ink}" stroke-width="2"/>`;
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
      // manches de la tenue (par-dessus le bras, sous les poignets)
      if (HT && HT.sl) {
        const c = HT.c, c2 = HT.c2 || shade(c, .8), ux = (A.E[0] - A.J[0]) / (Math.hypot(A.E[0] - A.J[0], A.E[1] - A.J[1]) || 1), uy = (A.E[1] - A.J[1]) / (Math.hypot(A.E[0] - A.J[0], A.E[1] - A.J[1]) || 1);
        const J0 = [A.J[0] - ux * UA * .2, A.J[1] - uy * UA * .2];
        const seg = (p, q, w, col, cap) => `<path d="M${pt(p)}L${pt(q)}" stroke="${col}" stroke-width="${f(w)}"${cap ? ` stroke-linecap="${cap}"` : ""}/>`;
        const hemL = (p, q, w, col, sw) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; return `<path d="M${f(q[0] + nx)} ${f(q[1] + ny)}L${f(q[0] - nx)} ${f(q[1] - ny)}" stroke="${col}" stroke-width="${sw || 2.6}" stroke-linecap="round"/>`; };
        if (HT.sl === "short") {
          const S = lerp(A.J, A.E, .52), w = UA + 5;
          s += `<circle cx="${f(J0[0])}" cy="${f(J0[1])}" r="${f(w / 2 + 3)}" fill="${ink}"/>` + seg(J0, S, w + 6, ink) + `<circle cx="${f(J0[0])}" cy="${f(J0[1])}" r="${f(w / 2)}" fill="${c}"/>` + seg(J0, S, w, c) + hemL(J0, S, w / 2 + 3);
          if (eq.haut === "maillot") s += hemL(J0, lerp(J0, S, .9), w / 2, c2, 3);
          if (eq.haut === "chemhaw") for (const [t, o, k] of [[.35, -.22, "#fff"], [.7, .2, "#ffd23f"]]) { const q = lerp(J0, S, t), x = q[0] + o * w * A.d, y = q[1]; for (let i = 0; i < 5; i++) s += `<circle cx="${f(x + Math.cos(i * 1.257) * 2.7)}" cy="${f(y + Math.sin(i * 1.257) * 2.7)}" r="2.2" fill="${k}"/>`; s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.3" fill="#c94f2c"/>`; }
        } else {
          const wide = HT.sl === "wide", W2 = lerp(A.E, A.Hd, wide ? .55 : .74), wu = UA + (wide ? 8 : 6), wf = FA + (wide ? Math.max(8, 16 - 6 * m) : 5);
          s += `<circle cx="${f(J0[0])}" cy="${f(J0[1])}" r="${f(wu / 2 + 3)}" fill="${ink}"/>` + seg(J0, A.E, wu + 6, ink, "round") + seg(A.E, W2, wf + 6, ink) + `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2] + 5)}" fill="${ink}"/>`;
          s += `<circle cx="${f(J0[0])}" cy="${f(J0[1])}" r="${f(wu / 2)}" fill="${c}"/>` + seg(J0, A.E, wu, c, "round") + seg(A.E, W2, wf, c) + `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2] + 2)}" fill="${c}"/>`;
          if (eq.haut === "surv80") s += `<path d="M${pt(J0)}L${pt(A.E)}L${pt(W2)}" stroke="${c2}" stroke-width="3.4" fill="none" stroke-linejoin="round" transform="translate(${f(A.d * 3)} 0)"/>`;
          if (!wide) { const W1 = lerp(A.E, A.Hd, .64); s += seg(W1, W2, wf, c2) + hemL(A.E, W1, wf / 2 + 3, ink, 2.2) + hemL(A.E, W2, wf / 2 + 3); }
          else s += hemL(A.E, W2, wf / 2 + 3);
          s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR)}" fill="${ink}"/><circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(handR - 2.5)}" fill="${skin}"/>` + handD(A);
        }
      }
      // poignets
      const w0 = lerp(A.E, A.Hd, .68), w1 = lerp(A.E, A.Hd, .84);
      if (eq.poignets === "pognet") s += `<path d="M${pt(w0)}L${pt(w1)}" stroke="${ink}" stroke-width="${f(FA + 8)}"/><path d="M${pt(w0)}L${pt(w1)}" stroke="#fdfdfd" stroke-width="${f(FA + 3)}"/><path d="M${pt(lerp(w0, w1, .5))}L${pt(lerp(w0, w1, .62))}" stroke="#e63946" stroke-width="${f(FA + 3)}"/>`;
      if (eq.poignets === "clous") {
        s += `<path d="M${pt(w0)}L${pt(w1)}" stroke="${ink}" stroke-width="${f(FA + 8)}"/><path d="M${pt(w0)}L${pt(w1)}" stroke="#2b2b33" stroke-width="${f(FA + 3)}"/>`;
        const mid = lerp(w0, w1, .5), dx = -(w1[1] - w0[1]), dy = w1[0] - w0[0], l = Math.hypot(dx, dy) || 1;
        for (let i = -1; i <= 1; i++) s += `<circle cx="${f(mid[0] + dx / l * i * FA * .32)}" cy="${f(mid[1] + dy / l * i * FA * .32)}" r="${f(1.6 + FA * .05)}" fill="#e8ecf2" stroke="${ink}" stroke-width="1"/>`;
      }
      if (eq.poignets === "montre" && A.d === -1) {
        const q0 = lerp(A.E, A.Hd, .62), q1 = lerp(A.E, A.Hd, .76), mid = lerp(q0, q1, .5), rr = 4 + FA * .13;
        s += `<path d="M${pt(q0)}L${pt(q1)}" stroke="${ink}" stroke-width="${f(FA + 8)}"/><path d="M${pt(q0)}L${pt(q1)}" stroke="#f5c518" stroke-width="${f(FA + 4)}"/><path d="M${pt(q0)}L${pt(q1)}" stroke="#b8860b" stroke-width="${f(FA + 4)}" stroke-dasharray="1.4 2.4"/>`
          + `<circle cx="${f(mid[0])}" cy="${f(mid[1])}" r="${f(rr + 2)}" fill="#f5c518" stroke="${ink}" stroke-width="2.4"/><circle cx="${f(mid[0])}" cy="${f(mid[1])}" r="${f(rr)}" fill="#fffdf2"/><path d="M${f(mid[0])} ${f(mid[1])}v${f(-rr * .7)}M${f(mid[0])} ${f(mid[1])}h${f(rr * .55)}" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>` + star(mid[0] + rr + 2, mid[1] - rr - 1, 3, "#fff");
      }
      if (eq.poignets === "gants") {
        const gr2 = handR + 6;
        s += `<path d="M${pt(lerp(A.E, A.Hd, .72))}L${pt(A.Hd)}" stroke="${ink}" stroke-width="${f(FA + 10)}"/><path d="M${pt(lerp(A.E, A.Hd, .74))}L${pt(A.Hd)}" stroke="#fff" stroke-width="${f(FA + 5)}"/>`;
        s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(gr2)}" fill="#d62828" stroke="${ink}" stroke-width="3.5"/><ellipse cx="${f(A.Hd[0] - gr2 * .3)}" cy="${f(A.Hd[1] - gr2 * .35)}" rx="${f(gr2 * .32)}" ry="${f(gr2 * .2)}" fill="#fff" opacity=".55"/>`;
      }
      if (eq.peau === "huile" && !(HT && HT.sl && HT.sl !== "short")) s += `<ellipse cx="${f(b[0] - b[2] * .3)}" cy="${f(b[1] - b[2] * .35)}" rx="${f(b[2] * .32)}" ry="${f(b[2] * .16)}" fill="#fff" opacity=".75" transform="rotate(-30 ${f(b[0] - b[2] * .3)} ${f(b[1] - b[2] * .35)})"/><circle cx="${f(A.J[0])}" cy="${f(A.J[1] - UA * .2)}" r="${f(2 + UA * .08)}" fill="#fff" opacity=".8"/>`;
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
      } else if (eq.main === "boombox") {
        const bw = 44 * k + 12, bh = 24 * k + 8, top = hy3 + handR * .2, x0 = Math.min(hx3 - bw / 2, 230 - bw), sr = bh * .32;
        it = `<path d="M${f(x0 + bw * .2)} ${f(top + 3)}Q${f(x0 + bw * .2)} ${f(hy3 - handR * .5)} ${f(hx3)} ${f(hy3 - handR * .5)}Q${f(x0 + bw * .8)} ${f(hy3 - handR * .5)} ${f(x0 + bw * .8)} ${f(top + 3)}" stroke="${ink}" stroke-width="6" fill="none"/><path d="M${f(x0 + bw * .2)} ${f(top + 3)}Q${f(x0 + bw * .2)} ${f(hy3 - handR * .5)} ${f(hx3)} ${f(hy3 - handR * .5)}Q${f(x0 + bw * .8)} ${f(hy3 - handR * .5)} ${f(x0 + bw * .8)} ${f(top + 3)}" stroke="#9aa5b1" stroke-width="3" fill="none"/>`
          + `<path d="M${f(x0 + bw * .85)} ${f(top + 2)}l${f(10 * k + 4)} ${f(-16 * k - 6)}" stroke="${ink}" stroke-width="1.8"/>`
          + `<rect x="${f(x0)}" y="${f(top)}" width="${f(bw)}" height="${f(bh)}" rx="4" fill="#c9d1d8" stroke="${ink}" stroke-width="3"/>`
          + [x0 + bh * .48, x0 + bw - bh * .48].map(x => `<circle cx="${f(x)}" cy="${f(top + bh * .55)}" r="${f(sr + 1.6)}" fill="#2b2b33" stroke="${ink}" stroke-width="1.6"/><circle cx="${f(x)}" cy="${f(top + bh * .55)}" r="${f(sr * .45)}" fill="#6b7480"/>`).join("")
          + `<rect x="${f(hx3 - bw * .15)}" y="${f(top + bh * .3)}" width="${f(bw * .3)}" height="${f(bh * .45)}" rx="1.6" fill="#3b3f47" stroke="${ink}" stroke-width="1.4"/><rect x="${f(hx3 - bw * .12)}" y="${f(top + 2.4)}" width="${f(bw * .24)}" height="2.6" fill="#ff2e88"/>`
          + AN.tr(["0 0", "3 -10"], 1.6, AN.op("1;0", 1.6, `<text x="${f(x0 + bw + 2)}" y="${f(top + 2)}" font-size="${f(9 + 4 * k)}" fill="#ffd23f" stroke="${ink}" stroke-width=".8">♪</text><text x="${f(x0 - 8)}" y="${f(top + 8)}" font-size="${f(8 + 3 * k)}" fill="#7fe7ff" stroke="${ink}" stroke-width=".8">♫</text>`));
      } else if (eq.main === "trophee") {
        const cw = 13 * k + 4, top = hy3 - handR - 40 * k;
        it = `<path d="M${f(hx3 - 3)} ${f(top + 26 * k)}V${f(hy3 + handR)}M${f(hx3 + 3)} ${f(top + 26 * k)}V${f(hy3 + handR)}" stroke="${ink}" stroke-width="3"/><rect x="${f(hx3 - 3)}" y="${f(top + 24 * k)}" width="6" height="${f(hy3 + handR - top - 24 * k)}" fill="#f5c518"/>`;
        it += `<path d="M${f(hx3 - cw)} ${f(top)}H${f(hx3 + cw)}Q${f(hx3 + cw)} ${f(top + 28 * k)} ${f(hx3)} ${f(top + 28 * k)}Q${f(hx3 - cw)} ${f(top + 28 * k)} ${f(hx3 - cw)} ${f(top)}Z" fill="#f5c518" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(hx3 - cw)} ${f(top + 4)}q${f(-9 * k)} 2 ${f(-6 * k)} ${f(12 * k)}q2 4 ${f(7 * k)} 3M${f(hx3 + cw)} ${f(top + 4)}q${f(9 * k)} 2 ${f(6 * k)} ${f(12 * k)}q-2 4 ${f(-7 * k)} 3" stroke="${ink}" stroke-width="2.6" fill="none"/>${star(hx3 - cw * .3, top + 9 * k, 3.5, "#fff8c2")}<text x="${f(hx3 + 1)}" y="${f(top + 15 * k)}" font-size="${f(9 * k)}" font-family="Anton,Impact,sans-serif" text-anchor="middle" fill="#8a6200">1</text>`;
      }
      s += it;
      // le poing par-dessus (sauf gants de boxe, déjà par-dessus)
      if (eq.poignets === "gants") s += `<circle cx="${f(hx3)}" cy="${f(hy3)}" r="${f(handR + 6)}" fill="#d62828" stroke="${ink}" stroke-width="3.5"/>`;
      else s += `<circle cx="${f(hx3)}" cy="${f(hy3)}" r="${f(handR - .5)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>` + fistD(A2.Hd, A2.E, 1);
    }
    // ---- arme tenue dans la main gauche (côté d = -1), orientée selon la pose
    let wfx = null;
    const fxOf = (def, pl, tipL) => { const t = tipL ? pl.toG(tipL) : pl.tip; return {kind: def.fx[2], word: def.fx[0], color: def.fx[1], x: +f(t[0]), y: +f(t[1]), ang: Math.round(pl.ang), s: +pl.s.toFixed(2)}; };
    if (eq.arme && WEAPONS[eq.arme]) {
      const W0 = WEAPONS[eq.arme], A1 = arms[0], [hx4, hy4] = A1.Hd;
      const fam = bustArm ? "flex" : poseFam(pose);
      const pl = placeLocal(W0, hx4, hy4, bestAngle(W0, fam, hx4, hy4, -1, handR / 12, wbox), true, handR / 12, 0, false, wbox);
      const fist = eq.poignets === "gants" ? `<circle cx="${f(hx4)}" cy="${f(hy4)}" r="${f(handR + 6)}" fill="#d62828" stroke="${ink}" stroke-width="3.5"/>` : `<circle cx="${f(hx4)}" cy="${f(hy4)}" r="${f(handR - .5)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>` + fistD(A1.Hd, A1.E, -1);
      s += W0.front ? fist + pl.svg : pl.svg + fist;
      wfx = fxOf(W0, pl);
    }
    // ---- lance-roquettes posé sur l'épaule droite (par-dessus l'épaule, derrière la tête)
    if (eq.dos === "roquette") {
      // point d'appui : le haut du trapèze / du deltoïde, côté droit
      const A2 = arms[1], ax = cx + SW * .58, tr = clamp01((ax - cx - tc0) / Math.max(1, SW - tc0));
      const ay = Math.min(trapTop + (yS + 4 - trapTop) * tr * tr + 2, A2.J[1] - UA * .5 - 2);
      const pl = placeLocal(BACKW.roquette, ax, ay, -22, false, handR / 12, 0, !!opts.fx);
      s += pl.svg;
      wfx = fxOf(BACKW.roquette, pl);
      const [rx, ry] = pl.toG(BACKW.roquette.rear);
      if (opts.fx) { // fumée du départ, derrière la tête
        const T = wtools(2.4), a = wfx.ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), k = wfx.s;
        for (let i = 0; i < 4; i++) s += T.C(rx - dx * (6 + i * 10) * k - i * 3 * k, ry - dy * (6 + i * 10) * k + i * 5 * k, (8 + i * 3) * k, i % 2 ? "#e6e6ea" : "#cfd1d8", .6);
      }
    }
    if (!wfx && dosFx && eq.dos === "fourreau") wfx = fxOf(dosFx.def, dosFx.pl);
    if (eq.poignets === "bagues") for (const A of arms) for (let i = -1; i <= 1; i++) {
      const x = A.Hd[0] + i * handR * .48, y = A.Hd[1] + handR * .12 + Math.abs(i) * handR * .06;
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(handR * .16 + .6)}" ry="${f(handR * .3)}" fill="none" stroke="${ink}" stroke-width="${f(2.4 + handR * .08)}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(handR * .16 + .6)}" ry="${f(handR * .3)}" fill="none" stroke="#f5c518" stroke-width="${f(1 + handR * .06)}"/>` + (i === 0 ? star(x, y - handR * .3, 2.4 + handR * .12, "#bfefff") : "");
    }
    if (eq.peau === "marbre") for (const A of arms) { const c = lerp(A.J, A.E, .45); s += `<path d="M${f(c[0] - 4)} ${f(c[1] - UA * .3)}q6 6 1 12t5 12" stroke="#9a9ca3" stroke-width="1.5" fill="none" opacity=".75"/>`; }
    if (eq.peau === "doree") for (const A of arms) { const c = lerp(A.J, A.E, .5); s += star(c[0] - UA * .15, c[1] - UA * .2, 4 + UA * .08, "#fff8c2"); }
    if (back) s += dosItem();
    if (eq.peau === "huile" && !back) s += `<ellipse cx="${f(cx - SW * .32)}" cy="${f(yS + 20 + pd * .4)}" rx="${f(4 + SW * .1)}" ry="3" fill="#fff" opacity=".6"/><ellipse cx="${f(cx + SW * .32)}" cy="${f(yS + 20 + pd * .4)}" rx="${f(4 + SW * .1)}" ry="3" fill="#fff" opacity=".6"/>`;

    // capuche du sweat (sous la tête)
    if (HT && HT.hood) {
      const hw2 = neckH + 14 + 4 * m;
      s += back ? `<path d="M${f(cx - neckH - 10 - 3 * m)} ${f(nkTop + 2)}Q${f(cx - hw2 - 4)} ${f(yS + 24 + 4 * m)} ${cx} ${f(yS + 32 + 6 * m)}Q${f(cx + hw2 + 4)} ${f(yS + 24 + 4 * m)} ${f(cx + neckH + 10 + 3 * m)} ${f(nkTop + 2)}Z" fill="${HT.c}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${f(cx - neckH - 4)} ${f(nkTop + 8)}Q${cx} ${f(yS + 20 + 4 * m)} ${f(cx + neckH + 4)} ${f(nkTop + 8)}" stroke="${HT.c2}" stroke-width="3" fill="none"/>`
        : `<path d="M${f(cx - neckH - 2)} ${f(nkTop + 12)}Q${f(cx - hw2 - 4)} ${f(nkTop + 8)} ${f(cx - hw2)} ${f(nkTop - 8)}Q${cx} ${f(nkTop - 24 - 4 * m)} ${f(cx + hw2)} ${f(nkTop - 8)}Q${f(cx + hw2 + 4)} ${f(nkTop + 8)} ${f(cx + neckH + 2)} ${f(nkTop + 12)}Z" fill="${HT.c}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${f(cx - hw2 + 5)} ${f(nkTop - 4)}Q${f(cx - neckH - 4)} ${f(nkTop + 6)} ${f(cx - neckH)} ${f(nkTop + 10)}M${f(cx + hw2 - 5)} ${f(nkTop - 4)}Q${f(cx + neckH + 4)} ${f(nkTop + 6)} ${f(cx + neckH)} ${f(nkTop + 10)}" stroke="${HT.c2}" stroke-width="2.6" fill="none"/>`;
    }
    // ---- tête
    const hx = cx, hy = headY, r = headR;
    { const rx = Math.min(r * .72, neckH + 2.5), cy0 = hy + r * .62, ry = r * .6; s += paint(`M${f(hx - rx)} ${f(cy0)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`, "#000", ".2"); } // ombre sous le menton
    s += `<circle cx="${f(hx - r + 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/><circle cx="${f(hx + r - 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/>`;
    s += paint([-1, 1].map(d => tap([hx + d * (r + .6), hy - .4], [hx + d * (r + 3.8), hy + 2.6], [hx + d * (r + .8), hy + 6.2], 1.5)).join(""), ink, ".55", 1); // pavillon des oreilles
    s += `<circle cx="${hx}" cy="${f(hy)}" r="${f(r)}" fill="${skin}" stroke="${ink}" stroke-width="4.5"/>`;
    s += paint(moon([hx, hy], r - 1.2, 68, .16), "#000", ".1"); // modelé du visage (joue et mâchoire)
    if (eq.visage === "catcheur" || lucha) {
      // cagoule de catcheur (violette) ou masque de luchador (vert et or, flammes rouges autour des yeux)
      const [mc, tc, ec] = lucha ? ["#14a35a", "#ffd23f", "#e63946"] : ["#8338ec", "#ffd23f", "#fff"];
      s += `<path d="M${f(hx - r - 1)} ${f(hy + r * .35)}A${f(r + 1)} ${f(r + 1)} 0 1 1 ${f(hx + r + 1)} ${f(hy + r * .35)}Q${hx} ${f(hy + r * .15)} ${f(hx - r - 1)} ${f(hy + r * .35)}Z" fill="${mc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (back) s += `<path d="M${hx} ${f(hy - r * .7)}V${f(hy + r * .3)}" stroke="${tc}" stroke-width="3" stroke-dasharray="4 3"/>`;
      else {
        s += `<path d="M${hx} ${f(hy - r)}L${f(hx - 5)} ${f(hy - r * .55)}H${f(hx + 5)}Z" fill="${tc}" stroke="${ink}" stroke-width="2"/>`;
        for (const d of [-1, 1]) {
          if (lucha) s += `<path d="M${f(hx + d * 3)} ${f(hy - r * .3)}Q${f(hx + d * r * .5)} ${f(hy - r * .9)} ${f(hx + d * r * .9)} ${f(hy - r * .55)}Q${f(hx + d * r * .7)} ${f(hy - r * .45)} ${f(hx + d * r * .95)} ${f(hy - r * .2)}Q${f(hx + d * r * .75)} ${f(hy - r * .15)} ${f(hx + d * r * .85)} ${f(hy + r * .15)}Q${f(hx + d * r * .4)} ${f(hy + r * .3)} ${f(hx + d * 3)} ${f(hy - r * .3)}Z" fill="${tc}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
          s += `<path d="M${f(hx + d * 2)} ${f(hy - r * .2)}Q${f(hx + d * r * .75)} ${f(hy - r * .55)} ${f(hx + d * r * .78)} ${f(hy + r * .05)}Q${f(hx + d * r * .4)} ${f(hy + r * .22)} ${f(hx + d * 2)} ${f(hy - r * .2)}Z" fill="${ec}" stroke="${lucha ? ink : tc}" stroke-width="${lucha ? 2 : 2.6}" stroke-linejoin="round"/>`;
          if (lucha) s += `<path d="M${f(hx + d * 4)} ${f(hy - r * .14)}Q${f(hx + d * r * .62)} ${f(hy - r * .38)} ${f(hx + d * r * .64)} ${f(hy + r * .02)}Q${f(hx + d * r * .36)} ${f(hy + r * .12)} ${f(hx + d * 4)} ${f(hy - r * .14)}Z" fill="#fff"/>`;
        }
      }
    }
    const hc = look.hairColor;
    // afro dégradée (high-top) : bloc plat sur le dessus, côtés rasés
    const hiTop = () => { const t = hy - r - 15 - 2 * m; let o = `<path d="M${f(hx - r * .84)} ${f(hy - r * .28)}L${f(hx - r * .98)} ${f(t + 7)}Q${f(hx - r)} ${f(t)} ${f(hx - r * .7)} ${f(t)}H${f(hx + r * .7)}Q${f(hx + r)} ${f(t)} ${f(hx + r * .98)} ${f(t + 7)}L${f(hx + r * .84)} ${f(hy - r * .28)}Q${hx} ${f(hy - r * .6)} ${f(hx - r * .84)} ${f(hy - r * .28)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M${f(hx - r * .94)} ${f(hy - r * .1)}q-2 6 0 12M${f(hx + r * .94)} ${f(hy - r * .1)}q2 6 0 12" stroke="${hc}" stroke-width="3" opacity=".45" stroke-linecap="round"/>`;
      for (let i = 0; i < 9; i++) o += `<path d="M${f(hx - r * .6 + (i % 5) * r * .3 + (i > 4 ? r * .15 : 0))} ${f(t + 5 + (i > 4 ? 7 : 0))}q2 -2 4 0" stroke="${shade(hc, 1.9)}" stroke-width="1.4" fill="none" opacity=".55" stroke-linecap="round"/>`;
      o += paint(tap([hx - r * .86, t + 9], [hx - r * .84, t + 2.5], [hx - r * .4, t + 2.4], 2.2), "#fff", ".3") + paint(`M${f(hx - r * .84)} ${f(hy - r * .28)}L${f(hx - r * .98)} ${f(t + 7)}L${f(hx - r * .84)} ${f(t + 9)}Q${f(hx - r * .74)} ${f(hy - r * .5)} ${f(hx - r * .6)} ${f(hy - r * .4)}ZM${f(hx + r * .84)} ${f(hy - r * .28)}L${f(hx + r * .98)} ${f(t + 7)}L${f(hx + r * .84)} ${f(t + 9)}Q${f(hx + r * .74)} ${f(hy - r * .5)} ${f(hx + r * .6)} ${f(hy - r * .4)}Z`, "#000", ".2");
      return o; };
    if (back) {
      // vue de dos : cheveux à l'arrière du crâne, pas de visage
      if (look.hair === "afro") s += `<circle cx="100" cy="${f(headY - 4)}" r="${f(headR + 13)}" fill="${hc}" stroke="${ink}" stroke-width="4"/>` + afroFx(headY - 4, headR + 13);
      else if (look.hair !== "chauve" && look.hair !== "crete") s += `<path d="M${f(hx - r - 1)} ${f(hy + r * .3)}Q${f(hx - r - 2)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r + 2)} ${f(hy - r - 8)} ${f(hx + r + 1)} ${f(hy + r * .3)}Q${hx} ${f(hy + r * .6)} ${f(hx - r - 1)} ${f(hy + r * .3)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + paint([-1, 0, 1].map(k => tap([hx + k * r * .12, hy - r * .8], [hx + k * r * .62, hy - r * .35], [hx + k * r * .66, hy + r * (.38 - Math.abs(k) * .08)], 2.4)).join(""), "#000", ".25")
        + paint(tap([hx - r * .75, hy - r * .4], [hx - r * .6, hy - r * .95], [hx - r * .1, hy - r - 4], 2.6), "#fff", ".28");
      if (look.hair === "queue") s += `<path d="M${f(hx - 5)} ${f(hy - r * .2)}q-6 30 0 50q10 -16 10 -50z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
      if (look.hair === "chignon") s += `<circle cx="${hx}" cy="${f(hy - r * .2)}" r="11" fill="${hc}" stroke="${ink}" stroke-width="4"/>` + paint(tap([hx - 7, hy - r * .2 + 2], [hx, hy - r * .2 - 8], [hx + 7, hy - r * .2 - 1], 1.8) + tap([hx - 6, hy - r * .2 + 6], [hx + 2, hy - r * .2 + 1], [hx + 8, hy - r * .2 + 4], 1.6), "#000", ".3");
      if (look.hair === "crete") s += `<path d="M${f(hx - 9)} ${f(hy - r + 4)}l-4 -20 9 8 4 -22 6 21 8 -16 -2 29z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${hx} ${f(hy - r)}V${f(hy + r * .8)}" stroke="${hc}" stroke-width="7"/>`;
      if (look.hair === "chauve") s += `<ellipse cx="${f(hx + r * .3)}" cy="${f(hy - r * .55)}" rx="${f(r * .3)}" ry="${f(r * .13)}" fill="#fff" opacity=".5"/><circle cx="${f(hx + r * .66)}" cy="${f(hy - r * .5)}" r="${f(r * .06)}" fill="#fff" opacity=".55"/>`;
      if (look.hair === "dreads") s += dreadLocs(true);
      if (look.hair === "manbun") s += `<circle cx="${hx}" cy="${f(hy - r * .25)}" r="${f(8 + r * .08)}" fill="${hc}" stroke="${ink}" stroke-width="3.5"/><path d="M${f(hx - 6)} ${f(hy - r * .25 + 6)}q6 3 12 0" stroke="${shade(hc, 1.8)}" stroke-width="2.4" fill="none"/>`;
      if (look.hair === "degrade") s += hiTop();
      if (eq.tete === "durag") s += duragTails(true);
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
      // humeur (écran des résultats / « C'est parti ») : win = grand sourire + étincelles, lose = triste et en sueur, fight = mâchoire serrée
      const mood = opts.mood === "win" || opts.mood === "lose" || opts.mood === "fight" ? opts.mood : null;
      const flush = m > 1.05 || pose === "most" || mood === "win";
      // yeux : blanc cerné, pupille et reflet ; paupière (couleur de peau) qui tombe quand on force ou qu'on boude
      const er = 2.3 + r * .1 + (m < .3 ? .4 : 0);
      const dot = (x, y, rr) => `M${f(x - rr)} ${f(y)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
      const eye = (ds, lid, py) => { const rx = er * .9, ry = er * 1.05, y0 = ey + (py || .2) * er;
        let o = ds.map(d => `<ellipse cx="${f(hx + d * ex)}" cy="${f(ey)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`).join("")
          + paint(ds.map(d => dot(hx + d * ex - d * er * .1, y0, er * .6)).join(""), ink, null, 1) + paint(ds.map(d => dot(hx + d * ex - d * er * .1 + er * .25, y0 - er * .28, er * .22)).join(""), "#fff", null, 1);
        if (lid) for (const d of ds) { const x = hx + d * ex, xi = x - d * (rx + 1), xo = x + d * (rx + 1), yi = ey - ry * (lid > 0 ? .1 : .85), yo = ey - ry * (lid > 0 ? .8 : .2), top = ey - ry - 1.6;
          o += `<path d="M${f(xi)} ${f(yi)}L${f(xo)} ${f(yo)}L${f(xo)} ${f(top)}L${f(xi)} ${f(top)}Z" fill="${skin}"/><path d="M${f(xi)} ${f(yi)}L${f(xo)} ${f(yo)}" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`; }
        return o; };
      if (flush) s += `<circle cx="${f(hx - r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity="${pose === "most" ? ".7" : ".45"}"/><circle cx="${f(hx + r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity="${pose === "most" ? ".7" : ".45"}"/>`;
      if (look.acc === "lunettes" && !eq.visage) s += `<path d="M${f(hx - r * .82)} ${f(ey - 4)}h${f(r * 1.64)}" stroke="${ink}" stroke-width="3"/><rect x="${f(hx - r * .78)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/><rect x="${f(hx + r * .12)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/>`;
      else if (eq.visage === "aviateur") {
        s += `<path d="M${f(hx - r * .9)} ${f(ey - 5)}h${f(r * 1.8)}" stroke="#c99a1e" stroke-width="2.4"/>`;
        for (const d of [-1, 1]) { const x = hx + d * r * .42; s += `<path d="M${f(x - r * .34)} ${f(ey - 6)}h${f(r * .68)}q0 ${f(r * .48)} ${f(-r * .34)} ${f(r * .48)}q${f(-r * .34)} 0 ${f(-r * .34)} ${f(-r * .48)}z" fill="#3b2d55" stroke="#c99a1e" stroke-width="2.4" stroke-linejoin="round"/><path d="M${f(x - r * .22)} ${f(ey - 3)}l${f(r * .14)} ${f(r * .2)}" stroke="#ffb3e6" stroke-width="2" opacity=".8"/>`; }
      } else if (eq.visage === "lunstar") {
        s += `<path d="M${f(hx - r * .9)} ${f(ey - 3)}h${f(r * 1.8)}" stroke="${ink}" stroke-width="2.4"/>`;
        for (const d of [-1, 1]) { let p = ""; const x = hx + d * r * .44, R = r * .4; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? R * .5 : R; p += (i ? "L" : "M") + f(x + Math.cos(a) * rr) + " " + f(ey - 1 + Math.sin(a) * rr); } s += `<path d="${p}Z" fill="#ff5fa2" stroke="#ffd23f" stroke-width="3.2" stroke-linejoin="round"/><path d="${p}Z" fill="none" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/><path d="M${f(x - R * .3)} ${f(ey - R * .3)}l${f(R * .2)} ${f(R * .25)}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`; }
      } else if (eq.visage === "coeur") {
        s += `<path d="M${f(hx - r * .9)} ${f(ey - 3)}h${f(r * 1.8)}" stroke="${ink}" stroke-width="2.4"/>`;
        for (const d of [-1, 1]) { const x = hx + d * r * .42, k = r / 22; s += `<path transform="translate(${f(x)} ${f(ey + 1)}) scale(${f(k)})" d="M0 7C-12 -1 -10 -10 -4 -10Q0 -10 0 -5Q0 -10 4 -10C10 -10 12 -1 0 7Z" fill="#ff2e63" stroke="${ink}" stroke-width="2.4"/>`; }
      } else if (pose === "kiss") {
        s += paint(tap([hx - ex - 4.5, ey + .5], [hx - ex, ey - 4.5], [hx - ex + 4.5, ey + .5], 2.8), ink, null, 1) + eye([1]);
      } else if (mood === "win") {
        s += paint([-1, 1].map(d => tap([hx + d * ex - 5.4, ey + 2], [hx + d * ex, ey - 6], [hx + d * ex + 5.4, ey + 2], 3.4)).join(""), ink, null, 1);
      } else if (mood === "lose") {
        s += eye([-1, 1], -1, .4);
        s += `<path d="M${f(hx - ex - 1)} ${f(ey + 5)}q-2 6 0 9q3 1 3 -2q0 -3 -3 -7z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.3"/>`; // larme
      } else { const lid = mood === "fight" || pose === "most" || m > .9 ? 1 : 0; s += eye([-1, 1], lid); }
      // sourcils : inquiets quand maigre, froncés quand énorme (ou en plein effort)
      const bt = mood === "lose" ? 5 : mood === "fight" ? -5 : mood === "win" ? 1 : pose === "most" ? -5 : m < .3 ? 4 : m > .9 ? -4 : 0;
      const gOff = (eq.visage === "aviateur" || eq.visage === "coeur" ? 3 : eq.visage === "lunstar" ? 5 : 0) + (mood === "win" ? 3 : 0);
      s += paint([-1, 1].map(d => { const a = [hx + d * (ex + 6.5), ey - 9 + bt - gOff], b = [hx + d * (ex - 5), ey - 9 - bt - gOff]; return tap(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.6], b, 3.8 + m); }).join(""), shade(hc, .55), null, 1); // sourcils
      { // nez : petite boule avec narine, ombre dessous et reflet
        const k = r / 22, ny = hy + r * .2;
        s += paint(tap([hx - 3.4 * k, ny + 1.4 * k], [hx, ny + 4.6 * k], [hx + 3.4 * k, ny + 1.4 * k], 2.2 * k), "#000", ".14", 1)
          + paint(tap([hx - 3 * k, ny - .4], [hx - .4 * k, ny + 3.6 * k], [hx + 3 * k, ny - .4], 1.8 * k + .4), ink, ".8", 1)
          + `<circle cx="${f(hx - 1 * k)}" cy="${f(ny - 2.4 * k)}" r="${f(1.3 * k)}" fill="#fff" opacity=".55"/>`;
      }
      if (eq.visage === "guerre") s += `<path d="M${f(hx - ex - 6)} ${f(ey + 6)}h11M${f(hx - ex - 6)} ${f(ey + 10)}h11M${f(hx + ex - 5)} ${f(ey + 6)}h11M${f(hx + ex - 5)} ${f(ey + 10)}h11" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M${hx} ${f(ey - r * .55)}v${f(r * .35)}" stroke="#d62828" stroke-width="3.4" stroke-linecap="round"/>`;
      const my = hy + r * .45;
      const grillz = eq.visage === "grillz";
      const grin = mood === "fight" || (mood !== "lose" && mood !== "win" && (pose === "most" || eq.visage === "dentor" || grillz || (m >= .9 && pose !== "kiss")));
      if (mood === "win") {
        // bouche grande ouverte (dents + langue)
        s += `<path d="M${f(hx - 12)} ${f(my - 4)}h24q-1 14 -12 14t-12 -14z" fill="#5a1020" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round"/><path d="M${f(hx - 10.5)} ${f(my - 3)}h21v3.2h-21z" fill="#fff"/><path d="M${f(hx - 6)} ${f(my + 6.5)}q6 -5 12 0q-6 4 -12 0z" fill="#ff6b81"/>`;
        if (eq.visage === "dentor") s += `<rect x="${f(hx + 1)}" y="${f(my - 3)}" width="5" height="3.2" fill="#f5c518" stroke="${ink}" stroke-width="1"/>`;
        if (grillz) s += `<path d="M${f(hx - 10.5)} ${f(my - 3)}h21v3.2h-21z" fill="#f5c518" stroke="${ink}" stroke-width=".8"/><path d="M${f(hx - 5)} ${f(my - 3)}v3.2M${hx} ${f(my - 3)}v3.2M${f(hx + 5)} ${f(my - 3)}v3.2" stroke="#b8860b" stroke-width="1"/>` + star(hx - 2.5, my - 1.4, 2, "#fff") + star(hx + 7.5, my - 1.4, 2, "#bfefff");
      } else if (mood === "lose") s += paint(tap([hx - 8.4, my + 5.4], [hx, my - 3], [hx + 8.4, my + 5.4], 3.2), ink, null, 1);
      else if (pose === "kiss") s += `<ellipse cx="${f(hx + 2)}" cy="${f(my)}" rx="4.6" ry="5.2" fill="#ff5d8a" stroke="${ink}" stroke-width="2.4"/><path d="M${f(hx + 1)} ${f(my - 2)}q3 2 0 4" stroke="${ink}" stroke-width="1.6" fill="none"/>`;
      else if (grin) {
        s += `<path d="M${f(hx - 10)} ${f(my - 3)}h20q-2 10 -10 10t-10 -10z" fill="#fff" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(hx - 9)} ${f(my + 1)}h18M${f(hx - 4.5)} ${f(my - 3)}v4M${hx} ${f(my - 3)}v4M${f(hx + 4.5)} ${f(my - 3)}v4M${f(hx - 2.5)} ${f(my + 1)}v3.6M${f(hx + 2.5)} ${f(my + 1)}v3.6" stroke="${ink}" stroke-width="1.2" opacity=".75"/>`;
        if (eq.visage === "dentor") s += `<rect x="${f(hx + 1)}" y="${f(my - 2.2)}" width="5" height="3.6" fill="#f5c518" stroke="${ink}" stroke-width="1"/>${star(hx + 7, my - 5, 3, "#fff6a8")}`;
        if (grillz) s += `<path d="M${f(hx - 9.4)} ${f(my - 2.4)}h18.8v3.4h-18.8z" fill="#f5c518"/><path d="M${f(hx - 9.6)} ${f(my + 1)}h19.2M${f(hx - 4.6)} ${f(my - 2.4)}v3.4M${hx} ${f(my - 2.4)}v3.4M${f(hx + 4.6)} ${f(my - 2.4)}v3.4" stroke="${ink}" stroke-width="1.1"/>` + star(hx - 2.3, my - .7, 2, "#fff") + star(hx + 7, my - .7, 2, "#bfefff") + AN.op("0;0;1;0", 2.4, star(hx + 13, my - 6, 4, "#fff"), "0;.7;.8;1");
      } else if (m < .3) s += `<path d="M${f(hx - 6)} ${f(my + 2)}q3 -4 6 0t6 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      else s += paint(tap([hx - 8.4, my - 1.4], [hx, my + 7.6], [hx + 8.4, my - 1.4], 3.4) + tap([hx - 10, my - 3.2], [hx - 9.6, my - 1.2], [hx - 8, my + .4], 1.2) + tap([hx + 10, my - 3.2], [hx + 9.6, my - 1.2], [hx + 8, my + .4], 1.2), ink, null, 1);
      if (look.acc === "moustache" && eq.visage !== "moust70") s += `<path d="M${f(hx - 12)} ${f(my - 2)}q6 -8 12 -3q6 -5 12 3q-6 4 -12 0q-6 4 -12 0z" fill="${hc}" stroke="${ink}" stroke-width="2.5"/>`;
      if (eq.visage === "moust70") s += `<path d="M${hx} ${f(my - 7)}q-9 -4 -14 2q-2 3 -2 14q0 4 3 4q2 0 2 -6q0 -7 4 -9q4 -2 7 -1q3 -1 7 1q4 2 4 9q0 6 2 6q3 0 3 -4q0 -11 -2 -14q-5 -6 -14 -2z" fill="${hc}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (eq.visage === "clown") s += `<circle cx="${hx}" cy="${f(hy + r * .2)}" r="${f(r * .24 + 1)}" fill="#ff1f3d" stroke="${ink}" stroke-width="2.6"/><circle cx="${f(hx - r * .07)}" cy="${f(hy + r * .13)}" r="${f(r * .07)}" fill="#fff" opacity=".8"/>`;
      if (eq.visage === "plongee") {
        s += `<path d="M${f(hx - r - 1)} ${f(ey - 2)}H${f(hx + r + 1)}" stroke="#111" stroke-width="5"/><rect x="${f(hx - r * .8)}" y="${f(ey - r * .38)}" width="${f(r * 1.6)}" height="${f(r * .66)}" rx="${f(r * .3)}" fill="#8fe3ff" fill-opacity=".45" stroke="#ff7b00" stroke-width="4"/><path d="M${f(hx - r * .55)} ${f(ey - r * .22)}l${f(r * .2)} ${f(r * .3)}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
        s += `<path d="M${f(hx + r * .55)} ${f(my + 2)}H${f(hx + r + 6)}V${f(hy - r - 14)}" stroke="${ink}" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M${f(hx + r * .55)} ${f(my + 2)}H${f(hx + r + 6)}V${f(hy - r - 14)}" stroke="#ffd23f" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (m < .15 || mood === "lose") s += `<path d="M${f(hx + r * .85)} ${f(hy - r * .5)}q5 8 0 11q-5 -3 0 -11z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.8"/>`; // goutte de sueur
      if (mood === "lose") s += `<path d="M${f(hx - r * 1.05)} ${f(hy - r * .75)}q6 9 0 13q-6 -4 0 -13z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.8"/><path d="M${f(hx + r * 1.1)} ${f(hy + r * .15)}q4 6 0 9q-4 -3 0 -9z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.5"/>`;
      if (mood === "win") s += star(hx - r - 12, hy - r * .7, 6, "#ffd23f") + star(hx + r + 13, hy - r * .9, 7.5, "#fff6a8") + star(hx + r + 6, hy + r * .5, 4.5, "#ffd23f") + star(hx - r - 6, hy + r * .55, 4, "#fff6a8");
      if (pose === "most") s += `<path d="M${f(hx - r * .45)} ${f(hy - r * .72)}q4 3 2 7q4 -2 6 2" stroke="#6d8fd0" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; // veine du front

      // ---- coiffure avant
      if (look.hair === "court" || look.hair === "queue") s += `<path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r)} ${f(hy - r - 8)} ${f(hx + r + 1)} ${f(hy - 2)}Q${f(hx + r * .4)} ${f(hy - r * .55)} ${f(hx - r * .2)} ${f(hy - r * .45)}Q${f(hx - r * .7)} ${f(hy - r * .3)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + paint(tap([hx - r * .45, hy - r * .48], [hx - r * .5, hy - r * .85], [hx - r * .12, hy - r - 4], 2.4) + tap([hx + r * .12, hy - r * .55], [hx + r * .1, hy - r * .9], [hx + r * .4, hy - r - 3.5], 2.4) + tap([hx + r * .72, hy - r * .42], [hx + r * .86, hy - r * .72], [hx + r * .62, hy - r - 1], 2), "#000", ".28")
        + paint(tap([hx - r * .86, hy - r * .4], [hx - r * .76, hy - r * .95], [hx - r * .28, hy - r - 4.5], 2.6), "#fff", ".3");
      if (look.hair === "crete") s += `<path d="M${f(hx - 9)} ${f(hy - r + 4)}l-4 -20 9 8 4 -22 6 21 8 -16 -2 29z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`
        + paint(tap([hx - 7, hy - r + 2], [hx - 9, hy - r - 6], [hx - 11.5, hy - r - 13], 1.6) + tap([hx - 2, hy - r + 1], [hx - 2, hy - r - 9], [hx + 2.6, hy - r - 26], 1.8) + tap([hx + 6, hy - r + 2], [hx + 9, hy - r - 6], [hx + 15, hy - r - 13], 1.6), "#fff", ".35")
        + `<circle cx="${f(hx - r * .62)}" cy="${f(hy - r * .5)}" r="${f(r * .05 + .4)}" fill="#000" opacity=".2"/><circle cx="${f(hx + r * .62)}" cy="${f(hy - r * .5)}" r="${f(r * .05 + .4)}" fill="#000" opacity=".2"/>`;
      if (look.hair === "chignon") s += `<circle cx="${hx}" cy="${f(hy - r - 8)}" r="11" fill="${hc}" stroke="${ink}" stroke-width="4"/><path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 6)} ${hx} ${f(hy - r - 4)}Q${f(hx + r)} ${f(hy - r - 6)} ${f(hx + r + 1)} ${f(hy - 2)}Q${hx} ${f(hy - r * .5)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + paint(tap([hx - 7, hy - r - 6], [hx, hy - r - 15], [hx + 7, hy - r - 9], 1.8) + tap([hx - r * .5, hy - r * .55], [hx - r * .3, hy - r * .9], [hx - 2, hy - r - 2], 2.2) + tap([hx + r * .5, hy - r * .55], [hx + r * .3, hy - r * .9], [hx + 2, hy - r - 2], 2.2), "#000", ".28")
        + paint(tap([hx - 7.5, hy - r - 10], [hx - 6, hy - r - 16], [hx - 1, hy - r - 17], 1.6) + tap([hx - r * .85, hy - r * .35], [hx - r * .75, hy - r * .85], [hx - r * .3, hy - r - 2], 2.4), "#fff", ".3");
      if (look.hair === "afro") s += `<path d="M${f(hx - r)} ${f(hy - 4)}Q${hx} ${f(hy - r * .55)} ${f(hx + r)} ${f(hy - 4)}" stroke="${hc}" stroke-width="6" fill="none"/>`;
      if (look.hair === "chauve") s += `<ellipse cx="${f(hx - r * .35)}" cy="${f(hy - r * .6)}" rx="${f(r * .3)}" ry="${f(r * .13)}" fill="#fff" opacity=".5" transform="rotate(-25 ${f(hx - r * .35)} ${f(hy - r * .6)})"/><circle cx="${f(hx - r * .02)}" cy="${f(hy - r * .76)}" r="${f(r * .06)}" fill="#fff" opacity=".55"/>`;
      if (look.hair === "dreads" || look.hair === "manbun") {
        s += `<path d="M${f(hx - r - 1)} ${f(hy - 1)}Q${f(hx - r)} ${f(hy - r - 7)} ${hx} ${f(hy - r - 5)}Q${f(hx + r)} ${f(hy - r - 7)} ${f(hx + r + 1)} ${f(hy - 1)}Q${f(hx + r * .55)} ${f(hy - r * .62)} ${hx} ${f(hy - r * .6)}Q${f(hx - r * .55)} ${f(hy - r * .62)} ${f(hx - r - 1)} ${f(hy - 1)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
          + paint(tap([hx - r * .84, hy - r * .3], [hx - r * .74, hy - r * .9], [hx - r * .25, hy - r - 3.5], 2.4), "#fff", ".28");
        if (look.hair === "dreads") s += paint([-1, 1].map(d => tap([hx + d * r * .2, hy - r * .64], [hx + d * r * .3, hy - r * .95], [hx + d * r * .1, hy - r - 4], 2)).join(""), "#000", ".3");
        if (look.hair === "manbun") s += `<path d="M${f(hx - r * .5)} ${f(hy - r * .85)}Q${f(hx - r * .1)} ${f(hy - r - 2)} ${f(hx + r * .1)} ${f(hy - r - 4)}M${f(hx + r * .45)} ${f(hy - r * .85)}Q${f(hx + r * .2)} ${f(hy - r - 1)} ${f(hx + r * .15)} ${f(hy - r - 4)}" stroke="${shade(hc, 1.8)}" stroke-width="1.8" fill="none" opacity=".7"/><path d="M${f(hx - r * .95)} ${f(hy + 1)}q2 -5 1 -9M${f(hx + r * .95)} ${f(hy + 1)}q-2 -5 -1 -9" stroke="${hc}" stroke-width="3" opacity=".4" stroke-linecap="round"/>`;
        else for (const d of [-1, 1]) for (const j of [0, 1]) { const a = [hx + d * r * (.72 + j * .16), hy - r * (.5 - j * .2)], b = [hx + d * (r * .84 + j * 4), hy + r * .5 + j * 4]; s += `<path d="M${pt(a)}L${pt(b)}" stroke="${ink}" stroke-width="7.5" stroke-linecap="round"/><path d="M${pt(a)}L${pt(b)}" stroke="${hc}" stroke-width="4.6" stroke-linecap="round"/>`; }
      }
      if (look.hair === "degrade") s += hiTop();
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
    if (eq.tete === "bob") {
      const y0 = hy - r * .52, y1 = y0 + 8 + m;
      s += `<path d="M${f(hx - r * .9)} ${f(y0 + 1)}Q${f(hx - r * .95)} ${f(hy - r - 10)} ${hx} ${f(hy - r - 9)}Q${f(hx + r * .95)} ${f(hy - r - 10)} ${f(hx + r * .9)} ${f(y0 + 1)}Z" fill="#d8c08a" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="M${f(hx - r * .92)} ${f(y0 - 4)}Q${hx} ${f(y0 - 8)} ${f(hx + r * .92)} ${f(y0 - 4)}" stroke="#8a6a3a" stroke-width="4" fill="none"/>`
        + `<path d="M${f(hx - r * .93)} ${f(y0 - 1)}Q${hx} ${f(y0 - 5)} ${f(hx + r * .93)} ${f(y0 - 1)}L${f(hx + r + 12)} ${f(y1)}Q${hx} ${f(y1 + 3)} ${f(hx - r - 12)} ${f(y1)}Z" fill="#c9ae74" stroke="${ink}" stroke-width="3.6" stroke-linejoin="round"/><path d="M${f(hx - r - 6)} ${f(y1 - 3)}Q${hx} ${f(y1)} ${f(hx + r + 6)} ${f(y1 - 3)}" stroke="#a88c52" stroke-width="1.4" fill="none" stroke-dasharray="3 2"/>`;
    }
    if (eq.tete === "bonnet") {
      const y0 = hy - r * .42, dome = `M${f(hx - r - 2)} ${f(y0)}Q${f(hx - r - 2)} ${f(hy - r - 13)} ${hx} ${f(hy - r - 13)}Q${f(hx + r + 2)} ${f(hy - r - 13)} ${f(hx + r + 2)} ${f(y0)}Z`, P = polyOf(dome);
      s += `<circle cx="${hx}" cy="${f(hy - r - 13)}" r="${f(4.6 + r * .04)}" fill="#fff" stroke="${ink}" stroke-width="3.2"/><path d="${dome}" fill="#e63946" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="${clipLines(P, [[hx - r - 6, hy - r * .82, hx + r + 6, hy - r * .82], [hx - r - 6, hy - r * 1.12, hx + r + 6, hy - r * 1.12]], 1.6)}" stroke="#fff" stroke-width="4.4" fill="none"/>`
        + `<rect x="${f(hx - r - 3.5)}" y="${f(y0 - 7)}" width="${f(2 * r + 7)}" height="11" rx="5" fill="#fff" stroke="${ink}" stroke-width="3.4"/><path d="${Array.from({length: 9}, (_, i) => `M${f(hx - r + i * r * .25)} ${f(y0 - 5)}v7`).join("")}" stroke="#e8c8cc" stroke-width="1.6"/>`;
    }
    if (eq.tete === "durag") {
      s += `<path d="M${f(hx - r - 1.5)} ${f(hy - r * .1)}Q${f(hx - r - 1.5)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 7)}Q${f(hx + r + 1.5)} ${f(hy - r - 8)} ${f(hx + r + 1.5)} ${f(hy - r * .1)}Q${hx} ${f(hy - r * .5)} ${f(hx - r - 1.5)} ${f(hy - r * .1)}Z" fill="#2c2f7a" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="M${f(hx - r * .7)} ${f(hy - r * .55)}Q${f(hx - r * .5)} ${f(hy - r - 2)} ${f(hx + r * .1)} ${f(hy - r - 3)}" stroke="#fff" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/><path d="M${hx} ${f(hy - r - 6)}V${f(hy - r * .45)}" stroke="#1c1e55" stroke-width="2"/>`
        + (back ? "" : `<path d="M${f(hx - r - 1)} ${f(hy - r * .18)}Q${hx} ${f(hy - r * .58)} ${f(hx + r + 1)} ${f(hy - r * .18)}" stroke="#4a4fb0" stroke-width="2.4" fill="none"/>`);
    }
    if (eq.tete === "snapback") {
      const yb = hy - r * .42;
      s += `<path d="M${f(hx - r - 1)} ${f(yb)}Q${f(hx - r)} ${f(hy - r - 9)} ${hx} ${f(hy - r - 7)}Q${f(hx + r)} ${f(hy - r - 9)} ${f(hx + r + 1)} ${f(yb)}Z" fill="#1d1d24" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      if (back) s += `<path d="M${f(hx - r * .45)} ${f(yb + 1)}q${f(r * .45)} -12 ${f(r * .9)} 0z" fill="${skin}" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(hx - r * .5)} ${f(yb - 1)}h${f(r)}" stroke="#f5c518" stroke-width="2.4"/>`;
      else s += `<text x="${hx}" y="${f(yb - r * .25)}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="${f(r * .5)}" fill="#f5c518">GF</text>`
        + `<path d="M${f(hx - r - 4)} ${f(yb + 1)}Q${hx} ${f(yb - 6)} ${f(hx + r + 4)} ${f(yb + 1)}Q${hx} ${f(yb + 7)} ${f(hx - r - 4)} ${f(yb + 1)}Z" fill="#26262f" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="${f(hx + r * .45)}" cy="${f(yb + 1.4)}" r="3.4" fill="#f5c518" stroke="${ink}" stroke-width="1"/><circle cx="${f(hx + r * .45)}" cy="${f(yb + 1.4)}" r="1.4" fill="#fff6a8"/>`;
    }
    if (eq.tete === "cretefluo") {
      const sp = `M${f(hx - 9)} ${f(hy - r + 5)}L${f(hx - 15)} ${f(hy - r - 18)}L${f(hx - 5)} ${f(hy - r - 9)}L${f(hx - 4)} ${f(hy - r - 32)}L${f(hx + 3)} ${f(hy - r - 11)}L${f(hx + 10)} ${f(hy - r - 30)}L${f(hx + 9)} ${f(hy - r - 8)}L${f(hx + 18)} ${f(hy - r - 18)}L${f(hx + 9)} ${f(hy - r + 5)}Z`;
      const by0 = hy - r + 5;
      s += `<g transform="translate(0 ${f(by0 * .4)}) scale(1 .6)">` + AN.op(".5;.15;.5", 1.2, `<path d="${sp}" fill="none" stroke="#39ff14" stroke-width="9" stroke-linejoin="round"/>`)
        + `<path d="${sp}" fill="#39ff14" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round"/><path d="M${f(hx - 12)} ${f(hy - r - 13)}L${f(hx - 15)} ${f(hy - r - 18)}L${f(hx - 9.4)} ${f(hy - r - 13.4)}ZM${f(hx - 4.3)} ${f(hy - r - 24)}L${f(hx - 4)} ${f(hy - r - 32)}L${f(hx - 1.6)} ${f(hy - r - 24)}ZM${f(hx + 8)} ${f(hy - r - 23)}L${f(hx + 10)} ${f(hy - r - 30)}L${f(hx + 9.6)} ${f(hy - r - 22)}Z" fill="#ff2e88"/></g>`;
      if (back) s += `<path d="M${hx} ${f(hy - r + 2)}V${f(hy + r * .8)}" stroke="#39ff14" stroke-width="7" stroke-linecap="round"/>`;
    }
    if (eq.peau === "doree") s += star(hx - r * .45, hy - r * .55, 4, "#fff8c2") + star(cx + SW * .3, yS + 22, 5, "#fff8c2");
    // ---- extras de pose
    if (pose === "kiss") {
      const A = arms[1], b = bulge(A);
      s += `<path transform="translate(${f(b[0] + 6)} ${f(b[1] - b[2] - 12)}) scale(1.1)" d="M0 7C-12 -1 -10 -10 -4 -10Q0 -10 0 -5Q0 -10 4 -10C10 -10 12 -1 0 7Z" fill="#ff2e63" stroke="${ink}" stroke-width="2.2"/>`;
      s += `<path transform="translate(${f(b[0] - 2)} ${f(b[1] - 2)}) rotate(-15)" d="M-5 0q2.5 -3 5 0q2.5 -3 5 0q-2.5 4 -5 1q-2.5 3 -5 -1z" fill="#ff5d8a" opacity=".85"/>`;
    }
    // ---- compagnon : à côté des pieds (taille presque fixe à l'écran), ou sur l'épaule (perroquet)
    const PD = PETS[eq.animal];
    if (PD) {
      let px, py, k, flip = false;
      if (PD.perch) {
        const d = eq.dos === "roquette" ? -1 : 1, a0 = [cx + d * neckH, nkTop], c0 = [cx + d * tc0, trapTop], b0 = [cx + d * SW, yS + 4];
        k = .72 + .2 * mc;
        const want = Math.max(SW * .6, headR * .78 + 12 * k);
        let q = b0;
        for (let i = 0; i <= 40; i++) { const p2 = bz(a0, c0, b0, i / 40); if (Math.abs(p2[0] - cx) >= want) { q = p2; break; } }
        px = q[0]; py = q[1] + 3; flip = d < 0;
      } else if (bust) {
        const S = hw * 2;
        k = S * .4 / 64; px = 100 - hw + S - PD.w * k / 2 - S * .03; py = headY - headR - 18 + S + PD.h * k * .28;
      } else {
        k = Math.pow(size(xp) / SIZE0, -.62);
        px = Math.min(Math.max((footX[1] || cx + 30) + 4 + PD.w * k / 2, cx + 52), 243 - PD.w * k / 2); py = 257;
      }
      const T = wtools(Math.max(2.4, 1.3 / k));
      let inner = PD.draw(T, AN);
      const mood = opts.mood;
      if (mood === "win") inner += `<path transform="translate(${f(PD.w * .3)} ${f(-PD.h - 4)}) scale(.8)" d="M0 7C-12 -1 -10 -10 -4 -10Q0 -10 0 -5Q0 -10 4 -10C10 -10 12 -1 0 7Z" fill="#ff2e63" stroke="${INK}" stroke-width="2.4"/>`;
      if (mood === "lose") inner += `<path d="M${f(PD.w * .32)} ${f(-PD.h + 2)}q5 8 0 11q-5 -3 0 -11z" fill="#8fd3ff" stroke="${INK}" stroke-width="1.8"/>`;
      if (PD.leash && !bust) {
        const H2 = arms[1].Hd, lp = [px + PD.leash[0] * k, py + PD.leash[1] * k], mid = [(lp[0] + H2[0]) / 2, Math.max(lp[1], H2[1]) + 18];
        s += `<path d="M${pt(H2)}Q${pt(mid)} ${pt(lp)}" stroke="${ink}" stroke-width="4" fill="none"/><path d="M${pt(H2)}Q${pt(mid)} ${pt(lp)}" stroke="#e63946" stroke-width="2" fill="none"/>`;
      }
      if (!PD.perch && !bust) s += `<ellipse cx="${f(px)}" cy="258" rx="${f(PD.w * k * .42)}" ry="${f(2 + 3 * k)}" fill="rgba(0,0,0,.22)"/>`;
      s += `<g transform="translate(${f(px)} ${f(py)}) scale(${f(flip ? -k : k)} ${f(k)})">${inner}</g>`;
      if (opts.view === "pet") { const side = Math.max(PD.w, PD.h) * k * 1.5; vbOut = `${f(px - side / 2)} ${f(py - PD.h * k / 2 - side / 2)} ${f(side)} ${f(side)}`; }
    }
    // ---- effet d'arme pendant une pose (le lobby ajoute l'onomatopée et la roquette qui s'envole)
    if (opts.fx && wfx) {
      if (wfx.kind === "rocket") {
        const T = wtools(2.4), a = wfx.ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), k = wfx.s;
        let d = ""; for (let i = 0; i < 14; i++) { const b = i * Math.PI / 7, r = i % 2 ? 9 * k : 18 * k; d += (i ? "L" : "M") + f(wfx.x + dx * 12 * k + Math.cos(b) * r) + " " + f(wfx.y + dy * 12 * k + Math.sin(b) * r); }
        s += T.P(d + "Z", "#ffb703") + T.C(wfx.x + dx * 12 * k, wfx.y + dy * 12 * k, 7 * k, "#fff6c9", 0);
      } else s += weaponFxSvg(wfx.kind, wfx.x, wfx.y, wfx.ang, wfx.s);
    }
    if (opts.out) {
      opts.out.fx = wfx;
      // points d'ancrage (unités du SVG, pour la pose et la vue courantes) : « L » = côté gauche de l'image (d = -1), « R » = côté droit
      const P2 = p => [+f(p[0]), +f(p[1])], lg = d => legs.find(L => L.d === d);
      opts.out.anchors = {headX: cx, headY: +f(headY), headR: +f(headR), neckY: +f(nkTop), shoulderY: +f(yS),
        shoulderL: P2(arms[0].J), shoulderR: P2(arms[1].J), handL: P2(arms[0].Hd), handR: P2(arms[1].Hd), hipY: 172,
        kneeL: P2(lg(-1).knee), kneeR: P2(lg(1).knee), footL: P2(feet[-1]), footR: P2(feet[1]), groundY: 258, viewBox: vbOut.split(" ").map(Number)};
    }
    return `<svg class="av" viewBox="${vbOut}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` + s + `</svg>`;
  }

  // Plus il est musclé, plus le perso prend de place à l'écran. growth(xp) = la taille rapportée au départ (×1 → ×2,7),
  // pour les textes « taille × ».
  // Départ ×3 (on voit les détails dès la crevette), croissance continue jusqu'à ×8 à 2 000 XP :
  // ≈ +5 % de taille par victoire (+100 XP), ≈ +1,2 % par partie jouée (+25 XP).
  const SIZE0 = 3, SIZE_MAX = 8;
  const size = xp => SIZE0 * Math.pow(SIZE_MAX / SIZE0, Math.max(0, Math.min(MAX_LEVEL * LEVEL_XP, +xp || 0)) / (MAX_LEVEL * LEVEL_XP));
  const growth = xp => size(xp) / SIZE0;
  G.avatar = {svg, tier, muscle, size, growth, SKINS, HAIR_COLORS, HAIR_STYLES, CLOTH, TOPS, ACCS, TIERS, DEFAULT_LOOK,
    LEVEL_XP, MAX_LEVEL, level, groups, skipLegDay, RARITIES, SLOTS, ITEMS, ITEM, equipped, POSES,
    // infos de l'effet d'arme pour une pose : {kind, word, color, x, y, ang, s} en unités du SVG (ou null)
    weaponFx(look, xp, pose) { const o = {}; svg(look, xp, {pose, fx: true, out: o}); return o.fx || null; }};
})();
