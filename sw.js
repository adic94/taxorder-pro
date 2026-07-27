/**
 * TaxOrder Pro — Service Worker (PWA)
 * Cache-first dla assetów, network-first dla danych
 * Obsługuje: install, activate, fetch, push, notificationclick
 */
const CACHE_NAME = 'taxorder-v68';
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
  '/modules/folder-monitor.js',
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
  '/modules/teryt.js',
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
  '/modules/vehicle-equipment.js',
  '/modules/vehicle-import.js',
  '/modules/vehicle-inventory.js',
  '/modules/vehicle-value.js',
  '/modules/webhooks-ui.js',
  '/modules/zsia-importer.js',
  '/modules/fleet-kanban.js',
  '/modules/ev-fleet.js',
  '/modules/delegations.js',
  '/modules/feature-config.js',
  '/modules/leasing-schedule.js',
  '/modules/gus-regon.js',
  '/modules/vies-validator.js',
  '/modules/fleet-reservations.js',
  '/modules/epp-vat.js',
  '/modules/integrations.js',
  '/modules/tachograph.js',
  '/modules/trip-private.js',
  '/modules/geofencing.js',
  '/modules/driver-wages.js',
  '/modules/route-cost.js',
  '/modules/smart-forms.js',
  '/modules/gps-integrations.js',
  '/modules/ev-charging.js',
  '/modules/insurance.js',
  '/modules/route-billing.js',
  '/modules/fleet-kpi.js',
  '/modules/zapier-ui.js',
  '/modules/access-control.js',
  '/modules/ksef.js',
  '/modules/vehicle-inspections.js',
  '/modules/fleet-renewal.js',
  '/modules/driver-training.js',
  '/modules/fleet-limits.js',
  '/modules/parking.js',
  '/modules/internal-rental.js',
  '/modules/carpooling.js',
  '/modules/gdpr.js',
  '/modules/currency.js',
  '/modules/predictive-maintenance.js',
  '/modules/warranties.js',
  '/modules/suppliers.js',
  '/modules/fleet-disposal.js',
  '/modules/report-builder.js',
  '/modules/cmr.js',
  '/modules/sent.js',
  '/modules/messenger.js',
  '/modules/vehicle-qr.js',
  '/modules/jpk.js',
  '/modules/edoreczenia.js',
  '/modules/video-telematics.js',
  '/modules/esg-report.js',
  '/modules/driver-worktime.js',
  '/modules/clerk-auth.js',
  '/modules/document-manager.js',
  '/modules/doc-workflow.js',
  '/modules/fuel-card-import.js',
  '/modules/supplier-invoices.js',
  '/modules/transport-orders.js',
  '/modules/co2-report.js',
  '/modules/driver-profiles.js',
  '/modules/tco.js',
  '/modules/approvals.js',
  '/modules/driver-shifts.js',
  '/modules/vehicle-reservations.js',
  '/modules/budgets.js',
  '/modules/budget-annual.js',
  '/modules/driver-schedule.js',
  '/modules/faults.js',
  '/modules/service-contracts.js',
  '/modules/spare-parts.js',
  '/modules/fk-export.js',
  '/modules/tacho.js',
  '/modules/fleet-policies.js',
  '/modules/driver-scoring.js',
  '/modules/driver-performance.js',
  '/modules/executive-dashboard.js',
  '/modules/benchmark.js',
  '/modules/driver-panel.js',
  '/modules/approval-levels.js',
  '/modules/audit-log.js',
  '/modules/onboarding.js',
  '/modules/fuel-db.js',
  '/modules/doc-viewer.js',
  '/modules/driver-pwa.js',
  '/modules/fleet-gantt.js',
  '/modules/driver-ranking.js',
  '/modules/fuel-import-scheduler.js',
  '/modules/debt-collection.js',
  '/modules/route-profitability.js',
  '/modules/fixed-assets.js',
  '/modules/external-panel.js',
  '/modules/rag-manager-chat.js',
  '/modules/ocr-fuel-invoices.js',
  '/modules/predictive-maintenance-ai.js',
  '/modules/hr-module.js',
  '/modules/vignettes.js',
  '/modules/carrier-rating.js',
  '/modules/esg-extended.js',
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
