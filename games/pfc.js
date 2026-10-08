/* Gonflette Party : Pierre-feuille-ciseaux, le tournoi (2 à 8 joueurs, chacun sur son téléphone).
   - 2 joueurs : un duel, premier à 3 points.
   - 3 à 8 joueurs : tableau à élimination directe (tirage au sort, exempts si besoin). Matchs en 2 points
     gagnants (finale en 3). Les matchs d'un même tour se jouent en même temps ; les autres regardent le
     tableau en direct, suivent un duel et encouragent.
   - Chaque coup : fenêtre d'« annonce » (facultative, publique) puis décompte « PIERRE… FEUILLE… CISEAUX…
     CHI-FOU-MI ! ». On peut changer son choix jusqu'à la fin ; pas de choix = 🎲 hasard.
     Gagner avec le signe annoncé = +1 point bonus (« BLUFF ASSUMÉ ! »). 2 victoires de suite avec le même
     signe = « COMBO ! ». Égalité = on rejoue tout de suite (les annonces restent valables).

   Synchronisation : l'hôte publie un calendrier en heure de l'hôte (m.T = début du coup). Chaque état porte
   t = Date.now() de l'hôte ; chaque téléphone estime le décalage d'horloge avec l'échantillon de plus petit
   délai (min sur une fenêtre de (heure locale de réception − t)), puis convertit le calendrier en heure locale.
   L'hôte republie l'état ~1 fois/s pour affiner l'estimation.
   Entrée d'un joueur : {u (id du coup), p (signe 0-2 ou -1), a (annonce), lk (verrouillé), cc ({place: nb d'encouragements})}.
   L'hôte ignore toute entrée dont u n'est pas le coup en cours ; il tranche quand les deux joueurs ont verrouillé,
   ou au plus tard 1,5 s après l'échéance. Un joueur absent plus de 8 s perd son match par forfait. */
GONFLETTE.registerGame({
  id: "pfc",
  name: "Pierre-feuille-ciseaux",
  min: 2,
  max: 8,
  create(api) {
    "use strict";
    const el = api.el, P = api.players, N = P.length;
    const seatOf = {}; P.forEach((p, i) => { seatOf[p.key] = i; });
    const mySeat = api.isPlayer && seatOf[api.me] !== undefined ? seatOf[api.me] : -1;
    const ANN = 2600, BEAT = 720, DL = 2600, MARGIN = 1500, REV = 3000, REV_DRAW = 1900;
    const LEAD0 = 2200, LEAD = 4200, NEXT = 1800, INTRO = 7500, END_HOLD = 6000, GRACE = 8000, OVER_HOLD = 3400;
    const SG = [
      {n: "Pierre", g: "Haltère", e: "🪨"},
      {n: "Feuille", g: "Serviette", e: "✋"},
      {n: "Ciseaux", g: "Ciseaux", e: "✌️"}
    ];
    const WHY = ["La pierre écrase les ciseaux", "La feuille enveloppe la pierre", "Les ciseaux coupent la feuille"];
    const beats = (a, b) => (a - b + 3) % 3 === 1;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const nm = s => (P[s] ? esc(P[s].pseudo || api.name(P[s].key)) : "?");
    const AVM = (window.GONFLETTE && window.GONFLETTE.avatar) || null;
    const muscle = xp => Math.max(0, Math.min(1.35, AVM && AVM.muscle ? AVM.muscle(+xp || 0) : (+xp || 0) / 1500));
    const bustCache = {};
    const bust = (s, pose) => {
      if (!P[s]) return "";
      const k = s + (pose || "idle");
      return bustCache[k] || (bustCache[k] = api.avatar(P[s].key, {view: "bust", pose: pose || "idle"}));
    };
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    let dead = false;
    let RM = false;
    try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* rien */ }

    /* ================= Mains dessinées (avant-bras musclés) ================= */
    const INK = "#23140c";
    const HEX = /^#[0-9a-f]{6}$/i;
    function shade(hex, k) {
      if (!HEX.test(hex || "")) return hex;
      const n = parseInt(hex.slice(1), 16);
      return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
    }
    const cap = (x, y, w, h, rot, ox, oy, fill, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${fill}" stroke="${INK}" stroke-width="${sw || 4.5}"${rot ? ` transform="rotate(${rot} ${ox} ${oy})"` : ""}/>`;
    const armCache = {};
    function armSVG(sign, seat, icon) {
      const ck = sign + ":" + seat + ":" + (icon ? 1 : 0);
      if (armCache[ck]) return armCache[ck];
      const p = P[seat] || P[0] || {}, lk = p.look || {};
      const sk = HEX.test(lk.skin || "") ? lk.skin : "#eebe98", sk2 = shade(sk, 0.8), hi = shade(sk, 1.12);
      const band = HEX.test(lk.topColor || "") ? lk.topColor : "#e63946";
      const mu = muscle(p.xp);
      const wB = 70 + 34 * mu, wW = 50 + 10 * mu, bul = 5 + 15 * mu;
      const xl = 80 - wB / 2, xr = 80 + wB / 2, wl = 80 - wW / 2, wr = 80 + wW / 2;
      let s = "";
      if (!icon) {
        s += `<path d="M${xl} 276C${xl - bul} 228 ${wl - bul * 0.7} 196 ${wl} 158L${wr} 158C${wr + bul * 0.45} 196 ${xr + bul * 0.55} 232 ${xr} 276Z" fill="${sk}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
        s += `<path d="M${wl + 7} 176C${wl - bul * 0.3} 200 ${xl + 2} 230 ${xl + 6} 268" stroke="${hi}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>`;
        s += `<path d="M86 270C${90 + 4 * mu} 244 ${72 - 3 * mu} 226 ${80 + 4 * mu} 200S78 178 84 168" stroke="${sk2}" stroke-width="${2.6 + mu}" fill="none" stroke-linecap="round"/>`;
        if (mu > 0.45) s += `<path d="M${xr - 12} 262C${xr - 8} 240 ${xr - 18} 222 ${wr - 6} 200" stroke="${sk2}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        if (sign === 1) { // serviette sur l'avant-bras
          s += `<path d="M${xl - 6} 196Q80 182 ${xr + 6} 198L${xr + 4} 230Q80 216 ${xl - 4} 226Z" fill="#fff6e8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
          s += `<path d="M${xl - 4} 205Q80 192 ${xr + 5} 207M${xl - 4} 217Q80 204 ${xr + 4} 220" stroke="#13a3a8" stroke-width="4" fill="none"/>`;
          s += `<path d="M${xr - 2} 204L${xr + 16} 212L${xr + 10} 254L${xr - 6} 246Z" fill="#fff6e8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M${xr + 1} 236L${xr + 12} 241" stroke="#13a3a8" stroke-width="3.5"/>`;
        }
        s += `<rect x="${wl - 5}" y="144" width="${wW + 10}" height="26" rx="7" fill="${band}" stroke="${INK}" stroke-width="4.5"/>`;
        s += `<path d="M${wl - 3} 151H${wr + 3}M${wl - 3} 163H${wr + 3}" stroke="#fff" stroke-width="3" opacity=".75"/>`;
      }
      if (sign === 0) { // poing serré sur un haltère
        s += `<rect x="6" y="94" width="148" height="13" rx="4" fill="#aeb6c0" stroke="${INK}" stroke-width="4"/>`;
        s += `<rect x="2" y="68" width="18" height="64" rx="5" fill="#3a3f47" stroke="${INK}" stroke-width="4"/><rect x="18" y="77" width="11" height="46" rx="3" fill="#59606b" stroke="${INK}" stroke-width="3.5"/>`;
        s += `<rect x="140" y="68" width="18" height="64" rx="5" fill="#3a3f47" stroke="${INK}" stroke-width="4"/><rect x="131" y="77" width="11" height="46" rx="3" fill="#59606b" stroke="${INK}" stroke-width="3.5"/>`;
        s += `<rect x="40" y="74" width="80" height="80" rx="25" fill="${sk}" stroke="${INK}" stroke-width="5"/>`;
        for (let i = 0; i < 4; i++) s += cap(41 + i * 19.5, 60, 19, 44, 0, 0, 0, sk, 4.5);
        for (let i = 0; i < 4; i++) s += `<path d="M${46 + i * 19.5} 70q4.5 -4 9 0" stroke="${sk2}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        s += cap(44, 108, 56, 21, -8, 72, 118, sk, 4.5);
        s += `<path d="M58 144q16 6 36 0" stroke="${sk2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      } else if (sign === 1) { // main ouverte
        s += cap(47, 26, 18, 76, -10, 56, 100, sk);
        s += cap(65, 14, 19, 86, -2, 74, 100, sk);
        s += cap(84, 20, 18, 80, 6, 93, 100, sk);
        s += cap(101, 40, 17, 62, 14, 109, 100, sk);
        s += cap(14, 104, 52, 20, -40, 56, 114, sk);
        s += `<rect x="42" y="82" width="78" height="74" rx="24" fill="${sk}" stroke="${INK}" stroke-width="5"/>`;
        s += `<path d="M56 112q20 9 44 -3M60 128q18 -6 36 4" stroke="${sk2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      } else { // ciseaux (V)
        s += cap(48, 16, 19, 80, -15, 57, 92, sk);
        s += cap(77, 14, 19, 80, 14, 86, 92, sk);
        s += `<path d="M40 22l-12 -8M37 36l-15 -2M124 20l12 -8M127 34l15 -2" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
        s += `<rect x="40" y="76" width="80" height="78" rx="25" fill="${sk}" stroke="${INK}" stroke-width="5"/>`;
        s += cap(81, 78, 19, 38, 0, 0, 0, sk, 4.5);
        s += cap(100, 82, 18, 34, 0, 0, 0, sk, 4.5);
        s += cap(46, 110, 58, 21, -10, 75, 120, sk, 4.5);
        s += `<path d="M58 144q16 6 36 0" stroke="${sk2}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      }
      const vb = icon ? "-4 4 168 158" : "0 0 160 280";
      return (armCache[ck] = `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${s}</svg>`);
    }

    /* ================= Styles ================= */
    el.innerHTML = `<style>
      .pf{--ink:#23140c;--cream:#fff6e0;--sand:#ffe3a3;--sun:#ffb703;--coral:#ff5a36;--teal:#0fa3a3;--pink:#ff3d7f;
        position:relative;min-height:100%;box-sizing:border-box;color:var(--ink);font-family:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
        background:linear-gradient(180deg,#ffd166 0%,#ff9f4a 48%,#f2643a 100%);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;overflow-x:hidden;overflow-x:clip}
      .pf.pf-fix{height:100%}
      .pf *{box-sizing:border-box}
      .pf button{font-family:inherit;color:inherit;cursor:pointer}
      .pf button:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .pf-scroll{min-height:100%;padding:12px 16px 26px;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;justify-items:center;gap:12px}
      .pf-title{font-family:Pacifico,"Brush Script MT",cursive;font-weight:400;font-size:clamp(1.9rem,8.6vw,2.8rem);line-height:1.1;margin:4px 0 0;color:var(--cream);text-align:center;text-shadow:3px 3px 0 var(--ink)}
      .pf-tag{font-family:Anton,Impact,sans-serif;letter-spacing:.06em;text-transform:uppercase;background:var(--ink);color:var(--sand);padding:3px 12px;border-radius:4px;font-size:1rem;text-align:center}
      .pf-box{width:min(100%,540px);background:var(--cream);border:3px solid var(--ink);border-radius:14px;box-shadow:0 5px 0 var(--ink);padding:10px 12px;font-size:1.06rem;line-height:1.28}
      .pf-box b{color:#b8321a}
      .pf-signs{width:min(100%,540px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .pf-sc{background:var(--cream);border:3px solid var(--ink);border-radius:14px;box-shadow:0 4px 0 var(--ink);padding:6px 4px 8px;text-align:center;display:grid;justify-items:center;gap:1px}
      .pf-sc svg{width:72%;max-width:96px;height:auto}
      .pf-sc b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.25rem;letter-spacing:.03em;line-height:1}
      .pf-sc i{font-family:Pacifico,cursive;font-style:normal;font-size:.85rem;color:#b8321a;line-height:1.3}
      .pf-sc small{font-size:.86rem;font-weight:700;line-height:1.05}
      .pf-bar{width:min(100%,540px);height:8px;border-radius:9px;background:rgba(35,20,12,.25);overflow:hidden}
      .pf-bar i{display:block;height:100%;background:var(--cream);transform-origin:left;animation:pf-bar linear forwards}
      @keyframes pf-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
      .pf-vs1{display:flex;align-items:center;justify-content:center;gap:10px;width:min(100%,540px)}
      .pf-vs1 .pf-av{width:84px;height:84px}
      .pf-vs1 b{font-family:Anton,Impact,sans-serif;font-size:2rem;color:var(--cream);text-shadow:2px 2px 0 var(--ink)}
      .pf-vs1 span{font-weight:800;font-size:1.1rem;text-align:center;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pf-av{border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#bff3f0,#5cc8c6);border:3px solid var(--ink);flex:none}
      .pf-av svg{width:100%;height:100%;display:block}
      /* ---------- duel ---------- */
      #pf-main{min-height:100%}
      .pf-fix #pf-main{height:100%}
      .pf-duel{height:100%;min-height:540px;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(150px,1fr) auto auto;gap:6px;padding:8px 12px 10px;max-width:560px;margin:0 auto}
      .pf-top{display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;min-height:30px}
      .pf-top .pf-tag{font-size:.92rem}
      .pf-top span{font-weight:800;font-size:1rem;background:rgba(255,246,224,.85);border:2px solid var(--ink);border-radius:20px;padding:0 9px}
      .pf-back{border:2px solid var(--ink);border-radius:20px;background:var(--cream);font-weight:800;font-size:1rem;padding:2px 10px;box-shadow:0 2px 0 var(--ink)}
      .pf-side{position:relative;display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:8px;background:var(--cream);border:3px solid var(--ink);border-radius:14px;padding:4px 10px 4px 4px;box-shadow:0 4px 0 var(--ink);min-height:68px}
      .pf-side.me{background:linear-gradient(90deg,#fff2c2,var(--cream))}
      .pf-side .pf-av{width:58px;height:58px;transition:transform .3s,filter .3s}
      .pf-side .pf-av.win{transform:scale(1.14);box-shadow:0 0 0 3px var(--sun),0 0 18px var(--sun);animation:pf-pop .5s}
      .pf-side .pf-av.lose{transform:scale(.88,.74) translateY(8px);filter:saturate(.25) brightness(.95)}
      .pf-who{min-width:0}
      .pf-nm{font-weight:800;font-size:1.18rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pf-nm i{font-style:normal;font-weight:600;font-size:.9rem;color:#8a5a2b}
      .pf-pips{display:flex;gap:5px;margin-top:4px}
      .pf-pips i{width:17px;height:17px;border-radius:50%;border:2.5px solid var(--ink);background:#fff}
      .pf-pips i.on{background:radial-gradient(circle at 35% 30%,#fff3b0,var(--sun) 55%,#d97800);animation:pf-pop .45s}
      .pf-annb{font-weight:800;font-size:.95rem;line-height:1.05;max-width:150px;white-space:nowrap;text-align:center;background:#fff;border:2.5px solid var(--ink);border-radius:12px;padding:3px 7px;position:relative;opacity:0;transform:scale(.6);transition:opacity .2s,transform .2s}
      .pf-annb.on{opacity:1;transform:none}
      .pf-annb small{display:block;font-size:.72rem;font-weight:700;color:#8a5a2b;text-transform:uppercase;letter-spacing:.04em}
      .pf-fl{position:absolute;pointer-events:none;font-size:1.6rem;animation:pf-float 1.3s ease-out forwards;z-index:6}
      @keyframes pf-float{from{opacity:1;transform:translateY(0) scale(.7)}to{opacity:0;transform:translateY(-70px) scale(1.25)}}
      .pf-arena{position:relative;min-height:0;border:3px solid var(--ink);border-radius:18px;overflow:hidden;background:#ffcc5c;box-shadow:inset 0 0 0 4px rgba(255,255,255,.35)}
      .pf-sunb{position:absolute;left:50%;top:50%;width:190%;aspect-ratio:1;margin:-95% 0 0 -95%;background:repeating-conic-gradient(#ffd97a 0 10deg,#ffbf47 10deg 20deg);animation:pf-spin 40s linear infinite;opacity:.9}
      @keyframes pf-spin{to{transform:rotate(360deg)}}
      .pf-duel[data-ph="rev"] .pf-sunb,.pf-duel[data-ph="over"] .pf-sunb{background:repeating-conic-gradient(#ffe8a6 0 10deg,#ff9f4a 10deg 20deg)}
      .pf-arm{position:absolute;left:50%;height:45%;aspect-ratio:160/280;transform:translateX(-50%);z-index:2;pointer-events:none}
      .pf-arm.bot{bottom:-6%}
      .pf-arm.top{top:-6%;transform:translateX(-50%) rotate(180deg)}
      .pf-armi{width:100%;height:100%}
      .pf-armi svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 5px 0 rgba(35,20,12,.25))}
      .pf-armi.pump{animation:pf-pump .34s ease-out}
      .pf-armi.slam{animation:pf-slam .42s cubic-bezier(.3,1.6,.5,1)}
      .pf-armi.wait{animation:pf-wait .5s ease-in-out infinite}
      .pf-armi.dim{filter:grayscale(.6) brightness(.9);transform:scale(.92);transition:transform .4s,filter .4s}
      @keyframes pf-pump{40%{transform:translateY(18%)}}
      @keyframes pf-slam{0%{transform:translateY(46%) scale(.86)}100%{transform:none}}
      @keyframes pf-wait{50%{transform:translateY(5%) rotate(2deg)}}
      .pf-sgt{position:absolute;left:50%;transform:translateX(-50%);z-index:3;font-family:Anton,Impact,sans-serif;font-size:1rem;letter-spacing:.03em;white-space:nowrap;background:var(--ink);color:var(--sand);border-radius:6px;padding:1px 8px;opacity:0;transition:opacity .2s}
      .pf-sgt.on{opacity:1}
      .pf-sgt.t{top:6px}.pf-sgt.b{bottom:6px}
      .pf-sgt small{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.9rem;color:#ffd166}
      .pf-mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);z-index:4;text-align:center;pointer-events:none;padding:0 8px}
      .pf-word{font-family:Anton,Impact,"Arial Narrow",sans-serif;font-size:clamp(2rem,10.5vw,3.4rem);line-height:1;color:#fff;text-transform:uppercase;letter-spacing:.02em;-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;text-shadow:3px 3px 0 var(--ink)}
      .pf-word.go{animation:pf-pop .3s ease-out}
      .pf-word.big{font-size:clamp(2.4rem,13vw,4.2rem);color:var(--sun)}
      .pf-word.lose{color:#9fd3ff}
      .pf-sub{margin-top:4px;font-weight:800;font-size:1.08rem;color:var(--ink);display:inline-block;background:rgba(255,246,224,.92);border:2px solid var(--ink);border-radius:10px;padding:1px 9px;max-width:100%}
      .pf-sub:empty{display:none}
      .pf-badges{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px}
      .pf-badges span{font-family:Anton,Impact,sans-serif;letter-spacing:.04em;font-size:1.05rem;padding:2px 10px;border:2.5px solid var(--ink);border-radius:8px;transform:rotate(-4deg);animation:pf-stamp .45s both}
      .pf-badges .cb{background:var(--pink);color:#fff}.pf-badges .bl{background:var(--teal);color:#fff}.pf-badges .ly{background:#fff;color:var(--ink)}
      .pf-badges span:nth-child(2){transform:rotate(3deg);animation-delay:.15s}
      @keyframes pf-stamp{from{opacity:0;transform:scale(2.2) rotate(-14deg)}}
      @keyframes pf-pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
      .pf-flash{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,#fff 0,#fff7c2 22%,rgba(255,255,255,0) 60%)}
      .pf-flash.go{animation:pf-flash .5s ease-out}
      @keyframes pf-flash{0%{opacity:1}100%{opacity:0}}
      .pf-arena.shake{animation:pf-shake .32s}
      @keyframes pf-shake{20%{transform:translate(-5px,3px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-3px,2px)}80%{transform:translate(2px,-1px)}}
      .pf-ctl{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
      .pf-hint{text-align:center;font-weight:800;font-size:1.05rem;line-height:1.15;min-height:1.2em;color:var(--ink)}
      .pf-annrow{display:flex;align-items:center;gap:5px;justify-content:center;min-height:40px}
      .pf-annrow>b{font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.03em;font-size:.95rem;white-space:nowrap;line-height:1;text-align:center}
      .pf-annrow button{flex:1 1 0;min-width:0;max-width:120px;border:2.5px solid var(--ink);background:#fff;border-radius:20px;font-weight:800;font-size:.98rem;padding:5px 4px;box-shadow:0 3px 0 var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pf-annrow button:disabled{opacity:.45;box-shadow:none;cursor:default}
      .pf-annrow button.sel{background:var(--teal);color:#fff;opacity:1}
      .pf-annrow.off{visibility:hidden}
      .pf-picks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .pf-pick{position:relative;border:3px solid var(--ink);border-radius:16px;background:var(--cream);box-shadow:0 5px 0 var(--ink);padding:3px 2px 6px;display:grid;justify-items:center;gap:0;transition:transform .08s,box-shadow .08s,background .15s}
      .pf-pick svg{width:min(70px,82%);height:56px}
      .pf-pick b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.15rem;letter-spacing:.03em;line-height:1}
      .pf-pick small{font-family:Pacifico,cursive;font-size:.78rem;color:#b8321a;line-height:1.25}
      .pf-pick:active{transform:translateY(3px);box-shadow:0 2px 0 var(--ink)}
      .pf-pick.sel{background:radial-gradient(circle at 50% 30%,#fff7c8,var(--sun));transform:translateY(-3px);box-shadow:0 8px 0 var(--ink),0 0 0 3px #fff}
      .pf-pick.sel::after{content:"✓";position:absolute;top:-10px;right:-6px;width:26px;height:26px;border-radius:50%;background:var(--teal);color:#fff;border:2.5px solid var(--ink);font-weight:900;display:grid;place-items:center;font-size:.95rem}
      .pf-pick:disabled{cursor:default;filter:grayscale(.5);opacity:.6;box-shadow:0 2px 0 var(--ink)}
      .pf-pick.sel:disabled{opacity:1;filter:none}
      .pf-cheers{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .pf-cheers button,.pf-btn{border:3px solid var(--ink);border-radius:14px;background:var(--pink);color:#fff;font-family:Anton,Impact,sans-serif;font-size:1.1rem;letter-spacing:.03em;padding:10px 6px;box-shadow:0 4px 0 var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pf-cheers button:active,.pf-btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
      .pf-btn.alt{background:var(--teal)}
      /* ---------- tableau ---------- */
      .pf-hh{display:flex;flex-direction:column;align-items:center;gap:4px}
      .pf-hh h2{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2rem;letter-spacing:.03em;color:var(--cream);text-shadow:3px 3px 0 var(--ink);text-transform:uppercase;line-height:1}
      .pf-live{width:min(100%,540px);display:grid;gap:10px}
      .pf-card{position:relative;background:var(--cream);border:3px solid var(--ink);border-radius:14px;box-shadow:0 4px 0 var(--ink);padding:8px 8px 8px;display:grid;gap:6px}
      .pf-card.mine{background:linear-gradient(#fff2c2,var(--cream))}
      .pf-card.done{opacity:.8}
      .pf-cr{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:6px}
      .pf-cp{display:flex;align-items:center;gap:6px;min-width:0}
      .pf-cp.r{flex-direction:row-reverse;text-align:right}
      .pf-cp .pf-av{width:44px;height:44px}
      .pf-cp>div{min-width:0}
      .pf-cp .pf-nm{font-size:1.05rem}
      .pf-cp.r .pf-pips{justify-content:flex-end}
      .pf-cp .pf-pips i{width:13px;height:13px;border-width:2px}
      .pf-cp.w .pf-av{box-shadow:0 0 0 3px var(--sun)}
      .pf-cp.l{opacity:.55}
      .pf-cvs{font-family:Anton,Impact,sans-serif;font-size:1.3rem;text-align:center;line-height:1}
      .pf-cst{text-align:center;font-weight:800;font-size:1rem;min-height:1.2em}
      .pf-cbt{display:grid;grid-template-columns:auto 1fr auto;gap:6px}
      .pf-cbt button{border:2.5px solid var(--ink);border-radius:12px;background:#fff;font-weight:800;font-size:1rem;padding:5px 9px;box-shadow:0 3px 0 var(--ink)}
      .pf-cbt .ch{background:var(--pink);color:#fff}
      .pf-cbt button:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
      .pf-h3{margin:4px 0 -4px;font-family:Anton,Impact,sans-serif;font-weight:400;letter-spacing:.06em;font-size:1.15rem;color:var(--cream);text-shadow:2px 2px 0 var(--ink);text-transform:uppercase}
      .pf-bk{width:min(100%,540px);display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:6px;background:rgba(255,246,224,.35);border:3px solid var(--ink);border-radius:14px;padding:6px}
      .pf-col{display:flex;flex-direction:column;min-width:0}
      .pf-colh{text-align:center;font-family:Anton,Impact,sans-serif;letter-spacing:.05em;font-size:.86rem;text-transform:uppercase;margin-bottom:4px}
      .pf-colb{flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:6px}
      .pf-bm{background:var(--cream);border:2.5px solid var(--ink);border-radius:9px;overflow:hidden}
      .pf-bm.live{box-shadow:0 0 0 3px var(--pink);animation:pf-pulse 1.4s infinite}
      @keyframes pf-pulse{50%{box-shadow:0 0 0 3px rgba(255,61,127,.25)}}
      .pf-br{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:3px;padding:2px 4px;font-weight:800;font-size:.9rem;line-height:1.1;min-height:25px}
      .pf-br+.pf-br{border-top:1.5px dashed rgba(35,20,12,.35)}
      .pf-br .pf-av{width:20px;height:20px;border-width:1.5px}
      .pf-br span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pf-br b{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:.95rem}
      .pf-br.w{background:#ffe08a}
      .pf-br.l{opacity:.5;text-decoration:line-through}
      .pf-br.me span{color:#b8321a}
      .pf-br.bye,.pf-br.tbd{display:block;text-align:center;color:#8a5a2b;font-weight:700;font-style:italic}
      .pf-champ-c{text-align:center;font-size:1.6rem;line-height:1}
      /* ---------- fin ---------- */
      .pf-hero{position:relative;width:min(70%,250px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fff7c8,var(--sun) 60%,#ff8c42);border:4px solid var(--ink);box-shadow:0 6px 0 var(--ink);overflow:hidden}
      .pf-hero svg{width:100%;height:100%;display:block}
      .pf-rays{position:absolute;inset:-30%;background:repeating-conic-gradient(rgba(255,255,255,.4) 0 8deg,transparent 8deg 18deg);animation:pf-spin 18s linear infinite}
      .pf-crown{font-size:2.6rem;line-height:1;margin-bottom:-14px;z-index:2;animation:pf-pop .6s}
      .pf-rk{width:min(100%,540px);display:grid;gap:6px}
      .pf-rr{display:grid;grid-template-columns:30px 44px minmax(0,1fr) auto;align-items:center;gap:8px;background:var(--cream);border:2.5px solid var(--ink);border-radius:12px;padding:3px 8px;box-shadow:0 3px 0 var(--ink);animation:pf-in .35s both}
      .pf-rr .pf-av{width:42px;height:42px;border-width:2px}
      .pf-rr .pl{font-family:Anton,Impact,sans-serif;font-size:1.4rem;text-align:center}
      .pf-rr .lb{font-weight:800;font-size:.95rem;color:#8a5a2b;text-align:right;line-height:1.05}
      .pf-rr.p1{background:linear-gradient(90deg,#ffe08a,var(--cream))}
      .pf-rr.mine{border-color:#b8321a}
      @keyframes pf-in{from{opacity:0;transform:translateX(-20px)}}
      @media (min-width:700px){.pf-duel{min-height:600px}.pf-word{font-size:3.4rem}}
      @media (max-height:700px){.pf-pick svg{height:44px}.pf-side{min-height:58px}.pf-side .pf-av{width:50px;height:50px}.pf-side{grid-template-columns:54px minmax(0,1fr) auto}}
      @media (prefers-reduced-motion:reduce){.pf *,.pf *::before,.pf *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.pf-sunb,.pf-rays{animation:none!important}.pf-flash{display:none}}
    </style><div class="pf" id="pf-root"><div id="pf-main"></div></div>`;
    const root = el.querySelector("#pf-root"), main = el.querySelector("#pf-main");

    /* ================= Son (WebAudio, après un geste) ================= */
    let actx = null, noiseBuf = null;
    function ensureAudio() {
      if (actx) { if (actx.state === "suspended") actx.resume().catch(() => {}); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        actx = new AC();
        noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.4), actx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { actx = null; }
    }
    function tone(f, dur, type, vol, delay, f2) {
      if (!actx) return;
      try {
        const t = actx.currentTime + (delay || 0);
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || "square"; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* rien */ }
    }
    function thud(vol) {
      if (!actx) return;
      try {
        const t = actx.currentTime;
        const src = actx.createBufferSource(); src.buffer = noiseBuf;
        const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        const g = actx.createGain(); g.gain.setValueAtTime(vol || 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        src.connect(lp); lp.connect(g); g.connect(actx.destination); src.start(t); src.stop(t + 0.4);
        tone(120, 0.25, "sine", (vol || 0.7) * 0.8, 0, 45);
      } catch (e) { /* rien */ }
    }
    const sfx = {
      beat: i => tone(i < 3 ? 330 + i * 60 : 660, i < 3 ? 0.09 : 0.18, "square", 0.08),
      win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0.18, i * 0.09)); },
      lose: () => tone(330, 0.5, "sawtooth", 0.09, 0.05, 110),
      draw: () => { tone(440, 0.1, "square", 0.08); tone(440, 0.1, "square", 0.08, 0.14); },
      combo: () => tone(300, 0.35, "sawtooth", 0.08, 0.15, 1400),
      pick: () => tone(880, 0.05, "square", 0.05),
      cheer: () => tone(700, 0.08, "triangle", 0.07, 0, 1100)
    };

    /* ================= Horloge partagée ================= */
    const samples = [];
    let off = 0;
    function sampleClock(t) {
      if (typeof t !== "number" || !isFinite(t)) return;
      samples.push(Date.now() - t);
      if (samples.length > 40) samples.shift();
      off = Math.min.apply(null, samples);
    }
    const loc = T => T + off;          // heure hôte -> heure locale
    const pairOf = m => (S && S.bk && S.bk[S.rd] && S.bk[S.rd][m.x]) || [-1, -1];
    function phaseOf(m, tl) {
      const T = loc(m.T), C = T + (m.an ? ANN : 0), D = C + DL;
      if (m.w >= 0 && tl >= T) return "over";
      if (tl < T) return m.L && m.L.k === m.k - 1 ? "rev" : "vs";
      if (tl < C) return "ann";
      if (tl < D) return "cd";
      return "lock";
    }
    function rName(r, plural) {
      if (!S || N === 2) return "Duel";
      const fe = S.nr - 1 - r;
      return fe === 0 ? "Finale" : fe === 1 ? (plural ? "Demi-finales" : "Demi-finale") : fe === 2 ? (plural ? "Quarts de finale" : "Quart de finale") : "Tour " + (r + 1);
    }
    const rShort = r => { const fe = S.nr - 1 - r; return fe === 0 ? "Finale" : fe === 1 ? "Demies" : fe === 2 ? "Quarts" : "Tour " + (r + 1); };

    /* ================= Logique de l'hôte ================= */
    let hostLoop = null;
    if (api.isHost) {
      const order = P.map((p, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let size = 2; while (size < N) size *= 2;
      const nr = Math.round(Math.log2(size)), slots = size / 2, byes = size - N;
      const spread = slots === 1 ? [0] : slots === 2 ? [0, 1] : [0, 2, 1, 3];
      const byeSet = new Set(spread.slice(0, byes));
      const r1 = []; let q = 0;
      for (let j = 0; j < slots; j++) r1.push(byeSet.has(j) ? [order[q++], -1] : [order[q++], order[q++]]);
      const bk = [r1];
      for (let r = 1; r < nr; r++) bk.push(Array.from({length: slots >> r}, () => [-2, -2]));
      const rs = bk.map((rd, r) => rd.map(pr => (r === 0 && pr[1] === -1 ? [0, 0, pr[0], 2] : [0, 0, -1, 0])));
      const H = {v: 1, ph: "intro", t: 0, E: Date.now() + INTRO, nr, rd: 0, bk, rs, m: [], cr: P.map(() => 0), sb: {c: 0, cs: -1, b: 0}};
      let inputs = {}, U = 0, nextAt = 0, lastPub = 0, pubTimer = null;
      const absent = P.map(() => 0), mx = {}, cheerPrev = {};
      const pub = () => {
        if (dead) return;
        const now = Date.now();
        if (now - lastPub < 90) { if (!pubTimer) pubTimer = later(() => { pubTimer = null; pub(); }, 95 - (now - lastPub)); return; }
        lastPub = now; H.t = now;
        api.setState(H);
      };
      const startRound = r => {
        const now = Date.now();
        H.ph = "play"; H.rd = r; H.m = [];
        H.bk[r].forEach((pr, x) => {
          if (pr[0] < 0 || pr[1] < 0) return;
          H.m.push({x, u: ++U, k: 1, T: now + (r === 0 ? LEAD0 : LEAD), an: 1, A: [-1, -1], L: null, s: [0, 0], w: -1, f: 0, tg: r === nr - 1 ? 3 : 2});
          mx[x] = {ls: -1, lg: -1, cn: 0};
        });
        nextAt = 0;
        pub();
      };
      const forfeit = (m, pr, ls) => {
        m.w = pr[1 - ls]; m.f = ls + 1; m.T = Date.now(); m.u = ++U; m.L = null;
        H.rs[H.rd][m.x] = [m.s[0], m.s[1], m.w, 1];
      };
      const resolve = (m, pr) => {
        const now = Date.now(), p = [0, 0], rnd = [0, 0];
        pr.forEach((s, i) => {
          const v = inputs[P[s].key];
          if (v && v.u === m.u && v.p >= 0 && v.p <= 2) p[i] = v.p | 0;
          else { p[i] = Math.floor(Math.random() * 3); rnd[i] = 1; }
        });
        const L = {u: m.u, k: m.k, p, r: rnd, w: -1, c: 0, b: 0, y: [0, 0], g: 0};
        if (p[0] === p[1]) { m.an = 0; m.T = now + REV_DRAW; }
        else {
          const w = beats(p[0], p[1]) ? 0 : 1, X = mx[m.x];
          let g = 1;
          if (m.A[w] === p[w]) { g = 2; L.b = 1; H.sb.b++; }
          X.cn = X.ls === w && X.lg === p[w] ? X.cn + 1 : 1; X.ls = w; X.lg = p[w];
          if (X.cn >= 2) { L.c = X.cn; if (X.cn > H.sb.c) { H.sb.c = X.cn; H.sb.cs = pr[w]; } }
          L.y = [0, 1].map(i => (m.A[i] >= 0 && m.A[i] !== p[i] ? 1 : 0));
          L.w = w; L.g = g;
          m.s[w] = Math.min(m.tg, m.s[w] + g);
          H.rs[H.rd][m.x] = [m.s[0], m.s[1], -1, 0];
          if (m.s[w] >= m.tg) { m.w = pr[w]; H.rs[H.rd][m.x][2] = pr[w]; }
          m.A = [-1, -1]; m.an = 1; m.T = now + REV;
        }
        m.L = L; m.u = ++U; m.k++;
      };
      const ranking = () => {
        const out = P.map(() => -1), pts = P.map(() => 0), ff = P.map(() => 0);
        H.bk.forEach((rd, r) => rd.forEach((pr, x) => {
          const res = H.rs[r][x];
          if (pr[0] < 0 || pr[1] < 0 || res[2] < 0) return;
          const li = pr[0] === res[2] ? 1 : 0, lo = pr[li];
          out[lo] = r; pts[lo] = res[li]; ff[lo] = res[3] === 1 ? 1 : 0;
        }));
        const champ = H.rs[H.nr - 1][0][2];
        if (champ >= 0) out[champ] = H.nr;
        return P.map((p, i) => i).sort((a, b) => (out[b] - out[a]) || (ff[a] - ff[b]) || (pts[b] - pts[a]) || a - b);
      };
      const endGame = () => {
        const rk = ranking();
        H.ph = "end"; H.rk = rk; H.m = [];
        pub();
        later(() => {
          const ch = rk[0], fin = H.rs[H.nr - 1][0], pr = H.bk[H.nr - 1][0];
          const other = pr[0] === ch ? pr[1] : pr[0], sc = pr[0] === ch ? fin[0] + "–" + fin[1] : fin[1] + "–" + fin[0];
          let summary = N === 2
            ? `${P[ch].pseudo} gagne le duel de chi-fou-mi ${sc}${fin[3] === 1 ? " (forfait)" : ""} !`
            : `${P[ch].pseudo} remporte le tournoi de chi-fou-mi face à ${P[other] ? P[other].pseudo : "?"} (${sc}) !`;
          if (H.sb.c >= 2 && P[H.sb.cs]) summary += ` Combo ×${H.sb.c} : ${P[H.sb.cs].pseudo}.`;
          if (H.sb.b) summary += ` ${H.sb.b} bluff${H.sb.b > 1 ? "s" : ""} assumé${H.sb.b > 1 ? "s" : ""}.`;
          api.finish({winners: [P[ch].key], ranking: rk.map(s => P[s].key), summary: summary.slice(0, 160)});
        }, END_HOLD);
      };
      const advance = () => {
        const r = H.rd;
        if (r >= H.nr - 1) { endGame(); return; }
        H.bk[r].forEach((pr, x) => { H.bk[r + 1][x >> 1][x & 1] = H.rs[r][x][2]; });
        startRound(r + 1);
      };
      const loop = () => {
        if (dead || H.ph === "end") return;
        const now = Date.now();
        const live = new Set(api.connected());
        P.forEach((p, i) => { if (live.has(p.key)) absent[i] = 0; else if (!absent[i]) absent[i] = now; });
        if (H.ph === "intro") { if (now >= H.E) startRound(0); else if (now - lastPub > 1000) pub(); return; }
        let dirty = false;
        for (const m of H.m) {
          if (m.w >= 0) continue;
          const pr = H.bk[H.rd][m.x];
          const gone = pr.map(s => absent[s] > 0 && now - absent[s] > GRACE);
          if (gone[0] || gone[1]) {
            forfeit(m, pr, gone[0] && gone[1] ? (absent[pr[0]] <= absent[pr[1]] ? 0 : 1) : gone[0] ? 0 : 1);
            dirty = true; continue;
          }
          const D = m.T + (m.an ? ANN : 0) + DL;
          if (now >= D) {
            const lk = pr.map(s => { const v = inputs[P[s].key]; return !!(v && v.u === m.u && v.lk); });
            if ((lk[0] && lk[1]) || now >= D + MARGIN) { resolve(m, pr); dirty = true; }
          }
        }
        if (!nextAt && H.m.every(m => m.w >= 0)) nextAt = Math.max(now, ...H.m.map(m => m.T)) + NEXT;
        if (nextAt && now >= nextAt) { nextAt = 0; advance(); return; }
        if (dirty || now - lastPub > 1000) pub();
      };
      api.onInputs(map => {
        inputs = map || {};
        if (H.ph !== "play") return;
        const now = Date.now();
        let dirty = false;
        for (const m of H.m) {
          if (m.w >= 0 || !m.an || now > m.T + ANN + 600) continue;
          H.bk[H.rd][m.x].forEach((s, i) => {
            const v = inputs[P[s].key];
            if (m.A[i] < 0 && v && v.u === m.u && v.a >= 0 && v.a <= 2) { m.A[i] = v.a | 0; dirty = true; }
          });
        }
        P.forEach(p => {
          const v = inputs[p.key];
          if (!v || !v.cc || typeof v.cc !== "object") return;
          const prev = cheerPrev[p.key] || (cheerPrev[p.key] = {});
          for (const k in v.cc) {
            const s = +k, n = +v.cc[k] || 0;
            if (!(s >= 0 && s < N)) continue;
            const d = n - (prev[k] || 0);
            if (d > 0) { H.cr[s] += Math.min(d, 15); dirty = true; prev[k] = n; }
          }
        });
        if (dirty) pub();
        loop();
      });
      pub();
      hostLoop = setInterval(loop, 100);
    }

    /* ================= Affichage (tous les téléphones) ================= */
    let S = null, view = "", Dx = null, Hx = null, watchX = null, noAuto = -1, skipMine = "", lastRd = -1;
    let myU = -1, myP = -1, myA = -1, lockedU = -1;
    const inp = {u: -1, p: -1, a: -1, lk: 0, cc: {}};
    const crSeen = P.map(() => -1);
    const push = () => api.setInput(JSON.parse(JSON.stringify(inp)));
    const setT = (node, txt) => { if (node && node.textContent !== txt) node.textContent = txt; };
    const setH = (node, html) => { if (node && node._h !== html) { node._h = html; node.innerHTML = html; } };
    const pips = (n, tg) => Array.from({length: tg}, (x, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
    const restart = (node, cls) => { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

    function bracketHTML() {
      if (!S || N <= 2) return "";
      let h = `<div class="pf-bk" style="--cols:${S.nr}">`;
      S.bk.forEach((rd, r) => {
        h += `<div class="pf-col"><div class="pf-colh">${rShort(r)}</div><div class="pf-colb">`;
        rd.forEach((pr, x) => {
          const res = S.rs[r][x];
          const isLive = S.ph === "play" && r === S.rd && res[2] < 0 && pr[0] >= 0 && pr[1] >= 0;
          const row = (s, i) => {
            if (s === -1) return `<div class="pf-br bye">exempt</div>`;
            if (s < 0) return `<div class="pf-br tbd">?</div>`;
            const w = res[2] >= 0 && res[2] === s, l = res[2] >= 0 && res[2] !== s;
            const sc = res[3] === 2 ? "✓" : res[3] === 1 && l ? "F" : (pr[0] >= 0 && pr[1] >= 0 ? res[i] : "");
            return `<div class="pf-br${w ? " w" : ""}${l ? " l" : ""}${s === mySeat ? " me" : ""}"><span class="pf-av">${bust(s)}</span><span>${nm(s)}</span><b>${sc}</b></div>`;
          };
          h += `<div class="pf-bm${isLive ? " live" : ""}">${row(pr[0], 0)}${row(pr[1], 1)}</div>`;
        });
        if (r === S.nr - 1) h += `<div class="pf-champ-c" aria-hidden="true">🏆</div>`;
        h += `</div></div>`;
      });
      return h + `</div>`;
    }

    /* ----- intro ----- */
    function buildIntro() {
      const hand = i => `<div class="pf-sc">${armSVG(i, mySeat >= 0 ? mySeat : 0, true)}<b>${SG[i].e} ${SG[i].n.toUpperCase()}</b><i>« ${SG[i].g} »</i><small>${["écrase les ciseaux", "enveloppe la pierre", "coupent la feuille"][i]}</small></div>`;
      let first = "";
      if (mySeat >= 0) {
        const pr = S.bk[0].find(q => q.includes(mySeat));
        if (pr) {
          const o = pr[0] === mySeat ? pr[1] : pr[0];
          first = o < 0 ? `<div class="pf-box" style="text-align:center">🛋️ Tirage au sort : vous êtes <b>exempté·e du premier tour</b>. Directement qualifié·e !</div>`
            : `<div class="pf-vs1"><span><span class="pf-av" style="display:block;width:84px;height:84px;margin:0 auto">${bust(mySeat)}</span>Vous</span><b>VS</b><span><span class="pf-av" style="display:block;width:84px;height:84px;margin:0 auto">${bust(o)}</span>${nm(o)}</span></div>`;
        }
      }
      main.innerHTML = `<div class="pf-scroll">
        <h1 class="pf-title">Pierre-feuille-ciseaux</h1>
        <div class="pf-tag">${N === 2 ? "Le duel · premier à 3 points" : `Tournoi à ${N} · matchs en 2 pts, finale en 3`}</div>
        <div class="pf-signs">${hand(0)}${hand(1)}${hand(2)}</div>
        <div class="pf-box">⏱️ Choix modifiable jusqu'à <b>« CHI-FOU-MI ! »</b>. Pas de choix = <b>🎲 hasard</b>. Égalité = on rejoue !<br>📢 <b>Annonce</b> (facultative, vue par tous) : gagnez avec le signe annoncé = <b>+1 point bonus</b>.<br>🔥 Deux victoires de suite avec le même signe = <b>COMBO</b>.</div>
        ${first}
        <div class="pf-bar"><i style="animation-duration:${Math.max(500, loc(S.E) - Date.now())}ms"></i></div>
        ${N > 2 ? `<div class="pf-h3">Tableau</div>${bracketHTML()}` : ""}
      </div>`;
    }

    /* ----- duel ----- */
    function buildDuel(m, spect) {
      const pr = pairOf(m);
      const bi = spect ? 0 : pr.indexOf(mySeat), ti = 1 - bi;
      const side = (i, pos) => {
        const s = pr[i], me = s === mySeat;
        return `<div class="pf-side ${pos}${me ? " me" : ""}" id="pf-side-${pos}"><span class="pf-av" id="pf-av-${pos}">${bust(s)}</span>
          <div class="pf-who"><div class="pf-nm">${nm(s)}${me ? " <i>(vous)</i>" : ""}</div><div class="pf-pips" id="pf-pp-${pos}"></div></div>
          <div class="pf-annb" id="pf-an-${pos}"></div></div>`;
      };
      const canCheer = spect && api.isPlayer;
      main.innerHTML = `<div class="pf-duel" id="pf-duel" data-ph="">
        <div class="pf-top">${spect ? `<button class="pf-back" type="button" data-pf-back>← Tableau</button>` : ""}<b class="pf-tag">${rName(S.rd)}</b><span id="pf-k"></span><span>Premier à ${m.tg}</span></div>
        ${side(ti, "t")}
        <div class="pf-arena" id="pf-arena"><div class="pf-sunb"></div>
          <div class="pf-arm top"><div class="pf-armi" id="pf-arm-t"></div></div>
          <div class="pf-arm bot"><div class="pf-armi" id="pf-arm-b"></div></div>
          <div class="pf-sgt t" id="pf-sg-t"></div><div class="pf-sgt b" id="pf-sg-b"></div>
          <div class="pf-flash" id="pf-flash"></div>
          <div class="pf-mid" role="status" aria-live="polite"><div class="pf-word" id="pf-word"></div><div class="pf-sub" id="pf-sub"></div><div class="pf-badges" id="pf-bdg"></div></div>
        </div>
        ${side(bi, "b")}
        <div class="pf-ctl">${spect
          ? `<div class="pf-hint" id="pf-hint">👀 Vous regardez ce duel</div>${canCheer ? `<div class="pf-cheers"><button type="button" data-pf-cheer="${pr[ti]}">💪 Allez ${nm(pr[ti])} !</button><button type="button" data-pf-cheer="${pr[bi]}">💪 Allez ${nm(pr[bi])} !</button></div>` : ""}`
          : `<div class="pf-hint" id="pf-hint"></div>
          <div class="pf-annrow" id="pf-annrow"><b>📢<br>Annonce</b>${[0, 1, 2].map(i => `<button type="button" data-pf-ann="${i}">${SG[i].e} ${SG[i].n}</button>`).join("")}</div>
          <div class="pf-picks">${[0, 1, 2].map(i => `<button type="button" class="pf-pick" data-pf-pick="${i}" aria-label="${SG[i].n}">${armSVG(i, mySeat, true)}<b>${SG[i].n.toUpperCase()}</b><small>${SG[i].g}</small></button>`).join("")}</div>`}
        </div></div>`;
      const q = id => main.querySelector("#" + id);
      Dx = {x: m.x, pr, bi, ti, spect, ph: "", beat: -1, revU: -1, overDone: false, armSig: {t: -1, b: -1}, pose: {t: "", b: ""},
        root: q("pf-duel"), arena: q("pf-arena"), word: q("pf-word"), sub: q("pf-sub"), bdg: q("pf-bdg"), hint: q("pf-hint"), k: q("pf-k"),
        arm: {t: q("pf-arm-t"), b: q("pf-arm-b")}, sg: {t: q("pf-sg-t"), b: q("pf-sg-b")}, av: {t: q("pf-av-t"), b: q("pf-av-b")},
        pp: {t: q("pf-pp-t"), b: q("pf-pp-b")}, an: {t: q("pf-an-t"), b: q("pf-an-b")}, side: {t: q("pf-side-t"), b: q("pf-side-b")},
        flash: q("pf-flash"), annrow: q("pf-annrow"), picks: [...main.querySelectorAll("[data-pf-pick]")], anns: [...main.querySelectorAll("[data-pf-ann]")]};
      setArm("t", 0); setArm("b", 0);
    }
    const posOf = i => (i === Dx.bi ? "b" : "t");
    function setArm(pos, sign, cls) {
      const s = Dx.pr[pos === "b" ? Dx.bi : Dx.ti];
      if (Dx.armSig[pos] !== sign) { Dx.armSig[pos] = sign; Dx.arm[pos].innerHTML = armSVG(sign, s, false); }
      Dx.arm[pos].classList.remove("pump", "slam", "wait", "dim");
      if (cls && !RM) { void Dx.arm[pos].offsetWidth; Dx.arm[pos].classList.add(cls); }
      else if (cls === "dim") Dx.arm[pos].classList.add("dim");
    }
    function setPose(pos, pose) {
      if (Dx.pose[pos] === pose) return;
      Dx.pose[pos] = pose;
      const s = Dx.pr[pos === "b" ? Dx.bi : Dx.ti], a = Dx.av[pos];
      a.innerHTML = bust(s, pose === "win" ? "flex" : "idle");
      a.classList.toggle("win", pose === "win"); a.classList.toggle("lose", pose === "lose");
    }
    function sgTag(pos, sign, rnd) {
      const n = Dx.sg[pos];
      if (sign < 0) { n.classList.remove("on"); return; }
      n.innerHTML = `${SG[sign].e} ${SG[sign].n.toUpperCase()} <small>« ${SG[sign].g} »${rnd ? " · 🎲 Hasard" : ""}</small>`;
      n.classList.add("on");
    }
    function float(target, txt, n) {
      if (!target) return;
      const r = target.getBoundingClientRect(), rr = root.getBoundingClientRect();
      for (let i = 0; i < Math.min(n, 5); i++) {
        const f = document.createElement("div");
        f.className = "pf-fl"; f.textContent = txt[i % txt.length];
        f.style.left = (r.left - rr.left + 20 + Math.random() * Math.max(20, r.width - 60)) + "px";
        f.style.top = (r.top - rr.top + 4 + Math.random() * 20) + "px";
        f.style.animationDelay = (i * 0.12) + "s";
        root.appendChild(f);
        later(() => f.remove(), 1600 + i * 120);
      }
    }

    function myLockTick(m, ph) {
      if (Dx.spect) return;
      if (m.u !== myU) { myU = m.u; myP = -1; myA = -1; Dx.picks.forEach(b => b.classList.remove("sel")); Dx.anns.forEach(b => b.classList.remove("sel")); }
      if (ph === "lock" && lockedU !== m.u && m.w < 0) {
        lockedU = m.u;
        inp.u = m.u; inp.p = myP; inp.a = myA; inp.lk = 1; push();
      }
    }

    function updDuel(m, tl) {
      const ph = phaseOf(m, tl), T = loc(m.T), C = T + (m.an ? ANN : 0);
      const pr = Dx.pr;
      myLockTick(m, ph);
      Dx.root.dataset.ph = ph;
      Dx.root.dataset.u = m.u;
      setT(Dx.k, "Coup " + (ph === "rev" ? m.k - 1 : m.k));
      // scores (pendant la révélation, le point vient d'être compté : on l'affiche avec le reste)
      [0, 1].forEach(i => setH(Dx.pp[posOf(i)], pips(m.s[i], m.tg)));
      // annonces
      [0, 1].forEach(i => {
        const pos = posOf(i), mine = !Dx.spect && pr[i] === mySeat;
        let a = m.A[i];
        if (mine && myA >= 0 && m.an && (ph === "ann" || ph === "cd")) a = myA;
        const html = a >= 0 && ph !== "over" ? `<small>📢 annonce</small>${SG[a].e} ${SG[a].n} !` : "";
        setH(Dx.an[pos], html);
        Dx.an[pos].classList.toggle("on", !!html);
      });
      if (ph !== Dx.ph) {
        const prev = Dx.ph; Dx.ph = ph;
        Dx.bdg.innerHTML = "";
        Dx.word.className = "pf-word";
        if (ph !== "rev" && ph !== "over") {
          setArm("t", 0, ph === "lock" ? "wait" : null);
          setArm("b", !Dx.spect && ph === "lock" && myP >= 0 ? myP : 0, ph === "lock" ? (Dx.spect ? "wait" : "slam") : null);
          sgTag("t", -1); sgTag("b", !Dx.spect && ph === "lock" && myP >= 0 ? myP : -1);
          setPose("t", "idle"); setPose("b", "idle");
        }
        if (ph === "cd") Dx.beat = -1;
        if (ph === "rev" && m.L && Dx.revU !== m.L.u) reveal(m);
        if (ph === "over" && !Dx.overDone) over(m, prev);
      }
      // textes dynamiques
      let hint = "";
      if (ph === "vs") {
        setT(Dx.word, prevWord("vs", m));
        setT(Dx.sub, "Début dans " + Math.max(1, Math.ceil((T - tl) / 1000)) + "…");
        hint = Dx.spect ? "👀 Vous regardez ce duel" : "Échauffez vos poignets…";
      } else if (ph === "ann") {
        setT(Dx.word, "📢 Annonces ?");
        setT(Dx.sub, "Décompte dans " + Math.max(1, Math.ceil((C - tl) / 1000)) + "…");
        if (!Dx.spect) hint = myA >= 0 ? `Annoncé : ${SG[myA].e} ${SG[myA].n}. Gagnez avec = +1 point bonus !` : "Facultatif : annoncez un signe. Gagner avec = +1 point bonus !";
      } else if (ph === "cd") {
        const b = Math.min(3, Math.floor((tl - C) / BEAT));
        if (b !== Dx.beat) {
          Dx.beat = b;
          setT(Dx.word, ["Pierre…", "Feuille…", "Ciseaux…", "Chi-fou-mi !"][b]);
          restart(Dx.word, "go");
          if (b === 3) Dx.word.classList.add("big");
          setArm("t", 0, "pump"); setArm("b", 0, "pump");
          sfx.beat(b);
        }
        setT(Dx.sub, m.an ? "" : "Égalité : on rejoue !");
        if (!Dx.spect) hint = myP >= 0 ? `Votre choix : ${SG[myP].e} ${SG[myP].n} (modifiable jusqu'à « MI ! »)` : "Choisissez avant « CHI-FOU-MI ! »";
      } else if (ph === "lock") {
        setT(Dx.word, "Chi-fou-mi !");
        Dx.word.classList.add("big");
        setT(Dx.sub, "");
        if (!Dx.spect) hint = myP >= 0 ? `Verrouillé : ${SG[myP].e} ${SG[myP].n}` : "Trop tard : 🎲 Hasard !";
      }
      if (ph === "rev" || ph === "over") hint = Dx.hintFix || "";
      setT(Dx.hint, hint || (Dx.spect ? "👀 Vous regardez ce duel" : ""));
      if (!Dx.spect) {
        const canPick = ph === "ann" || ph === "cd";
        Dx.picks.forEach((b, i) => { b.disabled = !canPick; b.classList.toggle("sel", myP === i && (canPick || ph === "lock")); });
        const canAnn = ph === "ann" && m.an && myA < 0 && m.A[pr.indexOf(mySeat)] < 0;
        Dx.anns.forEach((b, i) => { b.disabled = !canAnn; b.classList.toggle("sel", myA === i); });
        Dx.annrow.classList.toggle("off", !(ph === "ann" || ph === "vs") || !m.an);
      }
    }
    function prevWord(ph, m) { void ph; return m.k > 1 ? "Prêts ?" : rName(S.rd); }

    function reveal(m) {
      const L = m.L, pr = Dx.pr;
      Dx.revU = L.u;
      [0, 1].forEach(i => { const pos = posOf(i); setArm(pos, L.p[i], "slam"); sgTag(pos, L.p[i], L.r[i]); });
      if (!RM) { restart(Dx.flash, "go"); restart(Dx.arena, "shake"); }
      thud();
      const meI = Dx.spect ? -1 : pr.indexOf(mySeat);
      let badges = "";
      if (L.w < 0) {
        Dx.word.textContent = "Égalité !";
        Dx.sub.textContent = "On rejoue tout de suite !";
        Dx.hintFix = "Même signe des deux côtés…";
        sfx.draw();
      } else {
        const wpos = posOf(L.w), lpos = posOf(1 - L.w), wseat = pr[L.w];
        setPose(wpos, "win"); setPose(lpos, "lose");
        const la = Dx.arm[lpos];
        later(() => { if (la.isConnected && Dx && Dx.revU === L.u) la.classList.add("dim"); }, 420);
        const done = m.w >= 0;
        if (meI >= 0) {
          Dx.word.textContent = L.w === meI ? (done ? "Victoire !" : "Gagné !") : (done ? "Perdu…" : "Raté !");
          Dx.word.classList.add(L.w === meI ? "big" : "lose");
        } else { Dx.word.textContent = nm(wseat).length > 12 ? "Point !" : P[wseat].pseudo + " !"; Dx.word.classList.add("big"); }
        Dx.sub.textContent = WHY[L.p[L.w]];
        Dx.hintFix = L.g > 1 ? `+${L.g} points pour ${P[wseat].pseudo} !` : `+1 point pour ${P[wseat].pseudo}`;
        if (L.c >= 2) badges += `<span class="cb">COMBO ×${L.c} !</span>`;
        if (L.b) badges += `<span class="bl">BLUFF ASSUMÉ ! +1</span>`;
        [0, 1].forEach(i => { if (L.y[i] && i !== L.w) badges += `<span class="ly">${esc(P[pr[i]].pseudo)} a bluffé…</span>`; });
        if (meI >= 0) (L.w === meI ? sfx.win : sfx.lose)(); else sfx.win();
        if (L.c >= 2 || L.b) sfx.combo();
        if (!RM && meI >= 0 && L.w !== meI) float(Dx.side[lpos], ["💨"], 2);
      }
      Dx.bdg.innerHTML = badges;
      restart(Dx.word, "go");
    }
    function over(m, prev) {
      Dx.overDone = true;
      const pr = Dx.pr, wi = pr.indexOf(m.w), wpos = posOf(wi), lpos = posOf(1 - wi);
      const meI = Dx.spect ? -1 : pr.indexOf(mySeat);
      const isFinal = S.rd === S.nr - 1;
      setPose(wpos, "win"); setPose(lpos, "lose");
      if (prev !== "rev") { setArm(wpos, 0, "slam"); setArm(lpos, 0, "dim"); sgTag("t", -1); sgTag("b", -1); }
      Dx.word.className = "pf-word go";
      if (meI >= 0) {
        Dx.word.textContent = wi === meI ? (isFinal ? (N === 2 ? "Victoire !" : "Champion·ne !") : "Qualifié·e !") : "Éliminé·e";
        Dx.word.classList.add(wi === meI ? "big" : "lose");
      } else { Dx.word.textContent = isFinal ? "Victoire !" : "Qualifié·e !"; Dx.word.classList.add("big"); }
      Dx.sub.textContent = m.f ? `Forfait de ${P[pr[m.f - 1]].pseudo} (déconnecté·e)` : `${P[m.w].pseudo} gagne ${Math.max(m.s[0], m.s[1])}–${Math.min(m.s[0], m.s[1])}`;
      Dx.hintFix = isFinal ? "" : (meI >= 0 && wi !== meI ? "Restez pour encourager les autres !" : "");
      Dx.bdg.innerHTML = meI >= 0 && !isFinal ? `<span class="bl" style="cursor:pointer">→ Tableau</span>` : "";
      if (meI >= 0) (wi === meI ? sfx.win : sfx.lose)();
    }

    /* ----- tableau (spectateurs, éliminés, en attente) ----- */
    function myStatus() {
      if (mySeat < 0) return "👀 Vous êtes spectateur : suivez les duels et encouragez !";
      for (let r = 0; r <= S.rd; r++) {
        for (let x = 0; x < S.bk[r].length; x++) {
          const pr = S.bk[r][x], res = S.rs[r][x];
          if (!pr.includes(mySeat)) continue;
          const i = pr.indexOf(mySeat), o = pr[1 - i];
          if (o === -1) { if (r === S.rd) return "🛋️ Exempté·e du premier tour : vous êtes qualifié·e, profitez du spectacle !"; continue; }
          if (res[2] >= 0 && res[2] !== mySeat) return `💀 Éliminé·e par <b>${nm(o)}</b> (${res[i]}–${res[1 - i]}${res[3] === 1 ? ", forfait" : ""}). Encouragez les survivants !`;
          if (r === S.rd) {
            if (res[2] === mySeat) return r === S.nr - 1 ? "🏆 Vous avez gagné !" : `✅ Qualifié·e pour ${S.nr - 2 - r === 0 ? "la finale" : S.nr - 2 - r === 1 ? "les demi-finales" : "le tour suivant"} ! Petite pause protéinée…`;
            return `🔥 Votre duel contre <b>${nm(o)}</b> est en cours`;
          }
        }
      }
      return "💪 Encouragez les combattants !";
    }
    function buildHub() {
      main.innerHTML = `<div class="pf-scroll">
        <div class="pf-hh"><h2>${rName(S.rd, true)}</h2><div class="pf-tag" id="pf-hn"></div></div>
        <div class="pf-box" id="pf-me" style="text-align:center"></div>
        <div class="pf-live" id="pf-live">${S.m.map(m => {
          const pr = pairOf(m);
          const cp = (i, r) => `<div class="pf-cp${r ? " r" : ""}" id="pf-cp-${m.x}-${i}"><span class="pf-av">${bust(pr[i])}</span><div><div class="pf-nm">${nm(pr[i])}${pr[i] === mySeat ? " <i>(vous)</i>" : ""}</div><div class="pf-pips" id="pf-cpp-${m.x}-${i}"></div></div></div>`;
          const ch = api.isPlayer;
          return `<div class="pf-card${pr.includes(mySeat) ? " mine" : ""}" id="pf-card-${m.x}"><div class="pf-cr">${cp(0, 0)}<div class="pf-cvs">VS</div>${cp(1, 1)}</div>
            <div class="pf-cst" id="pf-cst-${m.x}"></div>
            <div class="pf-cbt">${ch ? `<button type="button" class="ch" data-pf-cheer="${pr[0]}" aria-label="Encourager ${nm(pr[0])}">💪</button>` : "<span></span>"}<button type="button" data-pf-watch="${m.x}" id="pf-cw-${m.x}">👀 Regarder</button>${ch ? `<button type="button" class="ch" data-pf-cheer="${pr[1]}" aria-label="Encourager ${nm(pr[1])}">💪</button>` : "<span></span>"}</div></div>`;
        }).join("")}</div>
        ${N > 2 ? `<div class="pf-h3">Tableau</div><div id="pf-bkw" style="width:min(100%,540px)"></div>` : ""}
      </div>`;
      Hx = {rd: S.rd, me: main.querySelector("#pf-me"), hn: main.querySelector("#pf-hn"), bk: main.querySelector("#pf-bkw")};
    }
    function cardStatus(m, ph, pr) {
      if (ph === "over") return m.f ? `Forfait de ${nm(pr[m.f - 1])}` : `🏅 ${nm(m.w)} gagne ${Math.max(...m.s)}–${Math.min(...m.s)}`;
      if (ph === "vs") return "Échauffement…";
      if (ph === "ann") { const a = m.A.map((v, i) => (v >= 0 ? `${nm(pr[i])} annonce ${SG[v].e}` : "")).filter(Boolean).join(" · "); return a || "📢 Annonces…"; }
      if (ph === "cd" || ph === "lock") return "✊ Chi-fou-mi…";
      if (ph === "rev" && m.L) return m.L.w < 0 ? `Égalité ${SG[m.L.p[0]].e}${SG[m.L.p[1]].e} !` : `${SG[m.L.p[0]].e} vs ${SG[m.L.p[1]].e} : point pour ${nm(pr[m.L.w])}${m.L.c >= 2 ? " · COMBO" : ""}${m.L.b ? " · BLUFF +1" : ""}`;
      return "";
    }
    function updHub(tl) {
      const live = S.m.filter(m => m.w < 0).length;
      setT(Hx.hn, live ? `${live} duel${live > 1 ? "s" : ""} en cours` : "Tour terminé · suite imminente");
      setH(Hx.me, myStatus());
      S.m.forEach(m => {
        const pr = pairOf(m), ph = phaseOf(m, tl);
        [0, 1].forEach(i => {
          setH(main.querySelector(`#pf-cpp-${m.x}-${i}`), pips(m.s[i], m.tg));
          const c = main.querySelector(`#pf-cp-${m.x}-${i}`);
          if (c) { c.classList.toggle("w", m.w >= 0 && m.w === pr[i]); c.classList.toggle("l", m.w >= 0 && ph === "over" && m.w !== pr[i]); }
        });
        setH(main.querySelector(`#pf-cst-${m.x}`), cardStatus(m, ph, pr));
        const card = main.querySelector(`#pf-card-${m.x}`); if (card) card.classList.toggle("done", ph === "over");
        const wb = main.querySelector(`#pf-cw-${m.x}`);
        if (wb) { const mine = pr.includes(mySeat); wb.disabled = mine && m.w >= 0; setT(wb, mine ? (m.w >= 0 ? "✔ Match terminé" : "👀 Revenir à mon duel") : "👀 Regarder"); }
      });
      if (Hx.bk) setH(Hx.bk, bracketHTML());
    }

    /* ----- fin ----- */
    function buildEnd() {
      const rk = S.rk || [], ch = rk[0];
      const label = s => {
        let out = -1;
        S.bk.forEach((rd, r) => rd.forEach((pr, x) => { const res = S.rs[r][x]; if (pr.includes(s) && res[2] >= 0 && res[2] !== s && pr[0] >= 0 && pr[1] >= 0) out = r; }));
        if (s === ch) return N === 2 ? "Vainqueur" : "Champion·ne";
        const fe = S.nr - 1 - out;
        return N === 2 ? "Vaincu·e" : fe === 0 ? "Finaliste" : fe === 1 ? "Demi-finale" : fe === 2 ? "Quart de finale" : "1er tour";
      };
      const fin = S.rs[S.nr - 1][0], fpr = S.bk[S.nr - 1][0];
      const sc = fpr[0] === ch ? `${fin[0]}–${fin[1]}` : `${fin[1]}–${fin[0]}`;
      const stats = [];
      if (S.sb && S.sb.c >= 2 && P[S.sb.cs]) stats.push(`🔥 Combo record : ×${S.sb.c} (${nm(S.sb.cs)})`);
      if (S.sb && S.sb.b) stats.push(`📢 ${S.sb.b} bluff${S.sb.b > 1 ? "s" : ""} assumé${S.sb.b > 1 ? "s" : ""}`);
      main.innerHTML = `<div class="pf-scroll">
        <h1 class="pf-title">${N === 2 ? "Roi du chi-fou-mi" : "Champion·ne !"}</h1>
        <div class="pf-crown" aria-hidden="true">👑</div>
        <div class="pf-hero"><div class="pf-rays"></div><div style="position:relative;width:100%;height:100%">${ch >= 0 ? api.avatar(P[ch].key, {pose: "flex"}) : ""}</div></div>
        <div class="pf-tag" style="font-size:1.3rem">${ch >= 0 ? nm(ch) : "?"} · ${N === 2 ? "duel" : "finale"} ${sc}${fin[3] === 1 ? " (forfait)" : ""}</div>
        ${stats.length ? `<div class="pf-box" style="text-align:center">${stats.join("<br>")}</div>` : ""}
        <div class="pf-rk">${rk.map((s, k) => `<div class="pf-rr${k === 0 ? " p1" : ""}${s === mySeat ? " mine" : ""}" style="animation-delay:${k * 80}ms"><span class="pl">${k < 3 ? ["🥇", "🥈", "🥉"][k] : k + 1}</span><span class="pf-av">${bust(s, k === 0 ? "flex" : "idle")}</span><span class="pf-nm">${nm(s)}${s === mySeat ? " <i>(vous)</i>" : ""}</span><span class="lb">${label(s)}</span></div>`).join("")}</div>
        ${N > 2 ? bracketHTML() : ""}
      </div>`;
      if (mySeat >= 0 && mySeat === ch) later(sfx.win, 200);
    }

    /* ----- boucle d'affichage ----- */
    function tick() {
      if (dead || !S) return;
      const tl = Date.now();
      if (S.rd !== lastRd) { lastRd = S.rd; watchX = null; }
      let key, m = null, spect = false;
      if (S.ph === "intro") key = "intro";
      else if (S.ph === "end") key = "end";
      else {
        const ms = S.m || [];
        const mine = mySeat >= 0 ? ms.find(q => pairOf(q).includes(mySeat)) : null;
        if (mine && skipMine !== S.rd + ":" + mine.x && !(mine.w >= 0 && tl >= loc(mine.T) + OVER_HOLD)) m = mine;
        else {
          let w = watchX != null ? ms.find(q => q.x === watchX && q !== mine) : null;
          if (!w && noAuto !== S.rd) { const lv = ms.filter(q => q !== mine && (q.w < 0 || tl < loc(q.T) + OVER_HOLD)); if (lv.length === 1) w = lv[0]; }
          if (w) { m = w; spect = true; }
        }
        key = m ? `duel:${S.rd}:${m.x}:${spect ? 1 : 0}` : `hub:${S.rd}`;
      }
      if (key !== view) {
        view = key; Dx = null; Hx = null;
        el.scrollTop = 0;
        root.classList.toggle("pf-fix", !!m);
        if (key === "intro") buildIntro();
        else if (key === "end") buildEnd();
        else if (m) buildDuel(m, spect);
        else buildHub();
      }
      if (Dx && m) updDuel(m, tl);
      if (Hx) updHub(tl);
      // encouragements reçus
      if (S.cr) S.cr.forEach((n, s) => {
        if (crSeen[s] >= 0 && n > crSeen[s]) {
          let tgt = null;
          if (Dx) { const i = Dx.pr.indexOf(s); if (i >= 0) tgt = Dx.side[posOf(i)]; }
          else if (Hx && S.m) { const mm = S.m.find(q => pairOf(q).includes(s)); if (mm) tgt = main.querySelector(`#pf-cp-${mm.x}-${pairOf(mm).indexOf(s)}`); }
          if (tgt && !RM) float(tgt, ["💪", "🔥", "👏"], n - crSeen[s]);
        }
        crSeen[s] = n;
      });
    }
    api.onState(s => {
      if (dead || !s || !s.ph) return;
      sampleClock(s.t);
      S = s;
      tick();
    });
    const tickInt = setInterval(tick, 50);

    /* ----- actions ----- */
    function curMine() { return S && S.m ? S.m.find(q => pairOf(q).includes(mySeat)) : null; }
    function doPick(i) {
      if (!Dx || Dx.spect) return;
      const m = curMine(); if (!m) return;
      const ph = phaseOf(m, Date.now());
      if (ph !== "ann" && ph !== "cd") return;
      myP = i; myU = m.u;
      inp.u = m.u; inp.p = i; inp.a = myA; inp.lk = 0; push();
      Dx.picks.forEach((b, k) => b.classList.toggle("sel", k === i));
      sfx.pick();
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* rien */ }
      tick();
    }
    function doAnn(i) {
      if (!Dx || Dx.spect) return;
      const m = curMine(); if (!m) return;
      if (phaseOf(m, Date.now()) !== "ann" || !m.an || myA >= 0) return;
      myA = i; myU = m.u;
      inp.u = m.u; inp.a = i; inp.p = myP; inp.lk = 0; push();
      sfx.pick();
      tick();
    }
    function doCheer(s) {
      if (!api.isPlayer || !(s >= 0 && s < N)) return;
      inp.cc[s] = (inp.cc[s] || 0) + 1; push();
      sfx.cheer();
    }
    function onClick(e) {
      ensureAudio();
      const t = e.target.closest ? e.target.closest("[data-pf-pick],[data-pf-ann],[data-pf-watch],[data-pf-back],[data-pf-cheer],.pf-badges .bl") : null;
      if (!t) return;
      if (t.dataset.pfPick != null) doPick(+t.dataset.pfPick);
      else if (t.dataset.pfAnn != null) doAnn(+t.dataset.pfAnn);
      else if (t.dataset.pfCheer != null) {
        doCheer(+t.dataset.pfCheer);
        if (!RM) float(t, ["💪"], 1);
      } else if (t.dataset.pfWatch != null) {
        const x = +t.dataset.pfWatch, mm = S && S.m ? S.m.find(q => q.x === x) : null;
        if (mm && pairOf(mm).includes(mySeat)) skipMine = ""; else { watchX = x; }
        tick();
      } else if (t.dataset.pfBack != null) { watchX = null; noAuto = S ? S.rd : -1; tick(); }
      else if (t.classList.contains("bl") && Dx && !Dx.spect && Dx.ph === "over") { skipMine = S.rd + ":" + Dx.x; tick(); }
    }
    root.addEventListener("click", onClick);
    const onDown = () => ensureAudio();
    root.addEventListener("pointerdown", onDown);
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = (e.key || "").toLowerCase();
      const i = k === "1" || k === "p" ? 0 : k === "2" || k === "f" ? 1 : k === "3" || k === "c" ? 2 : -1;
      if (i < 0 || !Dx || Dx.spect) return;
      ensureAudio();
      doPick(i);
    }
    window.addEventListener("keydown", onKey);

    return {
      destroy() {
        dead = true;
        timers.forEach(clearTimeout); timers.clear();
        clearInterval(tickInt);
        if (hostLoop) clearInterval(hostLoop);
        window.removeEventListener("keydown", onKey);
        root.removeEventListener("click", onClick);
        root.removeEventListener("pointerdown", onDown);
        if (actx) { try { actx.close(); } catch (e) { /* rien */ } actx = null; }
        el.innerHTML = "";
      }
    };
  }
});
