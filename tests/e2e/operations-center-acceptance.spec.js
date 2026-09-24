const { test, expect } = require('@playwright/test');
const { login, navigateTo } = require('./helpers');

const UAT_API_URL = process.env.UAT_API_URL || '';

test.describe('Centrum operacyjne A–F — UAT', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL && !process.env.TEST_TOKEN) test.skip();
    // Lokalny frontend może bez modyfikacji plików testować odseparowany Worker UAT.
    if (UAT_API_URL) {
      await page.addInitScript(apiUrl => { window.__TAXORDER_API_URL__ = apiUrl; }, UAT_API_URL);
      // storageState przenosi localStorage (token), lecz nie sessionStorage. SPA wymaga
      // obu wartości do bezpiecznego odtworzenia widoku po ponownym otwarciu strony.
      await page.addInitScript(email => {
        if (email) sessionStorage.setItem('dt1_user_email', email);
      }, process.env.TEST_EMAIL || '');
    }
    await login(page);
  });

  test('dyspozytor otwiera workbench, centrum integracji i automatyzacje', async ({ page }) => {
    const centers = [
      ['operations-workbench', 'Centrum operacyjne'],
      ['integration-hub', 'Centrum integracji'],
      ['automation-center', 'Automatyzacje kosztowe'],
    ];
    for (const [id, heading] of centers) {
      await navigateTo(page, id);
      await expect(page.locator(`#page-${id}`)).toBeVisible();
      await expect(page.locator(`#page-${id}`)).toContainText(heading);
      await expect(page.locator(`#page-${id} .empty-state`)).toHaveCount(0);
    }
  });

  test('integracje komunikują obsługę XLSM i dry-run', async ({ page }) => {
    const apiResponse = page.waitForResponse(r => r.url().includes('/api/integration-hub/overview'));
    await navigateTo(page, 'integration-hub');
    const response = await apiResponse;
    expect(response.url()).toContain(UAT_API_URL);
    expect(response.status()).toBe(200);
    const content = page.locator('#page-integration-hub');
    await expect(content).toContainText('XLSM');
    await expect(content).toContainText('dry-run');
  });

  test('automatyzacje ujawniają tryb reguły i explainable log', async ({ page }) => {
    const apiResponse = page.waitForResponse(r => r.url().includes('/api/automation-center/overview'));
    await navigateTo(page, 'automation-center');
    const response = await apiResponse;
    expect(response.url()).toContain(UAT_API_URL);
    expect(response.status()).toBe(200);
    const content = page.locator('#page-automation-center');
    await expect(content).toContainText('Automatyzacje kosztowe');
    await expect(content).toContainText('Explainable log');
    await expect(content.locator('tbody tr').first()).toBeVisible();
  });
});
