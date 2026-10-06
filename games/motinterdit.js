/* Gonflette Party : Le Mot Interdit (2 à 8 joueurs, chacun sur son téléphone).
   Adapté du jeu « Le Mot Interdit » (plateau télé des années 70 : lambris, poste de télé, tampon INTERDIT, buzzer rouge).
   Chaque joueur explique une fois par manche, 2 manches, 50 s par tour. L'hôte tient la pioche, le chrono et les scores.
   Score : l'explicateur gagne +1 par carte trouvée ; à partir de 3 joueurs, celui qui a trouvé gagne aussi +1.
   Passer : 0 point (2 passes max par tour). BZZZ (mot interdit) : −1 pour l'explicateur, carte suivante.
   Tests : window.__miSpeed = 10 accélère les durées (lu par l'hôte). */
(function () {
"use strict";

/* ================= PIOCHE (reprise du jeu original) ================= */
const CAT_COLORS = {
  "Maison":"#e8702a","Nourriture":"#c98a0b","Animaux":"#5c8f2b","Métiers":"#2a7a73","Sports":"#c7432a",
  "Lieux":"#8a4a1c","Objets":"#7d3c6b","Expressions":"#c4466e","Fêtes":"#b8326a","Nature":"#3f7d3a",
  "Transports":"#2f5d8a","Loisirs":"#9a5b1f","Corps & santé":"#b0473a"
};
const RAW = {
"Maison":`Canapé: salon, assis, coussin, télé, confortable
Cuisine: cuisiner, repas, four, frigo, pièce
Réfrigérateur: froid, frais, aliments, congélateur, porte
Lit: dormir, chambre, matelas, oreiller, nuit
Baignoire: bain, eau, salle de bains, mousse, douche
Escalier: marches, monter, descendre, étage, rampe
Grenier: toit, combles, poussière, vieux, ranger
Cave: sous-sol, vin, bouteilles, sombre, escalier
Cheminée: feu, bois, Père Noël, fumée, salon
Fenêtre: vitre, verre, ouvrir, rideau, regarder
Aspirateur: poussière, ménage, aspirer, bruit, tapis
Lave-linge: vêtements, laver, machine, lessive, tambour
Balcon: terrasse, appartement, dehors, étage, plantes
Rideau: fenêtre, tissu, tirer, lumière, théâtre
Robinet: eau, évier, ouvrir, fermer, goutte
Oreiller: lit, tête, dormir, plumes, taie
Sonnette: porte, ding-dong, appuyer, visiteur, entrée
Garage: voiture, garer, porte, outils, bricolage
Jardin: plantes, fleurs, herbe, potager, dehors
Boîte aux lettres: courrier, facteur, enveloppe, colis, clé
Télécommande: télé, boutons, zapper, chaîne, piles
Volet: fenêtre, fermer, bois, nuit, persienne`,
"Nourriture":`Croissant: boulangerie, beurre, petit-déjeuner, viennoiserie, pain au chocolat
Baguette: pain, boulangerie, croûte, longue, magique
Fromage: lait, camembert, raclette, vache, plateau
Crêpe: farine, poêle, Chandeleur, Nutella, sucre
Pizza: Italie, mozzarella, four, tomate, pâte
Raclette: fromage, pommes de terre, appareil, charcuterie, hiver
Fondue: fromage, caquelon, pain, savoyarde, chocolat
Escargot: Bourgogne, beurre, ail, coquille, lent
Chocolat: cacao, noir, lait, tablette, Pâques
Omelette: œufs, poêle, battre, champignons, jambon
Ratatouille: légumes, courgette, aubergine, Provence, film
Soupe: légumes, bol, cuillère, chaud, potage
Frites: pommes de terre, huile, belge, ketchup, friteuse
Salade: laitue, vinaigrette, verte, feuilles, tomates
Gâteau: anniversaire, bougies, four, farine, dessert
Glace: froid, cornet, vanille, été, boule
Pain perdu: rassis, œuf, lait, poêle, sucre
Quiche: lorraine, lardons, pâte, œufs, crème
Banane: jaune, fruit, singe, éplucher, peau
Fraise: rouge, fruit, chantilly, tarte, printemps
Citron: jaune, acide, jus, agrume, tarte
Miel: abeille, sucré, ruche, pot, jaune
Moutarde: Dijon, jaune, piquant, condiment, pot
Pop-corn: maïs, cinéma, sucré, salé, éclater
Sandwich: pain, jambon, beurre, midi, tranche
Couscous: semoule, merguez, légumes, Maroc, bouillon`,
"Animaux":`Girafe: cou, long, Afrique, taches, grand
Éléphant: trompe, défenses, gros, Afrique, oreilles
Pingouin: banquise, noir, blanc, froid, glisser
Kangourou: Australie, sauter, poche, bébé, boxe
Hérisson: piquants, boule, forêt, petit, Sonic
Chauve-souris: nuit, voler, grotte, Batman, vampire
Abeille: miel, piquer, ruche, jaune, reine
Requin: mer, dents, aileron, poisson, nager
Dauphin: mer, intelligent, sauter, nager, Flipper
Lion: roi, savane, crinière, rugir, Afrique
Serpent: ramper, venin, siffler, long, cobra
Chat: miauler, souris, moustaches, ronronner, griffes
Chien: aboyer, os, fidèle, niche, laisse
Coq: matin, cocorico, poule, France, crête
Vache: lait, meuh, pré, taches, ferme
Cochon: rose, ferme, groin, boue, jambon
Tortue: carapace, lent, vieille, ninja, mer
Perroquet: parler, plumes, couleurs, oiseau, répéter
Hibou: nuit, oiseau, yeux, chouette, hululer
Papillon: ailes, chenille, couleurs, voler, fleurs
Grenouille: sauter, mare, verte, crapaud, croasser
Mouton: laine, bêler, troupeau, berger, compter
Écureuil: noisettes, queue, arbre, roux, grimper
Araignée: toile, huit pattes, peur, insecte, tisser
Loup: hurler, meute, Petit Chaperon rouge, forêt, lune
Panda: bambou, Chine, noir, blanc, ours
Moustique: piquer, bzzz, été, sang, insecte`,
"Métiers":`Pompier: feu, camion, rouge, sirène, incendie
Boulanger: pain, baguette, four, farine, matin
Médecin: malade, docteur, ordonnance, stéthoscope, soigner
Dentiste: dents, carie, fauteuil, brosse, mal
Facteur: courrier, lettres, colis, vélo, boîte
Professeur: école, élèves, classe, cours, maître
Cuisinier: restaurant, chef, cuisine, plat, toque
Coiffeur: cheveux, couper, ciseaux, salon, brushing
Policier: police, voleur, menottes, uniforme, arrêter
Astronaute: espace, fusée, lune, combinaison, apesanteur
Plombier: tuyaux, fuite, eau, Mario, réparer
Vétérinaire: animaux, soigner, chien, chat, malade
Pilote: avion, voler, cockpit, commandant, ciel
Jardinier: plantes, jardin, fleurs, arroser, tondeuse
Journaliste: journal, article, informations, télé, interview
Serveur: restaurant, plateau, commande, café, pourboire
Clown: cirque, nez rouge, rire, maquillage, drôle
Magicien: tour, chapeau, lapin, baguette, illusion
Pharmacien: médicaments, pharmacie, ordonnance, croix verte, malade
Architecte: plans, maison, bâtiment, dessiner, construire
Agriculteur: ferme, tracteur, champs, vaches, récolte
Avocat: tribunal, juge, défendre, robe, procès
Boucher: viande, couteau, steak, charcuterie, tablier
Détective: enquête, loupe, indice, Sherlock, mystère`,
"Sports":`Football: ballon, but, équipe, gardien, pied
Tennis: raquette, balle, filet, court, Roland-Garros
Natation: nager, piscine, eau, crawl, maillot
Ski: neige, montagne, piste, bâtons, hiver
Vélo: pédaler, roues, Tour de France, guidon, bicyclette
Judo: kimono, ceinture, Japon, combat, tatami
Basket: panier, ballon, NBA, dribbler, grand
Rugby: ballon ovale, mêlée, essai, plaquer, équipe
Golf: trou, club, balle, green, swing
Boxe: gants, ring, coup de poing, combat, KO
Marathon: courir, 42 kilomètres, course, coureur, endurance
Pétanque: boules, cochonnet, pointer, tirer, Marseille
Surf: vague, planche, mer, glisse, Hawaï
Escalade: grimper, mur, corde, prises, montagne
Équitation: cheval, cavalier, monter, selle, galop
Danse: musique, bouger, pas, rythme, ballet
Yoga: posture, souplesse, tapis, respiration, zen
Ping-pong: tennis de table, raquette, balle, table, filet
Patinage: glace, patins, glisser, piste, artistique
Jeux olympiques: anneaux, médaille, sport, flamme, tous les quatre ans
Arbitre: sifflet, carton, match, faute, règles`,
"Lieux":`Plage: sable, mer, soleil, vacances, serviette
Bibliothèque: livres, emprunter, silence, lire, rayons
Hôpital: malade, médecin, infirmière, urgences, soigner
École: élèves, classe, professeur, cartable, récréation
Cinéma: film, écran, pop-corn, salle, séance
Musée: tableaux, exposition, art, visiter, Louvre
Aéroport: avion, décoller, valise, vol, terminal
Gare: train, quai, billet, SNCF, voie
Supermarché: courses, caddie, caisse, rayons, magasin
Boulangerie: pain, croissant, baguette, boulanger, gâteaux
Piscine: nager, eau, maillot, plonger, bassin
Zoo: animaux, cages, visiter, lion, soigneur
Prison: barreaux, cellule, détenu, évasion, gardien
Église: messe, prier, cloches, curé, croix
Tour Eiffel: Paris, monument, fer, haute, France
Château: roi, princesse, tours, donjon, fort
Désert: sable, chaud, chameau, Sahara, soif
Montagne: sommet, neige, ski, grimper, haute
Restaurant: manger, serveur, menu, table, addition
Cirque: clown, chapiteau, acrobate, jongleur, dompteur
Parc d’attractions: manèges, montagnes russes, Disney, file d’attente, sensations
Mairie: maire, mariage, ville, élus, papiers
Île: eau, entourée, mer, bateau, Robinson
Camping: tente, vacances, caravane, nature, sac de couchage`,
"Objets":`Parapluie: pluie, ouvrir, mouillé, protéger, baleines
Ciseaux: couper, lames, papier, coiffeur, pointu
Lunettes: yeux, voir, verres, myope, soleil
Montre: heure, poignet, aiguilles, temps, bracelet
Clé: porte, serrure, ouvrir, fermer, trousseau
Téléphone: appeler, portable, sonner, allô, numéro
Bougie: flamme, cire, allumer, anniversaire, mèche
Valise: voyage, bagages, roulettes, vacances, aéroport
Miroir: reflet, se regarder, glace, verre, salle de bains
Brosse à dents: dentifrice, dents, matin, soir, poils
Marteau: clou, taper, outil, bricolage, enfoncer
Ballon: gonfler, rond, jouer, football, air
Lampe: lumière, ampoule, allumer, éclairer, chevet
Stylo: écrire, encre, bille, papier, Bic
Ordinateur: clavier, souris, écran, internet, portable
Appareil photo: photo, objectif, flash, clic, souvenir
Casque: tête, protéger, moto, vélo, musique
Cartable: école, sac, dos, livres, élève
Échelle: monter, barreaux, grimper, haut, échelons
Couteau: couper, lame, cuisine, fourchette, tranchant
Tirelire: cochon, argent, pièces, économiser, casser
Boussole: nord, aiguille, orientation, direction, perdu
Parachute: sauter, avion, ciel, tomber, ouvrir
Réveil: sonner, matin, heure, lever, dormir`,
"Expressions":`Poser un lapin: rendez-vous, attendre, venir, oublier, animal
Avoir le cafard: triste, déprimé, insecte, moral, blues
Coûter les yeux de la tête: cher, prix, argent, payer, très
Tomber dans les pommes: évanouir, malaise, fruit, perdre connaissance, chute
Avoir un poil dans la main: paresseux, travailler, flemme, fainéant, rien faire
Mettre les pieds dans le plat: gaffe, maladresse, dire, assiette, erreur
Il pleut des cordes: pluie, beaucoup, mouillé, averse, temps
Être dans la lune: rêver, distrait, ailleurs, rêveur, ciel
Casser les pieds: embêter, ennuyer, agacer, pénible, énerver
Avoir la pêche: forme, énergie, fruit, moral, joyeux
Donner sa langue au chat: deviner, abandonner, réponse, devinette, savoir
Avoir le cœur sur la main: généreux, gentil, donner, bon, partager
Raconter des salades: mentir, mensonges, histoires, légumes, inventer
Se lever du pied gauche: mauvaise humeur, matin, droit, grognon, journée
Avoir une mémoire de poisson rouge: oublier, se souvenir, bocal, trois secondes, tête en l’air
Appeler un chat un chat: franc, direct, dire, vérité, animal
Faire la grasse matinée: dormir, tard, lit, dimanche, se lever
Chercher une aiguille dans une botte de foin: impossible, trouver, difficile, paille, introuvable
Avoir la chair de poule: frissons, peur, froid, peau, oiseau
Il y a anguille sous roche: louche, cacher, secret, suspect, poisson
Prendre la mouche: vexé, énerver, susceptible, insecte, colère
Être une poule mouillée: peureux, lâche, peur, courage, trouillard
Mettre son grain de sel: donner son avis, intervenir, se mêler, conversation, cuisine
Avoir un chat dans la gorge: voix, tousser, enroué, rauque, animal`,
"Fêtes":`Noël: sapin, cadeaux, Père Noël, décembre, réveillon
Anniversaire: gâteau, bougies, âge, cadeaux, souffler
Pâques: œufs, chocolat, cloches, lapin, printemps
Halloween: citrouille, bonbons, déguisement, sorcière, peur
Mariage: mariés, robe blanche, alliance, épouser, mairie
Carnaval: déguisement, masque, défilé, Rio, confettis
Nouvel An: minuit, 31 décembre, champagne, bonne année, résolutions
Feu d’artifice: 14 Juillet, ciel, explosions, couleurs, fusées
Saint-Valentin: amoureux, cœur, roses, février, amour
Fête des mères: maman, cadeau, mai, collier, dimanche
Galette des rois: fève, couronne, frangipane, janvier, roi
Poisson d’avril: blague, 1er avril, dos, farce, papier
14 Juillet: fête nationale, défilé, feu d’artifice, Bastille, bal
Chandeleur: crêpes, février, poêle, sauter, pièce
Fête de la musique: 21 juin, concert, rue, été, chanter
Pique-nique: nappe, herbe, panier, sandwich, dehors
Barbecue: grillades, saucisses, charbon, été, jardin
Karaoké: chanter, micro, paroles, écran, fausse note
Déguisement: costume, masque, carnaval, Halloween, personnage
Confettis: papier, couleurs, lancer, fête, petits
Sapin de Noël: guirlandes, boules, épines, décorer, étoile
Lune de miel: voyage, mariés, amoureux, après, noces`,
"Nature":`Arc-en-ciel: couleurs, pluie, soleil, ciel, sept
Volcan: lave, éruption, montagne, cratère, feu
Orage: éclair, tonnerre, pluie, nuages, foudre
Neige: blanc, flocons, hiver, froid, bonhomme
Forêt: arbres, bois, champignons, se promener, feuilles
Cascade: eau, chute, rivière, tomber, falaise
Soleil: chaud, étoile, lumière, jaune, ciel
Lune: nuit, croissant, pleine, astronaute, ciel
Étoile filante: vœu, ciel, nuit, tomber, souhait
Arbre: tronc, branches, feuilles, racines, forêt
Rose: fleur, épines, rouge, parfum, bouquet
Tournesol: jaune, fleur, soleil, graines, huile
Champignon: forêt, cueillir, vénéneux, chapeau, automne
Vague: mer, surf, écume, plage, rouleau
Tempête: vent, orage, pluie, violente, souffler
Glacier: glace, montagne, fondre, froid, neige
Automne: feuilles, saison, tomber, septembre, marron
Printemps: saison, fleurs, mars, beau temps, bourgeons
Coquillage: plage, mer, ramasser, oreille, nacre
Brouillard: brume, voir, gris, épais, matin
Tremblement de terre: séisme, secousse, sol, Richter, catastrophe
Grotte: caverne, sombre, roche, chauve-souris, stalactite
Coucher de soleil: soir, orange, horizon, ciel, romantique`,
"Transports":`Avion: voler, ailes, pilote, aéroport, ciel
Train: rails, gare, wagon, locomotive, TGV
Bateau: mer, naviguer, voile, port, capitaine
Métro: souterrain, Paris, ligne, station, ticket
Hélicoptère: hélices, voler, pales, décoller, ciel
Fusée: espace, décoller, lune, astronaute, lancement
Trottinette: roues, guidon, pousser, électrique, pied
Montgolfière: ballon, ciel, panier, air chaud, voler
Sous-marin: sous l’eau, plonger, périscope, jaune, mer
Ambulance: hôpital, sirène, blessé, urgence, brancard
Tracteur: ferme, champs, agriculteur, roues, labourer
Taxi: voiture, chauffeur, payer, compteur, New York
Moto: deux roues, casque, motard, vitesse, guidon
Camping-car: vacances, maison, roulante, camping, route
Téléphérique: cabine, câble, montagne, monter, ski
Skateboard: planche, roulettes, figures, rampe, glisser
Bus: arrêt, passagers, chauffeur, ticket, ligne`,
"Loisirs":`Guitare: cordes, instrument, musique, jouer, électrique
Piano: touches, noires, blanches, instrument, clavier
Échecs: roi, reine, plateau, pion, mat
Puzzle: pièces, assembler, image, emboîter, carton
Jeu de cartes: as, roi, belote, mélanger, poker
Peinture: pinceau, couleurs, tableau, toile, artiste
Roman: livre, histoire, pages, auteur, lire
Bande dessinée: bulles, dessins, Tintin, Astérix, cases
Jeu vidéo: console, manette, écran, jouer, niveau
Selfie: photo, téléphone, soi-même, Instagram, bras
Pêche: poisson, canne, hameçon, ver, rivière
Tricot: laine, aiguilles, pull, écharpe, mamie
Cerf-volant: vent, ficelle, voler, plage, ciel
Cache-cache: cacher, compter, chercher, trouver, enfants
Marionnette: fils, Guignol, spectacle, enfants, poupée
Théâtre: scène, acteurs, rideau, pièce, spectacle
Opéra: chanter, soprano, aigu, scène, Carmen
Batterie: tambour, baguettes, rythme, cymbales, pile
Dominos: points, aligner, tomber, plaquettes, jeu
Sudoku: chiffres, grille, neuf, cases, logique
Mots croisés: grille, cases, définitions, journal, horizontal
Château de sable: plage, seau, pelle, construire, marée
Bonhomme de neige: carotte, nez, hiver, boules, froid`,
"Corps & santé":`Éternuer: atchoum, nez, rhume, à tes souhaits, allergie
Hoquet: hic, respiration, peur, boire, gorge
Cheveux: tête, coiffeur, brosse, longs, blonds
Genou: jambe, articulation, plier, rotule, tomber
Dent de lait: enfant, tomber, petite souris, pièce, bouche
Rhume: nez, mouchoir, malade, éternuer, hiver
Bâiller: fatigué, bouche, sommeil, ennui, ouvrir
Pansement: blessure, coller, plaie, sparadrap, bobo
Cœur: battre, amour, rouge, sang, organe
Moustache: poils, lèvre, visage, barbe, homme
Nombril: ventre, trou, cordon, bébé, milieu
Squelette: os, Halloween, crâne, mort, corps
Chatouilles: rire, pieds, guili-guili, toucher, sensible
Rêve: dormir, nuit, cauchemar, sommeil, imaginer`
};
const CARDS = [];
Object.keys(RAW).forEach(cat => {
  RAW[cat].split("\n").forEach(line => {
    line = line.trim(); if (!line) return;
    const i = line.indexOf(":");
    CARDS.push({cat, w: line.slice(0, i).trim(), f: line.slice(i + 1).split(",").map(s => s.trim()).filter(Boolean)});
  });
});

/* ================= SON (WebAudio, après un geste) ================= */
function makeSound() {
  let ctx = null, master = null;
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = .85; master.connect(comp); comp.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, o) {
    if (!ctx || ctx.state !== "running") return;
    o = o || {};
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.vol == null ? .3 : o.vol, t + (o.att || .008));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .05);
  }
  return {
    unlock: ensure,
    found() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, .22, {type: "triangle", vol: .32, at: i * .07})); },
    pass() { tone(520, .28, {to: 200, vol: .28}); tone(260, .2, {type: "triangle", to: 130, vol: .15, at: .05}); },
    tick(hi) { tone(hi ? 1500 : 1050, .04, {type: "square", vol: hi ? .2 : .13, att: .002}); },
    gong() { [[1, .5, 2.6], [2.01, .25, 2.2], [2.76, .2, 1.8], [4.07, .1, 1.3]].forEach(([r, v, d]) => tone(98 * r, d, {vol: v, att: .01})); },
    fanfare() { [[392, 0], [523.25, .12], [659.25, .24], [783.99, .36], [659.25, .52], [783.99, .62]].forEach(([f, a], i) => tone(f, i === 5 ? .55 : .14, {type: "square", vol: .12, at: a})); },
    buzz() {
      if (!ctx || ctx.state !== "running") return;
      const t = ctx.currentTime, d = .85;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.75, t + .015);
      g.gain.setValueAtTime(.75, t + d - .12); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      const am = ctx.createGain(); am.gain.value = .65;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 32; lfoG.gain.value = .35;
      lfo.connect(lfoG); lfoG.connect(am.gain);
      [[98, "sawtooth"], [103.5, "sawtooth"], [49, "square"], [147, "square"]].forEach(([f, ty]) => {
        const o = ctx.createOscillator(); o.type = ty; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * .94, t + d);
        o.connect(am); o.start(t); o.stop(t + d + .05);
      });
      am.connect(lp); lp.connect(g); g.connect(master); lfo.start(t); lfo.stop(t + d + .05);
    },
    close() { if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; } }
  };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const NO_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="5"/><line x1="9.5" y1="9.5" x2="30.5" y2="30.5" stroke="currentColor" stroke-width="5"/></svg>';
const elide = name => /^[aeiouyhàâéèêëîïôöûüœ]/i.test(name) ? "d’" : "de ";
const pts = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n) + " pt" + (Math.abs(n) > 1 ? "s" : "");

const CSS = `
.mi{--wood-0:#24150b;--wood-1:#3a2213;--wood-2:#57331b;--cream:#f7e9cc;--paper:#fff7e6;--paper-2:#f3e2bf;--ink:#2b1a0f;--ink-2:#5b4130;
  --orange:#e8702a;--orange-d:#b44f14;--mustard:#f0b429;--mustard-d:#b98410;--brown:#7a3e17;--red:#d7332a;--red-d:#8f1a12;--green:#5c8f2b;--green-d:#3c6216;--led:#ffcf5a;
  --f-disp:"Anton","Impact","Arial Narrow",sans-serif;--f-ui:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;--f-script:"Pacifico","Brush Script MT",cursive;
  position:relative;min-height:100%;display:flex;flex-direction:column;padding:8px 8px 10px;color:var(--cream);font-family:var(--f-ui);font-size:17px;line-height:1.25;overflow-x:hidden;
  background-color:var(--wood-1);
  background-image:radial-gradient(120% 70% at 50% -10%,rgba(240,180,41,.18),transparent 60%),repeating-linear-gradient(90deg,rgba(0,0,0,.38) 0 3px,transparent 3px 132px),
    repeating-linear-gradient(90deg,rgba(255,220,170,.035) 0 9px,rgba(0,0,0,.05) 9px 17px,rgba(255,220,170,.02) 17px 29px,rgba(0,0,0,.04) 29px 44px),linear-gradient(180deg,var(--wood-2),var(--wood-1) 55%,var(--wood-0));
  -webkit-tap-highlight-color:transparent}
.mi *,.mi *::before,.mi *::after{box-sizing:border-box}
.mi button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}
.mi-tv{flex:1;display:flex;flex-direction:column;width:100%;max-width:560px;margin:0 auto;border-radius:26px;padding:9px 9px 0;position:relative;
  background:linear-gradient(160deg,#8a5428,#5f3618 45%,#4a2810);box-shadow:0 0 0 3px var(--ink),0 10px 0 3px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,220,170,.25)}
.mi-screen{flex:1;position:relative;border-radius:20px/22px;overflow:hidden;color:var(--ink);padding:12px 12px 14px;display:flex;flex-direction:column;
  background:radial-gradient(130% 110% at 50% 40%,#fbf0d8 0%,#f3e0b8 62%,#d9bd8b 100%);box-shadow:inset 0 0 0 4px var(--ink),inset 0 0 50px rgba(80,40,10,.45),0 0 0 5px #2a170b}
.mi-screen::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:30;border-radius:inherit;
  background:repeating-linear-gradient(0deg,rgba(43,26,15,.05) 0 1px,transparent 1px 3px),radial-gradient(120% 90% at 30% 15%,rgba(255,255,255,.26),transparent 45%)}
.mi-flash{position:absolute;inset:0;z-index:29;background:rgba(215,51,42,.55);pointer-events:none;animation:mi-flash .7s ease-out forwards}
@keyframes mi-flash{from{opacity:1}to{opacity:0}}
.mi-tv.mi-shake{animation:mi-shake .5s cubic-bezier(.36,.07,.19,.97)}
@keyframes mi-shake{10%,90%{transform:translateX(-3px) rotate(-.5deg)}20%,80%{transform:translateX(6px) rotate(1deg)}30%,50%,70%{transform:translateX(-11px) rotate(-1.5deg)}40%,60%{transform:translateX(11px) rotate(1.5deg)}}
.mi-foot{display:flex;align-items:center;gap:10px;padding:7px 8px 9px}
.mi-grille{flex:1;height:16px;border-radius:7px;background:repeating-linear-gradient(90deg,#2a170b 0 3px,#6a3d1c 3px 7px);box-shadow:inset 0 2px 4px rgba(0,0,0,.6)}
.mi-brand{font-family:var(--f-script);color:var(--paper-2);font-size:.9rem;text-shadow:1px 1px 0 var(--ink);white-space:nowrap}
.mi-onair{font-family:var(--f-ui);font-weight:800;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:#3b0f0b;color:#7a3a33;border:2px solid var(--ink)}
.mi-onair.on{background:var(--red);color:#fff3e0;box-shadow:0 0 12px rgba(255,80,60,.8)}
.mi-knob{width:20px;height:20px;border-radius:50%;flex:none;background:radial-gradient(circle at 35% 30%,#f2dcb0,#a07a45 60%,#5a3c1a);box-shadow:0 0 0 2px var(--ink);position:relative}
.mi-knob::after{content:"";position:absolute;left:50%;top:2px;width:3px;height:7px;margin-left:-1.5px;background:var(--ink);border-radius:2px}
.mi-scene{flex:1;display:flex;flex-direction:column;position:relative;z-index:1;animation:mi-in .35s ease-out}
@keyframes mi-in{from{opacity:0;transform:translateY(8px) scale(.99)}}
.mi-kicker{font-family:var(--f-ui);font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:var(--orange-d);font-size:.85rem;margin:0 0 2px;text-align:center}
.mi-title{font-family:var(--f-script);font-weight:400;font-size:1.9rem;line-height:1.15;margin:0 0 8px;color:var(--ink);text-shadow:2px 2px 0 var(--mustard);text-align:center}
/* barre d'état */
.mi-bar{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.mi-timer{position:relative;width:64px;height:64px;flex:none}
.mi-timer svg{width:100%;height:100%;transform:rotate(-90deg)}
.mi-timer .trk{fill:var(--wood-0);stroke:#4a2a14;stroke-width:8}
.mi-timer .bar{fill:none;stroke:var(--mustard);stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset .9s linear,stroke .3s}
.mi-timer .num{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-disp);font-size:1.5rem;color:var(--led);text-shadow:0 0 8px rgba(255,190,60,.7)}
.mi-timer.urgent .bar{stroke:var(--red)}.mi-timer.urgent .num{color:#ff8b7d}
.mi-timer.urgent{animation:mi-pulse 1s ease-in-out infinite}
@keyframes mi-pulse{50%{transform:scale(1.07)}}
.mi-stat{background:var(--paper);border:3px solid var(--ink);border-radius:12px;padding:3px 9px 4px;box-shadow:0 3px 0 rgba(43,26,15,.5);min-width:0;flex:1 1 0}
.mi-stat small{display:block;font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.68rem;color:var(--brown);white-space:nowrap}
.mi-stat b{font-family:var(--f-disp);font-weight:400;font-size:1.35rem;color:var(--ink);line-height:1.1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* carte */
.mi-zone{position:relative;perspective:1200px}
.mi-card{--cc:var(--orange);position:relative;background:var(--paper);border:9px solid var(--cc);border-radius:22px;padding:10px 14px 12px;
  box-shadow:0 0 0 3px var(--ink),inset 0 0 0 3px var(--paper),inset 0 0 0 5px rgba(43,26,15,.18),0 8px 0 3px rgba(43,26,15,.55);backface-visibility:hidden}
.mi-card::after{content:"";position:absolute;inset:0;border-radius:12px;pointer-events:none;background:radial-gradient(rgba(122,62,23,.07) 1px,transparent 1.5px) 0 0/7px 7px}
.mi-card.mi-flip{animation:mi-flipin .42s cubic-bezier(.2,.9,.3,1.25)}
@keyframes mi-flipin{from{transform:rotateY(-90deg) scale(.96)}}
.mi-card.mi-toss{position:absolute;left:0;right:0;top:0;z-index:6;pointer-events:none;animation:mi-toss .6s ease-in forwards}
@keyframes mi-toss{0%{transform:none}30%{transform:translateY(-6px) rotate(-2deg)}100%{transform:translate(120%,30px) rotate(18deg);opacity:0}}
.mi-chead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mi-stampmark{display:inline-flex;align-items:center;gap:6px;color:var(--red);font-family:var(--f-disp);font-size:1.15rem;letter-spacing:.06em;line-height:1;padding:4px 9px 5px;border:3px double var(--red);border-radius:9px;transform:rotate(-4deg);opacity:.92}
.mi-stampmark svg{width:20px;height:20px;flex:none}
.mi-cat{font-weight:800;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;background:var(--cc);color:#fff7e6;padding:3px 10px;border-radius:999px;border:2px solid var(--ink);text-shadow:1px 1px 0 rgba(0,0,0,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mi-make{text-align:center;font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-size:.78rem;color:var(--ink-2);margin:10px 0 0}
.mi-word{text-align:center;font-family:var(--f-disp);font-weight:400;color:var(--ink);font-size:2.6rem;line-height:1.05;margin:2px 0 10px;overflow-wrap:break-word;hyphens:auto;text-transform:uppercase;letter-spacing:.02em;text-shadow:3px 3px 0 rgba(240,180,41,.55)}
.mi-word.long{font-size:2rem}.mi-word.xlong{font-size:1.55rem}
.mi-ribbon{position:relative;margin:0 -23px;background:var(--red);color:#fff7e6;text-align:center;font-weight:800;letter-spacing:.18em;text-transform:uppercase;font-size:.92rem;padding:6px 30px;
  clip-path:polygon(0 0,100% 0,calc(100% - 16px) 50%,100% 100%,0 100%,16px 50%);text-shadow:1px 1px 0 var(--red-d);box-shadow:inset 0 -3px 0 var(--red-d)}
.mi-forbid{list-style:none;margin:6px 0 0;padding:0;display:grid}
.mi-forbid li{display:flex;align-items:center;gap:9px;font-weight:700;font-size:1.35rem;color:var(--ink);padding:3px 2px;border-bottom:2px dashed rgba(43,26,15,.2)}
.mi-forbid li:last-child{border-bottom:0}
.mi-forbid svg{width:20px;height:20px;color:var(--red);flex:none}
.mi-stamp{position:absolute;left:50%;top:46%;z-index:5;font-family:var(--f-disp);font-size:2.6rem;padding:2px 16px;border:6px solid currentColor;border-radius:14px;letter-spacing:.04em;
  transform:translate(-50%,-50%) rotate(-12deg);background:rgba(255,247,230,.88);white-space:nowrap;animation:mi-stampin .2s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes mi-stampin{from{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(2)}}
.mi-stamp.f{color:var(--green-d)}.mi-stamp.p{color:var(--mustard-d)}.mi-stamp.b{color:var(--red)}
/* boutons */
.mi-btn{--bg:var(--orange);--fg:#fff7e6;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border:3px solid var(--ink);border-radius:18px;background:var(--bg);color:var(--fg);
  font-family:var(--f-disp);font-size:1.6rem;letter-spacing:.03em;line-height:1.05;padding:8px 12px;min-height:66px;box-shadow:0 6px 0 var(--ink);transition:transform .07s,box-shadow .07s;text-shadow:1px 1px 0 rgba(0,0,0,.25);text-transform:uppercase}
.mi-btn small{font-family:var(--f-ui);font-weight:800;font-size:.8rem;letter-spacing:.06em;text-shadow:none;opacity:.95}
.mi-btn:active{transform:translateY(4px);box-shadow:0 2px 0 var(--ink)}
.mi-btn:disabled{filter:grayscale(.8);opacity:.5;cursor:not-allowed;transform:none;box-shadow:0 6px 0 var(--ink)}
.mi-btn.green{--bg:var(--green)}.mi-btn.mustard{--bg:var(--mustard);--fg:var(--ink);text-shadow:none}
.mi-btn:focus-visible,.mi-buzz:focus-visible,.mi-pick button:focus-visible{outline:4px solid #ffd34d;outline-offset:3px}
.mi-actions{display:grid;grid-template-columns:1.6fr 1fr;gap:10px;margin-top:16px}
/* qui a trouvé ? */
.mi-sheet{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:16px;border-radius:16px;background:rgba(43,26,15,.94);animation:mi-in .2s ease-out}
.mi-sheet h3{margin:0;text-align:center;font-family:var(--f-script);font-weight:400;font-size:1.8rem;color:var(--cream);text-shadow:2px 2px 0 var(--orange-d)}
.mi-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px}
.mi-pick button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px 8px;border:3px solid var(--ink);border-radius:16px;background:var(--paper);box-shadow:0 5px 0 var(--ink);color:var(--ink);font-weight:800;font-size:1.05rem;min-width:0}
.mi-pick button:active{transform:translateY(3px);box-shadow:0 2px 0 var(--ink)}
.mi-pick .av{width:72px;height:66px}
.mi-pick span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-cancel{align-self:center;background:none;border:0;color:var(--cream);text-decoration:underline;font-weight:800;font-size:1rem;padding:8px}
/* côté devineurs */
.mi-who{display:flex;align-items:center;gap:10px;background:var(--paper);border:3px solid var(--ink);border-radius:18px;padding:4px 12px 4px 4px;box-shadow:0 4px 0 rgba(43,26,15,.5)}
.mi-who .av{width:96px;height:88px;flex:none;margin:-6px -8px -6px -10px}
.mi-who small{display:block;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;color:var(--brown)}
.mi-who b{display:block;font-family:var(--f-disp);font-weight:400;font-size:1.7rem;line-height:1.05;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-who > div{min-width:0}
.mi-judge{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;margin-top:12px;padding:14px 10px 16px;border:3px solid var(--ink);border-radius:22px;text-align:center;color:var(--cream);
  background:var(--wood-0);background-image:repeating-linear-gradient(90deg,rgba(255,220,170,.04) 0 6px,transparent 6px 14px);box-shadow:0 6px 0 rgba(43,26,15,.6),inset 0 2px 0 rgba(255,220,170,.15)}
.mi-judge h3{margin:0;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.85rem;color:var(--mustard)}
.mi-judge p{margin:0;font-size:1rem;color:#e9d6b2;font-weight:600}
.mi-housing{width:min(232px,62vw);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 50% 40%,#d9d1c2,#8d8475 60%,#4c463d);box-shadow:0 0 0 3px var(--ink),0 8px 0 3px rgba(0,0,0,.5),inset 0 -6px 10px rgba(0,0,0,.35)}
.mi-buzz{width:80%;aspect-ratio:1;border-radius:50%;border:3px solid #4a0905;position:relative;padding:0;
  background:radial-gradient(circle at 36% 28%,#ffb3a6 0,#ff5a45 18%,#e0281c 42%,#a3150c 74%,#650a05 100%);
  box-shadow:0 12px 0 #5a0904,0 16px 18px rgba(0,0,0,.45),inset 0 -8px 16px rgba(0,0,0,.35),inset 0 6px 10px rgba(255,255,255,.25);
  transform:translateY(-6px);transition:transform .06s,box-shadow .06s;color:#fff7e6!important;display:grid;place-content:center;font-family:var(--f-disp);font-size:2.5rem;letter-spacing:.03em;text-shadow:0 2px 0 #650a05;line-height:1}
.mi-buzz::before{content:"";position:absolute;left:22%;top:11%;width:38%;height:22%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0));transform:rotate(-20deg);pointer-events:none}
.mi-buzz small{display:block;font-family:var(--f-ui);font-weight:800;font-size:.95rem;letter-spacing:.1em;text-shadow:none;margin-top:4px;text-transform:uppercase}
.mi-buzz:active,.mi-buzz.pressed{transform:translateY(5px);box-shadow:0 1px 0 #5a0904,0 3px 6px rgba(0,0,0,.45),inset 0 -4px 10px rgba(0,0,0,.4),inset 0 6px 10px rgba(255,255,255,.2)}
.mi-buzz:disabled{filter:saturate(.35) brightness(.8);cursor:not-allowed}
.mi-news{min-height:2.2em;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;font-size:1.1rem;color:var(--ink);margin-top:8px}
.mi-news span{display:inline-block;padding:4px 12px;border:3px solid var(--ink);border-radius:12px;background:var(--paper);animation:mi-pop .3s cubic-bezier(.2,.9,.3,1.3)}
.mi-news span.f{background:var(--green);color:#fff7e6}.mi-news span.b{background:var(--red);color:#fff7e6}.mi-news span.p{background:var(--mustard)}
@keyframes mi-pop{from{transform:scale(.4);opacity:0}}
/* plaques de score */
.mi-plates{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px}
.mi-plate{flex:1 1 84px;max-width:150px;min-width:0;border:3px solid var(--ink);border-radius:12px;overflow:hidden;background:var(--wood-0);box-shadow:0 3px 0 rgba(43,26,15,.6)}
.mi-plate .pn{display:flex;align-items:center;gap:3px;background:var(--orange);color:#fff7e6;font-weight:800;padding:0 6px 0 2px;font-size:.9rem;white-space:nowrap;overflow:hidden;text-shadow:1px 1px 0 rgba(0,0,0,.3)}
.mi-plate .pn .av{width:26px;height:24px;flex:none}
.mi-plate .pn span{overflow:hidden;text-overflow:ellipsis}
.mi-plate .pv{font-family:var(--f-disp);color:var(--led);text-align:center;font-size:1.35rem;padding:1px 0 2px;text-shadow:0 0 8px rgba(255,190,60,.7);background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px)}
.mi-plate.on .pn{background:var(--green)}
.mi-plate.gone{opacity:.45}
/* passage de main */
.mi-hand{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px}
.mi-cardback{width:104px;aspect-ratio:3/4;border-radius:16px;border:7px solid var(--orange);position:relative;box-shadow:0 0 0 3px var(--ink),0 8px 0 3px rgba(43,26,15,.55);transform:rotate(-6deg);
  background:repeating-linear-gradient(45deg,var(--mustard) 0 12px,var(--orange) 12px 24px,var(--brown) 24px 36px);display:grid;place-items:center;animation:mi-wob 2.8s ease-in-out infinite}
.mi-cardback span{width:64%;aspect-ratio:1;border-radius:50%;background:var(--paper);border:3px solid var(--ink);display:grid;place-items:center;font-family:var(--f-disp);font-size:2.4rem;color:var(--red)}
@keyframes mi-wob{50%{transform:rotate(-2deg) translateY(-4px)}}
.mi-hand .av{width:150px;height:138px}
.mi-big{font-family:var(--f-script);font-weight:400;font-size:2rem;line-height:1.2;margin:0;color:var(--ink)}
.mi-big em{font-style:normal;color:var(--orange-d);text-shadow:2px 2px 0 var(--mustard)}
.mi-warn{display:inline-block;background:var(--red);color:#fff7e6;padding:6px 12px;border-radius:12px;border:3px solid var(--ink);font-weight:800;letter-spacing:.03em;box-shadow:0 4px 0 var(--ink);transform:rotate(-1deg)}
.mi-line{margin:0;font-weight:700;font-size:1.1rem;color:var(--ink-2)}
.mi-prog{height:10px;border-radius:6px;background:var(--wood-0);border:2px solid var(--ink);overflow:hidden;margin-top:10px;width:100%}
.mi-prog i{display:block;height:100%;background:var(--mustard);transform-origin:left;animation:mi-prog linear forwards}
@keyframes mi-prog{from{transform:scaleX(1)}to{transform:scaleX(0)}}
/* récap */
.mi-rhead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.mi-rhead .mi-title{text-align:left;margin:0;font-size:1.6rem}
.mi-rhead .mi-kicker{text-align:left}
.mi-bigpts{font-family:var(--f-disp);font-size:2.6rem;color:var(--orange-d);line-height:1;text-shadow:3px 3px 0 var(--mustard);text-align:right}
.mi-bigpts small{display:block;font-family:var(--f-ui);font-weight:800;font-size:.75rem;color:var(--ink-2);text-shadow:none;letter-spacing:.06em;text-transform:uppercase}
.mi-rlist{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:5px}
.mi-rlist li{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--paper);border:3px solid var(--ink);border-left:9px solid var(--cc,var(--orange));border-radius:12px;padding:4px 6px 4px 9px;min-width:0;animation:mi-in .3s ease-out both}
.mi-rlist .w{font-weight:800;font-size:1.08rem;color:var(--ink);min-width:0;overflow-wrap:anywhere}
.mi-st{flex:none;border:2px solid var(--ink);border-radius:999px;padding:2px 9px;font-weight:800;font-size:.85rem;max-width:58%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mi-st.f{background:var(--green);color:#fff7e6}.mi-st.p{background:var(--mustard);color:var(--ink)}.mi-st.b{background:var(--red);color:#fff7e6}.mi-st.t{background:#cbb894;color:var(--ink)}
.mi-empty{margin:10px 0 0;font-weight:800;color:var(--ink-2);text-align:center}
.mi-next{margin:10px 0 0;text-align:center;font-weight:800;font-size:1.05rem;color:var(--ink)}
/* final */
.mi-podium{display:grid;gap:6px;margin-top:6px}
.mi-hero{display:flex;justify-content:center;margin:-4px 0 -6px}.mi-hero .av{width:170px;max-width:32%;height:auto;animation:mi-pop .5s cubic-bezier(.2,.9,.3,1.3)}
.mi-rank{display:flex;align-items:center;gap:8px;background:var(--paper);border:3px solid var(--ink);border-radius:14px;padding:2px 12px 2px 6px;box-shadow:0 3px 0 rgba(43,26,15,.5);animation:mi-in .4s ease-out both}
.mi-rank .n{font-family:var(--f-disp);font-size:1.5rem;width:1.4em;text-align:center;color:var(--brown)}
.mi-rank .av{width:64px;height:58px;flex:none}
.mi-rank b{flex:1;min-width:0;font-size:1.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-rank .s{font-family:var(--f-disp);font-size:1.6rem;color:var(--orange-d)}
.mi-rank.top{background:var(--mustard);transform-origin:left}
.mi-rank.top .n{color:var(--ink)}
.mi-rank.gone{opacity:.55}
.mi-spec{margin:8px 0 0;text-align:center;font-weight:700;color:var(--ink-2)}
@media (max-height:700px){.mi-forbid li{font-size:1.15rem;padding:1px 2px}.mi-word{font-size:2.1rem;margin-bottom:6px}.mi-housing{width:min(190px,52vw)}.mi-hand .av{width:110px;height:100px}}
@media (prefers-reduced-motion:reduce){.mi *,.mi *::before,.mi *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;

GONFLETTE.registerGame({
  id: "motinterdit",
  name: "Le Mot Interdit",
  min: 2,
  max: 8,
  create(api) {
    const el = api.el;
    const P = api.players, N = P.length;
    const mySeat = P.findIndex(p => p.key === api.me);       // -1 si spectateur
    const TURN = 50, HAND = 3.2, RECAP = 7, FINAL = 3.6, MAXPASS = 2, ROUNDS = 2;
    const FINDER_SCORES = N >= 3;                            // à 2, le devineur est toujours le même : seul l'explicateur marque
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const snd = makeSound();
    let dead = false;

    el.innerHTML = `<style>${CSS}</style><div class="mi"><div class="mi-tv" id="mi-tv"><div class="mi-screen" id="mi-screen"></div>
      <div class="mi-foot" aria-hidden="true"><span class="mi-knob"></span><span class="mi-onair" id="mi-onair">À l’antenne</span><div class="mi-grille"></div><span class="mi-brand">Télé-Mots 1974</span></div></div></div>`;
    const tv = el.querySelector("#mi-tv"), screen = el.querySelector("#mi-screen"), onair = el.querySelector("#mi-onair");
    const onGesture = () => snd.unlock();
    el.addEventListener("pointerdown", onGesture, {passive: true});

    /* ================= HÔTE ================= */
    const spd = () => Math.max(1, Math.min(200, +window.__miSpeed || 1));
    let H = null, hostInt = null;
    if (api.isHost) {
      const order = [];
      for (let r = 0; r < ROUNDS; r++) for (let i = 0; i < N; i++) order.push(i);
      let deck = [], pos = 0;
      const draw = () => {
        if (pos >= deck.length) { deck = CARDS.map((_, i) => i); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } pos = 0; }
        return deck[pos++];
      };
      H = {ph: "hand", ti: -1, ex: -1, ci: -1, cn: 0, fd: 0, ps: 0, h: [], sc: P.map(() => 0), fo: P.map(() => 0), ev: {n: 0}, nx: -1, rk: null, t: 0, left: TURN, gone: []};
      const seen = {};
      let lastInputs = {};
      // un joueur est « parti » s'il est absent de la salle depuis plus de 3 s (évite les faux départs au chargement)
      const seenAt = P.map(() => Date.now());
      const here = () => { const c = new Set(api.connected()), now = Date.now(); return P.map((p, i) => { if (c.has(p.key)) seenAt[i] = now; return now - seenAt[i] < 3000; }); };
      const nextTurn = from => { const h = here(); let t = from; while (t < order.length && !h[order[t]]) t++; return t; };
      const pub = () => {
        const s = {ph: H.ph, ti: H.ti, tt: order.length, r: H.ti >= 0 ? Math.floor(H.ti / N) + 1 : 1, ex: H.ex, sc: H.sc, ev: H.ev, g: H.gone};
        if (H.ph === "play") Object.assign(s, {left: Math.max(0, Math.ceil(H.left)), ci: H.ci, cn: H.cn, fd: H.fd, ps: H.ps});
        if (H.ph === "recap") Object.assign(s, {h: H.h, nx: H.nx});
        if (H.ph === "final") s.rk = H.rk;
        api.setState(s);
      };
      const goHand = ti => {
        if (ti >= order.length) return goFinal();
        H.ph = "hand"; H.ti = ti; H.ex = order[ti]; H.t = HAND; pub();
      };
      const goPlay = () => {
        H.ph = "play"; H.t = TURN; H.left = TURN; H.fd = 0; H.ps = 0; H.h = []; H.ci = draw(); H.cn++; pub();
      };
      const endTurn = timeout => {
        if (timeout && H.ci >= 0) H.h.push([H.ci, "t"]);
        H.ph = "recap"; H.t = RECAP;
        const nt = nextTurn(H.ti + 1);
        H.nx = nt < order.length ? order[nt] : -1;
        H.ev = {n: H.ev.n + 1, t: "end"};
        pub();
      };
      const goFinal = () => {
        H.ph = "final"; H.t = FINAL;
        const idx = P.map((_, i) => i).sort((a, b) => (H.sc[b] - H.sc[a]) || (H.fo[b] - H.fo[a]) || (a - b));
        H.rk = idx; pub();
      };
      const finishGame = () => {
        H.ph = "done";
        const best = H.sc[H.rk[0]];
        const top = H.rk.filter(i => H.sc[i] === best);
        const winners = top.length === N ? [] : top.map(i => P[i].key);   // tout le monde à égalité : match nul
        const totalFound = H.fo.reduce((a, b) => a + b, 0);
        const w = winners.length === 1 ? `${P[H.rk[0]].pseudo} remporte l’émission avec ${best} point${Math.abs(best) > 1 ? "s" : ""}`
          : winners.length > 1 ? `Égalité au sommet à ${best} point${Math.abs(best) > 1 ? "s" : ""}` : `Tout le monde à égalité (${best} point${Math.abs(best) > 1 ? "s" : ""})`;
        api.finish({winners, ranking: H.rk.map(i => P[i].key), summary: `${w} · ${totalFound} carte${totalFound > 1 ? "s" : ""} trouvée${totalFound > 1 ? "s" : ""} en tout.`});
      };
      const nextCard = () => { H.ci = draw(); H.cn++; };
      const apply = () => {
        for (const k in lastInputs) {
          const inp = lastInputs[k];
          if (!inp || inp.seq == null || inp.seq === seen[k]) continue;
          seen[k] = inp.seq;
          if (H.ph !== "play" || inp.c !== H.cn) continue;
          const seat = P.findIndex(p => p.key === k);
          if (seat < 0) continue;
          const exKey = P[H.ex].key;
          if (inp.a === "found" && k === exKey) {
            let who = P.findIndex(p => p.key === inp.who);
            if (who === H.ex || who < 0) { if (N === 2) who = 1 - H.ex; else who = -1; }
            H.sc[H.ex] += 1; H.fd += 1; H.fo[H.ex] += 1;
            if (who >= 0 && FINDER_SCORES) H.sc[who] += 1;
            H.h.push(who >= 0 ? [H.ci, "f", who] : [H.ci, "f"]);
            H.ev = {n: H.ev.n + 1, t: "f", by: who, cn: H.cn};
            nextCard(); pub();
          } else if (inp.a === "pass" && k === exKey && H.ps < MAXPASS) {
            H.ps += 1; H.h.push([H.ci, "p"]);
            H.ev = {n: H.ev.n + 1, t: "p", cn: H.cn};
            nextCard(); pub();
          } else if (inp.a === "buzz" && k !== exKey) {
            H.sc[H.ex] -= 1; H.h.push([H.ci, "b", seat]);
            H.ev = {n: H.ev.n + 1, t: "b", by: seat, cn: H.cn};
            nextCard(); pub();
          }
          if (H.h.length > 40) H.h.shift();
        }
      };
      api.onInputs(map => { lastInputs = map; apply(); });
      let last = Date.now();
      hostInt = setInterval(() => {
        if (dead) return;
        const now = Date.now(), dt = (now - last) / 1000 * spd(); last = now;
        // départs
        const h = here(), gone = P.map((_, i) => i).filter(i => !h[i]);
        if (gone.join() !== H.gone.join()) { H.gone = gone; if (H.ph !== "done") pub(); }
        if (H.ph === "done") return;
        H.t -= dt;
        if (H.ph === "hand") {
          if (!h[H.ex]) { goHand(nextTurn(H.ti + 1)); return; }
          if (H.t <= 0) goPlay();
        } else if (H.ph === "play") {
          if (!h[H.ex]) { endTurn(false); return; }
          const before = Math.ceil(H.left);
          H.left -= dt;
          if (H.left <= 0) endTurn(true);
          else if (Math.ceil(H.left) !== before) pub();
        } else if (H.ph === "recap") {
          if (H.t <= 0) goHand(nextTurn(H.ti + 1));
        } else if (H.ph === "final") {
          if (H.t <= 0) finishGame();
        }
      }, 100);
      later(() => goHand(nextTurn(0)), 400);
      H.ph = "init";
    }

    /* ================= AFFICHAGE ================= */
    let S = null, sceneKey = "", mySeq = 0, pend = -1, pendT = null, lastEvN = null, lastLeft = null, picking = false, lastCardCn = -1;
    const isEx = s => mySeat >= 0 && s.ex === mySeat;
    const gone = (s, i) => (s.g || []).includes(i);
    const send = obj => { api.setInput(Object.assign({seq: ++mySeq}, obj)); };
    const plates = (s, on) => `<div class="mi-plates">${P.map((p, i) => `<div class="mi-plate${i === on ? " on" : ""}${gone(s, i) ? " gone" : ""}"><div class="pn">${api.avatar(p.key)}<span>${esc(p.pseudo)}</span></div><div class="pv" data-i="${i}">${s.sc[i]}</div></div>`).join("")}</div>`;
    const timerHTML = `<div class="mi-timer" id="mi-timer" role="timer" aria-label="Temps restant"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="trk" cx="40" cy="40" r="34"/><circle class="bar" id="mi-tbar" cx="40" cy="40" r="34" stroke-dasharray="213.6" stroke-dashoffset="0"/></svg><div class="num" id="mi-tnum">50</div></div>`;
    const $ = sel => screen.querySelector(sel);
    const roundLabel = s => `Manche ${s.r}/${ROUNDS} · Tour ${s.ti + 1}/${s.tt}`;

    function cardHTML(ci, extra) {
      const c = CARDS[ci];
      if (!c) return "";
      const len = c.w.length;
      return `<article class="mi-card ${extra || ""}" style="--cc:${CAT_COLORS[c.cat] || "#e8702a"}">
        <div class="mi-chead"><span class="mi-stampmark">${NO_SVG}INTERDIT</span><span class="mi-cat">${esc(c.cat)}</span></div>
        <p class="mi-make">Faites deviner</p>
        <p class="mi-word${len > 22 ? " xlong" : len > 12 ? " long" : ""}">${esc(c.w)}</p>
        <div class="mi-ribbon">Mots interdits</div>
        <ul class="mi-forbid">${c.f.map(f => `<li>${NO_SVG}<span>${esc(f)}</span></li>`).join("")}</ul>
      </article>`;
    }

    function build(s) {
      const me = isEx(s);
      picking = false;
      if (s.ph === "hand") {
        const ex = P[s.ex];
        screen.innerHTML = `<section class="mi-scene"><p class="mi-kicker">${roundLabel(s)}</p><div class="mi-hand">
          <div class="mi-cardback" aria-hidden="true"><span>?</span></div>
          ${api.avatar(ex.key, {pose: "flex"})}
          ${me ? `<h2 class="mi-big">À vous <em>d’expliquer</em> !</h2><p class="mi-warn">Cachez votre écran aux autres</p><p class="mi-line">Ne dites ni le mot, ni les 5 mots interdits.</p>`
               : `<h2 class="mi-big">Au tour ${elide(ex.pseudo)}<em>${esc(ex.pseudo)}</em> d’expliquer</h2><p class="mi-line">${mySeat >= 0 ? "Devinez à voix haute, et gare aux mots interdits : buzzez !" : "Vous regardez l’émission."}</p>`}
        </div><div class="mi-prog"><i style="animation-duration:${(HAND / spdView()).toFixed(2)}s"></i></div>${plates(s, s.ex)}</section>`;
      } else if (s.ph === "play") {
        const ex = P[s.ex];
        if (me) {
          screen.innerHTML = `<section class="mi-scene"><div class="mi-bar">${timerHTML}
              <div class="mi-stat"><small>Trouvées</small><b id="mi-fd">0</b></div>
              <div class="mi-stat"><small>Passes</small><b id="mi-ps">${MAXPASS}</b></div></div>
            <div class="mi-zone" id="mi-zone"></div>
            <div class="mi-actions"><button class="mi-btn green" id="mi-found" type="button">Trouvé !<small>${FINDER_SCORES ? "+1 pour vous et le trouveur" : "+1 point"}</small></button>
              <button class="mi-btn mustard" id="mi-pass" type="button">Passer<small id="mi-psub">0 point</small></button></div>
            <div class="mi-news" id="mi-news" aria-live="polite"></div></section>`;
          $("#mi-found").addEventListener("click", onFound);
          $("#mi-pass").addEventListener("click", onPass);
          lastCardCn = -1;
        } else {
          const canBuzz = mySeat >= 0;
          screen.innerHTML = `<section class="mi-scene"><div class="mi-bar">${timerHTML}
              <div class="mi-stat"><small>${esc(roundLabel(s).split(" · ")[0])}</small><b>Tour ${s.ti + 1}/${s.tt}</b></div>
              <div class="mi-stat"><small>Trouvées</small><b id="mi-fd">0</b></div></div>
            <div class="mi-who">${api.avatar(ex.key, {pose: "flex"})}<div><small>Explique</small><b>${esc(ex.pseudo)}</b></div></div>
            <div class="mi-news" id="mi-news" aria-live="polite"></div>
            <div class="mi-judge">${canBuzz ? `<h3>Côté juge</h3>
              <div class="mi-housing"><button class="mi-buzz" id="mi-buzz" type="button" aria-label="BZZZ ! Mot interdit prononcé">BZZZ !<small>Mot interdit</small></button></div>
              <p>${esc(ex.pseudo)} a dit un mot interdit ? Buzzez !<br>−1 pour ${esc(ex.pseudo)}, carte suivante.</p>`
              : `<h3>En coulisses</h3><p>Vous regardez l’émission en spectateur.</p>`}</div>
            ${plates(s, s.ex)}</section>`;
          const b = $("#mi-buzz");
          if (b) b.addEventListener("click", onBuzz);
        }
      } else if (s.ph === "recap") {
        const ex = P[s.ex], h = s.h || [];
        const turnPts = h.reduce((a, e) => a + (e[1] === "f" ? 1 : e[1] === "b" ? -1 : 0), 0);
        const lab = e => e[1] === "f" ? "Trouvé" + (e[2] != null && P[e[2]] ? " · " + P[e[2]].pseudo : "") : e[1] === "p" ? "Passé" : e[1] === "b" ? "BZZZ" + (P[e[2]] ? " · " + P[e[2]].pseudo : "") : "Temps écoulé";
        const nx = s.nx >= 0 ? P[s.nx] : null;
        screen.innerHTML = `<section class="mi-scene"><div class="mi-rhead"><div><p class="mi-kicker">Gong ! Fin du tour</p><h2 class="mi-title">Récapitulatif</h2></div>
            <div class="mi-bigpts">${turnPts > 0 ? "+" : turnPts < 0 ? "−" : ""}${Math.abs(turnPts)}<small>pour ${esc(ex.pseudo)}</small></div></div>
          ${h.length ? `<ul class="mi-rlist">${h.map((e, i) => { const c = CARDS[e[0]]; return `<li style="--cc:${CAT_COLORS[c.cat]};animation-delay:${Math.min(i, 12) * 0.05}s"><span class="w">${esc(c.w)}</span><span class="mi-st ${e[1]}">${esc(lab(e))}</span></li>`; }).join("")}</ul>`
                     : `<p class="mi-empty">Aucune carte jouée ce tour.</p>`}
          ${plates(s, -1)}
          <p class="mi-next">${nx ? `Ensuite : ${esc(nx.pseudo)} explique` : "Fin de l’émission : place au classement !"}</p>
          <div class="mi-prog"><i style="animation-duration:${(RECAP / spdView()).toFixed(2)}s"></i></div></section>`;
      } else if (s.ph === "final") {
        const rk = s.rk || [], best = s.sc[rk[0]];
        let winners = rk.filter(i => s.sc[i] === best);
        if (winners.length === N) winners = [];
        screen.innerHTML = `<section class="mi-scene"><p class="mi-kicker">Fin de l’émission</p><h2 class="mi-title">Le tableau d’honneur</h2>
          ${winners.length ? `<div class="mi-hero">${winners.map(i => api.avatar(P[i].key, {pose: "flex"})).join("")}</div>` : ""}
          <p class="mi-line" style="text-align:center">${winners.length === 1 ? `Bravo <b>${esc(P[winners[0]].pseudo)}</b> !` : winners.length ? "Égalité au sommet !" : "Égalité parfaite : match nul !"}</p>
          <div class="mi-podium">${rk.map((i, n) => `<div class="mi-rank${winners.includes(i) ? " top" : ""}${gone(s, i) ? " gone" : ""}" style="animation-delay:${n * 0.12}s"><span class="n">${n + 1}</span>${api.avatar(P[i].key, {pose: winners.includes(i) ? "flex" : "idle"})}<b>${esc(P[i].pseudo)}</b><span class="s">${s.sc[i]}</span></div>`).join("")}</div>
          ${mySeat < 0 ? `<p class="mi-spec">Merci d’avoir regardé !</p>` : ""}</section>`;
      }
    }
    // la durée des barres de progression suit l'accélération de test (lue localement, 1 en vrai)
    const spdView = () => Math.max(1, Math.min(200, +window.__miSpeed || 1));

    function update(s) {
      screen.querySelectorAll(".mi-plate .pv").forEach(v => { const n = String(s.sc[+v.dataset.i]); if (v.textContent !== n) v.textContent = n; });
      if (s.ph === "play") {
        const left = s.left, t = $("#mi-timer");
        if (t) {
          $("#mi-tnum").textContent = left;
          $("#mi-tbar").setAttribute("stroke-dashoffset", (213.6 * (1 - left / TURN)).toFixed(1));
          t.classList.toggle("urgent", left <= 10);
        }
        if (lastLeft !== null && left !== lastLeft && left <= 5 && left > 0) snd.tick(left <= 3);
        lastLeft = left;
        const fd = $("#mi-fd"); if (fd) fd.textContent = s.fd;
        if (isEx(s)) {
          const remain = MAXPASS - s.ps;
          $("#mi-ps").textContent = remain;
          $("#mi-psub").textContent = remain > 0 ? `0 pt · reste ${remain}` : "Plus de passe";
          if (s.cn !== lastCardCn) showCard(s);
          const busy = pend === s.cn;
          $("#mi-found").disabled = busy;
          $("#mi-pass").disabled = busy || remain <= 0;
        } else {
          const b = $("#mi-buzz");
          if (b) b.disabled = pend === s.cn;
        }
      } else lastLeft = null;
    }

    function showCard(s) {
      const zone = $("#mi-zone");
      if (!zone) return;
      const old = zone.querySelector(".mi-card:not(.mi-toss)");
      const ev = s.ev || {};
      if (old && ev.cn === lastCardCn && (ev.t === "f" || ev.t === "p" || ev.t === "b")) {
        old.classList.add("mi-toss");
        old.insertAdjacentHTML("beforeend", `<div class="mi-stamp ${ev.t}">${ev.t === "f" ? "TROUVÉ !" : ev.t === "p" ? "PASSÉ" : "BZZZ !"}</div>`);
        later(() => old.remove(), 650);
      } else if (old) old.remove();
      zone.querySelectorAll(".mi-sheet").forEach(x => x.remove());
      picking = false;
      zone.insertAdjacentHTML("beforeend", cardHTML(s.ci, "mi-flip"));
      lastCardCn = s.cn;
    }

    function setPend(cn) {
      pend = cn;
      clearTimeout(pendT); timers.delete(pendT);
      pendT = later(() => { if (pend === cn) { pend = -1; if (S) update(S); } }, 2500);
      if (S) update(S);
    }
    function onFound() {
      const s = S;
      if (!s || s.ph !== "play" || !isEx(s) || pend === s.cn) return;
      const others = P.map((p, i) => i).filter(i => i !== mySeat && !gone(s, i));
      if (others.length <= 1) { send({a: "found", who: others.length ? P[others[0]].key : null, c: s.cn}); setPend(s.cn); snd.found(); return; }
      if (picking) return;
      picking = true;
      const zone = $("#mi-zone");
      zone.insertAdjacentHTML("beforeend", `<div class="mi-sheet" role="dialog" aria-label="Qui a trouvé ?"><h3>Qui a trouvé ?</h3>
        <div class="mi-pick">${others.map(i => `<button type="button" data-k="${esc(P[i].key)}">${api.avatar(P[i].key, {pose: "flex"})}<span>${esc(P[i].pseudo)}</span></button>`).join("")}</div>
        <button type="button" class="mi-cancel">Annuler</button></div>`);
      const sheet = zone.querySelector(".mi-sheet"), cn = s.cn;
      sheet.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.classList.contains("mi-cancel")) { sheet.remove(); picking = false; return; }
        if (!S || S.ph !== "play" || S.cn !== cn) { sheet.remove(); picking = false; return; }
        send({a: "found", who: b.dataset.k, c: cn}); setPend(cn); snd.found();
        b.style.background = "#5c8f2b";
      });
    }
    function onPass() {
      const s = S;
      if (!s || s.ph !== "play" || !isEx(s) || pend === s.cn || s.ps >= MAXPASS) return;
      send({a: "pass", c: s.cn}); setPend(s.cn); snd.pass();
    }
    function onBuzz(e) {
      const s = S;
      if (!s || s.ph !== "play" || isEx(s) || mySeat < 0 || pend === s.cn) return;
      snd.unlock(); snd.buzz();
      const b = e.currentTarget; b.classList.add("pressed"); later(() => b.classList.remove("pressed"), 160);
      send({a: "buzz", c: s.cn}); setPend(s.cn);
      if (navigator.vibrate) try { navigator.vibrate(120); } catch (er) {}
    }

    function onEvent(s) {
      const ev = s.ev || {};
      const news = $("#mi-news");
      if (ev.t === "b") {
        const f = document.createElement("div"); f.className = "mi-flash"; screen.appendChild(f); later(() => f.remove(), 750);
        tv.classList.remove("mi-shake"); void tv.offsetWidth; tv.classList.add("mi-shake");
        later(() => tv.classList.remove("mi-shake"), 550);
        if (!(mySeat === ev.by)) snd.buzz();
        if (news) news.innerHTML = `<span class="b">BZZZ ! ${P[ev.by] ? "par " + esc(P[ev.by].pseudo) : ""} · −1 pour ${esc(P[s.ex].pseudo)}</span>`;
      } else if (ev.t === "f") {
        if (!isEx(s)) snd.found();
        if (news) news.innerHTML = `<span class="f">Trouvé${P[ev.by] ? " par " + esc(ev.by === mySeat ? "vous" : P[ev.by].pseudo) : ""} !</span>`;
      } else if (ev.t === "p") {
        if (!isEx(s)) snd.pass();
        if (news) news.innerHTML = `<span class="p">${isEx(s) ? "Carte passée" : esc(P[s.ex].pseudo) + " passe la carte"}</span>`;
      } else if (ev.t === "end") snd.gong();
    }

    function render(s) {
      if (dead || !s || !s.ph || s.ph === "init" || s.ph === "done") return;
      const prev = S;
      S = s;
      onair.classList.toggle("on", s.ph === "play");
      const key = s.ph + ":" + s.ti + ":" + (isEx(s) ? 1 : 0);
      const fresh = key !== sceneKey;
      if (fresh) {
        sceneKey = key; build(s);
        if (s.ph === "final" && prev && prev.ph !== "final") snd.fanfare();
      }
      if (lastEvN === null) lastEvN = (s.ev || {}).n || 0;
      update(s);
      if (s.ev && s.ev.n !== lastEvN) { lastEvN = s.ev.n; onEvent(s); }
    }
    api.onState(render);

    return {
      destroy() {
        dead = true;
        clearInterval(hostInt);
        timers.forEach(t => clearTimeout(t)); timers.clear();
        el.removeEventListener("pointerdown", onGesture);
        snd.close();
        el.innerHTML = "";
      }
    };
  }
});
})();
