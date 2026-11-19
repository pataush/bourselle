/* Bourselle — service worker : rend l'app installable et ouvre l'interface même hors ligne.
 * Les données ne sont jamais mises en cache ici : elles restent dans le Drive de l'utilisateur. */
const CACHE = "bourselle-v21";
const SHELL = ["./", "index.html", "style.css", "app.js", "tontine.js", "economies.js", "ndf.js", "plus.js", "storage.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/favicon-32.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // Google, Microsoft, Drive : jamais en cache
  // Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
