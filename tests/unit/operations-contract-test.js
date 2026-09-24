/** Faza A: dowód kontraktowy luk obecnego transport_orders i spięcia prototypu. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const schema = fs.readFileSync(path.join(ROOT, 'worker', 'schema_v26.sql'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const contract = fs.readFileSync(path.join(ROOT, 'docs', 'contracts', 'operations-v1.md'), 'utf8');

let failed = 0;
function test(name, assertion) {
  try { assertion(); process.stdout.write(`  ✓ ${name}\n`); }
  catch (error) { failed++; process.stderr.write(`  ✗ ${name}: ${error.message}\n`); }
}
function assert(value, message) { if (!value) throw new Error(message); }

const create = schema.match(/CREATE TABLE IF NOT EXISTS transport_orders\s*\(([\s\S]*?)\n\);/i);
const columns = create ? [...create[1].matchAll(/^\s*([a-z_][a-z0-9_]*)\s+/gmi)].map(match => match[1]) : [];

console.log('\nOperations Contract v1 — Faza A\n');

test('transport_orders istnieje', () => assert(create, 'brak tabeli bazowej transport_orders'));
test('obecny model zachowuje bazowy identyfikator i tenant', () => {
  assert(columns.includes('id') && columns.includes('company_id'), 'brak id/company_id');
});
test('obecny model nie udaje pełnej osi operacji', () => {
  const required = ['version', 'operation_type_id', 'current_state', 'last_event_sequence'];
  const unexpectedlyPresent = required.filter(column => columns.includes(column));
  assert(unexpectedlyPresent.length === 0, `faza B została częściowo wdrożona bez aktualizacji kontraktu: ${unexpectedlyPresent.join(', ')}`);
});
test('przystanki, zadania, zdarzenia i POD nie są kolumnami transport_orders', () => {
  const missingByDesign = ['stops', 'tasks', 'events', 'proofs'];
  assert(missingByDesign.every(column => !columns.includes(column)), 'zagnieżdżone elementy nie powinny być płaskimi kolumnami');
});
test('kontrakt wymaga idempotencji i kontroli wersji', () => {
  assert(contract.includes('idempotency_key') && contract.includes('expected_version'), 'brak ochrony komend współbieżnych');
});
test('prototyp jest podpięty do nawigacji i routingu', () => {
  assert(index.includes('page-operations-workbench'), 'brak kontenera strony');
  assert(index.includes('modules/operations-workbench.js'), 'brak skryptu modułu');
  assert(app.includes("id==='operations-workbench'"), 'brak routingu renderowania');
});
test('fallback fazy A pozostaje read-only po podłączeniu Operations v1', () => {
  const module = fs.readFileSync(path.join(ROOT, 'modules', 'operations-workbench.js'), 'utf8');
  const guards = module.match(/sourceMode === 'legacy'/g) || [];
  assert(module.includes('nie udostępnia komend') && guards.length >= 4,
    'fallback nie ma kompletu guardów dla planowania, komend i przystanków');
});

if (failed) process.exit(1);
process.stdout.write('\nWynik: kontrakt fazy A potwierdza potrzebę osi operacji w fazie B.\n');
