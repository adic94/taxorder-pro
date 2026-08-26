#!/usr/bin/env node
/**
 * CHECKLISTA ROBOCZA — zamienia „89 pozycji do sprawdzenia" w listę zadań.
 *
 * PO CO. Arkusz wyliczenia mówi, KTÓRE pozycje są niepewne i dlaczego, ale
 * człowiek z tym arkuszem nadal nie wie, GDZIE szukać odpowiedzi. Ta checklista
 * dokłada trzy rzeczy, których w wyliczeniu nie ma:
 *
 *   [1] ŚCIEŻKĘ DO SKANU — konkretny plik, nie „poszukaj w dokumentacji".
 *   [2] CZEGO SZUKAĆ — pole i rubrykę dowodu, nie ogólne „sprawdź dane".
 *   [3] OSTATNI ŚLAD W DOKUMENTACJI — najpóźniejszą datę ważności widoczną
 *       w nazwach plików pojazdu.
 *
 * Punkt [3] okazał się rozstrzygać więcej niż nazwa katalogu. Cztery pojazdy
 * mają w nazwie folderu „SPRZEDANY", więc wyglądały na wyłączone z podatku —
 * ale trzy z nich mają polisę ważną do 2026 roku, czyli były posiadane
 * w rozliczanym okresie i podatek się od nich należy. Nazwa katalogu opisuje
 * stan na dziś, polisa — stan w danym roku.
 *
 *     node tools/dt1-checklist.js "<DT1 wyliczenie.xlsx>" [--wyjscie plik.xlsx]
 *       [--korzen "<katalog dokumentacji>"]
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const DOM = process.env.USERPROFILE || process.env.HOME || '.';
const KORZEN = par('--korzen', path.join(DOM, 'Desktop', 'Dokumentacja pojazdów'));
const WYJSCIE = par('--wyjscie', path.join(DOM, 'Documents', 'taxorder-backupy',
  `DT1 checklista ${new Date().toISOString().slice(0, 10)}.xlsx`));

const flagi = ['--korzen', '--wyjscie'];
const wejscie = argv.find((a, i) => !a.startsWith('--') &&
  !flagi.some(f => { const j = argv.indexOf(f); return j >= 0 && j === i - 1; }));

const klucz = (n) => String(n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const norm = (p) => path.relative(KORZEN, p).split(path.sep).join('/');

/**
 * Co konkretnie sprawdzić, w zależności od powodu. Rubryki podane wprost, bo
 * „sprawdź DMC" i „przepisz F.1 z żółtej tabeli" to dwie różne instrukcje —
 * druga da się wykonać bez znajomości dowodu rejestracyjnego.
 */
const CO_ROBIC = [
  [/nie przekracza 32 t/,        'Rubryka J: czy to CIĄGNIK SIODŁOWY? Jeśli tak, F.3 (masa zespołu) zamiast F.1.'],
  [/liczby osi/,                 'Rubryka L — liczba osi. Od 12 t decyduje o stawce.'],
  [/ślad zbycia/,                'Data sprzedaży: umowa albo faktura zbycia. Podatek za miesiące posiadania.'],
  [/ten sam VIN/,                'Który numer jest AKTUALNY. Rozstrzyga najnowszy dowód, nie nazwa folderu.'],
  [/nie ma go w bazie/,          'Czy pojazd należy do floty. Jeśli tak — wprowadzić do systemu.'],
  [/numer nie wygląda/,          'Odczytać numer rejestracyjny z rubryki A.'],
  [/kategoria autobusowa/,       'Rubryki J i S.1 — kategoria i liczba miejsc siedzących.'],
  [/pole podatkowe spoza dowodu/,'Przepisać F.1 (DMC) i L (osie) z dowodu — dziś wartość pochodzi z ewidencji.'],
  [/DR przeczy/,                 'Porównać markę, model i DMC ze skanem — dane same sobie przeczą.'],
  [/brak DMC/,                   'Rubryka F.1 — dopuszczalna masa całkowita z ŻÓŁTEJ tabeli.'],
  [/brak dowodu/,                'Odnaleźć dowód rejestracyjny — pojazdu nie zna żadne źródło urzędowe.'],
];
const coRobic = (uwagi) => {
  const kroki = CO_ROBIC.filter(([re]) => re.test(uwagi)).map(([, tekst]) => tekst);
  return kroki.length ? kroki.join('  •  ') : 'Porównać dane ze skanem dowodu.';
};

/** Numer z nazwy katalogu → pliki pojazdu + najpóźniejsza data widoczna w nazwach. */
function zbudujIndeks() {
  const idx = new Map();
  const chodz = (dir, glebokosc) => {
    if (glebokosc > 4) return;
    let wpisy; try { wpisy = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const numery = [...path.basename(dir).matchAll(/\b([A-Z]{2,3}[\s-]?[A-Z0-9]{3,6})\b/g)]
      .map(m => klucz(m[1])).filter(n => n.length >= 5 && n.length <= 10 && /\d/.test(n));
    for (const w of wpisy) {
      const p = path.join(dir, w.name);
      if (w.isDirectory()) { chodz(p, glebokosc + 1); continue; }
      if (!/\.(pdf|jpe?g|png)$/i.test(w.name)) continue;
      const dowod = /dow[oó]d|dow rej|rejestr/i.test(w.name);
      // Data ważności bywa w nazwie („pzu do 30.03.2026") — to najlepszy dostępny
      // ślad tego, do kiedy pojazd BYŁ we flocie. Lepszy niż nazwa katalogu:
      // trzy pojazdy z „SPRZEDANY" w nazwie mają polisę ważną do 2026 roku.
      const rok = Math.max(0, ...[...w.name.matchAll(/\b(20[12]\d)\b/g)].map(m => Number(m[1])));
      for (const nr of numery) {
        if (!idx.has(nr)) idx.set(nr, { pliki: [], dowody: [], rok: 0, slad: '' });
        const e = idx.get(nr);
        e.pliki.push(norm(p));
        if (dowod) e.dowody.push(norm(p));
        if (rok > e.rok) { e.rok = rok; e.slad = w.name; }
      }
    }
  };
  chodz(KORZEN, 0);
  return idx;
}

(async () => {
  if (!wejscie || !fs.existsSync(wejscie)) {
    console.error(R('\n  Podaj arkusz wyliczenia DT-1 (z tools/dt1-wyliczenie.js)\n'));
    process.exit(2);
  }
  const ROOT = path.resolve(__dirname, '..');
  const cel = path.resolve(WYJSCIE);
  if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
    console.error(R(`\n  ODMOWA: ${cel} leży w drzewie repozytorium (numery rejestracyjne, ścieżki do skanów).\n`));
    process.exit(2);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(wejscie);
  const ws = wb.getWorksheet('Do sprawdzenia');
  if (!ws) { console.error(R('\n  Arkusz nie ma zakładki „Do sprawdzenia"\n')); process.exit(2); }

  const h = []; ws.getRow(1).eachCell((c, i) => h[i] = String(c.value || ''));
  const kol = (frag) => h.findIndex(x => (x || '').includes(frag));
  const iK = kol('KWOTA'), iU = kol('Uwagi'), iM = kol('Marka'), iMo = kol('Model'),
        iD = kol('DMC [kg]'), iC = kol('Kategoria DT-1');

  process.stdout.write(D('  buduję indeks dokumentacji... '));
  const indeks = zbudujIndeks();
  console.log(D(`${indeks.size} numerów\n`));

  const wiersze = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const nr = String(r.getCell(1).value || '').trim();
    // Arkusz źródłowy kończy się wierszem podsumowania — bez tego warunku
    // checklista miała 90 pozycji zamiast 89 i DWUKROTNIE zawyżoną sumę.
    if (!nr || nr.toUpperCase() === 'RAZEM') return;
    const e = indeks.get(klucz(nr)) || { pliki: [], dowody: [], rok: 0, slad: '' };
    const uwagi = String(r.getCell(iU).value || '');
    wiersze.push({
      nr,
      pojazd: `${r.getCell(iM).value || ''} ${r.getCell(iMo).value || ''}`.trim(),
      dmc: r.getCell(iD).value || '',
      kat: r.getCell(iC).value || '',
      kwota: Number(r.getCell(iK).value) || 0,
      powod: uwagi,
      coRobic: coRobic(uwagi),
      skan: e.dowody[0] || e.pliki[0] || '',
      ilePlikow: e.pliki.length,
      ostatniRok: e.rok || '',
      ostatniSlad: e.slad,
    });
  });

  // Najdroższe najpierw — jeśli ktoś przejdzie tylko część listy, niech to będzie
  // ta część, która najbardziej zmienia kwotę.
  wiersze.sort((a, b) => b.kwota - a.kwota);

  const out = new ExcelJS.Workbook();
  out.creator = 'TaxOrder Pro';
  const w = out.addWorksheet('Do sprawdzenia', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  w.columns = [
    { header: 'Nr rej.', key: 'nr', width: 12 },
    { header: 'Pojazd', key: 'pojazd', width: 26 },
    { header: 'DMC', key: 'dmc', width: 8 },
    { header: 'Kat.', key: 'kat', width: 6 },
    { header: 'Kwota [zł]', key: 'kwota', width: 11 },
    { header: 'CO SPRAWDZIĆ', key: 'coRobic', width: 52 },
    { header: 'Dlaczego trafiło na listę', key: 'powod', width: 46 },
    { header: 'Skan dowodu', key: 'skan', width: 48 },
    { header: 'Plików', key: 'ilePlikow', width: 7 },
    { header: 'Ostatni ślad', key: 'ostatniRok', width: 11 },
    { header: 'Ustalono (wpisz)', key: 'ustalono', width: 22 },
  ];
  wiersze.forEach(x => {
    const r = w.addRow(x);
    if (!x.skan) r.getCell('skan').value = '— BRAK SKANU —';
    if (!x.skan) r.getCell('skan').font = { color: { argb: 'FF96322C' }, bold: true };
    // Pojazd bez śladu w dokumentacji po roku rozliczanym — mocna przesłanka,
    // że nie był wtedy posiadany.
    if (x.ostatniRok && x.ostatniRok < 2026) {
      r.getCell('ostatniRok').font = { color: { argb: 'FF8A5209' }, bold: true };
      r.getCell('ostatniRok').value = `${x.ostatniRok} ⚠`;
    }
    r.getCell('ustalono').border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
    r.alignment = { vertical: 'top', wrapText: true };
  });
  const nag = w.getRow(1);
  nag.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  nag.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5C' } };
  nag.alignment = { vertical: 'middle', wrapText: true };
  w.autoFilter = { from: 'A1', to: 'K1' };

  fs.mkdirSync(path.dirname(cel), { recursive: true });
  await out.xlsx.writeFile(cel);

  const suma = wiersze.reduce((a, x) => a + x.kwota, 0);
  const bezSkanu = wiersze.filter(x => !x.skan).length;
  const stare = wiersze.filter(x => x.ostatniRok && x.ostatniRok < 2026).length;
  console.log(B(`  ${wiersze.length} pozycji · ${suma.toLocaleString('pl')} zł`));
  console.log(`     ze skanem dowodu do przejrzenia   ${String(wiersze.length - bezSkanu).padStart(4)}`);
  console.log(`     ${Y('bez skanu w dokumentacji')}          ${String(bezSkanu).padStart(4)}   ${D('nie ma czego sprawdzić')}`);
  console.log(`     ${Y('ostatni ślad przed 2026')}           ${String(stare).padStart(4)}   ${D('przesłanka, że nie były posiadane')}`);
  console.log(G(`\n  ✓ zapisano: ${cel}\n`));
  console.log(D('  Posortowane od najdroższych — jeśli ktoś przejdzie tylko część listy,'));
  console.log(D('  będzie to część najbardziej zmieniająca kwotę.\n'));
})();
