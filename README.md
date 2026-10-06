# Gonflette Party

Lobby multijoueur sur téléphone : chacun ouvre le lien, choisit un pseudo, personnalise son perso
(qui commence très maigre) puis marche jusqu'au carré d'un jeu. Les victoires rapportent de l'XP
et font gonfler le perso jusqu'à l'excès.

**Jouer :** https://mehdisahariopt-afk.github.io/gonflette-party/

- Pas de compte : le premier joueur crée une salle (code), les autres ouvrent le même lien ou tapent le code.
- Les téléphones se connectent directement entre eux (WebRTC via PeerJS).
- Décors 3D (Muscle Beach, salle de muscu) avec repli 2D.
- 14 jeux : Puissance 4, Flip 7, Qui est-ce ?, Pong Délire, Dessine et devine, Le Mot Interdit, Bataille navale, Bras de fer, Morpion géant, Duel de réflexes, Développé couché, Uno muscu, Undercover, Petit Bac.
  Plusieurs parties peuvent tourner en même temps dans la même salle.
- XP : victoire +100, 2e place +40, participation +25. Gardée sur chaque téléphone.

Pour écrire un nouveau jeu, voir [GAMES-API.md](GAMES-API.md).
