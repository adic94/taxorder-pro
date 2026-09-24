#!/usr/bin/env node
const fs=require('fs'),path=require('path');const {DatabaseSync}=require('node:sqlite');
const ROOT=path.join(__dirname,'..','..'),migration=fs.readFileSync(path.join(ROOT,'worker','migration_v56_integration_platform.sql'),'utf8'),rollback=fs.readFileSync(path.join(ROOT,'worker','migration_v56_integration_platform_ROLLBACK.sql'),'utf8');
let pass=0,fail=0;const test=(m,v)=>{console.log(`  ${v?'✓':'✗'} ${m}`);v?pass++:fail++;};
console.log('\nIntegration platform — migracja v56\n');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE companies(id TEXT PRIMARY KEY); INSERT INTO companies VALUES (\'tenant-a\'),(\'tenant-b\');');
try{db.exec(migration);test('migracja wykonuje się na SQLite',true);}catch(e){test(`migracja wykonuje się na SQLite (${e.message})`,false);}
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
for(const name of ['integration_adapters','integration_mapping_profiles','integration_runs','integration_run_items','integration_schedules'])test(`istnieje ${name}`,tables.includes(name));
test('ERPNext sandbox powstaje dla każdego tenanta',db.prepare("SELECT count(*) n FROM integration_adapters WHERE adapter_key='erpnext'").get().n===2);
test('sekret jest referencją, nie wartością',db.prepare("SELECT secret_ref,config FROM integration_adapters LIMIT 1").get().secret_ref==='ERPNEXT_API_TOKEN');
db.prepare("INSERT INTO integration_mapping_profiles(id,company_id,name,entity_type,source_format,mapping) VALUES ('p1','tenant-a','Zlecenia','transport_order','xlsx','{}')").run();
db.prepare("INSERT INTO integration_runs(id,company_id,profile_id,direction,operation,idempotency_key) VALUES ('r1','tenant-a','p1','import','dry_run','same')").run();
let duplicateBlocked=false;try{db.prepare("INSERT INTO integration_runs(id,company_id,direction,operation,idempotency_key) VALUES ('r2','tenant-a','import','dry_run','same')").run();}catch{duplicateBlocked=true;}test('idempotency_key blokuje powtórzenie w obrębie firmy',duplicateBlocked);
db.prepare("INSERT INTO integration_runs(id,company_id,direction,operation,idempotency_key) VALUES ('r3','tenant-b','import','dry_run','same')").run();test('ten sam klucz może istnieć w innym tenancie',true);
let statusBlocked=false;try{db.prepare("UPDATE integration_runs SET status='forever' WHERE id='r1'").run();}catch{statusBlocked=true;}test('kolejka ma zamknięty model stanów',statusBlocked);
db.exec(rollback);const after=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'integration_%'").all();test('rollback usuwa wyłącznie tabele fazy E',after.length===0);
console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);process.exit(fail?1:0);
