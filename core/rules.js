/* Gonflette Party : « Règles en 10 secondes ».
   Une carte par jeu : nom + lieu, nombre de joueurs, 3 lignes de règles très concrètes et une petite animation du geste.
   - Une carte déjà vue n'est plus jamais imposée (mémorisé dans le profil : profile.rulesSeen = [ids]).
   - Écran « C'est parti » : si un joueur du match ne l'a pas vue, le match attend (au plus WAIT_MS) :
     celui qui découvre lit la carte et touche « J'ai compris ✓ », les autres voient un résumé d'une ligne et qui lit encore.
   - Réseau : chaque téléphone publie dans sa présence rs (jeux déjà vus, masque en base 36) et rd (id du match pour
     lequel il est prêt). L'hôte du lobby note M.rw (clés qui doivent lire) à la création du match ; tant que M.rw existe,
     la phase « chosen » n'avance pas ; quand tout le monde est prêt (ou délai dépassé), l'hôte retire M.rw et remet
     M.at à maintenant : le 3-2-1 habituel repart, synchronisé sur l'heure de l'hôte.
   - Bouton « ? » du bandeau de jeu : GONFLETTE.rules.open(id) rouvre la carte à tout moment. */
(() => {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
const WAIT_MS = 12000;
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

/* ---------- les 23 cartes ----------
   ORDER fixe les bits du masque « déjà vu » publié dans la présence : n'ajoutez qu'à la fin. */
const ORDER = ["puissance4", "flip7", "quiestce", "pong", "dessine", "motinterdit", "bataille", "brasdefer", "morpion", "reflexes",
  "developpe", "uno", "undercover", "petitbac", "tiracorde", "pictionary", "relais", "quiadit", "spotteur", "dames", "airhockey", "tron", "pfc", "priorities"];
// s : résumé d'une ligne (pour ceux qui connaissent déjà) · l : 3 lignes max · k : animation du geste
const R = {
  puissance4: {s: "Touchez une colonne, alignez 4 jetons.", k: "drop", l: [
    "<b>Touchez une colonne</b> : votre jeton tombe tout en bas.",
    "<b>Alignez 4 jetons</b> en ligne, en colonne ou en diagonale.",
    "Chacun son tour : <b>bloquez</b> les lignes de l'adversaire !"]},
  flip7: {s: "Piocher ou Rester : 7 numéros différents = jackpot.", k: "cards", o: {v: ["7", "3"], c: ["#ff4f8b", "#4be0a0"]}, l: [
    "À votre tour : <b>Piocher</b> une carte… ou <b>Rester</b> pour encaisser vos points.",
    "Deux fois <b>le même numéro</b> = manche perdue, zéro point !",
    "7 numéros différents = bonus. <b>Premier à 200 points</b> gagne."]},
  quiestce: {s: "Questions à voix haute, baissez les suspects, accusez.", k: "faces", l: [
    "Posez une question <b>à voix haute</b> : « Il a une moustache ? »",
    "<b>Touchez les suspects</b> qui ne collent pas pour les baisser.",
    "<b>Accusez</b> le bon suspect pour gagner. Erreur = perdu !"]},
  pong: {s: "Glissez le doigt, renvoyez la balle, 5 points.", k: "drag", l: [
    "<b>Glissez le doigt</b> n'importe où : votre raquette suit.",
    "Renvoyez la balle et <b>attrapez les bonus</b> (ou subissez-les).",
    "<b>Premier à 5 points</b> gagne."]},
  dessine: {s: "Dessinez le mot secret, devinez celui des autres.", k: "draw", o: {w: "CHAT ?"}, l: [
    "À votre tour : <b>dessinez le mot secret</b> avec le doigt.",
    "Les autres <b>tapent leurs propositions</b> au clavier.",
    "<b>Trouvé vite = plus de points</b>, pour le devineur et le dessinateur."]},
  motinterdit: {s: "Faites deviner sans dire les mots interdits.", k: "talk", l: [
    "<b>Faites deviner le mot à voix haute</b>, sans dire les mots interdits.",
    "Trouvé = <b>+1</b>. Mot interdit prononcé = <b>BZZZ, −1</b>.",
    "50 s par tour, 2 passes max. <b>Le plus de points</b> gagne."]},
  bataille: {s: "Placez vos navires, tirez, coulez tout.", k: "pick", o: {sym: "💥", bg: "sea"}, l: [
    "<b>Placez vos 5 navires</b> en secret sur votre grille.",
    "<b>Touchez une case</b> de la grille adverse pour tirer.",
    "<b>Coulez toute la flotte</b> ennemie le premier."]},
  brasdefer: {s: "Martelez le bouton au « FORCE ! ».", k: "mash", o: {lbl: "FORCE !", ico: "💪"}, l: [
    "Au signal <b>« FORCE ! »</b>, martelez votre gros bouton.",
    "Plus vous tapez vite, <b>plus le bras penche</b> de votre côté.",
    "Plaquez le bras adverse : <b>2 manches gagnantes</b>."]},
  morpion: {s: "Votre case envoie l'adversaire dans la grille voisine.", k: "pick", o: {sym: "✕", bg: "ttt"}, l: [
    "<b>Touchez une case</b> : l'adversaire doit jouer dans la petite grille au même endroit.",
    "<b>3 alignés</b> dans une petite grille = vous la gagnez.",
    "<b>Alignez 3 petites grilles</b> pour remporter la partie."]},
  reflexes: {s: "Attendez « TIREZ ! » puis touchez le plus vite.", k: "quick", l: [
    "<b>Attendez le signal</b>… puis touchez l'écran <b>le plus vite</b> possible !",
    "Trop tôt = <b>faux départ</b>. Méfiez-vous du faux signal orange.",
    "5 manches, des points au plus rapide : <b>le meilleur total</b> gagne."]},
  developpe: {s: "Tapez quand le curseur est dans le vert.", k: "gauge", o: {pop: "+10 kg"}, l: [
    "Une jauge oscille : <b>touchez quand le curseur est dans le vert</b>.",
    "Chaque rep réussie <b>ajoute des kilos</b>. Raté = temps perdu.",
    "<b>Le plus de kilos</b> soulevés à la fin du chrono gagne."]},
  uno: {s: "Même couleur ou même valeur, criez UNO !", k: "cards", o: {v: ["5", "5"], c: ["#3a86ff", "#e63946"], uno: 1}, l: [
    "<b>Touchez une carte</b> de même couleur ou même valeur pour la poser.",
    "Rien de jouable ? <b>Piochez</b>. Plus qu'une carte ? Criez <b>UNO !</b>",
    "<b>Le premier qui vide sa main</b> gagne."]},
  undercover: {s: "Un indice chacun, puis votez contre l'intrus.", k: "vote", o: {txt: "🍕 Pizza"}, l: [
    "<b>Lisez votre mot secret</b> sans le montrer. L'Undercover a un mot proche !",
    "Chacun <b>tape un indice</b>, puis tout le monde <b>vote</b> pour éliminer un suspect.",
    "Civils : <b>démasquez l'intrus</b>. Undercover : <b>survivez</b> jusqu'au bout."]},
  petitbac: {s: "Une lettre, 6 cases à remplir, STOP !", k: "type", o: {letter: "B", txt: "Banane"}, l: [
    "Une lettre, 6 catégories : <b>tapez un mot pour chaque case</b>.",
    "Tout rempli ? <b>Criez « STOP ! »</b> (5 s pour les autres).",
    "Mot unique = <b>2 pts</b>, partagé = 1 pt. 3 manches."]},
  tiracorde: {s: "Tapez pile sur le « HISSE ! », ensemble.", k: "beat", l: [
    "<b>Tapez pile sur le « HISSE ! »</b>, en rythme avec le tempo.",
    "Tapez <b>en même temps que votre équipe</b> : la synchro compte plus que la vitesse.",
    "Tirez la corde de votre côté : <b>2 tirs gagnants</b>."]},
  pictionary: {s: "Un dessinateur par équipe, devinez avant l'autre équipe.", k: "draw", o: {w: "SOLEIL ?", team: 1}, l: [
    "Un <b>dessinateur par équipe</b> dessine le même mot, en même temps.",
    "Ses coéquipiers <b>tapent leurs propositions</b>.",
    "<b>Première équipe qui trouve</b> : +1 point."]},
  relais: {s: "Votre relais : une mini-épreuve, le plus vite possible.", k: "relay", l: [
    "Chacun son tour, <b>courez votre relais</b> : une mini-épreuve express.",
    "<b>Suivez la consigne</b> à l'écran : taper, viser, retenir…",
    "<b>Temps d'équipe le plus court</b> = victoire."]},
  quiadit: {s: "Répondez en secret, devinez qui a dit quoi.", k: "vote", o: {txt: "« Je dors avec mes haltères »"}, l: [
    "<b>Répondez en secret</b> à la question du jour.",
    "Les réponses s'affichent anonymes : <b>votez pour l'auteur</b>.",
    "+1 si vous trouvez, <b>+1 par joueur que vous bernez</b>."]},
  spotteur: {s: "Tapez pour soulever, le spotteur attrape la barre à temps.", k: "mash", o: {lbl: "POUSSE !", ico: "🏋️", spot: 1}, l: [
    "Soulevé : <b>tapez vite</b> pour pousser la barre.",
    "Spotteur : <b>parlez-vous</b>, puis <b>attrapez la barre</b> juste avant l'écrasement.",
    "Les rôles tournent : <b>le meilleur score</b> gagne."]},
  dames: {s: "Touchez un pion puis sa case, prise obligatoire.", k: "move", l: [
    "<b>Touchez un pion</b>, puis <b>sa case d'arrivée</b> (en diagonale).",
    "<b>Prise obligatoire</b>, rafles en chaîne, dames volantes.",
    "<b>Prenez ou bloquez</b> toutes les pièces adverses."]},
  airhockey: {s: "Glissez le doigt, marquez dans le but adverse.", k: "drag2", l: [
    "<b>Glissez le doigt</b> : votre maillet suit.",
    "<b>Frappez le palet</b> dans le but adverse.",
    "<b>Premier à 7 buts</b> (ou le plus de buts en 3 min)."]},
  tron: {s: "Glissez pour tourner, ne touchez aucun mur.", k: "swipe", l: [
    "<b>Glissez dans une direction</b> pour tourner : ↑ → ↓ ←",
    "Ne touchez <b>aucun mur de néon</b>. Bouton BOOST pour accélérer.",
    "<b>Dernier en selle</b> gagne la manche, 3 manches pour gagner."]},
  pfc: {s: "Choisissez avant « CHI-FOU-MI ! », bluffez.", k: "pfc", l: [
    "<b>Choisissez</b> pierre, feuille ou ciseaux avant « CHI-FOU-MI ! »",
    "<b>Annoncez</b> votre signe pour bluffer : gagner avec = +1 bonus.",
    "Duel en 3 points ; à plusieurs, <b>tournoi</b> à élimination."]},
  priorities: {s: "La Vedette classe 5 cartes en secret, devinez son classement.", k: "sort", l: [
    "La <b>Vedette</b> classe 5 cartes en secret, de <b>J'ADORE ❤️</b> à <b>JE DÉTESTE 💀</b>.",
    "Les autres <b>glissent les cartes</b> pour deviner son classement.",
    "<b>Pile = 2 pts</b>, à une place près = 1 pt. La Vedette gagne la moyenne des autres."]}
};

/* ---------- illustrations (CSS seulement, en boucle) ---------- */
const F = (style, cls) => `<span class="gr-f${cls ? " " + cls : ""}" style="${style || ""}">👆</span>`;
const ILL = {
  drop: () => `<div class="gr-board gr-p4"></div><i class="gr-tok"></i>${F("left:84px;top:6px", "tapmove")}`,
  pick: o => `<div class="gr-board gr-${o.bg}">${o.bg === "ttt" ? "<i></i><i></i><i></i><i></i>" : ""}</div><b class="gr-sym appear" style="left:${o.bg === "ttt" ? 76 : 88}px;top:${o.bg === "ttt" ? 40 : 34}px">${o.sym}</b>${F(`left:${o.bg === "ttt" ? 76 : 88}px;top:${o.bg === "ttt" ? 50 : 46}px`, "tapmove")}`,
  move: () => `<div class="gr-board gr-chk"></div><i class="gr-pc red"></i><i class="gr-pc blue"></i><i class="gr-pc red mv"></i><i class="gr-dot"></i>${F("", "chkf")}`,
  faces: () => `<div class="gr-faces"><span>🧔</span><span class="dn">👩‍🦰</span><span>👴</span><span class="dn2">🧑‍🦱</span></div><span class="gr-bub">Moustache ?</span>${F("left:52px;top:58px", "facef")}`,
  mash: o => `<div class="gr-meter"><i></i></div><span class="gr-ico">${o.ico}</span>${o.spot ? `<span class="gr-spot">🙌</span>` : ""}<button class="gr-big" tabindex="-1" aria-hidden="true">${o.lbl}</button>${F("left:76px;top:62px", "mash")}`,
  beat: () => `<div class="gr-rope"><i></i></div><div class="gr-beats"><i></i><i></i><i></i><i></i></div><b class="gr-hisse">HISSE !</b>${F("left:118px;top:58px", "beat")}`,
  drag: () => `<div class="gr-table"></div><i class="gr-ball"></i><i class="gr-pad"></i>${F("", "dragf")}`,
  drag2: () => `<div class="gr-table hk"><i class="goal"></i></div><i class="gr-puck"></i><i class="gr-mallet"></i>${F("", "drag2f")}`,
  swipe: () => `<svg class="gr-svg" viewBox="0 0 168 96" aria-hidden="true"><path class="gr-trail" d="M20 80 H70 V30 H130 V70" fill="none" stroke="#2ef2ff" stroke-width="5" stroke-linecap="square"/><path class="gr-trail b" d="M150 16 H110 V54 H40" fill="none" stroke="#ff2e88" stroke-width="5" stroke-linecap="square"/></svg><span class="gr-arr">↑</span>${F("", "swipef")}`,
  draw: o => `<div class="gr-easel"></div><svg class="gr-svg" viewBox="0 0 168 96" aria-hidden="true"><path class="gr-ink" d="M44 62 Q40 34 60 30 L64 18 L72 30 Q84 26 92 30 L100 18 L102 32 Q118 40 108 62 Q78 76 44 62 Z M64 46 h4 M86 46 h4 M74 54 q4 4 8 0" fill="none" stroke="#1d1420" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="gr-guess">${esc(o.w)}</span>${o.team ? `<span class="gr-tm">🔴 vs 🔵</span>` : ""}${F("", "drawf")}`,
  talk: () => `<span class="gr-bub big">C'est rond, on tape dedans…</span><span class="gr-ban">🚫 PIED</span><span class="gr-bz">BZZZ</span><span class="gr-ok">BALLON ✓</span>`,
  cards: o => `<div class="gr-deck"></div><div class="gr-cd c1" style="--cc:${o.c[0]}"><b>${o.v[0]}</b></div><div class="gr-cd c2" style="--cc:${o.c[1]}"><b>${o.v[1]}</b></div>${o.uno ? `<span class="gr-uno">UNO !</span>` : ""}${F("left:32px;top:52px", "tapmove")}`,
  quick: () => `<span class="gr-cactus">🌵</span><span class="gr-wait">…</span><b class="gr-fire">TIREZ !</b><span class="gr-ms">0,28 s</span>${F("left:84px;top:52px", "quickf")}`,
  gauge: o => `<div class="gr-gauge"><i class="zone"></i><i class="cur"></i></div><span class="gr-pop">${esc(o.pop)}</span><span class="gr-ico bar">🏋️</span>${F("left:120px;top:56px", "gaugef")}`,
  vote: o => `<span class="gr-bub q">${esc(o.txt)}</span><div class="gr-faces v"><span>🧑</span><span class="pick">👩</span><span>🧔</span></div><b class="gr-sym appear" style="left:76px;top:44px">✓</b>${F("left:80px;top:66px", "tapmove")}`,
  type: o => `<b class="gr-letter">${esc(o.letter)}</b><div class="gr-field"><span class="lbl">Fruit</span><span class="txt">${esc(o.txt)}</span></div><span class="gr-stop">STOP !</span>${F("left:118px;top:60px", "typef")}`,
  relay: () => `<div class="gr-lanes"><span class="r1">🏃</span><span class="baton">🥢</span><span class="r2">🏃‍♀️</span></div><div class="gr-tasks"><span>👆</span><span>🎯</span><span>🧠</span></div>${F("left:120px;top:58px", "mash")}`,
  sort: () => `<div class="gr-lad"><i class="h">❤️</i><i class="s">💀</i></div><span class="gr-sc a" style="--cc:#ff9a2e">🍍 Ananas</span><span class="gr-sc b" style="--cc:#2fd18a">🎤 Karaoké</span><span class="gr-sc c" style="--cc:#93cc45">🐦 Pigeons</span>${F("left:118px;top:62px", "sortf")}`,
  pfc: () => `<div class="gr-hands"><span>✊</span><span>✋</span><span>✌️</span></div><b class="gr-chi">CHI-FOU-MI !</b>${F("left:96px;top:58px", "tapmove")}`
};
const CSS = `
.gr-card{display:grid;gap:8px;text-align:left;background:linear-gradient(160deg,#ffffff12,#ffffff04);border:3px solid var(--gold,#ffcc33);border-radius:18px;padding:10px 12px 12px;box-shadow:0 6px 0 #0006}
.gr-kick{font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#ffcc33)}
.gr-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;min-width:0}
.gr-head .gr-pe{font-size:1.6rem;line-height:1;flex:none}
.gr-head b{flex:1 1 150px;min-width:0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(1.25rem,5.6vw,1.55rem);line-height:1;text-transform:uppercase;color:#fff;overflow-wrap:break-word}
.gr-np{flex:none;font-weight:800;font-size:.85rem;background:#0005;border-radius:999px;padding:3px 9px;color:var(--text,#fff);white-space:nowrap}
.gr-body{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center}
.gr-ls{margin:0;padding:0 0 0 1.2em;display:grid;gap:5px;font-size:1.02rem;line-height:1.2;font-weight:600;color:var(--text,#f5efe6)}
.gr-ls li::marker{font-family:"Anton",Impact,sans-serif;color:var(--gold,#ffcc33)}
.gr-ls b{color:#fff;font-weight:800}
@media (max-width:480px){.gr-body{grid-template-columns:minmax(0,1fr)}.gr-ill{margin:0 auto}}
.gr-ill{--d:2.4s;position:relative;width:150px;height:96px;border-radius:14px;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#3b2a55,#150f1f);border:2px solid #ffffff26;font-family:"Barlow Condensed",sans-serif;user-select:none;-webkit-user-select:none}
.gr-ill *{position:absolute;margin:0}
.gr-f{z-index:9;font-size:28px;line-height:1;filter:drop-shadow(0 3px 0 #0009);font-style:normal;animation:gr-tapmove var(--d) ease-in-out infinite}
.gr-f.mash{animation:gr-mash .24s ease-in-out infinite alternate}
.gr-f.beat{animation:gr-beatf .8s ease-out infinite}
.gr-board{left:20px;top:12px;width:110px;height:72px;border-radius:9px}
.gr-p4{background:radial-gradient(circle,#04061a 0 5.5px,transparent 6px) 1px 0/15.6px 18px,#1d2fa3;box-shadow:inset 0 0 0 3px #c4943b}
.gr-tok{left:86px;top:57px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6cf,#ffb02e 55%,#9e3a06);animation:gr-drop var(--d) cubic-bezier(.5,0,1,.6) infinite}
.gr-sea{background:linear-gradient(#ffffff22 1px,transparent 1px) 0 0/14px 14px,linear-gradient(90deg,#ffffff22 1px,transparent 1px) 0 0/14px 14px,#0b4f6c}
.gr-ttt{left:40px;width:72px;background:#f5efe6;border-radius:6px}
.gr-ttt i{background:#1d1420;border-radius:2px}
.gr-ttt i:nth-child(1){left:23px;top:4px;width:3px;height:64px}.gr-ttt i:nth-child(2){left:47px;top:4px;width:3px;height:64px}
.gr-ttt i:nth-child(3){left:4px;top:23px;width:64px;height:3px}.gr-ttt i:nth-child(4){left:4px;top:46px;width:64px;height:3px}
.gr-sym{z-index:3;font-size:22px;line-height:1;font-weight:900;color:#e63946;transform-origin:center;animation:gr-appear var(--d) ease-out infinite}
.gr-chk{background:conic-gradient(#3b2a1d 25%,#e9d3a8 0 50%,#3b2a1d 0 75%,#e9d3a8 0) 0 0/36px 36px;border-radius:6px;left:21px;top:6px;width:108px;height:84px}
.gr-pc{width:14px;height:14px;border-radius:50%;border:2px solid #1d1420}
.gr-pc.red{background:#e63946}.gr-pc.blue{background:#3a86ff}
.gr-pc:nth-of-type(1){left:23px;top:62px}.gr-pc.blue{left:59px;top:26px}
.gr-pc.mv{left:41px;top:44px;animation:gr-chkmv var(--d) ease-in-out infinite}
.gr-dot{left:80px;top:9px;width:10px;height:10px;border-radius:50%;border:2px dashed #ffcc33;animation:gr-appear var(--d) infinite}
.gr-f.chkf{left:44px;top:52px;animation:gr-chkf var(--d) ease-in-out infinite}
.gr-faces{left:8px;right:8px;top:30px;display:flex;justify-content:space-around;font-size:28px;position:absolute}
.gr-faces span{position:relative;display:inline-block;transform-origin:50% 100%}
.gr-faces .dn{animation:gr-flip var(--d) ease-in infinite}
.gr-faces .dn2{animation:gr-flip var(--d) ease-in infinite;animation-delay:-1.2s}
.gr-bub{left:8px;top:5px;background:#fff;color:#1d1420;font-weight:800;font-size:.8rem;border-radius:10px;padding:1px 8px;white-space:nowrap;animation:gr-pulse 1.2s ease-in-out infinite alternate}
.gr-f.facef{animation:gr-facef var(--d) ease-in-out infinite}
.gr-meter{left:10px;top:10px;width:12px;height:76px;border-radius:6px;background:#0007;border:2px solid #ffffff44;overflow:hidden}
.gr-meter i{left:0;right:0;bottom:0;height:20%;background:linear-gradient(0deg,#3ccf8e,#ffcc33,#e63946);animation:gr-fill 1.6s ease-in infinite}
.gr-ico{left:32px;top:8px;font-size:30px;line-height:1;animation:gr-pump .48s ease-in-out infinite alternate}
.gr-spot{right:8px;top:8px;font-size:26px;animation:gr-catch 1.6s ease-in infinite}
.gr-big{left:52px;top:44px;width:68px;height:38px;border-radius:50%;border:3px solid #1d1420;background:radial-gradient(circle at 40% 30%,#ff8a8a,#e63946 60%,#a1121f);color:#fff;font:900 .78rem "Barlow Condensed",sans-serif;box-shadow:0 5px 0 #1d1420;padding:0;animation:gr-btn .24s ease-in-out infinite alternate}
.gr-rope{left:6px;right:6px;top:18px;height:6px;border-radius:3px;background:repeating-linear-gradient(60deg,#c99752 0 5px,#8a5a2b 5px 9px)}
.gr-rope i{left:68px;top:-5px;width:6px;height:16px;background:#e63946;border-radius:2px;animation:gr-knot 3.2s ease-in-out infinite}
.gr-beats{left:16px;top:40px;display:flex;gap:12px;position:absolute}
.gr-beats i{position:relative;width:14px;height:14px;border-radius:50%;background:#ffffff26;animation:gr-beat 3.2s steps(1) infinite}
.gr-beats i:nth-child(2){animation-delay:.8s}.gr-beats i:nth-child(3){animation-delay:1.6s}.gr-beats i:nth-child(4){animation-delay:2.4s}
.gr-hisse{left:30px;top:62px;font:400 1.3rem "Anton",Impact,sans-serif;color:#ffcc33;text-shadow:2px 2px 0 #e63946;animation:gr-hisse .8s ease-out infinite}
.gr-table{left:14px;top:6px;width:122px;height:84px;border-radius:10px;background:linear-gradient(180deg,#0d3b2e,#145a44);border:2px solid #2ef2ff88}
.gr-table.hk{background:linear-gradient(180deg,#f4d699,#e8c27f);border-color:#ff2e88}
.gr-table .goal{left:40px;top:-2px;width:40px;height:5px;background:#ff2e88;border-radius:3px}
.gr-ball{left:70px;top:20px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff;animation:gr-ball 2.4s linear infinite}
.gr-pad{left:56px;top:72px;width:38px;height:7px;border-radius:4px;background:#ffcc33;animation:gr-pad 2.4s ease-in-out infinite}
.gr-f.dragf{left:66px;top:76px;animation:gr-pad 2.4s ease-in-out infinite}
.gr-puck{left:70px;top:40px;width:14px;height:14px;border-radius:50%;background:#ff8fc8;border:2px solid #1d1420;animation:gr-puck 2.4s ease-in infinite}
.gr-mallet{left:62px;top:62px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#555 0 30%,#222 32%);border:3px solid #1d1420;animation:gr-mallet 2.4s ease-in-out infinite}
.gr-f.drag2f{left:66px;top:82px;animation:gr-mallet 2.4s ease-in-out infinite}
.gr-svg{left:0;top:0;width:100%;height:100%}
.gr-trail{stroke-dasharray:240;stroke-dashoffset:240;filter:drop-shadow(0 0 4px currentColor);animation:gr-trail 2.6s linear infinite}
.gr-trail.b{animation-delay:-1.1s}
.gr-arr{right:8px;top:6px;font:900 1.4rem "Barlow Condensed",sans-serif;color:#2ef2ff;animation:gr-arr 2.6s steps(1) infinite}
.gr-f.swipef{left:60px;top:56px;animation:gr-swipe 2.6s ease-in-out infinite}
.gr-easel{left:30px;top:8px;width:90px;height:72px;background:#fffdf5;border-radius:6px;border:3px solid #8a5a2b}
.gr-ink{stroke-dasharray:330;stroke-dashoffset:330;animation:gr-ink 3s linear infinite}
.gr-guess{left:6px;bottom:4px;background:#3ccf8e;color:#1d1420;font-weight:900;font-size:.8rem;border-radius:8px;padding:0 6px;animation:gr-appear2 3s infinite}
.gr-tm{right:6px;bottom:4px;font-size:.75rem;font-weight:800;color:#fff}
.gr-f.drawf{left:40px;top:60px;animation:gr-drawf 3s linear infinite}
.gr-bub.big{left:6px;top:8px;font-size:.78rem;max-width:138px;white-space:normal;line-height:1.1;animation:none;padding:3px 8px}
.gr-ban{left:10px;top:52px;background:#e63946;color:#fff;font-weight:900;font-size:.8rem;border-radius:6px;padding:1px 6px;text-decoration:line-through}
.gr-bz{right:10px;top:46px;font:400 1.2rem "Anton",Impact,sans-serif;color:#ff5a5f;animation:gr-bz 3s steps(1) infinite}
.gr-ok{right:8px;bottom:6px;background:#3ccf8e;color:#1d1420;font-weight:900;font-size:.8rem;border-radius:6px;padding:1px 6px;animation:gr-appear2 3s infinite;animation-delay:-1.5s}
.gr-deck{left:16px;top:18px;width:40px;height:58px;border-radius:7px;background:repeating-linear-gradient(45deg,#2b2b33 0 5px,#3a3a46 5px 10px);border:3px solid #fff;box-shadow:3px 3px 0 #0008}
.gr-cd{left:16px;top:18px;width:40px;height:58px;border-radius:7px;background:var(--cc);border:3px solid #fff;display:grid;place-items:center;box-shadow:3px 3px 0 #0008;animation:gr-deal var(--d) ease-in-out infinite}
.gr-cd b{position:static;font:400 1.6rem "Anton",Impact,sans-serif;color:#fff;text-shadow:2px 2px 0 #0008}
.gr-cd.c2{animation-delay:calc(var(--d) / -2)}
.gr-uno{right:4px;top:4px;font:400 1rem "Anton",Impact,sans-serif;color:#ffcc33;transform:rotate(-8deg);text-shadow:2px 2px 0 #e63946;animation:gr-pulse .6s ease-in-out infinite alternate}
.gr-cactus{left:8px;bottom:2px;font-size:30px}
.gr-wait{left:60px;top:16px;font:900 2rem "Barlow Condensed",sans-serif;color:#fff;animation:gr-q1 var(--d) steps(1) infinite}
.gr-fire{left:28px;top:20px;font:400 1.6rem "Anton",Impact,sans-serif;color:#1d1420;background:#ffcc33;padding:0 8px;border-radius:6px;animation:gr-q2 var(--d) steps(1) infinite}
.gr-ms{right:8px;bottom:8px;font-weight:900;color:#3ccf8e;animation:gr-q3 var(--d) steps(1) infinite}
.gr-f.quickf{animation:gr-quickf var(--d) ease-in-out infinite}
.gr-gauge{left:12px;top:22px;width:126px;height:16px;border-radius:8px;background:#0008;border:2px solid #ffffff55;overflow:hidden}
.gr-gauge .zone{left:76px;top:0;width:26px;height:100%;background:#3ccf8e}
.gr-gauge .cur{left:0;top:-2px;width:5px;height:20px;background:#fff;box-shadow:0 0 6px #fff;animation:gr-cur 2.4s linear infinite}
.gr-pop{left:78px;top:2px;font-weight:900;color:#3ccf8e;font-size:.9rem;animation:gr-popkg 2.4s ease-out infinite}
.gr-ico.bar{left:20px;top:48px;animation:gr-pump 1.2s ease-in-out infinite alternate}
.gr-f.gaugef{animation:gr-gaugef 2.4s linear infinite}
.gr-bub.q{left:6px;right:6px;top:6px;white-space:normal;text-align:center;font-size:.72rem;line-height:1.1;animation:none}
.gr-faces.v{top:40px}
.gr-faces .pick{animation:gr-pick var(--d) infinite}
.gr-letter{left:10px;top:10px;width:36px;height:36px;border-radius:50%;background:#ffcc33;color:#1d1420;display:grid;place-items:center;font:400 1.5rem "Anton",Impact,sans-serif;border:3px solid #1d1420}
.gr-field{left:52px;top:12px;width:88px;height:32px;background:#fffdf5;border-radius:6px;border:2px solid #9ec5ff}
.gr-field .lbl{left:4px;top:1px;font-size:.6rem;font-weight:800;color:#e63946;text-transform:uppercase}
.gr-field .txt{left:4px;top:12px;font-weight:800;font-size:.95rem;color:#1d3a8a;white-space:nowrap;overflow:hidden;width:0;animation:gr-typing var(--d) steps(6) infinite}
.gr-stop{left:12px;top:58px;background:#e63946;color:#fff;font:400 1.1rem "Anton",Impact,sans-serif;border-radius:8px;padding:0 8px;border:2px solid #1d1420;animation:gr-pulse .5s ease-in-out infinite alternate}
.gr-f.typef{animation:gr-mash .2s ease-in-out infinite alternate}
.gr-lanes{left:6px;right:6px;top:8px;height:34px;border-radius:8px;background:repeating-linear-gradient(90deg,#c0392b 0 18px,#a93226 18px 36px)}
.gr-lanes span{top:4px;font-size:22px;line-height:1}
.gr-lanes .r1{left:4px;animation:gr-run 2.4s linear infinite}
.gr-lanes .baton{left:30px;top:10px;font-size:14px;animation:gr-run 2.4s linear infinite}
.gr-lanes .r2{right:8px;transform:scaleX(-1)}
.gr-tasks{left:10px;top:52px;display:flex;gap:10px;font-size:22px;position:absolute}
.gr-tasks span{position:relative;opacity:.35;animation:gr-task 2.4s steps(1) infinite}
.gr-tasks span:nth-child(2){animation-delay:.8s}.gr-tasks span:nth-child(3){animation-delay:1.6s}
.gr-hands{left:0;right:0;top:8px;height:50px;position:absolute;font-size:38px;line-height:1}
.gr-hands span{left:56px;top:2px;opacity:0;animation:gr-hand 1.8s steps(1) infinite}
.gr-hands span:nth-child(2){animation-delay:.6s}.gr-hands span:nth-child(3){animation-delay:1.2s}
.gr-chi{left:10px;bottom:6px;font:400 1.05rem "Anton",Impact,sans-serif;color:#ffcc33;text-shadow:2px 2px 0 #e63946;animation:gr-pulse .6s ease-in-out infinite alternate}
.gr-lad{left:8px;top:8px;width:18px;height:80px;border-radius:9px;background:linear-gradient(#ff2d6f,#f5b52e 50%,#4b4468)}
.gr-lad i{left:1px;font-style:normal;font-size:13px;line-height:1}.gr-lad .h{top:2px}.gr-lad .s{bottom:2px}
.gr-sc{left:32px;width:108px;height:23px;border-radius:7px;border:2px solid #1d1420;background:var(--cc);color:#fff;font:400 .78rem/19px "Anton",Impact,sans-serif;padding-left:5px;white-space:nowrap;text-transform:uppercase;box-shadow:0 2px 0 #1d1420}
.gr-sc.a{top:9px;animation:gr-sorta var(--d) ease-in-out infinite}.gr-sc.b{top:37px;animation:gr-sorta var(--d) ease-in-out infinite}
.gr-sc.c{top:65px;z-index:3;animation:gr-sortc var(--d) ease-in-out infinite}
.gr-ill.gr-k-sort{--d:3s}
.gr-f.sortf{animation:gr-sortc var(--d) ease-in-out infinite}
@keyframes gr-sortc{0%,15%{transform:translateY(0)}55%,88%{transform:translateY(-56px)}100%{transform:translateY(0)}}
@keyframes gr-sorta{0%,28%{transform:translateY(0)}48%,88%{transform:translateY(28px)}100%{transform:translateY(0)}}
@keyframes gr-tapmove{0%{transform:translate(34px,30px);opacity:0}15%{opacity:1}35%{transform:translate(0,0)}42%{transform:translate(0,4px) scale(.9)}50%,80%{transform:translate(0,0);opacity:1}100%{transform:translate(34px,30px);opacity:0}}
@keyframes gr-drop{0%,42%{transform:translateY(-52px);opacity:0}44%{opacity:1;transform:translateY(-52px)}62%{transform:translateY(0)}68%{transform:translateY(-5px)}74%,88%{transform:translateY(0);opacity:1}100%{opacity:0}}
@keyframes gr-appear{0%,40%{transform:scale(0);opacity:0}48%{transform:scale(1.3);opacity:1}55%,88%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes gr-appear2{0%,55%{opacity:0;transform:scale(.6)}62%,92%{opacity:1;transform:scale(1)}100%{opacity:0}}
@keyframes gr-mash{from{transform:translateY(-6px)}to{transform:translateY(3px) scale(.92)}}
@keyframes gr-btn{from{transform:translateY(0);box-shadow:0 5px 0 #1d1420}to{transform:translateY(3px);box-shadow:0 2px 0 #1d1420}}
@keyframes gr-fill{from{height:10%}to{height:100%}}
@keyframes gr-pump{from{transform:translateY(0) scale(1)}to{transform:translateY(-3px) scale(1.12)}}
@keyframes gr-catch{0%,70%{transform:translateY(-20px);opacity:0}80%,95%{transform:translateY(8px);opacity:1}100%{opacity:0}}
@keyframes gr-beat{0%{background:#ffcc33;box-shadow:0 0 10px #ffcc33;transform:scale(1.3)}25%,100%{background:#ffffff26;box-shadow:none;transform:scale(1)}}
@keyframes gr-beatf{0%{transform:translateY(4px) scale(.9)}30%,100%{transform:translateY(-6px)}}
@keyframes gr-hisse{0%{transform:scale(1.25)}40%,100%{transform:scale(1)}}
@keyframes gr-knot{0%,100%{transform:translateX(-10px)}50%{transform:translateX(26px)}}
@keyframes gr-ball{0%{transform:translate(0,0)}25%{transform:translate(40px,26px)}50%{transform:translate(-10px,50px)}75%{transform:translate(-50px,22px)}100%{transform:translate(0,0)}}
@keyframes gr-pad{0%,100%{transform:translateX(-36px)}50%{transform:translateX(30px)}}
@keyframes gr-puck{0%,30%{transform:translate(0,0)}60%{transform:translate(4px,-38px)}61%,100%{transform:translate(4px,-38px);opacity:0}}
@keyframes gr-mallet{0%{transform:translate(-30px,6px)}30%{transform:translate(4px,-8px)}55%{transform:translate(8px,-14px)}100%{transform:translate(-30px,6px)}}
@keyframes gr-trail{0%{stroke-dashoffset:240}80%,100%{stroke-dashoffset:0}}
@keyframes gr-arr{0%{content:"→";transform:rotate(90deg)}25%{transform:rotate(0)}50%{transform:rotate(90deg)}75%{transform:rotate(180deg)}}
@keyframes gr-swipe{0%,100%{transform:translate(0,0)}20%{transform:translate(0,-26px)}40%{transform:translate(0,0)}60%{transform:translate(32px,0)}80%{transform:translate(0,0)}}
@keyframes gr-ink{0%{stroke-dashoffset:330}75%,100%{stroke-dashoffset:0}}
@keyframes gr-drawf{0%{transform:translate(0,0)}15%{transform:translate(16px,-34px)}30%{transform:translate(40px,-34px)}45%{transform:translate(66px,-34px)}60%{transform:translate(64px,0)}75%,100%{transform:translate(4px,0)}}
@keyframes gr-bz{0%,45%{opacity:0}50%,60%{opacity:1;transform:scale(1.2)}65%,100%{opacity:0}}
@keyframes gr-deal{0%,20%{transform:translate(0,0) rotateY(90deg)}30%{transform:translate(0,0) rotateY(0)}55%,85%{transform:translate(70px,0) rotate(6deg)}100%{transform:translate(70px,0) rotate(6deg);opacity:0}}
@keyframes gr-q1{0%{opacity:1}45%,100%{opacity:0}}
@keyframes gr-q2{0%{opacity:0}45%{opacity:1}100%{opacity:1}}
@keyframes gr-q3{0%{opacity:0}60%{opacity:1}100%{opacity:1}}
@keyframes gr-quickf{0%,44%{transform:translate(20px,20px)}52%{transform:translate(0,4px) scale(.9)}60%,100%{transform:translate(0,0)}}
@keyframes gr-cur{0%,100%{transform:translateX(0)}50%{transform:translateX(118px)}}
@keyframes gr-gaugef{0%,31%,43%,57%,69%,100%{transform:translateY(-6px)}37%,63%{transform:translateY(3px) scale(.92)}}
@keyframes gr-popkg{0%,36%,50%,62%,76%,100%{opacity:0;transform:translateY(6px)}40%,66%{opacity:1;transform:translateY(0)}48%,74%{opacity:.6;transform:translateY(-8px)}}
@keyframes gr-pick{0%,42%{transform:none}48%,90%{transform:scale(1.25);filter:drop-shadow(0 0 6px #3ccf8e)}}
@keyframes gr-typing{0%{width:0}70%,100%{width:64px}}
@keyframes gr-flip{0%,45%{transform:rotateX(0)}60%,90%{transform:rotateX(80deg);opacity:.4}100%{transform:rotateX(0)}}
@keyframes gr-facef{0%{transform:translate(30px,20px);opacity:0}20%{opacity:1}35%{transform:translate(0,0)}42%{transform:translate(0,4px) scale(.9)}50%{transform:translate(0,0)}65%{transform:translate(-36px,0)}72%{transform:translate(-36px,4px) scale(.9)}80%{transform:translate(-36px,0);opacity:1}100%{transform:translate(30px,20px);opacity:0}}
@keyframes gr-chkmv{0%,42%{transform:translate(0,0)}62%,90%{transform:translate(36px,-36px)}100%{transform:translate(36px,-36px);opacity:0}}
@keyframes gr-chkf{0%{transform:translate(20px,20px);opacity:0}15%{opacity:1}25%{transform:translate(0,0)}30%{transform:translate(0,3px) scale(.9)}36%{transform:translate(0,0)}52%{transform:translate(38px,-40px)}58%{transform:translate(38px,-37px) scale(.9)}66%,85%{transform:translate(38px,-40px);opacity:1}100%{opacity:0}}
@keyframes gr-run{from{transform:translateX(0)}to{transform:translateX(96px)}}
@keyframes gr-task{0%{opacity:1;transform:scale(1.2)}33%,100%{opacity:.35;transform:scale(1)}}
@keyframes gr-hand{0%{opacity:1;transform:scale(1.1) rotate(-8deg)}33%,100%{opacity:0}}
@keyframes gr-pulse{from{transform:scale(1)}to{transform:scale(1.08)}}
/* carte pendant l'écran « C'est parti » */
.gr-hold{display:block;margin-top:10px;text-align:left}
.gr-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;margin-top:10px}
.gr-actions .gk-btn{font-size:1.2rem}
.gr-timer{font-weight:800;color:var(--dim,#b9aec6);font-size:.95rem}
.gr-mini{display:flex;align-items:center;gap:8px;background:#0004;border:2px solid #ffffff22;border-radius:14px;padding:8px 10px;font-weight:700;color:var(--text,#fff);text-align:left}
.gr-mini .gr-pe{font-size:1.5rem;flex:none}
.gr-mini b{font-family:"Anton",Impact,sans-serif;font-weight:400;text-transform:uppercase;margin-right:4px}
.gr-waitmsg{margin-top:10px;text-align:center;font-weight:800;font-size:1.1rem;color:var(--gold,#ffcc33)}
.gr-waitmsg .dots::after{content:"";animation:gr-dots 1.2s steps(4) infinite}
@keyframes gr-dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
.ov-card.gr-on .versus{margin:6px 0}
.ov-card.gr-on .versus figure{max-width:24vw}
.ov-card.gr-on .announce{display:none}
.ov-card.gr-on .h2h,.ov-card.gr-on .h2h-note{display:none}
.ov-card.gr-on>p:first-child{margin:0}
@media (max-height:820px){.ov-card.gr-on .versus figure{max-width:17vw}.ov-card.gr-on .versus .vs{font-size:1.6rem}}
/* le bouton « J'ai compris » reste toujours visible (bas de la fenêtre qui défile) */
.ov-card.gr-on .gr-actions{position:sticky;bottom:-20px;z-index:2;margin:10px -20px -20px;padding:10px 12px 14px;background:linear-gradient(180deg,transparent,var(--panel) 30%)}
.ov-card.gr-on h2{font-size:clamp(1.6rem,6vw,2.6rem)}
/* « ? » : la carte par-dessus le jeu */
.gr-modal{position:fixed;inset:0;z-index:245;display:grid;place-items:center;padding:16px;background:rgba(10,6,14,.8);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:gr-fade .2s ease-out}
.gr-sheet{width:min(100%,520px);max-height:calc(100vh - 32px);overflow:auto;display:grid;gap:12px;justify-items:center;background:var(--panel,#231b2b);border:4px solid #1d1420;border-radius:22px;padding:14px;box-shadow:0 0 0 3px var(--gold,#ffcc33);animation:gr-pop .3s cubic-bezier(.2,1.5,.4,1)}
.gr-sheet .gr-card{width:100%}
@keyframes gr-fade{from{opacity:0}}
@keyframes gr-pop{from{transform:scale(.8);opacity:0}}
`;
(function injectCss() {
  if (document.getElementById("gr-css")) return;
  const s = document.createElement("style"); s.id = "gr-css"; s.textContent = CSS; document.head.appendChild(s);
})();

/* ---------- infos jeu (nom, lieu, joueurs) ---------- */
function info(id) {
  const g = G.lobby && G.lobby.game ? G.lobby.game(id) : null;
  if (g) return g;
  const d = (G.games || []).find(x => x.id === id) || {id, name: id, min: 2, max: 2};
  return {id, name: d.name, min: d.min, max: d.max, teams: !!d.teams, emoji: "🎮"};
}
const nbTxt = g => (g.teams ? "2 équipes · " : "") + (g.min === g.max ? `${g.min} joueurs` : `${g.min} à ${g.max}`);
function cardHtml(id) {
  const r = R[id]; if (!r) return "";
  const g = info(id);
  return `<div class="gr-card" data-gr="${esc(id)}"><div class="gr-kick">⏱ Règles en 10 secondes</div>
    <div class="gr-head"><span class="gr-pe" aria-hidden="true">${g.emoji || "🎮"}</span><b>${esc(g.name)}</b><span class="gr-np">👥 ${esc(nbTxt(g))}</span></div>
    <div class="gr-body"><div class="gr-ill gr-k-${r.k}" aria-hidden="true">${ILL[r.k](r.o || {})}</div><ol class="gr-ls">${r.l.map(x => `<li>${x}</li>`).join("")}</ol></div></div>`;
}
const miniHtml = id => { const r = R[id], g = info(id); return r ? `<div class="gr-mini"><span class="gr-pe" aria-hidden="true">${g.emoji || "🎮"}</span><span><b>${esc(g.name)}</b>${esc(r.s)}</span></div>` : ""; };

/* ---------- « déjà vu » (par profil) ---------- */
let memSeen = [];
function seenList() {
  const p = G.lobby && G.lobby.profile ? G.lobby.profile() : null;
  if (p) { if (!Array.isArray(p.rulesSeen)) p.rulesSeen = []; return p.rulesSeen; }
  return memSeen;
}
const seen = id => seenList().includes(id);
function markSeen(id) {
  if (!R[id] || seen(id)) return;
  seenList().push(id);
  if (G.lobby && G.lobby.saveProfile) G.lobby.saveProfile();
  if (G.lobby && G.lobby.pushPresence) G.lobby.pushPresence();
}
function mask() { let m = 0; ORDER.forEach((id, i) => { if (seen(id)) m |= 1 << i; }); return m.toString(36); }
const hasBit = (m, id) => { const i = ORDER.indexOf(id); if (i < 0) return true; const n = parseInt(m, 36); return isFinite(n) && !!(n & (1 << i)); };
let readyM = null;

/* ---------- hôte du lobby ---------- */
// À la création d'un match : qui doit lire la carte ? (présence sans `rs` = ancien client : on ne l'attend pas)
// viaDebug : partie lancée par GONFLETTE.debug.launch (tests) → pas d'attente, sauf si GONFLETTE.rules.onDebugLaunch = true.
function onNewMatch(M, grp, viaDebug) {
  if (!R[M.g] || (viaDebug && !G.rules.onDebugLaunch)) return;
  const rw = grp.filter(p => p.presence && typeof p.presence.rs === "string" && !hasBit(p.presence.rs, M.g)).map(p => p.peer);
  if (rw.length) M.rw = rw;
}
// Pendant l'attente : tout le monde prêt (ou parti), ou délai dépassé → on relance le 3-2-1 normal à partir de maintenant.
function hostStep(M, now, peers) {
  if (!M.rw) return null;
  const pr = new Map((peers || []).map(p => [p.peer, p.presence || {}]));
  const ready = M.rw.every(k => !pr.has(k) || pr.get(k).rd === M.mid);
  if (!ready && now - M.at <= WAIT_MS) return null;
  const c = Object.assign({}, M, {at: now}); delete c.rw;
  return c;
}

/* ---------- écran « C'est parti » ---------- */
const shownFor = {};
function names(list) { return list.length <= 1 ? list.join("") : list.slice(0, -1).join(", ") + " et " + list[list.length - 1]; }
function wait(M, el) {
  const L = G.lobby || {}, me = L.myPeer ? L.myPeer() : null, gid = M.g;
  if (!M.rw || !R[gid]) { if (shownFor[M.mid]) { markSeen(gid); delete shownFor[M.mid]; } return false; }
  if (!el) return false;
  shownFor[M.mid] = gid;
  const card = el.closest(".ov-card"); if (card) card.classList.add("gr-on");
  if (M.rw.includes(me) && seen(gid) && readyM !== M.mid) { readyM = M.mid; if (L.pushPresence) L.pushPresence(); }
  let mode = null, iv = null;
  const mustRead = () => M.rw.includes(me) && readyM !== M.mid;
  const left = () => Math.max(0, Math.ceil((M.at + WAIT_MS - (L.hostNow ? L.hostNow() : Date.now())) / 1000));
  function render() {
    mode = mustRead() ? "read" : "wait";
    el.className = "gr-hold"; // (pas « cd » : ses grands chiffres ne doivent pas s'appliquer à la carte)
    el.innerHTML = mode === "read"
      ? `${cardHtml(gid)}<div class="gr-actions"><button class="gk-btn good big" type="button" data-gr-ok>J'ai compris ✓</button><span class="gr-timer">⏱ <span data-gr-left>${left()}</span> s</span></div>`
      : `${miniHtml(gid)}<div class="gr-waitmsg" data-gr-msg></div>`;
    update();
  }
  function update() {
    if (!el.isConnected) { clearInterval(iv); return; }
    if (mode === "read") { const s = el.querySelector("[data-gr-left]"); if (s) s.textContent = left(); return; }
    const peers = L.peers ? L.peers() : [], byK = new Map(peers.map(p => [p.peer, p.presence || {}]));
    const pending = M.rw.filter(k => (k === me ? readyM !== M.mid : byK.has(k) && byK.get(k).rd !== M.mid));
    const nm = pending.map(k => (M.ro[k] && M.ro[k].p) || "?");
    const m = el.querySelector("[data-gr-msg]"); if (!m) return;
    const txt = nm.length ? `En attente : ${esc(names(nm))} ${nm.length > 1 ? "lisent" : "lit"} les règles<span class="dots"></span> (${left()} s)` : `Tout le monde est prêt<span class="dots"></span>`;
    if (m.dataset.t !== txt) { m.dataset.t = txt; m.innerHTML = txt; }
  }
  el.onclick = e => {
    if (!e.target.closest("[data-gr-ok]")) return;
    readyM = M.mid; markSeen(gid);
    if (L.pushPresence) L.pushPresence();
    if (G.kit) { G.kit.sfx("tap"); G.kit.haptic("light"); }
    render();
  };
  render();
  iv = setInterval(update, 250);
  return true;
}

/* ---------- « ? » : rouvrir la carte n'importe quand ---------- */
let modal = null;
function close() { if (modal) { modal.remove(); modal = null; removeEventListener("keydown", onKey); } }
function onKey(e) { if (e.key === "Escape") close(); }
function open(id) {
  if (!R[id]) return false;
  close();
  modal = document.createElement("div");
  modal.className = "gr-modal";
  modal.innerHTML = `<div class="gr-sheet" role="dialog" aria-modal="true" aria-label="Règles : ${esc(info(id).name)}">${cardHtml(id)}<button class="gk-btn big" type="button" data-gr-close>OK, on y va ! ✓</button></div>`;
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-gr-close]")) close(); });
  addEventListener("keydown", onKey);
  document.body.appendChild(modal);
  const b = modal.querySelector("[data-gr-close]"); if (b) b.focus();
  markSeen(id);
  return true;
}
// une partie qui se termine ferme la carte restée ouverte
if (G.kit) G.kit.on("game:end", close);

G.rules = {onDebugLaunch: false, has: id => !!R[id], ids: ORDER.slice(), data: R, cardHtml, miniHtml, open, close, wait, onNewMatch, hostStep,
  mask, readyMid: () => readyM, seen, markSeen, WAIT_MS,
  reset() { const l = seenList(); l.length = 0; if (G.lobby && G.lobby.saveProfile) G.lobby.saveProfile(); if (G.lobby && G.lobby.pushPresence) G.lobby.pushPresence(); }};
})();
