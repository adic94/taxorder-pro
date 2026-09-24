#!/usr/bin/env node
/** Blokada wydania centrum operacyjnego A–F. Bez --remote nie używa sieci. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),remote=process.argv.includes('--remote');
const releases=[
  {v:54,file:'migration_v54_operations_axis.sql',tables:['operation_records','operation_events','operation_commands']},
  {v:55,file:'migration_v55_operations_pod_settlement.sql',tables:['operation_pod_policies','operation_settlements','operation_cost_items']},
  {v:56,file:'migration_v56_integration_platform.sql',tables:['integration_adapters','integration_mapping_profiles','integration_runs','integration_run_items','integration_schedules']},
  {v:57,file:'migration_v57_cost_automation.sql',tables:['automation_rules','automation_executions','automation_actions','fuel_fraud_alerts','leasing_payment_schedules','leasing_payment_installments','insurance_fnol_cases','erp_exchange_documents']},
];
let pass=0,fail=0;const check=(m,v)=>{console.log(`  ${v?'✓':'✗'} ${m}`);v?pass++:fail++;};console.log('\nTaxOrder Pro — preflight wydania A–F\n');
for(const rel of releases){const sqlPath=path.join(ROOT,'worker',rel.file),rollback=sqlPath.replace('.sql','_ROLLBACK.sql');check(`v${rel.v}: migracja istnieje`,fs.existsSync(sqlPath));check(`v${rel.v}: rollback istnieje`,fs.existsSync(rollback));const sql=fs.existsSync(sqlPath)?fs.readFileSync(sqlPath,'utf8'):'';check(`v${rel.v}: deklaruje wszystkie wymagane tabele`,rel.tables.every(t=>new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${t}\\b`,'i').test(sql)));}
const workflow=fs.readFileSync(path.join(ROOT,'.github','workflows','deploy-worker.yml'),'utf8');check('deploy uruchamia pełny audit przed publikacją',workflow.includes('npm run audit:all'));check('deploy sprawdza zdalne D1 przed publikacją',workflow.includes('operations-release-preflight.js --remote'));
if(remote){
  const wrangler=process.platform==='win32'?path.join(ROOT,'node_modules','.bin','wrangler.cmd'):path.join(ROOT,'node_modules','.bin','wrangler');
  try{const raw=execFileSync(wrangler,['d1','execute','taxorder-pro','--remote','--command',"SELECT name FROM sqlite_master WHERE type='table'",'--json'],{cwd:ROOT,encoding:'utf8',timeout:45000,stdio:['ignore','pipe','pipe']});const parsed=JSON.parse(raw),rows=parsed?.[0]?.results||parsed?.results||[],present=new Set(rows.map(r=>r.name));for(const rel of releases)for(const table of rel.tables)check(`D1: istnieje ${table}`,present.has(table));}catch(ex){check(`połączenie i odczyt schematu D1 (${String(ex.stderr||ex.message).split(/\r?\n/)[0]})`,false);}
}else console.log('\n  ℹ Tryb offline: zdalny D1 zostanie sprawdzony przez workflow deployu (--remote).');
console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);process.exit(fail?1:0);
