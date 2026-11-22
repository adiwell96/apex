// APEX Service Worker: statische Dateien aus dem Cache, Seiten "Netzwerk zuerst" mit Offline-Fallback.
const V = 'apex-v1';
const STATIC = ['/assets/app.css', '/assets/app.js', '/assets/theme.js', '/assets/ics.js', '/fonts/playfair-display-latin-wght-normal.woff2', '/fonts/inter-latin-wght-normal.woff2', '/fonts/barlow-condensed-latin-700-normal.woff2', '/fonts/barlow-condensed-latin-600-normal.woff2', '/icons/icon-192.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actions/') || url.pathname === '/login' || url.pathname === '/logout') return;
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); if (res.ok) caches.open(V).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      // Nur erfolgreich angemeldete Seiten zwischenspeichern (keine Login-Weiterleitungen)
      if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/') || new Response('<h1>Offline</h1><p>Keine Verbindung. Zuletzt gelesene Seiten sind offline verfügbar.</p>', { headers: { 'content-type': 'text/html; charset=utf-8' } }))));
  }
});
