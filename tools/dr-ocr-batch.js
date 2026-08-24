#!/usr/bin/env node
/**
 * Ponowny OCR wybranych dowodów przez ŻYWY endpoint produkcyjny — z NAPRAWIONYM
 * promptem (od 24.08 pyta o zawieszenie i normę EURO, których stary checkpoint
 * nie mógł zawierać, bo prompt o nie nie pytał — patrz DR_POLA_OCR w worker/index.js).
 *
 *     node tools/dr-ocr-batch.js <cele.json> --wyjscie <checkpoint.json> [--limit 5] [--odstep 1500]
 *
 * WEJŚCIE: tablica [{ nrRej, plik }], `plik` to ŚCIEŻKA WZGLĘDNA wewnątrz folderu
 * dokumentacji (tak jak zapisuje ją istniejący checkpoint — z wiodącym „/").
 *
 *     [--korzen "C:\...\Dokumentacja pojazdów"]   domyślnie: Desktop\Dokumentacja pojazdów
 *
 * WYJŚCIE: obiekt kluczowany ścieżką pliku, W TYM SAMYM KSZTAŁCIE co
 * `dr-extraction-checkpoint.json` — `tools/dr-excel.js` przyjmuje go bez zmian jako
 * kolejne źródło (`--zrodlo ocr`).
 *
 * DLACZEGO NOWY PLIK, NIE NADPISANIE STAREGO CHECKPOINTU. Stary checkpoint jest
 * dowodem tego, co dał STARY prompt — nadpisanie go zatarłoby możliwość porównania.
 * Ranga źródeł w dr-excel.js i tak sprawia, że przy scalaniu wygrywa nowsza wartość
 * tylko wtedy, gdy jest lepsza (obie mają rangę „ocr" — patrz sekcja Konflikty, jeśli
 * się rozjadą).
 *
 * KOSZT. Próba 1 (CF Workers AI, `@cf/meta/llama-3.2-11b-vision-instruct`) na darmowym
 * planie ma limit 10 000 neuronów/dobę. Nieznany dokładny koszt jednego wywołania —
 * dlatego domyślny `--limit` jest MAŁY. Zacznij od kilkunastu, obejrzyj `model` w wyniku
 * (paddleocr/cf-workers-ai/groq — które warstwy faktycznie odpowiadały), dopiero potem
 * zwiększaj.
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
const LIMIT = Number(par('--limit', 15));
const ODSTEP = Number(par('--odstep', 1500));
const KORZEN = par('--korzen', path.join('C:', 'Users', 'acichocki', 'Desktop', 'Dokumentacja pojazdów'));
const BASE = process.env.TEST_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';

if (!wejscie || !fs.existsSync(wejscie) || !wyjscie) {
  console.error('\nUżycie: node tools/dr-ocr-batch.js <cele.json> --wyjscie <checkpoint.json> [--limit 15] [--odstep 1500]\n');
  console.error('Wejście: tablica [{ nrRej, plik }], plik = ścieżka względna w folderze dokumentacji.\n');
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

/**
 * Serwer lokalny dla pdf.js — worker MUSI być wczytany przez http(s), nie file://
 * (pdf.js odrzuca fake-worker fallback z lokalnego pliku). Ten sam wzorzec, co
 * w tools/aztec-compare.js i innych narzędziach tej sesji. Jeden serwer na CAŁY
 * przebieg (nie per plik) — aktualny PDF podmieniany w zmiennej `biezacyPdf`.
 */
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

/** Render strony 1 PDF-a w ustawieniach PDF_OCR z modules/dr-import.js (150 DPI, JPEG 0.92) — NIE PDF_AZTEC. */
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
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASS) {
    console.error(R('\n  Brak TEST_EMAIL/TEST_PASS w .env\n'));
    process.exit(2);
  }
  /**
   * Token sesji wygasa w trakcie dlugiego przebiegu (47 dokumentow x kilka-kilkanascie
   * sekund kazdy, bo martwy Railway w Probie 0 dokłada opoznienie zanim spadnie do
   * dzialajacej warstwy). Po wygasnieciu API oddaje strone bledu HTML zamiast JSON —
   * `r.json()` rzuca "Unexpected token '<'". Znalezione na pelnym przebiegu 24.08:
   * 15/47 dokumentow oznaczonych jako "blad" bylo w rzeczywistosci tym samym dokumentem
   * co poprzednio, tylko z martwym tokenem — nie prawdziwa porazka OCR.
   */
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
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let cele = JSON.parse(fs.readFileSync(wejscie, 'utf8'));
  const doPobrania = LIMIT ? cele.slice(0, LIMIT) : cele;

  console.log(B(`\n  Ponowny OCR — ${doPobrania.length}/${cele.length} dokumentów (naprawiony prompt: zawieszenie + normaEuro)\n`));

  let wynik = {};
  if (fs.existsSync(cel)) { try { wynik = JSON.parse(fs.readFileSync(cel, 'utf8')); } catch { wynik = {}; } }

  const browser = await chromium.launch(opcjeChrome());
  const { port, ustawPdf, zamknij } = await startPdfServer();
  let ok = 0, pusty = 0, blad = 0;
  const modeleUzyte = {};

  for (let i = 0; i < doPobrania.length; i++) {
    const { nrRej, plik } = doPobrania[i];
    if (wynik[plik]) { console.log(D(`  [${i+1}/${doPobrania.length}] ${nrRej} — już w pliku, pomijam`)); continue; }
    const sciezkaAbs = path.join(KORZEN, plik.replace(/^\//, ''));
    if (!fs.existsSync(sciezkaAbs)) {
      console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} — plik nie istnieje: ${sciezkaAbs}`));
      blad++; continue;
    }

    let imageBase64, mimeType;
    try {
      if (/\.pdf$/i.test(sciezkaAbs)) {
        imageBase64 = await renderujPdf(browser, port, ustawPdf, sciezkaAbs);
        mimeType = 'image/jpeg';
      } else {
        imageBase64 = fs.readFileSync(sciezkaAbs).toString('base64');
        mimeType = /\.png$/i.test(sciezkaAbs) ? 'image/png' : 'image/jpeg';
      }
    } catch (e) {
      console.log(R(`  [${i+1}/${doPobrania.length}] ${nrRej} — błąd renderu: ${e.message}`));
      blad++; continue;
    }

    try {
      let r = await fetch(`${BASE}/api/ai/ocr`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      let tresc = await r.text();
      if (!/^\s*[{[]/.test(tresc)) {
        // Nie-JSON = strona bledu (najczesciej wygasly token). Jedno ponowienie ze
        // swiezym logowaniem, zanim uznamy to za prawdziwa porazke dokumentu.
        console.log(D(`  [${i+1}/${doPobrania.length}] ${nrRej} — token wygasl, ponawiam logowanie`));
        token = await zaloguj();
        authHeaders.Authorization = `Bearer ${token}`;
        r = await fetch(`${BASE}/api/ai/ocr`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ imageBase64, mimeType }),
        });
        tresc = await r.text();
      }
      const d = JSON.parse(tresc);
      if (d.ok && d.fields) {
        wynik[plik] = { ...d.fields, nrRej: d.fields.nrRej || nrRej, _plik: plik, _zrodlo: 'ocr', _model: d.model };
        modeleUzyte[d.model] = (modeleUzyte[d.model] || 0) + 1;
        const zawKluczowe = ['dmcKg', 'liczbaOsi', 'zawieszenie'].filter(k => d.fields[k]).join(',') || 'brak DT-1-owych';
        console.log(`  [${i+1}/${doPobrania.length}] ${G('✓')} ${nrRej} (${d.model}) — ${zawKluczowe}`);
        ok++;
      } else {
        console.log(`  [${i+1}/${doPobrania.length}] ${Y('·')} ${nrRej} — bez pól (status ${r.status})`);
        pusty++;
      }
    } catch (e) {
      console.log(`  [${i+1}/${doPobrania.length}] ${R('✗')} ${nrRej} — ${e.message}`);
      blad++;
    }

    fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
    if (i < doPobrania.length - 1) await spij(ODSTEP);
  }
  await browser.close();
  zamknij();

  console.log(B(`\n  Gotowe: ${ok} odczytanych, ${pusty} bez pól, ${blad} błędów`));
  console.log(D(`  Warstwy, które odpowiadały: ${JSON.stringify(modeleUzyte)}`));
  console.log(`\n  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`\n  Dalej: node tools/dr-excel.js <zestawienie.json> ${path.basename(cel)} --zrodlo ocr --wyjscie <arkusz.xlsx>\n`));
})();
