#!/usr/bin/env node
/**
 * Ponowny OCR dowodów, których dane PRZECZĄ SAMYM SOBIE.
 *
 * PO CO. Arkusz „DR do weryfikacji" (tools/flota-master.js) wymienia wiersze
 * z wewnętrzną sprzecznością: kategoria M1 przy Sprinterze 5,5 t, DMC zespołu
 * mniejsze niż DMC pojazdu, marka bez samogłoski, numer homologacji długości 1.
 * Te dane pochodzą z OCR skanów, a parser był w tym czasie zepsuty na trzy
 * sposoby naraz (obrót strony, brak kontroli jednostek, rozpoznawanie paliwa).
 *
 * Zamiast poprawiać je ręcznie — przepuść te same skany przez NAPRAWIONY parser
 * i pokaż, co się zmieniło. Zmierzone na `NAL061`: przedtem marka „ZASTERA",
 * DMC puste; po naprawie MERCEDES-BENZ, DMC 5500, kategoria N2 zamiast M1.
 * A Sprinter 5,5 t podatkowi PODLEGA — więc to nie kosmetyka.
 *
 * CZEGO TO NARZĘDZIE NIE ROBI. Nie zapisuje niczego do bazy ani do checkpointu.
 * Wypisuje porównanie i zapisuje raport JSON — decyzję o przyjęciu nowej
 * wartości podejmuje człowiek, patrząc na dokument. OCR, który raz się pomylił,
 * nie staje się wiarygodny przez to, że pomylił się inaczej.
 *
 * UŻYCIE
 *   node tools/dr-reocr-podejrzane.js "<arkusz MASTER.xlsx>" [--limit N] [--wyjscie plik.json]
 *
 * WYMAGA w .env: OCR_PYTHON_URL, OCR_PYTHON_SECRET
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const C = (k, s) => `\x1b[${k}m${s}\x1b[0m`;
const G = (s) => C(32, s), Y = (s) => C(33, s), R = (s) => C(31, s), D = (s) => C(2, s), B = (s) => C(1, s);

const KORZEN = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'Dokumentacja pojazdów');
const WZ_DOWOD = /dow[oó]d|dow rej|rejestr/i;
const WZ_PLIK = /\.(pdf|jpe?g|png)$/i;

const args = process.argv.slice(2);
const flaga = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(flaga('--limit', '0')) || 0;
const WYJSCIE = flaga('--wyjscie', path.join(path.dirname(KORZEN), '..', 'Documents', 'taxorder-backupy', 'dr-reocr-podejrzane.json'));
const ARKUSZ = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--limit' && args[args.indexOf(a) - 1] !== '--wyjscie');

const klucz = (n) => String(n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── Indeks skanów: numer rejestracyjny → pliki wyglądające na dowód ──────────
// Numer bierzemy z NAZWY KATALOGU, bo tak zorganizowana jest dokumentacja
// („WB6357U Mercedes Sprinter"). Katalog bywa nazwany dwoma numerami naraz
// („EN703910 (stary WL1213N) Man TGE") — indeksujemy pod OBOMA, inaczej pojazd
// po przerejestrowaniu jest nie do znalezienia.
function zbudujIndeks() {
  const idx = new Map();
  const dodaj = (nr, plik) => {
    const k = klucz(nr);
    if (k.length < 5 || k.length > 10 || !/\d/.test(k) || !/^[A-Z]{2,3}/.test(k)) return;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(plik);
  };
  const chodz = (dir, glebokosc) => {
    if (glebokosc > 4) return;
    let wpisy; try { wpisy = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const numeryKatalogu = [...path.basename(dir).matchAll(/\b([A-Z]{2,3}[\s-]?[A-Z0-9]{3,6})\b/g)].map(m => m[1]);
    for (const w of wpisy) {
      const p = path.join(dir, w.name);
      if (w.isDirectory()) { chodz(p, glebokosc + 1); continue; }
      if (!WZ_PLIK.test(w.name) || !WZ_DOWOD.test(w.name)) continue;
      // Archiwum na końcu listy — dowód aktualny ma pierwszeństwo przed starym.
      const wArchiwum = /archiw/i.test(p);
      for (const nr of numeryKatalogu) dodaj(nr, { sciezka: p, archiwum: wArchiwum });
    }
  };
  chodz(KORZEN, 0);
  for (const lista of idx.values()) lista.sort((a, b) => (a.archiwum ? 1 : 0) - (b.archiwum ? 1 : 0));
  return idx;
}

async function ocr(sciezka) {
  const base = (process.env.OCR_PYTHON_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('OCR_PYTHON_URL nieustawiony w .env');
  const bufor = fs.readFileSync(sciezka);
  const mime = /\.pdf$/i.test(sciezka) ? 'application/pdf'
             : /\.png$/i.test(sciezka) ? 'image/png' : 'image/jpeg';
  const r = await fetch(base + '/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.OCR_PYTHON_SECRET || '' },
    body: JSON.stringify({ imageBase64: bufor.toString('base64'), mimeType: mime }),
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${tekst.slice(0, 120)}`);
  const d = JSON.parse(tekst);
  return d.fields || d;
}

// Pola, których zmiana wpływa na PODATEK. Reszta jest informacyjna — rozróżnienie
// istnieje po to, żeby raport nie tonął w poprawkach literówek w modelu.
const POLA_PODATKOWE = new Set(['dmcKg', 'liczbaOsi', 'zawieszenie', 'kategoria', 'przeznaczenie', 'rodzaj']);

(async () => {
  if (!ARKUSZ || !fs.existsSync(ARKUSZ)) {
    console.log(R('\n  Podaj arkusz MASTER (z tools/flota-master.js)\n'));
    process.exit(1);
  }
  if (!process.env.OCR_PYTHON_SECRET) {
    console.log(R('\n  Brak OCR_PYTHON_SECRET w .env — serwis odrzuci żądania (401)\n'));
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARKUSZ);
  const arkPodejrzane = wb.getWorksheet('DR do weryfikacji');
  const arkFlota = wb.getWorksheet('Flota');
  if (!arkPodejrzane || !arkFlota) {
    console.log(R('\n  Arkusz nie ma zakładek „DR do weryfikacji" i „Flota" — to nie jest MASTER\n'));
    process.exit(1);
  }

  const nagl = []; arkFlota.getRow(1).eachCell((c, i) => nagl[i] = String(c.value || ''));
  const stare = new Map();
  arkFlota.eachRow((r, i) => {
    if (i === 1) return;
    const o = {}; nagl.forEach((k, j) => { if (k) o[k] = r.getCell(j).value; });
    stare.set(klucz(r.getCell(1).value), o);
  });

  const naglP = []; arkPodejrzane.getRow(1).eachCell((c, i) => naglP[i] = String(c.value || ''));
  const iPowod = naglP.indexOf('Co się nie zgadza');
  let cele = [];
  arkPodejrzane.eachRow((r, i) => {
    if (i === 1) return;
    cele.push({ nr: klucz(r.getCell(1).value), powod: String(r.getCell(iPowod).value || '') });
  });
  if (LIMIT) cele = cele.slice(0, LIMIT);

  console.log(B(`\n  Ponowny OCR ${cele.length} podejrzanych dowodów\n`));
  process.stdout.write(D('  buduję indeks skanów... '));
  const indeks = zbudujIndeks();
  console.log(D(`${indeks.size} numerów, ${[...indeks.values()].reduce((a, b) => a + b.length, 0)} plików\n`));

  const raport = [];
  let bezPliku = 0, bledy = 0, zmienione = 0, podatkowe = 0;

  for (let i = 0; i < cele.length; i++) {
    const { nr, powod } = cele[i];
    const pliki = indeks.get(nr);
    const etykieta = `  [${i + 1}/${cele.length}] ${nr.padEnd(11)}`;
    if (!pliki || !pliki.length) {
      console.log(etykieta + D('— brak skanu w dokumentacji'));
      bezPliku++;
      raport.push({ nr, powod, status: 'brak-skanu' });
      continue;
    }
    let nowe;
    try { nowe = await ocr(pliki[0].sciezka); }
    catch (e) {
      console.log(etykieta + R('— OCR: ' + String(e.message).slice(0, 60)));
      bledy++;
      raport.push({ nr, powod, status: 'blad', blad: String(e.message).slice(0, 200) });
      continue;
    }

    const przed = stare.get(nr) || {};
    const mapa = {
      marka: 'Marka', model: 'Model', kategoria: 'Kategoria', dmcKg: 'F.1 DMC [kg]',
      dmcZespolu: 'F.3 DMC zespołu', liczbaOsi: 'L Osie', paliwo: 'P.3 Paliwo',
      nrHomolog: 'K Nr homologacji', przeznaczenie: 'Przeznaczenie', masaWlKg: 'G Masa własna',
    };
    const roznice = [];
    for (const [kNowe, kStare] of Object.entries(mapa)) {
      const a = String(przed[kStare] ?? '').trim();
      const b = String(nowe[kNowe] ?? '').trim();
      if (!b || a === b) continue;
      roznice.push({ pole: kNowe, przed: a || '(puste)', po: b, podatkowe: POLA_PODATKOWE.has(kNowe) });
    }
    const maPodatkowe = roznice.some(r => r.podatkowe);
    if (roznice.length) zmienione++;
    if (maPodatkowe) podatkowe++;

    const opis = roznice.length
      ? roznice.map(r => `${r.podatkowe ? Y(r.pole) : r.pole}: ${r.przed} → ${B(r.po)}`).join(', ')
      : D('bez zmian');
    console.log(etykieta + (roznice.length ? G('✓ ') : D('· ')) + opis.slice(0, 150));

    raport.push({
      nr, powod, status: 'ok', skan: pliki[0].sciezka,
      polaOdczytane: Object.keys(nowe).filter(k => nowe[k] != null && nowe[k] !== '').length,
      roznice, maZmianyPodatkowe: maPodatkowe,
    });
  }

  const kat = path.dirname(WYJSCIE);
  if (path.resolve(kat).startsWith(path.resolve(__dirname, '..'))) {
    console.log(R('\n  ODMAWIAM zapisu do drzewa repozytorium — raport zawiera VIN-y i dane właścicieli.\n'));
    process.exit(1);
  }
  fs.mkdirSync(kat, { recursive: true });
  fs.writeFileSync(WYJSCIE, JSON.stringify(raport, null, 2), 'utf8');

  console.log(B('\n  ── podsumowanie ──'));
  console.log(`  przetworzonych        ${cele.length - bezPliku - bledy}`);
  console.log(`  ze zmianami           ${zmienione}`);
  console.log(Y(`  w tym POLA PODATKOWE  ${podatkowe}`));
  console.log(D(`  bez skanu w dokumentacji ${bezPliku}, błędów OCR ${bledy}`));
  console.log(G(`\n  ✓ raport: ${WYJSCIE}\n`));
  console.log(Y('  ⚠ To NIE jest automatyczna korekta.') + D(' Narzędzie nic nie zapisuje do bazy.'));
  console.log(D('     OCR, który raz się pomylił, nie staje się wiarygodny przez to,'));
  console.log(D('     że pomylił się inaczej — nową wartość potwierdź na dokumencie.\n'));
})();
