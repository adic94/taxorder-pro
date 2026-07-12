/**
 * TaxOrder Pro — Service Worker (PWA)
 * Cache-first dla assetów, network-first dla danych
 * Obsługuje: install, activate, fetch, push, notificationclick
 */
const CACHE_NAME = 'taxorder-v22';
const STATIC_ASSETS = [
  '/',
  '/app.js',
  '/config/cf-config.js',
  '/fontkit.umd.min.js',
  '/index.html',
  '/manifest.json',
  '/pdf-lib.min.js',
  '/style.css',
  '/modules/ai-chat.js',
  '/modules/alert-dashboard.js',
  '/modules/api-keys.js',
  '/modules/aztec-scanner.js',
  '/modules/backup.js',
  '/modules/cepik-xml.js',
  '/modules/cf-cloud.js',
  '/modules/cfm-clients.js',
  '/modules/cfm-contracts.js',
  '/modules/cfm-invoices.js',
  '/modules/cloud-backup.js',
  '/modules/companies-auto-render.js',
  '/modules/companies-readonly.js',
  '/modules/company-access.js',
  '/modules/company-create.js',
  '/modules/csv-import.js',
  '/modules/damages.js',
  '/modules/dashboard-nav.js',
  '/modules/diagnostics.js',
  '/modules/documents.js',
  '/modules/dr-import.js',
  '/modules/drivers.js',
  '/modules/dt1-declarations.js',
  '/modules/dt1-generator.js',
  '/modules/dt1-xml.js',
  '/modules/error-tracker.js',
  '/modules/etoll-import.js',
  '/modules/fines.js',
  '/modules/fleet-calendar.js',
  '/modules/fleet-map.js',
  '/modules/fuel-import.js',
  '/modules/budget.js',
  '/modules/global-search.js',
  '/modules/gminy-rates.js',
  '/modules/keyboard-shortcuts.js',
  '/modules/handover-protocol.js',
  '/modules/i18n.js',
  '/modules/import-export.js',
  '/modules/inspection-calendar.js',
  '/modules/notification-settings.js',
  '/modules/notifications.js',
  '/modules/mileage-claims.js',
  '/modules/policies.js',
  '/modules/policy-ocr.js',
  '/modules/service-schedule.js',
  '/modules/rate-reader.js',
  '/modules/reports.js',
  '/modules/service-orders.js',
  '/modules/service.js',
  '/modules/storage.js',
  '/modules/tax-engine.js',
  '/modules/tekom-import.js',
  '/modules/tekom-sync.js',
  '/modules/tires-warehouse.js',
  '/modules/vehicle-detail.js',
  '/modules/vehicle-import.js',
  '/modules/webhooks-ui.js',
  '/modules/zsia-importer.js',
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
