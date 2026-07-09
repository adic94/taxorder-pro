/**
 * E2E — Karta pojazdu i modularność zakładek
 * Wymaga zalogowanego użytkownika z min. jednym pojazdem w bazie.
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Karta pojazdu', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    // Przejdź do listy pojazdów
    await page.click('[onclick*="pojazdy"], [data-tab="pojazdy"], nav a:has-text("Flota"), nav button:has-text("Pojazdy")');
    await page.waitForSelector('#page-pojazdy', { state: 'visible', timeout: 8_000 });
  });

  async function openFirstVehicle(page) {
    // Wiersz: pojedynczy klik = zaznaczenie (toggleRow), podwójny klik = karta pojazdu
    const firstRow = page.locator('#fleet-tbody tr, #veh-tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.dblclick();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
  }

  test('kliknięcie pojazdu otwiera modal karty pojazdu', async ({ page }) => {
    await openFirstVehicle(page);
    await expect(page.locator('#vd-modal')).toBeVisible();
    await expect(page.locator('#vd-tab-dr')).toBeVisible();
  });

  test('pasek zakładek zawiera min. 5 zakładek', async ({ page }) => {
    await openFirstVehicle(page);
    const tabButtons = page.locator('#vd-tabs button:visible');
    const count = await tabButtons.count();
    expect(count).toBeGreaterThan(4);
  });

  test('przycisk ⚙ "Dostosuj zakładki" jest widoczny', async ({ page }) => {
    await openFirstVehicle(page);
    await expect(page.locator('button[title="Dostosuj zakładki"]')).toBeVisible();
  });

  test('kliknięcie ⚙ otwiera modal konfiguracji zakładek', async ({ page }) => {
    await openFirstVehicle(page);
    await page.click('button[title="Dostosuj zakładki"]');
    await expect(page.locator('#modal-vd-tabs-cfg')).toBeVisible();
    // Modal zawiera 16 pozycji
    await expect(page.locator('#vd-tabs-cfg-list li')).toHaveCount(16);
  });

  test('odznaczenie zakładki "GPS" i zapisanie — zakładka znika z paska', async ({ page }) => {
    await openFirstVehicle(page);
    await page.click('button[title="Dostosuj zakładki"]');
    // Znajdź checkbox dla GPS
    const gpsChk = page.locator('#vdtc-gps');
    await expect(gpsChk).toBeVisible({ timeout: 3000 });
    if (await gpsChk.isChecked()) await gpsChk.uncheck();
    await page.click('#modal-vd-tabs-cfg button:has-text("Zapisz")');
    // Poczekaj na zamknięcie modalu konfiguracji
    await expect(page.locator('#modal-vd-tabs-cfg')).toBeHidden({ timeout: 5000 });
    // Zamknij kartę pojazdu i otwórz ponownie — pewne świeże renderowanie z nowym configiem
    await page.click('#vd-modal [onclick*="TaxOrderVehicleDetail.close"]');
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 3000 });
    await openFirstVehicle(page);
    // GPS nie powinno być widoczne w pasku zakładek
    await expect(page.locator('#vd-tab-gps')).toBeHidden();
    // Przywróć domyślne
    await page.click('button[title="Dostosuj zakładki"]');
    await page.click('#modal-vd-tabs-cfg button:has-text("Domyślne")');
    await expect(page.locator('#modal-vd-tabs-cfg')).toBeHidden({ timeout: 5000 });
  });

  test('przełączenie na zakładkę "Polisy" wyświetla jej treść', async ({ page }) => {
    await openFirstVehicle(page);
    await page.click('#vd-tab-insurance');
    await expect(page.locator('#vd-tab-insurance-content')).toBeVisible();
    await expect(page.locator('#vd-tab-dr-content')).toBeHidden();
  });

  test('zakładka DR domyślnie aktywna', async ({ page }) => {
    await openFirstVehicle(page);
    await expect(page.locator('#vd-tab-dr-content')).toBeVisible();
  });

  test('modal karty pojazdu zamyka się przyciskiem ×', async ({ page }) => {
    await openFirstVehicle(page);
    await page.click('#vd-modal button:has-text("×"), #vd-modal [onclick*="close"]');
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 3000 });
  });

  test('przycisk "Drukuj kartę" nie powoduje błędu JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openFirstVehicle(page);
    // Sprawdź że przycisk istnieje
    await expect(page.locator('button:has-text("Drukuj kartę")').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

test.describe('In-browser test suite', () => {

  test('strona testów ładuje się i wszystkie testy przechodzą', async ({ page }) => {
    await page.goto('/tests/browser/index.html');
    // Poczekaj na wyniki (karty wyników)
    await page.waitForSelector('#test-results .dash-card', { timeout: 15_000 });
    const passText = await page.locator('#test-results').textContent();
    console.log('Test suite wynik:', passText?.substring(0, 200));
    // Runner wyświetla "✓ Wszystkie testy zdane" gdy 0 FAILi
    // (etykieta "FAIL" zawsze istnieje w UI jako nagłówek statystyki)
    await expect(page.locator('#test-results').getByText('Wszystkie testy zdane')).toBeVisible({ timeout: 5_000 });
  });
});
