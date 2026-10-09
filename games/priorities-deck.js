/* Gonflette Party : le paquet de cartes de « Priorities » (chargé AVANT games/priorities.js).
   Format compact : une chaîne par catégorie, cartes séparées par « | », chaque carte = « emoji texte ».
   (Une carte sans emoji prend l'emoji de sa catégorie.) L'ordre des cartes fixe leurs numéros :
   l'état du jeu n'envoie que des numéros, donc tous les téléphones doivent avoir le même fichier.
   Règles d'écriture : français, léger, tout public, pas de politique ni de vraie personne privée, pas de doublon
   (vérifié sans tenir compte des accents ni des majuscules). */
(function () {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
G.prioritiesDeck = [
{id: "pop", n: "Pop culture", e: "🎬", c1: "#a066ff", c2: "#5b1fd1", l: `
🧱 Minecraft|⚡ Harry Potter|🌌 Star Wars|🐭 Pokémon|🍄 Mario Kart|🦸 Les super-héros|🧟 Les films de zombies|🎤 La Star Academy|🏝️ Koh-Lanta|💍 Le Seigneur des anneaux|
🦖 Jurassic Park|🎮 Fortnite|🐉 Dragon Ball|🏴‍☠️ One Piece|📺 Les séries coréennes|🦁 Le Roi Lion|❄️ La Reine des neiges|🕷️ Spider-Man|🦇 Batman|🧛 Les vampires|
🎭 Les comédies musicales|🚀 Les films de science-fiction|👻 Les films d'horreur|💘 Les comédies romantiques|📼 Les années 80|💿 Les années 2000|🎸 Le rock|🎧 Le rap|🪩 Le disco|🎻 La musique classique|
🐟 Le Monde de Nemo|🤠 Toy Story|🧸 Les Bisounours|🍩 Les Simpson|🧽 Bob l'éponge|🕹️ Tetris|🐸 Les mèmes internet|📱 TikTok|🏆 L'Eurovision|🕵️ Les séries policières|
👑 Les contes de fées|🛡️ Astérix et Obélix|🐕 Tintin|💙 Les Schtroumpfs|🧅 Shrek|🚢 Titanic|🎩 Indiana Jones|⏰ Retour vers le futur|🕶️ Matrix|🍸 James Bond|
🍌 Les Minions|🟡 Pac-Man|🦔 Sonic|🗡️ Zelda|🏠 Les Sims|🍬 Candy Crush|🦾 Les Avengers|🌹 Le Petit Prince|🐻 Le Livre de la jungle|🧞 Aladdin|
🧜 La Petite Sirène|👠 Cendrillon|🍎 Blanche-Neige|🔔 Questions pour un champion|🎙️ Les télé-crochets|📺 La télé-réalité|🧃 Les dessins animés du mercredi|📚 Les mangas|💬 Les BD|🍥 Les animés japonais|
🎄 Les téléfilms de Noël|🥋 Les films de kung-fu|🌵 Les westerns|🦈 Les films de requins|💥 Les films d'action|🏰 Les dessins animés Disney|💡 Les films Pixar|🐲 Donjons et Dragons|🔍 Le Cluedo|🔤 Le Scrabble|
💰 Le Monopoly|🃏 Le Uno|🧀 Le Trivial Pursuit|👾 Les jeux d'arcade|🎮 Les consoles rétro|🎶 Les génériques de dessins animés|☀️ Les tubes de l'été|🕯️ Les slows|💜 La K-pop|🟢 Le reggae|
🎷 Le jazz|🎼 L'opéra|🤘 Le métal|🔊 La techno|🕺 Les boys bands|🎤 Les chansons de Noël|🔪 Les podcasts de faits divers|🐈 Les vidéos de chats|📦 Les vidéos d'unboxing|💄 Les tutos maquillage|
👂 Les vidéos ASMR|🔴 Les lives Twitch|📹 Les youtubeurs|📲 Les jeux sur téléphone|📖 Les livres dont vous êtes le héros|🎞️ Les films en noir et blanc|🔁 Les remakes|2️⃣ Les suites de films|🤐 Les spoilers|🎬 Les bandes-annonces|
🩺 Les séries médicales|🛋️ Les sitcoms|🎒 Les séries d'ados|💔 Les feuilletons à rebondissements|🧶 Les marionnettes|💃 Les jeux de danse|🎸 Guitar Hero|🏎️ Les jeux de course|⚽ Les jeux de foot sur console|🏗️ Les jeux de construction|
🧙 Les sagas fantasy|🤖 Les films de robots|🦍 King Kong|🐙 Les monstres marins au cinéma|🦸‍♀️ Wonder Woman|🧪 Les savants fous de dessins animés|🚗 Cars|🐀 Ratatouille|🎈 Là-haut|🐠 Le Monde de Dory|
🧠 Vice-Versa|🦕 Le Petit Dinosaure|🐼 Kung Fu Panda|🐒 Les films de singes|👽 E.T.|🛸 Les films d'extraterrestres|🧛‍♂️ Dracula|🧟‍♂️ Frankenstein|👹 Les ogres de contes|🐺 Le Grand Méchant Loup|
🎪 Les dessins animés des années 90|📟 Les tamagotchis|🃏 Les cartes Pokémon|📀 Les DVD bonus|🎬 Les bêtisiers|🎙️ Les doublages ratés|📻 Les radios du matin|🎵 Les chansons qui restent dans la tête|🎹 Les musiques de jeux vidéo|🕺 La Macarena`},
{id: "miam", n: "Bouffe", e: "🍽️", c1: "#ffa23a", c2: "#d45f00", l: `
🍍 L'ananas|🍕 La pizza|🍍 La pizza à l'ananas|🥦 Le brocoli|🧀 Le fromage qui pue|🍫 Le chocolat noir|🥐 Les croissants|🍣 Les sushis|🌮 Les tacos|🍔 Les burgers|
🍟 Les frites|🥑 L'avocat|🍗 Le poulet-riz|🥚 Les œufs durs|🥤 Le shaker de protéines|🍌 La banane|🫒 Les olives|🥜 Le beurre de cacahuète|🍜 Les nouilles instantanées|🍿 Le pop-corn|
🧄 L'ail|🌶️ Le piment|🍦 La glace à la vanille|🥞 Les crêpes|🍝 Les pâtes au beurre|🥗 La salade verte|🍉 La pastèque|🍓 Les fraises|🫐 Les myrtilles|🍋 Le citron|
🥥 La noix de coco|🧇 Les gaufres|🥖 La baguette|🎂 Le gâteau d'anniversaire|🦪 Les huîtres|🐌 Les escargots au beurre persillé|🥕 Les carottes râpées|🍄 Les champignons|🫕 La raclette|🍫 La pâte à tartiner|
☕ Le café|🍵 Le thé|🧋 Le bubble tea|🥨 Les bretzels|🫕 La fondue savoyarde|🥔 La tartiflette|🫘 Le cassoulet|🌭 La choucroute|🍲 Le couscous|🥘 La paella|
🍝 Les lasagnes|🥔 Le hachis parmentier|🥬 Les endives|🥬 Les épinards|🥬 Les choux de Bruxelles|🟢 Les petits pois|🫘 Les lentilles|⬜ Le tofu|🌾 Le quinoa|🥣 Le porridge|
🥣 Les céréales du matin|🍞 Le pain perdu|🧁 Les madeleines|🍬 Les macarons|🍰 Le tiramisu|🍮 La crème brûlée|🍮 Le flan pâtissier|🧁 Les cannelés|🍫 Les éclairs au chocolat|🍫 La mousse au chocolat|
🍚 Le riz au lait|🥔 Les chips au vinaigre|🥒 Les cornichons|🥚 La mayonnaise|🍅 Le ketchup|🌭 La moutarde qui monte au nez|🌶️ La sauce piquante|🧀 Le fromage râpé|🧀 Le camembert|🧀 Le roquefort|
🍬 Les bonbons qui piquent|🍡 Les marshmallows|🍭 La barbe à papa|🍭 Les sucettes|🫧 Les chewing-gums|🍪 Le pain d'épices|🍪 Les cookies|🍩 Les donuts|🥖 Les churros|🥢 Les nems|
🥟 Les raviolis vapeur|🥙 Le kebab|🌭 Le hot-dog|🥪 Le sandwich triangle|🥪 Le croque-monsieur|🥧 La quiche lorraine|🍲 La soupe de légumes|🍅 Le gaspacho|🥤 Le smoothie vert|🍊 Le jus d'orange avec pulpe|
💧 L'eau pétillante|🥤 Le soda sans bulles|🥛 Le lait chaud|☕ Le chocolat chaud|⚡ Les boissons énergisantes|🍋 La limonade|🥝 Le kiwi|🥭 La mangue|🍒 Les cerises|🍐 Les poires|
🍇 Le raisin|🔴 La grenade|🍊 Le pamplemousse|🌴 Les dattes|🟣 Les figues|🥬 Le céleri|🔴 Les radis|🟣 La betterave|🌽 Le maïs|🍠 Les patates douces|
🫑 Les poivrons|🍆 Les aubergines|🥒 Les courgettes|🍗 Le blanc de poulet|🥩 Le steak haché|🐟 Le poisson pané|🦐 Les crevettes|🐟 Le saumon fumé|🥫 Le thon en boîte|🐟 Les sardines|
🥖 Le jambon-beurre|🍱 Les restes de la veille|🥞 Le brunch du dimanche|🍽️ La cantine|🍟 Le fast-food|🍽️ Les buffets à volonté|🍖 Le barbecue|👵 La cuisine de mamie|🥧 La tarte aux pommes|🍓 La tarte aux fraises|
🍋 La tarte au citron meringuée|🍰 Le fraisier|🎂 La forêt-noire|🥮 La galette des rois|🍩 Les beignets|🥐 Les pains au chocolat|🥐 Les chocolatines|🍞 La brioche|🥯 Les bagels|🫓 Les galettes bretonnes|
🍳 Les œufs brouillés|🍳 L'omelette|🥓 Le bacon|🥔 La purée|🍟 Les potatoes|🧅 Les rondelles d'oignon|🥗 La salade de pâtes|🥫 Les raviolis en boîte|🍝 Les spaghettis bolognaise|🍝 Les pâtes carbonara|
🍕 La pizza quatre fromages|🍕 La pizza froide le lendemain|🍔 Le burger végétarien|🥙 Le falafel|🫓 Le houmous|🍛 Le curry|🍛 Le poulet tikka|🍜 Les ramens|🍲 Le pot-au-feu|🥘 Le bœuf bourguignon|
🍲 La blanquette de veau|🐸 Les cuisses de grenouille|🫕 La bouillabaisse|🥗 La salade niçoise|🍅 La ratatouille|🥖 Le pan bagnat|🥞 Les pancakes au sirop d'érable|🍯 Le miel|🧈 Le beurre salé|🍮 Le caramel au beurre salé|
🍨 La glace à la pistache|🍨 Le sorbet citron|🍦 Les glaces à l'italienne|🍧 Les granités|🧊 Les esquimaux|🍫 Les barres chocolatées|🍬 Les bonbons à la menthe|🍬 La réglisse|🍭 Les bonbons en forme d'ours|🥜 Les cacahuètes de l'apéro|
🧀 Les dés de fromage|🥖 La tapenade|🫒 Le guacamole|🥕 Les bâtonnets de légumes|🍅 Les tomates cerises|🥒 Le concombre|🥑 Les toasts à l'avocat|🧀 Le fromage de chèvre|🧀 La mozzarella|🍕 La burrata`},
{id: "lieux", n: "Lieux", e: "🗺️", c1: "#4d97ff", c2: "#1b52cc", l: `
🏖️ La plage|⛰️ La montagne|🏋️ La salle de sport|🛒 Le supermarché un samedi|🗼 Paris|🗽 New York|🏯 Tokyo|🏝️ Une île déserte|🏕️ Le camping|🎢 Les parcs d'attractions|
🏰 Les châteaux forts|🚇 Le métro à l'heure de pointe|✈️ L'aéroport|🩺 La salle d'attente du médecin|🏫 L'école primaire|🏢 Le bureau|🛏️ Mon lit|🛋️ Le canapé|🚿 La douche|🌲 La forêt|
🌋 Les volcans|🏜️ Le désert|🧊 Le pôle Nord|🌊 L'océan|🐠 L'aquarium|🦁 Le zoo|🎡 La fête foraine|🏟️ Le stade|🎭 Le théâtre|🎬 Le cinéma|
📚 La bibliothèque|🏪 L'épicerie de nuit|🧖 Le sauna|🏊 La piscine municipale|🚗 Les embouteillages|🚂 Le train de nuit|🛳️ Les croisières|🍝 L'Italie|🌵 Le Mexique|🎪 Le cirque|
🛝 L'aire de jeux|🏡 La campagne|🌆 Les rooftops|🛶 Venise|💂 Londres|🏛️ Rome|⚓ Marseille|🏔️ Les Alpes|🌧️ La Bretagne|🏝️ La Corse|
☀️ La Côte d'Azur|🗾 Le Japon|🦘 L'Australie|🍁 Le Canada|🌋 L'Islande|🐫 L'Égypte|🔺 Les pyramides|🧱 La Grande Muraille de Chine|🎰 Las Vegas|🌺 Hawaï|
🏝️ Les Caraïbes|🏜️ Le Grand Canyon|🌴 La jungle|🦒 La savane|🦇 Les grottes|🐸 Les marais|🏞️ Les lacs de montagne|💦 Les cascades|🗼 Les phares|⚓ Les ports de pêche|
🎄 Les marchés de Noël|🧺 Les brocantes|🧸 Les vide-greniers|🛍️ Les centres commerciaux|🛋️ Le magasin de meubles un dimanche|🅿️ Les parkings souterrains|⛽ Les stations-service la nuit|🛣️ Les aires d'autoroute|🚉 Les gares|🛗 Les ascenseurs|
🪜 Les escalators|🧺 La laverie automatique|📮 La poste|🏦 La banque|🏛️ La mairie|🦷 Le cabinet du dentiste|💇 Le salon de coiffure|🚪 Le vestiaire de la salle|🚻 Les toilettes publiques|📦 Le grenier|
🕯️ La cave|🔧 Le garage|🌻 Le jardin|🪴 Le balcon|🍳 La cuisine|🛁 La salle de bain|🏨 Les chambres d'hôtel|🛏️ Les auberges de jeunesse|🌳 Les cabanes dans les arbres|⛄ Les igloos|
⛺ Les yourtes|🌕 La Lune|🔴 Mars|🚀 L'espace|🐙 Le fond des océans|⛷️ Les stations de ski|🪩 Les boîtes de nuit|🎤 Les bars à karaoké|👾 Les salles d'arcade|🖼️ Les musées|
🎨 Les expos d'art moderne|🎋 Les jardins japonais|🐄 Les fermes pédagogiques|👻 Les villes fantômes|🏚️ Les maisons hantées|💪 Muscle Beach|🌉 San Francisco|🍁 Montréal|🏙️ Dubaï|🌸 Kyoto|
🐘 L'Inde|🍜 La Thaïlande|🥐 Le Portugal|💃 L'Espagne|🍺 L'Allemagne|🧇 La Belgique|🧀 La Suisse|🌷 Les Pays-Bas|☘️ L'Irlande|🏴 L'Écosse|
🫖 L'Angleterre|🏺 La Grèce|🕌 Le Maroc|🦁 Le Kenya|🦜 Le Brésil|🌮 La Californie|🗿 L'île de Pâques|🧭 Le Triangle des Bermudes|🌍 Le tour du monde|🌌 La Voie lactée|
🛰️ La Station spatiale|🏙️ Les gratte-ciel|🏘️ Les lotissements|🌾 Les champs de blé|🌻 Les champs de tournesols|💜 Les champs de lavande|🍇 Les vignes|🍎 Les vergers|🐑 Les alpages|🏖️ Les criques secrètes|
🧗 Les falaises|🏝️ Les atolls|🛖 Les huttes|🏕️ Les bivouacs en montagne|🚐 Les vans aménagés|🛤️ Les voies ferrées abandonnées|⛲ Les fontaines|🎠 Les manèges|🌁 Les ponts suspendus|🏔️ L'Everest`},
{id: "ame", n: "Émotions & idées", e: "💭", c1: "#ff6f9a", c2: "#c81650", l: `
😈 L'égoïsme|🎁 La générosité|😒 La jalousie|😳 La honte|🥹 La nostalgie|😤 La colère|🧘 Le calme|💸 L'argent|🕰️ La ponctualité|🔮 L'horoscope|
🎲 Le hasard|😂 Les fous rires|😴 L'ennui|🤫 Les secrets|🤥 Les petits mensonges|🤗 Les câlins|🙃 L'ironie|🙏 La politesse|🏆 La compétition|🐢 La lenteur|
⚡ L'impatience|🦥 La paresse|🧐 La curiosité|🙈 La timidité|😎 La confiance en soi|😰 Le stress|😱 Le vertige|🌑 La peur du noir|🦁 Le courage|⏳ La patience|
😋 La gourmandise|🧊 La rancune|🕊️ Le pardon|🤝 L'amitié|💘 Le coup de foudre|🔁 La routine|🧭 L'aventure|🔄 Le changement|✨ La perfection|🌪️ Le désordre|
🗂️ Le rangement|🦅 La liberté|🏝️ La solitude|👥 La foule|🤐 Le silence|📢 Le bruit|🏎️ La vitesse|🌈 L'optimisme|🌧️ Le pessimisme|😏 Le sarcasme|
🌸 Les compliments|👎 Les critiques|🛋️ La flemme|🔥 La motivation|⏰ La procrastination|🤡 L'autodérision|😇 La mauvaise foi|🙄 Les excuses bidon|😬 La gêne|😶 Les silences gênants|
🦚 La fierté|🌱 L'humilité|🍀 La chance|🐈‍⬛ La malchance|⏳ Le suspense|🤞 Les promesses|💭 Les rêves bizarres|😨 Les cauchemars|🧠 La mémoire|🫥 Les trous de mémoire|
💯 La sincérité|🔨 La franchise brutale|🕊️ La diplomatie|💗 La gentillesse|⚔️ La rivalité|🥇 La victoire|🥈 La défaite|🤝 Le fair-play|🃏 La triche|🕵️ Le mystère|
🎭 L'improvisation|📋 L'organisation|✅ Les listes de choses à faire|⬜ Le minimalisme|💎 Le luxe|💍 Le bling-bling|🌿 La simplicité|🦉 La sagesse|🐣 La naïveté|🧓 La maturité|
🧒 L'enfance|👴 La vieillesse|🌹 Le romantisme|😉 La drague|💔 Les ruptures|🫶 Les réconciliations|👨‍👩‍👧 La famille|🎎 Les traditions|🆕 La nouveauté|🛸 Les théories farfelues|
🧂 Les superstitions|🔗 Les coïncidences|💡 L'intuition|🧮 La logique|➗ Les maths|🤔 La philosophie|🌙 Les débats à 3 h du matin|⚖️ Les dilemmes|🍃 La zénitude|🎢 L'adrénaline|
🥶 Les frissons|🤷 Le doute|🙌 L'enthousiasme|😌 Le soulagement|🤩 L'émerveillement|😮 La surprise|😢 Les larmes de joie|😡 Les coups de gueule|🥱 La fatigue|💪 La persévérance|
🎯 L'ambition|🧸 La tendresse|🫂 Le réconfort|🤓 La culture générale|🗣️ Les ragots|👀 Les commérages|📏 Les règles|🚫 Les interdits|🎉 La fête|🎊 L'euphorie|
😪 La mélancolie|🌅 L'espoir|🧩 La complicité|🧲 L'attirance|🙊 Les gaffes|💤 La rêverie|🫠 La gêne absolue|🤯 Les révélations|🔍 Le sens du détail|🎈 La légèreté|
🌋 Les colères noires|🎻 La sensibilité|📣 L'autorité|🙋 La spontanéité|⏱️ L'urgence|🐌 Prendre son temps|🗝️ La confiance|🕳️ Le vide|♾️ L'infini|🎓 Le savoir`},
{id: "moments", n: "Moments", e: "📅", c1: "#f2b01e", c2: "#9c6400", l: `
🗓️ Les lundis matin|🌆 Les dimanches soir|🎄 Noël|🎂 Mon anniversaire|💤 La sieste|⏰ Le réveil qui sonne|🎒 La rentrée scolaire|🏖️ Les vacances d'été|🎆 Le Nouvel An|💌 La Saint-Valentin|
🎃 Halloween|☀️ Le premier jour de soleil|🌧️ La pluie|🥵 La canicule|❄️ La neige|🌙 Les nuits blanches|📅 Les réunions|📝 Les devoirs|🧹 Le ménage|🧾 La paperasse|
🍂 L'automne|🌸 Le printemps|☃️ L'hiver|🌞 L'été|🌉 Les ponts de mai|🎉 Le vendredi soir|☕ Le samedi matin|📆 Les jours fériés|💒 Les mariages|🥳 Les enterrements de vie de garçon|
🍼 Les baby showers|🏠 Les pendaisons de crémaillère|👨‍👩‍👦 Les fêtes de famille|🍗 Les repas de Noël interminables|🥂 Le réveillon|🧀 Les apéros|🔥 Les barbecues entre voisins|🛌 Les soirées pyjama|🎲 Les soirées jeux de société|📦 Les déménagements|
💼 Les entretiens d'embauche|👔 Le premier jour de travail|✏️ Les examens|🎓 Les résultats du bac|🎓 Les remises de diplômes|🚗 Les bouchons du retour de vacances|🚙 Les longs trajets en voiture|🚆 Les retards de train|😴 Les grasses matinées|🌅 Les levers de soleil|
🌇 Les couchers de soleil|⛈️ Les orages|⏳ Les journées qui n'en finissent pas|🏷️ Les soldes|🛍️ Le Black Friday|💶 Le jour de paie|🪙 La fin du mois|🦷 Les rendez-vous chez le dentiste|🩺 Les visites médicales|🌟 Les premières fois|
💐 Les premiers rendez-vous|🎉 Les fêtes surprises|🎁 Les cadeaux ratés|📷 Les photos de classe|👪 Les réunions de famille|👵 Les vacances chez les grands-parents|🏕️ Les colonies de vacances|⛷️ Les classes de neige|🚌 Les sorties scolaires|🎪 Les kermesses|
🎶 La fête de la musique|🎆 Le 14 Juillet|🎭 Le carnaval|🐟 Le poisson d'avril|🥚 La chasse aux œufs|🔥 Les feux de camp|✨ Les nuits à la belle étoile|🌩️ Les orages d'été|🌫️ Les matins brumeux|🌬️ Les jours de grand vent|
🗓️ Les week-ends prolongés|⏱️ Les dernières minutes avant un départ|🧍 Les files d'attente|📶 Le Wi-Fi qui coupe|🔋 La batterie qui lâche|💻 Les mises à jour forcées|😌 Se réveiller avant l'alarme|☕ Le premier café du matin|🥪 La pause déjeuner|🍪 Le goûter|
🕯️ Les dîners aux chandelles|🌛 Le grignotage de minuit|🧳 Le retour de vacances|🕐 Le passage à l'heure d'été|🌒 Les éclipses|🌠 Les étoiles filantes|🌈 Les arcs-en-ciel|🌨️ Les tempêtes de neige|🍇 Les vendanges|🌾 Les moissons|
🎅 Le matin de Noël|🧧 Les étrennes|🍾 Les toasts au champagne|🎤 Les discours de mariage|📸 Les photos de groupe|🎈 Les anniversaires d'enfants|🏁 Les lignes d'arrivée|🔔 La dernière sonnerie avant les vacances|🎒 Le dernier jour d'école|🧑‍🎓 La remise des copies|
🛫 Le décollage|🛬 L'atterrissage|🚿 La douche après le sport|🛀 Le bain du dimanche soir|📺 Les soirées télé en famille|🍿 Les séances de cinéma en plein air|🏊 Le premier bain de l'année|🧊 Le bain du Nouvel An dans la mer|🌞 Les après-midi au soleil|🌙 Les nuits d'été|
🔦 Les coupures de courant|🚧 Les travaux du voisin|🛎️ Les livraisons qui arrivent pendant la douche|📞 Les appels à 8 h du matin|🗝️ Les clés oubliées à l'intérieur|🧦 La chaussette mouillée|🥶 Les matins de gel|🐝 Les guêpes à l'apéro|🍉 Les pique-niques qui finissent sous la pluie|⛱️ Le parasol qui s'envole`},
{id: "fun", n: "Activités", e: "🎉", c1: "#2fd18a", c2: "#0b7f4b", l: `
🎤 Le karaoké|💃 Danser en soirée|🎳 Le bowling|🎣 La pêche|🧩 Les puzzles|🎮 Les jeux vidéo|📖 Lire au lit|🍳 Cuisiner|🧺 Les pique-niques|🛍️ Le shopping|
🧗 L'escalade|🚲 Le vélo|🎨 La peinture|🪴 Le jardinage|📸 La photo|📺 Les marathons de séries|🎲 Les jeux de société|🃏 Les soirées jeux de cartes|⛺ Dormir sous la tente|🛹 Le skate|
⛸️ Le patin à glace|🎢 Les montagnes russes|🚐 Les road trips|🎧 Écouter des podcasts|📞 Les appels téléphoniques|✉️ Écrire des cartes postales|🧶 Le tricot|🐕 Promener le chien|🛁 Les bains moussants|🎻 Apprendre un instrument|
🔐 Les escape games|🧁 La pâtisserie|🦆 Nourrir les canards|🛒 Les courses en ligne|💬 Les messages vocaux|🎯 Les fléchettes|🏄 Le surf|🤿 La plongée|🥾 La randonnée|🛶 Le kayak|
🏄‍♀️ Le paddle|🪂 Le parachute|🪢 Le saut à l'élastique|🏎️ Le karting|🎨 Le paintball|🔦 Le laser game|🤸 Le trampoline|🛝 La balançoire|🏰 Les châteaux de sable|💦 Les batailles d'eau|
⛄ Les batailles de boules de neige|🛖 Construire des cabanes|🏺 La poterie|✂️ Le scrapbooking|✏️ Les mots croisés|🔢 Le sudoku|♟️ Les échecs|⚫ Les dames|🪄 La magie|🎴 Les tours de cartes|
🤹 Jongler|🎭 Le théâtre d'impro|🚿 Chanter sous la douche|🥞 Faire des crêpes|🧀 Les dégustations de fromages|🖼️ Visiter des musées|☁️ Regarder les nuages|🔭 Observer les étoiles|🎆 Les feux d'artifice|🔨 Le bricolage|
🧵 La couture|👚 Ranger son placard|🖼️ Trier ses photos|🤳 Les selfies|📲 Poster des stories|🌲 Les promenades en forêt|🐚 Ramasser des coquillages|🍄 La cueillette des champignons|🍓 La cueillette des fraises|👩‍🍳 Les ateliers cuisine|
🤲 Le bénévolat|🎭 Les soirées à thème|🦸 Les déguisements|💄 Le maquillage|💅 Les manucures|🛋️ Les cabanes en couvertures|🍿 Les soirées films d'horreur|🔤 Les jeux de mots|🍬 Les blagues de papier de bonbon|❓ Les devinettes|
🧠 Les quiz de culture générale|🎱 Le loto|🎟️ Les jeux à gratter|🪶 Les batailles d'oreillers|🙈 Le cache-cache|🏃 Le chat perché|⭕ Le hula hoop|🪀 Le yoyo|🪁 Les cerfs-volants|✈️ Les maquettes d'avion|
🚂 Les trains électriques|📮 Collectionner des timbres|🎴 Les cartes à collectionner|🗺️ Les jeux de piste|💰 Les chasses au trésor|📍 Le géocaching|🚗 Chanter en voiture|🎳 Le minigolf|🏹 Le tir à l'arc au camping|🐴 Les balades à poney|
🚣 Le pédalo|🏊 Les toboggans aquatiques|🎡 La grande roue|🎠 Les autos tamponneuses|🎈 Les lâchers de ballons|🍫 Les ateliers chocolat|🍹 Les cocktails sans alcool maison|🧪 Les expériences scientifiques à la maison|🌋 Les volcans en bicarbonate|🧩 Les puzzles de 5000 pièces|
🎬 Tourner des petits films|🎙️ Faire un podcast|🎵 Composer des chansons|🥁 La batterie|🎹 Le piano|🎺 La trompette|🪕 Le ukulélé|🎤 Les blind tests|🗣️ Les débats enflammés|📝 Écrire un journal intime|
📚 Les clubs de lecture|🧘 La méditation|🌿 Les herbiers|🦋 Observer les oiseaux|🐠 Le snorkeling|⛵ La voile|🚤 Le ski nautique|🏂 Le snowboard|🛷 La luge|⛄ Faire un bonhomme de neige`},
{id: "sport", n: "Sport & muscu", e: "💪", c1: "#ff5a5a", c2: "#bd1220", l: `
🏋️ Le powerlifting|🦵 Le jour de jambes|💪 Le jour des bras|🏃 Le cardio|🧘‍♂️ Le yoga|🥊 La boxe|🤸 Les burpees|🧱 Le gainage|🔥 Les courbatures|🥇 Battre son record|
🪞 Les selfies dans le miroir de la salle|🧴 L'autobronzant de compétition|🌧️ Le footing sous la pluie|⚽ Le foot|🏀 Le basket|🎾 Le tennis|🏉 Le rugby|🏐 Le beach-volley|🏊 La natation|🚣 Le rameur|
🚴 Le vélo d'appartement|⏱️ Le HIIT|🦍 Les cris à la salle|🧦 Les chaussettes dans les claquettes|🎽 Les débardeurs échancrés|🥄 La créatine|🍱 Les six repas par jour|😮‍💨 Les tractions|🪢 La corde à sauter|🏋️‍♀️ Le crossfit|
🏆 Les concours de bodybuilding|🤼 La lutte|🥋 Le judo|⛷️ Le ski alpin|🏌️ Le golf|🏓 Le ping-pong|🧊 Les bains glacés|📏 Mesurer ses biceps|🎒 Le sac de sport qui sent|🤳 Filmer sa séance|
💤 Le jour de repos|🥗 La sèche avant l'été|🍑 Le squat|🛏️ Le développé couché|⚙️ Le soulevé de terre|💪 Les pompes|🍫 Les abdos en béton|🦿 Les fentes|📐 La planche sur le côté|🙆 Les étirements|
🌡️ L'échauffement|📣 Le coach qui crie|🎧 La musique à fond dans les écouteurs|🤢 Le shaker oublié dans le sac|⏳ Les machines occupées|😤 Ceux qui ne rangent pas leurs poids|🏅 Les marathons|🏃‍♀️ Le semi-marathon|🏊‍♂️ Le triathlon|🚴‍♂️ Le Tour de France|
🥇 Les Jeux olympiques|🏆 La Coupe du monde|🍙 Le sumo|🎯 La pétanque|🥌 Le curling|🏒 Le hockey sur glace|🤾 Le handball|🏐 Le volley-ball|🏸 Le badminton|🎾 Le squash|
🤺 L'escrime|🏹 Le tir à l'arc|🏇 L'équitation|🎀 La gym rythmique|⛸️ Le patinage artistique|🩰 La danse classique|🕺 Le breakdance|💃 La zumba|🧘‍♀️ Le pilates|💦 L'aquagym|
🚲 Le spinning|🏋️‍♂️ Le body pump|👯 Les cours collectifs|💊 Les compléments alimentaires|🍫 Les barres protéinées|🥤 Les boissons isotoniques|🧤 Les gants de muscu|🥋 La ceinture de force|✋ La magnésie sur les mains|🎀 Les haltères roses|
🔔 Les kettlebells|🟢 Les élastiques de musculation|🪑 Le banc de muscu|🦵 La presse à cuisses|➖ La barre olympique|⚫ Les disques de 20 kg|🏗️ Le rack à squat|⚖️ La balance du vestiaire|📸 Les photos torse nu|💥 La congestion après la séance|
🦶 Les mollets|🔺 Les trapèzes|🫀 Les pectoraux|🔻 Le dos en V|🍫 Les tablettes de chocolat|💪 Les biceps saillants|🍗 Le régime hyperprotéiné|🍔 Le cheat meal|📱 Les applis de sport|⌚ Les montres cardio|
📈 Les records personnels|🚫 Le sport à jeun|🌅 Le sport à 6 h du matin|📆 Les abdos du lundi|🏁 Le sprint final|🧗‍♀️ L'escalade en salle|🥾 Le trail|🏔️ L'alpinisme|🚵 Le VTT|🛼 Le roller|
🏄‍♂️ Le bodyboard|🤽 Le water-polo|🏈 Le football américain|⚾ Le baseball|🏏 Le cricket|🥏 L'ultimate frisbee|🎳 Le bowling en compétition|🎱 Le billard|🎯 Les fléchettes de compétition|🏋️ L'haltérophilie|
🤸‍♀️ La gymnastique|🪂 Le parapente|🏂 Le snowboard freestyle|🛶 Le canoë|🚣‍♀️ L'aviron|🏃‍♂️ Le 100 mètres|🦘 Le saut en longueur|🎋 Le saut à la perche|🥏 Le lancer de disque|🔨 Le lancer de marteau`},
{id: "objets", n: "Objets", e: "📦", c1: "#22c3d6", c2: "#0a7385", l: `
🧦 Les chaussettes dépareillées|📱 Mon téléphone|🔋 La batterie à 1 %|🕶️ Les lunettes de soleil|🧢 Les casquettes|👟 Les baskets blanches|🩴 Les claquettes|🧸 Les peluches|🪴 Les plantes vertes|🕯️ Les bougies parfumées|
🎧 Les écouteurs sans fil|⌚ Les montres connectées|🧳 Les valises à roulettes|☂️ Les parapluies|🪥 La brosse à dents électrique|🧲 Les magnets de frigo|🛏️ Les couettes|🖊️ Les stylos quatre couleurs|🗝️ Les clés qu'on perd|🧻 Le papier toilette|
🪑 Les chaises qui grincent|🎈 Les ballons de baudruche|🧩 Les briques de construction sous le pied|📺 La télécommande|💡 Les guirlandes lumineuses|🧤 Les gants en laine|🎒 Les cartables|🪞 Les miroirs|🛴 Les trottinettes|📦 Les cartons de déménagement|
🧽 Les éponges|🫧 Le papier bulle|🔔 Les sonnettes|⏰ Les réveils|🧮 Les calculatrices|📻 La radio|🖨️ L'imprimante|🧊 Les glaçons|🥢 Les baguettes chinoises|🗒️ Les post-it|
📎 Les trombones|🎞️ Le scotch qui ne se décolle pas|✂️ Les ciseaux|🎀 Les élastiques à cheveux|🧺 Les pinces à linge|💨 Le sèche-cheveux|👔 Le fer à repasser|🧹 L'aspirateur|🤖 Le robot aspirateur|📡 Le micro-ondes|
🍞 Le grille-pain|☕ La machine à café|🫖 La bouilloire|🥶 Le congélateur|🥡 Les boîtes sans couvercle|🍴 Les couverts en plastique|🍷 Les verres à pied|☕ Les mugs rigolos|🍵 Les tasses ébréchées|🥿 Les chaussons|
👕 Les pyjamas|🥋 Les peignoirs|🏖️ Les serviettes de plage|🧢 Les bonnets|🧣 Les écharpes|🧥 Les doudounes|👔 Les cravates|🎀 Les nœuds papillon|🧦 Les chaussettes de Noël|🎄 Les pulls moches de Noël|
💍 Les bijoux fantaisie|⏱️ Les montres à gousset|🥽 Les lunettes de natation|🦆 Les bouées canard|🛟 Les matelas gonflables|🌴 Les hamacs|🏖️ Les transats|⛱️ Les parasols|🧊 Les glacières|🔦 Les lampes torches|
🧭 Les boussoles|🗺️ Les cartes routières|📍 Les GPS qui se trompent|🔌 Les chargeurs|🔌 Les multiprises|🪢 Les câbles emmêlés|⌨️ Les claviers mécaniques|🖱️ Les souris d'ordinateur|💾 Les clés USB|💾 Les disquettes|
📼 Les cassettes vidéo|💿 Les vinyles|📷 Les appareils photo jetables|📸 Les photos instantanées|🔭 Les jumelles|🔍 Les loupes|⏳ Les sabliers|🐦 Les horloges coucou|🔮 Les boules à neige|🧙 Les nains de jardin|
🐷 Les tirelires|🔑 Les porte-clés|📛 Les badges|⭐ Les autocollants|💮 Les tatouages éphémères|✨ Les paillettes|🎊 Les confettis|🥳 Les cotillons|💨 Les coussins péteurs|🌀 Les hand spinners|
🟥 Les cubes casse-tête|🌀 Les toupies|🔵 Les billes|🔫 Les pistolets à eau|🥏 Les frisbees|🪃 Les boomerangs|👝 Les sacs banane|🫗 Les gourdes|☕ Les thermos|🪒 Les rasoirs|
🧴 La crème solaire|🧼 Les savonnettes|💈 Les peignes|🧷 Les épingles à nourrice|🪡 Les aiguilles à coudre|🔩 Les vis en trop après un montage de meuble|🛠️ Les boîtes à outils|🪜 Les escabeaux|🪣 Les seaux|🧯 Les extincteurs|
🖼️ Les cadres photo|🕰️ Les pendules|🛋️ Les poufs|🪟 Les rideaux|🛏️ Les lits superposés|🪆 Les poupées russes|🎲 Les dés|🃏 Les jeux de cartes|♟️ Les échiquiers|🎯 Les cibles de fléchettes|
🎸 Les guitares|🥁 Les tambourins|🎺 Les trompettes en plastique|📯 Les cornes de brume|📣 Les mégaphones|🧸 Les doudous|🍼 Les biberons|🛒 Les caddies qui tirent à gauche|🚲 Les sonnettes de vélo|🛹 Les planches à roulettes`},
{id: "gens", n: "Les gens", e: "👥", c1: "#de9a52", c2: "#8d5214", l: `
🧑‍🏫 Les profs de sport|🧑‍🍳 Les chefs étoilés|🤳 Les influenceurs|☀️ Les lève-tôt|🦉 Les couche-tard|👏 Ceux qui applaudissent quand l'avion atterrit|🗣️ Ceux qui parlent fort au téléphone|🎉 Les voisins qui font la fête|👵 Les grands-mères|👶 Les bébés|
🧒 Les enfants au restaurant|🤡 Les clowns|🎩 Les magiciens|🕺 Les danseurs de mariage|🚕 Les chauffeurs de taxi|💇 Les coiffeurs bavards|📣 Les coachs trop motivés|🤓 Les geeks|🎅 Le Père Noël|🐭 La petite souris|
🤠 Les cow-boys|🏴‍☠️ Les pirates|🥷 Les ninjas|🧜‍♀️ Les sirènes|👽 Les extraterrestres|🤖 Les robots|👨‍🚀 Les astronautes|🧑‍🚒 Les pompiers|🕵️‍♀️ Les détectives|🤷 Ceux qui répondent « on verra »|
⏰ Les gens toujours en retard|🍰 Ceux qui mangent ton dessert|📸 Les touristes|🧑‍🎤 Les rockstars|💼 Les collègues du lundi|🧽 Les maniaques du rangement|😎 Les frimeurs|🧐 Les je-sais-tout|🏃 Les joggeurs du dimanche|⚔️ Les chevaliers|
👸 Les princesses|🤴 Les rois|🧙‍♀️ Les sorcières|🧚 Les fées|🦹 Les super-vilains|🤐 Les mimes|🤹 Les jongleurs|🎧 Les DJ|🍽️ Les serveurs pressés|🛍️ Les vendeurs trop insistants|
🛵 Les livreurs|📬 Les facteurs|🥖 Les boulangers|🧀 Les fromagers|🥩 Les bouchers|💐 Les fleuristes|🧑‍🌾 Les jardiniers|🔧 Les plombiers|🦷 Les dentistes|🐾 Les vétérinaires|
🛟 Les maîtres-nageurs|⛷️ Les moniteurs de ski|🟨 Les arbitres|📯 Les supporters de foot|🎮 Les youtubeurs gaming|🎙️ Les streamers|😹 Les créateurs de mèmes|🙊 Les gens qui spoilent|🐌 Les gens qui marchent lentement|😤 Ceux qui doublent dans la file|
🦶 Ceux qui mettent les pieds sur la table|🎶 Ceux qui chantent faux|😗 Les siffleurs|😠 Les râleurs|🎈 Les têtes en l'air|📐 Les perfectionnistes|💬 Les bavards|🃏 Les farceurs|😋 Les gourmands|🏰 Les fans de Disney|
⚽ Les fans de foot|🕹️ Les gamers|📚 Les lecteurs compulsifs|🎬 Les cinéphiles|🌍 Les grands voyageurs|🏕️ Les campeurs|🏄‍♂️ Les surfeurs|💪 Les bodybuilders|🛢️ Les culturistes huilés|🥕 Les végétariens|
☕ Les accros au café|🫖 Les fans de thé|🏠 Les colocataires|🔊 Les voisins du dessus|🧔 Les tontons blagueurs|👥 Les cousins éloignés|💔 Les ex|👯 Les meilleurs amis|📏 Les profs de maths|📖 Les bibliothécaires|
🧪 Les savants fous|💡 Les inventeurs|🧭 Les explorateurs|🏺 Les archéologues|👨‍✈️ Les pilotes d'avion|⚓ Les capitaines de bateau|🤼‍♂️ Les catcheurs|🗯️ Les gens qui disent « en vrai »|🎤 Ceux qui envoient des vocaux de 5 minutes|📵 Ceux qui répondent « ok. »|
🧛‍♀️ Les gothiques|🌸 Les fleurs bleues|🎸 Les guitaristes de soirée|🤳 Les accros aux selfies|🛒 Les accros aux soldes|🧗 Les casse-cou|😴 Les marmottes humaines|🐓 Les gens du matin qui chantent|🧘 Les zen en toutes circonstances|🧑‍💼 Les chefs de projet|
🧑‍⚕️ Les infirmiers|🧑‍🔬 Les scientifiques|🧑‍🎨 Les artistes|🧑‍💻 Les développeurs|🕴️ Les agents secrets|🧑‍🏭 Les ouvriers du bâtiment|🧑‍🚀 Les cosmonautes en herbe|🧑‍✈️ Les hôtesses de l'air|🧙‍♂️ Les sorciers|🧌 Les trolls`},
{id: "betes", n: "Animaux", e: "🐾", c1: "#93cc45", c2: "#4a780c", l: `
🐦 Les pigeons|🐱 Les chats|🐶 Les chiens|🐹 Les hamsters|🐍 Les serpents|🕷️ Les araignées|🦟 Les moustiques|🐝 Les abeilles|🦄 Les licornes|🐉 Les dragons|
🐼 Les pandas|🦥 Les paresseux|🐧 Les pingouins|🦈 Les requins|🐬 Les dauphins|🐙 Les pieuvres|🦀 Les crabes|🐌 Les limaces|🦆 Les canards|🐓 Les coqs qui chantent à 5 h|
🐄 Les vaches|🐷 Les cochons|🐑 Les moutons|🦒 Les girafes|🐘 Les éléphants|🦍 Les gorilles|🐒 Les singes|🦘 Les kangourous|🐨 Les koalas|🦉 Les hiboux|
🦇 Les chauves-souris|🐸 Les grenouilles|🦋 Les papillons|🐞 Les coccinelles|🐿️ Les écureuils|🦦 Les loutres|🦩 Les flamants roses|🐊 Les crocodiles|🦖 Les dinosaures|🐎 Les chevaux|
🐴 Les ânes|🦙 Les lamas|🐫 Les chameaux|🦓 Les zèbres|🦏 Les rhinocéros|🦛 Les hippopotames|🦁 Les lions|🐅 Les tigres|🐆 Les léopards|🐺 Les loups|
🦊 Les renards|🐻 Les ours|🐻‍❄️ Les ours polaires|🦭 Les phoques|🐋 Les baleines|🫧 Les méduses|⭐ Les étoiles de mer|🌊 Les hippocampes|🐢 Les tortues|🦎 Les lézards|
🦎 Les caméléons|🦂 Les scorpions|🐜 Les fourmis|🪰 Les mouches|🪳 Les cafards|🪱 Les vers de terre|🐔 Les poules|🐣 Les poussins|🦃 Les dindes|🐦 Les oies|
🦢 Les cygnes|🦜 Les perroquets|🦅 Les aigles|🐦 Les corbeaux|🐦 Les mouettes qui volent les frites|🌺 Les colibris|🦚 Les paons|🦔 Les hérissons|🐰 Les lapins|🐹 Les cochons d'Inde|
🦡 Les furets|🦝 Les ratons laveurs|🦫 Les castors|🦡 Les blaireaux|🕳️ Les taupes|🐭 Les souris|🐀 Les rats|🦬 Les bisons|🦌 Les cerfs|🦌 Les élans|
⛰️ Les marmottes|🐐 Les chèvres|🐠 Les poissons rouges|🐟 Les piranhas|〰️ Les anguilles|🦞 Les homards|🦑 Les calamars|🐳 Les orques|🦄 Les narvals|💗 Les axolotls|
🟫 Les capybaras|🦊 Les fennecs|👀 Les suricates|🐾 Les pandas roux|👃 Les tamanoirs|🐈 Les chats sans poils|🐕‍🦺 Les chiens qui portent des pulls|🌭 Les teckels|🐶 Les carlins|😼 Les chats qui font tomber les objets|
🐕 Les chiens qui aboient la nuit|🐈 Les chats qui dorment sur le clavier|🐟 Les poissons-clowns|🐡 Les poissons-globes|🦈 Les requins-marteaux|🐋 Les cachalots|🦭 Les morses|🐧 Les manchots empereurs|🐾 Les tatous|🦨 Les mouffettes|
🐻 Les oursons|🐥 Les canetons|🐺 Les huskys|🐩 Les caniches|🐕 Les golden retrievers|🦮 Les chiens guides|🐄 Les vaches qui regardent passer les trains|🐎 Les poneys|🦗 Les grillons|🦗 Les sauterelles|
🐛 Les chenilles|🐌 Les escargots de jardin|🦟 Les moucherons|🐝 Les bourdons|🦋 Les mites|🐜 Les termites|🦀 Les bernard-l'ermite|🐚 Les moules|🐙 Les poulpes|🦐 Les krills`},
{id: "manies", n: "Petits plaisirs & manies", e: "😏", c1: "#e57ce0", c2: "#952190", l: `
🍪 Manger la pâte à cookies crue|🌧️ Le bruit de la pluie sur le toit|🥖 L'odeur du pain chaud|⛽ L'odeur de l'essence|📚 L'odeur des livres neufs|🛏️ Retourner l'oreiller côté frais|📱 Enlever le film plastique d'un écran neuf|🫰 Faire craquer ses doigts|🙌 Se gratter le dos|🧺 Les draps propres|
🌱 Marcher pieds nus dans l'herbe|💦 Sauter dans les flaques|🍂 Écraser les feuilles mortes|🍕 Le premier croc dans une pizza|🥄 Racler le fond du pot de pâte à tartiner|🥛 Lécher le couvercle du yaourt|🍪 Tremper ses biscuits dans le lait|🍨 Manger le dessert en premier|🎂 Garder le meilleur pour la fin|🪴 Parler à ses plantes|
🐈 Parler à son chat|💃 Danser seul dans sa cuisine|😆 Rire à ses propres blagues|💤 Les siestes de 20 minutes|😴 Les siestes de 3 heures|⏰ Se rendormir 5 minutes|🔁 Appuyer sur « répéter »|🎞️ Regarder des vidéos de recettes|👎 Lire les avis négatifs|🛒 Acheter des trucs inutiles|
🌈 Ranger par couleur|📏 Aligner les objets parfaitement|🔢 Compter les marches|🚶 Éviter les lignes du trottoir|💼 Faire semblant d'être occupé|👀 Faire semblant de ne pas avoir vu un message|✔️ Laisser les messages en « vu »|🧶 Les gros pulls en hiver|🧦 Les chaussettes en laine|🛋️ Le plaid sur le canapé|
🍵 Les tisanes du soir|🌞 Les bains de soleil|🔥 Les douches brûlantes|🥶 Les douches froides|🪥 Se brosser les dents en marchant|💅 Se ronger les ongles|🖊️ Mâchouiller son stylo|✍️ Faire tourner son stylo|✏️ Griffonner pendant les réunions|🗨️ Parler tout seul|
🎭 Imiter les accents|😜 Faire des grimaces|🐶 Les selfies avec filtre chien|😂 Mettre des emojis partout|💬 Les messages sans ponctuation|🔠 Écrire en MAJUSCULES|💭 Les points de suspension|🚿 Les douches de 30 minutes|🛵 Se faire livrer à minuit|🛏️ Manger dans son lit|
🧊 Manger debout devant le frigo|👆 Goûter la sauce avec le doigt|🖍️ Sentir les feutres|🍬 Collectionner les sachets de sucre|📦 Garder les boîtes « au cas où »|🎟️ Garder ses tickets de cinéma|📱 Relire ses vieux messages|🖼️ Regarder les photos de vacances des autres|🛍️ Faire les magasins sans rien acheter|🌸 Essayer tous les parfums en boutique|
🎁 Les échantillons gratuits|🧀 Les dégustations au supermarché|🏷️ Les codes promo|💳 Les cartes de fidélité|📝 Les listes jamais finies|☑️ Cocher une case|⌨️ Le bruit du clavier|🤫 Le silence absolu|📻 Le bruit blanc pour dormir|📺 Dormir avec la télé allumée|
⭐ Dormir en étoile|🌀 Dormir avec un ventilateur|😪 Ronfler|🥱 Bâiller en réunion|⏱️ Arriver pile à l'heure|🕐 Arriver en avance|🌙 Les messages de bonne nuit|🎙️ Les vocaux qui commencent par « alors »|📞 Les plans de dernière minute|😮‍💨 Annuler un plan et être soulagé|
📺 Les soirées plaid et série|👕 Rester en pyjama toute la journée|🏠 Ne pas sortir du week-end|🦶 Les bains de pieds|🧖 Les masques de beauté|✂️ Se couper les cheveux soi-même|💇‍♀️ Changer de coupe sur un coup de tête|🎶 Chanter les génériques par cœur|🥤 Faire du bruit avec la paille|🍿 Manger le pop-corn avant le film|
🧃 Finir la brique de jus au goulot|🍝 Manger les pâtes froides|🥢 Manger avec des baguettes à la maison|🍫 Cacher du chocolat|🧂 Mettre du sel partout|🍳 Saucer son assiette|🍞 Le croûton de la baguette|🥐 Manger le croissant en chemin|🍟 Voler les frites des autres|🍉 Cracher les pépins de pastèque|
🎮 Juste une dernière partie|📺 Juste un dernier épisode|🛋️ Le canapé qui avale les télécommandes|📱 Scroller au lit|📸 Prendre son repas en photo|🗓️ Planifier ses vacances un an avant|🧳 Faire sa valise la veille au soir|🧳 Faire sa valise trois semaines avant|🚗 Arriver à l'aéroport trois heures avant|🧭 Se perdre exprès en voyage|
🔊 Mettre la musique à fond|🎧 Écouter la même chanson en boucle|🎤 Chanter les paroles de travers|🕺 Danser sur les chansons de pub|🛁 Lire dans le bain|📖 Corner les pages des livres|🔖 Les marque-pages fantaisie|🖊️ Tester les stylos en magasin|📝 Faire des listes de listes|🗃️ Trier ses mails|
🧽 Faire la vaisselle tout de suite|🍽️ Laisser tremper la vaisselle|🧺 La pile de linge sur la chaise|🧦 Les chaussettes qui disparaissent|🛏️ Faire son lit au carré|🛌 Ne jamais faire son lit|🪟 Regarder par la fenêtre en pensant à rien|☕ Le café trop chaud qu'on oublie|🥶 Le café froid qu'on boit quand même|🫖 Laisser infuser le thé trop longtemps`},
{id: "tech", n: "Tech & internet", e: "💻", c1: "#6f7fa8", c2: "#2b3655", l: `
📶 Le Wi-Fi gratuit|🔑 Les mots de passe oubliés|🤖 Les captchas|🔔 Les notifications|👨‍👩‍👧‍👦 Les groupes de discussion familiaux|😀 Les emojis|🎞️ Les GIF animés|🌈 Les filtres photo|💘 Les applis de rencontre|👣 Les podomètres|
🗣️ Les assistants vocaux|🚗 Les voitures électriques|🚁 Les drones|🥽 La réalité virtuelle|🍲 Les robots de cuisine|🧱 Les imprimantes 3D|💻 Les ordinateurs portables|📱 Les tablettes|📲 Les téléphones pliables|🤳 Les perches à selfie|
📺 Les écrans géants|🌐 Les jeux en ligne|🍪 Les cookies des sites web|⏭️ Les pubs avant les vidéos|🎬 Les plateformes de streaming|📧 Les spams|📨 Les mails pro du dimanche|📹 Les visios caméra coupée|🎙️ Le micro qui reste allumé|🎧 « Tu m'entends ? »|
❤️ Les likes|💬 Les commentaires en ligne|#️⃣ Les hashtags|👥 Les selfies de groupe|🔋 Les batteries externes|🖥️ Les doubles écrans|⌨️ Les raccourcis clavier|🖱️ Le clic droit|🗑️ La corbeille pleine|💾 La sauvegarde automatique|
⚠️ Les messages d'erreur|🔄 Redémarrer pour réparer|🐢 Les connexions lentes|📡 La 5G|🛰️ Le GPS|🗺️ Les cartes en ligne|📷 Les photos floues|🖼️ Les fonds d'écran|🎨 Les thèmes sombres|☀️ La luminosité au maximum|
🔕 Le mode silencieux|✈️ Le mode avion|🌙 Le mode nuit|🔒 La reconnaissance faciale|👆 Les empreintes digitales|🧠 L'intelligence artificielle|🤖 Les chatbots|🎮 Le cloud gaming|🕹️ Les manettes sans fil|🎧 Les casques gamer|
📦 Le suivi de colis|🚚 La livraison en 24 h|🛒 Les paniers abandonnés|⭐ Les avis cinq étoiles|💳 Le paiement sans contact|📲 Les QR codes|🎫 Les billets électroniques|📚 Les liseuses|🎵 Les playlists partagées|🎙️ Les messages vocaux accélérés|
🔍 Les recherches à 2 h du matin|❓ Les forums d'entraide|📝 Les wikis|🧑‍💻 Le code informatique|🐞 Les bugs|🧩 Les mises à jour d'applis|💡 Les ampoules connectées|🔊 Les enceintes connectées|🚪 Les sonnettes vidéo|🌡️ Les thermostats intelligents|
📸 Les appareils photo des téléphones|🎥 Les vidéos verticales|🎬 Les montages vidéo|🎶 Les sons viraux|🕺 Les chorégraphies virales|🐱 Les chats d'internet|🖼️ Les mèmes de chiens|🏆 Les défis viraux|🗳️ Les sondages en story|📊 Les statistiques de temps d'écran`}
];
})();
