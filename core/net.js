/* Gonflette Party : couche réseau.
   Salles à code (site public) : relais Nostr publics (wss://, port 443) par défaut, voir relayRoom ;
   ancien mode PeerJS/WebRTC avec ?net=peer (ou ?peer=hôte:port pour les tests).
   Dans le visualiseur claude.ai : capacité `room` (présence en direct entre téléphones).
   ?mock (tests) : simulation par BroadcastChannel entre onglets du même navigateur. */
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

    let doLost = () => {};
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
      doLost = lost;
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
      mock: false, p2p: true, transport: "peer", code, reason: "live",
      lobby: R("lobby").api,
      myPeer: () => myKey,
      async join(name) { const r = R(name); r.joined = true; r.flush(); return r.api; },
      async leave(name) { if (rooms[name]) await rooms[name].api.leave(); },
      status: () => ({transport: "peer", code, link, up: link ? 1 : 0, total: 1, proto: 1, app: APP_VERSION, key: myKey, lastErr: "", newer: null, legacy: null,
        peers: isHub ? clients.size : Object.values(rooms).reduce((n, r) => Math.max(n, r.all.size), 0), role: isHub ? "relais (ce téléphone)" : "client",
        relays: [{url: opts.host ? opts.host + ":" + opts.port : "0.peerjs.com", host: opts.host || "0.peerjs.com", st: link ? "up" : "connecting", err: "", rtt: null}]}),
      repair: () => { if (!dead) doLost(); },
      onStatus(fn) { const t = setInterval(() => fn(this.status()), 2000); setTimeout(() => fn(this.status()), 0); return () => clearInterval(t); }
    } : null);
  }
  /* ---------- Relais publics (Nostr) : transport par défaut des salles à code ----------
     Plus de WebRTC ni de « téléphone relais » : chaque téléphone ouvre une simple connexion WebSocket sécurisée
     (wss://, port 443, comme une page web) vers PLUSIEURS relais Nostr publics, gratuits et sans compte, et y
     publie des événements « éphémères » (genre 20000-29999 : relayés aux abonnés, jamais gardés). Deux téléphones
     se voient dès qu'ils partagent UN relais joignable ; un relais en panne ou bloqué ne coupe pas la salle.
     - Étiquette ["t", empreinte(code, salle)] : le relais ne transmet que les événements de nos salles (lobby, partie).
     - Contenu chiffré (AES-GCM, clé tirée du code de salle) et compressé : les inconnus du relais ne lisent rien.
     - Signature Schnorr (clé jetable par page), exigée par les relais (vendor/nostr-sign.min.js).
     - Présence = état COMPLET d'une salle (le plus récent gagne, numéro croissant q) ; ≤ 15 envois/s par salle
       de jeu, 10/s pour le lobby, 25/s en tout ; renvoyée toutes les 3 s au repos (battement). Les envois
       fréquents partent sur 2 relais communs à tous (les plus rapides), les « images clés » (≥ 1 toutes les 3 s)
       sur tous les relais.
     - Arrivée dans une salle : « bonjour » (h) ; chacun renvoie alors son état (délai aléatoire). Départ : p = null,
       « au revoir » (b) à la fermeture de la page. Un joueur muet depuis 15 s est retiré (il revient tout seul avec
       la même clé après un rechargement : la page la plus récente l'emporte).
     - Chaque relais a un débit adaptatif : s'il répond « rate-limited », on ralentit (moins de mises à jour, jamais
       de coupure) puis on réaccélère. Relais muet 10 s ou fermé : reconnexion (délai croissant) ; relais qui échoue
       ou refuse sans cesse : remplacé par un relais de secours.
     - iOS coupe les WebSocket en arrière-plan : au retour (visibilitychange, pageshow, online), on vérifie chaque
       relais et on redemande l'état de tout le monde aussitôt. */
  const PROTO = 3;                           // 1-2 : PeerJS ; 3 : relais Nostr (incompatibles : même version pour tous)
  const APP_VERSION = "2026.10.12-relais";
  const KIND = 21767;                        // genre éphémère propre à Gonflette Party
  const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://offchain.pub",
    "wss://relay.nostr.net", "wss://nostr.mom", "wss://nostr21.com"]; // 4 actifs, les autres en secours
  const ACTIVE = 4;
  const PEER_TTL = 15000, HB_MS = 3000, KF_MS = 3000, GAP_LOBBY = 100, GAP_ROOM = 66, GAP_ALL = 40, MAX_RATE = 25;
  let newerSeen = null;
  const newerLs = new Set();
  function sawNewer(v) { if (newerSeen) return; newerSeen = v; newerLs.forEach(fn => { try { fn(v); } catch (e) {} }); }
  const te = new TextEncoder(), td = new TextDecoder();
  function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  const canZ = (() => { try { new CompressionStream("deflate"); new DecompressionStream("deflate"); return true; } catch (e) { return false; } })();
  const zpipe = async (u8, T) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new T("deflate"))).arrayBuffer());
  const rnd = () => Math.random().toString(36).slice(2, 10);
  const relayOk = () => typeof window.NostrSign === "object" && typeof WebSocket === "function" && !!(window.crypto && crypto.subtle);

  function relayRoom(code, urls, key) {
    const norm = code.toLowerCase().replace(/[^a-z0-9]/g, "") || "salle";
    let inst = rnd(), t0 = Date.now();
    let myKey = key, dead = false, link = false, lastErr = "", seqN = 0, clockOff = 0, aes = null, everUp = false;
    let lastBuildAny = 0, lastBeat = Date.now(), tickT = null, tickAt = 0, statT = null;
    const kp = NostrSign.keygen();
    const rooms = {}, tagRoom = new Map(), connLs = new Set(), statLs = new Set();
    const others = new Map();                // clé -> {s: relais vus (masque), z: sait décompresser, a: version, seen}
    const seenIds = new Map(), ownIds = new Map();
    const stats = {built: 0, kf: 0, sent: 0, rx: 0, dup: 0, txB: 0, rxB: 0, limited: 0, maxMsg: 0, lat: [], perRoom: {}};
    const spares = urls.slice(ACTIVE);
    const mkLink = (url, slot) => ({slot, i: urls.indexOf(url), url, host: url.replace(/^wss?:\/\//, "").replace(/\/.*$/, ""), ws: null, st: "off", err: "", rtt: null,
      tries: 0, fails: 0, rejects: 0, timer: null, retryAt: 0, lastRx: 0, lastTx: 0, upAt: 0, sub: null, subN: 0, sent: {}, rate: MAX_RATE, tokens: MAX_RATE, tAt: Date.now(),
      limitedUntil: 0, okWait: new Map(), rx: 0, tx: 0, echoAt: 0, evAt: 0, subAt: 0, resub: 0});
    const links = urls.slice(0, ACTIVE).map(mkLink);
    const hidden = () => typeof document !== "undefined" && document.hidden;
    const upLinks = () => links.filter(l => l.st === "up");
    const mask = () => links.reduce((m, l) => l.st === "up" && l.i >= 0 ? m | (1 << l.i) : m, 0);
    const seq = () => (seqN = Math.max(seqN + 1, Date.now()));
    const tagOf = name => NostrSign.sha256hex("gonflette-party/v3/" + norm + "/" + name).slice(0, 32);
    const roomList = () => Object.values(rooms).sort((a, b) => (a.name === "lobby") - (b.name === "lobby"));

    async function seal(txt, z) {
      let bytes = te.encode(txt), flag = 0;
      if (z) { try { const c = await zpipe(bytes, CompressionStream); if (c.length < bytes.length) { bytes = c; flag = 1; } } catch (e) {} }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv}, aes, bytes));
      const out = new Uint8Array(13 + ct.length);
      out[0] = flag; out.set(iv, 1); out.set(ct, 13);
      return "1" + b64(out);
    }
    async function unseal(s) {
      if (typeof s !== "string" || s[0] !== "1") return null;
      const u = unb64(s.slice(1));
      let pt = new Uint8Array(await crypto.subtle.decrypt({name: "AES-GCM", iv: u.subarray(1, 13)}, aes, u.subarray(13)));
      if (u[0] & 1) pt = await zpipe(pt, DecompressionStream);
      return JSON.parse(td.decode(pt));
    }
    function sign(tag, content) {
      const now = Math.floor(Date.now() / 1000) + clockOff;
      return NostrSign.finish({pubkey: kp.pk, created_at: now, kind: KIND, tags: [["t", tag], ["expiration", String(now + 300)]], content}, kp);
    }
    function status() {
      const up = upLinks().filter(l => l.rejects < 2).length, now = Date.now();
      const seen = new Set(); for (const name in rooms) for (const k of rooms[name].all.keys()) seen.add(k);
      return {transport: "relay", code, link, up, total: links.length, proto: PROTO, app: APP_VERSION, key: myKey, peers: seen.size, lastErr, newer: newerSeen, legacy: legacyState, clockOff, compress: canZ,
        relays: links.map(l => ({url: l.url, host: l.host, st: l.st, err: l.err, rtt: l.rtt == null ? null : Math.round(l.rtt), limited: now < l.limitedUntil, refusing: l.st === "up" && l.rejects >= 2, rate: Math.round(l.rate),
          retryIn: l.st === "off" && l.retryAt ? Math.max(0, Math.round((l.retryAt - now) / 1000)) : null, rx: l.rx, tx: l.tx}))};
    }
    const emitStatus = () => { if (statT) return; statT = setTimeout(() => { statT = null; const s = status(); statLs.forEach(fn => { try { fn(s); } catch (e) {} }); }, 120); };
    const updLink = () => {
      const v = upLinks().length > 0;
      if (v) everUp = true;
      if (link !== v) { link = v; connLs.forEach(fn => { try { fn(v); } catch (e) {} }); }
      for (const name in rooms) rooms[name].dirty = true; // les autres apprennent quels relais on voit (masque s)
      emitStatus();
    };

    /* --- salles --- */
    function R(name) {
      if (rooms[name]) return rooms[name];
      const r = {name, tag: tagOf(name), mine: {}, all: new Map(), tomb: new Map(), ls: new Set(), snap: Object.freeze([]), joined: true,
        gap: name === "lobby" ? GAP_LOBBY : GAP_ROOM, dirty: true, forceKf: true, hello: true, building: false, cur: null, kfQ: 0, lastKfAt: 0, lastBuild: 0,
        replyT: null, bye: null, st: {calls: 0, built: 0, rx: 0, t: Date.now()}};
      stats.perRoom[name] = r.st;
      r.rebuild = () => {
        const arr = [];
        if (r.joined) arr.push(Object.freeze({peer: myKey, by: null, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: Object.freeze(Object.assign({}, r.mine)), updatedAt: Date.now()}));
        for (const [id, o] of r.all) if (id !== myKey) arr.push(Object.freeze({peer: id, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.at}));
        r.snap = Object.freeze(arr);
        r.ls.forEach(fn => { try { fn({peers: r.snap, joined: [], left: [], updated: []}); } catch (e) { console.error(e); } });
      };
      r.api = {
        name,
        presence(patch) {
          if (!r.joined) return Promise.resolve();
          r.st.calls++;
          for (const k in patch) { if (patch[k] === null) delete r.mine[k]; else r.mine[k] = JSON.parse(JSON.stringify(patch[k])); }
          r.dirty = true;
          r.rebuild();
          schedule(0);
          return Promise.resolve();
        },
        peers: () => r.snap,
        onPeers(fn) { r.ls.add(fn); setTimeout(() => fn({peers: r.snap, joined: r.snap, left: [], updated: []}), 0); return () => r.ls.delete(fn); },
        emit() { return Promise.resolve(); },
        on() { return () => {}; },
        connected: () => link,
        onConnection(fn) { connLs.add(fn); setTimeout(() => fn(link), 0); return () => connLs.delete(fn); },
        leave() {
          if (!r.joined) return Promise.resolve();
          r.joined = false; r.ls.clear(); clearTimeout(r.replyT); r.mine = {};
          if (rooms[name] === r) { delete rooms[name]; tagRoom.delete(r.tag); resubscribe(); }
          if (aes && !dead) { // départ annoncé sur tous les relais
            const body = JSON.stringify({v: PROTO, k: myKey, n: inst, t0, r: name, q: seq(), p: null, ts: Date.now()});
            seal(body, false).then(c => { const m = JSON.stringify(["EVENT", sign(r.tag, c)]); for (const l of upLinks()) sendRaw(l, m); }).catch(() => {});
          }
          return Promise.resolve();
        }
      };
      rooms[name] = r; tagRoom.set(r.tag, r);
      prepBye(r);
      resubscribe();
      schedule(0);
      return r;
    }
    // « au revoir » préparé d'avance : à la fermeture de la page, on n'a plus le temps de chiffrer (asynchrone)
    function prepBye(r) {
      if (!aes) return;
      const n = inst, k = myKey;
      seal(JSON.stringify({v: PROTO, k, n, t0, r: r.name, b: 1}), false).then(c => { if (inst === n && myKey === k) r.bye = c; }).catch(() => {});
    }

    /* --- fabrication et envoi des événements --- */
    function schedule(ms) {
      if (dead) return;
      const at = Date.now() + ms;
      if (tickT && tickAt <= at) return;
      clearTimeout(tickT); tickAt = at;
      tickT = setTimeout(() => { tickT = null; tick(); }, ms);
    }
    function tick() {
      if (dead || !aes) return;
      const now = Date.now();
      let next = 1000;
      if (upLinks().length) for (const r of roomList()) {
        if (!r.joined || r.building) continue;
        if (!(r.dirty || r.forceKf || now - r.lastBuild >= HB_MS)) { next = Math.min(next, r.lastBuild + HB_MS - now); continue; }
        const wait = Math.max(r.lastBuild + r.gap - now, lastBuildAny + GAP_ALL - now);
        if (wait > 0) { next = Math.min(next, wait); continue; }
        build(r, now);
      }
      for (const l of links) if (l.st === "up") next = Math.min(next, pumpLink(l, now));
      schedule(Math.max(8, next));
    }
    function primaries(r) {
      const up = upLinks(), now = Date.now();
      let c = up.filter(l => now >= l.limitedUntil && l.rejects < 2); // ni ralenti, ni en train de refuser nos messages
      if (!c.length) c = up.slice();
      c.sort((a, b) => (a.rtt == null ? 1e4 : a.rtt) - (b.rtt == null ? 1e4 : b.rtt));
      const ks = [...r.all.keys()];
      const common = c.filter(l => ks.every(k => { const o = others.get(k); return !o || !o.s || l.i < 0 || ((o.s >> l.i) & 1); }));
      return common.length ? common.slice(0, 2) : up;
    }
    function build(r, now) {
      const kf = r.forceKf || now - r.lastKfAt >= KF_MS, hello = r.hello;
      r.dirty = false; r.forceKf = false; r.hello = false; r.building = true; r.lastBuild = now; lastBuildAny = now;
      const q = seq(), body = {v: PROTO, k: myKey, n: inst, t0, r: r.name, q, p: r.mine, s: mask(), z: canZ ? 1 : 0, a: APP_VERSION, ts: now};
      if (hello) body.h = 1;
      const txt = JSON.stringify(body);
      const z = canZ && txt.length > 400 && [...r.all.keys()].every(k => { const o = others.get(k); return o && o.z; });
      const myInst = inst;
      seal(txt, z).then(content => {
        r.building = false;
        if (dead || !r.joined || inst !== myInst) return;
        const ev = sign(r.tag, content), msg = JSON.stringify(["EVENT", ev]);
        if (msg.length > 60000) { lastErr = "état trop gros (" + Math.round(msg.length / 1000) + " ko)"; console.warn("Gonflette : message relais trop gros", msg.length); }
        ownIds.set(ev.id, now); seenIds.set(ev.id, now);
        if (msg.length > stats.maxMsg) stats.maxMsg = msg.length;
        r.cur = {q, kf, msg, id: ev.id, at: now, prim: kf ? null : primaries(r)};
        if (kf) { r.kfQ = q; r.lastKfAt = now; stats.kf++; }
        stats.built++; r.st.built++;
        tick();
      }, e => { r.building = false; r.dirty = true; lastErr = "chiffrement : " + (e && e.message || e); schedule(500); });
    }
    function sendRaw(l, msg) {
      const ws = l.ws;
      if (!ws || ws.readyState !== 1) return false;
      if (ws.bufferedAmount > 200000) return false; // connexion engorgée : on attend (le plus récent partira)
      try { ws.send(msg); } catch (e) { return false; }
      l.lastTx = Date.now(); l.tx++; stats.sent++; stats.txB += msg.length;
      return true;
    }
    function pumpLink(l, now) {
      l.tokens = Math.min(Math.max(3, l.rate), l.tokens + (now - l.tAt) / 1000 * l.rate); l.tAt = now;
      let next = 1000;
      for (const r of roomList()) {
        const c = r.cur;
        if (!c || !r.joined) continue;
        const s = l.sent[r.name] || 0;
        if (s >= c.q) continue;
        if (now - c.at > 20000) { r.forceKf = true; next = 0; continue; } // trop vieux (refusé par les relais) : on en refait un
        // image clé : partout ; mise à jour rapide : sur les relais principaux, ou si ce relais a raté la dernière image clé
        if (!(c.kf || s < r.kfQ || !c.prim || c.prim.includes(l))) continue;
        if (l.tokens < 1) { next = Math.min(next, Math.ceil((1 - l.tokens) / Math.max(.5, l.rate) * 1000)); continue; }
        if (sendRaw(l, c.msg)) {
          l.tokens--; l.sent[r.name] = c.q;
          if (l.okWait.size < 60) l.okWait.set(c.id, now);
        } else next = Math.min(next, 50);
      }
      return next;
    }

    /* --- réception --- */
    function onFrame(l, data) {
      const now = Date.now();
      l.lastRx = now; l.rx++;
      if (typeof data !== "string") return;
      stats.rxB += data.length;
      if (data.startsWith('["EVENT"')) {
        if (l.st === "sub") becomeUp(l);
        const mm = /"id"\s*:\s*"([0-9a-f]{64})"/.exec(data);
        if (!mm) return;
        const id = mm[1];
        l.evAt = now;
        if (ownIds.has(id)) { l.echoAt = now; l.resub = 0; }   // écho de notre propre événement : l'abonnement marche
        if (seenIds.has(id)) { stats.dup++; return; }
        seenIds.set(id, now);
        if (seenIds.size > 5000) { let n = 2500; for (const k of seenIds.keys()) { seenIds.delete(k); if (--n <= 0) break; } }
        let m; try { m = JSON.parse(data); } catch (e) { return; }
        const ev = m[2];
        if (!ev || ev.kind !== KIND || !Array.isArray(ev.tags) || ev.pubkey === kp.pk) return;
        const tg = ev.tags.find(t => t[0] === "t"), r = tg && tagRoom.get(tg[1]);
        if (!r) return;
        stats.rx++; r.st.rx++;
        unseal(ev.content).then(p => onPayload(p, r)).catch(() => {});
        return;
      }
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      if (!Array.isArray(m)) return;
      if (m[0] === "OK") {
        const t = l.okWait.get(m[1]);
        if (t) { l.okWait.delete(m[1]); const d = now - t; l.rtt = l.rtt == null ? d : l.rtt * .8 + d * .2; }
        if (ownIds.has(m[1]) && l.st === "sub") becomeUp(l);
        if (m[2] === false) onReject(l, String(m[3] || "")); else if (m[2] === true) l.rejects = 0;
      } else if (m[0] === "EOSE") { if (m[1] === l.sub && l.st === "sub") becomeUp(l); }
      else if (m[0] === "CLOSED") {
        if (m[1] !== l.sub) return;
        l.err = "abonnement refusé : " + String(m[2] || "").slice(0, 60); l.rejects++; lastErr = l.host + " : " + l.err;
        if (l.rejects >= 3) down(l, l.err); else setTimeout(() => { if (l.ws && l.ws.readyState === 1) subscribe(l); }, 3000);
      } else if (m[0] === "NOTICE") {
        const s = String(m[1] || "");
        if (/rate|limit|slow|too (many|fast)/i.test(s)) limited(l, s);
        else l.err = "message : " + s.slice(0, 60);
        emitStatus();
      }
    }
    function limited(l, why) {
      const now = Date.now();
      l.rate = Math.max(1, l.rate * (now < l.limitedUntil ? .7 : .5));
      l.limitedUntil = now + 5000; l.tokens = Math.min(l.tokens, 0);
      l.err = "limite de débit (" + Math.round(l.rate) + "/s)"; stats.limited++;
      emitStatus();
    }
    function onReject(l, msg) {
      if (/^duplicate/i.test(msg)) return;
      if (/rate|slow|too (many|fast)|limit/i.test(msg)) { limited(l, msg); return; }
      l.err = "refusé : " + msg.slice(0, 70);
      const clock = /expired|too old|created_at|future|in the past/i.test(msg);
      if (clock) l.err += " (heure du téléphone décalée ?)";
      lastErr = l.host + " : " + l.err;
      if (!clock && ++l.rejects >= 5 && upLinks().some(x => x !== l)) down(l, l.err);
      emitStatus();
    }
    function onPayload(p, r) {
      if (!p || typeof p !== "object" || dead) return;
      if (p.v !== PROTO) { if (typeof p.v === "number" && p.v > PROTO) { sawNewer(p.v); emitStatus(); } return; }
      if (typeof p.k !== "string" || !/^[\w-]{1,40}$/.test(p.k) || p.r !== r.name || typeof p.n !== "string") return;
      if (rooms[r.name] !== r || !r.joined) return;
      const now = Date.now();
      if (p.k === myKey) {
        // même clé dans une page plus ancienne ENCORE active (pas un rechargement) : la plus récente change de clé
        if (p.n !== inst && !p.b && typeof p.t0 === "number" && p.t0 < t0 && typeof p.ts === "number" && p.ts > t0 + 4000) changeKey();
        return;
      }
      if (typeof p.ts === "number") { const d = now - p.ts; if (d > -5000 && d < 60000) { stats.lat.push(d); if (stats.lat.length > 400) stats.lat.splice(0, 200); } }
      const cur = r.all.get(p.k), tomb = r.tomb.get(p.k);
      const q = typeof p.q === "number" ? p.q : 0;
      if (tomb && tomb.n === p.n && (p.b || q <= tomb.q)) return;
      if (cur && cur.n === p.n && !p.b && q <= cur.q) return;          // doublon ou message en retard
      if (cur && cur.n !== p.n && !((p.t0 || 0) > (cur.t0 || 0) || now - cur.seen > 4000)) return; // vieille page (rechargée depuis)
      if (p.b || p.p === null) {
        r.tomb.set(p.k, {n: p.n, q: p.b ? Infinity : q});
        if (r.tomb.size > 200) r.tomb.delete(r.tomb.keys().next().value);
        if (r.all.delete(p.k)) { r.rebuild(); emitStatus(); }
        return;
      }
      if (!p.p || typeof p.p !== "object") return;
      others.set(p.k, {s: p.s | 0, z: p.z ? 1 : 0, a: typeof p.a === "string" ? p.a.slice(0, 40) : "", seen: now});
      if (p.h || !cur) reply(r);
      const json = JSON.stringify(p.p);
      if (cur && cur.n === p.n && cur.json === json) { cur.q = q; cur.seen = now; return; }
      r.all.set(p.k, {n: p.n, t0: p.t0 || 0, q, presence: Object.freeze(p.p), json, at: now, seen: now});
      r.rebuild();
      if (!cur) emitStatus();
    }
    // quelqu'un arrive (ou redemande) : on renvoie notre état complet, un peu plus tard (regroupé, délai aléatoire)
    function reply(r) {
      if (r.replyT) return;
      r.replyT = setTimeout(() => { r.replyT = null; if (Date.now() - r.lastKfAt > 300) { r.forceKf = true; schedule(0); } }, 60 + Math.random() * 300);
    }
    function changeKey() {
      const old = myKey;
      myKey = storeKey(newKey());
      console.warn("Gonflette : clé déjà utilisée par une autre page, nouvelle clé", old, "->", myKey);
      for (const name in rooms) { const r = rooms[name]; r.forceKf = true; r.hello = true; prepBye(r); r.rebuild(); }
      schedule(0);
    }

    /* --- connexions aux relais --- */
    function subscribe(l) {
      const ws = l.ws;
      if (!ws || ws.readyState !== 1) return;
      const tags = [...tagRoom.keys()];
      try { // nouvel abonnement d'abord, puis fermeture de l'ancien : rien ne se perd entre les deux (doublons ignorés)
        const old = l.sub;
        l.sub = "gf" + (++l.subN); l.subAt = Date.now();
        ws.send(JSON.stringify(["REQ", l.sub, {kinds: [KIND], "#t": tags, since: Math.floor(Date.now() / 1000) + clockOff - 30}]));
        if (old) ws.send(JSON.stringify(["CLOSE", old]));
      } catch (e) {}
    }
    let resubT = null;
    function resubscribe() { clearTimeout(resubT); resubT = setTimeout(() => { for (const l of links) if (l.st === "up" || l.st === "sub") subscribe(l); }, 0); }
    function becomeUp(l) {
      if (l.st === "up") return;
      l.st = "up"; l.tries = 0; l.fails = 0; l.upAt = Date.now(); l.err = ""; l.tokens = Math.max(3, l.rate); l.tAt = Date.now();
      updLink();
      const now = Date.now();
      for (const name in rooms) { const r = rooms[name]; r.forceKf = true; if (!r.lastHelloAt || now - r.lastHelloAt > 1500) { r.hello = true; r.lastHelloAt = now; } }
      schedule(0);
    }
    function connectLink(l) {
      clearTimeout(l.timer); l.timer = null;
      if (dead) return;
      if (l.ws) { const o = l.ws; l.ws = null; o.onopen = o.onmessage = o.onclose = o.onerror = null; try { o.close(); } catch (e) {} }
      l.st = "connecting"; l.retryAt = 0; l.sent = {}; l.sub = null; l.okWait.clear();
      emitStatus();
      let ws;
      try { ws = new WebSocket(l.url); } catch (e) { down(l, "adresse invalide"); return; }
      l.ws = ws;
      const openT = setTimeout(() => { if (l.ws === ws && l.st === "connecting") down(l, "pas de réponse"); }, 9000);
      ws.onopen = () => {
        if (l.ws !== ws) return;
        clearTimeout(openT);
        const at = l.lastRx = Date.now();
        l.st = "sub";
        subscribe(l);
        setTimeout(() => { if (l.ws === ws && l.st === "sub" && l.lastRx > at) becomeUp(l); }, 4000); // relais sans EOSE (mais qui répond)
        emitStatus();
      };
      ws.onmessage = e => { if (l.ws === ws) onFrame(l, e.data); };
      ws.onclose = e => { if (l.ws === ws) { clearTimeout(openT); down(l, l.st === "connecting" ? "injoignable" : "connexion fermée" + (e && e.code && e.code !== 1000 && e.code !== 1005 ? " (" + e.code + ")" : "")); } };
      ws.onerror = () => {};
    }
    function down(l, why, delay) {
      clearTimeout(l.timer); l.timer = null;
      const ws = l.ws; l.ws = null;
      if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) {} }
      const was = l.st;
      l.st = "off"; l.sub = null; l.okWait.clear();
      if (why) { l.err = String(why).slice(0, 90); lastErr = l.host + " : " + l.err; }
      updLink();
      if (dead) return;
      if (was !== "up") l.fails++;
      // relais qui échoue sans cesse alors que d'autres marchent : on passe à un relais de secours
      if (spares.length && (l.fails >= 3 || l.rejects >= 5) && upLinks().length) {
        spares.push(l.url);
        const url = spares.shift(), nl = mkLink(url, l.slot);
        Object.assign(l, nl);
        delay = 200;
      }
      clearTimeout(l.timer);
      const d = delay != null ? delay : was === "up" ? 300 + Math.random() * 700 : Math.min(30000, 1000 * Math.pow(2, Math.min(l.tries, 5))) * (0.7 + Math.random() * 0.6);
      l.tries++;
      l.retryAt = Date.now() + d;
      l.timer = setTimeout(() => connectLink(l), d);
      emitStatus();
    }
    // vérification rapide (retour au premier plan, réseau revenu, « Réparer ») : chaque relais doit répondre en 4 s
    function check() {
      if (dead) return;
      const now = Date.now();
      for (const name in rooms) for (const o of rooms[name].all.values()) o.seen = Math.max(o.seen, now - PEER_TTL + 6000); // 6 s pour se manifester
      for (const l of links) {
        if (l.st !== "up") { l.tries = 0; connectLink(l); } // hors service ou bloqué en cours de connexion : on recommence tout de suite
        else if (l.ws && l.ws.readyState > 1) down(l, "connexion perdue", 0);
        else if (l.st === "up") { const at = Date.now(); setTimeout(() => { if (l.st === "up" && l.lastRx < at && !dead) down(l, "muet après la mise en veille", 0); }, 4000); }
      }
      for (const name in rooms) { const r = rooms[name]; r.forceKf = true; r.hello = true; r.lastHelloAt = now; }
      schedule(0);
    }
    function repair() {
      if (dead) return;
      lastErr = "";
      links.forEach((l, i) => { l.tries = 0; l.fails = 0; l.rejects = 0; l.rate = MAX_RATE; l.limitedUntil = 0; down(l, "", 60 * i); });
      for (const name in rooms) { const r = rooms[name]; r.forceKf = true; r.hello = true; r.lastHelloAt = 0; }
      emitStatus();
    }
    setInterval(() => {
      if (dead) return;
      const now = Date.now(), gap = now - lastBeat;
      lastBeat = now;
      if (gap > 6000) { check(); return; } // ce téléphone se réveille : on vérifie avant de juger les autres
      for (const l of links) {
        if ((l.st === "up" || l.st === "sub") && !hidden() && now - l.lastRx > 10000 && now - l.upAt > 10000) down(l, "muet (connexion morte)");
        // nos images clés (≥ 1 toutes les 3 s) doivent nous revenir par l'abonnement : sinon on se réabonne, puis on reconnecte
        else if (l.st === "up" && !hidden() && now - Math.max(l.echoAt || 0, l.evAt || 0, l.subAt || 0, l.upAt) > 9000) {
          if ((l.resub = (l.resub || 0) + 1) > 2) down(l, "abonnement muet"); else subscribe(l);
        }
        else if (l.st === "up" && now > l.limitedUntil + 4000 && l.rate < MAX_RATE) { l.rate = Math.min(MAX_RATE, l.rate + 1); if (now >= l.limitedUntil && /^limite/.test(l.err)) l.err = ""; }
        for (const [id, t] of l.okWait) if (now - t > 15000) l.okWait.delete(id);
      }
      for (const name in rooms) {
        const r = rooms[name]; let ch = false;
        for (const [k, o] of r.all) if (now - o.seen > PEER_TTL) { r.all.delete(k); ch = true; }
        if (ch) { r.rebuild(); emitStatus(); }
      }
      for (const [k, o] of others) if (now - o.seen > 60000) others.delete(k);
      if (ownIds.size > 400) { let n = 200; for (const k of ownIds.keys()) { ownIds.delete(k); if (--n <= 0) break; } }
      emitStatus();
      tick();
    }, 1000);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); else schedule(0); });
    addEventListener("online", () => check());
    if (typeof document !== "undefined") document.addEventListener("resume", () => check()); // Chrome Android : onglet dégelé
    addEventListener("pagehide", () => {
      if (dead) return;
      // « au revoir » préparé d'avance, signé (synchrone) et envoyé sur tous les relais
      for (const name in rooms) { const r = rooms[name]; if (r.joined && r.bye) { const m = JSON.stringify(["EVENT", sign(r.tag, r.bye)]); for (const l of upLinks()) sendRaw(l, m); } }
      dead = true;
      clearTimeout(tickT); tickT = null;
    });
    // page restaurée depuis le cache arrière (iOS, Safari) : nouvelle instance, on se reconnecte et on se réannonce
    addEventListener("pageshow", e => {
      if (!e.persisted || !dead) return;
      dead = false; inst = rnd(); t0 = Date.now(); lastBeat = Date.now();
      for (const name in rooms) { const r = rooms[name]; r.cur = null; r.forceKf = true; r.hello = true; r.lastHelloAt = 0; prepBye(r); }
      links.forEach((l, i) => { l.tries = 0; down(l, "", 30 * i); });
    });

    // heure du téléphone : les relais refusent les événements éphémères trop « vieux ». On compare à l'heure du serveur du site.
    function checkClock() {
      if (!/^https?:/.test(location.protocol)) return;
      const t1 = Date.now();
      fetch(location.href.split("#")[0], {method: "HEAD", cache: "no-store"}).then(res => {
        const d = Date.parse(res.headers.get("date") || ""), t2 = Date.now();
        if (!d || t2 - t1 > 5000) return;
        const off = Math.round((d + 500 - (t1 + t2) / 2) / 1000);
        if (Math.abs(off) > 20) { clockOff = off; console.warn("Gonflette : heure du téléphone décalée de", off, "s (corrigée pour les relais)"); emitStatus(); }
      }).catch(() => {});
    }

    const api = {
      mock: false, p2p: true, transport: "relay", code, reason: "live",
      lobby: null,
      myPeer: () => myKey,
      async join(name) { const r = R(name); return r.api; },
      async leave(name) { if (rooms[name]) await rooms[name].api.leave(); },
      status, check, repair,
      stats: () => Object.assign({}, stats, {links: status().relays, lat: stats.lat.slice()}),
      onStatus(fn) { statLs.add(fn); setTimeout(() => fn(status()), 0); return () => statLs.delete(fn); }
    };
    let legacyState = null;
    api.setLegacy = v => { legacyState = v; emitStatus(); };
    return (async () => {
      const base = await crypto.subtle.importKey("raw", te.encode("gonflette-party:" + norm), "PBKDF2", false, ["deriveKey"]);
      aes = await crypto.subtle.deriveKey({name: "PBKDF2", salt: te.encode("gonflette-party/v3/salle"), iterations: 20000, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
      api.lobby = R("lobby").api;
      checkClock();
      links.forEach((l, i) => setTimeout(() => connectLink(l), 25 * i));
      // on rend la main dès qu'un relais répond (ou après 7 s : l'appli affiche l'état et on continue d'essayer)
      await new Promise(res => {
        const t = setTimeout(() => { connLs.delete(on); res(); }, 7000);
        const on = v => { if (v) { clearTimeout(t); connLs.delete(on); res(); } };
        connLs.add(on);
      });
      return api;
    })();
  }
  function relaysFromUrl() {
    const sp = new URLSearchParams(location.search);
    const list = [];
    for (const v of sp.getAll("relay")) for (let u of v.split(",")) {
      u = u.trim();
      if (!u) continue;
      if (!/^wss?:\/\//.test(u)) u = "wss://" + u;
      const host = u.replace(/^wss?:\/\//, "").replace(/[/:].*$/, "");
      if (/^ws:/.test(u) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) continue; // ws:// (non chiffré) : seulement en local
      if (!list.includes(u)) list.push(u);
    }
    return list.length ? list : null;
  }
  /* Anciens téléphones (version PeerJS, téléphone relais « gonflette-v1-<code> ») : ils ne voient pas les relais.
     On regarde, via le serveur PeerJS, si un tel relais existe pour ce code (« peer-unavailable » = personne). */
  function probeLegacy(code, server) {
    return new Promise(res => {
      if (typeof window.Peer !== "function") { res(null); return; }
      const hubId = "gonflette-v1-" + code.toLowerCase().replace(/[^a-z0-9]/g, "");
      let p = null, done = false;
      const end = v => { if (done) return; done = true; clearTimeout(t); try { p && p.destroy(); } catch (e) {} res(v); };
      const t = setTimeout(() => end(null), 16000);
      try { p = new Peer(Object.assign({debug: 0}, server || {})); } catch (e) { end(null); return; }
      p.on("open", () => {
        try { const c = p.connect(hubId, {reliable: true, metadata: {k: "sonde-version"}}); c.on("open", () => end(true)); } catch (e) { end(null); return; }
        // le serveur garde 5 s un message pour un identifiant inconnu avant de répondre « peer-unavailable » :
        // passé 9 s sans cette réponse, l'identifiant est pris par un ancien téléphone
        setTimeout(() => end(true), 9000);
      });
      p.on("error", e => end(e && e.type === "peer-unavailable" ? false : null));
    });
  }
  function serverFromUrl(param) {
    const m = new RegExp("[?&]" + (param || "peer") + "=([^&#]+)").exec(location.search);
    if (!m) return null;
    const [host, port] = decodeURIComponent(m[1]).split(":");
    return {host, port: +(port || 9000), path: "/", secure: location.protocol === "https:" && host !== "localhost"};
  }

  G.net = {
    // "claude" : salle partagée de claude.ai ; "p2p" : connexion directe avec un code de salle ; "mock" : onglets locaux (tests).
    mode() {
      if (/[?&#]mock\b/.test(location.search + location.hash)) return "mock";
      if (window.claude && typeof window.claude.use === "function") return "claude";
      return relayOk() || typeof window.Peer === "function" ? "p2p" : "mock";
    },
    key: () => keyNow,
    PROTO, APP_VERSION,
    // Salles à code : « relay » (défaut : relais Nostr publics, wss:// port 443) ou « peer » (ancien mode PeerJS/WebRTC).
    // ?net=peer (ou ?peer=hôte:port, serveur PeerJS de test) : ancien mode ; ?relay=wss://a,wss://b : relais à utiliser.
    // Tous les téléphones d'une salle doivent utiliser le même transport (ils ne se voient pas sinon).
    transport() {
      const m = /[?&]net=(relay|relais|peer|peerjs)\b/.exec(location.search);
      if (m) return /^rela/.test(m[1]) ? "relay" : "peer";
      if (/[?&]peer=/.test(location.search)) return "peer";
      return relayOk() || typeof window.Peer !== "function" ? "relay" : "peer";
    },
    relays: () => relaysFromUrl() || RELAYS.slice(0, ACTIVE),
    // une version plus récente du protocole a été vue dans la salle : fn(version)
    onNewer(fn) { newerLs.add(fn); if (newerSeen) setTimeout(() => fn(newerSeen), 0); return () => newerLs.delete(fn); },
    async connectP2P(code) {
      const key = await claimKey();
      if (G.net.transport() === "relay") {
        if (!relayOk()) return {mock: false, offline: true, reason: "relay-unsupported", lobby: null, myPeer: () => null, join: async () => { throw new Error("offline"); }, leave: async () => {}};
        const custom = relaysFromUrl(), net = await relayRoom(code, custom || RELAYS, key);
        // téléphones restés sur l'ancienne version (PeerJS) dans cette salle ? (?oldpeer=hôte:port : serveur PeerJS de test)
        const old = serverFromUrl("oldpeer");
        net.probeLegacy = () => (!custom || old ? probeLegacy(code, old) : Promise.resolve(null)).then(v => { net.setLegacy(v); return v; });
        setTimeout(net.probeLegacy, 2500);
        // seul dans la salle (ou ancien téléphone déjà signalé) : on revérifie de temps en temps
        setInterval(() => { const st = net.status(); if (!document.hidden && (st.peers === 0 || st.legacy)) net.probeLegacy(); }, 45000);
        return net;
      }
      const net = await p2pRoom(code, serverFromUrl(), key);
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
