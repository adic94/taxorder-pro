'use strict';
/**
 * Weryfikacja hipotezy: renderPdfToBase64 renderuje tylko stronę 1 PDF?
 * Losuje 20 plików "stały DR" z grupy "Aztec nieodczytany", sprawdza każdą
 * stronę osobno i raportuje, na której stronie Aztec jest wykryty.
 * Wynik: hipoteza potwierdzona — Aztec bywa na str. ≠ 1 (dr-extractor naprawiony).
 *
 * Wymaga: sharp, zxing-wasm, playwright  (npm install w katalogu projektu)
 * Uruchamia mini-serwer HTTP na porcie TEST_PORT (domyślnie 8799) i otwiera
 * Chromium do renderowania PDF — tools/dr-helper.html musi być w tym katalogu.
 * Narzędzie lokalne — nie uruchamiać na CI.
 *
 * Użycie:
 *   node tools/dr-page-test.js <checkpoint.ndjson>
 *
 *   checkpoint.ndjson — plik z dr-extractor (dr-extractor-checkpoint.ndjson);
 *                       ścieżki do PDF-ów muszą być dostępne lokalnie.
 */
const fs   = require('fs');
const path = require('path');
const http = require('http');
const sharp  = require('sharp');
const zxing  = require('zxing-wasm');
const { chromium } = require('playwright');

const CKPT = (() => {
  const p = process.argv[2];
  if (!p) {
    console.error('BŁĄD: Podaj ścieżkę do pliku checkpoint.');
    console.error('Użycie: node tools/dr-page-test.js <checkpoint.ndjson>');
    process.exit(1);
  }
  if (!fs.existsSync(p)) { console.error(`BŁĄD: Plik nie istnieje: ${p}`); process.exit(1); }
  return p;
})();
const TOOLS_DIR   = __dirname;
const PROJECT_DIR = path.join(__dirname, '..');
const TEST_PORT   = 8799;
const HELPER_URL  = `http://localhost:${TEST_PORT}/tools/dr-helper.html`;
const RENDER_TIMEOUT = 30000;
const SAMPLE_SIZE    = 20;
const MAX_PAGES      = 6;
const ZXING_OPTS = { formats: ['Aztec'], tryHarder: true, tryRotate: true, tryInvert: true };

const STALY_RE = /sta[łl]y|sta[łl]e/i;

// ── Mini HTTP server ──────────────────────────────────────────────────────────
function startServer() {
  const MIME = { '.html': 'text/html', '.js': 'application/javascript' };
  const server = http.createServer((req, res) => {
    let rel;
    if (req.url === '/tools/dr-helper.html') rel = path.join(TOOLS_DIR, 'dr-helper.html');
    else if (req.url.startsWith('/modules/'))   rel = path.join(PROJECT_DIR, req.url);
    else { res.writeHead(404); res.end(); return; }
    try {
      const content = fs.readFileSync(rel);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'text/plain' });
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(TEST_PORT, () => resolve(server));
  });
}

// ── Aztec decode helpers ──────────────────────────────────────────────────────
async function _tryDecodeRaw(imgBuf) {
  const { data, info } = await sharp(imgBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = await zxing.readBarcodesFromImageData(
    { data: new Uint8ClampedArray(data), width: info.width, height: info.height }, ZXING_OPTS
  );
  return (r.length && r[0].isValid) ? r[0].text : null;
}

async function detectFromJpeg(imgBuf) {
  let t;
  t = await _tryDecodeRaw(imgBuf).catch(() => null); if (t) return 'orig';
  t = await _tryDecodeRaw(await sharp(imgBuf).greyscale().threshold(128).toBuffer()).catch(() => null); if (t) return 'thresh';
  try {
    const m = await sharp(imgBuf).metadata();
    if (Math.min(m.width, m.height) < 4000) {
      const sc = await sharp(imgBuf).resize({ width: m.width * 2, height: m.height * 2 }).toBuffer();
      t = await _tryDecodeRaw(sc).catch(() => null); if (t) return '2x';
    }
  } catch {}
  return null;
}

// ── Playwright helpers ────────────────────────────────────────────────────────
async function getPageCount(page, b64) {
  try {
    return await Promise.race([
      page.evaluate(b64 => window.getPdfPageCount(b64), b64),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
    ]);
  } catch { return null; }
}

async function renderPage(page, b64, pageNum, scale) {
  try {
    return await Promise.race([
      page.evaluate(({ b64, pageNum, scale }) => window.renderPdfPage(b64, pageNum, scale), { b64, pageNum, scale }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), RENDER_TIMEOUT)),
    ]);
  } catch { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  // 1. Wczytaj checkpoint
  const lines = fs.readFileSync(CKPT, 'utf8').split('\n');
  const unreadPdfs = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (
        e.status === 'unreadable' &&
        e.reason === 'Aztec nieodczytany' &&
        (e.ext || '').toLowerCase() === '.pdf' &&
        STALY_RE.test(e.name || '')
      ) unreadPdfs.push(e);
    } catch {}
  }
  // deduplikuj wg path (ostatni wpis wygrywa — tak jak loadCheckpoint)
  const dedup = new Map();
  for (const e of unreadPdfs) dedup.set(e.path, e);
  const pool = [...dedup.values()];

  console.log(`"Stały" PDF-y nieodczytane w checkpoincie: ${pool.length}`);
  if (pool.length === 0) { console.log('Brak plików do testu.'); return; }

  // 2. Losowa próbka
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const sample   = shuffled.slice(0, Math.min(SAMPLE_SIZE, pool.length));
  console.log(`Próbka: ${sample.length} plików\n`);

  // 3. Uruchom serwer i przeglądarkę
  const server = await startServer();
  console.log(`Serwer HTTP na porcie ${TEST_PORT}`);

  await zxing.prepareZXingModule();
  console.log('zxing-wasm gotowy.');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const bPage   = await browser.newPage();
  bPage.setDefaultTimeout(60000);
  await bPage.goto(HELPER_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await bPage.waitForFunction('typeof window.renderPdfPage === "function"', { timeout: 15000 });
  console.log('Przeglądarka gotowa.\n');

  // 4. Testuj każdy plik
  const pageCounts = { 1: 0, 2: 0, 3: 0, '4+': 0, null: 0 };
  let hitsPage1 = 0, hitsPage2plus = 0;
  const hitDetails = [];

  for (let i = 0; i < sample.length; i++) {
    const e = sample[i];
    process.stdout.write(`[${i+1}/${sample.length}] ${e.name.slice(0, 50).padEnd(51)} `);
    if (!fs.existsSync(e.path)) { process.stdout.write('BRAK PLIKU\n'); continue; }

    let buf;
    try { buf = fs.readFileSync(e.path); } catch { process.stdout.write('BŁĄD ODCZYTU\n'); continue; }
    const b64 = buf.toString('base64');

    // Liczba stron
    const nPages = await getPageCount(bPage, b64);
    if (nPages === null) { process.stdout.write('timeout pageCount\n'); pageCounts.null++; continue; }
    const bucket = nPages === 1 ? '1' : nPages === 2 ? '2' : nPages === 3 ? '3' : '4+';
    pageCounts[bucket]++;

    process.stdout.write(`str=${nPages}  `);

    // Testuj każdą stronę
    let foundPage = null, foundStrategy = null;
    for (let pg = 1; pg <= Math.min(nPages, MAX_PAGES); pg++) {
      const imgB64 = await renderPage(bPage, b64, pg, 4.0);
      if (!imgB64) { process.stdout.write(`[pg${pg}:null] `); continue; }
      const strategy = await detectFromJpeg(Buffer.from(imgB64, 'base64'));
      if (strategy) { foundPage = pg; foundStrategy = strategy; break; }
      process.stdout.write(`[pg${pg}:−] `);
    }

    if (foundPage !== null) {
      if (foundPage === 1) { hitsPage1++; process.stdout.write(`HIT pg1 [${foundStrategy}]\n`); }
      else                 { hitsPage2plus++; process.stdout.write(`HIT pg${foundPage} [${foundStrategy}] ← NOWA STRONA!\n`); }
      hitDetails.push({ name: e.name, nPages, foundPage, foundStrategy });
    } else {
      process.stdout.write('brak Aztec na żadnej stronie\n');
    }
  }

  await browser.close();
  server.close();

  // 5. Raport
  console.log('\n══════════════════════════════════════');
  console.log('  WYNIKI TESTU — STRONY PDF');
  console.log('══════════════════════════════════════');
  console.log(`\nRozkład liczby stron (${sample.length} plików):`);
  for (const [k, n] of Object.entries(pageCounts)) if (n) console.log(`  ${k} str.: ${n}`);
  console.log(`\nAztec znaleziony:`);
  console.log(`  Na stronie 1:          ${hitsPage1}`);
  console.log(`  Na stronie 2 lub dalej: ${hitsPage2plus}  ← NOWE ODCZYTY`);
  console.log(`  Nadal nieodczytane:    ${sample.length - hitsPage1 - hitsPage2plus - pageCounts.null}`);
  if (hitDetails.length) {
    console.log('\nSzczegóły trafień:');
    for (const h of hitDetails)
      console.log(`  [pg${h.foundPage}/${h.nPages}] ${h.name.slice(0, 55)}  strat: ${h.foundStrategy}`);
  }

  console.log('\nHipoteza: renderowanie tylko strony 1 blokuje dekodowanie na kolejnych stronach.');
  if (hitsPage2plus > 0)
    console.log(`POTWIERDZONA — ${hitsPage2plus}/${sample.length} plików ma kod Aztec wyłącznie na stronie ≠ 1.`);
  else
    console.log('NIE POTWIERDZONA w tej próbce — brak trafień na stronach > 1.');
})().catch(e => { console.error('BŁĄD:', e.stack); process.exit(1); });
