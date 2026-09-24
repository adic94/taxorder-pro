// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

// Plik .auth-state.json tworzony przez globalSetup przy każdym uruchomieniu CI.
// Lokalnie: powstaje po pierwszym `npm run test:e2e` z ustawionymi zmiennymi.
const AUTH_STATE = 'tests/e2e/.auth-state.json';
const LOCAL_PORT = process.env.UAT_API_URL ? 3101 : 3000;
const HAS_TEST_AUTH = Boolean(
  process.env.TEST_TOKEN
  || (process.env.TEST_EMAIL && process.env.TEST_PASS)
);

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // testy logowania muszą być sekwencyjne
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Uruchom logowanie raz przed całą sesją — wynik zapisany w .auth-state.json
  // Akceptuje TEST_TOKEN (token z localStorage) LUB TEST_EMAIL+TEST_PASS
  globalSetup: HAS_TEST_AUTH ? './tests/e2e/global-setup.js' : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/results/html', open: 'never' }],
  ],

  use: {
    baseURL: process.env.TEST_URL || `http://localhost:${LOCAL_PORT}`,
    // Każdy test startuje z przywróconym stanem logowania (bez ponownego logowania przez API)
    storageState: HAS_TEST_AUTH ? AUTH_STATE : undefined,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    locale: 'pl-PL',
    // W UAT config Workera jest przechwytywany przez Playwright. Service Worker z
    // lokalnego cache omijał route i kierował część modułów z powrotem na produkcję.
    serviceWorkers: process.env.UAT_API_URL ? 'block' : 'allow',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
  ],

  // Uruchom http-server przed testami (jeśli nie ma zewnętrznego serwera)
  webServer: process.env.TEST_URL ? undefined : {
    command: `npx http-server . -p ${LOCAL_PORT} -c-1 --silent`,
    url: `http://localhost:${LOCAL_PORT}`,
    // UAT musi dostać świeży serwer. Pozostawiony proces na 3000 może serwować
    // starszą konfigurację i skierować testy na produkcyjnego Workera.
    reuseExistingServer: !process.env.UAT_API_URL,
    timeout: 10_000,
  },
});
