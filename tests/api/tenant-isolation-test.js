/**
 * TaxOrder Pro — Test izolacji tenantów (regresja gatingu uprawnień)
 * Uruchom: node tests/api/tenant-isolation-test.js
 *
 * W przeciwieństwie do api-test.js (konto adamus1000@gmail.com, role=admin,
 * który celowo pomija scoping firmy — worker/index.js:8672-8679) ten plik
 * loguje się kontem NIE-ADMINEM i sprawdza, czy próby dotknięcia danych
 * OBCEJ firmy przez ?company=<inna> konsekwentnie kończą się 403.
 *
 * Konto testowe utworzone 2026-08-10 (patrz CLAUDE.md HANDOFF):
 *   email:   TEST_EMAIL_NONADMIN (sekret GitHub)
 *   hasło:   TEST_PASS_NONADMIN (sekret GitHub)
 *   rola:    kierownik
 *   firma:   gcon
 *
 * Cel innej firmy (do której NIE powinno być dostępu) jest celowo
 * zahardkodowany na 'mtoilet' — to jedyna spółka, do której to konto
 * na pewno nie ma dostępu (przypisane do gcon), więc nie wymaga sekretu.
 *
 * Konfiguracja przez zmienne środowiskowe:
 *   TEST_URL              — base URL workera (domyślnie workers.dev)
 *   TEST_EMAIL_NONADMIN    — email konta nie-admina
 *   TEST_PASS_NONADMIN     — hasło konta nie-admina
 *   TEST_COMPANY_NONADMIN  — firma, do której to konto MA dostęp (domyślnie 'gcon')
 */

const IS_NODE = typeof window === 'undefined';

const CONFIG = {
  baseUrl:      (IS_NODE ? process.env.TEST_URL              : null) || 'https://taxorder-pro-api.adamus1000.workers.dev',
  email:        (IS_NODE ? process.env.TEST_EMAIL_NONADMIN   : null) || '',
  password:     (IS_NODE ? process.env.TEST_PASS_NONADMIN    : null) || '',
  ownCompany:   (IS_NODE ? process.env.TEST_COMPANY_NONADMIN : null) || 'gcon',
  foreignCompany: 'mtoilet',
};

if (IS_NODE) {
  const nodeFetch = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
  global.fetch = nodeFetch;
}

let _pass = 0, _fail = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    _pass++;
    results.push({ ok: true, name });
    IS_NODE ? process.stdout.write(`  ✓ ${name}\n`) : console.log(`✓ ${name}`);
  } catch (e) {
    _fail++;
    results.push({ ok: false, name, error: e.message });
    IS_NODE ? process.stdout.write(`  ✗ ${name}\n    → ${e.message}\n`) : console.error(`✗ ${name}:`, e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Asercja nie powiodła się');
}

async function runAll() {
  const base = CONFIG.baseUrl;

  console.log(`\n== TaxOrder Pro — Test izolacji tenantów ==`);
  console.log(`Base URL: ${base}`);
  console.log(`Konto:    nie-admin, firma własna "${CONFIG.ownCompany}"\n`);

  if (!CONFIG.email || !CONFIG.password) {
    console.log('  ⚠ Pominięto — ustaw TEST_EMAIL_NONADMIN i TEST_PASS_NONADMIN\n');
    return { pass: 0, fail: 0, results: [], skipped: true };
  }

  let token = null;

  console.log('[ Logowanie ]');
  await test('POST /api/auth/login (konto nie-admin) → 200 + token + poprawna rola/firma', async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CONFIG.email, password: CONFIG.password }),
    });
    assert(r.status === 200, `Status: ${r.status}`);
    const d = await r.json();
    assert(d.token, 'Brak tokenu w odpowiedzi');
    assert(d.user?.role !== 'admin', `Konto ma rolę admin (${d.user?.role}) — testy izolacji wymagają NIE-admina, popraw sekrety`);
    assert(d.user?.company_id === CONFIG.ownCompany, `Oczekiwano firmy "${CONFIG.ownCompany}", otrzymano "${d.user?.company_id}"`);
    token = d.token;
  });

  if (!token) {
    console.log(`\n${'─'.repeat(40)}\nWynik: ${_pass} PASS / ${_fail} FAIL — logowanie nieudane, reszta testów pominięta\n`);
    return { pass: _pass, fail: _fail, results };
  }

  const hdrs = { Authorization: `Bearer ${token}` };
  const foreign = CONFIG.foreignCompany;

  console.log('\n[ Własna firma — dostęp MA działać ]');
  await test(`GET /api/vehicles?company=${CONFIG.ownCompany} → 200`, async () => {
    const r = await fetch(`${base}/api/vehicles?company=${CONFIG.ownCompany}`, { headers: hdrs });
    assert(r.status === 200, `Status: ${r.status}`);
  });

  console.log(`\n[ Cudza firma (${foreign}) — dostęp MUSI być zablokowany ]`);

  const crossTenantChecks = [
    ['GET',  `/api/vehicles?company=${foreign}`],
    ['GET',  `/api/export?company=${foreign}`],
    ['GET',  `/api/damages?company=${foreign}`],
    ['GET',  `/api/fleet-cards?company=${foreign}`],
    ['GET',  `/api/drivers?company=${foreign}`],
    ['GET',  `/api/fines?company=${foreign}`],
  ];

  for (const [method, path] of crossTenantChecks) {
    await test(`${method} ${path} → 403`, async () => {
      const r = await fetch(`${base}${path}`, { method, headers: hdrs });
      assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status} — MOŻLIWY IDOR`);
    });
  }

  // --- Podsumowanie ---
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Wynik: ${_pass} PASS / ${_fail} FAIL`);
  if (_fail > 0) {
    console.log('\nNiezdane testy:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name}: ${r.error}`));
  }
  console.log('');

  return { pass: _pass, fail: _fail, results };
}

if (IS_NODE) {
  runAll().then(({ fail, skipped }) => process.exit(skipped ? 0 : (fail > 0 ? 1 : 0))).catch(e => {
    console.error('Błąd krytyczny:', e);
    process.exit(2);
  });
} else {
  window.TaxOrderTenantIsolationTests = { run: runAll };
  console.log('[Tenant Isolation Tests] Wywołaj: TaxOrderTenantIsolationTests.run()');
}
