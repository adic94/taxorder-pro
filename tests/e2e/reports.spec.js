/**
 * E2E — Strona raportów
 * Testuje: nawigację, widoczność KPI, wykresów, przycisku eksportu
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Strona raportów', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-raporty');
    await page.waitForSelector('#page-raporty', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 800);
  });

  test('strona raportów otwiera się po kliknięciu w nawigację', async ({ page }) => {
    await expect(page.locator('#page-raporty')).toBeVisible();
  });

  test('widoczne są przyciski filtrowania roku', async ({ page }) => {
    const yearFilter = page.locator('#page-raporty').locator('[data-yr], .yr-btn, select').first();
    await expect(yearFilter.or(page.locator('#page-raporty .btn').first())).toBeVisible();
  });

  test('przycisk eksportu Excel jest widoczny', async ({ page }) => {
    await expect(page.locator('#page-raporty button[onclick*="exportRaport"]')).toBeVisible();
  });

  test('obszar wykresu słupkowego jest obecny w DOM', async ({ page }) => {
    const chart = page.locator('#rp-chart');
    await expect(chart).toBeAttached();
  });

  test('obszar wykresu kołowego jest obecny w DOM', async ({ page }) => {
    const pie = page.locator('#rp-pie');
    await expect(pie).toBeAttached();
  });

  test('strona raportów ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.click('#tnb-raporty');
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});
