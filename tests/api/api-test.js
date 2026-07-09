/**
 * TaxOrder Pro — API Integration Tests
 * Uruchom: node tests/api/api-test.js
 * Lub skopiuj do konsoli przeglądarki (w aplikacji, gdzie masz token).
 *
 * Konfiguracja przez zmienne środowiskowe lub stałe poniżej:
 *   TEST_URL       — base URL workera (domyślnie workers.dev)
 *   TEST_EMAIL     — email testowego konta
 *   TEST_PASS      — hasło testowego konta
 *   TEST_COMPANY   — slug firmy do testów (np. "demo")
 */

const IS_NODE = typeof window === 'undefined';

const CONFIG = {
  baseUrl:  (IS_NODE ? process.env.TEST_URL     : null) || 'https://taxorder-pro-api.adamus1000.workers.dev',
  email:    (IS_NODE ? process.env.TEST_EMAIL   : null) || '',
  password: (IS_NODE ? process.env.TEST_PASS    : null) || '',
  company:  (IS_NODE ? process.env.TEST_COMPANY : null) || 'demo',
};

if (IS_NODE) {
  // Node.js — fetch dostępny od v18, wcześniej trzeba polyfill
  const nodeFetch = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
  global.fetch = nodeFetch;
}

// ─── Mini test runner dla API ─────────────────────────────────
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

// ─── Testy ────────────────────────────────────────────────────

async function runAll() {
  const base = CONFIG.baseUrl;
  let token = null;

  console.log(`\n== TaxOrder Pro API Tests ==`);
  console.log(`Base URL: ${base}`);
  console.log(`Company:  ${CONFIG.company}\n`);

  // --- Autoryzacja ---
  console.log('[ Autoryzacja ]');

  await test('OPTIONS preflight → 200 i nagłówki CORS', async () => {
    const r = await fetch(`${base}/api/vehicles?company=${CONFIG.company}`, { method: 'OPTIONS' });
    assert(r.status === 200 || r.status === 204, `Status: ${r.status}`);
    const allow = r.headers.get('Access-Control-Allow-Methods') || '';
    assert(allow.includes('GET'), `Brak GET w Allow-Methods: ${allow}`);
  });

  await test('GET /api/vehicles bez tokenu → 401', async () => {
    const r = await fetch(`${base}/api/vehicles?company=${CONFIG.company}`);
    assert(r.status === 401, `Oczekiwano 401, otrzymano ${r.status}`);
  });

  await test('POST /api/auth/login z błędnymi danymi → 401', async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nie@istnieje.pl', password: 'zle_haslo' }),
    });
    assert(r.status === 401, `Oczekiwano 401, otrzymano ${r.status}`);
  });

  if (CONFIG.email && CONFIG.password) {
    await test('POST /api/auth/login z poprawnymi danymi → 200 + token', async () => {
      const r = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: CONFIG.email, password: CONFIG.password }),
      });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(d.token, 'Brak tokenu w odpowiedzi');
      token = d.token;
    });
  } else {
    console.log('  ⚠ Pominięto testy z tokenem — ustaw TEST_EMAIL i TEST_PASS\n');
  }

  // --- Pojazdy (wymagają tokenu) ---
  if (token) {
    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    console.log('\n[ Pojazdy ]');

    await test('GET /api/vehicles → 200 + tablica', async () => {
      const r = await fetch(`${base}/api/vehicles?company=${CONFIG.company}`, { headers: authHeaders });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(Array.isArray(d.vehicles ?? d), 'Odpowiedź nie jest tablicą');
    });

    await test('POST /api/vehicles/bulk z pustym body → 400', async () => {
      const r = await fetch(`${base}/api/vehicles/bulk?company=${CONFIG.company}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      assert(r.status === 400 || r.status === 422, `Oczekiwano 400/422, otrzymano ${r.status}`);
    });

    await test('GET /api/vehicles nieistniejąca firma → 403 lub pusta lista', async () => {
      const r = await fetch(`${base}/api/vehicles?company=__nie_istnieje_xyz__`, { headers: authHeaders });
      assert(r.status === 403 || r.status === 200, `Nieoczekiwany status: ${r.status}`);
    });

    // --- Eksport/Import ---
    console.log('\n[ Eksport/Import ]');

    await test('GET /api/export → 200 + struktura JSON', async () => {
      const r = await fetch(`${base}/api/export?company=${CONFIG.company}`, { headers: authHeaders });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(d.exportedAt, 'Brak exportedAt w odpowiedzi');
      assert(Array.isArray(d.vehicles), 'Brak pola vehicles');
      assert(Array.isArray(d.dt1Declarations), 'Brak pola dt1Declarations (eksport deklaracji DT-1)');
      assert(Array.isArray(d.webhooks), 'Brak pola webhooks (eksport webhooków)');
      assert(Array.isArray(d.fines), 'Brak pola fines');
      assert(Array.isArray(d.reservations), 'Brak pola reservations');
    });

    // --- Klucze API (roundtrip) ---
    console.log('\n[ Klucze API ]');

    // Sprawdź rolę — testy admin-only mogą być pominięte
    let userRole = 'viewer';
    try {
      const meR = await fetch(`${base}/api/auth/me`, { headers: authHeaders });
      if (meR.ok) { const me = await meR.json(); userRole = me.role || 'viewer'; }
    } catch {}

    if (userRole === 'admin') {
      let tempKeyId = null, tempKeyToken = null;

      await test('POST /api/api-keys → tworzy klucz read (admin)', async () => {
        const r = await fetch(`${base}/api/api-keys`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ name: 'api-test-smoke', company_id: CONFIG.company, scope: 'read' }),
        });
        assert(r.status === 200, `Status: ${r.status}`);
        const d = await r.json();
        assert(d.ok && d.key?.startsWith('tord_live_'), `Nieprawidłowa odpowiedź: ${JSON.stringify(d)}`);
        tempKeyId = d.id; tempKeyToken = d.key;
      });

      if (tempKeyToken) {
        const AH = { 'Authorization': `Bearer ${tempKeyToken}` };

        await test('GET /api/export z kluczem API → 200 (własna firma)', async () => {
          const r = await fetch(`${base}/api/export?company=${CONFIG.company}`, { headers: AH });
          assert(r.status === 200, `Status: ${r.status}`);
          const d = await r.json();
          assert(d.exportedAt, 'Brak exportedAt');
        });

        await test('GET /api/export z kluczem API → 403 (obca firma)', async () => {
          const r = await fetch(`${base}/api/export?company=__obca__`, { headers: AH });
          assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
        });

        await test('POST /api/import z kluczem read-only → 403', async () => {
          const r = await fetch(`${base}/api/import?company=${CONFIG.company}`, {
            method: 'POST', headers: { ...AH, 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicles: [] }),
          });
          assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
        });
      }

      if (tempKeyId) {
        await test('DELETE /api/api-keys/:id → 200 (sprząta klucz testowy)', async () => {
          const r = await fetch(`${base}/api/api-keys/${tempKeyId}`, { method: 'DELETE', headers: authHeaders });
          assert(r.status === 200, `Status: ${r.status}`);
        });
      }
    } else {
      await test('GET /api/api-keys bez uprawnień admin → 403', async () => {
        const r = await fetch(`${base}/api/api-keys`, { headers: authHeaders });
        assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
      });
    }
  }

  // --- Nagłówki bezpieczeństwa (front-end nie ma ich, ale worker powinien) ---
  console.log('\n[ Nagłówki odpowiedzi ]');

  await test('Worker nie zwraca Access-Control-Allow-Origin: * dla nieznanej domeny', async () => {
    const r = await fetch(`${base}/api/vehicles?company=${CONFIG.company}`, {
      headers: { 'Origin': 'https://zly-serwis.example.com' },
    });
    const acao = r.headers.get('Access-Control-Allow-Origin') || '';
    assert(!acao.includes('*'), `Otrzymano wildcard CORS: ${acao}`);
  });

  await test('Błędny endpoint → 404', async () => {
    const r = await fetch(`${base}/api/nieistniejacy-endpoint`);
    assert(r.status === 404, `Oczekiwano 404, otrzymano ${r.status}`);
  });

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
  runAll().then(({ fail }) => process.exit(fail > 0 ? 1 : 0)).catch(e => {
    console.error('Błąd krytyczny:', e);
    process.exit(2);
  });
} else {
  window.TaxOrderApiTests = { run: runAll };
  console.log('[API Tests] Wywołaj: TaxOrderApiTests.run()');
}
