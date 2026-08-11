/**
 * TaxOrder Pro — regresja raportowania: ESG (CO2 / paliwo) + kreator raportów
 * Uruchom: node tests/api/esg-reports-test.js
 *
 * Zmienne: TEST_URL, TEST_EMAIL, TEST_PASS, TEST_COMPANY
 *
 * DLACZEGO ISTNIEJE: `fuel_entries` nie istnieje w D1 i nigdy nie istniała, a wszystkie
 * zapytania do niej miały `.catch(() => ({results: []}))`. Efektem nie był błąd, tylko
 * **cicha zera**: CO2 i zużycie paliwa w raportach ESG wychodziły 0 dla każdej firmy
 * i roku, kreator raportów ze źródłem „Paliwo" zwracał pustą tabelę, a eksport
 * JPK_KR/SAF_T nie zawierał żadnych pozycji paliwowych. Żaden istniejący test tego nie
 * łapał — dane wyglądały wiarygodnie, po prostu były zerowe.
 *
 * Asercje są RELATYWNE, nie progowe. Nie zakładamy, że konto testowe ma tankowania —
 * zamiast tego porównujemy ESG z `/api/co2-report`, który czyta te same `fuel_fills`
 * tymi samymi wskaźnikami. Jeśli co2-report widzi paliwo, ESG MUSI je widzieć też.
 * Dzięki temu test nie jest podatny na stan danych, a i tak upadłby na starym kodzie.
 */

const IS_NODE = typeof window === 'undefined';

const CONFIG = {
  baseUrl:  (IS_NODE ? process.env.TEST_URL     : null) || 'https://taxorder-pro-api.adamus1000.workers.dev',
  email:    (IS_NODE ? process.env.TEST_EMAIL   : null) || '',
  password: (IS_NODE ? process.env.TEST_PASS    : null) || '',
  company:  (IS_NODE ? process.env.TEST_COMPANY : null) || 'mtoilet',
  year:     new Date().getFullYear(),
};

let _pass = 0, _fail = 0, _skip = 0;
const failures = [];

async function test(name, fn) {
  try { await fn(); _pass++; console.log(`  ✓ ${name}`); }
  catch (e) {
    if (e && e.__skip) { _skip++; console.log(`  ○ ${name} — ${e.message}`); return; }
    _fail++; failures.push({ name, error: e.message }); console.log(`  ✗ ${name}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function skip(msg) { const e = new Error(msg); e.__skip = true; throw e; }

async function runAll() {
  const base = CONFIG.baseUrl;
  console.log('\nESG + kreator raportów — regresja „cichych zer"\n');
  console.log(`Worker:  ${base}`);
  console.log(`Firma:   ${CONFIG.company}   Rok: ${CONFIG.year}\n`);

  if (!CONFIG.email || !CONFIG.password) {
    console.log('⚠ Brak TEST_EMAIL / TEST_PASS — pomijam.\n');
    return { pass: 0, fail: 0, skipped: true };
  }

  let token = null;
  await test('POST /api/auth/login → token', async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CONFIG.email, password: CONFIG.password }),
    });
    assert(r.status === 200, `Oczekiwano 200, otrzymano ${r.status}`);
    const d = await r.json();
    assert(d.token, 'Brak tokenu w odpowiedzi');
    token = d.token;
  });
  if (!token) { console.log('\n✗ Brak tokenu — dalsze testy pominięte.\n'); _fail++; return { pass: _pass, fail: _fail }; }

  const hdrs = { Authorization: `Bearer ${token}` };
  const q = `company=${encodeURIComponent(CONFIG.company)}&year=${CONFIG.year}`;

  // Punkt odniesienia: /api/co2-report czyta fuel_fills i liczy CO2 z CO2_EMISSION_FACTORS.
  let co2Report = null;
  await test('GET /api/co2-report → 200 (punkt odniesienia dla ESG)', async () => {
    const r = await fetch(`${base}/api/co2-report?${q}`, { headers: hdrs });
    assert(r.status === 200, `Oczekiwano 200, otrzymano ${r.status}`);
    co2Report = await r.json();
    assert(typeof co2Report.total_kg === 'number', 'Brak liczbowego total_kg');
  });

  let esg = null;
  await test('GET /api/esg-targets → 200 + sekcja actuals', async () => {
    const r = await fetch(`${base}/api/esg-targets?${q}`, { headers: hdrs });
    assert(r.status === 200, `Oczekiwano 200, otrzymano ${r.status}`);
    esg = await r.json();
    assert(esg.actuals, 'Brak sekcji actuals w odpowiedzi');
  });

  // ─── Właściwa regresja ──────────────────────────────────────────────────────
  await test('ESG widzi CO2, jeśli widzi je /api/co2-report (regresja fuel_entries)', async () => {
    if (!co2Report || !esg) skip('brak danych z poprzednich kroków');
    if (!(co2Report.total_kg > 0)) skip(`brak tankowań w ${CONFIG.year} — nie ma czego porównać`);
    const t = Number(esg.actuals.co2_total_tonnes);
    assert(Number.isFinite(t) && t > 0,
      `co2-report widzi ${co2Report.total_kg} kg, a ESG zwraca co2_total_tonnes=${esg.actuals.co2_total_tonnes}. ` +
      'Tak wygląda odpytywanie nieistniejącej tabeli przez .catch().');
  });

  await test('ESG i co2-report zgadzają się co do rzędu wielkości CO2', async () => {
    if (!co2Report || !esg) skip('brak danych z poprzednich kroków');
    if (!(co2Report.total_kg > 0)) skip('brak tankowań — nie ma czego porównać');
    const esgKg = Number(esg.actuals.co2_total_tonnes) * 1000;
    const ratio = esgKg / co2Report.total_kg;
    assert(ratio > 0.5 && ratio < 2,
      `ESG=${esgKg.toFixed(0)} kg vs co2-report=${co2Report.total_kg} kg (stosunek ${ratio.toFixed(2)}). ` +
      'Rozjazd oznacza inne źródło danych albo inne wskaźniki emisji po obu stronach.');
  });

  await test('ESG raportuje zużycie paliwa, jeśli są tankowania', async () => {
    if (!co2Report || !esg) skip('brak danych z poprzednich kroków');
    if (!(co2Report.total_kg > 0)) skip('brak tankowań — nie ma czego porównać');
    const l = Number(esg.actuals.fuel_consumption_l);
    assert(Number.isFinite(l) && l > 0, `fuel_consumption_l=${esg.actuals.fuel_consumption_l} mimo tankowań w co2-report`);
  });

  // ─── Kreator raportów ───────────────────────────────────────────────────────
  await test('Kreator raportów: źródło "fuel_fills" jest dozwolone', async () => {
    const r = await fetch(`${base}/api/report-builder/run?company=${encodeURIComponent(CONFIG.company)}`, {
      method: 'POST', headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'fuel_fills', cols: ['fill_date', 'nr_rej', 'liters', 'total_cost'], limit: 5 }),
    });
    assert(r.status === 200, `Oczekiwano 200, otrzymano ${r.status}`);
    const d = await r.json();
    assert(!d.error, `Backend odrzucił źródło: ${d.error}`);
    assert(Array.isArray(d.rows), 'Brak tablicy rows w odpowiedzi');
  });

  await test('Kreator raportów: martwe źródło "fuel_entries" jest odrzucane', async () => {
    const r = await fetch(`${base}/api/report-builder/run?company=${encodeURIComponent(CONFIG.company)}`, {
      method: 'POST', headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'fuel_entries', cols: ['liters'], limit: 5 }),
    });
    const d = await r.json().catch(() => ({}));
    assert(d.error, 'fuel_entries nie istnieje w bazie — powinno być odrzucone, nie zwracać pustej tabeli');
  });

  console.log(`\n${'─'.repeat(46)}`);
  console.log(`Wynik: ${_pass} PASS / ${_fail} FAIL / ${_skip} SKIP`);
  if (_fail) { console.log('\nNiezdane:'); failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`)); }
  console.log('');
  return { pass: _pass, fail: _fail };
}

if (IS_NODE) {
  runAll().then(({ fail }) => process.exit(fail > 0 ? 1 : 0))
    .catch(e => { console.error('Błąd krytyczny:', e); process.exit(2); });
} else {
  window.TaxOrderEsgTests = { run: runAll };
}
