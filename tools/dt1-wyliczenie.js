#!/usr/bin/env node
/**
 * WYLICZENIE DT-1 — ile podatku od środków transportowych za dany rok.
 *
 * Odpowiada na pytanie, do którego zmierzała cała praca nad danymi: KWOTA.
 * Bierze arkusz MASTER (scalone DR + ZSI + MyCar + ORLEN) i przepuszcza każdy
 * pojazd przez PRODUKCYJNY `modules/tax-engine.js` — ten sam, którym liczy
 * aplikacja. Nie kopiuję tu progów ani stawek: druga kopia rozjechałaby się
 * z silnikiem i pokazywała kwotę inną niż system.
 *
 * ⚠️ TO NIE JEST DEKLARACJA. Kwoty są WYLICZONE Z DANYCH, których jakość znamy
 * i która nie jest jednolita:
 *   — 32 wiersze DR przeczą samym sobie (arkusz „DR do weryfikacji"),
 *   — 40 pojazdów ma pole podatkowe spoza dowodu rejestracyjnego,
 *   — część pojazdów zna wyłącznie OCR albo nazwa pliku.
 * Dlatego każdy wiersz niesie kolumnę PEWNOŚĆ, a arkusz „Do sprawdzenia"
 * wyciąga te, których nie wolno wysłać bez obejrzenia dokumentu.
 *
 * STAWKI pochodzą z `modules/gminy-rates.js`, zweryfikowanego wobec uchwały
 * Rady m.st. Warszawy XXIX/1065/2025 (bramka `tests/unit/gminy-rates-test.js`).
 * Dla pojazdów z innych gmin stawka może się różnić — kolumna „Gmina" mówi,
 * czego użyto.
 *
 *     node tools/dt1-wyliczenie.js <MASTER.xlsx> [--rok 2026] [--wyjscie plik.xlsx]
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const ROK = Number(par('--rok', new Date().getFullYear()));
const iw = argv.indexOf('--wyjscie'), ir = argv.indexOf('--rok'), ib = argv.indexOf('--baza');
const wejscie = argv.find((a, i) => !a.startsWith('--') &&
  !(iw >= 0 && i === iw + 1) && !(ir >= 0 && i === ir + 1) && !(ib >= 0 && i === ib + 1));
const DOM = process.env.USERPROFILE || process.env.HOME || '.';
const wyjscie = par('--wyjscie', path.join(DOM, 'Documents', 'taxorder-backupy', `DT1 wyliczenie ${ROK}.xlsx`));

// ── Lista tablic znanych PRODUKCYJNEJ BAZIE (opcjonalna) ────────────────────
//
// PO CO. Arkusz MASTER buduję ze SKANÓW DOKUMENTÓW, więc zawiera też pojazdy,
// których firma dziś nie ma: stare dowody sprzed przerejestrowania, auta
// sprzedane, cudze dokumenty leżące w cudzym folderze. Bez tej listy nie da się
// odróżnić „pojazd, którego brakuje w systemie" od „artefakt dokumentacji".
//
// Zmierzone 26.08: z 232 opodatkowanych 184 zna baza (229 104 zł), a 48 nie
// (62 952 zł) — i to te 48 jest całą otwartą pozycją, nie cała suma.
//
// Plik to zwykły tekst albo JSON z numerami rejestracyjnymi. Wytworzyć go można
// jednym zapytaniem:
//   SELECT GROUP_CONCAT(REPLACE(UPPER(nr_rej),' ','')) FROM vehicles
const bazaPlik = par('--baza', path.join(DOM, 'Documents', 'taxorder-backupy', 'tablice-w-bazie.txt'));
let TABLICE_BAZY = null;
if (fs.existsSync(bazaPlik)) {
  const surowe = fs.readFileSync(bazaPlik, 'utf8');
  const lista = surowe.trim().startsWith('[') || surowe.trim().startsWith('{')
    ? JSON.parse(surowe) : surowe.split(/[,\n;]+/);
  const plaska = Array.isArray(lista) ? lista : Object.values(lista);
  TABLICE_BAZY = new Set(plaska.map(x => String(typeof x === 'object' ? (x.nr_rej ?? x.nrRej ?? '') : x)
    .toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean));
}

if (!wejscie || !fs.existsSync(wejscie)) {
  console.error(R('\n  Podaj arkusz MASTER (z tools/flota-master.js)\n'));
  process.exit(2);
}
const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} leży w drzewie repozytorium.\n`));
  process.exit(2);
}

// Produkcyjny silnik przez `window`-shim — ten sam kod, którym liczy aplikacja.
const shim = { window: {} };
new Function('window', fs.readFileSync(path.join(ROOT, 'modules', 'gminy-rates.js'), 'utf8'))(shim.window);
new Function('window', fs.readFileSync(path.join(ROOT, 'modules', 'tax-engine.js'), 'utf8'))(shim.window);
const TaxEngine = shim.window.TaxEngine;

const liczba = (v) => { const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(wejscie);
  const wf = wb.getWorksheet('Flota');
  if (!wf) { console.error(R('\n  Brak arkusza „Flota" — to nie jest arkusz MASTER.\n')); process.exit(2); }

  const h = []; for (let c = 1; c <= wf.columnCount; c++) h[c] = String(wf.getRow(1).getCell(c).value || '');
  const kol = (n) => h.findIndex(x => x === n);
  const K = {
    nr: 1, zrodla: kol('Źródła'), marka: kol('Marka'), model: kol('Model'),
    rodzaj: kol('Rodzaj'), przezn: kol('Przeznaczenie'), kat: kol('J Kategoria'),
    dmc: kol('F.1 DMC [kg]'), dmc2: kol('F.2 Dop. masa całk.'), dmcZesp: kol('F.3 DMC zespołu'), osie: kol('L Osie'),
    zaw: kol('Zawieszenie'), rok: kol('Rok'), paliwo: kol('P.3 Paliwo'),
    miejsca: kol('S.1 Miejsca'), dt1Status: kol('DT-1 status'),
  };

  // Które pojazdy mają wiersz w „DR do weryfikacji"
  const podejrzane = new Set();
  wb.getWorksheet('DR do weryfikacji')?.eachRow((r, i) => { if (i > 1) podejrzane.add(String(r.getCell(1).value || '').trim()); });
  // Które mają pole podatkowe spoza dowodu
  const spozaDowodu = new Set();
  const wpd = wb.getWorksheet('Podstawa DT-1');
  wpd?.eachRow((r, i) => { if (i > 1 && r.getCell(wpd.columnCount).value) spozaDowodu.add(String(r.getCell(1).value || '').trim()); });

  // TEN SAM POJAZD POD DWIEMA TABLICAMI — podatek zapłacony dwa razy za jedno auto.
  //
  // Przerejestrowany pojazd zostaje w danych pod starym I nowym numerem, bo
  // scalanie idzie po tablicy, a ta się zmieniła. Zmierzone na tej flocie:
  // 6 pojazdów opodatkowanych wielokrotnie, w tym Sprinter o VIN
  // W1V9071551N140624 pod TRZEMA tablicami — łącznie 9 816 zł zbędnej należności.
  //
  // Wykrywa to arkusz MASTER (zakładka „Ten sam VIN"), bo VIN jest przypisany
  // do nadwozia na stałe i przeżywa zmianę tablicy. Tutaj tylko przenosimy
  // ten sygnał do wyliczenia — żeby stał tam, gdzie stoi kwota.
  const tenSamVin = new Map();   // tablica → pozostałe tablice tego samego VIN-u
  wb.getWorksheet('Ten sam VIN')?.eachRow((r, i) => {
    if (i === 1) return;
    const tab = String(r.getCell(2).value || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const t of tab) tenSamVin.set(t, { vin: String(r.getCell(1).value || ''), inne: tab.filter(x => x !== t) });
  });

  const wiersze = [];
  wf.eachRow((r, i) => {
    if (i === 1) return;
    const nr = String(r.getCell(K.nr).value || '').trim();
    if (!nr) return;
    const g = (c) => c > 0 ? r.getCell(c).value : null;

    // PODSTAWĄ PODATKU JEST F.2, NIE F.1 — to dwie różne wielkości, nie dwa
    // odczyty tej samej. F.1 to maksymalna masa TECHNICZNIE dopuszczalna
    // (możliwości konstrukcji), F.2 to DOPUSZCZALNA masa całkowita, czyli ta
    // zarejestrowana w kraju. Ustawa o podatkach i opłatach lokalnych posługuje
    // się tym drugim terminem, a katalog `modules/dr-fields.js` (weryfikowany
    // wobec Dz.U.) nazywa je dokładnie tak.
    //
    // Zmierzone na dowodzie WA1697F: F.1 = 37 000, F.2 = 32 000. Volvo FMX 8x4
    // jest sztywną ciężarówką, a te nie przekraczają w Polsce 32 t — więc to
    // F.2 opisuje pojazd, jakim on jeździ. Produkcyjne D1 ma tam 32 000, czyli
    // ktokolwiek je wypełniał, sięgnął po właściwą rubrykę.
    //
    // ⚠️ SANITY: F.2 <= F.1 ZAWSZE, bo masa zarejestrowana nie może przekroczyć
    // technicznie dopuszczalnej. Odwrotna relacja znaczy zły odczyt jednej
    // z rubryk — zmierzone na trzech Sprinterach, którym OCR dał F.2 = 37 000
    // przy F.1 = 3 500. Wtedy zostajemy przy F.1 i zgłaszamy sprzeczność,
    // zamiast wpisać do deklaracji dziesięciokrotnie zawyżoną masę.
    const f1 = liczba(g(K.dmc)), f2 = liczba(g(K.dmc2));
    const uzyjF2 = f2 != null && f2 > 0 && (f1 == null || f2 <= f1);
    const dmcPodatkowa = uzyjF2 ? f2 : f1;

    const v = {
      nrRej: nr,
      dmc: dmcPodatkowa, dmcMax: dmcPodatkowa,
      dmcZespolu: liczba(g(K.dmcZesp)) || 0,
      typ: String(g(K.rodzaj) || ''), przeznaczenie: String(g(K.przezn) || ''),
      osie: liczba(g(K.osie)), miejsca: liczba(g(K.miejsca)),
      rok: liczba(g(K.rok)), zawieszenie: String(g(K.zaw) || ''),
      _taxYear: ROK,
    };

    let wynik;
    try { wynik = TaxEngine.calcTax(v); } catch (e) { wynik = { cat: null, amount: 0, rate: 0, _blad: e.message }; }

    const zrodla = String(g(K.zrodla) || '');
    const uwagi = [];
    // SZTYWNA CIĘŻARÓWKA NIE MOŻE WAŻYĆ WIĘCEJ NIŻ 32 TONY.
    //
    // Rozporządzenie o warunkach technicznych pojazdów daje maksima: 18 t przy
    // dwóch osiach, 25–26 t przy trzech, 32 t przy czterech. Dopiero ZESPÓŁ
    // ciągnika z naczepą sięga 40 t. Jeśli więc pojazd oznaczony jako „ciężarowy"
    // ma DMC 40 000, to albo jest ciągnikiem siodłowym i pole niesie masę zespołu,
    // albo odczyt jest błędny — a to RÓŻNE TABELE STAWEK.
    //
    // Zmierzone na tej flocie: cztery takie pojazdy, wszystkie 40 t. Przy jednym
    // model mówi wprost „Scania koń SOLD" („koń" to w żargonie ciągnik siodłowy).
    // Liczone dziś jako D8 po 2 184 zł; jako ciągnik dwuosiowy powyżej 36 t
    // stawka wynosi 3 384 zł, a przy trzech osiach i 40 t — 4 200 zł.
    if (f1 != null && f2 != null && f2 > f1)
      uwagi.push(`F.2 (${f2} kg) większe niż F.1 (${f1} kg) — niemożliwe, jedna z rubryk źle odczytana`);

    const rodzajTxt = String(g(K.rodzaj) || '') + ' ' + String(g(K.przezn) || '');
    if (v.dmc != null && v.dmc > 32000 && !/ci[ąa]gnik|naczep|przyczep/i.test(rodzajTxt))
      uwagi.push(`DMC ${v.dmc} kg przy rodzaju „${String(g(K.rodzaj) || '—').trim()}" — sztywna ciężarówka nie przekracza 32 t, sprawdź, czy to nie ciągnik siodłowy`);

    // ŚLAD SPRZEDAŻY albo KASACJI w danych pojazdu. Zmierzone: cztery pojazdy
    // z modelem „SPRZEDANY", „koń SOLD", „Tge Sprzedany", „TGL SPRZEDANY" mają
    // naliczone razem 5 928 zł, a żadnego z nich nie zna baza produkcyjna.
    //
    // ⚠️ To FLAGA, nie automatyczne zwolnienie. Podatek należy się za miesiące
    // POSIADANIA, więc auto sprzedane w połowie roku ma należność częściową,
    // a nie zerową. Daty sprzedaży z pola „model" nie da się odczytać, więc
    // rozstrzyga dokument — narzędzie tylko pokazuje, gdzie patrzeć.
    const SLAD_ZBYCIA = /\b(sprzedan\w*|sold|zbyt\w*|zlomowan\w*|skasowan\w*|wyrejestrowan\w*|likwidacj\w*)\b/i;
    const teksty = [g(K.marka), g(K.model), g(K.rodzaj), g(K.przezn)].map(x => String(x || ''));
    const zbyty = teksty.find(t => SLAD_ZBYCIA.test(t));
    if (zbyty) uwagi.push(`ślad zbycia w danych („${zbyty.trim().slice(0, 30)}") — podatek należy się za miesiące posiadania`);

    if (TABLICE_BAZY && !TABLICE_BAZY.has(String(nr).toUpperCase().replace(/[^A-Z0-9]/g, '')))
      uwagi.push('nie ma go w bazie produkcyjnej — sprawdź, czy to realny pojazd firmy');

    const dupl = tenSamVin.get(nr);
    if (dupl) uwagi.push(`ten sam VIN co ${dupl.inne.join(', ')} — sprawdź, czy to nie jeden pojazd po przerejestrowaniu`);
    if (podejrzane.has(nr)) uwagi.push('DR przeczy sam sobie');
    if (spozaDowodu.has(nr)) uwagi.push('pole podatkowe spoza dowodu');
    if (!/DR/.test(zrodla)) uwagi.push('brak dowodu rejestracyjnego');
    if (v.dmc == null) uwagi.push('brak DMC');

    // ── Kontrole wychwycone przy pierwszym przebiegu wyliczenia ──────────────
    //
    // Pierwsza wersja wpuszczała do puli „bez zastrzeżeń" wiersze, które nie
    // powinny tam trafić. Widać je było dopiero na wyniku, nie na danych.

    // 1. Numer, który nie jest tablicą. „GD", „GDA" dostały kategorię i kwotę —
    //    to fragmenty tekstu z nazw plików, nie pojazdy.
    const nrCzysty = nr.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2,3}[A-Z0-9]{3,6}$/.test(nrCzysty) || !/\d/.test(nrCzysty))
      uwagi.push('numer nie wygląda na tablicę rejestracyjną');

    // 2. Od 12 t stawka zależy od LICZBY OSI — bez niej silnik przyjmuje wartość
    //    domyślną, a ta potrafi wskazać inną stawkę. Pojazd 40 t z nieznaną
    //    liczbą osi dostawał stawkę dwuosiową.
    if (v.dmc != null && v.dmc >= 12000 && !v.osie)
      uwagi.push('od 12 t stawka zależy od liczby osi, a osie nieznane');

    // 3. Kategoria autobusowa przy pojeździe, który autobusem nie wygląda.
    //    Pojazd 1200 kg trafił do D6 (autobus < 30 miejsc, 1488 zł).
    if (/^D[67]$/.test(wynik.cat || '')) {
      const rodzajTekst = `${v.typ} ${v.przeznaczenie}`.toLowerCase();
      if (!/autobus|bus\b/.test(rodzajTekst))
        uwagi.push(`kategoria autobusowa ${wynik.cat} przy rodzaju „${v.typ || '—'}"`);
      else if (v.dmc != null && v.dmc < 3500)
        uwagi.push(`kategoria autobusowa przy DMC ${v.dmc} kg`);
    }

    wiersze.push({
      nr, marka: String(g(K.marka) || ''), model: String(g(K.model) || ''),
      rodzaj: v.typ, dmc: v.dmc, dmcZesp: v.dmcZespolu || '', osie: v.osie ?? '',
      zaw: v.zawieszenie, rok: v.rok ?? '', paliwo: String(g(K.paliwo) || ''),
      kat: wynik.cat || '', stawka: wynik.rate || '', miesiecy: wynik.months ?? '',
      kwota: wynik.cat ? wynik.amount : '',
      zrodla, pewnosc: uwagi.length ? 'DO SPRAWDZENIA' : 'ok',
      uwagi: uwagi.join('; '),
    });
  });

  const podlega = wiersze.filter(w => w.kat);
  const doSprawdzenia = podlega.filter(w => w.pewnosc === 'DO SPRAWDZENIA');
  const pewne = podlega.filter(w => w.pewnosc === 'ok');
  const suma = (t) => Math.round(t.reduce((s, w) => s + (Number(w.kwota) || 0), 0) * 100) / 100;

  console.log(B(`\n  DT-1 — wyliczenie za ${ROK}\n`));
  console.log(`  pojazdów w arkuszu           ${String(wiersze.length).padStart(6)}`);
  console.log(`  podlega podatkowi            ${String(podlega.length).padStart(6)}`);
  console.log(`  ${G('— dane bez zastrzeżeń')}      ${String(pewne.length).padStart(6)}   ${G(suma(pewne).toLocaleString('pl-PL') + ' zł')}`);
  console.log(`  ${Y('— do sprawdzenia')}           ${String(doSprawdzenia.length).padStart(6)}   ${Y(suma(doSprawdzenia).toLocaleString('pl-PL') + ' zł')}`);
  console.log(B(`  RAZEM                        ${String(podlega.length).padStart(6)}   ${suma(podlega).toLocaleString('pl-PL')} zł\n`));

  // ══ Skoroszyt ══════════════════════════════════════════════════════════════
  const out = new ExcelJS.Workbook();
  out.creator = 'TaxOrder Pro';
  const naglowek = (ws, kolor = 'FF1F4E79') => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kolor } };
    ws.getRow(1).height = 28; ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
  };
  const KOLUMNY = [
    { header: 'Nr rejestracyjny', key: 'nr', width: 16 },
    { header: 'Marka', key: 'marka', width: 15 },
    { header: 'Model', key: 'model', width: 18 },
    { header: 'Rodzaj', key: 'rodzaj', width: 18 },
    { header: 'DMC [kg]', key: 'dmc', width: 10 },
    { header: 'DMC zespołu', key: 'dmcZesp', width: 12 },
    { header: 'Osie', key: 'osie', width: 7 },
    { header: 'Zawieszenie', key: 'zaw', width: 14 },
    { header: 'Rok', key: 'rok', width: 7 },
    { header: 'Paliwo', key: 'paliwo', width: 11 },
    { header: 'Kategoria DT-1', key: 'kat', width: 13 },
    { header: 'Stawka roczna [zł]', key: 'stawka', width: 15 },
    { header: 'Miesięcy', key: 'miesiecy', width: 9 },
    { header: 'KWOTA [zł]', key: 'kwota', width: 13 },
    { header: 'Źródła danych', key: 'zrodla', width: 18 },
    { header: 'Pewność', key: 'pewnosc', width: 15 },
    { header: 'Uwagi', key: 'uwagi', width: 42 },
  ];

  const dodajArkusz = (nazwa, dane, kolor) => {
    const ws = out.addWorksheet(nazwa);
    ws.columns = KOLUMNY;
    for (const w of dane) {
      const r = ws.addRow(w);
      r.getCell('kwota').numFmt = '# ##0.00';
      r.getCell('stawka').numFmt = '# ##0';
      if (w.pewnosc === 'DO SPRAWDZENIA') r.getCell('pewnosc').font = { bold: true, color: { argb: 'FFC00000' } };
      else r.getCell('pewnosc').font = { color: { argb: 'FF008000' } };
    }
    if (dane.length) {
      const s = ws.addRow({ nr: 'RAZEM', kwota: suma(dane) });
      s.font = { bold: true };
      s.getCell('kwota').numFmt = '# ##0.00';
      s.getCell('kwota').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    }
    naglowek(ws, kolor);
    return ws;
  };

  dodajArkusz('Wyliczenie', podlega, 'FF1F4E79');
  if (doSprawdzenia.length) dodajArkusz('Do sprawdzenia', doSprawdzenia, 'FF9C0006');
  const niepodlega = wiersze.filter(w => !w.kat);
  if (niepodlega.length) dodajArkusz('Nie podlega', niepodlega, 'FF375623');

  // Podsumowanie kategoriami — do sprawdzenia z deklaracją
  const wk = out.addWorksheet('Wg kategorii');
  wk.columns = [
    { header: 'Kategoria DT-1', key: 'kat', width: 15 },
    { header: 'Pojazdów', key: 'ile', width: 10 },
    { header: 'Kwota [zł]', key: 'kwota', width: 14 },
    { header: 'w tym do sprawdzenia', key: 'ryzyko', width: 20 },
  ];
  const wg = {};
  for (const w of podlega) {
    wg[w.kat] = wg[w.kat] || { ile: 0, kwota: 0, ryzyko: 0 };
    wg[w.kat].ile++; wg[w.kat].kwota += Number(w.kwota) || 0;
    if (w.pewnosc === 'DO SPRAWDZENIA') wg[w.kat].ryzyko++;
  }
  Object.entries(wg).sort((a, b) => b[1].kwota - a[1].kwota).forEach(([kat, v]) => {
    const r = wk.addRow({ kat, ile: v.ile, kwota: Math.round(v.kwota * 100) / 100, ryzyko: v.ryzyko || '' });
    r.getCell('kwota').numFmt = '# ##0.00';
    if (v.ryzyko) r.getCell('ryzyko').font = { color: { argb: 'FFC00000' } };
  });
  const sw = wk.addRow({ kat: 'RAZEM', ile: podlega.length, kwota: suma(podlega), ryzyko: doSprawdzenia.length || '' });
  sw.font = { bold: true }; sw.getCell('kwota').numFmt = '# ##0.00';
  naglowek(wk, 'FF7B3F00');

  await out.xlsx.writeFile(cel);
  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     arkusze: Wyliczenie (${podlega.length}), Do sprawdzenia (${doSprawdzenia.length}), Nie podlega (${niepodlega.length}), Wg kategorii\n`));
  console.log(Y('  ⚠ To NIE JEST deklaracja.') + D(' Kwoty wyliczone z danych o znanej, niejednolitej jakości.'));
  console.log(D('     Arkusz „Do sprawdzenia" wyciąga pozycje, których nie wolno wysłać bez obejrzenia dokumentu.\n'));
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
