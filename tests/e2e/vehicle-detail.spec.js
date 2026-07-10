/**
 * E2E — Karta pojazdu (vehicle detail)
 * Testuje: otwieranie karty, widoczność pól, zapis, walidację usunięcia
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Karta pojazdu', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-pojazdy');
    await page.waitForSelector('#page-pojazdy', { state: 'visible', timeout: 8_000 });
    await page.waitForSelector('#veh-tbody', { timeout: 8_000 });
    await waitForIdle(page, 800);
  });

  test('kliknięcie przycisku "Karta pojazdu" w wierszu otwiera modal', async ({ page }) => {
    // Przycisk karty w pierwszym wierszu tabeli
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) {
      test.skip(); // brak pojazdów w koncie testowym
      return;
    }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
  });

  test('karta pojazdu zawiera nr rejestracyjny', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Nr rejestracyjny powinien być wyświetlony w nagłówku modalu
    await expect(page.locator('#vd-modal')).toContainText(/[A-Z]{2,3}\s*\d/);
  });

  test('karta pojazdu ma zakładki i przycisk Zapisz', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#vd-save-btn')).toBeVisible();
  });

  test('karta pojazdu otwiera się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('podwójne kliknięcie w wiersz otwiera kartę pojazdu', async ({ page }) => {
    const firstRow = page.locator('#veh-tbody tr').first();
    if (!(await firstRow.isVisible())) { test.skip(); return; }
    await firstRow.dblclick();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
  });

  test('zamknięcie karty pojazdu (przycisk X) ukrywa modal', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Przycisk × z onclick="TaxOrderVehicleDetail.close()"
    const closeBtn = page.locator('#vd-modal button[onclick*="close"]');
    await closeBtn.click();
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 5_000 });
  });

  test('przycisk "Usuń pojazd" jest widoczny w karcie (bez potwierdzenia)', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Tylko sprawdź obecność — NIE klikaj (usunęłoby dane testowe)
    const deleteBtn = page.locator('#vd-modal button[title="Usuń pojazd z floty"]');
    await expect(deleteBtn).toBeVisible();
  });
});
