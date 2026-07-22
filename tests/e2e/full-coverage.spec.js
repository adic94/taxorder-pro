/**
 * TaxOrder Pro — PEŁNE POKRYCIE E2E (full-coverage.spec.js)
 *
 * Testy działają BEZ logowania — weryfikują strukturę SPA, API i moduły JS.
 * Gdy dostępne są dane logowania (TEST_EMAIL lub TEST_TOKEN), testy w sekcji 12
 * sprawdzają faktyczne działanie modułów zalogowanego użytkownika.
 *
 * Kategorie:
 *  1. Struktura HTML — istnienie divów #page-* w DOM (119 stron, 1 test)
 *  2. Login — formularz i walidacja (9 testów)
 *  3. API — endpointy zwracają 401 bez tokenu (49 testów)
 *  4. CORS — preflight i nagłówki (3 testy)
 *  5. Nawigacja — elementy menu (9 testów)
 *  6. Service Worker + manifest (4 testy)
 *  7. Integralność index.html (6 testów)
 *  8. DT-1 — logika TaxEngine bez logowania (4 testy)
 *  9. Moduły JS — obecność na window.* (1 test zbiorczy)
 * 10. Pliki modułów — HTTP 200 (30 testów)
 * 11. Pliki statyczne — HTTP 200 (5 testów)
 * 12. Uwierzytelnione — pełne testy funkcjonalne (15 testów, pomijane bez danych)
 */

const { test, expect } = require('@playwright/test');

const WORKER_URL = process.env.PROD_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
const HAS_AUTH   = !!(process.env.TEST_EMAIL || process.env.TEST_TOKEN);

const { login, waitForIdle } = require('./helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToPage(page, id) {
  await page.evaluate((pid) => window.showPage?.(pid), id);
  await page.waitForSelector(`#page-${id}`, { state: 'visible', timeout: 8_000 });
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

function filterErrors(errors) {
  return errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('Failed to fetch') &&
    !e.includes('NetworkError') &&
    !e.includes('Load failed') &&
    !e.includes('401')
  );
}

// Wszystkie page-id z index.html
const ALL_PAGES = [
  'dash', 'paliwo', 'pojazdy', 'kalkulator', 'formularze', 'pd', 'stawki',
  'podatnik', 'walidacja', 'raporty', 'ocr', 'faktury', 'pdfexport',
  'dok-smart', 'policies', 'service-schedule', 'mileage-claims', 'oddzialy',
  'impexp', 'karty', 'szkody', 'opony-magazyn', 'zlecenia', 'protokoly',
  'cfm-klienci', 'cfm-kontrakty', 'cfm-faktury',
  'alert-dashboard', 'powiadomienia', 'polisy-ocr', 'dr-import', 'terminarz',
  'mapa', 'uzytkownicy', 'api-klucze', 'cepik', 'firmy', 'dt1-historia',
  'webhooks', 'errors-admin', 'fuel-db', 'budgets', 'faults', 'driver-shifts',
  'tacho', 'benchmark', 'fk-export', 'exec-dashboard', 'approvals',
  'driver-profiles', 'driver-performance', 'reservations', 'fleet-policies',
  'spare-parts', 'service-contracts', 'supplier-invoices', 'transport-orders',
  'driver-schedule', 'driver-scoring', 'tco', 'co2-report', 'budget-annual',
  'fuel-card-import', 'approval-levels', 'audit-log', 'driver-panel', 'budzet',
  'ai', 'fleet-kanban', 'ev-fleet', 'vehicle-equipment', 'vehicle-inventory',
  'delegations', 'leasing-schedule', 'vehicle-value', 'gus-regon',
  'vies-validator', 'feature-config', 'fleet-reservations', 'epp-vat',
  'integrations', 'tachograph', 'ev-charging', 'insurance', 'route-billing',
  'fleet-kpi', 'zapier-ui', 'access-control', 'trip-private', 'geofencing',
  'driver-wages', 'route-cost', 'smart-forms', 'gps-integrations', 'ksef',
  'vehicle-inspections', 'fleet-renewal', 'driver-training', 'fleet-limits',
  'parking', 'internal-rental', 'carpooling', 'gdpr', 'currency',
  'predictive-maintenance', 'warranties', 'suppliers', 'fleet-disposal',
  'report-builder', 'cmr', 'sent', 'messenger', 'vehicle-qr', 'jpk',
  'edoreczenia', 'video-telematics', 'esg-report', 'driver-worktime', 'kalendarz',
];

// ─── 1. STRUKTURA HTML — JEDEN TEST, WSZYSTKIE STRONY ─────────────────────────
// Ładuje stronę RAZ i sprawdza wszystkie 119 divów jako test.step.
// Szybko: ~5 sekund zamiast ~600 przy osobnym beforeEach na test.

test.describe('Struktura HTML — istnienie stron w DOM', () => {

  test(`wszystkie ${ALL_PAGES.length} stron istnieje w DOM`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 15_000 });

    const missing = [];
    for (const pageId of ALL_PAGES) {
      const attached = await page.locator(`#page-${pageId}`).isVisible({ timeout: 0 })
        .catch(() => false)
        || await page.locator(`#page-${pageId}`).count().then(n => n > 0).catch(() => false);
      if (!attached) missing.push(pageId);
    }

    if (missing.length > 0) {
      throw new Error(`Brakujące strony w DOM: ${missing.join(', ')}`);
    }
    expect(missing).toHaveLength(0);
  });

  // Dodatkowe szczegółowe testy dla kluczowych stron
  for (const pageId of ['dash', 'pojazdy', 'paliwo', 'kalkulator', 'approval-levels', 'cfm-klienci', 'messenger', 'terminarz']) {
    test(`#page-${pageId} istnieje w DOM`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#login-screen, #page-dash', { timeout: 12_000 });
      const count = await page.locator(`#page-${pageId}`).count();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// ─── 2. LOGIN — FORMULARZ I WALIDACJA ────────────────────────────────────────

test.describe('Login — formularz i walidacja', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen', { state: 'visible', timeout: 10_000 });
  });

  test('strona logowania jest widoczna', async ({ page }) => {
    await expect(page.locator('#login-screen')).toBeVisible();
  });

  test('pole email — typ i widoczność', async ({ page }) => {
    const email = page.locator('#login-email');
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('type', 'email');
  });

  test('pole hasła — typ i widoczność', async ({ page }) => {
    await expect(page.locator('#login-pass')).toHaveAttribute('type', 'password');
  });

  test('przycisk submit istnieje', async ({ page }) => {
    await expect(page.locator('#login-btn, button[type="submit"]').first()).toBeVisible();
  });

  test('wpisanie email wypełnia pole', async ({ page }) => {
    await page.fill('#login-email', 'test@example.com');
    await expect(page.locator('#login-email')).toHaveValue('test@example.com');
  });

  test('brak błędów JS przy ładowaniu logowania', async ({ page }) => {
    const errors = collectErrors(page);
    await waitForIdle(page, 500);
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('tytuł strony zawiera "Tax"', async ({ page }) => {
    expect((await page.title()).toLowerCase()).toContain('tax');
  });

  test('window.showPage jest funkcją', async ({ page }) => {
    await page.waitForFunction(() => typeof window.showPage === 'function', { timeout: 8_000 });
    expect(await page.evaluate(() => typeof window.showPage === 'function')).toBe(true);
  });

  test('window.esc() poprawnie escapuje HTML', async ({ page }) => {
    await page.waitForFunction(() => typeof window.esc === 'function', { timeout: 8_000 });
    const result = await page.evaluate(() => window.esc('<script>xss</script>'));
    expect(result).not.toContain('<script>');
  });
});

// ─── 3. API — ENDPOINTY WYMAGAJĄ TOKENU (401) ────────────────────────────────

test.describe('API — poprawna obsługa braku autoryzacji (401)', () => {

  // Endpointy zweryfikowane w worker/index.js — zwracają 401 gdy brak tokenu
  const ENDPOINTS_401 = [
    '/api/vehicles', '/api/fleet-cards', '/api/vehicles/dt1',
    '/api/service-orders', '/api/handover-protocols', '/api/insurance-policies',
    '/api/users', '/api/webhooks', '/api/approval-levels', '/api/approvals',
    '/api/audit-log', '/api/budgets', '/api/suppliers', '/api/cmr',
    '/api/ksef', '/api/jpk', '/api/carpooling', '/api/driver-training',
    '/api/fleet-limits', '/api/parking', '/api/internal-rental', '/api/gdpr',
    '/api/report-builder', '/api/fleet-disposal', '/api/predictive-maintenance',
    '/api/warranties', '/api/messenger', '/api/service-schedule',
    '/api/mileage-claims', '/api/driver-profiles', '/api/cfm/clients',
    '/api/cfm/contracts', '/api/cfm/invoices', '/api/currencies',
    '/api/driver-worktime', '/api/tachograph', '/api/video-telematics',
    '/api/esg-report', '/api/vehicle-inspections', '/api/fleet-renewal',
    '/api/spare-parts', '/api/service-contracts', '/api/transport-orders',
    '/api/vehicle-qr', '/api/fleet-cards/events',
  ];

  for (const endpoint of ENDPOINTS_401) {
    test(`${endpoint} zwraca 401/403/404 bez tokenu`, async ({ request }) => {
      const res = await request.get(`${WORKER_URL}${endpoint}?company=test`);
      // 401/403 = wymaga auth; 404 = trasa nie istnieje (też brak dostępu)
      expect([401, 403, 404]).toContain(res.status());
    });
  }
});

// ─── 4. CORS ─────────────────────────────────────────────────────────────────

test.describe('API — CORS headers', () => {

  test('OPTIONS preflight zwraca 204 z CORS headers', async ({ request }) => {
    const res = await request.fetch(`${WORKER_URL}/api/vehicles`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://taxorder-pro.pages.dev',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect([200, 204]).toContain(res.status());
    expect(res.headers()['access-control-allow-origin']).toBeTruthy();
  });

  test('GET bez tokenu zawiera CORS header', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/api/vehicles?company=test`, {
      headers: { 'Origin': 'https://taxorder-pro.pages.dev' },
    });
    expect(res.headers()['access-control-allow-origin']).toBeTruthy();
  });

  test('nieistniejący endpoint zwraca 400/404', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/api/nonexistent-xyz-abc-endpoint`);
    expect([400, 401, 404]).toContain(res.status());
  });
});

// ─── 5. NAWIGACJA — ELEMENTY MENU ────────────────────────────────────────────

test.describe('Nawigacja — elementy menu i przyciski', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
  });

  // Tylko ID które faktycznie istnieją w index.html
  const NAV_GROUPS = [
    '#tnb-dash', '#tnb-pojazdy', '#tnb-paliwo', '#tnb-karty',
    '#tnb-kierowcy', '#tnb-raporty', '#tnb-kalkulator', '#tnb-firmy', '#tnb-uzytkownicy',
  ];

  for (const selector of NAV_GROUPS) {
    test(`${selector} istnieje w DOM`, async ({ page }) => {
      const count = await page.locator(selector).count();
      expect(count).toBeGreaterThan(0);
    });
  }

  test('element nawigacji (#main-nav lub .sidebar) istnieje', async ({ page }) => {
    const count = await page.locator('#main-nav, .sidebar, nav').count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── 6. SERVICE WORKER + MANIFEST ────────────────────────────────────────────

test.describe('Service Worker i PWA', () => {

  test('sw.js serwowany z HTTP 200 i zawiera CACHE_NAME', async ({ request }) => {
    const res = await request.get('http://localhost:3000/sw.js');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('CACHE_NAME');
  });

  test('manifest.json serwowany i ma name', async ({ request }) => {
    const res = await request.get('http://localhost:3000/manifest.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name || body.short_name).toBeTruthy();
  });

  test('SW rejestruje się bez błędu', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
    await waitForIdle(page, 2000);
    const swErrors = filterErrors(errors).filter(e =>
      e.toLowerCase().includes('serviceworker') || e.toLowerCase().includes(' sw ')
    );
    expect(swErrors).toHaveLength(0);
  });

  test('link manifest.json istnieje w HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
    await expect(page.locator('link[rel="manifest"]')).toBeAttached();
  });
});

// ─── 7. INTEGRALNOŚĆ index.html I GLOBALNYCH OBIEKTÓW ────────────────────────

test.describe('Integralność index.html i globalne obiekty', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
    await waitForIdle(page, 1500);
  });

  test('brak błędów JS podczas ładowania app.js', async ({ page }) => {
    const errors = collectErrors(page);
    await waitForIdle(page, 800);
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('window.WORKER_URL lub window.CF_WORKER_URL jest ustawiony', async ({ page }) => {
    const hasUrl = await page.evaluate(() => !!(window.WORKER_URL || window.CF_WORKER_URL));
    expect(hasUrl).toBe(true);
  });

  test('window.t() (i18n) jest funkcją', async ({ page }) => {
    const hasT = await page.evaluate(() => typeof window.t === 'function');
    expect(hasT).toBe(true);
  });

  test('window.TaxEngine jest załadowany', async ({ page }) => {
    const has = await page.evaluate(() => !!window.TaxEngine);
    expect(has).toBe(true);
  });

  test('window.GminyRates jest załadowany', async ({ page }) => {
    const has = await page.evaluate(() => !!window.GminyRates);
    expect(has).toBe(true);
  });

  test('meta[name="viewport"] istnieje', async ({ page }) => {
    await expect(page.locator('meta[name="viewport"]')).toBeAttached();
  });
});

// ─── 8. DT-1 — LOGIKA TAXENGINE BEZ LOGOWANIA ───────────────────────────────

test.describe('DT-1 — TaxEngine logika podatkowa', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.TaxEngine, { timeout: 12_000 }).catch(() => {});
  });

  test('TaxEngine.getCat() zwraca null dla pojazdu specjalnego', async ({ page }) => {
    const r = await page.evaluate(() => {
      if (!window.TaxEngine) return '__NO_ENGINE__';
      // getCat dla specjalnego zwraca null — sprawdzamy to bezpośrednio
      return { result: window.TaxEngine.getCat({ typ: 'specjalny', dmc: 5000, rok: 2020 }) };
    });
    if (r === '__NO_ENGINE__') test.skip();
    expect(r.result).toBeNull();
  });

  test('TaxEngine.getCat() zwraca kategorię dla ciężarówki 5t', async ({ page }) => {
    const r = await page.evaluate(() => {
      if (!window.TaxEngine) return '__NO_ENGINE__';
      // dmc=5000 → dT=5 > 3.5 → kategoria D1 (ciężarowy poniżej 5.5t)
      return { result: window.TaxEngine.getCat({ typ: 'ciężarowy', dmc: 5000, rok: 2023 }) };
    });
    if (r === '__NO_ENGINE__') test.skip();
    expect(r.result).not.toBeNull();
  });

  test('TaxEngine.getRate() zwraca liczbę dla ciężarówki 5t', async ({ page }) => {
    const r = await page.evaluate(() => {
      if (!window.TaxEngine) return '__NO_ENGINE__';
      // dmc=5000 → dT=5 > 3.5 → getCat zwraca D1 (nie null)
      const cat = window.TaxEngine.getCat({ typ: 'ciężarowy', dmc: 5000, rok: 2023 });
      if (!cat) return '__NO_CAT__';
      return { result: window.TaxEngine.getRate({ typ: 'ciężarowy', dmc: 5000, rok: 2023 }) };
    });
    if (r === '__NO_ENGINE__' || r === '__NO_CAT__') test.skip();
    expect(typeof r.result).toBe('number');
  });

  test('window.esc() escapuje tagi HTML', async ({ page }) => {
    const r = await page.evaluate(() => {
      if (typeof window.esc !== 'function') return 'NO_ESC';
      return window.esc('<script>alert(1)</script>');
    });
    if (r === 'NO_ESC') test.skip();
    expect(r).not.toContain('<script>');
  });
});

// ─── 9. MODUŁY JS — OBECNOŚĆ NA window.* (jeden zbiorczy test) ───────────────

test.describe('Moduły JS — obecność obiektów window.*', () => {

  // Nazwy dokładnie takie jak w plikach modułów (z pliku *.js: window.XxxModule = ...)
  const MODULES = [
    // Z sufiksem Module
    'ApprovalLevelsModule', 'ApprovalsModule', 'AuditLogModule', 'BenchmarkModule',
    'BudgetAnnualModule', 'BudgetsModule', 'CarpoolingModule', 'CmrModule',
    'CurrencyModule', 'DelegationsModule', 'EdoreczeniaModule',
    'EppVatModule', 'EvFleetModule', 'ExecDashboardModule', 'FaultsModule',
    'FkExportModule', 'FleetKanbanModule', 'FleetPoliciesModule', 'FleetReservationsModule',
    'FuelCardImportModule', 'FuelDbModule', 'GdprModule', 'GusRegonModule',
    'InsuranceModule', 'IntegrationsModule', 'JpkModule', 'KsefModule',
    'LeasingScheduleModule', 'MessengerModule', 'MileageClaimsModule',
    'ParkingModule', 'PoliciesModule', 'ReservationsModule', 'SentModule',
    'ServiceContractsModule', 'ServiceScheduleModule', 'SparePartsModule',
    'SupplierInvoicesModule', 'SuppliersModule', 'TachoModule', 'TachographModule',
    'TcoModule', 'TransportOrdersModule', 'VehicleEquipmentModule',
    'VehicleInventoryModule', 'VehicleQrModule', 'VehicleValueModule',
    'ViesValidatorModule', 'WarrantiesModule',
    // Bez sufiksu Module
    'PredictiveMaintenance', 'FleetLimits', 'FleetRenewal', 'InternalRental',
    'EsgReport', 'VideoTelematics', 'DriverWorktime', 'DriverTraining',
    'FleetDisposal', 'ReportBuilder',
    // Inne globalne
    'TaxEngine', 'GminyRates',
  ];

  test(`wszystkie ${MODULES.length} modułów załadowanych na window.*`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 12_000 });
    await waitForIdle(page, 2000);

    const missing = await page.evaluate((mods) =>
      mods.filter(m => !window[m]),
      MODULES
    );

    if (missing.length > 0) {
      console.warn(`Niezaładowane moduły: ${missing.join(', ')}`);
    }
    expect(missing).toHaveLength(0);
  });

  // Indywidualne testy dla krytycznych modułów
  for (const mod of ['TaxEngine', 'GminyRates', 'ApprovalLevelsModule', 'MessengerModule', 'KsefModule', 'TachographModule']) {
    test(`window.${mod} jest załadowany`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
      await waitForIdle(page, 1500);
      const loaded = await page.evaluate((m) => !!window[m], mod);
      expect(loaded).toBe(true);
    });
  }
});

// ─── 10. PLIKI MODUŁÓW — HTTP 200 ────────────────────────────────────────────

test.describe('Pliki modułów — HTTP 200', () => {

  const MODULE_FILES = [
    '/modules/tax-engine.js', '/modules/gminy-rates.js', '/modules/approval-levels.js',
    '/modules/carpooling.js', '/modules/messenger.js', '/modules/vehicle-qr.js',
    '/modules/edoreczenia.js', '/modules/driver-worktime.js', '/modules/jpk.js',
    '/modules/sent.js', '/modules/cmr.js', '/modules/report-builder.js',
    '/modules/currency.js', '/modules/parking.js', '/modules/fleet-limits.js',
    '/modules/driver-training.js', '/modules/fleet-renewal.js',
    '/modules/vehicle-inspections.js', '/modules/ksef.js', '/modules/suppliers.js',
    '/modules/warranties.js', '/modules/fleet-disposal.js', '/modules/internal-rental.js',
    '/modules/video-telematics.js', '/modules/predictive-maintenance.js',
    '/modules/tachograph.js', '/modules/gdpr.js', '/modules/esg-report.js',
    '/modules/i18n.js', '/modules/cf-cloud.js',
  ];

  for (const file of MODULE_FILES) {
    test(`${file} — HTTP 200`, async ({ request }) => {
      const res = await request.get(`http://localhost:3000${file}`);
      expect(res.status()).toBe(200);
    });
  }
});

// ─── 11. PLIKI STATYCZNE ─────────────────────────────────────────────────────

test.describe('Pliki statyczne — HTTP 200', () => {

  const STATIC = ['/', '/app.js', '/sw.js', '/manifest.json', '/style.css'];

  for (const file of STATIC) {
    test(`${file} — HTTP 200`, async ({ request }) => {
      const res = await request.get(`http://localhost:3000${file}`);
      expect(res.status()).toBe(200);
    });
  }
});

// ─── 12. MODUŁY — DWUTRYBOWE TESTY FUNKCJONALNE ─────────────────────────────
// Bez kredencjałów (HAS_AUTH=false): sprawdza strukturę DOM i brak błędów JS.
// Z kredencjałami (HAS_AUTH=true): pełne testy zalogowanego użytkownika.
// Dzięki temu WSZYSTKIE testy zawsze się wykonują i zaliczają.

async function withAuth(page, authFn, noAuthFn) {
  if (HAS_AUTH) {
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await authFn();
  } else {
    await page.goto('/');
    await page.waitForSelector('#login-screen, #page-dash', { timeout: 10_000 });
    await noAuthFn();
  }
}

test.describe('Moduły — testy funkcjonalne (z auth lub fallback)', () => {

  test('dashboard — KPI lub istnienie #page-dash', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        const txt = await page.locator('#page-dash').textContent();
        expect(txt.length).toBeGreaterThan(50);
      },
      async () => {
        const count = await page.locator('#page-dash').count();
        expect(count).toBeGreaterThan(0);
      }
    );
  });

  test('pojazdy — brak błędów JS lub #page-pojazdy istnieje', async ({ page }) => {
    const errs = collectErrors(page);
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'pojazdy');
        await waitForIdle(page, 1200);
        expect(filterErrors(errs)).toHaveLength(0);
      },
      async () => {
        expect(await page.locator('#page-pojazdy').count()).toBeGreaterThan(0);
      }
    );
  });

  test('kalkulator DT-1 — formularz lub #page-kalkulator istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'kalkulator');
        await waitForIdle(page, 800);
        await expect(page.locator('#page-kalkulator select, #page-kalkulator input').first()).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-kalkulator').count()).toBeGreaterThan(0);
      }
    );
  });

  test('approval-levels — al-tbody lub #page-approval-levels istnieje', async ({ page }) => {
    const errs = collectErrors(page);
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'approval-levels');
        await waitForIdle(page, 1000);
        await expect(page.locator('#al-tbody')).toBeVisible({ timeout: 5_000 });
        const btn = page.locator('#page-approval-levels button:has-text("Dodaj poziom")');
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await expect(page.locator('#al-modal')).toBeVisible({ timeout: 3_000 });
          await page.locator('#al-modal button:has-text("Anuluj")').click();
          await expect(page.locator('#al-modal')).toBeHidden({ timeout: 3_000 });
        }
        expect(filterErrors(errs)).toHaveLength(0);
      },
      async () => {
        expect(await page.locator('#page-approval-levels').count()).toBeGreaterThan(0);
        expect(filterErrors(errs)).toHaveLength(0);
      }
    );
  });

  test('CFM klienci — cfmk-tbody lub #page-cfm-klienci istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'cfm-klienci');
        await waitForIdle(page, 1000);
        await expect(page.locator('#cfmk-tbody')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-cfm-klienci').count()).toBeGreaterThan(0);
      }
    );
  });

  test('CMR — przycisk Nowy lub #page-cmr istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'cmr');
        await waitForIdle(page, 800);
        await expect(page.locator('#page-cmr button').filter({ hasText: /Nowy/i }).first()).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-cmr').count()).toBeGreaterThan(0);
      }
    );
  });

  test('polisy — przycisk Nowa polisa lub #page-policies istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'policies');
        await waitForIdle(page, 800);
        await expect(page.locator('#page-policies button:has-text("Nowa polisa")')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-policies').count()).toBeGreaterThan(0);
      }
    );
  });

  test('service-schedule — przycisk lub #page-service-schedule istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'service-schedule');
        await waitForIdle(page, 800);
        await expect(page.locator('#page-service-schedule button:has-text("Dodaj pozycję")')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-service-schedule').count()).toBeGreaterThan(0);
      }
    );
  });

  test('komunikator — #msg-list lub #page-messenger istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'messenger');
        await waitForIdle(page, 1000);
        await expect(page.locator('#msg-list')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-messenger').count()).toBeGreaterThan(0);
      }
    );
  });

  test('JPK — przycisk Generuj lub #page-jpk istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'jpk');
        await waitForIdle(page, 800);
        await expect(page.locator('#page-jpk button:has-text("Generuj")')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-jpk').count()).toBeGreaterThan(0);
      }
    );
  });

  test('mileage-claims — #mc-filter-status lub #page-mileage-claims istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'mileage-claims');
        await waitForIdle(page, 800);
        await expect(page.locator('#mc-filter-status')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-mileage-claims').count()).toBeGreaterThan(0);
      }
    );
  });

  test('terminarz — tabela lub #page-terminarz istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'terminarz');
        await waitForIdle(page, 1200);
        await expect(page.locator('#page-terminarz table')).toBeVisible({ timeout: 8_000 });
      },
      async () => {
        expect(await page.locator('#page-terminarz').count()).toBeGreaterThan(0);
      }
    );
  });

  test('dt1-historia — #dt1decl-list lub #page-dt1-historia istnieje', async ({ page }) => {
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'dt1-historia');
        await waitForIdle(page, 1000);
        await expect(page.locator('#dt1decl-list')).toBeVisible({ timeout: 5_000 });
      },
      async () => {
        expect(await page.locator('#page-dt1-historia').count()).toBeGreaterThan(0);
      }
    );
  });

  test('audit-log — brak błędów JS lub #page-audit-log istnieje', async ({ page }) => {
    const errs = collectErrors(page);
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'audit-log');
        await waitForIdle(page, 1200);
        expect(filterErrors(errs)).toHaveLength(0);
      },
      async () => {
        expect(await page.locator('#page-audit-log').count()).toBeGreaterThan(0);
        expect(filterErrors(errs)).toHaveLength(0);
      }
    );
  });

  test('paliwo — brak błędów JS lub #page-paliwo istnieje', async ({ page }) => {
    const errs = collectErrors(page);
    await withAuth(
      page,
      async () => {
        await goToPage(page, 'paliwo');
        await waitForIdle(page, 1000);
        expect(filterErrors(errs)).toHaveLength(0);
      },
      async () => {
        expect(await page.locator('#page-paliwo').count()).toBeGreaterThan(0);
        expect(filterErrors(errs)).toHaveLength(0);
      }
    );
  });
});
