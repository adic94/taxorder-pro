// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

// Plik .auth-state.json tworzony przez globalSetup przy każdym uruchomieniu CI.
// Lokalnie: powstaje po pierwszym `npm run test:e2e` z ustawionymi zmiennymi.
const AUTH_STATE = 'tests/e2e/.auth-state.json';

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // testy logowania muszą być sekwencyjne
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Uruchom logowanie raz przed całą sesją — wynik zapisany w .auth-state.json
  // Akceptuje TEST_TOKEN (token z localStorage) LUB TEST_EMAIL+TEST_PASS
  globalSetup: (process.env.TEST_EMAIL || process.env.TEST_TOKEN) ? './tests/e2e/global-setup.js' : undefined,

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
    },
    // Odkomentuj gdy potrzebujesz testów mobilnych:
    // { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  // Uruchom http-server przed testami (jeśli nie ma zewnętrznego serwera)
  webServer: process.env.TEST_URL ? undefined : {
    command: 'npx http-server . -p 3000 -c-1 --silent',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
