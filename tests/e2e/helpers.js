/**
 * Wspólne helpery dla testów Playwright
 */

const TEST_EMAIL    = process.env.TEST_EMAIL    || '';
const TEST_PASSWORD = process.env.TEST_PASS     || '';
const TEST_COMPANY  = process.env.TEST_COMPANY  || '';

/**
 * Zaloguj się do aplikacji i poczekaj na załadowanie pulpitu.
 *
 * Kiedy playwright.config.js ustawia storageState (.auth-state.json z globalSetup),
 * SPA wykrywa zapisaną sesję i ukrywa login-screen samodzielnie — ta funkcja wraca
 * od razu bez wysyłania żadnego żądania do API (0 prób logowania, brak ryzyka rate-limit).
 *
 * Kiedy storageState nie jest ustawiony (brak TEST_EMAIL), wykonuje pełne logowanie.
 * Rzuca błąd z czytelnym komunikatem gdy login API zwróci błąd.
 */
async function login(page) {
  await page.goto('/');

  // Daj SPA do 5s na auto-restore sesji z sessionStorage (zapisanego przez globalSetup).
  // Jeśli login-screen zniknie w tym czasie — jesteśmy już zalogowani.
  const alreadyIn = await page
    .waitForSelector('#login-screen', { state: 'hidden', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (alreadyIn) return;

  // Login-screen nadal widoczny — wykonaj pełne logowanie przez formularz.
  if (!TEST_EMAIL) throw new Error('TEST_EMAIL nie ustawiony — ustaw zmienną środowiskową lub dodaj do .env');

  await page.waitForSelector('#login-email', { timeout: 8_000 });
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
