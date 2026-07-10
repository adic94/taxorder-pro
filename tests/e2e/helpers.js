/**
 * Wspólne helpery dla testów Playwright
 */

const TEST_EMAIL    = process.env.TEST_EMAIL    || '';
const TEST_PASSWORD = process.env.TEST_PASS     || '';
const TEST_COMPANY  = process.env.TEST_COMPANY  || '';

/**
 * Zaloguj się do aplikacji i poczekaj na załadowanie pulpitu.
 * Rzuca błąd z czytelnym komunikatem gdy login API zwróci błąd.
 */
async function login(page) {
  await page.goto('/');
  await page.waitForSelector('#login-email', { timeout: 10_000 });
  await page.fill('#login-email', TEST_EMAIL);
  await page.fill('#login-pass', TEST_PASSWORD);

  // Zaczekaj na odpowiedź API zanim sprawdzisz UI — inaczej waitForSelector może
  // trafić w okienko gdy JS jeszcze nie zdążył ukryć login-screen po otrzymaniu tokenu.
  const [resp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/auth/login'),
      { timeout: 20_000 }
    ),
    page.click('#login-btn, button[type="submit"]'),
  ]);

  if (!resp.ok()) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(
      `Login nieudany (HTTP ${resp.status()}): ${body.error || 'sprawdź TEST_EMAIL/TEST_PASS'}`
    );
  }

  // Login się powiódł — poczekaj aż SPA ukryje ekran logowania
  await page.waitForSelector('#login-screen', { state: 'hidden', timeout: 10_000 });
}

/**
 * Poczekaj na zniknięcie toasta / loadera.
 */
async function waitForIdle(page, ms = 1000) {
  await page.waitForTimeout(ms);
}

module.exports = { login, waitForIdle, TEST_EMAIL, TEST_PASSWORD, TEST_COMPANY };
