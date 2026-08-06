/**
 * Playwright globalSetup — logowanie raz przed całą sesją testową.
 *
 * Tryby autoryzacji (pierwsze pasujące):
 *  1. TEST_TOKEN — gotowy token sesji (z localStorage.cf_token w przeglądarce).
 *     Pozwala pominąć logowanie przez formularz. Wystarczy skopiować token z DevTools.
 *  2. TEST_EMAIL + TEST_PASS — pełne logowanie przez formularz.
 *
 * Zapisuje stan przeglądarki (localStorage) do tests/e2e/.auth-state.json.
 * Wszystkie testy korzystają z tego pliku (storageState w playwright.config.js).
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup(config) {
  const hasToken = !!process.env.TEST_TOKEN;
  const hasEmail = !!process.env.TEST_EMAIL;
  if (!hasToken && !hasEmail) return;

  const baseURL =
    process.env.TEST_URL ||
    config?.projects?.[0]?.use?.baseURL ||
    'http://localhost:3000';

  const authPath = path.join(process.cwd(), 'tests/e2e/.auth-state.json');

  // Tryb 1: TEST_TOKEN — zapisz bezpośrednio do auth-state bez otwierania przeglądarki
  if (hasToken) {
    const company = process.env.TEST_COMPANY || '';
    const authState = {
      cookies: [],
      origins: [{
        origin: baseURL,
        localStorage: [
          { name: 'cf_token',                   value: process.env.TEST_TOKEN },
          { name: 'currentCompany',             value: company },
          { name: 'taxorder_prefs_kv_source',   value: 'local' },
          { name: 'slim_table',                 value: 'false' },
          { name: 'fleetViewMode',              value: 'fleet' },
          { name: 'onboarding_done',            value: '1' },
          { name: 'ks-hint-shown',              value: '1' },
        ],
      }],
    };
    fs.mkdirSync(path.dirname(authPath), { recursive: true });
    fs.writeFileSync(authPath, JSON.stringify(authState, null, 2));
    console.log('[globalSetup] Auth state zapisany z TEST_TOKEN (bez logowania przez formularz).');
    return;
  }

  // Tryb 2: TEST_EMAIL + TEST_PASS — pełne logowanie przez formularz
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page    = await context.newPage();

  try {
    const { login } = require('./helpers');
    await login(page);
  } catch (e) {
    await browser.close();
    throw new Error(
      `[globalSetup] Nie można zalogować się do aplikacji.\n` +
      `  Sprawdź TEST_EMAIL / TEST_PASS lub użyj TEST_TOKEN.\n` +
      `  Szczegóły: ${e.message}`
    );
  }

  // Ustaw klucze determinizujące widok przed zapisem auth-state.
  // addInitScript() nie modyfikuje storageState — musimy ustawić localStorage
  // bezpośrednio na stronie, zanim storageState() to snapshoutuje.
  await page.evaluate((company) => {
    localStorage.setItem('taxorder_prefs_kv_source', 'local');
    localStorage.setItem('slim_table',               'false');
    localStorage.setItem('fleetViewMode',            'fleet');
    localStorage.setItem('onboarding_done',          '1');
    localStorage.setItem('ks-hint-shown',            '1');
    if (company) localStorage.setItem('currentCompany', company);
  }, process.env.TEST_COMPANY || '');

  await context.storageState({ path: authPath });

  await browser.close();
};
