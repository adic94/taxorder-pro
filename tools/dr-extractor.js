#!/usr/bin/env node
/**
 * DR Extractor — batch processor dowodów rejestracyjnych
 *
 * Użycie:
 *   node tools/dr-extractor.js
 *
 * Dla PDF wymaga lokalnego serwera HTTP na porcie 8787 (serve8787.js).
 * Obrazy (JPG/PNG/TIFF) przetwarzane bezpośrednio przez zxing-wasm w Node.js.
 * Wyjście: ..\flota-dowody.xlsx (POZA repozytorium)
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const zxing   = require('zxing-wasm');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');

// ── Ścieżki ────────────────────────────────────────────────────────────────────
const SHARE_PATH  = '\\\\pl005vdcse\\mLogistyka\\Dokumentacja pojazdów';
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'flota-dowody.xlsx');
const HELPER_URL  = 'http://localhost:8787/tools/dr-helper.html';  // dla PDF

// Słowa kluczowe w nazwie pliku sugerujące dowód rejestracyjny
const DR_NAME_KEYWORDS = [
  'dowód', 'dowod', 'down d', 'stały', 'staly', 'rejstr', 'rejestr',
  'pasas',   // litewskie "pažymėjimas"
  ' dr ', 'dr.', '_dr_', '-dr-',
  'registration', 'zulassung',  // angielski, niemiecki
];
// Słowa w nazwie pliku które WYKLUCZAJĄ (nie są DR)
const DR_NAME_EXCLUDE = [
  'pzu', 'polisa', 'ubezpiecz', 'oc ', 'ac ', 'leasing', 'faktura',
  'serwis', 'obsług', 'przegląd', 'przeglad', 'warrant', 'cert',
  'instrukcj', 'harmonogram', 'palnomocnictw', 'pełnomocnictw',
  'viatoll', 'e-toll', 'raport', 'protokół', 'protokol',
  'thumbs.db', '.tmp',
];

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
  wlascicielTyp:  14,   // B — czy firma/osoba (P=prawna, F=fizyczna)
  // 15-37: dane właściciela (POMIJAMY — RODO)
  rodzajPojazdu:  30,   // rodzaj pojazdu (może być na różnych indeksach)
  kategoriaDR:    31,   // J — kategoria homologacyjna
  nadwozie:       32,   // zabudowa
  liczbaOsi:      33,   // L — liczba osi
  dmcKg:          38,   // F.1 — DMC (kg)
  dmcKg2:         39,   // F.2 — DMC z ładunkiem (kg)
  dmcZespolu:     40,   // F.3 — DMC zespołu (kg)
  masaWlKg:       41,   // G — masa własna (kg)
  kategoria:      42,   // J — kategoria UE
  zawieszenie:    45,   // zawieszenie (oś napędowa)
  przyczepaBH:    46,   // O.1 — przyczepa z hamulcem (kg)
  przyczepaBNH:   47,   // O.2 — przyczepa bez hamulca (kg)
  pojSilnika:     48,   // P.1 — pojemność silnika (cm³)
  mocKW:          49,   // P.2 — moc maksymalna (kW)
  paliwo:         50,   // P.3 — rodzaj paliwa
  dataRej:        51,   // B.1.1 — data pierwszej rejestracji
  miejscaSied:    52,   // S.1 — miejsca siedzące
  normaEmisji:    53,   // norma emisji (euro)
  rokProdukcji:   54,   // rok produkcji (szacowany indeks)
  podrodzaj:      55,   // podrodzaj pojazdu
  przeznaczenie:  56,   // przeznaczenie (szacowany indeks)
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

async function detectAztecFromImageBuffer(buf) {
  // Próba 1: oryginalny obraz (kolor)
  try {
    const t = await _tryDecodeRaw(buf);
    if (t) return { text: t, strategy: 'img-orig' };
  } catch { /* next */ }

  // Próba 2: grayscale + threshold 128
  try {
    const t = await _tryDecodeRaw(await sharp(buf).greyscale().threshold(128).toBuffer());
    if (t) return { text: t, strategy: 'img-thresh128' };
  } catch { /* next */ }

  // Próba 3: normalize + threshold 128
  try {
    const t = await _tryDecodeRaw(await sharp(buf).greyscale().normalize().threshold(128).toBuffer());
    if (t) return { text: t, strategy: 'img-norm-thresh' };
  } catch { /* next */ }

  // Próba 4: 2× upscale (dla skanów gdzie Aztec <800px)
  // Stosuj gdy krótszy bok < 4000px — przy 2x uzyskuje ~800px dla kodu ~400px
  try {
    const meta = await sharp(buf).metadata();
    const shortSide = Math.min(meta.width, meta.height);
    if (shortSide < 4000) {
      const scaled = await sharp(buf).resize({ width: meta.width * 2, height: meta.height * 2 }).toBuffer();
      const t = await _tryDecodeRaw(scaled);
      if (t) return { text: t, strategy: 'img-2x' };
    }
  } catch { /* ignore */ }

  return null;
}

// ── Detekcja Aztec — PDF (render przez Playwright + wasm w Node) ───────────────
async function detectAztecFromPdf(buf, bPage) {
  const b64 = buf.toString('base64');
  for (const scale of [4.0, 8.0]) {
    let imgB64;
    try {
      imgB64 = await bPage.evaluate(
        ({ b64, scale }) => window.renderPdfToBase64(b64, scale),
        { b64, scale }
      );
    } catch (e) { continue; }
    if (!imgB64) continue;

    const result = await detectAztecFromImageBuffer(Buffer.from(imgB64, 'base64'));
    if (result) return { ...result, strategy: `pdf-sc${scale}-${result.strategy}` };
  }
  return null;
}

// ── Walidacja VIN ─────────────────────────────────────────────────────────────
function validateVin(vin) {
  if (!vin || typeof vin !== 'string') return { valid: false, reason: 'brak VIN' };
  const v = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length !== 17) return { valid: false, reason: `długość ${v.length} ≠ 17` };
  if (/[IOQ]/.test(v)) return { valid: false, reason: 'zawiera niedozwoloną literę I/O/Q' };
  return { valid: true, vin: v };
}

// ── Lista plików ───────────────────────────────────────────────────────────────
const DOC_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff']);

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
async function generateExcel(vehicles, docRows, unreadable) {
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
    { header: 'Seria DR',           key: 'seriaDr',       width: 12 },
    { header: 'Format Aztec',       key: '_format',       width: 10 },
    { header: 'Plik źródłowy',      key: '_file',         width: 30 },
    { header: 'Strategia det.',     key: '_strategy',     width: 18 },
    { header: 'Próby det.',         key: '_attempts',     width: 10 },
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

  await wb.xlsx.writeFile(OUTPUT_PATH);
  return OUTPUT_PATH;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  DR Extractor — TaxOrder Pro');
  console.log('══════════════════════════════════════');
  console.log('Katalog źródłowy:', SHARE_PATH);
  console.log('Plik wyjściowy:  ', OUTPUT_PATH);
  console.log('');

  // 1. Lista plików — skanuj tylko katalogi pojazdów (nie cały udział)
  const VEHICLE_DIRS = ['Ciężarowe', 'Osobowe', 'Przyczepy'];
  console.log(`Skanowanie katalogu… (tylko: ${VEHICLE_DIRS.join(', ')})`);
  let docFiles = [];
  for (const vd of VEHICLE_DIRS) {
    const subPath = path.join(SHARE_PATH, vd);
    try {
      const files = listDocFiles(subPath, 2);  // max 2 poziomy głębiej = pliki w folderach pojazdu
      console.log(`  ${vd}: ${files.length} plików DR`);
      docFiles = docFiles.concat(files);
    } catch (e) {
      console.warn(`  [POMINIĘTO] ${vd}: ${e.message}`);
    }
  }
  console.log(`Łącznie plików DR do przetworzenia: ${docFiles.length}`);
  if (!docFiles.length) { console.log('Brak plików do przetworzenia.'); process.exit(0); }

  // 2. Inicjalizacja zxing-wasm
  console.log('\nInicjalizacja zxing-wasm…');
  await zxing.prepareZXingModule();
  console.log('zxing-wasm gotowy.');

  // 3. Lazy-start przeglądarki (tylko dla PDF)
  const hasPdfs = docFiles.some(f => f.ext === '.pdf');
  let browser = null, bPage = null;
  if (hasPdfs) {
    console.log('Uruchamiam przeglądarkę (dla PDF)…');
    try {
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
    }
    bPage = await browser.newPage();
    bPage.setDefaultTimeout(60000);
    await bPage.goto(HELPER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await bPage.waitForFunction('typeof window.renderPdfToBase64 === "function"', { timeout: 20000 });
    console.log('Przeglądarka gotowa (renderowanie PDF).');
  }

  // 4. Przetwarzaj pliki
  const docRows    = [];
  const unreadable = [];

  console.log('\nPrzetwarzanie plików:\n');
  for (let i = 0; i < docFiles.length; i++) {
    const f = docFiles[i];
    const label = `[${String(i+1).padStart(3,' ')}/${docFiles.length}] ${f.name}`;
    process.stdout.write('  ' + label.padEnd(55, '.'));

    // Odczyt pliku
    let buf, stat;
    try {
      buf  = fs.readFileSync(f.path);
      stat = fs.statSync(f.path);
    } catch (e) {
      unreadable.push({ file: f.name, ext: f.ext, size: '', reason: 'Błąd odczytu: ' + e.message });
      process.stdout.write(' BŁĄD ODCZYTU\n');
      continue;
    }

    const sizeKB = Math.round(buf.length / 1024);
    const t0 = Date.now();

    // Detekcja Aztec — obrazy bezpośrednio przez zxing-wasm, PDF przez Playwright
    let detected;
    try {
      if (f.ext === '.pdf') {
        detected = await detectAztecFromPdf(buf, bPage);
      } else {
        detected = await detectAztecFromImageBuffer(buf);
      }
    } catch (e) {
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason: 'Błąd detekcji: ' + e.message });
      process.stdout.write(' BŁĄD DET.\n');
      continue;
    }

    if (!detected || !detected.text) {
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason: 'Aztec nieodczytany' });
      process.stdout.write(' NIEODCZYTANY\n');
      continue;
    }

    // Parsowanie tekstu Aztec (base64 → NRV2E → UTF-16LE → pola)
    let fields;
    try {
      fields = parseAztecText(detected.text);
    } catch (e) {
      unreadable.push({ file: f.name, ext: f.ext, size: sizeKB+'KB', reason: 'Błąd parsowania: ' + e.message });
      process.stdout.write(' BŁĄD PARSOWANIA\n');
      continue;
    }

    fields._file      = f.name;
    fields._fileMtime = stat.mtime;
    fields._strategy  = detected.strategy;
    fields._attempts  = detected.attempts ?? 1;
    fields._timeMs    = Date.now() - t0;

    docRows.push(fields);
    const vinStr = fields.vin ? fields.vin.slice(0,8) + '…' : '?VIN';
    process.stdout.write(` OK [${(detected.strategy || '').slice(0,10)}] ${vinStr}\n`);
  }

  if (browser) await browser.close();

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

  // 5. Generuj Excel
  console.log(`\nGeneruję Excel: ${OUTPUT_PATH}`);
  console.log(`  Pojazdów (unikalnych VIN): ${vehicles.size}`);
  console.log(`  Dokumentów (wierszy):      ${docRows.length}`);
  console.log(`  Nieodczytanych:            ${unreadable.length}`);

  const outPath = await generateExcel(vehicles, docRows, unreadable);
  console.log(`\n✓ Zapisano: ${outPath}`);

  // 6. Raport liczbowy
  console.log('\n══════════════════════════════════════');
  console.log('  RAPORT');
  console.log('══════════════════════════════════════');
  console.log(`Przetworzono dokumentów:    ${docFiles.length}`);
  console.log(`  → odczytanych Aztec:      ${docRows.length}`);
  console.log(`  → nieodczytanych:         ${unreadable.length}`);
  console.log(`Unikalnych VIN:             ${vehicles.size}`);

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

  if (unreadable.length) {
    const reasons = {};
    for (const u of unreadable) {
      const k = u.reason.split(':')[0];
      reasons[k] = (reasons[k] || 0) + 1;
    }
    console.log(`Nieodczytane — przyczyny:`);
    for (const [k, n] of Object.entries(reasons)) console.log(`  ${k}: ${n}`);
  }

  console.log('\nGotowe.');
}

main().catch(e => { console.error('\nKRYTYCZNY BŁĄD:', e); process.exit(1); });
