/**
 * Każde zapytanie SQL w workerze dotykające `vehicles` musi dać się przygotować
 * na REALNYM schemacie z worker/schema_v*.sql.
 *
 * Powód powstania: tabela `vehicles` nie ma płaskich kolumn `status`, `active`,
 * `reg`, `brand`, `model` ani `fuel_type` — te dane siedzą w kolumnie JSON `data`.
 * Zapytania pisane tak, jakby kolumny istniały, dzieliły się na dwie grupy:
 *   - z `.catch()`  → cicho zwracały ZERA (liczniki floty, udział EV, wyszukiwarka QR),
 *   - bez `.catch()` → 500 (GET /api/fleet-kpi, czyli cała strona „Dashboard KPI").
 * Ani `node --check`, ani eslint, ani Playwright tego nie widzą: to poprawny JavaScript
 * i poprawny SQL, tylko odnoszący się do nieistniejących kolumn.
 *
 * `db.prepare()` w SQLite waliduje nazwy kolumn, więc samo przygotowanie wystarczy —
 * nie trzeba wykonywać zapytań ani mieć danych.
 *
 * Uruchom: node tests/unit/vehicles-columns-test.js
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SCHEMA = path.join(ROOT, 'worker');
const WORKER = path.join(SCHEMA, 'index.js');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, hint) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (hint) console.log(`      ${hint}`); };

// ── 1. zbuduj bazę z plików schematu ─────────────────────────────────────────
function zbudujBaze() {
  const db = new DatabaseSync(':memory:');
  const files = fs.readdirSync(SCHEMA)
    .filter(f => /^schema_v\d+\.sql$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  for (const f of files) {
    // D1 jest transakcyjne per plik — odtwarzamy to, żeby baza odpowiadała produkcji.
    try { db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(SCHEMA, f), 'utf8')); db.exec('COMMIT'); }
    catch { try { db.exec('ROLLBACK'); } catch { /* plik wycofany w całości */ } }
  }
  return db;
}

// ── 2. wyciągnij z workera literały SQL dotykające `vehicles` ────────────────
// Regex na literałach zawodzi — w JS pełno apostrofów, więc wzorzec przechodzi przez
// granice literałów i skleja śmieci, które nie parsują się nawet dla poprawnego kodu
// (test przestaje wtedy cokolwiek odróżniać). Dlatego skanujemy znak po znaku od
// wywołania `.prepare(` i bierzemy dokładnie jeden literał.
function wyciagnijZapytania(src) {
  const znalezione = [];
  const re = /\.prepare\s*\(\s*/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const i = m.index + m[0].length;
    const cudzyslow = src[i];
    if (cudzyslow !== '`' && cudzyslow !== "'" && cudzyslow !== '"') continue;
    let j = i + 1, buf = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { buf += src[j + 1]; j += 2; continue; }
      if (c === cudzyslow) break;
      buf += c; j++;
    }
    if (/\bvehicles\b/i.test(buf) && /^\s*(SELECT|UPDATE|DELETE|INSERT|WITH)\b/i.test(buf)) {
      znalezione.push({ sql: buf, offset: i });
    }
  }
  return znalezione;
}

// Podstaw stałe SQL_* zdefiniowane w workerze, żeby test sprawdzał ich TREŚĆ,
// a nie omijał ją zaślepką.
function rozwinStale(sql, src) {
  const stale = {};
  for (const m of src.matchAll(/const\s+(SQL_VEH_\w+)\s*=\s*(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*;/g)) {
    stale[m[1]] = m[2].slice(1, -1);
  }
  let out = sql;
  for (const [k, v] of Object.entries(stale)) out = out.split('${' + k + '}').join(v);
  // Pozostałe interpolacje to fragmenty budowane dynamicznie (np. lista warunków WHERE)
  // — zastępujemy je warunkiem neutralnym, żeby zapytanie dało się sparsować.
  out = out.replace(/\$\{[^}]*\}/g, '1=1');
  return out
    .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ')
    .replace(/\?/g, 'NULL');
}

const src = fs.readFileSync(WORKER, 'utf8');
const db = zbudujBaze();

console.log('\nZapytania do `vehicles` kontra realny schemat D1\n');

const kolumnyRealne = db.prepare('PRAGMA table_info(vehicles)').all().map(c => c.name);
if (kolumnyRealne.length) {
  ok(`tabela vehicles istnieje (${kolumnyRealne.length} kolumn)`);
} else {
  bad('tabela vehicles nie powstała — reszta testu jest bez znaczenia');
}

const zapytania = wyciagnijZapytania(src);
if (zapytania.length < 3) {
  bad(`wyciągnięto tylko ${zapytania.length} zapytań — ekstrakcja prawdopodobnie się zepsuła`,
    'Jeśli zmienił się sposób budowania SQL, popraw wyciagnijZapytania(), nie usuwaj testu.');
} else {
  ok(`wyciągnięto ${zapytania.length} zapytań dotykających vehicles`);
}

const bledy = [];
for (const { sql, offset } of zapytania) {
  const linia = src.slice(0, offset).split('\n').length;
  let gotowe;
  try { gotowe = rozwinStale(sql, src); } catch { continue; }
  try {
    db.prepare(gotowe);
  } catch (e) {
    bledy.push({ linia, err: e.message, sql: gotowe.replace(/\s+/g, ' ').slice(0, 100) });
  }
}

if (bledy.length) {
  bad(`zapytania odwołują się do kolumn, których vehicles NIE MA: ${bledy.length}`,
    'Dane pojazdu poza nr_rej siedzą w kolumnie JSON `data` — użyj JSON_EXTRACT(data,\'$.klucz\').\n' +
    '      Realne kolumny: ' + kolumnyRealne.join(', '));
  for (const b of bledy) console.log(`      index.js:${b.linia}  ${b.err}\n         ${b.sql}`);
} else {
  ok('każde zapytanie da się przygotować na realnym schemacie');
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
