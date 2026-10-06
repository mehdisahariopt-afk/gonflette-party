/* Gonflette Party : Uno muscu (2 à 6 joueurs, chacun sur son téléphone).
   Uno simplifié en une manche. L'hôte garde la pioche, la défausse et toutes les mains en mémoire.
   L'état publié ne contient que l'info publique + chaque main encodée (1 caractère par carte, brouillé
   par joueur) : chaque téléphone ne décode et n'affiche QUE sa propre main.
   Codes cartes : couleur r/y/g/b + valeur 0-9, D (+2), R (Inversion), S (Passe) ; jokers "wJ" et "w4". */
GONFLETTE.registerGame({
  id: "uno",
  name: "Uno muscu",
  min: 2,
  max: 6,
  create(api) {
    const el = api.el, P = api.players, N = P.length;
    const seatOf = k => P.findIndex(p => p.key === k);
    const mySeat = api.isPlayer ? seatOf(api.me) : -1;
    const esc = t => String(t).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
    const UNO_MS = 3000;

    /* ---------- Cartes : codage ---------- */
    const COLS = "rygb";          // ordre d'affichage : rouge, jaune, vert, bleu
    const VALS = "0123456789DRS";
    const ALL = [];
    for (const c of COLS) for (const v of VALS) ALL.push(c + v);
    ALL.push("wJ", "w4");
    const AL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    function salt(seat) {
      let h = 2166136261;
      const s = P[seat].key + "|" + api.seed + "|" + seat;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0) % 64;
    }
    const SALT = P.map((p, i) => salt(i));
    const encHand = (hand, seat) => hand.map((c, i) => AL[(ALL.indexOf(c) + SALT[seat] + i * 11) % 64]).join("");
    const decHand = (str, seat) => [...(str || "")].map((ch, i) => ALL[((AL.indexOf(ch) - SALT[seat] - i * 11) % 64 + 128) % 64]).filter(Boolean);
    const COLNAME = {r: "Rouge", y: "Jaune", g: "Vert", b: "Bleu"};
    const COLHEX = {r: "#e8383d", y: "#f6b81a", g: "#25a35a", b: "#2f6bdc"};
    const points = c => c[0] === "w" ? 50 : /\d/.test(c[1]) ? +c[1] : 20;
    const canPlay = (c, top, col) => c[0] === "w" || c[0] === col || (top[0] !== "w" && c[1] === top[1]);
    const cardName = c => c === "wJ" ? "Joker" : c === "w4" ? "Joker +4" :
      COLNAME[c[0]] + " " + (c[1] === "D" ? "+2" : c[1] === "R" ? "Inversion" : c[1] === "S" ? "Passe" : c[1]);

    /* ---------- Icônes SVG (originales, thème salle de sport) ---------- */
    const ICON = {
      D: '<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><rect x="2" y="14" width="5" height="12" rx="1.6"/><rect x="7.5" y="9" width="6.5" height="22" rx="2.2"/><rect x="14" y="18" width="12" height="4" rx="1"/><rect x="26" y="9" width="6.5" height="22" rx="2.2"/><rect x="33" y="14" width="5" height="12" rx="1.6"/></svg>',
      K: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12.5 19C10 6 30 6 27.5 19" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/><path d="M9 26a11 11 0 0 1 22 0c0 4.5-1.7 8-3.6 10H12.6C10.7 34 9 30.5 9 26z" fill="currentColor"/></svg>',
      R: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18A13 13 0 0 1 29.5 9.5"/><path d="M30.5 3v7.5H23"/><path d="M33 22A13 13 0 0 1 10.5 30.5"/><path d="M9.5 37v-7.5H17"/></svg>',
      S: '<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><rect x="11.2" y="7" width="5" height="17" rx="2.5"/><rect x="16.8" y="3.5" width="5" height="20" rx="2.5"/><rect x="22.4" y="5" width="5" height="19" rx="2.5"/><rect x="28" y="9" width="4.6" height="16" rx="2.3"/><path d="M11.2 19h21.4v7.5c0 6.8-4.6 11-10.8 11-4.6 0-7.4-2-9.6-5.6L6.4 24a2.6 2.6 0 0 1 4.2-3l.6.8z"/></svg>',
      P: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 20V2a18 18 0 0 1 18 18z" fill="#e8383d"/><path d="M20 20h18a18 18 0 0 1-18 18z" fill="#f6b81a"/><path d="M20 20v18A18 18 0 0 1 2 20z" fill="#25a35a"/><path d="M20 20H2A18 18 0 0 1 20 2z" fill="#2f6bdc"/><circle cx="20" cy="20" r="12.5" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.2"/><circle cx="20" cy="20" r="5.2" fill="#f2ead9" stroke="#1d1420" stroke-width="2"/></svg>'
    };
    function corner(c) {
      const v = c[1];
      if (c === "w4") return "+4";
      if (c === "wJ") return '<i class="uno-mini">' + ICON.P + "</i>";
      if (v === "D") return "+2";
      if (v === "R" || v === "S") return '<i class="uno-mini">' + ICON[v] + "</i>";
      return v;
    }
    function center(c) {
      const v = c[1];
      if (c === "wJ") return `<span class="uno-rainbow">${ICON.P}</span>`;
      if (c === "w4") return `<span class="uno-plate uno-pw">${ICON.K}<b class="uno-ptxt">+4</b></span>`;
      if (v === "D") return `<span class="uno-plate">${ICON.D}<b class="uno-ptxt">+2</b></span>`;
      if (v === "R" || v === "S") return `<span class="uno-plate">${ICON[v]}</span>`;
      return `<span class="uno-plate"><b class="uno-big${v === "6" || v === "9" ? " ul" : ""}">${v}</b></span>`;
    }
    function cardHTML(c, extra = "", tag = "div", attrs = "") {
      const k = c[0] === "w" ? "w" : c[0];
      return `<${tag} class="uno-card uno-c-${k}${extra ? " " + extra : ""}" ${attrs} aria-label="${cardName(c)}"><span class="uno-cn">${corner(c)}</span>${center(c)}<span class="uno-cn b">${corner(c)}</span></${tag}>`;
    }
    const backHTML = (extra = "") => `<div class="uno-card uno-back${extra ? " " + extra : ""}" aria-hidden="true"><span class="uno-bk">${ICON.D}<i>muscu</i></span></div>`;

    /* ================= Interface ================= */
    el.innerHTML = `<style>
      .uno{--cw:70px;--ink:#17121c;--cream:#f4ecdb;position:relative;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;padding:8px 12px 0;color:var(--cream);
        font-family:"Barlow Condensed",system-ui,sans-serif;font-size:17px;line-height:1.15;overflow:hidden;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;
        background:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1.4px) 0 0/9px 9px,radial-gradient(rgba(0,0,0,.35) 1px,transparent 1.4px) 4px 5px/11px 11px,linear-gradient(#24222b,#141318)}
      .uno *{box-sizing:border-box}
      .uno button{font-family:inherit;color:inherit}
      /* adversaires */
      .uno-opps{display:flex;justify-content:center;gap:6px}
      .uno-opp{position:relative;flex:1 1 0;min-width:0;max-width:112px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 3px 4px;border-radius:14px;
        background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.1);transition:border-color .25s,box-shadow .25s,transform .25s}
      .uno-opp.on{border-color:#ffcc33;box-shadow:0 0 0 3px rgba(255,204,51,.25),0 0 22px rgba(255,204,51,.45);transform:translateY(2px)}
      .uno-opp.out{opacity:.35;filter:grayscale(1)}
      .uno-oav{width:46px;height:46px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#4a3b56,#221a29);border:2px solid rgba(255,255,255,.25)}
      .uno-opp.on .uno-oav{border-color:#ffcc33;animation:uno-glow 1.2s ease-in-out infinite}
      .uno-oav .av,.uno-mav .av,.uno-rav .av{width:100%;height:100%;display:block}
      .uno-oname{max-width:100%;font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .uno-ocount{display:flex;align-items:center;gap:4px;font-family:Anton,Impact,sans-serif;font-size:1.05rem;line-height:1}
      .uno-mf{position:relative;width:20px;height:18px}
      .uno-mf i{position:absolute;left:4px;top:0;width:11px;height:16px;border-radius:3px;background:#2b2033;border:1.5px solid #ffcc33;transform-origin:50% 100%}
      .uno-mf i:nth-child(1){transform:rotate(-18deg)}.uno-mf i:nth-child(3){transform:rotate(18deg)}
      .uno-badge{position:absolute;top:-7px;right:-4px;background:#e8383d;color:#fff;font-family:Anton,Impact,sans-serif;font-size:.78rem;padding:1px 6px;border-radius:999px;border:2px solid var(--ink);transform:rotate(8deg);display:none}
      .uno-opp.uno1 .uno-badge{display:block;animation:uno-pop .3s}
      .uno-opp.wait .uno-badge{display:block;background:#ffcc33;color:var(--ink)}
      .uno-flow{display:flex;align-items:center;justify-content:center;gap:6px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(244,236,219,.6);height:16px}
      .uno-flow svg{width:64px;height:12px;transition:transform .4s}
      .uno-flow.rev svg{transform:scaleX(-1)}
      /* table = plateforme d'haltérophilie */
      .uno-table{position:relative;flex:1 1 auto;min-height:190px;max-height:380px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:26px;
        background:linear-gradient(90deg,#2a2830 0 16%,#0e0d11 16% 17%,transparent 17% 83%,#0e0d11 83% 84%,#2a2830 84%),repeating-linear-gradient(90deg,#b98a52 0 22px,#a77a45 22px 23px,#c39561 23px 47px,#9f733f 47px 48px);
        box-shadow:inset 0 0 0 4px #0e0d11,inset 0 0 40px rgba(0,0,0,.55),0 10px 24px rgba(0,0,0,.45)}
      .uno-ring{position:absolute;left:50%;top:50%;width:min(78%,250px);aspect-ratio:1;translate:-50% -50%;pointer-events:none;opacity:.5;animation:uno-spin 14s linear infinite}
      .uno-ring.rev{animation-direction:reverse}
      .uno-ring svg{width:100%;height:100%}
      .uno-ring.rev svg{transform:scaleX(-1)}
      .uno-pile,.uno-disc{position:relative;width:calc(var(--cw)*1.12);height:calc(var(--cw)*1.62)}
      .uno-pile{border:0;padding:0;background:none;cursor:pointer;border-radius:14px}
      .uno-pile .uno-card{position:absolute;left:0;top:0}
      .uno-pile .uno-card:nth-child(1){transform:translate(5px,6px) rotate(4deg)}
      .uno-pile .uno-card:nth-child(2){transform:translate(2px,3px) rotate(-3deg)}
      .uno-pile.can .uno-card:nth-child(3){animation:uno-beckon 1.1s ease-in-out infinite}
      .uno-pcount{position:absolute;left:50%;bottom:-10px;translate:-50% 0;background:var(--ink);color:#ffcc33;font-family:Anton,Impact,sans-serif;font-size:.85rem;padding:1px 8px;border-radius:999px;border:2px solid #ffcc33;z-index:3;white-space:nowrap}
      .uno-disc .uno-card{position:absolute;left:0;top:0}
      .uno-disc .uno-card.top{box-shadow:0 0 0 4px var(--cc,#fff),0 0 26px 6px var(--cc,#fff),0 6px 0 rgba(0,0,0,.35)}
      .uno-disc .uno-card.land-me{animation:uno-land-me .45s cubic-bezier(.2,.9,.3,1.2)}
      .uno-disc .uno-card.land-op{animation:uno-land-op .45s cubic-bezier(.2,.9,.3,1.2)}
      .uno-colchip{position:absolute;left:50%;bottom:8px;translate:-50% 0;display:flex;align-items:center;gap:6px;background:rgba(14,13,17,.82);padding:3px 10px 3px 4px;border-radius:999px;font-weight:700;font-size:.9rem;white-space:nowrap}
      .uno-colchip i{width:16px;height:16px;border-radius:50%;background:var(--cc);border:2px solid #fff}
      .uno-shout{position:absolute;left:50%;top:50%;translate:-50% -50%;z-index:6;pointer-events:none;font-family:Anton,Impact,sans-serif;font-size:3.2rem;line-height:1;color:#fff;text-align:center;
        -webkit-text-stroke:2px var(--ink);text-shadow:4px 4px 0 #e8383d,8px 8px 0 var(--ink);opacity:0;white-space:nowrap}
      .uno-shout small{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:1.05rem;-webkit-text-stroke:0;text-shadow:0 2px 4px #000;margin-top:6px}
      .uno-shout.go{animation:uno-shout 1.5s ease-out}
      /* cartes */
      .uno-card{--h:calc(var(--cw)*1.45);position:relative;flex:none;width:var(--cw);height:var(--h);border-radius:calc(var(--cw)*.17);padding:0;display:block;
        background:var(--k);border:calc(var(--cw)*.055) solid #fbf6ea;box-shadow:0 3px 0 rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.35);overflow:hidden;color:#fff;font-family:Anton,Impact,sans-serif}
      .uno-card::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 3px,transparent 3px 9px);pointer-events:none}
      .uno-c-r{--k:#e8383d;--kd:#9e1d22}.uno-c-y{--k:#f6b81a;--kd:#a8700a}.uno-c-g{--k:#25a35a;--kd:#11633a}.uno-c-b{--k:#2f6bdc;--kd:#163f92}
      .uno-c-w{--k:#1d1420;--kd:#000}
      .uno-c-w::before{background:conic-gradient(from 45deg,#e8383d 0 25%,#f6b81a 0 50%,#25a35a 0 75%,#2f6bdc 0);opacity:.22}
      .uno-cn{position:absolute;left:calc(var(--cw)*.07);top:calc(var(--cw)*.03);font-size:calc(var(--cw)*.27);line-height:1.1;text-shadow:1px 1px 0 var(--kd);z-index:1}
      .uno-cn.b{left:auto;top:auto;right:calc(var(--cw)*.07);bottom:calc(var(--cw)*.03);transform:rotate(180deg)}
      .uno-mini{display:inline-block;width:calc(var(--cw)*.24);height:calc(var(--cw)*.24);vertical-align:middle}
      .uno-mini svg{width:100%;height:100%;display:block;filter:drop-shadow(1px 1px 0 var(--kd))}
      .uno-plate{position:absolute;left:50%;top:50%;width:calc(var(--cw)*.74);aspect-ratio:1;translate:-50% -50%;border-radius:50%;display:grid;place-items:center;
        background:radial-gradient(circle,#fbf6ea 0 54%,var(--kd) 55% 60%,#fbf6ea 61% 100%);box-shadow:0 0 0 calc(var(--cw)*.035) var(--kd),inset 0 -3px 0 rgba(0,0,0,.12);color:var(--k)}
      .uno-plate svg{width:58%;height:58%;grid-area:1/1;filter:drop-shadow(1px 1px 0 var(--kd))}
      .uno-plate:has(.uno-ptxt){display:flex;flex-direction:column;align-items:center;justify-content:center}
      .uno-plate:has(.uno-ptxt) svg{width:50%;height:auto;margin-top:-6%}
      .uno-ptxt{font-weight:400;font-size:calc(var(--cw)*.19);color:var(--kd);line-height:.9;margin-top:-1px}
      .uno-pw .uno-ptxt{color:#ffcc33}
      .uno-pw{color:#fbf6ea;background:radial-gradient(circle,#2b2033 0 60%,#fbf6ea 61%)}
      .uno-pw svg{filter:drop-shadow(0 0 3px rgba(255,204,51,.7))}
      .uno-big{font-weight:400;font-size:calc(var(--cw)*.46);line-height:1;color:var(--k);-webkit-text-stroke:1.5px var(--kd);text-shadow:2px 2px 0 var(--kd)}
      .uno-big.ul{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:2px}
      .uno-rainbow{position:absolute;left:50%;top:50%;width:calc(var(--cw)*.76);aspect-ratio:1;translate:-50% -50%;border-radius:50%;box-shadow:0 0 0 3px #fbf6ea,0 0 0 5px var(--ink)}
      .uno-rainbow svg{width:100%;height:100%;display:block;animation:uno-spin 9s linear infinite}
      .uno-back{--k:#2b2033;--kd:#000;background:repeating-linear-gradient(45deg,rgba(255,204,51,.12) 0 2px,transparent 2px 6px),repeating-linear-gradient(-45deg,rgba(255,204,51,.12) 0 2px,transparent 2px 6px),#2b2033;border-color:#ffcc33}
      .uno-back::before{display:none}
      .uno-bk{position:absolute;inset:16% 10%;border-radius:50%;background:#17121c;border:2px solid #ffcc33;display:grid;place-items:center;align-content:center;color:#ffcc33;transform:rotate(-14deg)}
      .uno-bk svg{width:60%;height:auto}
      .uno-bk i{font-family:Pacifico,cursive;font-style:normal;font-size:calc(var(--cw)*.2);color:#fbf6ea;line-height:1;margin-top:-2px}
      /* événement */
      .uno-ev{min-height:2.4em;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:600;font-size:1rem;padding:0 4px;color:rgba(244,236,219,.85)}
      .uno-ev b{color:#fff}
      /* ma zone */
      .uno-me{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:16px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.1);transition:border-color .25s,box-shadow .25s}
      .uno.mine .uno-me{border-color:#ffcc33;box-shadow:0 0 0 3px rgba(255,204,51,.2),0 0 26px rgba(255,204,51,.4)}
      .uno-me.hit{animation:uno-shake .5s}
      .uno-mav{width:44px;height:44px;flex:none;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#4a3b56,#221a29);border:2px solid rgba(255,255,255,.25)}
      .uno.mine .uno-mav{border-color:#ffcc33}
      .uno-mtxt{flex:1;min-width:0}
      .uno-mtxt b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.15rem;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .uno-mtxt span{display:block;font-size:.9rem;color:rgba(244,236,219,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .uno.mine .uno-mtxt b{color:#ffcc33}
      .uno-btn{flex:none;border:3px solid var(--ink);border-radius:12px;padding:8px 12px;font-weight:800;font-size:1.05rem;text-transform:uppercase;letter-spacing:.03em;background:#f4ecdb;color:var(--ink)!important;box-shadow:0 4px 0 var(--ink);cursor:pointer;min-height:44px}
      .uno-btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
      .uno-btn[disabled]{opacity:.35;cursor:default;box-shadow:0 4px 0 var(--ink);transform:none}
      .uno-btn.go{background:#ffcc33}
      .uno-unob{position:relative;flex:none;width:58px;height:58px;border-radius:50%;border:3px solid var(--ink);background:#e8383d;color:#fff!important;font-family:Anton,Impact,sans-serif;font-size:1.05rem;line-height:1;
        box-shadow:0 4px 0 var(--ink);cursor:pointer;overflow:hidden;padding:0}
      .uno-unob span{position:relative;z-index:1;text-shadow:1px 1px 0 var(--ink)}
      .uno-unob[disabled]{background:#5a4a5f;opacity:.5;cursor:default}
      .uno-unob.armed{background:#25a35a}
      .uno-unob.hot{animation:uno-hot .5s ease-in-out infinite}
      .uno-unob.hot::before{content:"";position:absolute;inset:0;background:conic-gradient(rgba(0,0,0,.45) var(--p,0%),transparent 0)}
      /* main */
      .uno-hand{display:flex;align-items:flex-end;overflow-x:auto;overflow-y:hidden;padding:24px 22px 18px;margin:0 -12px;min-height:calc(var(--cw)*1.45 + 44px);scrollbar-width:none;scroll-snap-type:x proximity}
      .uno-hand::-webkit-scrollbar{display:none}
      .uno-hand.few{justify-content:center}
      .uno-hand .uno-card{cursor:pointer;transform:translateY(calc(var(--y,0px) - var(--lift,0px))) rotate(var(--r,0deg));transform-origin:50% 100%;transition:transform .2s,filter .2s;scroll-snap-align:center;margin-left:var(--ml,4px)}
      .uno-hand .uno-card:first-child{margin-left:0}
      .uno.mine .uno-hand .uno-card{filter:brightness(.6) saturate(.6)}
      .uno.mine .uno-hand .uno-card.uno-ok{--lift:16px;filter:none;box-shadow:0 0 0 3px #ffcc33,0 10px 18px rgba(0,0,0,.45)}
      .uno-hand .uno-card.uno-new{animation:uno-in .45s cubic-bezier(.2,.9,.3,1.2)}
      .uno-hand .uno-card.no{animation:uno-shake .35s}
      .uno-hand .uno-spec{margin:auto;color:rgba(244,236,219,.6);font-size:1rem}
      /* sélecteur de couleur */
      .uno-picker{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(10,8,12,.72);padding:16px}
      .uno-picker.hidden,.uno-end.hidden{display:none}
      .uno-pbox{width:min(100%,340px);background:#231b2b;border:3px solid #ffcc33;border-radius:20px;padding:16px;text-align:center;animation:uno-pop .25s}
      .uno-pbox h3{margin:0 0 12px;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:1.5rem;text-transform:uppercase;letter-spacing:.03em}
      .uno-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .uno-pick{border:3px solid var(--ink);border-radius:16px;padding:12px 6px 8px;background:var(--k);cursor:pointer;display:grid;justify-items:center;gap:4px;box-shadow:0 4px 0 var(--ink);font-weight:800;font-size:1.1rem;text-transform:uppercase;color:#fff!important;text-shadow:1px 1px 0 var(--kd)}
      .uno-pick i{width:46px;height:46px;border-radius:50%;background:radial-gradient(circle,#fbf6ea 0 22%,var(--kd) 23% 30%,var(--k) 31% 100%);box-shadow:0 0 0 3px #fbf6ea}
      .uno-pick:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
      .uno-pcancel{margin-top:12px;background:none;border:0;color:rgba(244,236,219,.7);font-size:1rem;text-decoration:underline;cursor:pointer;padding:8px}
      /* fin */
      .uno-end{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(10,8,12,.8);padding:16px}
      .uno-ebox{width:min(100%,360px);background:#231b2b;border:3px solid #ffcc33;border-radius:22px;padding:14px 14px 16px;text-align:center;animation:uno-pop .35s}
      .uno-ebox h2{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:2.4rem;line-height:1;color:#ffcc33;text-transform:uppercase;text-shadow:3px 3px 0 #e8383d}
      .uno-ewin{width:130px;height:150px;margin:2px auto -4px}
      .uno-ewin .av{width:100%;height:100%}
      .uno-ebox p{margin:4px 0 10px;font-size:1.05rem}
      .uno-rk{list-style:none;margin:0;padding:0;display:grid;gap:5px;text-align:left}
      .uno-rk li{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border-radius:12px;padding:4px 10px 4px 6px}
      .uno-rk li.w{background:rgba(255,204,51,.18)}
      .uno-rk em{font-style:normal;font-family:Anton,Impact,sans-serif;width:1.4em;text-align:center;color:#ffcc33}
      .uno-rav{width:30px;height:30px;border-radius:50%;overflow:hidden;flex:none;background:#3a2d44}
      .uno-rk b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .uno-rk span{font-weight:700;color:rgba(244,236,219,.75);white-space:nowrap}
      @keyframes uno-spin{to{transform:rotate(360deg)}}
      @keyframes uno-glow{50%{box-shadow:0 0 14px #ffcc33}}
      @keyframes uno-pop{from{transform:scale(.6);opacity:0}}
      @keyframes uno-beckon{50%{transform:translateY(-5px)}}
      @keyframes uno-land-me{from{transform:translateY(260px) rotate(-30deg) scale(.8);opacity:.3}}
      @keyframes uno-land-op{from{transform:translateY(-220px) rotate(25deg) scale(.6);opacity:.3}}
      @keyframes uno-in{from{transform:translateY(-120px) rotate(10deg) scale(.7);opacity:0}}
      @keyframes uno-shake{0%,100%{translate:0}20%{translate:-7px 0}40%{translate:6px 0}60%{translate:-4px 0}80%{translate:3px 0}}
      @keyframes uno-hot{50%{transform:scale(1.1);box-shadow:0 4px 0 var(--ink),0 0 0 6px rgba(232,56,61,.35)}}
      @keyframes uno-shout{0%{opacity:0;transform:scale(.3) rotate(-14deg)}18%{opacity:1;transform:scale(1.12) rotate(-5deg)}75%{opacity:1;transform:scale(1) rotate(-5deg)}100%{opacity:0;transform:scale(1.05) rotate(-5deg) translateY(-30px)}}
      @media (min-width:700px){.uno{max-width:640px;margin:0 auto;--cw:84px}}
      @media (max-height:700px){.uno{--cw:60px}.uno-oav{width:38px;height:38px}}
      @media (prefers-reduced-motion:reduce){.uno *,.uno *::before,.uno *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    </style>
    <div class="uno" id="uno-root">
      <div class="uno-opps" id="uno-opps"></div>
      <div class="uno-flow" id="uno-flow"><span>sens</span><svg viewBox="0 0 64 12" aria-hidden="true"><path d="M2 6h56" stroke="currentColor" stroke-width="2.4" stroke-dasharray="5 4"/><path d="M53 1l8 5-8 5z" fill="currentColor"/></svg></div>
      <section class="uno-table" aria-label="Table">
        <div class="uno-ring" id="uno-ring" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#17121c" stroke-width="2.4" stroke-dasharray="10 7"/><path d="M50 1.5l7 3.5-7 3.5z M50 91.5l-7 3.5 7 3.5z M1.5 50l3.5-7 3.5 7z M98.5 50l-3.5 7-3.5-7z" fill="#17121c"/></svg></div>
        <button class="uno-pile" id="uno-pile" type="button" aria-label="Pioche">${backHTML()}${backHTML()}${backHTML()}<span class="uno-pcount" id="uno-pcount">–</span></button>
        <div class="uno-disc" id="uno-disc" aria-label="Défausse"></div>
        <div class="uno-colchip" id="uno-colchip"><i></i><span></span></div>
        <div class="uno-shout" id="uno-shout" aria-hidden="true"></div>
      </section>
      <div class="uno-ev" id="uno-ev" role="status" aria-live="polite">Distribution des cartes…</div>
      <div class="uno-me" id="uno-me">
        <div class="uno-mav" id="uno-mav">${mySeat >= 0 ? api.avatar(api.me, {view: "bust"}) : ""}</div>
        <div class="uno-mtxt"><b id="uno-mname"></b><span id="uno-mstat"></span></div>
        <button class="uno-btn" id="uno-draw" type="button">Piocher</button>
        <button class="uno-unob" id="uno-unob" type="button" aria-label="Crier UNO"><span>UNO !</span></button>
      </div>
      <div class="uno-hand" id="uno-hand" aria-label="Ma main"></div>
      <div class="uno-picker hidden" id="uno-picker" role="dialog" aria-label="Choix de la couleur"><div class="uno-pbox"><h3>Choisis la couleur</h3><div class="uno-pgrid">
        ${[..."rygb"].map(c => `<button type="button" class="uno-pick uno-c-${c}" data-col="${c}"><i></i>${COLNAME[c]}</button>`).join("")}
      </div><button type="button" class="uno-pcancel" id="uno-pcancel">Annuler</button></div></div>
      <div class="uno-end hidden" id="uno-end"></div>
    </div>`;
    const $ = id => el.querySelector("#" + id);
    const root = $("uno-root");
    $("uno-mname").textContent = mySeat >= 0 ? P[mySeat].pseudo : "Spectateur";
    if (mySeat < 0) { $("uno-draw").style.display = "none"; $("uno-unob").style.display = "none"; $("uno-mav").style.display = "none"; }

    /* adversaires, dans l'ordre de jeu à partir de moi */
    const oppSeats = [];
    for (let k = 1; k <= N; k++) { const s = ((mySeat < 0 ? -1 : mySeat) + k + N) % N; if (s !== mySeat) oppSeats.push(s); }
    $("uno-opps").innerHTML = oppSeats.map(s => `<div class="uno-opp" data-s="${s}"><div class="uno-oav">${api.avatar(P[s].key, {view: "bust"})}</div>
      <div class="uno-oname">${esc(P[s].pseudo)}</div><div class="uno-ocount"><span class="uno-mf"><i></i><i></i><i></i></span><b>7</b></div><span class="uno-badge">UNO</span></div>`).join("");
    const oppEl = {};
    el.querySelectorAll(".uno-opp").forEach(o => { oppEl[+o.dataset.s] = o; });

    /* ---------- Son (après un geste) ---------- */
    let actx = null;
    function unlock() {
      if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
      if (actx && actx.state === "suspended") actx.resume().catch(() => {});
    }
    el.addEventListener("pointerdown", unlock);
    function tone(f, at, dur, type = "triangle", vol = .08, slide) {
      if (!actx || actx.state !== "running") return;
      const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + .05);
    }
    const sfx = {
      play: () => { tone(180, 0, .09, "square", .05, 90); tone(520, .02, .08, "triangle", .06); },
      draw: () => tone(700, 0, .12, "triangle", .05, 420),
      turn: () => { tone(660, 0, .1, "sine", .07); tone(990, .09, .16, "sine", .07); },
      uno: () => [523, 784, 1047].forEach((f, i) => tone(f, i * .08, .25, "square", .05)),
      hit: () => tone(240, 0, .45, "sawtooth", .06, 70),
      win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * .11, .35, "square", .045))
    };

    /* ================= Moteur (hôte) ================= */
    if (api.isHost) {
      const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const deck = [];
      for (const c of COLS) {
        deck.push(c + "0");
        for (const v of "123456789DRS") deck.push(c + v, c + v);
      }
      for (let k = 0; k < 4; k++) deck.push("wJ", "w4");
      shuffle(deck);
      const H = {deck, disc: [], hands: P.map(() => []), top: "", col: "r", t: 0, d: 1, pd: -1, out: P.map(() => 0), ud: P.map(() => 0),
        uWait: {}, hist: [], ev: "", ek: "", es: -1, ec: "", n: 0, ph: "p", w: -1};
      window.__unoMaxState = window.__unoMaxState || 0;
      const nm = s => P[s].pseudo;
      function drawOne() {
        if (!H.deck.length) {
          if (!H.disc.length) return null;
          H.deck = shuffle(H.disc); H.disc = [];
        }
        return H.deck.pop();
      }
      function give(s, k) { let got = 0; for (let i = 0; i < k; i++) { const c = drawOne(); if (!c) break; H.hands[s].push(c); got++; } touch(s); return got; }
      /* deal */
      for (let r = 0; r < 7; r++) for (let s = 0; s < N; s++) H.hands[s].push(H.deck.pop());
      let first = H.deck.pop();
      while (!/\d/.test(first[1])) { H.deck.unshift(first); first = H.deck.pop(); }
      H.top = first; H.col = first[0];
      H.t = Math.floor(Math.random() * N);
      H.ev = `Première carte : ${cardName(first)}. ${nm(H.t)} commence !`; H.ek = "start";
      const active = () => P.map((p, i) => i).filter(i => !H.out[i]);
      function nextSeat(from, steps = 1) {
        if (!active().length) return from;
        let s = from;
        for (let k = 0; k < steps; k++) { do { s = (s + H.d + N) % N; } while (H.out[s]); }
        return s;
      }
      function touch(s) {
        if (H.hands[s].length !== 1) { H.ud[s] = 0; if (H.uWait[s]) { clearTimeout(H.uWait[s]); timers.delete(H.uWait[s]); delete H.uWait[s]; } }
      }
      function publish() {
        if (!alive) return;
        H.n++;
        const s = {n: H.n, ph: H.ph, t: H.t, d: H.d, tp: H.top, cl: H.col, hs: H.hist.join(""), dk: H.deck.length,
          h: H.hands.map((h, i) => encHand(h, i)), o: H.out.join(""), u: Object.keys(H.uWait).join(""), ud: H.ud.join(""),
          pd: H.pd, ev: H.ev, ek: H.ek, es: H.es, ec: H.ec};
        if (H.ph === "e") { s.w = H.w; s.pts = H.hands.map(h => h.reduce((a, c) => a + points(c), 0)); }
        const len = JSON.stringify(s).length;
        if (len > window.__unoMaxState) window.__unoMaxState = len;
        api.setState(s);
      }
      function finishGame(w) {
        H.ph = "e"; H.w = w; H.pd = -1;
        for (const k in H.uWait) { clearTimeout(H.uWait[k]); timers.delete(H.uWait[k]); }
        H.uWait = {};
        const pts = s => H.hands[s].reduce((a, c) => a + points(c), 0);
        const others = P.map((p, i) => i).filter(i => i !== w).sort((a, b) => (H.out[a] - H.out[b]) || (pts(a) - pts(b)) || (H.hands[a].length - H.hands[b].length));
        H.ev = `${nm(w)} vide sa main : victoire !`; H.ek = "win"; H.es = w;
        publish();
        const ranking = [w, ...others].map(i => P[i].key);
        const second = others.find(i => !H.out[i]);
        const summary = `${nm(w)} pose sa dernière carte en premier !` + (second != null ? ` ${nm(second)} finit 2e avec ${pts(second)} pts en main.` : "");
        later(() => api.finish({winners: [P[w].key], ranking, summary}), 3000);
      }
      function startUnoWait(s) {
        H.uWait[s] = later(() => {
          delete H.uWait[s];
          if (H.ph !== "p" || H.hands[s].length !== 1 || H.out[s]) return;
          const got = give(s, 2);
          H.ev = `${nm(s)} a oublié de crier UNO : +${got} cartes !`; H.ek = "pen"; H.es = s; H.ec = "";
          publish();
        }, UNO_MS);
      }
      function play(s, code, color, unoFlag) {
        const hand = H.hands[s];
        let idx = -1;
        if (H.pd === s) { if (hand[hand.length - 1] === code) idx = hand.length - 1; }
        else idx = hand.indexOf(code);
        if (idx < 0 || !canPlay(code, H.top, H.col)) return false;
        hand.splice(idx, 1);
        H.disc.push(H.top);
        H.top = code;
        H.col = code[0] === "w" ? ("rygb".includes(color) && color ? color : "rygb"[Math.floor(Math.random() * 4)]) : code[0];
        H.hist.push(code); if (H.hist.length > 3) H.hist.shift();
        H.pd = -1; H.es = s; H.ec = code; H.ek = "play";
        touch(s);
        if (!hand.length) { finishGame(s); return true; }
        let txt = `${nm(s)} joue ${cardName(code)}`;
        const v = code[1], nAct = active().length;
        if (code === "wJ") { txt += ` et choisit le ${COLNAME[H.col].toLowerCase()}.`; H.t = nextSeat(s); }
        else if (v === "S") { const sk = nextSeat(s); txt += ` : ${nm(sk)} passe son tour.`; H.t = nextSeat(s, 2); }
        else if (v === "R") {
          H.d = -H.d;
          if (nAct <= 2) { txt += " : rejoue !"; H.t = nextSeat(s, 2); }
          else { txt += " : changement de sens !"; H.t = nextSeat(s); }
        } else if (v === "D" || code === "w4") {
          const vic = nextSeat(s), k = v === "D" ? 2 : 4;
          const got = give(vic, k);
          txt += (code === "w4" ? ` (couleur ${COLNAME[H.col].toLowerCase()})` : "") + ` : ${nm(vic)} prend ${got} carte${got > 1 ? "s" : ""} et passe !`;
          H.ek = "hit"; H.vic = vic;
          H.t = nextSeat(s, 2);
        } else { txt += "."; H.t = nextSeat(s); }
        if (hand.length === 1) {
          if (unoFlag) { H.ud[s] = 1; txt = `UNO ! ${txt}`; H.ek = H.ek === "hit" ? "hit" : "uno"; }
          else startUnoWait(s);
        }
        H.ev = txt;
        return true;
      }
      function draw(s) {
        if (H.pd === s) { H.pd = -1; H.ev = `${nm(s)} garde sa carte.`; H.ek = "keep"; H.es = s; H.ec = ""; H.t = nextSeat(s); return; }
        const c = drawOne();
        H.es = s; H.ec = ""; H.ek = "draw";
        if (!c) { H.ev = `Pioche vide : ${nm(s)} passe.`; H.t = nextSeat(s); return; }
        H.hands[s].push(c); touch(s);
        if (canPlay(c, H.top, H.col)) { H.pd = s; H.ev = `${nm(s)} pioche… et peut la jouer !`; }
        else { H.ev = `${nm(s)} pioche une carte et passe.`; H.t = nextSeat(s); }
      }
      const seen = {};
      let inputs = {};
      function handle() {
        if (H.ph !== "p") return;
        let changed = false;
        for (const key in inputs) {
          const s = seatOf(key), i = inputs[key];
          if (s < 0 || H.out[s] || !i || i.seq == null || i.seq === seen[key]) continue;
          seen[key] = i.seq;
          if (i.a === "uno") {
            if (H.uWait[s] && H.hands[s].length === 1) {
              clearTimeout(H.uWait[s]); timers.delete(H.uWait[s]); delete H.uWait[s];
              H.ud[s] = 1; H.ev = `${nm(s)} crie UNO !`; H.ek = "uno"; H.es = s; H.ec = ""; changed = true;
            }
            continue;
          }
          if (s !== H.t) continue;
          if (i.a === "play") {
            let code = typeof i.c === "string" ? i.c : H.hands[s][i.c | 0];
            if (code && play(s, code, i.color, !!i.uno)) changed = true;
            if (H.ph !== "p") return;
          } else if (i.a === "draw" || i.a === "pass") { draw(s); changed = true; }
        }
        if (changed) publish();
      }
      api.onInputs(m => { inputs = m || {}; handle(); });

      /* départs : la main retourne dans la pioche, le joueur est sauté */
      const poll = setInterval(() => {
        if (!alive || H.ph !== "p") return;
        const on = new Set(api.connected());
        let ch = false;
        P.forEach((p, i) => {
          if (H.out[i] || on.has(p.key)) return;
          H.out[i] = 1; ch = true;
          H.deck.push(...H.hands[i]); H.hands[i] = []; shuffle(H.deck); touch(i);
          H.ev = `${nm(i)} quitte la salle : ses cartes retournent dans la pioche.`; H.ek = "out"; H.es = i; H.ec = "";
          if (H.pd === i) H.pd = -1;
          if (H.t === i) H.t = nextSeat(i);
        });
        if (!ch) return;
        const act = active();
        if (act.length === 1) { finishGame(act[0]); return; }
        if (!act.length) return;
        publish();
      }, 1000);
      timers.add(poll);
      publish();
    }

    /* ================= Affichage (tout le monde) ================= */
    let cur = null, lastN = -1, mySeq = 0, lockN = -1, lockT = 0, unoArmed = false, pickCode = null;
    let prevHand = null, prevTop = "", prevTurn = -1, unoSince = 0, unoRaf = 0, shownEnd = false;
    const myHandOf = s => mySeat >= 0 && s.h ? decHand(s.h[mySeat], mySeat) : [];
    const colOrder = c => "rygbw".indexOf(c[0]) * 20 + (c[0] === "w" ? (c[1] === "J" ? 0 : 1) : VALS.indexOf(c[1]));
    const locked = () => cur && lockN === cur.n && Date.now() - lockT < 2500;
    function send(obj) {
      if (!cur) return;
      mySeq++; obj.seq = mySeq; lockN = cur.n; lockT = Date.now();
      api.setInput(obj);
    }
    function myTurn() { return cur && cur.ph === "p" && mySeat >= 0 && cur.t === mySeat && cur.o[mySeat] !== "1"; }
    function playable(hand) {
      if (!myTurn()) return new Set();
      if (cur.pd === mySeat) return new Set([hand.length - 1]);
      return new Set(hand.map((c, i) => canPlay(c, cur.tp, cur.cl) ? i : -1).filter(i => i >= 0));
    }
    function shout(big, small) {
      const sh = $("uno-shout");
      sh.innerHTML = esc(big) + (small ? `<small>${esc(small)}</small>` : "");
      sh.classList.remove("go"); void sh.offsetWidth; sh.classList.add("go");
    }
    function layoutHand() {
      const hand = $("uno-hand"), cards = [...hand.querySelectorAll(".uno-card")], n = cards.length;
      if (!n) return;
      const cw = cards[0].offsetWidth || 70, W = hand.clientWidth - 64;
      let ml = 4;
      if (n * cw + (n - 1) * 4 > W) ml = Math.max((W - cw) / (n - 1), cw * .46) - cw;
      hand.classList.toggle("few", n * cw + (n - 1) * (ml) <= W);
      const spread = Math.min(3, 18 / n);
      cards.forEach((c, i) => {
        const o = i - (n - 1) / 2;
        c.style.setProperty("--ml", ml.toFixed(1) + "px");
        c.style.setProperty("--r", (o * spread).toFixed(2) + "deg");
        c.style.setProperty("--y", (Math.abs(o * spread) * Math.abs(o * spread) * .35).toFixed(1) + "px");
      });
    }
    function renderHand(s) {
      const handEl = $("uno-hand");
      if (mySeat < 0) { handEl.innerHTML = '<p class="uno-spec">Vous regardez la partie en spectateur.</p>'; return; }
      if (s.o[mySeat] === "1") { handEl.innerHTML = '<p class="uno-spec">Vous avez quitté la partie.</p>'; return; }
      const hand = myHandOf(s);
      const ok = playable(hand);
      const order = hand.map((c, i) => i);
      const drawnIdx = s.pd === mySeat ? hand.length - 1 : -1;
      order.sort((a, b) => (a === drawnIdx) - (b === drawnIdx) || colOrder(hand[a]) - colOrder(hand[b]) || a - b);
      // cartes nouvelles (arrivées depuis l'état précédent)
      const pool = prevHand ? prevHand.slice() : null, fresh = new Set();
      if (pool) for (let i = 0; i < hand.length; i++) { const j = pool.indexOf(hand[i]); if (j >= 0) pool.splice(j, 1); else fresh.add(i); }
      prevHand = hand;
      const sl = handEl.scrollLeft;
      handEl.innerHTML = order.map(i => cardHTML(hand[i], (ok.has(i) ? "uno-ok" : "") + (fresh.has(i) ? " uno-new" : ""), "button", `type="button" data-i="${i}" data-code="${hand[i]}"`)).join("");
      layoutHand();
      handEl.scrollLeft = sl;
      if (drawnIdx >= 0) { const d = handEl.querySelector(`[data-i="${drawnIdx}"]`); if (d && d.scrollIntoView) d.scrollIntoView({block: "nearest", inline: "center"}); }
    }
    function tickUno() {
      unoRaf = 0;
      const b = $("uno-unob");
      if (!b || !b.classList.contains("hot")) return;
      const p = Math.min(100, (Date.now() - unoSince) / UNO_MS * 100);
      b.style.setProperty("--p", p.toFixed(1) + "%");
      if (p < 100 && alive) unoRaf = requestAnimationFrame(tickUno);
    }
    function render(s) {
      const fresh = s.n !== lastN;
      cur = s;
      if (!fresh) return;
      lastN = s.n;
      const mine = myTurn();
      root.classList.toggle("mine", mine);
      // adversaires
      for (const k in oppEl) {
        const i = +k, o = oppEl[k], cnt = (s.h[i] || "").length, out = s.o[i] === "1";
        o.classList.toggle("on", s.ph === "p" && s.t === i);
        o.classList.toggle("out", out);
        o.classList.toggle("wait", s.u.includes(String(i)));
        o.classList.toggle("uno1", !out && cnt === 1 && !s.u.includes(String(i)));
        o.querySelector(".uno-ocount b").textContent = out ? "–" : cnt;
        o.querySelector(".uno-badge").textContent = s.u.includes(String(i)) ? "UNO ?" : "UNO";
      }
      $("uno-flow").classList.toggle("rev", s.d < 0);
      $("uno-ring").classList.toggle("rev", s.d < 0);
      // pioche & défausse
      $("uno-pcount").textContent = s.dk;
      const pileOk = mine && s.pd !== mySeat;
      $("uno-pile").classList.toggle("can", pileOk);
      const hist = (s.hs || "").match(/../g) || [s.tp];
      if (hist[hist.length - 1] !== s.tp) hist.push(s.tp);
      const rot = (c, i) => ((c.charCodeAt(0) * 7 + c.charCodeAt(1) * 13 + i * 29) % 30) - 15;
      const landed = s.tp !== prevTop && prevTop !== "";
      $("uno-disc").innerHTML = hist.slice(-3).map((c, i, a) => {
        const top = i === a.length - 1;
        return cardHTML(c, (top ? "top" : "") + (top && landed ? (s.es === mySeat ? " land-me" : " land-op") : ""), "div", `style="transform:rotate(${top ? rot(c, s.n % 7) / 3 : rot(c, i)}deg)"`);
      }).join("");
      const topEl = $("uno-disc").querySelector(".top");
      if (topEl) topEl.style.setProperty("--cc", COLHEX[s.cl]);
      const chip = $("uno-colchip");
      chip.style.setProperty("--cc", COLHEX[s.cl]);
      chip.querySelector("span").textContent = "Couleur : " + COLNAME[s.cl];
      // événement
      const ev = $("uno-ev");
      ev.textContent = s.ev || "";
      if (s.ek === "play" || s.ek === "hit" || s.ek === "uno") sfx.play();
      else if (s.ek === "draw") sfx.draw();
      if (s.ek === "uno") { shout("UNO !", P[s.es] ? P[s.es].pseudo : ""); sfx.uno(); }
      if (s.ek === "pen") { shout("+2 !", (P[s.es] ? P[s.es].pseudo : "") + " a oublié UNO"); sfx.hit(); }
      if (s.ek === "hit" && s.ec) shout(s.ec === "w4" ? "+4 !" : "+2 !", "");
      if (s.ek === "play" && s.ec && s.ec[1] === "R" && s.tp === s.ec) shout("⇄", "Changement de sens");
      if ((s.ek === "hit" || s.ek === "pen") && mySeat >= 0) {
        const myCnt = (s.h[mySeat] || "").length;
        if (prevHand && myCnt > prevHand.length) { const me = $("uno-me"); me.classList.remove("hit"); void me.offsetWidth; me.classList.add("hit"); }
      }
      prevTop = s.tp;
      // ma zone
      const hand = myHandOf(s);
      const stat = $("uno-mstat");
      if (mySeat < 0) stat.textContent = s.ph === "p" ? `Au tour de ${P[s.t].pseudo}` : "";
      else if (s.ph !== "p") stat.textContent = "Partie terminée";
      else if (s.o[mySeat] === "1") stat.textContent = "Hors jeu";
      else if (mine && s.pd === mySeat) stat.textContent = "Joue la carte piochée ou garde-la";
      else if (mine) stat.textContent = playable(hand).size ? "À toi ! Joue une carte" : "À toi ! Aucune carte jouable : pioche";
      else stat.textContent = `${P[s.t].pseudo} joue… · ${hand.length} carte${hand.length > 1 ? "s" : ""}`;
      const db = $("uno-draw");
      db.disabled = !mine;
      db.textContent = mine && s.pd === mySeat ? "Garder" : "Piocher";
      db.classList.toggle("go", mine && (s.pd === mySeat || !playable(hand).size));
      // bouton UNO
      const ub = $("uno-unob");
      const waiting = mySeat >= 0 && s.u.includes(String(mySeat));
      if (waiting && !ub.classList.contains("hot")) { unoSince = Date.now(); ub.classList.add("hot"); if (!unoRaf) unoRaf = requestAnimationFrame(tickUno); }
      if (!waiting) ub.classList.remove("hot");
      if (!mine || hand.length !== 2) unoArmed = false;
      const canArm = mine && hand.length === 2 && playable(hand).size > 0;
      ub.disabled = !(waiting || canArm);
      ub.classList.toggle("armed", unoArmed && canArm);
      if (mine && prevTurn !== s.t) { sfx.turn(); try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} }
      prevTurn = s.ph === "p" ? s.t : -1;
      renderHand(s);
      if (!mine || s.ph !== "p") closePicker();
      if (s.ph === "e") showEnd(s);
    }
    function showEnd(s) {
      if (shownEnd) return;
      shownEnd = true;
      sfx.win();
      const w = s.w, pts = s.pts || [];
      const others = P.map((p, i) => i).filter(i => i !== w).sort((a, b) => ((s.o[a] === "1") - (s.o[b] === "1")) || (pts[a] - pts[b]));
      const box = $("uno-end");
      box.innerHTML = `<div class="uno-ebox"><h2>${w === mySeat ? "Victoire !" : "Main vide !"}</h2>
        <div class="uno-ewin">${api.avatar(P[w].key, {pose: "flex"})}</div>
        <p><b>${esc(P[w].pseudo)}</b> pose sa dernière carte.</p>
        <ol class="uno-rk">${[w, ...others].map((i, r) => `<li class="${i === w ? "w" : ""}"><em>${r + 1}</em><span class="uno-rav">${api.avatar(P[i].key, {view: "bust"})}</span><b>${esc(P[i].pseudo)}</b><span>${s.o[i] === "1" ? "parti" : i === w ? "0 pt" : pts[i] + " pts"}</span></li>`).join("")}</ol></div>`;
      box.classList.remove("hidden");
    }
    function openPicker(code) { pickCode = code; $("uno-picker").classList.remove("hidden"); }
    function closePicker() { pickCode = null; $("uno-picker").classList.add("hidden"); }
    api.onState(render);

    /* ---------- gestes ---------- */
    function nope(btn) { if (!btn) return; btn.classList.remove("no"); void btn.offsetWidth; btn.classList.add("no"); }
    $("uno-hand").addEventListener("click", e => {
      const b = e.target.closest(".uno-card");
      if (!b || !cur) return;
      if (!myTurn() || locked() || !b.classList.contains("uno-ok")) { nope(b); return; }
      const code = b.dataset.code;
      if (code[0] === "w") { openPicker(code); return; }
      send({a: "play", c: code, uno: unoArmed ? 1 : 0});
    });
    $("uno-picker").addEventListener("click", e => {
      const b = e.target.closest(".uno-pick");
      if (e.target.id === "uno-pcancel" || e.target === $("uno-picker")) { closePicker(); return; }
      if (!b || !pickCode || !myTurn()) return;
      const code = pickCode;
      closePicker();
      send({a: "play", c: code, color: b.dataset.col, uno: unoArmed ? 1 : 0});
    });
    const doDraw = () => { if (!myTurn() || locked()) return; send({a: cur.pd === mySeat ? "pass" : "draw"}); };
    $("uno-draw").addEventListener("click", doDraw);
    $("uno-pile").addEventListener("click", () => { if (cur && cur.pd !== mySeat) doDraw(); });
    $("uno-unob").addEventListener("click", () => {
      if (!cur || mySeat < 0) return;
      if (cur.u.includes(String(mySeat))) { send({a: "uno"}); lockN = -1; shout("UNO !", P[mySeat].pseudo); sfx.uno(); return; }
      if (myTurn() && myHandOf(cur).length === 2) { unoArmed = !unoArmed; $("uno-unob").classList.toggle("armed", unoArmed); if (unoArmed) { sfx.uno(); api.toast("UNO armé : joue ta carte !"); } }
    });
    const onResize = () => layoutHand();
    window.addEventListener("resize", onResize);

    return {
      destroy() {
        alive = false;
        timers.forEach(t => { clearTimeout(t); clearInterval(t); });
        timers.clear();
        if (unoRaf) cancelAnimationFrame(unoRaf);
        window.removeEventListener("resize", onResize);
        el.removeEventListener("pointerdown", unlock);
        if (actx) { try { actx.close(); } catch (e) {} }
        el.innerHTML = "";
      }
    };
  }
});
