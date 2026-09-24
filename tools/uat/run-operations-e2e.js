#!/usr/bin/env node
/** Loguje się do UAT i uruchamia UI Playwright bez zapisywania tokenu w plikach repo. */
require('dotenv').config({ quiet: true });
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const API = 'https://taxorder-pro-api-uat.adamus1000.workers.dev';

(async () => {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASS) {
    throw new Error('Brak TEST_EMAIL lub TEST_PASS w .env.');
  }
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASS }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) throw new Error(`Logowanie UAT nieudane: HTTP ${response.status}`);

  const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const result = spawnSync(process.execPath, [cli, 'test',
    'tests/e2e/operations-center-acceptance.spec.js', '--project=chromium',
  ], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_URL: '',
      TEST_TOKEN: data.token,
      TEST_COMPANY: 'uat-demo',
      UAT_API_URL: API,
    },
  });
  process.exit(result.status ?? 1);
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});

