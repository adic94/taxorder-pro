#!/usr/bin/env node
/**
 * Druga warstwa dla dokumentów, które dr-ocr-batch.js oddał jako "bez pól (502)"
 * na WSZYSTKICH warstwach kaskady (CF Workers AI + Groq). Przyczyna znaleziona
 * wizualną inspekcją WE6LR80 (24-25.08): treść strony PDF jest narysowana w
 * orientacji PIONOWEJ, mimo że prawdziwy dowód rejestracyjny (seria DR/BAW) jest
 * fizycznie POZIOMY. page.rotate w PDF-ie to 0 — obrót NIE jest we fladze /Rotate,
 * jest zaszyty w samej macierzy transformacji obrazu na stronie, więc pdf.js (i
 * produkcyjny render w modules/dr-import.js) nie prostuje go automatycznie.
 * Modele wizyjne (CF llama, Groq qwen) na tekście obróconym o 90° zwracają puste
 * pola zamiast błędu — stąd 502 "no valid JSON", nie coś głośniejszego.
 *
 * Zweryfikowane: sharp .rotate(-90) na renderze WE6LR80 dał w pełni czytelny,
 * poziomy dokument. .rotate(90) — nadal na boku (w drugą stronę). Stąd kolejność
 * prób: -90 najpierw (najtańsza droga do trafienia w większość klastra), potem
 * 0 (na wypadek, gdyby któryś dokument w tej samej liście był jednak prosty i
 * zawiódł z innego powodu), potem 90, na końcu 180.
 *
 *     node tools/dr-ocr-retry-rotacje.js <cele.json> --wyjscie <checkpoint.json> [--limit 20] [--odstep 1500]
 *
 * Wejście/wyjście — dokładnie ten sam kształt co dr-ocr-batch.js (patrz tam).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { chromium } = require(path.join(__dirname, '..', 'node_modules', '@playwright', 'test'));

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const wejscie = argv.find(a => !a.startsWith('--') && /\.json$/i.test(a));
const wyjscie = par('--wyjscie');
const LIMIT = Number(par('--limit', 20));
const ODSTEP = Number(par('--odstep', 1500));
const KORZEN = par('--korzen', path.join('C:', 'Users', 'acichocki', 'Desktop', 'Dokumentacja pojazdów'));
const BASE = process.env.TEST_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
const ROTACJE = [-90, 0, 90, 180];

if (!wejscie || !fs.existsSync(wejscie) || !wyjscie) {
  console.error('\nUżycie: node tools/dr-ocr-retry-rotacje.js <cele.json> --wyjscie <checkpoint.json> [--limit 20] [--odstep 1500]\n');
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

/** Jak w dr-ocr-batch.js (150 DPI, JPEG 0.92) — dodatkowo obrót o `stopnie` na canvasie. */
async function renderujPdf(browser, port, ustawPdf, sciezkaAbs, stopnie) {
  ustawPdf(fs.readFileSync(sciezkaAbs));
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ url: '/pdf.js' });
  await page.evaluate(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'; });
  const b64 = await page.evaluate(async ({ stopnie }) => {
    const dane = await (await fetch('/obraz')).arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: dane }).promise;
    const strona = await pdf.getPage(1);
    const vp = strona.getViewport({ scale: 150 / 72 });
    const off = document.createElement('canvas');
    off.width = vp.width; off.height = vp.height;
    await strona.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;

    const rad = (stopnie * Math.PI) / 180;
    const obrocone = Math.abs(stopnie % 180) === 90;
    const cv = document.createElement('canvas');
    cv.width = obrocone ? off.height : off.width;
    cv.height = obrocone ? off.width : off.height;
    const ctx = cv.getContext('2d');
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(off, -off.width / 2, -off.height / 2);

    return cv.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, { stopnie });
  await page.close();
  return b64;
}

(async () => {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASS) {
    console.error(R('\n  Brak TEST_EMAIL/TEST_PASS w .env\n'));
    process.exit(2);
  }
  async function zaloguj() {
    const lg = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASS }),
    });
    const ld = await lg.json();
    if (!ld.token) throw new Error('Logowanie nie powiodło się: ' + lg.status);
    return ld.token;
  }
  let token;
  try { token = await zaloguj(); } catch (e) { console.error(R('\n  ' + e.message + '\n')); process.exit(2); }
  let authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function wywolajOcr(imageBase64, mimeType) {
    let r = await fetch(`${BASE}/api/ai/ocr`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    let tresc = await r.text();
    if (!/^\s*[{[]/.test(tresc)) {
      token = await zaloguj();
      authHeaders.Authorization = `Bearer ${token}`;
      r = await fetch(`${BASE}/api/ai/ocr`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      tresc = await r.text();
    }
    return { r, d: JSON.parse(tresc) };
  }

  let cele = JSON.parse(fs.readFileSync(wejscie, 'utf8'));
  const doPobrania = LIMIT ? cele.slice(0, LIMIT) : cele;

  console.log(B(`\n  OCR z próbą obrotów [${ROTACJE.join(', ')}]° — ${doPobrania.length}/${cele.length} dokumentów\n`));

  let wynik = {};
  if (fs.existsSync(cel)) { try { wynik = JSON.parse(fs.readFileSync(cel, 'utf8')); } catch { wynik = {}; } }

  const browser = await chromium.launch(opcjeChrome());
  const { port, ustawPdf, zamknij } = await startPdfServer();
  let ok = 0, pusty = 0, blad = 0;
  const trafienieWgObrotu = {};

  for (let i = 0; i < doPobrania.length; i++) {
    const { nrRej, plik } = doPobrania[i];
    if (wynik[plik]) { console.log(D(`  [${i+1}/${doPobrania.length}] ${nrRej} — już w pliku, pomijam`)); continue; }
    const sciezkaAbs = path.join(KORZEN, plik.replace(/^\//, ''));
    if (!fs.existsSync(sciezkaAbs)) {
      console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} — plik nie istnieje: ${sciezkaAbs}`));
      blad++; continue;
    }
    if (!/\.pdf$/i.test(sciezkaAbs)) {
      console.log(Y(`  [${i+1}/${doPobrania.length}] ${nrRej} — nie PDF, pomijam (ten tryb obraca tylko render PDF)`));
      continue;
    }

    let trafiono = false;
    for (const stopnie of ROTACJE) {
      let imageBase64;
      try {
        imageBase64 = await renderujPdf(browser, port, ustawPdf, sciezkaAbs, stopnie);
      } catch (e) {
        console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} (${stopnie}°) — błąd renderu: ${e.message}`));
        continue;
      }
      try {
        const { r, d } = await wywolajOcr(imageBase64, 'image/jpeg');
        if (d.ok && d.fields) {
          wynik[plik] = { ...d.fields, nrRej: d.fields.nrRej || nrRej, _plik: plik, _zrodlo: 'ocr', _model: d.model, _obrot: stopnie };
          trafienieWgObrotu[stopnie] = (trafienieWgObrotu[stopnie] || 0) + 1;
          const zawKluczowe = ['dmcKg', 'liczbaOsi', 'zawieszenie'].filter(k => d.fields[k]).join(',') || 'brak DT-1-owych';
          console.log(`  [${i+1}/${doPobrania.length}] ${G('✓')} ${nrRej} (${stopnie}°, ${d.model}) — ${zawKluczowe}`);
          ok++; trafiono = true;
          break;
        } else {
          console.log(`  [${i+1}/${doPobrania.length}] ${D('·')} ${nrRej} (${stopnie}°) — bez pól (status ${r.status})`);
        }
      } catch (e) {
        console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} (${stopnie}°) — ${e.message}`));
      }
      await spij(ODSTEP);
    }
    if (!trafiono) {
      console.log(`  [${i+1}/${doPobrania.length}] ${Y('✗')} ${nrRej} — bez pól na ŻADNYM z ${ROTACJE.length} obrotów`);
      pusty++;
    }

    fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
  }
  await browser.close();
  zamknij();

  console.log(B(`\n  Gotowe: ${ok} odczytanych, ${pusty} bez pól na żadnym obrocie, ${blad} błędów`));
  console.log(D(`  Trafienia wg obrotu: ${JSON.stringify(trafienieWgObrotu)}`));
  console.log(`\n  ${G('✓')} zapisano: ${cel}`);
})();
