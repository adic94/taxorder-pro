/**
 * Playwright globalSetup — logowanie raz przed całą sesją testową.
 *
 * Zapisuje stan przeglądarki (localStorage + sessionStorage) do .auth-state.json.
 * Wszystkie testy korzystają z tego pliku (storageState w playwright.config.js),
 * więc żaden test nie musi osobno logować się przez API.
 *
 * Jeśli TEST_EMAIL nie jest ustawiony — plik nie jest tworzony, auth-testy skipują się same.
 */

const { chromium } = require('@playwright/test');

module.exports = async function globalSetup(config) {
  if (!process.env.TEST_EMAIL) return;

  const baseURL =
    process.env.TEST_URL ||
    config?.projects?.[0]?.use?.baseURL ||
    'http://localhost:3000';

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page    = await context.newPage();

  try {
    const { login } = require('./helpers');
    await login(page); // rzuca czytelny błąd jeśli dane są błędne (HTTP 401 / 429)
  } catch (e) {
    await browser.close();
    throw new Error(
      `[globalSetup] Nie można zalogować się do aplikacji.\n` +
      `  Sprawdź wartości TEST_EMAIL / TEST_PASS w GitHub → Settings → Secrets.\n` +
      `  Szczegóły: ${e.message}`
    );
  }

  await context.storageState({ path: 'tests/e2e/.auth-state.json' });
  await browser.close();
};
