#!/usr/bin/env node
/**
 * Buduje wyłącznie zdalną bazę `taxorder-pro-uat` z jawnego configu UAT.
 * Domyślnie pokazuje plan. Zapis wymaga --apply; produkcyjna nazwa/id powoduje odmowę.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKER = path.join(ROOT, 'worker');
const CONFIG = path.join(ROOT, 'wrangler.uat.toml');
const apply = process.argv.includes('--apply');
// Nie uruchamiaj `.cmd` przez spawnSync na Windowsie: wrapper wymaga powłoki i przy
// ścieżkach ze spacjami potrafi zwrócić ENOENT bez stderr. Bezpośredni entrypoint JS
// działa identycznie na Windows/Linux i nie potrzebuje `shell: true`.
const wrangler = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const runWrangler = args => spawnSync(process.execPath, [wrangler, ...args], {
  cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});

const config = fs.readFileSync(CONFIG, 'utf8');
const dbName = config.match(/database_name\s*=\s*"([^"]+)"/)?.[1];
const dbId = config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
if (dbName !== 'taxorder-pro-uat' || dbId !== 'aee5038e-e7d4-4ae5-af51-b11fe7ae9008') {
  throw new Error('Odmowa: wrangler.uat.toml nie wskazuje zatwierdzonej bazy UAT.');
}

const schemas = fs.readdirSync(WORKER)
  .filter(f => /^schema_v\d+\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const manual = fs.readdirSync(WORKER)
  .filter(f => /^migration_v\d+.*\.sql$/.test(f) && !/_ROLLBACK/i.test(f))
  .sort((a, b) => Number(a.match(/_v(\d+)/)[1]) - Number(b.match(/_v(\d+)/)[1]));
const files = [...schemas, ...manual];

console.log(`\nUAT D1: ${dbName} (${dbId})`);
console.log(`Plan: ${schemas.length} schema + ${manual.length} migracji ręcznych = ${files.length} plików`);
console.log(`Zakres końcowy: ${files.at(-1)}\n`);
if (!apply) {
  console.log('Tryb planu — bez zmian. Uruchom z --apply, aby zastosować do UAT.');
  process.exit(0);
}

for (const [index, file] of files.entries()) {
  process.stdout.write(`[${String(index + 1).padStart(2, '0')}/${files.length}] ${file} ... `);
  const result = runWrangler([
    'd1', 'execute', dbName, '--remote', '--config', CONFIG,
    '--file', path.join(WORKER, file),
  ]);
  if (result.status !== 0) {
    const sql = fs.readFileSync(path.join(WORKER, file), 'utf8');
    const diagnostic = `${result.stderr || ''}\n${result.stdout || ''}`;
    const duplicateOnly = /duplicate column name/i.test(diagnostic);
    const createsTable = /CREATE\s+TABLE/i.test(sql.replace(/--[^\n]*/g, ''));
    if (duplicateOnly && !createsTable) {
      console.log('POMINIĘTO (kolumna istnieje; plik nie tworzy tabel)');
      continue;
    }
    console.log('BŁĄD');
    process.stderr.write(result.stderr || result.stdout || 'Nieznany błąd wrangler\n');
    process.exit(result.status || 1);
  }
  console.log('OK');
}

const verify = runWrangler([
  'd1', 'execute', dbName, '--remote', '--config', CONFIG,
  '--command', "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", '--json',
]);
if (verify.status !== 0) {
  process.stderr.write(verify.stderr || verify.stdout);
  process.exit(verify.status || 1);
}
const parsed = JSON.parse(verify.stdout);
const rows = parsed?.[0]?.results || parsed?.results || [];
const present = new Set(rows.map(row => row.name));
const required = [
  'operation_records', 'operation_events', 'operation_commands',
  'operation_pod_policies', 'operation_settlements', 'operation_cost_items',
  'integration_adapters', 'integration_mapping_profiles', 'integration_runs',
  'integration_run_items', 'integration_schedules', 'automation_rules',
  'automation_executions', 'automation_actions', 'fuel_fraud_alerts',
  'leasing_payment_schedules', 'leasing_payment_installments',
  'insurance_fnol_cases', 'erp_exchange_documents',
];
const missing = required.filter(name => !present.has(name));
console.log(`\nWeryfikacja UAT: ${present.size} tabel; wymagane A–F: ${required.length - missing.length}/${required.length}.`);
if (missing.length) {
  console.error(`Brak: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Migracje UAT zakończone poprawnie.');
