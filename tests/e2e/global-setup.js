/**
 * Playwright globalSetup — logowanie raz przed całą sesją testową.
 *
 * Tryby autoryzacji konta admina (pierwsze pasujące):
 *  1. TEST_TOKEN — gotowy token sesji (z localStorage.cf_token w przeglądarce).
 *     Pozwala pominąć logowanie przez formularz. Wystarczy skopiować token z DevTools.
 *  2. TEST_EMAIL + TEST_PASS — pełne logowanie przez formularz.
 *
 * Zapisuje stan przeglądarki (localStorage) do tests/e2e/.auth-state.json.
 * Wszystkie testy admina korzystają z tego pliku (storageState w playwright.config.js).
 *
 * DRUGIE KONTO (nie-admin) — TEST_EMAIL_NONADMIN + TEST_PASS_NONADMIN, opcjonalne.
 * Loguje się zawsze przez formularz (to konto nie ma odpowiednika trybu TEST_TOKEN)
 * i zapisuje stan do osobnego pliku .auth-state-nonadmin.json, używanego wyłącznie
 * przez projekt `nonadmin` w playwright.config.js. Bez tych zmiennych blok jest
 * pomijany — main suite (286 testów na koncie admina) nie jest tym w żaden sposób
 * dotknięty. Powód istnienia: dług „konto CI głównego suite loguje się jako admin,
 * regresja w gatingu uprawnień na poziomie UI nie zostanie wykryta" (CLAUDE.md).
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Klucze determinizujące widok, wspólne dla obu kont — bez nich CI zależy od stanu
// przeglądarki sprzed testu i pada niedeterministycznie (patrz dług w CLAUDE.md).
// addInitScript() nie modyfikuje storageState — trzeba ustawić localStorage
// bezpośrednio na stronie, zanim storageState() to snapshoutuje.
async function pinujWidokIZapisz(context, page, authPath, company) {
  await page.evaluate((firma) => {
    localStorage.setItem('taxorder_prefs_kv_source', 'local');
    localStorage.setItem('slim_table',               'false');
    localStorage.setItem('fleetViewMode',            'fleet');
    localStorage.setItem('onboarding_done',          '1');
    localStorage.setItem('ks-hint-shown',            '1');
    if (firma) localStorage.setItem('currentCompany', firma);
  }, company || '');
  await context.storageState({ path: authPath });
}

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
  } else {
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

    await pinujWidokIZapisz(context, page, authPath, process.env.TEST_COMPANY || '');
    await browser.close();
  }

  // Drugie konto (nie-admin) — niezależne od tego, którym trybem zalogował się admin.
  // Zawsze przez formularz: to konto nie ma odpowiednika TEST_TOKEN.
  const hasNonAdminCreds = !!(process.env.TEST_EMAIL_NONADMIN && process.env.TEST_PASS_NONADMIN);
  if (hasNonAdminCreds) {
    const authPathNonAdmin = path.join(process.cwd(), 'tests/e2e/.auth-state-nonadmin.json');
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page    = await context.newPage();

    try {
      const { login } = require('./helpers');
      await login(page, process.env.TEST_EMAIL_NONADMIN, process.env.TEST_PASS_NONADMIN);
    } catch (e) {
      await browser.close();
      throw new Error(
        `[globalSetup] Nie można zalogować się kontem nie-admina.\n` +
        `  Sprawdź TEST_EMAIL_NONADMIN / TEST_PASS_NONADMIN.\n` +
        `  Szczegóły: ${e.message}`
      );
    }

    await pinujWidokIZapisz(
      context, page, authPathNonAdmin,
      process.env.TEST_COMPANY_NONADMIN || 'gcon'
    );
    await browser.close();
    console.log('[globalSetup] Auth state konta nie-admina zapisany (.auth-state-nonadmin.json).');
  }
};
