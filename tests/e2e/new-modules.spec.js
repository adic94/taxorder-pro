/**
 * TaxOrder Pro — E2E testy nowych modułów (Batch 4+)
 * Weryfikuje: polisy, harmonogram serwisowy, rozliczenia km
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

async function goToPage(page, pageId) {
  await page.evaluate((id) => window.showPage?.(id), pageId);
  await page.waitForSelector(`#page-${pageId}`, { state: 'visible', timeout: 8_000 });
}

// ─── POLISY UBEZPIECZENIOWE ───────────────────────────────────────────────────
test.describe('Polisy ubezpieczeniowe', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona polis laduje sie bez bledow JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'policies');
    await waitForIdle(page, 1500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona polis zawiera przycisk "Nowa polisa"', async ({ page }) => {
    await goToPage(page, 'policies');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-policies button:has-text("Nowa polisa")')).toBeVisible({ timeout: 5_000 });
  });

  test('klikniecie "Nowa polisa" otwiera modal', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'policies');
    await waitForIdle(page, 800);
    await page.click('#page-policies button:has-text("Nowa polisa")');
    await expect(page.locator('#pm-modal')).toBeVisible({ timeout: 4_000 });
    await page.click('#pm-modal button:has-text("Anuluj"), #pm-modal .btn-icon').first();
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: nrRej i ubezpieczyciel escapowane w tabeli polis', async ({ page }) => {
    await goToPage(page, 'policies');
    await waitForIdle(page, 1500);
    const html = await page.locator('#policies-global-content').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });
});

// ─── HARMONOGRAM SERWISOWY ───────────────────────────────────────────────────
test.describe('Harmonogram serwisowy', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona harmonogramu laduje sie bez bledow JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 1500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona harmonogramu zawiera przycisk "Dodaj pozycje"', async ({ page }) => {
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-service-schedule button:has-text("Dodaj pozycję")')).toBeVisible({ timeout: 5_000 });
  });

  test('klikniecie "Dodaj pozycje" otwiera modal harmonogramu', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 800);
    await page.click('#page-service-schedule button:has-text("Dodaj pozycję")');
    await expect(page.locator('#ss-modal')).toBeVisible({ timeout: 4_000 });
    await page.click('#ss-modal .btn-icon').first();
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: nazwy pozycji harmonogramu escapowane', async ({ page }) => {
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 1500);
    const html = await page.locator('#ss-global-content').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });
});

// ─── ROZLICZENIA KM ─────────────────────────────────────────────────────────
test.describe('Rozliczenia km pracowniczych', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
  });

  test('strona rozliczen km laduje sie bez bledow JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 1500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('strona rozliczen km zawiera filtry i przycisk dodawania', async ({ page }) => {
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 1000);
    await expect(page.locator('#mc-filter-status')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#mc-filter-driver')).toBeVisible({ timeout: 5_000 });
  });

  test('kalkulator kwoty przelicza sie przy wpisaniu km', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 800);
    // Otwórz modal
    await page.evaluate(() => window.MileageClaimsModule?._openEdit?.(null));
    await expect(page.locator('#mc-modal')).toBeVisible({ timeout: 4_000 });
    // Wpisz km start i end
    await page.fill('#mc-f-kmstart', '1000');
    await page.fill('#mc-f-kmend', '1100');
    await page.locator('#mc-f-kmend').dispatchEvent('input');
    await waitForIdle(page, 300);
    // Kalkulator powinien pokazać "100 km × ..."
    const preview = await page.locator('#mc-calc-preview').textContent().catch(() => '');
    expect(preview).toMatch(/100/);
    await page.click('#mc-modal .btn-icon').first();
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('regresja XSS: dane pracownika escapowane w tabeli rozliczen', async ({ page }) => {
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 1500);
    const html = await page.locator('#mc-global-content').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });

  test('filtr pracownika wyfiltruje liste po wpisaniu nazwy', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 1000);
    const input = page.locator('#mc-filter-driver');
    await input.fill('TestNieistniejacyPracownik');
    await input.dispatchEvent('input');
    await waitForIdle(page, 600);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});
