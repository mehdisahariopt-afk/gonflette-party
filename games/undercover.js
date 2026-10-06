/* Gonflette Party : Undercover (3 à 8 joueurs, chacun sur son téléphone).
   Jeu de déduction sociale, ambiance film noir / dossier d'espionnage.
   Les civils reçoivent le mot A, 1 Undercover (2 à partir de 7 joueurs) reçoit le mot B, proche.
   À partir de 5 joueurs, un Mister White ne reçoit aucun mot (et le sait).
   Manche : chaque survivant tape un indice à son tour (30 s), puis tout le monde vote (égalité : un second vote
   entre les ex aequo, puis tirage au sort). Le rôle de l'éliminé est révélé ; Mister White éliminé peut deviner
   le mot des civils pour gagner seul.
   L'état publié contient l'index de la paire et les rôles (légèrement brouillés) : rien n'est affiché aux autres.
   Tests : window.__ucSpeed = 10 accélère les durées (lu par l'hôte, et localement pour les animations). */
(function () {
"use strict";

/* ================= PAIRES DE MOTS ================= */
const RAW = `plage|piscine
chat|lion
café|thé
pizza|quiche
Batman|Spider-Man
avion|hélicoptère
croissant|pain au chocolat
vélo|trottinette
guitare|violon
Harry Potter|Gandalf
football|rugby
tennis|badminton
ski|snowboard
mer|lac
montagne|colline
pomme|poire
orange|mandarine
fraise|framboise
citron|pamplemousse
vin|bière
champagne|cidre
chien|loup
cheval|âne
dauphin|requin
crocodile|lézard
abeille|guêpe
papillon|libellule
hibou|chauve-souris
train|métro
bus|tramway
voiture|moto
bateau|sous-marin
fusée|satellite
lune|soleil
étoile|planète
pluie|neige
orage|tempête
été|printemps
Noël|Halloween
anniversaire|mariage
école|université
professeur|directeur
médecin|infirmier
pompier|policier
boulanger|pâtissier
cuisinier|serveur
dentiste|coiffeur
cinéma|théâtre
musée|bibliothèque
restaurant|cantine
hôpital|pharmacie
église|château
Paris|Londres
Marseille|Nice
France|Belgique
Italie|Espagne
Japon|Chine
Tour Eiffel|Arc de triomphe
Mario|Sonic
Mickey|Donald
Superman|Iron Man
Astérix|Obélix
Tintin|Lucky Luke
Shrek|Hulk
Dark Vador|Voldemort
Cendrillon|Blanche-Neige
Le Roi Lion|Le Livre de la jungle
Star Wars|Star Trek
James Bond|Indiana Jones
Sherlock Holmes|Hercule Poirot
piano|accordéon
batterie|trompette
rap|rock
karaoké|discothèque
chocolat|caramel
glace|sorbet
gâteau|tarte
crêpe|gaufre
hamburger|hot-dog
frites|chips
sushi|nems
raclette|fondue
couscous|paella
spaghetti|lasagnes
soupe|purée
fromage|yaourt
beurre|confiture
sel|poivre
ketchup|mayonnaise
lait|jus d'orange
eau|soda
lit|canapé
table|bureau
chaise|tabouret
fenêtre|porte
cuisine|salle de bains
frigo|four
lampe|bougie
douche|baignoire
téléphone|tablette
ordinateur|télévision
Facebook|Instagram
YouTube|Netflix
WhatsApp|Snapchat
Google|Wikipédia
lunettes|lentilles
montre|bracelet
bague|collier
chapeau|casquette
écharpe|cravate
chaussettes|chaussons
jean|jogging
robe|jupe
parapluie|imperméable
valise|sac à dos
tente|caravane
forêt|jungle
désert|banquise
volcan|séisme
rivière|cascade
arbre|buisson
rose|tulipe
tournesol|marguerite
carotte|radis
tomate|poivron
pomme de terre|patate douce
dragon|dinosaure
vampire|zombie
sorcière|fée
fantôme|squelette
pirate|viking
chevalier|samouraï
roi|président
princesse|reine
cowboy|shérif
clown|mime
magicien|hypnotiseur
cirque|fête foraine
Disneyland|Parc Astérix
zoo|aquarium
sauna|hammam
yoga|méditation
boxe|judo
natation|plongée
marathon|triathlon
basket|handball
golf|mini-golf
échecs|dames
poker|belote
Monopoly|Scrabble
puzzle|Lego
poupée|peluche
ballon|frisbee
Père Noël|lapin de Pâques
cadeau|carte postale
bisou|câlin
rêve|cauchemar
rire|sourire
brosse à dents|dentifrice
savon|shampoing
stylo|crayon
cahier|agenda
ciseaux|couteau
marteau|tournevis
clé|cadenas
aspirateur|balai
boulangerie|supermarché
camping|hôtel
Mbappé|Zidane
Beyoncé|Rihanna
Mozart|Beethoven
Picasso|Van Gogh
Napoléon|Louis XIV
Einstein|Newton
vacances|week-end
réveil|horloge
miel|sirop d'érable
escargot|limace
pingouin|phoque
girafe|zèbre
éléphant|hippopotame
kangourou|koala
serpent|ver de terre
araignée|fourmi
poule|canard
vache|chèvre
mouton|lama
lapin|hamster
perroquet|pigeon
moustique|mouche`;
const PAIRS = RAW.split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(s => s.trim()));

/* ================= OUTILS ================= */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function lev(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 1) return 2;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/* la proposition de Mister White est-elle le mot ? (accents, pluriel et une faute de frappe tolérés) */
function sameWord(g, w) {
  const a = norm(g), b = norm(w);
  if (!a || !b) return false;
  if (a === b || a.replace(/s$/, "") === b.replace(/s$/, "")) return true;
  return b.length >= 6 && lev(a, b) <= 1;
}
/* un indice qui contient son propre mot est censuré */
const leaks = (clue, word) => { const a = norm(clue), b = norm(word); return !!a && !!b && (sameWord(clue, word) || (b.length >= 3 && a.includes(b))); };
const cleanText = (t, max) => String(t || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ROLE = ["CIVIL", "UNDERCOVER", "MISTER WHITE"];
const ROLE_SHORT = ["Civil", "Undercover", "Mr White"];

/* ================= SON (WebAudio, après un geste) ================= */
function makeSound() {
  let ctx = null, master = null;
  const ok = () => ctx && ctx.state === "running";
  function unlock() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination); } catch (e) { ctx = null; }
  }
  function tone(freq, dur, o) {
    if (!ok()) return; o = o || {};
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || .3, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .05);
  }
  function noise(dur, at, vol, hp) {
    if (!ok()) return;
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = hp || 1200; g.gain.value = vol || .25;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(master); src.start(ctx.currentTime + (at || 0));
  }
  return {
    unlock,
    keys(n) { for (let i = 0; i < Math.min(n, 10); i++) noise(.03, i * .065, .18, 2500); },
    stamp() { tone(90, .25, {type: "triangle", to: 45, vol: .6}); noise(.12, 0, .3, 400); },
    sting() { tone(196, .9, {type: "sawtooth", vol: .12}); tone(233, .9, {type: "sawtooth", vol: .1, at: .02}); tone(277, 1.2, {type: "sawtooth", vol: .08, at: .5}); },
    tick() { tone(1400, .04, {type: "square", vol: .06}); },
    win() { [392, 494, 587, 784].forEach((f, i) => tone(f, .35, {type: "triangle", vol: .2, at: i * .12})); },
    close() { if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; } }
  };
}

/* ================= STYLE ================= */
const CSS = `
.uc{--ink:#16110e;--paper:#ece2c6;--manila:#d9b97a;--manila2:#c49c55;--red:#c41e2a;--red2:#ff3b47;--gold:#e8c26a;--smoke:#b9b1a3;
  position:relative;min-height:100%;display:flex;flex-direction:column;color:#efe6d2;font-family:"Barlow Condensed",system-ui,sans-serif;font-size:17px;
  background:repeating-linear-gradient(-24deg,rgba(255,236,190,.045) 0 26px,transparent 26px 54px),radial-gradient(120% 70% at 50% -10%,#3a2c22 0%,#15100d 55%,#070505 100%);
  background-color:#0b0807;-webkit-tap-highlight-color:transparent;overflow-x:hidden}
.uc *{box-sizing:border-box}
.uc button{font-family:inherit;color:inherit}
.uc-top{display:flex;align-items:center;gap:10px;padding:10px 16px 8px;border-bottom:1px solid rgba(232,194,106,.18);background:linear-gradient(#000a,#0000)}
.uc-file{flex:1;min-width:0;line-height:1.05}
.uc-file small{display:block;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);opacity:.8}
.uc-file b{display:block;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.25rem;letter-spacing:.03em;text-transform:uppercase;line-height:1.05;overflow-wrap:anywhere}
.uc-ts{font-family:Anton,Impact,"Arial Narrow",sans-serif;color:var(--red2);border:2px solid var(--red);padding:1px 6px;transform:rotate(-6deg);font-size:.8rem;letter-spacing:.12em;opacity:.85;flex:none}
.uc-clock{flex:none;min-width:58px;text-align:center;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:1.5rem;line-height:1;padding:6px 8px;border-radius:6px;background:#000;border:2px solid #3b2f25;color:var(--gold);font-variant-numeric:tabular-nums}
.uc-clock.urg{color:var(--red2);border-color:var(--red);animation:uc-pulse 1s infinite}
.uc-clock[hidden]{display:none}
@keyframes uc-pulse{50%{box-shadow:0 0 14px rgba(255,59,71,.7)}}
.uc-main{flex:1;padding:12px 16px 18px;display:flex;flex-direction:column;gap:14px}
.uc-scene{display:flex;flex-direction:column;gap:14px;animation:uc-in .4s ease-out}
@keyframes uc-in{from{opacity:0;transform:translateY(8px)}}
.uc-h{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.03em;margin:0;line-height:1.05;font-size:1.7rem}
.uc-lead{margin:0;font-size:1.08rem;color:var(--smoke);line-height:1.25}
.uc-lead b{color:#fff}
.uc-hand{font-family:Pacifico,cursive;color:var(--gold);font-size:1rem}

/* ---- tableau des suspects ---- */
.uc-line{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px 6px;padding:10px 6px 6px;border-radius:6px;
  background:repeating-linear-gradient(#0000 0 17px,rgba(232,194,106,.16) 17px 18px),linear-gradient(#211915,#120d0b);border:1px solid #3b2f25}
.uc-sus{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;transition:opacity .3s,filter .3s}
.uc-mug{position:relative;width:66px;height:66px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#5b4a3a,#1d1612 75%);border:2px solid #4a3b2f}
.uc-mug .av{width:100%;height:100%;display:block}
.uc-sus b{font-weight:700;font-size:.92rem;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.04em}
.uc-sus .no{position:absolute;top:-4px;left:4px;z-index:2;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:.72rem;background:var(--paper);color:var(--ink);padding:0 4px;border-radius:2px}
.uc-sus.hi .uc-mug{border-color:var(--gold);box-shadow:0 0 0 3px rgba(232,194,106,.25),0 0 26px rgba(255,220,140,.55)}
.uc-sus.hi::before{content:"";position:absolute;inset:-14px -6px auto;height:110px;background:radial-gradient(50% 60% at 50% 40%,rgba(255,232,170,.28),transparent 70%);pointer-events:none}
.uc-sus.hi b{color:var(--gold)}
.uc-sus small{font-size:.7rem;line-height:1;margin-top:-2px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);opacity:.85}
.uc-sus.out{opacity:.55}
.uc-sus.out .uc-mug{filter:grayscale(1) contrast(1.1)}
.uc-sus.out .uc-mug::after{content:"";position:absolute;inset:0;background:linear-gradient(45deg,transparent 46%,var(--red) 46% 54%,transparent 54%),linear-gradient(-45deg,transparent 46%,var(--red) 46% 54%,transparent 54%)}
.uc-tag{position:absolute;z-index:3;left:50%;bottom:-2px;transform:translateX(-50%) rotate(-8deg);font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:.62rem;letter-spacing:.06em;padding:0 4px;border:2px solid;background:#120d0b;white-space:nowrap;text-transform:uppercase}
.uc-tag.r0{color:#9fc3e0;border-color:#5f87a8}.uc-tag.r1{color:var(--red2);border-color:var(--red)}.uc-tag.r2{color:#fff;border-color:#fff}
.uc-tick{position:absolute;top:-4px;right:6px;z-index:2;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#2e7d4f;color:#fff;font-weight:800;font-size:.85rem;border:2px solid #0b0807;transform:scale(0);transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.uc-sus.done .uc-tick{transform:scale(1)}

/* ---- feuille de dépositions ---- */
.uc-paper{position:relative;color:var(--ink);background:linear-gradient(#0000 0 0),var(--paper);border-radius:3px;padding:14px 14px 12px;box-shadow:0 10px 30px rgba(0,0,0,.6);
  background-image:repeating-linear-gradient(#0000 0 27px,rgba(70,90,140,.18) 27px 28px);background-position:0 40px;transform:rotate(-.4deg)}
.uc-paper::before{content:"CONFIDENTIEL";position:absolute;right:10px;top:8px;font-family:Anton,Impact,"Arial Narrow",sans-serif;color:var(--red);border:2px solid var(--red);padding:0 5px;font-size:.75rem;letter-spacing:.14em;transform:rotate(5deg);opacity:.75}
.uc-paper h3{margin:0 0 6px;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;text-transform:uppercase;font-size:1.1rem;letter-spacing:.06em}
.uc-paper h4{margin:10px 0 2px;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;color:#7a5d3a}
.uc-paper ol{list-style:none;margin:0;padding:0}
.uc-paper li{display:flex;gap:8px;align-items:baseline;min-height:28px;border-bottom:1px dashed rgba(22,17,14,.12)}
.uc-paper .who{flex:none;width:34%;font-weight:700;text-transform:uppercase;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}
.uc-paper .cl{flex:1;min-width:0;font-size:1.25rem;font-weight:600;overflow-wrap:anywhere}
.uc-paper .cl i{font-weight:500;color:#6b5b48;font-size:1rem}
.uc-paper .cl s{color:var(--red);text-decoration:none;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:.95rem;letter-spacing:.1em}
.uc-paper .empty{color:#6b5b48;font-style:italic;margin:4px 0}
.uc-tw{display:inline-block;clip-path:inset(0 100% 0 0);animation:uc-type var(--d,.6s) steps(var(--s,8)) .15s forwards}
@keyframes uc-type{to{clip-path:inset(0 0 0 0)}}
.uc-caret{display:inline-block;width:.5em;height:1.05em;margin-left:3px;vertical-align:-2px;background:currentColor;animation:uc-blink 1s steps(1) infinite}
@keyframes uc-blink{50%{opacity:0}}

/* ---- saisie ---- */
.uc-form{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:6px;background:#1c1512;border:2px solid var(--gold);box-shadow:0 0 30px rgba(232,194,106,.15)}
.uc-form label{font-family:Anton,Impact,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.05em;font-size:1.15rem;color:var(--gold)}
.uc-row{display:flex;gap:8px}
.uc-in{flex:1;min-width:0;font:600 1.3rem "Barlow Condensed",system-ui,sans-serif;padding:10px 12px;border-radius:4px;border:2px solid #4a3b2f;background:var(--paper);color:var(--ink)}
.uc-in:focus{outline:3px solid var(--red2);outline-offset:1px}
.uc-btn{border:0;border-radius:4px;padding:10px 14px;font:400 1.1rem Anton,Impact,"Arial Narrow",sans-serif;letter-spacing:.06em;text-transform:uppercase;background:var(--red);color:#fff;cursor:pointer;box-shadow:0 4px 0 #6d0f16}
.uc-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #6d0f16}
.uc-btn:disabled{opacity:.5;cursor:default}
.uc-btn.ghost{background:transparent;color:var(--smoke);box-shadow:none;border:1px dashed #6b5b48;font:600 1rem "Barlow Condensed",system-ui,sans-serif;text-transform:none;letter-spacing:0}
.uc-err{min-height:1.2em;margin:0;color:var(--red2);font-weight:700}
.uc-wait{padding:12px 14px;border-left:4px solid var(--gold);background:rgba(0,0,0,.35);font-size:1.15rem}
.uc-wait b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;letter-spacing:.04em;text-transform:uppercase;color:var(--gold)}

/* ---- vote ---- */
.uc-mugs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.uc-card2{position:relative;display:flex;flex-direction:column;align-items:stretch;padding:0;border:2px solid #3b2f25;border-radius:4px;background:#1a1411;cursor:pointer;text-align:left;overflow:hidden;transition:transform .15s,border-color .2s}
.uc-card2:disabled{cursor:default}
.uc-card2 .pic{position:relative;height:118px;background:repeating-linear-gradient(#0000 0 15px,rgba(232,194,106,.18) 15px 16px),radial-gradient(circle at 50% 35%,#4c3d30,#17110e 75%);display:grid;place-items:end center;overflow:hidden}
.uc-card2 .pic .av{width:112px;height:112px;display:block}
.uc-card2 .plate{background:#000;color:#fff;padding:4px 8px;font-family:Anton,Impact,"Arial Narrow",sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-card2 .cls{padding:4px 8px 8px;font-size:.92rem;color:var(--smoke);line-height:1.2;min-height:2.4em}
.uc-card2 .cls span{display:inline-block;margin-right:6px;color:#efe6d2}
.uc-card2 .cls span+span{color:var(--smoke)}
.uc-card2.self{opacity:.65}
.uc-card2.nope{opacity:.3;filter:grayscale(1)}
.uc-card2.pick{border-color:var(--red2);transform:rotate(-1.2deg) scale(1.02);box-shadow:0 0 0 2px var(--red),0 10px 26px rgba(196,30,42,.45)}
.uc-card2 .mark{position:absolute;inset:6px 10px auto auto;font-family:Anton,Impact,"Arial Narrow",sans-serif;color:var(--red2);border:3px solid var(--red2);padding:1px 6px;transform:rotate(12deg) scale(0);opacity:0;transition:transform .25s cubic-bezier(.3,1.6,.5,1),opacity .2s;background:rgba(0,0,0,.5);letter-spacing:.06em;font-size:.95rem}
.uc-card2.pick .mark{transform:rotate(12deg) scale(1);opacity:1}
.uc-card2 .uc-tick{top:6px;left:6px;right:auto}
.uc-card2.done .uc-tick{transform:scale(1)}
.uc-card2 .ring{position:absolute;inset:auto 0 0;height:3px;background:var(--red2);transform:scaleX(0);transition:transform .3s}
.uc-card2.pick .ring{transform:scaleX(1)}
.uc-outs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.9rem;color:var(--smoke)}
.uc-outs .uc-sus{width:70px}
.uc-outs .uc-mug{width:48px;height:48px}

/* ---- dépouillement ---- */
.uc-tally{display:flex;flex-direction:column;gap:8px}
.uc-trow{display:flex;align-items:center;gap:10px;padding:6px 10px 6px 6px;background:rgba(0,0,0,.35);border:1px solid #3b2f25;border-radius:4px;animation:uc-in .4s both}
.uc-trow .uc-mug{width:48px;height:48px;flex:none}
.uc-trow .nm{flex:1;min-width:0}
.uc-trow .nm b{display:block;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-trow .nm small{display:block;color:var(--smoke);font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-trow .cnt{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:1.8rem;color:var(--gold);min-width:28px;text-align:right}
.uc-trow.top{border-color:var(--red);background:rgba(196,30,42,.16)}
.uc-trow.top .cnt{color:var(--red2)}
.uc-marks{display:flex;gap:3px;margin-top:2px}
.uc-marks i{width:3px;height:14px;background:var(--red2);transform:rotate(8deg)}
.uc-verdict{text-align:center;font-size:1.25rem;padding:10px;border:2px dashed var(--gold);color:#fff}
.uc-verdict b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;letter-spacing:.04em;text-transform:uppercase;color:var(--gold)}

/* ---- révélation ---- */
.uc-elim{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:18px 8px 26px;margin:0 -16px;overflow:hidden;
  background:radial-gradient(48% 40% at 50% 32%,rgba(255,236,190,.22),transparent 70%)}
.uc-elim .big{width:190px;height:190px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#5a4838,#140f0c 70%);border:3px solid #4a3b2f;animation:uc-zoom 1.4s ease-out both}
.uc-elim .big .av{width:100%;height:100%;display:block}
@keyframes uc-zoom{from{transform:scale(.8);filter:brightness(0)}}
.uc-was{margin:10px 0 0;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:2rem;text-transform:uppercase;letter-spacing:.03em;line-height:1.05;max-width:100%;overflow-wrap:anywhere}
.uc-was .uc-tw{--d:1s}
.uc-rstamp{display:inline-block;margin-top:8px;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:2.6rem;letter-spacing:.06em;padding:4px 14px;border:5px solid;border-radius:6px;text-transform:uppercase;
  animation:uc-slam .45s cubic-bezier(.2,1.5,.4,1) var(--at,1.7s) both;transform:rotate(-8deg);mix-blend-mode:screen}
.uc-rstamp.r0{color:#9fc3e0;border-color:#9fc3e0}
.uc-rstamp.r1{color:var(--red2);border-color:var(--red2);text-shadow:0 0 18px rgba(255,59,71,.6)}
.uc-rstamp.r2{color:#fff;border-color:#fff;text-shadow:0 0 18px rgba(255,255,255,.6)}
@keyframes uc-slam{from{transform:scale(3.2) rotate(-18deg);opacity:0}to{transform:scale(1) rotate(-8deg);opacity:1}}
.uc-after{margin:14px 0 0;color:var(--smoke);font-size:1.12rem;animation:uc-in .5s calc(var(--at,1.7s) + .4s) both}
.uc-flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,rgba(255,59,71,.5),transparent 70%);opacity:0;animation:uc-flash .7s var(--at,1.7s) both}
.uc-elim.r0 .uc-flash{background:radial-gradient(circle,rgba(159,195,224,.35),transparent 70%)}
.uc-elim.r2 .uc-flash{background:radial-gradient(circle,rgba(255,255,255,.4),transparent 70%)}
@keyframes uc-flash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
.uc-guessed{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:2.2rem;text-transform:uppercase;color:#fff;overflow-wrap:anywhere}

/* ---- fin ---- */
.uc-closed{align-self:center;white-space:nowrap;max-width:100%;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:clamp(1.4rem,8vw,2.2rem);color:var(--red2);border:5px double var(--red2);padding:2px 14px;transform:rotate(-6deg);letter-spacing:.06em;animation:uc-slam .5s cubic-bezier(.2,1.5,.4,1) .2s both}
.uc-win{text-align:center}
.uc-win .uc-h{font-size:2rem;color:var(--gold)}
.uc-words{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.uc-words div{background:var(--paper);color:var(--ink);padding:8px 10px;border-radius:3px;text-align:center}
.uc-words small{display:block;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#7a5d3a}
.uc-words b{display:block;font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;font-size:1.35rem;text-transform:uppercase;overflow-wrap:anywhere}
.uc-words .u b{color:var(--red)}
.uc-roster{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.uc-roster li{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;background:rgba(0,0,0,.35);border:1px solid #3b2f25;border-radius:4px;animation:uc-in .4s both}
.uc-roster li.w{border-color:var(--gold);background:rgba(232,194,106,.12)}
.uc-roster .uc-mug{width:46px;height:46px;flex:none}
.uc-roster .nm{flex:1;min-width:0;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-roster .nm small{display:block;font-weight:500;text-transform:none;color:var(--smoke)}
.uc-roster .uc-tag{position:static;transform:rotate(-4deg);font-size:.8rem}
.uc-roster .star{color:var(--gold);font-size:1.2rem}

/* ---- dossier secret (maintenir pour lire) ---- */
.uc-sec{position:sticky;bottom:0;z-index:20;padding:8px 16px calc(10px + env(safe-area-inset-bottom,0px));background:linear-gradient(#0000,#070505 35%)}
.uc-sec[hidden]{display:none}
.uc-card{position:relative;display:block;width:100%;padding:0;border:0;background:none;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;text-align:center}
.uc-card .in{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:#fbf6e6;color:var(--ink);border-radius:4px;
  background-image:repeating-linear-gradient(#0000 0 23px,rgba(70,90,140,.2) 23px 24px);border-top:6px solid var(--red)}
.uc-card .in small{font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:#7a5d3a}
.uc-card .in b{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.02em;line-height:1.05;overflow-wrap:anywhere;max-width:100%}
.uc-card .in em{font-style:normal;color:#5b4a3a;font-size:.95rem;line-height:1.15}
.uc-card .cov{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:4px;color:var(--ink);
  background:linear-gradient(170deg,#e4c88d,var(--manila) 45%,var(--manila2));box-shadow:0 6px 18px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.15);transition:transform .28s cubic-bezier(.4,0,.2,1)}
.uc-card .cov .st{font-family:Anton,Impact,"Arial Narrow",sans-serif;color:var(--red);border:3px solid var(--red);padding:0 7px;transform:rotate(-7deg);letter-spacing:.1em;opacity:.9;flex:none}
.uc-card .cov .hint{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.95rem}
.uc-card.open .cov{transform:translateY(calc(-100% + 14px))}
.uc-card.mini .in{min-height:76px;padding:8px 12px}
.uc-card.mini .in b{font-size:1.7rem}
.uc-card.mini .cov{min-height:60px}
.uc-card.mini.open .cov{transform:translateY(-82%)}
.uc-card.big{max-width:340px;margin:0 auto}
.uc-card.big .in{min-height:230px;padding:22px 16px}
.uc-card.big .in b{font-size:2.8rem}
.uc-card.big .cov{flex-direction:column;gap:14px}
.uc-card.big .cov .st{font-size:2rem;padding:2px 12px}
.uc-card.big .cov::before{content:"";position:absolute;left:18px;top:-14px;width:110px;height:18px;border-radius:6px 6px 0 0;background:#e4c88d}
.uc-card.big.open .cov{transform:translateY(calc(-100% - 8px)) rotate(-2deg)}
.uc-card:focus-visible{outline:3px solid var(--gold);outline-offset:4px}
.uc-deal{display:flex;flex-direction:column;gap:16px;padding-top:40px}
.uc-deal .uc-h{text-align:center}
.uc-note{text-align:center;color:var(--smoke);margin:0}
.uc-spec{text-align:center;color:var(--smoke);font-style:italic;margin:0}

@media (min-width:600px){.uc-main{max-width:560px;width:100%;margin:0 auto}.uc-mugs{grid-template-columns:repeat(3,1fr)}}
@media (prefers-reduced-motion:reduce){
  .uc *,.uc *::before,.uc *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
  .uc-tw{clip-path:none}
}`;

/* ================= JEU ================= */
GONFLETTE.registerGame({
  id: "undercover",
  name: "Undercover",
  min: 3,
  max: 8,
  create(api) {
    const el = api.el;
    const P = api.players, N = P.length;
    const mySeat = P.findIndex(p => p.key === api.me);
    const T = {deal: 40, clue: 30, vote: 45, tally: 5, elim: 6, guess: 30, gres: 4.5, end: 5};
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const spd = () => Math.max(1, Math.min(200, +window.__ucSpeed || 1));
    const snd = makeSound();
    let dead = false;
    const mask = i => hashStr(String(api.seed) + "|uc|" + i) % 3;
    const roleOf = (s, i) => s && s.r ? ((+s.r[i] - mask(i)) % 3 + 3) % 3 : 0;
    const civWord = s => PAIRS[s.w][s.sw];
    const ucWord = s => PAIRS[s.w][1 - s.sw];

    /* ================= HÔTE ================= */
    let hostInt = null;
    if (api.isHost) {
      const H = {ph: "init", n: 0, rd: 0, w: Math.floor(Math.random() * PAIRS.length), sw: Math.random() < .5 ? 0 : 1,
        role: [], o: P.map(() => 0), ec: 0, g: [], ord: [], ti: 0, c: [], t: 0, rdy: [], votes: {}, vc: null, rv: 0,
        vt: null, tie: null, el: -1, how: "", gs: "", gok: 0, win: "", ev: null};
      // distribution des rôles
      const seats = P.map((_, i) => i);
      for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
      const nU = N >= 7 ? 2 : 1, nM = N >= 5 ? 1 : 0;
      H.role = P.map(() => 0);
      seats.slice(0, nU).forEach(i => { H.role[i] = 1; });
      seats.slice(nU, nU + nM).forEach(i => { H.role[i] = 2; });
      const encRoles = H.role.map((r, i) => (r + mask(i)) % 3).join("");
      const wordOf = i => H.role[i] === 0 ? PAIRS[H.w][H.sw] : H.role[i] === 1 ? PAIRS[H.w][1 - H.sw] : "";
      const alive = () => P.map((_, i) => i).filter(i => !H.o[i]);
      const seen = {};
      let lastInputs = {};
      const seenAt = P.map(() => Date.now());
      const here = () => { const c = new Set(api.connected()), now = Date.now(); return P.map((p, i) => { if (c.has(p.key)) seenAt[i] = now; return now - seenAt[i] < 3000; }); };

      const pub = () => {
        const s = {ph: H.ph, n: H.n, rd: H.rd, w: H.w, sw: H.sw, r: encRoles, o: H.o, t: Math.max(0, Math.ceil(H.t)), c: H.c};
        if (H.g.length) s.g = H.g;
        if (H.ev) s.ev = H.ev;
        if (H.ph === "deal") s.rdy = H.rdy;
        if (H.ph === "clue") { s.ord = H.ord; s.ti = H.ti; }
        if (H.ph === "vote") { s.vd = Object.keys(H.votes).map(Number); if (H.vc) s.vc = H.vc; }
        if (H.ph === "tally") { s.vt = H.vt; s.tie = H.tie; s.el = H.el; s.how = H.how; if (H.vc) s.vc = H.vc; }
        if (H.ph === "elim" || H.ph === "guess") { s.el = H.el; s.how = H.how; }
        if (H.ph === "gres") { s.el = H.el; s.gs = H.gs; s.gok = H.gok; }
        if (H.ph === "end") { s.win = H.win; s.el = H.el; if (H.gs) s.gs = H.gs; }
        api.setState(s);
      };
      const phase = (ph, t) => { H.ph = ph; H.n++; H.t = t; pub(); };

      const goDeal = () => { H.rdy = []; phase("deal", T.deal); };
      const goClue = () => {
        H.rd++;
        const al = alive();
        let cand = al;
        if (H.rd === 1) { const nm = al.filter(i => H.role[i] !== 2); if (nm.length) cand = nm; }   // Mister White ne commence jamais
        const start = cand[Math.floor(Math.random() * cand.length)], k = al.indexOf(start);
        H.ord = al.slice(k).concat(al.slice(0, k));
        H.ti = 0;
        phase("clue", T.clue);
      };
      const addClue = (seat, text, flag) => {
        H.c.push(flag ? [seat, H.rd, "", flag] : [seat, H.rd, text]);
        while (H.c.length > 40) H.c.shift();
      };
      const nextClue = () => {
        H.ti++;
        while (H.ti < H.ord.length && H.o[H.ord[H.ti]]) H.ti++;
        if (H.ti >= H.ord.length) return goVote(null);
        H.n++; H.t = T.clue; pub();
      };
      const goVote = vc => {
        H.votes = {}; H.vc = vc; H.rv = vc ? 1 : 0;
        phase("vote", T.vote);
      };
      const tally = () => {
        const al = alive(), cands = (H.vc || al).filter(i => !H.o[i]);
        const cnt = P.map(() => 0);
        H.vt = [];
        for (const v of al) { const t = H.votes[v]; if (t != null && cands.includes(t)) { cnt[t]++; H.vt.push([v, t]); } }
        const max = Math.max(0, ...cands.map(i => cnt[i]));
        let tied = cands.filter(i => cnt[i] === max);
        H.tie = tied.length > 1 ? tied : null;
        if (!tied.length) { H.el = -1; H.how = "x"; }
        else if (tied.length === 1) { H.el = tied[0]; H.how = "v"; }
        else if (!H.rv) { H.el = -1; H.how = "r"; }
        else { H.el = tied[Math.floor(Math.random() * tied.length)]; H.how = "t"; }
        phase("tally", T.tally);
      };
      const afterTally = () => {
        if (H.how === "r") {
          const tied = H.tie.filter(i => !H.o[i]);
          if (tied.length >= 2) return goVote(tied);
          if (tied.length === 1) return eliminate(tied[0], "v");
          return afterElim();
        }
        if (H.el < 0 || H.o[H.el]) return afterElim();
        eliminate(H.el, H.how);
      };
      const eliminate = (i, how) => {
        H.ec++; H.o[i] = H.ec; H.el = i; H.how = how; H.gs = ""; H.gok = 0;
        phase("elim", T.elim);
      };
      const checkWin = () => {
        const al = alive(), civ = al.filter(i => H.role[i] === 0).length, inf = al.length - civ;
        if (!inf) return "c";
        if (civ <= inf) return "u";
        return "";
      };
      const afterElim = () => { const w = checkWin(); if (w) goEnd(w); else goClue(); };
      const afterElimPhase = () => {
        if (H.role[H.el] === 2 && here()[H.el]) phase("guess", T.guess);
        else afterElim();
      };
      const resolveGuess = text => {
        H.gs = cleanText(text, 24);
        H.gok = H.gs && sameWord(H.gs, PAIRS[H.w][H.sw]) ? 1 : 0;
        phase("gres", T.gres);
      };
      const goEnd = w => { H.win = w; phase("end", T.end); };
      const finishGame = () => {
        H.ph = "done";
        const W = H.win;
        const isW = i => W === "m" ? H.role[i] === 2 : W === "c" ? H.role[i] === 0 : (H.role[i] === 1 || (H.role[i] === 2 && !H.o[i]));
        const better = (a, b) => ((H.o[a] || 99) > (H.o[b] || 99) ? -1 : (H.o[a] || 99) < (H.o[b] || 99) ? 1 : a - b);
        const idx = P.map((_, i) => i);
        const win = idx.filter(isW).sort(better), lose = idx.filter(i => !isW(i)).sort(better);
        const names = arr => arr.map(i => P[i].pseudo).join(" et ");
        const U = idx.filter(i => H.role[i] === 1), M = idx.filter(i => H.role[i] === 2);
        const cw = PAIRS[H.w][H.sw], uw = PAIRS[H.w][1 - H.sw];
        let summary;
        if (W === "m") summary = `Mister White ${names(M)} devine « ${cw} » et gagne seul !`;
        else if (W === "c") summary = `Les civils démasquent ${names(U)} (${uw})${M.length ? ` et Mister White ${names(M)}` : ""}`;
        else summary = `${names(U)} (${uw}) ${U.length > 1 ? "échappent" : "échappe"} aux civils (${cw})${M.length && !H.o[M[0]] ? `, avec Mister White ${names(M)}` : ""}`;
        api.finish({winners: win.map(i => P[i].key), ranking: win.concat(lose).map(i => P[i].key), summary: summary.slice(0, 160)});
      };

      const apply = () => {
        for (const k in lastInputs) {
          const inp = lastInputs[k];
          if (!inp || inp.seq == null || inp.seq === seen[k]) continue;
          seen[k] = inp.seq;
          const i = P.findIndex(p => p.key === k);
          if (i < 0 || H.o[i] && inp.a !== "guess") continue;
          if (inp.n !== undefined && inp.n !== H.n) continue;
          if (inp.a === "ready" && H.ph === "deal") {
            if (!H.rdy.includes(i)) { H.rdy.push(i); pub(); }
          } else if (inp.a === "clue" && H.ph === "clue" && H.ord[H.ti] === i) {
            const txt = cleanText(inp.t, 20);
            if (!txt) addClue(i, "", inp.aloud ? 1 : 2);
            else if (leaks(txt, wordOf(i))) addClue(i, "", 3);
            else addClue(i, txt, 0);
            nextClue();
          } else if (inp.a === "vote" && H.ph === "vote") {
            const t = P.findIndex(p => p.key === inp.k);
            if (t < 0 || t === i || H.o[t] || (H.vc && !H.vc.includes(t))) continue;
            H.votes[i] = t;
            if (alive().every(a => H.votes[a] != null)) H.t = Math.min(H.t, 1.2);
            pub();
          } else if (inp.a === "guess" && H.ph === "guess" && H.el === i) {
            resolveGuess(inp.t);
          }
        }
      };
      api.onInputs(map => { lastInputs = map; if (!dead) apply(); });

      const onLeave = i => {
        H.ec++; H.o[i] = H.ec; H.g.push(i);
        H.ev = {n: (H.ev ? H.ev.n : 0) + 1, i};
        if (H.ph === "end" || H.ph === "done" || H.ph === "init") { pub(); return; }
        const w = checkWin();
        if (w && H.ph !== "guess" && H.ph !== "gres") return goEnd(w);
        if (H.ph === "clue" && H.ord[H.ti] === i) return nextClue();
        if (H.ph === "vote") {
          delete H.votes[i];
          for (const v in H.votes) if (H.votes[v] === i) delete H.votes[v];
          if (H.vc) { H.vc = H.vc.filter(x => x !== i); if (H.vc.length < 2) H.t = Math.min(H.t, 1); }
          if (alive().every(a => H.votes[a] != null)) H.t = Math.min(H.t, 1.2);
        }
        if (H.ph === "guess" && H.el === i) return resolveGuess("");
        pub();
      };

      let last = Date.now();
      hostInt = setInterval(() => {
        if (dead || H.ph === "done") return;
        const now = Date.now(), dt = (now - last) / 1000 * spd(); last = now;
        if (H.ph === "init") return;
        const h = here();
        for (let i = 0; i < N; i++) if (!h[i] && !H.g.includes(i) && !H.o[i]) onLeave(i);
        const before = Math.ceil(H.t);
        H.t -= dt;
        if (H.ph === "deal") {
          const al = alive();
          if (H.t <= 0 || al.every(i => H.rdy.includes(i))) return goClue();
        } else if (H.ph === "clue") {
          if (H.t <= 0) { addClue(H.ord[H.ti], "", 2); return nextClue(); }
        } else if (H.ph === "vote") {
          if (H.t <= 0) return tally();
        } else if (H.ph === "tally") {
          if (H.t <= 0) return afterTally();
        } else if (H.ph === "elim") {
          if (H.t <= 0) return afterElimPhase();
        } else if (H.ph === "guess") {
          if (H.t <= 0 || !h[H.el]) return resolveGuess("");
        } else if (H.ph === "gres") {
          if (H.t <= 0) { if (H.gok) return goEnd("m"); return afterElim(); }
        } else if (H.ph === "end") {
          if (H.t <= 0) return finishGame();
        }
        if (Math.ceil(H.t) !== before) pub();
      }, 100);
      later(goDeal, 300);
    }

    /* ================= AFFICHAGE ================= */
    el.innerHTML = `<style>${CSS}</style><div class="uc" id="uc-root">
      <header class="uc-top"><span class="uc-ts" aria-hidden="true">TOP SECRET</span><div class="uc-file"><small id="uc-kick">Dossier Undercover</small><b id="uc-title">Ouverture du dossier</b></div>
        <div class="uc-clock" id="uc-clock" role="timer" hidden>30</div></header>
      <main class="uc-main" id="uc-main"><p class="uc-lead">Distribution des dossiers…</p></main>
      <div class="uc-sec" id="uc-sec" hidden></div></div>`;
    const root = el.querySelector("#uc-root"), main = el.querySelector("#uc-main"), sec = el.querySelector("#uc-sec");
    const clock = el.querySelector("#uc-clock"), kick = el.querySelector("#uc-kick"), title = el.querySelector("#uc-title");
    let S = null, sceneKey = "", mySeq = 0, myVote = -1, voteN = -1, sentN = -1, lastEvN = null, lastT = null, secBuilt = false;
    const typed = new Set();
    const send = obj => { api.setInput(Object.assign({seq: ++mySeq}, obj)); };
    const myRole = s => mySeat < 0 ? -1 : roleOf(s, mySeat);
    const myWord = s => { const r = myRole(s); return r === 0 ? civWord(s) : r === 1 ? ucWord(s) : ""; };
    const amAlive = s => mySeat >= 0 && !s.o[mySeat];
    const name = i => P[i] ? P[i].pseudo : "?";
    const bust = i => api.avatar(P[i].key, {view: "bust"});
    const tw = (txt, extra) => { const t = String(txt); return `<span class="uc-tw" style="--s:${Math.max(1, t.length)};--d:${(Math.min(t.length, 24) * .055 + .15).toFixed(2)}s${extra || ""}">${esc(t)}</span>`; };

    /* --- dossier secret --- */
    function cardHTML(s, big) {
      const r = myRole(s), w = myWord(s);
      const inside = r === 2
        ? `<small>Identité</small><b>Mister White</b><em>Vous êtes Mister White : vous n'avez pas de mot. Écoutez les indices et bluffez.</em>`
        : `<small>Votre mot secret</small><b>${esc(w)}</b>${big ? `<em>Donnez des indices sans le trahir. Personne ne connaît son rôle…</em>` : ""}`;
      return `<button type="button" class="uc-card ${big ? "big" : "mini"}" aria-label="Maintenir appuyé pour lire votre dossier secret">
        <span class="in">${inside}</span>
        <span class="cov" aria-hidden="true"><span class="st">TOP SECRET</span><span class="hint">${big ? "Maintenez appuyé pour ouvrir<br>votre dossier" : "Maintenir : mon mot"}</span></span></button>`;
    }
    const openCard = e => {
      const c = e.target.closest && e.target.closest(".uc-card");
      if (!c) return;
      snd.unlock();
      if (e.type === "pointerdown") { try { c.setPointerCapture(e.pointerId); } catch (er) {} }
      c.classList.add("open");
    };
    const closeCards = () => root.querySelectorAll(".uc-card.open").forEach(c => c.classList.remove("open"));
    const onKeyDown = e => { if ((e.key === " " || e.key === "Enter") && e.target.closest && e.target.closest(".uc-card")) { e.preventDefault(); e.target.closest(".uc-card").classList.add("open"); } };
    const onKeyUp = e => { if (e.key === " " || e.key === "Enter") closeCards(); };
    const noMenu = e => { if (e.target.closest && e.target.closest(".uc-card")) e.preventDefault(); };
    const onGesture = () => snd.unlock();
    root.addEventListener("pointerdown", openCard);
    root.addEventListener("pointerdown", onGesture, {passive: true});
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("keyup", onKeyUp);
    root.addEventListener("contextmenu", noMenu);
    window.addEventListener("pointerup", closeCards);
    window.addEventListener("pointercancel", closeCards);
    window.addEventListener("blur", closeCards);

    /* --- briques --- */
    function lineup(s, hi, ticks, order) {
      return `<div class="uc-line" role="list" aria-label="Suspects">${P.map((p, i) => {
        const out = s.o[i] > 0, no = order ? order.indexOf(i) : -1;
        return `<div class="uc-sus${i === hi ? " hi" : ""}${out ? " out" : ""}${i === mySeat ? " me" : ""}${ticks && ticks.includes(i) ? " done" : ""}" data-i="${i}" role="listitem">
          ${no >= 0 && !out ? `<span class="no">N°${no + 1}</span>` : ""}
          <div class="uc-mug">${bust(i)}${out ? `<span class="uc-tag r${roleOf(s, i)}">${ROLE_SHORT[roleOf(s, i)]}</span>` : ""}</div><span class="uc-tick" aria-hidden="true">✓</span><b>${esc(p.pseudo)}</b>${i === mySeat ? "<small>vous</small>" : ""}</div>`;
      }).join("")}</div>`;
    }
    function clueText(e, anim) {
      if (e[3] === 1) return `<i>(indice donné à voix haute)</i>`;
      if (e[3] === 2) return `<i>… silence radio</i>`;
      if (e[3] === 3) return `<s>█████ CENSURÉ</s>`;
      return anim ? tw(e[2]) : esc(e[2]);
    }
    function cluesHTML(s) {
      const c = s.c || [];
      if (!c.length) return `<div class="uc-paper"><h3>Dépositions</h3><p class="empty">Aucune déposition pour l'instant.</p></div>`;
      const rounds = [...new Set(c.map(e => e[1]))].sort((a, b) => b - a);
      let fresh = 0;
      const html = rounds.map(r => `<h4>Manche ${r}</h4><ol>${c.filter(e => e[1] === r).map(e => {
        const id = e[1] + ":" + e[0], isNew = !typed.has(id);
        if (isNew) { typed.add(id); fresh++; }
        return `<li><span class="who">${esc(name(e[0]))}</span><span class="cl">${clueText(e, isNew && sceneKey !== "")}</span></li>`;
      }).join("")}</ol>`).join("");
      if (fresh && sceneKey) later(() => snd.keys(6), 150);
      return `<div class="uc-paper"><h3>Dépositions</h3>${html}</div>`;
    }
    const cluesOf = (s, i) => (s.c || []).filter(e => e[0] === i).sort((a, b) => b[1] - a[1]);

    /* --- scènes --- */
    function build(s) {
      const ph = s.ph;
      const me = mySeat >= 0;
      if (ph === "deal") {
        kick.textContent = "Dossier Undercover"; title.textContent = "Les dossiers";
        main.innerHTML = `<section class="uc-scene uc-deal">
          <h2 class="uc-h">${me ? "Votre dossier secret" : "Distribution des dossiers"}</h2>
          ${me ? cardHTML(s, true) + `<p class="uc-note">Cachez votre écran, maintenez le dossier, mémorisez… et relâchez.</p>
            <button type="button" class="uc-btn" id="uc-ready">J'ai lu, je suis prêt</button>` : `<p class="uc-spec">Vous observez l'enquête en spectateur.</p>`}
          <p class="uc-note"><span class="uc-hand">Les civils partagent un mot. Un imposteur a un mot voisin…</span></p>
          ${lineup(s, -1, s.rdy)}</section>`;
        const b = main.querySelector("#uc-ready");
        if (b) b.addEventListener("click", () => { if (S && S.ph === "deal") { send({a: "ready", n: S.n}); b.disabled = true; b.textContent = "Prêt ! En attente des autres…"; } });
      } else if (ph === "clue") {
        const cur = s.ord[s.ti], mine = cur === mySeat;
        kick.textContent = `Manche ${s.rd} · indice ${s.ti + 1}/${s.ord.length}`; title.textContent = "Dépositions";
        main.innerHTML = `<section class="uc-scene">
          ${lineup(s, cur, null, s.ord)}
          ${mine ? `<form class="uc-form" id="uc-cf" autocomplete="off"><label for="uc-ci">À vous : un indice, un seul mot</label>
              <div class="uc-row"><input class="uc-in" id="uc-ci" maxlength="20" enterkeyhint="send" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Votre indice…"><button class="uc-btn" type="submit">Déposer</button></div>
              <p class="uc-err" id="uc-ce" role="alert"></p>
              <button type="button" class="uc-btn ghost" id="uc-aloud">Je l'ai dit à voix haute : j'ai donné mon indice</button></form>`
            : `<div class="uc-wait"><b>${esc(name(cur))}</b> rédige sa déposition<span class="uc-caret" aria-hidden="true"></span></div>`}
          ${cluesHTML(s)}</section>`;
        if (mine) {
          const f = main.querySelector("#uc-cf"), inp = main.querySelector("#uc-ci"), err = main.querySelector("#uc-ce"), n = s.n;
          const lock = () => { f.querySelectorAll("button,input").forEach(x => { x.disabled = true; }); };
          f.addEventListener("submit", e => {
            e.preventDefault();
            if (!S || S.n !== n || sentN === n) return;
            const t = cleanText(inp.value, 20);
            if (!t) { err.textContent = "Écrivez un indice (ou dites-le à voix haute)."; return; }
            if (myRole(S) !== 2 && leaks(t, myWord(S))) { err.textContent = "Interdit : c'est votre mot !"; return; }
            sentN = n; send({a: "clue", t, n}); lock(); err.textContent = ""; snd.keys(t.length);
          });
          main.querySelector("#uc-aloud").addEventListener("click", () => {
            if (!S || S.n !== n || sentN === n) return;
            sentN = n; send({a: "clue", t: "", aloud: 1, n}); lock();
          });
          later(() => { try { inp.focus({preventScroll: true}); } catch (e) {} }, 50);
        }
      } else if (ph === "vote") {
        kick.textContent = `Manche ${s.rd} · ${s.vc ? "second vote" : "qui est l'infiltré ?"}`; title.textContent = s.vc ? "Départage" : "Le vote";
        if (voteN !== s.n || (myVote >= 0 && s.o[myVote])) { voteN = s.n; myVote = -1; }
        const can = amAlive(s);
        const al = P.map((_, i) => i).filter(i => !s.o[i]), outs = P.map((_, i) => i).filter(i => s.o[i]);
        main.innerHTML = `<section class="uc-scene">
          <p class="uc-lead">${s.vc ? `<b>Égalité !</b> Nouveau vote entre ${s.vc.map(i => `<b>${esc(name(i))}</b>`).join(" et ")}.` : can ? "Touchez le suspect à éliminer. Vous pouvez changer d'avis tant que le vote est ouvert." : mySeat >= 0 ? "Vous êtes hors jeu : les survivants votent." : "Les survivants votent."}</p>
          <div class="uc-mugs" id="uc-mugs">${al.map(i => {
            const self = i === mySeat, nope = !!s.vc && !s.vc.includes(i);
            const cl = cluesOf(s, i);
            return `<button type="button" class="uc-card2${self ? " self" : ""}${nope ? " nope" : ""}" data-i="${i}" ${!can || self || nope ? "disabled" : ""} aria-label="Voter contre ${esc(name(i))}">
              <span class="pic">${bust(i)}<span class="uc-tick" aria-hidden="true">✓</span><span class="mark">SUSPECT</span></span>
              <span class="plate">${esc(name(i))}${self ? " · vous" : ""}</span>
              <span class="cls">${cl.length ? cl.slice(0, 3).map(e => `<span>${e[3] ? (e[3] === 3 ? "█████" : "…") : esc(e[2])}</span>`).join("") : "<span>—</span>"}</span><span class="ring"></span></button>`;
          }).join("")}</div>
          ${outs.length ? `<div class="uc-outs"><span>Hors jeu :</span>${outs.map(i => `<div class="uc-sus out"><div class="uc-mug">${bust(i)}<span class="uc-tag r${roleOf(s, i)}">${ROLE_SHORT[roleOf(s, i)]}</span></div><b>${esc(name(i))}</b></div>`).join("")}</div>` : ""}
        </section>`;
        main.querySelector("#uc-mugs").addEventListener("click", e => {
          const b = e.target.closest(".uc-card2");
          if (!b || b.disabled || !S || S.ph !== "vote" || !amAlive(S)) return;
          const i = +b.dataset.i;
          if (i === myVote) return;
          myVote = i; send({a: "vote", k: P[i].key, n: S.n}); snd.tick();
          update(S);
        });
      } else if (ph === "tally") {
        kick.textContent = `Manche ${s.rd}`; title.textContent = "Dépouillement";
        const cnt = {}, by = {};
        (s.vt || []).forEach(([v, t]) => { cnt[t] = (cnt[t] || 0) + 1; (by[t] = by[t] || []).push(name(v)); });
        const rows = P.map((_, i) => i).filter(i => (!s.o[i] && (!s.vc || s.vc.includes(i))) || cnt[i]).sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0) || a - b);
        const max = Math.max(0, ...rows.map(i => cnt[i] || 0));
        const verdict = s.how === "r" ? `<b>Égalité !</b> Second vote entre ${s.tie.map(i => esc(name(i))).join(" et ")}.`
          : s.how === "t" ? `Égalité persistante : le sort désigne <b>${esc(name(s.el))}</b>.`
          : s.el >= 0 ? `Le tribunal désigne <b>${esc(name(s.el))}</b>.` : "Aucun vote : l'enquête continue.";
        main.innerHTML = `<section class="uc-scene"><h2 class="uc-h">Dépouillement</h2>
          <div class="uc-tally">${rows.map((i, n) => `<div class="uc-trow${cnt[i] && cnt[i] === max ? " top" : ""}" style="animation-delay:${n * .12}s"><div class="uc-mug">${bust(i)}</div>
            <div class="nm"><b>${esc(name(i))}</b><small>${by[i] ? "Votes : " + by[i].map(esc).join(", ") : "Aucun vote"}</small><div class="uc-marks">${"<i></i>".repeat(cnt[i] || 0)}</div></div><span class="cnt">${cnt[i] || 0}</span></div>`).join("")}</div>
          <p class="uc-verdict">${verdict}</p></section>`;
        later(() => snd.stamp(), 600);
      } else if (ph === "elim") {
        const r = roleOf(s, s.el), at = (1.7 / spd()).toFixed(2) + "s";
        kick.textContent = `Manche ${s.rd} · verdict`; title.textContent = "Révélation";
        const isMe = s.el === mySeat;
        main.innerHTML = `<section class="uc-scene"><div class="uc-elim r${r}" style="--at:${at}"><div class="uc-flash"></div>
          <div class="big">${bust(s.el)}</div>
          <p class="uc-was">${tw((isMe ? "Vous étiez" : name(s.el) + " était") + "…")}</p>
          <div class="uc-rstamp r${r}">${ROLE[r]}</div>
          <p class="uc-after">${r === 2 ? "Mister White a une dernière chance : deviner le mot des civils." : r === 1 ? "Un infiltré démasqué !" : "Un innocent tombe… L'enquête continue."}</p></div></section>`;
        later(() => { snd.sting(); }, 200);
        later(() => { snd.stamp(); if (navigator.vibrate) try { navigator.vibrate(80); } catch (e) {} }, 1700 / spd());
      } else if (ph === "guess") {
        const mine = s.el === mySeat;
        kick.textContent = "Mister White"; title.textContent = "Dernière chance";
        main.innerHTML = `<section class="uc-scene"><div class="uc-elim r2"><div class="big">${bust(s.el)}</div></div>
          ${mine ? `<form class="uc-form" id="uc-gf" autocomplete="off"><label for="uc-gi">Quel est le mot des civils ?</label>
            <div class="uc-row"><input class="uc-in" id="uc-gi" maxlength="24" enterkeyhint="send" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Votre proposition…"><button class="uc-btn" type="submit">Accuser</button></div>
            <p class="uc-err" id="uc-ge" role="alert"></p></form>`
            : `<div class="uc-wait">Mister White <b>${esc(name(s.el))}</b> cherche le mot des civils<span class="uc-caret" aria-hidden="true"></span></div><p class="uc-lead">S'il le trouve, il gagne seul.</p>`}
          ${cluesHTML(s)}</section>`;
        if (mine) {
          const f = main.querySelector("#uc-gf"), inp = main.querySelector("#uc-gi"), n = s.n;
          f.addEventListener("submit", e => {
            e.preventDefault();
            if (!S || S.n !== n || sentN === n) return;
            const t = cleanText(inp.value, 24);
            if (!t) { main.querySelector("#uc-ge").textContent = "Tentez un mot !"; return; }
            sentN = n; send({a: "guess", t, n}); f.querySelectorAll("button,input").forEach(x => { x.disabled = true; });
          });
          later(() => { try { inp.focus({preventScroll: true}); } catch (e) {} }, 50);
        }
      } else if (ph === "gres") {
        kick.textContent = "Mister White"; title.textContent = s.gok ? "Coup de théâtre" : "Tentative ratée";
        main.innerHTML = `<section class="uc-scene"><div class="uc-elim ${s.gok ? "r2" : "r1"}" style="--at:${(1 / spd()).toFixed(2)}s"><div class="uc-flash"></div>
          <div class="big">${bust(s.el)}</div>
          <p class="uc-was">${esc(name(s.el))} propose…</p>
          <p class="uc-guessed">${s.gs ? "« " + esc(s.gs) + " »" : "… rien"}</p>
          <div class="uc-rstamp ${s.gok ? "r2" : "r1"}">${s.gok ? "EXACT !" : "RATÉ"}</div>
          <p class="uc-after">${s.gok ? "Mister White a tout compris : il gagne seul !" : "Le mot des civils reste secret."}</p></div></section>`;
        later(() => snd.stamp(), 1000 / spd());
      } else if (ph === "end") {
        kick.textContent = "Fin de l'enquête"; title.textContent = "Affaire classée";
        const W = s.win;
        const isW = i => { const r = roleOf(s, i); return W === "m" ? r === 2 : W === "c" ? r === 0 : (r === 1 || (r === 2 && !s.o[i])); };
        const head = W === "c" ? "Victoire des civils" : W === "m" ? "Mister White gagne seul" : "Victoire des infiltrés";
        const sub = W === "c" ? "Tous les infiltrés sont démasqués." : W === "m" ? `${esc(name(s.el))} a deviné le mot des civils.` : "Les civils ne sont plus assez nombreux.";
        const order = P.map((_, i) => i).sort((a, b) => (isW(b) - isW(a)) || ((s.o[a] || 99) > (s.o[b] || 99) ? -1 : (s.o[a] || 99) < (s.o[b] || 99) ? 1 : a - b));
        main.innerHTML = `<section class="uc-scene"><div class="uc-closed">AFFAIRE CLASSÉE</div>
          <div class="uc-win"><h2 class="uc-h">${head}</h2><p class="uc-lead">${sub}</p></div>
          <div class="uc-words"><div><small>Mot des civils</small><b>${esc(civWord(s))}</b></div><div class="u"><small>Mot undercover</small><b>${esc(ucWord(s))}</b></div></div>
          <ul class="uc-roster">${order.map((i, n) => { const r = roleOf(s, i); return `<li class="${isW(i) ? "w" : ""}" style="animation-delay:${.3 + n * .1}s"><div class="uc-mug">${bust(i)}</div>
            <span class="nm">${esc(name(i))}${i === mySeat ? " (vous)" : ""}<small>${s.o[i] ? (s.g && s.g.includes(i) ? "a quitté l'enquête" : s.o[i] + (s.o[i] === 1 ? "er" : "e") + " éliminé") : "survivant"}</small></span>
            <span class="uc-tag r${r}">${ROLE[r]}</span>${isW(i) ? `<span class="star" aria-label="gagnant">★</span>` : ""}</li>`; }).join("")}</ul></section>`;
        const iWon = mySeat >= 0 && isW(mySeat);
        later(() => { if (iWon) snd.win(); else snd.stamp(); }, 300);
      }
      if (el.scrollTo) el.scrollTo({top: 0});
    }

    function update(s) {
      const timed = s.ph === "deal" || s.ph === "clue" || s.ph === "vote" || s.ph === "guess";
      clock.hidden = !timed;
      if (timed) {
        clock.textContent = s.t;
        clock.classList.toggle("urg", s.t <= 5);
        if (lastT !== null && s.t !== lastT && s.t <= 5 && s.t > 0) snd.tick();
      }
      lastT = timed ? s.t : null;
      if (s.ph === "deal") main.querySelectorAll(".uc-sus").forEach(x => x.classList.toggle("done", (s.rdy || []).includes(+x.dataset.i)));
      if (s.ph === "vote") {
        main.querySelectorAll(".uc-card2").forEach(b => {
          const i = +b.dataset.i;
          b.classList.toggle("done", (s.vd || []).includes(i));
          b.classList.toggle("pick", i === myVote);
        });
      }
      // dossier secret en bas de l'écran
      const showSec = mySeat >= 0 && s.ph !== "deal" && s.ph !== "end";
      if (showSec && !secBuilt) { sec.innerHTML = cardHTML(s, false); secBuilt = true; }
      sec.hidden = !showSec;
    }

    function render(s) {
      if (dead || !s || !s.ph || s.ph === "init" || s.ph === "done") return;
      S = s;
      root.dataset.ph = s.ph; root.dataset.n = s.n;
      const key = s.ph + ":" + s.n + ":" + (s.g || []).length;   // un départ redessine la scène
      if (lastEvN === null) lastEvN = s.ev ? s.ev.n : 0;
      if (s.ev && s.ev.n !== lastEvN) {
        lastEvN = s.ev.n;
        const i = s.ev.i;
        if (P[i] && i !== mySeat) api.toast(`${P[i].pseudo} a quitté l'enquête : c'était ${["un civil", "un Undercover", "Mister White"][roleOf(s, i)]}`);
      }
      if (key !== sceneKey) {
        if (!sceneKey) (s.c || []).forEach(e => typed.add(e[1] + ":" + e[0]));   // arrivée en cours de partie : pas d'animation
        build(s);
        sceneKey = key;
      }
      update(s);
    }
    api.onState(render);

    return {
      destroy() {
        dead = true;
        clearInterval(hostInt);
        timers.forEach(t => clearTimeout(t)); timers.clear();
        root.removeEventListener("pointerdown", openCard);
        root.removeEventListener("pointerdown", onGesture);
        root.removeEventListener("keydown", onKeyDown);
        root.removeEventListener("keyup", onKeyUp);
        root.removeEventListener("contextmenu", noMenu);
        window.removeEventListener("pointerup", closeCards);
        window.removeEventListener("pointercancel", closeCards);
        window.removeEventListener("blur", closeCards);
        snd.close();
        el.innerHTML = "";
      }
    };
  }
});
})();
