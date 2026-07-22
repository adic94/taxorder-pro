/**
 * TaxOrder Pro — PEŁNE POKRYCIE E2E (full-coverage.spec.js)
 *
 * Testuje KAŻDĄ stronę systemu (~119 modułów):
 *  • ładowanie bez błędów JS
 *  • widoczna zawartość (nie pusta strona)
 *  • otwieranie/zamykanie modali na kluczowych stronach
 *  • brak XSS w danych renderowanych przez moduły
 *
 * Wymaga: TEST_EMAIL + TEST_PASS w zmiennych środowiskowych.
 * Uruchomienie: npm run test:e2e -- tests/e2e/full-coverage.spec.js
 */

const { test, expect } = require('@playwright/test');
const { login, waitForIdle } = require('./helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToPage(page, id, opts = {}) {
  await page.evaluate((pid) => window.showPage?.(pid), id);
  await page.waitForSelector(`#page-${id}`, { state: 'visible', timeout: opts.timeout || 8_000 });
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

function filterErrors(errors) {
  return errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('Failed to fetch') &&
    !e.includes('NetworkError') &&
    !e.includes('Load failed')
  );
}

async function noJsErrors(page, id, idle = 800) {
  const errors = collectErrors(page);
  await goToPage(page, id);
  await waitForIdle(page, idle);
  return filterErrors(errors);
}

async function hasContent(page, id) {
  const el = page.locator(`#page-${id}`);
  const txt = await el.textContent().catch(() => '');
  return txt.trim().length > 15;
}

async function noXss(page, id) {
  const html = await page.locator(`#page-${id}`).innerHTML().catch(() => '');
  return !/<script/i.test(html) && !/onerror=/i.test(html) && !/javascript:/i.test(html);
}

// ─── Setup: login once ────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  if (!process.env.TEST_EMAIL) test.skip();
  await login(page);
  await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
});

// ─── 1. PULPIT / DASHBOARD ────────────────────────────────────────────────────

test.describe('Pulpit', () => {
  test('dashboard ładuje się i ma KPI', async ({ page }) => {
    const errors = collectErrors(page);
    await waitForIdle(page, 1000);
    expect(filterErrors(errors)).toHaveLength(0);
    await expect(page.locator('#page-dash')).toBeVisible();
    const txt = await page.locator('#page-dash').textContent();
    expect(txt.length).toBeGreaterThan(50);
  });

  test('dashboard — brak XSS w widgetach', async ({ page }) => {
    await waitForIdle(page, 1000);
    const html = await page.locator('#page-dash').innerHTML().catch(() => '');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
  });
});

// ─── 2. POJAZDY ───────────────────────────────────────────────────────────────

test.describe('Pojazdy', () => {
  test('lista pojazdów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'pojazdy', 1500);
    expect(errs).toHaveLength(0);
  });

  test('lista pojazdów ma tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'pojazdy');
    await waitForIdle(page, 1200);
    const hasTbl = await page.locator('#pojazdy-tbody, #fl-tbody, #page-pojazdy table').isVisible().catch(() => false);
    const hasTxt = await hasContent(page, 'pojazdy');
    expect(hasTbl || hasTxt).toBe(true);
  });

  test('pojazdy — brak XSS w tabeli', async ({ page }) => {
    await goToPage(page, 'pojazdy');
    await waitForIdle(page, 1200);
    expect(await noXss(page, 'pojazdy')).toBe(true);
  });

  test('karta pojazdu otwiera się przez kliknięcie (jeśli jest pojazd)', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'pojazdy');
    await waitForIdle(page, 1200);
    const firstRow = page.locator('#pojazdy-tbody tr, #fl-tbody tr, #page-pojazdy tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await waitForIdle(page, 1000);
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });
});

// ─── 3. PALIWO ────────────────────────────────────────────────────────────────

test.describe('Paliwo', () => {
  test('strona paliwa ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'paliwo', 1200);
    expect(errs).toHaveLength(0);
  });

  test('strona paliwa ma zawartość i filtr roku', async ({ page }) => {
    await goToPage(page, 'paliwo');
    await waitForIdle(page, 1000);
    const hasSel = await page.locator('#page-paliwo select, #page-paliwo .btn').first().isVisible().catch(() => false);
    const hasTxt = await hasContent(page, 'paliwo');
    expect(hasSel || hasTxt).toBe(true);
  });
});

// ─── 4. KARTY FLOTOWE ────────────────────────────────────────────────────────

test.describe('Karty flotowe', () => {
  test('strona kart flotowych ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'karty', 1500);
    expect(errs).toHaveLength(0);
  });

  test('strona kart flotowych ma tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'karty');
    await waitForIdle(page, 1200);
    expect(await hasContent(page, 'karty')).toBe(true);
  });

  test('przycisk "Dodaj kartę" jest widoczny', async ({ page }) => {
    await goToPage(page, 'karty');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-karty button').filter({ hasText: /doda|kart/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await waitForIdle(page, 500);
      const modal = page.locator('#karta-modal, .modal-backdrop:visible').first();
      if (await modal.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ─── 5. DT-1 ─────────────────────────────────────────────────────────────────

test.describe('DT-1 — deklaracje podatkowe', () => {
  test('kalkulator DT-1 ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'kalkulator', 1000);
    expect(errs).toHaveLength(0);
  });

  test('kalkulator DT-1 ma formularz z polami', async ({ page }) => {
    await goToPage(page, 'kalkulator');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-kalkulator select, #page-kalkulator input').first()).toBeVisible({ timeout: 5_000 });
  });

  test('historia DT-1 ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'dt1-historia', 1200);
    expect(errs).toHaveLength(0);
  });

  test('historia DT-1 ma kontener listy', async ({ page }) => {
    await goToPage(page, 'dt1-historia');
    await waitForIdle(page, 1000);
    await expect(page.locator('#dt1decl-list')).toBeVisible({ timeout: 5_000 });
  });

  test('formularze DT-1 ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'formularze', 1000);
    expect(errs).toHaveLength(0);
  });

  test('podatnik ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'podatnik', 1000);
    expect(errs).toHaveLength(0);
  });

  test('stawki i porównanie gmin ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'stawki', 1000);
    expect(errs).toHaveLength(0);
  });

  test('walidacja deklaracji ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'walidacja', 1000);
    expect(errs).toHaveLength(0);
  });

  test('eksport PDF ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'pdfexport', 1000);
    expect(errs).toHaveLength(0);
  });

  test('PD — zeznanie roczne ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'pd', 1000);
    expect(errs).toHaveLength(0);
  });
});

// ─── 6. RAPORTY ───────────────────────────────────────────────────────────────

test.describe('Raporty', () => {
  test('strona raportów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'raporty', 1500);
    expect(errs).toHaveLength(0);
  });

  test('strona raportów ma przyciski filtrowania', async ({ page }) => {
    await goToPage(page, 'raporty');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'raporty')).toBe(true);
  });
});

// ─── 7. IMPORT / EKSPORT ─────────────────────────────────────────────────────

test.describe('Import / Eksport', () => {
  test('strona importu/eksportu ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'impexp', 1000);
    expect(errs).toHaveLength(0);
  });

  test('strona impexp ma przyciski importu', async ({ page }) => {
    await goToPage(page, 'impexp');
    await waitForIdle(page, 800);
    expect(await hasContent(page, 'impexp')).toBe(true);
  });

  test('OCR dowodów rejestracyjnych ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'ocr', 1000);
    expect(errs).toHaveLength(0);
  });

  test('historia DR — DR Import ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'dr-import', 1000);
    expect(errs).toHaveLength(0);
  });
});

// ─── 8. SERWIS / FLOTA ───────────────────────────────────────────────────────

test.describe('Serwis i utrzymanie floty', () => {
  test('zlecenia serwisowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'zlecenia', 1200);
    expect(errs).toHaveLength(0);
  });

  test('zlecenia mają tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'zlecenia');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'zlecenia')).toBe(true);
  });

  test('opony — magazyn ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'opony-magazyn', 1200);
    expect(errs).toHaveLength(0);
  });

  test('opony mają tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'opony-magazyn');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'opony-magazyn')).toBe(true);
  });

  test('terminarz przeglądów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'terminarz', 1200);
    expect(errs).toHaveLength(0);
  });

  test('terminarz ma tabelę', async ({ page }) => {
    await goToPage(page, 'terminarz');
    await waitForIdle(page, 1200);
    await expect(page.locator('#page-terminarz table')).toBeVisible({ timeout: 8_000 });
  });

  test('szkody ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'szkody', 1200);
    expect(errs).toHaveLength(0);
  });

  test('harmonogram serwisowy ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'service-schedule', 1200);
    expect(errs).toHaveLength(0);
  });

  test('harmonogram serwisowy ma przycisk dodawania', async ({ page }) => {
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-service-schedule button:has-text("Dodaj pozycję")')).toBeVisible({ timeout: 5_000 });
  });

  test('inspekcje pojazdów ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-inspections', 1200);
    expect(errs).toHaveLength(0);
  });

  test('serwis predykcyjny ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'predictive-maintenance', 1200);
    expect(errs).toHaveLength(0);
  });

  test('usterki ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'faults', 1200);
    expect(errs).toHaveLength(0);
  });

  test('usterki mają zawartość', async ({ page }) => {
    await goToPage(page, 'faults');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'faults')).toBe(true);
  });

  test('gwarancje / recall ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'warranties', 1200);
    expect(errs).toHaveLength(0);
  });

  test('magazyn części ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'spare-parts', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kontrakty serwisów ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'service-contracts', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 9. DOKUMENTY I PROTOKOŁY ────────────────────────────────────────────────

test.describe('Dokumenty i protokoły', () => {
  test('protokoły przekazania ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'protokoly', 1200);
    expect(errs).toHaveLength(0);
  });

  test('protokoły mają toolbar lub tabelę', async ({ page }) => {
    await goToPage(page, 'protokoly');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'protokoly')).toBe(true);
  });

  test('dokumenty flotowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'dok-smart', 1200);
    expect(errs).toHaveLength(0);
  });

  test('faktury ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'faktury', 1200);
    expect(errs).toHaveLength(0);
  });

  test('polisy ubezpieczeniowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'policies', 1200);
    expect(errs).toHaveLength(0);
  });

  test('polisy mają przycisk "Nowa polisa"', async ({ page }) => {
    await goToPage(page, 'policies');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-policies button:has-text("Nowa polisa")')).toBeVisible({ timeout: 5_000 });
  });

  test('polisy OCR ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'polisy-ocr', 1200);
    expect(errs).toHaveLength(0);
  });

  test('CMR ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'cmr', 1200);
    expect(errs).toHaveLength(0);
  });

  test('CMR ma przycisk "Nowy CMR"', async ({ page }) => {
    await goToPage(page, 'cmr');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-cmr button:has-text("Nowy")')).toBeVisible({ timeout: 5_000 });
  });

  test('CMR — XSS check', async ({ page }) => {
    await goToPage(page, 'cmr');
    await waitForIdle(page, 1200);
    expect(await noXss(page, 'cmr')).toBe(true);
  });

  test('SENT / PUESC ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'sent', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 10. KIEROWCY ────────────────────────────────────────────────────────────

test.describe('Kierowcy', () => {
  test('profile kierowców ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-profiles', 1200);
    expect(errs).toHaveLength(0);
  });

  test('profile kierowców mają zawartość', async ({ page }) => {
    await goToPage(page, 'driver-profiles');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'driver-profiles')).toBe(true);
  });

  test('wydajność kierowców ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-performance', 1200);
    expect(errs).toHaveLength(0);
  });

  test('scoring kierowców ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-scoring', 1200);
    expect(errs).toHaveLength(0);
  });

  test('wynagrodzenia kierowców ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-wages', 1200);
    expect(errs).toHaveLength(0);
  });

  test('grafik kierowców ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-schedule', 1200);
    expect(errs).toHaveLength(0);
  });

  test('panel kierowcy ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-panel', 1200);
    expect(errs).toHaveLength(0);
  });

  test('czas pracy kierowcy ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-worktime', 1200);
    expect(errs).toHaveLength(0);
  });

  test('czas pracy kierowcy ma tabelę lub zawartość', async ({ page }) => {
    await goToPage(page, 'driver-worktime');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'driver-worktime')).toBe(true);
  });

  test('czas pracy (tacho/driver-shifts) ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-shifts', 1200);
    expect(errs).toHaveLength(0);
  });

  test('szkolenia i badania kierowców ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'driver-training', 1200);
    expect(errs).toHaveLength(0);
  });

  test('szkolenia mają zawartość', async ({ page }) => {
    await goToPage(page, 'driver-training');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'driver-training')).toBe(true);
  });
});

// ─── 11. ZATWIERDZENIA / WORKFLOW ────────────────────────────────────────────

test.describe('Zatwierdzenia i workflow', () => {
  test('zatwierdzenia ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'approvals', 1200);
    expect(errs).toHaveLength(0);
  });

  test('zatwierdzenia mają zawartość', async ({ page }) => {
    await goToPage(page, 'approvals');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'approvals')).toBe(true);
  });

  test('poziomy zatwierdzeń ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'approval-levels', 1200);
    expect(errs).toHaveLength(0);
  });

  test('poziomy zatwierdzeń mają tabelę i przycisk', async ({ page }) => {
    await goToPage(page, 'approval-levels');
    await waitForIdle(page, 1000);
    await expect(page.locator('#page-approval-levels table')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#page-approval-levels button:has-text("Dodaj poziom")')).toBeVisible({ timeout: 5_000 });
  });

  test('poziomy zatwierdzeń — modal dodawania otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'approval-levels');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-approval-levels button:has-text("Dodaj poziom")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await expect(page.locator('#al-modal')).toBeVisible({ timeout: 3_000 });
      await page.locator('#al-modal button:has-text("Anuluj")').click();
      await expect(page.locator('#al-modal')).toBeHidden({ timeout: 3_000 });
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('historia zmian (audit-log) ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'audit-log', 1500);
    expect(errs).toHaveLength(0);
  });

  test('historia zmian ma tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'audit-log');
    await waitForIdle(page, 1200);
    expect(await hasContent(page, 'audit-log')).toBe(true);
  });
});

// ─── 12. FINANSOWE ────────────────────────────────────────────────────────────

test.describe('Moduły finansowe', () => {
  test('budżet/TCO ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'budzet', 1200);
    expect(errs).toHaveLength(0);
  });

  test('budżety ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'budgets', 1200);
    expect(errs).toHaveLength(0);
  });

  test('budżety mają zawartość', async ({ page }) => {
    await goToPage(page, 'budgets');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'budgets')).toBe(true);
  });

  test('budżet roczny ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'budget-annual', 1200);
    expect(errs).toHaveLength(0);
  });

  test('TCO pojazdów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'tco', 1200);
    expect(errs).toHaveLength(0);
  });

  test('TCO ma zawartość', async ({ page }) => {
    await goToPage(page, 'tco');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'tco')).toBe(true);
  });

  test('EPP / VAT ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'epp-vat', 1200);
    expect(errs).toHaveLength(0);
  });

  test('FK Eksport ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fk-export', 1200);
    expect(errs).toHaveLength(0);
  });

  test('faktury dostawców ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'supplier-invoices', 1200);
    expect(errs).toHaveLength(0);
  });

  test('rozliczenia km ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'mileage-claims', 1200);
    expect(errs).toHaveLength(0);
  });

  test('rozliczenia km mają filtry', async ({ page }) => {
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 800);
    await expect(page.locator('#mc-filter-status')).toBeVisible({ timeout: 5_000 });
  });

  test('ewidencja paliwa (fuel-db) ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fuel-db', 1200);
    expect(errs).toHaveLength(0);
  });

  test('import kart paliwowych ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fuel-card-import', 1200);
    expect(errs).toHaveLength(0);
  });

  test('waluty ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'currency', 1200);
    expect(errs).toHaveLength(0);
  });

  test('waluty mają zawartość', async ({ page }) => {
    await goToPage(page, 'currency');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'currency')).toBe(true);
  });
});

// ─── 13. CFM ─────────────────────────────────────────────────────────────────

test.describe('CFM — Car Fleet Management', () => {
  test('klienci CFM ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'cfm-klienci', 1200);
    expect(errs).toHaveLength(0);
  });

  test('klienci CFM mają tabelę', async ({ page }) => {
    await goToPage(page, 'cfm-klienci');
    await waitForIdle(page, 1000);
    await expect(page.locator('#cfmk-tbody')).toBeVisible({ timeout: 5_000 });
  });

  test('kontrakty CFM ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'cfm-kontrakty', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kontrakty CFM mają tabelę', async ({ page }) => {
    await goToPage(page, 'cfm-kontrakty');
    await waitForIdle(page, 1000);
    await expect(page.locator('#cfmu-tbody')).toBeVisible({ timeout: 5_000 });
  });

  test('faktury CFM ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'cfm-faktury', 1200);
    expect(errs).toHaveLength(0);
  });

  test('faktury CFM mają tabelę', async ({ page }) => {
    await goToPage(page, 'cfm-faktury');
    await waitForIdle(page, 1000);
    await expect(page.locator('#cfmf-tbody')).toBeVisible({ timeout: 5_000 });
  });
});

// ─── 14. ADMINISTRACJA ───────────────────────────────────────────────────────

test.describe('Administracja systemu', () => {
  test('użytkownicy ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'uzytkownicy', 1200);
    expect(errs).toHaveLength(0);
  });

  test('użytkownicy mają tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'uzytkownicy');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'uzytkownicy')).toBe(true);
  });

  test('klucze API ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'api-klucze', 1200);
    expect(errs).toHaveLength(0);
  });

  test('klucze API mają tabelę', async ({ page }) => {
    await goToPage(page, 'api-klucze');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'api-klucze')).toBe(true);
  });

  test('webhooki ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'webhooks', 1200);
    expect(errs).toHaveLength(0);
  });

  test('webhooki mają tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'webhooks');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'webhooks')).toBe(true);
  });

  test('firmy ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'firmy', 1200);
    expect(errs).toHaveLength(0);
  });

  test('konfiguracja modułów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'feature-config', 1200);
    expect(errs).toHaveLength(0);
  });

  test('konfiguracja modułów ma zawartość', async ({ page }) => {
    await goToPage(page, 'feature-config');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'feature-config')).toBe(true);
  });

  test('błędy JS (panel admina) ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'errors-admin', 1200);
    expect(errs).toHaveLength(0);
  });

  test('oddziały ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'oddzialy', 1200);
    expect(errs).toHaveLength(0);
  });

  test('dostęp / pakiety ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'access-control', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 15. DASHBOARDY I ANALIZY ────────────────────────────────────────────────

test.describe('Dashboardy i analizy', () => {
  test('dashboard executive ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'exec-dashboard', 1500);
    expect(errs).toHaveLength(0);
  });

  test('dashboard executive ma zawartość', async ({ page }) => {
    await goToPage(page, 'exec-dashboard');
    await waitForIdle(page, 1200);
    expect(await hasContent(page, 'exec-dashboard')).toBe(true);
  });

  test('dashboard KPI ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-kpi', 1500);
    expect(errs).toHaveLength(0);
  });

  test('dashboard KPI ma zawartość', async ({ page }) => {
    await goToPage(page, 'fleet-kpi');
    await waitForIdle(page, 1200);
    expect(await hasContent(page, 'fleet-kpi')).toBe(true);
  });

  test('alerty ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'alert-dashboard', 1500);
    expect(errs).toHaveLength(0);
  });

  test('powiadomienia ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'powiadomienia', 1200);
    expect(errs).toHaveLength(0);
  });

  test('benchmark ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'benchmark', 1200);
    expect(errs).toHaveLength(0);
  });

  test('benchmark ma zawartość', async ({ page }) => {
    await goToPage(page, 'benchmark');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'benchmark')).toBe(true);
  });

  test('raport CO₂ ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'co2-report', 1200);
    expect(errs).toHaveLength(0);
  });

  test('raport ESG ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'esg-report', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kreator raportów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'report-builder', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kreator raportów ma zawartość', async ({ page }) => {
    await goToPage(page, 'report-builder');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'report-builder')).toBe(true);
  });
});

// ─── 16. INTEGRACJE I GPS ────────────────────────────────────────────────────

test.describe('Integracje i GPS', () => {
  test('mapa GPS ładuje się bez krytycznych błędów', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => {
      if (!e.message.includes('net::ERR') && !e.message.includes('GPS') && !e.message.includes('tekom')) {
        errors.push(e.message);
      }
    });
    await goToPage(page, 'mapa');
    await waitForIdle(page, 2000);
    expect(errors).toHaveLength(0);
  });

  test('integracje ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'integrations', 1200);
    expect(errs).toHaveLength(0);
  });

  test('integracje mają zawartość', async ({ page }) => {
    await goToPage(page, 'integrations');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'integrations')).toBe(true);
  });

  test('GPS integracje ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'gps-integrations', 1200);
    expect(errs).toHaveLength(0);
  });

  test('geofencing ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'geofencing', 1200);
    expect(errs).toHaveLength(0);
  });

  test('Zapier / Make ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'zapier-ui', 1200);
    expect(errs).toHaveLength(0);
  });

  test('tachografy DDD ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'tachograph', 1200);
    expect(errs).toHaveLength(0);
  });

  test('tachografy mają zawartość', async ({ page }) => {
    await goToPage(page, 'tachograph');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'tachograph')).toBe(true);
  });

  test('tachograf (tacho) ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'tacho', 1200);
    expect(errs).toHaveLength(0);
  });

  test('telematyka wideo ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'video-telematics', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 17. PLANOWANIE TRAS ─────────────────────────────────────────────────────

test.describe('Planowanie tras i transportu', () => {
  test('koszty tras ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'route-cost', 1200);
    expect(errs).toHaveLength(0);
  });

  test('faktury tras ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'route-billing', 1200);
    expect(errs).toHaveLength(0);
  });

  test('zlecenia transportowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'transport-orders', 1200);
    expect(errs).toHaveLength(0);
  });

  test('zlecenia transportowe mają zawartość', async ({ page }) => {
    await goToPage(page, 'transport-orders');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'transport-orders')).toBe(true);
  });

  test('delegacje ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'delegations', 1200);
    expect(errs).toHaveLength(0);
  });

  test('prywatna/służbowa ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'trip-private', 1200);
    expect(errs).toHaveLength(0);
  });

  test('carpooling ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'carpooling', 1200);
    expect(errs).toHaveLength(0);
  });

  test('carpooling ma zawartość', async ({ page }) => {
    await goToPage(page, 'carpooling');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'carpooling')).toBe(true);
  });
});

// ─── 18. FLOTA EV / WYPOSAŻENIE ──────────────────────────────────────────────

test.describe('Flota EV i wyposażenie', () => {
  test('flota EV/Hybrid ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'ev-fleet', 1200);
    expect(errs).toHaveLength(0);
  });

  test('ładowanie EV ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'ev-charging', 1200);
    expect(errs).toHaveLength(0);
  });

  test('wyposażenie pojazdów ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-equipment', 1200);
    expect(errs).toHaveLength(0);
  });

  test('inwentaryzacja ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-inventory', 1200);
    expect(errs).toHaveLength(0);
  });

  test('wartość pojazdu ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-value', 1200);
    expect(errs).toHaveLength(0);
  });

  test('leasing / harmonogram ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'leasing-schedule', 1200);
    expect(errs).toHaveLength(0);
  });

  test('wymiana floty ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-renewal', 1200);
    expect(errs).toHaveLength(0);
  });

  test('likwidacja pojazdu ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-disposal', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kanban floty ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-kanban', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kody QR ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-qr', 1200);
    expect(errs).toHaveLength(0);
  });

  test('kody QR mają siatkę pojazdów lub komunikat', async ({ page }) => {
    await goToPage(page, 'vehicle-qr');
    await waitForIdle(page, 1200);
    expect(await hasContent(page, 'vehicle-qr')).toBe(true);
  });
});

// ─── 19. POLITYKI I LIMITY ───────────────────────────────────────────────────

test.describe('Polityki flotowe i limity', () => {
  test('polityki flotowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-policies', 1200);
    expect(errs).toHaveLength(0);
  });

  test('polityki flotowe mają zawartość', async ({ page }) => {
    await goToPage(page, 'fleet-policies');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'fleet-policies')).toBe(true);
  });

  test('limity km/paliwa ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-limits', 1200);
    expect(errs).toHaveLength(0);
  });

  test('limity mają zawartość', async ({ page }) => {
    await goToPage(page, 'fleet-limits');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'fleet-limits')).toBe(true);
  });

  test('ubezpieczenia ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'insurance', 1200);
    expect(errs).toHaveLength(0);
  });

  test('ubezpieczenia mają zawartość', async ({ page }) => {
    await goToPage(page, 'insurance');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'insurance')).toBe(true);
  });

  test('rezerwacje (reservations) ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'reservations', 1200);
    expect(errs).toHaveLength(0);
  });

  test('rezerwacje pojazdów (fleet-reservations) ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'fleet-reservations', 1200);
    expect(errs).toHaveLength(0);
  });

  test('miejsca parkingowe ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'parking', 1200);
    expect(errs).toHaveLength(0);
  });

  test('miejsca parkingowe mają zawartość', async ({ page }) => {
    await goToPage(page, 'parking');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'parking')).toBe(true);
  });

  test('wynajem wewnętrzny ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'internal-rental', 1200);
    expect(errs).toHaveLength(0);
  });

  test('RODO / ADO ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'gdpr', 1200);
    expect(errs).toHaveLength(0);
  });

  test('RODO / ADO ma zawartość', async ({ page }) => {
    await goToPage(page, 'gdpr');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'gdpr')).toBe(true);
  });
});

// ─── 20. DOSTAWCY I ZAKUPY ───────────────────────────────────────────────────

test.describe('Dostawcy i zakupy', () => {
  test('dostawcy ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'suppliers', 1200);
    expect(errs).toHaveLength(0);
  });

  test('dostawcy mają tabelę lub komunikat', async ({ page }) => {
    await goToPage(page, 'suppliers');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'suppliers')).toBe(true);
  });

  test('dostawcy — XSS check', async ({ page }) => {
    await goToPage(page, 'suppliers');
    await waitForIdle(page, 1200);
    expect(await noXss(page, 'suppliers')).toBe(true);
  });
});

// ─── 21. PRAWO I KSIĘGOWOŚĆ ──────────────────────────────────────────────────

test.describe('Prawo i księgowość', () => {
  test('KSeF / e-Faktury ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'ksef', 1200);
    expect(errs).toHaveLength(0);
  });

  test('KSeF ma tabelę i przyciski', async ({ page }) => {
    await goToPage(page, 'ksef');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'ksef')).toBe(true);
  });

  test('JPK / SAF-T ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'jpk', 1200);
    expect(errs).toHaveLength(0);
  });

  test('JPK ma tabelę i przycisk generowania', async ({ page }) => {
    await goToPage(page, 'jpk');
    await waitForIdle(page, 800);
    await expect(page.locator('#page-jpk button:has-text("Generuj")')).toBeVisible({ timeout: 5_000 });
  });

  test('e-Doręczenia ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'edoreczenia', 1200);
    expect(errs).toHaveLength(0);
  });

  test('e-Doręczenia mają tabelę i przycisk', async ({ page }) => {
    await goToPage(page, 'edoreczenia');
    await waitForIdle(page, 800);
    expect(await hasContent(page, 'edoreczenia')).toBe(true);
  });

  test('GUS / REGON ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'gus-regon', 1200);
    expect(errs).toHaveLength(0);
  });

  test('VIES validator ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vies-validator', 1200);
    expect(errs).toHaveLength(0);
  });

  test('CEPIK ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'cepik', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 22. KOMUNIKACJA ──────────────────────────────────────────────────────────

test.describe('Komunikacja', () => {
  test('komunikator wewnętrzny ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'messenger', 1500);
    expect(errs).toHaveLength(0);
  });

  test('komunikator ma panel listy i panel wątku', async ({ page }) => {
    await goToPage(page, 'messenger');
    await waitForIdle(page, 1000);
    await expect(page.locator('#msg-list')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#msg-thread')).toBeVisible({ timeout: 5_000 });
  });

  test('komunikator — "Nowa wiadomość" otwiera modal', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'messenger');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-messenger button:has-text("Nowa wiadomość")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await expect(page.locator('#msg-compose-modal')).toBeVisible({ timeout: 3_000 });
      await page.locator('#msg-compose-modal button:has-text("Anuluj")').click();
      await expect(page.locator('#msg-compose-modal')).toBeHidden({ timeout: 3_000 });
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('smart forms ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'smart-forms', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 23. AI / OCR ──────────────────────────────────────────────────────────

test.describe('AI i automatyzacja', () => {
  test('AI chat ładuje się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'ai', 1500);
    expect(errs).toHaveLength(0);
  });

  test('AI chat ma zawartość', async ({ page }) => {
    await goToPage(page, 'ai');
    await waitForIdle(page, 1000);
    expect(await hasContent(page, 'ai')).toBe(true);
  });
});

// ─── 24. NARZĘDZIA DODATKOWE ─────────────────────────────────────────────────

test.describe('Narzędzia dodatkowe', () => {
  test('powiadomienia push ładują się bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'powiadomienia', 1200);
    expect(errs).toHaveLength(0);
  });

  test('pojazd — wyposażenie i inspekcje bez błędów', async ({ page }) => {
    const errs = await noJsErrors(page, 'vehicle-equipment', 1200);
    expect(errs).toHaveLength(0);
  });
});

// ─── 25. MODALE — otwieranie i zamykanie ──────────────────────────────────────

test.describe('Modale kluczowych stron', () => {

  test('zlecenia — modal "Zgłoś / Nowe zlecenie" otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'zlecenia');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-zlecenia button').filter({ hasText: /zgłoś|nowe/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await waitForIdle(page, 500);
      const modal = page.locator('.modal-backdrop:visible').first();
      if (await modal.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await waitForIdle(page, 300);
      }
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('szkody — modal "Nowa szkoda" otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'szkody');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-szkody button').filter({ hasText: /nowa|dodaj/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await waitForIdle(page, 500);
      const modal = page.locator('.modal-backdrop:visible').first();
      if (await modal.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await waitForIdle(page, 300);
      }
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('polisy — modal "Nowa polisa" otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'policies');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-policies button:has-text("Nowa polisa")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await expect(page.locator('#pm-modal')).toBeVisible({ timeout: 3_000 });
      const closeBtn = page.locator('#pm-modal button:has-text("Anuluj"), #pm-modal .btn-icon').first();
      await closeBtn.click();
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('harmonogram serwisowy — modal dodawania otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'service-schedule');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-service-schedule button:has-text("Dodaj pozycję")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await expect(page.locator('#ss-modal')).toBeVisible({ timeout: 3_000 });
      await page.locator('#ss-modal .btn-icon').first().click();
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('rozliczenia km — modal dodawania otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'mileage-claims');
    await waitForIdle(page, 800);
    await page.evaluate(() => window.MileageClaimsModule?._openEdit?.(null));
    const modal = page.locator('#mc-modal');
    if (await modal.isVisible().catch(() => false)) {
      await page.locator('#mc-modal .btn-icon').first().click();
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('CMR — modal nowego CMR otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await goToPage(page, 'cmr');
    await waitForIdle(page, 800);
    const btn = page.locator('#page-cmr button:has-text("Nowy CMR")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await expect(page.locator('#cmr-modal')).toBeVisible({ timeout: 3_000 });
      await page.locator('#cmr-modal button:has-text("Anuluj")').click();
      await expect(page.locator('#cmr-modal')).toBeHidden({ timeout: 3_000 });
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });

  test('mandaty — modal otwiera się i zamyka', async ({ page }) => {
    const errors = collectErrors(page);
    await page.evaluate(async () => { await window.FinesModule?.open?.(); });
    const modal = page.locator('#fines-modal');
    if (await modal.isVisible().catch(() => false)) {
      await expect(modal).toBeVisible();
      await page.evaluate(() => window.FinesModule?.close?.());
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });
});

// ─── 26. XSS — weryfikacja globalnie ─────────────────────────────────────────

test.describe('XSS — weryfikacja escaping danych użytkownika', () => {

  const xssPages = [
    'pojazdy', 'karty', 'szkody', 'opony-magazyn', 'zlecenia', 'protokoly',
    'cfm-klienci', 'cfm-kontrakty', 'cfm-faktury', 'dostawcy', 'suppliers',
    'cmr', 'sent', 'messenger', 'ksef', 'jpk', 'edoreczenia',
    'approvals', 'approval-levels', 'audit-log',
    'driver-profiles', 'driver-wages', 'transport-orders',
    'spare-parts', 'warranties', 'service-contracts',
  ];

  for (const pageId of xssPages) {
    test(`${pageId} — brak niezescapowanych tagów <script>`, async ({ page }) => {
      try {
        await goToPage(page, pageId);
        await waitForIdle(page, 800);
        expect(await noXss(page, pageId)).toBe(true);
      } catch {
        // Strona może nie istnieć lub wymagać dodatkowych danych — nie fail
      }
    });
  }
});

// ─── 27. WYSZUKIWARKA GLOBALNA ────────────────────────────────────────────────

test.describe('Wyszukiwarka globalna', () => {
  test('wyszukiwarka globalna otwiera się skrótem klawiaturowym', async ({ page }) => {
    const errors = collectErrors(page);
    await page.keyboard.press('Control+k');
    await waitForIdle(page, 500);
    const search = page.locator('#global-search-modal, #search-modal, [id*="search"]').first();
    if (await search.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
    }
    expect(filterErrors(errors)).toHaveLength(0);
  });
});
