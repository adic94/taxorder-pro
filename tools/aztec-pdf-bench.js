#!/usr/bin/env node
/**
 * TaxOrder Pro — czy render PDF-a odbiera dekoderowi szansę?
 *
 * Uruchom:
 *   node tools/aztec-pdf-bench.js
 *
 * PYTANIE. Import dowodu przyjmuje PDF-y i renderował je ustawieniem dobranym pod
 * OCR: `scale: 2.0` (baza PDF to 72 DPI, więc 144 DPI) plus przekompresowanie do
 * JPEG 0.92. Dla modelu językowego to bez znaczenia, dla kodu kreskowego — być może
 * wszystko. `tests/unit/dr-pdf-render-test.js` pilnuje tylko, że wartości są dziś
 * inne. Nie mierzy, czy stare NAPRAWDĘ psuły odczyt. To narzędzie mierzy.
 *
 * METODA. Budujemy PDF z kodem Aztec o ZNANYM ładunku, w realnym rozmiarze fizycznym
 * (kod na dowodzie ma ok. 20–30 mm), renderujemy go OBOMA ustawieniami przez to samo
 * pdf.js, co aplikacja, i próbujemy odczytać PRODUKCYJNĄ funkcją `tryAztecFromCanvas`
 * wyciągniętą z app.js. Wynik to tabela: przy jakim rozmiarze kodu które ustawienie
 * jeszcze czyta.
 *
 * ⛔ STAN: NIEROZSTRZYGAJĄCY. NIE UŻYWAJ TEGO JAKO DOWODU — 13.08.2026
 *
 * Narzędzie działa, ale NIE mierzy tego, co deklaruje, i zostawiam je wyłącznie po to,
 * żeby ktoś nie zbudował tego samego drugi raz. Izolacja, która to ujawniła:
 *
 *     sam kod, 8 px/moduł, bez PDF ......... ODCZYTANY
 *     pełna strona A4, 300 DPI PNG ......... brak
 *     ten sam render, wycięty 1:1 do kodu .. brak
 *
 * Dekoder jest więc sprawny, a psuje się coś w drodze przez PDF. Przyczyna: osadzamy
 * kod jako RASTER (PNG 568 px), a pdf.js przy renderze skaluje go W DÓŁ do ~295 px
 * z antyaliasingiem. To rozmywa krawędzie modułów i ten artefakt DOMINUJE nad zmienną
 * (DPI/format), którą chciałem zmierzyć. Prawdziwy skan nie powstaje w ten sposób —
 * tam raster jest zapisem optycznym, nie przeskalowanym rysunkiem wektorowym.
 *
 * Objaw, po którym to poznać: w jednej komórce tabeli 144 DPI + JPEG czytało tam,
 * gdzie 300 DPI + PNG nie czytało. To fizycznie niemożliwe, więc jest podpisem
 * zepsutego przyrządu, a nie wynikiem. Dlatego raport poniżej ODMAWIA wyciągnięcia
 * wniosku, gdy trafi na taką niespójność.
 *
 * ŻEBY TO NAPRAWIĆ, trzeba rysować kod w PDF-ie WEKTOROWO (prostokąt na moduł,
 * przez pdf-lib `drawRectangle`), a nie osadzać rastra — wtedy render w danym DPI
 * jest jedynym miejscem, gdzie powstają piksele, i zmienna zostaje odizolowana.
 * Dopóki tego nie zrobiono, wniosek o wpływie DPI opiera się na rozumowaniu
 * (144 DPI to ~1 px/moduł na dowodzie; ponowna kompresja JPEG dokłada artefakty
 * DCT na krawędziach), nie na pomiarze.
 *
 * Nic nie zapisuje i nie używa żadnych danych produkcyjnych — ładunek jest syntetyczny.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const { wyciagnijDekoder, zbudujDrKontrolny, uruchomChrome } = require('./aztec-compare.js');

const ZXING   = path.join(ROOT, 'node_modules', '@zxing', 'library', 'umd', 'index.min.js');
const PDFLIB  = path.join(ROOT, 'pdf-lib.min.js');
const PDFJS   = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
const PDFWRK  = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');

for (const [nazwa, p] of [['@zxing/library', ZXING], ['pdf-lib.min.js', PDFLIB], ['pdfjs-dist', PDFJS]]) {
  if (!fs.existsSync(p)) { console.error(`Brak ${nazwa} (${p})`); process.exit(2); }
}

/**
 * Wyciąga PRODUKCYJNĄ funkcję dekodującą z app.js — nie kopiuje jej.
 * Ten sam wzorzec, co ekstrakcja dekodera z worker/index.js: kopia rozjechałaby się
 * i narzędzie mierzyłoby coś innego niż aplikacja.
 */
function wyciagnijDekoderZApp() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const OD = 'const _CP1252_ODWROTNA';
  const DO = 'async function tryAztecFromCanvas';
  const i = src.indexOf(OD), j = src.indexOf(DO);
  if (i < 0 || j < 0 || j < i) {
    console.error(`Nie znaleziono kotwic w app.js ("${OD}" / "${DO}"). Popraw kotwice tutaj.`);
    process.exit(2);
  }
  const koniec = src.indexOf('\n}', j);
  if (koniec < 0) { console.error('Nie znaleziono końca tryAztecFromCanvas w app.js'); process.exit(2); }
  return src.slice(i, koniec + 2);
}

// Ustawienia renderu — STARE wzięte z historii, NOWE z bieżącego dr-import.js,
// żeby tabela porównywała rzeczywistość, a nie moje wyobrażenie o niej.
function ustawieniaZModulu() {
  const src = fs.readFileSync(path.join(ROOT, 'modules', 'dr-import.js'), 'utf8');
  const m = src.match(/PDF_AZTEC\s*=\s*\{([^}]*)\}/);
  if (!m) { console.error('Nie znaleziono PDF_AZTEC w modules/dr-import.js'); process.exit(2); }
  const dpi = Number((m[1].match(/dpi:\s*(\d+)/) || [])[1]);
  const format = (m[1].match(/format:\s*'([^']+)'/) || [])[1];
  return { dpi, format };
}

const NOWE = ustawieniaZModulu();
const STARE = { dpi: 144, format: 'image/jpeg', quality: 0.92 };   // scale: 2.0 → 72 × 2
const ROZMIARY_MM = [15, 20, 25, 30, 40];

(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));
  const { _decodeAztecPayload } = wyciagnijDekoder();
  const { bajty: LADUNEK, oczekiwane: POLA } = zbudujDrKontrolny();
  const dekoderZApp = wyciagnijDekoderZApp();

  const typ = f => f.endsWith('.mjs') ? 'text/javascript' : f.endsWith('.js') ? 'application/javascript' : 'text/html';
  const srv = http.createServer((req, res) => {
    const mapa = {
      '/':            [ 'text/html', Buffer.from('<!doctype html><meta charset="utf-8"><title>pdf-bench</title>') ],
      '/zxing.js':    [ typ('.js'),  fs.readFileSync(ZXING) ],
      '/pdf-lib.js':  [ typ('.js'),  fs.readFileSync(PDFLIB) ],
      '/pdf.js':      [ typ('.js'),  fs.readFileSync(PDFJS) ],
      '/pdf.worker.js': [ typ('.js'), fs.readFileSync(PDFWRK) ],
    };
    const w = mapa[req.url];
    if (!w) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': w[0] });
    res.end(w[1]);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const browser = await uruchomChrome(chromium);
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('  [strona]', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ url: '/zxing.js' });
  await page.addScriptTag({ url: '/pdf-lib.js' });
  await page.addScriptTag({ url: '/pdf.js' });
  await page.evaluate(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'; });
  // Produkcyjny dekoder z app.js — wstrzyknięty, nie przepisany.
  await page.addScriptTag({ content: dekoderZApp });

  const wyniki = await page.evaluate(async ({ ladunek, rozmiary, stare, nowe }) => {
    // ── 1. Kod Aztec o znanym ładunku, wyrenderowany bezstratnie ───────────────
    const kod = ZXing.AztecEncoder.encode(Uint8Array.from(ladunek), 33, ZXing.AztecEncoder.DEFAULT_AZTEC_LAYERS);
    const m = kod.getMatrix();
    const MOD = 8;                       // px na moduł w źródłowym PNG — z zapasem
    const c = document.createElement('canvas');
    c.width = m.getWidth() * MOD; c.height = m.getHeight() * MOD;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.fillStyle = '#000';
    for (let y = 0; y < m.getHeight(); y++)
      for (let x = 0; x < m.getWidth(); x++)
        if (m.get(x, y)) cx.fillRect(x * MOD, y * MOD, MOD, MOD);
    const pngKodu = c.toDataURL('image/png');
    const modulow = m.getWidth();

    // ── 2. PDF z tym kodem w zadanym rozmiarze fizycznym ───────────────────────
    // POZYCJA JEST ZMIENNĄ, nie szczegółem. Detektor Aztec w ZXing startuje od
    // WhiteRectangleDetector, który przeszukuje obraz OD ŚRODKA. Kod w rogu pełnej
    // strony A4 może więc być nieodnaleziony niezależnie od rozdzielczości.
    async function zbudujPdf(mm, gdzie) {
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.create();
      const [W, H] = [595.28, 841.89];                             // A4 w punktach (72/cal)
      const strona = doc.addPage([W, H]);
      const png = await doc.embedPng(pngKodu);
      const pt = mm / 25.4 * 72;                                   // mm → punkty PDF
      const poz = gdzie === 'srodek'
        ? { x: (W - pt) / 2, y: (H - pt) / 2 }
        : { x: 60, y: H - 60 - pt };
      strona.drawImage(png, { ...poz, width: pt, height: pt });
      return await doc.save();
    }

    // ── 3. Render dokładnie tak, jak robi to _pdfPage1Blob ─────────────────────
    async function render(pdfBytes, opts) {
      // KOPIA, nie oryginał: pdf.js przekazuje bufor do workera przez postMessage
      // z transferem, co go ODŁĄCZA. Drugi render tych samych bajtów padłby na
      // "ArrayBuffer at index 0 is already detached".
      const pdf = await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      const strona = await pdf.getPage(1);
      const vp = strona.getViewport({ scale: opts.dpi / 72 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await strona.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(r => cv.toBlob(r, opts.format, opts.quality));
      // Powrót do canvasu — tak samo jak _tryAztecBlob w dr-import.js
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; });
      const out = document.createElement('canvas');
      out.width = img.naturalWidth; out.height = img.naturalHeight;
      out.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return { canvas: out, kb: Math.round(blob.size / 1024) };
    }

    // ── 4. Odczyt PRODUKCYJNĄ funkcją, w czterech obrotach jak dr-import.js ────
    async function odczytaj(canvas) {
      for (const deg of [0, 90, 270, 180]) {
        let cel = canvas;
        if (deg) {
          const obr = deg % 180 !== 0;
          const t = document.createElement('canvas');
          t.width = obr ? canvas.height : canvas.width;
          t.height = obr ? canvas.width : canvas.height;
          const tx = t.getContext('2d');
          tx.translate(t.width / 2, t.height / 2); tx.rotate(deg * Math.PI / 180);
          tx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
          cel = t;
        }
        const b = await tryAztecFromCanvas(cel);      // ← produkcyjna, wstrzyknięta z app.js
        if (b) return Array.from(b);
      }
      return null;
    }

    const out = { modulow, wiersze: [] };
    for (const gdzie of ['srodek', 'rog']) {
      for (const mm of rozmiary) {
        const pdfBytes = await zbudujPdf(mm, gdzie);
        const w = { mm, gdzie, pxNaModul: {}, bajty: {}, kb: {} };
        for (const [nazwa, opts] of [['stare', stare], ['nowe', nowe]]) {
          const { canvas, kb } = await render(pdfBytes, opts);
          w.pxNaModul[nazwa] = +((mm / 25.4 * opts.dpi) / modulow).toFixed(2);
          w.kb[nazwa] = kb;
          w.bajty[nazwa] = await odczytaj(canvas);
        }
        out.wiersze.push(w);
      }
    }
    return out;
  }, { ladunek: LADUNEK, rozmiary: ROZMIARY_MM, stare: STARE, nowe: NOWE });

  await browser.close(); srv.close();

  // ── Raport ──────────────────────────────────────────────────────────────────
  const zgodne = (b) => {
    if (!b) return null;
    try {
      const d = _decodeAztecPayload(Uint8Array.from(b));
      const zle = Object.entries(POLA).filter(([k, v]) => d.fields[k] !== v);
      return zle.length ? `pola niezgodne (${zle.length})` : 'OK';
    } catch (e) { return `NRV2E: ${String(e.message).slice(0, 30)}`; }
  };

  console.log(`\nRender PDF a odczyt kodu Aztec — kod ma ${wyniki.modulow}×${wyniki.modulow} modułów\n`);
  console.log(`  STARE ustawienie: ${STARE.dpi} DPI, ${STARE.format} q=${STARE.quality}   (scale: 2.0)`);
  console.log(`  NOWE  ustawienie: ${NOWE.dpi} DPI, ${NOWE.format}   (z modules/dr-import.js)\n`);
  console.log(' pozycja │ rozmiar │   STARE (144 DPI + JPEG)   │    NOWE (300 DPI + PNG)');
  console.log('  kodu    │  kodu   │ px/moduł  wynik            │ px/moduł  wynik');
  console.log('  ────────┼─────────┼────────────────────────────┼──────────────────────────────');
  let staryCzyta = 0, nowyCzyta = 0;
  for (const w of wyniki.wiersze) {
    const s = zgodne(w.bajty.stare), n = zgodne(w.bajty.nowe);
    if (s === 'OK') staryCzyta++;
    if (n === 'OK') nowyCzyta++;
    const kom = (v) => v === 'OK' ? '\x1b[32m✓ odczytany\x1b[0m' : v === null ? '\x1b[31m✗ brak odczytu\x1b[0m' : `\x1b[31m✗ ${v}\x1b[0m`;
    console.log(`  ${w.gdzie.padEnd(7)} │  ${String(w.mm).padStart(2)} mm  │  ${String(w.pxNaModul.stare).padStart(5)}   ${kom(s).padEnd(26)}│  ${String(w.pxNaModul.nowe).padStart(5)}   ${kom(n)}`);
  }

  console.log(`\n  Odczytanych rozmiarów: STARE ${staryCzyta}/${wyniki.wiersze.length}, NOWE ${nowyCzyta}/${wyniki.wiersze.length}\n`);

  // Wykrycie WŁASNEJ niespójności. Jeśli gorsze ustawienie czyta tam, gdzie lepsze nie,
  // to nie jest wynik — to podpis zepsutego przyrządu. Lepiej odmówić wniosku niż podać
  // fałszywy: ten projekt ma już udokumentowane przypadki testów, które świeciły na
  // zielono, mierząc coś innego niż deklarowały.
  const niespojne = wyniki.wiersze.some(w => zgodne(w.bajty.stare) === 'OK' && zgodne(w.bajty.nowe) !== 'OK');
  if (niespojne) {
    console.log('  \x1b[31mPRZYRZĄD NIESPÓJNY — nie wyciągam wniosku.\x1b[0m');
    console.log('  W co najmniej jednej komórce 144 DPI + JPEG odczytało tam, gdzie 300 DPI + PNG nie.');
    console.log('  To fizycznie niemożliwe. Przyczyna jest w konstrukcji testu (raster osadzony');
    console.log('  w PDF-ie i skalowany w dół przy renderze), nie w porównywanych ustawieniach.');
    console.log('  Patrz nagłówek pliku — narzędzie wymaga przepisania na rysowanie wektorowe.\n');
    process.exit(2);
  }
  if (nowyCzyta === 0 && staryCzyta === 0) {
    console.log('  \x1b[31mŻADNA komórka nie została odczytana — test nie różnicuje niczego.\x1b[0m');
    console.log('  Sprawdź najpierw kontrolę: czy dekoder czyta sam kod, bez PDF-a.\n');
    process.exit(2);
  }
  if (nowyCzyta > staryCzyta) {
    console.log('  Zmiana renderu realnie poszerza zakres czytelnych dokumentów.');
    console.log('  Uwaga: render cyfrowy, bez rozmycia i szumu — prawdziwy skan jest TRUDNIEJSZY.\n');
  } else {
    console.log('  Brak mierzalnej przewagi nowego ustawienia w tym zakresie.\n');
  }
  process.exit(nowyCzyta >= staryCzyta ? 0 : 1);
})();
