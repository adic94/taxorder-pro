/**
 * E2E — Strona webhooków
 * Testuje: nawigację, listę, przycisk dodawania
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle, navigateTo } = require('./helpers');

test.describe('Webhooki', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await navigateTo(page, 'webhooks');
    await page.waitForSelector('#page-webhooks', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 800);
  });

  test('strona webhooków otwiera się', async ({ page }) => {
    await expect(page.locator('#page-webhooks')).toBeVisible();
  });

  test('kontener listy webhooków (#webhooks-list) jest w DOM', async ({ page }) => {
    await expect(page.locator('#webhooks-list')).toBeAttached();
  });

  test('przycisk "Nowy webhook" jest widoczny', async ({ page }) => {
    await expect(page.locator('#page-webhooks button[onclick*="openModal"]')).toBeVisible();
  });

  test('kliknięcie "Nowy webhook" otwiera modal', async ({ page }) => {
    await page.click('#page-webhooks button[onclick*="openModal"]');
    await expect(page.locator('#webhook-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('strona webhooków ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await navigateTo(page, 'webhooks');
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});
