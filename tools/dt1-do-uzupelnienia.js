#!/usr/bin/env node
/**
 * Lista pojazdów, które NAPRAWDĘ wymagają ręcznego uzupełnienia do DT-1.
 *
 * PO CO ISTNIEJE. Arkusz DT-1 mówił „72 pojazdy bez DMC — kategorii nie da się
 * ustalić". Ta liczba jest PRAWDZIWA co do wierszy i MYLĄCA co do pracy: po
 * rozbiciu okazało się, że realnych pojazdów jest **14**. Reszta to:
 *
 *   13 — SPRZĘT ZAMONTOWANY NA PRZYCZEPIE, nie pojazd. Źródło podaje w polu
 *        marki opis urządzenia („Myjka Ciśnieniowa KRANZLE"), bo tak wpisano
 *        w ewidencji. Takie pozycje nie mają DMC, bo nie są pojazdem —
 *        podatek dotyczy przyczepy, na której stoją, a ta ma własny wiersz.
 *    3 — NUMER, KTÓRY NIE JEST TABLICĄ: „WKOŁO2824-", „WKRAKU2024",
 *        „ZM15ZTTE1N" — fragmenty tekstu z nazw plików.
 *   42 — POJAZDY-WIDMA znane WYŁĄCZNIE z OCR albo z nazwy pliku, nigdy
 *        z zestawienia floty. Przykłady mówią same za siebie: „HAK2022-11"
 *        (hak holowniczy), „ZŁODZIŃSKI" jako marka, „RODZAJ POJAZDU /" jako
 *        rodzaj. Numer przekłamany o jeden znak tworzy pojazd, który nie istnieje.
 *
 * Wysłanie księgowości listy 72 pozycji kazałoby jej szukać danych dla 58
 * bytów, które albo nie są pojazdami, albo nie istnieją. Ta lista podaje 14.
 *
 *     node tools/dt1-do-uzupelnienia.js <raport-zarzad.xlsx> [--wyjscie plik.xlsx]
 *
 * Wejście: skoroszyt z `dr-excel.js --zarzad` (potrzebne arkusze „Podatek DT-1"
 * i „Flota" — ten drugi niesie kolumnę „Pewność", po której idzie odsiew).
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const iw = argv.indexOf('--wyjscie');
const wejscie = argv.find((a, i) => !a.startsWith('--') && !(iw >= 0 && i === iw + 1));
const wyjscie = (iw >= 0 ? argv[iw + 1] : null) || path.join(
  process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'taxorder-backupy',
  `DT1-do-uzupelnienia-${new Date().toISOString().slice(0, 10)}.xlsx`);

if (!wejscie || !fs.existsSync(wejscie)) {
  console.error(R('\n  Podaj skoroszyt z dr-excel.js --zarzad\n'));
  console.error(D('  node tools/dt1-do-uzupelnienia.js "<raport-zarzad.xlsx>" [--wyjscie plik.xlsx]\n'));
  process.exit(2);
}
const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} leży w drzewie repozytorium (dane pojazdów).\n`));
  process.exit(2);
}

// Sprzęt montowany na przyczepie — w polu marki bywa opis urządzenia, nie marka.
const SPRZET = /myjka|kranzle|agregat|kompresor|zbiornik|cysterna kontener|\bwc\b|toaleta|kabina/i;

/** Czy tekst wygląda na polską tablicę rejestracyjną. */
function wygladaJakTablica(n) {
  const c = String(n).replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z]{2,3}[A-Z0-9]{3,6}$/.test(c) && /[0-9]/.test(c);
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(wejscie);
  const wd = wb.getWorksheet('Podatek DT-1');
  const wf = wb.getWorksheet('Flota');
  if (!wd || !wf) {
    console.error(R('\n  Brak arkusza „Podatek DT-1" albo „Flota" — to nie jest skoroszyt z --zarzad.\n'));
    process.exit(2);
  }

  // Pewność wiersza mieszka w arkuszu Flota (ostatnia kolumna)
  const kolPewnosc = wf.columnCount;
  const pewnosc = {};
  wf.eachRow((r, i) => { if (i > 1) pewnosc[String(r.getCell(1).value || '').trim()] = String(r.getCell(kolPewnosc).value || ''); });

  const wiersze = [];
  wd.eachRow((r, i) => {
    if (i === 1) return;
    const nr = String(r.getCell(1).value || '').trim();
    wiersze.push({
      nr, marka: String(r.getCell(2).value || ''), model: String(r.getCell(3).value || ''),
      rodzaj: String(r.getCell(4).value || ''), dmc: r.getCell(5).value,
      osie: r.getCell(7).value, zawieszenie: String(r.getCell(8).value || ''),
      status: String(r.getCell(10).value || ''), braki: String(r.getCell(11).value || ''),
      pewnosc: pewnosc[nr] || '?',
    });
  });

  const bezDmc = wiersze.filter(w => w.status === 'NIE DA SIE USTALIC');
  const niepewne12t = wiersze.filter(w => /niepewna/.test(w.status));

  const odsiew = { sprzet: [], zlyNumer: [], widmo: [], doPracy: [] };
  for (const w of bezDmc) {
    if (SPRZET.test(w.marka) || SPRZET.test(w.rodzaj)) odsiew.sprzet.push(w);
    else if (!wygladaJakTablica(w.nr)) odsiew.zlyNumer.push(w);
    else if (w.pewnosc !== 'wysoka') odsiew.widmo.push(w);
    else odsiew.doPracy.push(w);
  }
  // Pojazdy >= 12 t z brakami — TE są potwierdzone i realne, dochodzą do pracy.
  const doPracy12t = niepewne12t.filter(w => w.pewnosc === 'wysoka');

  console.log(B(`\n  DT-1 — co NAPRAWDĘ wymaga uzupełnienia\n`));
  console.log(`  Arkusz DT-1 pokazuje ${bezDmc.length} pozycji „bez DMC". Po odsiewie:`);
  console.log(`    ${String(odsiew.sprzet.length).padStart(4)}  sprzęt zamontowany na przyczepie — nie pojazd, nie ma DMC`);
  console.log(`    ${String(odsiew.zlyNumer.length).padStart(4)}  numer nie jest tablicą rejestracyjną`);
  console.log(`    ${String(odsiew.widmo.length).padStart(4)}  pojazdy-widma — znane wyłącznie z OCR/nazwy pliku`);
  console.log(`  ${G(String(odsiew.doPracy.length).padStart(6))}  ${B('POJAZDÓW do uzupełnienia DMC')}`);
  console.log(`  ${G(String(doPracy12t.length).padStart(6))}  ${B('POJAZDÓW od 12 t z brakiem osi/zawieszenia')}`);
  console.log(D(`\n     razem do pracy: ${odsiew.doPracy.length + doPracy12t.length} pozycji, nie ${bezDmc.length + niepewne12t.length}\n`));

  // ── Skoroszyt ──────────────────────────────────────────────────────────────
  const out = new ExcelJS.Workbook();
  out.creator = 'TaxOrder Pro';
  const naglowek = (ws) => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    ws.getRow(1).height = 26;
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const wu = out.addWorksheet('Do uzupełnienia');
  wu.columns = [
    { header: 'Nr rejestracyjny', key: 'nr', width: 16 },
    { header: 'Marka', key: 'marka', width: 18 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Rodzaj pojazdu', key: 'rodzaj', width: 20 },
    { header: 'Czego brakuje', key: 'braki', width: 30 },
    { header: 'DMC [kg] — WPISZ', key: 'wDmc', width: 18 },
    { header: 'Liczba osi — WPISZ', key: 'wOsie', width: 18 },
    { header: 'Zawieszenie — WPISZ', key: 'wZaw', width: 22 },
    { header: 'Sprawdzone przez', key: 'kto', width: 18 },
  ];
  const doWpisania = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  for (const w of [...odsiew.doPracy, ...doPracy12t].sort((a, b) => a.nr.localeCompare(b.nr, 'pl'))) {
    const r = wu.addRow({
      nr: w.nr, marka: w.marka, model: w.model, rodzaj: w.rodzaj,
      braki: w.braki || 'F.1 DMC', wDmc: w.dmc ?? '', wOsie: w.osie ?? '', wZaw: w.zawieszenie || '',
    });
    ['wDmc', 'wOsie', 'wZaw', 'kto'].forEach(k => { r.getCell(k).fill = doWpisania; });
  }
  naglowek(wu);
  wu.autoFilter = { from: 'A1', to: { row: 1, column: wu.columns.length } };

  // Odsiane — żeby nikt nie musiał wierzyć na słowo, że 58 pozycji odpadło słusznie
  const wo = out.addWorksheet('Odsiane — dlaczego');
  wo.columns = [
    { header: 'Nr / tekst', key: 'nr', width: 18 },
    { header: 'Marka', key: 'marka', width: 26 },
    { header: 'Rodzaj', key: 'rodzaj', width: 22 },
    { header: 'Powód odsiania', key: 'powod', width: 52 },
  ];
  const dodaj = (lista, powod) => lista.forEach(w => wo.addRow({ nr: w.nr, marka: w.marka, rodzaj: w.rodzaj, powod }));
  dodaj(odsiew.sprzet, 'Sprzęt zamontowany na przyczepie — nie pojazd. Podatek dotyczy przyczepy, ta ma własny wiersz.');
  dodaj(odsiew.zlyNumer, 'Tekst nie jest tablicą rejestracyjną — fragment z nazwy pliku.');
  dodaj(odsiew.widmo, 'Znany wyłącznie z OCR lub nazwy pliku, brak w zestawieniu floty — prawdopodobnie przekłamany numer.');
  naglowek(wo);
  wo.autoFilter = { from: 'A1', to: { row: 1, column: wo.columns.length } };

  await out.xlsx.writeFile(cel);
  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     arkusze: „Do uzupełnienia" (${odsiew.doPracy.length + doPracy12t.length} wierszy, żółte kolumny do wpisania), „Odsiane — dlaczego" (${odsiew.sprzet.length + odsiew.zlyNumer.length + odsiew.widmo.length})\n`));
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
