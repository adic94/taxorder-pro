/**
 * TaxOrder Pro — porównanie produkcyjnego D1 z definicjami w worker/schema_v*.sql
 *
 * Uruchom:
 *   node tools/autotest/d1-schema-diff.js            # pełny diff (wymaga wranglera)
 *   node tools/autotest/d1-schema-diff.js --offline  # tylko analiza plików schema
 *   node tools/autotest/d1-schema-diff.js --strict   # kod wyjścia 1 przy rozjeździe (do CI)
 *
 * Wymaga zalogowanego wranglera (`wrangler login`) albo CLOUDFLARE_API_TOKEN.
 *
 * DLACZEGO ISTNIEJE: `npm run migration-check` porównuje pliki schema MIĘDZY SOBĄ —
 * odpowiada na pytanie „czy migracje są spójne w repo", nie „czy baza wygląda tak,
 * jak myślimy". To dwa różne pytania i drugie nigdy nie było zadawane.
 *
 * Wykryty tym sposobem dryf (11.08.2026, odczyt produkcyjnego D1):
 *   • company_packages  — NIE ISTNIEJE (cały schema_v48 nigdy nie zastosowany),
 *     mimo że audyt twierdził „istnieje w wersji v33 bez kolumny active",
 *   • esg_targets       — stoi na v35, choć v41 miał ją przedefiniować,
 *   • reservations      — stoi na v13 z CHECK, choć v40 miał go usunąć.
 *
 * Przyczyna jest zawsze ta sama: `CREATE TABLE IF NOT EXISTS` na istniejącej tabeli
 * to CICHY NO-OP. Ponowne puszczenie migracji NIE naprawi struktury i nic nie zgłosi.
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT    = path.join(__dirname, '..', '..');
const SCHEMA  = path.join(ROOT, 'worker');
const DB_NAME = 'taxorder-pro';

const OFFLINE = process.argv.includes('--offline');
const STRICT  = process.argv.includes('--strict');

// ─── Parsowanie CREATE TABLE ──────────────────────────────────────────────────

/**
 * Usuwa komentarze SQL (-- do końca linii, /* ... *\/), respektując literały 'w apostrofach'.
 * Bez tego komentarz po przecinku staje się „kolumną" (`--`), a przecinek WEWNĄTRZ komentarza
 * rozbija definicję na kawałki — pierwsza wersja tego narzędzia raportowała w ten sposób
 * nieistniejące kolumny `kontrakt` i `ts}`.
 */
function stripComments(sql) {
  let out = '', i = 0, inStr = false;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (inStr) {
      out += c;
      if (c === "'") inStr = (n === "'") ? (out += sql[++i], true) : false;
      i++; continue;
    }
    if (c === "'") { inStr = true; out += c; i++; continue; }
    if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

/** Zwraca treść między zewnętrzną parą nawiasów (z uwzględnieniem zagnieżdżeń). */
function outerParens(sql) {
  const open = sql.indexOf('(');
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') { depth--; if (!depth) return sql.slice(open + 1, i); }
  }
  return sql.slice(open + 1);
}

/** Dzieli listę kolumn po przecinkach na poziomie 0 (ignoruje przecinki w nawiasach). */
function splitTopLevel(body) {
  const out = []; let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const CONSTRAINTS = new Set(['primary', 'foreign', 'unique', 'check', 'constraint', 'key']);

/** Wyciąga nazwy kolumn z treści CREATE TABLE (pomija definicje więzów). */
function columnsOf(sql) {
  return splitTopLevel(outerParens(stripComments(sql)))
    .map(s => s.trim().replace(/^["`[]|["`\]]$/g, ''))
    .filter(Boolean)
    .map(s => s.split(/\s+/)[0])
    .filter(n => n && !CONSTRAINTS.has(n.toLowerCase()))
    .map(n => n.replace(/^["`[]|["`\]]$/g, ''));
}

/** Czy definicja zawiera CHECK — bywa źródłem cichych naruszeń przy zapisie. */
const hasCheck = sql => /\bCHECK\s*\(/i.test(sql);

// ─── Wczytanie definicji z repo ───────────────────────────────────────────────

function schemaFiles() {
  return fs.readdirSync(SCHEMA)
    .filter(f => /^schema.*\.sql$/.test(f) && !/_ROLLBACK/i.test(f))
    .sort((a, b) => {
      const n = s => (s.match(/schema_v(\d+)/) || [, '0'])[1];
      return Number(n(a)) - Number(n(b));
    });
}

/**
 * ALTER TABLE ... ADD COLUMN z późniejszych plików schema.
 *
 * Bez tego narzędzie porównywało stan D1 wyłącznie z treścią CREATE TABLE i każdą
 * tabelę rozszerzoną późniejszym ALTER-em raportowało jako „nie pasuje do ŻADNEJ
 * definicji". Na zdrowej bazie dawało to 14 fałszywych rozjazdów i kod wyjścia 1,
 * czyli bramka `--strict` w nocnym workflow świeciłaby czerwono KAŻDEJ nocy
 * niezależnie od stanu bazy — a bramka, która zawsze krzyczy, nie niesie informacji.
 *
 * Uwzględniamy wyłącznie ADD COLUMN: pliki schema*.sql nie zawierają DROP COLUMN
 * ani RENAME (sprawdzone), a operacje destrukcyjne żyją w plikach migration_*,
 * których to narzędzie celowo nie czyta.
 */
function parseAlters(files) {
  const alters = new Map(); // tabela -> [{ fileIdx, column }]
  files.forEach((f, fileIdx) => {
    const src = stripComments(fs.readFileSync(path.join(SCHEMA, f), 'utf8'));
    const re = /ALTER\s+TABLE\s+["`[]?(\w+)["`\]]?\s+ADD\s+(?:COLUMN\s+)?["`[]?(\w+)/gi;
    let m;
    while ((m = re.exec(src))) {
      if (!alters.has(m[1])) alters.set(m[1], []);
      alters.get(m[1]).push({ fileIdx, column: m[2] });
    }
  });
  return alters;
}

function parseRepo() {
  const files = schemaFiles();
  const defs  = new Map(); // table -> [{file, columns, check, altered}]
  files.forEach((f, fileIdx) => {
    const src = stripComments(fs.readFileSync(path.join(SCHEMA, f), 'utf8'));
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)["`\]]?\s*\(/gi;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1];
      const body = src.slice(m.index);
      const entry = {
        file: f, fileIdx, created: columnsOf(body),
        check: hasCheck(outerParens(body)),
      };
      if (!defs.has(name)) defs.set(name, []);
      defs.get(name).push(entry);
    }
  });

  // Do każdej definicji doklejamy kolumny dodane ALTER-ami z PÓŹNIEJSZYCH plików.
  const alters = parseAlters(files);
  for (const [name, entries] of defs) {
    const add = alters.get(name) || [];
    for (const e of entries) {
      e.altered = [...new Set(
        add.filter(a => a.fileIdx > e.fileIdx).map(a => a.column)
      )].filter(c => !e.created.includes(c));
      e.columns = [...e.created, ...e.altered];
    }
  }
  return defs;
}

// ─── Odczyt stanu D1 ──────────────────────────────────────────────────────────

function readD1() {
  // --fixture <plik.json> — symuluje odpowiedź D1 (do testów logiki bez dostępu do bazy)
  const fi = process.argv.indexOf('--fixture');
  if (fi >= 0 && process.argv[fi + 1]) {
    const rows = JSON.parse(fs.readFileSync(process.argv[fi + 1], 'utf8'));
    const out = new Map();
    for (const r of rows) out.set(r.name, { sql: r.sql, columns: columnsOf(r.sql), check: hasCheck(r.sql) });
    return out;
  }
  // Uruchamiamy punkt wejścia wranglera przez `node`, NIE przez node_modules/.bin/wrangler.cmd.
  // Powód: od łatki na CVE-2024-27980 Node na Windows odmawia uruchomienia pliku .cmd bez
  // powłoki i przewraca się na `spawnSync ... EINVAL`. Ścieżka przez `node <plik>.js` jest
  // identyczna na Windows i POSIX, nie wymaga shell:true, więc omija też całą pułapkę
  // cudzysłowów cmd.exe (a zapytanie i tak zawiera apostrofy).
  // Lokalny wrangler z node_modules; w CI (gdzie instalowany jest globalnie, bez npm ci)
  // spadamy na `wrangler` z PATH. Na Linuksie to zwykły plik JS z shebangiem, więc
  // execFileSync poradzi sobie bez powłoki.
  const cli = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const useLocal = fs.existsSync(cli);

  // Bez LIKE '%...' — znak % jest specjalny dla cmd.exe, a filtrowanie tabel
  // systemowych jest równie łatwe po stronie JS.
  const sql = "SELECT name, sql FROM sqlite_master WHERE type='table'";
  const tail = ['d1', 'execute', DB_NAME, '--remote', '--json', '--command', sql];
  const exe  = useLocal ? process.execPath : 'wrangler';
  const args = useLocal ? [cli, ...tail] : tail;

  let raw;
  try {
    raw = execFileSync(exe, args, {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const details = [e.stderr, e.stdout].filter(Boolean).join('\n');
    if (/not authenticated|wrangler login|Authentication|CLOUDFLARE_API_TOKEN|credentials/i.test(details)) {
      throw new Error('AUTH: wrangler nie ma poświadczeń');
    }
    throw new Error((e.message || 'nieznany błąd').split('\n')[0] +
      (details ? '\n   ' + details.trim().split('\n').slice(-3).join('\n   ') : ''));
  }

  const start = raw.indexOf('[');
  if (start < 0) throw new Error('Nie znaleziono JSON w odpowiedzi wranglera:\n   ' + raw.slice(0, 300));
  const parsed = JSON.parse(raw.slice(start));
  const rows = (Array.isArray(parsed) ? parsed : [parsed]).flatMap(r => r.results || r.result || []);
  const out = new Map();
  for (const r of rows) {
    if (!r || !r.name || /^sqlite_|^_cf_/.test(r.name)) continue;
    out.set(r.name, { sql: r.sql || '', columns: columnsOf(r.sql || ''), check: hasCheck(r.sql || '') });
  }
  return out;
}

// ─── Raport ───────────────────────────────────────────────────────────────────

// Porównujemy ZBIORY kolumn, nie kolejność. Kolejność w CREATE TABLE wpływa tylko na
// `SELECT *`; nazwane INSERT/UPDATE (a takie są w całym workerze) jej nie widzą. Pierwsza
// wersja tego narzędzia porównywała tablice po indeksie i zgłaszała `sessions`/`vehicles`
// jako rozjazd, choć różniły się wyłącznie kolejnością — czysty fałszywy alarm.
const eq = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const setDiff = (a, b) => a.filter(x => !b.includes(x));

function main() {
  const repo = parseRepo();
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   TaxOrder — D1 vs worker/schema_v*.sql              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`Plików schema: ${schemaFiles().length}   |   unikalnych tabel w repo: ${repo.size}\n`);

  // 1. Tabele zdefiniowane wielokrotnie — kandydaci na cichy no-op
  const multi = [...repo.entries()].filter(([, d]) => d.length > 1);
  const conflicting = multi.filter(([, d]) => !d.every(x => eq(x.columns, d[0].columns)));
  console.log(`[1] Tabele zdefiniowane >1×: ${multi.length}  (w tym z RÓŻNĄ strukturą: ${conflicting.length})`);
  for (const [name, d] of conflicting) {
    console.log(`    ⚠ ${name}`);
    d.forEach(x => console.log(`        ${x.file.padEnd(16)} kolumny: ${x.columns.join(', ')}${x.check ? '   [CHECK]' : ''}${x.altered.length ? `   [+ALTER: ${x.altered.join(', ')}]` : ''}`));
    console.log(`        → wygrywa ${d[0].file} (CREATE TABLE IF NOT EXISTS = pozostałe to no-op)`);
  }
  if (!conflicting.length) console.log('    ✅ brak konfliktów strukturalnych');

  if (OFFLINE) {
    console.log('\n(--offline: pominięto porównanie z bazą)\n');
    return 0;
  }

  let live;
  try {
    live = readD1();
  } catch (e) {
    const msg = String(e.message || '');
    console.log('\n❌ Nie udało się odczytać D1.');
    if (msg.startsWith('AUTH:')) {
      console.log('   Wrangler nie jest zalogowany.');
      console.log('   Zaloguj się:  node node_modules/wrangler/bin/wrangler.js login');
      console.log('   albo ustaw CLOUDFLARE_API_TOKEN w środowisku.');
    } else {
      // Nie zgaduj przyczyny — pokaż to, co faktycznie powiedział wrangler.
      console.log('   ' + msg);
    }
    console.log('\n   Sama analiza plików (bez bazy): node tools/autotest/d1-schema-diff.js --offline\n');
    return 2;
  }

  console.log(`\nTabel w produkcyjnym D1: ${live.size}\n`);

  const missing = [...repo.keys()].filter(t => !live.has(t));
  console.log(`[2] W repo, BRAK w D1 (migracja nigdy nie zastosowana): ${missing.length || 'brak'}`);
  missing.forEach(t => console.log(`    ✗ ${t}   (zdefiniowana w: ${repo.get(t).map(d => d.file).join(', ')})`));

  const extra = [...live.keys()].filter(t => !repo.has(t));
  console.log(`\n[3] W D1, BRAK w repo (tabela bez definicji w migracjach): ${extra.length || 'brak'}`);
  extra.forEach(t => console.log(`    ? ${t}   kolumny: ${live.get(t).columns.join(', ')}`));

  const drift = [], stale = [];
  for (const [name, defs] of repo) {
    if (!live.has(name)) continue;
    const act = live.get(name);
    const idx = defs.findIndex(d => eq(d.columns, act.columns));
    if (idx >= 0) {
      // D1 pasuje do którejś definicji. Problem jest tylko wtedy, gdy NAJNOWSZA definicja
      // ma inny zbiór kolumn — wtedy to ona była cichym no-opem i kod pisany pod nią padnie.
      const newer = defs.slice(idx + 1).filter(d => !eq(d.columns, act.columns));
      if (newer.length) stale.push({ name, match: defs[idx], newer, act });
      continue;
    }
    drift.push({ name, act, defs });
  }

  console.log(`\n[4] CICHY NO-OP — D1 stoi na STARSZEJ definicji, nowsza nigdy nie zadziałała: ${stale.length || 'brak'}`);
  for (const { name, match, newer, act } of stale) {
    console.log(`    ⚠ ${name}   D1 = ${match.file}${act.check ? ' [CHECK]' : ''}`);
    newer.forEach(d => {
      const brak = setDiff(d.columns, act.columns);
      const nadm = setDiff(act.columns, d.columns);
      console.log(`        ${d.file} nigdy nie zastosowany${d.check ? ' [CHECK]' : ''}`);
      if (brak.length) console.log(`            zakładał kolumny, których w D1 NIE MA: ${brak.join(', ')}`);
      if (nadm.length) console.log(`            w D1 są dodatkowo: ${nadm.join(', ')}`);
    });
    console.log('        → jeśli kod pisze kolumny z nowszej definicji, zapis kończy się błędem SQLite');
  }

  console.log(`\n[5] ROZJAZD struktury (tabela istnieje, ale nie pasuje do ŻADNEJ definicji): ${drift.length || 'brak'}`);
  for (const { name, act, defs } of drift) {
    console.log(`    ⚠ ${name}`);
    console.log(`        D1:   ${act.columns.join(', ')}${act.check ? '   [CHECK]' : ''}`);
    defs.forEach(d => {
      const brak = setDiff(d.columns, act.columns);
      const nadm = setDiff(act.columns, d.columns);
      console.log(`        ${d.file.padEnd(16)} ${d.columns.join(', ')}${d.altered.length ? `   [+ALTER: ${d.altered.join(', ')}]` : ''}`);
      if (brak.length) console.log(`            w D1 BRAKUJE: ${brak.join(', ')}`);
      if (nadm.length) console.log(`            w D1 NADMIAROWE: ${nadm.join(', ')}`);
    });
  }

  const problems = missing.length + drift.length + stale.length;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(problems
    ? `⚠ Rozjazd: ${missing.length} brakujących tabel, ${stale.length} na starszej definicji, ${drift.length} niepasujących do niczego.`
    : '✅ Baza zgodna z definicjami w repo.');
  console.log('Pamiętaj: CREATE TABLE IF NOT EXISTS NIE naprawi istniejącej tabeli —');
  console.log('rozjazd struktury wymaga CREATE TABLE ... AS SELECT + DROP + RENAME.\n');

  // ── Linia bazowa dla --strict ───────────────────────────────────────────────
  // Sekcja [4] to dług STAŁY: 11 tabel stoi na starszej definicji i naprawa każdej
  // wymaga przebudowy (CREATE TABLE AS SELECT + DROP + RENAME) na żywych danych.
  // Gdyby --strict czerwienił się od tego co noc, bramka przestałaby nieść informację —
  // a dokładnie tak przegapiono pierwotną awarię: nocny job świecił NA ZIELONO co noc
  // mimo kasowania tabel, więc nikt go nie czytał. Czerwony na stałe działa tak samo,
  // tylko z drugiej strony.
  //
  // Dlatego znany dług jest wypisany imiennie i NIE psuje kodu wyjścia, ale każda
  // NOWA tabela na starszej definicji już tak. Brakujące tabele [2] i rozjazd [5]
  // psują kod wyjścia zawsze — to zawsze regresja, nigdy dług.
  //
  // TA LISTA MOŻE SIĘ TYLKO SKRACAĆ. Dopisanie do niej tabeli oznacza pogodzenie się
  // z tym, że kod piszący nowszą definicję będzie padał — napraw tabelę, nie listę.
  //
  // POCHODZENIE LISTY: sekcja [4] nocnego przebiegu `31571743555` z 12.08.2026, sha
  // fd43645 — czyli odczyt z PRODUKCYJNEGO D1, nie z odtworzenia plików schematu.
  // To rozróżnienie jest istotne: stanu produkcji NIE DA SIĘ zreplikować lokalnie,
  // bo realna historia bazy różni się od kolejności plików w repo (np. produkcyjne
  // `push_subscriptions` pochodzi z `schema.sql`, którego nocny automat nie uruchamia).
  // Odtworzenie z plików daje INNY zbiór tabel na starszej definicji — jeśli kiedyś
  // zechcesz zweryfikować tę listę, zrób to raportem z produkcji, nie lokalnie.
  const ZNANY_DLUG_STALE = new Set([
    'push_subscriptions', 'reservations', 'trips', 'geofences', 'geofence_events',
    'company_packages', 'gdpr_records', 'predictive_alerts', 'warranties_recalls',
    'disposal_records', 'esg_targets',
  ]);

  const staleNowe = stale.filter(s => !ZNANY_DLUG_STALE.has(s.name));
  const staleNaprawione = [...ZNANY_DLUG_STALE].filter(n => !stale.some(s => s.name === n));

  if (STRICT) {
    if (staleNaprawione.length) {
      console.log(`❌ ZNANY_DLUG_STALE jest nieaktualny — te tabele już NIE są na starszej definicji:`);
      staleNaprawione.forEach(n => console.log(`     ${n}`));
      console.log('   Usuń je z listy w tools/autotest/d1-schema-diff.js, żeby nie maskowała przyszłej regresji.\n');
    }
    if (staleNowe.length) {
      console.log(`❌ NOWE tabele na starszej definicji (poza znanym długiem):`);
      staleNowe.forEach(s => console.log(`     ${s.name}   D1 = ${s.match.file}`));
      console.log('   To regresja, nie dług — nowsza definicja nigdy się nie zastosowała.\n');
    }
    if (stale.length && !staleNowe.length && !staleNaprawione.length) {
      console.log(`ℹ Sekcja [4]: ${stale.length} tabel na starszej definicji — wszystkie w znanym długu, kod wyjścia bez zmian.\n`);
    }
  }

  const blokujace = missing.length + drift.length + staleNowe.length + staleNaprawione.length;
  return STRICT && blokujace ? 1 : 0;
}

process.exit(main());
