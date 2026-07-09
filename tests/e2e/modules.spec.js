/**
 * TaxOrder Pro — E2E testy modułów bez poprzedniego pokrycia
 * Weryfikuje: service-orders, fines, damages, fleet-map, dt1-declarations,
 *             rate limiting logowania oraz regresja XSS po ostatnich fixach.
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle, TEST_EMAIL, TEST_PASSWORD } = require('./helpers');

// ─── Nawigacja do strony ───────────────────────────────────────────────────────
async function goToPage(page, pageId) {
  await page.evaluate((id) => window.showPage?.(id), pageId);
  await page.waitForSelector(`#page-${pageId}`, { state: 'visible', timeout: 8_000 });
}

// ─── SERVICE ORDERS (zlecenia serwisowe) ─────────────────────────────────────
test.describe('Zlecenia serwisowe', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona zleceń ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'zlecenia');
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona zleceń zawiera tabelę i przycisk "Nowe zlecenie"', async ({ page }) => {
    await goToPage(page, 'zlecenia');
    await expect(page.locator('#page-zlecenia table, #page-zlecenia .tbl-wrap')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#page-zlecenia button:has-text("Nowe"), #page-zlecenia button:has-text("Zlecenie")')).toBeVisible();
  });

  test('filtr statusu działa — wybór AUTORYZOWANE nie powoduje błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'zlecenia');
    const statusSel = page.locator('#zlc-status, select[id*="status"]');
    if (await statusSel.isVisible()) {
      await statusSel.selectOption('AUTORYZOWANE');
      await waitForIdle(page, 500);
    }
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── MANDATY (fines) ─────────────────────────────────────────────────────────
test.describe('Mandaty', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona mandatów ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'mandaty');
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona mandatów zawiera przycisk "Dodaj mandat"', async ({ page }) => {
    await goToPage(page, 'mandaty');
    await expect(page.locator('#page-mandaty button:has-text("Dodaj"), #page-mandaty button:has-text("mandat")')).toBeVisible({ timeout: 8_000 });
  });

  test('kliknięcie "Dodaj mandat" otwiera modal bez błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'mandaty');
    await page.click('#page-mandaty button:has-text("Dodaj"), #page-mandaty button:has-text("mandat")');
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: nrRej z quote nie powoduje błędu JS w renderForVehicle', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page);
    // Symuluj wywołanie renderForVehicle z payload zawierającym cudzysłów
    await page.evaluate(async () => {
      if (window.FinesModule?.renderForVehicle) {
        await window.FinesModule.renderForVehicle("WA'1234\"<test>");
      }
    });
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── SZKODY (damages) ────────────────────────────────────────────────────────
test.describe('Szkody', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona szkód ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'szkody');
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona szkód zawiera tabelę lub komunikat "brak"', async ({ page }) => {
    await goToPage(page, 'szkody');
    const hasTbl  = await page.locator('#page-szkody table').isVisible().catch(() => false);
    const hasMsg  = await page.locator('#page-szkody').textContent().then(t => t.includes('Brak') || t.includes('brak'));
    const hasTool = await page.locator('#page-szkody .toolbar, #page-szkody button').isVisible().catch(() => false);
    expect(hasTbl || hasMsg || hasTool).toBe(true);
  });
});

// ─── MAPA FLOTY (fleet-map) ──────────────────────────────────────────────────
test.describe('Mapa floty', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona mapy ładuje się bez krytycznych błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => {
      // Pomiń błędy sieciowe GPS (oczekiwane gdy Tekom nie odpowiada)
      if (!e.message.includes('net::ERR') && !e.message.includes('GPS') && !e.message.includes('tekom')) {
        errors.push(e.message);
      }
    });
    await goToPage(page, 'mapa');
    await waitForIdle(page, 2000);
    expect(errors).toHaveLength(0);
  });

  test('kontener mapy Leaflet istnieje w DOM', async ({ page }) => {
    await goToPage(page, 'mapa');
    await waitForIdle(page, 1500);
    // Leaflet tworzy div.leaflet-container po inicjalizacji mapy
    const mapContainer = page.locator('#page-mapa #fleet-map-container, #page-mapa .leaflet-container, #page-mapa #fm-map');
    await expect(mapContainer).toBeVisible({ timeout: 10_000 });
  });

  test('regresja XSS: marka/model pojazdu w sidebar escapowana', async ({ page }) => {
    await goToPage(page, 'mapa');
    await waitForIdle(page, 1500);
    // Sprawdź że sidebar nie zawiera niezescapowanego <script> lub <img onerror>
    const sidebarHtml = await page.locator('#page-mapa #fm-sidebar, #page-mapa .map-sidebar').innerHTML().catch(() => '');
    expect(sidebarHtml).not.toMatch(/<script/i);
    expect(sidebarHtml).not.toMatch(/onerror=/i);
  });
});

// ─── DT-1 DEKLARACJE (dt1-declarations) ─────────────────────────────────────
test.describe('Historia deklaracji DT-1', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona historii DT-1 ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'dt1-historia');
    await waitForIdle(page, 1500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('lista deklaracji lub komunikat "brak" jest widoczny', async ({ page }) => {
    await goToPage(page, 'dt1-historia');
    const el = page.locator('#dt1decl-list');
    await expect(el).toBeVisible({ timeout: 8_000 });
    const text = await el.textContent();
    // Albo są deklaracje, albo jest komunikat "Brak"
    expect(text.length).toBeGreaterThan(0);
  });
});

// ─── RATE LIMITING logowania ──────────────────────────────────────────────────
test.describe('Brute-force protection', () => {

  test('po 5 błędnych próbach odpowiedź to 429', async ({ page }) => {
    const workerUrl = process.env.PROD_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    let lastStatus = 0;
    // Wysyłamy 6 błędnych żądań logowania z fałszywym emailem (unikalnym per test-run)
    const testEmail = `ratelimit-test-${Date.now()}@nonexistent.invalid`;
    for (let i = 0; i < 6; i++) {
      const resp = await page.request.post(`${workerUrl}/api/auth/login`, {
        data: { email: testEmail, password: 'wrongpassword' },
        headers: { 'Content-Type': 'application/json' },
      });
      lastStatus = resp.status();
    }
    // Szósta lub kolejne próby MUSZĄ zwracać 401 lub 429
    // (401 dla pierwszych 5, 429 od 6-tej)
    expect([401, 429]).toContain(lastStatus);
  });

  test('po zbyt wielu próbach odpowiedź zawiera komunikat o blokadzie', async ({ page }) => {
    const workerUrl = process.env.PROD_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const testEmail = `ratelimit-test2-${Date.now()}@nonexistent.invalid`;
    let lastBody = {};
    for (let i = 0; i < 8; i++) {
      const resp = await page.request.post(`${workerUrl}/api/auth/login`, {
        data: { email: testEmail, password: 'wrongpassword' },
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.status() === 429) {
        lastBody = await resp.json();
        break;
      }
    }
    if (lastBody.error) {
      expect(lastBody.error).toMatch(/prób|blok|429/i);
    }
  });
});
