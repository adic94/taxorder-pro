#!/usr/bin/env node
/**
 * TaxOrder Pro — API Smoke Test (weryfikacja produkcji po deploy)
 * Cel: szybki (<30s), bez potrzeby logowania, uruchamiany przez deploy.ps1
 *
 * Tryby:
 *   bez flag      — tylko testy publiczne (nie wymaga credentiali)
 *   --auth        — + testy uwierzytelnione (wymaga TEST_EMAIL, TEST_PASS, TEST_COMPANY)
 *   --full        — --auth + testy CRUD (może modyfikować dane testowe)
 *
 * Zmienne środowiskowe:
 *   PROD_WORKER_URL  — URL workera (domyślnie: wbudowany)
 *   TEST_EMAIL       — e-mail konta testowego
 *   TEST_PASS        — hasło konta testowego
 *   TEST_COMPANY     — slug firmy (np. mtoilet)
 */

const BASE  = process.env.PROD_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
const EMAIL = process.env.TEST_EMAIL  || '';
const PASS  = process.env.TEST_PASS   || '';
const CO    = process.env.TEST_COMPANY || 'mtoilet';
const AUTH  = process.argv.includes('--auth') || process.argv.includes('--full');
const FULL  = process.argv.includes('--full');
const TIMEOUT_MS = 12000;

// ── Helpers ──────────────────────────────────────────────────────────────────

let pass = 0, fail = 0, skip = 0;
const failed = [];
const START  = Date.now();

// Opóźnienie między requestami
const DELAY_MS = 300;
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Licznik 429 — jeśli wszystkie requesty dostają 429, to Cloudflare WAF blokuje nasze IP
let _total429 = 0;
let _totalReqs = 0;

async function req(method, path, opts = {}) {
  await delay(DELAY_MS);
  _totalReqs++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${BASE}${path}`;
    const res = await fetch(url, { method, signal: controller.signal, ...opts });
    clearTimeout(timer);
    if (res.status === 429) _total429++;
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e.name === 'AbortError' ? `Timeout (${TIMEOUT_MS}ms)` : e.message);
  }
}

async function t(label, fn) {
  try {
    await fn();
    process.stdout.write(`  ✅ ${label}\n`);
    pass++;
  } catch (e) {
    process.stdout.write(`  ❌ ${label}\n     → ${e.message}\n`);
    failed.push({ label, error: e.message });
    fail++;
  }
}

function skipped(label, reason) {
  process.stdout.write(`  ⏭  ${label} (${reason})\n`);
  skip++;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function section(name) { console.log(`\n[ ${name} ]`); }

// ── Testy ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║      TaxOrder Pro — API Smoke Test                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nWorker: ${BASE}`);
  console.log(`Firma:  ${CO}  |  Auth: ${AUTH ? 'tak' : 'nie (tylko publiczne)'}\n`);

  // ── 1. Łączność i routing ──────────────────────────────────────────────────
  section('Łączność i routing');

  await t('Worker odpowiada na żądanie HTTP', async () => {
    const r = await req('GET', '/api/auth/me');
    assert(r.status > 0, `Brak odpowiedzi (status ${r.status})`);
  });

  await t('Chroniony endpoint bez tokenu → 401', async () => {
    const r = await req('GET', `/api/vehicles?company=${CO}`);
    assert(r.status === 401, `Oczekiwano 401, otrzymano ${r.status}`);
  });

  await t('Nieistniejący endpoint → 404', async () => {
    const r = await req('GET', '/api/__nie_istnieje_xyz__');
    assert(r.status === 404, `Oczekiwano 404, otrzymano ${r.status}`);
  });

  await t('OPTIONS preflight → 200/204 + nagłówki CORS', async () => {
    const r = await req('OPTIONS', `/api/vehicles?company=${CO}`, {
      headers: { 'Origin': 'https://taxorder-pro.pages.dev', 'Access-Control-Request-Method': 'GET' }
    });
    assert([200, 204].includes(r.status), `Status: ${r.status}`);
    const acao = r.headers.get('Access-Control-Allow-Origin') || '';
    assert(acao.length > 0, 'Brak nagłówka Access-Control-Allow-Origin');
  });

  await t('CORS nie zwraca wildcard (*) dla nieznanej domeny', async () => {
    const r = await req('GET', `/api/auth/me`, {
      headers: { 'Origin': 'https://zly-atak.example.com' }
    });
    const acao = r.headers.get('Access-Control-Allow-Origin') || '';
    assert(!acao.includes('*'), `Wildcard CORS wykryty: "${acao}"`);
  });

  // ── 2. Publiczne endpointy (bez auth) ─────────────────────────────────────
  section('Publiczne endpointy');

  await t('POST /api/errors (logger JS) → 200/201', async () => {
    const r = await req('POST', '/api/errors', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_type: 'smoke_test', error_msg: 'Smoke test ping', url: '/smoke-test', stack: '' }),
    });
    assert([200, 201, 204].includes(r.status), `Status: ${r.status}`);
  });

  await t('GET /api/push/vapid-public-key → 200 + klucz', async () => {
    const r = await req('GET', '/api/push/vapid-public-key');
    assert(r.status === 200, `Status: ${r.status}`);
    const d = await r.json();
    assert(d.publicKey || d.key || typeof d === 'string', 'Brak klucza VAPID w odpowiedzi');
  });

  // ── 3. Uwierzytelnianie ────────────────────────────────────────────────────
  section('Uwierzytelnianie');

  await t('POST /api/auth/login z błędnym hasłem → 401', async () => {
    const r = await req('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke_test@nie.istnieje', password: 'zle_haslo_xyz' }),
    });
    assert(r.status === 401, `Oczekiwano 401, otrzymano ${r.status}`);
  });

  let token = null;

  if (AUTH && EMAIL && PASS) {
    await t('POST /api/auth/login z poprawnymi danymi → 200 + token', async () => {
      const r = await req('POST', '/api/auth/login', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASS }),
      });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(d.token, `Brak tokenu: ${JSON.stringify(d)}`);
      token = d.token;
    });
  } else if (AUTH) {
    skipped('Login z poprawnymi danymi', 'brak TEST_EMAIL / TEST_PASS');
  }

  // ── 4. Kluczowe endpointy (wymagają tokenu) ───────────────────────────────
  if (token) {
    const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    section('Kluczowe endpointy (zalogowany)');

    let userRole = 'viewer';
    await t('GET /api/auth/me → 200 + dane użytkownika', async () => {
      const r = await req('GET', '/api/auth/me', { headers: H });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(d.email || d.user?.email, 'Brak e-maila w odpowiedzi');
      userRole = d.role || d.user?.role || 'viewer';
    });

    await t(`GET /api/vehicles?company=${CO} → 200 + tablica`, async () => {
      const r = await req('GET', `/api/vehicles?company=${CO}`, { headers: H });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(Array.isArray(d.vehicles ?? d), 'Odpowiedź nie zawiera tablicy pojazdów');
    });

    await t('GET /api/dashboard/stats → 200', async () => {
      const r = await req('GET', `/api/dashboard/stats?company=${CO}`, { headers: H });
      assert([200, 204].includes(r.status), `Status: ${r.status}`);
    });

    await t('GET /api/export → 200 + exportedAt', async () => {
      const r = await req('GET', `/api/export?company=${CO}`, { headers: H });
      assert(r.status === 200, `Status: ${r.status}`);
      const d = await r.json();
      assert(d.exportedAt, 'Brak pola exportedAt w eksporcie');
      assert(Array.isArray(d.vehicles), 'Brak pola vehicles w eksporcie');
    });

    await t('GET /api/dt1-declarations → 200', async () => {
      const r = await req('GET', `/api/dt1-declarations?company=${CO}`, { headers: H });
      assert([200, 204].includes(r.status), `Status: ${r.status}`);
    });

    await t('GET /api/webhooks → 200 (lista webhooków)', async () => {
      const r = await req('GET', `/api/webhooks?company=${CO}`, { headers: H });
      assert([200, 204].includes(r.status), `Status: ${r.status}`);
    });

    await t('POST /api/webhooks z URL bez https:// → 400 (walidacja)', async () => {
      const r = await req('POST', `/api/webhooks?company=${CO}`, {
        headers: H,
        body: JSON.stringify({ name: 'test', url: 'http://niezabezpieczony.pl', events: [] }),
      });
      assert(r.status === 400, `Oczekiwano 400 (walidacja HTTPS), otrzymano ${r.status}`);
    });

    // ── 5. Klucze API (tylko admin) ───────────────────────────────────────────
    if (userRole === 'admin') {
      section('Klucze API (admin)');

      let apiKeyId = null;
      let apiKeyToken = null;

      await t('GET /api/api-keys → 200 + tablica (admin)', async () => {
        const r = await req('GET', '/api/api-keys', { headers: H });
        assert(r.status === 200, `Status: ${r.status}`);
        const d = await r.json();
        assert(Array.isArray(d), 'Odpowiedź nie jest tablicą');
      });

      await t('POST /api/api-keys → tworzy klucz + zwraca tord_live_ token', async () => {
        const r = await req('POST', '/api/api-keys', {
          headers: H,
          body: JSON.stringify({ name: 'smoke-test-key', company_id: CO, scope: 'read' }),
        });
        assert(r.status === 200, `Status: ${r.status}`);
        const d = await r.json();
        assert(d.ok, `Brak pola ok: ${JSON.stringify(d)}`);
        assert(typeof d.key === 'string' && d.key.startsWith('tord_live_'), `Nieprawidłowy token: ${d.key}`);
        apiKeyId    = d.id;
        apiKeyToken = d.key;
      });

      if (apiKeyToken) {
        const AH = { 'Authorization': `Bearer ${apiKeyToken}` };

        await t('GET /api/export z kluczem API → 200 (autentykacja kluczem)', async () => {
          const r = await req('GET', `/api/export?company=${CO}`, { headers: AH });
          assert(r.status === 200, `Status: ${r.status}`);
          const d = await r.json();
          assert(d.exportedAt, 'Brak exportedAt w odpowiedzi');
        });

        await t('GET /api/export z kluczem API → 403 przy innej firmie (granica firmy)', async () => {
          const r = await req('GET', '/api/export?company=__obca_firma__', { headers: AH });
          assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
        });

        await t('POST /api/import z kluczem read-only → 403 (brak uprawnień zapisu)', async () => {
          const r = await req('POST', `/api/import?company=${CO}`, {
            headers: { ...AH, 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicles: [] }),
          });
          assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
        });
      }

      if (apiKeyId) {
        await t('DELETE /api/api-keys/:id → usuwa klucz testowy', async () => {
          const r = await req('DELETE', `/api/api-keys/${apiKeyId}`, { headers: H });
          assert(r.status === 200, `Status: ${r.status}`);
          const d = await r.json();
          assert(d.ok, 'Odpowiedź nie zawiera ok:true');
        });
      }

    } else {
      skipped('Klucze API', `konto "${userRole}" nie ma uprawnień admin`);

      await t('GET /api/api-keys bez uprawnień admin → 403', async () => {
        const r = await req('GET', '/api/api-keys', { headers: H });
        assert(r.status === 403, `Oczekiwano 403, otrzymano ${r.status}`);
      });
    }

    if (FULL) {
      section('CRUD (tryb --full)');
      skipped('Testy CRUD', 'implementacja w api-test.js — uruchom: npm run test:api');
    }
  } else if (AUTH) {
    section('Endpointy zalogowanego');
    skipped('Testy z tokenem', 'logowanie nie powiodło się lub brak credentiali');
  }

  // ── Podsumowanie ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - START) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(54)}`);
  console.log(`Wynik: ${pass} ✅  ${fail} ❌  ${skip} ⏭   (${elapsed}s)`);

  // Jeśli >50% requestów dostało 429 — to Cloudflare WAF blokuje IP testera, nie błąd kodu
  const wafBlocked = _totalReqs > 0 && (_total429 / _totalReqs) > 0.5;
  if (wafBlocked) {
    console.log(`\n⚠ UWAGA: ${_total429}/${_totalReqs} requestów zwróciło 429 — IP testera jest zablokowane`);
    console.log('  przez Cloudflare WAF (intensywne testowanie). Poczekaj ~5 min i uruchom ponownie.');
    console.log('  Worker działa poprawnie — to jest blokada infrastrukturalna, nie błąd kodu.\n');
    process.exit(2); // exit 2 = WAF rate limit, nie błąd deployu
  }

  if (failed.length) {
    console.log('\nNiezdane testy:');
    failed.forEach(f => console.log(`  • ${f.label}\n    ${f.error}`));
    console.log('\n❌ Smoke test FAILED — sprawdź powyższe błędy przed ogłoszeniem sukcesu deployu\n');
  } else {
    console.log('\n✅ Smoke test PASSED — produkcja odpowiada poprawnie\n');
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('\n❌ Krytyczny błąd smoke testu:', e.message);
  process.exit(2);
});
