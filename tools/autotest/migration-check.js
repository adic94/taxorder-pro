#!/usr/bin/env node
/**
 * TaxOrder Pro — DB Migration Tracker
 * Porównuje pliki schema_vN.sql w repo z tabelami faktycznie istniejącymi w D1.
 *
 * Co robi:
 *   1. Skanuje worker/schema_v*.sql i wyciąga tabele które tworzą
 *   2. Pyta D1 (--remote) o listę istniejących tabel
 *   3. Raportuje: które tabele z migracji brakuje w D1 (niezaaplikowane)
 *      oraz które migracje można pominąć (tabele już istnieją)
 *
 * Wymagania: wrangler w PATH lub node_modules/.bin/wrangler
 *
 * Użycie:
 *   node tools/autotest/migration-check.js
 *   node tools/autotest/migration-check.js --local   (lokalna D1, nie remote)
 */

const { execSync }  = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '../..');
const SCHEMA_DIR = path.join(ROOT, 'worker');
const LOCAL  = process.argv.includes('--local');
const DB_NAME = 'taxorder-pro';

// Wrangler — szukaj w node_modules lub PATH
const WRANGLER = (() => {
  const local = path.join(ROOT, 'node_modules/.bin/wrangler.cmd');
  if (fs.existsSync(local)) return local;
  const localSh = path.join(ROOT, 'node_modules/.bin/wrangler');
  if (fs.existsSync(localSh)) return localSh;
  return 'wrangler';
})();

// Node.js portable w PATH (Windows)
const NODE_PATH = 'C:\\Users\\acichocki\\node\\node-v24.16.0-win-x64';
if (fs.existsSync(NODE_PATH)) {
  process.env.Path = NODE_PATH + ';' + (process.env.Path || process.env.PATH || '');
}

// ── 1. Skanuj schema_vN.sql ──────────────────────────────────────────────────

const schemaFiles = fs.readdirSync(SCHEMA_DIR)
  .filter(f => /^schema_v\d+\.sql$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0]);
    const nb = parseInt(b.match(/\d+/)[0]);
    return na - nb;
  });

// Wyciągnij nazwy tabel i indeksów z każdej migracji
const migrations = [];

for (const file of schemaFiles) {
  const sql = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
  const tables  = [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)].map(m => m[1]);
  const indexes = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)].map(m => m[1]);
  const version = parseInt(file.match(/\d+/)[0]);
  migrations.push({ file, version, tables, indexes });
}

// ── 2. Pobierz tabele z D1 ───────────────────────────────────────────────────

let d1Tables = null;
let wranglerError = null;

try {
  const flag  = LOCAL ? '--local' : '--remote';
  const cmd   = `"${WRANGLER}" d1 execute ${DB_NAME} ${flag} --command "SELECT name, type FROM sqlite_master WHERE type IN ('table','index') ORDER BY name" --json`;
  const raw   = execSync(cmd, { cwd: ROOT, timeout: 30000, encoding: 'utf8' });

  // wrangler zwraca tablicę JSON: [{ results: [{name, type}] }]
  const parsed = JSON.parse(raw);
  const rows   = parsed?.[0]?.results ?? parsed?.results ?? [];
  d1Tables = {
    tables:  new Set(rows.filter(r => r.type === 'table').map(r => r.name)),
    indexes: new Set(rows.filter(r => r.type === 'index').map(r => r.name)),
  };
} catch (e) {
  wranglerError = e.message?.split('\n')[0] || String(e);
}

// ── 3. Raport ────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║      TaxOrder Pro — DB Migration Tracker            ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log(`Pliki migracji w repo:  ${schemaFiles.length} (v${migrations[0]?.version}–v${migrations.at(-1)?.version})`);
console.log(`Cel D1:                 ${LOCAL ? 'lokalna (--local)' : 'produkcja (--remote)'}\n`);

// Tabele ze wszystkich migracji
const allRepoTables  = new Set(migrations.flatMap(m => m.tables));
const allRepoIndexes = new Set(migrations.flatMap(m => m.indexes));

if (wranglerError) {
  console.log('⚠️  Nie udało się połączyć z D1 (wrangler niedostępny lub brak auth)');
  console.log(`   Błąd: ${wranglerError}\n`);
  console.log('Tabele zdefiniowane w migracjach (stan repo):');
  for (const m of migrations) {
    if (m.tables.length === 0 && m.indexes.length === 0) continue;
    console.log(`\n  [${m.file}]`);
    m.tables.forEach(t  => console.log(`    tabela:  ${t}`));
    m.indexes.forEach(i => console.log(`    indeks:  ${i}`));
  }
  console.log('\nAby sprawdzić D1 ręcznie:');
  console.log(`  ${WRANGLER} d1 execute ${DB_NAME} --remote --command "SELECT name FROM sqlite_master WHERE type='table'"\n`);
  process.exit(0); // brak wranglera — nie traktuj jako błąd CI
}

// Porównanie repo vs D1
const missingTables  = [...allRepoTables].filter(t => !d1Tables.tables.has(t));
const missingIndexes = [...allRepoIndexes].filter(i => !d1Tables.indexes.has(i));
const extraTables    = [...d1Tables.tables]
  .filter(t => !['sqlite_sequence','sqlite_stat1','sqlite_stat4','_cf_KV'].includes(t) && !allRepoTables.has(t));

console.log(`Tabele w D1:            ${d1Tables.tables.size}`);
console.log(`Tabele w repo:          ${allRepoTables.size}`);
console.log(`Indeksy brakujące:      ${missingIndexes.length}\n`);

if (missingTables.length === 0 && missingIndexes.length === 0) {
  console.log('✅ Wszystkie migracje zaaplikowane — D1 jest w sync z repo\n');
} else {
  console.log('❌ NIEZAAPLIKOWANE MIGRACJE:\n');

  for (const m of migrations) {
    const unappTables  = m.tables.filter(t => !d1Tables.tables.has(t));
    const unappIndexes = m.indexes.filter(i => !d1Tables.indexes.has(i));
    if (unappTables.length === 0 && unappIndexes.length === 0) continue;

    console.log(`  [${m.file}] — BRAK w D1:`);
    unappTables.forEach(t  => console.log(`    CREATE TABLE  ${t}`));
    unappIndexes.forEach(i => console.log(`    CREATE INDEX  ${i}`));
    console.log(`\n  Aby zaaplikować:\n    .\\deploy.ps1 -Schema v${m.version}\n`);
  }
}

if (extraTables.length) {
  console.log(`ℹ️  Tabele w D1 bez odpowiednika w schema_v*.sql (${extraTables.length}):`);
  extraTables.forEach(t => console.log(`    • ${t}`));
  console.log('   (prawdopodobnie stare tabele lub ręczne zmiany — weryfikuj ręcznie)\n');
}

// Stan każdej migracji
console.log('─'.repeat(54));
console.log('Stan migracji:\n');
for (const m of migrations) {
  if (m.tables.length === 0 && m.indexes.length === 0) {
    console.log(`  [v${String(m.version).padStart(2,'0')}] ${m.file} — (brak CREATE TABLE/INDEX)`);
    continue;
  }
  const allPresent = m.tables.every(t => d1Tables.tables.has(t)) &&
                     m.indexes.every(i => d1Tables.indexes.has(i));
  const icon = allPresent ? '✅' : '❌';
  const objects = [...m.tables, ...m.indexes].join(', ');
  console.log(`  ${icon} [v${String(m.version).padStart(2,'0')}] ${m.file.replace('schema_','').replace('.sql','')} — ${objects}`);
}

console.log('');
process.exit(missingTables.length > 0 || missingIndexes.length > 0 ? 1 : 0);
