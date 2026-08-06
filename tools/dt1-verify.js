'use strict';
/**
 * DT-1 verifier — porównuje DMC/DMC-zespołu z dowodów rejestracyjnych (Aztec)
 * z wartościami zapisanymi w bazie D1 (tabela vehicles).
 *
 * ⚠  UWAGA: wyniki dotyczą danych podatkowych (~100 pojazdów, prod. D1).
 *    Domyślny tryb DRY-RUN: raport i SQL trafiają na stdout, żadnych plików.
 *    Zapis plików + SQL wyłącznie po fladze --execute.
 *
 * Wymaga: node >= 18
 * Narzędzie lokalne — nie uruchamiać na CI.
 *
 * Użycie:
 *   node tools/dt1-verify.js <checkpoint.ndjson> <d1-vehicles.json> [--execute]
 *
 *   checkpoint.ndjson — plik z dr-extractor (dr-extractor-checkpoint.ndjson)
 *   d1-vehicles.json  — eksport tabeli vehicles z D1; pobierz przez:
 *                         wrangler d1 execute taxorder-pro --remote \
 *                           --command "SELECT id,company_id,nr_rej,vin,marka,model,dmc,dmcZespolu FROM vehicles" \
 *                           --json > d1-vehicles.json
 *   --execute         — zapisuje pliki wynikowe do katalogu bieżącego;
 *                       SQL generowany jest tylko do ręcznego wykonania przez wrangler d1
 *
 * Generowane pliki (tylko z --execute):
 *   dt1-rozbieznosci-C.txt / .json  — rozbieżności DMC do weryfikacji
 *   dt1-brakujace-B.json            — brakujące DMC w D1
 *   dt1-backup-przed-update-B.json  — stan przed UPDATE (do rollbacku)
 *   dt1-update-B.sql                — SQL UPDATE grupy B (WYKONAĆ PRZEZ WRANGLER)
 */
const fs = require('fs');
const path = require('path');

const rawArgs = process.argv.slice(2);
const DRY_RUN = !rawArgs.includes('--execute');
const posArgs = rawArgs.filter(a => !a.startsWith('--'));

const CKPT   = posArgs[0];
const D1_ARG = posArgs[1];

if (!CKPT) {
  console.error('BŁĄD: Podaj ścieżkę do checkpointu jako pierwszy argument.');
  console.error('Użycie: node tools/dt1-verify.js <checkpoint.ndjson> <d1-vehicles.json> [--execute]');
  process.exit(1);
}
if (!fs.existsSync(CKPT)) {
  console.error(`BŁĄD: Checkpoint nie istnieje: ${CKPT}`);
  process.exit(1);
}
if (DRY_RUN) {
  console.log('⚠  DRY-RUN — raport i SQL na stdout, żadnych plików nie zapisuję.');
  console.log('   Użyj --execute aby zapisać pliki wynikowe.\n');
}

// ─── Progi podatkowe DT-1 (pojazdy ciężarowe) ────────────────────────────────
// Zwraca kategorię podatkową na podstawie DMC pojazdu
function dt1Category(dmc) {
  if (!dmc || dmc <= 0)     return null;    // brak DMC — nie obliczamy
  if (dmc <= 3500)          return null;    // motocykle, osobowe — poza DT-1
  if (dmc <= 5500)          return 'N2-A';  // 3,5–5,5 t
  if (dmc <= 9000)          return 'N2-B';  // 5,5–9 t
  if (dmc <= 12000)         return 'N2-C';  // 9–12 t
  return 'N3';                              // powyżej 12 t
}

// ─── Normalizacja nr_rej ──────────────────────────────────────────────────────
function normRej(s) {
  if (!s) return '';
  return s.toString().toUpperCase().replace(/\s+/g,'').replace(/-/g,'');
}

// ─── Wczytaj checkpoint ───────────────────────────────────────────────────────
const lines = fs.readFileSync(CKPT, 'utf8').split('\n');
const cpMap = new Map(); // VIN → best entry
const cpNrRej = new Map(); // normRej → best entry

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const e = JSON.parse(line);
    if (e.status !== 'ok') continue;
    const f = e.fields || {};
    const vin = (f.vin || '').trim().toUpperCase();
    const nr  = normRej(f.nrRej);
    const dmcKg = parseFloat(f.dmcKg) || 0;
    const dmcZ  = parseFloat(f.dmcZespolu) || 0;
    // Data rejestracji jako znacznik "świeżości"
    const dataRej = f.dataRej || '01.01.1900';

    const entry = { vin, nr, dmcKg, dmcZ, dataRej, path: e.path, format: f._format };

    // Zachowaj najnowszy dowód — porównaj daty
    function updateIfNewer(map, key, entry) {
      if (!key) return;
      const prev = map.get(key);
      if (!prev || compareDates(entry.dataRej, prev.dataRej) > 0) {
        map.set(key, entry);
      }
    }
    if (vin && vin.length >= 5) updateIfNewer(cpMap, vin, entry);
    if (nr)                     updateIfNewer(cpNrRej, nr, entry);
  } catch {}
}

function compareDates(a, b) {
  // DD.MM.YYYY → sortowalna data
  const parse = (s) => {
    const p = (s || '').split('.');
    if (p.length !== 3) return '1900-01-01';
    return `${p[2]}-${p[1]}-${p[0]}`;
  };
  return parse(a) < parse(b) ? -1 : parse(a) > parse(b) ? 1 : 0;
}

console.log(`Checkpoint — wpisy OK unikalne: VIN=${cpMap.size}, nrRej=${cpNrRej.size}`);

// ─── D1 vehicles (wczytane z pliku JSON) ─────────────────────────────────────
const D1_FILE = D1_ARG || path.join(path.dirname(CKPT), 'dt1-verify-d1.json');
if (!fs.existsSync(D1_FILE)) {
  console.error(`BŁĄD: Brak pliku danych D1: ${D1_FILE}`);
  console.error('Pobierz przez:');
  console.error('  wrangler d1 execute taxorder-pro --remote \\');
  console.error('    --command "SELECT id,company_id,nr_rej,vin,marka,model,dmc,dmcZespolu FROM vehicles" \\');
  console.error('    --json > d1-vehicles.json');
  process.exit(1);
}
const vehicles = JSON.parse(fs.readFileSync(D1_FILE, 'utf8'));
console.log(`D1 — pojazdów: ${vehicles.length}\n`);

// ─── Dopasowanie ─────────────────────────────────────────────────────────────
let matchVin = 0, matchNr = 0, noMatch = 0;
const groupA = [], groupB = [], groupC = [], unmatched = [];

for (const v of vehicles) {
  const vinD1 = (v.vin || '').trim().toUpperCase();
  const nrD1  = normRej(v.nr_rej);

  let dr = null;
  let matchMethod = null;

  if (vinD1 && vinD1.length >= 5) {
    dr = cpMap.get(vinD1);
    if (dr) matchMethod = 'vin';
  }
  if (!dr && nrD1) {
    dr = cpNrRej.get(nrD1);
    if (dr) matchMethod = 'nr_rej';
  }

  if (!dr) {
    noMatch++;
    unmatched.push({ id: v.id, company_id: v.company_id, nr_rej: v.nr_rej, vin: v.vin, marka: v.marka });
    continue;
  }

  if (matchMethod === 'vin') matchVin++;
  else matchNr++;

  // Porównaj DMC
  const dmcD1 = Number(v.dmc) || 0;
  const dmcDr = dr.dmcKg;
  const dmcZd1 = Number(v.dmcZespolu) || 0;
  const dmcZdr = dr.dmcZ;

  // Czy mamy sensowne wartości z DR?
  const drHasDmc  = dmcDr > 0;
  const drHasDmcZ = dmcZdr > 0;

  const dmcMissing  = drHasDmc  && dmcD1  === 0;
  const dmcZMissing = drHasDmcZ && dmcZd1 === 0;
  const dmcDiffer   = drHasDmc  && dmcD1  > 0 && dmcD1  !== dmcDr;
  const dmcZDiffer  = drHasDmcZ && dmcZd1 > 0 && dmcZd1 !== dmcZdr;

  const row = {
    id: v.id, company_id: v.company_id, nr_rej: v.nr_rej, vin: v.vin,
    marka: v.marka, model: v.model,
    dmc_d1: dmcD1, dmc_dr: dmcDr, dmcZ_d1: dmcZd1, dmcZ_dr: dmcZdr,
    dmc_diff: drHasDmc ? dmcD1 - dmcDr : null,
    dmcZ_diff: drHasDmcZ ? dmcZd1 - dmcZdr : null,
    cat_d1: dt1Category(dmcD1), cat_dr: dt1Category(dmcDr),
    matchMethod, dr_path: dr.path
  };

  if (dmcMissing || dmcZMissing) {
    groupB.push({ ...row, missing: { dmc: dmcMissing, dmcZ: dmcZMissing } });
  } else if (dmcDiffer || dmcZDiffer) {
    groupC.push({ ...row, differ: { dmc: dmcDiffer, dmcZ: dmcZDiffer } });
  } else {
    groupA.push(row);
  }
}

// ─── WPŁYW NA PODATEK ─────────────────────────────────────────────────────────
// Ile pojazdów z B i C zmienia kategorię po korekcie DMC?
function taxImpact(rows) {
  return rows.filter(r => r.cat_d1 !== r.cat_dr && r.cat_dr !== null).length;
}

const taxImpactB = taxImpact(groupB);
const taxImpactC = taxImpact(groupC);

// Rozkład różnic DMC w grupie C
const diffBuckets = { lt100: 0, b100_500: 0, gt500: 0 };
for (const r of groupC) {
  if (r.dmc_diff === null) continue;
  const abs = Math.abs(r.dmc_diff);
  if (abs < 100) diffBuckets.lt100++;
  else if (abs <= 500) diffBuckets.b100_500++;
  else diffBuckets.gt500++;
}

// ─── RAPORT ───────────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════');
console.log('  WERYFIKACJA DT-1 — DOPASOWANIE');
console.log('══════════════════════════════════════════════');
console.log(`  Dopasowano po VIN:    ${matchVin}`);
console.log(`  Dopasowano po nr_rej: ${matchNr}`);
console.log(`  Bez dopasowania:      ${noMatch}`);
console.log(`  Łącznie przebadanych: ${matchVin + matchNr}`);
console.log('');
console.log('══════════════════════════════════════════════');
console.log('  GRUPY');
console.log('══════════════════════════════════════════════');
console.log(`  A — ZGODNE:              ${groupA.length}`);
console.log(`  B — BRAKUJĄCE w D1:      ${groupB.length}`);
console.log(`  C — ROZBIEŻNE:           ${groupC.length}`);
console.log('');
console.log('══════════════════════════════════════════════');
console.log('  WPŁYW NA PODATEK DT-1');
console.log('══════════════════════════════════════════════');
console.log(`  Zmiana kategorii z grupy B:  ${taxImpactB}`);
console.log(`  Zmiana kategorii z grupy C:  ${taxImpactC}`);
console.log(`  ŁĄCZNIE ryzyko zmiany stawki: ${taxImpactB + taxImpactC}`);
console.log('');
console.log('  Rozkład |DMC_D1 - DMC_DR| w grupie C:');
console.log(`    < 100 kg (prawdop. zabudowa/błąd drobny): ${diffBuckets.lt100}`);
console.log(`    100–500 kg:                               ${diffBuckets.b100_500}`);
console.log(`    > 500 kg (błąd wpisu lub inna wersja):   ${diffBuckets.gt500}`);
console.log('');
console.log('  Pojazdy bez dopasowania:');
for (const u of unmatched) {
  console.log(`    ${u.nr_rej.padEnd(12)} ${(u.vin||'(brak VIN)').padEnd(20)} ${u.marka||''}`);
}

// ─── GENERUJ SQL UPDATE dla grupy B ──────────────────────────────────────────
let sql = `-- UPDATE grupy B: uzupełnienie brakujących DMC z dowodów rejestracyjnych\n`;
sql += `-- Wygenerowano: ${new Date().toISOString()}\n`;
sql += `-- PRZED wykonaniem: wrangler d1 time-travel info taxorder-pro\n\n`;
for (const r of groupB) {
  const sets = [];
  if (r.missing?.dmc)  sets.push(`json_set(data, '$.dmc', ${r.dmc_dr})`);
  if (r.missing?.dmcZ) sets.push(`json_set(data, '$.dmcZespolu', ${r.dmcZ_dr})`);
  if (!sets.length) continue;
  const jsonExpr = sets.length === 1
    ? sets[0]
    : `json_set(json_set(data, '$.dmc', ${r.dmc_dr}), '$.dmcZespolu', ${r.dmcZ_dr})`;
  sql += `UPDATE vehicles SET data = ${jsonExpr}, updated_at = datetime('now') WHERE id = ${r.id};\n`;
}

if (DRY_RUN) {
  console.log('\n══════════════════════════════════════════════');
  console.log('  SQL UPDATE grupy B (DRY-RUN — nie wykonano)');
  console.log('══════════════════════════════════════════════');
  console.log(sql);
  console.log('Aby zapisać pliki wynikowe, uruchom z flagą --execute.');
} else {
  const OUT_DIR = process.cwd();

  // ─── Zapisz grupę C ───────────────────────────────────────────────────────
  const outC    = path.join(OUT_DIR, 'dt1-rozbieznosci-C.json');
  const outCTxt = path.join(OUT_DIR, 'dt1-rozbieznosci-C.txt');
  fs.writeFileSync(outC, JSON.stringify(groupC, null, 2), 'utf8');

  let txtC = 'GRUPA C — ROZBIEŻNOŚCI DMC (D1 vs dowód rejestracyjny)\n';
  txtC += `Wygenerowano: ${new Date().toISOString().slice(0,10)}\n`;
  txtC += 'Do ręcznej weryfikacji z księgowością.\n\n';
  txtC += `${'nr_rej'.padEnd(14)}${'VIN'.padEnd(20)}${'marka'.padEnd(14)}${'DMC D1'.padEnd(9)}${'DMC DR'.padEnd(9)}${'diff'.padEnd(9)}${'KAT D1'.padEnd(8)}${'KAT DR'.padEnd(8)}${'DMCZ D1'.padEnd(9)}${'DMCZ DR'.padEnd(9)}TAX?\n`;
  txtC += '-'.repeat(110) + '\n';
  for (const r of groupC) {
    const taxChange = r.cat_d1 !== r.cat_dr && r.cat_dr !== null ? ' <-- ZMIANA STAWKI' : '';
    txtC += `${(r.nr_rej||'').padEnd(14)}${(r.vin||'').padEnd(20)}${(r.marka||'').padEnd(14)}${String(r.dmc_d1).padEnd(9)}${String(r.dmc_dr).padEnd(9)}${String(r.dmc_diff??'').padEnd(9)}${String(r.cat_d1||'-').padEnd(8)}${String(r.cat_dr||'-').padEnd(8)}${String(r.dmcZ_d1).padEnd(9)}${String(r.dmcZ_dr).padEnd(9)}${taxChange}\n`;
  }
  fs.writeFileSync(outCTxt, txtC, 'utf8');

  // ─── Zapisz grupę B ───────────────────────────────────────────────────────
  const outBJson = path.join(OUT_DIR, 'dt1-brakujace-B.json');
  fs.writeFileSync(outBJson, JSON.stringify(groupB, null, 2), 'utf8');

  // ─── Backup stanu przed UPDATE ────────────────────────────────────────────
  const outBBackup = path.join(OUT_DIR, 'dt1-backup-przed-update-B.json');
  const backupRows = groupB.map(r => ({
    id: r.id, company_id: r.company_id, nr_rej: r.nr_rej, vin: r.vin,
    dmc_przed: r.dmc_d1, dmcZespolu_przed: r.dmcZ_d1,
    dmc_po: r.missing?.dmc ? r.dmc_dr : r.dmc_d1,
    dmcZespolu_po: r.missing?.dmcZ ? r.dmcZ_dr : r.dmcZ_d1,
  }));
  fs.writeFileSync(outBBackup, JSON.stringify(backupRows, null, 2), 'utf8');

  // ─── Zapisz SQL ───────────────────────────────────────────────────────────
  const outSQL = path.join(OUT_DIR, 'dt1-update-B.sql');
  fs.writeFileSync(outSQL, sql, 'utf8');

  console.log(`\nZapisano:`);
  console.log(`  Rozbieżności C: ${outCTxt}`);
  console.log(`  Brakujące B JSON: ${outBJson}`);
  console.log(`  Rozbieżności C JSON: ${outC}`);
  console.log(`  Backup B przed UPDATE: ${outBBackup}`);
  console.log(`  SQL UPDATE: ${outSQL}`);
}
