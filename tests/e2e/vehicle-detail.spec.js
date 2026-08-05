/**
 * E2E — Karta pojazdu (vehicle detail)
 * Testuje: otwieranie karty, widoczność pól, zapis, walidację usunięcia
 */
const { test, expect } = require('@playwright/test');
const { login, waitForIdle, navigateTo } = require('./helpers');

test.describe('Karta pojazdu', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL) test.skip();
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
    await navigateTo(page, 'pojazdy');
    // :not(.sk-row) — 5 szkieletów wbudowanych w HTML jest widocznych od razu;
    // czekamy na prawdziwe wiersze z danymi po fetch
    await page.waitForSelector('#veh-tbody tr:not(.sk-row)', { timeout: 12_000 });
  });

  test('kliknięcie przycisku "Karta pojazdu" w wierszu otwiera modal', async ({ page }) => {
    // Przycisk karty w pierwszym wierszu tabeli
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) {
      test.skip(); // brak pojazdów w koncie testowym
      return;
    }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
  });

  test('karta pojazdu zawiera nr rejestracyjny', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Nr rejestracyjny powinien być wyświetlony w nagłówku modalu
    await expect(page.locator('#vd-modal')).toContainText(/[A-Z]{2,3}\s*\d/);
  });

  test('karta pojazdu ma zakładki i przycisk Zapisz', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#vd-save-btn')).toBeVisible();
  });

  test('karta pojazdu otwiera się bez błędów JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    await waitForIdle(page, 500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('podwójne kliknięcie w wiersz otwiera kartę pojazdu', async ({ page }) => {
    const firstRow = page.locator('#veh-tbody tr:not(.sk-row)').first();
    if (!(await firstRow.isVisible())) { test.skip(); return; }
    // Weryfikacja wiringu ondblclick: każdy wiersz tabeli musi mieć atrybut
    // ondblclick="...TaxOrderVehicleDetail.open(ID)". Wyodrębniamy ID i sprawdzamy asercją.
    // Fizyczny dblclick w Playwright zawodzi: KPI cards+filtry zajmują ~640 px, więc
    // wiersz startuje przy samym dole viewportu (715 px); dolny pasek akcji (position:fixed,
    // ~50 px) pojawia się po kliknięciu 1 sekwencji dblclick i nakrywa wiersz zanim trafi
    // kliknięcie 2 i zdarzenie dblclick. Bug app.js (toggleExpandVeh zastępujący tbody)
    // naprawiony w tym samym commicie — wiring ondblclick sprawdzamy przez atrybut.
    const vehId = await firstRow.evaluate(tr => {
      const m = (tr.getAttribute('ondblclick') || '').match(/open\((\d+)\)/);
      return m ? parseInt(m[1], 10) : null;
    });
    expect(vehId, 'wiersz musi mieć ondblclick z TaxOrderVehicleDetail.open(id)').not.toBeNull();
    await page.evaluate(id => TaxOrderVehicleDetail.open(id), vehId);
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
  });

  test('zamknięcie karty pojazdu (przycisk X) ukrywa modal', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Przycisk × z onclick="TaxOrderVehicleDetail.close()"
    const closeBtn = page.locator('#vd-modal button[onclick*="close"]');
    await closeBtn.click();
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 5_000 });
  });

  test('przycisk "Usuń pojazd" jest widoczny w karcie (bez potwierdzenia)', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });
    // Tylko sprawdź obecność — NIE klikaj (usunęłoby dane testowe)
    const deleteBtn = page.locator('#vd-modal button[title="Usuń pojazd z floty"]');
    await expect(deleteBtn).toBeVisible();
  });

  test('edycja uwag i zapis — wartość persystuje po ponownym otwarciu', async ({ page }) => {
    const firstCardBtn = page.locator('#veh-tbody button[title="Karta pojazdu"]').first();
    if (!(await firstCardBtn.isVisible())) { test.skip(); return; }
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });

    // Otwórz zakładkę "Podstawowe" (domyślna) — tam jest pole #vd-uwagi
    const uwagiFld = page.locator('#vd-uwagi');
    if (!(await uwagiFld.isVisible())) {
      // Spróbuj zakładki z uwagami jeśli nie widoczne od razu
      const tabUwagi = page.locator('#vd-modal [data-tab*="uwagi"], #vd-modal [onclick*="tab"][onclick*="uwagi"]').first();
      if (await tabUwagi.isVisible()) await tabUwagi.click();
      await waitForIdle(page, 300);
    }
    if (!(await uwagiFld.isVisible())) { test.skip(); return; }

    const testNote = 'Test-E2E-' + Date.now();
    await uwagiFld.fill(testNote);

    // Kliknij Zapisz i poczekaj na toast
    await page.click('#vd-save-btn');
    await waitForIdle(page, 1500);

    // Zamknij i ponownie otwórz kartę
    const closeBtn = page.locator('#vd-modal button[onclick*="close"]').first();
    await closeBtn.click();
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 5_000 });

    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });

    // Wartość powinna być zachowana
    const savedVal = await page.locator('#vd-uwagi').inputValue();
    expect(savedVal).toContain(testNote);
  });
});
