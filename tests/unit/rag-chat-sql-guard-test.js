#!/usr/bin/env node
/**
 * Bramka: zabezpieczenie SQL w RAG chat (handleRagChat, worker/index.js).
 *
 * PO CO. Do 02.09.2026 handleRagChat wykonywał DOWOLNY SELECT wygenerowany przez
 * model AI bezpośrednio na produkcyjnej bazie — jedynym warunkiem było "zaczyna się
 * od SELECT". Filtr `company_id` istniał wyłącznie jako PROŚBA w prompcie, nie jako
 * wymóg egzekwowany kodem. Pytanie użytkownika trafia do tej samej rozmowy, którą
 * czyta model, więc dowolny zalogowany użytkownik (dowolnej roli, dowolnej firmy)
 * mógł prompt-injectionem skłonić model do zwrócenia np. `SELECT email,password_hash
 * FROM users` albo zapytania bez filtra firmy — i Worker wykonałby to bez sprzeciwu.
 * To dokładnie ta klasa błędu (IDOR / brak scope'u company_id), przed którą CLAUDE.md
 * ostrzega przy KAŻDYM innym endpoincie w tym repo — tu whitelistę zastąpiono
 * zaufaniem do LLM.
 *
 * Naprawa: `validateRagSql(sql, company_id)` — whitelista tabel (ten sam wzorzec co
 * `ALLOWED_TABLES` w handleReportBuilder) + wymóg literalnego `company_id='<firma>'`
 * w wygenerowanym SQL-u, sprawdzany kodem, nie promptem.
 *
 * CO SPRAWDZA. Wyciąga `RAG_ALLOWED_TABLES` i `validateRagSql` BEZPOŚREDNIO z
 * worker/index.js (nie kopiuje ich) — ten sam wzorzec ekstrakcji co
 * tools/aztec-compare.js dla `_decodeAztecPayload`. Kopia rozjechałaby się z
 * produkcją i przestała mierzyć to, co ma mierzyć.
 *
 * GRANICA (udokumentowana też w komentarzu przy kodzie): to heurystyka regexowa,
 * nie parser SQL. Nie łapie semantycznie pustego filtra typu `WHERE 1=1 OR
 * company_id='x'`. Ten test tego też nie udaje — sprawdza dokładnie to, co
 * `validateRagSql` faktycznie robi: blokadę dostępu do niedozwolonych tabel i
 * wymóg obecności poprawnego filtra firmy.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', msg); }
}

const ROOT = path.join(__dirname, '..', '..');

function wyciagnijWalidator() {
  const src = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');
  const OD = "const RAG_ALLOWED_TABLES = new Set(";
  const DO = 'async function handleRagChat';
  const i = src.indexOf(OD), j = src.indexOf(DO);
  if (i < 0 || j < 0 || j < i) {
    console.error('Nie znaleziono sekcji RAG_ALLOWED_TABLES/validateRagSql w worker/index.js.');
    console.error(`Kotwice: "${OD}" oraz "${DO}" — jeśli kod przeniesiono, popraw je tutaj.`);
    process.exit(2);
  }
  return new Function(src.slice(i, j) + '\nreturn { RAG_ALLOWED_TABLES, validateRagSql };')();
}

const { RAG_ALLOWED_TABLES, validateRagSql } = wyciagnijWalidator();

ok(RAG_ALLOWED_TABLES instanceof Set && RAG_ALLOWED_TABLES.size >= 8,
  `RAG_ALLOWED_TABLES ma tylko ${RAG_ALLOWED_TABLES?.size ?? 0} wpisów — ekstraktor prawdopodobnie się rozjechał (oczekiwano >=8, po dodaniu policies/drivers/fines 03.09.2026)`);

const CO = 'mtoilet';

// --- [1] Legalne zapytania na dozwolonych tabelach, z poprawnym filtrem firmy ---
{
  const legalne = [
    `SELECT * FROM vehicles WHERE company_id = '${CO}'`,
    `SELECT nr_rej FROM vehicles WHERE company_id="${CO}" AND JSON_EXTRACT(data,'$.dmc') > 3500`,
    `SELECT v.nr_rej FROM vehicles v JOIN damage_reports d ON d.nr_rej=v.nr_rej WHERE v.company_id='${CO}' AND d.company_id='${CO}'`,
    `select * from fuel_fills where company_id = '${CO}'`,
    // Dodane 03.09.2026 — policies/drivers/fines w RAG_ALLOWED_TABLES.
    `SELECT insurer, end_date FROM policies WHERE company_id = '${CO}' AND type = 'oc'`,
    `SELECT name, license_expiry FROM drivers WHERE company_id = '${CO}'`,
    `SELECT nr_rej, amount FROM fines WHERE company_id = '${CO}' AND paid = 0`,
  ];
  for (const sql of legalne) {
    const r = validateRagSql(sql, CO);
    ok(r.ok === true, `zapytanie legalne odrzucone: ${sql} — powód: ${r.reason}`);
  }
}

// --- [2] Próba dostępu do tabeli spoza whitelisty (kradzież poświadczeń, dane inne) --
{
  const nielegalne = [
    `SELECT email, password_hash FROM users`,
    `SELECT * FROM sessions`,
    `SELECT * FROM company_packages`,
    `SELECT name FROM sqlite_master`,
  ];
  for (const sql of nielegalne) {
    const r = validateRagSql(sql, CO);
    ok(r.ok === false, `zapytanie do niedozwolonej tabeli PRZESZŁO: ${sql}`);
  }
}

// --- [3] Brak filtra company_id w ogóle — zwróciłoby dane WSZYSTKICH firm ---------
{
  const bezFiltra = [
    `SELECT * FROM vehicles`,
    `SELECT * FROM vehicles WHERE nr_rej LIKE 'WA%'`,
  ];
  for (const sql of bezFiltra) {
    const r = validateRagSql(sql, CO);
    ok(r.ok === false, `zapytanie bez filtra company_id PRZESZŁO: ${sql}`);
  }
}

// --- [4] Filtr company_id obecny, ale wskazuje na INNĄ firmę (cross-tenant) -------
{
  const cudzaFirma = `SELECT * FROM vehicles WHERE company_id = 'inna-firma'`;
  const r = validateRagSql(cudzaFirma, CO);
  ok(r.ok === false, `zapytanie z company_id INNEJ firmy PRZESZŁO: ${cudzaFirma}`);
}

// --- [5] Niebezpieczne słowa kluczowe (introspekcja schematu, PRAGMA) -------------
{
  const niebezpieczne = [
    `SELECT * FROM vehicles WHERE company_id='${CO}'; PRAGMA table_info(users)`,
    `PRAGMA table_info(vehicles)`,
  ];
  for (const sql of niebezpieczne) {
    const r = validateRagSql(sql, CO);
    ok(r.ok === false, `zapytanie z niebezpiecznym słowem kluczowym PRZESZŁO: ${sql}`);
  }
}

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
