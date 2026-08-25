#!/usr/bin/env node
/**
 * OCR wsadowy przez serwis PaddleOCR na Cloud Run — BEZPOŚREDNIO, z pominięciem
 * Workera i jego limitu 8 s (`AbortSignal.timeout(8000)` w worker/index.js przy
 * Próbie 0, patrz `PROBA_0_WLACZONA`).
 *
 * DLACZEGO OSOBNE NARZĘDZIE, NIE dr-ocr-batch.js. Tamto woła `/api/ai/ocr` na
 * Workerze (kaskada CF/Groq — Próba 0 jest tam WYŁĄCZONA). To narzędzie woła
 * `/ocr` NA SAMYM Cloud Run, więc dotyczy WYŁĄCZNIE nowego silnika PaddleOCR
 * (lang=pl + parser geometryczny, patrz ocr-service/extractors/paddle_fields.py).
 *
 * ZMIERZONA PRĘDKOŚĆ (25.08, realny dokument, 4 vCPU, bez akceleratora oneDNN —
 * pada na tym CPU niezależnie od wersji paddlepaddle, patrz komentarz w
 * ocr-service/requirements.txt): ~60 s / dokument. Za wolno dla synchronicznego
 * Workera, ALE bez znaczenia dla wsadu — stąd ten plik zamiast czekania na
 * optymalizację. Limit `--odstep` mimo to > 0: Cloud Run ma `maxScale: 10`,
 * zbyt agresywne wysyłanie równolegle mogłoby wysycić instancje i podnieść koszt.
 *
 *     node tools/dr-ocr-batch-cloudrun.js <cele.json> --wyjscie <checkpoint.json> [--limit 10]
 *
 * Wejście/wyjście — ten sam kształt co dr-ocr-batch.js.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const wejscie = argv.find(a => !a.startsWith('--') && /\.json$/i.test(a));
const wyjscie = par('--wyjscie');
const LIMIT = Number(par('--limit', 10));
const ODSTEP = Number(par('--odstep', 2000));
const TIMEOUT_MS = Number(par('--timeout', 90000));
const KORZEN = par('--korzen', path.join('C:', 'Users', 'acichocki', 'Desktop', 'Dokumentacja pojazdów'));
const OCR_URL = process.env.OCR_PYTHON_URL;
const OCR_SECRET = process.env.OCR_PYTHON_SECRET;

if (!wejscie || !fs.existsSync(wejscie) || !wyjscie) {
  console.error('\nUżycie: node tools/dr-ocr-batch-cloudrun.js <cele.json> --wyjscie <checkpoint.json> [--limit 10] [--odstep 2000]\n');
  process.exit(2);
}
if (!OCR_URL || !OCR_SECRET) {
  console.error(R('\n  Brak OCR_PYTHON_URL / OCR_PYTHON_SECRET w .env\n'));
  process.exit(2);
}
const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} leży w drzewie repozytorium (dane pojazdów).\n`));
  process.exit(2);
}

function opcjeChrome() {
  const args = ['--no-sandbox'];
  const wKontenerze = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(wKontenerze)) return { executablePath: wKontenerze, args };
  return { args };
}

const spij = (ms) => new Promise(r => setTimeout(r, ms));
const http = require('http');

function startPdfServer() {
  const PDFJS = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
  const PDFWRK = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
  let biezacyPdf = null;
  const srv = http.createServer((req, res) => {
    const mapa = {
      '/': ['text/html', Buffer.from('<!doctype html><meta charset="utf-8">')],
      '/pdf.js': ['application/javascript', fs.readFileSync(PDFJS)],
      '/pdf.worker.js': ['application/javascript', fs.readFileSync(PDFWRK)],
      '/obraz': ['application/pdf', biezacyPdf],
    };
    const w = mapa[req.url];
    if (!w || !w[1]) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': w[0] });
    res.end(w[1]);
  });
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => resolve({
      port: srv.address().port,
      ustawPdf: (buf) => { biezacyPdf = buf; },
      zamknij: () => srv.close(),
    }));
  });
}

/** Render strony 1 w ustawieniach PDF_OCR z modules/dr-import.js (150 DPI, JPEG 0.92). */
async function renderujPdf(browser, port, ustawPdf, sciezkaAbs) {
  ustawPdf(fs.readFileSync(sciezkaAbs));
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ url: '/pdf.js' });
  await page.evaluate(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'; });
  const b64 = await page.evaluate(async () => {
    const dane = await (await fetch('/obraz')).arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: dane }).promise;
    const strona = await pdf.getPage(1);
    const vp = strona.getViewport({ scale: 150 / 72 });
    const cv = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await strona.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    return cv.toDataURL('image/jpeg', 0.92).split(',')[1];
  });
  await page.close();
  return b64;
}

(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));

  let cele = JSON.parse(fs.readFileSync(wejscie, 'utf8'));
  const doPobrania = LIMIT ? cele.slice(0, LIMIT) : cele;

  console.log(B(`\n  OCR przez Cloud Run (PaddleOCR, bez limitu 8s) — ${doPobrania.length}/${cele.length} dokumentów, timeout ${TIMEOUT_MS}ms/dok.\n`));

  let wynik = {};
  if (fs.existsSync(cel)) { try { wynik = JSON.parse(fs.readFileSync(cel, 'utf8')); } catch { wynik = {}; } }

  const browser = await chromium.launch(opcjeChrome());
  const { port, ustawPdf, zamknij } = await startPdfServer();
  let ok = 0, pusty = 0, blad = 0;

  for (let i = 0; i < doPobrania.length; i++) {
    const { nrRej, plik } = doPobrania[i];
    if (wynik[plik]) { console.log(D(`  [${i+1}/${doPobrania.length}] ${nrRej} — już w pliku, pomijam`)); continue; }
    const sciezkaAbs = path.join(KORZEN, plik.replace(/^\//, ''));
    if (!fs.existsSync(sciezkaAbs)) {
      console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} — plik nie istnieje: ${sciezkaAbs}`));
      blad++; continue;
    }

    let imageBase64, mimeType;
    const t0 = Date.now();
    try {
      if (/\.pdf$/i.test(sciezkaAbs)) {
        imageBase64 = await renderujPdf(browser, port, ustawPdf, sciezkaAbs);
        mimeType = 'image/jpeg';
      } else {
        // Zdjęcia (.jpg/.png) — bez renderu, wprost jako base64. Bez tej gałęzi
        // każdy nie-PDF leciał do renderujPdf() i padał na InvalidPDFException
        // (złapane 25.08: 2 dokumenty z pełnej partii 58 to były .jpg, nie PDF).
        imageBase64 = fs.readFileSync(sciezkaAbs).toString('base64');
        mimeType = /\.png$/i.test(sciezkaAbs) ? 'image/png' : 'image/jpeg';
      }
    } catch (e) {
      console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} — błąd renderu: ${e.message}`));
      blad++; continue;
    }

    try {
      const r = await fetch(`${OCR_URL.replace(/\/$/, '')}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': OCR_SECRET },
        body: JSON.stringify({ imageBase64, mimeType }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const d = await r.json();
      const czasS = ((Date.now() - t0) / 1000).toFixed(1);
      if (d.ok && d.fields && Object.keys(d.fields).length) {
        wynik[plik] = { ...d.fields, nrRej: d.fields.nrRej || nrRej, _plik: plik, _zrodlo: 'ocr', _model: d.model || 'paddleocr-pl' };
        const zawKluczowe = ['dmcKg', 'liczbaOsi', 'zawieszenie'].filter(k => d.fields[k]).join(',') || 'brak DT-1-owych';
        console.log(`  [${i+1}/${doPobrania.length}] ${G('✓')} ${nrRej} (${czasS}s) — ${zawKluczowe}`);
        ok++;
      } else {
        console.log(`  [${i+1}/${doPobrania.length}] ${Y('·')} ${nrRej} (${czasS}s) — bez pól${d.error ? ': ' + String(d.error).slice(0, 100) : ''}`);
        pusty++;
      }
    } catch (e) {
      const czasS = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [${i+1}/${doPobrania.length}] ${R('✗')} ${nrRej} (${czasS}s) — ${e.name === 'TimeoutError' ? `przekroczono ${TIMEOUT_MS}ms` : e.message}`);
      blad++;
    }

    fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
    if (i < doPobrania.length - 1) await spij(ODSTEP);
  }
  await browser.close();
  zamknij();

  console.log(B(`\n  Gotowe: ${ok} odczytanych, ${pusty} bez pól, ${blad} błędów`));
  console.log(`\n  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`\n  Dalej: node tools/dr-excel.js <zestawienie.json> ${path.basename(cel)} --zrodlo ocr --wyjscie <arkusz.xlsx>\n`));
})();
