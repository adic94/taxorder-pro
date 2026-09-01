/**
 * TaxOrder Pro — strażnik automatycznego uruchamiania migracji
 * Uruchom: node tests/unit/migration-glob-test.js
 *
 * Bez zależności (żaden npm install) — nadaje się do ci-js.yml.
 *
 * DLACZEGO ISTNIEJE: `nightly-report.yml` uruchamiał `for f in worker/schema_v*.sql`.
 * Ten glob dopasowuje **także** `schema_vNN_ROLLBACK.sql`, a leksykograficznie każdy
 * trafiał TUŻ PO swojej migracji (`schema_v48.sql` → `schema_v48_ROLLBACK.sql`).
 * Baza co noc tworzyła tabele i natychmiast je kasowała — `companies`,
 * `user_company_access`, `ksef_config`, `vignettes`, `hr_leaves`, `debt_collection`,
 * `company_packages`, `user_prefs_kv` i kilkanaście innych. Job świecił na zielono,
 * bo `|| echo` zjadał kod wyjścia. Trwało to do 11.08.2026.
 *
 * Żadne istniejące narzędzie tego nie widziało: `migration-check` porównuje pliki
 * schema między sobą, `syntax-check` sprawdza JS, a `d1-schema-diff` wymaga dostępu
 * do bazy. Ten test pilnuje samego workflow — statycznie, bez sieci.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WF   = path.join(ROOT, '.github', 'workflows');
const SQL  = path.join(ROOT, 'worker');

let _pass = 0, _fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); _pass++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { _fail++; failures.push({ name, error: e.message }); process.stdout.write(`  ✗ ${name}\n`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('\nAutomatyczne uruchamianie migracji — strażnik\n');

// ─── 1. Konwencja nazw: destrukcyjny SQL tylko w plikach ROLLBACK/migration ───
test('każdy plik z DROP TABLE ma w nazwie _ROLLBACK albo migration_', () => {
  const bad = fs.readdirSync(SQL)
    .filter(f => f.endsWith('.sql'))
    .filter(f => /DROP\s+TABLE/i.test(fs.readFileSync(path.join(SQL, f), 'utf8')))
    .filter(f => !/_ROLLBACK/i.test(f) && !/^migration_/i.test(f));
  assert(bad.length === 0,
    `pliki z DROP TABLE poza konwencją: ${bad.join(', ')}. ` +
    'Nazwa schema_vNN.sql znaczy „idempotentny, można puszczać w kółko" — ' +
    'migracje strukturalne nazywaj migration_vNN_opis.sql');
});

// ─── 2. Żaden workflow nie może podać wranglerowi globa łapiącego ROLLBACK ────
const workflows = fs.existsSync(WF)
  ? fs.readdirSync(WF).filter(f => /\.ya?ml$/.test(f))
  : [];

test('workflowy istnieją i dają się wczytać', () => {
  assert(workflows.length > 0, 'brak plików w .github/workflows');
});

for (const wf of workflows) {
  const src = fs.readFileSync(path.join(WF, wf), 'utf8');
  const lines = src.split('\n');

  // Linie, które iterują po plikach schema (glob) — kandydaci na masowe wykonanie.
  const globLines = lines
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => /schema_v\*/.test(l) && !/^\s*#/.test(l));

  if (!globLines.length) continue;

  test(`${wf}: glob po schema_v* wyklucza pliki ROLLBACK`, () => {
    for (const { l, i } of globLines) {
      // Interesują nas WYŁĄCZNIE linie, które przekazują pliki do wykonania: pętla
      // po globie, lista zbierana do zmiennej, albo bezpośrednie wywołanie wranglera.
      // Linia w rodzaju `LATEST=$(ls ... | grep -oP 'v\K[0-9]+')` tylko odczytuje numer
      // najnowszego schematu i niczego nie uruchamia — flagowanie jej to fałszywy alarm.
      const executes = /\bfor\s+f\s+in\b|wrangler|d1\s+execute|FILES=/.test(l);
      if (!executes) continue;
      const guarded = /_ROLLBACK/.test(l) || /grep\s+-v/.test(l);
      assert(guarded,
        `${wf}:${i} — glob schema_v* bez wykluczenia ROLLBACK:\n      ${l.trim()}\n` +
        '      Taki glob dopasowuje schema_vNN_ROLLBACK.sql, który wykonuje się ' +
        'leksykograficznie TUŻ PO swojej migracji i kasuje właśnie utworzone tabele.');
    }
  });

  test(`${wf}: migracje idą w kolejności numerycznej, nie leksykograficznej`, () => {
    const runsLoop = globLines.some(({ l }) => /for f in|ls /.test(l) && /wrangler|d1 execute|FILES=/.test(l));
    if (!runsLoop && !/for f in .*schema_v\*/.test(src)) return;
    assert(/sort\s+-V/.test(src),
      `${wf} iteruje po plikach schema bez \`sort -V\`. Glob powłoki sortuje ` +
      'leksykograficznie, więc schema_v2.sql wykonuje się PO schema_v19.sql, ' +
      'a schema_v5.sql po schema_v49.sql — migracje idą w złej kolejności.');
  });
}

// ─── 3. Pliki ROLLBACK faktycznie są destrukcyjne (sanity dla testu 2) ────────
test('pliki _ROLLBACK zawierają DROP — więc ich przypadkowe uruchomienie kasuje dane', () => {
  const rollbacks = fs.readdirSync(SQL).filter(f => /_ROLLBACK\.sql$/i.test(f));
  assert(rollbacks.length > 0, 'brak plików ROLLBACK — test straciłby sens, zaktualizuj go');
  const harmless = rollbacks.filter(f => !/DROP\s+(TABLE|INDEX|COLUMN)/i.test(fs.readFileSync(path.join(SQL, f), 'utf8')));
  assert(harmless.length === 0, `pliki ROLLBACK bez DROP (podejrzane): ${harmless.join(', ')}`);
});

console.log(`\n${'─'.repeat(44)}`);
console.log(`Wynik: ${_pass} PASS / ${_fail} FAIL`);
if (_fail) {
  console.log('\nNiezdane:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n      ${f.error}`));
}
console.log('');
process.exit(_fail > 0 ? 1 : 0);
