const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const hasTestAuth = Boolean(
  process.env.TEST_TOKEN
  || (process.env.TEST_EMAIL && process.env.TEST_PASS)
);

test.describe('Mobilny interfejs @mobile', () => {
  test('kokpit mieści się w viewport bez poziomego przewijania', async ({ page }) => {
    test.skip(!hasTestAuth, 'Wymaga TEST_TOKEN albo TEST_EMAIL i TEST_PASS');

    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content, 'Strona powoduje poziomy overflow na urządzeniu mobilnym')
      .toBeLessThanOrEqual(dimensions.viewport + 1);
  });

  test('zoom 200% i dotyk nadal pozostają używalne', async ({ page }) => {
    test.skip(!hasTestAuth, 'Wymaga TEST_TOKEN albo TEST_EMAIL i TEST_PASS');
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });

    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });

    const state = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      focusable: document.querySelectorAll('button, a[href], input, select, textarea').length,
    }));

    expect(state.focusable).toBeGreaterThan(0);
    expect(state.content).toBeLessThanOrEqual(state.viewport + 1);

    const tapTarget = await page.locator('button, .btn, .tnb').first();
    await expect(tapTarget).toBeVisible();
    await tapTarget.tap();
  });
});
