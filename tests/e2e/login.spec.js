/**
 * E2E — Logowanie i autoryzacja
 */
const { test, expect } = require('@playwright/test');

test.describe('Logowanie', () => {

  test('strona startowa — widoczny formularz logowania', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-email, input[type="email"]').first()).toBeVisible();
    await expect(page.locator('#login-pass, input[type="password"]').first()).toBeVisible();
    await expect(page.locator('#login-btn, button[type="submit"]').first()).toBeVisible();
  });

  test('tytuł strony zawiera "TaxOrder"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TaxOrder/i);
  });

  test('błędne hasło → komunikat błędu (nie crash)', async ({ page }) => {
    await page.goto('/');
    await page.fill('#login-email', 'nie@istnieje.pl');
    await page.fill('#login-pass', 'zle_haslo_123');
    await page.click('#login-btn, button[type="submit"]');
    // Formularz logowania nadal widoczny (nie przeszło do pulpitu)
    await page.waitForTimeout(3000);
    await expect(page.locator('#login-email, input[type="email"]').first()).toBeVisible();
  });

  test('puste pola → brak nawigacji do pulpitu', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-btn, button[type="submit"]');
    await page.waitForTimeout(1000);
    // Nadal na stronie logowania
    await expect(page.locator('#login-email, input[type="email"]').first()).toBeVisible();
  });

  test('walidacja email — niepoprawny format', async ({ page }) => {
    await page.goto('/');
    await page.fill('#login-email', 'niejestemmail');
    await page.fill('#login-pass', 'haslo');
    await page.click('#login-btn, button[type="submit"]');
    await page.waitForTimeout(1000);
    // Formularz nadal widoczny
    await expect(page.locator('#login-email').first()).toBeVisible();
  });

  // Ten test wymaga prawidłowych danych — pominięty jeśli brak zmiennych środowiskowych
  test.skip(!process.env.TEST_EMAIL, 'Wymaga TEST_EMAIL i TEST_PASS');
  test('poprawne logowanie → widoczny pulpit', async ({ page }) => {
    const { login } = require('./helpers');
    await login(page);
    await expect(page.locator('#login-screen')).toBeHidden({ timeout: 5_000 });
  });
});
