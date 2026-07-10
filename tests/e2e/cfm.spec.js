/**
 * E2E — Moduł CFM (klienci, kontrakty, faktury)
 * Testuje: nawigację do stron CFM, obecność list i przycisków
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('CFM — Klienci', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-cfm-klienci');
    await page.waitForSelector('#page-cfm-klienci', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 1000);
  });

  test('strona klientów CFM otwiera się', async ({ page }) => {
    await expect(page.locator('#page-cfm-klienci')).toBeVisible();
  });

  test('tabela klientów CFM (#cfmk-tbody) jest w DOM', async ({ page }) => {
    await expect(page.locator('#cfmk-tbody')).toBeAttached();
  });

  test('przycisk "Nowy klient" jest widoczny', async ({ page }) => {
    const btn = page.locator('#page-cfm-klienci button[onclick*="openAdd"], #page-cfm-klienci button[onclick*="add"]').first();
    await expect(btn).toBeVisible();
  });
});

test.describe('CFM — Kontrakty', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-cfm-kontrakty');
    await page.waitForSelector('#page-cfm-kontrakty', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 1000);
  });

  test('strona kontraktów CFM otwiera się', async ({ page }) => {
    await expect(page.locator('#page-cfm-kontrakty')).toBeVisible();
  });

  test('tabela kontraktów CFM (#cfmu-tbody) jest w DOM', async ({ page }) => {
    await expect(page.locator('#cfmu-tbody')).toBeAttached();
  });
});

test.describe('CFM — Faktury', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await page.click('#tnb-cfm-faktury');
    await page.waitForSelector('#page-cfm-faktury', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 1000);
  });

  test('strona faktur CFM otwiera się', async ({ page }) => {
    await expect(page.locator('#page-cfm-faktury')).toBeVisible();
  });

  test('tabela faktur CFM (#cfmf-tbody) jest w DOM', async ({ page }) => {
    await expect(page.locator('#cfmf-tbody')).toBeAttached();
  });
});
