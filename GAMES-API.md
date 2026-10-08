# Gonflette Party : écrire un jeu pour le lobby

Chaque jeu est un fichier `games/<id>.js` chargé par `index.html`. Il s'enregistre avec :

```js
GONFLETTE.registerGame({
  id: "puissance4",          // identifiant unique, minuscules
  name: "Puissance 4",       // nom affiché sur le carré du lobby
  min: 2, max: 2,            // nombre de joueurs humains acceptés
  create(api) {              // appelé sur CHAQUE téléphone quand la partie démarre
    // ... construire l'interface dans api.el, brancher la logique ...
    return { destroy() { api.el.innerHTML = ""; /* arrêter timers, rAF, écouteurs globaux */ } };
  }
});
```

`games/puissance4.js` est l'implémentation de référence : lisez-la en premier.

## Modèle réseau

Chaque joueur est sur son propre téléphone. Il n'y a pas de serveur : un des téléphones, **l'hôte**
(`api.isHost`), fait tourner la logique du jeu et publie l'état. Tous les téléphones (hôte compris)
affichent cet état. Les joueurs envoient leurs actions comme des « entrées ».

- `api.setInput(obj)` : publie MON entrée (remplace la précédente, pas un historique).
  Pour une action ponctuelle, mettez un compteur : `{seq: ++n, col: 3}`. L'hôte ignore un `seq` déjà traité.
  Les entrées peuvent être perdues si on en envoie deux très vite : attendez que l'état confirme avant de rejouer.
- `api.onInputs(fn)` : `fn({[clé joueur]: entrée})` à chaque changement. Utilisé par l'hôte, mais n'importe quel
  téléphone peut l'écouter (par exemple pour afficher le dessin en direct sans passer par l'hôte).
- `api.setState(state)` : (hôte) publie l'état complet. **Au plus ~3,5 Ko de JSON.** Publiez de l'état absolu,
  pas des différences. Fréquence : quand ça change ; pour un jeu temps réel, au plus ~25 fois par seconde.
- `api.onState(fn)` : appelé avec le dernier état de l'hôte (déjà dédoublonné), sur tous les téléphones.
- `api.finish({winners, ranking, summary})` : (hôte) termine la partie.
  - `winners` : clés des gagnants (`[]` si match nul) ; chaque gagnant reçoit +100 XP.
  - `ranking` : toutes les clés de joueurs, du meilleur au moins bon (2e place = +40 XP s'il y a 3 joueurs ou plus).
  - Les autres joueurs reçoivent +25 XP. `summary` : une phrase affichée sur l'écran des résultats.
  - Laissez ~2 s à l'écran final du jeu avant d'appeler `finish` (le lobby prend ensuite le relais).

Tout ce qui passe dans l'état ou les entrées est visible par tous les téléphones (un tricheur avec les outils
développeur pourrait le lire) : n'affichez simplement pas les informations secrètes aux autres.

## Ce que fournit `api`

| Champ | Description |
|---|---|
| `api.el` | Conteneur plein écran sous la barre de titre (défile si besoin). Mettez votre `<style>` dedans, préfixez toutes les classes par l'id du jeu. |
| `api.players` | `[{key, seat, pseudo, look, xp}]` dans l'ordre des places (fixe pendant la partie). |
| `api.me` | Ma clé. `api.isPlayer` est faux si je regarde en spectateur (plus de joueurs que `max`). |
| `api.isHost` | Ce téléphone fait tourner la logique. **L'hôte peut être un spectateur** : ne supposez pas qu'il joue. |
| `api.rng()` | Aléatoire déterministe à partir de `api.seed` (même suite sur tous les téléphones si appelée pareil). Pour l'aléatoire de l'hôte, `Math.random` suffit. |
| `api.name(key)` | Pseudo d'un joueur. |
| `api.avatar(key, {pose, view})` | SVG du perso musclé du joueur (`pose: "idle"` ou `"flex"`, `view: "bust"` pour un gros plan buste). Utilisez-le, c'est la signature du lobby. |
| `api.connected()` | Clés des joueurs encore présents dans la partie. Un joueur déconnecté depuis moins de 30 s y figure encore (il peut revenir : voir « Reconnexion »). |
| `api.resume` | (jeux `resumable`, hôte rechargé) dernier état publié avant le rechargement, sinon `null`. |
| `api.toast(msg)` | Petit message temporaire. |

Le lobby annule la partie tout seul s'il reste moins de `min` joueurs.

## Reconnexion

Un téléphone qui perd le réseau, recharge la page ou dont l'onglet est tué (écran éteint) revient avec la **même clé**
et le lobby relance le jeu sur ce téléphone, en pleine partie : `create(api)` est rappelé et `api.onState` donne tout de
suite l'état courant. Affichez donc tout à partir de l'état (pas d'hypothèse « j'ai vu le début »). Pendant 30 s, les
autres voient « on l'attend » et `api.connected()` le compte encore ; ensuite, forfait comme avant. Les `seq` des
entrées d'un téléphone revenu sont décalés par le lobby pour rester plus grands que les précédents.

Si c'est **l'hôte du jeu** qui recharge, sa logique en mémoire est perdue : par défaut la partie s'arrête (« Partie
interrompue », +25 XP pour tous, rien n'est compté). Un jeu dont l'état publié contient toute la partie peut reprendre :
ajoutez `resumable: true` à la définition et, côté hôte, partez de `api.resume` s'il existe
(`state = api.resume || étatNeuf()`, et relancez la fin si l'état repris est terminé). Les entrées déjà traitées avant
le rechargement ne sont pas redonnées à `onInputs`. Exemples : `puissance4.js`, `morpion.js`.

## Contraintes

- Fichier JS seul, pas de dépendance externe. Polices : celles déjà chargées par la page (Anton, Barlow Condensed, Pacifico).
- Pensé pour téléphone (~390 px de large) d'abord, utilisable sur ordinateur. Pas de défilement horizontal.
- Pas d'`alert/confirm/prompt`. Son : WebAudio seulement, après un geste de l'utilisateur.
- `destroy()` doit tout nettoyer (timers, `requestAnimationFrame`, écouteurs sur `window`/`document`).

## Tester sans téléphones

Ouvrez `index.html?mock` dans plusieurs onglets du même navigateur : ils se voient comme des téléphones
(simulation par BroadcastChannel). Dans la console de l'hôte (le premier entré, 👑) :
`GONFLETTE.debug.launch("<id>")` lance directement le jeu avec tous les joueurs du lobby.

## Jeux d'équipe (2 équipes)

Ajoutez `teams: true` à la définition (`GONFLETTE.registerGame({id, name, min, max, teams: true, create})`).
Le lobby forme alors deux équipes avec les joueurs qui ont validé : il garde les équipes choisies dans le lobby
(zones rouge et bleue, nommées par le premier arrivé) et répartit les autres pour équilibrer.

- `api.teams` : `[{index: 0, name, color, keys: [...]}, {index: 1, name, color, keys: [...]}]` (null pour un jeu normal).
  Une équipe peut être plus nombreuse que l'autre d'un joueur ; avec 2 joueurs, c'est du 1 contre 1.
- `api.teamOf(key)` : 0, 1 ou null.
- Fin de partie : `api.finish({winners: [toutes les clés de l'équipe gagnante], ranking: [...], summary})`.
  Chaque gagnant reçoit +100 XP. Tableau de score du lobby : 3 points partagés entre les équipes du lobby selon
  l'équipe du lobby de chaque gagnant (un joueur déplacé pour équilibrer rapporte à SON équipe du lobby, un joueur sans
  équipe ne rapporte rien). Match nul : `winners: []`.
- Affichez les noms et couleurs des équipes (`color` : rouge `#e63946`, bleu `#3a86ff`).

## Kit partagé (`core/kit.js`) : même look, mêmes sons, mêmes vibrations

Pour que les 23 jeux ressemblent à un seul produit sans les réécrire, le lobby fournit un petit kit. Tout est facultatif.

| Champ / classe | Description |
|---|---|
| `api.sfx(nom)` | Petit son WebAudio commun (aucun fichier) : `"tap"` (toc), `"win"`, `"lose"`, `"count"` (bip), `"go"`, `"whoosh"`. Silencieux si le joueur a coupé le son (🔇) ou avant son premier geste. |
| `api.haptic(type)` | Vibration (`navigator.vibrate` quand il existe) : `"light"`, `"heavy"`, `"success"`, `"fail"`. |
| `api.rules()` | Rouvre la carte « Règles en 10 secondes » du jeu (comme le bouton « ? » du bandeau). |
| `.gk-btn` | Bouton commun (≥ 48 px de haut, Barlow Condensed 800 majuscules, bord encre, ombre « pressée »). Variantes : `.gk-btn.red`, `.gk-btn.good`, `.gk-btn.alt`, `.gk-btn.big`. |
| `.gk-title` | Titre en Anton majuscules. |
| Variables CSS sur `api.el` (`.game-root`) | `--gk-ink`, `--gk-gold`, `--gk-accent` (couleur du lieu), `--gk-good`, `--gk-bad`, `--gk-panel`, `--gk-text`, `--gk-dim`, `--gk-display` (Anton), `--gk-ui` (Barlow Condensed), `--gk-radius`, `--gk-tap` (48 px). La police par défaut du jeu est déjà `--gk-ui`. |

Exemple : `api.sfx("tap"); api.haptic("light");` quand un pion est posé (voir `puissance4.js`, `quiestce.js`).

Ce que le lobby fait déjà pour tous les jeux (inutile de le refaire) :

- **Bandeau de jeu commun** : emoji du lieu, nom du jeu, duel « A vs B », bouton **« ? »** (règles), plein écran.
- **« FIN ! »** : quand `api.finish` est appelé, chaque téléphone affiche « FIN ! » 1 s (son + vibration) puis l'écran
  des résultats du lobby (son et vibration de victoire / défaite, présentateur). Gardez juste ~2 s de votre écran final.
- **Musique d'ambiance** du lobby coupée pendant la partie (le jeu garde ses propres sons).
- **Règles en 10 secondes** (`core/rules.js`) : avant le 3-2-1, un joueur qui n'a jamais joué au jeu voit une carte
  (3 lignes + animation du geste) et les autres attendent qu'il touche « J'ai compris ✓ » (12 s au plus).
  **Nouveau jeu** : ajoutez son id à la fin de `ORDER` et une entrée dans `R` (`s` : résumé d'une ligne,
  `l` : 3 lignes avec les verbes en `<b>`, `k` : une animation existante, `o` : ses options).

Règles d'ergonomie communes (téléphone de 360 px) : texte ≥ 12 px, cibles tactiles ≥ 44 px, pas de défilement horizontal,
polices limitées à Anton (titres), Barlow Condensed (interface) et Pacifico (déco).

Événements du lobby (pour les modules `core/*.js`, pas pour les jeux) : `GONFLETTE.kit.on(nom, fn)` avec
`"place"`, `"chosen"`, `"count"`, `"game:start"`, `"game:end"`, `"results"`, `"unlock"` (premier geste), `"mute"`.
