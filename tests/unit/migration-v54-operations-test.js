#!/usr/bin/env node
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const migration = fs.readFileSync(path.join(ROOT, 'worker', 'migration_v54_operations_axis.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(ROOT, 'worker', 'migration_v54_operations_axis_ROLLBACK.sql'), 'utf8');
const worker = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
function ok(condition, message) {
  process.stdout.write(`  ${condition ? '✓' : '✗'} ${message}\n`);
  condition ? pass++ : fail++;
}

const db = new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE transport_orders (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, title TEXT NOT NULL,
 driver_id TEXT, driver_name TEXT, vehicle_id TEXT, nr_rej TEXT,
 origin TEXT, destination TEXT, scheduled_start TEXT, scheduled_end TEXT,
 actual_start TEXT, actual_end TEXT, status TEXT DEFAULT 'planned', priority TEXT,
 created_at TEXT, updated_at TEXT
);
INSERT INTO transport_orders VALUES
 ('o1','alpha','Trasa A','d1','Jan','v1','WA1','Warszawa','Łódź','2026-09-01T08:00','2026-09-01T10:00',NULL,NULL,'planned','normal','2026-08-01','2026-08-01'),
 ('o2','beta','Trasa B','d1','Inny Jan','v1','WA1','Gdańsk','Gdynia','2026-09-01T08:30','2026-09-01T09:30',NULL,NULL,'planned','normal','2026-08-01','2026-08-01');`);

console.log('\nMigracja v54 — oś operacji\n');
try { db.exec(migration); ok(true, 'migracja wykonuje się na istniejących transport_orders'); }
catch (error) { ok(false, `migracja: ${error.message}`); process.exit(1); }

const records = db.prepare('SELECT * FROM operation_records ORDER BY company_id').all();
ok(records.length === 2 && records.every(x => x.version === 1 && x.last_event_sequence === 1), 'backfill tworzy wersjonowaną operację dla każdego zlecenia');
ok(db.prepare('SELECT COUNT(*) c FROM operation_stops').get().c === 4, 'backfill tworzy pickup i delivery');
ok(db.prepare('SELECT COUNT(*) c FROM operation_assignments').get().c === 4, 'backfill tworzy przydział kierowcy i pojazdu');
ok(db.prepare('SELECT COUNT(*) c FROM operation_events').get().c === 2, 'backfill zapisuje zdarzenie importu');

db.exec(`INSERT INTO transport_orders VALUES
 ('o3','alpha','Nowa trasa',NULL,NULL,NULL,NULL,'Poznań','Wrocław','2026-09-02T08:00','2026-09-02T12:00',NULL,NULL,'planned','normal','2026-08-02','2026-08-02');`);
ok(db.prepare('SELECT current_state FROM operation_records WHERE order_id=?').get('o3')?.current_state === 'planned', 'adapter automatycznie obejmuje zlecenia utworzone po migracji');
db.exec("UPDATE transport_orders SET status='in_progress' WHERE id='o3'");
const legacySync = db.prepare('SELECT current_state,version,last_event_sequence FROM operation_records WHERE order_id=?').get('o3');
ok(legacySync.current_state === 'in_progress' && legacySync.version === 2 && legacySync.last_event_sequence === 2, 'zmiana statusu legacy synchronizuje wersję i zdarzenie osi');

db.prepare(`INSERT INTO operation_commands
 (id,company_id,operation_id,command_type,idempotency_key,expected_version,target_state,event_type,actor_id,actor_role,payload)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('c1','alpha','op_o1','operation.dispatch','idem-1',1,'dispatched','operation.dispatched','u1','dyspozytor','{}');
const after = db.prepare('SELECT current_state,version,last_event_sequence FROM operation_records WHERE id=?').get('op_o1');
ok(after.current_state === 'dispatched' && after.version === 2 && after.last_event_sequence === 2, 'komenda atomowo zmienia stan i wersję');
ok(db.prepare('SELECT from_state,to_state,sequence_no FROM operation_events WHERE correlation_id=?').get('c1').to_state === 'dispatched', 'trigger zapisuje skorelowane zdarzenie');
ok(db.prepare('SELECT status FROM transport_orders WHERE id=?').get('o1').status === 'planned', 'adapter zachowuje zgodny status legacy');

let staleRejected = false;
try {
  db.prepare(`INSERT INTO operation_commands(id,company_id,operation_id,command_type,idempotency_key,expected_version,target_state,event_type)
    VALUES('c2','alpha','op_o1','operation.accept','idem-2',1,'accepted','operation.accepted')`).run();
} catch (error) { staleRejected = String(error.message).includes('operation_version_conflict'); }
ok(staleRejected, 'stara expected_version jest odrzucana w bazie');
ok(db.prepare('SELECT COUNT(*) c FROM operation_events WHERE operation_id=?').get('op_o1').c === 2, 'odrzucona komenda nie zostawia zdarzenia');

let duplicateRejected = false;
try {
  db.prepare(`INSERT INTO operation_commands(id,company_id,operation_id,command_type,idempotency_key,expected_version,target_state,event_type)
    VALUES('c3','alpha','op_o1','operation.accept','idem-1',2,'accepted','operation.accepted')`).run();
} catch (error) { duplicateRejected = /UNIQUE/.test(String(error.message)); }
ok(duplicateRejected, 'klucz idempotencji jest unikalny w firmie');

const crossTenant = db.prepare('SELECT id FROM operation_records WHERE id=? AND company_id=?').get('op_o2','alpha');
ok(!crossTenant, 'zapytanie tenantowe nie widzi operacji innej firmy');
ok(worker.includes("path.startsWith('/api/operations')") && worker.includes('operationCompanyAccess'), 'Worker wymusza osobny guard dostępu dla Operations API');
ok(worker.includes("a.starts_at<? AND a.ends_at>?") && worker.includes("code: 'assignment_conflict'"), 'detektor stosuje poprawny warunek nakładania przedziałów');

try { db.exec(rollback); ok(true, 'rollback wykonuje się bez błędu'); }
catch (error) { ok(false, `rollback: ${error.message}`); }
const remains = db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name LIKE 'operation_%'").get().c;
ok(remains === 0 && db.prepare('SELECT COUNT(*) c FROM transport_orders').get().c === 3, 'rollback usuwa nakładkę i zachowuje transport_orders');

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
