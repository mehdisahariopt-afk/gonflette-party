/* Gonflette Party : service worker (appli installable + secours hors ligne).
   Stratégie prudente :
   - nos fichiers (HTML, JS, CSS, manifeste, icônes) : RÉSEAU D'ABORD (revalidé, jamais une vieille version
     tant qu'il y a du réseau), copie en cache, et cache seulement si le réseau ne répond pas (hors ligne) ;
   - bibliothèques des CDN (three.js…) et polices Google : CACHE D'ABORD (URL versionnées, ne changent pas) ;
   - tout le reste (PeerJS : serveur de mise en relation, WebSocket, requêtes d'autres sites) : jamais touché.
   Changer VERSION purge les anciens caches à l'activation. */
const VERSION = "v1";
const APP = "gf-app-" + VERSION, LIB = "gf-lib-" + VERSION;
const CDN_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const SCOPE = new URL(self.registration ? self.registration.scope : "./", self.location.href);
const SHELL = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon.svg", "vendor/qrcode.min.js"];

// Installation : on met de côté la page et tous les scripts qu'elle charge (lus dans la page : rien à tenir à jour ici).
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    const urls = new Set(SHELL.map(u => new URL(u, SCOPE).href));
    try {
      const res = await fetch(new URL("./", SCOPE).href, {cache: "no-cache"});
      if (res.ok) {
        await cache.put(new URL("./", SCOPE).href, res.clone());
        const html = await res.text();
        for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"#?]+\.(?:js|css|webmanifest|png|svg))"/g)) {
          const u = new URL(m[1], SCOPE);
          if (u.origin === SCOPE.origin) urls.add(u.href);
        }
        // bibliothèques des CDN (three.js…) et feuille des polices : aussi mises de côté, pour le hors-ligne dès la 2e ouverture
        const lib = await caches.open(LIB);
        await Promise.all([...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="(https:\/\/[^"]+)"/g)]
          .map(m => m[1].replace(/&amp;/g, "&")).filter(u => CDN_HOSTS.includes(new URL(u).hostname) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\/?$/.test(u))
          .map(u => lib.match(u).then(hit => hit || fetch(u, {mode: "no-cors"}).then(r => (r.ok || r.type === "opaque") ? lib.put(u, r) : null)).catch(() => null)));
      }
    } catch (e) { /* hors ligne pendant l'installation : le cache se remplira à l'usage */ }
    // un fichier manquant ne doit pas faire échouer l'installation
    await Promise.all([...urls].map(u => fetch(u, {cache: "no-cache"}).then(r => r.ok ? cache.put(u, r) : null).catch(() => null)));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("gf-") && k !== APP && k !== LIB) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

async function networkFirst(req) {
  const cache = await caches.open(APP);
  const nav = req.mode === "navigate";
  // ?prof=…, ?mock, #salle : même page. On range la page sous « ./ » pour la retrouver hors ligne.
  const key = nav ? new URL("./", SCOPE).href : req.url;
  const cached = await cache.match(key, {ignoreSearch: true});
  // « no-cache » : revalidation auprès du serveur (304 si rien n'a changé) au lieu du cache HTTP (10 min sur GitHub Pages)
  const get = nav ? fetch(req.url, {cache: "no-cache", credentials: "same-origin"}).then(r => r.redirected ? fetch(req) : r) : fetch(req, {cache: "no-cache"});
  const net = get.then(res => {
    if (res && res.ok && res.type === "basic") cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  net.catch(() => {});
  try {
    // réseau très lent (« lie-fi ») : au bout de 6 s on sert la copie si on en a une
    return await (cached ? Promise.race([net, timeout(6000)]) : net);
  } catch (e) {
    if (cached) return cached;
    if (nav) { const home = await cache.match(new URL("./", SCOPE).href); if (home) return home; }
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(LIB);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // réponses CORS (polices) ou opaques (<script src> d'un CDN) : on garde ce qui n'est pas une erreur
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  if (url.origin === SCOPE.origin) {
    if (!url.href.startsWith(SCOPE.href)) return;          // hors de l'appli
    if (req.headers.get("range")) return;                 // médias partiels : laissés au navigateur
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // sinon (PeerJS, autres sites) : pas de respondWith, le navigateur fait comme d'habitude
});
