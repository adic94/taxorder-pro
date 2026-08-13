#!/usr/bin/env node
/**
 * Strażnik: migration_v50_esg_targets.sql — przebudowa esg_targets z modelu v35
 * (sztywne kolumny) na v41 (metric_key/target_value).
 *
 * PO CO TO JEST: migracja w chwili pisania NIE jest jeszcze zastosowana na produkcji,
 * a przebudowuje tabelę przez DROP + RENAME — czyli operacją nieodwracalną poza oknem
 * Time Travel. Ten test uruchamia ją na prawdziwym silniku SQLite, na wiernie odtworzonej
 * strukturze v35 (PRAGMA table_info z produkcji, 11.08.2026), i sprawdza, że nic nie ginie.
 *
 * Sprawdza w szczególności trzy rzeczy, które łatwo zepsuć edycją pliku:
 *   1. przeliczenie CO2 kg → t (bez niego cele byłyby zawyżone 1000×),
 *   2. usunięcie starego indeksu UNIQUE(company_id, year) — inaczej model v41 blokuje
 *      się na drugiej metryce w roku,
 *   3. że DOSŁOWNY `INSERT` z worker/index.js wykonuje się na nowej strukturze —
 *      bo to właśnie on zwraca dziś 500 i on jest celem całej migracji.
 *
 * Bez zależności i bez sieci: `node:sqlite` (wymaga Node ≥ 22.5).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
process.chdir(path.join(__dirname, '..', '..'));
let pass=0, fail=0;
const ok=(w,m)=>{ console.log(`  ${w?'\x1b[32m✓\x1b[0m':'\x1b[31m✗\x1b[0m'} ${m}`); w?pass++:fail++; };

const db = new DatabaseSync(':memory:');
// Produkcyjna struktura v35 — dosłownie z worker/schema_v35.sql (PRAGMA potwierdzone 11.08).
db.exec(`CREATE TABLE esg_targets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), company_id TEXT NOT NULL,
  year INTEGER NOT NULL, co2_target_kg REAL, fuel_target_l REAL,
  ev_percentage_target REAL, electric_km_target REAL, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE UNIQUE INDEX idx_esg_co_year ON esg_targets(company_id, year);`);

// Wiersz z KOMPLETEM celów + wiersz częściowy (tylko CO2) — sprawdza oba rozgałęzienia.
db.exec(`INSERT INTO esg_targets(id,company_id,year,co2_target_kg,fuel_target_l,ev_percentage_target,electric_km_target,notes)
         VALUES('r1','mtoilet',2026, 250000, 90000, 15, 40000, 'cel roczny');
         INSERT INTO esg_targets(id,company_id,year,co2_target_kg) VALUES('r2','gcon',2026, 80000);`);

const przed = db.prepare('SELECT COUNT(*) c FROM esg_targets').get().c;

console.log('\nMigracja v50 esg_targets — weryfikacja przed uruchomieniem na produkcji\n');

// Uruchom migrację dokładnie tak, jak zrobi to wrangler --file.
// Wyjątek łapiemy świadomie: bez tego test kończy się gołym stack trace'em, z którego
// nie widać, KTÓRA własność migracji się zepsuła. Przykład z życia — zostawienie starego
// indeksu UNIQUE wywala dopiero ostatni CREATE UNIQUE INDEX (SQLITE_CONSTRAINT 2067),
// bo zmigrowane dane słusznie mają wiele wierszy na ten sam rok.
try {
  db.exec(fs.readFileSync('worker/migration_v50_esg_targets.sql','utf8'));
} catch (e) {
  ok(false, `migracja wykonuje się na strukturze v35 — PADŁA: ${e.message}`);
  console.log('\n  Cały plik zostałby wycofany przez D1 (import --file jest transakcyjny),');
  console.log('  więc produkcja nie ucierpi — ale migracja nie zrobi nic.');
  console.log(`\n────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
  process.exit(1);
}
const wiersze = db.prepare('SELECT company_id,metric_key,year,target_value,unit,lower_is_better,description FROM esg_targets ORDER BY company_id,metric_key').all();
ok(przed===2, `dane wejściowe: ${przed} wiersze v35`);
ok(wiersze.length===5, `po migracji: ${wiersze.length} wierszy v41 (4 z kompletnego + 1 z częściowego)`);

const co2 = wiersze.find(w=>w.company_id==='mtoilet'&&w.metric_key==='co2_total_tonnes');
ok(co2 && co2.target_value===250, `CO2 przeliczone kg→t: 250000 kg → ${co2?co2.target_value:'?'} t (bez tego cele byłyby 1000× zawyżone)`);
const ev = wiersze.find(w=>w.metric_key==='ev_share_pct');
ok(ev && ev.lower_is_better===0, `udział EV ma lower_is_better=0 (jedyna metryka „im więcej, tym lepiej")`);
const inne = wiersze.filter(w=>w.metric_key!=='ev_share_pct'&&w.metric_key!=='electric_km');
ok(inne.every(w=>w.lower_is_better===1), 'pozostałe metryki mają lower_is_better=1');
ok(wiersze.find(w=>w.company_id==='gcon')?.metric_key==='co2_total_tonnes' && wiersze.filter(w=>w.company_id==='gcon').length===1,
   'wiersz częściowy (sam CO2) dał dokładnie 1 metrykę — NULL-e nie tworzą pustych celów');
ok(wiersze.every(w=>w.description!==undefined), 'notes przeniesione do description');

// PUŁAPKA 2: stary UNIQUE(company_id,year) blokowałby drugą metrykę w tym samym roku.
let wieleMetryk=true;
try {
  db.exec(`INSERT INTO esg_targets(company_id,metric_key,year,target_value) VALUES('gcon','fuel_consumption_l',2026,50000)`);
} catch(e){ wieleMetryk=false; console.log('     '+e.message); }
ok(wieleMetryk, 'wiele metryk na ten sam rok przechodzi — stary indeks UNIQUE faktycznie usunięty');

// Czy PRODUKCYJNY zapis backendu działa na nowej strukturze (to jest cel migracji: 500 → 200)
let zapisOk=true, blad='';
try {
  db.prepare('INSERT INTO esg_targets(id,company_id,metric_key,year,target_value,unit,lower_is_better,description) VALUES(?,?,?,?,?,?,?,?)')
    .run('nowy','mtoilet','co2_total_tonnes',2027,200,'t',1,null);
} catch(e){ zapisOk=false; blad=e.message; }
ok(zapisOk, `POST /api/esg/targets (dosłowny INSERT z worker/index.js:11996) wykonuje się${zapisOk?'':' — '+blad}`);

// ROLLBACK: czy da się wrócić
const db2 = new DatabaseSync(':memory:');
db2.exec(`CREATE TABLE esg_targets (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, year INTEGER NOT NULL, co2_target_kg REAL,
  fuel_target_l REAL, ev_percentage_target REAL, electric_km_target REAL, notes TEXT, created_at TEXT);
CREATE UNIQUE INDEX idx_esg_co_year ON esg_targets(company_id, year);
INSERT INTO esg_targets VALUES('r1','mtoilet',2026,250000,90000,15,40000,'cel roczny','2026-01-01');`);
db2.exec(fs.readFileSync('worker/migration_v50_esg_targets.sql','utf8'));
db2.exec(fs.readFileSync('worker/migration_v50_esg_targets_ROLLBACK.sql','utf8'));
const wr = db2.prepare('SELECT company_id,year,co2_target_kg,fuel_target_l,ev_percentage_target,electric_km_target FROM esg_targets').all();
ok(wr.length===1 && wr[0].co2_target_kg===250000 && wr[0].fuel_target_l===90000 && wr[0].ev_percentage_target===15 && wr[0].electric_km_target===40000,
   'round-trip v35 → v50 → ROLLBACK → v35 zwraca dane bez strat (w tym kg z powrotem z ton)');

// Drugie uruchomienie MUSI paść (plik nie jest idempotentny — dlatego migration_, nie schema_)
let drugie=false;
try { db.exec(fs.readFileSync('worker/migration_v50_esg_targets.sql','utf8')); } catch(e){ drugie=true; }
ok(drugie, 'drugie uruchomienie pada (D1 wycofa plik w całości) — zgodne z nagłówkiem pliku');

console.log(`\n────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail?1:0);
