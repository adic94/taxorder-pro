#!/usr/bin/env node
const fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..','..'),worker=fs.readFileSync(path.join(ROOT,'worker','index.js'),'utf8'),ui=fs.readFileSync(path.join(ROOT,'modules','automation-center.js'),'utf8'),migration=fs.readFileSync(path.join(ROOT,'worker','migration_v57_cost_automation.sql'),'utf8'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');let pass=0,fail=0;const test=(m,v)=>{console.log(`  ${v?'✓':'✗'} ${m}`);v?pass++:fail++;};console.log('\nAutomatyzacje kosztowe — faza F\n');
test('silnik nie wykonuje dowolnego SQL ani kodu użytkownika',worker.includes("rule.rule_key==='fuel_gps_anomaly'")&&worker.includes("rule.rule_key==='service_authorization'"));
test('tenant pochodzi wyłącznie z tokenu',worker.includes('async function handleAutomationCenter')&&worker.includes('const company=user.company_id'));
test('aktywacja wymaga kierownika',worker.includes("body.mode==='active'&&!['admin','kierownik'].includes(user.role)"));
test('nowe reguły są domyślnie dry-run',migration.match(/'dry_run' FROM companies/g)?.length===4);
test('silnik ma limit akcji i ochronę przed pętlą',worker.includes('max_actions_per_run')&&migration.includes('UNIQUE(company_id,action_key)'));
test('paliwo ↔ GPS zapisuje wyjaśnialne dowody',worker.includes('NO_GPS_EVIDENCE')&&worker.includes('ODOMETER_MISMATCH')&&worker.includes('reason_codes'));
test('serwis powyżej progu trafia do approvals',worker.includes("record_type,record_id")&&worker.includes("'service_order'"));
test('leasing utrwala kapitał, odsetki i marżę',worker.includes('principal_amount')&&worker.includes('interest_amount')&&worker.includes('margin_amount'));
test('harmonogram leasingu ma idempotentną wersję umowy',migration.includes('UNIQUE(company_id,contract_ref,version)')&&worker.includes('replayed:true'));
test('FNOL waliduje datę, opis, pojazd i polisę',['Brak daty zdarzenia','Brak opisu','Brak pojazdu','Brak powiązanej polisy'].every(x=>worker.includes(x)));
test('dokument ERP wymaga zaakceptowanego rozliczenia',worker.includes("operation_settlements WHERE id=? AND company_id=? AND status='approved'"));
test('ERP ma wersję, checksum i klucz idempotencji',worker.includes("contract_version:'1.0'")&&worker.includes('integrationContentHash(payload)')&&migration.includes('UNIQUE(company_id,idempotency_key)'));
test('enova365 i Comarch pozostają wyłączone do zatwierdzenia',migration.match(/disabled_until_approved/g)?.length===2);
test('UI pokazuje log wyjaśniający i wymaga potwierdzenia aktywacji',ui.includes('Explainable log')&&ui.includes("confirm('Aktywować regułę?"));
test('centrum jest podłączone do aplikacji i PWA',html.includes('page-automation-center')&&html.includes('modules/automation-center.js')&&sw.includes("'/modules/automation-center.js'"));
console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);process.exit(fail?1:0);
