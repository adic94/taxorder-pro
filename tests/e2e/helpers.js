/**
 * Wspólne helpery dla testów Playwright
 */

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASS     || 'testpassword';
const TEST_COMPANY  = process.env.TEST_COMPANY  || 'demo';

/**
 * Zaloguj się do aplikacji i poczekaj na załadowanie listy pojazdów.
 */
async function login(page) {
  await page.goto('/');
  await page.waitForSelector('#login-email, [data-testid="login-email"], input[type="email"]', { timeout: 10_000 });
  const emailSel = '#login-email';
  const passSel  = '#login-pass';
  const btnSel   = '#login-btn, button[type="submit"]';
  await page.fill(emailSel, TEST_EMAIL);
  await page.fill(passSel, TEST_PASSWORD);
  await page.click(btnSel);
  // Poczekaj na nawigację lub pojawienie się elementu po zalogowaniu
  await page.waitForSelector('#page-dash, .pg-title', { timeout: 15_000 });
}

/**
 * Poczekaj na zniknięcie toasta / loadera.
 */
async function waitForIdle(page, ms = 1000) {
  await page.waitForTimeout(ms);
}

module.exports = { login, waitForIdle, TEST_EMAIL, TEST_PASSWORD, TEST_COMPANY };
