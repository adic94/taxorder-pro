#!/usr/bin/env node
/**
 * Strażnik: co NAPRAWDĘ zrobi nocny automat migracji.
 *
 * `migration-check` porównuje pliki schema między sobą. `migration-glob-test`
 * pilnuje, żeby automat nie odpalił plików ROLLBACK. Żaden z nich nie odpowiada
 * na pytanie: „czy te pliki, uruchomione po kolei, faktycznie zakładają bazę?".
 *
 * Ten test uruchamia je NA PRAWDZIWYM SILNIKU SQL (node:sqlite, wbudowany w Node 22 —
 * zero zależności) i odtwarza dwie własności D1, bez których wynik byłby fikcją:
 *
 *  1. Import z `--file` jest TRANSAKCYJNY PER PLIK. Jeden błędny statement wycofuje
 *     CAŁY plik — więc `CREATE TABLE` z pliku, w którym poleciał „duplicate column
 *     name", też nie powstaje. Dokładnie tak ginie dziś schema_v8.sql: `ALTER TABLE
 *     users ADD COLUMN extra_permissions` dubluje kolumnę z schema_v1.sql, przez co
 *     cztery tabele powiadomień z tego samego pliku nie powstają NIGDY.
 *     Potwierdzone w logu produkcyjnym z 11.08.2026 (run 31459590724), nie tylko lokalnie.
 *
 *  2. Automat przejeżdża WSZYSTKIE pliki co noc, na bazie, gdzie już raz je puścił.
 *     Dlatego liczy się przebieg drugi, nie pierwszy.
 *
 * Test jest charakteryzujący: lista ZNANE_BRAKI zamraża dzisiejszy dług. Nowa migracja,
 * która zgubi tabelę w ten sam sposób, wywali ten test — o to chodzi.
 */
const { DatabaseSync } = require('node:sqlite');
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os   = require('os');

const ROOT   = path.join(__dirname, '..', '..');
const SCHEMA = path.join(ROOT, 'worker');

let pass = 0, fail = 0;
const ok  = m => { console.log(`  [32m✓[0m ${m}`); pass++; };
const bad = (m, d) => { console.log(`  [31m✗[0m ${m}`); if (d) console.log(`      ${d}`); fail++; };

/**
 * Tabele, których automat NIE tworzy — stan zastany, nie regresja.
 * Każda pozycja musi mieć powód; pusta lista to cel docelowy.
 */
// Pusta = żaden plik schema_v*.sql nie gubi dziś tabeli przez wycofanie.
// Do 12.08.2026 było tu 5 wpisów: cztery tabele powiadomień ginące z schema_v8
// (ALTER users.extra_permissions — kolumna już w v1) i usage_snapshots ginące
// z schema_v48 (CREATE INDEX na nieistniejącej kolumnie `active`). Oba pliki
// naprawione u źródła, więc lista jest pusta — i ma taka zostać.
// Nie dopisuj tu tabeli, żeby uciszyć test: wpis oznacza, że migracja NIE dociera
// na produkcję. Napraw błędny statement albo rozdziel plik.
const ZNANE_BRAKI = {};

// ── odpowiednik: ls worker/schema_v*.sql | grep -v _ROLLBACK | sort -V ──────────
const files = fs.readdirSync(SCHEMA)
  .filter(f => /^schema_v\d+\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

/** Podział na statementy: SQLite bez triggerów, więc wystarczy ';' poza stringami i komentarzami. */
function split(sql) {
  const out = []; let cur = '', i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; cur += c; i++;
      while (i < sql.length) { cur += sql[i]; if (sql[i] === q && sql[i + 1] !== q) { i++; break; } if (sql[i] === q) cur += sql[++i]; i++; }
      continue;
    }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const tablesOf = db => db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all().map(r => r.name);

function przebieg(db) {
  const bledy = [];
  for (const f of files) {
    const stmts = split(fs.readFileSync(path.join(SCHEMA, f), 'utf8'));
    db.exec('BEGIN');
    try { for (const s of stmts) db.exec(s); db.exec('COMMIT'); }
    catch (e) { try { db.exec('ROLLBACK'); } catch { /* noop */ } bledy.push({ f, err: e.message }); }
  }
  return bledy;
}

console.log('\nAutomat migracji — co faktycznie powstaje w bazie\n');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=OFF');
przebieg(db);                    // przebieg 1 — pusta baza
const bledy = przebieg(db);      // przebieg 2 — realny scenariusz produkcyjny
const istnieje = new Set(tablesOf(db));

// ── 1. żadna NOWA tabela nie ginie przez wycofanie całego pliku ────────────────
const zadeklarowane = new Set();
for (const f of files) {
  const src = fs.readFileSync(path.join(SCHEMA, f), 'utf8')
    .replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)["`\]]?\s*\(/gi)) {
    zadeklarowane.add(m[1]);
  }
}
const braki = [...zadeklarowane].filter(t => !istnieje.has(t));
const nowe  = braki.filter(t => !ZNANE_BRAKI[t]);
const znikle = Object.keys(ZNANE_BRAKI).filter(t => istnieje.has(t));

if (nowe.length) {
  bad(`żadna nowa tabela nie ginie przez wycofanie pliku — zginęły: ${nowe.join(', ')}`,
    'Plik z tą tabelą pada na innym statemencie, a D1 wycofuje CAŁY plik. Rozdziel go albo napraw błędny statement.');
} else {
  ok(`żadna nowa tabela nie ginie przez wycofanie pliku (znane braki: ${braki.length})`);
}

if (znikle.length) {
  bad(`ZNANE_BRAKI są nieaktualne — te tabele już powstają: ${znikle.join(', ')}`,
    'Usuń je z ZNANE_BRAKI, żeby lista nie maskowała przyszłej regresji.');
} else {
  ok('lista ZNANE_BRAKI zgodna ze stanem faktycznym');
}

// ── 2. pliki padają tylko z powodów udokumentowanych ──────────────────────────
const DOZWOLONE = /duplicate column name|no such column: active/i;
const nieznane = bledy.filter(b => !DOZWOLONE.test(b.err));
if (nieznane.length) {
  bad(`pliki padają z nieznanego powodu: ${nieznane.map(b => `${b.f} (${b.err})`).join('; ')}`);
} else {
  ok(`pliki padające przy powtórzeniu mają znane przyczyny (${bledy.length} plików)`);
}

// ── 2b. plik padający przy powtórzeniu NIE MOŻE zawierać CREATE TABLE ─────────
// Najważniejsza asercja tego pliku, dopisana po tym, jak test przepuścił schema_v45.
// Testy 1 i 2 pytają „czy na CZYSTEJ bazie coś ginie" — a produkcja to baza, na której
// plik już raz przeszedł. Tam ALTER pada na duplikat kolumny, D1 wycofuje CAŁY plik
// i tabele z tego pliku nie powstają NIGDY. Jeśli zniknęły (np. przez ROLLBACK), są
// nie do odzyskania: ALTER-a nie da się cofnąć, bo SQLite nie usuwa kolumn.
// Dokładnie tak zakleszczyły się ksef_config i ksef_offline_queue (schema_v45).
// Linia bazowa z 12.08.2026 — pliki, które łamią ten niezmiennik od dawna. Ich tabele
// AKTUALNIE ISTNIEJĄ na produkcji (sekcja [2] nocnego raportu wymienia tylko 3 braki),
// więc to ryzyko utajone, nie awaria: gdyby te tabele kiedykolwiek zniknęły, żaden
// przebieg by ich nie odtworzył. Naprawa wymaga przeniesienia 26 ALTER-ów do CREATE
// TABLE w 7 różnych plikach, a dla schema_v23/v24 brakuje dowodu z logu produkcyjnego,
// że kolumny tam faktycznie są — bez tego usunięcie ALTER-a mogłoby pozbawić produkcję
// kolumny. Osobny temat, wymaga odczytu PRAGMA table_info z --remote.
//
// TA LISTA MOŻE SIĘ TYLKO SKRACAĆ. Dopisanie do niej nowego pliku oznacza, że właśnie
// wprowadzasz migrację, której tabele będą nie do odtworzenia — napraw plik, nie listę.
const ZNANE_ZAKLESZCZONE = new Set([]);

const zakleszczone = [];
const bazowe = [];
for (const b of bledy) {
  const src = fs.readFileSync(path.join(SCHEMA, b.f), 'utf8')
    .replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tabele = [...src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)["`\]]?\s*\(/gi)]
    .map(m => m[1]);
  if (!tabele.length) continue;
  const wpis = `${b.f} → ${tabele.join(', ')} (${b.err})`;
  (ZNANE_ZAKLESZCZONE.has(b.f) ? bazowe : zakleszczone).push(wpis);
}
const naprawione = [...ZNANE_ZAKLESZCZONE].filter(f => !bledy.some(b => b.f === f));
if (naprawione.length) {
  bad(`ZNANE_ZAKLESZCZONE są nieaktualne — te pliki już nie padają: ${naprawione.join(', ')}`,
    'Usuń je z listy, żeby nie maskowała przyszłej regresji.');
} else {
  ok(`linia bazowa zakleszczonych plików aktualna (${bazowe.length} plików, do naprawy osobno)`);
}
if (zakleszczone.length) {
  bad(`plik pada przy powtórzeniu I tworzy tabele — te tabele są nie do odtworzenia:\n      ${zakleszczone.join('\n      ')}`,
    'Przenieś kolumny z ALTER-ów do CREATE TABLE w pliku, który tabelę zakłada, ' +
    'albo wydziel ryzykowne statementy do osobnego pliku. Plik tworzący tabele ' +
    'musi być odporny na ponowne uruchomienie.');
} else {
  ok('żaden plik padający przy powtórzeniu nie tworzy tabel');
}

// ── 3. bramka d1-schema-diff nie generuje fałszywych alarmów na zdrowej bazie ──
// Sekcja [5] („nie pasuje do ŻADNEJ definicji") musi być pusta dla ZDROWEJ bazy.
// Zanim narzędzie zaczęło uwzględniać ALTER TABLE ADD COLUMN, wychodziło tu
// 14 rozjazdów i `--strict` świecił czerwono co noc bez powodu.
//
// ⚠️ TA JEDNA ASERCJA UŻYWA INNEJ BAZY NIŻ RESZTA PLIKU, i to celowo.
// Reszta modeluje NOCNY AUTOMAT, który uruchamia wyłącznie glob `schema_v*.sql` —
// i o to właśnie pyta: czy automat gubi tabele. Tutaj pytanie jest inne: czy bramka
// nie krzyczy na ZDROWEJ produkcji. A zdrowa produkcja ma zastosowane RÓWNIEŻ pliki
// `migration_v*`, uruchamiane ręcznie (v51/v52/v53 — 27.08.2026). Budowanie fixture
// z samych plików schema kazałoby bramce raportować 9 tabel jako rozjechane, choć
// różnica pochodzi wyłącznie z migracji, których ta baza nie dostała.
const dbPelna = new DatabaseSync(':memory:');
const migracje = fs.readdirSync(SCHEMA)
  .filter(f => /^migration_v\d+.*\.sql$/.test(f) && !/_ROLLBACK/i.test(f))
  .sort((a, b) => Number(a.match(/_v(\d+)/)[1]) - Number(b.match(/_v(\d+)/)[1]));
for (const f of [...files, ...migracje]) {
  // Transakcyjność per plik, jak w imporcie D1 — patrz komentarz przy budowie `db`.
  try { dbPelna.exec(fs.readFileSync(path.join(SCHEMA, f), 'utf8')); } catch { /* plik wycofany w całości */ }
}

const fixture = path.join(os.tmpdir(), `d1-fixture-${process.pid}.json`);
fs.writeFileSync(fixture, JSON.stringify(
  dbPelna.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
));
try {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'tools', 'autotest', 'd1-schema-diff.js'), '--fixture', fixture],
    { cwd: ROOT, encoding: 'utf8' });
  const m = out.match(/\[5\][^:]*:\s*(\S+)/);
  if (!m) bad('nie znaleziono sekcji [5] w raporcie d1-schema-diff');
  else if (m[1] === 'brak') ok('d1-schema-diff: zero fałszywych rozjazdów na bazie zbudowanej z tych plików');
  else bad(`d1-schema-diff zgłasza ${m[1]} rozjazdów na zdrowej bazie`,
    'Najczęstsza przyczyna: narzędzie przestało uwzględniać ALTER TABLE ADD COLUMN.');
} catch (e) {
  bad('d1-schema-diff nie dał się uruchomić', String(e.message).split('\n')[0]);
} finally {
  fs.unlinkSync(fixture);
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
