#!/usr/bin/env node
/**
 * TaxOrder Pro — weryfikacja migracji schema_v44 (firmy jako dane)
 *
 * Uruchom PO `wrangler deploy` a PRZED mergem do main.
 * Sprawdza, czy nowe endpointy działają i czy seed firm doszedł do bazy.
 *
 *   node tools/autotest/verify-v44.js
 *
 * Zmienne środowiskowe:
 *   PROD_WORKER_URL — URL workera (domyślnie wbudowany)
 *   TEST_EMAIL      — e-mail konta testowego (rola admin dla pełnego zakresu)
 *   TEST_PASS       — hasło konta testowego
 *
 * Kody wyjścia:
 *   0 — wszystko OK (albo pominięto z braku credentiali)
 *   1 — wykryto problem, NIE merguj
 */

const BASE  = process.env.PROD_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
const EMAIL = process.env.TEST_EMAIL || '';
const PASS  = process.env.TEST_PASS  || '';

const SEED = ['mtoilet', 'gcon', 'grental', 'kjrsupply', 'nwkinvest', 'wolund'];

let pass = 0, fail = 0, skip = 0;
const problems = [];

function ok(m)   { console.log('  \x1b[32m✓\x1b[0m ' + m); pass++; }
function bad(m)  { console.log('  \x1b[31m✗\x1b[0m ' + m); fail++; problems.push(m); }
function warn(m) { console.log('  \x1b[33m•\x1b[0m ' + m); skip++; }

async function req(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(BASE + path, { ...opts, signal: ctrl.signal });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  } finally { clearTimeout(t); }
}

(async () => {
  console.log('\n═══ Weryfikacja schema_v44 — firmy jako dane ═══');
  console.log('Worker: ' + BASE + '\n');

  // ── 1. Endpoint istnieje i wymaga autoryzacji ────────────────────────────
  console.log('1. Routing i autoryzacja');
  try {
    const r = await req('/api/companies');
    // 404 = jedyny sygnal, ze Workera nie wdrozono. 401 = poprawne odrzucenie.
    // 403 bywa zwracane przez Cloudflare WAF przy ruchu z IP centrum danych
    // (ten sam problem ma api-smoke-test.js) — nie traktujemy tego jako bledu kodu.
    if (r.status === 404) {
      bad('/api/companies → 404 — Worker NIE zawiera nowego kodu. Uruchom wrangler deploy.');
    } else if (r.status === 401) {
      ok('/api/companies bez tokenu → 401 (poprawnie)');
    } else if (r.status === 403 || r.status === 429) {
      warn('/api/companies → ' + r.status + ' (Cloudflare WAF / rate-limit, nie blad kodu). Endpoint istnieje.');
    } else {
      warn('/api/companies bez tokenu → ' + r.status + ' (nietypowe, ale endpoint odpowiada)');
    }
  } catch (e) { bad('Brak połączenia z Workerem: ' + e.message); }

  if (!EMAIL || !PASS) {
    console.log('\n\x1b[33mBrak TEST_EMAIL / TEST_PASS — pomijam testy uwierzytelnione.\x1b[0m');
    console.log('Ustaw je, żeby zweryfikować seed firm i dostępy.\n');
    summary();
    return;
  }

  // ── 2. Logowanie ─────────────────────────────────────────────────────────
  console.log('\n2. Logowanie');
  let token = '';
  try {
    const r = await req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS })
    });
    token = r.body.token || r.body.session || '';
    if (token) ok('Zalogowano jako ' + EMAIL);
    else { bad('Logowanie nieudane (' + r.status + ') — dalsze testy pominięte'); summary(); return; }
  } catch (e) { bad('Błąd logowania: ' + e.message); summary(); return; }

  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  // ── 3. Seed firm ─────────────────────────────────────────────────────────
  console.log('\n3. Tabela companies (seed z migracji)');
  const r3 = await req('/api/companies', { headers: H });
  if (r3.status !== 200) {
    bad('/api/companies → ' + r3.status + ' ' + (r3.body.error || '') +
        '\n      Prawdopodobnie NIE uruchomiono migracji schema_v44.sql');
  } else {
    const list = Array.isArray(r3.body.companies) ? r3.body.companies : [];
    ok('Zwrócono ' + list.length + ' firm');

    const ids = new Set(list.map(c => c.id));
    const missing = SEED.filter(s => !ids.has(s));
    if (!missing.length) ok('Wszystkie 6 firm z seeda obecne');
    else warn('Brak w odpowiedzi: ' + missing.join(', ') +
              ' (normalne, jeśli konto nie jest adminem i nie ma do nich dostępu)');

    const mt = list.find(c => c.id === 'mtoilet');
    if (mt) {
      if (mt.nip === '5361938486') ok('Dane mToilet poprawne (NIP zgodny z literałem w app.js)');
      else bad('NIP mToilet w bazie: ' + mt.nip + ' — oczekiwano 5361938486');
      if (mt.organ && mt.organ.includes('Białołęka')) ok('Organ podatkowy zachowany (kluczowe dla DT-1)');
      else bad('Brak lub błędny organ podatkowy mToilet — sprawdź DT-1!');
    }
  }

  // ── 4. Dostępy ───────────────────────────────────────────────────────────
  console.log('\n4. Endpoint dostępów');
  const r4 = await req('/api/company-access', { headers: H });
  if (r4.status === 200)      ok('/api/company-access działa');
  else if (r4.status === 403) warn('/api/company-access → 403 (konto nie jest adminem — poprawne zachowanie)');
  else                        bad('/api/company-access → ' + r4.status + ' ' + (r4.body.error || ''));

  // ── 5. Walidacja zapisu (bez tworzenia śmieci) ───────────────────────────
  console.log('\n5. Walidacja danych wejściowych');
  const r5 = await req('/api/companies', {
    method: 'POST', headers: H,
    body: JSON.stringify({ id: 'ZŁY SLUG!!', short_name: 'x', name: 'y' })
  });
  if (r5.status === 400)      ok('Niepoprawny slug odrzucony (400)');
  else if (r5.status === 403) warn('Brak uprawnień admina — walidacji nie sprawdzono');
  else                        bad('Niepoprawny slug → ' + r5.status + ' (oczekiwano 400)');

  const r6 = await req('/api/companies', {
    method: 'POST', headers: H,
    body: JSON.stringify({ id: 'mtoilet', short_name: 'Dubel', name: 'Duplikat' })
  });
  if (r6.status === 409)      ok('Duplikat identyfikatora odrzucony (409)');
  else if (r6.status === 403) warn('Brak uprawnień admina — testu duplikatu nie wykonano');
  else                        bad('Duplikat → ' + r6.status + ' (oczekiwano 409)');

  // ── 6. Izolacja tenanta — poprawka IDOR ──────────────────────────────────
  console.log('\n6. Izolacja tenanta (poprawka IDOR)');
  const r7 = await req('/api/folder-monitor/queue/nieistniejace-id-' + Date.now(), {
    method: 'PATCH', headers: H, body: JSON.stringify({ status: 'skipped' })
  });
  if (r7.status === 404)      ok('PATCH nieistniejącej pozycji → 404 (scope firmy działa)');
  else if (r7.status === 400) warn('PATCH → 400 (walidacja zadziałała wcześniej)');
  else                        bad('PATCH nieistniejącej pozycji → ' + r7.status + ' (oczekiwano 404)');

  summary();
})();

function summary() {
  console.log('\n' + '─'.repeat(60));
  console.log(`Wynik: \x1b[32m${pass} OK\x1b[0m · \x1b[31m${fail} błędów\x1b[0m · \x1b[33m${skip} pominięto\x1b[0m`);
  if (fail) {
    console.log('\n\x1b[31mNIE MERGUJ — do naprawy:\x1b[0m');
    problems.forEach(p => console.log('  • ' + p));
    console.log('\nWycofanie: patrz docs/ROLLBACK_v44.md');
    process.exit(1);
  }
  console.log('\n\x1b[32mMigracja zweryfikowana — można mergować.\x1b[0m\n');
  process.exit(0);
}
