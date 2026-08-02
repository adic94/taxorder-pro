#!/usr/bin/env node
/**
 * DR Extractor — batch processor dowodów rejestracyjnych
 *
 * Użycie:
 *   node tools/dr-extractor.js
 *   node tools/dr-extractor.js --retry-unreadable   (ponawia tylko "Aztec nieodczytany")
 *
 * Samodzielny mini-serwer HTTP dla dr-helper.html (port 8797, bez wranglera).
 * Obrazy (JPG/PNG/TIFF) przetwarzane bezpośrednio przez zxing-wasm w Node.js.
 * Wyjście: ..\flota-dowody.xlsx (POZA repozytorium)
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const http    = require('http');
const sharp   = require('sharp');
const zxing   = require('zxing-wasm');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');

// ── Ścieżki ────────────────────────────────────────────────────────────────────
const SHARE_PATH       = 'C:\\Users\\acichocki\\Desktop\\Dokumentacja pojazdów';
const OUTPUT_PATH      = path.join(__dirname, '..', '..', 'flota-dowody.xlsx');
const CHECKPOINT_PATH  = path.join(__dirname, '..', '..', 'dr-extractor-checkpoint.ndjson');
const HELPER_PORT      = 8797;
const HELPER_URL       = `http://localhost:${HELPER_PORT}/tools/dr-helper.html`;
const PROJECT_DIR      = path.join(__dirname, '..');

// ── Mini HTTP server dla dr-helper.html ────────────────────────────────────────
function startHelperServer() {
  const MIME = { '.html': 'text/html', '.js': 'application/javascript' };
  const server = http.createServer((req, res) => {
    let filePath;
    if (req.url === '/tools/dr-helper.html') filePath = path.join(__dirname, 'dr-helper.html');
    else if (req.url.startsWith('/modules/'))  filePath = path.join(PROJECT_DIR, req.url);
    else { res.writeHead(404); res.end(); return; }
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(HELPER_PORT, () => resolve(server));
  });
}

// ── Checkpoint (NDJSON, append-only) ──────────────────────────────────────────
// Klucz: pełna ścieżka + mtime + size — zmieniły się → plik przetworzy się ponownie.
function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return new Map();
  const map = new Map();
  try {
    for (const line of fs.readFileSync(CHECKPOINT_PATH, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const e = JSON.parse(line); if (e.path) map.set(e.path, e); } catch {}
    }
  } catch {}
  return map;
}

function saveCheckpointEntry(entry) {
  try { fs.appendFileSync(CHECKPOINT_PATH, JSON.stringify(entry) + '\n', 'utf8'); } catch {}
}

// Słowa kluczowe w nazwie pliku sugerujące dowód rejestracyjny
const DR_NAME_KEYWORDS = [
  'dowód', 'dowod', 'down d', 'stały', 'staly', 'rejstr', 'rejestr',
  'pasas',   // litewskie "pažymėjimas"
  ' dr ', 'dr.', '_dr_', '-dr-',
  'registration', 'zulassung',  // angielski, niemiecki
];
// Słowa w nazwie pliku które WYKLUCZAJĄ DR (inne dokumenty pojazdu)
const DR_NAME_EXCLUDE = [
  'leasing', 'faktura', 'serwis', 'obsług', 'przegląd', 'przeglad',
  'warrant', 'cert', 'instrukcj', 'harmonogram', 'palnomocnictw',
  'pełnomocnictw', 'viatoll', 'e-toll', 'raport', 'protokół', 'protokol',
  'thumbs.db', '.tmp', 'decyzja', 'wniosek', 'pokwitowanie', 'zaśw',
];

// Heurystyka polis ubezpieczeniowych — dopasowanie → arkusz "Pominięte"
const INSURANCE_KW = [
  'polisa', 'ubezpiecz', 'pzu', 'warta', 'ergo', 'hestia',
  'allianz', 'generali', 'uniqa', 'link4',
];
// OC i AC jako samodzielne tokeny (nie jako część numeru rej./VIN)
const INSURANCE_OC_AC = /(?<![a-z\d])(oc|ac)(?![a-z\d])/;

function insuranceMatch(filename, dirName) {
  const text = (filename + ' ' + dirName).toLowerCase().replace(/[_\-]/g, ' ');
  for (const kw of INSURANCE_KW) {
    if (text.includes(kw)) return kw;
  }
  const m = INSURANCE_OC_AC.exec(text);
  if (m) return m[1].toUpperCase();
  return null;
}

function isDrCandidate(filename) {
  const lower = filename.toLowerCase();
  // Wyklucz po rozszerzeniu — tylko PDF i obrazy skanów
  const ext = path.extname(lower);
  if (!['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext)) return false;
  // Wyklucz pliki systemowe
  if (DR_NAME_EXCLUDE.some(kw => lower.includes(kw))) return false;
  // Akceptuj jeśli pasuje słowo kluczowe
  if (DR_NAME_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Akceptuj też skany bez opisowej nazwy (Skan_*, zeskanowane*) — mogą być DR
  if (/^skan|^zeskan|^scan/.test(lower)) return true;
  return false;
}

// ── NRV2E Decompressor ────────────────────────────────────────────────────────
// MSB-first bit reading, direct getByte() dla literałów i offsetu low-byte.
// Wariant B wg testów na rzeczywistych polskich DR (WB6385U Mercedes Sprinter).
function nrv2eDecompress(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let pos = 0, bitBuf = 0, bitCnt = 0;
  function getBit() {
    if (bitCnt === 0) { bitBuf = buf[pos++] || 0; bitCnt = 8; }
    return (bitBuf >> (--bitCnt)) & 1;
  }
  function getByte() { return buf[pos++] || 0; }
  const out = new Uint8Array(outputLen);
  let p = 0, lastOff = 1;
  while (pos < buf.length && p < outputLen) {
    if (getBit() === 1) { out[p++] = getByte(); continue; }
    let off = 1, len = 0;
    for (;;) {
      off = off * 2 + getBit();
      if (getBit() === 1) break;
      off = (off - 1) * 2 + getBit();
    }
    if (off === 2) {
      off = lastOff; len = getBit();
    } else {
      off = (off - 3) * 0x100 + getByte();
      if (off === 0xffffffff) break;
      len = (off ^ 0xffffffff) & 1;
      off >>= 1;
      lastOff = ++off;
    }
    if (len) { len = 1 + getBit(); }
    else if (getBit() === 1) { len = 3 + getBit(); }
    else { len++; do { len = len * 2 + getBit(); } while (getBit() === 0); len += 3; }
    if (off > 0x500) len++;
    let src = p - off;
    if (src < 0) throw new Error('NRV2E: nieprawidłowy offset');
    for (let i = 0; i <= len && p < outputLen; i++) out[p++] = out[src++];
  }
  return out;
}

// ── Mapowanie pól polskiego DR (nowy format, >40 pól) ─────────────────────────
// Rozszerzony o dodatkowe pola w stosunku do parsera w worker/index.js
const DR_NEW = {
  seriaDr:         1,   // seria dokumentu
  nrRej:           7,   // A — numer rejestracyjny
  marka:           8,   // D.1 — marka
  typ:             9,   // D.2 — typ (wariant)
  wariant:        10,   // D.2 cd.
  wersja:         11,   // D.2 cd.
  model:          12,   // D.3 — model handlowy
  vin:            13,   // E — VIN
  wlascicielTyp:  14,   // data ostatniej aktualizacji danych (pos 14)
  // 15-37: dane właściciela i organu wydającego (POMIJAMY — RODO)
  // pos 31: NIP właściciela, pos 32: kod pocztowy, pos 33: miasto — NIE są to pola pojazdu
  dmcKg:          38,   // F.1 — DMC (kg)
  dmcKg2:         39,   // F.2 — DMC z ładunkiem (kg)
  dmcZespolu:     40,   // F.3 — DMC zespołu (kg)
  masaWlKg:       41,   // G — masa własna (kg)
  kategoria:      42,   // J — kategoria UE
  // pos 43: K — numer homologacji (np. "PL*2770*06")
  liczbaOsi:      44,   // L — liczba osi (POTWIERDZONE: WZ899GJ=3, WK63469=2)
  zawieszenie:    45,   // M.1 / zawieszenie
  przyczepaBH:    46,   // O.1 — przyczepa z hamulcem (kg)
  przyczepaBNH:   47,   // O.2 — przyczepa bez hamulca (kg)
  pojSilnika:     48,   // P.1 — pojemność silnika (cm³)
  mocKW:          49,   // P.2 — moc maksymalna (kW)
  paliwo:         50,   // P.3 — rodzaj paliwa
  dataRej:        51,   // B — data pierwszej rejestracji
  miejscaSied:    52,   // S.1 — miejsca siedzące
  normaEmisji:    53,   // norma emisji (euro)
  rodzajPojazdu:  54,   // rodzaj pojazdu (np. "SAMOCHÓD CIĘŻAROWY", "CIĄGNIK SAMOCHODOWY")
  przeznaczenie:  55,   // przeznaczenie (np. "PRZEWÓZ WODY")
  rokProdukcji:   56,   // rok produkcji
};
const DR_OLD = { nrRej:4, marka:5, typ:6, vin:10, dataRej:48 };
const FUEL = {
  P:'PB (Benzyna)', D:'ON (Olej napędowy)', M:'LNG (Metan)',
  LPG:'LPG', CNG:'CNG', LNG:'LNG', H:'Hybrydowy', BD:'Biodiesel',
  EE:'Elektryczny', E85:'E85',
};
const WLASCICIEL = { P: 'firma', F: 'osoba fizyczna' };

// Aztec tekst to dane base64-kodowane (zxing-wasm zwraca tekst ASCII).
// Dekodujemy base64 → bytes, pierwsze 4 bajty = outputLen LE, reszta = NRV2E.
function parseAztecText(aztecText) {
  if (!aztecText || typeof aztecText !== 'string') throw new Error('Brak tekstu Aztec');
  const bytes = Buffer.from(aztecText, 'base64');
  if (bytes.length < 8) throw new Error(`Za mało bajtów po base64 (${bytes.length})`);
  const outputLen = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] * 0x1000000);
  if (outputLen < 10 || outputLen > 131072) throw new Error(`Nieprawidłowa długość: ${outputLen}`);
  const decompressed = nrv2eDecompress(bytes.slice(4), outputLen);
  const text = Buffer.from(decompressed).toString('utf16le');
  const fields = text.split(/[|\n]/);
  const isNew = fields.length > 40;
  const map = isNew ? DR_NEW : DR_OLD;
  const result = {};
  for (const [key, idx] of Object.entries(map)) {
    const v = (fields[idx] || '').trim().replace(/\r/g, '');
    if (v) result[key] = v;
  }
  if (result.paliwo) result.paliwo = FUEL[result.paliwo] || result.paliwo;
  if (result.wlascicielTyp) result.wlascicielTyp = WLASCICIEL[result.wlascicielTyp] || result.wlascicielTyp;
  for (const k of ['dataRej']) {
    if (!result[k]) continue;
    if (/^\d{8}$/.test(result[k])) {
      result[k] = result[k].slice(6,8)+'.'+result[k].slice(4,6)+'.'+result[k].slice(0,4);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(result[k])) {
      const [y,m,d] = result[k].split('-');
      result[k] = d+'.'+m+'.'+y;
    }
  }
  result._format = isNew ? 'new' : 'old';
  result._fieldCount = fields.length;
  return result;
}

// ── Detekcja Aztec — obraz (Node.js, bez przeglądarki) ────────────────────────
const ZXING_OPTS = { formats: ['Aztec'], tryHarder: true, tryRotate: true, tryInvert: true };

async function _tryDecodeRaw(imgBuf) {
  const { data, info } = await sharp(imgBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = await zxing.readBarcodesFromImageData(
    { data: new Uint8ClampedArray(data), width: info.width, height: info.height }, ZXING_OPTS
  );
  return (r.length && r[0].isValid) ? r[0].text : null;
}

async function detectAztecFromImageBuffer(buf, attemptOffset = 0) {
  let n = attemptOffset;

  // Próba 1: oryginalny obraz (kolor)
  try {
    n++;
    const t = await _tryDecodeRaw(buf);
    if (t) return { text: t, strategy: 'img-orig', attempts: n };
  } catch { /* next */ }

  // Próba 2: grayscale + threshold 128
  try {
    n++;
    const t = await _tryDecodeRaw(await sharp(buf).greyscale().threshold(128).toBuffer());
    if (t) return { text: t, strategy: 'img-thresh128', attempts: n };
  } catch { /* next */ }

  // Próba 3: normalize + threshold 128
  try {
    n++;
    const t = await _tryDecodeRaw(await sharp(buf).greyscale().normalize().threshold(128).toBuffer());
    if (t) return { text: t, strategy: 'img-norm-thresh', attempts: n };
  } catch { /* next */ }

  // Próba 4: 2× upscale (dla skanów gdzie Aztec <800px)
  try {
    const meta = await sharp(buf).metadata();
    if (Math.min(meta.width, meta.height) < 4000) {
      n++;
      const scaled = await sharp(buf).resize({ width: meta.width * 2, height: meta.height * 2 }).toBuffer();
      const t = await _tryDecodeRaw(scaled);
      if (t) return { text: t, strategy: 'img-2x', attempts: n };
    }
  } catch { /* ignore */ }

  return null;
}

// ── PdfRenderer — zarządza przeglądarką i timeoutami renderowania ─────────────
// Promise.race z 30s timeoutem; po timeoucie strona jest zamykana i tworzona na nowo.
// 3 timeouty z rzędu (niekoniecznie ten sam plik) → restart całej przeglądarki.
class PdfRenderer {
  constructor() { this.browser = null; this.page = null; this.consecutiveTimeouts = 0; }

  async init() {
    try {
      this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    } catch {
      this.browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
    }
    await this._newPage();
  }

  async _newPage() {
    if (this.page) { try { await this.page.close(); } catch {} }
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(90000);
    await this.page.goto(HELPER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForFunction('typeof window.renderPdfPage === "function"', { timeout: 20000 });
  }

  async _restartBrowser() {
    process.stdout.write('\n  [RENDERER] Restart przeglądarki (3 timeouty z rzędu)…\n');
    if (this.browser) { try { await this.browser.close(); } catch {} }
    try {
      this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    } catch {
      this.browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
    }
    await this._newPage();
    this.consecutiveTimeouts = 0;
  }

  // Zwraca liczbę stron PDF | null (błąd/timeout)
  async getPageCountSafe(b64) {
    try {
      return await Promise.race([
        this.page.evaluate(b64 => window.getPdfPageCount(b64), b64),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout pagecount')), 10000)),
      ]);
    } catch { return null; }
  }

  // Zwraca imgB64 (sukces) | '__timeout__' (timeout) | null (inny błąd)
  async renderPageSafe(b64, pageNum, scale) {
    try {
      const imgB64 = await Promise.race([
        this.page.evaluate(({ b64, pageNum, scale }) => window.renderPdfPage(b64, pageNum, scale), { b64, pageNum, scale }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout renderowania')), 30000)),
      ]);
      this.consecutiveTimeouts = 0;
      return imgB64;
    } catch (e) {
      if (e.message === 'timeout renderowania') {
        this.consecutiveTimeouts++;
        process.stdout.write(`\n  [RENDERER] Timeout #${this.consecutiveTimeouts} (pg=${pageNum} sc=${scale})…`);
        if (this.consecutiveTimeouts >= 3) {
          await this._restartBrowser();
        } else {
          try { await this._newPage(); } catch {}
        }
        return '__timeout__';
      }
      return null;
    }
  }

  async close() { if (this.browser) { try { await this.browser.close(); } catch {} } }
}

const PDF_MAX_PAGES = 6;

async function detectAztecFromPdf(buf, renderer) {
  const b64 = buf.toString('base64');
  let hadTimeout = false;

  const nPages = await renderer.getPageCountSafe(b64);
  const maxPg  = nPages !== null ? Math.min(nPages, PDF_MAX_PAGES) : 1;

  let attemptOffset = 0;
  for (let pg = 1; pg <= maxPg; pg++) {
    for (const scale of [4.0, 6.0, 8.0]) {
      const imgB64 = await renderer.renderPageSafe(b64, pg, scale);
      if (!imgB64 || imgB64 === '__timeout__') {
        if (imgB64 === '__timeout__') hadTimeout = true;
        attemptOffset += 4;
        continue;
      }
      const result = await detectAztecFromImageBuffer(Buffer.from(imgB64, 'base64'), attemptOffset);
      if (result) return { ...result, strategy: `pdf-pg${pg}-sc${scale}-${result.strategy}`, pageNum: pg, scale };
      attemptOffset += 4;
    }
  }
  return hadTimeout ? { timeout: true } : null;
}

// ── Walidacja VIN ─────────────────────────────────────────────────────────────
function validateVin(vin) {
  if (!vin || typeof vin !== 'string') return { valid: false, reason: 'brak VIN' };
  const v = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length !== 17) return { valid: false, reason: `długość ${v.length} ≠ 17` };
  if (/[IOQ]/.test(v)) return { valid: false, reason: 'zawiera niedozwoloną literę I/O/Q' };
  return { valid: true, vin: v };
}

// ── Kontrola duplikatów VIN ───────────────────────────────────────────────────
// Zwraca mapę VIN → lista par (nrRej, dataRej) z nachodzącymi datami.
// "Nachodzące" = dwie różne tablice mają daty rejestracji w odległości ≤ 30 dni.
// Prawidłowe przerejestrowanie może nastąpić w 1 dzień; flaga informacyjna,
// nie twarde odrzucenie — decyzja należy do użytkownika.
function checkVinConflicts(vehicles) {
  const conflicts = new Map();  // VIN → [ { plates, dates, gapDays } ]
  for (const [vin, vdata] of vehicles.entries()) {
    const dated = vdata.rejestracje.filter(r => r._dateParsed);
    if (dated.length < 2) continue;
    const issues = [];
    for (let i = 1; i < dated.length; i++) {
      const prev = dated[i - 1];
      const curr = dated[i];
      const gapDays = Math.round((curr._dateParsed - prev._dateParsed) / 86400000);
      if (gapDays <= 30) {
        issues.push({
          plates:  [prev.nrRej, curr.nrRej],
          dates:   [prev.dataRej, curr.dataRej],
          gapDays,
        });
      }
    }
    if (issues.length) conflicts.set(vin, issues);
  }
  return conflicts;
}

// ── Lista plików ───────────────────────────────────────────────────────────────
const DOC_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff']);

// Skanuje wszystkie pliki z rozszerzeniami dokumentów bez filtrowania nazwy.
// Zwraca też nazwę katalogu bezpośredniego rodzica (dir) — potrzebna do
// heurystyki polis (np. katalog "Polisy OC" → wszystkie pliki w nim to polisy).
function listAllDocFiles(dirPath, maxDepth = 5) {
  const result = [];
  const stack = [{ dir: dirPath, depth: 0 }];
  while (stack.length) {
    const { dir: cur, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) {
      process.stderr.write(`  [SKIP] ${cur}: ${e.message}\n`); continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (DOC_EXTS.has(ext)) {
        result.push({ path: full, name: e.name, ext, dir: path.basename(cur) });
      }
    }
  }
  return result;
}

function listDocFiles(dirPath, maxDepth = 3) {
  const result = [];
  const stack = [{ dir: dirPath, depth: 0 }];
  while (stack.length) {
    const { dir: cur, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) {
      process.stderr.write(`  [SKIP] ${cur}: ${e.message}\n`); continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (isDrCandidate(e.name)) result.push({ path: full, name: e.name, ext: path.extname(e.name).toLowerCase() });
    }
  }
  return result;
}

// ── Parsowanie daty DD.MM.YYYY → Date ─────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

// ── Generowanie Excel ──────────────────────────────────────────────────────────
async function generateExcel(vehicles, docRows, unreadable, skippedFiles) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TaxOrder Pro — DR Extractor';
  wb.created = new Date();

  // Styl nagłówka
  const hdrStyle = {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right:  { style: 'thin', color: { argb: 'FF000000' } },
    },
  };
  const conflictFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const dateFmt = 'DD.MM.YYYY';

  // ── Arkusz 1: Pojazdy ─────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Pojazdy');

  // Zbierz max liczbę nr_rej
  let maxRej = 1;
  for (const v of vehicles.values()) maxRej = Math.max(maxRej, v.rejestracje.length);

  const rejCols = [];
  for (let i = 1; i <= maxRej; i++) rejCols.push(`nr_rej_${i}`, `data_rej_${i}`);

  const cols1 = [
    // Identyfikacja
    { header: 'VIN',                     key: 'vin',             width: 20 },
    { header: 'Marka',                   key: 'marka',           width: 14 },
    { header: 'Model',                   key: 'model',           width: 16 },
    { header: 'Typ (D.2)',               key: 'typ',             width: 14 },
    { header: 'Rodzaj pojazdu',          key: 'rodzajPojazdu',   width: 16 },
    { header: 'Podrodzaj',              key: 'podrodzaj',       width: 14 },
    { header: 'Przeznaczenie',          key: 'przeznaczenie',   width: 16 },
    { header: 'Rok produkcji',          key: 'rokProdukcji',    width: 12 },
    { header: 'Kategoria (J)',          key: 'kategoria',       width: 12 },
    { header: 'Data 1. rejestracji',    key: 'dataRej',         width: 16, style: { numFmt: dateFmt } },
    { header: 'Właściciel typ',         key: 'wlascicielTyp',   width: 14 },
    // Numery rejestracyjne
    ...Array.from({ length: maxRej }, (_, i) => [
      { header: `Nr rej. ${i+1}`,    key: `nr_rej_${i+1}`,    width: 13 },
      { header: `Data rej. ${i+1}`,  key: `data_rej_${i+1}`,  width: 13, style: { numFmt: dateFmt } },
    ]).flat(),
    { header: 'Nr rej. aktualny',    key: 'nr_rej_aktualny',   width: 13 },
    { header: 'Liczba przerejestr.', key: 'liczba_przerejestrowan', width: 10 },
    // Dane techniczne
    { header: 'F.1 DMC (kg)',        key: 'dmcKg',             width: 11 },
    { header: 'F.2 DMC z ład. (kg)', key: 'dmcKg2',            width: 13 },
    { header: 'F.3 DMC zesp. (kg)',  key: 'dmcZespolu',        width: 13 },
    { header: 'G Masa własna (kg)',  key: 'masaWlKg',          width: 14 },
    { header: 'Liczba osi',          key: 'liczbaOsi',         width: 10 },
    { header: 'Zawieszenie',         key: 'zawieszenie',       width: 14 },
    { header: 'P.1 Pojemność (cm³)', key: 'pojSilnika',        width: 14 },
    { header: 'P.2 Moc (kW)',        key: 'mocKW',             width: 11 },
    { header: 'P.3 Paliwo',          key: 'paliwo',            width: 18 },
    { header: 'Norma emisji',        key: 'normaEmisji',       width: 12 },
    { header: 'O.1 Przycz. z ham. (kg)', key: 'przyczepaBH',  width: 16 },
    { header: 'O.2 Przycz. bez ham. (kg)', key: 'przyczepaBNH', width: 17 },
    { header: 'S.1 Miejsca siedz.', key: 'miejscaSied',        width: 13 },
    // Jakość
    { header: 'Źródeł danych',       key: 'zrodel_danych',    width: 11 },
    { header: 'Konflikt DMC (F.1)',   key: 'konflikt_dmc',     width: 14 },
    { header: 'Konflikt masy wł.',    key: 'konflikt_masa_wlasna', width: 14 },
    { header: 'Uwagi',               key: 'uwagi',             width: 30 },
  ];

  ws1.columns = cols1;

  // Nagłówek + freeze
  const hdrRow1 = ws1.getRow(1);
  hdrRow1.height = 36;
  cols1.forEach((_, i) => { Object.assign(ws1.getCell(1, i + 1), hdrStyle); });
  ws1.views = [{ state: 'frozen', ySplit: 1 }];
  ws1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols1.length } };

  for (const [vin, vdata] of vehicles.entries()) {
    const lat = vdata.latest;  // najnowszy dokument
    const rejestracje = vdata.rejestracje;

    // Sprawdź konflikt DMC i masy
    const allDmc  = [...new Set(vdata.docs.map(d => d.dmcKg).filter(Boolean))];
    const allMasa = [...new Set(vdata.docs.map(d => d.masaWlKg).filter(Boolean))];
    const hasConflictDmc  = allDmc.length > 1;
    const hasConflictMasa = allMasa.length > 1;

    const uwagi = [];
    if (hasConflictDmc)  uwagi.push(`F.1 różni się: ${allDmc.join(' → ')}`);
    if (hasConflictMasa) uwagi.push(`G różni się: ${allMasa.join(' → ')}`);
    if (vdata._vinConflict) {
      for (const issue of vdata._vinConflict) {
        const info = issue.gapDays === 0
          ? `Tablice ${issue.plates.join(' i ')} — ta sama data rejestracji ${issue.dates[0]}`
          : `Tablice ${issue.plates.join(' i ')} — delta ${issue.gapDays} dni (${issue.dates[0]} → ${issue.dates[1]})`;
        uwagi.push(`⚠ Podejrzany duplikat VIN: ${info}`);
      }
    }

    // Zbuduj wiersz
    const row = {
      vin,
      marka:          lat.marka            || '',
      model:          lat.model            || '',
      typ:            lat.typ              || '',
      rodzajPojazdu:  lat.rodzajPojazdu    || '',
      podrodzaj:      lat.podrodzaj        || '',
      przeznaczenie:  lat.przeznaczenie    || '',
      rokProdukcji:   lat.rokProdukcji     || '',
      kategoria:      lat.kategoria        || lat.kategoriaDR || '',
      dataRej:        parseDate(lat.dataRej),
      wlascicielTyp:  lat.wlascicielTyp   || '',
      nr_rej_aktualny:      rejestracje[rejestracje.length - 1]?.nrRej || '',
      liczba_przerejestrowan: rejestracje.length,
      // Dane techniczne z najnowszego dokumentu
      dmcKg:       lat.dmcKg    ? +lat.dmcKg    : '',
      dmcKg2:      lat.dmcKg2   ? +lat.dmcKg2   : '',
      dmcZespolu:  lat.dmcZespolu ? +lat.dmcZespolu : '',
      masaWlKg:    lat.masaWlKg  ? +lat.masaWlKg  : '',
      liczbaOsi:   lat.liczbaOsi ? +lat.liczbaOsi : '',
      zawieszenie: lat.zawieszenie  || '',
      pojSilnika:  lat.pojSilnika   ? +lat.pojSilnika  : '',
      mocKW:       lat.mocKW        ? +lat.mocKW        : '',
      paliwo:      lat.paliwo       || '',
      normaEmisji: lat.normaEmisji  || '',
      przyczepaBH:  lat.przyczepaBH  ? +lat.przyczepaBH  : '',
      przyczepaBNH: lat.przyczepaBNH ? +lat.przyczepaBNH : '',
      miejscaSied:  lat.miejscaSied  ? +lat.miejscaSied  : '',
      // Jakość
      zrodel_danych:       vdata.docs.length,
      konflikt_dmc:        hasConflictDmc  ? 'TAK' : 'NIE',
      konflikt_masa_wlasna: hasConflictMasa ? 'TAK' : 'NIE',
      uwagi: uwagi.join('; '),
    };

    // Numery rejestracyjne chronologicznie
    for (let i = 0; i < rejestracje.length; i++) {
      row[`nr_rej_${i+1}`]   = rejestracje[i].nrRej;
      row[`data_rej_${i+1}`] = parseDate(rejestracje[i].dataRej);
    }

    const addedRow = ws1.addRow(row);

    // Podświetl wiersze z konfliktem DMC
    if (hasConflictDmc) {
      addedRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = conflictFill;
      });
    }
  }

  // Formatuj kolumny dat w Pojazdy
  cols1.forEach((c, i) => {
    if (c.style?.numFmt || c.key?.startsWith('data')) {
      const col = ws1.getColumn(i + 1);
      col.eachCell({ includeEmpty: false }, (cell, rowNum) => {
        if (rowNum > 1 && cell.value instanceof Date) {
          cell.numFmt = dateFmt;
        }
      });
    }
  });

  // ── Arkusz 2: Dokumenty ────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Dokumenty');
  const cols2 = [
    { header: 'VIN',                key: 'vin',           width: 20 },
    { header: 'Nr rejestracyjny',   key: 'nrRej',         width: 13 },
    { header: 'Data rejestracji',   key: 'dataRej',       width: 16, style: { numFmt: dateFmt } },
    { header: 'Marka',              key: 'marka',         width: 14 },
    { header: 'Model',              key: 'model',         width: 16 },
    { header: 'Typ (D.2)',          key: 'typ',           width: 14 },
    { header: 'Rok produkcji',      key: 'rokProdukcji',  width: 12 },
    { header: 'Kategoria',          key: 'kategoria',     width: 12 },
    { header: 'F.1 DMC (kg)',       key: 'dmcKg',         width: 11 },
    { header: 'F.2 DMC z ład.',     key: 'dmcKg2',        width: 13 },
    { header: 'F.3 DMC zesp.',      key: 'dmcZespolu',    width: 13 },
    { header: 'G Masa własna (kg)', key: 'masaWlKg',      width: 15 },
    { header: 'Liczba osi',         key: 'liczbaOsi',     width: 10 },
    { header: 'P.1 Pojemność',      key: 'pojSilnika',    width: 12 },
    { header: 'P.2 Moc (kW)',       key: 'mocKW',         width: 11 },
    { header: 'P.3 Paliwo',         key: 'paliwo',        width: 18 },
    { header: 'Norma emisji',       key: 'normaEmisji',   width: 12 },
    { header: 'S.1 Miejsca',        key: 'miejscaSied',   width: 10 },
    { header: 'Właściciel typ',     key: 'wlascicielTyp', width: 14 },
    { header: 'Seria DR',            key: 'seriaDr',       width: 12 },
    { header: 'Format Aztec',       key: '_format',       width: 10 },
    { header: 'Plik źródłowy',      key: '_file',         width: 30 },
    { header: 'Strategia detekcji', key: '_strategy',     width: 22 },
    { header: 'Liczba prób',        key: '_attempts',     width: 11 },
    { header: 'Czas det. (ms)',     key: '_timeMs',       width: 12 },
    { header: 'Data mod. pliku',    key: '_fileMtime',    width: 16, style: { numFmt: dateFmt } },
  ];
  ws2.columns = cols2;
  const hdrRow2 = ws2.getRow(1);
  hdrRow2.height = 30;
  cols2.forEach((_, i) => { Object.assign(ws2.getCell(1, i + 1), hdrStyle); });
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols2.length } };

  for (const doc of docRows) {
    ws2.addRow({
      ...doc,
      dataRej:    parseDate(doc.dataRej),
      _fileMtime: doc._fileMtime ? new Date(doc._fileMtime) : null,
      dmcKg:      doc.dmcKg   ? +doc.dmcKg   : '',
      dmcKg2:     doc.dmcKg2  ? +doc.dmcKg2  : '',
      dmcZespolu: doc.dmcZespolu ? +doc.dmcZespolu : '',
      masaWlKg:   doc.masaWlKg  ? +doc.masaWlKg  : '',
      liczbaOsi:  doc.liczbaOsi ? +doc.liczbaOsi : '',
      pojSilnika: doc.pojSilnika ? +doc.pojSilnika : '',
      mocKW:      doc.mocKW    ? +doc.mocKW    : '',
      miejscaSied: doc.miejscaSied ? +doc.miejscaSied : '',
    });
  }

  // ── Arkusz 3: Nieodczytane ─────────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Nieodczytane');
  const cols3 = [
    { header: 'Plik',         key: 'file',   width: 35 },
    { header: 'Format',       key: 'ext',    width: 8  },
    { header: 'Rozmiar',      key: 'size',   width: 10 },
    { header: 'Powód',        key: 'reason', width: 50 },
  ];
  ws3.columns = cols3;
  ws3.getRow(1).height = 28;
  cols3.forEach((_, i) => { Object.assign(ws3.getCell(1, i + 1), hdrStyle); });
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  for (const u of unreadable) ws3.addRow(u);

  // ── Arkusz 4: Pominięte (polisy ubezpieczeniowe i inne wykluczone) ─────────
  const ws4 = wb.addWorksheet('Pominięte');
  const cols4 = [
    { header: 'Plik',         key: 'file',    width: 45 },
    { header: 'Katalog',      key: 'dir',     width: 30 },
    { header: 'Format',       key: 'ext',     width: 8  },
    { header: 'Powód',        key: 'reason',  width: 28 },
    { header: 'Wzorzec',      key: 'wzorzec', width: 14 },
  ];
  ws4.columns = cols4;
  ws4.getRow(1).height = 28;
  cols4.forEach((_, i) => { Object.assign(ws4.getCell(1, i + 1), hdrStyle); });
  ws4.views = [{ state: 'frozen', ySplit: 1 }];
  for (const s of (skippedFiles || [])) ws4.addRow(s);

  await wb.xlsx.writeFile(OUTPUT_PATH);
  return OUTPUT_PATH;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Flagi:
//   --retry-unreadable   ponów próbę dla wszystkich plików "Aztec nieodczytany"
//                        (pomija only-ok z checkpointu, re-przetwarza unreadable)
const RETRY_UNREADABLE = process.argv.includes('--retry-unreadable');

async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  DR Extractor — TaxOrder Pro');
  if (RETRY_UNREADABLE) console.log('  TRYB: --retry-unreadable (397 plików)');
  console.log('══════════════════════════════════════');
  console.log('Katalog źródłowy:', SHARE_PATH);
  console.log('Plik wyjściowy:  ', OUTPUT_PATH);
  console.log('');

  // 1. Skan katalogu — wszystkie pliki z rozszerzeniami doc/img, bez filtrowania
  console.log('Skanowanie katalogu…');
  const allFiles = listAllDocFiles(SHARE_PATH, 5);
  console.log(`Znaleziono ${allFiles.length} plików do sprawdzenia.\n`);

  // Kategoryzacja: polisa → Pominięte | DR kandidat → dekoduj | inne → pomiń cicho
  const docFiles = [];
  const skippedFiles = [];           // polisy ubezpieczeniowe
  const insurancePatternCounts = {}; // { wzorzec → count }

  for (const f of allFiles) {
    const kw = insuranceMatch(f.name, f.dir);
    if (kw) {
      insurancePatternCounts[kw] = (insurancePatternCounts[kw] || 0) + 1;
      skippedFiles.push({ file: f.name, dir: f.dir, ext: f.ext, reason: 'polisa ubezpieczeniowa', wzorzec: kw });
      continue;
    }
    if (isDrCandidate(f.name)) {
      docFiles.push(f);
    }
    // else: inne (serwis, faktura, itp.) — pomijamy bez wpisu
  }

  console.log(`  Kandydatów DR:          ${docFiles.length}`);
  console.log(`  Polis ubezpieczeniowych: ${skippedFiles.length}`);
  console.log(`  Pominiętych (inne):      ${allFiles.length - docFiles.length - skippedFiles.length}`);
  if (!docFiles.length) { console.log('\nBrak plików DR do przetworzenia.'); process.exit(0); }
  console.log('');

  // 2. Inicjalizacja zxing-wasm
  console.log('\nInicjalizacja zxing-wasm…');
  await zxing.prepareZXingModule();
  console.log('zxing-wasm gotowy.');

  // 2b. Wczytaj checkpoint — pomiń już przetworzone pliki
  const checkpoint = loadCheckpoint();
  const docRows    = [];
  const unreadable = [];
  const pendingFiles = [];
  let _chkOk = 0, _chkNok = 0;

  for (const f of docFiles) {
    const cp = checkpoint.get(f.path);
    if (cp) {
      try {
        const st = fs.statSync(f.path);
        if (cp.mtime === st.mtimeMs && cp.size === st.size) {
          if (cp.status === 'ok') {
            docRows.push(cp.fields);
            _chkOk++;
            continue;
          }
          // status !== 'ok' — unreadable
          const isAztecFail = (cp.reason || '') === 'Aztec nieodczytany';
          if (RETRY_UNREADABLE && isAztecFail) {
            // Ponów próbę z nowym multi-page
            pendingFiles.push(f);
          } else {
            unreadable.push({
              file:   cp.name || path.basename(f.path),
              ext:    cp.ext  || f.ext,
              size:   cp.size ? Math.round(cp.size / 1024) + 'KB' : '',
              reason: cp.reason || 'Aztec nieodczytany',
            });
            _chkNok++;
            continue;
          }
        }
      } catch {}
    }
    if (!pendingFiles.includes(f)) pendingFiles.push(f);
  }

  if (_chkOk + _chkNok > 0) {
    const retryNote = RETRY_UNREADABLE ? ` (tryb retry: ${pendingFiles.length - (_chkNok === 0 ? 0 : 0)} plików nieodczytanych ponownie)` : '';
    console.log(`Checkpoint: ${_chkOk} OK, ${_chkNok} nieodczytanych pominięto. Do przetworzenia: ${pendingFiles.length}.${retryNote}`);
  }

  // 3. Lazy-start serwera + przeglądarki (tylko dla PDF)
  const hasPdfs = pendingFiles.some(f => f.ext === '.pdf');
  let helperServer = null;
  let renderer = null;
  if (hasPdfs) {
    console.log('Uruchamiam serwer HTTP dla dr-helper.html…');
    helperServer = await startHelperServer();
    console.log(`Serwer HTTP gotowy (port ${HELPER_PORT}).`);
    console.log('Uruchamiam przeglądarkę (dla PDF)…');
    renderer = new PdfRenderer();
    await renderer.init();
    console.log('Przeglądarka gotowa (renderowanie PDF).');
  }

  // 4. Przetwarzaj pliki — heartbeat co 30s
  let _hbIdx = 0, _hbLastOk = '';
  const _hbTimer = setInterval(() => {
    process.stdout.write(`\n  [żyję — ${_hbIdx}/${pendingFiles.length}, ostatni OK: ${_hbLastOk || 'brak'}]\n`);
  }, 30000);

  console.log('\nPrzetwarzanie plików:\n');
  for (let i = 0; i < pendingFiles.length; i++) {
    const f = pendingFiles[i];
    _hbIdx = i + 1;
    const label = `[${String(i+1).padStart(3,' ')}/${pendingFiles.length}] ${f.name}`;
    process.stdout.write('  ' + label.padEnd(55, '.'));

    // Odczyt pliku z jedną ponowną próbą po 200 ms
    let buf, stat;
    try {
      buf  = fs.readFileSync(f.path);
      stat = fs.statSync(f.path);
    } catch {
      await new Promise(r => setTimeout(r, 200));
      try {
        buf  = fs.readFileSync(f.path);
        stat = fs.statSync(f.path);
      } catch (e2) {
        const reason = 'Błąd odczytu: ' + e2.message;
        unreadable.push({ file: f.name, ext: f.ext, size: '', reason });
        // Nie zapisujemy do checkpointu — błąd może być przejściowy
        process.stdout.write(' BŁĄD ODCZYTU\n');
        continue;
      }
    }

    const sizeKB = Math.round(buf.length / 1024);
    const t0 = Date.now();

    // Detekcja Aztec — obrazy bezpośrednio przez zxing-wasm, PDF przez Playwright
    let detected;
    try {
      if (f.ext === '.pdf') {
        detected = await detectAztecFromPdf(buf, renderer);
      } else {
        detected = await detectAztecFromImageBuffer(buf);
      }
    } catch (e) {
      const reason = 'Błąd detekcji: ' + e.message;
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason });
      saveCheckpointEntry({ path: f.path, mtime: stat.mtimeMs, size: stat.size, status: 'unreadable', name: f.name, ext: f.ext, reason });
      process.stdout.write(' BŁĄD DET.\n');
      continue;
    }

    if (!detected || !detected.text) {
      const reason = detected?.timeout ? 'timeout renderowania PDF' : 'Aztec nieodczytany';
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason });
      saveCheckpointEntry({ path: f.path, mtime: stat.mtimeMs, size: stat.size, status: 'unreadable', name: f.name, ext: f.ext, reason });
      process.stdout.write(detected?.timeout ? ' TIMEOUT\n' : ' NIEODCZYTANY\n');
      continue;
    }

    // Parsowanie tekstu Aztec (base64 → NRV2E → UTF-16LE → pola)
    let fields;
    try {
      fields = parseAztecText(detected.text);
    } catch (e) {
      const reason = 'Błąd parsowania: ' + e.message;
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason });
      saveCheckpointEntry({ path: f.path, mtime: stat.mtimeMs, size: stat.size, status: 'unreadable', name: f.name, ext: f.ext, reason });
      process.stdout.write(' BŁĄD PARSOWANIA\n');
      continue;
    }

    fields._file      = f.name;
    fields._fileMtime = stat.mtime;
    fields._strategy  = detected.strategy;
    fields._attempts  = detected.attempts ?? 1;
    fields._timeMs    = Date.now() - t0;

    docRows.push(fields);
    _hbLastOk = f.name;
    const _pg = detected.pageNum; const _sc = detected.scale;
    saveCheckpointEntry({ path: f.path, mtime: stat.mtimeMs, size: stat.size, status: 'ok',
      ...(_pg != null ? { pageNum: _pg, scale: _sc } : {}), fields });
    const vinStr = fields.vin ? fields.vin.slice(0,13) + '…' : '?VIN';
    process.stdout.write(` OK [${(detected.strategy || '').slice(0,10)}] ${vinStr}\n`);
  }

  clearInterval(_hbTimer);
  if (renderer) await renderer.close();
  if (helperServer) helperServer.close();

  // 4. Grupuj po VIN
  console.log('\nGroupowanie po VIN…');
  const vehicles = new Map();  // VIN → { docs: [], latest: {}, rejestracje: [] }

  for (const doc of docRows) {
    const rawVin = doc.vin || '';
    const vinChk = validateVin(rawVin);
    if (!vinChk.valid) {
      unreadable.push({ file: doc._file, ext: '', size: '', reason: `Nieprawidłowy VIN: ${vinChk.reason}` });
      continue;
    }
    const vin = vinChk.vin;
    if (!vehicles.has(vin)) vehicles.set(vin, { docs: [], rejestracje: [], latest: null });
    vehicles.get(vin).docs.push(doc);
  }

  // Buduj chronologię nr_rej i wyznacz najnowszy dokument
  for (const [vin, vdata] of vehicles.entries()) {
    // Sortuj wg daty rejestracji; brak daty → data modyfikacji pliku (oznacz)
    vdata.docs.sort((a, b) => {
      const da = parseDate(a.dataRej) || new Date(a._fileMtime || 0);
      const db = parseDate(b.dataRej) || new Date(b._fileMtime || 0);
      return da - db;
    });

    // Unikalne numery rejestracyjne chronologicznie
    const seen = new Set();
    for (const doc of vdata.docs) {
      const nr = (doc.nrRej || '').trim().toUpperCase();
      if (!nr || seen.has(nr)) continue;
      seen.add(nr);
      const dateStr = doc.dataRej || null;
      const dateParsed = parseDate(dateStr);
      vdata.rejestracje.push({
        nrRej:  nr,
        dataRej: dateStr,
        _dateParsed: dateParsed,
        _uncertain: !dateParsed,
      });
    }

    vdata.latest = vdata.docs[vdata.docs.length - 1];
  }

  // 4b. Kontrola duplikatów VIN — pełne 17 znaków, nachodzące daty
  const vinConflicts = checkVinConflicts(vehicles);
  // Oznacz pojazdy z konfliktem uwagą (odczyt w generateExcel)
  for (const [vin, issues] of vinConflicts.entries()) {
    const vdata = vehicles.get(vin);
    if (vdata) vdata._vinConflict = issues;
  }

  // 5. Generuj Excel
  console.log(`\nGeneruję Excel: ${OUTPUT_PATH}`);
  console.log(`  Pojazdów (unikalnych VIN): ${vehicles.size}`);
  console.log(`  Dokumentów (wierszy):      ${docRows.length}`);
  console.log(`  Nieodczytanych:            ${unreadable.length}`);

  const outPath = await generateExcel(vehicles, docRows, unreadable, skippedFiles);
  console.log(`\n✓ Zapisano: ${outPath}`);

  // 6. Raport liczbowy
  console.log('\n══════════════════════════════════════');
  console.log('  RAPORT');
  console.log('══════════════════════════════════════');
  console.log(`Znalezionych plików:        ${allFiles.length}`);
  console.log(`  → pominięte (polisy):     ${skippedFiles.length}`);
  console.log(`  → kandydaci DR:           ${docFiles.length}`);
  console.log(`  → odczytanych Aztec:      ${docRows.length}`);
  console.log(`  → nieodczytanych:         ${unreadable.length}`);
  console.log(`Unikalnych VIN:             ${vehicles.size}`);

  if (Object.keys(insurancePatternCounts).length) {
    console.log(`\nWzorce ubezpieczeniowe (${skippedFiles.length} plików pominięto):`);
    for (const [kw, cnt] of Object.entries(insurancePatternCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${kw.padEnd(18)} ${cnt}`);
    }
  }

  const rejDist = { 1: 0, 2: 0, 3: 0, '4+': 0 };
  let conflictDmc = 0, conflictMasa = 0;
  for (const v of vehicles.values()) {
    const n = v.rejestracje.length;
    if (n === 1) rejDist['1']++;
    else if (n === 2) rejDist['2']++;
    else if (n === 3) rejDist['3']++;
    else rejDist['4+']++;

    const allDmc  = [...new Set(v.docs.map(d => d.dmcKg).filter(Boolean))];
    const allMasa = [...new Set(v.docs.map(d => d.masaWlKg).filter(Boolean))];
    if (allDmc.length  > 1) conflictDmc++;
    if (allMasa.length > 1) conflictMasa++;
  }

  console.log(`Rozkład numerów rejestracyjnych:`);
  console.log(`  1 nr_rej:    ${rejDist['1']}`);
  console.log(`  2 nr_rej:    ${rejDist['2']}`);
  console.log(`  3 nr_rej:    ${rejDist['3']}`);
  console.log(`  4+ nr_rej:   ${rejDist['4+']}`);
  console.log(`Konflikt DMC (zabudowa):    ${conflictDmc}`);
  console.log(`Konflikt masy własnej:      ${conflictMasa}`);

  // Rozkład strategii detekcji
  const stratDist = {};
  for (const d of docRows) {
    const s = d._strategy || 'unknown';
    stratDist[s] = (stratDist[s] || 0) + 1;
  }
  const stratEntries = Object.entries(stratDist).sort((a, b) => b[1] - a[1]);
  console.log(`\nRozkład strategii detekcji (${docRows.length} dok.):`);
  for (const [s, n] of stratEntries) {
    console.log(`  ${s.padEnd(28)} ${n}`);
  }

  // Duplikaty VIN z nachodzącymi datami
  if (vinConflicts.size) {
    console.log(`\n⚠ PODEJRZANE DUPLIKATY VIN (delta ≤ 30 dni): ${vinConflicts.size}`);
    for (const [vin, issues] of vinConflicts.entries()) {
      for (const issue of issues) {
        const delta = issue.gapDays === 0 ? 'ta sama data' : `delta ${issue.gapDays} dni`;
        console.log(`  ${vin}  ${issue.plates.join(' / ')}  [${issue.dates.join(' – ')}]  ${delta}`);
      }
    }
  } else {
    console.log('\n✓ Brak podejrzanych duplikatów VIN (delta ≤ 30 dni).');
  }

  if (unreadable.length) {
    const reasons = {};
    for (const u of unreadable) {
      const k = u.reason.split(':')[0];
      reasons[k] = (reasons[k] || 0) + 1;
    }
    console.log(`\nNieodczytane — przyczyny:`);
    for (const [k, n] of Object.entries(reasons)) console.log(`  ${k}: ${n}`);
  }

  console.log('\nGotowe.');
}

main().catch(e => { console.error('\nKRYTYCZNY BŁĄD:', e); process.exit(1); });
