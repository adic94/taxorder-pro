#!/usr/bin/env node
/**
 * Import CSV paliwowego: kwota BRUTTO, nie netto — i to samo we WSZYSTKICH trzech parserach.
 *
 * DLACZEGO. `worker/index.js` ma TRZY parsery CSV paliwowego, bo powstawały osobno:
 *   `_parseFuelCsv`           — import z podglądem (POST /api/fuel-import)
 *   `parseFuelCsv`            — import kart paliwowych (POST /api/fuel-card-import)
 *   `_parseFuelCsvScheduled`  — automatyczny import z harmonogramu
 * Raport ORLEN ma OBIE kolumny kwoty: „Wartość netto" i „Wartość brutto". Zmierzone przed
 * naprawą, na tym samym realistycznym nagłówku:
 *
 *   _parseFuelCsv           brał OSTATNIĄ pasującą kolumnę  → netto, gdy brutto stało wcześniej
 *   parseFuelCsv            brał PIERWSZĄ pasującą          → netto, gdy netto stało wcześniej
 *   _parseFuelCsvScheduled  porównywał nagłówki DOKŁADNIE   → „wartość brutto" nie trafiało
 *                                                             nigdzie, kwota zawsze null
 *
 * Żaden nie odróżniał brutto od netto ZNACZENIEM — dwa zgadywały po kolejności kolumn.
 * Różnica to stawka VAT (250,00 zamiast 307,50), a kwota idzie wprost do raportów ESG
 * i eksportu JPK. To ta sama klasa co „ciche zera": wynik wygląda wiarygodnie i jest zły.
 *
 * Bramka sprawdza WSZYSTKIE TRZY na tej samej tablicy przypadków — dopóki istnieją trzy
 * kopie, to jedyna rzecz, która nie pozwoli im się znowu rozjechać.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, h) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (h) console.log(`      ${h}`); };

console.log('\nImport CSV paliwowego — kwota brutto we wszystkich parserach\n');

// Funkcje wycinamy z pliku PRODUKCYJNEGO, nie trzymamy kopii — kopia rozjechałaby się
// z oryginałem i ukryła dokładnie ten błąd, który ma wykrywać.
function wytnij(nazwa) {
  const m = src.match(new RegExp('function ' + nazwa + '\\([\\s\\S]*?\\n\\}'));
  if (!m) { bad(`nie znaleziono ${nazwa} w worker/index.js`); return null; }
  return m[0];
}
const HELPER = wytnij('_fuelAmountColumn');
if (!HELPER) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }
ok('wspólny `_fuelAmountColumn` istnieje — trzy parsery nie wybierają kolumny osobno');

// `_parseFuelCsvScheduled` woła `_mapFuelType`; podstawiamy zaślepkę, bo mapowanie
// rodzaju paliwa nie jest przedmiotem tej bramki.
const ZASLEPKA = 'function _mapFuelType(x){ return x; }';
function zbuduj(nazwa) {
  const kod = wytnij(nazwa);
  if (!kod) return null;
  // eslint-disable-next-line no-new-func
  return new Function(`${ZASLEPKA}\n${HELPER}\n${kod}\nreturn ${nazwa};`)();
}

const NAGLOWEK = 'Data transakcji;Nr rejestracyjny;Ilość;';
const WIERSZ   = '15.03.2026;WA1234A;50,25;';
const PRZYPADKI = [
  ['netto przed brutto', `${NAGLOWEK}Wartość netto;Wartość brutto;Stacja\n${WIERSZ}250,00;307,50;Warszawa`, 307.5],
  ['brutto przed netto', `${NAGLOWEK}Wartość brutto;Wartość netto;Stacja\n${WIERSZ}307,50;250,00;Warszawa`, 307.5],
  ['tylko brutto',       `${NAGLOWEK}Wartość brutto;Stacja\n${WIERSZ}307,50;Warszawa`,                      307.5],
  ['tylko kwota ogólna', `${NAGLOWEK}Kwota;Stacja\n${WIERSZ}307,50;Warszawa`,                               307.5],
];

const PARSERY = [
  ['_parseFuelCsv',          c => zbuduj('_parseFuelCsv')(c),            r => r.totalGross],
  ['parseFuelCsv',           c => zbuduj('parseFuelCsv')(c, ';', null),  r => r.cost_pln],
  ['_parseFuelCsvScheduled', c => zbuduj('_parseFuelCsvScheduled')(c, 'orlen'), r => r.total_cost],
];

for (const [nazwa, uruchom, pole] of PARSERY) {
  for (const [opis, csv, oczekiwane] of PRZYPADKI) {
    let kwota;
    try {
      const wynik = uruchom(csv);
      const rec = Array.isArray(wynik) ? wynik[0] : wynik;
      kwota = rec ? pole(rec) : null;
    } catch (e) { kwota = `błąd: ${e.message}`; }
    if (typeof kwota === 'number' && Math.abs(kwota - oczekiwane) < 0.01)
      ok(`${nazwa} · ${opis} → ${kwota} zł`);
    else
      bad(`${nazwa} · ${opis} → ${kwota}, oczekiwano ${oczekiwane}`,
        'Kwota netto zamiast brutto zaniża koszt paliwa o stawkę VAT — cicho, bo obie liczby wyglądają wiarygodnie.');
  }
}

// Sam wybór kolumny — przypadek graniczny, w którym NIE MA nic poza netto.
// Wtedy bierzemy netto (lepsze niż nic), ale sygnalizujemy rodzaj, żeby warstwa
// wyżej mogła to pokazać, zamiast udawać, że wszystko się zgadza.
{
  // eslint-disable-next-line no-new-func
  const wybierz = new Function(`${HELPER}\nreturn _fuelAmountColumn;`)();
  const w1 = wybierz(['Data', 'Nr rejestracyjny', 'Ilość', 'Wartość netto']);
  if (w1.rodzaj === 'netto' && w1.idx === 3) ok('gdy istnieje WYŁĄCZNIE netto — kolumna brana, ale oznaczona jako netto');
  else bad(`sam netto obsłużony niepoprawnie: ${JSON.stringify(w1)}`);

  const w2 = wybierz(['Data', 'Nr rejestracyjny', 'Ilość']);
  if (w2.idx === -1 && w2.rodzaj === null) ok('brak jakiejkolwiek kolumny kwoty → idx -1, bez zgadywania');
  else bad(`brak kolumny kwoty obsłużony niepoprawnie: ${JSON.stringify(w2)}`);

  const w3 = wybierz(['Data', 'Wartość netto', 'Wartość brutto']);
  if (w3.rodzaj === 'brutto' && w3.idx === 2) ok('brutto wygrywa z netto niezależnie od kolejności kolumn');
  else bad(`wybór brutto niepoprawny: ${JSON.stringify(w3)}`);
}

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
