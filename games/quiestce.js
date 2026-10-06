/* Gonflette Party : Qui est-ce ? (2 joueurs, chacun sur son téléphone).
   Adapté de qui-est-ce/index.html (mode « à deux » avec questions orales).
   - Les 24 suspects sont tirés avec api.rng() : même distribution sur tous les téléphones.
   - Chaque téléphone n'affiche que le plateau de son propriétaire (joueur 1 rouge, joueur 2 bleu)
     et son propre suspect secret (caché, maintenir pour le voir).
   - Les suspects baissés restent locaux ; seul le nombre de suspects debout part dans l'entrée.
   Entrées : {seq, a:"pick"|"end"|"accuse", id, sec, up}. `sec` (mon suspect) et `up` (suspects debout)
   sont recopiés dans chaque entrée pour survivre au remplacement des entrées. */
GONFLETTE.registerGame({
  id: "quiestce",
  name: "Qui est-ce ?",
  min: 2,
  max: 2,
  create(api) {
    const el = api.el;
    const [P1, P2] = api.players;
    const PL = [P1, P2];
    const mySide = api.me === P1.key ? 0 : api.me === P2.key ? 1 : -1;
    const isPl = mySide >= 0;
    const R = api.rng;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const esc = t => String(t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const nm = i => esc(PL[i].pseudo || api.name(PL[i].key));
    const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

    /* ---------- Les 24 suspects (générés avec api.rng) ---------- */
    const SKIN = ["#f6d2b8", "#eebe98", "#d9a27a", "#b97b54", "#8d5a3b", "#f2c9a5"];
    const HAIR = {blond: "#e3bb4f", brun: "#6b4226", roux: "#c8562b", noir: "#25201f", blanc: "#dcd8d0"};
    const EYES = {bleu: "#3d7fd6", vert: "#3d9a5b", marron: "#6b3e1f"};
    const NAMES_F = ["Alice", "Chloé", "Fatou", "Hélène", "Jeanne", "Léa", "Nina", "Paula", "Rose", "Thérèse", "Wanda", "Agathe", "Inès", "Camille", "Zoé", "Margot",
      "Yasmine", "Lucie", "Odile", "Sofia", "Mireille", "Aïcha", "Clara", "Emma", "Josiane", "Nadia", "Louise", "Maëlle", "Gisèle", "Salomé", "Berthe", "Ginette"];
    const NAMES_H = ["Bernard", "David", "Émile", "Gérard", "Igor", "Karim", "Marcel", "Oscar", "Quentin", "Samuel", "Ulysse", "Victor", "Yann", "Hugo", "Léon", "Omar",
      "Raphaël", "Théo", "Gaspard", "Jules", "Malik", "Bruno", "Félix", "Lucien", "Nestor", "Paco", "René", "Sacha", "Tom", "Xavier", "Firmin", "Kofi"];
    const SHIRTS = ["#4f86c6", "#7d6b5d", "#3f8f6b", "#c0533a", "#e0a43a", "#d9468a", "#556b2f", "#8a5bb8", "#2f6f8f", "#b8433a", "#3a5a8c", "#e07a5f",
      "#333a44", "#2a9d8f", "#9c6644", "#6a4c93", "#4d908e", "#f28482", "#577590", "#c9a227", "#43aa8b", "#90be6d", "#f3722c", "#277da1"];
    const Q = [
      {g: "Allure", chip: "Femme / homme", t: p => p.sex === "F"},
      {g: "Allure", chip: "Sourit", t: p => p.smile},
      {g: "Cheveux", chip: "Blonds", t: p => p.hair === "blond"},
      {g: "Cheveux", chip: "Bruns", t: p => p.hair === "brun"},
      {g: "Cheveux", chip: "Roux", t: p => p.hair === "roux"},
      {g: "Cheveux", chip: "Noirs", t: p => p.hair === "noir"},
      {g: "Cheveux", chip: "Blancs", t: p => p.hair === "blanc"},
      {g: "Cheveux", chip: "Chauve", t: p => p.style === "chauve"},
      {g: "Cheveux", chip: "Longs", t: p => p.style === "long"},
      {g: "Cheveux", chip: "Bouclés", t: p => p.style === "boucle"},
      {g: "Visage", chip: "Yeux bleus", t: p => p.eyes === "bleu"},
      {g: "Visage", chip: "Yeux verts", t: p => p.eyes === "vert"},
      {g: "Visage", chip: "Yeux marron", t: p => p.eyes === "marron"},
      {g: "Visage", chip: "Barbe", t: p => p.beard},
      {g: "Visage", chip: "Moustache", t: p => p.mus},
      {g: "Visage", chip: "Gros nez", t: p => p.nose},
      {g: "Visage", chip: "Joues roses", t: p => p.cheeks},
      {g: "Accessoires", chip: "Lunettes", t: p => p.glasses},
      {g: "Accessoires", chip: "Chapeau", t: p => !!p.hat},
      {g: "Accessoires", chip: "Boucles d'oreilles", t: p => p.earrings}
    ];
    const rnd = a => a[Math.floor(R() * a.length)];
    const shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // Tri sans dépendre de la locale du navigateur (même ordre sur tous les téléphones).
    const sortKey = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    function genPeople() {
      const out = [], sigs = new Set(), nf = shuffled(NAMES_F), nh = shuffled(NAMES_H), shirts = shuffled(SHIRTS);
      const sexes = shuffled([...Array(12).fill("F"), ...Array(12).fill("H")]);
      // 4 à 5 suspects par couleur de cheveux, 8 par couleur d'yeux
      const hairs = shuffled([...Object.keys(HAIR), ...Object.keys(HAIR), ...Object.keys(HAIR), ...Object.keys(HAIR), "blond", "brun", "roux", "noir"]);
      const eyes = shuffled([...Array(8).fill("bleu"), ...Array(8).fill("vert"), ...Array(8).fill("marron")]);
      let guard = 0;
      while (out.length < 24 && guard++ < 20000) {
        const sex = sexes[out.length];
        const style = sex === "H" ? (R() < .14 ? "chauve" : rnd(["court", "court", "court", "boucle", "boucle", "long"])) : rnd(["court", "long", "long", "boucle", "boucle"]);
        const p = {sex, hair: hairs[out.length], style, eyes: eyes[out.length], skin: rnd(SKIN)};
        p.glasses = R() < .3;
        p.hat = style !== "chauve" && R() < .25 ? rnd(["casquette", "bonnet", "beret", "haut"]) : null;
        p.beard = sex === "H" && R() < .3;
        p.mus = sex === "H" && R() < .3;
        p.earrings = R() < (sex === "F" ? .45 : .08);
        p.nose = R() < .25; p.cheeks = R() < .3; p.smile = R() < .5;
        const sig = Q.map(q => q.t(p) ? 1 : 0).join("");
        if (sigs.has(sig)) continue;
        sigs.add(sig);
        p.name = sex === "F" ? nf.pop() : nh.pop();
        p.shirt = shirts[out.length];
        out.push(p);
      }
      out.sort((a, b) => { const x = sortKey(a.name), y = sortKey(b.name); return x < y ? -1 : x > y ? 1 : 0; });
      out.forEach((p, i) => p.id = i);
      return out;
    }
    const PEOPLE = genPeople();
    const N = PEOPLE.length;

    /* ---------- Portraits SVG (repris de l'original) ---------- */
    function shade(hex, f) {
      const n = parseInt(hex.slice(1), 16);
      const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
      return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
    }
    function portrait(p) {
      const hair = HAIR[p.hair], sk = p.skin, sk2 = shade(sk, .85), brow = p.hair === "blanc" ? "#bdb8ae" : shade(hair, .8);
      let s = `<svg viewBox="0 0 100 108" aria-hidden="true">`;
      s += `<path d="M12 108C14 88 30 81 50 81S86 88 88 108Z" fill="${p.shirt}"/><path d="M41 82L50 93L59 82" fill="none" stroke="${shade(p.shirt, .7)}" stroke-width="3"/>`;
      s += `<rect x="43" y="68" width="14" height="16" rx="4" fill="${sk2}"/>`;
      if (p.style === "long") s += `<path d="M25 42C22 66 20 86 30 92H70C80 86 78 66 75 42Z" fill="${hair}"/>`;
      if (p.style === "boucle" && p.sex === "F") for (const [x, y] of [[26, 62], [74, 62], [25, 72], [75, 72], [29, 80], [71, 80]]) s += `<circle cx="${x}" cy="${y}" r="7" fill="${hair}"/>`;
      s += `<circle cx="28" cy="54" r="5" fill="${sk2}"/><circle cx="72" cy="54" r="5" fill="${sk2}"/>`;
      s += `<ellipse cx="50" cy="50" rx="22" ry="26" fill="${sk}"/>`;
      if (p.earrings) s += `<circle cx="27" cy="62" r="2.8" fill="#f5c542" stroke="#9a7417" stroke-width=".8"/><circle cx="73" cy="62" r="2.8" fill="#f5c542" stroke="#9a7417" stroke-width=".8"/>`;
      if (p.style === "court") s += `<path d="M27 47C25 28 38 21 50 21S75 28 73 47C69 36 61 31 50 32C39 31 31 36 27 47Z" fill="${hair}"/>`;
      else if (p.style === "long") s += `<path d="M27 52C23 26 40 19 50 19S77 26 73 52C70 38 64 31 55 31C47 37 38 37 30 41Z" fill="${hair}"/>`;
      else if (p.style === "boucle") {
        for (let a = 190; a <= 350; a += 20) { const r = a * Math.PI / 180; s += `<circle cx="${(50 + 24 * Math.cos(r)).toFixed(1)}" cy="${(46 + 24 * Math.sin(r)).toFixed(1)}" r="7.5" fill="${hair}"/>`; }
        s += `<circle cx="42" cy="26" r="7" fill="${hair}"/><circle cx="58" cy="26" r="7" fill="${hair}"/><circle cx="50" cy="24" r="7" fill="${hair}"/>`;
      } else {
        s += `<path d="M27 56C25 46 28 41 33 39L34 52Z" fill="${hair}"/><path d="M73 56C75 46 72 41 67 39L66 52Z" fill="${hair}"/>`;
        s += `<ellipse cx="44" cy="30" rx="8" ry="4" fill="#fff" opacity=".28" transform="rotate(-20 44 30)"/>`;
      }
      s += `<path d="M36 43Q41 40 46 43M54 43Q59 40 64 43" stroke="${brow}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      for (const x of [41, 59]) s += `<ellipse cx="${x}" cy="50" rx="4.3" ry="3.7" fill="#fff"/><circle cx="${x}" cy="50.3" r="2.5" fill="${EYES[p.eyes]}"/><circle cx="${x}" cy="50.3" r="1.1" fill="#111"/><circle cx="${x + .9}" cy="49.3" r=".6" fill="#fff"/>`;
      if (p.cheeks) s += `<circle cx="36" cy="61" r="4.6" fill="#ff6f7d" opacity=".45"/><circle cx="64" cy="61" r="4.6" fill="#ff6f7d" opacity=".45"/>`;
      s += p.nose ? `<ellipse cx="50" cy="59" rx="5.8" ry="5.2" fill="${sk2}"/><ellipse cx="48.5" cy="57.5" rx="1.6" ry="1.2" fill="#fff" opacity=".35"/>`
                  : `<path d="M50 52C48 57 47 59 50.5 60" stroke="${sk2}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      if (p.beard) s += `<path d="M28 54C28 72 38 80 50 80S72 72 72 54C70 64 64 70 58 70C55 73 45 73 42 70C36 70 30 64 28 54Z" fill="${hair}"/>`;
      s += p.smile ? `<path d="M43 67Q50 74 57 67" stroke="#7a2b2b" stroke-width="2.2" fill="${p.beard ? "#7a2b2b" : "none"}" stroke-linecap="round"/>`
                   : `<path d="M44.5 69H55.5" stroke="#7a2b2b" stroke-width="2.2" stroke-linecap="round"/>`;
      if (p.mus) s += `<path d="M40 66C44 61.5 48.5 63 50 64.5C51.5 63 56 61.5 60 66C56 67.5 52.5 67 50 66C47.5 67 44 67.5 40 66Z" fill="${hair === HAIR.blanc ? "#c9c4ba" : hair}"/>`;
      if (p.glasses) s += `<g fill="#fff" fill-opacity=".15" stroke="#1d1d1d" stroke-width="1.9"><circle cx="41" cy="50" r="6.6"/><circle cx="59" cy="50" r="6.6"/></g><path d="M47.6 49.5Q50 47.8 52.4 49.5M34.4 49L28 47.5M65.6 49L72 47.5" stroke="#1d1d1d" stroke-width="1.9" fill="none"/>`;
      if (p.hat === "casquette") s += `<path d="M27 40C27 24 38 17 50 17S73 24 73 40Z" fill="#c0392b"/><path d="M25 40C42 35 62 35 84 41C72 47 40 45 25 40Z" fill="#922b21"/><circle cx="50" cy="18" r="2" fill="#922b21"/>`;
      if (p.hat === "bonnet") s += `<path d="M26 41C26 19 38 13 50 13S74 19 74 41Z" fill="#2e86ab"/><rect x="24" y="35" width="52" height="9" rx="4" fill="#1f5f7a"/><circle cx="50" cy="12" r="5.5" fill="#f4f1de"/>`;
      if (p.hat === "beret") s += `<ellipse cx="47" cy="27" rx="26" ry="9" fill="#1d1d1d" transform="rotate(-8 47 27)"/><rect x="48" y="15" width="3" height="5" rx="1.5" fill="#1d1d1d"/>`;
      if (p.hat === "haut") s += `<rect x="34" y="1" width="32" height="28" rx="2" fill="#1b1b1b"/><rect x="34" y="21" width="32" height="5" fill="#a4161a"/><ellipse cx="50" cy="29" rx="28" ry="5" fill="#111"/>`;
      return s + `</svg>`;
    }

    /* ---------- Interface ---------- */
    const DECK = ["rouge", "bleu"];
    const tapeTxt = "QUI EST-CE ? · ENQUÊTE EN COURS · NE PAS FRANCHIR · ".repeat(6);
    const memo = (() => {
      const groups = {};
      Q.forEach(q => (groups[q.g] = groups[q.g] || []).push(q.chip));
      return Object.entries(groups).map(([g, cs]) => `<div class="qec-mg"><h4>${g}</h4><div class="qec-chips">${cs.map(c => `<span class="qec-chip">${c}</span>`).join("")}</div></div>`).join("");
    })();
    const miniBars = () => `<div class="qec-bars">${"<i></i>".repeat(N)}</div>`;

    el.innerHTML = `<style>
.qec{--wall:#2c3640;--wall2:#242d36;--chalk:#ece6d8;--tape:#f3c33c;--red:#d6372e;--paper:#efe5cf;--ink:#2a2622;--dim:#a9b3bd;--line:rgba(236,230,216,.18);
  --fh:"Anton","Impact","Arial Narrow",sans-serif;--ft:"Courier New",Courier,ui-monospace,"Liberation Mono",monospace;--fb:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
  min-height:100%;color:var(--chalk);font-family:var(--fb);font-size:16px;line-height:1.3;background:radial-gradient(120% 60% at 50% 0%,#36424e,var(--wall2) 70%) var(--wall2);padding-bottom:28px;overflow-x:clip}
.qec *{box-sizing:border-box}
.qec [hidden]{display:none!important}
.qec-tape{position:relative;overflow:hidden;height:26px;background:repeating-linear-gradient(-45deg,var(--tape) 0 20px,#1b1b1b 20px 32px);transform:rotate(-1deg);margin:6px -12px 0;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.qec-tape span{position:absolute;inset:4px 0;display:flex;align-items:center;white-space:nowrap;background:var(--tape);color:#1b1b1b;font-family:var(--fh);font-size:.82rem;letter-spacing:.12em;padding-left:12px;animation:qec-scroll 50s linear infinite}
.qec-top{position:sticky;top:0;z-index:4;background:linear-gradient(180deg,#2a333d 88%,rgba(42,51,61,0));padding-bottom:4px}
.qec-bar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px 8px}
.qec-pol{appearance:none;border:0;margin:0;background:#fff;padding:4px 4px 13px;box-shadow:0 4px 10px rgba(0,0,0,.35);transform:rotate(-3deg);position:relative;width:62px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none}
.qec-pol::after{content:"";position:absolute;top:-6px;left:28%;width:44%;height:11px;background:rgba(243,195,60,.8);transform:rotate(4deg)}
.qec-pic{aspect-ratio:3/3.6;background:repeating-linear-gradient(to bottom,transparent 0 7px,rgba(0,0,0,.12) 7px 8px),#c9c3b4;display:grid;place-items:center;overflow:hidden}
.qec-pic svg{width:100%;height:100%;display:block}
.qec-pol .qec-cap{position:absolute;left:0;right:0;bottom:1px;text-align:center;font-family:var(--ft);font-size:.56rem;color:#4b4238;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
.qec-pol.masked .qec-pic{background:repeating-linear-gradient(45deg,#7d2a22 0 7px,#93342b 7px 14px)}
.qec-pol.masked .qec-pic svg{visibility:hidden}
.qec-pol .qec-q{display:none;font-family:var(--fh);font-size:1.6rem;color:#f3d9c9;grid-area:1/1}
.qec-pol.masked .qec-q{display:block}
.qec-pol.masked .qec-pic svg{grid-area:1/1}
.qec-pol:focus-visible{outline:3px solid var(--tape);outline-offset:3px}
.qec-st{min-width:0}
.qec-turn{display:flex;align-items:center;gap:7px;font-family:var(--fh);font-size:1.15rem;letter-spacing:.04em;text-transform:uppercase;line-height:1.1}
.qec-turn .dot{flex:none;width:11px;height:11px;border-radius:50%;background:var(--red);box-shadow:0 0 0 3px rgba(214,55,46,.25)}
.qec-turn.mine .dot{background:#3fbf6a;box-shadow:0 0 0 3px rgba(63,191,106,.3);animation:qec-pulse 1.2s ease-in-out infinite alternate}
.qec-sub{margin:3px 0 0;font-family:var(--ft);font-size:.78rem;color:var(--dim);line-height:1.3}
.qec-opp{display:grid;justify-items:center;gap:1px;text-align:center;width:82px;padding:4px 2px 5px;border-radius:10px;border:2px solid rgba(255,255,255,.12);background:rgba(0,0,0,.2);transition:border-color .3s,box-shadow .3s}
.qec-opp.on{border-color:var(--tape);box-shadow:0 0 14px rgba(243,195,60,.35)}
.qec-opp .qec-avw{width:66px;height:60px;margin:-6px 0 -4px;display:grid;place-items:center}
.qec-avw .av{width:100%;height:100%}
.qec-opp b{font-family:var(--fh);font-weight:400;font-size:.82rem;letter-spacing:.04em;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
.qec-opp small{font-family:var(--ft);font-size:.66rem;color:var(--dim);line-height:1.15}
.qec-opp small em{font-style:normal;font-family:var(--fh);font-size:1.05rem;color:var(--tape);display:block;letter-spacing:.02em}
.qec-acts{display:flex;gap:8px;padding:0 12px 8px}
.qec-btn{flex:1;font-family:var(--fh);font-weight:400;letter-spacing:.08em;text-transform:uppercase;font-size:1rem;border:0;border-radius:9px;padding:9px 8px;cursor:pointer;transition:transform .1s,filter .15s;line-height:1.1;color:#fff}
.qec-btn:active:not(:disabled){transform:translateY(2px)}
.qec-btn.red{background:var(--red);box-shadow:0 4px 0 #8a2019}
.qec-btn.dark{background:#151a1f;color:var(--paper);box-shadow:0 4px 0 #000;border:2px solid #56636f}
.qec-btn.light{background:transparent;color:var(--ink);border:2px solid var(--ink)}
.qec-btn.gold{background:var(--tape);color:#1b1b1b;box-shadow:0 4px 0 #8c6d12}
.qec-btn:disabled{opacity:.4;cursor:not-allowed}
.qec-btn:focus-visible{outline:3px solid var(--tape);outline-offset:2px}
.qec-folder{position:relative;margin:34px 12px 14px;background:var(--paper);color:var(--ink);border-radius:4px 12px 12px 12px;padding:12px 13px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.qec-folder::before{content:attr(data-tab);position:absolute;top:-21px;left:0;height:22px;padding:3px 12px;background:var(--paper);border-radius:8px 8px 0 0;font-family:var(--fh);font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:#6b5d48}
.qec-oral{margin:0;padding:0 0 0 1.2em;font-family:var(--ft);font-size:.86rem;line-height:1.45;display:grid;gap:4px}
.qec-oral b{font-family:var(--fh);font-weight:400;letter-spacing:.04em}
.qec-memo{margin-top:8px;border-top:1.5px dashed #c9bb9c;padding-top:6px}
.qec-memo summary{cursor:pointer;font-family:var(--fh);font-size:.82rem;letter-spacing:.1em;text-transform:uppercase;color:#6b5d48;list-style-position:inside}
.qec-mg{margin-top:6px}
.qec-mg h4{margin:0 0 3px;font-family:var(--ft);font-weight:400;font-size:.7rem;color:#6b5d48;text-transform:uppercase;letter-spacing:.08em}
.qec-chips{display:flex;flex-wrap:wrap;gap:4px}
.qec-chip{font-weight:600;font-size:.8rem;color:var(--ink);background:#fffaf0;border:1.5px solid #c9bb9c;border-radius:999px;padding:2px 9px}
.qec-wall{position:relative;margin:14px 12px 0;border-radius:14px;padding:16px 8px 10px;background:var(--wall);border:3px solid #56636f;box-shadow:inset 0 0 50px rgba(0,0,0,.35)}
.qec-wall::before{content:"";position:absolute;inset:0;border-radius:11px;pointer-events:none;background:repeating-linear-gradient(to bottom,transparent 0 47px,rgba(236,230,216,.10) 47px 48px)}
.qec-wall[data-deck="0"]{border-color:#c0392b;box-shadow:inset 0 0 50px rgba(0,0,0,.35),0 0 0 4px rgba(192,57,43,.25);background:linear-gradient(180deg,#3d2f33,#2f2a31)}
.qec-wall[data-deck="1"]{border-color:#2e6fd1;box-shadow:inset 0 0 50px rgba(0,0,0,.35),0 0 0 4px rgba(46,111,209,.25);background:linear-gradient(180deg,#2c3a52,#26303f)}
.qec-tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);font-family:var(--fh);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;padding:3px 12px;border-radius:999px;color:#fff;white-space:nowrap;z-index:2;max-width:92%;overflow:hidden;text-overflow:ellipsis;background:#56636f}
.qec-wall[data-deck="0"] .qec-tag{background:#c0392b}
.qec-wall[data-deck="1"] .qec-tag{background:#2e6fd1}
.qec-grid{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
@media (min-width:560px){.qec-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.qec-wall,.qec-folder,.qec-top,.qec-spec{max-width:760px;margin-left:auto;margin-right:auto}.qec-acts{padding-left:12px;padding-right:12px}}
.qec-tile{position:relative;aspect-ratio:3/4.05;perspective:700px;border:0;padding:0;margin:0;background:none;cursor:pointer;color:inherit;border-radius:7px;font:inherit;-webkit-tap-highlight-color:transparent}
.qec-tile:focus-visible{outline:3px solid var(--tape);outline-offset:2px}
.qec-flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.4,1.4,.5,1)}
.qec-tile.down .qec-flip{transform:rotateX(180deg)}
.qec-face,.qec-back{position:absolute;inset:0;border-radius:7px;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.qec-face{background:repeating-linear-gradient(to bottom,transparent 0 10px,rgba(236,230,216,.22) 10px 11px),linear-gradient(180deg,#4b5866,#3a4551);border:2px solid #56636f;display:grid;grid-template-rows:minmax(0,1fr) auto}
.qec-face svg{width:100%;height:100%;display:block}
.qec-plaque{background:#151515;color:#f2f2f2;font-family:var(--fh);font-size:.74rem;letter-spacing:.07em;text-transform:uppercase;text-align:center;padding:2px 1px 3px;line-height:1.15;border-top:2px solid #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qec-plaque small{display:block;font-family:var(--ft);font-size:.78em;letter-spacing:0;color:#bdbdbd;text-transform:none}
.qec-back{transform:rotateX(180deg);background:repeating-linear-gradient(45deg,#3a1e1a 0 7px,#45231e 7px 14px);border:2px solid #5a2c26;display:grid;place-items:center}
.qec-back span{font-family:var(--fh);color:var(--red);font-size:.8rem;letter-spacing:.06em;border:2px solid var(--red);padding:1px 5px;transform:rotate(-14deg);border-radius:4px;background:rgba(0,0,0,.25)}
.qec-wall[data-deck="1"] .qec-back{background:repeating-linear-gradient(45deg,#1b2d4a 0 7px,#223a5e 7px 14px);border-color:#2e4f80}
.qec-wall[data-deck="1"] .qec-back span{color:#9cc2ff;border-color:#9cc2ff}
.qec-wall.accusing .qec-tile:not(.down) .qec-face{border-color:var(--red);box-shadow:inset 0 0 0 2px rgba(214,55,46,.55)}
.qec-wall.picking .qec-tile .qec-face{border-color:#8a96a2}
.qec-tile.sel .qec-face{border-color:var(--tape)!important;box-shadow:0 0 0 3px var(--tape)!important}
.qec-tile.mine::after{content:"MON SUSPECT";position:absolute;left:50%;top:4px;transform:translateX(-50%);font-family:var(--fh);font-size:.55rem;letter-spacing:.08em;background:var(--tape);color:#1b1b1b;padding:1px 5px;border-radius:3px;white-space:nowrap;z-index:2}
.qec-tile.culprit .qec-face{border-color:var(--tape);box-shadow:0 0 0 3px var(--tape)}
.qec-sheet{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;justify-content:center;padding:0 10px calc(10px + env(safe-area-inset-bottom,0px));pointer-events:none}
.qec-card{pointer-events:auto;width:min(100%,460px);background:var(--paper);color:var(--ink);border-radius:12px;padding:12px;display:grid;grid-template-columns:64px minmax(0,1fr);gap:4px 12px;align-items:center;box-shadow:0 -6px 30px rgba(0,0,0,.55);border:3px solid var(--ink);animation:qec-up .3s cubic-bezier(.2,1.3,.4,1)}
.qec-card.alert{border-color:var(--red)}
.qec-card .qec-pic{border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.qec-card p{margin:0;font-family:var(--ft);font-size:.86rem}
.qec-card h3{margin:0;font-family:var(--fh);font-weight:400;font-size:1.25rem;letter-spacing:.03em;text-transform:uppercase;line-height:1.1}
.qec-card .qec-row{grid-column:1/-1;display:flex;gap:8px;margin-top:8px}
.qec-spec{display:grid;gap:12px;padding:14px 12px 0}
.qec-sp{display:grid;grid-template-columns:84px minmax(0,1fr);gap:4px 12px;align-items:center;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.22);border:3px solid #56636f;transition:box-shadow .3s}
.qec-sp[data-deck="0"]{border-color:#c0392b}.qec-sp[data-deck="1"]{border-color:#2e6fd1}
.qec-sp.on{box-shadow:0 0 0 4px rgba(243,195,60,.6),0 0 22px rgba(243,195,60,.3)}
.qec-sp .qec-avw{width:84px;height:80px;grid-row:span 2}
.qec-sp h3{margin:0;font-family:var(--fh);font-weight:400;font-size:1.3rem;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qec-sp p{margin:0;font-family:var(--ft);font-size:.85rem;color:var(--dim)}
.qec-sp p em{font-style:normal;font-family:var(--fh);color:var(--tape);font-size:1.15rem}
.qec-bars{grid-column:1/-1;display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin-top:4px}
.qec-bars i{aspect-ratio:3/4;border-radius:3px;background:#b9ae95;transition:background .4s,transform .4s}
.qec-bars i.down{background:#6d3a32;transform:scaleY(.35);transform-origin:bottom}
.qec-ov{position:fixed;inset:0;z-index:8;display:grid;place-items:center;padding:16px;background:rgba(10,12,16,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.qec-verdict{width:min(100%,440px);background:var(--paper);color:var(--ink);border-radius:10px;padding:22px 16px 18px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:qec-drop .45s cubic-bezier(.2,1.4,.4,1);position:relative}
.qec-verdict h2{margin:0;font-family:var(--fh);font-weight:400;font-size:2rem;line-height:1;text-transform:uppercase;text-align:center}
.qec-verdict p{margin:0;text-align:center;font-family:var(--ft);font-size:.9rem}
.qec-stamp{position:absolute;top:-16px;right:10px;background:var(--paper);font-family:var(--fh);font-size:1rem;color:var(--red);border:3px solid var(--red);padding:2px 10px;transform:rotate(10deg);border-radius:6px;animation:qec-stampin .4s .2s both cubic-bezier(.2,1.6,.4,1)}
.qec-stamp.win{color:#2f8f4e;border-color:#2f8f4e}
.qec-duo{display:grid;grid-template-columns:1fr 1fr;gap:14px;justify-items:center}
.qec-duo figure{margin:0;display:grid;justify-items:center;gap:6px;width:min(100%,130px)}
.qec-duo .qec-pol{width:100%;padding:5px 5px 16px;cursor:default;touch-action:auto}
.qec-duo figcaption{font-family:var(--ft);font-size:.78rem;text-align:center}
.qec-duo figcaption b{display:block;font-family:var(--fh);font-weight:400;font-size:1.15rem;letter-spacing:.04em;text-transform:uppercase}
@keyframes qec-scroll{to{transform:translateX(-50%)}}
@keyframes qec-pulse{to{box-shadow:0 0 0 6px rgba(63,191,106,.1)}}
@keyframes qec-up{from{transform:translateY(60px);opacity:0}}
@keyframes qec-drop{from{transform:translateY(-40px) rotate(-3deg);opacity:0}}
@keyframes qec-stampin{from{transform:rotate(10deg) scale(2.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.qec *,.qec *::before,.qec *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
</style>
<div class="qec">
  <div class="qec-tape" aria-hidden="true"><span>${tapeTxt}</span></div>
  ${isPl ? `
  <div class="qec-top"><div class="qec-bar">
    <button class="qec-pol masked" type="button" id="qec-mine" aria-label="Maintenir pour voir mon suspect"><div class="qec-pic"><span class="qec-q">?</span><span id="qec-mypic"></span></div><span class="qec-cap" id="qec-mycap">Maintenir</span></button>
    <div class="qec-st" role="status" aria-live="polite"><div class="qec-turn" id="qec-turn"><span class="dot"></span><span id="qec-tt"></span></div><p class="qec-sub" id="qec-sub"></p></div>
    <div class="qec-opp" id="qec-opp"><span class="qec-avw">${api.avatar(PL[1 - mySide].key)}</span><b>${nm(1 - mySide)}</b><small id="qec-oppn"></small></div>
  </div>
  <div class="qec-acts" id="qec-acts"><button class="qec-btn dark" type="button" id="qec-end">Fin de mon tour</button><button class="qec-btn red" type="button" id="qec-acc">Accuser</button></div></div>
  <main class="qec-wall" id="qec-wall" data-deck="${mySide}" aria-label="Mon line-up de suspects"><span class="qec-tag">Plateau ${DECK[mySide]} · ${nm(mySide)}</span><div class="qec-grid" id="qec-grid"></div></main>
  <section class="qec-folder" data-tab="Interrogatoire" id="qec-help"><ol class="qec-oral" id="qec-oral"></ol>
    <details class="qec-memo" id="qec-memo" open><summary>Mémo : idées de questions</summary>${memo}</details></section>
  <div class="qec-sheet" id="qec-sheet" hidden></div>
  ` : `
  <div class="qec-spec">
    <div class="qec-turn" id="qec-turn"><span class="dot"></span><span id="qec-tt"></span></div>
    <p class="qec-sub" id="qec-sub" style="margin-top:-6px"></p>
    ${[0, 1].map(i => `<div class="qec-sp" data-deck="${i}" id="qec-sp${i}"><span class="qec-avw">${api.avatar(PL[i].key)}</span><h3>${nm(i)}</h3><p id="qec-spn${i}"></p>${miniBars()}</div>`).join("")}
    <section class="qec-folder" data-tab="Mémo des questions" style="margin:22px 0 0">${memo}</section>
  </div>`}
  <div id="qec-ov"></div>
</div>`;
    const $ = id => el.querySelector("#" + id);

    /* ---------- Logique (hôte) ---------- */
    let hostState = null;
    if (api.isHost) {
      const seen = [null, null];
      let lastInputs = {};
      hostState = {ph: "pick", t: Math.random() < .5 ? 0 : 1, pk: [0, 0], up: [N, N], n: 0};
      api.setState(hostState);
      const secOf = i => {
        const inp = lastInputs[PL[i].key];
        const s = inp && Number.isInteger(inp.sec) ? inp.sec : inp && inp.a === "pick" && Number.isInteger(inp.id) ? inp.id : null;
        return s != null && s >= 0 && s < N ? s : null;
      };
      api.onInputs(inputs => {
        lastInputs = inputs;
        const s = hostState;
        if (s.ph === "over") return;
        let ch = false;
        for (const i of [0, 1]) {
          const inp = inputs[PL[i].key];
          if (!inp) continue;
          if (s.ph === "pick" && !s.pk[i] && secOf(i) != null) { s.pk[i] = 1; ch = true; }
          if (s.ph === "play" && Number.isInteger(inp.up)) {
            const u = Math.max(0, Math.min(N, inp.up));
            if (u !== s.up[i]) { s.up[i] = u; ch = true; }
          }
          if (inp.seq == null || inp.seq === seen[i]) continue;
          seen[i] = inp.seq;
          if (s.ph !== "play" || s.t !== i) continue;
          if (inp.a === "end") { s.t = 1 - i; s.n++; ch = true; }
          else if (inp.a === "accuse" && Number.isInteger(inp.id) && inp.id >= 0 && inp.id < N) {
            const target = secOf(1 - i);
            if (target == null) continue;
            const ok = inp.id === target;
            const w = ok ? i : 1 - i;
            Object.assign(s, {ph: "over", w, acc: {by: i, id: inp.id, ok: ok ? 1 : 0}, sec: [secOf(0), secOf(1)]});
            ch = true;
            const W = PL[w], L = PL[1 - w];
            const summary = ok
              ? `${W.pseudo} a démasqué ${PEOPLE[inp.id].name}, le suspect de ${L.pseudo}.`
              : `${L.pseudo} a accusé ${PEOPLE[inp.id].name} à tort : c'était ${PEOPLE[target].name}.`;
            later(() => api.finish({winners: [W.key], ranking: [W.key, L.key], summary}), 2600);
            break;
          }
        }
        if (s.ph === "pick" && s.pk[0] && s.pk[1]) { s.ph = "play"; s.up = [N, N]; ch = true; }
        if (ch) api.setState({...s, pk: s.pk.slice(), up: s.up.slice()});
      });
    }

    /* ---------- État local du joueur ---------- */
    const down = new Set();
    let mySec = null, myChoice = null, mySeq = 0, myAct = null, myId = null;
    let accusing = false, accPick = null, pendingN = -1, pendingAcc = false;
    let cur = null, prevT = -1, prevPh = "";
    let restored = false;

    function publish() {
      if (!isPl) return;
      api.setInput({seq: mySeq, a: myAct, id: myId, sec: mySec, up: N - down.size});
    }
    function act(a, id) { mySeq++; myAct = a; myId = id == null ? null : id; publish(); }

    // Si le jeu est remonté sur ce téléphone, on retrouve mon suspect et mon compteur depuis ma propre entrée.
    if (isPl) {
      api.onInputs(inputs => {
        if (restored) return;
        restored = true;
        const mine = inputs[api.me];
        if (mine && Number.isInteger(mine.sec) && mySec == null) {
          mySec = mine.sec; mySeq = Math.max(mySeq, mine.seq | 0); myAct = mine.a; myId = mine.id;
          if (cur) render(cur);
        }
      });
    }

    /* ---------- Plateau ---------- */
    let tiles = [];
    if (isPl) {
      const grid = $("qec-grid");
      grid.innerHTML = PEOPLE.map(p => `<button class="qec-tile" type="button" data-id="${p.id}" data-name="${esc(p.name)}"><div class="qec-flip"><div class="qec-face">${portrait(p)}<div class="qec-plaque">${esc(p.name)}<small>N° ${String(p.id + 1).padStart(2, "0")}</small></div></div><div class="qec-back"><span>ÉCARTÉ</span></div></div></button>`).join("");
      tiles = [...grid.children];
      grid.addEventListener("click", e => {
        const t = e.target.closest(".qec-tile");
        if (!t || !cur) return;
        tileClick(+t.dataset.id);
      });
    }
    function tileClick(id) {
      const s = cur;
      if (s.ph === "over") return;
      if (s.ph === "pick") {
        if (mySec != null) return;
        myChoice = id; render(s); return;
      }
      if (mySec == null) return;
      if (accusing) {
        if (down.has(id) || pendingAcc) return;
        accPick = id; render(s); return;
      }
      if (down.has(id)) down.delete(id); else down.add(id);
      publish();
      render(s);
    }

    /* ---------- Feuille de confirmation (en bas) ---------- */
    function sheet(html, alert) {
      const sh = $("qec-sheet");
      if (!sh) return;
      if (!html) { sh.hidden = true; sh.innerHTML = ""; sh.dataset.k = ""; return; }
      if (sh.dataset.k === html) return;
      sh.dataset.k = html;
      sh.innerHTML = `<div class="qec-card${alert ? " alert" : ""}">${html}</div>`;
      sh.hidden = false;
    }
    if (isPl) {
      $("qec-sheet").addEventListener("click", e => {
        const b = e.target.closest("[data-k]");
        if (!b || !cur) return;
        const k = b.dataset.k;
        if (k === "pick" && myChoice != null && cur.ph === "pick" && mySec == null) {
          mySec = myChoice; myChoice = null; act("pick", mySec);
        } else if (k === "unpick") { myChoice = null; }
        else if (k === "accuse" && accPick != null && cur.ph === "play" && cur.t === mySide && !pendingAcc) {
          pendingAcc = true; act("accuse", accPick);
        } else if (k === "cancel") { accusing = false; accPick = null; }
        render(cur);
      });
      $("qec-end").addEventListener("click", () => {
        const s = cur;
        if (!s || s.ph !== "play" || s.t !== mySide || pendingN === s.n || pendingAcc) return;
        accusing = false; accPick = null;
        pendingN = s.n; act("end");
        render(s);
      });
      $("qec-acc").addEventListener("click", () => {
        const s = cur;
        if (!s || s.ph !== "play" || s.t !== mySide || pendingN === s.n || pendingAcc) return;
        accusing = !accusing; accPick = null;
        render(s);
      });
      // Maintenir pour voir mon suspect
      const pol = $("qec-mine");
      const hold = on => { if (mySec == null && on) return; pol.classList.toggle("masked", !on && !(cur && cur.ph === "over")); };
      pol.addEventListener("pointerdown", e => { e.preventDefault(); hold(true); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(t => pol.addEventListener(t, () => hold(false)));
      pol.addEventListener("contextmenu", e => e.preventDefault());
      pol.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); hold(true); } });
      pol.addEventListener("keyup", () => hold(false));
    }

    /* ---------- Affichage ---------- */
    const polaroid = (p, cap) => `<figure><div class="qec-pol"><div class="qec-pic">${portrait(p)}</div></div><figcaption>${cap}<b>${esc(p.name)}</b></figcaption></figure>`;
    function verdict(s) {
      const ov = $("qec-ov");
      if (s.ph !== "over") { ov.innerHTML = ""; return; }
      if (ov.firstChild) return;
      const w = s.w, by = s.acc.by, mineWin = isPl && w === mySide;
      const stamp = s.acc.ok ? "AFFAIRE RÉSOLUE" : "ERREUR JUDICIAIRE";
      const title = isPl ? (mineWin ? "Victoire !" : `${nm(w)} gagne`) : `${nm(w)} gagne !`;
      const why = s.acc.ok
        ? `${nm(by)} accuse ${esc(PEOPLE[s.acc.id].name)} : c'était bien le suspect de ${nm(1 - by)}.`
        : `${nm(by)} accuse ${esc(PEOPLE[s.acc.id].name)} à tort. Le coupable était ${esc(PEOPLE[s.sec[1 - by]].name)}.`;
      ov.innerHTML = `<div class="qec-ov"><div class="qec-verdict" role="dialog" aria-modal="true" aria-label="Verdict">
        <span class="qec-stamp ${s.acc.ok ? "win" : ""}">${stamp}</span>
        <h2>${title}</h2><p>${why}</p>
        <div class="qec-duo">${[0, 1].map(i => s.sec[i] != null ? polaroid(PEOPLE[s.sec[i]], `Suspect de ${nm(i)}`) : "").join("")}</div>
      </div></div>`;
    }
    function render(s) {
      cur = s;
      const t = s.t, ph = s.ph;
      const turnName = nm(t);
      const tt = $("qec-tt"), sub = $("qec-sub"), turn = $("qec-turn");
      if (!isPl) {
        turn.classList.toggle("mine", ph === "play");
        if (ph === "pick") { tt.textContent = "Choix des suspects"; sub.textContent = [0, 1].map(i => `${PL[i].pseudo} : ${s.pk[i] ? "prêt" : "choisit…"}`).join(" · "); }
        else if (ph === "play") { tt.innerHTML = `Au tour de ${turnName}`; sub.innerHTML = `${turnName} pose une question à voix haute.`; }
        else { tt.textContent = "Enquête close"; sub.textContent = ""; }
        for (const i of [0, 1]) {
          const box = $("qec-sp" + i), up = s.up[i];
          box.classList.toggle("on", ph === "play" && t === i);
          $("qec-spn" + i).innerHTML = ph === "pick" ? (s.pk[i] ? "Suspect choisi" : "Choisit son suspect…") : `encore <em>${up}</em> suspect${up > 1 ? "s" : ""} debout`;
          [...box.querySelectorAll(".qec-bars i")].forEach((b, k) => b.classList.toggle("down", k >= up));
        }
        verdict(s);
        prevPh = ph; prevT = t;
        return;
      }
      const me = mySide, opp = 1 - me, oppName = nm(opp);
      const myTurn = ph === "play" && t === me;
      if (ph !== "play" || !myTurn) { accusing = false; accPick = null; }
      if (pendingN !== -1 && s.n !== pendingN) pendingN = -1;
      const waitingEnd = myTurn && pendingN === s.n;

      // mon suspect (polaroid)
      const pol = $("qec-mine"), secP = mySec != null ? PEOPLE[mySec] : null;
      const mp = $("qec-mypic");
      const want = secP ? String(mySec) : "";
      if (mp.dataset.k !== want) { mp.dataset.k = want; mp.innerHTML = secP ? portrait(secP) : ""; }
      if (ph === "over") pol.classList.remove("masked");
      else if (!secP) pol.classList.add("masked");
      $("qec-mycap").textContent = ph === "over" && secP ? secP.name : secP ? "Maintenir" : "À choisir";
      pol.setAttribute("aria-label", secP ? "Maintenir pour voir mon suspect" : "Suspect pas encore choisi");

      // adversaire
      $("qec-opp").classList.toggle("on", ph === "play" && t === opp);
      $("qec-oppn").innerHTML = ph === "pick" ? (s.pk[opp] ? "a choisi" : "choisit…") : `encore <em>${s.up[opp]}</em> debout`;

      // statut
      turn.classList.toggle("mine", myTurn || (ph === "pick" && mySec == null));
      if (ph === "pick") {
        if (mySec == null) { tt.textContent = "Choisissez votre suspect"; sub.innerHTML = `Touchez un portrait de votre plateau. ${oppName} devra le deviner.`; }
        else { tt.textContent = "En attente de l'autre joueur…"; sub.innerHTML = `${oppName} choisit son suspect secret.`; }
      } else if (ph === "play") {
        if (myTurn && accusing) { tt.textContent = "Désignez le coupable"; sub.innerHTML = `Touchez le suspect de ${oppName}. Une erreur et vous perdez !`; }
        else if (myTurn) { tt.textContent = waitingEnd ? "Tour terminé…" : "À vous d'interroger !"; sub.innerHTML = `Posez une question à voix haute à ${oppName}, puis écartez vos suspects. Vous en avez ${N - down.size} debout.`; }
        else { tt.innerHTML = `${oppName} vous interroge`; sub.innerHTML = `Répondez-lui à voix haute par oui ou non. ${oppName} a encore ${plural(s.up[opp], "suspect")} debout.`; }
      } else {
        tt.textContent = "Enquête close"; sub.textContent = "";
      }

      // boutons
      $("qec-acts").hidden = ph !== "play";
      $("qec-end").disabled = !myTurn || waitingEnd || pendingAcc || accusing;
      $("qec-acc").disabled = !myTurn || waitingEnd || pendingAcc;
      $("qec-acc").textContent = accusing ? "Annuler" : "Accuser";
      $("qec-end").textContent = waitingEnd ? "Envoi…" : "Fin de mon tour";

      // aide orale
      const help = $("qec-help"), oral = $("qec-oral");
      help.hidden = ph === "over";
      let steps;
      if (ph === "pick") steps = mySec == null
        ? ["Choisissez en secret votre <b>suspect</b> sur votre plateau.", `${oppName} devra le démasquer en vous posant des questions.`, "Ensuite, il sera caché : maintenez la photo en haut pour le revoir."]
        : [`${oppName} choisit son suspect…`, "Votre suspect est caché : maintenez la photo en haut pour le revoir.", "Vous pouvez montrer votre écran, personne ne le verra."];
      else if (myTurn) steps = [`Posez <b>une question à voix haute</b> à ${oppName} (lunettes ? chapeau ? cheveux roux ?).`, `${oppName} répond oui ou non.`, "Touchez les portraits qui ne correspondent pas pour les écarter.", "Puis <b>Fin de mon tour</b>. Sûr de vous ? <b>Accuser</b>."];
      else steps = [`${oppName} vous pose une question : répondez <b>oui ou non</b> d'après votre suspect.`, "Maintenez la photo en haut pour revoir votre suspect.", "Préparez votre prochaine question."];
      const oh = steps.map(x => `<li>${x}</li>`).join("");
      if (oral.dataset.k !== oh) { oral.dataset.k = oh; oral.innerHTML = oh; }

      // plateau
      const wall = $("qec-wall");
      wall.classList.toggle("accusing", accusing);
      wall.classList.toggle("picking", ph === "pick" && mySec == null);
      const culprit = ph === "over" && s.sec ? s.sec[opp] : null;
      tiles.forEach((el2, i) => {
        const d = ph !== "pick" && down.has(i);
        el2.classList.toggle("down", d);
        el2.classList.toggle("sel", (ph === "pick" && myChoice === i) || (accusing && accPick === i));
        el2.classList.toggle("mine", ph === "over" && mySec === i);
        el2.classList.toggle("culprit", culprit === i);
        el2.setAttribute("aria-label", PEOPLE[i].name + (d ? ", écarté" : ""));
        el2.setAttribute("aria-pressed", d ? "true" : "false");
      });

      // feuille de confirmation
      if (ph === "pick" && mySec == null && myChoice != null) {
        const p = PEOPLE[myChoice];
        sheet(`<div class="qec-pic">${portrait(p)}</div><div><h3>${esc(p.name)}</h3><p>Garder ce suspect secret ? ${oppName} devra le trouver.</p></div>
          <div class="qec-row"><button class="qec-btn red" type="button" data-k="pick">Choisir ${esc(p.name)}</button><button class="qec-btn light" type="button" data-k="unpick">Changer</button></div>`);
      } else if (myTurn && accusing && accPick != null) {
        const p = PEOPLE[accPick];
        sheet(`<div class="qec-pic">${portrait(p)}</div><div><h3>Accuser ${esc(p.name)} ?</h3><p>Si ce n'est pas le suspect de ${oppName}, vous perdez.</p></div>
          <div class="qec-row"><button class="qec-btn red" type="button" data-k="accuse"${pendingAcc ? " disabled" : ""}>${pendingAcc ? "Envoi…" : "Oui, j'accuse"}</button><button class="qec-btn light" type="button" data-k="cancel"${pendingAcc ? " disabled" : ""}>Annuler</button></div>`, true);
      } else sheet("");

      if (ph === "play" && prevPh === "pick") api.toast(`${PL[t].pseudo} commence !`);
      verdict(s);
      prevPh = ph; prevT = t;
    }
    api.onState(s => { if (s && s.ph) render(s); });

    return {
      destroy() {
        timers.forEach(clearTimeout);
        timers.length = 0;
        el.innerHTML = "";
      }
    };
  }
});
