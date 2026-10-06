/* Gonflette Party : couche réseau.
   Dans le visualiseur claude.ai : capacité `room` (présence en direct entre téléphones).
   Ailleurs (fichier local, tests) : simulation par BroadcastChannel entre onglets du même navigateur. */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});

  function mockRoom() {
    const myPeer = "t" + Math.random().toString(36).slice(2, 10);
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
      function send() { if (!closed) bc.postMessage({t: "p", peer: myPeer, presence: mine}); }
      bc.onmessage = e => {
        const m = e.data;
        if (m.t === "p") {
          const prev = others.get(m.peer), json = JSON.stringify(m.presence);
          if (prev && prev.json === json) { prev.seen = Date.now(); return; }
          others.set(m.peer, {presence: Object.freeze(m.presence), json, updatedAt: Date.now(), seen: Date.now()});
          rebuild();
          if (!prev) send();
        } else if (m.t === "bye") { if (others.delete(m.peer)) rebuild(); }
        else if (m.t === "e") (topicLs.get(m.topic) || []).forEach(fn => fn(Object.assign({topic: m.topic, data: m.data}, sender(false), {peer: m.peer})));
      };
      const hb = setInterval(() => {
        send();
        const now = Date.now(); let ch = false;
        for (const [p, o] of others) if (now - o.seen > 4500) { others.delete(p); ch = true; }
        if (ch) rebuild();
      }, 1000);
      addEventListener("pagehide", () => { if (!closed) bc.postMessage({t: "bye", peer: myPeer}); });
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
        leave() { if (closed) return Promise.resolve(); closed = true; clearInterval(hb); bc.postMessage({t: "bye", peer: myPeer}); bc.close(); peerLs.clear(); return Promise.resolve(); }
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

  function realRoom(room) {
    const rooms = {};
    return {
      mock: false,
      lobby: room,
      myPeer: () => { const me = room.peers().find(p => p.sameTab); return me ? me.peer : null; },
      async join(name) { if (!rooms[name]) rooms[name] = await room.join(name); return rooms[name]; },
      async leave(name) { if (rooms[name]) { try { await rooms[name].leave(); } catch (e) {} delete rooms[name]; } }
    };
  }

  /* ---------- Connexion directe entre téléphones (PeerJS / WebRTC), sans compte ----------
     Le premier téléphone qui ouvre la salle prend l'identifiant "gonflette-v1-<code>" et sert de relais :
     il reçoit la présence de chacun et la renvoie aux autres. Si le relais part, un autre téléphone le remplace. */
  function p2pRoom(code, server) {
    const hubId = "gonflette-v1-" + code.toLowerCase().replace(/[^a-z0-9]/g, "");
    const opts = Object.assign({debug: 0}, server || {});
    let peer = null, myId = null, isHub = false, hubConn = null, link = false, dead = false;
    const clients = new Map();                 // relais : id -> connexion
    const rooms = {};
    const connLs = new Set();
    const setLink = v => { if (link !== v) { link = v; connLs.forEach(fn => { try { fn(v); } catch (e) {} }); } };

    function R(name, joined = true) {
      if (rooms[name]) return rooms[name];
      const r = {name, mine: {}, all: new Map(), ls: new Set(), snap: Object.freeze([]), members: new Set(), joined, timer: null};
      r.rebuild = () => {
        const arr = [];
        if (myId && r.joined) arr.push(Object.freeze({peer: myId, by: null, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: Object.freeze(Object.assign({}, r.mine)), updatedAt: Date.now()}));
        for (const [id, o] of r.all) if (id !== myId) arr.push(Object.freeze({peer: id, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.at}));
        r.snap = Object.freeze(arr);
        r.ls.forEach(fn => { try { fn({peers: r.snap, joined: [], left: [], updated: []}); } catch (e) { console.error(e); } });
      };
      r.flush = () => {
        r.timer = null;
        if (!r.joined || !myId) return;
        if (isHub) relay(name, {t: "u", r: name, id: myId, p: r.mine});
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
          if (isHub) relay(name, {t: "x", r: name, id: myId}); // le relais garde la salle pour les autres
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
      for (const id of r.members) if (id !== except) { const c = clients.get(id); if (c && c.open) c.send(msg); }
    }
    function hubReceive(conn, m) {
      if (!m || typeof m.r !== "string") return;
      const r = R(m.r, false);
      if (m.t === "p") {
        if (!r.members.has(conn.peer)) {
          r.members.add(conn.peer);
          const list = [];
          if (myId && r.joined) list.push([myId, r.mine]);
          for (const [id, o] of r.all) if (id !== myId) list.push([id, o.presence]);
          conn.send({t: "s", r: m.r, peers: list});
        }
        r.all.set(conn.peer, {presence: Object.freeze(m.p || {}), at: Date.now()});
        r.rebuild();
        relay(m.r, {t: "u", r: m.r, id: conn.peer, p: m.p}, conn.peer);
      } else if (m.t === "l") {
        r.members.delete(conn.peer); r.all.delete(conn.peer); r.rebuild();
        relay(m.r, {t: "x", r: m.r, id: conn.peer});
      }
    }
    function dropClient(id) {
      clients.delete(id);
      for (const name in rooms) {
        const r = rooms[name];
        if (r.members.delete(id) | r.all.delete(id)) { r.rebuild(); relay(name, {t: "x", r: name, id}); }
      }
    }
    function clientReceive(m) {
      if (!m || !rooms[m.r]) return;
      const r = rooms[m.r];
      if (m.t === "s") { r.all.clear(); for (const [id, p] of m.peers || []) if (id !== myId) r.all.set(id, {presence: Object.freeze(p || {}), at: Date.now()}); r.rebuild(); }
      else if (m.t === "u") { if (m.id !== myId) { r.all.set(m.id, {presence: Object.freeze(m.p || {}), at: Date.now()}); r.rebuild(); } }
      else if (m.t === "x") { if (r.all.delete(m.id)) r.rebuild(); }
    }

    return new Promise(resolve => {
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      const failT = setTimeout(() => done(null), 20000);
      const ok = () => { clearTimeout(failT); done(true); };

      function becomeHub(onFail) {
        const p = new Peer(hubId, opts);
        peer = p;
        p.on("open", id => {
          isHub = true; myId = id; setLink(true);
          for (const name in rooms) { const r = rooms[name]; r.all.clear(); r.members.clear(); r.rebuild(); }
          ok();
        });
        p.on("connection", conn => {
          conn.on("open", () => clients.set(conn.peer, conn));
          conn.on("data", m => hubReceive(conn, m));
          conn.on("close", () => dropClient(conn.peer));
          conn.on("error", () => dropClient(conn.peer));
        });
        p.on("disconnected", () => { if (!dead && !p.destroyed) p.reconnect(); });
        p.on("error", e => {
          if (e.type === "unavailable-id") { p.destroy(); onFail(); }
          else if (!myId) { console.warn("p2p", e.type); }
        });
      }
      function becomeClient() {
        const p = new Peer(opts);
        peer = p; isHub = false;
        p.on("open", id => {
          myId = id;
          const c = p.connect(hubId, {reliable: true, serialization: "json"});
          hubConn = c;
          c.on("open", () => {
            setLink(true);
            for (const name in rooms) { const r = rooms[name]; r.all.clear(); r.rebuild(); if (r.joined) c.send({t: "p", r: name, p: r.mine}); }
            ok();
          });
          c.on("data", clientReceive);
          c.on("close", lost);
          c.on("error", lost);
        });
        p.on("disconnected", () => { if (!dead && !p.destroyed && !(hubConn && hubConn.open)) p.reconnect(); });
        p.on("error", e => { if (e.type === "peer-unavailable") lost(); else console.warn("p2p", e.type); });
      }
      let retrying = false;
      function lost() {
        if (dead || retrying) return;
        retrying = true; setLink(false);
        try { peer && peer.destroy(); } catch (e) {}
        hubConn = null;
        // Le relais est parti : chacun tente de le remplacer après un délai aléatoire, les autres le rejoignent.
        setTimeout(() => { retrying = false; becomeHub(becomeClient); }, 400 + Math.random() * 1500);
      }
      becomeHub(becomeClient);
      addEventListener("pagehide", () => { dead = true; try { peer && peer.destroy(); } catch (e) {} });
    }).then(okay => okay ? {
      mock: false, p2p: true, code, reason: "live",
      lobby: R("lobby").api,
      myPeer: () => myId,
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
    async connectP2P(code) {
      const net = await p2pRoom(code, serverFromUrl());
      return net || {mock: false, offline: true, reason: "p2p", lobby: null, myPeer: () => null, join: async () => { throw new Error("offline"); }, leave: async () => {}};
    },
    // Renvoie {mock, lobby, ..., reason}. Dans le visualiseur claude.ai on n'utilise JAMAIS la simulation :
    // si la salle partagée est indisponible, on le dit (reason) au lieu de jouer seul sans le savoir.
    async connect() {
      const forceMock = /[?&#]mock\b/.test(location.search + location.hash);
      const inViewer = !!(window.claude && typeof window.claude.use === "function");
      if (forceMock || !inViewer) return Object.assign(mockRoom(), {reason: inViewer ? "mock" : "local"});
      let room = null, reason = null;
      try { room = await Promise.race([window.claude.use("room"), new Promise(r => setTimeout(() => r("timeout"), 20000))]); }
      catch (e) { room = null; reason = "error"; }
      if (room === "timeout") { room = null; reason = "timeout"; }
      if (!room) return {mock: false, offline: true, reason: reason || "unavailable", lobby: null, myPeer: () => null, join: async () => { throw new Error("offline"); }, leave: async () => {}};
      return Object.assign(realRoom(room), {reason: "live"});
    }
  };
})();
