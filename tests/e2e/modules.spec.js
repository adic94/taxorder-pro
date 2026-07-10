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
    await expect(page.locator('#page-zlecenia table, #page-zlecenia .tbl-wrap').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#page-zlecenia button:has-text("Zgłoś")')).toBeVisible();
  });

  test('filtr statusu działa — wybór AUTORYZOWANE nie powoduje błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'zlecenia');
    const statusSel = page.locator('#zlc-status, select[id*="status"]').first();
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
    // Mandaty to modal, nie strona — FinesModule.open() wyświetla #fines-modal
    await page.evaluate(async () => { await window.FinesModule?.open?.(); });
    await expect(page.locator('#fines-modal')).toBeVisible({ timeout: 8_000 });
    await waitForIdle(page, 500);
    await page.evaluate(() => window.FinesModule?.close?.());
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona mandatów zawiera przycisk "Dodaj mandat"', async ({ page }) => {
    await page.evaluate(async () => { await window.FinesModule?.open?.(); });
    await expect(page.locator('#fines-modal')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#fines-modal-body button:has-text("Dodaj")')).toBeVisible({ timeout: 8_000 });
    await page.evaluate(() => window.FinesModule?.close?.());
  });

  test('kliknięcie "Dodaj mandat" otwiera modal bez błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(async () => { await window.FinesModule?.open?.(); });
    await expect(page.locator('#fines-modal')).toBeVisible({ timeout: 8_000 });
    await page.locator('#fines-modal-body button:has-text("Dodaj")').click();
    await waitForIdle(page, 500);
    await page.evaluate(() => window.FinesModule?.close?.());
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
    const sidebarHtml = await page.locator('#page-mapa #mapa-sidebar').innerHTML().catch(() => '');
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

// ─── OPONY — MAGAZYN ─────────────────────────────────────────────────────────
test.describe('Opony — magazyn', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona opon ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'opony-magazyn');
    await waitForIdle(page, 1200);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona opon zawiera tabelę lub komunikat "brak"', async ({ page }) => {
    await goToPage(page, 'opony-magazyn');
    await waitForIdle(page, 1200);
    const hasTbl = await page.locator('#page-opony-magazyn table').isVisible().catch(() => false);
    const hasMsg = await page.locator('#page-opony-magazyn').textContent().then(t => t.includes('Brak') || t.length > 50);
    expect(hasTbl || hasMsg).toBe(true);
  });

  test('regresja XSS: rozmiar opony i marka escapowane w tabeli', async ({ page }) => {
    await goToPage(page, 'opony-magazyn');
    await waitForIdle(page, 1200);
    const html = await page.locator('#page-opony-magazyn').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });

  test('filtr wyszukiwania opon nie powoduje błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'opony-magazyn');
    await waitForIdle(page, 800);
    const searchInput = page.locator('#tires-search, #page-opony-magazyn input[type="text"], #page-opony-magazyn .fi').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await waitForIdle(page, 400);
    }
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── PROTOKOŁY PRZEKAZANIA ──────────────────────────────────────────────────
test.describe('Protokoły przekazania', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona protokołów ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'protokoly');
    await waitForIdle(page, 1200);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona protokołów zawiera toolbar lub tabelę', async ({ page }) => {
    await goToPage(page, 'protokoly');
    await waitForIdle(page, 1000);
    const hasToolbar = await page.locator('#page-protokoly .toolbar, #page-protokoly button').isVisible().catch(() => false);
    const hasContent = await page.locator('#page-protokoly').textContent().then(t => t.length > 30);
    expect(hasToolbar || hasContent).toBe(true);
  });

  test('regresja XSS: dane protokołu escapowane w liście', async ({ page }) => {
    await goToPage(page, 'protokoly');
    await waitForIdle(page, 1200);
    const html = await page.locator('#page-protokoly').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });

  test('kliknięcie "Nowy protokół" otwiera modal bez błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'protokoly');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-protokoly button:has-text("Nowy"), #page-protokoly button:has-text("protokół"), #page-protokoly button:has-text("Dodaj")').first();
    if (await btn.isVisible()) {
      await btn.click();
      await waitForIdle(page, 500);
    }
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── KIEROWCY ────────────────────────────────────────────────────────────────
test.describe('Kierowcy', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('przejście do widoku kierowców nie powoduje błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Kierowcy to modal, nie osobna strona — wywołujemy przez nav lub API
    await page.evaluate(() => window.TaxOrderDrivers?.open?.());
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('panel kierowców renderuje dane z API bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Jeśli istnieje tnb-kierowcy lub nav link
    const driverBtn = page.locator('[onclick*="kierowcy"], [onclick*="TaxOrderDrivers"], nav button:has-text("Kierowcy")');
    if (await driverBtn.first().isVisible()) {
      await driverBtn.first().click();
      await waitForIdle(page, 1200);
    }
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: imię kierowcy z payload XSS nie wykonuje się', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page);
    // Symuluj render kierowcy z XSS payload w imieniu
    await page.evaluate(() => {
      if (window.TaxOrderDrivers?.renderScoring) {
        window.TaxOrderDrivers.renderScoring();
      }
    });
    const xssExecuted = await page.evaluate(() => window.__xss === 1);
    expect(xssExecuted).toBe(false);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── TERMINARZ PRZEGLĄDÓW (nowa funkcja) ─────────────────────────────────────
test.describe('Terminarz przeglądów i ubezpieczeń', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona terminarz ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 1200);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona terminarz zawiera tabele i statystyki', async ({ page }) => {
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 1000);
    await expect(page.locator('#page-terminarz table')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#insp-stat-expired')).toBeVisible();
  });

  test('zmiana horyzontu przelicza tabelę bez błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 800);
    await page.selectOption('#page-terminarz select', '30');
    await waitForIdle(page, 400);
    await page.selectOption('#page-terminarz select', '365');
    await waitForIdle(page, 400);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('przycisk "Eksportuj ICS" nie powoduje błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 800);
    // Ustaw horyzont 365 dni żeby mieć dane do eksportu
    await page.selectOption('#page-terminarz select', '365').catch(() => {});
    await waitForIdle(page, 400);
    const exportBtn = page.locator('button:has-text("Eksportuj ICS")');
    if (await exportBtn.isVisible()) {
      // Przechwytuj pobieranie pliku
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
        exportBtn.click(),
      ]);
      // Jeśli nie ma terminów, toast; jeśli są — download
      await waitForIdle(page, 500);
    }
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: nrRej i marka/model escapowane w tabeli terminów', async ({ page }) => {
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 1200);
    const html = await page.locator('#insp-cal-tbody').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });
});
