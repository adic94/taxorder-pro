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
    await firstRow.dblclick();
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

    // #vd-uwagi jest w zakładce "notes", która należy do super-tabu 'ustawienia'
    // (VD_SUPER_TABS.ustawienia = ['archive','notes','gps','karty','konserwacja']),
    // nie do domyślnego 'przeglad'. Trzeba przełączyć super-tab, zanim zakładka
    // "notes" (i pole w niej) w ogóle stanie się widoczna (modules/vehicle-detail.js:2911).
    await page.click('#vd-st-ustawienia');
    await page.click('#vd-tab-notes');

    const uwagiFld = page.locator('#vd-uwagi');
    await expect(uwagiFld).toBeVisible({ timeout: 5_000 });

    const testNote = 'Test-E2E-' + Date.now();
    await uwagiFld.fill(testNote);

    // Kliknij Zapisz — save() w vehicle-detail.js kończy się zawsze this.close()
    // (vehicle-detail.js:469), więc modal zamyka się sam. Nie klikamy X.
    await page.click('#vd-save-btn');
    await expect(page.locator('#vd-modal')).toBeHidden({ timeout: 5_000 });

    // Ponownie otwórz kartę
    await firstCardBtn.click();
    await expect(page.locator('#vd-modal')).toBeVisible({ timeout: 8_000 });

    // _activeSuperTab przetrwał zamknięcie karty, ale pierwsza zakładka aktywowana
    // automatycznie w grupie 'ustawienia' to 'archive', nie 'notes' — przełącz ponownie.
    await page.click('#vd-st-ustawienia');
    await page.click('#vd-tab-notes');
    await expect(page.locator('#vd-uwagi')).toBeVisible({ timeout: 5_000 });

    // Wartość powinna być zachowana
    const savedVal = await page.locator('#vd-uwagi').inputValue();
    expect(savedVal).toContain(testNote);
  });
});
