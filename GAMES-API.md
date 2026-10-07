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
| `api.connected()` | Clés des joueurs encore présents dans la partie. |
| `api.toast(msg)` | Petit message temporaire. |

Le lobby annule la partie tout seul s'il reste moins de `min` joueurs.

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
  Chaque gagnant reçoit +100 XP et l'équipe gagne +3 points au tableau de score du lobby. Match nul : `winners: []`.
- Affichez les noms et couleurs des équipes (`color` : rouge `#e63946`, bleu `#3a86ff`).
