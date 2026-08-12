/**
 * TaxOrder Pro — spójność źródeł kreatora raportów
 * Uruchom: node tests/unit/report-sources-test.js
 *
 * Bez zależności i bez sieci — działa na PR-ze, w przeciwieństwie do testów API.
 *
 * DLACZEGO ISTNIEJE (dwa powody, oba boleśnie praktyczne):
 *
 *  1. Kreator raportów oferował źródło „Paliwo" wskazujące na `fuel_entries` — tabelę,
 *     której NIE TWORZY żaden `schema_v*.sql`. Zapytanie miało `.catch()`, więc raport
 *     wychodził zawsze pusty, bez błędu. Żaden test tego nie widział.
 *
 *  2. Front (`modules/report-builder.js`) i backend (`ALLOWED_TABLES` / `ALLOWED_COLS`
 *     w `worker/index.js`) trzymają DWIE niezależne kopie tej samej listy. Rozjazd
 *     kończy się „Niedozwolone źródło danych" albo cichym odrzuceniem kolumn.
 *
 * Pierwsza wersja tej weryfikacji siedziała w teście API i odpytywała produkcyjnego
 * Workera — przez co nie miała prawa przejść przed mergem i deployem (400 dla świeżo
 * dodanego `fuel_fills`). Sprawdzenie jest statyczne z natury, więc tu jest jego miejsce.
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..', '..');
const WORKER = path.join(ROOT, 'worker', 'index.js');
const FRONT  = path.join(ROOT, 'modules', 'report-builder.js');
const SQLDIR = path.join(ROOT, 'worker');

let _pass = 0, _fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); _pass++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { _fail++; failures.push({ name, error: e.message }); process.stdout.write(`  ✗ ${name}\n`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Parsowanie SQL (komentarze SQL potrafią udawać kolumny) ──────────────────
function stripComments(sql) {
  let out = '', i = 0, inStr = false;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (inStr) { out += c; if (c === "'") inStr = (n === "'") ? (out += sql[++i], true) : false; i++; continue; }
    if (c === "'") { inStr = true; out += c; i++; continue; }
    if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    out += c; i++;
  }
  return out;
}
function columnsFromCreate(sql) {
  const open = sql.indexOf('(');
  let depth = 0, end = open;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') { depth--; if (!depth) { end = i; break; } }
  }
  const body = sql.slice(open + 1, end);
  const parts = []; let d = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') d++; if (ch === ')') d--;
    if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const CONSTR = new Set(['primary', 'foreign', 'unique', 'check', 'constraint', 'key']);
  return parts.map(s => s.trim().split(/\s+/)[0]).filter(n => n && !CONSTR.has(n.toLowerCase()));
}

/** Kolumny tabeli wg PIERWSZEJ definicji w plikach schema (CREATE TABLE IF NOT EXISTS = pierwsza wygrywa). */
function schemaColumns(table) {
  const files = fs.readdirSync(SQLDIR)
    .filter(f => /^schema.*\.sql$/.test(f) && !/_ROLLBACK/i.test(f))
    .sort((a, b) => Number((a.match(/schema_v(\d+)/) || [, 0])[1]) - Number((b.match(/schema_v(\d+)/) || [, 0])[1]));
  for (const f of files) {
    const src = stripComments(fs.readFileSync(path.join(SQLDIR, f), 'utf8'));
    const re = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`, 'i');
    const m = src.match(re);
    if (m) return { file: f, columns: columnsFromCreate(src.slice(m.index)) };
  }
  return null;
}

// ─── Wczytanie obu whitelist ──────────────────────────────────────────────────
const workerSrc = fs.readFileSync(WORKER, 'utf8');
const frontSrc  = fs.readFileSync(FRONT, 'utf8');

const allowedTables = (() => {
  const m = workerSrc.match(/const\s+ALLOWED_TABLES\s*=\s*\[([^\]]+)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
})();

const allowedCols = (() => {
  const m = workerSrc.match(/const\s+ALLOWED_COLS\s*=\s*\{([\s\S]*?)\};/);
  const out = {};
  if (!m) return out;
  for (const t of [...m[1].matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)]) {
    out[t[1]] = [...t[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
  }
  return out;
})();

const frontSources = (() => {
  const m = frontSrc.match(/const\s+SOURCES\s*=\s*\{([\s\S]*?)\n\s*\};/);
  const out = {};
  if (!m) return out;
  for (const s of [...m[1].matchAll(/(\w+)\s*:\s*\{[^}]*cols\s*:\s*\[([^\]]*)\]/g)]) {
    out[s[1]] = [...s[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
  }
  return out;
})();

console.log('\nKreator raportów — spójność źródeł\n');

test('obie whitelisty dają się wczytać', () => {
  assert(allowedTables.length > 0, 'nie znaleziono ALLOWED_TABLES w worker/index.js');
  assert(Object.keys(allowedCols).length > 0, 'nie znaleziono ALLOWED_COLS w worker/index.js');
  assert(Object.keys(frontSources).length > 0, 'nie znaleziono SOURCES w modules/report-builder.js');
});

test('każde źródło z frontu jest dozwolone przez backend', () => {
  const missing = Object.keys(frontSources).filter(t => !allowedTables.includes(t));
  assert(missing.length === 0,
    `front oferuje źródła odrzucane przez backend („Niedozwolone źródło danych"): ${missing.join(', ')}`);
});

test('każda kolumna z frontu jest akceptowana przez backend', () => {
  const bad = [];
  for (const [t, cols] of Object.entries(frontSources)) {
    const back = allowedCols[t] || [];
    const miss = cols.filter(c => !back.includes(c));
    if (miss.length) bad.push(`${t}: ${miss.join(', ')}`);
  }
  assert(bad.length === 0, `kolumny odrzucane po cichu przez backend → ${bad.join(' | ')}`);
});

test('każda tabela z whitelisty backendu ISTNIEJE w plikach schema', () => {
  const ghosts = allowedTables.filter(t => !schemaColumns(t));
  assert(ghosts.length === 0,
    `whitelista dopuszcza tabele bez definicji w worker/schema*.sql: ${ghosts.join(', ')}. ` +
    'Zapytanie ma .catch(), więc raport będzie zawsze pusty — bez żadnego błędu. ' +
    'Dokładnie tak zachowywało się źródło „Paliwo" wskazujące na fuel_entries.');
});

// Nazwa z whitelisty może być albo płaską kolumną, albo nazwą LOGICZNĄ mapowaną
// w backendzie na wyrażenie SQL (COL_EXPR) — tak działa `vehicles`, gdzie poza
// `nr_rej` wszystko siedzi w kolumnie JSON `data`. Test musi uznawać oba warianty,
// ale nie wolno mu przepuścić nazwy, która nie jest ani jednym, ani drugim.
const colExpr = (() => {
  const m = workerSrc.match(/const\s+COL_EXPR\s*=\s*\{[\s\S]*?\n\s*\}\}\s*;/);
  if (!m) return {};
  const out = {};
  const tabela = m[0].match(/(\w+)\s*:\s*\{([\s\S]*)\}\}/);
  if (!tabela) return {};
  out[tabela[1]] = [...tabela[2].matchAll(/(\w+)\s*:\s*['"`]/g)].map(x => x[1]);
  return out;
})();

test('kolumny z whitelisty istnieją w tabeli albo mają mapowanie COL_EXPR', () => {
  const bad = [];
  for (const [t, cols] of Object.entries(allowedCols)) {
    const def = schemaColumns(t);
    if (!def) continue; // zgłoszone w teście wyżej
    const zmapowane = colExpr[t] || [];
    const miss = cols.filter(c => !def.columns.includes(c) && !zmapowane.includes(c));
    if (miss.length) bad.push(`${t} (${def.file}): ${miss.join(', ')}`);
  }
  assert(bad.length === 0,
    `whitelista wymienia kolumny, których nie ma ani w schemacie, ani w COL_EXPR → ${bad.join(' | ')}. ` +
    'Zapytanie ma .catch(), więc raport będzie zawsze pusty — bez żadnego błędu.');
});

test('mapowanie COL_EXPR odwołuje się wyłącznie do realnych kolumn', () => {
  const m = workerSrc.match(/const\s+COL_EXPR\s*=\s*\{[\s\S]*?\n\s*\}\}\s*;/);
  const bad = [];
  if (m) {
    for (const [t] of Object.entries(colExpr)) {
      const def = schemaColumns(t);
      if (!def) continue;
      // Kolumny użyte wprost w wyrażeniach (poza literałami ścieżek JSON i słowami SQL).
      const uzyte = new Set();
      for (const w of m[0].matchAll(/JSON_EXTRACT\(\s*(\w+)\s*,/g)) uzyte.add(w[1]);
      for (const w of m[0].matchAll(/COALESCE\([^)]*?,\s*(\w+)\s*\)/g)) uzyte.add(w[1]);
      for (const w of m[0].matchAll(/:\s*'(\w+)'\s*,/g)) uzyte.add(w[1]);
      const brak = [...uzyte].filter(c => !def.columns.includes(c));
      if (brak.length) bad.push(`${t}: ${brak.join(', ')}`);
    }
  }
  assert(bad.length === 0,
    `COL_EXPR odwołuje się do kolumn, których tabela NIE MA → ${bad.join(' | ')}`);
});

console.log(`\n${'─'.repeat(44)}`);
console.log(`Wynik: ${_pass} PASS / ${_fail} FAIL`);
if (_fail) { console.log('\nNiezdane:'); failures.forEach(f => console.log(`  ✗ ${f.name}\n      ${f.error}`)); }
console.log('');
process.exit(_fail > 0 ? 1 : 0);
