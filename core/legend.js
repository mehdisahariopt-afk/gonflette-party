/* Gonflette Party : formes légendaires du PRESTIGE (chargé après avatar.js).
   Au niveau max, un joueur peut « renaître » : XP → 0, prestige +1. Le niveau de prestige voyage dans le look
   (look.pr = 1, 2, 3…) : présence, rosters de partie, soirée… tout le monde le reçoit sans rien changer au réseau.
   Les anciens clients ignorent look.pr (ils voient le perso normal).

   GONFLETTE.avatar.svg est enveloppée : tout look avec pr > 0 est dessiné dans sa forme légendaire, partout.
     P1 « Enflammé » (★ Bronze) · P2 « Demi-dieu » (★★ Argent) · P3 « Ombre démoniaque » (★★★ Or)
     P4 « Titan cosmique » (💎 Diamant) · P5 « Divinité » (👑 Légende) ; au-delà de 5 : forme P5, « 👑 Légende ×N ».
   opts.lg choisit le rendu (performances : beaucoup de persos sur un téléphone) :
     "full"   : animé (lobby 2D, éditeur, cabine d'essayage) : renvoie <div class="lg-stack"> = SVG principal FIXE (filtres,
                rastérisé une fois, calque à part) + calques SVG légers animés sans filtre (particules, rayons, volutes).
                Une animation SMIL dans un SVG filtré force le recalcul de tous ses filtres à chaque image (8 persos ≈ 8 i/s) ;
                en calques : ≈ 60 i/s. "still" si prefers-reduced-motion.
     "smil"   : tout en un seul SVG animé (comparaison / maquette ; lourd)
     "still"  : filtres, sans animation (images rastérisées une fois : photo souvenir…)
     "sprite" : comme "still", pour les sprites 3D (pas de faisceau qui monte jusqu'en haut du cadre)
     "lite"   : (défaut) petits formats : ni filtre ni animation, moins de particules (bustes, podiums, jeux)
     "off"    : perso normal
   Outils (génériques, toutes poses) : la peau (éléments peints exactement en couleur de peau) est repeinte par
   remplacement de couleur ; un clone noir & blanc de la scène (peau = blanc) sert de masque « peau visible » aux
   surcouches et de source aux filtres d'éclairage ; les points du corps viennent de opts.out.anchors (avatar.js)
   ou, à défaut, des formules de proportions d'avatar.js. Identifiants uniques par instance (compteur). */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});
  const AV = G.avatar;
  if (!AV || !AV.svg || AV.svg.__legend) return;
  const ORIG = AV.svg;
  const INK = "#1d1420";
  const f = n => Math.round(n * 10) / 10;
  function shade(hex, k) {
    const n = parseInt(String(hex).slice(1), 16);
    if (!isFinite(n) || String(hex).length !== 7) return hex;
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
  }
  const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const star4 = (x, y, r, fill, extra) => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * .16)} ${f(y - r * .16)} ${f(x + r)} ${f(y)}Q${f(x + r * .16)} ${f(y + r * .16)} ${f(x)} ${f(y + r)}Q${f(x - r * .16)} ${f(y + r * .16)} ${f(x - r)} ${f(y)}Q${f(x - r * .16)} ${f(y - r * .16)} ${f(x)} ${f(y - r)}Z" fill="${fill}"${extra || ""}/>`;
  const REG = `x="-80" y="-60" width="380" height="400"`;
  const TOKEN = "\u0001"; // préfixe d'identifiants, remplacé à chaque appel (cache)
  let UID = 0;
  const reducedMQ = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!(reducedMQ && reducedMQ.matches);
  const SKIN_FX = {doree: "#e9b824", marbre: "#ecebe4", fluo: "#ff8a1f", coupsoleil: "#f4836c"};
  const MAXF = 5;
  const prOf = look => { const n = Math.floor(+(look && look.pr) || 0); return n > 0 && n < 1000 ? n : 0; };
  const formOf = P => Math.min(MAXF, Math.max(0, P | 0));

  // géométrie (mêmes formules que avatar.js) ; affinée par opts.out.anchors quand avatar.js les fournit
  function geom(m) {
    const mc = Math.min(m, 1);
    const g = {m, hx: 100, gy: 258, headR: 25 - 6 * mc - 2 * Math.max(0, m - 1), yS: 100 + 2 * m, headY: 50 + 12 * m, neckH: 4 + 13 * m,
      SW: 19 + 50 * m, W: 13 + 12 * m, H: 15 + 13 * m, UA0: 7 + 28 * m, handR: 8 + 6 * m};
    g.trapTop = g.yS - 10 - 22 * m; g.nkTop = g.yS - 12 - 8 * m; g.tc0 = g.neckH + (g.SW - g.neckH) * .45;
    g.hw = Math.max(g.SW + g.UA0 + 10, 62);
    return g;
  }
  const num = v => typeof v === "number" && isFinite(v);
  function pt(v, y) {
    if (Array.isArray(v) && num(v[0]) && num(v[1])) return [v[0], v[1]];
    if (v && num(v.x) && num(v.y)) return [v.x, v.y];
    if (num(v) && num(y)) return [v, y];
    return null;
  }

  /* ---------- filtres partagés ---------- */
  const glowF = (id, sd, k) => `<filter id="${id}" filterUnits="userSpaceOnUse" ${REG}><feGaussianBlur in="SourceGraphic" stdDeviation="${sd}" result="b"/><feMerge>${"<feMergeNode in=\"b\"/>".repeat(k || 2)}<feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const matF = (id, o) => `<filter id="${id}" filterUnits="userSpaceOnUse" ${REG} color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="a"/><feGaussianBlur in="a" stdDeviation="${o.blur}" result="ab"/><feSpecularLighting in="ab" surfaceScale="${o.scale}" specularConstant="${o.sc}" specularExponent="${o.se}" lighting-color="${o.light}" result="sp"><feDistantLight azimuth="${o.az || 230}" elevation="${o.el || 48}"/></feSpecularLighting><feComposite in="sp" in2="a" operator="in" result="spi"/><feOffset in="ab" dx="${o.dx || -2.5}" dy="${o.dy || -3.5}" result="off"/><feComposite in="a" in2="off" operator="out" result="edge"/><feGaussianBlur in="edge" stdDeviation="1.2" result="edgeb"/><feFlood flood-color="${o.shadow}" flood-opacity="${o.so}"/><feComposite in2="edgeb" operator="in" result="sh"/><feComposite in="sh" in2="a" operator="in" result="sh2"/><feMerge><feMergeNode in="sh2"/><feMergeNode in="spi"/></feMerge></filter>`;
  const rimF = (id, col, sd, gain) => `<filter id="${id}" filterUnits="userSpaceOnUse" ${REG} color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="a"/><feGaussianBlur in="a" stdDeviation="${sd}" result="ab"/><feComposite in="a" in2="ab" operator="out" result="e"/><feComponentTransfer in="e" result="e2"><feFuncA type="linear" slope="${gain}"/></feComponentTransfer><feFlood flood-color="${col}"/><feComposite in2="e2" operator="in"/></filter>`;
  const silGlow = (id, col, dil, sd, op, col2, sd2, op2) => `<filter id="${id}" filterUnits="userSpaceOnUse" ${REG} color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="a"/><feMorphology in="a" operator="dilate" radius="${dil}" result="d"/><feGaussianBlur in="d" stdDeviation="${sd}" result="b1"/><feFlood flood-color="${col}" flood-opacity="${op}"/><feComposite in2="b1" operator="in" result="g1"/><feGaussianBlur in="d" stdDeviation="${sd2}" result="b2"/><feFlood flood-color="${col2}" flood-opacity="${op2}"/><feComposite in2="b2" operator="in" result="g2"/><feMerge><feMergeNode in="g2"/><feMergeNode in="g1"/></feMerge></filter>`;
  const bandTable = (n, band, soft) => { const a = []; for (let i = 0; i <= n; i++) { const d = Math.abs(i / n - .5); a.push(d <= band ? 1 : d <= band + soft ? +(1 - (d - band) / soft).toFixed(2) : 0); } return a.join(" "); };
  const noiseLines = (id, o) => `<filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ${REG} color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${o.freq}" numOctaves="${o.oct || 2}" seed="${o.seed || 4}" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="r"/>${o.wide ? `<feComponentTransfer in="r" result="w"><feFuncA type="table" tableValues="${bandTable(80, o.wide, .06)}"/></feComponentTransfer><feFlood flood-color="${o.wideCol}" flood-opacity="${o.wideOp}"/><feComposite in2="w" operator="in" result="wc"/>` : ""}<feComponentTransfer in="r" result="ln"><feFuncA type="table" tableValues="${bandTable(200, o.band, o.band)}"/></feComponentTransfer><feFlood flood-color="${o.col}"/><feComposite in2="ln" operator="in" result="c"/>${o.core ? `<feComponentTransfer in="r" result="ln2"><feFuncA type="table" tableValues="${bandTable(200, o.core, o.core * .6)}"/></feComponentTransfer><feFlood flood-color="${o.coreCol}"/><feComposite in2="ln2" operator="in" result="cc"/>` : ""}<feGaussianBlur in="c" stdDeviation="${o.glow || 0}" result="g"/><feMerge>${o.wide ? `<feMergeNode in="wc"/>` : ""}${o.glow ? `<feMergeNode in="g"/><feMergeNode in="g"/>` : ""}<feMergeNode in="c"/>${o.core ? `<feMergeNode in="cc"/>` : ""}</feMerge></filter>`;
  const blob = (id, col, op) => `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset=".55" stop-color="${col}" stop-opacity="${f(op * .45)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;

  /* ---------- matières ---------- */
  let galCache = null, lavaCache = null;
  function galaxyStars(n) {
    const R = rng(11);
    let st = "";
    for (let i = 0; i < n; i++) {
      const x = -60 + R() * 340, y = -40 + R() * 340, r = .3 + Math.pow(R(), 3) * 1.25, c = R() < .18 ? "#bfe8ff" : R() < .12 ? "#ffd1f4" : "#fff";
      st += `<circle cx="${f(x)}" cy="${f(y)}" r="${r.toFixed(2)}" fill="${c}" opacity="${(.5 + R() * .5).toFixed(2)}"/>`;
    }
    return {st, R};
  }
  const GAL_CL = [[60, 120, 46, 26, -30, "#ff3dbb", .55], [140, 175, 50, 24, 25, "#2fd6ff", .45], [100, 60, 40, 22, 10, "#8a5cff", .7], [95, 230, 55, 20, -10, "#b14dff", .5],
    [30, 200, 30, 30, 0, "#2fd6ff", .35], [175, 95, 35, 20, 40, "#ff3dbb", .45], [100, 140, 140, 16, -38, "#e9d8ff", .28]];
  function galaxyDefs(id, lite) {
    if (!galCache) {
      const full = galaxyStars(300); let s4 = ""; for (let i = 0; i < 26; i++) s4 += star4(-50 + full.R() * 320, -30 + full.R() * 320, 1.6 + full.R() * 2.6, i % 3 ? "#fff" : "#c9f3ff");
      const lt = galaxyStars(70); let s4l = ""; for (let i = 0; i < 10; i++) s4l += star4(-50 + lt.R() * 320, -30 + lt.R() * 320, 1.8 + lt.R() * 2.4, i % 3 ? "#fff" : "#c9f3ff");
      galCache = {full: full.st + s4, lite: lt.st + s4l};
    }
    let nb = "", gr = "";
    if (lite) { // nébuleuses en dégradés radiaux (pas de flou)
      const cols = {};
      GAL_CL.forEach(([x, y, rx, ry, a, c, o]) => { const k = c.slice(1); if (!cols[k]) { cols[k] = 1; gr += blob(`${id}gb${k}`, c, 1); } nb += `<ellipse cx="${x}" cy="${y}" rx="${f(rx * 1.5)}" ry="${f(ry * 1.6)}" fill="url(#${id}gb${k})" opacity="${o}" transform="rotate(${a} ${x} ${y})"/>`; });
    } else GAL_CL.forEach(([x, y, rx, ry, a, c, o]) => { nb += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}" transform="rotate(${a} ${x} ${y})" filter="url(#${id}nb)"/>`; });
    return `<radialGradient id="${id}gx" gradientUnits="userSpaceOnUse" cx="100" cy="140" r="190"><stop offset="0" stop-color="#3a1d86"/><stop offset=".45" stop-color="#1c1660"/><stop offset="1" stop-color="#090824"/></radialGradient>${gr}`
      + (lite ? "" : `<filter id="${id}nb" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="11"/></filter>`)
      + `<pattern id="${id}gal" patternUnits="userSpaceOnUse" x="-60" y="-40" width="340" height="340"><g transform="translate(60 40)"><rect x="-60" y="-40" width="340" height="340" fill="url(#${id}gx) #1c1660"/>${nb}${lite ? galCache.lite : galCache.full}</g></pattern>`;
  }
  // P1 en petit format : fissures de lave figées (motif) au lieu du bruit filtré
  function lavaPattern(id) {
    if (!lavaCache) {
      const R = rng(71);
      let d = "";
      for (let i = 0; i < 34; i++) {
        let x = -60 + R() * 340, y = -40 + R() * 340, a = R() * 6.3;
        d += `M${f(x)} ${f(y)}`;
        const n = 3 + (R() * 4 | 0);
        for (let k = 0; k < n; k++) { a += (R() - .5) * 1.6; const l = 5 + R() * 9; x += Math.cos(a) * l; y += Math.sin(a) * l; d += `L${f(x)} ${f(y)}`; }
      }
      lavaCache = d;
    }
    return `<pattern id="${id}lv" patternUnits="userSpaceOnUse" x="-60" y="-40" width="340" height="340"><g transform="translate(60 40)"><rect x="-60" y="-40" width="340" height="340" fill="url(#${id}ash) #a65a42"/><path d="${lavaCache}" fill="none" stroke="#3a1208" stroke-width="2.6" opacity=".45" stroke-linejoin="round"/><path d="${lavaCache}" fill="none" stroke="#ff6a00" stroke-width="1.3" stroke-linejoin="round"/><path d="${lavaCache}" fill="none" stroke="#ffe08a" stroke-width=".45" stroke-linejoin="round"/></g></pattern>`;
  }

  /* ---------- formes ---------- */
  const flameT = (x, base, h, w, fill, sw) => `<path d="M${f(x - w)} ${f(base)}Q${f(x - w * 1.15)} ${f(base - h * .5)} ${f(x - w * .1)} ${f(base - h * .78)}Q${f(x + w * .05)} ${f(base - h * .9)} ${f(x - w * .15)} ${f(base - h)}Q${f(x + w * .75)} ${f(base - h * .72)} ${f(x + w * .6)} ${f(base - h * .5)}Q${f(x + w * 1.2)} ${f(base - h * .3)} ${f(x + w)} ${f(base)}Z" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"` : ""}/>`;
  const glowEye = (x, y, r, col, core) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.1)}" fill="${col}" opacity=".35"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.15)}" fill="${col}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .55)}" fill="${core}"/>`;
  const fl = (c, id) => c.full ? ` filter="url(#${c.id}${id})"` : "";
  const an = (c, s) => c.anim ? s : "";

  // particules : dessinées fixes dans le SVG principal (still / lite) ou animées dans un calque à part (full)
  function p1Smoke(c) {
    const g = c.g, R = rng(71);
    let sm = "";
    for (let i = 0; i < 6; i++) { const x = g.hx + (R() - .5) * g.SW * 1.6, y = Math.max(c.top + 16, g.headY - g.headR - 10 - R() * 30), rr = 8 + R() * 8, du = (3 + R() * 2).toFixed(1); sm += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(c.fx ? rr * 1.5 : rr)}" fill="${c.fx ? `url(#${c.id}sg)` : "#6b5a6e"}" opacity="${c.fx ? .8 : .3}">${an(c, `<animate attributeName="cy" values="${f(y + 20)};${f(y - 30)}" dur="${du}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" dur="${du}s" repeatCount="indefinite"/>`)}</circle>`; }
    return c.fx ? `<defs><radialGradient id="${c.id}sg"><stop offset="0" stop-color="#6b5a6e" stop-opacity=".55"/><stop offset="1" stop-color="#6b5a6e" stop-opacity="0"/></radialGradient></defs>${sm}` : `<g filter="url(#${c.id}smk)">${sm}</g>`;
  }
  function p1Embers(c, n) {
    const g = c.g, R = rng(77);
    let o = "";
    for (let i = 0; i < n; i++) {
      const x = g.hx + (R() - .5) * (g.SW * 2 + 40), y0 = (c.bust ? g.yS + 60 : 230) - R() * 120, du = (1.6 + R() * 1.6).toFixed(2), rr = .9 + R() * 1.4, b1 = (R() * 2).toFixed(2), b2 = (R() * 2).toFixed(2), col = i % 3 ? "#ffd23f" : "#ff7a1a";
      if (c.fx) o += `<g><circle cx="${f(x)}" cy="${f(y0)}" r="${f(rr * 2.6)}" fill="${col}" opacity=".3"/><circle cx="${f(x)}" cy="${f(y0)}" r="${f(rr)}" fill="${col}"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -70" dur="${du}s" begin="-${b1}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="${du}s" begin="-${b1}s" repeatCount="indefinite"/></g>`;
      else o += `<circle cx="${f(x)}" cy="${f(y0)}" r="${f(rr * (c.full ? 1 : 1.3))}" fill="${col}"${fl(c, "gl")}>${an(c, `<animate attributeName="cy" values="${f(y0)};${f(y0 - 70)}" dur="${du}s" begin="-${b1}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="${du}s" begin="-${b2}s" repeatCount="indefinite"/>`)}</circle>`;
    }
    return o;
  }
  function p2Sparkles(c, n) {
    const g = c.g, R = rng(21), ext = Math.min(g.SW + 40, 132);
    let o = "";
    for (let i = 0; i < n; i++) {
      const a = i * 2.39 + .4, rr = .62 + (i % 4) * .12, x = g.hx + Math.cos(a) * ext * rr, y = (c.bust ? g.yS + 10 : 130) + Math.sin(a) * (c.bust ? 70 : 118) * rr, r = 3 + (i % 3) * 2.2, du = (1.4 + R()).toFixed(2), b = (R() * 2).toFixed(2);
      o += `<g>${star4(x, y, r, i % 3 ? "#fff6c9" : "#ffd23f", ` stroke="${INK}" stroke-width="1.1"`)}${an(c, `<animate attributeName="opacity" values="1;.15;1" dur="${du}s" begin="-${b}s" repeatCount="indefinite"/>`)}</g>`;
    }
    return o;
  }
  function p3Wisps(c) {
    const g = c.g, R = rng(501);
    let w = "";
    const src = [[g.hx - g.SW * .7, g.yS - 4], [g.hx + g.SW * .7, g.yS - 4], [g.hx - g.headR * .6, g.headY - g.headR], [g.hx + g.headR * .5, g.headY - g.headR], [g.hx - g.SW * .35, g.trapTop], [g.hx + g.SW * .35, g.trapTop]];
    src.forEach(([x, y], i) => {
      const s = i % 2 ? 1 : -1, wd = 6 + 5 * g.m, du = (2.2 + R() * 1.2).toFixed(1);
      let h = 40 + R() * 30 + 15 * g.m; if (y - h < c.top) h = Math.max(14, y - c.top);
      const d = `M${f(x - wd)} ${f(y + 6)}C${f(x - wd + s * 10)} ${f(y - h * .35)} ${f(x + s * 18)} ${f(y - h * .6)} ${f(x + s * 6)} ${f(y - h)}C${f(x + s * 26)} ${f(y - h * .55)} ${f(x + wd + s * 8)} ${f(y - h * .3)} ${f(x + wd)} ${f(y + 6)}Z`;
      w += `<path d="${d}">${an(c, `<animateTransform attributeName="transform" type="translate" values="0 4;0 -8;0 4" dur="${du}s" repeatCount="indefinite"/>`)}</path>`;
    });
    return `<g fill="#05020a" stroke="#7d2fe0" stroke-width="2" opacity=".95"${fl(c, "smk")}>${w}</g>`;
  }
  function p4Twinkles(c, n) {
    const g = c.g, ext = c.bust ? g.hw * .62 : Math.min(g.SW + 50, 140), cy = c.bust ? g.yS + 10 : 135, vy = c.bust ? g.hw * .55 : 110, R = rng(37);
    let o = "";
    for (let i = 0; i < n; i++) { const x = g.hx + (R() - .5) * ext * 2, y = cy + (R() - .5) * vy * 2.1, du = (1.5 + R() * 1.5).toFixed(2), b = (R() * 2).toFixed(2); o += `<g>${star4(x, y, 3 + R() * 3, "#e9fbff")}${an(c, `<animate attributeName="opacity" values="1;.2;1" dur="${du}s" begin="-${b}s" repeatCount="indefinite"/>`)}</g>`; }
    return o;
  }
  function p5Motes(c, n) {
    const g = c.g, R = rng(51);
    let o = "";
    for (let i = 0; i < n; i++) { const x = g.hx + (R() - .5) * 150, y = 40 + R() * 210, du = (2 + R() * 2).toFixed(1); o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8 + R() * 1.6)}" fill="#fff8d6" opacity=".9">${an(c, `<animate attributeName="cy" values="${f(y)};${f(y - 40)}" dur="${du}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="${du}s" repeatCount="indefinite"/>`)}</circle>`; }
    return o;
  }
  function p5Rays(c) {
    const g = c.g, hx = g.hx, hy = g.headY - 2, r = g.headR, R1 = nimR(c);
    let rays = "";
    for (let i = 0; i < 18; i++) { const a = i * Math.PI / 9, a1 = a - .07, a2 = a + .07, r0 = r + 4, r2 = R1 + 12 + (i % 2) * 8; rays += `M${f(hx + Math.cos(a1) * r0)} ${f(hy + Math.sin(a1) * r0)}L${f(hx + Math.cos(a) * r2)} ${f(hy + Math.sin(a) * r2)}L${f(hx + Math.cos(a2) * r0)} ${f(hy + Math.sin(a2) * r0)}Z`; }
    return `<g fill="#ffe27a" opacity=".55"><path d="${rays}"/>${an(c, `<animateTransform attributeName="transform" type="rotate" from="0 ${f(hx)} ${f(hy)}" to="360 ${f(hx)} ${f(hy)}" dur="24s" repeatCount="indefinite"/>`)}</g>`;
  }
  function nimR(c) { const g = c.g, hy = g.headY - 2, r = g.headR; let R1 = r + 18 + 6 * g.m; if (hy - R1 - 20 < c.top) R1 = Math.max(r + 8, hy - c.top - 20); return R1; }

  const FORMS = [
    {key: "p0", name: "Normal", sub: ""},
    { // P1 « Enflammé » : braises sous la peau, cheveux et couronne de feu, étincelles
      key: "p1", name: "Enflammé", sub: "braises sous la peau · cheveux de feu",
      hairStyle: "court", hair: "#ff6a1b", hairPaint: c => `url(#${c.id}fh) #ff6a1b`,
      skin: c => c.full ? `url(#${c.id}ash) #a65a42` : `url(#${c.id}lv) #a65a42`, skin2: "#5e2a1c", vein: "#ff9f1c",
      defs: c => `<linearGradient id="${c.id}ash" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="260"><stop offset="0" stop-color="#c98566"/><stop offset=".55" stop-color="#a65a42"/><stop offset="1" stop-color="#6e3326"/></linearGradient>`
        + `<linearGradient id="${c.id}fh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset=".5" stop-color="#ff8a1a"/><stop offset="1" stop-color="#e8361a"/></linearGradient>`
        + `<radialGradient id="${c.id}heat"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".5"/><stop offset=".6" stop-color="#e8361a" stop-opacity=".16"/><stop offset="1" stop-color="#e8361a" stop-opacity="0"/></radialGradient>`
        + (c.full ? noiseLines(c.id + "lava", {freq: .045, oct: 2, seed: 4, band: .012, col: "#ff6a00", glow: 1.8, core: .005, coreCol: "#fff1a0", wide: .05, wideCol: "#2a0c06", wideOp: .5})
          + matF(c.id + "mat", {blur: 2.2, scale: 3, sc: .5, se: 16, light: "#ffd2a0", shadow: "#2a0c06", so: .5})
          + glowF(c.id + "gl", 2.5, 2) + `<filter id="${c.id}smk" filterUnits="userSpaceOnUse" ${REG}><feGaussianBlur stdDeviation="4"/></filter>` : lavaPattern(c.id)),
      ground: c => {
        const g = c.g, ext = c.bust ? g.hw * .85 : Math.min(g.SW + 55, 140), cy = c.bust ? g.yS + 20 : 140;
        let o = `<ellipse cx="${f(g.hx)}" cy="${f(cy)}" rx="${f(ext)}" ry="${f(c.bust ? g.hw * .85 : 140)}" fill="url(#${c.id}heat)"/>`;
        return !c.full || c.stack ? o : o + p1Smoke(c);
      },
      behind: c => {
        const g = c.g, hx = g.hx, hy = g.headY, r = g.headR, base = hy - r * .25;
        const T = [[-1.05, 1.5, .38], [-.66, 2.15, .42], [-.24, 2.7, .46], [.2, 2.5, .46], [.62, 2.05, .42], [1.02, 1.4, .38]];
        let o = "";
        T.forEach(([k, h, w], i) => {
          let H = r * h; if (base - H < c.top) H = Math.max(r * .7, base - c.top);
          const x = hx + k * r, Wd = r * w, du = (.7 + (i % 3) * .17).toFixed(2);
          o += `<g transform="translate(${f(x)} ${f(base)})"><g>${flameT(0, 0, H, Wd, "#ff4b1f", 3)}${flameT(Wd * .08, 0, H * .72, Wd * .66, "#ff9f1c")}${flameT(Wd * .12, 0, H * .45, Wd * .38, "#ffe14d")}${an(c, `<animateTransform attributeName="transform" type="scale" values="1 1;1.06 1.14;.96 .92;1 1" dur="${du}s" repeatCount="indefinite"/>`)}</g></g>`;
        });
        return (c.full ? `<g filter="url(#${c.id}gl)" opacity=".55">${o}</g>` : "") + o;
      },
      overlay: c => c.full ? `<use href="#${c.id}bw" filter="url(#${c.id}mat)"/><g><rect x="-80" y="-60" width="380" height="400" fill="#000" filter="url(#${c.id}lava)"/>${an(c, `<animate attributeName="opacity" values="1;.55;1" dur="1.6s" repeatCount="indefinite"/>`)}</g>` : "",
      top: c => {
        let o = "";
        for (const [x, y, r] of c.eyes) o += c.full ? `<g filter="url(#${c.id}gl)"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.1)}" fill="#ffb21a"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .5)}" fill="#fff6c9"/></g>` : glowEye(x, y, r, "#ffb21a", "#fff6c9");
        return o + p1Embers(c, c.stack ? 0 : c.anim ? 16 : c.full ? 8 : 5);
      },
      fx: c => ({back: c.bust ? "" : p1Smoke(c), front: p1Embers(c, 16)})
    },
    { // P2 « Demi-dieu » : peau d'or métallique, yeux lumineux, étincelles
      key: "p2", name: "Demi-dieu", sub: "peau d'or · yeux lumineux · étincelles",
      skin: c => `url(#${c.id}gold) #f2a91b`, skin2: "#b77808", vein: "#a8670a",
      defs: c => `<linearGradient id="${c.id}gold" gradientUnits="userSpaceOnUse" x1="60" y1="20" x2="140" y2="262"><stop offset="0" stop-color="#ffe680"/><stop offset=".3" stop-color="#ffc93a"/><stop offset=".55" stop-color="#f2a91b"/><stop offset=".75" stop-color="#ffcf4a"/><stop offset="1" stop-color="#d48a0a"/></linearGradient>`
        + `<radialGradient id="${c.id}aur"><stop offset="0" stop-color="#ffe680" stop-opacity=".55"/><stop offset=".6" stop-color="#ffb703" stop-opacity=".18"/><stop offset="1" stop-color="#ffb703" stop-opacity="0"/></radialGradient>`
        + (c.full ? matF(c.id + "mat", {blur: 2.4, scale: 4, sc: 1.25, se: 22, light: "#fffbe6", shadow: "#8a4d00", so: .55}) + glowF(c.id + "gl", 2.2, 3) : "")
        + (c.anim ? `<linearGradient id="${c.id}glint" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ""),
      ground: c => `<ellipse cx="${f(c.g.hx)}" cy="${c.bust ? f(c.g.yS + 30) : 140}" rx="${f(c.bust ? c.g.hw * .9 : Math.min(c.g.SW + 60, 145))}" ry="${f(c.bust ? c.g.hw * .9 : 140)}" fill="url(#${c.id}aur)"/>`,
      overlay: c => c.full ? `<use href="#${c.id}bw" filter="url(#${c.id}mat)"/>` + an(c, `<rect x="-60" y="-40" width="40" height="400" fill="url(#${c.id}glint)" transform="rotate(25 100 140)" opacity=".9"><animate attributeName="x" values="-120;-120;300" keyTimes="0;.6;1" dur="3.2s" repeatCount="indefinite"/></rect>`) : "",
      top: c => {
        let o = "";
        for (const [x, y, r] of c.eyes) o += (c.full ? `<g filter="url(#${c.id}gl)"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.25)}" fill="#ffe14d"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .7)}" fill="#fff"/></g>` : glowEye(x, y, r * 1.1, "#ffe14d", "#fff")) + `<path d="M${f(x - r * 2.6)} ${f(y)}h${f(r * 5.2)}" stroke="#fff6c9" stroke-width="1" opacity=".9"/>`;
        return o + p2Sparkles(c, c.stack ? 0 : c.anim ? 12 : c.full ? 8 : 5);
      },
      fx: c => ({front: p2Sparkles(c, 12)})
    },
    { // P3 « Ombre démoniaque » : corps d'encre, liseré et halo violets, cornes de feu, sourire carnassier
      key: "p3", name: "Ombre démoniaque", sub: "corps d'encre · liseré violet · cornes de feu",
      sil: true, hairStyle: "chauve", skin: () => "#140b1f", skin2: "#3b1f5c", vein: "#7a3fd0", noFlush: true,
      defs: c => `<linearGradient id="${c.id}horn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5b17b8"/><stop offset=".5" stop-color="#b14dff"/><stop offset="1" stop-color="#f3d9ff"/></linearGradient>`
        + `<radialGradient id="${c.id}pool"><stop offset="0" stop-color="#05020a" stop-opacity=".95"/><stop offset=".6" stop-color="#2a0d4a" stop-opacity=".6"/><stop offset="1" stop-color="#5b17b8" stop-opacity="0"/></radialGradient>`
        + (c.full ? rimF(c.id + "rim", "#c77dff", 2.2, 3.4) + silGlow(c.id + "halo", "#a64dff", 1.6, 3, .9, "#5b17b8", 13, .65) + glowF(c.id + "gl", 2, 3) + glowF(c.id + "gl2", 3.5, 2)
          + `<filter id="${c.id}smk" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ${REG}><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.6"/></filter>`
          : `<radialGradient id="${c.id}aur"><stop offset="0" stop-color="#b14dff" stop-opacity=".75"/><stop offset=".55" stop-color="#7d2fe0" stop-opacity=".35"/><stop offset="1" stop-color="#5b17b8" stop-opacity="0"/></radialGradient>`),
      ground: c => {
        if (c.bust) return "";
        const g = c.g, w = Math.min(50 + 45 * g.m, 140), gy = g.gy;
        let o = `<ellipse cx="${f(g.hx)}" cy="${f(gy - 1)}" rx="${f(w)}" ry="14" fill="url(#${c.id}pool)"/>`;
        const flame = (x, h, wd) => `<path d="M${f(x - wd)} ${f(gy + 1)}Q${f(x - wd)} ${f(gy + 1 - h * .6)} ${f(x + wd * .2)} ${f(gy + 1 - h)}Q${f(x + wd * .1)} ${f(gy + 1 - h * .45)} ${f(x + wd)} ${f(gy + 1)}Z"/>`;
        let fls = "";
        [-.9, -.62, -.35, .35, .62, .9].forEach((k, i) => { fls += flame(g.hx + k * w * .8, 18 + (i % 3) * 10 + 12 * g.m, 7 + 3 * g.m); });
        return o + `<g fill="#0a0410" stroke="#a64dff" stroke-width="1.6"${fl(c, "gl")}>${fls}</g>`;
      },
      behind: c => {
        const g = c.g;
        const aura = c.full ? `<use href="#${c.id}sil" filter="url(#${c.id}halo)"/>`
          : `<ellipse cx="${f(g.hx)}" cy="${f(c.bust ? g.yS + 10 : (g.headY + g.gy) / 2)}" rx="${f(c.bust ? g.hw * .95 : Math.min(g.SW + g.UA0 + 22, 140))}" ry="${f(c.bust ? g.hw * .95 : (g.gy - g.headY) / 2 + g.headR + 20)}" fill="url(#${c.id}aur)"/>`;
        return aura + (c.stack ? "" : p3Wisps(c)) + (c.full ? `<use href="#${c.id}sil" filter="url(#${c.id}halo)" opacity=".7"/>` : "");
      },
      overlay: c => c.full ? `<use href="#${c.id}bw" filter="url(#${c.id}rim)"/>` : "",
      top: c => {
        const g = c.g, hx = g.hx, hy = g.headY, r = g.headR;
        let o = "";
        for (const d of [-1, 1]) {
          const bx = hx + d * r * .5, by = hy - r * .78;
          let hh = Math.max(r, 22) * .95; if (by - hh < c.top) hh = Math.max(r * .5, by - c.top);
          const p = `M${f(bx - d * r * .2)} ${f(by + 3)}Q${f(bx + d * r * .05)} ${f(by - hh * .5)} ${f(bx + d * r * .55)} ${f(by - hh)}Q${f(bx + d * r * .2)} ${f(by - hh * .55)} ${f(bx + d * r * .3)} ${f(by + 1)}Z`;
          o += `<g${fl(c, "gl")}><path d="${p}" fill="url(#${c.id}horn) #b14dff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">${an(c, `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur=".6s" repeatCount="indefinite"/>`)}</path></g>`;
        }
        if (c.pose !== "back") {
          const ey = hy - r * .05, ex = r * .38, k = r * .3;
          let eyes = "";
          for (const d of [-1, 1]) { const x = hx + d * ex; eyes += `<path d="M${f(x - d * k * 1.15)} ${f(ey - k * .15)}Q${f(x)} ${f(ey - k * .95)} ${f(x + d * k * 1.25)} ${f(ey - k * .7)}Q${f(x + d * k * .3)} ${f(ey + k * .75)} ${f(x - d * k * 1.15)} ${f(ey - k * .15)}Z"/>`; }
          const my = hy + r * .42, mw = r * .62;
          let teeth = `M${f(hx - mw * .82)} ${f(my + r * .04)}`;
          for (let i = 1; i <= 8; i++) teeth += `L${f(hx - mw * .82 + i * mw * 1.64 / 8)} ${f(my + (i % 2 ? r * .17 : r * .04))}`;
          o += `<g fill="#ffffff"${fl(c, "gl2")}>${eyes}<path d="M${f(hx - mw)} ${f(my - r * .1)}Q${hx} ${f(my + r * .5)} ${f(hx + mw)} ${f(my - r * .1)}Q${hx} ${f(my + r * .14)} ${f(hx - mw)} ${f(my - r * .1)}Z"/>${an(c, `<animate attributeName="opacity" values="1;.75;1" dur="2s" repeatCount="indefinite"/>`)}</g><path d="${teeth}" stroke="#140b1f" stroke-width="1.2" fill="none" stroke-linejoin="round"/>`;
        }
        return o;
      },
      fx: c => ({back: p3Wisps(c)}) // volutes de fumée animées derrière le corps
    },
    { // P4 « Titan cosmique » : galaxie dans la peau, liseré cosmique, aura nébuleuse
      key: "p4", name: "Titan cosmique", sub: "galaxie dans la peau · aura nébuleuse",
      skin: c => `url(#${c.id}gal) #2a1f7a`, skin2: "#8f7bff", vein: "#bfe8ff", noFlush: true,
      defs: c => galaxyDefs(c.id, !c.full) + (c.full ? "" : blob(`${c.id}gb5b2bd6`, "#5b2bd6", 1)) + (c.full ? rimF(c.id + "rim", "#8fe9ff", 2.2, 2.6) + glowF(c.id + "gl", 2, 3) + `<filter id="${c.id}neb" filterUnits="userSpaceOnUse" ${REG}><feGaussianBlur stdDeviation="16"/></filter>` : ""),
      ground: c => {
        const g = c.g, ext = c.bust ? g.hw * .62 : Math.min(g.SW + 50, 140), cy = c.bust ? g.yS + 10 : 135, vy = c.bust ? g.hw * .55 : 110;
        const NEB = [[0, 0, 1, .9, "#5b2bd6", .75], [-.6, .25, .6, .55, "#ff3dbb", .55], [.6, -.2, .6, .5, "#2fd6ff", .5], [-.4, -.55, .5, .35, "#8a5cff", .6], [.45, .55, .55, .35, "#b14dff", .6]];
        let o = "";
        if (c.full) {
          o += `<g filter="url(#${c.id}neb)">`;
          NEB.forEach(([x, y, rx, ry, col, op]) => { o += `<ellipse cx="${f(g.hx + x * ext)}" cy="${f(cy + y * vy)}" rx="${f(ext * rx)}" ry="${f(vy * 1.1 * ry)}" fill="${col}" opacity="${op}"/>`; });
          o += `</g>`;
        } else NEB.forEach(([x, y, rx, ry, col, op]) => { o += `<ellipse cx="${f(g.hx + x * ext)}" cy="${f(cy + y * vy)}" rx="${f(ext * rx * 1.35)}" ry="${f(vy * 1.1 * ry * 1.35)}" fill="url(#${c.id}gb${col.slice(1)})" opacity="${op}"/>`; });
        const R = rng(31), nd = c.full ? 26 : 10;
        for (let i = 0; i < nd; i++) { const x = g.hx + (R() - .5) * ext * 2.1, y = cy + (R() - .5) * vy * 2.3, r = .6 + R() * 1.4; o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff" opacity="${(.4 + R() * .6).toFixed(2)}"/>`; }
        o += p4Twinkles(c, c.stack ? 0 : c.anim ? 6 : 3);
        return o;
      },
      overlay: c => {
        if (!c.full) return "";
        const R = rng(41);
        let tw = "";
        for (const L of c.limbs) { const t = .3 + R() * .4, x = L.a[0] + (L.b[0] - L.a[0]) * t, y = L.a[1] + (L.b[1] - L.a[1]) * t, du = (1.2 + R()).toFixed(2); tw += `<g>${star4(x + (R() - .5) * L.w * .4, y, 2 + L.w * .1, "#fff")}${an(c, `<animate attributeName="opacity" values="1;.25;1" dur="${du}s" repeatCount="indefinite"/>`)}</g>`; }
        return `<use href="#${c.id}bw" filter="url(#${c.id}rim)"/>${c.stack ? "" : tw}`;
      },
      fx: c => ({front: p4Twinkles(c, 7)}),
      top: c => {
        let o = "";
        for (const [x, y, r] of c.eyes) o += c.full ? `<g filter="url(#${c.id}gl)"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="#8fe9ff"/>${star4(x, y, r * 1.9, "#fff")}</g>` : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.1)}" fill="#8fe9ff" opacity=".35"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="#8fe9ff"/>${star4(x, y, r * 1.9, "#fff")}`;
        return o;
      }
    },
    { // P5 « Divinité » : auréole radieuse, ailes de plumes, lévitation, lumière céleste
      key: "p5", name: "Divinité", sub: "auréole · ailes · lévitation · lumière",
      lift: 14,
      defs: c => `<linearGradient id="${c.id}beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fffbe6" stop-opacity=".75"/><stop offset=".7" stop-color="#fff1b8" stop-opacity=".22"/><stop offset="1" stop-color="#ffe680" stop-opacity=".05"/></linearGradient>`
        + `<radialGradient id="${c.id}pool"><stop offset="0" stop-color="#fff6c9" stop-opacity=".9"/><stop offset=".5" stop-color="#ffd23f" stop-opacity=".35"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>`
        + `<radialGradient id="${c.id}nim"><stop offset="0" stop-color="#fffbe6" stop-opacity=".95"/><stop offset=".55" stop-color="#ffe27a" stop-opacity=".55"/><stop offset=".85" stop-color="#ffb703" stop-opacity=".15"/><stop offset="1" stop-color="#ffb703" stop-opacity="0"/></radialGradient>`
        + `<linearGradient id="${c.id}fth" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fdf8ec"/><stop offset=".8" stop-color="#ffe7a0"/><stop offset="1" stop-color="#f3b632"/></linearGradient>`
        + (c.full ? rimF(c.id + "rim", "#fff1a8", 2, 2.2) + matF(c.id + "mat", {blur: 2.4, scale: 3, sc: .55, se: 18, light: "#fff8dc", shadow: "#7a3f00", so: 0}) : ""),
      ground: c => {
        const g = c.g, gy = g.gy;
        let o = "";
        if (!c.sprite && !c.bust) {
          const top = c.vb[1];
          o += `<path d="M${f(g.hx - 30)} ${f(top)}H${f(g.hx + 30)}L${f(g.hx + 105)} ${f(gy + 10)}H${f(g.hx - 105)}Z" fill="url(#${c.id}beam)" opacity=".75"/><path d="M${f(g.hx - 12)} ${f(top)}H${f(g.hx + 12)}L${f(g.hx + 52)} ${f(gy + 10)}H${f(g.hx - 52)}Z" fill="url(#${c.id}beam)"/>`;
        }
        o += p5Motes(c, c.stack ? 0 : c.anim ? 12 : c.full ? 6 : 0);
        if (!c.bust) o += `<ellipse cx="${f(g.hx)}" cy="${f(gy)}" rx="${f(40 + 40 * g.m)}" ry="10" fill="url(#${c.id}pool)"/>`;
        return o;
      },
      behind: c => wings(c) + nimbus(c),
      fx: c => ({back: p5Rays(c), front: p5Motes(c, 12)}),
      overlay: c => c.full ? `<use href="#${c.id}bw" filter="url(#${c.id}mat)" opacity=".8"/><use href="#${c.id}bw" filter="url(#${c.id}rim)"/>` : "",
      top: c => {
        const g = c.g, R = rng(61), n = c.full ? 5 : 3;
        let o = "";
        for (let i = 0; i < n; i++) { const a = i * 1.9 + .6, x = g.hx + Math.cos(a) * Math.min(g.SW + 30, 128), y = (c.bust ? g.yS : 150) + Math.sin(a) * 60; o += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(R() * 360)})"><path d="M0 -7Q4 -2 0 7Q-4 -2 0 -7Z" fill="#fffdf4" stroke="${INK}" stroke-width="1.2"/><path d="M0 -5V6" stroke="#e8c25a" stroke-width=".8"/></g>`; }
        return o;
      }
    }
  ];

  function nimbus(c) {
    const g = c.g, hx = g.hx, hy = g.headY - 2, r = g.headR, R1 = nimR(c);
    const ringR = r + 9;
    return `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(R1 + 10)}" fill="url(#${c.id}nim)"/>`
      + (c.stack ? "" : p5Rays(c))
      + `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(ringR)}" fill="none" stroke="${INK}" stroke-width="6.5"/><circle cx="${f(hx)}" cy="${f(hy)}" r="${f(ringR)}" fill="none" stroke="#ffd23f" stroke-width="3.5"/>`
      + `<path d="M${f(hx - ringR * .7)} ${f(hy - ringR * .7)}A${f(ringR)} ${f(ringR)} 0 0 1 ${f(hx + ringR * .2)} ${f(hy - ringR * .98)}" fill="none" stroke="#fff6c9" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // ailes de plumes (aile droite, miroir pour la gauche) ; moins de plumes en petit format
  function wings(c) {
    const g = c.g, ax = g.hx + g.SW * .32, ay = g.yS + 2, right = c.vb[0] + c.vb[2];
    const span = Math.max(40, Math.min(g.SW + 70, right - 6 - ax));
    const s = span / 118;
    const Q = t => { const p0 = [0, 0], p1 = [26, -78], p2 = [82, -86]; return [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]; };
    const feather = (t, ang, L, w, fill) => {
      const p = Q(t), x = ax + p[0] * s, y = ay + p[1] * s, Ls = L * s, ws = w * s, tr = `translate(${f(x)} ${f(y)}) rotate(${f(ang)})`;
      return `<path transform="${tr}" d="M0 ${f(-ws * .5)}C${f(Ls * .4)} ${f(-ws * .8)} ${f(Ls * .85)} ${f(-ws * .6)} ${f(Ls)} 0C${f(Ls * .85)} ${f(ws * .6)} ${f(Ls * .4)} ${f(ws * .8)} 0 ${f(ws * .5)}Z" fill="${fill}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
        + (c.full ? `<path transform="${tr}" d="M${f(Ls * .1)} 0L${f(Ls * .78)} 0" stroke="#e3d6b8" stroke-width="1"/>` : "");
    };
    let w = "";
    const row = (n, t0, t1, a0, a1, L0, L1, wd, fill) => { for (let i = 0; i < n; i++) { const k = i / (n - 1); w += feather(t0 + (t1 - t0) * k, a0 + (a1 - a0) * k, L0 + (L1 - L0) * k, wd, fill); } };
    const big = `url(#${c.id}fth) #fdf8ec`;
    if (c.full) { row(8, 1, .42, 8, 78, 62, 56, 15, big); row(5, .38, .02, 82, 98, 52, 40, 15, big); row(8, 1, .05, 22, 96, 36, 26, 13, "#fffdf6"); row(9, 1, 0, 50, 112, 17, 15, 11, "#ffffff"); }
    else { row(6, 1, .42, 8, 78, 62, 56, 17, big); row(4, .38, .02, 82, 98, 52, 40, 17, big); row(6, 1, .05, 22, 96, 36, 26, 15, "#fffdf6"); }
    const bone = `M${f(ax)} ${f(ay)}Q${f(ax + 26 * s)} ${f(ay - 78 * s)} ${f(ax + 82 * s)} ${f(ay - 86 * s)}`;
    w += `<path d="${bone}" stroke="${INK}" stroke-width="${f(8 * s + 5)}" fill="none" stroke-linecap="round"/><path d="${bone}" stroke="#fffdf6" stroke-width="${f(8 * s)}" fill="none" stroke-linecap="round"/>`;
    const flap = an(c, `<animateTransform attributeName="transform" type="rotate" values="0 ${f(ax)} ${f(ay)};-6 ${f(ax)} ${f(ay)};0 ${f(ax)} ${f(ay)}" dur="2.6s" repeatCount="indefinite"/>`);
    return `<g><g>${w}${flap}</g></g><g transform="matrix(-1 0 0 1 ${f(2 * g.hx)} 0)"><g>${w}${flap}</g></g>`;
  }

  /* ---------- assemblage ---------- */
  const attr = (tag, n) => { const m = new RegExp(`\\s${n}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
  // membres peints en peau (segments droits) : relevés dans la chaîne SVG (repli si avatar.js ne donne pas d'ancres)
  function limbsOf(body, skin, g, A) {
    const out = [];
    const re = /<path\b[^>]*>/g;
    let m;
    while ((m = re.exec(body))) {
      const t = m[0], st = (attr(t, "stroke") || "").toLowerCase();
      if (st !== skin) continue;
      const mm = /^M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)$/.exec(attr(t, "d") || "");
      if (!mm) continue;
      const a = [+mm[1], +mm[2]], b = [+mm[3], +mm[4]], w = +attr(t, "stroke-width") || 8;
      out.push({a, b, w});
      if (out.length > 12) break;
    }
    if (!out.length && A) { // ancres : épaule → main, hanche → genou → pied
      const w = 8 + 16 * g.m;
      for (const s of ["L", "R"]) {
        const sh = pt(A["shoulder" + s], A.shoulderY), hd = pt(A["hand" + s]), kn = pt(A["knee" + s]), ft = pt(A["foot" + s]);
        if (sh && hd) out.push({a: sh, b: hd, w});
        if (kn && num(A.hipY)) out.push({a: [kn[0], A.hipY], b: kn, w: w * 1.2});
        if (kn && ft) out.push({a: kn, b: ft, w: w * .9});
      }
    }
    return out;
  }
  const cache = new Map();
  function render(look, xp, opts, P) {
    const F = FORMS[formOf(P)];
    const mode0 = opts.lg || "lite", mode = mode0 === "full" && reduced() ? "still" : mode0;
    // full = calques : SVG principal fixe (filtres, rastérisé une fois) + calques légers animés sans filtre (particules)
    const full = mode !== "lite", stack = mode === "full", anim = mode === "smil", sprite = mode === "sprite";
    const ck = JSON.stringify([look, xp, P, mode, opts.pose || "", opts.view || "", opts.mood || "", opts.m == null ? "" : opts.m, !!opts.fx]);
    const hit = cache.get(ck);
    const id = "gfL" + (++UID) + "_";
    if (hit) {
      if (opts.out) Object.assign(opts.out, hit.out);
      return hit.s.split(TOKEN).join(id);
    }
    const lk = Object.assign({}, AV.DEFAULT_LOOK, look || {});
    if (F.hairStyle) lk.hair = F.hairStyle;
    if (F.hair) lk.hairColor = F.hair;
    const out = opts.out || {};
    const o2 = Object.assign({}, opts, {out});
    delete o2.lg;
    const base = ORIG(lk, xp, o2);
    const mo = /^<svg[^>]*>/.exec(base);
    if (!mo || !base.endsWith("</svg>")) return base;
    const A = out.anchors || null;
    let eqSkin = null;
    try { const eq = AV.equipped ? AV.equipped(lk) : null; eqSkin = eq && SKIN_FX[eq.peau]; } catch (e) {}
    const skin = String((A && A.skin) || eqSkin || lk.skin).toLowerCase();
    const skin2 = shade(skin, .86).toLowerCase();
    const m = opts.m != null ? opts.m : AV.muscle(xp);
    const g = geom(m), pose = opts.pose || "idle", bust = opts.view === "bust";
    if (A) {
      if (num(A.headX)) g.hx = A.headX;
      if (num(A.headY)) g.headY = A.headY;
      if (num(A.headR)) g.headR = A.headR;
      if (num(A.shoulderY)) g.yS = A.shoulderY;
      if (num(A.groundY)) g.gy = A.groundY;
    }
    const openTag = mo[0];
    const vbm = /viewBox="([^"]+)"/.exec(openTag), vb = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : [-45, -12, 290, 280];
    let inner = base.slice(openTag.length, -6);
    const shm = /^<ellipse cx="100" cy="258" rx="([\d.]+)" ry="7" fill="rgba\(0,0,0,\.28\)"\/>/.exec(inner);
    let shadow = "";
    if (shm) { shadow = shm[0]; inner = inner.slice(shadow.length); }
    const body0 = inner;
    const eyes = [];
    if (pose !== "back") {
      const ey = g.headY - g.headR * .05, ex = g.headR * .38, er = m < .3 ? 4.2 : 3.4;
      if (pose !== "kiss") eyes.push([g.hx - ex, ey, er]);
      eyes.push([g.hx + ex, ey, er]);
    }
    const c = {id: TOKEN, g, pose, bust, eyes, look: lk, mode, full, anim, stack, sprite, lite: !full, vb,
      top: (anim || stack) && !bust ? -1e9 : vb[1] + 3, limbs: F.overlay && full && F.key === "p4" ? limbsOf(body0, skin, g, A) : []};
    // repeinte (peau, ombre de peau, cheveux, veines, joues)
    const map = {};
    if (F.skin2) map[skin2] = F.skin2;
    if (F.vein) map["#6d8fd0"] = F.vein;
    if (F.noFlush) map["#ff5d6c"] = "none";
    if (F.hairPaint) map[F.hair.toLowerCase()] = F.hairPaint(c);
    if (F.skin) map[skin] = F.skin(c);
    const body = Object.keys(map).length ? body0.replace(/\b(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (s0, a, v) => { const r = map[v.toLowerCase()]; return r ? `${a}="${r}"` : s0; }) : body0;
    // clone noir & blanc (peau visible = blanc) et silhouette (tout en blanc)
    let bwDefs = "";
    if (full) {
      const clean = body0.replace(/<defs>[\s\S]*?<\/defs>/g, "").replace(/<animate\b[^>]*attributeName="(?:fill|stroke)"[^>]*\/>/g, "").replace(/\s(?:id|filter)="[^"]*"/g, "");
      const bw = clean.replace(/\b(fill|stroke)="([^"]*)"/g, (s0, a, v) => v === "none" ? s0 : `${a}="${v.toLowerCase() === skin ? "#fff" : "#000"}"`);
      bwDefs = `<g id="${TOKEN}bw">${bw}</g><mask id="${TOKEN}vis" maskUnits="userSpaceOnUse" ${REG}><use href="#${TOKEN}bw"/></mask>`;
      if (F.sil) bwDefs += `<g id="${TOKEN}sil">${clean.replace(/\b(fill|stroke)="([^"]*)"/g, (s0, a, v) => v === "none" ? s0 : `${a}="#fff"`)}</g>`;
    }
    const lift = F.lift && !bust ? F.lift : 0;
    if (lift && anim && shadow) { const rx = (28 + 40 * m) * .6; shadow = `<ellipse cx="100" cy="258" rx="${f(rx)}" ry="5" fill="rgba(0,0,0,.22)"><animate attributeName="rx" values="${f(rx)};${f(rx * .83)};${f(rx)}" dur="3s" repeatCount="indefinite"/></ellipse>`; }
    const defs = `<defs>${F.defs ? F.defs(c) : ""}${bwDefs}</defs>`;
    const ground = F.ground ? F.ground(c) : "";
    const behind = F.behind ? F.behind(c) : "";
    const ov = F.overlay ? F.overlay(c) : "";
    const overlay = ov ? `<g mask="url(#${TOKEN}vis)">${ov}</g>` : "";
    const top = F.top ? F.top(c) : "";
    const bob = lift && anim ? `<animateTransform attributeName="transform" type="translate" values="0 ${-lift};0 ${-lift - 5};0 ${-lift}" dur="3s" repeatCount="indefinite"/>` : "";
    let s = `${openTag.replace(/^<svg/, `<svg data-pr="${P}"`).replace(/\bclass="av"/, stack ? `class="av lg-main"` : `class="av"`)}${shadow}${defs}${ground}<g${lift ? ` transform="translate(0 ${-lift})"` : ""}>${bob}${behind}${body}${overlay}${top}</g></svg>`;
    if (stack) {
      const fx = F.fx ? F.fx(Object.assign({}, c, {anim: true, full: false, stack: false, fx: true})) : {};
      const layer = (cls, inner) => inner ? `<svg class="av lg-fx ${cls}" viewBox="${vb.join(" ")}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g${lift ? ` transform="translate(0 ${-lift})"` : ""}>${inner}</g></svg>` : "";
      s = `<div class="lg-stack lg-p${formOf(P)}${lift ? " lift" : ""}">${layer("lg-back", fx.back)}${s}${layer("lg-front", fx.front)}</div>`;
    }
    if (lift && out.fx && num(out.fx.y)) out.fx = Object.assign({}, out.fx, {y: out.fx.y - lift});
    const keep = {}; if (out.fx !== undefined) keep.fx = out.fx; if (out.anchors) keep.anchors = out.anchors;
    cache.set(ck, {s, out: keep});
    if (cache.size > 160) cache.delete(cache.keys().next().value);
    return s.split(TOKEN).join(id);
  }
  function svg(look, xp, opts) {
    opts = opts || {};
    const P = prOf(look);
    if (!P || opts.lg === "off" || opts.view === "pet") {
      if (opts.lg) { opts = Object.assign({}, opts); delete opts.lg; }
      return ORIG(look, xp, opts);
    }
    try { return render(look, xp, opts, P); }
    catch (e) { console.warn("legend", e); const o = Object.assign({}, opts); delete o.lg; return ORIG(look, xp, o); }
  }
  svg.__legend = true;
  AV.svg = svg;

  /* ---------- rangs : emblèmes, noms, couleurs ---------- */
  const RANKS = [null,
    {name: "Bronze", stars: 1, ico: "★", col: "#d98a4e", c1: "#ffd2a8", c2: "#b4652e", c3: "#6e3712"},
    {name: "Argent", stars: 2, ico: "★★", col: "#cfd8e3", c1: "#ffffff", c2: "#b8c3d0", c3: "#5f6b7a"},
    {name: "Or", stars: 3, ico: "★★★", col: "#ffcf3a", c1: "#fff6c2", c2: "#f5b82a", c3: "#9a5f00"},
    {name: "Diamant", gem: true, ico: "💎", col: "#6fe7ff", c1: "#e8fdff", c2: "#5fd0f5", c3: "#1d5fa8"},
    {name: "Légende", crown: true, ico: "👑", col: "#ff6ad5", c1: "#ffe9a8", c2: "#ffcf3a", c3: "#a0005e"}];
  function badge(P, size) {
    const r = RANKS[formOf(P)];
    if (!r) return "";
    P = formOf(P);
    const id = "gfB" + (++UID);
    const shield = "M32 6L54 14V30C54 44 44 53 32 58C20 53 10 44 10 30V14Z";
    let s = `<svg viewBox="0 0 64 64" width="${size || 56}" height="${size || 56}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.c1}"/><stop offset=".45" stop-color="${r.c2}"/><stop offset=".6" stop-color="${r.c1}"/><stop offset="1" stop-color="${r.c3}"/></linearGradient><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffcf3a"/><stop offset="1" stop-color="#b87400"/></linearGradient><radialGradient id="${id}h"><stop offset="0" stop-color="${r.col}" stop-opacity=".9"/><stop offset="1" stop-color="${r.col}" stop-opacity="0"/></radialGradient></defs>`;
    const M = `url(#${id}m) ${r.c2}`, Gd = `url(#${id}g) #ffcf3a`;
    if (P >= 4) s += `<circle cx="32" cy="32" r="31" fill="url(#${id}h)"/>`;
    if (P === 5) for (const d of [-1, 1]) s += `<g${d < 0 ? ` transform="matrix(-1 0 0 1 64 0)"` : ""}><path d="M48 24Q60 16 63 8Q62 22 58 26Q62 26 63 24Q60 34 52 36Q57 37 59 36Q54 44 46 42Z" fill="#fffdf4" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M52 24Q57 21 60 15M51 31Q55 30 58 27" stroke="#e8c25a" stroke-width="1.2" fill="none"/></g>`;
    if (P === 3 || P === 4) for (const d of [-1, 1]) for (let i = 0; i < 4; i++) { const y = 46 - i * 8, x = 32 + d * (19 + i * 1.5); s += `<ellipse cx="${x}" cy="${y}" rx="5.2" ry="2.6" fill="${i % 2 ? "#5cb85c" : "#3f9b3f"}" stroke="${INK}" stroke-width="1.3" transform="rotate(${d * (-40 + i * 12)} ${x} ${y})"/>`; }
    if (r.gem) {
      s += `<path d="M32 6L56 24L32 58L8 24Z" fill="${M}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 24H56M20 24L32 6L44 24L32 58L20 24Z" fill="none" stroke="${r.c3}" stroke-width="1.4" stroke-linejoin="round" opacity=".8"/><path d="M14 22L21 14L26 22Z" fill="#fff" opacity=".85"/><path d="M32 30L37 24L32 50Z" fill="#fff" opacity=".35"/>` + star4(50, 10, 5, "#fff") + star4(13, 46, 3.5, "#fff");
    } else if (r.crown) {
      s += `<path d="${shield}" fill="#4a1060" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M32 10L50 16.5V30C50 41.5 42 49 32 53.5C22 49 14 41.5 14 30V16.5Z" fill="none" stroke="${Gd}" stroke-width="2.2"/>`
        + `<path d="M17 40L14 21L23.5 29L32 15L40.5 29L50 21L47 40Z" fill="${Gd}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><rect x="17" y="38" width="30" height="6" rx="2" fill="${Gd}" stroke="${INK}" stroke-width="2.4"/>`
        + `<circle cx="32" cy="31" r="3.3" fill="#ff2e88" stroke="${INK}" stroke-width="1.4"/><circle cx="23.5" cy="34" r="2.2" fill="#3ef2ff" stroke="${INK}" stroke-width="1.2"/><circle cx="40.5" cy="34" r="2.2" fill="#3ef2ff" stroke="${INK}" stroke-width="1.2"/>`
        + `<circle cx="14" cy="21" r="2.4" fill="#fff6c2" stroke="${INK}" stroke-width="1.2"/><circle cx="32" cy="15" r="2.6" fill="#fff6c2" stroke="${INK}" stroke-width="1.2"/><circle cx="50" cy="21" r="2.4" fill="#fff6c2" stroke="${INK}" stroke-width="1.2"/>` + star4(52, 8, 4.5, "#fff");
    } else {
      s += `<path d="${shield}" fill="${M}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M32 11L49.5 17.3V30C49.5 41 41.5 48.5 32 52.6C22.5 48.5 14.5 41 14.5 30V17.3Z" fill="none" stroke="${r.c3}" stroke-width="1.6" opacity=".7"/><path d="M14 17L32 10.5V30L14 34Z" fill="#fff" opacity=".22"/>`;
      const pos = r.stars === 1 ? [[32, 31, 12]] : r.stars === 2 ? [[24, 31, 8.5], [40, 31, 8.5]] : [[32, 25, 8], [22.5, 37, 7], [41.5, 37, 7]];
      for (const [x, y, rr] of pos) { let d = ""; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? rr * .45 : rr; d += (i ? "L" : "M") + f(x + Math.cos(a) * q) + " " + f(y + Math.sin(a) * q); } s += `<path d="${d}Z" fill="#fffdf2" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`; }
    }
    return s + `</svg>`;
  }
  const rank = P => RANKS[formOf(P)] || null;
  const color = P => { const r = rank(P); return r ? r.col : null; };
  // « ★★ Argent », « 👑 Légende », « 👑 Légende ×2 » (prestige 6)…
  const rankLabel = P => { const r = rank(P); return !r ? "" : `${r.ico} ${r.name}${P > MAXF ? ` ×${P - MAXF + 1}` : ""}`; };
  const formName = P => P > 0 ? FORMS[formOf(P)].name : "";
  const escH = t => String(t == null ? "" : t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
  const badgeHtml = (P, cls) => P > 0 ? `<span class="lg-b${cls ? " " + cls : ""}" title="Prestige ${P} · ${escH(rankLabel(P))}">${badge(P, 64)}</span>` : "";
  // nom (déjà échappé) précédé de l'emblème et coloré à la couleur du rang
  const nameHtml = (nameEsc, P, o) => P > 0 ? `${badgeHtml(P)}<span class="lg-nm${o && o.plain ? " plain" : ""}" style="--lgc:${color(P)}">${nameEsc}</span>` : nameEsc;
  // emblèmes rastérisés pour les canvas (étiquettes 3D, photo souvenir)
  const imgs = [];
  function badgeImg(P) {
    const k = formOf(P);
    if (!k) return null;
    let im = imgs[k];
    if (!im) { im = imgs[k] = new Image(); im.decoding = "async"; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(badge(k, 128).replace("<svg ", `<svg xmlns:xlink="http://www.w3.org/1999/xlink" `)); }
    return im.complete && im.naturalWidth ? im : null;
  }
  for (let k = 1; k <= MAXF; k++) badgeImg(k);
  const badgeReady = P => !!badgeImg(P);

  /* ---------- styles : étiquettes, entrée en scène, renaissance ---------- */
  const CSS = `
.lg-stack{position:relative;isolation:isolate}
.lg-stack>svg.lg-main{position:relative;z-index:1;will-change:transform}
.lg-stack>svg.lg-fx{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;will-change:transform}
.lg-stack>svg.lg-back{z-index:0}
.lg-stack>svg.lg-front{z-index:2}
.lg-stack.lift{animation:lgBob 3s ease-in-out infinite}
@keyframes lgBob{50%{transform:translateY(-2%)}}
@media (prefers-reduced-motion:reduce){.lg-stack.lift{animation:none}}
.lg-b{display:inline-block;width:1.3em;height:1.3em;vertical-align:-.3em;margin-right:.18em;flex:none;filter:drop-shadow(0 1px 0 rgba(0,0,0,.55))}
.lg-b svg{width:100%;height:100%;display:block}
.lg-nm{color:var(--lgc,#fff);text-shadow:0 0 8px var(--lgc,transparent),0 1px 0 #000a}
.lg-nm.plain{color:inherit;text-shadow:none}
.lg-rank{font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lgc,#ffcc33);white-space:nowrap}
.lg-entr{position:absolute;pointer-events:none;z-index:2;transform:translate(-50%,-100%);width:var(--w);height:calc(var(--w) * 1.25)}
.lg-entr i{position:absolute;display:block}
.lg-entr .fl{left:50%;bottom:0;width:150%;aspect-ratio:1;transform:translate(-50%,40%) scale(.2);border-radius:50%;opacity:0;animation:lgFlash 1.1s ease-out forwards}
.lg-e1 .fl{background:radial-gradient(circle,#fff6c9 0,#ffb21a 25%,#ff4b1f55 50%,transparent 70%)}
.lg-e1 .tg{left:calc(50% + var(--x));bottom:0;width:18%;height:70%;border-radius:50% 50% 50% 50%/70% 70% 30% 30%;background:linear-gradient(to top,#ff4b1f,#ff9f1c 55%,#ffe14d);transform-origin:50% 100%;transform:scaleY(0);opacity:.95;animation:lgTongue 1.2s var(--d) cubic-bezier(.2,1.4,.4,1) forwards;filter:drop-shadow(0 0 6px #ff7a1a)}
.lg-e1 .sp,.lg-e2 .sp,.lg-e4 .sp{left:50%;top:60%;width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);animation:lgSpark 1.4s var(--d) ease-out forwards;opacity:0}
.lg-e2 .fl{background:radial-gradient(circle,#fff 0,#ffe680 22%,#ffb70388 45%,transparent 70%)}
.lg-e2 .sp{width:12px;height:12px;border-radius:0;background:none;box-shadow:none}
.lg-e2 .sp::before{content:"✦";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:18px;color:#ffe14d;text-shadow:0 0 6px #fff6c9}
.lg-e2 .ring{left:50%;bottom:0;width:120%;aspect-ratio:3;border:4px solid #ffd23f;border-radius:50%;transform:translate(-50%,50%) scale(.1);animation:lgRing 1s ease-out forwards}
.lg-e3 .fl{background:radial-gradient(circle,#e9c6ff 0,#a64dff 25%,#5b17b855 50%,transparent 70%);animation-delay:.35s}
.lg-e3 .sm{left:calc(50% + var(--x));bottom:5%;width:55%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#05020a 0,#1a0a2aee 45%,transparent 72%);transform:translate(-50%,0) scale(.3);opacity:0;animation:lgSmoke 1.8s var(--d) ease-out forwards}
.lg-e3 .ring{left:50%;bottom:0;width:130%;aspect-ratio:3;border:3px solid #c77dff;border-radius:50%;box-shadow:0 0 14px #a64dff;transform:translate(-50%,50%) scale(.1);animation:lgRing 1s .4s ease-out both}
.lg-e4 .neb{left:50%;top:45%;width:220%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 45%,#ff3dbb88,transparent 40%),radial-gradient(circle at 62% 55%,#2fd6ff77,transparent 42%),radial-gradient(circle,#5b2bd6aa,transparent 65%);transform:translate(-50%,-50%) scale(.2);opacity:0;animation:lgNeb 1.9s ease-out forwards}
.lg-e4 .rays{left:50%;top:45%;width:240%;aspect-ratio:1;border-radius:50%;background:repeating-conic-gradient(from 0deg,#fff9 0 3deg,transparent 3deg 22deg);-webkit-mask:radial-gradient(circle,#000 0,#000 25%,transparent 65%);mask:radial-gradient(circle,#000 0,#000 25%,transparent 65%);transform:translate(-50%,-50%) scale(.2) rotate(0);opacity:0;animation:lgRays 1.6s ease-out forwards}
.lg-e5 .beam{left:50%;bottom:0;width:62%;height:var(--bh,600px);background:linear-gradient(to right,#ffe68000,#fff6d0b8 24%,#fffdf0 50%,#fff6d0b8 76%,#ffe68000);box-shadow:0 0 30px 6px #ffe68066;-webkit-mask:linear-gradient(to bottom,transparent,#000 30%,#000 92%,transparent);mask:linear-gradient(to bottom,transparent,#000 30%,#000 92%,transparent);transform:translateX(-50%) scaleX(.1);transform-origin:50% 100%;opacity:0;animation:lgBeam 2.2s ease-out forwards}
.lg-e5 .pool{left:50%;bottom:0;width:170%;aspect-ratio:4;border-radius:50%;background:radial-gradient(closest-side,#fff6c9,#ffd23f88 55%,transparent);transform:translate(-50%,50%) scale(.2);opacity:0;animation:lgFlash 2.2s .2s ease-out forwards}
@keyframes lgFlash{0%{opacity:0;transform:translate(-50%,40%) scale(.2)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,40%) scale(1.2)}}
@keyframes lgTongue{0%{transform:translateX(-50%) scaleY(0)}35%{transform:translateX(-50%) scaleY(1.15)}100%{transform:translateX(-50%) scaleY(0);opacity:0}}
@keyframes lgSpark{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.4)}}
@keyframes lgRing{0%{opacity:1;transform:translate(-50%,50%) scale(.1)}100%{opacity:0;transform:translate(-50%,50%) scale(1.3)}}
@keyframes lgSmoke{0%{opacity:0;transform:translate(-50%,0) scale(.3)}30%{opacity:.95}100%{opacity:0;transform:translate(-50%,-90%) scale(1.5)}}
@keyframes lgNeb{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}35%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}
@keyframes lgRays{0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.1) rotate(40deg)}}
@keyframes lgBeam{0%{opacity:0;transform:translateX(-50%) scaleX(.1)}20%{opacity:1;transform:translateX(-50%) scaleX(1)}70%{opacity:.85}100%{opacity:0;transform:translateX(-50%) scaleX(.5)}}
@media (prefers-reduced-motion:reduce){.lg-entr i{animation-duration:.01s!important;animation-delay:0s!important}.lg-entr .fl,.lg-entr .pool{animation:lgFade 1.4s ease-out forwards!important}@keyframes lgFade{0%{opacity:.8}100%{opacity:0}}}
.lg-cele{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;overflow:hidden;background:#0d0814f2;background:radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--lgc2,#ffcc33) 38%,#0d0814f2),#0d0814f5 62%);animation:lgCeleIn .35s ease-out;cursor:pointer}
.lg-cele .in{display:grid;justify-items:center;gap:6px;text-align:center;padding:16px;max-width:min(92vw,520px)}
.lg-cele .k{font:800 1rem/1 "Barlow Condensed",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#fff;opacity:.85}
.lg-cele h2{margin:0;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:clamp(2.2rem,10vw,4rem);line-height:1;text-transform:uppercase;color:#ffcc33;text-shadow:3px 3px 0 #e63946,6px 6px 0 #1d1420;animation:lgPop .7s .2s cubic-bezier(.2,1.6,.4,1) both}
.lg-cele .av-w{width:min(70vw,300px);animation:lgRise 1.1s .1s cubic-bezier(.2,1.4,.4,1) both;position:relative}
.lg-cele .av-w::before{content:"";position:absolute;left:50%;top:50%;width:170%;aspect-ratio:1;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,#fff3 0 4deg,transparent 4deg 18deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 20%,transparent 66%);mask:radial-gradient(circle,#000 20%,transparent 66%);animation:lgSpin 14s linear infinite;z-index:-1}
.lg-cele .rk{display:flex;align-items:center;gap:10px;font:800 1.35rem/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--lgc2,#ffcc33);animation:lgPop .6s .6s cubic-bezier(.2,1.6,.4,1) both}
.lg-cele .rk .lg-b{width:64px;height:64px;margin:0}
.lg-cele small{color:#e9dcff;font-weight:700;font-size:1rem}
.lg-cele .cf{position:fixed;top:-20px;width:9px;height:14px;background:var(--c);left:var(--x);animation:lgFall var(--t) var(--d) linear forwards;border-radius:2px}
@keyframes lgCeleIn{from{opacity:0}to{opacity:1}}
@keyframes lgPop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@keyframes lgRise{from{opacity:0;transform:translateY(40px) scale(.4)}to{opacity:1;transform:none}}
@keyframes lgSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes lgFall{to{transform:translateY(110vh) rotate(720deg)}}
@media (prefers-reduced-motion:reduce){.lg-cele *,.lg-cele .av-w::before{animation:none!important}.lg-cele .cf{display:none}}
.lg-gal{position:fixed;inset:0;z-index:9001;overflow:auto;background:#1a1027;color:#fff;padding:14px 12px 30px;font-family:"Barlow Condensed",sans-serif}
.lg-gal h2{font-family:"Anton",Impact,sans-serif;font-weight:400;text-transform:uppercase;color:#ffcc33;margin:4px 0 10px}
.lg-gal .row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.lg-gal .cell{background:#ffffff10;border:2px solid #ffffff22;border-radius:12px;padding:6px;text-align:center}
.lg-gal .cell .av{width:100%;height:auto}
.lg-gal .x{position:sticky;top:0;float:right;font-size:1.4rem;background:#e63946;color:#fff;border:2px solid #1d1420;border-radius:10px;padding:2px 12px;cursor:pointer}
`;
  try { const st = document.createElement("style"); st.id = "gf-legend-css"; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  /* ---------- entrée en scène d'un joueur légendaire ---------- */
  // container : élément positionné ; x, y = pieds (px dans container) ; w = largeur du perso (px) ; skyY = haut du ciel (px, P5)
  function entrance(container, x, y, w, P, skyY) {
    if (!container || !(P > 0)) return null;
    const k = formOf(P), el = document.createElement("div");
    el.className = "lg-entr lg-e" + k;
    w = Math.max(60, Math.min(260, w || 90));
    el.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;--w:${Math.round(w)}px`;
    let h = `<i class="fl"></i>`;
    const R = rng(7 + k);
    if (k === 1) { for (let i = 0; i < 7; i++) h += `<i class="tg" style="--x:${Math.round((i - 3) * w * .13 - w * .09)}px;--d:${(i % 3) * .08}s"></i>`; for (let i = 0; i < 12; i++) h += `<i class="sp" style="--c:${i % 2 ? "#ffd23f" : "#ff7a1a"};--dx:${Math.round((R() - .5) * w * 1.4)}px;--dy:${-Math.round(w * (.5 + R()))}px;--d:${(R() * .4).toFixed(2)}s"></i>`; }
    if (k === 2) { h += `<i class="ring"></i>`; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; h += `<i class="sp" style="--dx:${Math.round(Math.cos(a) * w * .9)}px;--dy:${Math.round(Math.sin(a) * w * .9 - w * .3)}px;--d:${(R() * .25).toFixed(2)}s"></i>`; } }
    if (k === 3) { for (let i = 0; i < 6; i++) h += `<i class="sm" style="--x:${Math.round((i - 2.5) * w * .16)}px;--d:${(i % 3) * .1}s"></i>`; h += `<i class="ring"></i>`; }
    if (k === 4) { h += `<i class="neb"></i><i class="rays"></i>`; for (let i = 0; i < 10; i++) { const a = R() * 6.28; h += `<i class="sp" style="--c:${i % 3 ? "#ffffff" : "#8fe9ff"};--dx:${Math.round(Math.cos(a) * w)}px;--dy:${Math.round(Math.sin(a) * w)}px;--d:${(R() * .4).toFixed(2)}s"></i>`; } }
    if (k === 5) { el.style.setProperty("--bh", Math.max(200, Math.round(y - (skyY || 0) + 20)) + "px"); h += `<i class="beam"></i><i class="pool"></i>`; }
    el.innerHTML = h;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    return el;
  }
  // annonce vocale « Le légendaire MEHDI est dans la salle ! » (au plus une fois par joueur toutes les 5 min)
  const lastAnn = new Map();
  function announceArrival(key, name, P) {
    const now = Date.now(), t = lastAnn.get(key) || 0;
    if (now - t < 5 * 60 * 1000) return false;
    lastAnn.set(key, now);
    const AN = G.announcer;
    if (!AN || !AN.say) return false;
    const nm = AN.stretch ? AN.stretch(name) : name;
    return AN.say([{t: P >= 5 ? "Mesdames et messieurs…" : "Attention…", rate: .9, pitch: .6}, {t: `Le légendaire… ${nm}… est dans la salle !`, rate: .8, pitch: 1.25}], {low: false});
  }

  /* ---------- galerie de contrôle (debug) ---------- */
  function gallery(look) {
    const old = document.querySelector(".lg-gal"); if (old) old.remove();
    const LOOK = Object.assign({skin: "#eebe98", hair: "court", hairColor: "#25201f", top: "nu", topColor: "#e63946", shorts: "#e63946", acc: "aucun"}, look || {});
    const el = document.createElement("div");
    el.className = "lg-gal";
    const sets = [["XP 0 · idle · full", 0, {pose: "idle", lg: "full"}], ["XP 800 · most · full", 800, {pose: "most", lg: "full"}], ["XP 2000 · flex · full", 2000, {pose: "flex", lg: "full"}],
      ["XP 2000 · lite (podium)", 2000, {pose: "flex"}], ["XP 1300 · buste lite", 1300, {view: "bust"}], ["XP 1000 · sprite 3D", 1000, {lg: "sprite"}]];
    let h = `<button class="x" type="button">✕</button><h2>Formes légendaires</h2>`;
    for (const [t, xp, o] of sets) {
      h += `<h3>${t}</h3><div class="row">`;
      for (let P = 1; P <= MAXF; P++) h += `<div class="cell">${svg(Object.assign({}, LOOK, {pr: P}), xp, o)}<div>${badgeHtml(P)}<b class="lg-nm" style="--lgc:${color(P)}">P${P} · ${FORMS[P].name}</b></div><small class="lg-rank" style="--lgc:${color(P)}">${rankLabel(P)}</small></div>`;
      h += `</div>`;
    }
    h += `<div class="row">${[6, 7].map(P => `<div class="cell">${badgeHtml(P)}<small class="lg-rank" style="--lgc:${color(P)}">Prestige ${P} · ${rankLabel(P)}</small></div>`).join("")}</div>`;
    el.innerHTML = h;
    el.querySelector(".x").onclick = () => el.remove();
    document.body.appendChild(el);
    return el;
  }

  G.legend = {svg, badge, badgeHtml, nameHtml, badgeImg, badgeReady, rankLabel, formName, color, rank, level: prOf, form: formOf, entrance, announceArrival, gallery,
    FORMS, RANKS, MAX_FORM: MAXF, orig: ORIG, _cache: cache};
})();
