/* Gonflette Party : Petit Bac (2 à 8 joueurs, chacun sur son téléphone).
   Style cahier d'écolier : papier Seyès, marge rouge, post-it, tampon, corrections au stylo rouge.
   3 manches. L'hôte tire une lettre (sans K Q W X Y Z) et 6 catégories. 2 min pour remplir ;
   le premier qui a tout rempli peut crier « STOP ! » (fin pour tous 5 s plus tard).
   Correction sans chrono serré : un JUGE (le joueur qui fait tourner la partie, sinon le premier joueur ; s'il
   part, le suivant) attribue les points de chaque réponse : 10 (unique), 5 (doublon), 0 (refusée). C'est pré-rempli
   (vide ou mauvaise lettre = 0, doublon = 5, sinon 10), le juge corrige d'une touche (10 → 5 → 0) et tout le monde
   voit ses choix en direct ; les autres peuvent contester (👎, indicatif). Le juge touche « Terminé ✓ » (confirmé)
   pour valider ; filet de sécurité : validation automatique au bout de 5 min.
   État de correction : {ph:"val", A, p (un code par réponse : "0"=0, "1"=5, "2"=10, "-"=pas de copie), j (siège du juge),
   jv (n° de juge, change à chaque relève), V (nombre de 👎 par réponse), tl}.
   Entrée joueur (absolue, renvoyée régulièrement) : {r, a:[6 réponses], st:0|1 (STOP), v:[ids contestés],
   jv, p (points du juge), dn:0|1 (juge : terminé)}.
   Tests : window.__pbSpeed = 10 accélère les durées ; window.__pbJudge = siège force le juge préféré (lus par l'hôte). */
(function () {
"use strict";

const CATS = [
  "Prénom", "Pays", "Ville", "Animal", "Fruit ou légume", "Métier", "Objet", "Marque", "Sport",
  "Film ou série", "Célébrité (fictive OK)", "Plat", "Couleur", "Instrument", "Partie du corps",
  "Super-héros", "Chose qu'on trouve à la salle de sport", "Excuse pour ne pas aller au sport",
  "Insulte gentille", "Vêtement", "Boisson", "Moyen de transport", "Chanteur ou groupe",
  "Personnage de dessin animé", "Dessert", "Fleur ou plante", "Pièce de la maison",
  "Exercice de muscu", "Prénom de chien", "Mot doux", "Truc qu'on emporte en vacances", "Métier de rêve"
];
const LETTERS = "ABCDEFGHIJLMNOPRSTUV";             // sans K Q W X Y Z
const ROUNDS = 3, NC = 6, MAXLEN = 24;
const T = {draw: 5, play: 120, stop: 5, lock: 1, val: 300, cor: 8, lb: 6, end: 3};
const PTS = {"0": 0, "1": 5, "2": 10};          // code de points -> points
const fmt = t => t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : String(t);
const NOTE_COLORS = 4;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
const core = s => { const n = norm(s); const m = n.match(/^(?:le|la|les|l|un|une|des|du|de|d)\s+(.+)$/); return m ? m[1] : n; };
const dupKey = s => { let k = core(s).replace(/ /g, ""); if (k.length > 3) k = k.replace(/[sx]$/, ""); return k; };
/* "" si l'answer passe le contrôle automatique, sinon le motif du refus. */
function autoBad(s, L) {
  const n = norm(s), c = core(s), l = L.toLowerCase();
  if (!n) return "vide";
  if (n[0] !== l && c[0] !== l) return "≠ " + L;
  if (n.replace(/ /g, "").length < 2) return "trop court";
  return "";
}
const clean = a => Array.from({length: NC}, (_, i) => Array.from(String((a && a[i]) || "").replace(/[\u0000-\u001f]/g, "")).slice(0, MAXLEN).join(""));

const CSS = `
.pb{--paper:#fdfcf4;--ink:#1d3fa6;--red:#d7262e;--txt:#2b2a33;--line:#dfe7f6;--line2:#b9cbea;--vline:#d9cfe8;
  position:relative;min-height:100%;box-sizing:border-box;padding:0 12px 28px 40px;color:var(--txt);
  font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;font-size:17px;overflow-x:clip;
  background-color:var(--paper);
  background-image:linear-gradient(var(--line2) 1px,transparent 1px),linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--vline) 1px,transparent 1px);
  background-size:100% 32px,100% 8px,32px 100%;background-position:0 0,0 0,8px 0}
.pb::before{content:"";position:absolute;top:0;bottom:0;left:28px;width:2px;background:var(--red);box-shadow:4px 0 0 rgba(215,38,46,.35);z-index:0;pointer-events:none}
.pb *{box-sizing:border-box}
.pb-page{position:relative;z-index:1;max-width:560px;margin:0 auto}
.pb-script{font-family:"Pacifico","Brush Script MT",cursive;font-weight:400}
.pb-top{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:10px;margin:0 -12px 8px -40px;padding:8px 12px 8px 12px;
  background:rgba(253,252,244,.96);border-bottom:2px solid var(--line2);box-shadow:0 4px 10px -6px rgba(0,0,0,.25)}
.pb-badge{flex:none;width:52px;height:52px;border-radius:50%;border:3px solid var(--red);color:var(--red);display:grid;place-items:center;
  font-family:"Pacifico",cursive;font-size:28px;line-height:1;transform:rotate(-8deg);box-shadow:inset 0 0 0 2px rgba(215,38,46,.25);padding-bottom:6px}
.pb-mid{flex:1;min-width:0;line-height:1.05}
.pb-mid b{display:block;font-family:"Pacifico",cursive;font-weight:400;font-size:19px;color:var(--ink);white-space:nowrap}
.pb-mid small{display:block;font-size:14px;font-weight:600;color:#5d5a6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pb-clock{flex:none;min-width:52px;height:44px;padding:0 6px;border:2px solid var(--txt);border-radius:10px;background:#fff;display:grid;place-items:center;
  font-family:"Anton",Impact,sans-serif;font-size:24px;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.pb-clock.pb-hot{color:#fff;background:var(--red);border-color:var(--red);animation:pb-pulse 1s ease-in-out infinite}
.pb-stop{flex:none;height:44px;min-width:78px;padding:0 10px;border:3px solid #9a9aa6;border-radius:10px;background:#ececf0;color:#9a9aa6;
  font-family:"Anton",Impact,sans-serif;font-size:21px;letter-spacing:.04em;cursor:pointer;transform:rotate(2deg)}
.pb-stop:not(:disabled){border-color:#7d0f14;background:var(--red);color:#fff;box-shadow:0 4px 0 #7d0f14;animation:pb-wiggle 1.2s ease-in-out infinite}
.pb-stop:not(:disabled):active{transform:translateY(3px) rotate(2deg);box-shadow:0 1px 0 #7d0f14}
.pb-banw{position:sticky;top:72px;z-index:5}
.pb-ban{margin:0 0 10px;padding:8px 12px;border-radius:6px;background:var(--red);color:#fff;text-align:center;
  box-shadow:0 6px 14px rgba(150,0,0,.3);transform:rotate(-1deg);animation:pb-pop .3s}
.pb-ban b{font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:30px;letter-spacing:.03em;display:block;line-height:1.1}
.pb-ban small{font-size:15px;font-weight:600;opacity:.92}
.pb-ban.pb-lockb{background:var(--txt);box-shadow:none}
.pb-rows{display:grid;gap:12px;padding-bottom:6px}
.pb-row{display:block;position:relative}
.pb-note{display:inline-block;position:relative;max-width:100%;padding:3px 10px 4px;font-weight:700;font-size:15px;line-height:1.15;color:#3a3420;
  background:#fff27a;box-shadow:0 2px 4px rgba(0,0,0,.18);transform:rotate(var(--rot,-1.5deg))}
.pb-note::before{content:"";position:absolute;top:-6px;left:50%;width:34px;height:12px;margin-left:-17px;background:rgba(255,255,255,.55);border:1px solid rgba(0,0,0,.05);transform:rotate(3deg)}
.pb-n1{background:#ffb8cb}.pb-n2{background:#bdf0ae}.pb-n3{background:#acdcff}
.pb-field{display:flex;align-items:center;margin-top:6px;position:relative}
.pb-in{width:100%;height:46px;padding:4px 10px;border:0;border-bottom:2px solid var(--line2);border-radius:6px 6px 0 0;background:rgba(255,255,255,.6);
  color:var(--ink);font-family:"Barlow Condensed","Arial Narrow",sans-serif;font-weight:600;font-size:23px;letter-spacing:.02em;outline:none;
  -webkit-appearance:none;appearance:none}
.pb-in::placeholder{color:#b4bfd6;font-weight:500}
.pb-in:focus{background:#fff;border-bottom-color:var(--ink);box-shadow:0 2px 0 var(--ink)}
.pb-in:disabled{background:transparent;color:#58628a}
.pb-warn{position:absolute;right:8px;top:50%;transform:translateY(-50%) rotate(-6deg);font-family:"Pacifico",cursive;font-style:normal;font-size:15px;color:var(--red);pointer-events:none}
.pb-row.pb-bad .pb-in{text-decoration:line-through wavy rgba(215,38,46,.7)}
.pb-row.pb-ok .pb-field::after{content:"✓";position:absolute;right:10px;color:#2e8b3a;font-weight:800;font-size:20px}
.pb-hint{margin:10px 0 0;font-size:15px;color:#5d5a6a;font-weight:600}
.pb-prog{margin-top:14px;padding:8px 10px;border:2px dashed var(--line2);border-radius:8px;background:rgba(255,255,255,.5)}
.pb-prog h4{margin:0 0 6px;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5d5a6a}
.pb-prog ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 12px}
.pb-prog li{display:flex;align-items:center;gap:6px;font-weight:700;min-width:0}
.pb-prog li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-dots{display:flex;gap:2px;flex:none}.pb-dots i{width:9px;height:9px;border:1.5px solid var(--ink);border-radius:2px}.pb-dots i.f{background:var(--ink)}
.pb-gone{opacity:.45}
.pb-pad{height:40vh}
.pb-next{margin:14px 0 0;text-align:center;font-weight:700;color:#5d5a6a}
.pb-next b{font-family:"Anton",Impact,sans-serif;font-weight:400;color:var(--txt)}
/* tirage */
.pb-draw{display:grid;justify-items:center;gap:6px;padding-top:12px;text-align:center}
.pb-draw h2{margin:0;color:var(--ink);font-size:30px}
.pb-draw h2 small{font-size:18px}
.pb-wbox{position:relative;width:min(270px,72vw);aspect-ratio:1;margin:6px 0}
.pb-wheel{position:absolute;inset:0;border-radius:50%;border:4px solid var(--txt);background:repeating-conic-gradient(from -9deg,#fff27a 0 18deg,#fff 18deg 36deg);
  box-shadow:0 8px 20px rgba(0,0,0,.2),inset 0 0 0 10px rgba(255,255,255,.4)}
.pb-wheel span{position:absolute;left:50%;top:0;width:30px;height:50%;margin-left:-15px;transform-origin:50% 100%;display:flex;justify-content:center;
  align-items:flex-start;padding-top:5%;font-family:"Anton",Impact,sans-serif;font-size:20px;color:var(--txt)}
.pb-hub{position:absolute;left:50%;top:50%;width:22%;height:22%;transform:translate(-50%,-50%);border-radius:50%;background:var(--red);border:4px solid var(--txt)}
.pb-ptr{position:absolute;left:50%;top:-12px;margin-left:-14px;width:28px;height:34px;z-index:2;background:var(--red);clip-path:polygon(0 0,100% 0,50% 100%);filter:drop-shadow(0 2px 0 var(--txt))}
.pb-stamp{position:absolute;left:50%;top:50%;z-index:3;width:min(200px,54vw);padding:4px 8px 10px;border:5px double var(--red);border-radius:12px;color:var(--red);
  background:rgba(253,252,244,.92);opacity:0;transform:translate(-50%,-50%) rotate(-10deg) scale(2.6);pointer-events:none}
.pb-stamp b{display:block;font-family:"Pacifico",cursive;font-weight:400;font-size:96px;line-height:1.25}
.pb-stamp small{display:block;font-family:"Anton",Impact,sans-serif;font-size:18px;letter-spacing:.2em}
.pb-stamp.pb-on{opacity:.93;transform:translate(-50%,-50%) rotate(-10deg) scale(1);animation:pb-stamp var(--d,.35s) cubic-bezier(.3,1.6,.6,1) both;
  -webkit-mask-image:radial-gradient(circle at 30% 40%,#000 60%,rgba(0,0,0,.75) 61%,#000 70%);mask-image:radial-gradient(circle at 30% 40%,#000 60%,rgba(0,0,0,.75) 61%,#000 70%)}
.pb-wcats{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 10px;margin-top:6px}
.pb-wcats .pb-note{opacity:0}
.pb-wcats.pb-on .pb-note{opacity:1;animation:pb-drop .4s backwards;animation-delay:calc(var(--i) * 110ms)}
/* correction */
.pb-instr{margin:0 0 8px;font-weight:600;font-size:15px;color:#5d5a6a}
.pb-cat{margin:0 0 14px}
.pb-cat ul{list-style:none;margin:6px 0 0;padding:0}
.pb-ans{display:flex;align-items:center;gap:8px;min-height:40px;padding:2px 0;border-bottom:1px solid var(--line)}
.pb-who{flex:none;width:76px;font-weight:700;font-size:15px;color:#5d5a6a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-txt{position:relative;flex:0 1 auto;margin-right:auto;min-width:0;font-weight:600;font-size:21px;color:var(--ink);overflow-wrap:anywhere;line-height:1.1}
.pb-txt.pb-empty{color:#a3a8bb}
.pb-x .pb-txt::after,.pb-ct .pb-txt::after{content:"";position:absolute;left:-3px;right:-3px;top:52%;height:3px;border-radius:2px;background:var(--red);
  transform:rotate(-4deg);transform-origin:left;animation:pb-strike .35s backwards;animation-delay:var(--dl,0s)}
.pb-ct .pb-txt::after{opacity:.55;height:2px;background:repeating-linear-gradient(90deg,var(--red) 0 6px,transparent 6px 10px)}
.pb-cor .pb-ct .pb-txt::after{opacity:1;height:3px;background:var(--red)}
.pb-mark{flex:none;font-family:"Pacifico",cursive;font-style:normal;color:var(--red);font-size:16px;transform:rotate(-6deg);white-space:nowrap;animation:pb-ink .35s backwards;animation-delay:var(--dl,0s)}
.pb-mark.pb-big{font-size:21px}
.pb-mark small{font-family:"Barlow Condensed",sans-serif;font-size:13px;font-weight:700;margin-left:3px}
.pb-me{flex:none;font-size:13px;font-weight:700;color:#8a879a;text-transform:uppercase;letter-spacing:.06em}
.pb-vote{flex:none;min-width:48px;height:44px;padding:0 8px;border:2px solid #c6cbe0;border-radius:22px;background:#fff;font:700 17px "Barlow Condensed",sans-serif;color:var(--txt);cursor:pointer;touch-action:manipulation}
.pb-vote.pb-on{border-color:var(--red);background:#ffe3e3;color:var(--red)}
.pb-vote:disabled{opacity:.6}
.pb-cnt{flex:none;font-weight:700;color:var(--red);font-size:15px}
.pb-okbar{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;gap:8px;min-height:68px;margin:10px -12px 0 -40px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px)) 16px;
  background:rgba(253,252,244,.97);border-top:2px solid var(--line2);box-shadow:0 -4px 10px -6px rgba(0,0,0,.2)}
.pb-okbar .gk-btn{flex:none;min-height:48px;padding:8px 14px;font-size:1.05rem}
.pb-okbar .gk-btn:not(.good){background:#fff}
.pb-okbar .pb-done{flex:1 1 auto;max-width:220px;font-size:1.2rem}
.pb-bmsg{flex:1;min-width:0;font-weight:600;font-size:15px;line-height:1.2;color:#5d5a6a}
.pb-bmsg b{color:var(--txt)}
.pb-mytot{flex:none;display:grid;justify-items:center;line-height:1;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5d5a6a}
.pb-mytot b{font-family:"Pacifico",cursive;font-weight:400;font-size:24px;line-height:1.3;color:var(--red);text-transform:none;letter-spacing:0}
.pb-instr b{color:var(--txt)}
.pb-aw{flex:1;min-width:0;display:flex;flex-direction:column;padding:3px 0}
.pb-aw .pb-who{width:auto;font-size:13px;line-height:1.1}
.pb-aw .pb-txt{margin:0;align-self:flex-start;font-size:21px}
.pb-why{font-family:"Pacifico",cursive;font-style:normal;font-size:12px;color:var(--red);line-height:1.2}
.pb-ans.pb-mine .pb-aw .pb-who{color:var(--ink)}
.pb-pt{flex:none;display:grid;place-items:center;width:56px;height:44px;padding:0;border:3px solid var(--txt);border-radius:12px;background:#fff;color:var(--txt);
  font:400 22px "Anton",Impact,sans-serif;letter-spacing:.02em;font-variant-numeric:tabular-nums;transition:background-color .15s,transform .1s}
button.pb-pt{cursor:pointer;box-shadow:0 3px 0 var(--txt);touch-action:manipulation}
button.pb-pt:active{transform:translateY(2px);box-shadow:0 1px 0 var(--txt)}
button.pb-pt:disabled{cursor:default;opacity:.5;box-shadow:none}
span.pb-pt{border-width:2px;height:38px;width:48px;font-size:19px;transform:rotate(-3deg)}
.pb-pt.pb-v2{background:#bdf0ae;border-color:#2e7d32;color:#1b5e20}
.pb-pt.pb-v1{background:#fff27a;border-color:#a68a00;color:#6b5900}
.pb-pt.pb-v0{background:#f1eef2;border-color:#9a93a6;color:#9a93a6}
button.pb-pt.pb-v2{box-shadow:0 3px 0 #2e7d32}button.pb-pt.pb-v1{box-shadow:0 3px 0 #a68a00}button.pb-pt.pb-v0{box-shadow:0 3px 0 #9a93a6}
.pb-pt.pb-flash{animation:pb-flash .7s}
.pb-ans.pb-x .pb-aw .pb-txt{color:#8d8aa0}
@keyframes pb-flash{0%{transform:scale(1.35) rotate(-3deg);box-shadow:0 0 0 6px rgba(29,63,166,.25)}100%{transform:scale(1) rotate(-3deg)}}
.pb-score{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
.pb-circle{display:inline-grid;place-items:center;min-width:76px;height:58px;padding:0 10px 6px;border:3px solid var(--red);border-radius:50%;color:var(--red);
  font-family:"Pacifico",cursive;font-size:26px;transform:rotate(-6deg);animation:pb-ink .4s backwards}
.pb-score p{margin:0;font-weight:600;color:#5d5a6a;line-height:1.15}
/* classement */
.pb-lb{padding-top:10px}
.pb-lb h2{margin:0;color:var(--ink);font-size:30px;text-align:center}
.pb-lb>p{margin:0 0 10px;text-align:center;font-weight:600;color:#5d5a6a}
.pb-rank{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pb-rank li{display:flex;align-items:center;gap:10px;padding:6px 12px 6px 8px;background:#fff;border:2px solid var(--line2);border-radius:10px;
  box-shadow:0 2px 0 var(--line2);animation:pb-slide .45s backwards;animation-delay:calc(var(--i) * 90ms)}
.pb-rank li.pb-mine{border-color:var(--ink);box-shadow:0 2px 0 var(--ink)}
.pb-rank li.pb-first{background:#fff9c9}
.pb-rk{flex:none;width:26px;font-family:"Anton",Impact,sans-serif;font-size:24px;color:var(--txt);text-align:center}
.pb-av{flex:none;width:52px;height:52px;border-radius:50%;overflow:hidden;background:#e9eefb;border:2px solid var(--txt)}
.pb-av svg{width:100%;height:100%;display:block}
.pb-nm{flex:1;min-width:0;font-weight:800;font-size:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-nm small{display:block;font-weight:600;font-size:13px;color:#8a879a}
.pb-gain{flex:none;font-family:"Pacifico",cursive;color:var(--red);font-size:18px;transform:rotate(-6deg)}
.pb-tot{flex:none;min-width:40px;text-align:right;font-family:"Anton",Impact,sans-serif;font-size:26px}
.pb-pod{display:flex;justify-content:center;align-items:flex-end;gap:8px;margin:6px 0 12px}
.pb-pod figure{margin:0;display:grid;justify-items:center;gap:2px;width:31%;max-width:150px;text-align:center}
.pb-pod .pb-av{width:100%;height:auto;aspect-ratio:1}
.pb-pod figure.pb-p1 .pb-av{border-color:var(--red);border-width:3px}
.pb-pod figcaption{font-weight:800;font-size:16px;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pb-pod em{font-family:"Pacifico",cursive;font-style:normal;color:var(--red);font-size:14px;line-height:1.2}
.pb-step{width:100%;border:2px solid var(--txt);border-bottom:0;background:#fff27a;font-family:"Anton",Impact,sans-serif;font-size:22px;display:grid;place-items:center}
.pb-p1 .pb-step{height:64px}.pb-p2 .pb-step{height:44px;background:#acdcff}.pb-p3 .pb-step{height:30px;background:#ffb8cb}
@keyframes pb-pulse{50%{transform:scale(1.08)}}
@keyframes pb-wiggle{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-3deg) scale(1.05)}}
@keyframes pb-pop{from{transform:scale(.6) rotate(-6deg);opacity:0}}
@keyframes pb-stamp{from{opacity:0;transform:translate(-50%,-50%) rotate(-10deg) scale(2.6)}}
@keyframes pb-drop{from{opacity:0;transform:translateY(-30px) rotate(12deg)}}
@keyframes pb-strike{from{transform:rotate(-4deg) scaleX(0)}}
@keyframes pb-ink{from{opacity:0;transform:scale(1.8) rotate(-6deg)}}
@keyframes pb-slide{from{opacity:0;transform:translateX(30px)}}
@media (prefers-reduced-motion:reduce){.pb *,.pb *::before,.pb *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;

GONFLETTE.registerGame({
  id: "petitbac",
  name: "Petit Bac",
  min: 2,
  max: 8,
  create(api) {
    const el = api.el, P = api.players, NP = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] != null ? seatOf[api.me] : -1;
    const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const spd = () => Math.max(1, Math.min(50, +window.__pbSpeed || 1));
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const cancel = t => { if (t) { clearTimeout(t); timers.delete(t); } };
    const aliveSet = () => new Set(api.connected());

    el.innerHTML = `<style>${CSS}</style><div class="pb"><div class="pb-page" id="pb-page"></div></div>`;
    const page = el.querySelector("#pb-page");
    const $ = id => el.querySelector("#" + id);

    /* ---------- son (WebAudio, après un geste) ---------- */
    let AC = null;
    const wake = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } };
    el.addEventListener("pointerdown", wake, {passive: true});
    function tone(f, d, type, vol, slide) {
      if (!AC || AC.state !== "running") return;
      try {
        const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
        g.gain.setValueAtTime(vol || .06, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .02);
      } catch (e) {}
    }

    /* =================== HÔTE =================== */
    let H = null, lastPub = "", hostT = null, finished = false;
    let ans = {}, inputs = {};
    const usedL = new Set(), usedC = new Set();
    function pub() { const j = JSON.stringify(H); if (j === lastPub) return; lastPub = j; api.setState(H); }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function newRound(r) {
      const ls = LETTERS.split("").filter(l => !usedL.has(l));
      const L = ls[Math.floor(Math.random() * ls.length)]; usedL.add(L);
      let pool = CATS.map((_, i) => i).filter(i => !usedC.has(i));
      if (pool.length < NC) { usedC.clear(); pool = CATS.map((_, i) => i); }
      const c = shuffle(pool).slice(0, NC); c.forEach(i => usedC.add(i));
      ans = {};
      H = {ph: "draw", r, L, c, tl: T.draw, S: H ? H.S : P.map(() => 0)};
    }
    /* Points par défaut : vide ou mauvaise lettre = 0, même réponse qu'un autre = 5 (doublon), sinon 10. */
    function defaults(A, L) {
      const out = new Array(NP * NC).fill("-");
      for (let ci = 0; ci < NC; ci++) {
        const n = {};
        P.forEach((p, s) => { const a = A[s]; if (a && !autoBad(a[ci], L)) { const k = dupKey(a[ci]); n[k] = (n[k] || 0) + 1; } });
        P.forEach((p, s) => { const a = A[s]; if (a) out[s * NC + ci] = autoBad(a[ci], L) ? "0" : n[dupKey(a[ci])] > 1 ? "1" : "2"; });
      }
      return out.join("");
    }
    function startVal() {
      const alive = aliveSet();
      const A = P.map(p => alive.has(p.key) ? clean(ans[p.key]) : null);
      H = {ph: "val", r: H.r, L: H.L, c: H.c, tl: T.val, A, p: defaults(A, H.L), j: -1, jv: 0, V: "0".repeat(NP * NC), S: H.S};
      hostVal();
    }
    /* Juge : le joueur qui fait tourner la partie (sinon le premier joueur). S'il n'est plus là, le suivant prend
       la relève (jv change : le nouveau juge repart des points publiés). */
    function pickJudge() {
      const alive = aliveSet();
      if (H.j >= 0 && alive.has(P[H.j].key)) return;
      const f = window.__pbJudge, pref = f != null && P[+f] ? +f : (mySeat >= 0 ? mySeat : 0);
      for (let d = 0; d < NP; d++) {
        const s = (pref + d) % NP;
        if (alive.has(P[s].key)) { if (H.j !== s) { H.j = s; H.jv++; } return; }
      }
    }
    /* Contestations (👎, indicatives) -> H.V ; points et « Terminé » du juge -> H.p / fin de la correction. */
    function hostVal() {
      pickJudge();
      const alive = aliveSet(), cnt = new Array(NP * NC).fill(0);
      for (const p of P) {
        const inp = inputs[p.key];
        if (!alive.has(p.key) || !inp || inp.r !== H.r || !Array.isArray(inp.v)) continue;
        const seen = new Set();
        for (const raw of inp.v.slice(0, NP * NC)) {
          const id = raw | 0, s = (id / NC) | 0;
          if (id < 0 || id >= NP * NC || seen.has(id) || s === seatOf[p.key] || !H.A[s] || !norm(H.A[s][id % NC])) continue;
          seen.add(id); cnt[id]++;
        }
      }
      H.V = cnt.map(n => Math.min(9, n)).join("");
      const jp = H.j >= 0 ? inputs[P[H.j].key] : null;
      if (jp && jp.r === H.r && jp.jv === H.jv) {
        if (typeof jp.p === "string" && jp.p.length === NP * NC) {
          H.p = H.p.split("").map((c, i) => {
            const v = jp.p[i], a = H.A[(i / NC) | 0];
            return c === "-" || !/^[012]$/.test(v) || (v !== "0" && !norm(a[i % NC])) ? c : v;   // réponse vide : 0 d'office
          }).join("");
        }
        if (jp.dn) endVal();
      }
    }
    function endVal() {
      const alive = aliveSet(), G = P.map(() => 0), R = H.p.split("");
      P.forEach((p, s) => {
        for (let ci = 0; ci < NC; ci++) {
          const id = s * NC + ci;
          if (!H.A[s] || !alive.has(p.key)) R[id] = "-";             // parti : réponses ignorées
          else G[s] += PTS[R[id]] || 0;
        }
      });
      H = {ph: "cor", r: H.r, L: H.L, c: H.c, tl: T.cor, A: H.A, R: R.join(""), G, S: H.S.map((v, i) => v + G[i]), j: H.j};
    }
    function rankSeats(S) {
      const alive = aliveSet();
      const on = i => (alive.has(P[i].key) ? 1 : 0);
      return P.map((p, i) => i).sort((a, b) => (on(b) - on(a)) || (S[b] - S[a]) || a - b);   // les partis en dernier
    }
    function doFinish() {
      if (finished) return; finished = true;
      const rk = rankSeats(H.S), top = H.S[rk[0]], alive = aliveSet();
      const winners = top > 0 ? rk.filter(s => H.S[s] === top && alive.has(P[s].key)).map(s => P[s].key) : [];
      const names = winners.map(k => api.name(k));
      api.finish({
        winners, ranking: rk.map(s => P[s].key),
        summary: winners.length === 1 ? `${names[0]} remporte le Petit Bac avec ${top} points : félicitations du jury !`
          : winners.length ? `Ex æquo à ${top} points : ${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}.` : "Copie blanche pour tout le monde !"
      });
    }
    function step() {
      switch (H.ph) {
        case "draw": if (--H.tl <= 0) H = {ph: "play", r: H.r, L: H.L, c: H.c, tl: T.play, S: H.S}; break;
        case "play":
          H.tl = Math.max(0, H.tl - 1);
          if (H.sx != null) H.sx = Math.max(0, H.sx - 1);
          if (H.tl <= 0 || H.sx === 0) { H.ph = "lock"; H.tl = T.lock; }
          break;
        case "lock": if (--H.tl <= 0) startVal(); break;
        case "val": hostVal(); if (H.ph === "val" && --H.tl <= 0) endVal(); break;
        case "cor": if (--H.tl <= 0) H = {ph: "lb", r: H.r, tl: T.lb, G: H.G, S: H.S}; break;
        case "lb":
          if (--H.tl <= 0) {
            if (H.r >= ROUNDS) H = {ph: "end", r: H.r, tl: T.end, S: H.S, rk: rankSeats(H.S)};
            else newRound(H.r + 1);
          }
          break;
        case "end": if (--H.tl <= 0) { H.tl = 0; doFinish(); } break;
      }
    }
    /* Horloge en temps réel : si l'onglet de l'hôte est ralenti (arrière-plan), on rattrape les secondes perdues. */
    let vt = 0, lastNow = 0;
    function tick() {
      if (dead) return;
      const now = performance.now(), sp = spd();
      vt += Math.min(120000, now - lastNow) * sp; lastNow = now;
      let n = 0;
      while (vt >= 990 && n++ < 120) { vt -= 1000; step(); pub(); }
      if (vt < 0) vt = 0;
      pub();
      hostT = later(tick, Math.max(20, (1000 - vt) / sp));
    }
    function hostInputs(map) {
      inputs = map;
      if (!H) return;
      if (H.ph === "play" || H.ph === "lock") {
        const alive = aliveSet();
        for (const p of P) {
          const inp = map[p.key];
          if (!inp || inp.r !== H.r || !alive.has(p.key)) continue;
          if (Array.isArray(inp.a)) ans[p.key] = clean(inp.a);
          if (H.ph === "play" && H.sx == null && inp.st && ans[p.key].every(x => norm(x))) { H.sx = T.stop; H.sb = seatOf[p.key]; }
        }
      } else if (H.ph === "val") hostVal();
      pub();
    }
    if (api.isHost) {
      newRound(1); pub();
      api.onInputs(hostInputs);
      lastNow = performance.now();
      hostT = later(tick, 1000 / spd());
    }

    /* =================== AFFICHAGE (tout le monde) =================== */
    let S = null, view = "", myRound = 0, myAns = [], myStop = 0, myVotes = new Set(), allInputs = {};
    let myPts = "", myJv = 0, myDone = 0, confirming = false, confirmT = null, prevP = "";
    let sendT = null, lastStopBeep = -1;
    const blank = () => new Array(NC).fill("");
    const amJudge = () => !!S && S.ph === "val" && mySeat >= 0 && S.j === mySeat;
    function myInput() {
      const o = {r: S.r, a: myAns.map(x => x.slice(0, MAXLEN)), st: myStop, v: [...myVotes]};
      if (myJv) { o.jv = myJv; o.p = myPts; o.dn = myDone; }
      return o;
    }
    function push() { cancel(sendT); sendT = null; if (S && mySeat >= 0) api.setInput(myInput()); }
    function sendSoon() { if (!sendT) sendT = later(push, 250); }
    const beat = setInterval(() => { if (!dead && S && /play|lock|val/.test(S.ph)) push(); }, 1200);

    function top(s, title, sub, right) {
      return `<div class="pb-top"><div class="pb-badge" aria-label="Lettre ${s.L}">${s.L}</div>
        <div class="pb-mid"><b>${title}</b><small>${sub}</small></div>${right || ""}<div class="pb-clock" id="pb-clock" aria-label="Temps restant">${fmt(s.tl)}</div></div>`;
    }
    const nameHTML = s => esc(P[s].pseudo);

    /* ---- tirage ---- */
    function buildDraw(s) {
      const k = 1 / spd(), idx = LETTERS.indexOf(s.L), step = 360 / LETTERS.length;
      page.innerHTML = `<div class="pb-draw"><h2 class="pb-script">Manche ${s.r}<small>/${ROUNDS}</small></h2>
        <div class="pb-wbox"><div class="pb-ptr"></div><div class="pb-wheel" id="pb-wheel">${LETTERS.split("").map((l, i) => `<span style="transform:rotate(${i * step}deg)">${l}</span>`).join("")}</div><div class="pb-hub"></div>
          <div class="pb-stamp" id="pb-stamp" role="status"><b>${s.L}</b><small>LETTRE TIRÉE</small></div></div>
        <div class="pb-wcats" id="pb-wcats">${s.c.map((ci, i) => `<span class="pb-note pb-n${i % NOTE_COLORS}" style="--i:${i};--rot:${(i % 2 ? 2 : -2) + (i % 3) - 1}deg">${esc(CATS[ci])}</span>`).join("")}</div>
        <p class="pb-next">${mySeat >= 0 ? "À vos stylos !" : "Les joueurs prennent leurs stylos…"} ${T.play >= 60 && T.play % 60 === 0 ? T.play / 60 + " min" : T.play + " s"}, 6 catégories.</p></div>`;
      const wheel = $("pb-wheel"), stamp = $("pb-stamp"), cats = $("pb-wcats");
      const final = -(idx * step) - 360 * 5;
      const late = s.tl < T.draw - 1;
      if (RM || late) { wheel.style.transform = `rotate(${final}deg)`; stamp.classList.add("pb-on"); cats.classList.add("pb-on"); return; }
      wheel.style.transform = "rotate(0deg)";
      later(() => {
        wheel.style.transition = `transform ${2.3 * k}s cubic-bezier(.12,.6,.18,1)`; wheel.style.transform = `rotate(${final}deg)`;
        for (let i = 0; i < 10; i++) later(() => tone(900 + i * 40, .03, "square", .025), (i * i * 25) * k);
      }, 40);
      later(() => { stamp.style.setProperty("--d", (.35 * k) + "s"); stamp.classList.add("pb-on"); tone(110, .25, "sine", .3, 50); tone(70, .2, "triangle", .2); }, 2450 * k);
      later(() => cats.classList.add("pb-on"), 2900 * k);
    }

    /* ---- écriture ---- */
    function buildPlay(s) {
      const me = mySeat >= 0;
      page.innerHTML = top(s, `Manche ${s.r}/${ROUNDS}`, me ? `Tout en « ${s.L} » !` : "Vous regardez la partie",
          me ? `<button class="pb-stop" id="pb-stop" type="button" disabled>STOP !</button>` : "") +
        `<div id="pb-ban" class="pb-banw"></div>` +
        (me ? `<div class="pb-rows">${s.c.map((ci, i) => `<label class="pb-row" id="pb-row${i}"><span class="pb-note pb-n${i % NOTE_COLORS}" style="--rot:${i % 2 ? 1.2 : -1.6}deg">${esc(CATS[ci])}</span>
            <span class="pb-field"><input class="pb-in" id="pb-in${i}" data-i="${i}" type="text" maxlength="${MAXLEN}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              enterkeyhint="${i < NC - 1 ? "next" : "done"}" placeholder="${s.L}…" aria-label="${esc(CATS[ci])}"><i class="pb-warn"></i></span></label>`).join("")}</div>
          <p class="pb-hint" id="pb-hint">Remplis les 6 cases pour pouvoir crier STOP !</p>` :
          `<div class="pb-rows">${s.c.map((ci, i) => `<div><span class="pb-note pb-n${i % NOTE_COLORS}">${esc(CATS[ci])}</span></div>`).join("")}</div>`) +
        `<div class="pb-prog"><h4>Copies en cours</h4><ul id="pb-prog"></ul></div>${me ? `<div class="pb-pad"></div>` : ""}`;
      if (!me) return;
      const ins = [...el.querySelectorAll(".pb-in")];
      ins.forEach((inp, i) => {
        inp.value = myAns[i] || "";
        inp.addEventListener("input", () => { myAns[i] = inp.value.slice(0, MAXLEN); checkRows(); sendSoon(); renderProg(); });
        inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (ins[i + 1]) ins[i + 1].focus(); else inp.blur(); } });
        inp.addEventListener("focus", () => later(() => { if (document.activeElement === inp) inp.scrollIntoView({block: "center", behavior: RM ? "auto" : "smooth"}); }, 320));
      });
      $("pb-stop").addEventListener("click", () => {
        if (!S || S.ph !== "play" || S.sx != null || !myAns.every(x => norm(x))) return;
        myStop = 1; push(); tone(660, .12, "square", .08); later(() => tone(880, .2, "square", .08), 120);
        const b = $("pb-stop"); b.disabled = true; b.textContent = "…";
      });
      checkRows();
    }
    function checkRows() {
      if (!S || mySeat < 0) return;
      for (let i = 0; i < NC; i++) {
        const row = $("pb-row" + i); if (!row) continue;
        const v = myAns[i] || "", bad = norm(v) ? autoBad(v, S.L) : "";
        row.classList.toggle("pb-bad", !!bad); row.classList.toggle("pb-ok", !!norm(v) && !bad);
        row.querySelector(".pb-warn").textContent = bad && bad !== "vide" ? bad : "";
      }
      const b = $("pb-stop"), hint = $("pb-hint"), full = myAns.every(x => norm(x));
      if (b && S.ph === "play" && S.sx == null && !myStop) { b.disabled = !full; b.textContent = "STOP !"; }
      if (hint) hint.textContent = S.sx != null ? "Vite, complète ce que tu peux !" : full ? "Tout est rempli : appuie sur STOP ! pour arrêter tout le monde." : "Remplis les 6 cases pour pouvoir crier STOP !";
    }
    function renderProg() {
      const ul = $("pb-prog"); if (!ul || !S) return;
      const alive = aliveSet();
      ul.innerHTML = P.map((p, s) => {
        const inp = s === mySeat ? {r: S.r, a: myAns} : allInputs[p.key];
        const a = inp && inp.r === S.r && Array.isArray(inp.a) ? inp.a : [];
        const n = clean(a).filter(x => norm(x)).length;
        return `<li class="${alive.has(p.key) ? "" : "pb-gone"}"><span>${nameHTML(s)}${s === mySeat ? " (toi)" : ""}</span><span class="pb-dots">${Array.from({length: NC}, (_, i) => `<i class="${i < n ? "f" : ""}"></i>`).join("")}</span></li>`;
      }).join("");
    }
    function updPlay(s) {
      const clock = $("pb-clock");
      if (clock) { clock.textContent = s.ph === "lock" ? "0" : fmt(s.tl); clock.classList.toggle("pb-hot", s.ph === "play" && s.tl <= 10); }
      const ban = $("pb-ban");
      const setBan = (mode, html) => { if (ban.dataset.m !== mode) { ban.dataset.m = mode; ban.innerHTML = html; } };
      if (s.ph === "lock") {
        setBan("lock", `<div class="pb-ban pb-lockb" role="status"><b>Stylos posés !</b><small>On ramasse les copies…</small></div>`);
        el.querySelectorAll(".pb-in").forEach(i => { i.disabled = true; i.blur(); });
        const b = $("pb-stop"); if (b) { b.disabled = true; b.textContent = "STOP"; }
        push();
      } else if (s.sx != null) {
        const who = s.sb === mySeat ? "toi" : nameHTML(s.sb);
        setBan("stop", `<div class="pb-ban" role="status"><b></b><small>STOP ! crié par ${who}</small></div>`);
        ban.querySelector("b").textContent = `STOP dans ${s.sx}…`;
        const b = $("pb-stop"); if (b) { b.disabled = true; b.textContent = "STOP"; }
        if (lastStopBeep !== s.sx) { lastStopBeep = s.sx; tone(s.sx ? 520 : 260, .12, "square", .07); }
      } else setBan("", "");
      checkRows(); renderProg();
    }

    /* ---- correction : le juge attribue les points ---- */
    function ansList(s, ci, rowFn) {
      return P.map((p, si) => s.A[si] ? rowFn(si, s.A[si][ci] || "", si * NC + ci) : "").join("");
    }
    const ptsOf = id => (amJudge() && myPts ? myPts : S.p)[id];
    const ptLabel = c => c === "-" ? "–" : String(PTS[c]);
    function myTotal(codes) { let t = 0; if (mySeat >= 0) for (let ci = 0; ci < NC; ci++) t += PTS[codes[mySeat * NC + ci]] || 0; return t; }
    function buildVal(s) {
      const me = mySeat >= 0, judge = amJudge(), jn = nameHTML(s.j);
      clearConfirm();
      page.innerHTML = top(s, "Correction", judge ? "⚖️ Tu es le juge" : `⚖️ Juge : ${jn}`) +
        `<p class="pb-instr">${judge
          ? `<b>Tu donnes les points.</b> Touche un score pour le changer : <b>10 → 5 → 0</b>. Pré-rempli : unique 10, doublon 5, vide ou mauvaise lettre 0.`
          : `<b>${jn}</b> est le juge : il donne les points, tu les vois en direct.${me ? " Pas d'accord ? Touche 👎." : ""}`}</p>` +
        s.c.map((ci, k) => `<section class="pb-cat"><span class="pb-note pb-n${k % NOTE_COLORS}" style="--rot:${k % 2 ? 1.2 : -1.6}deg">${esc(CATS[ci])}</span><ul>` +
          ansList(s, k, (si, a, id) => {
            const mine = si === mySeat, empty = !norm(a), bad = autoBad(a, s.L);
            const vote = !judge && me && !mine && !empty
              ? `<button class="pb-vote" type="button" data-id="${id}" aria-label="Contester ${esc(a)}">👎<b></b></button>`
              : `<span class="pb-cnt" data-c="${id}"></span>`;
            const pt = judge
              ? `<button class="pb-pt" type="button" data-id="${id}"${empty ? " disabled" : ""} aria-label="Points pour ${esc(a || "réponse vide")}"></button>`
              : `<span class="pb-pt" data-id="${id}"></span>`;
            return `<li class="pb-ans${mine ? " pb-mine" : ""}" data-li="${id}"><span class="pb-aw"><span class="pb-who">${nameHTML(si)}${mine ? " (toi)" : ""}</span>` +
              `<span class="pb-txt${a ? "" : " pb-empty"}">${a ? esc(a) : "—"}</span>${bad && bad !== "vide" ? `<em class="pb-why">${bad}</em>` : ""}</span>${vote}${pt}</li>`;
          }) + `</ul></section>`).join("") +
        `<div class="pb-okbar" id="pb-bar"></div>`;
      el.querySelectorAll(".pb-vote").forEach(b => b.addEventListener("click", () => {
        const id = +b.dataset.id;
        if (myVotes.has(id)) myVotes.delete(id); else { myVotes.add(id); tone(300, .08, "triangle", .08); }
        b.classList.toggle("pb-on", myVotes.has(id)); push();
      }));
      el.querySelectorAll("button.pb-pt").forEach(b => b.addEventListener("click", () => {
        if (!amJudge() || myDone) return;
        const id = +b.dataset.id, c = ptsOf(id), nx = c === "2" ? "1" : c === "1" ? "0" : "2";
        myPts = myPts.slice(0, id) + nx + myPts.slice(id + 1);
        push(); updVal(S);
        tone(nx === "2" ? 880 : nx === "1" ? 660 : 220, .07, "triangle", .08);
        if (api.haptic) api.haptic("light");
      }));
      prevP = s.p;
      drawBar(s);
    }
    function clearConfirm() { confirming = false; cancel(confirmT); confirmT = null; }
    /* Barre du bas : « Terminé ✓ » (avec confirmation) pour le juge, rappel du juge et total de ma copie pour les autres. */
    function drawBar(s) {
      const bar = $("pb-bar"); if (!bar) return;
      const late = s.tl <= 30 ? ` · validation auto dans ${s.tl} s` : "";
      let mode, html;
      if (amJudge()) {
        const nCt = (s.V.match(/[1-9]/g) || []).length;
        if (myDone) { mode = "sent"; html = `<span class="pb-bmsg">Points validés, on corrige au stylo rouge…</span>`; }
        else if (confirming) {
          mode = "ask";
          html = `<span class="pb-bmsg"><b>Valider ces points ?</b></span><button class="gk-btn" id="pb-no" type="button">Retour</button><button class="gk-btn good" id="pb-yes" type="button">Oui ✓</button>`;
        } else {
          mode = "j:" + nCt + late;
          html = `<button class="gk-btn good pb-done" id="pb-done" type="button">Terminé ✓</button><span class="pb-bmsg">${nCt ? `👎 sur ${nCt} réponse${nCt > 1 ? "s" : ""}` : "Prends ton temps."}${late}</span>`;
        }
      } else {
        const t = myTotal(s.p);
        mode = "o:" + t + late;
        html = `<span class="pb-bmsg">⚖️ <b>${nameHTML(s.j)}</b> corrige…${late}</span>${mySeat >= 0 ? `<span class="pb-mytot">Ta copie<b>${t}</b></span>` : ""}`;
      }
      if (bar.dataset.m === mode) return;
      bar.dataset.m = mode; bar.innerHTML = html;
      const on = (id, fn) => { const b = $(id); if (b) b.addEventListener("click", fn); };
      on("pb-done", () => { confirming = true; drawBar(S); confirmT = later(() => { confirmT = null; confirming = false; drawBar(S); }, 8000); });
      on("pb-no", () => { clearConfirm(); drawBar(S); });
      on("pb-yes", () => { clearConfirm(); myDone = 1; push(); drawBar(S); tone(523, .1, "triangle", .1); later(() => tone(784, .2, "triangle", .1), 110); if (api.haptic) api.haptic("success"); });
    }
    function updVal(s) {
      const clock = $("pb-clock");
      if (clock) { clock.textContent = fmt(s.tl); clock.classList.toggle("pb-hot", s.tl <= 30); }
      const judge = amJudge(), codes = judge && myPts ? myPts : s.p, alive = aliveSet();
      for (let id = 0; id < NP * NC; id++) {
        const li = el.querySelector(`[data-li="${id}"]`);
        if (!li) continue;
        li.classList.toggle("pb-gone", !alive.has(P[(id / NC) | 0].key));
        const c = codes[id], pt = li.querySelector(".pb-pt");
        li.classList.toggle("pb-x", c === "0");
        if (pt) {
          const cls = "pb-pt pb-v" + c;
          if (pt.className.replace(" pb-flash", "") !== cls) {
            pt.className = cls;
            if (!judge && prevP && prevP[id] !== c && !RM) { void pt.offsetWidth; pt.classList.add("pb-flash"); }
          }
          pt.textContent = ptLabel(c);
        }
        const n = +(s.V[id] || 0);
        const b = li.querySelector(".pb-vote");
        if (b) { b.querySelector("b").textContent = n ? " " + n : ""; b.classList.toggle("pb-on", myVotes.has(id)); }
        const cn = li.querySelector(".pb-cnt"); if (cn) cn.textContent = n ? `👎 ${n}` : "";
      }
      prevP = s.p;
      drawBar(s);
    }

    /* ---- corrections au stylo rouge ---- */
    function buildCor(s) {
      const me = mySeat >= 0, g = me ? s.G[mySeat] : 0;
      page.innerHTML = top(s, "Corrigé", `Manche ${s.r}/${ROUNDS} · lettre ${s.L}`) +
        (me ? `<div class="pb-score"><span class="pb-circle">+${g}</span><p>${g >= 50 ? "Excellent travail !" : g >= 30 ? "Bien, continue !" : g >= 15 ? "Peut mieux faire." : "Il faut réviser !"}<br><small>Unique 10 · doublon 5${s.j != null && P[s.j] ? ` · juge : ${nameHTML(s.j)}` : ""}</small></p></div>` : "") +
        s.c.map((ci, k) => `<section class="pb-cat pb-cor"><span class="pb-note pb-n${k % NOTE_COLORS}" style="--rot:${k % 2 ? 1.2 : -1.6}deg">${esc(CATS[ci])}</span><ul>` +
          ansList(s, k, (si, a, id) => {
            const r = s.R[id], dl = `style="--dl:${((k * 0.25 + 0.2) / spd()).toFixed(2)}s"`;
            if (r === "-") return `<li class="pb-ans pb-gone"><span class="pb-who">${nameHTML(si)}</span><span class="pb-txt pb-empty">parti</span></li>`;
            const mark = r === "2" ? `<em class="pb-mark pb-big" ${dl}>+10</em>` : r === "1" ? `<em class="pb-mark pb-big" ${dl}>+5<small>doublon</small></em>`
              : `<em class="pb-mark" ${dl}>${autoBad(a, s.L) || "refusé"}</em>`;
            return `<li class="pb-ans${r === "0" ? " pb-x" : ""}${si === mySeat ? " pb-mine" : ""}" ${dl}><span class="pb-who">${nameHTML(si)}${si === mySeat ? " ★" : ""}</span><span class="pb-txt${a ? "" : " pb-empty"}" ${dl}>${a ? esc(a) : "—"}</span>${mark}</li>`;
          }) + `</ul></section>`).join("");
      later(() => tone(1400, .05, "sawtooth", .02), 300);
    }
    function updClock(s) { const c = $("pb-clock"); if (c) { c.textContent = fmt(s.tl); c.classList.remove("pb-hot"); } }

    /* ---- classement ---- */
    function rankList(s, order) {
      const alive = aliveSet();
      return `<ol class="pb-rank">${order.map((si, i) => {
        const p = P[si], rank = order.findIndex(o => s.S[o] === s.S[si]) + 1;
        return `<li class="${si === mySeat ? "pb-mine " : ""}${rank === 1 ? "pb-first " : ""}${alive.has(p.key) ? "" : "pb-gone"}" style="--i:${i}">
          <span class="pb-rk">${rank}</span><span class="pb-av">${api.avatar(p.key, {view: "bust"})}</span>
          <b class="pb-nm">${esc(p.pseudo)}${si === mySeat ? " (toi)" : ""}<small>${alive.has(p.key) ? "" : "a quitté la partie"}</small></b>
          ${s.G ? `<span class="pb-gain">+${s.G[si]}</span>` : ""}<span class="pb-tot">${s.S[si]}</span></li>`;
      }).join("")}</ol>`;
    }
    const order = s => P.map((p, i) => i).sort((a, b) => (s.S[b] - s.S[a]) || a - b);
    function buildLb(s) {
      page.innerHTML = `<div class="pb-lb"><h2 class="pb-script">Classement</h2><p>${s.r >= ROUNDS ? "après la dernière manche" : `après la manche ${s.r}/${ROUNDS}`}</p>${rankList(s, order(s))}<p class="pb-next" id="pb-next"></p></div>`;
    }
    function buildEnd(s) {
      const o = s.rk || order(s), podium = o.slice(0, 3);
      const words = ["Félicitations du jury", "Très bien", "Assez bien"];
      const slot = [1, 0, 2].filter(i => podium[i] != null);
      page.innerHTML = `<div class="pb-lb"><h2 class="pb-script">Bulletin final</h2><p>3 manches, ${NP} copies corrigées</p>
        <div class="pb-pod">${slot.map(i => { const si = podium[i]; return `<figure class="pb-p${i + 1}"><span class="pb-av">${api.avatar(P[si].key, {view: "bust"})}</span>
          <figcaption>${esc(P[si].pseudo)}</figcaption><em>${words[i]}</em><div class="pb-step">${s.S[si]}</div></figure>`; }).join("")}</div>
        ${rankList(s, o)}</div>`;
      tone(523, .15, "triangle", .1); later(() => tone(659, .15, "triangle", .1), 150); later(() => tone(784, .3, "triangle", .1), 300);
    }

    function render(s) {
      if (dead || !s) return;
      const prev = S; S = s;
      if (s.r !== myRound) { myRound = s.r; myAns = blank(); myStop = 0; myVotes = new Set(); myPts = ""; myJv = 0; myDone = 0; clearConfirm(); lastStopBeep = -1; }
      // je deviens juge (début de correction ou relève) : je repars des points publiés
      if (s.ph === "val" && mySeat >= 0 && s.j === mySeat && myJv !== s.jv) { myJv = s.jv; myPts = s.p; myDone = 0; push(); }
      const ph = s.ph === "lock" ? "play" : s.ph, vk = ph + ":" + s.r + (ph === "val" ? ":" + s.j : "");
      if (vk !== view) {
        if (prev && (prev.ph === "play" || prev.ph === "lock")) push();     // dernières réponses
        const relay = ph === "val" && view.startsWith("val:" + s.r + ":");    // relève du juge : on garde le défilement
        view = vk;
        if (relay) { const y = el.scrollTop; buildVal(s); el.scrollTop = y; api.toast(s.j === mySeat ? "⚖️ Le juge est parti : c'est toi le juge !" : `⚖️ ${P[s.j].pseudo} devient juge.`); }
        else {
          page.scrollTop = 0; el.scrollTop = 0;
          ({draw: buildDraw, play: buildPlay, val: buildVal, cor: buildCor, lb: buildLb, end: buildEnd})[ph](s);
        }
      }
      if (ph === "play") updPlay(s);
      else if (ph === "val") updVal(s);
      else if (ph === "cor") updClock(s);
      else if (ph === "lb") { const n = $("pb-next"); if (n) n.innerHTML = s.r >= ROUNDS ? `Bulletin final dans <b>${s.tl}</b> s` : `Manche ${s.r + 1} dans <b>${s.tl}</b> s`; }
    }
    api.onState(render);
    api.onInputs(map => { allInputs = map; if (S && S.ph === "play") renderProg(); });

    return {
      destroy() {
        dead = true;
        timers.forEach(t => clearTimeout(t)); timers.clear();
        clearInterval(beat);
        el.removeEventListener("pointerdown", wake);
        if (AC) { try { AC.close(); } catch (e) {} AC = null; }
        el.innerHTML = "";
      }
    };
  }
});
})();
