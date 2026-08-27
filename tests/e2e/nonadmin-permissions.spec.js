/**
 * E2E — gating uprawnień w UI dla roli innej niż admin.
 *
 * Dług z CLAUDE.md: główny suite (ten plik obok) loguje się WYŁĄCZNIE kontem admina
 * (`role==='admin'` pomija scoping wszędzie w applyRoleAccess() — widzi każdą zakładkę),
 * więc regresja w ukrywaniu zakładek dla zwykłej roli nigdy nie zostałaby wykryta przez
 * te 286 testów, niezależnie od tego, ile ich jeszcze dopiszemy. Test izolacji tenanta
 * (`tests/api/tenant-isolation-test.js`) sprawdza inną warstwę — że backend odmawia
 * dostępu do cudzych DANYCH; ten plik sprawdza, że FRONTEND w ogóle nie pokazuje
 * przycisku do funkcji, do których dana rola nie ma dostępu.
 *
 * Konto: acichocki@mtoilet.pl, rola `kierownik`, spółka `gcon` — to samo konto,
 * którego backend-level test izolacji już używa (patrz HANDOFF w CLAUDE.md, wpis
 * "Drugie, nie-adminowe konto testowe założone").
 *
 * Ten plik uruchamia się WYŁĄCZNIE w projekcie `nonadmin` (patrz playwright.config.js —
 * `testMatch`/`testIgnore` rozdzielają go od projektu `chromium`, bo pod kontem admina
 * te asercje i tak by nie przeszły: admin widzi każdą zakładkę). Guard `test.skip()`
 * poniżej jest defensywny — na wypadek uruchomienia tego pliku poza swoim projektem
 * (np. ręcznie `npx playwright test nonadmin-permissions.spec.js` bez `--project`).
 */
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Gating uprawnień — rola kierownik', () => {

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_EMAIL_NONADMIN) test.skip();
    // login() ma dwie ścieżki: jeśli storageState już przywrócił sesję, wraca od razu
    // (#login-screen znika w 5s bez żadnego żądania); jeśli nie — robi pełne logowanie
    // formularzem. Bez tej odporności (sam page.goto('/') + czekanie na #page-dash)
    // test wisi na timeout 10s, gdy tylko przywrócenie sesji z .auth-state-nonadmin.json
    // się nie powiedzie — dokładnie to zaobserwowane na CI: wszystkie 3 testy padły
    // identycznie na '#page-dash' pozostającym ukrytym, bo ekran logowania się nie
    // zamknął. Każdy inny plik *.spec.js w tym repo woła login() z tego samego powodu.
    await login(page, process.env.TEST_EMAIL_NONADMIN, process.env.TEST_PASS_NONADMIN);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });
  });

  test('zalogowana rola to Kierownik, nie Administrator', async ({ page }) => {
    // Kontrola, że test faktycznie działa na koncie nie-adminowym, a nie na resztkach
    // sesji admina — gdyby storageState wskazywał złe konto, wszystkie asercje niżej
    // przeszłyby fałszywie (admin widzi wszystko, więc "zakładka niewidoczna" nigdy
    // by nie zawiodła z POWODU roli — mogłaby przejść przez przypadek).
    await expect(page.locator('#user-role-lbl')).toHaveText('Kierownik');
  });

  test('zakładki dostępne dla kierownika są widoczne (kontrola pozytywna)', async ({ page }) => {
    // Bez tego dowodu "zakładka ukryta" niżej mogłaby oznaczać zepsute renderowanie
    // całego paska nawigacji, nie działający gating ról.
    await expect(page.locator('#tnb-dash')).toBeVisible();
    await expect(page.locator('#tnb-pojazdy')).toBeVisible();
  });

  test('zakładki administracyjne są ukryte dla kierownika', async ({ page }) => {
    // Lista wzięta wprost z ROLE_TABS.kierownik w app.js — dokładnie te ID, które
    // applyRoleAccess() ukrywa (nie ma ich na liście dozwolonych dla tej roli).
    const ukryte = [
      '#tnb-uzytkownicy',
      '#tnb-firmy',
      '#tnb-api-klucze',
      '#tnb-cepik',
      '#tnb-errors-admin',
      '#tnb-walidacja',
    ];
    for (const sel of ukryte) {
      await expect(page.locator(sel)).toBeHidden();
    }
  });
});
