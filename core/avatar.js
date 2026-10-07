/* Gonflette Party : personnage qui prend du muscle avec l'expérience.
   GONFLETTE.avatar.svg(look, xp, {pose:'idle'|'flex', m}) renvoie une chaîne SVG. */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  const SKINS = ["#f6d2b8", "#eebe98", "#d9a27a", "#b97b54", "#8d5a3b", "#5e3a26"];
  const HAIR_COLORS = ["#25201f", "#6b4226", "#c8562b", "#e3bb4f", "#dcd8d0", "#d6337a", "#2f7fd6"];
  const HAIR_STYLES = [["court", "Court"], ["crete", "Crête"], ["queue", "Queue"], ["afro", "Afro"], ["chignon", "Chignon"], ["chauve", "Chauve"]];
  const CLOTH = ["#e63946", "#f4a261", "#ffd166", "#2a9d8f", "#264653", "#8338ec", "#ff006e", "#3a86ff", "#111111", "#f1faee"];
  const TOPS = [["nu", "Torse nu"], ["debardeur", "Débardeur"], ["singlet", "Justaucorps"]];
  const ACCS = [["aucun", "Rien"], ["bandeau", "Bandeau"], ["casquette", "Casquette"], ["lunettes", "Lunettes"], ["moustache", "Moustache"], ["barbe", "Barbe"], ["ceinture", "Ceinture"]];

  // Paliers d'expérience : victoire +100, 2e place +40, participation +25.
  const TIERS = [[0, "Crevette"], [100, "Brindille"], [200, "Nouille molle"], [350, "Échalas"], [500, "Sportif du dimanche"],
    [700, "Costaud"], [900, "Balèze"], [1150, "Armoire à glace"], [1500, "Montagne"], [2000, "Titan démesuré"]];
  function tier(xp) {
    let i = 0;
    for (let k = 0; k < TIERS.length; k++) if (xp >= TIERS[k][0]) i = k;
    return {index: i, name: TIERS[i][1], from: TIERS[i][0], to: TIERS[i + 1] ? TIERS[i + 1][0] : null, count: TIERS.length};
  }
  // 0 = brindille, 1 = très musclé (1500 XP), jusqu'à 1.35 = démesuré (2000 XP).
  function muscle(xp) {
    xp = Math.max(0, xp || 0);
    return xp <= 1500 ? xp / 1500 : Math.min(1.35, 1 + (xp - 1500) / 500 * 0.35);
  }
  const DEFAULT_LOOK = {skin: SKINS[1], hair: "court", hairColor: HAIR_COLORS[0], top: "debardeur", topColor: CLOTH[0], shorts: CLOTH[4], acc: "aucun"};

  const f = n => Math.round(n * 10) / 10;
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
  }

  function svg(look, xp, opts = {}) {
    look = Object.assign({}, DEFAULT_LOOK, look || {});
    const m = opts.m != null ? opts.m : muscle(xp);
    const mc = Math.min(m, 1);
    const pose = opts.pose || "idle";
    const ink = "#1d1420", skin = look.skin, skin2 = shade(skin, .86);
    const cx = 100;

    // proportions
    const headR = 25 - 6 * mc - 2 * Math.max(0, m - 1);
    const yS = 100 + 2 * m;                   // ligne des épaules
    const headY = 50 + 12 * m;                // la tête s'enfonce dans les trapèzes
    const neckH = 4 + 13 * m;                 // demi-largeur du cou
    const SW = 19 + 50 * m;                   // demi-largeur des épaules
    const W = 13 + 12 * m;                    // demi-taille
    const H = 15 + 13 * m;                    // demi-hanches
    const UA = 7 + 28 * m, FA = 6 + 19 * m;   // épaisseur bras / avant-bras
    const TW = 10 + 25 * m, CW = 7 + 15 * m;  // cuisse / mollet
    const trapTop = yS - 10 - 22 * m;

    const hw = Math.max(SW + UA + 10, 62);
    const vb = opts.view === "bust" ? `${f(100 - hw)} ${f(headY - headR - 18)} ${f(hw * 2)} ${f(hw * 2)}` : "-45 -12 290 280";
    let s = `<svg class="av" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    // ombre au sol
    s += `<ellipse cx="100" cy="258" rx="${f(28 + 40 * m)}" ry="7" fill="rgba(0,0,0,.28)"/>`;

    // ---- coiffure arrière (afro, queue)
    if (look.hair === "afro") s += `<circle cx="100" cy="${f(headY - 4)}" r="${f(headR + 13)}" fill="${look.hairColor}" stroke="${ink}" stroke-width="4"/>`;
    if (look.hair === "queue") s += `<path d="M${f(cx + headR * .6)} ${f(headY - headR * .4)} q 26 6 20 46 q -10 -6 -24 -28 z" fill="${look.hairColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;

    // ---- jambes
    const legs = [];
    for (const d of [-1, 1]) {
      const hip = [cx + d * (H - 9 - 3 * m), 172], knee = [cx + d * (H - 7 + 2 * m), 212], ank = [cx + d * (H - 9), 245];
      legs.push({d, hip, knee, ank});
    }
    for (const L of legs) s += `<path d="M${f(L.hip[0])} ${L.hip[1]}L${f(L.knee[0])} ${L.knee[1]}" stroke="${ink}" stroke-width="${f(TW + 6)}" stroke-linecap="round"/><path d="M${f(L.knee[0])} ${L.knee[1]}L${f(L.ank[0])} ${L.ank[1]}" stroke="${ink}" stroke-width="${f(CW + 6)}" stroke-linecap="round"/>`;
    for (const L of legs) {
      s += `<path d="M${f(L.hip[0])} ${L.hip[1]}L${f(L.knee[0])} ${L.knee[1]}" stroke="${skin}" stroke-width="${f(TW)}" stroke-linecap="round"/><path d="M${f(L.knee[0])} ${L.knee[1]}L${f(L.ank[0])} ${L.ank[1]}" stroke="${skin}" stroke-width="${f(CW)}" stroke-linecap="round"/>`;
      if (m > .35) s += `<path d="M${f(L.knee[0] + L.d * CW * .2)} ${L.knee[1] + 8}q${f(L.d * CW * .5)} 10 0 26" stroke="${skin2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      if (m < .35) s += `<circle cx="${f(L.knee[0])}" cy="${L.knee[1]}" r="${f(7.5 - 6 * m)}" fill="${skin}" stroke="${ink}" stroke-width="3"/>`;
      s += `<ellipse cx="${f(L.ank[0] + L.d * 5)}" cy="251" rx="${f(12 + 4 * m)}" ry="7" fill="#f4f1ea" stroke="${ink}" stroke-width="3.5"/><path d="M${f(L.ank[0] + L.d * 5 - 10)} 253h${f(20 + 6 * m)}" stroke="#d6337a" stroke-width="2.5"/>`;
    }
    // short
    const shortY = 194 + 4 * m;
    s += `<path d="M${f(cx - H - 3)} 165 L${f(cx - H - TW * .45 - 3)} ${f(shortY)} L${f(cx - 3)} ${f(shortY)} L${cx} ${f(shortY - 12)} L${f(cx + 3)} ${f(shortY)} L${f(cx + H + TW * .45 + 3)} ${f(shortY)} L${f(cx + H + 3)} 165 Z" fill="${look.shorts}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;

    // ---- torse
    const nkTop = yS - 12 - 8 * m;
    const tc = [neckH + (SW - neckH) * .45, trapTop];
    const torso = (k) => {
      // k: 1 = peau complète, sinon tissu un peu en retrait
      const pts = side => {
        const d = side;
        return [
          `${f(cx + d * neckH)} ${f(nkTop)}`,
          `Q${f(cx + d * tc[0])} ${f(tc[1])} ${f(cx + d * SW)} ${f(yS + 4)}`,
          `Q${f(cx + d * (SW + 7 + 5 * m))} ${f(yS + 19)} ${f(cx + d * (SW - 3))} ${f(yS + 34)}`,
          `Q${f(cx + d * (W + 6 + 18 * m))} ${f(yS + 50)} ${f(cx + d * W)} 152`,
          `L${f(cx + d * H)} 172`
        ];
      };
      const L = pts(-1), R = pts(1);
      return `M${L[0]} ${L[1]} ${L[2]} ${L[3]} ${L[4]} L${f(cx + H)} 172 L${f(cx + W)} 152 Q${f(cx + (W + 6 + 18 * m))} ${f(yS + 50)} ${f(cx + SW - 3)} ${f(yS + 34)} Q${f(cx + SW + 7 + 5 * m)} ${f(yS + 19)} ${f(cx + SW)} ${f(yS + 4)} Q${f(cx + tc[0])} ${f(tc[1])} ${f(cx + neckH)} ${f(nkTop)} Z`;
    };
    // cou
    s += `<rect x="${f(cx - neckH)}" y="${f(headY + headR * .4)}" width="${f(neckH * 2)}" height="${f(yS - headY)}" fill="${skin}" stroke="${ink}" stroke-width="4"/>`;
    s += `<path d="${torso()}" fill="${skin}" stroke="${ink}" stroke-width="4.5" stroke-linejoin="round"/>`;

    // détails musculaires sur la peau
    const det = [];
    if (m < .3) { // côtes
      const o = (.3 - m) / .3;
      for (let i = 0; i < 4; i++) det.push(`<path d="M${f(cx - W - 2)} ${yS + 22 + i * 9}q${f(W * .6)} 5 ${f(W - 3)} 2M${f(cx + W + 2)} ${yS + 22 + i * 9}q${f(-W * .6)} 5 ${f(-W + 3)} 2" stroke="${ink}" stroke-width="2" fill="none" opacity="${f(o * .7)}"/>`);
    }
    if (m > .25) { // pectoraux
      const o = Math.min(1, (m - .25) / .3);
      det.push(`<path d="M${f(cx - SW * .62)} ${f(yS + 22)}Q${f(cx - SW * .35)} ${f(yS + 40 + 8 * m)} ${cx} ${f(yS + 30 + 4 * m)}Q${f(cx + SW * .35)} ${f(yS + 40 + 8 * m)} ${f(cx + SW * .62)} ${f(yS + 22)}M${cx} ${f(yS + 4)}v${f(26 + 4 * m)}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round" opacity="${f(o)}"/>`);
    }
    if (m > .45) { // abdos
      const o = Math.min(1, (m - .45) / .3), top = yS + 44 + 8 * m, bw = W * .55;
      let a = `<g stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="${f(o)}"><path d="M${cx} ${f(top)}V164"/>`;
      for (let i = 0; i < 3; i++) a += `<path d="M${f(cx - bw)} ${f(top + 4 + i * 11)}q${f(bw)} 4 ${f(bw * 2)} 0"/>`;
      det.push(a + `</g>`);
    }
    if (look.top === "nu") s += det.join("");

    // vêtement du haut
    if (look.top !== "nu") {
      const c = look.topColor, strap = look.top === "singlet" ? .32 : .5;
      const tp = `M${f(cx - neckH - 4)} ${f(nkTop + 6)} L${f(cx - SW * strap - 6)} ${f(yS - 2 - 6 * m)} Q${f(cx - SW * strap)} ${f(yS + 22)} ${f(cx - SW + 7)} ${f(yS + 36)} Q${f(cx - (W + 4 + 16 * m))} ${f(yS + 50)} ${f(cx - W - 1)} 152 L${f(cx - H - 2)} 174 L${f(cx + H + 2)} 174 L${f(cx + W + 1)} 152 Q${f(cx + W + 4 + 16 * m)} ${f(yS + 50)} ${f(cx + SW - 7)} ${f(yS + 36)} Q${f(cx + SW * strap)} ${f(yS + 22)} ${f(cx + SW * strap + 6)} ${f(yS - 2 - 6 * m)} L${f(cx + neckH + 4)} ${f(nkTop + 6)} Q${cx} ${f(yS + 20)} ${f(cx - neckH - 4)} ${f(nkTop + 6)} Z`;
      s += `<path d="${tp}" fill="${c}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<g opacity=".55">${det.join("")}</g>`;
      if (look.top === "singlet") s += `<path d="M${f(cx - W - 1)} 160 L${f(cx + W + 1)} 160" stroke="#fff" stroke-width="4" opacity=".7"/>`;
      if (m > 1.05) s += `<path d="M${f(cx - SW * .3)} ${f(yS + 18)}l6 6-4 5 7 5M${f(cx + SW * .25)} ${f(yS + 40)}l-5 5 5 5" stroke="${ink}" stroke-width="2.4" fill="none"/>`; // tissu qui craque
    }
    if (look.acc === "ceinture") s += `<rect x="${f(cx - W - 5)}" y="148" width="${f(W * 2 + 10)}" height="17" rx="4" fill="#5a3418" stroke="${ink}" stroke-width="3.5"/><rect x="${cx - 7}" y="150" width="14" height="13" rx="2" fill="#e3bb4f" stroke="${ink}" stroke-width="2.5"/>`;

    // ---- bras
    const arms = [];
    for (const d of [-1, 1]) {
      const J = [cx + d * (SW - 5), yS + 12];
      let E, Hd;
      if (pose === "flex") { E = [J[0] + d * (24 + 16 * m), yS + 6]; Hd = [J[0] + d * (14 + 12 * m), yS - 34 - 6 * m]; }
      else if (pose === "wave" && d === 1) { E = [J[0] + 26 + 8 * m, yS + 4]; Hd = [J[0] + 34 + 10 * m, yS - 38]; }
      else { E = [J[0] + d * (5 + 13 * m), yS + 50]; Hd = [J[0] + d * (3 + 15 * m), yS + 86]; }
      arms.push({d, J, E, Hd});
    }
    const bulge = A => {
      const mx = (A.J[0] + A.E[0]) / 2, my = (A.J[1] + A.E[1]) / 2;
      let px = -(A.E[1] - A.J[1]), py = A.E[0] - A.J[0];
      const l = Math.hypot(px, py) || 1; px /= l; py /= l;
      if (pose === "flex") { if (py > 0) { px = -px; py = -py; } } else if (px * A.d < 0) { px = -px; py = -py; }
      return pose === "flex" ? [mx + px * UA * .28, my + py * UA * .28, UA * .5 + 3 + 9 * m] : [mx + px * UA * .2, my + py * UA * .2, UA * .44 + 2 + 5 * m];
    };
    for (const A of arms) {
      const b = bulge(A);
      s += `<path d="M${f(A.J[0])} ${f(A.J[1])}L${f(A.E[0])} ${f(A.E[1])}" stroke="${ink}" stroke-width="${f(UA + 6)}" stroke-linecap="round"/><path d="M${f(A.E[0])} ${f(A.E[1])}L${f(A.Hd[0])} ${f(A.Hd[1])}" stroke="${ink}" stroke-width="${f(FA + 6)}" stroke-linecap="round"/>`;
      if (m > .2) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2] + 3)}" fill="${ink}"/>`;
      s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(8 + 6 * m)}" fill="${ink}"/>`;
    }
    for (const A of arms) {
      const b = bulge(A);
      s += `<path d="M${f(A.J[0])} ${f(A.J[1])}L${f(A.E[0])} ${f(A.E[1])}" stroke="${skin}" stroke-width="${f(UA)}" stroke-linecap="round"/><path d="M${f(A.E[0])} ${f(A.E[1])}L${f(A.Hd[0])} ${f(A.Hd[1])}" stroke="${skin}" stroke-width="${f(FA)}" stroke-linecap="round"/>`;
      if (m > .2) s += `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(b[2])}" fill="${skin}"/>`;
      s += `<circle cx="${f(A.Hd[0])}" cy="${f(A.Hd[1])}" r="${f(5.5 + 6 * m)}" fill="${skin}"/>`;
      if (m > .8) { // veines
        const o = Math.min(1, (m - .8) / .3);
        s += `<path d="M${f(b[0] - 4)} ${f(b[1] - b[2] * .5)}q6 6 0 12q-5 6 3 12" stroke="#6d8fd0" stroke-width="2.4" fill="none" opacity="${f(o)}" stroke-linecap="round"/>`;
      }
      if (look.acc === "bandeau") s += `<rect x="${f(A.Hd[0] - FA * .55)}" y="${f((A.E[1] + A.Hd[1]) / 2 + (A.Hd[1] - A.E[1]) * .25 - 4)}" width="${f(FA * 1.1)}" height="8" rx="3" fill="${look.topColor}" stroke="${ink}" stroke-width="2"/>`;
    }

    // ---- tête
    const hx = cx, hy = headY, r = headR;
    s += `<circle cx="${f(hx - r + 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/><circle cx="${f(hx + r - 1)}" cy="${f(hy + 3)}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="3.5"/>`;
    s += `<circle cx="${hx}" cy="${f(hy)}" r="${f(r)}" fill="${skin}" stroke="${ink}" stroke-width="4.5"/>`;
    if (look.acc === "barbe") s += `<path d="M${f(hx - r + 3)} ${f(hy + 2)}Q${f(hx - r + 4)} ${f(hy + r + 8)} ${hx} ${f(hy + r + 10)}Q${f(hx + r - 4)} ${f(hy + r + 8)} ${f(hx + r - 3)} ${f(hy + 2)}Q${hx} ${f(hy + r * .6)} ${f(hx - r + 3)} ${f(hy + 2)}Z" fill="${look.hairColor}" stroke="${ink}" stroke-width="3.5"/>`;
    // visage
    const ey = hy - r * .05, ex = r * .38;
    if (m > 1.05) s += `<circle cx="${f(hx - r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity=".45"/><circle cx="${f(hx + r * .5)}" cy="${f(hy + r * .35)}" r="${f(r * .2)}" fill="#ff5d6c" opacity=".45"/>`;
    if (look.acc === "lunettes") s += `<path d="M${f(hx - r * .82)} ${f(ey - 4)}h${f(r * 1.64)}" stroke="${ink}" stroke-width="3"/><rect x="${f(hx - r * .78)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/><rect x="${f(hx + r * .12)}" y="${f(ey - 5)}" width="${f(r * .66)}" height="${f(r * .38)}" rx="4" fill="#15121c"/>`;
    else s += `<circle cx="${f(hx - ex)}" cy="${f(ey)}" r="${f(m < .3 ? 4.2 : 3.4)}" fill="${ink}"/><circle cx="${f(hx + ex)}" cy="${f(ey)}" r="${f(m < .3 ? 4.2 : 3.4)}" fill="${ink}"/><circle cx="${f(hx - ex + 1.2)}" cy="${f(ey - 1.3)}" r="1.2" fill="#fff"/><circle cx="${f(hx + ex + 1.2)}" cy="${f(ey - 1.3)}" r="1.2" fill="#fff"/>`;
    // sourcils : inquiets quand maigre, froncés quand énorme
    const bt = m < .3 ? 4 : m > .9 ? -4 : 0;
    s += `<path d="M${f(hx - ex - 6)} ${f(ey - 9 + bt)}L${f(hx - ex + 5)} ${f(ey - 9 - bt)}M${f(hx + ex + 6)} ${f(ey - 9 + bt)}L${f(hx + ex - 5)} ${f(ey - 9 - bt)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    const my = hy + r * .45;
    if (m < .3) s += `<path d="M${f(hx - 6)} ${f(my + 2)}q3 -4 6 0t6 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    else if (m < .9) s += `<path d="M${f(hx - 8)} ${f(my - 1)}q8 8 16 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    else s += `<path d="M${f(hx - 10)} ${f(my - 3)}h20q-2 10 -10 10t-10 -10z" fill="#fff" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${f(hx - 9)} ${f(my + 1)}h18" stroke="${ink}" stroke-width="1.5"/>`;
    if (look.acc === "moustache") s += `<path d="M${f(hx - 12)} ${f(my - 2)}q6 -8 12 -3q6 -5 12 3q-6 4 -12 0q-6 4 -12 0z" fill="${look.hairColor}" stroke="${ink}" stroke-width="2.5"/>`;
    if (m < .15) s += `<path d="M${f(hx + r * .85)} ${f(hy - r * .5)}q5 8 0 11q-5 -3 0 -11z" fill="#8fd3ff" stroke="${ink}" stroke-width="1.8"/>`; // goutte de sueur

    // ---- coiffure avant
    const hc = look.hairColor;
    if (look.hair === "court" || look.hair === "queue") s += `<path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 8)} ${hx} ${f(hy - r - 6)}Q${f(hx + r)} ${f(hy - r - 8)} ${f(hx + r + 1)} ${f(hy - 2)}Q${f(hx + r * .4)} ${f(hy - r * .55)} ${f(hx - r * .2)} ${f(hy - r * .45)}Q${f(hx - r * .7)} ${f(hy - r * .3)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    if (look.hair === "crete") s += `<path d="M${f(hx - 9)} ${f(hy - r + 4)}l-4 -20 9 8 4 -22 6 21 8 -16 -2 29z" fill="${hc}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    if (look.hair === "chignon") s += `<circle cx="${hx}" cy="${f(hy - r - 8)}" r="11" fill="${hc}" stroke="${ink}" stroke-width="4"/><path d="M${f(hx - r - 1)} ${f(hy - 2)}Q${f(hx - r)} ${f(hy - r - 6)} ${hx} ${f(hy - r - 4)}Q${f(hx + r)} ${f(hy - r - 6)} ${f(hx + r + 1)} ${f(hy - 2)}Q${hx} ${f(hy - r * .5)} ${f(hx - r - 1)} ${f(hy - 2)}Z" fill="${hc}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    if (look.hair === "afro") s += `<path d="M${f(hx - r)} ${f(hy - 4)}Q${hx} ${f(hy - r * .55)} ${f(hx + r)} ${f(hy - 4)}" stroke="${hc}" stroke-width="6" fill="none"/>`;
    if (look.hair === "chauve") s += `<ellipse cx="${f(hx - r * .35)}" cy="${f(hy - r * .6)}" rx="${f(r * .3)}" ry="${f(r * .13)}" fill="#fff" opacity=".5" transform="rotate(-25 ${f(hx - r * .35)} ${f(hy - r * .6)})"/>`;
    if (look.acc === "bandeau") s += `<path d="M${f(hx - r - 1)} ${f(hy - r * .42)}Q${hx} ${f(hy - r * .72)} ${f(hx + r + 1)} ${f(hy - r * .42)}" stroke="${look.topColor}" stroke-width="7" fill="none"/><path d="M${f(hx + r - 2)} ${f(hy - r * .45)}l14 -2 -4 9z" fill="${look.topColor}" stroke="${ink}" stroke-width="2"/>`;
    if (look.acc === "casquette") s += `<path d="M${f(hx - r - 1)} ${f(hy - 3)}Q${f(hx - r)} ${f(hy - r - 9)} ${hx} ${f(hy - r - 7)}Q${f(hx + r)} ${f(hy - r - 9)} ${f(hx + r + 1)} ${f(hy - 3)}Z" fill="${look.topColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M${f(hx - r - 2)} ${f(hy - 4)}q-14 -2 -18 4q12 4 20 0z" fill="${shade(look.topColor, .75)}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    s += `</svg>`;
    return s;
  }

  // Plus il est musclé, plus le perso prend de place à l'écran : ×1 (Crevette) → ×1,45 (Montagne) → ×1,75 (Titan).
  function size(xp) { const m = muscle(xp); return 1 + .45 * Math.min(m, 1) + .3 * Math.max(0, m - 1) / .35; }
  G.avatar = {svg, tier, muscle, size, SKINS, HAIR_COLORS, HAIR_STYLES, CLOTH, TOPS, ACCS, TIERS, DEFAULT_LOOK};
})();
