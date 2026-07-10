/**
 * E2E — Autentykacja i rate limiting
 * Testuje: błędne hasło, blokada po 5 próbach (429), formularz logowania
 * UWAGA: Rate limiting używa klucza KV loginfail:${ip}:${email} — każdy email
 * ma niezależny licznik, więc test z innym emailem nie wpływa na CI account.
 */
const { test, expect } = require('@playwright/test');

const WORKER_URL = process.env.PROD_WORKER_URL
  || 'https://taxorder-pro-api.adamus1000.workers.dev';

// ─── Formularz logowania ──────────────────────────────────────────────────────

test.describe('Formularz logowania', () => {

  test('strona główna wyświetla formularz logowania gdy brak sesji', async ({ page }) => {
    // Otwórz stronę bez storageState (nowa karta, czysta sesja)
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    // Ekran logowania powinien być widoczny
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-pass')).toBeVisible();
  });

  test('błędne dane logowania wyświetlają komunikat błędu', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#login-screen', { state: 'visible', timeout: 10_000 });

    await page.fill('#login-email', 'nieistniejacy@example.com');
    await page.fill('#login-pass', 'BledneHaslo123!');
    await page.click('#login-btn');

    // Komunikat błędu: icon alert + tekst (element startuje pusty)
    await expect(page.locator('#login-err i.ti-alert-circle')).toBeAttached({ timeout: 8_000 });
  });

  test('puste pola logowania nie przechodzą walidacji', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#login-screen', { state: 'visible', timeout: 10_000 });

    await page.fill('#login-email', '');
    await page.fill('#login-pass', '');
    await page.click('#login-btn');

    // Ekran logowania nadal widoczny — nie zalogowano
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Rate limiting (API bezpośrednio) ────────────────────────────────────────

test.describe('Rate limiting logowania (API)', () => {

  test('5 nieudanych prób → 6. próba zwraca 429', async ({ request }) => {
    // Unikalny email — niezależny licznik KV, nie wpływa na konto CI
    const testEmail = `ratelimit-e2e-${Date.now()}@nowhere.invalid`;

    for (let i = 0; i < 5; i++) {
      await request.post(`${WORKER_URL}/api/auth/login`, {
        data: { email: testEmail, password: 'BledneHaslo!' },
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resp = await request.post(`${WORKER_URL}/api/auth/login`, {
      data: { email: testEmail, password: 'BledneHaslo!' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status()).toBe(429);
    const body = await resp.json();
    expect(body.error).toMatch(/prób|limit|zablok/i);
  });

  test('endpoint logowania zwraca 401 dla niepoprawnych danych', async ({ request }) => {
    const resp = await request.post(`${WORKER_URL}/api/auth/login`, {
      data: { email: 'test-single@nowhere.invalid', password: 'wrong' },
      headers: { 'Content-Type': 'application/json' },
    });
    // 401 = złe dane, 429 = rate limit (oba akceptowalne poza 200)
    expect([401, 429]).toContain(resp.status());
  });

  test('endpoint logowania wymaga pola email', async ({ request }) => {
    const resp = await request.post(`${WORKER_URL}/api/auth/login`, {
      data: { password: 'haslo' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status()).not.toBe(200);
  });

  test('endpoint logowania wymaga pola password', async ({ request }) => {
    const resp = await request.post(`${WORKER_URL}/api/auth/login`, {
      data: { email: 'ktos@example.com' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status()).not.toBe(200);
  });
});
