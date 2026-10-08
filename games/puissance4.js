/* Gonflette Party : Puissance 4 en réseau (2 joueurs, chacun sur son téléphone).
   Jeu de référence pour l'API décrite dans GAMES-API.md. */
GONFLETTE.registerGame({
  id: "puissance4",
  name: "Puissance 4",
  min: 2,
  max: 2,
  resumable: true,                           // l'hôte rechargé repart de api.resume (l'état publié contient toute la partie)
  create(api) {
    const ROWS = 6, COLS = 7;
    const [P1, P2] = api.players;            // P1 = soleil (commence), P2 = lune
    const el = api.el;
    const mySide = api.me === P1.key ? 1 : api.me === P2.key ? 2 : 0;

    el.innerHTML = `<style>
      .p4{min-height:100%;display:grid;justify-items:center;align-content:start;gap:12px;padding:14px 16px 30px;background:radial-gradient(120% 80% at 50% 0%,#1d2a6e,#070a22 70%);color:#ede7d4;font-family:"Barlow Condensed",system-ui,sans-serif}
      .p4-head{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;width:min(100%,560px)}
      .p4-pl{display:flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:12px;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);opacity:.6;transition:opacity .3s,border-color .3s}
      .p4-pl.on{opacity:1;border-color:#ffcc33;box-shadow:0 0 18px rgba(255,204,51,.35)}
      .p4-pl .av{width:44px;height:50px}
      .p4-pl b{font-size:1.1rem}
      .p4-tok{width:22px;height:22px;border-radius:50%;flex:none}
      .p4-status{font-size:1.3rem;font-weight:800;text-align:center;min-height:1.6em}
      .p4-board{position:relative;width:min(100%,520px,calc((100vh - 230px) * 7 / 6));aspect-ratio:7/6;padding:2.2%;border-radius:22px;background:linear-gradient(145deg,#f5dc97,#c4943b 30%,#7a5a1e 55%,#d9b461 80%);box-shadow:0 20px 50px rgba(0,0,0,.6)}
      .p4-grid{position:relative;width:100%;height:100%;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(6,1fr);background:#16207a;border-radius:14px;overflow:hidden}
      .p4-cell{display:grid;place-items:center;border:0;padding:0;background:none;cursor:pointer}
      .p4-hole{width:82%;aspect-ratio:1;border-radius:50%;background:#04061a;box-shadow:inset 0 3px 6px #000,0 0 0 3px #c39a45}
      .p4-hole.s1{background:radial-gradient(circle at 36% 30%,#fff6cf,#ffd65c 26%,#ffb02e 52%,#e2690f 80%,#9e3a06)}
      .p4-hole.s2{background:radial-gradient(circle at 34% 28%,#fff,#e9eefa 24%,#b8c3df 62%,#7480a6)}
      .p4-hole.new{animation:p4drop .45s cubic-bezier(.5,0,1,.6)}
      .p4-hole.win{box-shadow:0 0 0 4px #fff,0 0 22px #ffcc33}
      .p4-grid.mine .p4-cell:hover .p4-hole:not(.s1):not(.s2){box-shadow:inset 0 3px 6px #000,0 0 0 3px #ffcc33}
      @keyframes p4drop{from{transform:translateY(-400%)}}
      .t1{background:radial-gradient(circle at 36% 30%,#fff6cf,#ffb02e 55%,#9e3a06)}.t2{background:radial-gradient(circle at 34% 28%,#fff,#b8c3df 62%,#7480a6)}
    </style>
    <div class="p4">
      <div class="p4-head">
        <div class="p4-pl" id="p4-a">${api.avatar(P1.key)}<span class="p4-tok t1"></span><b></b></div>
        <div class="p4-pl" id="p4-b">${api.avatar(P2.key)}<span class="p4-tok t2"></span><b></b></div>
      </div>
      <div class="p4-status" id="p4-status" role="status" aria-live="polite"></div>
      <div class="p4-board"><div class="p4-grid" id="p4-grid"></div></div>
    </div>`;
    el.querySelector("#p4-a b").textContent = P1.pseudo;
    el.querySelector("#p4-b b").textContent = P2.pseudo;
    const grid = el.querySelector("#p4-grid");
    for (let i = 0; i < ROWS * COLS; i++) {
      const b = document.createElement("button");
      b.className = "p4-cell"; b.type = "button"; b.dataset.c = i % COLS;
      b.setAttribute("aria-label", "Colonne " + "abcdefg"[i % COLS]);
      b.innerHTML = '<span class="p4-hole"></span>';
      grid.appendChild(b);
    }
    const holes = [...grid.querySelectorAll(".p4-hole")];

    // ---------- logique (hôte) ----------
    function lineAt(b, r, c, p) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [r * COLS + c];
        for (const s of [1, -1]) {
          let rr = r + dr * s, cc = c + dc * s;
          while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr * COLS + cc] === p) { cells.push(rr * COLS + cc); rr += dr * s; cc += dc * s; }
        }
        if (cells.length >= 4) return cells;
      }
      return null;
    }
    let state = null;
    const seen = {};
    function hostEnd() {
      const winner = state.win ? (state.t === 1 ? P1 : P2) : null;
      setTimeout(() => api.finish(winner
        ? {winners: [winner.key], ranking: [winner.key, winner === P1 ? P2.key : P1.key], summary: `${winner.pseudo} aligne quatre astres.`}
        : {winners: [], ranking: [P1.key, P2.key], summary: "Plateau plein : éclipse totale."}), 2600);
    }
    if (api.isHost) {
      state = api.resume || {b: "0".repeat(ROWS * COLS), t: 1, last: -1, win: null, over: 0, n: 0};
      api.setState(state);
      if (state.over) hostEnd();
      api.onInputs(inputs => {
        if (state.over) return;
        const who = state.t === 1 ? P1.key : P2.key;
        const inp = inputs[who];
        if (!inp || inp.seq == null || inp.seq === seen[who]) return;
        seen[who] = inp.seq;
        const c = inp.col | 0;
        if (c < 0 || c >= COLS) return;
        const b = state.b.split("").map(Number);
        let r = -1;
        for (let rr = ROWS - 1; rr >= 0; rr--) if (!b[rr * COLS + c]) { r = rr; break; }
        if (r < 0) return;
        b[r * COLS + c] = state.t;
        const line = lineAt(b, r, c, state.t);
        const full = b.every(v => v);
        state = {b: b.join(""), t: line || full ? state.t : 3 - state.t, last: r * COLS + c, win: line, over: line || full ? 1 : 0, n: state.n + 1};
        api.setState(state);
        if (state.over) hostEnd();
      });
    }

    // ---------- affichage (tout le monde) ----------
    let mySeq = 0, lastN = -1, cur = null;
    function render(s) {
      cur = s;
      const b = s.b;
      holes.forEach((h, i) => {
        h.className = "p4-hole" + (b[i] === "1" ? " s1" : b[i] === "2" ? " s2" : "") + (i === s.last && s.n !== lastN ? " new" : "") + (s.win && s.win.includes(i) ? " win" : "");
      });
      // kit partagé (GAMES-API.md) : « toc » quand un jeton tombe, petite vibration quand c'est à moi
      if (s.n !== lastN && lastN >= 0 && s.last >= 0 && api.sfx) api.sfx("tap");
      if (api.haptic && !s.over && mySide === s.t && s.n !== lastN && lastN >= 0) api.haptic("light");
      lastN = s.n;
      el.querySelector("#p4-a").classList.toggle("on", !s.over && s.t === 1);
      el.querySelector("#p4-b").classList.toggle("on", !s.over && s.t === 2);
      const myTurn = !s.over && mySide === s.t;
      grid.classList.toggle("mine", myTurn);
      const st = el.querySelector("#p4-status");
      const curName = s.t === 1 ? P1.pseudo : P2.pseudo;
      if (s.over) st.textContent = s.win ? `${curName} a gagné !` : "Match nul !";
      else if (myTurn) st.textContent = "À vous ! Touchez une colonne.";
      else if (mySide) st.textContent = `${curName} réfléchit…`;
      else st.textContent = `Au tour de ${curName}`;
    }
    api.onState(render);
    grid.addEventListener("click", e => {
      const cell = e.target.closest(".p4-cell");
      if (!cell || !cur || cur.over || cur.t !== mySide) return;
      api.setInput({seq: ++mySeq, col: +cell.dataset.c});
    });
    return {destroy() { el.innerHTML = ""; }};
  }
});
