// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

// Plik .auth-state.json tworzony przez globalSetup przy każdym uruchomieniu CI.
// Lokalnie: powstaje po pierwszym `npm run test:e2e` z ustawionymi zmiennymi.
const AUTH_STATE = 'tests/e2e/.auth-state.json';

// Drugie konto (nie-admin) — projekt `nonadmin` istnieje TYLKO gdy oba sekrety są
// ustawione. Bez tej bramki Playwright próbowałby wczytać storageState z pliku,
// którego globalSetup nigdy nie zapisał (bo tam też jest warunkowe), i cały przebieg
// padałby na starcie — nawet dla developerów, którzy tych sekretów nie mają i nie
// próbują ich używać. Patrz global-setup.js po pełne uzasadnienie.
const HAS_NONADMIN = !!(process.env.TEST_EMAIL_NONADMIN && process.env.TEST_PASS_NONADMIN);
const AUTH_STATE_NONADMIN = 'tests/e2e/.auth-state-nonadmin.json';
const NONADMIN_SPEC = /nonadmin-permissions\.spec\.js/;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // testy logowania muszą być sekwencyjne
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Uruchom logowanie raz przed całą sesją — wynik zapisany w .auth-state.json
  // Akceptuje TEST_TOKEN (token z localStorage) LUB TEST_EMAIL+TEST_PASS. Musi też
  // liczyć się z HAS_NONADMIN — bez tego trzeciego warunku, konfiguracja z samymi
  // TEST_EMAIL_NONADMIN/TEST_PASS_NONADMIN (bez konta admina) włączałaby niżej projekt
  // `nonadmin` ze storageState wskazującym na .auth-state-nonadmin.json, ale globalSetup
  // nigdy by go nie zapisał — crash na starcie testów (ENOENT), nie pominięcie.
  globalSetup: (process.env.TEST_EMAIL || process.env.TEST_TOKEN || HAS_NONADMIN) ? './tests/e2e/global-setup.js' : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/results/html', open: 'never' }],
  ],

  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    // Każdy test startuje z przywróconym stanem logowania (bez ponownego logowania przez API)
    storageState: (process.env.TEST_EMAIL || process.env.TEST_TOKEN) ? AUTH_STATE : undefined,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    locale: 'pl-PL',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Ten plik ma osobny projekt (niżej) z sesją nie-admina — pod kontem admina
      // wszystkie zakładki są widoczne, więc asercje "ta zakładka jest ukryta" i tak
      // by tu nie przeszły. Ignorowane bezwarunkowo, nawet gdy HAS_NONADMIN=false,
      // żeby lokalny dev bez tych sekretów nie dostał fałszywego czerwonego.
      testIgnore: NONADMIN_SPEC,
    },
    // Odkomentuj gdy potrzebujesz testów mobilnych:
    // { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    ...(HAS_NONADMIN ? [{
      name: 'nonadmin',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_NONADMIN },
      testMatch: NONADMIN_SPEC,
    }] : []),
  ],

  // Uruchom http-server przed testami (jeśli nie ma zewnętrznego serwera)
  webServer: process.env.TEST_URL ? undefined : {
    command: 'npx http-server . -p 3000 -c-1 --silent',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
