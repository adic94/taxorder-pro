/**
 * E2E — Deklaracja DT-1 / DT-1/A
 * Testuje: nawigację, widoczność strony, historię deklaracji
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle, navigateTo } = require('./helpers');

test.describe('DT-1 — Deklaracje podatkowe', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
  });

  // ─── Strona formularza DT-1 ────────────────────────────────────────────────

  test('przycisk "Deklaracja DT-1" jest w nawigacji', async ({ page }) => {
    // Sekcja PODATKI jest ukryta dopóki switchSection('podatki') jej nie otworzy.
    // Sprawdzamy obecność w DOM — widoczność zależy od aktywnej sekcji sidebara.
    await expect(page.locator('#tnb-formularze')).toBeAttached();
  });

  test('strona DT-1 ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona DT-1 zawiera przycisk "Pobierz PDF"', async ({ page }) => {
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    await expect(page.locator('#btn-pobierz-pdf')).toBeVisible();
  });

  test('strona DT-1 zawiera sekcję wyboru podatnika', async ({ page }) => {
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    // Musi być select lub input wyboru firmy/podatnika
    const taxpayerEl = page.locator('#page-formularze select, #page-formularze input[type="text"]').first();
    await expect(taxpayerEl).toBeVisible({ timeout: 5_000 });
  });

  // ─── Historia deklaracji DT-1 ──────────────────────────────────────────────

  test('strona historii DT-1 ładuje się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await navigateTo(page, 'formularze'); // otwiera sekcję PODATKI
    const histBtn = page.locator('#tnb-dt1-historia');
    if (!(await histBtn.isVisible())) { test.skip(); return; }
    await histBtn.click();
    await page.waitForSelector('#page-dt1-historia', { state: 'visible', timeout: 8_000 });
    await waitForIdle(page, 1000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona historii DT-1 zawiera kontener listy deklaracji', async ({ page }) => {
    await navigateTo(page, 'formularze'); // otwiera sekcję PODATKI
    const histBtn = page.locator('#tnb-dt1-historia');
    if (!(await histBtn.isVisible())) { test.skip(); return; }
    await histBtn.click();
    await page.waitForSelector('#page-dt1-historia', { state: 'visible', timeout: 8_000 });
    await expect(page.locator('#dt1decl-list')).toBeVisible({ timeout: 5_000 });
  });

  // ─── TaxEngine — weryfikacja kalkulatora ───────────────────────────────────

  test('TaxEngine jest dostępny globalnie', async ({ page }) => {
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    const hasTaxEngine = await page.evaluate(() => typeof window.TaxEngine !== 'undefined');
    expect(hasTaxEngine).toBe(true);
  });

  test('TaxEngine.getCat() nie rzuca błędu dla typowego pojazdu', async ({ page }) => {
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    const result = await page.evaluate(() => {
      try {
        // Samochód ciężarowy, DMC 3500, rok 2020 — powinien zwrócić kategorię lub null
        const cat = window.TaxEngine?.getCat?.({ typ: 'samochód ciężarowy', dmc: 3500, rok: 2020 });
        return { ok: true, cat };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    expect(result.ok).toBe(true);
  });

  test('TaxEngine zwraca null dla pojazdu specjalnego (zwolnienie DT-1)', async ({ page }) => {
    await navigateTo(page, 'formularze');
    await page.waitForSelector('#page-formularze', { state: 'visible', timeout: 8_000 });
    const result = await page.evaluate(() => {
      // Pojazd specjalny jest zwolniony z podatku DT-1
      return window.TaxEngine?.getCat?.({ typ: 'pojazd specjalny', dmc: 5000, rok: 2020 });
    });
    expect(result).toBeNull();
  });
});
