#!/usr/bin/env node
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..','..');
const worker=fs.readFileSync(path.join(ROOT,'worker','index.js'),'utf8');const workbench=fs.readFileSync(path.join(ROOT,'modules','operations-workbench.js'),'utf8');const pwa=fs.readFileSync(path.join(ROOT,'modules','driver-pwa.js'),'utf8');
let pass=0,fail=0;const test=(m,v)=>{console.log(`  ${v?'✓':'✗'} ${m}`);v?pass++:fail++;};
console.log('\nOperations — faza D POD i rozliczenie\n');
test('kompletność wynika z polityk per typ operacji',worker.includes('function operationPodStatus')&&worker.includes('operation_pod_policies'));
test('kompletność raportuje SLA i opóźnienie',worker.includes('sla_minutes')&&worker.includes('overdue:'));
test('POD łączy Smart Forms, dokumenty i protokoły',['smart_form_submissions','documents','handover_protocols'].every(x=>worker.includes(x)));
test('upload POD ma limit, R2 i sprzątanie po błędzie',worker.includes('20 * 1024 * 1024')&&worker.includes('await env.DOCS.delete(uploadedKey)'));
test('kierowca dodaje POD tylko do własnego przydziału',worker.includes("user.role === 'kierowca'")&&worker.includes('Operacja nie jest przypisana do tego kierowcy'));
test('zakończenie blokuje niekompletny POD',worker.includes("body.command_type === 'operation.complete'")&&worker.includes('Nie można zakończyć: POD jest niekompletny'));
test('rozliczenie wymaga zakończonej operacji i kompletnego POD',worker.includes('Rozliczenie można przygotować po zakończeniu operacji')&&worker.includes("error:'POD jest niekompletny'"));
test('rozliczenie zapisuje plan, wykonanie, koszty i marżę',worker.includes('planned_distance_km')&&worker.includes('actual_distance_km')&&worker.includes('margin_pct'));
test('akceptacja tworzy szkic Route Billing',worker.includes('INSERT INTO route_invoices')&&worker.includes("status='approved'"));
test('workbench pokazuje kompletność i przygotowanie rozliczenia',workbench.includes('POD i kompletność')&&workbench.includes('prepareSettlement'));
test('PWA pozwala przesłać zdjęcie lub PDF jako POD',pwa.includes("input.accept='image/*,application/pdf'")&&pwa.includes('/proofs/upload?company='));
test('każde połączenie dowodu jest wersjonowaną komendą',worker.includes("'operation.add_proof'")&&worker.includes("'operation.proof_added'"));
console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);process.exit(fail?1:0);

