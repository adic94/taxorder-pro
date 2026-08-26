#!/usr/bin/env node
/**
 * Buduje listę celów dla ponownego OCR — z arkusza wyliczenia DT-1.
 *
 * PO CO OSOBNE NARZĘDZIE. `dr-ocr-batch-cloudrun.js` przyjmuje gotową listę
 * `[{nrRej, plik}]`, ale nikt jej nie produkuje z sensownym wyborem. Przebieg na
 * całości to 1318 dokumentów i ~4 godziny; przebieg na tych, gdzie dane wpływają
 * na KWOTĘ, to około 280 dokumentów i 45 minut. Ta różnica decyduje, czy
 * ponowny OCR robi się raz na tydzień, czy raz.
 *
 * KOGO WYBIERA — dwie grupy, obie uzasadnione pieniędzmi:
 *
 *   [1] POJAZDY OPODATKOWANE — tam każde pole przekłada się wprost na kwotę.
 *   [2] GRANICZNE Z „NIE PODLEGA" — brak DMC przy modelu ciężarowym albo DMC
 *       dokładnie 3500 (czyli na progu) przy modelu, który na 3,5 t nie wygląda.
 *       To kandydaci na pojazdy, których NIE opodatkowujemy, a powinniśmy —
 *       kierunek droższy niż nadpłata, bo odsetki nalicza urząd.
 *
 * Pomija pojazdy bez skanu w dokumentacji: nie ma czego przetwarzać, a wpis
 * na liście zamieniłby się w błąd w logu przebiegu.
 *
 *     node tools/dr-cele.js "<DT1 wyliczenie.xlsx>" --wyjscie cele.json
 *       [--korzen "<katalog dokumentacji>"] [--tylko-opodatkowane]
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
const WYJSCIE = par('--wyjscie', path.join(DOM, 'Documents', 'taxorder-backupy', 'cele-reocr.json'));
const TYLKO_OPODATKOWANE = argv.includes('--tylko-opodatkowane');

// Uwaga: przy NIEOBECNEJ fladze `indexOf` zwraca -1, co zbiega się z `i-1`
// dla pierwszego argumentu — stąd jawny warunek `>= 0`. Bez niego narzędzie
// odrzucało własny plik wejściowy i twierdziło, że go nie podano.
const flagi = ['--korzen', '--wyjscie'];
const wejscie = argv.find((a, i) => !a.startsWith('--') &&
  !flagi.some(f => { const j = argv.indexOf(f); return j >= 0 && j === i - 1; }));

const klucz = (n) => String(n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const WZ_DOWOD = /dow[oó]d|dow rej|rejestr/i;
const WZ_PLIK = /\.(pdf|jpe?g|png)$/i;

// Modele, których nazwa sama mówi „to nie jest auto do 3,5 tony".
const CIEZAROWE = /\b(atego|actros|axor|arocs|tgl|tgm|tgs|tgx|eurocargo|sprinter|crafter|master|movano|ducato|daily|canter|fuso|scania|volvo\s*f|daf|iveco)\b/i;

/** Numer rejestracyjny z nazwy katalogu → pliki wyglądające na dowód. */
function zbudujIndeks() {
  const idx = new Map();
  const chodz = (dir, glebokosc) => {
    if (glebokosc > 4) return;
    let wpisy; try { wpisy = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    // Katalog bywa nazwany dwoma numerami („EN703910 (stary WL1213N) Man TGE") —
    // indeksujemy pod OBOMA, inaczej pojazd po przerejestrowaniu jest nie do znalezienia.
    const numery = [...path.basename(dir).matchAll(/\b([A-Z]{2,3}[\s-]?[A-Z0-9]{3,6})\b/g)].map(m => klucz(m[1]));
    for (const w of wpisy) {
      const p = path.join(dir, w.name);
      if (w.isDirectory()) { chodz(p, glebokosc + 1); continue; }
      if (!WZ_PLIK.test(w.name) || !WZ_DOWOD.test(w.name)) continue;
      const wArchiwum = /archiw/i.test(p);
      for (const nr of numery) {
        if (nr.length < 5 || nr.length > 10 || !/\d/.test(nr)) continue;
        if (!idx.has(nr)) idx.set(nr, []);
        idx.get(nr).push({ plik: path.relative(KORZEN, p).replace(/\\/g, '/'), archiwum: wArchiwum });
      }
    }
  };
  chodz(KORZEN, 0);
  // Dowód aktualny przed archiwalnym — stary dowód opisuje stan sprzed przerejestrowania.
  for (const lista of idx.values()) lista.sort((a, b) => (a.archiwum ? 1 : 0) - (b.archiwum ? 1 : 0));
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

  const cele = [];
  const przyczyny = { opodatkowany: 0, brakDmc: 0, naProgu: 0 };
  const bezSkanu = [];

  process.stdout.write(D('  buduję indeks skanów... '));
  const indeks = zbudujIndeks();
  console.log(D(`${indeks.size} numerów\n`));

  const dodaj = (nr, powod) => {
    const k = klucz(nr);
    const pliki = indeks.get(k);
    if (!pliki || !pliki.length) { bezSkanu.push(nr); return; }
    if (cele.some(c => klucz(c.nrRej) === k)) return;
    cele.push({ nrRej: nr, plik: pliki[0].plik, _powod: powod });
    przyczyny[powod]++;
  };

  // [1] Wszystko, co podlega podatkowi.
  const wy = wb.getWorksheet('Wyliczenie');
  wy?.eachRow((r, i) => {
    if (i === 1) return;
    const nr = String(r.getCell(1).value || '').trim();
    if (!nr || nr === 'RAZEM') return;
    dodaj(nr, 'opodatkowany');
  });

  // [2] Graniczne z „Nie podlega" — kandydaci na pojazdy, których NIE
  //     opodatkowujemy, a powinniśmy.
  if (!TYLKO_OPODATKOWANE) {
    const np = wb.getWorksheet('Nie podlega');
    const h = []; np?.getRow(1).eachCell((c, i) => h[i] = String(c.value || ''));
    const kol = (frag) => h.findIndex(x => (x || '').includes(frag));
    const iD = kol('DMC [kg]'), iM = kol('Marka'), iMo = kol('Model');
    np?.eachRow((r, i) => {
      if (i === 1) return;
      const nr = String(r.getCell(1).value || '').trim();
      if (!nr) return;
      const dmc = Number(r.getCell(iD).value) || 0;
      const opis = `${r.getCell(iM).value || ''} ${r.getCell(iMo).value || ''}`;
      if (!CIEZAROWE.test(opis)) return;
      if (!dmc) dodaj(nr, 'brakDmc');
      else if (dmc === 3500) dodaj(nr, 'naProgu');
    });
  }

  fs.mkdirSync(path.dirname(cel), { recursive: true });
  fs.writeFileSync(cel, JSON.stringify(cele.map(({ nrRej, plik }) => ({ nrRej, plik })), null, 2), 'utf8');

  console.log(B(`  ${cele.length} celów`));
  console.log(`     opodatkowanych                    ${String(przyczyny.opodatkowany).padStart(4)}`);
  if (!TYLKO_OPODATKOWANE) {
    console.log(`     bez DMC, model ciężarowy          ${String(przyczyny.brakDmc).padStart(4)}   ${D('kandydaci na brakujący podatek')}`);
    console.log(`     DMC dokładnie 3500 (na progu)     ${String(przyczyny.naProgu).padStart(4)}   ${D('próg to 3,5 t — jedna cyfra decyduje')}`);
  }
  console.log(D(`\n     pominięte, bo nie mają skanu: ${bezSkanu.length}`));
  if (bezSkanu.length) console.log(D(`     ${bezSkanu.slice(0, 14).join(' ')}${bezSkanu.length > 14 ? ' …' : ''}`));
  console.log(G(`\n  ✓ zapisano: ${cel}\n`));
  console.log(D('  Dalej:  node tools/dr-ocr-batch-cloudrun.js "' + cel + '" \\'));
  console.log(D('            --wyjscie "<nowy-checkpoint.json>" --limit 0\n'));
})();
