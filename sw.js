/**
 * TaxOrder Pro — Service Worker (PWA)
 * Cache-first dla assetów, network-first dla danych
 * Obsługuje: install, activate, fetch, push, notificationclick
 */
const CACHE_NAME = 'taxorder-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/modules/i18n.js',
  '/modules/cf-cloud.js',
  '/modules/vehicle-detail.js',
  '/modules/fleet-calendar.js',
  '/modules/fuel-import.js',
  '/modules/service.js',
  '/modules/reports.js',
  '/modules/documents.js',
  '/modules/fines.js',
  '/modules/drivers.js',
  '/modules/cepik-xml.js',
  '/modules/dt1-xml.js',
  '/modules/dt1-generator.js',
  '/modules/notifications.js',
  '/modules/notification-settings.js',
  '/modules/backup.js',
  '/modules/damages.js',
  '/modules/tires-warehouse.js',
  '/modules/service-orders.js',
  '/modules/handover-protocol.js',
  '/modules/cfm-clients.js',
  '/modules/cfm-contracts.js',
  '/modules/cfm-invoices.js',
  '/modules/api-keys.js',
  '/modules/zsia-importer.js',
  '/modules/import-export.js',
  '/modules/csv-import.js',
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

// ==================== PUSH NOTIFICATIONS ====================

// Obsługa wiadomości push z serwera (Cloudflare Worker + VAPID)
self.addEventListener('push', e => {
  let data = { title: 'TaxOrder Pro', body: '', tag: 'taxorder-push', url: '/' };
  try {
    if (e.data) Object.assign(data, e.data.json());
  } catch {
    if (e.data) data.body = e.data.text();
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      tag:      data.tag || 'taxorder-push',
      icon:     '/favicon.ico',
      badge:    '/favicon.ico',
      data:     { url: data.url || '/' },
      requireInteraction: data.urgent || false,
    })
  );
});

// Klik w powiadomienie push — otwiera aplikację
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
