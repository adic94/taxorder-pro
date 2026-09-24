#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const worker = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');
const workbench = fs.readFileSync(path.join(ROOT, 'modules', 'operations-workbench.js'), 'utf8');
const pwa = fs.readFileSync(path.join(ROOT, 'modules', 'driver-pwa.js'), 'utf8');

let pass = 0, fail = 0;
function test(name, condition, detail = '') {
  process.stdout.write(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}\n`);
  condition ? pass++ : fail++;
}

console.log('\nOperations Workbench — faza C\n');
test('API publikuje katalog kierowców i pojazdów', worker.includes("operationId === 'resources'") && worker.includes('drivers:') && worker.includes('vehicles:'));
test('preview planu jest osobnym endpointem bez zapisu', worker.includes("action === 'plan-preview'") && worker.includes('committable: conflicts.length === 0'));
test('plan wymaga obu podstawowych zasobów', (worker.match(/Plan wymaga kierowcy i pojazdu/g) || []).length >= 2);
test('detektor używa otwartych granic nakładania przedziałów', worker.includes("a.starts_at<? AND a.ends_at>?"));
test('zmiana przystanku jest wersjonowana i emituje zdarzenie', worker.includes("'operation.update_stop'") && worker.includes("'operation.stop_updated'") && workbench.includes('expected_version:order.version'));
test('kierowca odczytuje tylko własne przydziały', worker.includes("user.role === 'kierowca'") && worker.includes("own.resource_id=?"));
test('kierowca nie wykona komendy na cudzym przydziale', worker.includes('Operacja nie jest przypisana do tego kierowcy'));
test('dispatch obsługuje akceptację i odrzucenie', worker.includes("'operation.reject'") && pwa.includes("'operation.accept'") && pwa.includes("'operation.reject'"));
test('PWA ładuje operacje równolegle z trasami legacy', pwa.includes('Promise.all([_loadTrips(), _loadOperations()])'));
test('workbench ma listę, Gantt i mapę', ['queue','gantt','map'].every(view => workbench.includes(`'${view}'`)) && workbench.includes('renderGantt') && workbench.includes('renderMap'));
test('zapis planu jest zablokowany do pozytywnego preview', workbench.includes('id="op-plan-commit"') && workbench.includes('disabled') && workbench.includes('commit.disabled = false'));
test('workbench pokazuje oś czasu zdarzeń', workbench.includes('Oś czasu') && workbench.includes('/events?company='));
test('komendy UI wysyłają wersję i klucz idempotencji', workbench.includes('expected_version:order.version') && workbench.includes('idempotency_key:'));
test('fallback legacy nie wykonuje mutacji', workbench.includes("sourceMode === 'legacy'") && workbench.includes('nie udostępnia komend'));

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);

