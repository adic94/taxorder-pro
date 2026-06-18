/**
 * TaxOrder Pro — Service Worker (PWA)
 * Cache-first dla assetów, network-first dla danych
 */
const CACHE_NAME = 'taxorder-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/modules/fuel-import.js',
  '/modules/service.js',
  '/modules/reports.js',
  '/modules/documents.js',
  '/modules/fines.js',
  '/modules/drivers.js',
  '/modules/cepik-xml.js',
  '/modules/notifications.js',
  '/modules/vehicle-detail.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pomijaj żądania do zewnętrznych API i Cloudflare Workers
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchFresh = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);

      // Stale-while-revalidate: zwróć cache od razu, odśwież w tle
      return cached || fetchFresh;
    })
  );
});
