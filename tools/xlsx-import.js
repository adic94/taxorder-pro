#!/usr/bin/env node
/**
 * Wczytuje istniejący arkusz (np. „Zestawienie pojazdów") i normalizuje go do pól DR.
 *
 *     node tools/xlsx-import.js --pokaz "Zestawienie.xlsx"           # co jest w pliku
 *     node tools/xlsx-import.js "Zestawienie.xlsx" --wyjscie dane.json
 *
 * DWA KROKI, BO NIE ZNAM WASZYCH NAGŁÓWKÓW. `--pokaz` wypisuje arkusze, kolumny
 * i PROPONOWANE dopasowanie do katalogu `modules/dr-fields.js`. Dopiero po obejrzeniu
 * propozycji uruchamiasz normalizację. Zgadywanie mapowania bez pokazania go człowiekowi
 * dałoby plik, w którym „masa własna" trafiła do kolumny DMC — a taki błąd wygląda
 * wiarygodnie i przechodzi dalej niezauważony.
 *
 * Dopasowanie jest ZACHOWAWCZE: przy niejednoznaczności woli nie dopasować niż zgadnąć.
 * Kolumnę można wskazać ręcznie plikiem mapy (`--mapa mapa.json`, `{"Nagłówek":"klucz"}`).
 *
 * ŹRÓDŁO. Rekordy dostają `_zrodlo: 'zestawienie'` — dane prowadzone ręcznie przez
 * człowieka. To NIE jest to samo co odczyt z kodu Aztec ani wpis w rejestrze państwowym:
 * bywa aktualniejsze niż stary dowód, ale bywa też przepisane z błędem. `dr-excel.js`
 * pokaże konflikty między źródłami zamiast po cichu wybrać jedno.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const DR = require(path.join(__dirname, '..', 'modules', 'dr-fields.js'));

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const args = process.argv.slice(2);
const POKAZ = args.includes('--pokaz');
const idx = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const plik = args.find(a => !a.startsWith('--') && /\.xlsx?$/i.test(a));
const wyjscie = idx('--wyjscie');
const plikMapy = idx('--mapa');
const nrArkusza = Number(idx('--arkusz') || 0);

if (!plik || !fs.existsSync(plik)) {
  console.error('\nUżycie:');
  console.error('  node tools/xlsx-import.js --pokaz "Zestawienie.xlsx"');
  console.error('  node tools/xlsx-import.js "Zestawienie.xlsx" --wyjscie dane.json [--arkusz 1] [--mapa mapa.json]\n');
  process.exit(2);
}

/**
 * Warianty nagłówków spotykane w arkuszach prowadzonych ręcznie. Klucz to pole z katalogu,
 * wartości to fragmenty, których szukamy w nagłówku po normalizacji (małe litery, bez
 * spacji, kropek i polskich znaków).
 *
 * ⚠️ KOLEJNOŚĆ MA ZNACZENIE dla mas. „masacalkowita" pasuje i do DMC, i do „dopuszczalna
 * masa całkowita zespołu" — dlatego warianty bardziej szczegółowe (zespol) sprawdzamy
 * wcześniej i wykluczamy je z ogólnych.
 */
const WARIANTY = {
  nrRej:        ['nrrej', 'numerrejestracyjny', 'rejestracja', 'nrrejestracyjny', 'tablica'],
  // „Nr podwozia" TO JEST VIN. Wzór dowodu nazywa pole E „numer VIN / nr nadwozia,
  // podwozia lub ramy" i arkusze flotowe używają każdego z tych określeń zamiennie.
  // Pominięcie tego wariantu kosztowało w realnym arkuszu 817 numerów VIN.
  vin:          ['vin', 'nrvin', 'numervin', 'nadwozie', 'nrnadwozia', 'podwozie', 'nrpodwozia', 'rama', 'nrramy'],
  wlasciciel:   ['wlasciciel', 'wlascicielpojazdu'],
  marka:        ['marka'],
  model:        ['model'],
  typ:          ['typ', 'wariant'],
  dataRej:      ['datapierwszejrejestracji', 'data1rejestracji', 'pierwszarejestracja', 'datarejestracji'],
  rokProd:      ['rokprodukcji', 'rokprod', 'rocznik'],
  dmcZespolu:   ['dmczespolu', 'masacalkowitazespolu', 'f3'],
  dmcKg:        ['dmc', 'maksymalnamasacalkowita', 'dopuszczalnamasacalkowita', 'masacalkowita', 'f1'],
  masaWlKg:     ['masawlasna', 'masapojazdu', 'tara'],
  liczbaOsi:    ['liczbaosi', 'osie', 'ilosc osi'.replace(/\s/g, ''), 'losi'],
  zawieszenie:  ['zawieszenie', 'rodzajzawieszenia', 'pneumatyczne'],
  kategoria:    ['kategoria', 'kategoriapojazdu'],
  przeznaczenie:['rodzajpojazdu', 'przeznaczenie', 'rodzaj'],
  paliwo:       ['paliwo', 'rodzajpaliwa'],
  pojSilnika:   ['pojemnosc', 'pojemnoscsilnika'],
  mocKW:        ['mockw', 'moc'],
  miejscaSied:  ['miejscasiedzace', 'liczbamiejsc', 'miejsca'],
  normaEuro:    ['euro', 'normaemisji', 'normaeuro'],
  nextInspection:['badanietechniczne', 'nastepnebadanie', 'przegladdo', 'terminbadania', 'przeglad'],
  nrHomolog:    ['homologacja', 'swiadectwohomologacji'],
  seriaDr:      ['seriadowodu', 'nrdowodu', 'numerdowodu'],
};

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/[ąàáâ]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęèéê]/g, 'e')
  .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óòô]/g, 'o')
  .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z')
  .replace(/[^a-z0-9]/g, '');

function dopasuj(naglowek) {
  const n = norm(naglowek);
  if (!n) return null;
  // Kod urzędowy w nagłówku („F.1", „L") jest najpewniejszą wskazówką — sprawdzamy pierwszy.
  const poKodzie = DR.POLA.find(p => p.kod !== '—' && norm(p.kod) === n);
  if (poKodzie) return { klucz: poKodzie.klucz, pewnosc: 'kod' };
  const poNazwie = DR.POLA.find(p => norm(p.nazwa) === n);
  if (poNazwie) return { klucz: poNazwie.klucz, pewnosc: 'nazwa' };
  for (const [klucz, war] of Object.entries(WARIANTY)) {
    if (war.some(w => n === w)) return { klucz, pewnosc: 'wariant' };
  }
  for (const [klucz, war] of Object.entries(WARIANTY)) {
    if (war.some(w => n.includes(w))) return { klucz, pewnosc: 'fragment' };
  }
  return null;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(plik);

  if (POKAZ) {
    console.log(B(`\n  ${path.basename(plik)} — ${wb.worksheets.length} arkusz(y)\n`));
    wb.worksheets.forEach((ws, i) => {
      console.log(B(`  [${i}] ${ws.name}`) + D(`   ${ws.rowCount} wierszy, ${ws.columnCount} kolumn`));
      const naglowki = [];
      ws.getRow(1).eachCell({ includeEmpty: false }, (c, n) => naglowki.push({ n, v: String(c.value ?? '').trim() }));
      if (!naglowki.length) { console.log(D('      (pusty pierwszy wiersz)\n')); return; }
      let trafione = 0;
      for (const h of naglowki) {
        const d = dopasuj(h.v);
        if (d) trafione++;
        const pole = d ? DR.wgKlucza[d.klucz] : null;
        const znak = !d ? R('—') : d.pewnosc === 'fragment' ? Y('≈') : G('✓');
        console.log(`      ${znak} ${String(h.v).slice(0, 34).padEnd(36)}` +
          (pole ? `${(pole.kod + ' ' + pole.nazwa).slice(0, 40)}  ${D(d.pewnosc)}` : D('(brak dopasowania)')));
      }
      console.log(D(`      dopasowano ${trafione}/${naglowki.length}\n`));
    });
    console.log(D('  ✓ pewne dopasowanie   ≈ po fragmencie nazwy — SPRAWDŹ   — brak\n'));
    console.log(D('  Kolumnę można wskazać ręcznie: --mapa mapa.json  z {"Nagłówek":"klucz"}\n'));
    return;
  }

  if (!wyjscie) { console.error(R('\n  Podaj --wyjscie <plik.json> albo uruchom z --pokaz\n')); process.exitCode = 2; return; }

  const ws = wb.worksheets[nrArkusza];
  if (!ws) { console.error(R(`\n  Nie ma arkusza o indeksie ${nrArkusza}\n`)); process.exitCode = 2; return; }

  const reczna = plikMapy ? JSON.parse(fs.readFileSync(plikMapy, 'utf8')) : {};
  const kolumny = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, n) => {
    const h = String(c.value ?? '').trim();
    const klucz = reczna[h] || dopasuj(h)?.klucz;
    if (klucz && DR.wgKlucza[klucz]) kolumny[n] = klucz;
  });

  if (!Object.keys(kolumny).length) {
    console.error(R('\n  Żadnej kolumny nie dopasowano. Uruchom z --pokaz i użyj --mapa.\n'));
    process.exitCode = 1; return;
  }

  const rekordy = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const wiersz = ws.getRow(r);
    const rek = { _zrodlo: 'zestawienie' };
    let niepuste = 0;
    for (const [nr, klucz] of Object.entries(kolumny)) {
      let v = wiersz.getCell(Number(nr)).value;
      if (v && typeof v === 'object') v = v.text ?? v.result ?? v.richText?.map(t => t.text).join('') ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      v = String(v ?? '').trim();
      if (v) { rek[klucz] = v; niepuste++; }
    }
    // Rekord bez numeru rejestracyjnego jest bezużyteczny do scalania — nie ma po czym
    // dopasować go do dowodu. Liczymy takie osobno, zamiast po cichu je wpuszczać.
    if (niepuste && rek.nrRej) rekordy.push(rek);
  }

  fs.writeFileSync(wyjscie, JSON.stringify(rekordy, null, 2), 'utf8');

  console.log(B(`\n  ${path.basename(plik)} → ${path.basename(wyjscie)}\n`));
  console.log(`  ${G('✓')} ${rekordy.length} rekordów z arkusza „${ws.name}"`);
  console.log(D(`     kolumn dopasowanych: ${Object.keys(kolumny).length}`));
  const pola = [...new Set(Object.values(kolumny))];
  const dt1 = pola.filter(k => DR.wgKlucza[k]?.dt1);
  console.log(D(`     pola: ${pola.join(', ')}`));
  console.log(`  ${dt1.length ? G('✓') : Y('⚠')} pól istotnych dla DT-1: ${dt1.length ? dt1.join(', ') : 'BRAK'}\n`);
  console.log(D(`  Dalej:  node tools/dr-excel.js ${path.basename(wyjscie)} [inne-zrodla.json...]\n`));
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
