#!/usr/bin/env node
/**
 * Podgląd SUROWYCH boxów OCR dla jednego dokumentu — odpowiada na pytanie
 * „czemu pole X się nie wyciąga", którego sam wynik parsera nie rozstrzyga.
 *
 * Dwie zupełnie różne przyczyny wyglądają identycznie w wyniku (pole puste):
 *   (a) OCR w ogóle nie odczytał tekstu z tej rubryki,
 *   (b) OCR odczytał, ale parser geometryczny nie dopasował wartości do etykiety.
 * Bez surowych boxów strojenie parsera jest zgadywaniem — stąd to narzędzie.
 *
 *     node tools/dr-ocr-boxes.js <sciezka-do-pdf-lub-obrazu> [--szukaj TEKST]
 *
 * `--szukaj` filtruje boxy do zawierających podany tekst (bez uwzgl. wielkości liter)
 * — wygodne, gdy szukasz konkretnej rubryki na gęstym dokumencie.
 *
 * ⚠ Wynik zawiera PEŁNY tekst dokumentu (VIN, dane właściciela). Nie zapisuj
 * do repozytorium, nie wklejaj do zgłoszeń bez zamaskowania.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const plik = argv.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
const SZUKAJ = par('--szukaj');
const OCR_URL = process.env.OCR_PYTHON_URL;
const OCR_SECRET = process.env.OCR_PYTHON_SECRET;

if (!plik || !fs.existsSync(plik)) {
  console.error('\nUżycie: node tools/dr-ocr-boxes.js <sciezka-do-pdf-lub-obrazu> [--szukaj TEKST]\n');
  process.exit(2);
}
if (!OCR_URL || !OCR_SECRET) {
  console.error(R('\n  Brak OCR_PYTHON_URL / OCR_PYTHON_SECRET w .env\n'));
  process.exit(2);
}
const ROOT = path.resolve(__dirname, '..');

function opcjeChrome() {
  const args = ['--no-sandbox'];
  const wKontenerze = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(wKontenerze)) return { executablePath: wKontenerze, args };
  return { args };
}

function startPdfServer(pdfBuf) {
  const PDFJS = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
  const PDFWRK = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
  const srv = http.createServer((req, res) => {
    const mapa = {
      '/': ['text/html', Buffer.from('<!doctype html><meta charset="utf-8">')],
      '/pdf.js': ['application/javascript', fs.readFileSync(PDFJS)],
      '/pdf.worker.js': ['application/javascript', fs.readFileSync(PDFWRK)],
      '/obraz': ['application/pdf', pdfBuf],
    };
    const w = mapa[req.url];
    if (!w || !w[1]) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': w[0] });
    res.end(w[1]);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, zamknij: () => srv.close() })));
}

(async () => {
  let imageBase64, mimeType;
  if (/\.pdf$/i.test(plik)) {
    // Ten sam render co produkcja (PDF_OCR z modules/dr-import.js): 150 DPI, JPEG 0.92
    const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));
    const { port, zamknij } = await startPdfServer(fs.readFileSync(plik));
    const browser = await chromium.launch(opcjeChrome());
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.addScriptTag({ url: '/pdf.js' });
    await page.evaluate(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'; });
    imageBase64 = await page.evaluate(async () => {
      const dane = await (await fetch('/obraz')).arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: dane }).promise;
      const strona = await pdf.getPage(1);
      const vp = strona.getViewport({ scale: 150 / 72 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await strona.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      return cv.toDataURL('image/jpeg', 0.92).split(',')[1];
    });
    await browser.close(); zamknij();
    mimeType = 'image/jpeg';
  } else {
    imageBase64 = fs.readFileSync(plik).toString('base64');
    mimeType = /\.png$/i.test(plik) ? 'image/png' : 'image/jpeg';
  }

  console.log(D('  wysyłam do Cloud Run (debugBoxes)...'));
  const r = await fetch(`${OCR_URL.replace(/\/$/, '')}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': OCR_SECRET },
    body: JSON.stringify({ imageBase64, mimeType, debugBoxes: true }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json();
  if (!d.ok) { console.error(R('  Błąd: ' + (d.error || r.status))); process.exit(1); }

  console.log(B(`\n  ${path.basename(plik)} — ${d.rozmiar[0]}x${d.rozmiar[1]}, ${d.boxes.length} boxów\n`));

  let boxy = d.boxes;
  if (SZUKAJ) {
    boxy = boxy.filter(b => b.t.toLowerCase().includes(SZUKAJ.toLowerCase()));
    console.log(D(`  filtr „${SZUKAJ}" → ${boxy.length} boxów\n`));
  }

  // Sortuj jak czyta człowiek: wiersz (zaokrąglony y), potem kolumna (x)
  boxy.sort((a, b) => (Math.round(a.y0 / 20) - Math.round(b.y0 / 20)) || (a.x0 - b.x0));
  for (const b of boxy) {
    const poz = `[${String(b.x0).padStart(4)},${String(b.y0).padStart(4)} ${String(b.x1).padStart(4)},${String(b.y1).padStart(4)}]`;
    console.log(`  ${D(poz)} ${b.s.toFixed(2)}  ${JSON.stringify(b.t)}`);
  }

  console.log(B('\n  WYNIK PARSERA (tylko niepuste):\n'));
  const p = d.parsed || {};
  Object.keys(p).sort().forEach(k => console.log(`  ${G('✓')} ${k.padEnd(22)} = ${JSON.stringify(p[k])}`));
  console.log(B('\n  PO MAPOWANIU NA KLUCZE WORKERA:\n'));
  Object.entries(d.fields || {}).forEach(([k, v]) => console.log(`    ${k.padEnd(18)} = ${JSON.stringify(v)}`));
  console.log(D('\n  ⚠ Wynik zawiera pełny tekst dokumentu — nie zapisuj do repo.\n'));
})();
