/* Bourselle — service worker : rend l'app installable et ouvre l'interface même hors ligne.
 * Les données ne sont jamais mises en cache ici : elles restent dans le Drive de l'utilisateur. */
const CACHE = "bourselle-v124";
const SHELL = ["./", "index.html", "style.css", "icons.js", "app.js", "accounts.js", "patrimoine.js", "tontine.js", "economies.js", "ndf.js", "plus.js", "qr.js", "pay.js", "deal-ui.js", "deals.js", "projects.js", "assistant.js", "social.js", "session.js", "lock.js", "payme.js", "proches.js", "ensemble.js", "bankpdf.js", "feedback.js", "reset.js", "widgets.js", "avatar.js", "fun.js", "bonsplans.js", "profile.js", "smart.js", "storage.js", "i18n.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/favicon-32.png", "icons/og-invite.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // Google, Microsoft, Drive : jamais en cache
  // Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
  // « no-cache » : on redemande toujours au serveur si le fichier a changé (sinon le navigateur peut servir une ancienne version pendant 10 min).
  const req = e.request.mode === "navigate" ? e.request : new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

// ---------- Notifications en direct ----------
// Si Bourselle est ouvert et visible, on lui passe simplement le message (il se met à jour) ; sinon on affiche la notification.
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    list.forEach(c => c.postMessage({ type: "bourselle-push", data: d }));
    if (list.some(c => c.visibilityState === "visible" && c.focused)) return;
    return self.registration.showNotification(d.title || "Bourselle", { body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", data: { url: d.url || "./" } });
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: "bourselle-open", url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
