/**
 * E2E — Modularny kokpit
 * Wymaga zalogowanego użytkownika: ustaw TEST_EMAIL i TEST_PASS
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Modularny kokpit', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    // Upewnij się że jesteśmy na pulpicie
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
  });

  test('przycisk "Dostosuj kokpit" jest widoczny', async ({ page }) => {
    await expect(page.locator('button:has-text("Dostosuj kokpit")')).toBeVisible();
  });

  test('kliknięcie "Dostosuj kokpit" otwiera modal', async ({ page }) => {
    await page.click('button:has-text("Dostosuj kokpit")');
    await expect(page.locator('#modal-dash-customize')).toBeVisible();
    await expect(page.locator('#dash-customize-list li')).toHaveCount(6);
  });

  test('modal zawiera wszystkie 6 widgetów z checkboxami', async ({ page }) => {
    await page.click('button:has-text("Dostosuj kokpit")');
    const items = page.locator('#dash-customize-list li');
    await expect(items).toHaveCount(6);
    const checkboxes = page.locator('#dash-customize-list input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(6);
  });

  test('odznaczenie widgetu i zapisanie ukrywa sekcję', async ({ page }) => {
    await page.click('button:has-text("Dostosuj kokpit")');
    // Odznacz "Aktywność floty" przez ID checkboxa (niezależnie od kolejności w liście)
    const activityChk = page.locator('#dw-chk-activity');
    await expect(activityChk).toBeVisible({ timeout: 3000 });
    if (await activityChk.isChecked()) {
      await activityChk.uncheck();
    }
    await page.click('#modal-dash-customize button:has-text("Zapisz")');
    await waitForIdle(page);
    // Widget aktywności w layoucie powinien być ukryty (szukamy tylko w #dash-layout)
    const activityWidget = page.locator('#dash-layout [data-wid="activity"]');
    await expect(activityWidget).toBeHidden();
    // Przywróć domyślny
    await page.click('button:has-text("Dostosuj kokpit")');
    await page.click('#modal-dash-customize button:has-text("Domyślny")');
    await waitForIdle(page);
  });

  test('anulowanie modalu — brak zmian w układzie', async ({ page }) => {
    const widgetCount = await page.locator('[data-wid]:visible').count();
    await page.click('button:has-text("Dostosuj kokpit")');
    // Odznacz pierwszy widget
    await page.locator('#dash-customize-list input[type="checkbox"]').first().uncheck();
    // Anuluj
    await page.click('#modal-dash-customize button:has-text("Anuluj")');
    await waitForIdle(page);
    // Liczba widocznych widgetów bez zmian
    const widgetCountAfter = await page.locator('[data-wid]:visible').count();
    expect(widgetCountAfter).toBe(widgetCount);
  });

  test('"Domyślny" przywraca wszystkie widgety', async ({ page }) => {
    // Ukryj kilka widgetów
    await page.click('button:has-text("Dostosuj kokpit")');
    const checks = page.locator('#dash-customize-list input[type="checkbox"]');
    for (let i = 0; i < 3; i++) {
      if (await checks.nth(i).isChecked()) await checks.nth(i).uncheck();
    }
    await page.click('#modal-dash-customize button:has-text("Zapisz")');
    await waitForIdle(page);
    // Przywróć domyślny
    await page.click('button:has-text("Dostosuj kokpit")');
    await page.click('#modal-dash-customize button:has-text("Domyślny")');
    await waitForIdle(page);
    // Wszystkie 6 widgetów widoczne
    await expect(page.locator('[data-wid]:visible')).toHaveCount(6);
  });

  test('KPI strip jest widoczny po zalogowaniu', async ({ page }) => {
    await expect(page.locator('#dash-fleet-kpi')).toBeVisible();
  });

  test('sekcja alertów jest widoczna', async ({ page }) => {
    await expect(page.locator('[data-wid="alerts"]')).toBeVisible();
  });
});
