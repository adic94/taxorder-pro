/**
 * E2E — Import/Eksport
 * Testuje: otwarcie modalu CSV import, przyciski eksportu CSV i PDF na stronie pojazdów
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Import/Eksport', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-pojazdy');
    await page.waitForSelector('#page-pojazdy', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 800);
  });

  test('przycisk "Import CSV" jest widoczny na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="CSVImport.open"]')).toBeVisible();
  });

  test('przycisk "Eksport CSV" jest widoczny na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportFleetCSV"]')).toBeVisible();
  });

  test('przycisk "Eksport PDF" jest widoczny na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportVehicleListPdf"]')).toBeVisible();
  });

  test('przycisk "Historia serwisów CSV" jest widoczny na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="exportServiceHistoryCsv"]')).toBeVisible();
  });

  test('kliknięcie "Import CSV" otwiera modal importu', async ({ page }) => {
    await page.click('button[onclick*="CSVImport.open"]');
    const modal = page.locator('#csv-import-modal, .csv-import, [id*="csv"]').first();
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test('kliknięcie "Import Excel" jest widoczny na stronie pojazdów', async ({ page }) => {
    await expect(page.locator('button[onclick*="VehicleImport.openModal"]')).toBeVisible();
  });
});
