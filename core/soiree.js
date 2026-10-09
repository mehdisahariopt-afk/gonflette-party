/* Gonflette Party : Mode Soirée.
   Un maître du jeu (MJ 🎤) compose une playlist de jeux ; l'hôte du lobby enchaîne les étapes en lançant des parties
   normales (duels en parallèle à la suisse, groupes équilibrés, deux équipes), compte les points de soirée,
   affiche le classement entre deux jeux, puis la cérémonie « Mister Olympia de la soirée » et la photo souvenir.

   Réseau (tout passe par la présence du lobby, comme le reste) :
   - état de la soirée : st.so, publié par l'hôte du lobby (repris par le prochain hôte comme le reste de st) ;
   - téléphones : presence.mj = demande de micro (heure), presence.sc = commande du MJ {c, a, id},
     presence.sw = 1 « je regarde seulement », presence.cs = 1 champion de la soirée (titre pour la session).
   st.so = {i: id, ph: "m"(menu)|"i"(entracte)|"r"(jeu en cours)|"f"(cérémonie), mj: id profil du MJ, cq: dernière commande traitée,
            pl: [ids de jeux], k: étape, at: début de la phase (heure de l'hôte), pz: ms restantes si pause,
            ids: [id profil], nm: [pseudos], r: [résultats par étape, 1 caractère], pp: paires déjà jouées (2 car.),
            sp: répartition de l'étape {g: ["01", "23|45"], by: "6", lt: 1 si équipes du lobby, x: 1 si impossible},
            m: {mid: 0 en cours | 1 compté}, sk: [étapes sautées], lm: [n, message], d: date de début}
   Résultat d'une étape (r) : W victoire 3 · F victoire par forfait 2 · D nul 1 · L défaite 0 · S 2e 2 · T 3e 1 · Z autre 0 · B exempt 1 · - absent */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  // Durée approximative d'une partie (minutes), pour estimer la soirée.
  const MINUTES = {airhockey: 3, bataille: 7, brasdefer: 2, dames: 10, dessine: 8, developpe: 3, flip7: 6, morpion: 4, motinterdit: 8, petitbac: 6, pfc: 2,
    pictionary: 10, pong: 3, priorities: 10, puissance4: 5, quiadit: 7, quiestce: 5, reflexes: 2, relais: 3, spotteur: 3, tiracorde: 2, tron: 3, undercover: 8, uno: 8};
  const minutesOf = id => MINUTES[id] || 5;
  const STEP_OVERHEAD = .6; // compte à rebours + résultats + entracte
  const INTER_MS = 15000, FIRST_MS = 12000, SKIP_LEFT_MS = 6000, MJ_GONE_MS = 15000, CLAIM_MS = 12000;
  const PTS = {W: 3, F: 2, D: 1, L: 0, S: 2, T: 1, Z: 0, B: 1};
  const BLUFF = new Set(["undercover", "quiadit", "pfc", "flip7", "motinterdit", "bataille", "uno", "quiestce"]);
  const BONUS = [[150, 80], [60, 30], [30, 15]];
  const TEAM_NAMES = [["Team Whey", "Team Créatine"], ["Les Pecs d'Acier", "Les Biceps en Feu"], ["Les Gonflés", "Les Secs"], ["Club Protéine", "Gang du Shaker"]];
  const PRESETS = {
    express: ["reflexes", "pfc", "brasdefer", "tiracorde", "developpe", "airhockey", "pong", "spotteur", "relais", "morpion", "tron"],
    duels: ["brasdefer", "pong", "puissance4", "airhockey", "morpion", "quiestce", "dames", "bataille"],
    team: ["tiracorde", "relais", "pictionary", "dessine", "motinterdit", "petitbac", "developpe"]
  };

  let C = null, A = null;
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const rnd = n => Math.random().toString(36).slice(2, 2 + (n || 6));
  const i2c = i => i.toString(36);
  const cs2i = s => String(s || "").split("").filter(c => c !== "|").map(c => parseInt(c, 36));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kindOf = g => g.teams ? "team" : g.min === g.max ? "duel" : "group";
  const pidOf = p => p && p.presence && typeof p.presence.id === "string" ? p.presence.id.slice(0, 16) : "p:" + (p && p.peer);
  const myPid = () => String((C.profile() || {}).id || "").slice(0, 16);
  const gameOf = id => C.gameById(id);
  const curSo = () => { const st = C.hostSt(); return st && st.so && st.so.ph ? st.so : null; };
  const pidOfKey = (M, k) => (M.ro && M.ro[k] && typeof M.ro[k].i === "string") ? M.ro[k].i : pidOf(C.peers().find(p => p.peer === k));
  function groupsCount(g, n) { let k = Math.max(1, Math.ceil(n / g.max)); while (k > 1 && Math.floor(n / k) < g.min) k--; return k; }
  function modeOf(g, n, short) {
    const K = kindOf(g);
    if (n < g.min) return `Il faut ${g.min} joueurs minimum`;
    if (K === "duel") return n <= 2 ? "en duel" : short ? "en duels" : `en duels (${Math.floor(n / 2)} en parallèle${n % 2 ? ", 1 exempt" : ""})`;
    const k = groupsCount(g, n);
    if (K === "team") return k === 1 ? "en équipes" : `en équipes (${k} matchs)`;
    return k === 1 ? "tous ensemble" : `en ${k} groupes`;
  }
  const rangeOf = g => g.min === g.max ? `${g.min} joueurs` : `${g.min}–${g.max} joueurs`;

  /* ---------- classement ---------- */
  function standings(so, upto) {
    const rows = so.ids.map((pid, i) => {
      const s = (so.r[i] || "").slice(0, upto == null ? undefined : Math.max(0, upto));
      let pts = 0, w = 0, l = 0, by = 0, pl = 0, sec = 0;
      for (const c of s) {
        if (c === "-") continue;
        pts += PTS[c] || 0;
        if (c === "B") { by++; continue; }
        pl++;
        if (c === "W" || c === "F") w++; else if (c === "L" || c === "Z") l++; else if (c === "S") sec++;
      }
      return {i, pid, name: so.nm[i] || "?", pts, w, l, by, pl, sec, s};
    });
    rows.sort((a, b) => b.pts - a.pts || b.w - a.w || a.l - b.l || a.i - b.i);
    rows.forEach((r, n) => { r.rank = n && rows[n - 1].pts === r.pts && rows[n - 1].w === r.w && rows[n - 1].l === r.l ? rows[n - 1].rank : n + 1; });
    return rows;
  }
  const doneLen = so => Math.max(0, ...so.r.map(s => s.length));
  function setR(so, i, k, c) { let s = so.r[i] || ""; while (s.length < k) s += "-"; so.r[i] = s.slice(0, k) + c + s.slice(k + 1); }
  function idxOf(so, pid, name) {
    let i = so.ids.indexOf(pid);
    if (i < 0 && name != null && so.ids.length < 36) { so.ids.push(pid); so.nm.push(String(name).slice(0, 14)); so.r.push(""); i = so.ids.length - 1; }
    return i;
  }
  function msg(so, text) { so.lm = [((so.lm && so.lm[0]) || 0) + 1, String(text).slice(0, 120)]; }

  /* ---------- répartition d'une étape ---------- */
  function makeSplit(so, g, idx, byPid) {
    const n = idx.length;
    if (n < g.min) return {x: 1, g: [], by: ""};
    const S = standings(so), pts = {}; S.forEach(r => { pts[r.i] = r.pts; });
    const sorted = shuffle(idx.slice()).sort((a, b) => (pts[b] || 0) - (pts[a] || 0)); // égalités au hasard
    const K = kindOf(g);
    if (K === "duel") {
      let by = "", list = sorted.slice();
      if (n % 2) {
        const byes = {}; so.ids.forEach((_, i) => { byes[i] = ((so.r[i] || "").match(/B/g) || []).length; });
        const minB = Math.min(...list.map(i => byes[i]));
        const cand = list.filter(i => byes[i] === minB);
        const b = cand[cand.length - 1]; // le moins bien classé parmi ceux qui n'ont pas encore été exemptés
        by = i2c(b); list = list.filter(i => i !== b);
      }
      const faced = new Set();
      for (let j = 0; j + 1 < (so.pp || "").length; j += 2) { const a = parseInt(so.pp[j], 36), b = parseInt(so.pp[j + 1], 36); faced.add(Math.min(a, b) + "," + Math.max(a, b)); }
      return {g: swiss(list, faced).map(([a, b]) => i2c(a) + i2c(b)), by};
    }
    const k = groupsCount(g, n), groups = Array.from({length: k}, () => []);
    sorted.forEach((i, j) => { const r = Math.floor(j / k), c = j % k; groups[r % 2 ? k - 1 - c : c].push(i); }); // serpentin : forts et faibles mélangés
    if (K === "team") {
      if (k === 1) {
        const tm = idx.map(i => { const p = byPid.get(so.ids[i]); return p ? p.presence.tm : null; });
        const t0 = idx.filter((_, j) => tm[j] === 0), t1 = idx.filter((_, j) => tm[j] === 1);
        if (t0.length && t1.length && t0.length + t1.length === n && Math.abs(t0.length - t1.length) <= 1) return {g: [t0.map(i2c).join("") + "|" + t1.map(i2c).join("")], by: "", lt: 1};
      }
      return {g: groups.map(gr => { const t = [[], []]; gr.forEach((i, j) => t[[0, 1, 1, 0][j % 4]].push(i)); return t[0].map(i2c).join("") + "|" + t[1].map(i2c).join(""); }), by: ""};
    }
    return {g: groups.map(gr => gr.map(i2c).join("")), by: ""};
  }
  // Appariement à la suisse : chacun contre le mieux classé suivant qu'il n'a pas encore affronté (retour arrière si impasse).
  function swiss(list, faced) {
    const n = list.length, used = new Array(n).fill(false), pairs = [];
    let budget = 40000;
    const key = (a, b) => Math.min(a, b) + "," + Math.max(a, b);
    function dfs(rep) {
      if (--budget < 0) return false;
      const a = used.indexOf(false); if (a < 0) return true;
      used[a] = true;
      for (let b = a + 1; b < n; b++) if (!used[b] && (rep || !faced.has(key(list[a], list[b])))) {
        used[b] = true; pairs.push([list[a], list[b]]);
        if (dfs(rep)) return true;
        pairs.pop(); used[b] = false;
      }
      used[a] = false; return false;
    }
    if (!dfs(false)) { pairs.length = 0; used.fill(false); budget = 1e6; dfs(true); }
    return pairs;
  }
  const splitMembers = sp => sp ? cs2i((sp.g || []).join("") + (sp.by || "")).sort((a, b) => a - b).join(",") : "";

  /* ---------- hôte du lobby ---------- */
  let mjGone = null, claimSeen = new Map();
  function participants(ps, ms) {
    const busy = new Set();
    Object.values(ms).forEach(M => { if (!M.so) M.pl.forEach(k => busy.add(k)); });
    return ps.filter(p => p.presence.ps && !p.presence.sw && !p.presence.ed && !busy.has(p.peer));
  }
  function toFinal(so, now) { so.ph = "f"; so.at = now; delete so.sp; delete so.m; delete so.pz; }
  function hostTick(ms, now, prev) {
    const ps = C.players();
    let so = prev && prev.ph ? JSON.parse(JSON.stringify(prev)) : null;
    // 1. demandes de micro (« Lancer une soirée ») : la plus ancienne gagne
    if (!so || so.ph === "f") {
      const cl = ps.filter(p => typeof p.presence.mj === "number" && p.presence.ps);
      // arbitrage : la demande vue en premier par l'hôte ; si plusieurs arrivent ensemble, la plus ancienne (heure estimée de l'hôte)
      const seen = new Map();
      cl.forEach(p => { const k = p.peer + ":" + p.presence.mj; seen.set(p.peer, claimSeen.get(k) || now); });
      claimSeen = new Map(cl.map(p => [p.peer + ":" + p.presence.mj, seen.get(p.peer)]));
      if (cl.length) {
        cl.sort((a, b) => seen.get(a.peer) - seen.get(b.peer) || a.presence.mj - b.presence.mj || (a.presence.ja - b.presence.ja) || (a.peer < b.peer ? -1 : 1));
        const p = cl[0];
        so = {i: rnd(6), ph: "m", mj: pidOf(p), cq: p.presence.sc && p.presence.sc.id || null, at: now, d: now, pl: [], k: 0, ids: [], nm: [], r: [], pp: ""};
      }
    }
    if (!so) return {so: prev && prev.ph ? prev : null, changed: false, hold: new Set()};
    const byPid = new Map(ps.map(p => [pidOf(p), p]));
    // 2. MJ absent plus de 15 s : le micro passe au joueur suivant par ordre d'arrivée
    if (!byPid.has(so.mj)) {
      if (!mjGone || mjGone.mj !== so.mj) mjGone = {mj: so.mj, at: now};
      else if (now - mjGone.at > MJ_GONE_MS) {
        const cand = ps.filter(p => p.presence.ps).sort((a, b) => (!!a.presence.sw - !!b.presence.sw) || (a.presence.ja - b.presence.ja) || (a.peer < b.peer ? -1 : 1))[0];
        if (cand) {
          const old = so.nm[so.ids.indexOf(so.mj)] || "Le maître du jeu";
          so.mj = pidOf(cand); so.cq = cand.presence.sc && cand.presence.sc.id || null;
          msg(so, `🎤 ${old} a quitté la salle : ${cand.presence.ps} prend le micro !`);
          mjGone = null;
        }
      }
    } else mjGone = null;
    // 3. commandes du MJ
    const mjp = byPid.get(so.mj), sc = mjp && mjp.presence.sc;
    if (sc && typeof sc.id === "string" && sc.id !== so.cq) {
      so.cq = sc.id;
      so = command(so, sc, ms, now, ps, byPid);
    }
    // 4. déroulé
    if (so && so.ph === "i") {
      const parts = participants(ps, ms);
      parts.forEach(p => { const i = idxOf(so, pidOf(p), p.presence.ps); if (i >= 0) so.nm[i] = String(p.presence.ps).slice(0, 14); });
      const g = gameOf(so.pl[so.k]);
      const idx = parts.map(p => so.ids.indexOf(pidOf(p))).filter(i => i >= 0);
      if (g) {
        const key = idx.slice().sort((a, b) => a - b).join(",");
        if (!so.sp || (so.sp.x ? idx.length >= g.min : splitMembers(so.sp) !== key)) so.sp = makeSplit(so, g, idx, byPid);
      }
      const dur = so.k === 0 && !so.sk ? FIRST_MS : INTER_MS;
      if (!so.pz && now - so.at > dur) launchStep(so, ms, now, parts, byPid);
    } else if (so && so.ph === "r") {
      const m = so.m || {};
      for (const mid of Object.keys(m)) {
        if (m[mid]) continue;
        const M = ms[mid];
        if (!M) { m[mid] = 1; continue; }           // partie annulée : pas de points
        if (M.ph === "results") { scoreMatch(so, M); m[mid] = 1; }
      }
      so.m = m;
      const left = Object.keys(m).some(mid => ms[mid]);
      if (Object.values(m).every(v => v) && !left) {
        so.k++; delete so.m; delete so.sp; so.ph = "i"; so.at = now;
        if (so.k >= so.pl.length) toFinal(so, now);
      }
    }
    const hold = new Set();
    if (so && (so.ph === "i" || so.ph === "r")) ps.forEach(p => { if (!p.presence.sw) hold.add(p.peer); });
    const changed = JSON.stringify(so || null) !== JSON.stringify(prev && prev.ph ? prev : null);
    return {so: so || null, changed, hold};
  }
  function command(so, sc, ms, now, ps, byPid) {
    const c = sc.c;
    if (c === "go" && so.ph === "m") {
      const pl = (Array.isArray(sc.a) ? sc.a : []).filter(id => typeof id === "string" && gameOf(id)).slice(0, 30);
      if (!pl.length) return so;
      so.pl = pl; so.k = 0; so.ph = "i"; so.at = now; so.d = now; delete so.pz; delete so.sp; delete so.sk;
      participants(ps, ms).forEach(p => idxOf(so, pidOf(p), p.presence.ps));
      const mjName = byPid.get(so.mj) ? byPid.get(so.mj).presence.ps : "le MJ";
      msg(so, `🎉 Soirée lancée par ${mjName} ! ${pl.length} jeu${pl.length > 1 ? "x" : ""} au programme`);
    } else if (c === "stop") {
      if (so.ph === "m" || so.ph === "f" || !standings(so).some(r => r.pl + r.by > 0)) return null;
      toFinal(so, now); msg(so, "⏹ Le maître du jeu a arrêté la soirée : place à la cérémonie !");
    } else if (c === "next" && so.ph === "i") {
      delete so.pz; so.at = now - 1e7;
    } else if (c === "pause" && so.ph === "i") {
      const dur = so.k === 0 && !so.sk ? FIRST_MS : INTER_MS;
      if (so.pz) { so.at = now - (dur - so.pz); delete so.pz; }
      else so.pz = Math.max(1000, dur - (now - so.at));
    } else if (c === "end" && so.ph === "r" && so.m && so.m[sc.a] === 0) {
      const M = ms[sc.a];
      if (M && M.ph !== "results") {
        ms[sc.a] = Object.assign({}, M, {ph: "results", at: now, res: C.gainsFor(M, {winners: [], ranking: [], summary: "Match arrêté par le maître du jeu 🎤"})});
        M.pl.forEach(k => { const i = so.ids.indexOf(pidOfKey(M, k)); if (i >= 0) setR(so, i, so.k, "Z"); });
        so.m[sc.a] = 1;
      }
    } else if (c === "give" && typeof sc.a === "string" && byPid.has(sc.a) && sc.a !== so.mj) {
      const p = byPid.get(sc.a);
      so.mj = sc.a; so.cq = p.presence.sc && p.presence.sc.id || null;
      msg(so, `🎤 ${p.presence.ps} prend le micro !`);
    }
    return so;
  }
  function launchStep(so, ms, now, parts, byPid) {
    const g = gameOf(so.pl[so.k]);
    const idx = parts.map(p => so.ids.indexOf(pidOf(p))).filter(i => i >= 0);
    if (!g || idx.length < g.min) {
      so.sk = (so.sk || []).concat(so.k);
      msg(so, g ? `⏭ ${g.name} sauté : il faut ${g.min} joueurs minimum` : "⏭ Jeu introuvable : sauté");
      so.k++; delete so.sp; delete so.pz; so.at = now - (INTER_MS - SKIP_LEFT_MS);
      if (so.k >= so.pl.length) toFinal(so, now);
      return;
    }
    if (!so.sp || so.sp.x || splitMembers(so.sp) !== idx.slice().sort((a, b) => a - b).join(",")) so.sp = makeSplit(so, g, idx, byPid);
    const sp = so.sp, K = kindOf(g), names = TEAM_NAMES[so.k % TEAM_NAMES.length];
    so.m = {};
    for (const s of sp.g) {
      const ix = cs2i(s), grp = ix.map(i => byPid.get(so.ids[i])).filter(Boolean);
      if (grp.length < g.min) { ix.forEach(i => setR(so, i, so.k, "-")); continue; }
      const M = C.newMatch(g.id, grp, now);
      M.so = so.k + 1;
      if (K === "team" && !sp.lt) {
        const [a, b] = s.split("|");
        M.tm = [cs2i(a).map(i => byPid.get(so.ids[i])).filter(Boolean).map(p => p.peer), cs2i(b).map(i => byPid.get(so.ids[i])).filter(Boolean).map(p => p.peer)];
        M.tn = names.slice();
      }
      ms[M.mid] = M; so.m[M.mid] = 0;
      if (K === "duel" && ix.length === 2) so.pp = (so.pp || "") + s;
    }
    cs2i(sp.by).forEach(i => setR(so, i, so.k, "B"));
    if (so.pp && so.pp.length > 400) so.pp = so.pp.slice(-400);
    so.ph = "r"; so.at = now; delete so.pz;
    if (!Object.keys(so.m).length) { so.k++; delete so.m; delete so.sp; so.ph = "i"; if (so.k >= so.pl.length) toFinal(so, now); }
  }
  function scoreMatch(so, M) {
    const res = M.res || {}, W = res.winners || [], R = res.ranking || [], n = M.pl.length;
    const forfeit = /forfait/i.test(res.summary || "");
    const set = (k, c) => { const i = so.ids.indexOf(pidOfKey(M, k)); if (i >= 0) setR(so, i, so.k, c); };
    if (!W.length) { M.pl.forEach(k => set(k, "D")); return; }
    const win = forfeit ? "F" : "W";
    if (M.tm || n === 2) { M.pl.forEach(k => set(k, W.includes(k) ? win : "L")); return; }
    M.pl.forEach(k => set(k, "Z"));
    W.forEach(k => set(k, win));
    const rest = R.filter(k => !W.includes(k) && M.pl.includes(k));
    if (rest[0]) set(rest[0], "S");
    if (rest[1]) set(rest[1], "T");
  }

  /* ---------- téléphone : présence ---------- */
  const mine = {mj: null, mjAt: 0, sc: null, sw: false, cs: 0};
  function presence() { return {mj: mine.mj, sc: mine.sc, sw: mine.sw ? 1 : null, cs: mine.cs || null}; }
  function sendCmd(c, a) { mine.sc = {c, id: rnd(8)}; if (a !== undefined) mine.sc.a = a; C.pushPresence(); }
  function claim() {
    const so = curSo();
    if (so && so.ph !== "f") { toast(so.ph === "m" ? "Une soirée est déjà en préparation" : "Une soirée est déjà en cours"); return; }
    mine.mj = Math.round(C.hostNow()); mine.mjAt = Date.now(); C.pushPresence(); draftFresh = true;
    toast("🎤 Vous prenez le micro…");
  }

  /* ---------- interface ---------- */
  const looks = new Map(); // id profil -> {lk, xp} vus pendant la session (pour les absents)
  function lookOf(pid) {
    if (pid === myPid()) { const pr = C.profile(); return {lk: C.myLook(), xp: pr.xp || 0}; }
    const p = C.players().find(q => pidOf(q) === pid);
    if (p) { const v = {lk: p.presence.lk, xp: p.presence.xp || 0}; looks.set(pid, v); return v; }
    return looks.get(pid) || {lk: null, xp: 0};
  }
  const svgCache = new Map();
  function avatar(pid, opts) {
    const L = lookOf(pid), k = JSON.stringify([L.lk, L.xp, opts || 0]);
    let s = svgCache.get(k);
    if (!s) { s = A.svg(L.lk, L.xp, opts); svgCache.set(k, s); if (svgCache.size > 150) svgCache.delete(svgCache.keys().next().value); }
    return s;
  }
  const toast = m => C.toast(m);
  let bar = null, panel = null, modal = null, panelOpen = false, panelMode = null, lastAutoKey = null, panelKey = null, snapSo = null;
  let lastLm = null, lastMjSeen = null, lastSoId = null, draft = [], draftFresh = false, giveOpen = false, animKey = null, cerT0 = null, cerTimers = [];

  function setup() {
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    bar = document.createElement("div"); bar.className = "so-bar"; bar.id = "so-bar";
    const tb = document.getElementById("teambar");
    if (tb && tb.parentNode) tb.parentNode.insertBefore(bar, tb);
    panel = document.createElement("div"); panel.className = "so-panel hidden"; panel.id = "so-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Soirée");
    document.body.appendChild(panel);
    modal = document.createElement("div"); modal.id = "so-modal"; document.body.appendChild(modal);
    document.addEventListener("click", onClick);
    const roster = document.getElementById("roster");
    if (roster) roster.addEventListener("click", e => {
      const so = curSo(), li = e.target.closest("li[data-peer]");
      if (!so || so.ph === "f" || so.mj !== myPid() || !li || li.dataset.peer === C.me()) return;
      const p = C.players().find(q => q.peer === li.dataset.peer); if (!p) return;
      e.stopPropagation();
      openModal(`<h3>${esc(p.presence.ps)}</h3><div class="so-row"><button class="btn" type="button" data-so="give" data-a="${esc(pidOf(p))}">Donner le micro 🎤</button><button class="btn alt" type="button" data-so="rival" data-a="${esc(p.peer)}">Voir le face-à-face</button><button class="btn alt" type="button" data-so="mclose">Annuler</button></div>`);
    }, true);
    setInterval(tickUi, 500);
  }
  function openModal(html) { modal.innerHTML = `<div class="so-modal" data-so-bg><div class="so-mcard">${html}</div></div>`; }
  function closeModal() { const u = modal.dataset.url; if (u) { try { URL.revokeObjectURL(u); } catch (e) {} delete modal.dataset.url; } modal.innerHTML = ""; }
  function openPanel() { panelOpen = true; panelKey = null; render(); }
  function closePanel() { panelOpen = false; giveOpen = false; panel.classList.add("hidden"); document.body.classList.remove("so-open"); clearCer(); }
  function clearCer() { cerTimers.forEach(clearTimeout); cerTimers = []; }

  function onClick(e) {
    if (e.target.matches && e.target.matches("[data-so-bg]")) { closeModal(); return; }
    const b = e.target.closest("[data-so]"); if (!b || b.disabled) return;
    const act = b.dataset.so, a = b.dataset.a, so = curSo();
    switch (act) {
      case "claim": claim(); break;
      case "open": openPanel(); break;
      case "close": closePanel(); if (C.renderAll) C.renderAll(); break;
      case "watch": mine.sw = !mine.sw; C.pushPresence(); toast(mine.sw ? "👀 Vous regardez la soirée (vous pouvez vous balader)" : "🙋 Vous rejoindrez la soirée au prochain jeu"); render(); C.renderAll(); break;
      case "add": if (draft.length < 30) draft.push(a); render(); break;
      case "up": { const i = +a; if (i > 0) [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; render(); break; }
      case "down": { const i = +a; if (i < draft.length - 1) [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; render(); break; }
      case "rm": draft.splice(+a, 1); render(); break;
      case "clear": draft = []; render(); break;
      case "preset": draft = preset(a, countForMenu()); render(); break;
      case "go": if (draft.length) { sendCmd("go", draft.slice()); toast("🎉 C'est parti !"); } break;
      case "cancel": sendCmd("stop"); closePanel(); break;
      case "next": sendCmd("next"); break;
      case "pause": sendCmd("pause"); break;
      case "stop": sendCmd("stop"); break;
      case "end": sendCmd("end", a); toast("Match arrêté"); break;
      case "givelist": giveOpen = !giveOpen; panelKey = null; render(); break;
      case "give": sendCmd("give", a); closeModal(); giveOpen = false; toast("🎤 Micro transmis !"); break;
      case "rival": closeModal(); if (C.openRival) C.openRival(a); break;
      case "mclose": closeModal(); break;
      case "photo": photoFlow(b.dataset.kind || (so && so.ph === "f" ? "soiree" : "groupe")); break;
      case "share": shareBlob(); break;
      case "save": saveBlob(); break;
      case "replay": cerT0 = Date.now(); panelKey = null; render(); break;
    }
  }

  /* playlist : nombre de joueurs pris en compte et préréglages */
  function countForMenu() { return C.players().filter(p => p.presence.ps && !p.presence.sw).length; }
  function preset(kind, n) {
    const ok = id => { const g = gameOf(id); return g && n >= g.min; };
    if (kind === "surprise") {
      const all = shuffle(C.games().map(g => g.id).filter(ok));
      const pick = [], want = Math.min(6, all.length);
      for (const K of ["duel", "group", "team"]) { const g = all.find(id => kindOf(gameOf(id)) === K && !pick.includes(id)); if (g) pick.push(g); }
      let longs = pick.filter(id => minutesOf(id) >= 8).length;
      for (const id of all) { if (pick.length >= want) break; if (pick.includes(id)) continue; if (minutesOf(id) >= 8) { if (longs >= 2) continue; longs++; } pick.push(id); }
      shuffle(pick);
      if (pick.length > 1 && minutesOf(pick[0]) >= 8) { const j = pick.findIndex(id => minutesOf(id) < 8); if (j > 0) [pick[0], pick[j]] = [pick[j], pick[0]]; }
      return pick;
    }
    const base = (PRESETS[kind] || []).filter(ok);
    return base.slice(0, kind === "express" ? 5 : 6);
  }
  const estMin = list => Math.round(list.reduce((s, id) => s + minutesOf(id) + STEP_OVERHEAD, 0));

  function render() {
    renderBar();
    if (!panel) return;
    const inLobby = C.inLobby();
    let so = curSo();
    if (!so && panelOpen && panelMode === "f" && snapSo) so = snapSo;
    const amMJ = so && so.mj === myPid();
    const mode = !so ? null : so.ph === "m" ? (amMJ ? "m" : null) : so.ph;
    if (!panelOpen) return;
    if (!mode) { closePanel(); return; }
    if (!inLobby) { panel.classList.add("hidden"); document.body.classList.remove("so-open"); panelKey = null; return; }
    panelMode = mode;
    const st = C.hostSt(), ms = st && st.ms ? st.ms : {};
    const live = so.m ? Object.keys(so.m).map(mid => ms[mid] ? mid + ms[mid].ph + (ms[mid].res ? (ms[mid].res.winners || []).join() : "") : mid).join() : "";
    const ps = C.players().map(p => [pidOf(p), p.presence.ps, p.presence.sw ? 1 : 0, JSON.stringify(p.presence.lk).length, p.presence.xp, p.presence.cs ? 1 : 0]);
    const key = JSON.stringify([mode, so, live, ps, mode === "m" ? [draft, countForMenu()] : 0, mine.sw, giveOpen, cerT0]);
    panel.classList.remove("hidden"); document.body.classList.add("so-open");
    if (key === panelKey) return;
    panelKey = key;
    const keepScroll = panel.scrollTop;
    panel.innerHTML = `<div class="so-card"><button class="so-x" type="button" data-so="close" aria-label="Réduire">✕</button>${mode === "m" ? menuHtml(so) : mode === "f" ? ceremonyHtml(so) : stepHtml(so, ms)}</div>`;
    panel.scrollTop = mode === "f" ? 0 : keepScroll;
    if (mode === "i" || mode === "r") animateStandings(so);
    if (mode === "f") runCeremony(so);
    tickUi();
  }
  function renderBar() {
    if (!bar) return;
    const so = curSo(), me = myPid();
    let h;
    if (!so) h = `<span class="so-lbl">🎉 <b>Mode soirée</b> : une playlist de jeux, un classement, un champion.</span><span class="so-btns"><button class="btn" type="button" data-so="claim">🎉 Lancer une soirée</button><button class="chip" type="button" data-so="photo" data-kind="groupe">📸 Photo de groupe</button></span>`;
    else {
      const mjName = so.nm[so.ids.indexOf(so.mj)] || (C.players().find(p => pidOf(p) === so.mj) || {presence: {}}).presence.ps || "?";
      const amMJ = so.mj === me;
      if (so.ph === "m") h = `<span class="so-lbl">🎤 <b>${esc(mjName)}</b> ${amMJ ? "(vous) prépare" : "prépare"} une soirée…</span><span class="so-btns">${amMJ ? `<button class="btn" type="button" data-so="open">📝 Ma playlist</button><button class="chip" type="button" data-so="cancel">Annuler</button>` : `<button class="chip" type="button" data-so="photo" data-kind="groupe">📸 Photo de groupe</button>`}</span>`;
      else if (so.ph === "f") {
        const S = standings(so);
        h = `<span class="so-lbl">🏆 Soirée terminée : <b>${esc(S[0] ? S[0].name : "?")}</b> est Mister Olympia !</span><span class="so-btns"><button class="btn" type="button" data-so="open">🏆 Cérémonie</button><button class="chip" type="button" data-so="photo" data-kind="soiree">📸 Photo</button>${amMJ ? `<button class="chip" type="button" data-so="stop">Fermer la soirée</button>` : `<button class="chip" type="button" data-so="claim">🎉 Nouvelle soirée</button>`}</span>`;
      } else {
        const N = so.pl.length, g = gameOf(so.pl[so.k]), n = countForMenu();
        const what = so.ph === "r" ? `Jeu ${so.k + 1}/${N} en cours : <b>${esc(g ? g.name : "?")}</b>` : `Jeu ${so.k + 1}/${N} · prochain : <b>${esc(g ? g.name : "?")}</b> <small>${esc(g ? modeOf(g, n, true) : "")}</small>`;
        h = `<span class="so-lbl">🎉 <b>Soirée</b> 🎤 ${esc(mjName)} · ${what}</span><span class="so-btns"><button class="btn" type="button" data-so="open">📊 Classement</button><button class="chip" type="button" data-so="watch">${mine.sw ? "Je participe 🙋" : "Je regarde seulement 👀"}</button></span>`;
      }
    }
    if (bar.dataset.h !== h) { bar.dataset.h = h; bar.innerHTML = h; }
    bar.classList.toggle("on", !!so);
  }

  /* menu du MJ */
  function menuHtml(so) {
    const n = countForMenu(), games = C.games();
    const list = draft.map((id, i) => { const g = gameOf(id); if (!g) return ""; const bad = n < g.min; return `<li class="${bad ? "bad" : ""}"><span class="so-num">${i + 1}</span><span class="so-gn"><b>${esc(g.name)}</b><small>${esc(modeOf(g, n))} · ${minutesOf(id)} min</small></span><span class="so-ord"><button type="button" class="so-ic" data-so="up" data-a="${i}" aria-label="Monter"${i ? "" : " disabled"}>↑</button><button type="button" class="so-ic" data-so="down" data-a="${i}" aria-label="Descendre"${i < draft.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="so-ic rm" data-so="rm" data-a="${i}" aria-label="Retirer">✕</button></span></li>`; }).join("");
    const cat = Object.keys(C.PLACES).map(pl => {
      const gs = games.filter(g => C.placeOfGame(g) === pl);
      return `<h3>${C.PLACES[pl].emoji} ${esc(C.PLACES[pl].name)}</h3><div class="so-cat">${gs.map(g => { const bad = n < g.min, cnt = draft.filter(x => x === g.id).length; return `<button type="button" class="so-gbtn${bad ? " off" : ""}" data-so="add" data-a="${g.id}"${bad ? " disabled" : ""} style="--tc:${g.color || "#888"}"><b>${esc(g.name)}${cnt ? ` <i>×${cnt}</i>` : ""}</b><small>${rangeOf(g)} · ${bad ? `<span class="so-why">${esc(modeOf(g, n))}</span>` : esc(modeOf(g, n, true)) + " · " + minutesOf(g.id) + " min"}</small></button>`; }).join("")}</div>`;
    }).join("");
    return `<div class="so-kicker">🎤 Vous êtes le maître du jeu</div><h2>Votre soirée</h2>
      <p class="so-sub">${n} joueur${n > 1 ? "s" : ""} dans la salle${n < 2 ? " : il en faut au moins 2" : ""}. Touchez les jeux pour les ajouter dans l'ordre.</p>
      <div class="so-presets"><button class="chip" type="button" data-so="preset" data-a="express">⚡ Express (5 jeux)</button><button class="chip" type="button" data-so="preset" data-a="duels">🥊 Spécial duels</button><button class="chip" type="button" data-so="preset" data-a="team">🤝 Team building</button><button class="chip" type="button" data-so="preset" data-a="surprise">🎲 Surprise</button></div>
      <div class="so-plbox"><div class="so-plhead"><b>Playlist</b><span>${draft.length ? `${draft.length} jeu${draft.length > 1 ? "x" : ""} · ≈ ${estMin(draft)} min` : "vide"}</span>${draft.length ? `<button type="button" class="so-link" data-so="clear">Vider</button>` : ""}</div>
      ${draft.length ? `<ol class="so-pl">${list}</ol>` : `<p class="so-empty">Ajoutez des jeux ci-dessous ou choisissez un préréglage.</p>`}</div>
      ${cat}
      <div class="so-foot"><button class="btn red" type="button" data-so="go"${draft.length && n >= 2 ? "" : " disabled"}>Lancer la soirée ! ${draft.length ? `(${draft.length})` : ""}</button><button class="btn alt" type="button" data-so="cancel">Annuler</button></div>`;
  }

  /* entracte et étape en cours */
  function nameOf(so, pid) { const i = so.ids.indexOf(pid); return i >= 0 ? so.nm[i] : ((C.players().find(p => pidOf(p) === pid) || {presence: {}}).presence.ps || "?"); }
  function splitHtml(so, sp, g) {
    if (!sp || !g) return "";
    if (sp.x) return `<span class="so-warn">⚠️ Il faut ${g.min} joueurs minimum : ce jeu sera sauté</span>`;
    const nm = i => `<b>${esc(so.nm[i] || "?")}</b>`, K = kindOf(g);
    const tl = i => sp.lt ? C.teamLabel(i) : TEAM_NAMES[so.k % TEAM_NAMES.length][i];
    const parts = sp.g.map((s, n) => {
      if (s.includes("|")) { const [a, b] = s.split("|"); return `<span class="so-pair">${sp.g.length > 1 ? `<small>Match ${n + 1}</small> ` : ""}🔴 <em>${esc(tl(0))}</em> ${cs2i(a).map(nm).join(", ")} <i>vs</i> 🔵 <em>${esc(tl(1))}</em> ${cs2i(b).map(nm).join(", ")}</span>`; }
      const ix = cs2i(s);
      if (K === "duel" && ix.length === 2) return `<span class="so-pair">${nm(ix[0])} <i>vs</i> ${nm(ix[1])}</span>`;
      return `<span class="so-pair">${sp.g.length > 1 ? `<small>Groupe ${n + 1}</small> ` : ""}${ix.map(nm).join(", ")}</span>`;
    });
    if (sp.by) parts.push(`<span class="so-pair bye">${cs2i(sp.by).map(nm).join(", ")} exempt 😴 <small>+1 pt</small></span>`);
    return parts.join("");
  }
  function stepHtml(so, ms) {
    const N = so.pl.length, me = myPid(), amMJ = so.mj === me, g = gameOf(so.pl[so.k]);
    const mjName = nameOf(so, so.mj), n = countForMenu();
    const myI = so.ids.indexOf(me);
    let h = `<div class="so-kicker">🎉 Soirée · 🎤 ${esc(mjName)}${amMJ ? " (vous)" : ""}</div>`;
    if (so.ph === "i") {
      const first = so.k === 0 && !doneLen(so);
      h += first ? `<h2 class="so-big">Soirée lancée par ${esc(mjName)} !</h2><p class="so-sub">${N} jeu${N > 1 ? "x" : ""} au programme · ≈ ${estMin(so.pl)} min · tout le monde participe</p>`
        : `<h2>Classement après ${so.k} jeu${so.k > 1 ? "x" : ""}</h2>`;
      if (so.lm && /⏭/.test(so.lm[1])) h += `<p class="so-note">${esc(so.lm[1])}</p>`;
      h += `<div class="so-next"><small>Prochain jeu · ${so.k + 1}/${N}</small><b>${esc(g ? g.name : "?")}</b><span class="so-mode">${g && !(so.sp && so.sp.x) ? `${C.PLACES[C.placeOfGame(g)].emoji} ${esc(modeOf(g, (so.sp && !so.sp.x) ? cs2i((so.sp.g || []).join("") + (so.sp.by || "")).length : n))}` : ""}</span>
        <div class="so-split">${splitHtml(so, so.sp, g)}</div>
        <div class="so-cd" data-so-cd>${so.pz ? "⏸ En pause" : ""}</div></div>`;
      if (first) h += `<div class="so-prog">${so.pl.map((id, i) => { const gg = gameOf(id); return `<span class="${i === so.k ? "cur" : ""}">${i + 1}. ${esc(gg ? gg.name : id)}</span>`; }).join("")}</div>`;
    } else {
      h += `<h2>Jeu ${so.k + 1}/${N} : ${esc(g ? g.name : "?")}</h2><p class="so-sub">${g ? esc(modeOf(g, n)) : ""} · on attend la fin de toutes les parties</p>`;
      const mids = Object.keys(so.m || {});
      const rows = mids.map(mid => {
        const M = ms[mid];
        if (!M) return `<li><span>Partie terminée</span><span class="so-st done">✔</span></li>`;
        const who = M.tm ? M.tm.map((t, i) => (i ? "🔵 " : "🔴 ") + t.map(k => esc(M.ro[k] ? M.ro[k].p : "?")).join(", ")).join(" <i>vs</i> ") : M.pl.map(k => esc(M.ro[k] ? M.ro[k].p : "?")).join(M.pl.length === 2 ? " <i>vs</i> " : ", ");
        const res = M.res, W = res && res.winners || [];
        const st = M.ph === "chosen" ? `<span class="so-st">⏳ 3, 2, 1…</span>` : M.ph === "playing" ? `<span class="so-st live">🎮 en cours</span>` : `<span class="so-st done">✔ ${W.length ? (M.tm ? esc((M.tn && M.tn[M.tm[0].includes(W[0]) ? 0 : 1]) || "Équipe") : W.map(k => esc(M.ro[k] ? M.ro[k].p : "?")).join(", ")) + " gagne" : "nul"}</span>`;
        return `<li><span class="so-who">${who}</span>${st}${amMJ && M.ph !== "results" ? `<button class="chip so-end" type="button" data-so="end" data-a="${esc(mid)}">Terminer ce match</button>` : ""}</li>`;
      }).join("");
      h += `<ul class="so-matches">${rows}</ul>`;
      if (so.sp && so.sp.by) h += `<p class="so-note">😴 ${cs2i(so.sp.by).map(i => esc(so.nm[i] || "?")).join(", ")} exempt${cs2i(so.sp.by).length > 1 ? "s" : ""} ce tour-ci (+1 pt)</p>`;
      const playing = mids.some(mid => ms[mid] && ms[mid].pl.includes(C.me()));
      if (!playing && !mine.sw) h += `<p class="so-sub">Vous ne jouez pas ce tour-ci : vous rejoindrez au prochain jeu.</p>`;
      const nx = gameOf(so.pl[so.k + 1]);
      if (nx) h += `<p class="so-sub">Ensuite : <b>${esc(nx.name)}</b> (${esc(modeOf(nx, n, true))})</p>`;
    }
    h += `<div class="so-stand" data-so-stand></div>`;
    h += `<div class="so-row"><button class="chip" type="button" data-so="watch">${mine.sw ? "Je participe 🙋" : "Je regarde seulement 👀"}</button>${myI >= 0 ? "" : `<small class="so-dim">${mine.sw ? "Vous regardez." : "Vous entrez dans la soirée au prochain jeu."}</small>`}</div>`;
    if (amMJ) {
      h += `<div class="so-mj"><b>🎤 Commandes du maître du jeu</b><div class="so-row">${so.ph === "i" ? `<button class="btn" type="button" data-so="next">Suivant ▶</button><button class="btn alt" type="button" data-so="pause">${so.pz ? "Reprendre ▶" : "Pause ⏸"}</button>` : ""}<button class="btn alt" type="button" data-so="givelist">Donner le micro 🎤</button><button class="btn alt" type="button" data-so="stop">Arrêter la soirée ⏹</button></div>`;
      if (giveOpen) h += `<div class="so-row">${C.players().filter(p => pidOf(p) !== me).map(p => `<button class="chip" type="button" data-so="give" data-a="${esc(pidOf(p))}">🎤 ${esc(p.presence.ps)}</button>`).join("") || `<small class="so-dim">Personne d'autre dans la salle.</small>`}</div>`;
      h += `</div>`;
    }
    return h;
  }
  // classement animé : les barres partent du classement précédent puis la course reprend
  function animateStandings(so) {
    const box = panel.querySelector("[data-so-stand]"); if (!box) return;
    const L = doneLen(so), now = standings(so);
    const prev = standings(so, so.ph === "i" && L > 0 ? L - 1 : L);
    if (!now.length) { box.innerHTML = `<p class="so-dim">Le classement apparaîtra après le premier jeu.</p>`; return; }
    const prevRank = {}; prev.forEach((r, n) => { prevRank[r.pid] = {n, rank: r.rank, pts: r.pts}; });
    const max = Math.max(3, ...now.map(r => r.pts)), RH = 50;
    const ak = so.i + ":" + L + ":" + so.ph;
    const anim = ak !== animKey && so.ph === "i" && L > 0;
    animKey = ak;
    const me = myPid();
    box.style.height = now.length * RH + "px";
    box.classList.toggle("anim", anim);
    box.innerHTML = now.map((r, n) => {
      const p = prevRank[r.pid] || {n, rank: r.rank, pts: 0}, d = so.ph === "i" && L > 1 ? p.rank - r.rank : 0;
      const top = (anim ? p.n : n) * RH, w = ((anim ? p.pts : r.pts) / max * 100).toFixed(1);
      const last = r.s.slice(-1);
      return `<div class="so-sr${r.pid === me ? " me" : ""}" data-pid="${esc(r.pid)}" data-top="${n * RH}" data-w="${(r.pts / max * 100).toFixed(1)}" style="top:${top}px">
        <span class="so-rk">${r.rank}</span><span class="so-av">${avatar(r.pid, {view: "bust"})}</span>
        <span class="so-nmw"><b>${esc(r.name)}${so.mj === r.pid ? " 🎤" : ""}</b><span class="so-barw"><i style="width:${w}%"></i></span></span>
        <span class="so-pts"><b>${r.pts}</b><small>pt${r.pts > 1 ? "s" : ""}</small>${d > 0 ? `<em class="up">▲${d}</em>` : d < 0 ? `<em class="dn">▼${-d}</em>` : so.ph === "i" && L > 0 && last && last !== "-" ? `<em class="eq">+${PTS[last] || 0}</em>` : ""}</span></div>`;
    }).join("");
    if (anim) requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      box.querySelectorAll(".so-sr").forEach(el => { el.style.top = el.dataset.top + "px"; const i = el.querySelector(".so-barw i"); if (i) i.style.width = el.dataset.w + "%"; });
    }, 250)));
  }

  /* ---------- cérémonie ---------- */
  function awards(so) {
    const S = standings(so).filter(r => r.pl + r.by > 0);
    if (S.length < 2) return [];
    const kinds = so.pl.map(id => { const g = gameOf(id); return g ? kindOf(g) : "group"; });
    const X = S.map(r => {
      let duelW = 0, teamW = 0, bluffW = 0, streak = 0, best = 0; const pts = [];
      r.s.split("").forEach((c, k) => {
        if (c === "-") { streak = 0; return; }
        const win = c === "W" || c === "F";
        if (win && kinds[k] === "duel") duelW++;
        if (win && kinds[k] === "team") teamW++;
        if (win && BLUFF.has(so.pl[k])) bluffW++;
        streak = win ? streak + 1 : c === "B" ? streak : 0; best = Math.max(best, streak);
        if (c !== "B") pts.push(PTS[c] || 0);
      });
      const mean = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
      const vr = pts.length ? pts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / pts.length : 9;
      return Object.assign({}, r, {duelW, teamW, bluffW, best, mean, vr, np: pts.length});
    });
    const used = new Set(), out = [];
    const give = (e, t, d, list, reuse) => {
      const c = list.find(x => !used.has(x.pid)) || (reuse ? list[0] : null);
      if (!c) return; used.add(c.pid); out.push({e, t, pid: c.pid, name: c.name, d: d(c)});
    };
    const by = (f, min) => X.filter(x => f(x) >= min).sort((a, b) => f(b) - f(a) || a.rank - b.rank);
    give("⭐", "MVP", x => `${x.w} victoire${x.w > 1 ? "s" : ""}`, by(x => x.w, 1), true);
    give("🥊", "Machine à duels", x => `${x.duelW} duels gagnés`, by(x => x.duelW, 2));
    give("🃏", "Roi du bluff", x => `${x.bluffW} victoire${x.bluffW > 1 ? "s" : ""} au culot`, by(x => x.bluffW, 1));
    give("🔥", "Inarrêtable", x => `${x.best} victoires d'affilée`, by(x => x.best, 2));
    give("🥈", "Toujours 2ᵉ", x => `${x.sec} fois deuxième`, by(x => x.sec, 2));
    give("🤝", "Esprit d'équipe", x => `${x.teamW} victoire${x.teamW > 1 ? "s" : ""} en équipe`, by(x => x.teamW, 1));
    give("📏", "Le plus régulier", x => `${x.mean.toFixed(1)} pt par jeu, sans faiblir`, X.filter(x => x.np >= 3 && x.mean >= 1).sort((a, b) => a.vr - b.vr || b.mean - a.mean));
    give("😴", "Roi de la sieste", x => `${x.by} exemption${x.by > 1 ? "s" : ""}`, by(x => x.by, 1));
    const res = out.slice(0, 6);
    if (S.length >= 3) { const L = S[S.length - 1]; res.push({e: "🏮", t: "Lanterne rouge", pid: L.pid, name: L.name, d: `${L.pts} pt${L.pts > 1 ? "s" : ""}, mais quel cardio`}); }
    return res;
  }
  function applyBonus(so) {
    const pr = C.profile(); if (!pr || pr.lastSo === so.i) return null;
    const S = standings(so).filter(r => r.pl + r.by > 0);
    pr.lastSo = so.i;
    const n = S.findIndex(r => r.pid === myPid());
    let out = null;
    if (n >= 0 && n < 3 && S.length >= 2 && !(n === 2 && S.length < 4)) {
      const [xp, sh] = BONUS[n];
      pr.xp += xp; pr.sh = (pr.sh || 0) + sh;
      if (n === 0) { mine.cs = 1; pr.loot = (pr.loot || 0) + 1; }
      out = {n, xp, sh};
    }
    C.saveProfile(); C.pushPresence(); C.renderAll();
    return out;
  }
  let myBonus = null;
  function ceremonyHtml(so) {
    const S = standings(so).filter(r => r.pl + r.by > 0), top = S.slice(0, 3);
    const AW = awards(so);
    const poses = ["flex", "most", "kiss"], H = [118, 84, 62], order = [1, 0, 2];
    const pod = order.filter(n => top[n]).map(n => { const r = top[n]; return `<div class="so-step s${n + 1}" data-rev="${n}"><div class="so-fig">${n === 0 ? `<span class="so-trophy">🏆</span>` : ""}${avatar(r.pid, {pose: poses[n]})}</div><b>${esc(r.name)}</b><span class="so-ptsb">${r.pts} pt${r.pts > 1 ? "s" : ""}</span><div class="so-blk" style="height:${H[n]}px"><span>${n + 1}</span></div></div>`; }).join("");
    const b = myBonus && myBonus.so === so.i ? myBonus.b : null;
    return `<div class="so-cer"><div class="so-kicker">🎉 ${so.pl.length} jeux · ${S.length} athlètes</div><h2 class="so-olympia">Mister Olympia<small>de la soirée</small></h2>
      <div class="so-drum" data-so-drum>🥁 Roulement de tambour…</div>
      <div class="so-pod">${pod || `<p class="so-dim">Pas assez de jeux joués pour un podium.</p>`}</div>
      <div class="so-after" data-rev="aw">
        ${S[0] ? `<p class="so-champ-l">👑 <b>${esc(S[0].name)}</b> est champion de la soirée : +${BONUS[0][0]} XP, +${BONUS[0][1]} 🥤 et un shaker mystère 🎁</p>` : ""}
        ${b ? `<p class="so-mybonus">Votre bonus de podium : <b>+${b.xp} XP</b> et <b>+${b.sh} 🥤</b>${b.n === 0 ? " · titre « 👑 Champion de la soirée »" : ""}</p>` : ""}
        ${AW.length ? `<h3>Les trophées</h3><ul class="so-aw">${AW.map(a => `<li><span class="so-awe">${a.e}</span><span><b>${esc(a.t)}</b><small>${esc(a.name)} · ${esc(a.d)}</small></span><span class="so-awav">${avatar(a.pid, {view: "bust"})}</span></li>`).join("")}</ul>` : ""}
        <h3>Classement final</h3><ol class="so-final">${standings(so).map(r => `<li><span>${r.rank}.</span><b>${esc(r.name)}${so.mj === r.pid ? " 🎤" : ""}</b><small>${r.w} V · ${r.l} D${r.by ? ` · ${r.by} exempt` : ""}</small><em>${r.pts} pt${r.pts > 1 ? "s" : ""}</em></li>`).join("")}</ol>
        <div class="so-row so-center"><button class="btn red" type="button" data-so="photo" data-kind="soiree">📸 Photo souvenir</button><button class="btn alt" type="button" data-so="replay">Rejouer la remise</button><button class="btn alt" type="button" data-so="close">Retour au lobby</button>${so.mj === myPid() && curSo() ? `<button class="btn alt" type="button" data-so="stop">Fermer la soirée</button>` : ""}</div>
      </div></div>`;
  }
  function runCeremony(so) {
    clearCer();
    const t0 = cerT0 || Date.now(), el = Date.now() - t0;
    const steps = [["2", 1600], ["1", 4200], ["0", 7200], ["aw", 8600]];
    const reveal = k => { const e = panel.querySelector(`[data-rev="${k}"]`); if (e) e.classList.add("rev"); if (k === "0") { confetti(); const d = panel.querySelector("[data-so-drum]"); if (d) d.textContent = "👑 Et le vainqueur est…"; } if (k === "aw") { const d = panel.querySelector("[data-so-drum]"); if (d) d.classList.add("gone"); } };
    const instant = k => { const e = panel.querySelector(`[data-rev="${k}"]`); if (e) e.classList.add("rev", "now"); const d = panel.querySelector("[data-so-drum]"); if (d && k === "aw") d.classList.add("gone"); else if (d && k === "0") d.textContent = "👑 Et le vainqueur est…"; };
    if (el < 1500 && drumFor !== t0) { drumFor = t0; drumroll(7000); }
    steps.forEach(([k, at]) => { if (at <= el) instant(k); else cerTimers.push(setTimeout(() => reveal(k), at - el)); });
  }
  let actx = null, drumFor = null;
  function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); return actx; } catch (e) { return null; } }
  function drumroll(ms) {
    const a = audio(); if (!a || a.state !== "running") return;
    try {
      const len = Math.floor(a.sampleRate * .06), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const t0 = a.currentTime + .05, n = Math.floor(ms / 60);
      for (let i = 0; i < n; i++) {
        const s = a.createBufferSource(), gn = a.createGain(), f = a.createBiquadFilter(), t = t0 + i * .06;
        s.buffer = buf; f.type = "bandpass"; f.frequency.value = 1500; gn.gain.value = .04 + .22 * (i / n);
        s.connect(f); f.connect(gn); gn.connect(a.destination); s.start(t);
      }
      const L2 = a.sampleRate * 1.4, b2 = a.createBuffer(1, L2, a.sampleRate), d2 = b2.getChannelData(0);
      for (let i = 0; i < L2; i++) d2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L2, 3);
      const s2 = a.createBufferSource(), g2 = a.createGain(), f2 = a.createBiquadFilter(); s2.buffer = b2; f2.type = "highpass"; f2.frequency.value = 3000; g2.gain.value = .35;
      s2.connect(f2); f2.connect(g2); g2.connect(a.destination); s2.start(t0 + n * .06);
    } catch (e) {}
  }
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cols = ["#ffd23f", "#ff2e88", "#3ccf8e", "#2fa8ff", "#b14dff", "#ff7b00", "#ffffff"];
    const box = document.createElement("div"); box.className = "so-conf";
    for (let i = 0; i < 110; i++) { const c = document.createElement("i"); c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() * 160 - 80).toFixed(0)}px;--r:${Math.floor(Math.random() * 900)}deg;animation-delay:${(Math.random() * .9).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.8).toFixed(2)}s`; box.appendChild(c); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 5200);
  }

  /* ---------- photo souvenir (canvas 1080×1350 → PNG) ---------- */
  let photoBlob = null, photoName = "gonflette.png";
  const FD = `"Anton", Impact, "Arial Narrow Bold", "Arial Black", sans-serif`, FU = `"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif`;
  function loadImg(svg, w, h) {
    return new Promise(res => {
      const img = new Image(), t = setTimeout(() => res(null), 4000);
      img.onload = () => { clearTimeout(t); res(img); };
      img.onerror = () => { clearTimeout(t); res(null); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/<svg\b/, `<svg width="${w}" height="${h}"`));
    });
  }
  const dateFr = t => { try { return new Date(t).toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"}); } catch (e) { return new Date(t).toDateString(); } };
  function rr(x, cx, cy, w, h, r) { x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); }
  function fitText(x, t, max, size, weight, fam) { let s = size; do { x.font = `${weight} ${s}px ${fam}`; s -= 2; } while (x.measureText(t).width > max && s > 10); return t; }
  function drawDecor(x, W, H, pl) {
    const floorY = 520;
    if (pl === "salle") {
      x.fillStyle = "#2a3138"; x.fillRect(0, 0, W, H);
      const m = x.createLinearGradient(0, 200, W, 380); m.addColorStop(0, "#9fb6c6"); m.addColorStop(.3, "#d6e6ef"); m.addColorStop(.31, "#a8c0cf"); m.addColorStop(.55, "#c9dbe6"); m.addColorStop(1, "#9cb3c3");
      x.fillStyle = m; x.globalAlpha = .55; x.fillRect(40, 190, W - 80, 230); x.globalAlpha = 1; x.strokeStyle = "#8a939b"; x.lineWidth = 10; x.strokeRect(40, 190, W - 80, 230);
      x.save(); x.translate(W / 2, 470); x.rotate(-.04); x.font = `64px "Pacifico", "Brush Script MT", cursive`; x.textAlign = "center"; x.shadowColor = "#ff2e88"; x.shadowBlur = 30; x.fillStyle = "#fff"; x.fillText("No pain no gain", 0, 0); x.restore();
      x.fillStyle = "#222629"; x.fillRect(0, floorY + 40, W, H - floorY); x.fillStyle = "#444b52"; x.fillRect(0, floorY + 40, W, 10);
      x.strokeStyle = "#00000066"; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * W / 8, floorY + 50); x.lineTo(i * W / 8 + (i - 4) * 60, H); x.stroke(); }
    } else if (pl === "ring") {
      const g = x.createRadialGradient(W / 2, 0, 50, W / 2, 0, H); g.addColorStop(0, "#3b2160"); g.addColorStop(.4, "#1a1030"); g.addColorStop(1, "#0b0712"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (let row = 0; row < 3; row++) { x.fillStyle = ["#120b1d", "#0f0918", "#0b0712"][row]; const r = 14 + row * 3, y = 250 + row * 55; for (let cx = (row * 11) % 30; cx < W + 30; cx += r * 2.3) { x.beginPath(); x.arc(cx, y, r, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx, y + r * 2.2, r * 1.2, r * 1.3, 0, 0, 7); x.fill(); } }
      for (let i = 0; i < 3; i++) { x.save(); x.globalAlpha = .13; x.fillStyle = "#fff4d6"; x.beginPath(); const cx = 180 + i * 360; x.moveTo(cx - 10, 0); x.lineTo(cx + 10, 0); x.lineTo(cx + 230, floorY + 300); x.lineTo(cx - 230, floorY + 300); x.fill(); x.restore(); }
      const f = x.createLinearGradient(0, floorY, 0, H); f.addColorStop(0, "#cfd5e0"); f.addColorStop(.3, "#e8ebf1"); f.addColorStop(1, "#dde1e9"); x.fillStyle = f; x.fillRect(0, floorY + 30, W, H);
      [["#c1121f", 0], ["#f2f2f2", 22], ["#1d4fb8", 44]].forEach(([c, dy]) => { x.fillStyle = c; x.fillRect(0, floorY - 60 + dy, W, 9); });
    } else {
      const g = x.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, "#3a2163"); g.addColorStop(.45, "#b83b6e"); g.addColorStop(.8, "#ff8a3d"); g.addColorStop(1, "#ffd36e"); x.fillStyle = g; x.fillRect(0, 0, W, 470);
      x.save(); x.beginPath(); x.arc(W * .7, 330, 120, 0, 7); x.clip(); x.fillStyle = "#ffe066"; for (let y = 210; y < 460; y += 26) x.fillRect(W * .7 - 130, y, 260, 18); x.restore();
      x.fillStyle = "#1a7fa5"; x.fillRect(0, 440, W, 80); for (let i = 0; i < W; i += 56) { x.fillStyle = "#2591b8"; x.fillRect(i, 440, 28, 80); } x.fillStyle = "#e9f6ff"; x.fillRect(0, 516, W, 8);
      const s = x.createLinearGradient(0, 524, 0, H); s.addColorStop(0, "#e8c27f"); s.addColorStop(1, "#f4d699"); x.fillStyle = s; x.fillRect(0, 524, W, H);
      x.fillStyle = "#c9975288"; for (let i = 0; i < 500; i++) { x.fillRect((i * 97) % W, 530 + (i * 53) % (H - 530), 3, 3); }
      const palm = (px, flip) => { x.save(); x.translate(px, 0); x.scale(flip ? -1 : 1, 1); x.strokeStyle = "#3b1f12"; x.lineWidth = 16; x.beginPath(); x.moveTo(40, 530); x.quadraticCurveTo(60, 380, 30, 230); x.stroke(); x.fillStyle = "#2c1a35"; for (let a = 0; a < 6; a++) { x.save(); x.translate(30, 230); x.rotate(-2.6 + a * .7); x.beginPath(); x.ellipse(70, 0, 80, 16, 0, 0, 7); x.fill(); x.restore(); } x.restore(); };
      palm(-10, false); palm(W + 10, true);
    }
    return floorY;
  }
  async function makePhoto(kind) {
    const so = kind === "soiree" ? (curSo() && curSo().ph === "f" ? curSo() : snapSo || curSo()) : null;
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`80px Anton`), document.fonts.load(`700 40px "Barlow Condensed"`), document.fonts.load(`40px Pacifico`)]), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
    const pl = C.place();
    drawDecor(x, W, H, pl);
    // titre
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#00000066"; x.fillRect(0, 0, W, 190);
    fitText(x, "GONFLETTE PARTY", W - 80, 110, "400", FD);
    x.lineWidth = 10; x.strokeStyle = "#1d1420"; x.fillStyle = "#e63946"; x.fillText("GONFLETTE PARTY", W / 2 + 6, 122); x.strokeText("GONFLETTE PARTY", W / 2, 116); x.fillStyle = "#ffcc33"; x.fillText("GONFLETTE PARTY", W / 2, 116);
    const date = dateFr(so ? (so.d || Date.now()) : Date.now());
    const sub = so ? `Soirée du ${date}` : `Photo de groupe · ${date} · ${C.PLACES[pl] ? C.PLACES[pl].name : ""}`;
    fitText(x, sub, W - 80, 44, "700", FU); x.fillStyle = "#fff"; x.fillText(sub, W / 2, 172);
    // personnages
    let people;
    if (so) { people = standings(so).map(r => ({pid: r.pid, name: r.name, pts: r.pts, rank: r.rank, played: r.pl + r.by > 0})).filter(p => p.played); }
    else people = C.players().map(p => ({pid: pidOf(p), name: p.presence.ps}));
    people.forEach(p => { const L = lookOf(p.pid); p.lk = L.lk; p.xp = L.xp; p.k = .78 + .22 * Math.log(Math.max(1, A.size(L.xp))) / Math.log(8); });
    const AW = so ? awards(so) : [];
    const draw = async (p, cx, feetY, h, pose) => {
      const w = h * 290 / 280, img = await loadImg(A.svg(p.lk, p.xp, pose ? {pose} : undefined), Math.round(w), Math.round(h));
      if (img) x.drawImage(img, cx - w / 2, feetY - h * (272 / 280), w, h);
    };
    const label = (t, cx, y, size, bg, fg) => { x.font = `800 ${size}px ${FU}`; const tw = Math.min(x.measureText(t).width, 300) + size; x.fillStyle = bg; rr(x, cx - tw / 2, y - size * .95, tw, size * 1.3, size * .5); x.fill(); x.fillStyle = fg; x.fillText(t, cx, y, 300); };
    if (so) {
      const top = people.slice(0, 3), rest = people.slice(3).sort((a, b) => b.k - a.k);
      // rangée du fond : les autres, les plus gonflés au fond
      // places libres entre les marches du podium, puis sur les côtés ; au-delà, rangée régulière
      const back = rest, nb = back.length, SLOTS = [390, 690, 90, 990, 240, 840];
      for (let j = 0; j < nb; j++) {
        const p = back[j], cx = nb <= SLOTS.length ? SLOTS[j] : W * (j + .5) / nb, h = 290 * p.k * (nb > 6 ? .8 : 1);
        await draw(p, cx, 545, h); label(p.name, cx, 578, 26, "#000000aa", "#fff");
      }
      // podium
      const spots = [[W / 2, 300, 150, "#ffcc33", "flex"], [W / 2 - 300, 260, 110, "#d9dde6", "most"], [W / 2 + 300, 240, 80, "#d98b4a", "kiss"]];
      const baseY = 770;
      for (let n = 0; n < top.length; n++) {
        const [cx, hh, bh, col, pose] = spots[n], p = top[n], bw = 260;
        x.fillStyle = col; x.strokeStyle = "#1d1420"; x.lineWidth = 6; rr(x, cx - bw / 2, baseY - bh, bw, bh, 10); x.fill(); x.stroke();
        x.fillStyle = "#1d1420"; x.font = `400 ${Math.round(bh * .55)}px ${FD}`; x.fillText(String(n + 1), cx, baseY - bh * (n ? .28 : .45));
        await draw(p, cx, baseY - bh + 6, hh * 1.25 * p.k, pose);
        label(`${p.name} · ${p.pts} pt${p.pts > 1 ? "s" : ""}`, cx, baseY - bh - hh * 1.25 * p.k * .93 - 6, 32, n ? "#1d1420dd" : "#e63946", "#fff");
        if (n === 0) { x.font = `48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textBaseline = "middle"; x.fillText("🏆", cx - 92, baseY - bh / 2); x.fillText("🏆", cx + 92, baseY - bh / 2); x.textBaseline = "alphabetic"; }
      }
      // panneau du bas : classement + trophées
      const py = 800;
      x.fillStyle = "#14101add"; rr(x, 36, py, W - 72, H - py - 30, 28); x.fill(); x.strokeStyle = "#ffcc33"; x.lineWidth = 4; x.stroke();
      x.textAlign = "left"; x.fillStyle = "#ffcc33"; x.font = `400 40px ${FD}`; x.fillText("CLASSEMENT FINAL", 70, py + 56);
      const S = standings(so).filter(r => r.pl + r.by > 0).slice(0, 10);
      S.forEach((r, n) => { const y = py + 102 + n * 41; x.font = `800 32px ${FU}`; x.fillStyle = n < 3 ? ["#ffcc33", "#e6e9f0", "#e8a06a"][n] : "#f5efe6"; x.fillText(`${r.rank}. ${r.name}`, 70, y, 300); x.textAlign = "right"; x.fillText(`${r.pts} pt${r.pts > 1 ? "s" : ""}`, 500, y); x.textAlign = "left"; });
      x.fillStyle = "#ffcc33"; x.font = `400 40px ${FD}`; x.fillText("TROPHÉES", 560, py + 56);
      AW.slice(0, 7).forEach((a, n) => { const y = py + 100 + n * 58; x.font = `34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.fillText(a.e, 560, y + 4); x.font = `800 30px ${FU}`; x.fillStyle = "#fff"; x.fillText(a.t, 610, y - 6, 400); x.font = `600 24px ${FU}`; x.fillStyle = "#b9aec6"; x.fillText(`${a.name} · ${a.d}`, 610, y + 22, 400); x.fillStyle = "#ffcc33"; });
      x.textAlign = "center"; x.font = `700 26px ${FU}`; x.fillStyle = "#b9aec6"; x.fillText(`${so.pl.length} jeux · ${people.length} athlètes · 🎤 ${nameOf(so, so.mj)}`, W / 2, H - 50);
    } else {
      // photo de groupe : les plus gonflés au fond, les autres devant
      const ps = people.slice().sort((a, b) => b.k - a.k), n = ps.length;
      const nBack = n > 3 ? Math.ceil(n / 2) : 0, back = ps.slice(0, nBack), front = ps.slice(nBack);
      const big = n <= 2 ? 1.5 : n <= 4 ? 1.25 : 1;
      for (let j = 0; j < back.length; j++) { const p = back[j], cx = W * (j + 1) / (back.length + 1); await draw(p, cx, 760, 380 * p.k * big * (back.length > 4 ? .85 : 1), ["flex", "most", "back", "kiss", "leg"][j % 5]); }
      for (let j = 0; j < front.length; j++) { const p = front[j], cx = W * (j + .5) / front.length; await draw(p, cx, 1080, 420 * p.k * big * (front.length > 4 ? .8 : 1), ["flex", "kiss", "most", "leg", "flex"][j % 5]); }
      x.fillStyle = "#14101add"; rr(x, 36, 1120, W - 72, 200, 28); x.fill(); x.strokeStyle = "#ffcc33"; x.lineWidth = 4; x.stroke();
      x.fillStyle = "#ffcc33"; x.font = `400 40px ${FD}`; x.fillText(`${n} ATHLÈTE${n > 1 ? "S" : ""} GONFLÉ${n > 1 ? "S" : ""}`, W / 2, 1176);
      const names = ps.map(p => p.name).join(" · ");
      fitText(x, names, W - 120, 40, "800", FU); x.fillStyle = "#fff"; x.fillText(names, W / 2, 1240);
      x.font = `700 26px ${FU}`; x.fillStyle = "#b9aec6"; x.fillText("No pain no gain 💪", W / 2, 1290);
    }
    return new Promise(res => cv.toBlob(b => res(b), "image/png"));
  }
  async function photoFlow(kind) {
    openModal(`<h3>📸 Photo ${kind === "soiree" ? "souvenir" : "de groupe"}</h3><p class="so-dim">Tout le monde prend la pose… 💪</p>`);
    let blob = null;
    try { blob = await makePhoto(kind); } catch (e) { console.warn("photo", e); }
    if (!blob) { openModal(`<h3>📸 Oups</h3><p class="so-dim">Impossible de créer la photo sur ce téléphone.</p><div class="so-row so-center"><button class="btn alt" type="button" data-so="mclose">Fermer</button></div>`); return; }
    photoBlob = blob;
    const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    photoName = `gonflette-${kind === "soiree" ? "soiree" : "groupe"}-${stamp}.png`;
    const url = URL.createObjectURL(blob);
    openModal(`<h3>📸 ${kind === "soiree" ? "Photo souvenir" : "Photo de groupe"}</h3><img class="so-photo" src="${url}" alt="Photo de groupe Gonflette Party"><div class="so-row so-center"><button class="btn red" type="button" data-so="share">📤 Partager</button><button class="btn" type="button" data-so="save">💾 Enregistrer</button><button class="btn alt" type="button" data-so="mclose">Fermer</button></div><small class="so-dim">Astuce : sur téléphone, un appui long sur l'image permet aussi de l'enregistrer.</small>`);
    modal.dataset.url = url;
  }
  async function shareBlob() {
    if (!photoBlob) return;
    try {
      const file = new File([photoBlob], photoName, {type: "image/png"});
      if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: "Gonflette Party", text: "Notre soirée Gonflette Party 💪🎉"}); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    toast("Partage indisponible ici : l'image est enregistrée à la place");
    saveBlob();
  }
  function saveBlob() {
    if (!photoBlob) return;
    try { const a = document.createElement("a"), u = URL.createObjectURL(photoBlob); a.href = u; a.download = photoName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    catch (e) { toast("Enregistrement impossible : faites un appui long sur l'image"); }
  }

  /* ---------- à chaque changement d'état ---------- */
  function update() {
    if (!C) return;
    const so = curSo(), me = myPid();
    if (so) so.ids.forEach(lookOf); // garde les looks pour la cérémonie (même si quelqu'un part)
    // demande de micro traitée (ou périmée)
    if (mine.mj && ((so && so.ph !== "f") || Date.now() - mine.mjAt > CLAIM_MS)) {
      if (so && so.ph === "m" && so.mj !== me) toast(`🎤 ${nameOf(so, so.mj)} a pris le micro avant vous`);
      mine.mj = null; C.pushPresence();
    }
    if (so) {
      if (lastSoId === so.i && so.lm && (!lastLm || lastLm[0] !== so.lm[0])) toast(so.lm[1]);
      if (lastSoId === so.i && lastMjSeen && lastMjSeen !== so.mj && so.mj === me) toast("🎤 Vous êtes maintenant le maître du jeu !");
      lastLm = so.lm || null; lastMjSeen = so.mj;
      if (so.ph === "f") {
        snapSo = JSON.parse(JSON.stringify(so));
        if (!myBonus || myBonus.so !== so.i) { const b = applyBonus(so); myBonus = {so: so.i, b}; }
      }
      // ouverture automatique de l'écran de soirée à chaque nouvelle phase
      const ak = so.i + so.ph + so.k;
      if (ak !== lastAutoKey) {
        const was = lastAutoKey; lastAutoKey = ak;
        if (so.ph === "m" && so.mj === me) { if (draftFresh) draft = []; draftFresh = false; openPanel(); }
        else if (so.ph === "i" || so.ph === "f") {
          if (so.ph === "f") {
            cerT0 = was && was.startsWith(so.i) ? Date.now() : Date.now() - 20000;
            // la cérémonie passe avant la boutique / le shaker mystère (qui reste à ouvrir via 🎁)
            const x = document.querySelector("#sheet [data-close]"); if (x) x.click();
          }
          openPanel();
        }
        else if (so.ph === "r") { const st = C.hostSt(); const M = C.matchOf(st, C.me()); if (!M) openPanel(); }
      }
      lastSoId = so.i;
    } else if (lastSoId && !(panelOpen && panelMode === "f")) { lastSoId = null; lastAutoKey = null; }
    render();
  }
  function tickUi() {
    const so = curSo();
    if (!panelOpen || !so || so.ph !== "i") return;
    const el = panel.querySelector("[data-so-cd]"); if (!el) return;
    if (so.pz) { el.textContent = "⏸ En pause : le maître du jeu reprend quand il veut"; return; }
    const dur = so.k === 0 && !so.sk ? FIRST_MS : INTER_MS;
    const left = Math.max(0, Math.ceil((so.at + dur - C.hostNow()) / 1000));
    el.innerHTML = left > 0 ? `Départ dans <b>${left}</b> s` : `C'est parti !`;
  }
  // Pendant une soirée, les participants ne votent pas : c'est le MJ qui choisit.
  function action(msgEl, btnsEl) {
    const so = curSo();
    if (!so || (so.ph !== "i" && so.ph !== "r") || mine.sw) return false;
    const g = gameOf(so.pl[so.k]);
    msgEl.innerHTML = `🎉 <b>Soirée en cours</b> : c'est le maître du jeu 🎤 qui choisit les jeux. ${so.ph === "r" ? `En cours : <b>${esc(g ? g.name : "?")}</b>.` : `Prochain : <b>${esc(g ? g.name : "?")}</b>.`}`;
    if (btnsEl.dataset.state !== "soiree") { btnsEl.dataset.state = "soiree"; btnsEl.innerHTML = `<button class="btn" type="button" data-so="open">📊 Classement</button><button class="btn alt" type="button" data-so="watch">Je regarde seulement 👀</button>`; }
    return true;
  }
  function badge(p, plain) {
    const so = curSo(), pid = pidOf(p);
    let s = "";
    if (so && so.mj === pid) s += plain ? " 🎤" : ` <span class="so-mjb" title="Maître du jeu">🎤</span>`;
    if (p.presence && p.presence.cs) s += plain ? " 👑" : ` <span class="so-champ" title="Champion de la soirée">👑 Champion de la soirée</span>`;
    return s;
  }
  function resultsHtml(M) {
    const so = curSo(); if (!M || !M.so || !so || !so.r) return "";
    const k = M.so - 1, items = M.pl.map(key => { const pid = pidOfKey(M, key), i = so.ids.indexOf(pid), c = i >= 0 ? (so.r[i] || "")[k] : null; return c && c !== "-" ? `${esc(M.ro[key] ? M.ro[key].p : "?")} <b>+${PTS[c] || 0}</b>` : ""; }).filter(Boolean);
    if (!items.length) return "";
    const S = standings(so), mr = S.find(r => r.pid === myPid());
    return `<p class="so-res">🎉 Soirée · jeu ${M.so}/${so.pl.length} : ${items.join(" · ")}${mr && M.pl.includes(C.me()) ? `<br><small>Vous : ${mr.pts} pt${mr.pts > 1 ? "s" : ""}, ${mr.rank}ᵉ${mr.rank === 1 ? "r" : ""} du classement</small>`.replace("1ᵉr", "1ᵉʳ") : ""}</p>`;
  }
  function chosenTag(M) { const so = curSo(); return M && M.so && so && so.pl ? `<span class="so-ctag">🎉 Soirée · jeu ${M.so}/${so.pl.length}</span><br>` : ""; }

  const CSS = `
.so-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 10px;margin:0 0 10px;background:var(--panel);border:2px dashed var(--line);border-radius:14px;padding:6px 10px}
.so-bar.on{border-style:solid;border-color:var(--gold);background:linear-gradient(90deg,#ff2e8826,#ffcc3318),var(--panel)}
.so-bar .so-lbl{font-weight:700;min-width:0;flex:1 1 220px}.so-bar .so-lbl b{color:var(--gold)}.so-bar .so-lbl small{color:var(--dim);font-weight:700}
.so-bar .so-btns{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.so-bar .btn{padding:6px 12px;font-size:.92rem}
.so-panel{position:fixed;inset:0;z-index:190;overflow:auto;overscroll-behavior:contain;background:radial-gradient(120% 70% at 50% 0%,#4a1d4acc,#0d0912f2 60%);padding:12px 12px 90px;-webkit-overflow-scrolling:touch}
.so-card{position:relative;max-width:760px;margin:0 auto;background:var(--panel);border:4px solid var(--ink);box-shadow:0 0 0 3px var(--gold);border-radius:22px;padding:16px 14px 18px;animation:pop .35s cubic-bezier(.2,1.5,.4,1)}
.so-card h2{margin:2px 44px 4px 0;font-family:var(--f-display);font-weight:400;text-transform:uppercase;line-height:1;font-size:clamp(1.6rem,6.5vw,2.6rem);color:var(--gold);text-shadow:3px 3px 0 var(--accent)}
.so-card h2.so-big{font-size:clamp(1.9rem,8vw,3.2rem)}
.so-card h3{margin:14px 0 6px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.85rem;color:var(--dim)}
.so-x{position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:50%;border:3px solid var(--ink);background:var(--gold);color:var(--ink);font-weight:900;font-size:1.1rem;cursor:pointer;z-index:2}
.so-kicker{font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:.82rem;color:var(--accent);margin-right:44px}
.so-sub{margin:4px 0 8px;color:var(--dim);font-weight:600}.so-sub b{color:var(--text)}
.so-dim{color:var(--dim);font-weight:600}
.so-note{margin:6px 0;background:#ffffff10;border-left:4px solid var(--gold);border-radius:8px;padding:6px 10px;font-weight:700}
.so-warn{color:#ff8fa3;font-weight:800}
.so-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}.so-center{justify-content:center}
.so-presets{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.so-plbox{background:#00000033;border:2px solid var(--line);border-radius:14px;padding:8px 10px;margin:6px 0 4px}
.so-plhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.so-plhead span{color:var(--gold);font-weight:800;flex:1}
.so-link{background:none;border:0;color:var(--dim);text-decoration:underline;cursor:pointer;font-weight:700}
.so-empty{margin:6px 0;color:var(--dim);font-weight:600}
.so-pl{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:5px}
.so-pl li{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;background:#ffffff0d;border-radius:10px;padding:4px 6px}
.so-pl li.bad{outline:2px solid #ff6b6b}
.so-num{font-family:var(--f-display);font-size:1.2rem;color:var(--gold);text-align:center}
.so-gn{min-width:0}.so-gn b{display:block;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.so-gn small{color:var(--dim);font-weight:700}
.so-ord{display:flex;gap:4px}
.so-ic{width:34px;height:34px;border-radius:9px;border:2px solid var(--line);background:var(--panel);color:var(--text);font-weight:900;cursor:pointer;padding:0}
.so-ic:disabled{opacity:.3}.so-ic.rm{color:#ff8fa3}
.so-cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.so-gbtn{text-align:left;display:grid;gap:1px;border:2px solid var(--line);border-left:6px solid var(--tc);border-radius:10px;background:#ffffff0a;padding:6px 8px;cursor:pointer;color:var(--text);font:inherit}
.so-gbtn b{font-weight:800;line-height:1.05}.so-gbtn b i{font-style:normal;color:var(--gold)}.so-gbtn small{color:var(--dim);font-weight:700;font-size:.8rem}
.so-gbtn:active{transform:scale(.97)}
.so-gbtn.off{opacity:.45;filter:grayscale(1);cursor:not-allowed}.so-gbtn .so-why{color:#ff8fa3}
.so-foot{position:sticky;bottom:-18px;margin:14px -14px -18px;padding:10px 14px 14px;background:linear-gradient(180deg,transparent,var(--panel) 30%);display:flex;flex-wrap:wrap;gap:8px;justify-content:center;border-radius:0 0 20px 20px}
.so-next{margin:10px 0;background:#00000040;border:3px solid var(--gold);border-radius:16px;padding:10px 12px;text-align:center;display:grid;gap:3px;justify-items:center}
.so-next>small{font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}
.so-next>b{font-family:var(--f-display);font-weight:400;text-transform:uppercase;font-size:clamp(1.6rem,7vw,2.4rem);line-height:1;color:#fff;text-shadow:3px 3px 0 var(--accent)}
.so-mode{font-weight:800;color:var(--gold)}
.so-split{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:4px}
.so-pair{background:#ffffff14;border-radius:999px;padding:2px 10px;font-weight:600}.so-pair i{color:var(--accent);font-weight:900;font-style:normal;margin:0 2px}.so-pair em{font-style:normal;font-weight:800;color:var(--dim);font-size:.85em}
.so-pair.bye{background:#ffffff08;border:1px dashed var(--line)}.so-pair small{color:var(--dim);font-weight:800}
.so-cd{font-weight:800;font-size:1.1rem;min-height:1.3em}.so-cd b{font-family:var(--f-display);font-weight:400;font-size:1.6rem;color:var(--gold)}
.so-prog{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:4px 0 8px}.so-prog span{font-size:.85rem;font-weight:700;background:#ffffff0d;border-radius:8px;padding:1px 7px;color:var(--dim)}.so-prog span.cur{background:var(--gold);color:var(--ink)}
.so-stand{position:relative;margin:10px 0 4px;transition:height .4s}
.so-sr{position:absolute;left:0;right:0;height:46px;display:grid;grid-template-columns:28px 44px minmax(0,1fr) 62px;gap:6px;align-items:center;background:#ffffff0c;border-radius:12px;padding:0 6px 0 4px;transition:top 1.1s cubic-bezier(.5,0,.2,1)}
.so-sr.me{background:#ffcc3326;box-shadow:inset 0 0 0 2px var(--gold)}
.so-rk{font-family:var(--f-display);font-size:1.3rem;text-align:center;color:var(--gold)}
.so-av{width:44px;height:44px;overflow:hidden;display:block}.so-av .av{width:100%;height:100%}
.so-nmw{min-width:0;display:grid;gap:3px}.so-nmw b{font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.so-barw{height:10px;border-radius:6px;background:#ffffff1a;overflow:hidden}.so-barw i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--gold),var(--accent));transition:width 1.4s cubic-bezier(.3,0,.2,1)}
.so-pts{text-align:right;line-height:1;display:grid;justify-items:end}.so-pts b{font-family:var(--f-display);font-weight:400;font-size:1.35rem}.so-pts small{font-size:.7rem;color:var(--dim);font-weight:800}
.so-pts em{font-style:normal;font-weight:900;font-size:.78rem}.so-stand.anim .so-pts em{animation:sopop .5s 1.3s both}.so-pts em.up{color:#3ccf8e}.so-pts em.dn{color:#ff6b6b}.so-pts em.eq{color:var(--dim)}
@keyframes sopop{from{transform:scale(0);opacity:0}}
.so-matches{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}
.so-matches li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;background:#ffffff0d;border-radius:12px;padding:6px 10px}
.so-who{flex:1 1 180px;font-weight:700}.so-who i{color:var(--accent);font-style:normal;font-weight:900}
.so-st{font-weight:800;font-size:.9rem;border-radius:999px;padding:1px 9px;background:#ffffff14}.so-st.live{background:var(--accent);color:#fff;animation:badgebeat 1s ease-in-out infinite alternate}.so-st.done{background:var(--good);color:var(--ink)}
.so-end{font-size:.8rem}
.so-mj{margin-top:12px;border:2px dashed var(--gold);border-radius:14px;padding:8px 10px}.so-mj>b{color:var(--gold)}
.so-mjb{display:inline-block;filter:drop-shadow(0 1px 0 #0008)}
.so-champ{display:inline-block;background:linear-gradient(90deg,#ffb703,#ffe66d);color:#1d1420;border:2px solid #1d1420;border-radius:999px;padding:0 7px;font-size:.72rem;font-weight:900;white-space:nowrap;vertical-align:middle}
.so-res{margin:8px auto;max-width:520px;background:#ffcc331a;border:2px solid var(--gold);border-radius:12px;padding:6px 10px;color:var(--text)!important;font-weight:700;font-size:1rem!important}.so-res b{color:var(--gold)}.so-res small{color:var(--dim)}
.so-ctag{display:inline-block;background:var(--gold);color:var(--ink);border-radius:999px;padding:1px 10px;font-weight:900;font-size:.9rem;margin-bottom:4px}
.so-cer{text-align:center}
.so-olympia{margin:4px 30px 0!important;font-size:clamp(2rem,9vw,3.6rem)!important}.so-olympia small{display:block;font-family:var(--f-script);text-transform:none;font-size:.5em;color:#fff;text-shadow:2px 2px 0 var(--accent);margin-top:4px}
.so-drum{font-weight:800;font-size:1.1rem;margin:8px 0;animation:sodrum .12s linear infinite alternate}.so-drum.gone{visibility:hidden;animation:none}
@keyframes sodrum{from{transform:translateX(-1px) rotate(-1deg)}to{transform:translateX(1px) rotate(1deg)}}
.so-pod{display:flex;justify-content:center;align-items:flex-end;gap:6px;margin:6px 0 0;min-height:200px}
.so-step{flex:0 1 31%;max-width:190px;display:grid;justify-items:center;gap:2px;opacity:0;transform:translateY(30px) scale(.8)}
.so-step.rev{opacity:1;transform:none;transition:opacity .5s,transform .7s cubic-bezier(.2,1.6,.4,1)}.so-step.now{transition:none}
.so-step b{font-family:var(--f-display);font-weight:400;font-size:clamp(1rem,4.6vw,1.5rem);text-transform:uppercase;line-height:1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.so-ptsb{font-weight:800;color:var(--gold);font-size:.95rem}
.so-fig{position:relative;width:100%}.so-fig .av{width:100%;height:auto;display:block}
.so-step.s1 .so-fig{width:118%}.so-step.s1.rev .so-fig .av{animation:flexbeat .9s ease-in-out infinite alternate}
.so-trophy{position:absolute;right:-6%;top:4%;font-size:clamp(1.8rem,8vw,3rem);animation:sldwob 1.4s ease-in-out infinite;z-index:2}
.so-blk{width:100%;border:3px solid var(--ink);border-bottom:0;border-radius:10px 10px 0 0;display:grid;place-items:center;font-family:var(--f-display);font-size:2rem;color:var(--ink)}
.so-step.s1 .so-blk{background:linear-gradient(180deg,#ffe66d,#ffb703)}.so-step.s2 .so-blk{background:linear-gradient(180deg,#f1f3f8,#aeb6c4)}.so-step.s3 .so-blk{background:linear-gradient(180deg,#f0b07a,#b8682f)}
.so-after{opacity:0;transform:translateY(20px)}.so-after.rev{opacity:1;transform:none;transition:opacity .6s,transform .6s}.so-after.now{transition:none}
.so-champ-l{margin:10px 0 4px;font-weight:700}.so-champ-l b{color:var(--gold)}
.so-mybonus{margin:4px auto;max-width:480px;background:var(--good);color:var(--ink);border:3px solid var(--ink);border-radius:12px;padding:6px 10px;font-weight:800}
.so-aw{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;text-align:left}
.so-aw li{display:grid;grid-template-columns:36px minmax(0,1fr) 44px;gap:6px;align-items:center;background:#ffffff0d;border-radius:12px;padding:4px 6px}
.so-awe{font-size:1.6rem;text-align:center}.so-aw b{display:block;line-height:1.05}.so-aw small{color:var(--dim);font-weight:700}
.so-awav{width:44px;height:44px;overflow:hidden}.so-awav .av{width:100%;height:100%}
.so-final{list-style:none;margin:0 auto;padding:0;display:grid;gap:3px;max-width:480px;text-align:left}
.so-final li{display:grid;grid-template-columns:30px minmax(0,1fr) auto auto;gap:8px;align-items:baseline;background:#ffffff0a;border-radius:8px;padding:3px 8px}
.so-final li>span{color:var(--gold);font-weight:800}.so-final b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.so-final small{color:var(--dim);font-weight:700}.so-final em{font-style:normal;font-weight:900}
.so-conf{position:fixed;inset:0;pointer-events:none;z-index:240;overflow:hidden}
.so-conf i{position:absolute;top:-20px;width:10px;height:14px;border-radius:2px;animation:sofall linear forwards}
@keyframes sofall{to{transform:translate(var(--dx),110vh) rotate(var(--r))}}
.so-modal{position:fixed;inset:0;z-index:235;display:grid;place-items:center;padding:12px;background:rgba(10,6,14,.86)}
.so-mcard{width:min(100%,520px);max-height:calc(100vh - 24px);overflow:auto;background:var(--panel);border:4px solid var(--ink);box-shadow:0 0 0 3px var(--gold);border-radius:20px;padding:14px;text-align:center;animation:pop .3s cubic-bezier(.2,1.5,.4,1)}
.so-mcard h3{margin:0 0 8px;font-family:var(--f-display);font-weight:400;text-transform:uppercase;font-size:1.6rem;color:var(--gold)}
.so-photo{display:block;width:100%;max-height:60vh;object-fit:contain;border-radius:12px;border:3px solid var(--ink);background:#000}
body.so-open{overflow:hidden}
@media (max-width:520px){.so-cat{grid-template-columns:repeat(2,minmax(0,1fr))}.so-sr{grid-template-columns:24px 40px minmax(0,1fr) 54px}.so-av{width:40px;height:40px}.so-bar .so-lbl{flex-basis:100%}}
`;

  G.soiree = {
    init(ctx) {
      C = ctx; A = G.avatar;
      try { setup(); } catch (e) { console.warn("soirée", e); }
      const api = {presence, hostTick, update, action, badge, resultsHtml, chosenTag};
      G.soiree.api = api;
      G.soiree.debug = {
        so: () => curSo(),
        size: () => JSON.stringify(curSo() || {}).length,
        standings: () => { const so = curSo() || snapSo; return so ? standings(so) : []; },
        awards: () => { const so = curSo() || snapSo; return so ? awards(so) : []; },
        draft: () => draft.slice(),
        setDraft: l => { draft = l.slice(); render(); return draft; },
        photo: async kind => { const b = await makePhoto(kind || "groupe"); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); },
        mine: () => Object.assign({}, mine),
        panel: () => ({open: panelOpen, mode: panelMode})
      };
      return api;
    }
  };
})();
