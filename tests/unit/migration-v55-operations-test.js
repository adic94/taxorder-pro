#!/usr/bin/env node
const { DatabaseSync } = require('node:sqlite');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..');
const v54=fs.readFileSync(path.join(ROOT,'worker','migration_v54_operations_axis.sql'),'utf8');
const v55=fs.readFileSync(path.join(ROOT,'worker','migration_v55_operations_pod_settlement.sql'),'utf8');
const rollback=fs.readFileSync(path.join(ROOT,'worker','migration_v55_operations_pod_settlement_ROLLBACK.sql'),'utf8');
let pass=0,fail=0;const ok=(v,m)=>{console.log(`  ${v?'✓':'✗'} ${m}`);v?pass++:fail++;};
const db=new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE transport_orders(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,title TEXT NOT NULL,driver_id TEXT,driver_name TEXT,vehicle_id TEXT,nr_rej TEXT,origin TEXT,destination TEXT,scheduled_start TEXT,scheduled_end TEXT,actual_start TEXT,actual_end TEXT,distance_km REAL,status TEXT DEFAULT 'planned',priority TEXT,created_at TEXT,updated_at TEXT);
INSERT INTO transport_orders VALUES('o1','alpha','Dostawa','d1','Jan','v1','WA1','A','B','2026-09-01T08:00','2026-09-01T10:00',NULL,'2026-09-01T10:05',120,'completed','normal','2026-08-01','2026-09-01');`);
console.log('\nMigracja v55 — POD i rozliczenie\n');
try{db.exec(v54);db.exec(v55);ok(true,'v55 wykonuje się po v54');}catch(e){ok(false,e.message);process.exit(1);}
const policies=db.prepare('SELECT proof_type,min_count,sla_minutes FROM operation_pod_policies WHERE company_id=? ORDER BY proof_type').all('alpha');
ok(policies.length===2&&policies.some(x=>x.proof_type==='signature')&&policies.some(x=>x.proof_type==='document'),'domyślna polityka transportu wymaga podpisu i dokumentu');
db.exec(`INSERT INTO operation_proofs(id,company_id,operation_id,proof_type,source_type,source_id,captured_at) VALUES('p1','alpha','op_o1','signature','smart_form','f1',datetime('now')),('p2','alpha','op_o1','document','document','d1',datetime('now'));
INSERT INTO operation_settlements(id,company_id,operation_id,settlement_version,status,planned_distance_km,actual_distance_km,planned_cost_pln,actual_cost_pln,revenue_net_pln,margin_pln,margin_pct) VALUES('s1','alpha','op_o1',1,'draft',120,125,300,320,600,280,46.67);
INSERT INTO operation_cost_items(id,company_id,operation_id,settlement_id,cost_type,planned_amount_pln,actual_amount_pln) VALUES('c1','alpha','op_o1','s1','fuel',100,110);`);
ok(db.prepare('SELECT COUNT(*) c FROM operation_proofs WHERE operation_id=?').get('op_o1').c===2,'dowody pozostają w osi v54 i spełniają politykę v55');
const settlement=db.prepare('SELECT * FROM operation_settlements WHERE operation_id=?').get('op_o1');
ok(settlement.actual_cost_pln===320&&settlement.margin_pln===280,'rozliczenie zachowuje plan, wykonanie i marżę');
try{db.exec(rollback);ok(true,'rollback v55 wykonuje się bez błędu');}catch(e){ok(false,e.message);}
ok(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name IN ('operation_pod_policies','operation_settlements','operation_cost_items')").get().c===0,'rollback usuwa tylko tabele v55');
ok(db.prepare("SELECT COUNT(*) c FROM operation_records").get().c===1&&db.prepare("SELECT COUNT(*) c FROM operation_proofs").get().c===2,'rollback zachowuje oś i dowody v54');
console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);process.exit(fail?1:0);

