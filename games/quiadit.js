/* Gonflette Party : Qui a dit ça ? (3 à 8 joueurs, chacun sur son téléphone).
   Ambiance magazine people / presse à potins : « POTINS & PROTÉINES », le journal qui balance.
   Chaque numéro (manche), une question est tirée ; chacun écrit en secret une réponse courte (60 s, 80 car.).
   Les confidences sont ensuite dévoilées une par une, anonymes et mélangées : les autres votent pour l'auteur
   (20 s), puis l'auteur est démasqué. Points : +1 par bonne réponse pour l'enquêteur, +1 pour l'auteur par
   joueur berné, +1 bonus « Imprévisible » si personne ne l'a trouvé.
   État publié par l'hôte : la confidence en cours seulement, auteur légèrement brouillé jusqu'à la révélation.
   Entrée joueur (absolue, renvoyée régulièrement) : {r, a: texte, ok: 0|1 (scellée), c: n° de carte, v: place votée}.
   Tests : window.__qadSpeed = 10 accélère les durées (lu par l'hôte et pour les animations). */
(function () {
"use strict";

const QUESTIONS = [
  "Ta pire honte à la salle de sport", "Le plat que tu pourrais manger tous les jours", "Ton talent caché le plus inutile",
  "Ce que tu ferais avec 1 million d'euros", "Ta phrase de drague la plus nulle", "Le métier dont tu rêvais à 8 ans",
  "Ta pire coupe de cheveux", "La chanson que tu chantes à fond sous la douche", "Ton excuse préférée pour sécher le sport",
  "Le truc que tu ne sais toujours pas faire à ton âge", "Ton plaisir coupable à la télé", "La pire excuse que tu aies donnée pour un retard",
  "Le surnom qu'on te donnait petit(e)", "Ton premier achat avec ton premier salaire", "L'objet le plus bizarre chez toi",
  "Ce que tu commandes toujours au resto", "Ta peur la plus irrationnelle", "Le film que tu peux revoir 100 fois",
  "Ta pire tenue de soirée", "La première chose que tu fais en te réveillant", "Le super-pouvoir que tu voudrais avoir",
  "La célébrité avec qui tu aimerais dîner", "L'exercice de muscu que tu détestes le plus", "Ce que tu manges après une séance de sport",
  "Ton record le plus ridicule", "Le pire cadeau que tu aies reçu", "Ton emoji le plus utilisé",
  "Le dernier truc qui t'a fait pleurer de rire", "Ta pire galère en vacances", "Ton péché mignon au supermarché",
  "Le mot ou l'expression que tu dis beaucoup trop", "Ton rituel bizarre avant de dormir", "Le prénom que tu donnerais à ton haltère",
  "Ce que tu ferais si tu étais invisible une journée", "La pire chose que tu aies cuisinée", "La compétence un peu gonflée de ton CV",
  "Ton pire fou rire au mauvais moment", "La dernière chose que tu as cherchée sur internet (version avouable)", "Le sport olympique que tu pourrais gagner",
  "Ton animal totem", "L'appli que tu ouvres 50 fois par jour", "Ta plus grosse bêtise d'enfance",
  "Le défaut qui t'agace chez toi", "Ce que tu cries quand tu soulèves lourd", "Le seul titre de ta playlist de muscu",
  "Le pire petit boulot que tu aies fait", "Si tu étais un plat, tu serais…", "Ta technique pour fuir une conversation gênante",
  "Ce que tu fais pendant les réunions ennuyeuses", "Le truc que tu collectionnes (ou collectionnais)", "La destination de tes rêves",
  "Ton défi sportif le plus fou (réel ou rêvé)", "La phrase de tes parents que tu répètes maintenant", "Ton jeu vidéo ou jeu de société préféré",
  "La chose la plus chère que tu aies cassée", "Le slogan de ton t-shirt de sport idéal", "Ton crush de célébrité quand tu étais ado",
  "Le dernier petit mensonge gentil que tu as dit", "Ton petit-déj parfait", "Ta pose de bodybuilder signature (décris-la !)",
  "Le titre de ton autobiographie", "La pire mode que tu as suivie", "Le truc le plus bizarre que tu aies mangé",
  "Le bruit qui t'énerve le plus", "Ce que tu ferais d'une journée sans téléphone", "Ton objectif de muscu secret",
  "Ta devise dans la vie", "Ta chanson de karaoké imparable", "Le métier que tu ferais dans une autre vie",
  "Ton pire souvenir de cours de sport à l'école", "Le surnom que tu donnerais à ton coach", "L'appareil de la salle que tu n'as jamais compris"
];
const MAXLEN = 80, RECAP_LEN = 56;
const T = {intro: 6, write: 60, lock: 1, vote: 20, rev: 7, rk: 10, empty: 4, end: 5};
const roundsFor = n => n <= 4 ? 5 : n <= 6 ? 4 : 3;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const cleanTxt = s => Array.from(String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()).slice(0, MAXLEN).join("");
const cut = (s, n) => { const a = Array.from(String(s)); return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join(""); };
/* Auteur brouillé pendant le vote (pas affiché ; juste pour que l'auteur se reconnaisse). */
const enc = (s, r, i) => (s + 3 + r * 5 + i * 7) % 11;
const dec = (o, r, i) => (((o - 3 - r * 5 - i * 7) % 11) + 11) % 11;
const plural = (n, w, ws) => n + " " + (n > 1 ? (ws || w + "s") : w);

const CSS = `
.qad{--paper:#f6f0e2;--ink:#151316;--red:#e3120b;--yel:#ffd60a;--pink:#ff4f9a;--blue:#1c64f2;--mute:#6b6470;
  position:relative;min-height:100%;box-sizing:border-box;padding:0 0 30px;color:var(--ink);overflow-x:clip;
  font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;font-size:18px;line-height:1.2;
  background-color:var(--paper);
  background-image:radial-gradient(rgba(21,19,22,.07) 1px,transparent 1.3px),radial-gradient(rgba(227,18,11,.05) 1px,transparent 1.3px);
  background-size:7px 7px,11px 11px;background-position:0 0,3px 5px}
.qad *{box-sizing:border-box}
.qad button{font-family:inherit;color:inherit}
.qad-a{font-family:"Anton",Impact,sans-serif;font-weight:400;letter-spacing:.01em}
.qad-s{font-family:"Pacifico","Brush Script MT",cursive;font-weight:400}
/* bandeau du magazine */
.qad-mast{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:10px;padding:8px max(12px,calc(50% - 310px)) 9px;background:var(--red);color:#fff;
  border-bottom:4px solid var(--ink);box-shadow:0 3px 0 var(--yel)}
.qad-logo{flex:1;min-width:0;line-height:.9;transform:rotate(-1.5deg)}
.qad-logo b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:34px;letter-spacing:.03em;text-shadow:3px 3px 0 var(--ink)}
.qad-logo small{display:block;font-family:"Pacifico",cursive;font-size:14px;color:var(--yel);margin:2px 0 0 6px;white-space:nowrap}
.qad-iss{flex:none;text-align:right;font-weight:800;font-size:13px;line-height:1.1;text-transform:uppercase;letter-spacing:.06em}
.qad-iss b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:20px;letter-spacing:.02em}
.qad-clock{flex:none;width:58px;height:58px;display:grid;place-items:center;color:var(--ink);background:var(--yel);
  clip-path:polygon(50% 0,61% 13%,77% 6%,79% 23%,95% 25%,88% 40%,100% 50%,88% 60%,95% 75%,79% 77%,77% 94%,61% 87%,50% 100%,39% 87%,23% 94%,21% 77%,5% 75%,12% 60%,0 50%,12% 40%,5% 25%,21% 23%,23% 6%,39% 13%);
  font-family:"Anton",Impact,sans-serif;font-size:22px;font-variant-numeric:tabular-nums}
.qad-clock.qad-hot{background:#fff;color:var(--red);animation:qad-pulse 1s ease-in-out infinite}
.qad-clock.qad-off{visibility:hidden}
.qad-page{max-width:620px;margin:0 auto;padding:12px 14px 0}
.qad-kick{display:inline-block;white-space:nowrap;padding:3px 9px 2px;background:var(--ink);color:var(--yel);font-weight:800;font-size:14px;letter-spacing:.12em;text-transform:uppercase;transform:rotate(-1.5deg)}
.qad-kick.qad-r{background:var(--red);color:#fff}
.qad-head{margin:8px 0 6px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(30px,9vw,46px);line-height:1.02;text-transform:uppercase;letter-spacing:.005em}
.qad-head em{font-style:normal;color:var(--red)}
.qad-sub{margin:0 0 10px;font-weight:600;color:var(--mute);font-size:17px}
.qad-q{position:relative;margin:2px 0 12px;padding:10px 12px 12px;background:#fff;border:3px solid var(--ink);box-shadow:5px 5px 0 var(--ink)}
.qad-q h2{margin:6px 0 0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(23px,6.6vw,32px);line-height:1.05;text-transform:uppercase}
.qad-q.qad-small h2{font-size:19px}
/* couverture */
.qad-cover{position:relative;padding-top:4px}
.qad-burst{position:absolute;right:-4px;top:-2px;width:104px;height:104px;display:grid;place-items:center;text-align:center;background:var(--yel);color:var(--ink);
  clip-path:polygon(50% 0,61% 13%,77% 6%,79% 23%,95% 25%,88% 40%,100% 50%,88% 60%,95% 75%,79% 77%,77% 94%,61% 87%,50% 100%,39% 87%,23% 94%,21% 77%,5% 75%,12% 60%,0 50%,12% 40%,5% 25%,21% 23%,23% 6%,39% 13%);
  font-family:"Anton",Impact,sans-serif;font-size:17px;line-height:1;transform:rotate(12deg);animation:qad-spin 6s linear infinite}
.qad-burst span{display:block;padding:0 14px}
.qad-cover .qad-head{padding-right:84px}
.qad-stars{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 8px;margin:14px 0 8px}
.qad-star{width:84px;text-align:center;animation:qad-drop .5s backwards;animation-delay:calc(var(--i) * 90ms)}
.qad-star .qad-av{width:70px;height:70px;margin:0 auto}
.qad-star b{display:block;margin-top:3px;font-weight:800;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qad-av{display:block;border-radius:50%;overflow:hidden;background:#ffe7f1;border:3px solid var(--ink)}
.qad-av svg{width:100%;height:100%;display:block}
.qad-av.qad-a2{background:#dfeaff}.qad-av.qad-a3{background:#fff3b8}.qad-av.qad-a4{background:#dcf7df}
.qad-note{margin:12px 0 0;padding:10px 12px;background:var(--yel);border:2px dashed var(--ink);font-weight:700;font-size:17px;transform:rotate(-.8deg)}
/* écriture */
.qad-pad{position:relative;margin:4px 0 10px;padding:12px;background:#fff;border:3px solid var(--ink);box-shadow:5px 5px 0 var(--pink)}
.qad-pad label{display:block;font-family:"Pacifico",cursive;font-size:18px;color:var(--red);margin:0 0 6px}
.qad-ta{display:block;width:100%;min-height:96px;resize:none;padding:8px 10px;border:2px solid #cfc6d6;border-radius:6px;background:#fffdf7;
  font-family:"Barlow Condensed",sans-serif;font-weight:600;font-size:23px;line-height:1.15;color:var(--ink);outline:none}
.qad-ta:focus{border-color:var(--ink);box-shadow:0 0 0 3px var(--yel)}
.qad-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.qad-cnt{flex:1;font-weight:700;color:var(--mute);font-size:15px}
.qad-btn{flex:none;min-height:50px;padding:0 18px;border:3px solid var(--ink);border-radius:999px;background:var(--red);color:#fff!important;
  font-family:"Anton",Impact,sans-serif!important;font-size:21px;letter-spacing:.04em;cursor:pointer;box-shadow:0 4px 0 var(--ink);text-transform:uppercase}
.qad-btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.qad-btn:disabled{background:#cfc6d6;cursor:default}
.qad-btn.qad-ghost{background:#fff;color:var(--ink)!important;font-size:17px;min-height:40px;padding:0 14px}
.qad-env{display:flex;align-items:center;gap:12px}
.qad-env .qad-ico{flex:none;font-size:48px;line-height:1;animation:qad-pop .4s}
.qad-env p{flex:1;min-width:0;margin:0}
.qad-env p b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:24px;text-transform:uppercase;color:var(--red)}
.qad-env p q{display:block;margin-top:3px;font-weight:600;font-size:18px;color:var(--mute);overflow-wrap:anywhere}
.qad-prog h4{margin:16px 0 8px;font-weight:800;font-size:15px;letter-spacing:.1em;text-transform:uppercase}
.qad-chips{display:flex;flex-wrap:wrap;gap:8px}
.qad-chip{display:flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;border:2px solid var(--ink);border-radius:999px;background:#fff;font-weight:700;font-size:16px;max-width:100%}
.qad-chip .qad-av{width:32px;height:32px;border-width:2px;flex:none}
.qad-chip span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qad-chip i{font-style:normal;flex:none}
.qad-chip.qad-done{background:var(--yel)}
.qad-gone{opacity:.42;filter:grayscale(1)}
.qad-spacer{height:34vh}
/* confidence */
.qad-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}
.qad-meta small{font-weight:700;color:var(--mute);font-size:15px;line-height:1.1;min-width:0;text-align:right;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.qad-clip{position:relative;margin:14px 4px 16px;padding:20px 18px 18px;background:#fff;color:var(--ink);transform:rotate(-1.2deg);
  box-shadow:0 10px 22px -10px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.08);
  clip-path:polygon(0 3%,4% 0,9% 2%,15% 0,22% 3%,30% 0,38% 2%,46% 0,55% 3%,63% 0,71% 2%,80% 0,88% 3%,95% 0,100% 2%,99% 30%,100% 60%,98% 97%,93% 100%,86% 98%,78% 100%,70% 97%,61% 100%,52% 98%,44% 100%,35% 97%,27% 100%,18% 98%,10% 100%,3% 97%,0 100%,1% 60%)}
.qad-clip.qad-in{animation:qad-slap .5s cubic-bezier(.2,1.5,.5,1) backwards}
.qad-clip::before{content:"“";position:absolute;left:6px;top:-18px;font-family:"Anton",Impact,sans-serif;font-size:96px;color:var(--pink);opacity:.9;line-height:1}
.qad-quote{position:relative;margin:0;padding-left:30px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(25px,7.4vw,38px);line-height:1.08;overflow-wrap:anywhere;text-transform:none}
.qad-quote.qad-long{font-size:clamp(21px,6vw,30px)}
.qad-tape{position:absolute;top:-2px;left:50%;width:84px;height:20px;margin-left:-42px;background:rgba(255,214,10,.75);transform:rotate(3deg)}
.qad-ask{margin:2px 0 8px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:26px;text-transform:uppercase;text-align:center}
.qad-ask small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:600;font-size:15px;color:var(--mute);text-transform:none}
.qad-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
.qad-pick{position:relative;display:grid;justify-items:center;gap:4px;padding:8px 4px 8px;border:3px solid var(--ink);border-radius:12px;background:#fff;cursor:pointer;
  box-shadow:0 4px 0 var(--ink);transition:transform .12s}
.qad-pick .qad-av{width:66px;height:66px}
.qad-pick b{max-width:100%;font-weight:800;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qad-pick:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.qad-pick.qad-on{background:var(--yel);transform:rotate(-2deg) scale(1.04)}
.qad-pick.qad-on::after{content:"SUSPECT !";position:absolute;top:6px;right:-6px;padding:1px 6px;background:var(--red);color:#fff;font-family:"Anton",Impact,sans-serif;font-size:13px;letter-spacing:.06em;transform:rotate(12deg);animation:qad-pop .25s}
.qad-pick:disabled{cursor:default;box-shadow:none}
.qad-poker{margin:4px 0 10px;padding:14px;text-align:center;background:var(--ink);color:#fff;border-radius:12px;transform:rotate(1deg)}
.qad-poker b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:28px;color:var(--yel);text-transform:uppercase}
.qad-poker span{display:block;font-size:44px;line-height:1.2;animation:qad-shh 2.4s ease-in-out infinite}
.qad-poker small{display:block;font-weight:600;font-size:16px;opacity:.85}
.qad-tally{margin:12px 0 0;text-align:center;font-weight:700;color:var(--mute)}
.qad-tally b{font-family:"Anton",Impact,sans-serif;font-weight:400;color:var(--ink);font-size:20px}
/* révélation */
.qad-rev{position:relative;text-align:center}
.qad-drum{margin:6px 0 0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:28px;text-transform:uppercase}
.qad-drum i{font-style:normal;display:inline-block;animation:qad-dot 1s infinite}
.qad-drum i:nth-child(2){animation-delay:.15s}.qad-drum i:nth-child(3){animation-delay:.3s}
.qad-polar{position:relative;width:min(250px,68vw);margin:8px auto 4px;padding:10px 10px 6px;background:#fff;box-shadow:0 12px 26px -10px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.1);
  transform:rotate(3deg);opacity:0}
.qad-polar .qad-ph{display:block;aspect-ratio:290/250;background:linear-gradient(160deg,#ffd3e6,#cfe0ff);overflow:hidden}
.qad-polar .qad-ph svg{width:100%;height:100%;display:block}
.qad-polar figcaption{font-family:"Pacifico",cursive;font-size:26px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qad-stamp{position:absolute;left:50%;top:70%;padding:2px 12px;border:4px solid var(--red);border-radius:8px;color:var(--red);background:rgba(255,255,255,.82);
  font-family:"Anton",Impact,sans-serif;font-size:30px;letter-spacing:.06em;white-space:nowrap;transform:translate(-50%,-50%) rotate(-14deg);opacity:0}
.qad-stamp.qad-imp{border-color:var(--blue);color:var(--blue)}
.qad-flash{position:fixed;inset:0;z-index:20;background:#fff;opacity:0;pointer-events:none}
.qad-rev.qad-shown .qad-drum{display:none}
.qad-rev.qad-shown .qad-polar{opacity:1;animation:qad-polar .6s cubic-bezier(.2,1.4,.5,1)}
.qad-rev.qad-shown .qad-stamp{opacity:1;animation:qad-stampin .35s .45s backwards cubic-bezier(.3,1.6,.6,1)}
.qad-rev.qad-shown .qad-flash{animation:qad-flash .7s}
.qad-after{opacity:0}
.qad-rev.qad-shown .qad-after{opacity:1;animation:qad-up .45s .55s backwards}
.qad-badge{display:inline-block;margin:6px 0 4px;padding:5px 14px 4px;background:var(--blue);color:#fff;font-family:"Anton",Impact,sans-serif;font-size:22px;letter-spacing:.05em;text-transform:uppercase;transform:rotate(-2deg);border:3px solid var(--ink)}
.qad-badge.qad-open{background:var(--pink)}
.qad-badge small{display:block;font-family:"Barlow Condensed",sans-serif;font-size:14px;letter-spacing:0;text-transform:none;font-weight:700}
.qad-mine{margin:6px auto 8px;max-width:420px;padding:8px 12px;background:var(--ink);color:#fff;font-weight:700;font-size:19px;border-radius:10px}
.qad-mine b{color:var(--yel);font-family:"Anton",Impact,sans-serif;font-weight:400}
.qad-mini{margin:4px 0 6px;padding:8px 10px;background:#fff;border-left:6px solid var(--pink);font-family:"Anton",Impact,sans-serif;font-size:20px;line-height:1.1;text-align:left;overflow-wrap:anywhere}
.qad-votes{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px;text-align:left}
.qad-votes li{display:flex;align-items:center;gap:8px;padding:4px 8px 4px 4px;background:#fff;border:2px solid var(--ink);border-radius:10px}
.qad-votes .qad-av{width:36px;height:36px;border-width:2px;flex:none}
.qad-votes span{flex:1;min-width:0;font-weight:700;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qad-votes span small{font-weight:600;color:var(--mute);font-size:15px}
.qad-votes li.qad-ok{background:#dcf7df}.qad-votes li.qad-ko{background:#ffe3ea}
.qad-votes li.qad-auth{background:var(--yel)}
.qad-pts{flex:none;font-family:"Anton",Impact,sans-serif;font-size:20px;color:var(--red)}
.qad-pts.qad-z{color:var(--mute)}
/* classement */
.qad-rk h2{margin:4px 0 2px;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:34px;text-transform:uppercase;line-height:1}
.qad-recap{display:grid;gap:8px;margin:8px 0 14px}
.qad-recap div{padding:6px 10px;background:#fff;border:2px solid var(--ink);transform:rotate(var(--rot));font-weight:600;font-size:17px;overflow-wrap:anywhere;
  animation:qad-drop .4s backwards;animation-delay:calc(var(--i) * 80ms)}
.qad-recap div b{font-family:"Pacifico",cursive;font-weight:400;color:var(--red);font-size:15px;white-space:nowrap}
.qad-rank{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:7px}
.qad-rank li{display:flex;align-items:center;gap:10px;padding:5px 12px 5px 6px;background:#fff;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);
  animation:qad-slide .45s backwards;animation-delay:calc(var(--i) * 90ms)}
.qad-rank li.qad-me{box-shadow:3px 3px 0 var(--red)}
.qad-rank li.qad-1{background:var(--yel)}
.qad-rn{flex:none;width:26px;text-align:center;font-family:"Anton",Impact,sans-serif;font-size:24px}
.qad-rank .qad-av{width:46px;height:46px;flex:none}
.qad-nm{flex:1;min-width:0;font-weight:800;font-size:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qad-nm small{display:block;font-weight:600;font-size:13px;color:var(--mute)}
.qad-gain{flex:none;font-family:"Pacifico",cursive;color:var(--red);font-size:17px;transform:rotate(-6deg)}
.qad-tot{flex:none;min-width:34px;text-align:right;font-family:"Anton",Impact,sans-serif;font-size:26px}
.qad-next{margin:12px 0 0;text-align:center;font-weight:700;color:var(--mute)}
.qad-next b{font-family:"Anton",Impact,sans-serif;font-weight:400;color:var(--ink)}
.qad-pod{display:flex;justify-content:center;align-items:flex-end;gap:8px;margin:10px 0 12px}
.qad-pod figure{margin:0;width:31%;max-width:160px;display:grid;justify-items:center;gap:2px;text-align:center;animation:qad-up .6s backwards;animation-delay:var(--d)}
.qad-pod .qad-ph{display:block;width:100%;aspect-ratio:290/250;overflow:hidden}
.qad-pod .qad-ph svg{width:100%;height:100%;display:block}
.qad-pod figcaption{max-width:100%;font-weight:800;font-size:17px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qad-step{width:100%;display:grid;place-items:center;border:3px solid var(--ink);border-bottom:0;font-family:"Anton",Impact,sans-serif;font-size:24px;background:#fff}
.qad-p1 .qad-step{height:74px;background:var(--yel)}.qad-p2 .qad-step{height:50px;background:#ffd3e6}.qad-p3 .qad-step{height:34px;background:#cfe0ff}
.qad-crown{font-size:26px;line-height:1}
.qad-awards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:4px 0 12px}
.qad-aw{padding:8px 10px;border:3px solid var(--ink);background:#fff;transform:rotate(var(--rot));animation:qad-pop .4s backwards;animation-delay:var(--d)}
.qad-aw small{display:block;font-weight:800;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
.qad-aw b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:22px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qad-aw span{font-weight:600;font-size:15px;color:var(--mute)}
@keyframes qad-pulse{50%{transform:scale(1.12)}}
@keyframes qad-spin{50%{transform:rotate(-6deg) scale(1.06)}}
@keyframes qad-drop{from{opacity:0;transform:translateY(-24px) rotate(8deg)}}
@keyframes qad-pop{from{opacity:0;transform:scale(.5) rotate(-8deg)}}
@keyframes qad-slap{from{opacity:0;transform:scale(1.5) rotate(8deg)}}
@keyframes qad-shh{0%,100%{transform:none}50%{transform:scale(1.15) rotate(-6deg)}}
@keyframes qad-dot{50%{opacity:.15}}
@keyframes qad-polar{from{opacity:0;transform:translateY(40px) rotate(-20deg) scale(.6)}}
@keyframes qad-stampin{from{opacity:0;transform:translate(-50%,-50%) rotate(-14deg) scale(2.4)}}
@keyframes qad-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes qad-up{from{opacity:0;transform:translateY(18px)}}
@keyframes qad-slide{from{opacity:0;transform:translateX(30px)}}
@media (min-width:700px){.qad-page{padding-top:18px}.qad-picks{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}
@media (prefers-reduced-motion:reduce){.qad *,.qad *::before,.qad *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
  .qad-flash{display:none}}
`;

GONFLETTE.registerGame({
  id: "quiadit",
  name: "Qui a dit ça ?",
  min: 3,
  max: 8,
  create(api) {
    const el = api.el, P = api.players, NP = P.length, NR = roundsFor(NP);
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] != null ? seatOf[api.me] : -1;
    const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const spd = () => Math.max(1, Math.min(50, +window.__qadSpeed || 1));
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const cancel = t => { if (t) { clearTimeout(t); timers.delete(t); } };
    const aliveSet = () => new Set(api.connected());

    el.innerHTML = `<style>${CSS}</style><div class="qad" id="qad-root">
      <header class="qad-mast"><div class="qad-logo"><b>POTINS</b><small>&amp; Protéines</small></div>
        <div class="qad-iss" id="qad-iss"></div><div class="qad-clock qad-off" id="qad-clock" aria-label="Temps restant"></div></header>
      <main class="qad-page" id="qad-page"></main></div>`;
    const root = el.querySelector("#qad-root"), page = el.querySelector("#qad-page");
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
    function shutter() {
      if (!AC || AC.state !== "running") return;
      try {
        const n = Math.floor(AC.sampleRate * .12), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
        const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = .25; s.buffer = b; s.connect(g).connect(AC.destination); s.start();
      } catch (e) {}
    }

    /* =================== HÔTE =================== */
    let H = null, lastPub = "", hostT = null, finished = false, inputs = {}, ans = {}, cards = [], recap = [];
    const usedQ = new Set();
    function pub() { const j = JSON.stringify(H); if (j === lastPub) return; lastPub = j; api.setState(H); }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function base(ph, tl, extra) { return Object.assign({ph, r: H.r, q: H.q, tl, S: H.S, C: H.C, F: H.F, K: H.K, g: H.g}, extra || {}); }
    function newRound(r) {
      let pool = QUESTIONS.map((_, i) => i).filter(i => !usedQ.has(i));
      if (!pool.length) { usedQ.clear(); pool = QUESTIONS.map((_, i) => i); }
      const q = pool[Math.floor(Math.random() * pool.length)]; usedQ.add(q);
      const z = () => P.map(() => 0);
      H = {ph: "intro", r, q, tl: T.intro, S: H ? H.S : z(), C: H ? H.C : z(), F: H ? H.F : z(), K: H ? H.K : z(), g: z()};
      ans = {}; cards = []; recap = [];
    }
    function collectAns() {
      const alive = aliveSet();
      for (const p of P) {
        const inp = inputs[p.key];
        if (inp && inp.r === H.r && typeof inp.a === "string" && alive.has(p.key)) ans[p.key] = cleanTxt(inp.a);
      }
    }
    function hostWrite() {
      const alive = aliveSet();
      H.k = P.map(p => !alive.has(p.key) ? "-" : (inputs[p.key] && inputs[p.key].r === H.r && inputs[p.key].ok && ans[p.key]) ? "1" : "0").join("");
      if (H.ph === "write" && !/0/.test(H.k)) H.tl = Math.min(H.tl, 1);     // tout le monde a scellé : on enchaîne
    }
    function startCards() {
      const alive = aliveSet();
      cards = shuffle(P.map((p, s) => ({s, t: ans[p.key] || ""})).filter(c => c.t && alive.has(P[c.s].key)));
      if (!cards.length) { H = base("empty", T.empty); return; }
      startVote(0);
    }
    function startVote(i) {
      const c = cards[i];
      H = base("vote", T.vote, {i, n: cards.length, t: c.t, o: enc(c.s, H.r, i), nv: 0, ne: 0});
      hostVotes();
    }
    function votesNow() {
      const alive = aliveSet(), c = cards[H.i], V = {};
      P.forEach((p, s) => {
        if (s === c.s || !alive.has(p.key)) return;
        const inp = inputs[p.key];
        if (inp && inp.r === H.r && inp.c === H.i && Number.isInteger(inp.v) && inp.v >= 0 && inp.v < NP && inp.v !== s) V[s] = inp.v;
      });
      return V;
    }
    function hostVotes() {
      const alive = aliveSet(), c = cards[H.i];
      H.nv = Object.keys(votesNow()).length;
      H.ne = P.filter((p, s) => s !== c.s && alive.has(p.key)).length;
      if (H.nv >= H.ne) H.tl = Math.min(H.tl, 1);                              // tous les votes sont là
    }
    function endVote() {
      const c = cards[H.i], V = votesNow(), G = P.map(() => 0);
      let right = 0, wrong = 0;
      for (const k in V) { const s = +k; if (V[s] === c.s) { right++; G[s] += 1; H.C[s]++; } else wrong++; }
      G[c.s] += wrong; H.F[c.s] += wrong; H.K[c.s] += right;
      let b = "";
      if (!right && wrong) { b = "imp"; G[c.s] += 1; }
      else if (right && !wrong) b = "open";
      recap.push([cut(c.t, RECAP_LEN), c.s]);
      const S = H.S.map((v, i) => v + G[i]), g = H.g.map((v, i) => v + G[i]);
      H = Object.assign(base("rev", T.rev, {i: H.i, n: H.n, t: c.t, a: c.s, V: P.map((p, s) => V[s] != null ? String(V[s]) : ".").join(""), G, b}), {S, g});
    }
    function rankSeats(S) {
      const alive = aliveSet(), on = i => (alive.has(P[i].key) ? 1 : 0);
      return P.map((p, i) => i).sort((a, b) => (on(b) - on(a)) || (S[b] - S[a]) || a - b);
    }
    function doFinish() {
      if (finished) return; finished = true;
      const rk = rankSeats(H.S), top = H.S[rk[0]], alive = aliveSet();
      const winners = top > 0 ? rk.filter(s => H.S[s] === top && alive.has(P[s].key)).map(s => P[s].key) : [];
      const names = winners.map(k => api.name(k));
      api.finish({
        winners, ranking: rk.map(s => P[s].key),
        summary: winners.length === 1 ? `${names[0]} décroche la une avec ${top} points : la vraie star des potins !`
          : winners.length ? `Ex æquo à la une avec ${top} points : ${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}.`
          : "Personne n'a rien deviné : une équipe de grands mystères !"
      });
    }
    function step() {
      switch (H.ph) {
        case "intro": if (--H.tl <= 0) { H = base("write", T.write, {k: ""}); collectAns(); hostWrite(); } break;
        case "write": collectAns(); if (--H.tl <= 0) { H.ph = "lock"; H.tl = T.lock; } else hostWrite(); break;
        case "lock": collectAns(); if (--H.tl <= 0) startCards(); break;
        case "vote": hostVotes(); if (--H.tl <= 0) endVote(); break;
        case "rev": if (--H.tl <= 0) { if (H.i + 1 < cards.length) startVote(H.i + 1); else H = base("rk", T.rk, {L: recap}); } break;
        case "empty": if (--H.tl <= 0) H = base("rk", T.rk, {L: []}); break;
        case "rk": if (--H.tl <= 0) { if (H.r >= NR) H = base("end", T.end, {o: rankSeats(H.S)}); else newRound(H.r + 1); } break;
        case "end": if (--H.tl <= 0) { H.tl = 0; doFinish(); } break;
      }
    }
    /* Horloge en temps réel : si l'onglet de l'hôte est ralenti, on rattrape les secondes perdues. */
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
      inputs = map || {};
      if (!H) return;
      if (H.ph === "write" || H.ph === "lock") { collectAns(); if (H.ph === "write") hostWrite(); }
      else if (H.ph === "vote") hostVotes();
      pub();
    }
    if (api.isHost) {
      newRound(1); pub();
      api.onInputs(hostInputs);
      lastNow = performance.now();
      hostT = later(tick, 1000 / spd());
    }

    /* =================== AFFICHAGE (tout le monde) =================== */
    let S = null, view = "", myRound = 0, myText = "", myOk = 0, myCard = -1, myVote = -1, sendT = null, lastBeep = -1;
    function push() { cancel(sendT); sendT = null; if (S && mySeat >= 0) api.setInput({r: S.r, a: myText, ok: myOk, c: myCard, v: myVote}); }
    function sendSoon() { if (!sendT) sendT = later(push, 300); }
    const beat = setInterval(() => { if (!dead && S && /write|lock|vote/.test(S.ph)) push(); }, 1500);

    const nm = i => esc(P[i] ? P[i].pseudo : "?");
    const av = (i, cls, opts) => `<span class="qad-av qad-a${(i % 4) + 1}${cls ? " " + cls : ""}">${api.avatar(P[i].key, Object.assign({view: "bust"}, opts || {}))}</span>`;
    const full = (i, pose) => `<span class="qad-ph">${api.avatar(P[i].key, {pose: pose || "flex"})}</span>`;
    const Q = s => QUESTIONS[s.q] || "";
    const k = () => 1 / spd();

    function setMast(s) {
      const iss = $("qad-iss"), labels = {intro: "À la une", write: "Confidences", lock: "Bouclage", vote: "Enquête", rev: "Révélation", rk: "Le Top", empty: "Silence radio", end: "Spécial fin"};
      iss.innerHTML = `<b>N°${s.r}<small>/${NR}</small></b>${labels[s.ph] || ""}`;
      const c = $("qad-clock"), timed = /write|vote/.test(s.ph);
      c.classList.toggle("qad-off", !timed && s.ph !== "lock");
      c.textContent = s.ph === "lock" ? "0" : s.tl;
      const hot = (s.ph === "write" && s.tl <= 10) || (s.ph === "vote" && s.tl <= 5);
      c.classList.toggle("qad-hot", hot);
      if (hot && lastBeep !== s.tl) { lastBeep = s.tl; tone(s.tl <= 3 ? 880 : 660, .07, "square", .04); }
    }

    /* ---- couverture du numéro ---- */
    function buildIntro(s) {
      const alive = aliveSet();
      page.innerHTML = `<section class="qad-cover"><div class="qad-burst"><span>QUI A DIT ÇA ?</span></div>
        <span class="qad-kick qad-r">Exclu · Numéro ${s.r}</span>
        <h1 class="qad-head">${esc(Q(s))}</h1>
        <p class="qad-sub">Les confidences de nos stars du jour :</p>
        <div class="qad-stars">${P.map((p, i) => `<div class="qad-star${alive.has(p.key) ? "" : " qad-gone"}" style="--i:${i}">${av(i, "", {pose: "flex"})}<b>${nm(i)}</b></div>`).join("")}</div>
        <p class="qad-note">${mySeat >= 0 ? "🤫 Réponds en secret sur ton téléphone. Les autres devront deviner que c'est toi… ou pas !" : "Les stars préparent leurs confidences…"}</p></section>`;
      if (!RM) { tone(392, .12, "triangle", .08); later(() => tone(523, .12, "triangle", .08), 120); later(() => tone(784, .25, "triangle", .08), 240); }
    }

    /* ---- écriture ---- */
    function buildWrite(s) {
      const me = mySeat >= 0;
      page.innerHTML = `<div class="qad-q"><span class="qad-kick">La question du numéro</span><h2>${esc(Q(s))}</h2></div>
        ${me ? `<div class="qad-pad" id="qad-pad"></div>` : `<p class="qad-sub">Les joueurs écrivent leurs confidences en secret…</p>`}
        <div class="qad-prog"><h4>À la rédaction</h4><div class="qad-chips" id="qad-chips"></div></div>${me ? `<div class="qad-spacer"></div>` : ""}`;
      if (me) drawPad(s);
    }
    function drawPad(s) {
      const pad = $("qad-pad"); if (!pad) return;
      const locked = s.ph === "lock";
      if (myOk || locked) {
        pad.dataset.m = "ok";
        pad.innerHTML = `<div class="qad-env"><span class="qad-ico">${myText ? "✉️" : "🙊"}</span><p><b>${myText ? "Confidence scellée" : locked ? "Rien balancé…" : "Rien à déclarer ?"}</b>
          ${myText ? `<q>${esc(myText)}</q>` : ""}</p></div>
          ${locked ? `<p class="qad-sub" style="margin:8px 0 0">Bouclage du numéro, on imprime !</p>` : `<div class="qad-row"><span class="qad-cnt">Tu peux encore la modifier.</span><button class="qad-btn qad-ghost" id="qad-edit" type="button">Modifier</button></div>`}`;
        const ed = $("qad-edit");
        if (ed) ed.addEventListener("click", () => { myOk = 0; push(); drawPad(S); const ta = $("qad-txt"); if (ta) ta.focus(); });
        return;
      }
      pad.dataset.m = "edit";
      pad.innerHTML = `<label for="qad-txt">Ta confidence (anonyme)</label>
        <textarea class="qad-ta" id="qad-txt" maxlength="${MAXLEN}" rows="3" autocomplete="off" spellcheck="true" enterkeyhint="send" placeholder="Écris ta réponse ici…"></textarea>
        <div class="qad-row"><span class="qad-cnt" id="qad-cnt"></span><button class="qad-btn" id="qad-send" type="button">Balancer 🤫</button></div>`;
      const ta = $("qad-txt"), cnt = $("qad-cnt"), btn = $("qad-send");
      ta.value = myText;
      const upd = () => { const n = Array.from(ta.value).length; cnt.textContent = `${n}/${MAXLEN}`; btn.disabled = !cleanTxt(ta.value); };
      upd();
      ta.addEventListener("input", () => { myText = Array.from(ta.value.replace(/[\r\n]+/g, " ")).slice(0, MAXLEN).join(""); upd(); sendSoon(); });
      const send = () => {
        if (!S || S.ph !== "write") return;
        myText = cleanTxt(ta.value); if (!myText) return;
        myOk = 1; push(); tone(523, .08, "triangle", .08); later(() => tone(784, .14, "triangle", .08), 90);
        ta.blur(); drawPad(S); renderChips(S);
      };
      ta.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
      btn.addEventListener("click", send);
    }
    function renderChips(s) {
      const box = $("qad-chips"); if (!box) return;
      const k2 = s.k || "";
      box.innerHTML = P.map((p, i) => {
        const f = i === mySeat && myOk && myText ? "1" : k2[i] || "0";
        return `<span class="qad-chip${f === "1" ? " qad-done" : ""}${f === "-" ? " qad-gone" : ""}">${av(i)}<span>${nm(i)}${i === mySeat ? " (toi)" : ""}</span><i>${f === "1" ? "✉️" : f === "-" ? "👋" : "✍️"}</i></span>`;
      }).join("");
    }
    function updWrite(s) {
      const pad = $("qad-pad");
      if (pad && ((s.ph === "lock") !== (pad.dataset.lk === "1"))) { pad.dataset.lk = s.ph === "lock" ? "1" : "0"; if (s.ph === "lock") { const ta = $("qad-txt"); if (ta) { myText = cleanTxt(ta.value); ta.blur(); } push(); drawPad(s); } }
      renderChips(s);
    }

    /* ---- enquête (vote) ---- */
    function clipHTML(s, cls) {
      const long = Array.from(s.t).length > 46;
      return `<div class="qad-clip ${cls || ""}"><span class="qad-tape"></span><p class="qad-quote${long ? " qad-long" : ""}">${esc(s.t)}</p></div>`;
    }
    function buildVote(s) {
      const author = dec(s.o, s.r, s.i), mine = mySeat >= 0 && author === mySeat, alive = aliveSet();
      let body = "";
      if (mine) body = `<div class="qad-poker"><b>C'est toi !</b><span>😐</span>Fais ta tête de poker<small>Ne te trahis pas… les autres enquêtent.</small></div>`;
      else if (mySeat >= 0) body = `<p class="qad-ask">Qui a dit ça ?<small>Touche le suspect (tu peux changer d'avis)</small></p>
        <div class="qad-picks">${P.map((p, i) => i === mySeat ? "" : `<button type="button" class="qad-pick${alive.has(p.key) ? "" : " qad-gone"}" data-s="${i}"${alive.has(p.key) ? "" : " disabled"} aria-pressed="false">${av(i)}<b>${nm(i)}</b></button>`).join("")}</div>`;
      else body = `<p class="qad-ask">Qui a dit ça ?<small>Les joueurs mènent l'enquête…</small></p>`;
      page.innerHTML = `<div class="qad-meta"><span class="qad-kick qad-r">Confidence ${s.i + 1}/${s.n}</span><small>${esc(Q(s))}</small></div>
        ${clipHTML(s, RM ? "" : "qad-in")}${body}<p class="qad-tally" id="qad-tally"></p>`;
      page.querySelectorAll(".qad-pick").forEach(b => b.addEventListener("click", () => {
        if (!S || S.ph !== "vote") return;
        myVote = +b.dataset.s; push(); tone(300 + myVote * 40, .08, "triangle", .08); updVote(S);
      }));
      tone(180, .12, "sawtooth", .05, 90);
    }
    function updVote(s) {
      page.querySelectorAll(".qad-pick").forEach(b => { const on = +b.dataset.s === myVote; b.classList.toggle("qad-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
      const t = $("qad-tally"); if (t) t.innerHTML = `<b>${s.nv}</b> / ${s.ne} ${s.ne > 1 ? "enquêteurs ont" : "enquêteur a"} voté`;
    }

    /* ---- révélation ---- */
    function buildRev(s) {
      const a = s.a, V = s.V || "", voters = [], alive = aliveSet();
      for (let i = 0; i < NP; i++) if (V[i] && V[i] !== ".") voters.push([i, +V[i]]);
      const right = voters.filter(v => v[1] === a), wrong = voters.filter(v => v[1] !== a);
      const stamp = s.b === "imp" ? `<span class="qad-stamp qad-imp">INTROUVABLE</span>` : right.length ? `<span class="qad-stamp">DÉMASQUÉ !</span>` : "";
      const badge = s.b === "imp" ? `<span class="qad-badge">Imprévisible !<small>Personne ne l'a vu venir : +1 bonus</small></span>`
        : s.b === "open" ? `<span class="qad-badge qad-open">Livre ouvert<small>Tout le monde l'a reconnu·e</small></span>`
        : right.length === 1 && voters.length >= 3 ? `<span class="qad-badge" style="background:var(--red)">Flair de fouine<small>${nm(right[0][0])} a trouvé seul·e contre tous</small></span>` : "";
      let mine = "";
      if (mySeat === a) mine = wrong.length ? `Tu as berné <b>${plural(wrong.length, "personne")}</b> ! +${s.G[a]}` : right.length ? "Grillé·e ! Tout le monde t'a reconnu·e." : "Personne n'a voté pour cette fois…";
      else if (mySeat >= 0) { const mv = V[mySeat]; mine = mv === "." || mv == null ? "Tu n'as pas voté… zéro pointé !" : +mv === a ? "Bien vu, détective ! <b>+1</b>" : `Raté ! Ce n'était pas ${nm(+mv)}…`; }
      const rows = voters.map(([i, v]) => `<li class="${v === a ? "qad-ok" : "qad-ko"}">${av(i)}<span>${nm(i)} <small>a accusé ${v === a ? "<b>" + nm(v) + "</b> ✅" : nm(v) + " ❌"}</small></span><em class="qad-pts${s.G[i] ? "" : " qad-z"}">${s.G[i] ? "+" + s.G[i] : "0"}</em></li>`).join("");
      page.innerHTML = `<div class="qad-rev" id="qad-rev"><div class="qad-flash"></div>
        <div class="qad-meta"><span class="qad-kick qad-r">Confidence ${s.i + 1}/${s.n}</span><small>${esc(Q(s))}</small></div>
        <div class="qad-mini">“${esc(s.t)}”</div>
        <p class="qad-drum">Et c'était<i>.</i><i>.</i><i>.</i></p>
        <figure class="qad-polar">${full(a, s.b === "open" ? "idle" : "flex")}<figcaption>${nm(a)}${alive.has(P[a].key) ? "" : " 👋"}</figcaption>${stamp}</figure>
        <div class="qad-after">${badge}${mine ? `<p class="qad-mine">${mine}</p>` : ""}
          <ul class="qad-votes"><li class="qad-auth">${av(a)}<span>${nm(a)} <small>l'auteur·e · ${plural(wrong.length, "victime")}</small></span><em class="qad-pts${s.G[a] ? "" : " qad-z"}">${s.G[a] ? "+" + s.G[a] : "0"}</em></li>${rows}</ul></div></div>`;
      const rev = $("qad-rev");
      const show = () => { rev.classList.add("qad-shown"); shutter(); later(() => (right.length ? tone(196, .3, "sawtooth", .06, 98) : (tone(659, .1, "triangle", .08), later(() => tone(988, .2, "triangle", .08), 110))), 450); };
      if (RM || s.tl < T.rev - 1) { rev.classList.add("qad-shown"); return; }
      for (let i = 0; i < 6; i++) later(() => tone(110 + i * 6, .06, "triangle", .1), i * 180 * k());
      later(show, 1300 * k());
    }

    /* ---- top du numéro ---- */
    function rankList(s, order, gains) {
      const alive = aliveSet();
      return `<ol class="qad-rank">${order.map((si, n) => {
        const rank = order.findIndex(o => s.S[o] === s.S[si]) + 1, gone = !alive.has(P[si].key);
        return `<li class="${si === mySeat ? "qad-me " : ""}${rank === 1 ? "qad-1 " : ""}${gone ? "qad-gone" : ""}" style="--i:${n}"><span class="qad-rn">${rank}</span>${av(si)}
          <b class="qad-nm">${nm(si)}${si === mySeat ? " (toi)" : ""}<small>${gone ? "a quitté la partie" : `${plural(s.C[si], "bonne piste")} · ${plural(s.F[si], "victime")}`}</small></b>
          ${gains ? `<span class="qad-gain">+${s.g[si]}</span>` : ""}<span class="qad-tot">${s.S[si]}</span></li>`;
      }).join("")}</ol>`;
    }
    const order = s => P.map((p, i) => i).sort((a, b) => (s.S[b] - s.S[a]) || a - b);
    function buildRk(s) {
      const L = s.L || [];
      page.innerHTML = `<div class="qad-rk"><span class="qad-kick">Numéro ${s.r}/${NR} · récap</span>
        ${L.length ? `<h2>Les confidences</h2><div class="qad-recap">${L.map((c, i) => `<div style="--i:${i};--rot:${(i % 2 ? .8 : -.9)}deg">“${esc(c[0])}” <b>— ${nm(c[1])}</b></div>`).join("")}</div>` : ""}
        <h2>Le top des stars</h2>${rankList(s, order(s), true)}<p class="qad-next" id="qad-next"></p></div>`;
    }
    function buildEmpty() {
      page.innerHTML = `<section class="qad-cover" style="text-align:center;padding-top:30px"><span class="qad-kick qad-r">Silence radio</span>
        <h1 class="qad-head">Personne n'a rien balancé&nbsp;!</h1><p class="qad-sub">Le numéro sort avec des pages blanches. On passe à la suite…</p><div style="font-size:64px">🙊</div></section>`;
    }
    function bestOf(arr) { let b = -1; arr.forEach((v, i) => { if (v > 0 && (b < 0 || v > arr[b])) b = i; }); return b; }
    function buildEnd(s) {
      const o = s.o || order(s), pod = o.slice(0, 3), slot = [1, 0, 2].filter(i => pod[i] != null);
      const aw = [];
      const d = bestOf(s.C); if (d >= 0) aw.push(["Détective en chef", d, plural(s.C[d], "bonne piste")]);
      const m = bestOf(s.F); if (m >= 0) aw.push(["Grand mystère", m, plural(s.F[m], "victime")]);
      const b = bestOf(s.K); if (b >= 0) aw.push(["Livre ouvert", b, `reconnu·e ${s.K[b]} fois`]);
      page.innerHTML = `<div class="qad-rk"><span class="qad-kick qad-r">Spécial fin de saison</span><h1 class="qad-head" style="margin-bottom:0">Les stars de l'année</h1>
        <div class="qad-pod">${slot.map((i, n) => { const si = pod[i]; return `<figure class="qad-p${i + 1}" style="--d:${(n * .15).toFixed(2)}s">${i === 0 ? `<span class="qad-crown">👑</span>` : ""}${full(si, i === 0 ? "flex" : "idle")}
          <figcaption>${nm(si)}</figcaption><div class="qad-step">${s.S[si]}</div></figure>`; }).join("")}</div>
        ${aw.length ? `<div class="qad-awards">${aw.map(([t, si, sub], n) => `<div class="qad-aw" style="--rot:${n % 2 ? 1.2 : -1.2}deg;--d:${(.4 + n * .15).toFixed(2)}s"><small>${t}</small><b>${nm(si)}</b><span>${sub}</span></div>`).join("")}</div>` : ""}
        ${rankList(s, o, false)}</div>`;
      tone(523, .15, "triangle", .1); later(() => tone(659, .15, "triangle", .1), 150); later(() => tone(784, .3, "triangle", .1), 300);
    }

    function render(s) {
      if (dead || !s) return;
      const prev = S; S = s;
      if (s.r !== myRound) { myRound = s.r; myText = ""; myOk = 0; myCard = -1; myVote = -1; }
      if ((s.ph === "vote" || s.ph === "rev") && s.i !== myCard) { myCard = s.i; myVote = -1; if (s.ph === "vote") push(); }
      root.dataset.ph = s.ph; root.dataset.r = s.r; root.dataset.i = s.i != null ? s.i : "";
      const ph = s.ph === "lock" ? "write" : s.ph, vk = ph + ":" + s.r + ":" + (s.i != null ? s.i : "");
      setMast(s);
      if (vk !== view) {
        if (prev && (prev.ph === "write" || prev.ph === "lock")) push();
        view = vk; el.scrollTop = 0;
        ({intro: buildIntro, write: buildWrite, vote: buildVote, rev: buildRev, rk: buildRk, empty: buildEmpty, end: buildEnd})[ph](s);
      }
      if (ph === "write") updWrite(s);
      else if (ph === "vote") updVote(s);
      else if (ph === "rk") { const n = $("qad-next"); if (n) n.innerHTML = s.r >= NR ? `Grand final dans <b>${s.tl}</b> s` : `Numéro ${s.r + 1} dans <b>${s.tl}</b> s`; }
    }
    api.onState(render);

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
