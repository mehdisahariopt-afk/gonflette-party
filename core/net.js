/* Gonflette Party : couche réseau.
   Dans le visualiseur claude.ai : capacité `room` (présence en direct entre téléphones).
   Ailleurs (fichier local, tests) : simulation par BroadcastChannel entre onglets du même navigateur. */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  /* ---------- Identité stable du téléphone ----------
     Chaque onglet a une clé (« peer » dans la présence) gardée dans sessionStorage : elle survit à un rechargement,
     à une coupure réseau ou à un onglet tué puis restauré par le navigateur (écran éteint). Le joueur revient donc
     avec la MÊME clé et retrouve sa partie (M.pl, entrées des jeux…). Un onglet dupliqué copie sessionStorage :
     on demande d'abord aux autres onglets de ce navigateur si la clé est prise ; si oui, on en tire une nouvelle. */
  const KEY_SS = "gonflette-key";
  const newKey = () => "k" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  let keyNow = null, keyBc = null;
  function storeKey(k) { keyNow = k; try { sessionStorage.setItem(KEY_SS, k); } catch (e) {} return k; }
  function claimKey() {
    if (keyNow) return Promise.resolve(keyNow);
    let k = null;
    try { k = sessionStorage.getItem(KEY_SS); } catch (e) {}
    const valid = typeof k === "string" && /^k[a-z0-9]{6,16}$/.test(k);
    try { keyBc = new BroadcastChannel("gonflette-keys"); } catch (e) { keyBc = null; }
    const answer = () => { if (keyBc) keyBc.onmessage = e => { const m = e.data; if (m && m.t === "q" && m.k === keyNow) keyBc.postMessage({t: "a", k: keyNow}); }; };
    if (!valid || !keyBc) { storeKey(valid ? k : newKey()); answer(); return Promise.resolve(keyNow); }
    return new Promise(res => {
      let taken = false;
      keyBc.onmessage = e => { const m = e.data; if (m && m.t === "a" && m.k === k) taken = true; };
      keyBc.postMessage({t: "q", k});
      setTimeout(() => { storeKey(taken ? newKey() : k); answer(); res(keyNow); }, 250);
    });
  }

  function mockRoom(myPeer) {
    const inst = Math.random().toString(36).slice(2, 10); // instance de page : distingue un rechargement de l'ancienne page
    const sender = isMe => ({peer: myPeer, by: null, isMe, sameTab: isMe, kind: "viewer", guest: false});
    function makeRoom(name) {
      const bc = new BroadcastChannel("gonflette:" + name);
      let mine = {}, myUpdated = Date.now(), snapshot = Object.freeze([]);
      const others = new Map(), peerLs = new Set(), topicLs = new Map();
      let closed = false;
      function rebuild() {
        const arr = [Object.freeze(Object.assign(sender(true), {presence: Object.freeze(Object.assign({}, mine)), updatedAt: myUpdated}))];
        for (const [p, o] of others) arr.push(Object.freeze({peer: p, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.updatedAt}));
        snapshot = Object.freeze(arr);
        peerLs.forEach(fn => { try { fn({peers: snapshot, joined: [], left: [], updated: []}); } catch (e) { console.error(e); } });
      }
      function send() { if (!closed) bc.postMessage({t: "p", peer: myPeer, n: inst, presence: mine}); }
      bc.onmessage = e => {
        const m = e.data;
        if (m.peer === myPeer) return;
        if (m.t === "p") {
          const prev = others.get(m.peer), json = JSON.stringify(m.presence), fresh = !prev || prev.n !== m.n;
          if (!fresh && prev.json === json) { prev.seen = Date.now(); return; }
          others.set(m.peer, {presence: Object.freeze(m.presence), json, n: m.n, updatedAt: Date.now(), seen: Date.now()});
          rebuild();
          if (fresh) send();
        } else if (m.t === "bye") { const o = others.get(m.peer); if (o && (!m.n || o.n === m.n) && others.delete(m.peer)) rebuild(); }
        else if (m.t === "e") (topicLs.get(m.topic) || []).forEach(fn => fn(Object.assign({topic: m.topic, data: m.data}, sender(false), {peer: m.peer})));
      };
      const hb = setInterval(() => {
        send();
        const now = Date.now(); let ch = false;
        for (const [p, o] of others) if (now - o.seen > 4500) { others.delete(p); ch = true; }
        if (ch) rebuild();
      }, 1000);
      addEventListener("pagehide", () => { if (!closed) bc.postMessage({t: "bye", peer: myPeer, n: inst}); });
      let pending = false;
      send();
      return {
        name,
        presence(patch) {
          for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = JSON.parse(JSON.stringify(patch[k])); }
          myUpdated = Date.now();
          if (!pending && !closed) { pending = true; setTimeout(() => { pending = false; if (!closed) { send(); rebuild(); } }, 33); }
          return Promise.resolve();
        },
        peers: () => snapshot,
        onPeers(fn) { peerLs.add(fn); setTimeout(() => fn({peers: snapshot, joined: snapshot, left: [], updated: []}), 0); return () => peerLs.delete(fn); },
        emit(topic, data) {
          if (!closed) bc.postMessage({t: "e", topic, data, peer: myPeer});
          (topicLs.get(topic) || []).forEach(fn => fn(Object.assign({topic, data}, sender(true))));
          return Promise.resolve();
        },
        on(topic, fn) {
          if (!topicLs.has(topic)) topicLs.set(topic, []);
          topicLs.get(topic).push(fn);
          return () => { const a = topicLs.get(topic); a.splice(a.indexOf(fn), 1); };
        },
        connected: () => true,
        onConnection(fn) { setTimeout(() => fn(true), 0); return () => {}; },
        leave() { if (closed) return Promise.resolve(); closed = true; clearInterval(hb); bc.postMessage({t: "bye", peer: myPeer, n: inst}); bc.close(); peerLs.clear(); return Promise.resolve(); }
      };
    }
    const lobby = makeRoom("lobby");
    const rooms = {};
    return {
      mock: true,
      lobby,
      myPeer: () => myPeer,
      async join(name) { if (!rooms[name]) rooms[name] = makeRoom(name); return rooms[name]; },
      async leave(name) { if (rooms[name]) { await rooms[name].leave(); delete rooms[name]; } }
    };
  }

  /* Salle claude.ai : son identifiant de pair peut changer quand on recharge la page. On publie donc notre clé
     stable dans la présence (_k) et on la présente comme « peer » au lobby et aux jeux. Si une ancienne connexion
     traîne encore avec la même clé, on garde la nôtre (sameTab), sinon la plus récente. */
  function keyed(room, key) {
    let raw = null, out = Object.freeze([]);
    const map = list => {
      if (list === raw) return out;
      const best = new Map();
      for (const p of list || []) {
        const k = p.sameTab ? key : (p.presence && typeof p.presence._k === "string" && p.presence._k) || p.peer;
        const o = best.get(k);
        if (o && (o.sameTab || (!p.sameTab && (o.updatedAt || 0) >= (p.updatedAt || 0)))) continue;
        best.set(k, p);
      }
      raw = list;
      out = Object.freeze([...best].map(([k, p]) => Object.freeze(Object.assign({}, p, {peer: k}))));
      return out;
    };
    const over = {
      presence: patch => room.presence(Object.assign({}, patch, {_k: key})),
      peers: () => map(room.peers()),
      onPeers: (fn, err) => room.onPeers(ch => fn(Object.assign({}, ch, {peers: map(ch.peers)})), err)
    };
    return new Proxy(room, {get(t, p) { if (Object.prototype.hasOwnProperty.call(over, p)) return over[p]; const v = t[p]; return typeof v === "function" ? v.bind(t) : v; }});
  }
  function realRoom(room, key) {
    const rooms = {}, lobby = keyed(room, key);
    return {
      mock: false,
      lobby,
      myPeer: () => key,
      async join(name) { if (!rooms[name]) rooms[name] = keyed(await room.join(name), key); return rooms[name]; },
      async leave(name) { if (rooms[name]) { try { await rooms[name].leave(); } catch (e) {} delete rooms[name]; } }
    };
  }

  /* ---------- Connexion directe entre téléphones (PeerJS / WebRTC), sans compte ----------
     Le premier téléphone qui ouvre la salle prend l'identifiant "gonflette-v1-<code>" et sert de relais :
     il reçoit la présence de chacun et la renvoie aux autres. Si le relais part, un autre téléphone le remplace.
     Les joueurs sont désignés par leur clé stable (et non par leur identifiant PeerJS, qui change à chaque
     reconnexion et quand on devient relais) : le relais l'apprend dans les métadonnées de la connexion.
     Battements toutes les 2 s dans les deux sens : un relais muet (téléphone endormi) est remplacé, un téléphone
     muet est retiré (il revient tout seul avec la même clé). Un relais dont l'onglet passe en arrière-plan
     cède sa place après 1,5 s (un onglet caché est ralenti, voire gelé). */
  function p2pRoom(code, server, key) {
    const hubId = "gonflette-v1-" + code.toLowerCase().replace(/[^a-z0-9]/g, "");
    const opts = Object.assign({debug: 0}, server || {});
    let myKey = key, peer = null, isHub = false, hubConn = null, link = false, dead = false, retrying = false;
    const clients = new Map();                 // relais : clé -> connexion
    const seenAt = new Map();                  // relais : clé -> dernier message reçu
    let lastHubMsg = Date.now();
    const rooms = {};
    const connLs = new Set();
    const setLink = v => { if (link !== v) { link = v; connLs.forEach(fn => { try { fn(v); } catch (e) {} }); } };
    const hidden = () => typeof document !== "undefined" && document.hidden;

    function R(name, joined = true) {
      if (rooms[name]) return rooms[name];
      const r = {name, mine: {}, all: new Map(), ls: new Set(), snap: Object.freeze([]), members: new Set(), joined, timer: null};
      r.rebuild = () => {
        const arr = [];
        if (r.joined) arr.push(Object.freeze({peer: myKey, by: null, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: Object.freeze(Object.assign({}, r.mine)), updatedAt: Date.now()}));
        for (const [id, o] of r.all) if (id !== myKey) arr.push(Object.freeze({peer: id, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.at}));
        r.snap = Object.freeze(arr);
        r.ls.forEach(fn => { try { fn({peers: r.snap, joined: [], left: [], updated: []}); } catch (e) { console.error(e); } });
      };
      r.flush = () => {
        r.timer = null;
        if (!r.joined) return;
        if (isHub) relay(name, {t: "u", r: name, id: myKey, p: r.mine});
        else if (hubConn && hubConn.open) hubConn.send({t: "p", r: name, p: r.mine});
      };
      r.api = {
        name,
        presence(patch) {
          for (const k in patch) { if (patch[k] === null) delete r.mine[k]; else r.mine[k] = JSON.parse(JSON.stringify(patch[k])); }
          r.rebuild();
          if (!r.timer) r.timer = setTimeout(r.flush, 33);
          return Promise.resolve();
        },
        peers: () => r.snap,
        onPeers(fn) { r.ls.add(fn); setTimeout(() => fn({peers: r.snap, joined: r.snap, left: [], updated: []}), 0); return () => r.ls.delete(fn); },
        emit() { return Promise.resolve(); },
        on() { return () => {}; },
        connected: () => link,
        onConnection(fn) { connLs.add(fn); setTimeout(() => fn(link), 0); return () => connLs.delete(fn); },
        leave() {
          r.joined = false; r.ls.clear(); clearTimeout(r.timer); r.mine = {};
          if (isHub) relay(name, {t: "x", r: name, id: myKey}); // le relais garde la salle pour les autres
          else { if (hubConn && hubConn.open) hubConn.send({t: "l", r: name}); delete rooms[name]; }
          return Promise.resolve();
        }
      };
      rooms[name] = r;
      return r;
    }
    function relay(name, msg, except) {
      const r = rooms[name];
      if (!r) return;
      for (const id of r.members) if (id !== except) { const c = clients.get(id); if (c && c.open) try { c.send(msg); } catch (e) {} }
    }
    function hubReceive(id, conn, m) {
      // battement d'un client : s'il se croit dans une salle où le relais ne le compte pas (message perdu), il renvoie sa présence
      if (m && m.t === "k" && Array.isArray(m.j)) { if (m.j.some(n => typeof n === "string" && !(rooms[n] && rooms[n].members.has(id)))) conn.send({t: "rq"}); return; }
      if (!m || typeof m.r !== "string") return;
      const r = R(m.r, false);
      if (m.t === "p") {
        if (!r.members.has(id)) {
          r.members.add(id);
          const list = [];
          if (r.joined) list.push([myKey, r.mine]);
          for (const [k, o] of r.all) if (k !== myKey && k !== id) list.push([k, o.presence]);
          conn.send({t: "s", r: m.r, peers: list});
        }
        r.all.set(id, {presence: Object.freeze(m.p || {}), at: Date.now()});
        r.rebuild();
        relay(m.r, {t: "u", r: m.r, id, p: m.p}, id);
      } else if (m.t === "l") {
        r.members.delete(id); r.all.delete(id); r.rebuild();
        relay(m.r, {t: "x", r: m.r, id});
      }
    }
    function dropClient(id) {
      clients.delete(id); seenAt.delete(id);
      for (const name in rooms) {
        const r = rooms[name];
        if (r.members.delete(id) | r.all.delete(id)) { r.rebuild(); relay(name, {t: "x", r: name, id}); }
      }
    }
    function clientReceive(m) {
      if (!m || !rooms[m.r]) return;
      const r = rooms[m.r];
      if (m.t === "s") { r.all.clear(); for (const [id, p] of m.peers || []) if (id !== myKey) r.all.set(id, {presence: Object.freeze(p || {}), at: Date.now()}); r.rebuild(); }
      else if (m.t === "u") { if (m.id !== myKey) { r.all.set(m.id, {presence: Object.freeze(m.p || {}), at: Date.now()}); r.rebuild(); } }
      else if (m.t === "x") { if (r.all.delete(m.id)) r.rebuild(); }
    }

    return new Promise(resolve => {
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      const failT = setTimeout(() => done(null), 20000);
      const ok = () => { clearTimeout(failT); done(true); };

      function becomeHub(onFail) {
        const p = new Peer(hubId, opts);
        let opened = false;
        peer = p;
        p.on("open", () => {
          if (peer !== p) return;
          opened = true; isHub = true; hubConn = null; setLink(true);
          // On garde la présence connue des autres (pas de trou dans la liste pendant le changement de relais) ;
          // ceux qui ne se sont pas reconnectés à nous d'ici 10 s sont retirés.
          for (const name in rooms) { const r = rooms[name]; r.members.clear(); r.rebuild(); }
          setTimeout(() => {
            if (peer !== p || !isHub) return;
            for (const name in rooms) {
              const r = rooms[name]; let ch = false;
              for (const id of [...r.all.keys()]) if (!r.members.has(id)) { r.all.delete(id); ch = true; relay(name, {t: "x", r: name, id}); }
              if (ch) r.rebuild();
            }
          }, 10000);
          ok();
        });
        p.on("connection", conn => {
          const md = conn.metadata, id = md && typeof md.k === "string" && /^[\w-]{1,40}$/.test(md.k) ? md.k : conn.peer;
          conn.on("open", () => {
            if (peer !== p) return;
            if (id === myKey) { try { conn.send({t: "dup"}); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 300); return; }
            const old = clients.get(id);
            if (old && old !== conn) {
              // Même clé qui revient (rechargement, reconnexion) : la nouvelle connexion remplace l'ancienne, sans
              // faire disparaître le joueur ; elle recevra l'état complet des salles à son premier message.
              for (const name in rooms) rooms[name].members.delete(id);
              try { old.send({t: "dup"}); } catch (e) {}
              setTimeout(() => { try { old.close(); } catch (e) {} }, 300);
            }
            clients.set(id, conn); seenAt.set(id, Date.now());
          });
          conn.on("data", m => { if (clients.get(id) !== conn) return; seenAt.set(id, Date.now()); hubReceive(id, conn, m); });
          conn.on("close", () => { if (clients.get(id) === conn) dropClient(id); });
          conn.on("error", () => { if (clients.get(id) === conn) dropClient(id); });
        });
        p.on("disconnected", () => { if (!dead && peer === p && !p.destroyed) setTimeout(() => { if (peer === p && !p.destroyed && p.disconnected) try { p.reconnect(); } catch (e) {} }, 1000); });
        p.on("error", e => {
          if (peer !== p) return;
          if (e.type === "unavailable-id") {
            // l'identifiant de relais est pris (ou repris par un autre pendant notre absence) : on devient client
            peer = null; isHub = false;
            for (const c of clients.values()) try { c.close(); } catch (er) {}
            clients.clear(); seenAt.clear();
            try { p.destroy(); } catch (er) {}
            onFail();
          } else if (!opened) lost();
          else console.warn("p2p", e.type);
        });
      }
      function becomeClient() {
        const p = new Peer(opts);
        peer = p; isHub = false;
        const wd = setTimeout(() => { if (peer === p && !(hubConn && hubConn.open)) lost(); }, 12000);
        p.on("open", () => {
          if (peer !== p) return;
          const c = p.connect(hubId, {reliable: true, serialization: "json", metadata: {k: myKey}});
          hubConn = c;
          c.on("open", () => {
            if (hubConn !== c) return;
            clearTimeout(wd); lastHubMsg = Date.now();
            setLink(true);
            // pas de remise à zéro : le relais renvoie l'état complet de chaque salle (message "s")
            for (const name in rooms) { const r = rooms[name]; if (r.joined) c.send({t: "p", r: name, p: r.mine}); }
            ok();
          });
          c.on("data", m => {
            if (hubConn !== c) return;
            lastHubMsg = Date.now();
            if (m && m.t === "dup") { myKey = storeKey(newKey()); lost(); return; } // onglet dupliqué : nouvelle clé
            if (m && m.t === "rq") { for (const name in rooms) { const r = rooms[name]; if (r.joined) c.send({t: "p", r: name, p: r.mine}); } return; }
            clientReceive(m);
          });
          c.on("close", () => { if (hubConn === c) lost(); });
          c.on("error", () => { if (hubConn === c) lost(); });
        });
        p.on("disconnected", () => { if (!dead && peer === p && !p.destroyed && !(hubConn && hubConn.open)) try { p.reconnect(); } catch (e) {} });
        p.on("error", e => { if (peer !== p) return; if (e.type === "peer-unavailable" || !(hubConn && hubConn.open)) lost(); else console.warn("p2p", e.type); });
      }
      function lost() {
        if (dead || retrying) return;
        retrying = true; setLink(false);
        const old = peer; peer = null; hubConn = null; isHub = false;
        clients.clear(); seenAt.clear();
        try { old && old.destroy(); } catch (e) {}
        // Le relais est parti : chacun tente de le remplacer après un délai aléatoire, les autres le rejoignent.
        // Un onglet caché ne se propose pas comme relais.
        setTimeout(() => { retrying = false; if (dead) return; if (hidden()) becomeClient(); else becomeHub(becomeClient); }, 400 + Math.random() * 1500);
      }
      function resign() {
        if (dead || retrying || !isHub) return;
        retrying = true; setLink(false);
        const old = peer; peer = null; isHub = false;
        clients.clear(); seenAt.clear();
        for (const name in rooms) rooms[name].members.clear();
        try { old && old.destroy(); } catch (e) {}
        setTimeout(() => { retrying = false; if (!dead) becomeClient(); }, 2500);
      }
      let lastBeat = Date.now(), hideT = null;
      setInterval(() => {
        if (dead) return;
        const now = Date.now(), gap = now - lastBeat;
        lastBeat = now;
        // ce téléphone vient de se réveiller : on laisse aux autres le temps de se manifester avant de juger
        if (gap > 6000) { lastHubMsg = now; for (const k of seenAt.keys()) seenAt.set(k, now); return; }
        if (isHub && peer && !peer.destroyed) {
          if (peer.disconnected) try { peer.reconnect(); } catch (e) {}
          for (const [id, c] of [...clients]) {
            if (now - (seenAt.get(id) || now) > 15000) { try { c.close(); } catch (e) {} dropClient(id); }
            else if (c.open) try { c.send({t: "k"}); } catch (e) {}
          }
        } else if (hubConn && hubConn.open) {
          try { hubConn.send({t: "k", j: Object.keys(rooms).filter(n => rooms[n].joined)}); } catch (e) {}
          if (now - lastHubMsg > 10000 && !hidden()) lost();
        }
      }, 2000);
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
        clearTimeout(hideT);
        if (hidden() && isHub && clients.size) hideT = setTimeout(() => { if (hidden() && isHub && clients.size) resign(); }, 1500);
      });
      becomeHub(becomeClient);
      addEventListener("pagehide", () => { dead = true; try { peer && peer.destroy(); } catch (e) {} });
      // page restaurée depuis le cache arrière (iOS) : la connexion a été coupée, on recharge pour revenir proprement
      addEventListener("pageshow", e => { if (e.persisted && dead) location.reload(); });
    }).then(okay => okay ? {
      mock: false, p2p: true, code, reason: "live",
      lobby: R("lobby").api,
      myPeer: () => myKey,
      async join(name) { const r = R(name); r.joined = true; r.flush(); return r.api; },
      async leave(name) { if (rooms[name]) await rooms[name].api.leave(); }
    } : null);
  }
  function serverFromUrl() {
    const m = /[?&]peer=([^&#]+)/.exec(location.search);
    if (!m) return null;
    const [host, port] = decodeURIComponent(m[1]).split(":");
    return {host, port: +(port || 9000), path: "/", secure: location.protocol === "https:" && host !== "localhost"};
  }

  G.net = {
    // "claude" : salle partagée de claude.ai ; "p2p" : connexion directe avec un code de salle ; "mock" : onglets locaux (tests).
    mode() {
      if (/[?&#]mock\b/.test(location.search + location.hash)) return "mock";
      if (window.claude && typeof window.claude.use === "function") return "claude";
      return typeof window.Peer === "function" ? "p2p" : "mock";
    },
    key: () => keyNow,
    async connectP2P(code) {
      const net = await p2pRoom(code, serverFromUrl(), await claimKey());
      return net || {mock: false, offline: true, reason: "p2p", lobby: null, myPeer: () => null, join: async () => { throw new Error("offline"); }, leave: async () => {}};
    },
    // Renvoie {mock, lobby, ..., reason}. Dans le visualiseur claude.ai on n'utilise JAMAIS la simulation :
    // si la salle partagée est indisponible, on le dit (reason) au lieu de jouer seul sans le savoir.
    async connect() {
      const forceMock = /[?&#]mock\b/.test(location.search + location.hash);
      const inViewer = !!(window.claude && typeof window.claude.use === "function");
      const key = await claimKey();
      if (forceMock || !inViewer) return Object.assign(mockRoom(key), {reason: inViewer ? "mock" : "local"});
      let room = null, reason = null;
      try { room = await Promise.race([window.claude.use("room"), new Promise(r => setTimeout(() => r("timeout"), 20000))]); }
      catch (e) { room = null; reason = "error"; }
      if (room === "timeout") { room = null; reason = "timeout"; }
      if (!room) return {mock: false, offline: true, reason: reason || "unavailable", lobby: null, myPeer: () => null, join: async () => { throw new Error("offline"); }, leave: async () => {}};
      return Object.assign(realRoom(room, key), {reason: "live"});
    }
  };
})();
