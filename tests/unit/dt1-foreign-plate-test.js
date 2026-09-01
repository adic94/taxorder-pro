#!/usr/bin/env node
/**
 * Pojazd zarejestrowany poza Polską nie podlega DT-1.
 *
 * PO CO. Ustawa o podatkach i opłatach lokalnych dotyczy pojazdów zarejestrowanych
 * w Polsce — ustalone z właścicielem 01.09.2026, dotyczy m.in. floty litewskiej
 * (patrz CLAUDE.md, „6 pojazdów litewskich"). Pole `krajRejestracji` istniało już
 * w karcie pojazdu (`modules/vehicle-detail.js`), ale `TaxEngine` nigdy go nie
 * czytał — wpisanie „Litwa" nie miało żadnego wpływu na naliczenie.
 *
 * PUŁAPKA, KTÓREJ TA BRAMKA PILNUJE: pole jest wolnym tekstem i w zdecydowanej
 * większości floty PUSTE (nikt go nie wypełniał, bo nic go nie czytało). Naiwna
 * interpretacja „puste = nie wiadomo → nie opodatkuj" zwolniłaby z dnia na dzień
 * całą krajową flotę. Puste pole MUSI oznaczać Polskę (opodatkowany).
 *
 * Ładuje PRODUKCYJNY `modules/tax-engine.js` przez window-shim — ten sam wzorzec
 * co `tools/dr-excel.js` i `tests/unit/dmc-podstawa-test.js` — żeby bramka
 * mierzyła kod produkcyjny, nie kopię.
 *
 * Uruchom: node tests/unit/dt1-foreign-plate-test.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TAX_ENGINE = path.join(ROOT, 'modules', 'tax-engine.js');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

function zaladuj() {
  const shim = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function('window', fs.readFileSync(TAX_ENGINE, 'utf8'))(shim.window);
  return shim.window.TaxEngine;
}

console.log('\nDT-1: pojazd zarejestrowany poza Polską nie jest opodatkowany\n');

const TaxEngine = zaladuj();

// Bazowy pojazd, który BEZ tej reguły dostałby kategorię D2 (dT=6, 5.5<dT<=9)
const bazowy = { dmc: 6000, typ: 'ciężarowy', osie: 2, rok: 2022 };

// [1] Puste pole krajRejestracji → nadal opodatkowany (regresja dla całej krajowej floty)
{
  const cat = TaxEngine.getCat({ ...bazowy });
  if (cat === 'D2') ok(true, 'brak krajRejestracji → opodatkowany jak dotychczas (D2)');
  else ok(false, `brak krajRejestracji dał kategorię ${cat} zamiast D2 — zmiana zwolniłaby całą krajową flotę`);
}

// [2] Jawnie "Polska" / warianty zapisu → nadal opodatkowany
{
  const warianty = ['Polska', 'polska', 'PL', 'pl', 'Poland', '  Polska  '];
  const zle = warianty.filter(w => TaxEngine.getCat({ ...bazowy, krajRejestracji: w }) !== 'D2');
  if (!zle.length) ok(true, `warianty zapisu "Polska" (${warianty.length}) nadal opodatkowane`);
  else ok(false, `te warianty "Polska" NIE dały D2: ${zle.join(', ')}`);
}

// [3] Kraj inny niż Polska → zwolniony (getCat i getRate zwracają null)
{
  const kraje = ['Litwa', 'litwa', 'Niemcy', 'LT', 'Germany'];
  const zle = kraje.filter(k => TaxEngine.getCat({ ...bazowy, krajRejestracji: k }) !== null);
  if (!zle.length) ok(true, `pojazdy z zagraniczną rejestracją (${kraje.length} wariantów) zwolnione z DT-1 (getCat → null)`);
  else ok(false, `te kraje NIE zwolniły pojazdu: ${zle.join(', ')}`);

  const rate = TaxEngine.getRate({ ...bazowy, krajRejestracji: 'Litwa' });
  if (rate === null) ok(true, 'getRate() też zwraca null dla pojazdu zagranicznego (spójne z getCat)');
  else ok(false, `getRate() dla pojazdu zagranicznego zwrócił ${rate} zamiast null`);
}

// [4] calcTax() dla pojazdu zagranicznego daje kwotę 0, nie wyjątek
{
  const wynik = TaxEngine.calcTax({ ...bazowy, krajRejestracji: 'Litwa' });
  if (wynik.cat === null && wynik.amount === 0) ok(true, 'calcTax() dla pojazdu zagranicznego: cat=null, amount=0');
  else ok(false, `calcTax() dał nieoczekiwany wynik: ${JSON.stringify(wynik)}`);
}

// [5] Reguła nie nadpisuje istniejącego zwolnienia "pojazd specjalny" ani na odwrót —
//     obie działają niezależnie na tym samym pojeździe.
{
  const specjalnyZagraniczny = TaxEngine.getCat({ ...bazowy, typ: 'specjalny', krajRejestracji: 'Litwa' });
  const specjalnyKrajowy = TaxEngine.getCat({ ...bazowy, typ: 'specjalny' });
  if (specjalnyZagraniczny === null && specjalnyKrajowy === null)
    ok(true, 'zwolnienie "specjalny" i zwolnienie "zagraniczny" nie kolidują ze sobą');
  else ok(false, `kolizja zwolnień: zagraniczny+specjalny=${specjalnyZagraniczny}, krajowy specjalny=${specjalnyKrajowy}`);
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
