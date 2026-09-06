const CACHE_NAME = "cleana-shell-v1";
const PRECACHE_URLS = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Network-first, no offline caching of dynamic app content: bookings/
// availability must never show stale data (CLAUDE.md — מניעת חפיפה,
// יתרות כרטיסייה). This handler exists mainly to satisfy the PWA
// installability requirement (a fetch listener is required on Chrome/
// Android for "Add to Home Screen"), not to enable real offline use.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
