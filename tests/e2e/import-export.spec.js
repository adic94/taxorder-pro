/**
 * E2E — Import/Eksport
 * Testuje: obecność przycisków w dropdownie Narzędzia i otwarcie modalu CSV import.
 *
 * Przyciski Import/Eksport są w #tools-dropdown (display:none domyślnie).
 * Sprawdzamy obecność w DOM (toBeAttached), nie widoczność.
 * Dla akcji modalnych: openTool() wywołuje funkcję przez evaluate() z pominięciem dropdown.
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle, openTool } = require('./helpers');

test.describe('Import/Eksport', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-pojazdy');
    await page.waitForSelector('#page-pojazdy', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 800);
  });

  test('przycisk "Import CSV" jest w DOM na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="CSVImport.open"]')).toBeAttached();
  });

  test('przycisk "Eksport CSV" jest w DOM na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportFleetCSV"]')).toBeAttached();
  });

  test('przycisk "Eksport PDF" jest w DOM na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportVehicleListPdf"]')).toBeAttached();
  });

  test('przycisk "Historia serwisów CSV" jest w DOM na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportServiceHistoryCsv"]')).toBeAttached();
  });

  test('kliknięcie "Import CSV" otwiera modal importu', async ({ page }) => {
    await openTool(page, 'CSVImport.open()');
    await expect(page.locator('#csv-import-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('przycisk "Import Excel" jest w DOM na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="VehicleImport.openModal"]')).toBeAttached();
  });
});
