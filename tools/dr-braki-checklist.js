#!/usr/bin/env node
/**
 * Checklist do RĘCZNEGO uzupełnienia — pojazdy, których żadne źródło (zestawienie,
 * OCR, Aztec) nie wypełniło na tyle, żeby policzyć DT-1.
 *
 *     node tools/dr-braki-checklist.js <arkusz-dowody.xlsx> [--wyjscie plik.xlsx]
 *
 * PO CO OSOBNY PLIK. Arkusz źródłowy ma 907 wierszy i 7 zakładek — dobry do audytu,
 * zły do wzięcia w ręce i przejścia po segregatorach. Ten plik ogranicza się do
 * pojazdów, które NAPRAWDĘ wymagają człowieka z fizycznym dowodem: bez DMC (kategorii
 * nie da się ustalić wcale) albo ≥12t z brakiem osi/zawieszenia (kategoria niepewna).
 *
 * Posortowany po ścieżce źródłowego pliku, nie po numerze rejestracyjnym — żeby
 * przechodzenie przez segregatory/foldery szło w jedną stronę, nie w tę i z powrotem.
 * Puste kolumny na końcu każdego wiersza czekają na wpisanie z ręki.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const G = s => `\x1b[32m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const wejscie = argv.find(a => !a.startsWith('--') && /\.xlsx$/i.test(a));
const iw = argv.indexOf('--wyjscie');
const wyjscie = (iw >= 0 ? argv[iw + 1] : null) || path.join(
  process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'taxorder-backupy',
  `checklist-braki-DT1-${new Date().toISOString().slice(0, 10)}.xlsx`);

if (!wejscie || !fs.existsSync(wejscie)) {
  console.error('\nUżycie: node tools/dr-braki-checklist.js <arkusz-dowody.xlsx> [--wyjscie plik.xlsx]\n');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} lezy w drzewie repozytorium (dane pojazdow).\n`));
  process.exit(2);
}

function czytajArkusz(ws) {
  const headers = ws.getRow(1).values.slice(1);
  const out = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const vals = ws.getRow(r).values.slice(1);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]);
    out.push(obj);
  }
  return out;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(wejscie);

  const pojazdy = czytajArkusz(wb.getWorksheet('Pojazdy'));
  const dt1 = czytajArkusz(wb.getWorksheet('DT-1'));
  // Naglowek kolumny A w arkuszu Pojazdy to `DR.naglowek()`, czyli "A — Numer rejestracyjny".
  const kluczNr = Object.keys(pojazdy[0] || {}).find(k => /numer rejestracyjny/i.test(k)) || 'A — Numer rejestracyjny';
  const kluczTyp = Object.keys(pojazdy[0] || {}).find(k => /typ, wariant/i.test(k));
  const plikWg = new Map(), typWg = new Map(), przeznWg = new Map();
  for (const r of pojazdy) {
    plikWg.set(r[kluczNr], r['Plik źródłowy']);
    if (kluczTyp) typWg.set(r[kluczNr], r[kluczTyp]);
    przeznWg.set(r[kluczNr], r['Rodzaj pojazdu / przeznaczenie']);
  }

  const bezDmc = dt1.filter(r => r['Status'] === 'NIE DA SIE USTALIC')
    .map(r => ({ ...r, kategoria: 'Brak DMC — kategorii nie da się ustalić wcale' }));
  const niepewne = dt1.filter(r => String(r['Status'] || '').includes('niepewna'))
    .map(r => ({ ...r, kategoria: '≥12t — brakuje osi/zawieszenia' }));

  const wszystkie = [...bezDmc, ...niepewne].map(r => ({
    ...r,
    plik: plikWg.get(r['Nr rej.']) || '',
    typ: typWg.get(r['Nr rej.']) || '',
    przezn: przeznWg.get(r['Nr rej.']) || '',
  }));
  // Marka/model/przeznaczenie bywaja w zrodle pomylone z opisem SPRZETU zamontowanego
  // na przyczepie (np. "Myjka Cisnieniowa KRANZLE" zamiast marki przyczepy) — a to
  // zanieczyszczenie wystepuje CZASEM takze w polu przeznaczenie, wiec nie ufamy jednemu
  // polu. Pokazujemy TYP i PRZEZNACZENIE osobno — czlowiek przegladajacy rekord widzi
  // rozbieznosc od razu, zamiast dostac jedna, po cichu wybrana wartosc.
  // Sortowanie po ścieżce pliku: dziel katalog nadrzędny osobno, żeby ten sam folder
  // (ten sam segregator/pojazd) trzymał się razem, a foldery szły alfabetycznie.
  wszystkie.sort((a, b) => String(a.plik).localeCompare(String(b.plik)));

  const nowy = new ExcelJS.Workbook();
  nowy.creator = 'TaxOrder Pro';
  nowy.created = new Date();

  const ws = nowy.addWorksheet('Do uzupełnienia', { views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] });
  ws.columns = [
    { header: 'Nr rej.', key: 'nrRej', width: 12 },
    { header: 'Marka', key: 'marka', width: 16 },
    { header: 'Model', key: 'model', width: 18 },
    { header: 'D.2 Typ', key: 'typ', width: 16 },
    { header: 'Przeznaczenie (uwaga: bywa opisem sprzętu na przyczepie, nie samej przyczepy — porównaj z Typem)', key: 'przezn', width: 30 },
    { header: 'Czego brakuje', key: 'kategoria', width: 36 },
    { header: 'Plik źródłowy (szukaj tu fizycznego dowodu)', key: 'plik', width: 60 },
    { header: 'F.1 DMC (kg) — wpisz', key: 'dmc', width: 20 },
    { header: 'L Liczba osi — wpisz', key: 'osie', width: 20 },
    { header: 'Zawieszenie — wpisz', key: 'zawieszenie', width: 20 },
    { header: 'Sprawdzone (X)', key: 'ok', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: 'top' };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const KOLOR_BRAK_DMC = 'FFFCE4E4', KOLOR_NIEPEWNE = 'FFFFF3CD';
  for (const r of wszystkie) {
    const wiersz = ws.addRow({
      nrRej: r['Nr rej.'], marka: r['Marka'] || '', model: r['Model'] || '',
      typ: r.typ, przezn: r.przezn, kategoria: r.kategoria, plik: r.plik,
    });
    const kolor = r.kategoria.startsWith('Brak DMC') ? KOLOR_BRAK_DMC : KOLOR_NIEPEWNE;
    wiersz.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kolor } }; });
  }

  // Podsumowanie na górze osobnej zakładki, zeby bylo wiadomo ile roboty zostalo
  // bez otwierania calego arkusza.
  const wp = nowy.addWorksheet('Podsumowanie');
  wp.columns = [{ header: '', key: 'a', width: 40 }, { header: '', key: 'b', width: 14 }];
  wp.addRows([
    { a: 'Pojazdów bez DMC (kategorii nie da się ustalić)', b: bezDmc.length },
    { a: 'Pojazdów ≥12t z brakiem osi/zawieszenia', b: niepewne.length },
    { a: 'RAZEM do ręcznego przejrzenia', b: wszystkie.length },
    { a: '', b: '' },
    { a: 'Wygenerowano', b: new Date().toISOString().slice(0, 10) },
    { a: 'Źródło', b: path.basename(wejscie) },
  ]);
  wp.getColumn('a').font = { bold: true };

  await nowy.xlsx.writeFile(cel);
  console.log(B(`\n  Checklist do ręcznego uzupełnienia\n`));
  console.log(`   ${bezDmc.length} bez DMC, ${niepewne.length} ≥12t z brakiem osi/zawieszenia`);
  console.log(`   ${G('✓')} zapisano: ${cel}\n`);
})();
