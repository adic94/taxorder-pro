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
  znalezione.push(...wyciagnijZapytaniaZeZmiennej(src));
  return znalezione;
}

// Wariant pośredni: `let sql = '...'; ...; sql += ' AND ...'; ...; .prepare(sql)`.
// Ten sam handler (handleTCO) budował zapytanie w zmiennej i pierwsza wersja tego
// testu tego nie widziała — `.prepare(` był wywoływany na IDENTYFIKATORZE, nie
// literale, więc pętla wyżej po prostu pomijała go (pierwszy znak po `.prepare(`
// to litera, nie cudzysłów). Efekt: `v.make`/`v.model`/`v.year` (kolumny, których
// `vehicles` nie ma) przeszły przez tę bramkę niezauważone przez całą sesję audytu,
// mimo że bramka istniała od dawna i miała je złapać. Naprawa: dla `.prepare(IDENT)`
// znajdź najbliższą WCZEŚNIEJSZĄ deklarację `let/const IDENT = '...'` w obrębie tej
// samej funkcji i doklej wszystkie `IDENT += '...'` między deklaracją a wywołaniem.
function wyciagnijZapytaniaZeZmiennej(src) {
  const znalezione = [];
  const rePrepareVar = /\.prepare\s*\(\s*([a-zA-Z_$][\w$]*)\s*\)/g;
  let m;
  while ((m = rePrepareVar.exec(src)) !== null) {
    const ident = m[1];
    const wywolanie = m.index;
    // Granica funkcji: nie schodź przed najbliższe wcześniejsze "function" —
    // zmienne o tej samej nazwie w innych handlerach nie mają tu znaczenia.
    const funStart = Math.max(src.lastIndexOf('function', wywolanie), 0);
    const zakres = src.slice(funStart, wywolanie);
    const identEsc = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reDecl = new RegExp(`(?:let|const|var)\\s+${identEsc}\\s*=\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
    let ostatnia = null, dm;
    while ((dm = reDecl.exec(zakres)) !== null) ostatnia = dm; // najbliższa poprzedzająca deklaracja
    if (!ostatnia) continue;
    let sql = ostatnia[2];
    const poDeklaracji = zakres.slice(ostatnia.index + ostatnia[0].length);
    const reConcat = new RegExp(`${identEsc}\\s*\\+=\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
    let cm;
    while ((cm = reConcat.exec(poDeklaracji)) !== null) sql += cm[2];
    if (/\bvehicles\b/i.test(sql) && /^\s*(SELECT|UPDATE|DELETE|INSERT|WITH)\b/i.test(sql)) {
      znalezione.push({ sql, offset: wywolanie });
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
