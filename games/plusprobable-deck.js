/* Gonflette Party : le paquet de « Le plus probable » (chargé AVANT games/plusprobable.js).
   Chaque carte complète « Qui est le plus susceptible de… ». Une chaîne par catégorie, cartes séparées par « | ».
   L'ordre des cartes fixe leurs numéros : l'état du jeu n'envoie que des numéros, donc tous les téléphones doivent
   avoir le même fichier. Règles d'écriture : français, drôle, bienveillant, tout public ; rien sur le physique,
   la sexualité, la religion, la politique ni l'argent des gens ; pas de doublon (vérifié sans accents ni majuscules). */
(function () {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
G.plusprobableDeck = [
{n: "À la salle", e: "🏋️", l: `
faire un selfie torse nu à la salle|oublier le leg day pendant 6 mois|parler de ses macros pendant un dîner|crier en soulevant une charge toute légère|
squatter une machine pendant 20 minutes en scrollant|s'inscrire à la salle en janvier et arrêter en février|donner un prénom à chacun de ses haltères|
oublier sa serviette et s'essuyer avec son t-shirt|boire son shaker de protéines au restaurant|faire des curls dans le rack à squat|se filmer pendant chaque série|
donner des conseils de muscu sans qu'on lui demande|porter une ceinture de force pour faire du vélo|s'endormir sur le banc entre deux séries|
compter ses répétitions à voix haute devant tout le monde|se tromper de vestiaire|s'acheter une tenue de sport hors de prix pour y aller deux fois|
courir un marathon sans s'être entraîné|vouloir battre le record de pompes de la salle|manger poulet-riz-brocoli tous les jours pendant un an|
reposer les haltères n'importe où|se blesser pendant l'échauffement|demander « tu soulèves combien ? » à un inconnu|tester tous les cours collectifs en une semaine|
arriver à la salle en jean|faire une sieste dans le vestiaire|mettre plus de temps à se changer qu'à s'entraîner|
repartir de la salle au bout de 10 minutes « parce qu'il y a trop de monde »|mettre une musique de film épique pour faire ses abdos|
abandonner le cardio au bout de 3 minutes|encourager des inconnus à la salle comme un vrai coach|faire du gainage en regardant une série|
se mesurer les bras tous les matins|parler à son reflet dans le miroir de la salle|casser une machine de la salle|
s'inscrire à un concours de bodybuilding pour rigoler|être élu membre du mois de sa salle|transformer son salon en salle de sport|
oublier ses baskets et s'entraîner en chaussettes|faire 100 burpees pour un pari|devenir prof de yoga du jour au lendemain|
se faire mal au dos en ramassant un stylo|se prendre en photo avec le plus gros haltère de la salle|avoir une playlist qui s'appelle « BEAST MODE »|
aller à la salle à 5 h du matin|promettre « demain je m'y remets » tous les jours|acheter un vélo d'appartement qui finit en porte-manteau|
tenir la planche 5 minutes juste pour impressionner|ne jamais rater une séance, même enrhumé|bouder parce que quelqu'un a pris sa machine|
connaître tous les habitués de la salle par leur prénom|compter les calories d'un bonbon à la menthe|mettre de la protéine dans son café|
faire du sport juste pour pouvoir manger une pizza après|se faire remarquer au cours de zumba par excès d'enthousiasme|oublier sa carte d'abonnement à chaque fois|
faire de la muscu en costume|porter sa casquette à l'envers pour soulever plus lourd|faire un « dernier set » qui dure une heure|
tenter un salto sur les tapis de la salle|recevoir un abonnement à la salle pour son anniversaire|faire de la corde à sauter dans son salon à minuit|
s'inscrire à un triathlon et finir en marchant|appeler sa salle de sport « ma deuxième maison »|avoir des courbatures rien qu'en montant les escaliers|
faire des squats dans la file d'attente du supermarché|proposer une séance de squats en pleine soirée|sécher la séance parce qu'il pleut un peu|
porter des gants de muscu pour porter les courses|dire « je ne sens plus mes jambes » après 10 squats|chronométrer ses temps de repos à la seconde près|
prendre une photo « avant/après » au bout d'une semaine|faire son programme d'entraînement dans un tableur plein de couleurs|
partir faire un footing et finir à la boulangerie|taper dans un sac de frappe en criant comme dans un film|s'endormir pendant la séance de relaxation|
applaudir après chaque série réussie|se faire un shaker avec de la glace à la vanille|faire des pompes sur un seul bras pour frimer|
porter un bandeau en éponge comme dans les années 80|faire du sport avec un gilet lesté pour aller chercher le pain|
s'entraîner pour un défi de 30 jours et tenir 2 jours|transformer chaque promenade en séance de fractionné|faire les escaliers en sautant les marches deux par deux|
mettre une alarme pour boire son shaker toutes les 2 heures|avoir plus de shakers que de tasses chez soi|garder ses habits de sport pour aller à un mariage|
essayer de faire une traction sur une porte|tomber du tapis de course|se retrouver coincé sous la barre au développé couché|
filmer un tutoriel de musculation que personne n'a demandé|faire le tour de la salle pour dire bonjour à tout le monde|
oublier de respirer pendant un squat|tenir un journal de ses séances depuis 10 ans|faire du sport devant une vidéo de 1985|
transpirer pendant une séance d'étirements|appeler son coach à minuit pour lui parler de ses abdos|confondre le sauna et le hammam
`},
{n: "En soirée", e: "🪩", l: `
finir la soirée en dansant sur la table|arriver en retard à sa propre fête|s'endormir le premier à une soirée|lancer un karaoké à 3 h du matin|
connaître par cœur toutes les chorégraphies des années 2000|faire une chorégraphie complète au milieu de la piste|repartir avec la veste de quelqu'un d'autre|
raconter la même anecdote trois fois dans la soirée|monopoliser la playlist toute la soirée|lancer un débat sur la pizza à l'ananas à 2 h du matin|
venir déguisé alors que ce n'était pas une soirée costumée|devenir ami avec le DJ|s'improviser DJ et vider la piste|gagner un concours de danse improvisé|
partir à l'anglaise sans dire au revoir|rester jusqu'au bout pour aider à ranger|manger la moitié du buffet avant l'arrivée des invités|
oublier l'anniversaire de son meilleur ami|organiser une soirée à thème complètement improbable|inviter à sa fête des gens rencontrés dans le bus|
faire un discours émouvant sans qu'on lui demande|pleurer pendant un discours de mariage|apprendre une danse TikTok exprès pour une soirée|
se retrouver au milieu d'un cercle de danse|expliquer les règles d'un jeu de société pendant une heure|tricher au Uno|
perdre au Monopoly et bouder toute la soirée|dormir sur le canapé de quelqu'un sans prévenir|faire la fête jusqu'au lever du soleil|
s'incruster à un mariage par erreur|faire un tour de magie raté devant tout le monde|lancer une bataille d'eau en pleine soirée d'été|
commander des pizzas pour tout le monde à 4 h du matin|oublier où il s'est garé après une soirée|chanter faux mais très, très fort|
connaître tout le monde à une soirée où il n'était pas invité|prendre 200 photos de la soirée et n'en publier aucune|organiser un blind test à chaque soirée|
faire une entrée spectaculaire à une fête|porter des lunettes de soleil en pleine nuit|danser la macarena avec un sérieux total|
perdre une battle de danse contre un enfant de 8 ans|venir à une soirée pyjama en costume-cravate|organiser un anniversaire surprise et tout révéler par accident|
oublier qu'il a organisé une soirée chez lui|gagner un concours de limbo|faire tomber le gâteau d'anniversaire|
finir la soirée à raconter sa vie au livreur de pizza|lancer un concours de pompes au milieu de la fête|dire « allez, dernière chanson » cinq fois de suite|
se perdre dans une maison pendant une soirée|mettre l'ambiance dans une soirée où personne ne danse|préparer des cocktails sans alcool hyper élaborés|
transformer un goûter d'anniversaire d'enfants en boum géante|porter un pull de Noël en plein mois d'août|se faire adopter par la grand-mère de quelqu'un à un mariage|
continuer à danser seul sur la piste sans s'en rendre compte|apporter une enceinte à un pique-nique et faire danser tout le parc|
réclamer « sa » chanson au DJ toutes les 10 minutes|rentrer d'une soirée avec un nouveau meilleur ami|faire le DJ avec la playlist de sa grand-mère|
s'endormir dans la baignoire pendant une soirée|perdre sa chaussure en dansant|faire un slow tout seul|lancer une chenille sur n'importe quelle musique|
gagner un concours de déguisement avec un costume fait en carton|connaître toutes les paroles des génériques de dessins animés|
transformer n'importe quel repas en soirée karaoké|danser dès qu'une musique sort d'un téléphone|réveiller tout le monde pour aller voir le lever du soleil
`},
{n: "Au quotidien", e: "🏠", l: `
rater son train|se perdre avec un GPS|s'enfermer dehors en laissant les clés à l'intérieur|appuyer sur « répondre à tous » par erreur|
parler tout seul dans la rue|faire coucou à quelqu'un qui saluait une autre personne|trébucher dans les escaliers devant tout le monde|
porter son pull à l'envers toute la journée|envoyer un message à la mauvaise personne|oublier pourquoi il est entré dans une pièce|
ranger son téléphone dans le frigo|se tromper de bus et finir à l'autre bout de la ville|faire semblant de téléphoner pour éviter quelqu'un|
garder des tickets de caisse de 2015|avoir 150 onglets ouverts sur son navigateur|répondre « vous aussi » au serveur qui dit « bon appétit »|
se réveiller une heure en retard un jour important|repousser son réveil 12 fois|partir en week-end en oubliant sa valise|
mettre deux chaussettes différentes sans s'en rendre compte|parler à ses plantes|donner un prénom à sa voiture|garder ses guirlandes de Noël jusqu'en juin|
remplir le caddie de choses qui n'étaient pas sur la liste|oublier son mot de passe 5 minutes après l'avoir changé|lire la fin d'un livre en premier|
pleurer en coupant des oignons et dire que c'est l'émotion|arriver avec une heure d'avance à un rendez-vous|appeler son prof « maman » par erreur|
mettre le sucre dans le frigo et le lait dans le placard|faire la vaisselle seulement quand il n'y a plus d'assiettes propres|dormir avec une peluche à 30 ans|
répondre à un message trois semaines plus tard|avoir peur d'un papillon|garder ses cartons de déménagement fermés pendant des années|
oublier son parapluie à chaque fois qu'il pleut|se battre avec une porte automatique|pousser une porte marquée « tirer »|se coincer dans un tourniquet de métro|
faire la queue dans la mauvaise file pendant 20 minutes|oublier un plat au four jusqu'à ce qu'il soit carbonisé|appeler à l'aide pour une araignée|
avoir 47 bouteilles de shampoing entamées|ranger sa chambre seulement quand quelqu'un vient|se faire tomber son téléphone sur le nez au lit|
lire le mode d'emploi après avoir tout monté|monter un meuble et avoir trois vis en trop|sursauter devant son propre reflet|
tomber amoureux d'un canapé en magasin|garder ses lunettes de soleil à l'intérieur|oublier le prénom de quelqu'un juste après les présentations|
se réveiller de sa sieste sans savoir quel jour on est|mettre ses chaussures sans défaire les lacets|tout réparer avec du scotch|
connaître le prénom de tous les chiens du quartier|faire un détour de 10 minutes pour caresser un chat|prendre l'ascenseur pour monter un seul étage|
avoir une liste de choses à faire de 3 mètres de long|se brosser les dents avec de la crème pour les mains par erreur|mettre du sel dans son café au lieu du sucre|
oublier une machine de linge pendant trois jours|perdre une chaussette à chaque lessive|crier sur son imprimante|débrancher la box internet pour la « réparer »|
oublier son code de carte bleue à la caisse|se garer en prenant trois places|faire ses courses en pyjama|se lever la nuit pour manger du fromage|
se tromper de jour pour un rendez-vous|laver un mouchoir avec tout le linge noir|faire tomber sa tartine côté confiture|
chercher ses lunettes alors qu'il les a sur la tête|promener son chat en laisse|parler à son four pour qu'il chauffe plus vite|
acheter un objet en double parce qu'il avait oublié qu'il l'avait déjà|attendre le bus du mauvais côté de la rue|
répondre « présent » quand on l'appelle chez le médecin|oublier son sac de courses à la caisse|mettre la lessive dans le lave-vaisselle|
appeler tous les animaux « mon grand »|tenir une conversation avec un répondeur|se perdre dans son propre quartier|
faire son lit parfaitement tous les matins|ne jamais trouver le bout du rouleau de scotch|chanter les annonces de la gare|
laisser toutes les lumières allumées en partant|avoir un tiroir rempli de câbles qui ne servent à rien|mettre 10 minutes à se garer en créneau|
confondre le sel et le sucre dans un gâteau|se faire piéger par l'arroseur automatique|courir après le bus et le rater de deux secondes
`},
{n: "En voyage", e: "✈️", l: `
oublier son passeport le jour du départ|se perdre dans un aéroport|rater son avion à cause du shopping au duty free|
ramener un souvenir complètement inutile|prendre l'accent local après deux jours de vacances|dormir pendant tout le vol|applaudir quand l'avion atterrit|
faire une valise de 30 kilos pour un week-end|partir en vacances sans avoir réservé d'hôtel|attraper un coup de soleil dès le premier jour|
tomber amoureux pendant les vacances|se faire voler son sandwich par une mouette|commander le plat le plus bizarre du menu|se faire des amis dans le train|
vouloir parler la langue locale et commander n'importe quoi|prendre 3 000 photos du même coucher de soleil|partir faire le tour du monde sur un coup de tête|
faire du camping et finir par dormir dans la voiture|se perdre en randonnée|arriver sur le quai pile quand le train part|
mettre de la crème solaire sur la moitié du dos seulement|emporter sa propre bouilloire en vacances|faire un road trip sans carte ni GPS|
perdre ses bagages à chaque voyage|vouloir adopter tous les chats errants en vacances|prendre le mauvais train et visiter une autre ville|
dormir dans une cabane perchée dans les arbres|vouloir s'installer dans chaque pays visité|négocier le prix d'un porte-clés pendant une heure|
se lever à 4 h du matin pour voir le lever du soleil|faire un selfie avec un garde royal|se baigner dans une eau glacée en plein hiver|
envoyer des cartes postales qui arrivent après son retour|prévoir un planning de vacances à la minute près|tout organiser à la dernière minute|
oublier son maillot de bain en partant à la mer|faire de la plongée et avoir peur des poissons|faire le tour du monde à vélo|
se retrouver en première classe par erreur|discuter avec son voisin de siège pendant tout un vol de 10 heures|ramener du sable de chaque plage dans un bocal|
se faire piquer par une méduse|descendre une piste noire pour son premier jour de ski|rester bloqué sur un télésiège|se perdre dans un musée|
se réveiller sur la plage avec la marque de son livre sur le ventre|faire la queue deux heures pour une glace célèbre|
partir en vacances avec trois guides touristiques et ne pas en ouvrir un|demander son chemin à un autre touriste|
faire un château de sable avec des enfants et le prendre très au sérieux|rapporter une valise entière de fromages|
louer un scooter et faire le tour du parking pendant une heure|confondre la gauche et la droite en Angleterre|
camper sous la pluie en disant « c'est l'aventure »|se faire réveiller par un coq à 5 h du matin|faire tout un voyage en tongs|
monter au sommet d'une tour juste pour la photo|faire un selfie en tenant la tour de Pise|se tromper d'avion à l'embarquement
`},
{n: "À table", e: "🍕", l: `
manger une pizza entière tout seul|commander toujours la même chose au restaurant|mettre du ketchup sur absolument tout|goûter dans l'assiette des autres|
manger le dessert en premier|finir les restes de tout le monde|cacher des chocolats dans sa chambre|rater des pâtes|faire brûler de l'eau|
manger des céréales au dîner|ouvrir le frigo dix fois en espérant qu'un plat apparaisse|participer à un concours du plus gros mangeur de burgers|
devenir chef étoilé|commenter chaque plat comme un juré d'émission de cuisine|prendre en photo chaque plat avant de manger|manger une glace en plein hiver|
tremper ses frites dans son milkshake|inventer une recette improbable et la trouver délicieuse|faire une raclette en plein mois de juillet|
avoir une étagère entière de sauces piquantes|pleurer en mangeant un piment|lancer un débat sur la meilleure boulangerie de la ville|
manger debout devant le frigo|commander à manger alors que le frigo est plein|rater la première crêpe à chaque fois|
garder tous les sachets de sauce du fast-food|lécher le couvercle du yaourt|manger des pâtes tous les jours pendant une semaine|
finir le paquet de chips « juste pour goûter »|venir avec des boîtes en plastique à un buffet|s'étouffer de rire pendant un repas de famille|
se resservir quatre fois|mettre de la mayonnaise dans les pâtes|connaître la carte du kebab du coin par cœur|manger un sandwich en courant pour gagner du temps|
apporter un gâteau maison raté et le revendiquer fièrement|faire un barbecue sous la pluie|gagner un concours de cuisine|
faire une tache de sauce sur sa chemise blanche|couper la pizza avec des ciseaux|mettre de l'ananas sur sa pizza et l'assumer|
manger des lasagnes au petit-déjeuner|boire son café froid parce qu'il l'a oublié|cacher les légumes sous sa serviette|
devenir fan de cuisine japonaise après un seul repas|avoir un frigo rempli de sauces et rien à manger|finir la corbeille de pain avant l'entrée|
commencer un régime et craquer le jour même|tremper son croissant dans son chocolat chaud|faire ses propres pizzas avec une pâte maison|
manger la croûte du fromage|piquer les frites des autres en disant « je n'ai pas faim »|ramener des spécialités de chaque ville visitée|
faire une dégustation de chips à l'aveugle|ouvrir un paquet de gâteaux par le mauvais côté|cuisiner pour 10 alors qu'ils sont 3|
rater un œuf dur|se lever à 3 h du matin pour finir le gâteau|manger un bol de céréales dans un saladier|
faire griller du pain et déclencher le détecteur de fumée|transformer chaque repas en concours de piment|mettre du fromage râpé sur tout
`},
{n: "Connecté", e: "📱", l: `
liker une très vieille photo par erreur|envoyer un message vocal de 7 minutes|passer 3 heures sur TikTok sans s'en rendre compte|
devenir influenceur fitness|publier sa séance de sport sur les réseaux tous les jours|répondre « mdr » sans rire du tout|avoir 30 000 photos dans son téléphone|
oublier de couper son micro en visio|porter un bas de pyjama pendant une visio sérieuse|avoir sa batterie à 2 % en permanence|
regarder des vidéos de chats jusqu'à 3 h du matin|devenir célèbre grâce à une vidéo ridicule|mettre des emojis dans un mail professionnel|
envoyer un message à son patron par erreur|lire tous les commentaires sous une vidéo|écrire un avis de deux pages sur un restaurant|
passer plus de temps à choisir un film qu'à le regarder|regarder une série entière en un week-end|se faire spoiler et en vouloir à tout le monde|
lancer un appel vidéo par erreur|mettre un filtre chien sur toutes ses photos|faire une story à chaque repas|créer un groupe de discussion pour organiser un pique-nique|
quitter un groupe de discussion en douce|être dans 50 groupes de discussion en même temps|changer de photo de profil toutes les semaines|
s'énerver contre un jeu vidéo|passer une nuit blanche sur un jeu vidéo|battre un enfant à Mario Kart et s'en vanter|tester tous les filtres pour une seule photo|
répondre à un long message par un simple « ok »|laisser un message en « vu » pendant trois jours|acheter un objet inutile vu dans une pub|
écrire un long message et finalement tout effacer|mettre son téléphone en mode avion pour fuir le monde|laisser son téléphone en silencieux pour toujours|
paniquer en croyant avoir perdu son téléphone qu'il a dans la main|parler à son assistant vocal comme à un ami|commander son grille-pain avec une appli|
dire « je regarde juste un épisode » et en regarder huit|se faire battre aux échecs par une appli niveau facile|
envoyer « joyeux anniversaire » le mauvais jour|faire une capture d'écran de tout|avoir une alarme pour chaque minute entre 6 h et 7 h|
mettre ses écouteurs sans musique pour avoir la paix|regarder des vidéos de recettes sans jamais cuisiner|lancer une chaîne de vidéos de muscu|
se prendre en photo avec chaque plat de la semaine|faire une mise à jour au pire moment|garder 2 000 mails non lus|
taper son mot de passe dans la barre de recherche|écrire un message à sa grand-mère avec des abréviations|regarder des vidéos de gens qui rangent leur maison|
devenir accro à un jeu de ferme sur téléphone|faire défiler son fil d'actualité jusqu'au bout|acheter un objet connecté qui ne sert qu'une fois
`},
{n: "Dans 10 ans", e: "✨", l: `
devenir millionnaire|devenir président d'un club de foot|ouvrir sa propre salle de sport|gagner au loto et perdre le ticket|vivre dans une ferme avec des chèvres|
partir vivre sur une île déserte|devenir une star de télé-réalité|écrire un best-seller|ouvrir un food truck|devenir astronaute|participer à Koh-Lanta|
battre un record du monde complètement improbable|devenir maire de son village|vivre avec 12 chats|avoir sa statue au musée Grévin|devenir coach sportif de stars|
inventer un objet révolutionnaire|devenir youtubeur de jeux vidéo|gagner un Oscar|monter sa start-up dans son garage|faire le tour du monde en voilier|
se marier à Las Vegas|participer aux Jeux olympiques|ouvrir un restaurant étoilé|vivre dans une maison entièrement connectée|
devenir le prof préféré de tout le collège|élever des abeilles|parler cinq langues couramment|devenir champion de bras de fer|élever des alpagas|
ouvrir une boulangerie|devenir pilote de ligne|devenir le meilleur ami d'une star|monter un groupe de rock à 50 ans|se reconvertir en moniteur de ski|
vivre dans un van aménagé|devenir ceinture noire de karaté|gagner un concours de culturisme|devenir champion de pétanque|ouvrir un bar à smoothies protéinés|
écrire son autobiographie à 35 ans|passer dans un jeu télévisé|gagner à « Questions pour un champion »|déménager à l'autre bout du monde sur un coup de tête|
devenir guide de haute montagne|construire sa maison de ses propres mains|adopter un cochon nain|devenir le doyen de sa salle de sport|lancer sa propre marque de vêtements|
vouloir conquérir le monde|inventer une danse qui devient virale|devenir cascadeur pour le cinéma|tenir un camping au bord de la mer|
devenir chroniqueur à la radio|ouvrir un refuge pour animaux|devenir arbitre de foot professionnel|faire la couverture d'un magazine de sport|
devenir champion du monde de jeux vidéo|avoir une rue à son nom|devenir sommelier en jus de fruits|ouvrir un musée de ses propres collections|
être le premier humain à faire des pompes sur la Lune|animer une émission de cuisine|devenir garde forestier|prendre sa retraite à 40 ans sur un bateau|
devenir le coach de l'équipe de France de quelque chose|faire pousser tous ses légumes|fabriquer ses propres meubles
`},
{n: "Cœur tendre", e: "🥹", l: `
pleurer devant un dessin animé|pleurer devant une publicité|crier pendant un film d'horreur|rire au pire moment|avoir un fou rire incontrôlable en réunion|
s'attacher à un personnage de série comme à un vrai ami|pleurer de joie en ouvrant un cadeau|dire « je t'aime » au livreur par réflexe|écrire un poème pour son chien|
offrir un cadeau fait main|se vexer pendant un jeu de société|vouloir câliner tous les chiens qu'il croise|avoir le cœur brisé à la fin d'un film|
rougir dès qu'on lui fait un compliment|raconter ses rêves en détail tous les matins|garder les lettres de ses amis d'enfance|chanter sous la douche à pleins poumons|
faire une déclaration d'amitié devant tout le monde|faire un câlin à un arbre|s'excuser auprès d'un meuble après s'être cogné|avoir encore peur du noir|
sursauter quand le micro-ondes sonne|rire de ses propres blagues avant la chute|pleurer à la cérémonie de clôture des Jeux olympiques|garder son doudou d'enfance|
s'émouvoir devant un coucher de soleil|écrire à minuit « vous êtes les meilleurs » dans le groupe|appeler sa mère tous les jours|
se mettre à danser dès que passe sa chanson préférée|avoir des frissons en écoutant un hymne|s'attacher à une plante verte comme à un animal|
oublier sa rancune au bout de 5 minutes|consoler un inconnu qui pleure|bouder trois jours pour une broutille|pleurer en regardant une vidéo de retrouvailles avec un chien|
offrir des fleurs sans raison|se souvenir de l'anniversaire de tout le monde|pleurer en finissant un livre|réconforter tout le monde après une défaite|
écrire des petits mots gentils sur des post-it|faire un album photo souvenir pour ses amis|serrer tout le monde dans ses bras en arrivant|
avoir les larmes aux yeux en écoutant une chanson d'amour|garder la première pièce gagnée au foot|demander pardon à une fourmi qu'il a failli écraser|
trouver un prénom pour chaque pigeon du quartier|organiser un enterrement pour son poisson rouge|regarder les mêmes vieilles photos en boucle
`},
{n: "Au boulot", e: "💼", l: `
s'endormir en réunion|répondre « c'est noté » sans avoir écouté|arriver en retard à son entretien d'embauche|envoyer un mail en oubliant la pièce jointe|
taper n'importe quoi au clavier pour avoir l'air occupé|manger le yaourt d'un collègue dans le frigo commun|organiser un pot alors que personne ne part|
être élu employé du mois|appeler son chef par un surnom|transformer son bureau en jungle de plantes vertes|faire des pompes pendant la pause café|
dire « on se fait un point » toutes les deux phrases|organiser un tournoi de ping-pong au bureau|inventer une excuse incroyable pour un retard|
lancer un concours de déguisement au travail|oublier de couper sa caméra en mangeant|démissionner pour ouvrir un bar à jus|avoir un bureau parfaitement rangé|
avoir un bureau recouvert de post-it|répondre à ses mails à 2 h du matin|faire une présentation PowerPoint pour choisir le restaurant|
apporter des croissants tous les vendredis|tricher au quiz de l'entreprise|connaître tous les potins du bureau|monter un club de course à pied au bureau|
venir au travail à vélo par tous les temps|réviser toute la nuit la veille de l'examen|être le chouchou du prof|se faire sortir de cours pour un fou rire|
oublier son discours au moment de le prononcer|gagner le concours de talents de l'entreprise|faire une sieste dans la salle de réunion|
transformer une réunion de 10 minutes en réunion d'une heure|décorer son bureau pour chaque fête|se tromper de salle pour un examen|
faire ses exposés avec des blagues à chaque diapo|écrire « Cordialement » à ses amis|mettre un bureau debout et ne jamais se lever|
prendre des notes dans un carnet que personne ne peut relire|lever la main pour poser une question déjà posée|arriver en réunion avec un bol de céréales|
faire des étirements en plein open space|se faire choisir comme capitaine de l'équipe de foot du boulot|connaître le code de la photocopieuse de tout le monde
`},
{n: "Improbable", e: "🦄", l: `
survivre à une apocalypse zombie|se faire adopter par une meute de loups|devenir ami avec un pigeon|gagner un combat de pouces contre un champion|
rester coincé en haut d'un manège|se faire passer pour un expert à la télé|chanter l'hymne national en plein supermarché|se faire poursuivre par une oie|
tomber dans une piscine tout habillé|se faire enfermer dans un magasin la nuit|trouver un trésor en creusant dans le jardin|
rencontrer un extraterrestre et lui proposer un shaker|voyager dans le temps et se tromper d'époque|se battre avec un distributeur de boissons|
vouloir discuter avec les animaux du zoo|monter sur scène pendant un concert sans y être invité|s'endormir debout dans le métro|
se retrouver figurant dans un film|gagner un concours de grimaces|battre un record de vitesse en trottinette|jouer les touristes dans sa propre ville|
être élu délégué sans s'être présenté|tenir une minute sur un taureau mécanique|se faire photobomber par une star|survivre une semaine seul dans la forêt|
manger une fourmi pour un pari|crier « BINGO ! » sans avoir gagné|se coincer la main dans un bocal de bonbons|apprendre à jongler avec des œufs|
traverser la Manche à la nage|se faire voler sa casquette par un perroquet|être le dernier survivant d'un film d'horreur|être le premier à disparaître dans un film d'horreur|
se cacher pour faire une blague et s'endormir dans sa cachette|faire sonner tous les portiques de sécurité de l'aéroport|gagner une course en sac|
se faire offrir un poney|résoudre un mystère digne d'un grand détective|traverser la ville en rollers pour aller travailler|monter l'Everest en tongs|
devenir la mascotte d'un club de sport|être pris pour une célébrité dans la rue|avoir une discussion philosophique avec un chat|
dresser son chien à rapporter la télécommande|trouver un trèfle à quatre feuilles|construire une cabane géante dans son salon|
se faire tatouer le prénom de son chat|gagner un concours de lancer de tongs|se retrouver dans le public d'une émission par hasard|
parler à une statue en pensant que c'est un mime|se faire réveiller par un écureuil sur son balcon|faire du parachute et réclamer de recommencer|
gagner un duel de regards contre un chat|tenir un stand de limonade à 35 ans|avoir un poisson rouge qui s'appelle Hulk|
se lancer dans le lancer de troncs d'arbres écossais|apprendre la cornemuse en une semaine|remporter un concours de sosies|
se faire suivre jusqu'à chez lui par un canard|déclarer la guerre aux moustiques avec un plan de bataille
`}
];
})();
