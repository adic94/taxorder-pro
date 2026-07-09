/**
 * E2E — Zarządzanie kolumnami tabeli floty
 * Testuje: panel widoczności, ukrywanie/pokazywanie kolumn, presety, reset domyślnych
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

test.describe('Zarządzanie kolumnami floty', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    // Przejdź do listy pojazdów
    await page.click('[onclick*="pojazdy"], [data-tab="pojazdy"], nav button:has-text("Pojazdy"), #tnb-pojazdy');
    await page.waitForSelector('#page-pojazdy', { state: 'visible', timeout: 8_000 });
    // Poczekaj na załadowanie tabeli
    await page.waitForSelector('#veh-thead', { timeout: 8_000 });
    // Wyczyść localStorage presetów na świeżym starcie
    await page.evaluate(() => {
      localStorage.removeItem('taxColPresets');
      localStorage.removeItem('taxColOrder');
      localStorage.removeItem('taxColVis');
    });
  });

  test('przycisk "Widoczność kolumn" jest widoczny na stronie floty', async ({ page }) => {
    await expect(page.locator('#col-vis-btn')).toBeVisible();
  });

  test('kliknięcie "Widoczność kolumn" otwiera panel', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();
  });

  test('panel zawiera listę kolumn z checkboxami', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();
    // Co najmniej 10 checkboxów (jest ich 32)
    const checks = page.locator('#col-order-list input[type="checkbox"]');
    const count = await checks.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('kliknięcie poza panelem zamyka go', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();
    // Kliknij gdzieś poza panelem (tytuł strony)
    await page.click('.pg-title');
    await expect(page.locator('#col-vis-panel')).toBeHidden();
  });

  test('odznaczenie kolumny "Rok" ukrywa ją z tabeli', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();

    // Znajdź checkbox odpowiadający kolumnie "rok"
    const rokChk = page.locator('#col-order-list [data-flcol="rok"] input[type="checkbox"]');
    await expect(rokChk).toBeVisible({ timeout: 3000 });

    if (await rokChk.isChecked()) {
      await rokChk.uncheck();
      // Poczekaj na re-render tabeli
      await waitForIdle(page, 500);
      // Kolumna rok nie powinna być w nagłówku
      await expect(page.locator('#veh-thead [data-col="rok"]')).toBeHidden();
    }

    // Przywróć domyślne
    await page.click('#col-vis-btn');
    await page.click('#col-vis-panel button:has-text("Resetuj domyślne")');
    await waitForIdle(page, 500);
  });

  test('przycisk "Resetuj domyślne" przywraca standardowy zestaw kolumn', async ({ page }) => {
    await page.click('#col-vis-btn');
    // Odznacz kilka kolumn
    const checks = page.locator('#col-order-list input[type="checkbox"]');
    for (let i = 0; i < 3; i++) {
      if (await checks.nth(i).isChecked()) await checks.nth(i).uncheck();
    }
    await waitForIdle(page, 300);

    // Resetuj
    await page.click('#col-vis-panel button:has-text("Resetuj domyślne")');
    await waitForIdle(page, 500);

    // Otwórz panel ponownie i sprawdź że checkbox "rok" jest zaznaczony
    await page.click('#col-vis-btn');
    const rokChk = page.locator('#col-order-list [data-flcol="rok"] input[type="checkbox"]');
    await expect(rokChk).toBeChecked();
  });

  test('zapisanie presetu kolumn pojawia się na liście presetów', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();

    // Wpisz nazwę presetu
    await page.fill('#col-preset-name', 'Test-preset-E2E');
    await page.click('#col-vis-panel button:has-text("Zapisz")');
    await waitForIdle(page, 300);

    // Preset powinien pojawić się na liście
    await expect(page.locator('#col-vis-panel').getByText('Test-preset-E2E')).toBeVisible();

    // Usuń preset (ikona X przy presecie)
    const deleteBtn = page.locator('#col-vis-panel button[title^="Usuń preset"]').first();
    await deleteBtn.click();
    await waitForIdle(page, 300);
    await expect(page.locator('#col-vis-panel').getByText('Test-preset-E2E')).toBeHidden();
  });

  test('widok DT-1 przełącza się przyciskiem w panelu', async ({ page }) => {
    await page.click('#col-vis-btn');
    await expect(page.locator('#col-vis-panel')).toBeVisible();

    await page.click('#col-vis-panel button:has-text("DT-1")');
    await waitForIdle(page, 500);

    // Po przełączeniu na DT-1 — kolumna "podatek" powinna być widoczna w thead
    await expect(page.locator('#veh-thead [data-col="podatek"]')).toBeVisible({ timeout: 3000 });

    // Przywróć widok Flota
    await page.click('#col-vis-btn');
    await page.click('#col-vis-panel button:has-text("Flota")');
    await waitForIdle(page, 500);
  });

  test('thead jest generowany dynamicznie — ma atrybut data-col na th', async ({ page }) => {
    // Nagłówki kolumn powinny mieć data-col dla ułatwienia testowania
    const ths = page.locator('#veh-thead [data-col]');
    const count = await ths.count();
    expect(count).toBeGreaterThan(5);
  });

  test('przycisk Filtry otwiera wiersz filtrów per kolumna', async ({ page }) => {
    // Wiersz filtrów domyślnie ukryty
    await expect(page.locator('#veh-filter-row')).toBeHidden();
    // Kliknij przycisk Filtry
    await page.click('#veh-filter-btn');
    await waitForIdle(page, 300);
    // Wiersz filtrów powinien być widoczny
    await expect(page.locator('#veh-filter-row')).toBeVisible();
    // Powinny być inputy do filtrowania
    const filterInputs = page.locator('#veh-filter-row .col-fi');
    const count = await filterInputs.count();
    expect(count).toBeGreaterThan(0);
    // Ukryj wiersz powrotem
    await page.click('#veh-filter-btn');
    await waitForIdle(page, 300);
    await expect(page.locator('#veh-filter-row')).toBeHidden();
  });

  test('filtr kolumny Nr rej. redukuje wyniki tabeli', async ({ page }) => {
    await page.click('#veh-filter-btn');
    await expect(page.locator('#veh-filter-row')).toBeVisible();

    const nrRejInput = page.locator('#veh-filter-row .col-fi').first();
    await nrRejInput.fill('XXXXNONEXISTENT9999');
    await waitForIdle(page, 500);

    // Tabela powinna pokazać 0 wierszy lub komunikat "Brak wyników"
    const rows = page.locator('#veh-tbody tr:not([style*="display:none"])');
    const rowCount = await rows.count();
    // Filtr działa jeśli wynikowy zestaw jest mniejszy od standardowego
    // — przy nieistniejącym numerze rej. powinno być 0 lub bardzo mało
    expect(rowCount).toBeLessThanOrEqual(1);

    // Wyczyść filtr
    await nrRejInput.fill('');
    await waitForIdle(page, 300);
    await page.click('#veh-filter-btn');
  });

  test('filtry kolumn persystują w localStorage', async ({ page }) => {
    await page.click('#veh-filter-btn');
    await expect(page.locator('#veh-filter-row')).toBeVisible();

    const nrRejInput = page.locator('#veh-filter-row .col-fi').first();
    await nrRejInput.fill('E2E-PERSIST');
    await waitForIdle(page, 500);

    // Sprawdź że filtr zapisał się w localStorage
    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('taxColFilters') || '{}'); } catch { return {}; }
    });
    expect(Object.values(saved).some(v => v === 'E2E-PERSIST')).toBe(true);

    // Wyczyść
    await nrRejInput.fill('');
    await waitForIdle(page, 300);
    await page.evaluate(() => localStorage.removeItem('taxColFilters'));
  });
});
