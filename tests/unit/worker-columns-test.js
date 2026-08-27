#!/usr/bin/env node
/**
 * KAŻDE zapytanie SQL w workerze musi dać się przygotować na REALNYM schemacie
 * z `worker/schema_v*.sql` + `worker/migration_v*.sql`.
 *
 * To uogólnienie `vehicles-columns-test.js`, który pilnował JEDNEJ tabeli. Pierwsze
 * uruchomienie na całym backendzie (862 zapytania, 135 tabel) znalazło **19 zapytań
 * odwołujących się do kolumn, których nie ma** — w tabelach, których tamta bramka
 * nie oglądała.
 *
 * DLACZEGO TEGO NIE WIDZI NIC INNEGO. To poprawny JavaScript i poprawny SQL; błąd
 * ujawnia się dopiero przy wykonaniu, wobec konkretnego schematu. `node --check`,
 * eslint i Playwright przechodzą obok. Skutek zależy wyłącznie od tego, czy zapytanie
 * ma `.catch()`:
 *   - z `.catch()`  → CICHE ZERA albo pusta lista, bez śladu w konsoli,
 *   - bez `.catch()` → 500.
 * Ciche zera są gorsze: użytkownik dostaje wiarygodnie wyglądający wynik.
 *
 * Ta klasa błędu wraca w tym projekcie uporczywie — `fuel_entries` (CO2 i ESG zerowe
 * dla każdej firmy), `damages` (tabela nigdy nie istniała), kolumny `service_orders`
 * i `fines` w kreatorze raportów, płaskie kolumny `vehicles`. Za każdym razem
 * wykrywana po miesiącach, przypadkiem.
 *
 * `db.prepare()` w SQLite waliduje nazwy tabel i kolumn, więc samo przygotowanie
 * wystarczy — bez wykonywania zapytań i bez danych.
 *
 * ZASADA LIST PONIŻEJ: mogą wyłącznie MALEĆ. Dopisanie pozycji, żeby uciszyć bramkę,
 * jest cofnięciem jej działania — wpis oznacza endpoint, który dziś nie działa.
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SCHEMA = path.join(ROOT, 'worker');
const WORKER = path.join(SCHEMA, 'index.js');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, h) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (h) console.log(`      ${h}`); };

/**
 * Tabele, do których worker się odwołuje, a których ŻADEN plik schematu nie tworzy.
 * Każda pozycja to świadoma decyzja udokumentowana w CLAUDE.md — nie przeoczenie.
 */
const ZNANE_BRAKI_TABEL = {
  alert_events: 'jedyny zapis, zero odczytów; utworzenie zaczęłoby zbierać dane, których nic nie czyta',
};

/**
 * Zapytania odwołujące się do NIEISTNIEJĄCYCH KOLUMN — stan zastany, do naprawy.
 *
 * SKURCZYŁA SIĘ 27.08 o osiem pozycji: `migration_v51_martwe_tabele.sql` dodaje kolumny,
 * których żądały handlery sześciu tabel z `schema_v35`. Zostają wyłącznie te pozycje,
 * gdzie pojęcia NIE MA w schemacie wcale (kierowca w `faults`, telefon w `users`) albo
 * gdzie rozstrzygnięcie jest decyzją produktową (`company_packages.active`).
 * Klucz: `tabela.kolumna`. Wartość: co jest naprawdę w schemacie i jaka jest waga.
 *
 * Pięć tabel z `schema_v35` (cmr_documents, sent_records, messages,
 * edoreczenia_items, driver_work_sessions) dostało tam kształt, którego NIE UŻYWA
 * ŻADEN kod: 14 ich kolumn ma zero wystąpień w workerze i we froncie. Handler i front
 * mówią spójnie innym słownikiem. Te funkcje nigdy nie działały — POST pada na
 * „no such column", lista wraca pusta przez `.catch()`.
 */
const ZNANE_ROZJAZDY = {
  'tachograph_vehicles_used.vehicle_id': 'tabela wiąże pojazd numerem rejestracyjnym (vehicle_reg), nie identyfikatorem',
  'users.telefon':                       'users nie ma kolumny telefonu — powiadomienia SMS nie mogą działać',
};

// ── budowa bazy ──────────────────────────────────────────────────────────────
function zbudujBaze() {
  const db = new DatabaseSync(':memory:');
  const schema = fs.readdirSync(SCHEMA)
    .filter(f => /^schema_v\d+\.sql$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  // migration_v* NIE są uruchamiane przez nocny automat (celowa konwencja nazewnicza),
  // ale bywają stosowane ręcznie — v50 jest na produkcji od 13.08. Odtwarzamy to,
  // inaczej bramka zgłasza esg_targets jako rozjazd, którym na produkcji nie jest.
  const migracje = fs.readdirSync(SCHEMA)
    .filter(f => /^migration_v\d+.*\.sql$/.test(f) && !/ROLLBACK/i.test(f))
    .sort();
  for (const f of [...schema, ...migracje]) {
    // D1 jest transakcyjne per plik — plik z jednym błędnym statementem wycofuje się
    // w całości, razem z tabelami, które tworzy. Odtwarzamy to zachowanie.
    try { db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(SCHEMA, f), 'utf8')); db.exec('COMMIT'); }
    catch { try { db.exec('ROLLBACK'); } catch { /* wycofany w całości */ } }
  }
  return db;
}

// ── ekstrakcja zapytań ───────────────────────────────────────────────────────
// Regex na literałach zawodzi: w JS pełno apostrofów, więc wzorzec przechodzi przez
// granice literałów i skleja śmieci, które nie parsują się nawet dla poprawnego kodu —
// test przestaje wtedy cokolwiek odróżniać. Skanujemy znak po znaku od `.prepare(`.
function wyciagnij(src) {
  const out = [];
  const re = /\.prepare\s*\(\s*/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const i = m.index + m[0].length;
    const q = src[i];
    if (q !== '`' && q !== "'" && q !== '"') continue;
    let j = i + 1, buf = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { buf += src[j + 1]; j += 2; continue; }
      if (c === q) break;
      buf += c; j++;
    }
    if (/^\s*(SELECT|UPDATE|DELETE|INSERT|WITH|REPLACE)\b/i.test(buf))
      out.push({ sql: buf, linia: src.slice(0, i).split('\n').length });
  }
  return out;
}

const src = fs.readFileSync(WORKER, 'utf8');

// Stałe SQL_* podstawiamy TREŚCIĄ, żeby bramka sprawdzała je, a nie omijała zaślepką.
const stale = {};
for (const m of src.matchAll(/const\s+(SQL_\w+)\s*=\s*(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*;/g))
  stale[m[1]] = m[2].slice(1, -1);

// Nazwy tabel trzymane w stałych (`const TABLE='jpk_exports'`) też podstawiamy treścią.
// BEZ TEGO CAŁY HANDLER WYPADAŁ Z POMIARU: zaślepka `1=1` w miejscu nazwy tabeli daje
// błąd składni, więc zapytanie lądowało w koszu „poza zasięgiem ekstrakcji" — a nie
// w [2] jako rozjazd kolumny. Tak właśnie ukrył się `jpk_exports`: INSERT wymieniał
// siedem nieistniejących kolumn i padał 500 przy każdym wywołaniu, a bramka świeciła
// na zielono. Podstawiamy WYŁĄCZNIE literały wyglądające jak identyfikator tabeli —
// nic, co mogłoby wnieść do zapytania fragment SQL.
for (const m of src.matchAll(/\bconst\s+([A-Z_][A-Z0-9_]*)\s*=\s*'([a-z_][a-z0-9_]*)'\s*;/g))
  if (!stale[m[1]]) stale[m[1]] = m[2];

function rozwin(sql) {
  let o = sql;
  for (const [k, v] of Object.entries(stale)) o = o.split('${' + k + '}').join(v);
  // Pozostałe interpolacje to fragmenty budowane dynamicznie (listy warunków, kolumn).
  // Zastępujemy je tak, żeby wynik był poprawnym SQL-em w każdej z pozycji, w jakich
  // występują: w WHERE potrzeba warunku, po SET/SELECT — wyrażenia.
  o = o.replace(/SET\s+\$\{[^}]*\}/gi, 'SET id=id')
       .replace(/\$\{[^}]*\}/g, '1=1');
  return o.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\?/g, 'NULL');
}

console.log('\nZapytania workera kontra realny schemat\n');

const db = zbudujBaze();
const zapytania = wyciagnij(src);
ok(`wyciągnięto ${zapytania.length} zapytań z worker/index.js`);

const brakTabeli = new Map();
const brakKolumny = new Map();
let niesparsowane = 0;

for (const z of zapytania) {
  let przygotowane;
  try { przygotowane = rozwin(z.sql); db.prepare(przygotowane); continue; }
  catch (e) {
    const msg = String(e.message);
    const t = msg.match(/no such table:\s*(?:main\.)?(\w+)/);
    if (t) { if (!brakTabeli.has(t[1])) brakTabeli.set(t[1], []); brakTabeli.get(t[1]).push(z.linia); continue; }
    // SQLite zgłasza brakującą kolumnę DWOMA różnymi komunikatami, zależnie od rodzaju
    // zapytania: SELECT/UPDATE dają „no such column: X", a INSERT — „table T has no
    // column named X". Pierwsza wersja tej bramki znała tylko pierwszy wzorzec, więc
    // WSZYSTKIE zepsute INSERT-y lądowały w koszu „poza zasięgiem ekstrakcji" i były
    // liczone jako ograniczenie narzędzia, nie jako błędy. Ukryło to m.in. zapis sesji
    // w handleClerkSignin (kolumna `id`, której `sessions` nie ma) — bez `.catch()`,
    // czyli 500 na ścieżce logowania.
    const ins = msg.match(/table\s+(\w+)\s+has no column named\s+(\w+)/);
    if (ins) {
      const klucz = `${ins[1]}.${ins[2]}`;
      if (!brakKolumny.has(klucz)) brakKolumny.set(klucz, []);
      brakKolumny.get(klucz).push(z.linia);
      continue;
    }
    const k = msg.match(/no such column:\s*(?:\w+\.)?(\w+)/);
    if (k) {
      // Nazwa tabeli z zapytania — bierzemy pierwszą po FROM/UPDATE/INTO.
      const tm = przygotowane.match(/\b(?:FROM|UPDATE|INTO|JOIN)\s+([a-z_][a-z0-9_]*)/i);
      const klucz = `${tm ? tm[1] : '?'}.${k[1]}`;
      if (!brakKolumny.has(klucz)) brakKolumny.set(klucz, []);
      brakKolumny.get(klucz).push(z.linia);
      continue;
    }
    // Zapytanie, którego nasze podstawienie interpolacji nie odtworzyło wiernie.
    // To ograniczenie EKSTRAKCJI, nie wada kodu — liczymy je i pilnujemy, żeby nie rosło.
    niesparsowane++;
  }
}

// ── [1] brakujące tabele ─────────────────────────────────────────────────────
console.log('\n[1] Tabele, których nie tworzy żaden plik schematu');
for (const [t, linie] of [...brakTabeli].sort()) {
  if (ZNANE_BRAKI_TABEL[t]) ok(`${t} — znany brak: ${ZNANE_BRAKI_TABEL[t]}`);
  else bad(`${t} — NOWY brak tabeli`, `linie: ${linie.join(', ')}`);
}
for (const t of Object.keys(ZNANE_BRAKI_TABEL))
  if (!brakTabeli.has(t)) bad(`${t} jest na liście znanych braków, ale już się nie pojawia — usuń wpis`);

// ── [2] brakujące kolumny ────────────────────────────────────────────────────
console.log('\n[2] Zapytania do nieistniejących kolumn');
for (const [klucz, linie] of [...brakKolumny].sort()) {
  if (ZNANE_ROZJAZDY[klucz]) ok(`${klucz} — znany: ${ZNANE_ROZJAZDY[klucz]} ${'\x1b[2m'}(index.js:${linie.join(',')})\x1b[0m`);
  else bad(`${klucz} — NOWY rozjazd kolumny`, `index.js:${linie.join(', ')}`);
}
for (const k of Object.keys(ZNANE_ROZJAZDY))
  if (!brakKolumny.has(k)) bad(`${k} jest na liście znanych rozjazdów, ale już nie występuje — usuń wpis (naprawione)`);

// ── [3] ograniczenie ekstrakcji ──────────────────────────────────────────────
// Zapytania składane z fragmentów, których podstawienie nie odtwarza wiernie. Nie są
// dowodem błędu, ale liczba nie może rosnąć — inaczej bramka po cichu przestaje mierzyć.
// Zapadka: 40 → 15 → 9. Ostatnie zejście (12 → 7) po podstawianiu nazw tabel trzymanych
// w stałych — to właśnie te zapytania kryły martwy INSERT do `jpk_exports`.
// Limit trzymany tuż nad stanem faktycznym — luźny limit pozwala
// bramce po cichu przestać mierzyć backend, a to dokładnie ta awaria, którą właśnie
// wykryliśmy (zepsute INSERT-y liczone jako „ograniczenie narzędzia").
const LIMIT_NIESPARSOWANYCH = 9;
console.log('\n[3] Zapytania poza zasięgiem ekstrakcji');
if (niesparsowane <= LIMIT_NIESPARSOWANYCH)
  ok(`${niesparsowane} zapytań składanych dynamicznie (limit ${LIMIT_NIESPARSOWANYCH})`);
else
  bad(`${niesparsowane} zapytań poza zasięgiem — powyżej limitu ${LIMIT_NIESPARSOWANYCH}`,
      'Bramka mierzy coraz mniejszą część backendu. Popraw rozwin() zamiast podnosić limit.');

// ── [4] białe listy nazw tabel wstawianych do SQL ────────────────────────────
// Te zapytania mają nazwę tabeli w interpolacji (`FROM ${table}`), więc ekstrakcja
// literałów ich nie sprawdzi — trzeba zweryfikować same listy. Stawka jest wyższa niż
// przy zwykłym zapytaniu: pętla w `handleExport` NIE MA `.catch()`, więc jedna
// nieistniejąca tabela wywraca CAŁY eksport danych firmy. `ALLOWED_TABLES` (kreator
// raportów) rozjechało się już raz ze schematem — patrz CLAUDE.md, naprawa źródeł.
console.log('\n[4] Białe listy tabel wstawianych do SQL');
const istniejace = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
);
function sprawdzListe(nazwa, tabele) {
  if (!tabele.length) { bad(`${nazwa} — nie udało się odczytać listy z worker/index.js`); return; }
  const brak = tabele.filter(t => !istniejace.has(t));
  if (brak.length) bad(`${nazwa} — tabel nie ma w schemacie: ${brak.join(', ')}`);
  else ok(`${nazwa} — ${tabele.length}/${tabele.length} tabel istnieje w schemacie`);
}
const mExp = src.match(/const\s+EXPORT_TABLES\s*=\s*\[([\s\S]*?)\];/);
sprawdzListe('EXPORT_TABLES', mExp ? [...mExp[1].matchAll(/table:\s*'([^']+)'/g)].map(x => x[1]) : []);
const mAll = src.match(/const\s+ALLOWED_TABLES\s*=\s*\[([^\]]*)\]/);
sprawdzListe('ALLOWED_TABLES', mAll ? [...mAll[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []);

// ── [5] liczba `?` w zapytaniu kontra liczba argumentów .bind() ──────────────
// `db.prepare()` waliduje nazwy tabel i kolumn, ale NIE liczbę parametrów — niezgodność
// wychodzi dopiero przy wykonaniu („Wrong number of parameter bindings"). To osobna
// klasa od sekcji [2] i nie łapie jej nic innego w tym repo.
//
// KOMENTARZE LECĄ PRECZ PRZED POMIAREM. Pierwsza wersja tego skanera zgłosiła fałszywy
// alarm na kodzie, w którym komentarz WEWNĄTRZ `.bind()` zawierał przecinek i backtick —
// licznik argumentów rozsypywał się na treści komentarza. Ta sama pomyłka co w pierwszej
// wersji strażnika mostu, który mierzył prozę zamiast kodu.
console.log('\n[5] Liczba parametrów: `?` kontra .bind()');
function bezKomentarzy(kod) {
  let o = '', q = null;
  for (let i = 0; i < kod.length; i++) {
    const c = kod[i];
    if (q) { o += c; if (c === '\\') { o += kod[i + 1]; i++; continue; } if (c === q) q = null; continue; }
    if (c === '`' || c === "'" || c === '"') { q = c; o += c; continue; }
    if (c === '/' && kod[i + 1] === '/') { while (i < kod.length && kod[i] !== '\n') i++; o += '\n'; continue; }
    if (c === '/' && kod[i + 1] === '*') { i += 2; while (i < kod.length && !(kod[i] === '*' && kod[i + 1] === '/')) i++; i++; continue; }
    o += c;
  }
  return o;
}
function czytajLiteral(kod, i) {
  const q = kod[i];
  if (q !== '`' && q !== "'" && q !== '"') return null;
  let j = i + 1, buf = '';
  while (j < kod.length) {
    const c = kod[j];
    if (c === '\\') { buf += kod[j + 1]; j += 2; continue; }
    if (c === q) break;
    buf += c; j++;
  }
  return { tresc: buf, koniec: j };
}
function argumentyNajwyzszegoPoziomu(t) {
  const out = []; let d = 0, buf = '', q = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '\\') { buf += c + t[i + 1]; i++; continue; } buf += c; if (c === q) q = null; continue; }
    if (c === '`' || c === "'" || c === '"') { q = c; buf += c; continue; }
    if ('([{'.includes(c)) d++;
    if (')]}'.includes(c)) d--;
    if (c === ',' && d === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
{
  const kod = bezKomentarzy(src);
  const reB = /\.prepare\s*\(\s*/g;
  let mb, sprawdzone = 0, pominiete = 0;
  const zle = [];
  while ((mb = reB.exec(kod)) !== null) {
    const i = mb.index + mb[0].length;
    const lit = czytajLiteral(kod, i);
    if (!lit) continue;
    const sql = lit.tresc;
    if (!/^\s*(SELECT|UPDATE|DELETE|INSERT|WITH|REPLACE)\b/i.test(sql)) continue;
    if (/\$\{/.test(sql)) { pominiete++; continue; }   // interpolacja może wnosić własne `?`
    let k = lit.koniec + 1;
    while (k < kod.length && /[\s)]/.test(kod[k])) k++;
    if (kod.slice(k, k + 6) !== '.bind(') continue;
    let d = 1, j = k + 6, arg = '', q = null;
    while (j < kod.length && d > 0) {
      const c = kod[j];
      if (q) { if (c === '\\') { arg += c + kod[j + 1]; j += 2; continue; } arg += c; if (c === q) q = null; j++; continue; }
      if (c === '`' || c === "'" || c === '"') { q = c; arg += c; j++; continue; }
      if ('(['.includes(c) || c === '{') d++;
      if (')]'.includes(c) || c === '}') d--;
      if (d === 0) break;
      arg += c; j++;
    }
    if (/\.\.\./.test(arg)) { pominiete++; continue; } // spread — liczby nie znamy statycznie
    const ile = argumentyNajwyzszegoPoziomu(arg).filter(a => a !== '').length;
    const znaki = (sql.match(/\?/g) || []).length;
    sprawdzone++;
    if (znaki !== ile) zle.push({ linia: kod.slice(0, i).split('\n').length, znaki, ile, sql: sql.replace(/\s+/g, ' ').slice(0, 110) });
  }
  if (zle.length) for (const z of zle) bad(`index.js:${z.linia} — ? = ${z.znaki}, .bind() = ${z.ile}`, z.sql);
  else ok(`${sprawdzone} par prepare/bind zgodnych co do liczby parametrów (${pominiete} pominiętych: interpolacja lub spread)`);
}

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
