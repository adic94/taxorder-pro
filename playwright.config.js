// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // testy logowania muszą być sekwencyjne
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/results/html', open: 'never' }],
  ],

  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
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
