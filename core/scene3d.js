/* Gonflette Party : scène 3D du lobby (three.js r128, global window.THREE).
   GONFLETTE.scene3d.supported -> WebGL + THREE disponibles.
   const s = GONFLETTE.scene3d.create(el, {theme, tiles, onFloorClick});
   s.setTheme / setTiles / setTileState / setEntities / ping / resize / destroy.
   Tout est construit à partir de primitives et de textures dessinées sur canvas : aucun chargement réseau. */
(function () {
  "use strict";
  const G = (window.GONFLETTE = window.GONFLETTE || {});
  const THREE = window.THREE;

  function webglOK() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return false;
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }
  const supported = !!(THREE && THREE.WebGLRenderer && webglOK());

  // ---------- constantes ----------
  const FONT_D = '"Anton", Impact, "Arial Narrow Bold", sans-serif';
  const FONT_UI = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  const FONT_S = '"Pacifico", "Brush Script MT", cursive';
  const VB = {x: -45, y: -12, w: 290, h: 280};      // viewBox de avatar.svg
  const TEX = 512, KPX = TEX / VB.w, DRAWN_H = VB.h * KPX, OFFY = TEX - DRAWN_H;
  const FOOT_Y = 258;                                // semelles dans le SVG
  const FOOT_FRAC = (TEX - (OFFY + (FOOT_Y - VB.y) * KPX)) / TEX;
  const SKINNY_SPAN = 241;                           // hauteur (unités SVG) d'un perso maigre : cheveux -> pieds
  const ME_GOLD = "#ffcc33";
  const TILE_T = 0.08;                               // épaisseur des tapis

  // ---------- utilitaires ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shade(hex, k) {
    const c = new THREE.Color(hex);
    if (k < 1) c.multiplyScalar(k); else c.lerp(new THREE.Color(1, 1, 1), k - 1);
    return "#" + c.getHexString();
  }
  function fitFont(ctx, text, family, weight, size, maxW, min) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (s > (min || 8) && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
    return s;
  }
  function disposeTree(obj) {
    obj.traverse(o => {
      if (o.isLight && o.dispose) o.dispose();             // libère la shadow map
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose(); }
      }
    });
  }

  function create(container, opts) {
    if (!supported) throw new Error("scene3d: WebGL/three.js indisponible");
    opts = opts || {};
    const mq = q => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
    const reduced = mq("(prefers-reduced-motion: reduce)");
    const coarse = mq("(pointer: coarse)");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lowPower = opts.lowPower != null ? !!opts.lowPower : (coarse && (navigator.hardwareConcurrency || 4) <= 4);
    const CHAR_H = opts.charHeight || 1.8;
    const SU = CHAR_H / SKINNY_SPAN;                 // unités monde par unité SVG
    const CHAR_SIZE = VB.w * SU;                     // côté du plan carré du sprite

    const renderer = new THREE.WebGLRenderer({antialias: dpr < 1.5, alpha: false, powerPreference: "high-performance"});
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = opts.shadows != null ? !!opts.shadows : !lowPower;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const cvs = renderer.domElement;
    cvs.style.cssText = "display:block;width:100%;height:100%;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;cursor:pointer";
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    container.appendChild(cvs);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 300);
    const world = new THREE.Group(), tilesG = new THREE.Group(), entG = new THREE.Group(), fxG = new THREE.Group();
    scene.add(world, tilesG, entG, fxG);

    let W = 16, D = 11, portrait = false, vpW = 0, vpH = 0;
    let themeName = opts.theme === "salle" ? "salle" : "plage";
    let theme = null;                                // objet du décor courant
    let tilesData = (opts.tiles || []).slice();
    const tileState = new Map();
    let tileObjs = [];
    const ents = new Map();
    const pings = [];
    const cam = {elev: 0.75, fov: 36, target: new THREE.Vector3(), dist: 20, az: 0};
    const tmpV = new THREE.Vector3();
    let destroyed = false;

    const wx = nx => (nx - 0.5) * W, wz = ny => (ny - 0.5) * D;

    // ---------- textures partagées ----------
    function canvasTex(c, {repeat, mip = true} = {}) {
      const t = new THREE.CanvasTexture(c);
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
      t.anisotropy = maxAniso;
      return t;
    }
    const blobTex = (() => {
      const c = mkCanvas(128, 128), x = c.getContext("2d");
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(.55, "rgba(0,0,0,.32)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return canvasTex(c);
    })();
    const shared = {
      plane: new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
      flat: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      ring: new THREE.RingGeometry(0.62, 0.8, 40).rotateX(-Math.PI / 2),
      meRing: new THREE.RingGeometry(0.8, 0.92, 40).rotateX(-Math.PI / 2),
    };

    // ---------- caméra ----------
    function placeCamera(az) {
      const e = cam.elev, t = cam.target;
      camera.position.set(t.x + cam.dist * Math.cos(e) * Math.sin(az), t.y + cam.dist * Math.sin(e), t.z + cam.dist * Math.cos(e) * Math.cos(az));
      camera.lookAt(t);
      camera.updateMatrixWorld();
    }
    function bounds(pts) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) {
        tmpV.copy(p).project(camera);
        x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y);
      }
      return {x0, x1, y0, y1};
    }
    function fitCamera() {
      const aspect = vpW / vpH;
      camera.aspect = aspect;
      cam.fov = aspect < 1 ? 40 : 34;
      cam.elev = (aspect < 1 ? 50 : 44) * Math.PI / 180;
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      const pts = [
        new THREE.Vector3(-W / 2 - .2, 0, D / 2 + .55), new THREE.Vector3(W / 2 + .2, 0, D / 2 + .55),
        new THREE.Vector3(-W / 2 - .2, 0, -D / 2), new THREE.Vector3(W / 2 + .2, 0, -D / 2),
        new THREE.Vector3(-W / 2, 2.6, -D / 2), new THREE.Vector3(W / 2, 2.6, -D / 2),
      ].concat(theme && theme.fitPoints ? theme.fitPoints() : []);
      const mx = 0.985, my = 0.97;
      cam.target.set(0, 0, 0);
      for (let it = 0; it < 5; it++) {
        let lo = 4, hi = 150;
        for (let k = 0; k < 28; k++) {
          cam.dist = (lo + hi) / 2; placeCamera(0);
          const b = bounds(pts);
          if (Math.max(-b.x0, b.x1) <= mx && b.y1 - b.y0 <= 2 * my) hi = cam.dist; else lo = cam.dist;
        }
        cam.dist = hi; placeCamera(0);
        const b = bounds(pts), c = (b.y0 + b.y1) / 2;
        // remonte/descend la cible pour centrer verticalement le contenu
        cam.target.z -= c * cam.dist * Math.tan(cam.fov * Math.PI / 360) / Math.sin(cam.elev);
      }
      placeCamera(0);
      if (theme && theme.onFit) theme.onFit();
    }
    // point du plan (normal n passant par p) touché par le rayon caméra en NDC (x,y)
    const ray = new THREE.Raycaster();
    function hitPlane(nx, ny, plane) {
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out : null;
    }

    // ---------- lumières / helpers de décor ----------
    function lam(color, extra) { return new THREE.MeshLambertMaterial(Object.assign({color}, extra || {})); }
    function phong(color, extra) { return new THREE.MeshPhongMaterial(Object.assign({color, shininess: 60}, extra || {})); }
    function mesh(parent, geo, mat, x, y, z, o) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      if (o) {
        if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
        if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]);
        if (o.cast) m.castShadow = true; if (o.recv) m.receiveShadow = true;
      }
      parent.add(m);
      return m;
    }
    function setupLights(group, {sky, ground, hemiI, sunColor, sunI, sunPos, ambient}) {
      const hemi = new THREE.HemisphereLight(sky, ground, hemiI);
      group.add(hemi);
      if (ambient) group.add(new THREE.AmbientLight(ambient[0], ambient[1]));
      const sun = new THREE.DirectionalLight(sunColor, sunI);
      sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
      sun.target.position.set(0, 0, -1);
      group.add(sun, sun.target);
      if (renderer.shadowMap.enabled) {
        sun.castShadow = true;
        const ms = lowPower || coarse ? 1024 : 2048;
        sun.shadow.mapSize.set(ms, ms);
        const r = Math.max(W, D) / 2 + 7;
        Object.assign(sun.shadow.camera, {left: -r, right: r, top: r, bottom: -r, near: 1, far: 80});
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.02;
        sun.shadow.radius = 3;
      }
      return {hemi, sun};
    }
    function stripes(geo, colors, n) {
      // colore une géométrie (non indexée) en quartiers selon l'angle autour de Y
      const g = geo.index ? geo.toNonIndexed() : geo;
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i += 3) {
        const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const a = (Math.atan2(cz, cx) + Math.PI * 2) % (Math.PI * 2);
        c.set(colors[Math.floor(a / (Math.PI * 2) * n) % colors.length]);
        for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    }

    // ---------- regroupement des maillages statiques (moins d'appels de dessin) ----------
    // userData.keep : ne pas toucher (objet animé / repositionné) ; userData.dyn : groupe mobile, on fusionne à l'intérieur.
    function batchStatic(top) {
      const dropped = new Set(), mtx = new THREE.Matrix4();
      (function batch(root) {
        root.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map(), subs = [];
        (function walk(o) {
          for (const c of o.children) {
            if (c.userData.keep) continue;
            if (c.userData.dyn) { subs.push(c); continue; }
            const m = c.material;
            if (c.isMesh && !c.isInstancedMesh && m && !Array.isArray(m) && !m.transparent && !c.children.length) {
              const key = [m.type, m.color.getHex(), m.map ? m.map.uuid : 0, m.vertexColors, m.side, m.shininess || 0, m.specular ? m.specular.getHex() : 0, m.emissive ? m.emissive.getHex() : 0, c.castShadow, c.receiveShadow].join("|");
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key).push(c);
            }
            if (c.children.length) walk(c);
          }
        })(root);
        for (const list of buckets.values()) {
          if (list.length < 2) continue;
          const mat = list[0].material, useCol = !!mat.vertexColors, useUv = !!mat.map;
          const parts = list.map(o => {
            const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            g.applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld));
            if (!g.attributes.normal) g.computeVertexNormals();
            return g;
          });
          const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = useUv ? new Float32Array(n * 2) : null, col = useCol ? new Float32Array(n * 3).fill(1) : null;
          let off = 0;
          for (const g of parts) {
            const c = g.attributes.position.count;
            pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
            if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
            if (col && g.attributes.color) col.set(g.attributes.color.array, off * 3);
            off += c; g.dispose();
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
          if (uv) geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
          if (col) geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
          const mm = new THREE.Mesh(geo, mat);
          mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
          root.add(mm);
          for (const o of list) { o.parent.remove(o); dropped.add(o.geometry); if (o.material !== mat) dropped.add(o.material); }
        }
        for (const c of subs) batch(c);
      })(top);
      const used = new Set();
      top.traverse(o => { if (o.geometry) used.add(o.geometry); if (o.material) used.add(o.material); });
      for (const x of dropped) if (!used.has(x)) x.dispose();
    }

    // ================= THÈME PLAGE : Muscle Beach 1975 =================
    function buildPlage() {
      const g = new THREE.Group(), R = rng(1975), anim = [];
      const shoreZ = -D / 2 - 3.2, skyZ = shoreZ - 5.5;
      scene.background = new THREE.Color("#ff9a52");
      scene.fog = new THREE.Fog("#ffb27a", 40, 90);
      const L = setupLights(g, {sky: "#ffe2bf", ground: "#c98a55", hemiI: .78, sunColor: "#ffbe7d", sunI: .85, sunPos: [9, 11, -13], ambient: ["#ffcfa0", .12]});

      // sable
      const sc = mkCanvas(256, 256), sx = sc.getContext("2d");
      sx.fillStyle = "#efcd8f"; sx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        const v = R();
        sx.fillStyle = v < .45 ? "rgba(176,128,62,.35)" : v < .85 ? "rgba(255,246,214,.55)" : "rgba(150,100,50,.45)";
        const r = .6 + R() * 1.3; sx.beginPath(); sx.arc(R() * 256, R() * 256, r, 0, 7); sx.fill();
      }
      for (let i = 0; i < 9; i++) { // ondulations du vent
        sx.strokeStyle = "rgba(190,140,70,.18)"; sx.lineWidth = 3; sx.beginPath();
        const y = R() * 256; sx.moveTo(0, y); for (let x = 0; x <= 256; x += 16) sx.lineTo(x, y + Math.sin(x / 40 + i) * 6); sx.stroke();
      }
      const sandW = W + 70, sandFront = D / 2 + 25, sandD = sandFront - shoreZ;
      const sand = mesh(g, new THREE.PlaneGeometry(sandW, sandD).rotateX(-Math.PI / 2), lam("#ffffff", {map: canvasTex(sc, {repeat: [sandW / 3.2, sandD / 3.2]})}), 0, 0, shoreZ + sandD / 2, {recv: true});
      sand.renderOrder = -10;
      // sable mouillé près du bord
      const wetC = mkCanvas(4, 64), wx2 = wetC.getContext("2d"), wg = wx2.createLinearGradient(0, 0, 0, 64);
      wg.addColorStop(0, "rgba(150,105,60,.55)"); wg.addColorStop(1, "rgba(150,105,60,0)"); wx2.fillStyle = wg; wx2.fillRect(0, 0, 4, 64);
      mesh(g, new THREE.PlaneGeometry(sandW, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: canvasTex(wetC, {mip: false}), transparent: true, depthWrite: false}), 0, 0.005, shoreZ + 0.8);

      // mer
      const seaD = shoreZ - skyZ + 3, segX = lowPower ? 36 : 56, segZ = 10;
      const seaGeo = new THREE.PlaneGeometry(sandW, seaD, segX, segZ).rotateX(-Math.PI / 2);
      const sp = seaGeo.attributes.position, base = Float32Array.from(sp.array), sCol = new Float32Array(sp.count * 3), c1 = new THREE.Color("#3fc1c9"), c2 = new THREE.Color("#1d5f8f"), cc = new THREE.Color();
      for (let i = 0; i < sp.count; i++) { const t = (sp.getZ(i) + seaD / 2) / seaD; cc.copy(c2).lerp(c1, Math.pow(t, 1.5)); sCol.set([cc.r, cc.g, cc.b], i * 3); }
      seaGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
      const sea = mesh(g, seaGeo, new THREE.MeshPhongMaterial({vertexColors: true, flatShading: true, shininess: 70, specular: "#6a4630"}), 0, -0.12, shoreZ - seaD / 2 + 0.6);
      sea.userData.keep = true;
      anim.push((t) => {
        for (let i = 0; i < sp.count; i++) {
          const x = base[i * 3], z = base[i * 3 + 2];
          sp.array[i * 3 + 1] = Math.sin(x * .55 + t * 1.3 + z * .4) * .07 + Math.sin(x * 1.3 - t * 1.9 + z * 1.7) * .04 + Math.sin(z * 2.2 + t * 2.2) * .03;
        }
        sp.needsUpdate = true;
      });
      // écume
      const fc = mkCanvas(256, 32), fx = fc.getContext("2d");
      fx.fillStyle = "#fff"; fx.beginPath(); fx.moveTo(0, 32);
      for (let x = 0; x <= 256; x += 8) fx.lineTo(x, 14 + Math.sin(x / 256 * Math.PI * 6) * 6 + Math.sin(x / 256 * Math.PI * 14) * 3);
      fx.lineTo(256, 32); fx.closePath(); fx.fill();
      fx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 60; i++) { fx.beginPath(); fx.arc(R() * 256, 18 + R() * 14, 1 + R() * 2.5, 0, 7); fx.fill(); }
      const foamTex = canvasTex(fc, {repeat: [sandW / 6, 1]});
      const foam = mesh(g, new THREE.PlaneGeometry(sandW, .55).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: foamTex, transparent: true, opacity: .9, depthWrite: false}), 0, .02, shoreZ - .1);
      anim.push((t) => { const k = Math.sin(t * .9); foam.position.z = shoreZ - .15 + k * .22; foam.material.opacity = .65 + .3 * (k * .5 + .5); foamTex.offset.x = t * .01; });

      // ciel (toile peinte inclinée face caméra, comme un fond de diorama)
      const sky = new THREE.Group(); sky.position.set(0, -.2, skyZ); sky.userData.keep = true; g.add(sky);
      const skyC = mkCanvas(8, 512), skx = skyC.getContext("2d"), sg = skx.createLinearGradient(0, 512, 0, 0);
      sg.addColorStop(0, "#ffe7a3"); sg.addColorStop(.12, "#ffc56b"); sg.addColorStop(.3, "#ff8a3d"); sg.addColorStop(.55, "#e0527a"); sg.addColorStop(.8, "#7a2f78"); sg.addColorStop(1, "#3a2163");
      skx.fillStyle = sg; skx.fillRect(0, 0, 8, 512);
      const skyMat = new THREE.MeshBasicMaterial({map: canvasTex(skyC, {mip: false}), fog: false, depthWrite: false});
      const skyPlane = mesh(sky, shared.plane.clone(), skyMat, 0, 0, 0, {s: [sandW + 40, 14, 1]});
      skyPlane.renderOrder = -20;
      // soleil rétro rayé
      const sunC = mkCanvas(512, 512), su = sunC.getContext("2d");
      const sgr = su.createLinearGradient(0, 30, 0, 482); sgr.addColorStop(0, "#fff3a8"); sgr.addColorStop(.5, "#ffd166"); sgr.addColorStop(1, "#ff7b54");
      su.fillStyle = sgr; su.beginPath(); su.arc(256, 256, 226, 0, 7); su.fill();
      su.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 7; i++) { const y = 290 + i * 30, h = 6 + i * 3.2; su.fillRect(0, y, 512, h); }
      const sunMat = new THREE.MeshBasicMaterial({map: canvasTex(sunC), transparent: true, fog: false, depthWrite: false});
      const sunM = mesh(sky, new THREE.PlaneGeometry(1, 1), sunMat, 0, 0, .05);
      sunM.renderOrder = -18;
      const haloC = mkCanvas(256, 256), hx = haloC.getContext("2d"), hg = hx.createRadialGradient(128, 128, 20, 128, 128, 128);
      hg.addColorStop(0, "rgba(255,230,150,.75)"); hg.addColorStop(.45, "rgba(255,180,100,.25)"); hg.addColorStop(1, "rgba(255,150,90,0)");
      hx.fillStyle = hg; hx.fillRect(0, 0, 256, 256);
      const halo = mesh(sky, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: canvasTex(haloC), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending}), 0, 0, .03);
      halo.renderOrder = -19;
      // îles et nuages : silhouettes plates
      const isl = (w, h, col, seed) => {
        const r2 = rng(seed), s = new THREE.Shape(); s.moveTo(-w / 2, 0);
        const n = 7; for (let i = 1; i < n; i++) s.lineTo(-w / 2 + w * i / n, h * Math.sin(Math.PI * i / n) * (.65 + r2() * .5));
        s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
        const m = mesh(sky, new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({color: col, fog: false, depthWrite: false}), 0, 0, .08);
        m.renderOrder = -17; return m;
      };
      const islands = [isl(9, 1.3, "#7a3a72", 3), isl(6, .8, "#8f4a7a", 8), isl(14, .9, "#9a557c", 11)];
      const clouds = [];
      for (let i = 0; i < 4; i++) {
        const cl = new THREE.Shape(), w = 2.5 + R() * 3;
        cl.absellipse(0, 0, w / 2, .16 + R() * .12, 0, Math.PI * 2, false, 0);
        const m = mesh(sky, new THREE.ShapeGeometry(cl, 24), new THREE.MeshBasicMaterial({color: i % 2 ? "#ffb08a" : "#ff9a8a", fog: false, transparent: true, opacity: .8, depthWrite: false}), 0, 0, .06);
        m.renderOrder = -17; clouds.push({m, sp: .05 + R() * .08, ph: R() * 40});
      }
      anim.push((t) => {
        halo.material.opacity = .85 + .15 * Math.sin(t * .8);
        for (const c of clouds) c.m.position.x = ((c.ph + t * c.sp) % 40) - 20;
      });

      // palmiers
      const trunkMats = [lam("#8a5a34"), lam("#a8744a")], leafMats = [lam("#2f8f4e", {side: THREE.DoubleSide}), lam("#3fae5a", {side: THREE.DoubleSide})], coco = lam("#5a3a1e");
      const leafGeo = (() => {
        const N = 9, Lf = 2.3, pos = [], idx = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, x = t * Lf, y = .55 * t - 1.35 * t * t, hw = .42 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .8) + .02, mid = .1 * Math.sin(Math.PI * t);
          pos.push(x, y - mid * .2, -hw, x, y + mid, 0, x, y - mid * .2, hw);
          if (i < N) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
      })();
      const segGeo = new THREE.CylinderGeometry(.13, .17, .55, 7);
      const palms = [];
      function palm(x, z, h, lean, rot) {
        const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = rot; g.add(p);
        let px = 0, py = 0, ang = 0; const n = Math.round(h / .5);
        for (let i = 0; i < n; i++) {
          ang = lean * (i / n) * (i / n);
          const s = mesh(p, segGeo, trunkMats[i % 2], px, py + .25, 0, {rz: -ang, cast: true});
          s.scale.setScalar(1 - i / n * .3);
          px += Math.sin(ang) * .5; py += Math.cos(ang) * .5;
        }
        const crown = new THREE.Group(); crown.position.set(px, py, 0); crown.userData.dyn = true; p.add(crown);
        for (let i = 0; i < 8; i++) {
          const lf = mesh(crown, leafGeo, leafMats[i % 2], 0, 0, 0, {cast: true});
          lf.rotation.set(0, i / 8 * Math.PI * 2 + R() * .3, -.15 + R() * .3, "YZX");
          lf.scale.setScalar(.85 + R() * .3);
        }
        for (let i = 0; i < 3; i++) mesh(crown, new THREE.SphereGeometry(.13, 8, 6), coco, Math.cos(i * 2.1) * .16, -.12, Math.sin(i * 2.1) * .16);
        palms.push({crown, ph: R() * 6});
      }
      palm(-W / 2 - .6, -D / 2 - 1.6, 4.6, .55, .2);
      palm(-W / 2 - 2.4, -D / 2 + .8, 3.6, -.45, 2.8);
      palm(W / 2 + .9, -D / 2 - 2.1, 5.2, -.5, -.3);
      palm(W / 2 + 2.6, D / 2 - 2, 3.4, .5, 3.3);
      anim.push((t) => { for (const p of palms) { p.crown.rotation.z = Math.sin(t * .7 + p.ph) * .05; p.crown.rotation.x = Math.sin(t * .5 + p.ph) * .04; } });

      // agrès d'extérieur : barres de traction + anneaux
      const rig = new THREE.Group(); rig.position.set(-W / 2 + 2.6, 0, -D / 2 - 1.5); g.add(rig);
      const post = lam("#2b8a8a"), chrome = phong("#e8edf2", {shininess: 110, specular: "#ffffff"}), rope = lam("#c9a46a");
      const postGeo = new THREE.CylinderGeometry(.07, .07, 2.7, 8);
      for (const x of [-1.6, 0, 1.6]) mesh(rig, postGeo, post, x, 1.35, 0, {cast: true});
      mesh(rig, new THREE.CylinderGeometry(.045, .045, 3.3, 8), chrome, 0, 2.62, 0, {rz: Math.PI / 2, cast: true});
      mesh(rig, new THREE.CylinderGeometry(.045, .045, 1.7, 8), chrome, .8, 1.6, 0, {rz: Math.PI / 2, cast: true});
      const rings = [];
      for (const x of [-1.05, -.55]) {
        const r = new THREE.Group(); r.position.set(x, 2.6, 0); r.userData.dyn = true; rig.add(r);
        mesh(r, new THREE.CylinderGeometry(.015, .015, 1.05, 4), rope, 0, -.52, 0);
        mesh(r, new THREE.TorusGeometry(.13, .028, 6, 16), lam("#7a4a22"), 0, -1.17, 0, {cast: true});
        rings.push(r);
      }
      anim.push((t) => { rings.forEach((r, i) => { r.rotation.z = Math.sin(t * 1.4 + i) * .08; r.rotation.x = Math.sin(t * 1.1 + i * 2) * .05; }); });
      // banc de musculation rétro
      mesh(rig, new THREE.BoxGeometry(.5, .12, 1.3), lam("#d94f2b"), -2.6, .5, .8, {cast: true});
      mesh(rig, new THREE.BoxGeometry(.08, .45, .08), post, -2.6, .22, .3, {cast: true});
      mesh(rig, new THREE.BoxGeometry(.08, .45, .08), post, -2.6, .22, 1.3, {cast: true});

      // tour de maître-nageur
      const tw = new THREE.Group(); tw.position.set(W / 2 - 2.3, 0, -D / 2 - 1.9); tw.rotation.y = -.25; g.add(tw);
      const wood = lam("#f3efe6"), red = lam("#e63946"), blue = lam("#2f6fb2");
      for (const [x, z] of [[-.7, -.6], [.7, -.6], [-.7, .6], [.7, .6]]) mesh(tw, new THREE.BoxGeometry(.12, 2.3, .12), wood, x, 1.15, z, {cast: true, rz: -x * .06, rx: z * .06});
      mesh(tw, new THREE.BoxGeometry(1.8, .12, 1.7), wood, 0, 2.3, 0, {cast: true});
      mesh(tw, new THREE.BoxGeometry(1.25, .9, 1.15), red, 0, 2.82, -.15, {cast: true});
      mesh(tw, new THREE.BoxGeometry(1.27, .18, 1.17), wood, 0, 2.86, -.15);
      mesh(tw, new THREE.PlaneGeometry(.7, .35), lam("#2b2340"), 0, 2.95, .43);
      const roof = mesh(tw, new THREE.ConeGeometry(1.15, .55, 4), blue, 0, 3.55, -.15, {ry: Math.PI / 4, cast: true});
      roof.scale.set(1, 1, .95);
      for (const x of [-.86, .86]) mesh(tw, new THREE.BoxGeometry(.05, .45, 1.6), wood, x, 2.55, .05);
      mesh(tw, new THREE.BoxGeometry(1.75, .05, .05), wood, 0, 2.75, .85);
      // échelle
      const lad = new THREE.Group(); lad.position.set(0, 0, 1.25); lad.rotation.x = -.42; tw.add(lad);
      for (const x of [-.28, .28]) mesh(lad, new THREE.BoxGeometry(.06, 2.5, .06), wood, x, 1.25, 0, {cast: true});
      for (let i = 0; i < 6; i++) mesh(lad, new THREE.BoxGeometry(.56, .05, .08), wood, 0, .3 + i * .38, 0);
      // drapeau
      mesh(tw, new THREE.CylinderGeometry(.025, .025, 1.3, 5), wood, .5, 4.3, -.15);
      const flagC = mkCanvas(64, 32), fl = flagC.getContext("2d"); fl.fillStyle = "#e63946"; fl.fillRect(0, 0, 64, 16); fl.fillStyle = "#ffd23f"; fl.fillRect(0, 16, 64, 16);
      const flag = mesh(tw, new THREE.PlaneGeometry(.6, .35, 6, 1).translate(.3, 0, 0), lam("#ffffff", {map: canvasTex(flagC), side: THREE.DoubleSide}), .52, 4.75, -.15);
      flag.userData.keep = true;
      const fpos = flag.geometry.attributes.position, fbase = Float32Array.from(fpos.array);
      anim.push((t) => { for (let i = 0; i < fpos.count; i++) { const x = fbase[i * 3]; fpos.array[i * 3 + 2] = Math.sin(x * 9 - t * 5) * .06 * x; } fpos.needsUpdate = true; });
      // bouée sur la tour
      mesh(tw, new THREE.TorusGeometry(.22, .07, 6, 14), lam("#ff6b35"), -.4, 2.55, .9, {cast: true});

      // panneau MUSCLE BEACH
      const sgC = mkCanvas(512, 160), sgx = sgC.getContext("2d");
      sgx.fillStyle = "#8a5a34"; rrect(sgx, 4, 4, 504, 152, 22); sgx.fill();
      for (let i = 0; i < 5; i++) { sgx.fillStyle = i % 2 ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.06)"; sgx.fillRect(4, 8 + i * 30, 504, 15); }
      sgx.lineWidth = 8; sgx.strokeStyle = "#5a3418"; rrect(sgx, 4, 4, 504, 152, 22); sgx.stroke();
      sgx.textAlign = "center"; sgx.textBaseline = "middle";
      fitFont(sgx, "Muscle Beach", FONT_S, "400", 76, 440);
      sgx.fillStyle = "#7a2a5a"; sgx.fillText("Muscle Beach", 262, 74);
      sgx.fillStyle = "#ffe7a3"; sgx.fillText("Muscle Beach", 256, 68);
      sgx.font = `700 26px ${FONT_UI}`; sgx.fillStyle = "#ffd23f"; sgx.fillText("— EST. 1975 —", 256, 132);
      const signG = new THREE.Group(); signG.position.set(.6, 0, -D / 2 - 1.1); g.add(signG);
      const signTex = canvasTex(sgC);
      mesh(signG, new THREE.PlaneGeometry(2.6, .81), lam("#ffffff", {map: signTex}), 0, 1.5, .06, {cast: true});
      mesh(signG, new THREE.BoxGeometry(2.6, .81, .1), lam("#5a3418"), 0, 1.5, 0, {cast: true});
      for (const x of [-1, 1]) mesh(signG, new THREE.BoxGeometry(.1, 1.2, .1), lam("#6b4226"), x, .6, -.02, {cast: true});

      // parasols
      function umbrella(x, z, cols, tilt, rot) {
        const u = new THREE.Group(); u.position.set(x, 0, z); u.rotation.set(tilt, rot, tilt * .6); g.add(u);
        mesh(u, new THREE.CylinderGeometry(.035, .035, 2.2, 6), lam("#f3efe6"), 0, 1.1, 0, {cast: true});
        const canopy = new THREE.Mesh(stripes(new THREE.ConeGeometry(1.25, .5, 12, 1, true), cols, 12), lam("#ffffff", {vertexColors: true, side: THREE.DoubleSide}));
        canopy.position.y = 2.15; canopy.castShadow = true; u.add(canopy);
        mesh(u, new THREE.SphereGeometry(.06, 6, 4), lam("#f3efe6"), 0, 2.42, 0);
      }
      umbrella(-W / 2 - 1.3, .4, ["#e63946", "#fff8e7"], .08, .3);
      umbrella(W / 2 + 1.2, -.6, ["#2a9d8f", "#fff8e7"], -.06, .9);
      umbrella(-W / 2 - 1.1, D / 2 + 1.6, ["#ffd23f", "#ff6b35"], .1, 0);
      // ballon de plage, planche de surf
      const ball = new THREE.Mesh(stripes(new THREE.SphereGeometry(.28, 12, 8), ["#e63946", "#fff8e7", "#3a86ff", "#fff8e7", "#ffd23f", "#fff8e7"], 6), lam("#ffffff", {vertexColors: true}));
      ball.position.set(W / 2 + .9, .28, D / 2 - .2); ball.castShadow = true; ball.userData.keep = true; g.add(ball);
      anim.push((t) => { ball.rotation.y = t * .3; });
      const board = mesh(g, new THREE.SphereGeometry(1, 16, 8), lam("#ff6b35"), -W / 2 - .5, 1.05, -D / 2 - .2, {s: [.32, 1.15, .06], rz: .12, ry: .5, cast: true});
      mesh(board, new THREE.SphereGeometry(1.01, 16, 8, 0, Math.PI * 2, 1.2, .5), lam("#fff8e7"), 0, 0, 0);
      // coquillages / petits cailloux
      for (let i = 0; i < 14; i++) {
        const x = (R() - .5) * (W + 6), z = D / 2 + .7 + R() * 3;
        mesh(g, new THREE.SphereGeometry(.08 + R() * .07, 5, 4), lam(R() < .5 ? "#fff1dc" : "#d9a27a"), x, .03, z, {s: [1, .5, 1]});
      }

      function onFit() {
        sky.rotation.x = -cam.elev;
        // hauteur visible de la toile (repère local) -> placer soleil, îles, nuages
        const n = new THREE.Vector3(0, Math.sin(cam.elev), Math.cos(cam.elev)), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, sky.position);
        const hit = hitPlane(0, 1, pl);
        let vis = 6, half = 10;
        if (hit) { sky.worldToLocal(hit); vis = clamp(hit.y, 1.2, 14); }
        const side = hitPlane(1, .5, pl); if (side) { sky.worldToLocal(side); half = Math.abs(side.x); }
        const r = clamp(vis * .3, .7, 2.6);
        sunM.scale.set(r * 2, r * 2, 1); sunM.position.set(half * .3, Math.min(vis * .52, vis - r * .9), .05);
        halo.scale.set(r * 5.5, r * 5.5, 1); halo.position.set(sunM.position.x, sunM.position.y, .03);
        islands[0].position.set(-half * .55, 0, .08); islands[1].position.set(-half * .2, 0, .09); islands[2].position.set(half * .75, 0, .08);
        const hs = clamp(vis / 6, .35, 1); islands.forEach(m => m.scale.set(1, hs, 1));
        clouds.forEach((c, i) => { c.m.position.y = vis * (.68 + .1 * (i % 2)) - i * .05; });
        skyPlane.scale.set(half * 2 + 20, Math.max(14, vis + 4), 1);
      }
      function fitPoints() {
        const up = new THREE.Vector3(0, Math.cos(cam.elev), -Math.sin(cam.elev));
        return [new THREE.Vector3(0, -.2, skyZ).addScaledVector(up, 3.2)];
      }
      batchStatic(g);
      return {group: g, gold: "#ffd23f", glow: "#ff5a1f", glowAdd: false, anim, onFit, fitPoints, lights: L, tileStyle: "towel"};
    }

    // ================= THÈME SALLE : salle de muscu =================
    function buildSalle() {
      const g = new THREE.Group(), R = rng(42), anim = [];
      const wallZ = -D / 2 - 2.7, sideX = W / 2 + 3.6, frontZ = D / 2 + 6;
      scene.background = new THREE.Color("#14181c");
      scene.fog = null;
      const L = setupLights(g, {sky: "#e3efff", ground: "#2b323a", hemiI: .72, sunColor: "#f1f6ff", sunI: .72, sunPos: [-4, 15, 7], ambient: ["#9fb8d8", .1]});

      // sol caoutchouc moucheté avec joints
      const fc = mkCanvas(256, 256), f = fc.getContext("2d");
      f.fillStyle = "#24282c"; f.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) {
        const v = R();
        f.fillStyle = v < .5 ? "rgba(255,255,255,.10)" : v < .8 ? "rgba(0,0,0,.35)" : v < .9 ? "rgba(90,140,200,.35)" : "rgba(220,220,220,.25)";
        f.fillRect(R() * 256, R() * 256, 1 + R() * 1.6, 1 + R() * 1.6);
      }
      f.strokeStyle = "rgba(0,0,0,.65)"; f.lineWidth = 4; f.strokeRect(0, 0, 256, 256);
      f.strokeStyle = "rgba(255,255,255,.05)"; f.lineWidth = 2; f.strokeRect(4, 4, 248, 248);
      const flW = sideX * 2 + 2, flD = frontZ - wallZ + 2;
      const fl = mesh(g, new THREE.PlaneGeometry(flW, flD).rotateX(-Math.PI / 2), lam("#ffffff", {map: canvasTex(fc, {repeat: [flW / 2, flD / 2]})}), 0, 0, wallZ + flD / 2 - 1, {recv: true});
      fl.renderOrder = -10;
      // bande de sécurité jaune/noire devant le mur
      const hz = mkCanvas(128, 16), hzx = hz.getContext("2d"); hzx.fillStyle = "#1a1a1a"; hzx.fillRect(0, 0, 128, 16); hzx.fillStyle = "#f5c518";
      for (let x = -16; x < 128; x += 32) { hzx.beginPath(); hzx.moveTo(x, 16); hzx.lineTo(x + 16, 0); hzx.lineTo(x + 32, 0); hzx.lineTo(x + 16, 16); hzx.fill(); }
      mesh(g, new THREE.PlaneGeometry(flW, .22).rotateX(-Math.PI / 2), lam("#ffffff", {map: canvasTex(hz, {repeat: [flW / 1.2, 1]})}), 0, .004, -D / 2 - .45, {recv: true});

      // murs (parpaings peints)
      const wc = mkCanvas(256, 256), w = wc.getContext("2d");
      w.fillStyle = "#3d4a57"; w.fillRect(0, 0, 256, 256);
      w.strokeStyle = "rgba(0,0,0,.28)"; w.lineWidth = 3;
      for (let r = 0; r < 4; r++) { w.beginPath(); w.moveTo(0, r * 64); w.lineTo(256, r * 64); w.stroke(); for (let c = 0; c < 2; c++) { const x = c * 128 + (r % 2) * 64; w.beginPath(); w.moveTo(x, r * 64); w.lineTo(x, r * 64 + 64); w.stroke(); } }
      for (let i = 0; i < 900; i++) { w.fillStyle = R() < .5 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.06)"; w.fillRect(R() * 256, R() * 256, 2, 2); }
      const wallH = 9;
      const wallMat = lam("#ffffff", {map: canvasTex(wc, {repeat: [flW / 2.4, wallH / 2.4]})});
      mesh(g, new THREE.PlaneGeometry(flW, wallH), wallMat, 0, wallH / 2, wallZ, {recv: true});
      const sideMat = lam("#ffffff", {map: canvasTex(wc, {repeat: [flD / 2.4, wallH / 2.4]})});
      mesh(g, new THREE.PlaneGeometry(flD, wallH), sideMat, -sideX, wallH / 2, wallZ + flD / 2, {ry: Math.PI / 2, recv: true});
      mesh(g, new THREE.PlaneGeometry(flD, wallH), sideMat, sideX, wallH / 2, wallZ + flD / 2, {ry: -Math.PI / 2, recv: true});
      // plinthe + bande colorée
      const stripeMat = lam("#ff2e88");
      mesh(g, new THREE.BoxGeometry(flW, .35, .06), lam("#1d2329"), 0, .175, wallZ + .03);
      mesh(g, new THREE.BoxGeometry(flW, .12, .04), stripeMat, 0, 1.2, wallZ + .02);
      for (const s of [-1, 1]) { mesh(g, new THREE.BoxGeometry(.06, .35, flD), lam("#1d2329"), s * (sideX - .03), .175, wallZ + flD / 2); mesh(g, new THREE.BoxGeometry(.04, .12, flD), stripeMat, s * (sideX - .02), 1.2, wallZ + flD / 2); }

      // miroir
      const mc = mkCanvas(512, 256), m = mc.getContext("2d");
      const mg = m.createLinearGradient(0, 0, 512, 256);
      mg.addColorStop(0, "#8ea7b8"); mg.addColorStop(.3, "#d5e5ee"); mg.addColorStop(.31, "#a3bccb"); mg.addColorStop(.55, "#c6d9e4"); mg.addColorStop(.56, "#93acbd"); mg.addColorStop(1, "#b9cfdc");
      m.fillStyle = mg; m.fillRect(0, 0, 512, 256);
      m.globalAlpha = .25; m.fillStyle = "#fff";
      m.beginPath(); m.moveTo(120, 0); m.lineTo(170, 0); m.lineTo(60, 256); m.lineTo(10, 256); m.fill();
      m.beginPath(); m.moveTo(330, 0); m.lineTo(350, 0); m.lineTo(240, 256); m.lineTo(220, 256); m.fill();
      m.globalAlpha = 1;
      const mirTex = canvasTex(mc);
      const mirror = new THREE.Group(); mirror.userData.keep = true; g.add(mirror);
      const mirMat = new THREE.MeshPhongMaterial({map: mirTex, color: "#ffffff", shininess: 140, specular: "#ffffff", emissive: "#3a4a55", emissiveIntensity: .35});
      const mirPane = mesh(mirror, new THREE.PlaneGeometry(1, 1), mirMat, 0, 0, .03);
      const frameMat = phong("#9aa3ab", {shininess: 90});
      const frames = [0, 1, 2, 3].map(() => mesh(mirror, new THREE.BoxGeometry(1, 1, .08), frameMat, 0, 0, .02));
      anim.push((t) => { mirTex.offset.x = Math.sin(t * .15) * .03; });

      // néon NO PAIN NO GAIN
      const nc = mkCanvas(1024, 256), n = nc.getContext("2d");
      n.textAlign = "center"; n.textBaseline = "middle";
      const fs = fitFont(n, "No Pain No Gain", FONT_S, "400", 132, 880);
      n.font = `400 ${fs}px ${FONT_S}`;
      n.save(); n.translate(512, 124); n.rotate(-.04);
      n.shadowColor = "#ff2e88"; n.lineJoin = "round";
      for (const [b, a] of [[40, .9], [22, 1], [10, 1]]) { n.shadowBlur = b; n.strokeStyle = `rgba(255,46,136,${a})`; n.lineWidth = 10; n.strokeText("No Pain No Gain", 0, 0); }
      n.shadowBlur = 8; n.shadowColor = "#ff8fc1"; n.fillStyle = "#ffe3f0"; n.fillText("No Pain No Gain", 0, 0);
      n.restore();
      const neonMat = new THREE.MeshBasicMaterial({map: canvasTex(nc), transparent: true, depthWrite: false});
      const neon = mesh(g, new THREE.PlaneGeometry(1, .25), neonMat, 0, 0, wallZ + .12);
      neon.renderOrder = 2;
      // boîtier du néon
      const neonBack = mesh(g, new THREE.BoxGeometry(1, .25, .05), lam("#1a1d22"), 0, 0, wallZ + .05);
      neonBack.scale.set(.92, .8, 1); neonBack.userData.keep = true;
      const glowC = mkCanvas(128, 64), gx = glowC.getContext("2d"), gg = gx.createRadialGradient(64, 32, 4, 64, 32, 64);
      gg.addColorStop(0, "rgba(255,46,136,.5)"); gg.addColorStop(1, "rgba(255,46,136,0)"); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 64);
      const wallGlow = mesh(g, new THREE.PlaneGeometry(1, .5), new THREE.MeshBasicMaterial({map: canvasTex(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}), 0, 0, wallZ + .04);
      const pink = new THREE.PointLight("#ff2e88", lowPower ? 0 : .7, 9, 2);
      g.add(pink);
      let flick = 1, nextF = 2;
      anim.push((t, dt) => {
        nextF -= dt;
        if (nextF < 0) { flick = R() < .5 ? .25 : .55; if (nextF < -.08 - R() * .12) { flick = 1; nextF = 1.5 + R() * 4; } }
        const o = flick * (.94 + .06 * Math.sin(t * 40));
        neonMat.opacity = o; wallGlow.material.opacity = o; pink.intensity = (lowPower ? 0 : .7) * o;
      });

      // matériaux du matos
      const black = lam("#1b1e22"), steel = phong("#cfd6dd", {shininess: 120, specular: "#ffffff"}), rackMat = lam("#2a2f35"), redM = lam("#d62839"), blueM = lam("#2f6fdc"), yel = lam("#f5c518"), grn = lam("#2bb673");

      // rack d'haltères (InstancedMesh)
      const rack = new THREE.Group(); rack.position.set(-1.2, 0, -D / 2 - 1.2); g.add(rack);
      const rW = Math.min(4.6, W * .3);
      for (const [y, z] of [[.55, .2], [1.0, -.2]]) {
        mesh(rack, new THREE.BoxGeometry(rW, .07, .5), rackMat, 0, y, z, {cast: true, rx: -.18});
      }
      for (const x of [-rW / 2, rW / 2]) { mesh(rack, new THREE.BoxGeometry(.08, 1.1, .08), rackMat, x, .55, .35, {cast: true}); mesh(rack, new THREE.BoxGeometry(.08, 1.1, .08), rackMat, x, .55, -.4, {cast: true}); }
      const nDb = 7, heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .12, .14, 6), black, nDb * 2 * 4), handles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.03, .03, .34, 6), steel, nDb * 2);
      heads.castShadow = handles.castShadow = true;
      const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
      let hi = 0, hn = 0;
      [[.62, .2], [1.07, -.2]].forEach(([y, z], row) => {
        for (let i = 0; i < nDb; i++) {
          const k = .75 + (i + row * nDb) / (nDb * 2) * .8, x = -rW / 2 + .35 + i * (rW - .7) / (nDb - 1);
          E.set(0, Math.PI / 2, Math.PI / 2); Q.setFromEuler(E);
          for (const d of [-1, 1]) { P.set(x, y + .1 * k, z + d * (.15 + .07 * k)); S.set(k, k, k); M4.compose(P, Q, S); heads.setMatrixAt(hi++, M4); }
          P.set(x, y + .1 * k, z); S.set(1, 1, 1); M4.compose(P, Q, S); handles.setMatrixAt(hn++, M4);
          // seconde rangée de têtes plus fine (anneau chromé)
          for (const d of [-1, 1]) { P.set(x, y + .1 * k, z + d * (.24 + .1 * k)); S.set(k * .5, .25, k * .5); M4.compose(P, Q, S); heads.setMatrixAt(hi++, M4); }
        }
      });
      heads.count = hi; handles.count = hn;
      rack.add(heads, handles);

      // barre + disques
      function barbell(parent, x, y, z, len, plates) {
        const b = new THREE.Group(); b.position.set(x, y, z); parent.add(b);
        mesh(b, new THREE.CylinderGeometry(.035, .035, len, 8), steel, 0, 0, 0, {rz: Math.PI / 2, cast: true});
        for (const d of [-1, 1]) {
          let off = len / 2 - .45;
          for (const [r, th, mat] of plates) { mesh(b, new THREE.CylinderGeometry(r, r, th, 18), mat, d * (off + th / 2), 0, 0, {rz: Math.PI / 2, cast: true}); off += th + .01; }
          mesh(b, new THREE.CylinderGeometry(.06, .06, .08, 8), steel, d * (off + .04), 0, 0, {rz: Math.PI / 2});
        }
        return b;
      }
      // développé couché
      const bench = new THREE.Group(); bench.position.set(W / 2 - 2.4, 0, -D / 2 - 1.3); bench.rotation.y = -.12; g.add(bench);
      mesh(bench, new THREE.BoxGeometry(.55, .16, 1.7), redM, 0, .55, .25, {cast: true});
      mesh(bench, new THREE.BoxGeometry(.6, .06, 1.75), black, 0, .45, .25);
      for (const z of [-.45, .95]) mesh(bench, new THREE.BoxGeometry(.5, .45, .08), rackMat, 0, .22, z, {cast: true});
      for (const x of [-.55, .55]) { mesh(bench, new THREE.BoxGeometry(.08, 1.35, .08), rackMat, x, .67, -.45, {cast: true}); mesh(bench, new THREE.BoxGeometry(.1, .05, .2), steel, x, 1.2, -.38); }
      barbell(bench, 0, 1.27, -.36, 2.7, [[.42, .1, redM], [.36, .08, blueM], [.27, .06, yel]]);
      // squat rack
      const sq = new THREE.Group(); sq.position.set(-W / 2 + 1.6, 0, -D / 2 - 1.5); g.add(sq);
      for (const x of [-.8, .8]) for (const z of [-.45, .45]) mesh(sq, new THREE.BoxGeometry(.1, 2.7, .1), rackMat, x, 1.35, z, {cast: true});
      for (const z of [-.45, .45]) mesh(sq, new THREE.BoxGeometry(1.7, .1, .1), rackMat, 0, 2.65, z, {cast: true});
      for (const x of [-.8, .8]) { mesh(sq, new THREE.BoxGeometry(.1, .1, 1), rackMat, x, 2.65, 0, {cast: true}); mesh(sq, new THREE.BoxGeometry(.1, .1, 1), rackMat, x, .1, 0); mesh(sq, new THREE.BoxGeometry(.06, .06, .5), yel, x, .9, .7); }
      barbell(sq, 0, 1.5, .5, 2.6, [[.45, .12, grn], [.42, .1, redM], [.36, .08, blueM]]);
      // arbre à disques
      const tree = new THREE.Group(); tree.position.set(-W / 2 - 1.1, 0, -D / 2 - .4); g.add(tree);
      mesh(tree, new THREE.CylinderGeometry(.05, .05, 1.4, 6), rackMat, 0, .7, 0, {cast: true});
      mesh(tree, new THREE.CylinderGeometry(.4, .45, .06, 10), rackMat, 0, .03, 0);
      [[.45, redM, .35], [.42, blueM, .8], [.36, yel, 1.15]].forEach(([r, mat, y], i) => mesh(tree, new THREE.CylinderGeometry(r, r, .1, 18), mat, (i % 2 ? .12 : -.12), y, 0, {rz: Math.PI / 2, cast: true}));

      // kettlebells
      const kbCols = [lam("#2bb673"), lam("#f5c518"), lam("#3a86ff"), lam("#e63946"), lam("#8338ec")];
      const kbBody = new THREE.SphereGeometry(.22, 12, 8), kbHandle = new THREE.TorusGeometry(.13, .035, 6, 12, Math.PI);
      for (let i = 0; i < 5; i++) {
        const kb = new THREE.Group(), s = .7 + i * .12; kb.position.set(-W / 2 - .9 + (i % 2) * .5, 0, -.6 + i * .75); kb.scale.setScalar(s); kb.rotation.y = R() * 3; g.add(kb);
        mesh(kb, kbBody, kbCols[i], 0, .22, 0, {s: [1, .95, 1], cast: true});
        mesh(kb, kbHandle, black, 0, .38, 0, {cast: true});
      }
      // sac de frappe
      const bagPivot = new THREE.Group(); bagPivot.position.set(W / 2 + 1.5, 4.8, .4); bagPivot.userData.dyn = true; g.add(bagPivot);
      mesh(bagPivot, new THREE.CylinderGeometry(.015, .015, 2.2, 4), steel, 0, -1.1, 0);
      const bag = mesh(bagPivot, new THREE.CylinderGeometry(.34, .32, 1.55, 14), phong("#b3202f", {shininess: 40}), 0, -3.0, 0, {cast: true});
      bag.userData.keep = true;
      mesh(bag, new THREE.CylinderGeometry(.345, .345, .12, 14), black, 0, .55, 0);
      mesh(bag, new THREE.CylinderGeometry(.345, .345, .12, 14), black, 0, -.55, 0);
      mesh(bagPivot, new THREE.ConeGeometry(.33, .3, 14, 1, true), black, 0, -2.08, 0, {rx: Math.PI});
      mesh(g, new THREE.BoxGeometry(.25, .15, 4), rackMat, W / 2 + 1.5, 4.85, -1.2); // poutre
      anim.push((t) => { bagPivot.rotation.z = Math.sin(t * 1.3) * .05 + Math.sin(t * .37) * .03; bagPivot.rotation.x = Math.sin(t * .9 + 1) * .035; bag.rotation.y = Math.sin(t * .5) * .3; });
      // fontaine à eau
      const wf = new THREE.Group(); wf.position.set(W / 2 + 1.4, 0, -D / 2 - .6); g.add(wf);
      mesh(wf, new THREE.BoxGeometry(.5, 1, .45), lam("#e6ebef"), 0, .5, 0, {cast: true});
      mesh(wf, new THREE.CylinderGeometry(.2, .2, .55, 12), new THREE.MeshPhongMaterial({color: "#5fb6ff", transparent: true, opacity: .75, shininess: 120}), 0, 1.28, 0);
      // bancs latéraux + tapis de sol
      mesh(g, new THREE.BoxGeometry(.5, .15, 1.6), blueM, W / 2 + 1.1, .48, D / 2 - 1, {cast: true});
      for (const z of [D / 2 - 1.6, D / 2 - .4]) mesh(g, new THREE.BoxGeometry(.4, .42, .08), rackMat, W / 2 + 1.1, .21, z);

      function onFit() {
        const pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(wallZ + .1));
        const top = hitPlane(0, 1, pl), side = hitPlane(1, .6, pl);
        const vis = top ? top.y : 5, half = side ? Math.abs(side.x) : W / 2;
        const nW = clamp(Math.min(half * 1.15, W * .62), 4, 11), nH = nW * .25;
        const ny = clamp(vis - nH * .62, 2.6, 5.4);
        neon.scale.set(nW, nW, 1); neon.position.y = ny;
        neonBack.scale.set(nW * .9, nW * .7, 1); neonBack.position.y = ny;
        wallGlow.scale.set(nW * 1.5, nW * 1.6, 1); wallGlow.position.y = ny;
        pink.position.set(0, ny, wallZ + 1.5);
        const mTop = ny - nH * .55, mBot = .45, mW = Math.min(W * .9, half * 1.8), mH = Math.max(.8, mTop - mBot);
        mirPane.scale.set(mW, mH, 1); mirror.position.set(0, mBot + mH / 2, wallZ);
        mirTex.repeat.set(1, 1);
        frames[0].scale.set(mW + .16, .08, 1); frames[0].position.set(0, mH / 2 + .04, .02);
        frames[1].scale.set(mW + .16, .08, 1); frames[1].position.set(0, -mH / 2 - .04, .02);
        frames[2].scale.set(.08, mH + .16, 1); frames[2].position.set(-mW / 2 - .04, 0, .02);
        frames[3].scale.set(.08, mH + .16, 1); frames[3].position.set(mW / 2 + .04, 0, .02);
      }
      function fitPoints() { return [new THREE.Vector3(-W / 2, 3.4, wallZ), new THREE.Vector3(W / 2, 3.4, wallZ)]; }
      batchStatic(g);
      return {group: g, gold: "#00e5ff", glow: "#00e5ff", glowAdd: true, anim, onFit, fitPoints, lights: L, tileStyle: "mat"};
    }

    // ---------- construction du monde ----------
    function buildWorld() {
      if (theme) { world.remove(theme.group); disposeTree(theme.group); }
      theme = themeName === "salle" ? buildSalle() : buildPlage();
      world.add(theme.group);
      for (const p of pings) p.m.material.color.set(theme.gold);
      buildTiles();
      fitCamera();
    }

    // ---------- tapis de jeu ----------
    function drawTile(o) {
      const t = o.data, st = tileState.get(t.id) || {}, cvs2 = o.canvas, ctx = cvs2.getContext("2d");
      const Lw = 512, Lh = Lw * o.wd / o.ww, sy = cvs2.height / Lh;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs2.width, cvs2.height);
      ctx.setTransform(1, 0, 0, sy, 0, 0);
      const col = t.color || "#e63946", towel = theme.tileStyle === "towel";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const nameS = Math.min(74, Lh * .26), subS = Math.min(36, Lh * .13), stS = Math.min(30, Lh * .115), dotR = Math.min(13, Lh * .05);
      const hasDots = (st.voters || 0) > 0, hasLbl = !!st.label;
      let blockH = nameS + subS + 10 + (hasDots ? dotR * 2 + 12 : 0) + (hasLbl ? stS + 18 : 0);
      let y = Lh / 2 - blockH / 2;
      if (towel) {
        // serviette de plage rayée avec franges
        ctx.fillStyle = "#fff8e7"; rrect(ctx, 14, 6, Lw - 28, Lh - 12, 16); ctx.fill();
        ctx.save(); rrect(ctx, 14, 6, Lw - 28, Lh - 12, 16); ctx.clip();
        for (let x = 14, i = 0; x < Lw; i++) { const sw = i % 2 ? 26 : 46; if (i % 2 === 0) { ctx.fillStyle = col; ctx.fillRect(x, 0, sw, Lh); } x += sw; }
        ctx.fillStyle = "rgba(255,255,255,.12)"; for (let yy = 0; yy < Lh; yy += 8) ctx.fillRect(0, yy, Lw, 3);
        ctx.restore();
        ctx.strokeStyle = "#6b3b1f"; ctx.lineWidth = 6; rrect(ctx, 14, 6, Lw - 28, Lh - 12, 16); ctx.stroke();
        ctx.strokeStyle = "#fff8e7"; ctx.lineWidth = 3;
        for (let yy = 16; yy < Lh - 12; yy += 9) { ctx.beginPath(); ctx.moveTo(2, yy); ctx.lineTo(13, yy); ctx.moveTo(Lw - 13, yy); ctx.lineTo(Lw - 2, yy); ctx.stroke(); }
        // étiquette centrale
        ctx.font = `400 ${nameS}px ${FONT_D}`;
        const nw = Math.min(Lw - 70, Math.max(ctx.measureText(t.name).width, 180) + 50);
        ctx.fillStyle = "rgba(107,59,31,.35)"; rrect(ctx, Lw / 2 - nw / 2 + 5, y - 8 + 6, nw, blockH + 16, 14); ctx.fill();
        ctx.fillStyle = "#fff8e7"; rrect(ctx, Lw / 2 - nw / 2, y - 8, nw, blockH + 16, 14); ctx.fill();
        ctx.strokeStyle = "#6b3b1f"; ctx.lineWidth = 4; ctx.stroke();
      } else {
        // tapis caoutchouc
        ctx.fillStyle = col; rrect(ctx, 6, 6, Lw - 12, Lh - 12, 30); ctx.fill();
        ctx.save(); rrect(ctx, 6, 6, Lw - 12, Lh - 12, 30); ctx.clip();
        const r2 = rng(7); for (let i = 0; i < 700; i++) { ctx.fillStyle = r2() < .5 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.09)"; ctx.fillRect(r2() * Lw, r2() * Lh, 2, 2); }
        const gr = ctx.createLinearGradient(0, 0, 0, Lh); gr.addColorStop(0, "rgba(255,255,255,.14)"); gr.addColorStop(1, "rgba(0,0,0,.18)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, Lw, Lh);
        ctx.restore();
        ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 8; rrect(ctx, 6, 6, Lw - 12, Lh - 12, 30); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 6; rrect(ctx, 24, 24, Lw - 48, Lh - 48, 18); ctx.stroke();
      }
      const ink = towel ? "#3b1b0b" : "#ffffff";
      y += nameS / 2;
      fitFont(ctx, (t.name || "").toUpperCase(), FONT_D, "400", nameS, Lw - 110, 20);
      if (!towel) { ctx.fillStyle = "#0b0d10"; ctx.fillText((t.name || "").toUpperCase(), Lw / 2 + 4, y + 4); }
      ctx.fillStyle = ink; ctx.fillText((t.name || "").toUpperCase(), Lw / 2, y);
      y += nameS / 2 + 8 + subS / 2;
      ctx.font = `800 ${subS}px ${FONT_UI}`; ctx.fillStyle = towel ? "#7a4a22" : "rgba(255,255,255,.9)";
      ctx.fillText(t.sub || "", Lw / 2, y);
      y += subS / 2;
      if (hasDots) {
        y += 8 + dotR;
        const n = Math.min(st.voters, 12), gap = dotR * 2.6, x0 = Lw / 2 - (n - 1) * gap / 2;
        for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, dotR, 0, 7); ctx.fillStyle = "#3ccf8e"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#1d1420"; ctx.stroke(); }
        y += dotR;
      }
      if (hasLbl) {
        y += 10 + stS / 2 + 4;
        ctx.font = `800 ${stS}px ${FONT_UI}`;
        const lw = Math.min(Lw - 60, ctx.measureText(st.label).width + 30);
        fitFont(ctx, st.label, FONT_UI, "800", stS, lw - 24, 12);
        ctx.fillStyle = towel ? "#ff6b35" : "rgba(0,0,0,.6)"; rrect(ctx, Lw / 2 - lw / 2, y - stS / 2 - 6, lw, stS + 12, (stS + 12) / 2); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.fillText(st.label, Lw / 2, y + 1);
      }
      if (st.off) { ctx.fillStyle = "rgba(30,30,30,.45)"; ctx.fillRect(0, 0, Lw, Lh); }
      o.tex.needsUpdate = true;
    }
    const glowTexCache = {};
    function glowTex(color) {
      if (glowTexCache[color]) return glowTexCache[color];
      const c = mkCanvas(256, 256), x = c.getContext("2d");
      x.filter = "blur(14px)"; x.strokeStyle = color; x.lineWidth = 34; rrect(x, 40, 40, 176, 176, 26); x.stroke();
      x.filter = "none"; x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,.9)"; rrect(x, 40, 40, 176, 176, 26); x.stroke();
      return (glowTexCache[color] = canvasTex(c, {mip: false}));
    }
    function buildTiles() {
      for (const o of tileObjs) { tilesG.remove(o.group); disposeTree(o.group); }
      tileObjs = [];
      if (!theme) return;
      const towel = theme.tileStyle === "towel";
      for (const t of tilesData) {
        const ww = t.w * W, wd = t.h * D, grp = new THREE.Group();
        grp.position.set(wx(t.x + t.w / 2), 0, wz(t.y + t.h / 2));
        const ch = (512 * wd / ww) > 384 ? 512 : 256;
        const canvas = mkCanvas(512, ch), tex = canvasTex(canvas);
        const side = new THREE.MeshLambertMaterial({color: towel ? "#fff1d6" : shade(t.color || "#3a86ff", .55)});
        const thick = towel ? .03 : TILE_T;
        const box = new THREE.Mesh(new THREE.BoxGeometry(ww * .985, thick, wd * .985), side);
        box.position.y = thick / 2; box.receiveShadow = true; box.castShadow = !towel; grp.add(box);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(ww, wd).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({map: tex, transparent: true, alphaTest: .05}));
        top.position.y = thick + .002; top.receiveShadow = true; grp.add(top);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: glowTex(theme.glow), transparent: true, depthWrite: false, blending: theme.glowAdd ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0}));
        glow.scale.set(ww * 1.3, 1, wd * 1.3); glow.position.y = .01; glow.renderOrder = 1; grp.add(glow);
        tilesG.add(grp);
        const o = {id: t.id, data: t, group: grp, top, box, glow, canvas, tex, ww, wd, thick, lift: 0, key: ""};
        tileObjs.push(o);
        drawTile(o);
      }
      // la texture de lueur est partagée : ne pas la libérer avec chaque tapis
      for (const o of tileObjs) o.glow.material.map = glowTex(theme.glow);
    }
    function tileTopAt(nx, ny) {
      for (const o of tileObjs) { const t = o.data; if (nx >= t.x && nx <= t.x + t.w && ny >= t.y && ny <= t.y + t.h) return o.thick + o.lift; }
      return 0;
    }

    // ---------- personnages ----------
    const svgCache = new Map();
    function acquireSvg(svg) {
      let e = svgCache.get(svg);
      if (!e) {
        e = {refs: 0, tex: null, top: .9, rx: 40};
        svgCache.set(svg, e);
        let src = svg.replace(/<ellipse cx="100" cy="258" rx="([\d.]+)" ry="7" fill="rgba\(0,0,0,\.28\)"\/>/, (m0, rx) => { e.rx = +rx; return ""; });
        src = src.replace(/<svg\b/, `<svg width="${TEX}" height="${DRAWN_H.toFixed(2)}"`);
        const img = new Image();
        img.onload = () => {
          if (destroyed || e.refs <= 0) return;
          const c = mkCanvas(TEX, TEX), x = c.getContext("2d");
          x.drawImage(img, 0, OFFY, TEX, DRAWN_H);
          try {
            const d = x.getImageData(0, 0, TEX, TEX).data;
            let row = 0;
            outer: for (; row < TEX; row++) for (let i = 3 + row * TEX * 4, end = i + TEX * 4; i < end; i += 16) if (d[i] > 60) break outer;
            e.top = 1 - row / TEX;
          } catch (err) { e.top = .9; }
          e.tex = canvasTex(c);
          e.tex.premultiplyAlpha = true;
        };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
      }
      e.refs++;
      return e;
    }
    function releaseSvg(svg) {
      const e = svgCache.get(svg);
      if (!e) return;
      if (--e.refs <= 0) { if (e.tex) e.tex.dispose(); svgCache.delete(svg); }
    }
    function drawTag(en) {
      const name = en.name || "", sub = en.sub || "", S = 2;
      const nameF = 15 * S, subF = 11.5 * S, padX = 8 * S, padY = 3 * S;
      const c0 = mkCanvas(4, 4).getContext("2d");
      c0.font = `800 ${nameF}px ${FONT_UI}`; const nw = c0.measureText(name).width;
      c0.font = `700 ${subF}px ${FONT_UI}`; const sw = sub ? c0.measureText(sub).width : 0;
      const pw = Math.ceil(Math.max(nw, sw) + padX * 2), ph = Math.ceil(nameF * 1.12 + (sub ? subF * 1.12 : 0) + padY * 2);
      const crownH = en.crown ? 22 * S : 0, badge = en.voted ? 11 * S : 0, bw = 2 * S;
      const cw = pw + badge * 2 + bw * 2 + 4, chh = ph + crownH + bw * 2 + badge * .4 + 4;
      const c = mkCanvas(cw, chh), x = c.getContext("2d");
      const px = (cw - pw) / 2, py = chh - ph - bw - 2;
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "rgba(0,0,0,.25)"; rrect(x, px + 1, py + 3, pw, ph, 8 * S); x.fill();
      x.fillStyle = en.me ? ME_GOLD : "rgba(20,14,26,.82)"; rrect(x, px, py, pw, ph, 8 * S); x.fill();
      x.lineWidth = bw; x.strokeStyle = en.me ? "#1d1420" : "rgba(255,255,255,.3)"; x.stroke();
      x.font = `800 ${nameF}px ${FONT_UI}`; x.fillStyle = en.me ? "#1d1420" : "#ffffff";
      x.fillText(name, cw / 2, py + padY + nameF * .58);
      if (sub) { x.font = `700 ${subF}px ${FONT_UI}`; x.fillStyle = en.me ? "#5b3a00" : "#ffd977"; x.fillText(sub, cw / 2, py + padY + nameF * 1.12 + subF * .55); }
      if (en.crown) { x.font = `${20 * S}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.fillText("👑", cw / 2, py - crownH / 2 + 2); }
      if (en.voted) {
        const bx = px + pw - 2, by = py + 3;
        x.beginPath(); x.arc(bx, by, badge, 0, 7); x.fillStyle = "#3ccf8e"; x.fill(); x.lineWidth = bw; x.strokeStyle = "#1d1420"; x.stroke();
        x.strokeStyle = "#1d1420"; x.lineWidth = 2.6 * S; x.lineCap = "round"; x.lineJoin = "round";
        x.beginPath(); x.moveTo(bx - badge * .45, by + badge * .02); x.lineTo(bx - badge * .1, by + badge * .38); x.lineTo(bx + badge * .48, by - badge * .38); x.stroke();
      }
      if (en.tagTex) en.tagTex.dispose();
      en.tagTex = canvasTex(c, {mip: false});
      en.tagMat.map = en.tagTex; en.tagMat.needsUpdate = true;
      en.tagW = cw / S; en.tagH = chh / S;
    }
    function newEnt(d) {
      const mat = new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true, opacity: 0});
      const m = new THREE.Mesh(shared.plane, mat);
      m.rotation.order = "YXZ";
      const shMat = new THREE.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false});
      const sh = new THREE.Mesh(shared.flat, shMat); sh.renderOrder = 3;
      const tagMat = new THREE.SpriteMaterial({sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true});
      const tag = new THREE.Sprite(tagMat); tag.center.set(.5, 0);
      const ring = new THREE.Mesh(shared.meRing, new THREE.MeshBasicMaterial({color: ME_GOLD, transparent: true, opacity: .85, depthWrite: false}));
      ring.renderOrder = 4; ring.visible = false;
      entG.add(sh, ring, m, tag);
      return {key: d.key, mesh: m, mat, sh, shMat, tag, tagMat, ring, svg: null, cache: null, tagKey: "", x: d.x, y: d.y, tx: d.x, ty: d.y, ph: Math.random() * 6, walkK: 0, fade: 0};
    }
    function setEntities(list) {
      const live = new Set();
      for (const d of list || []) {
        if (d == null || d.key == null || typeof d.x !== "number" || typeof d.y !== "number") continue;
        live.add(d.key);
        let en = ents.get(d.key);
        if (!en) { en = newEnt(d); ents.set(d.key, en); }
        en.tx = d.x; en.ty = d.y;
        en.me = !!d.me; en.walking = !!d.walking; en.busy = !!d.busy;
        en.k = typeof d.scale === "number" && d.scale > 0 ? d.scale : 1;
        en.facing = d.facing === -1 ? -1 : 1;
        const pz = d.pose || null;                         // pose en cours : petit « pop » + anneau doré
        if (pz !== (en.pose || null)) { en.pose = pz; if (pz) en.popT = 0; }
        if (en.me) { en.x = d.x; en.y = d.y; }
        if (d.svg !== en.svg) {
          const old = en.svg;
          en.svg = d.svg; en.cache = d.svg ? acquireSvg(d.svg) : null;
          if (old) releaseSvg(old);
        }
        const tk = [d.name, d.sub, en.me, !!d.voted, !!d.crown].join("\u0001");
        if (tk !== en.tagKey) { en.tagKey = tk; en.name = d.name; en.sub = d.sub; en.voted = !!d.voted; en.crown = !!d.crown; drawTag(en); }
      }
      for (const [k, en] of ents) if (!live.has(k)) removeEnt(k, en);
    }
    function removeEnt(k, en) {
      entG.remove(en.mesh, en.sh, en.tag, en.ring);
      en.mat.dispose(); en.shMat.dispose(); en.tagMat.dispose(); en.ring.material.dispose();
      if (en.tagTex) en.tagTex.dispose();
      if (en.svg) releaseSvg(en.svg);
      ents.delete(k);
    }

    // ---------- interactions ----------
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    function onPointerDown(e) {
      if (e.button != null && e.button > 0) return;
      const r = cvs.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const p = hitPlane((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, floorPlane);
      if (!p) return;
      const nx = p.x / W + .5, ny = p.z / D + .5;
      if (nx < -.25 || nx > 1.25 || ny < -.25 || ny > 1.3) return;
      if (opts.onFloorClick) opts.onFloorClick(clamp(nx, .03, .97), clamp(ny, .05, .98));
    }
    cvs.addEventListener("pointerdown", onPointerDown);

    function ping(nx, ny) {
      const m = new THREE.Mesh(shared.ring, new THREE.MeshBasicMaterial({color: theme ? theme.gold : ME_GOLD, transparent: true, depthWrite: false, depthTest: false}));
      m.position.set(wx(nx), tileTopAt(nx, ny) + .02, wz(ny)); m.renderOrder = 5;
      fxG.add(m); pings.push({m, t: 0});
    }

    // ---------- tailles ----------
    function resize() {
      if (destroyed) return;
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      vpW = w; vpH = h;
      renderer.setSize(w, h, false);
      const p = w < h;
      if (p !== portrait || !theme) {
        portrait = p;
        W = p ? 11 : 16; D = p ? 13.5 : 11;
        buildWorld();
      } else fitCamera();
      needRender = true;
    }

    // ---------- boucle ----------
    let raf = 0, last = 0, t0 = performance.now(), needRender = true, visible = !document.hidden, onScreen = true, fps = 60;
    const camUp = new THREE.Vector3();
    function update(now, dt) {
      const t = (now - t0) / 1000;
      if (theme && !reduced) for (const a of theme.anim) a(t, dt);
      // caméra : très léger balancement
      placeCamera(reduced ? 0 : Math.sin(t * .11) * .028);
      if (!reduced) camera.position.y += Math.sin(t * .17) * .06;
      if (!reduced) camera.lookAt(cam.target);
      camera.updateMatrixWorld();
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      // tapis
      for (const o of tileObjs) {
        const st = tileState.get(o.id) || {};
        const goal = st.mine ? .12 : 0;
        o.lift += (goal - o.lift) * Math.min(1, dt * 10);
        const pulse = st.mine && !reduced ? Math.sin(t * 4) * .5 + .5 : 1;
        o.group.position.y = o.lift + (st.mine && !reduced ? pulse * .03 : 0);
        o.glow.material.opacity += ((st.mine ? .55 + .45 * pulse : 0) - o.glow.material.opacity) * Math.min(1, dt * 8);
        o.glow.visible = o.glow.material.opacity > .01;
      }
      // personnages
      const P11 = camera.projectionMatrix.elements[5], tagK = clamp(vpW / 1000, .74, 1.05), stretch = 1 / Math.cos(cam.elev * .82);
      for (const en of ents.values()) {
        if (!en.me) { const k = 1 - Math.exp(-dt * 12); en.x += (en.tx - en.x) * k; en.y += (en.ty - en.y) * k; }
        en.walkK += ((en.walking ? 1 : 0) - en.walkK) * Math.min(1, dt * 8);
        en.ph += dt * (en.walking ? 2 * Math.PI / .64 : 2);
        const e = en.cache, ready = e && e.tex;
        if (ready && en.mat.map !== e.tex) { en.mat.map = e.tex; en.mat.needsUpdate = true; }
        en.fade = Math.min(1, en.fade + (ready ? dt * 4 : 0));
        const X = wx(en.x), Z = wz(en.y), floorY = tileTopAt(en.x, en.y);
        const walkAmt = reduced ? 0 : en.walkK;
        const bob = Math.abs(Math.sin(en.ph)) * .09 * walkAmt;
        const wob = Math.sin(en.ph) * .07 * walkAmt;
        const breath = reduced ? 1 : 1 + Math.sin(en.ph * .5) * .012 * (1 - walkAmt);
        let pop = 1;
        if (en.popT != null) { en.popT += dt; const pk = en.popT / .45; if (pk < 1 && !reduced) pop = 1 + .2 * Math.sin(pk * Math.PI); else if (pk >= 1) en.popT = null; }
        const sz = CHAR_SIZE * (en.k || 1) * pop, hy = sz * stretch;
        en.mesh.scale.set(sz * en.facing, hy * breath, 1);
        en.mesh.position.set(X, floorY + bob - FOOT_FRAC * hy, Z);
        en.mesh.rotation.set(0, Math.atan2(camera.position.x - X, camera.position.z - Z), wob * en.facing);
        en.mat.opacity = en.fade * (en.busy ? .55 : 1);
        en.mat.color.setScalar(en.busy ? .78 : 1);
        en.mesh.renderOrder = 100 + Math.round(en.y * 1000);
        en.mesh.visible = !!ready;
        const shw = Math.max(.7, ((e && e.rx) || 40) * 2.3 * SU) * (en.k || 1) * (1 - bob * 1.5);
        en.sh.scale.set(shw, 1, shw * .42); en.sh.position.set(X, floorY + .012, Z + .05);
        en.shMat.opacity = en.fade * (en.busy ? .5 : 1);
        en.ring.visible = en.me || !!en.pose; en.ring.position.set(X, floorY + .014, Z + .05); en.ring.scale.set(shw * .62, 1, shw * .3);
        // étiquette au-dessus de la tête
        const headH = ((e && e.top) || .9) - FOOT_FRAC;
        en.tag.position.set(X, floorY + bob + headH * hy * breath + .06, Z);
        const sc = 2 / (P11 * vpH) * tagK;
        en.tag.scale.set((en.tagW || 60) * sc, (en.tagH || 20) * sc, 1);
        en.tag.renderOrder = 5000 + Math.round(en.y * 1000);
        en.tagMat.opacity = en.fade * (en.busy ? .75 : 1);
      }
      // pings
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i]; p.t += dt;
        const k = p.t / .7, s = .4 + 1.2 * k;
        p.m.scale.set(s, 1, s * .8); p.m.material.opacity = 1 - k;
        if (k >= 1) { fxG.remove(p.m); p.m.material.dispose(); pings.splice(i, 1); }
      }
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      if (dt > 0) fps += (1 / dt - fps) * .05;
      if (!vpW || !vpH) return;
      update(now, dt);
      renderer.render(scene, camera);
      needRender = false;
    }
    function start() { if (!raf && !destroyed && visible && onScreen) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onVis() { visible = !document.hidden; if (visible) start(); else stop(); }
    document.addEventListener("visibilitychange", onVis);
    let io = null, ro = null;
    if (window.IntersectionObserver) { io = new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) start(); else stop(); }); io.observe(container); }
    if (window.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(container); }
    else window.addEventListener("resize", resize);
    function onCtxLost(e) { e.preventDefault(); stop(); }
    function onCtxRestored() { start(); }
    cvs.addEventListener("webglcontextlost", onCtxLost);
    cvs.addEventListener("webglcontextrestored", onCtxRestored);

    // polices web : redessiner les textes une fois chargées
    if (document.fonts && document.fonts.load) {
      Promise.all([`400 64px Anton`, `800 30px "Barlow Condensed"`, `700 24px "Barlow Condensed"`, `400 60px Pacifico`].map(f => document.fonts.load(f).catch(() => null)))
        .then(() => {
          if (destroyed) return;
          for (const o of tileObjs) drawTile(o);
          for (const en of ents.values()) drawTag(en);
          if (theme) buildWorld();
        });
    }

    resize();
    start();

    const api = {
      get supported() { return true; },
      get fps() { return Math.round(fps); },
      get renderer() { return renderer; },
      get _scene() { return scene; },
      setTheme(name) {
        name = name === "salle" ? "salle" : "plage";
        if (name === themeName && theme) return;
        themeName = name; buildWorld();
      },
      setTiles(tiles) { tilesData = (tiles || []).slice(); buildTiles(); },
      setTileState(id, st) {
        const prev = tileState.get(id) || {};
        const next = Object.assign({}, prev, st || {});
        tileState.set(id, next);
        const key = [!!next.mine, next.voters || 0, next.label || "", !!next.off].join("|");
        const o = tileObjs.find(x => x.id === id);
        if (o && o.key !== key) { const redraw = o.key.split("|").slice(1).join("|") !== key.split("|").slice(1).join("|"); o.key = key; if (redraw) drawTile(o); }
      },
      setEntities,
      ping,
      resize,
      destroy() {
        if (destroyed) return;
        destroyed = true; stop();
        document.removeEventListener("visibilitychange", onVis);
        cvs.removeEventListener("pointerdown", onPointerDown);
        cvs.removeEventListener("webglcontextlost", onCtxLost);
        cvs.removeEventListener("webglcontextrestored", onCtxRestored);
        if (io) io.disconnect();
        if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
        for (const [k, en] of Array.from(ents)) removeEnt(k, en);
        for (const e of svgCache.values()) if (e.tex) e.tex.dispose();
        svgCache.clear();
        for (const k in glowTexCache) glowTexCache[k].dispose();
        disposeTree(scene);
        blobTex.dispose();
        for (const k in shared) shared[k].dispose();
        if (scene.background && scene.background.dispose) scene.background.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (cvs.parentNode) cvs.parentNode.removeChild(cvs);
      },
    };
    return api;
  }

  G.scene3d = {supported, create};
})();
