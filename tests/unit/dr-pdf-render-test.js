#!/usr/bin/env node
/**
 * Strażnik: jak renderujemy PDF przed próbą odczytu kodu Aztec.
 *
 * DLACZEGO ISTNIEJE. Import dowodu przyjmuje PDF-y (skany), a te renderowaliśmy
 * jednym ustawieniem dobranym pod OCR:
 *
 *     const vp = page.getViewport({ scale: 2.0 });
 *     canvas.toBlob(res, 'image/jpeg', 0.92);
 *
 * Obie liczby są zabójcze dla kodu kreskowego, a dla OCR nieszkodliwe — dlatego
 * nikt tego nie zauważył:
 *
 *   • `scale: 2.0` — baza PDF to 72 DPI, więc render szedł w **144 DPI**. Moduł
 *     kodu Aztec na dowodzie ma przy tej gęstości ok. 1 piksela. Nie ma czego czytać.
 *   • `toBlob('image/jpeg', 0.92)` — renderowaliśmy do canvasu (piksele bezstratne)
 *     i z powrotem kompresowali do JPEG, dokładając artefakty DCT 8×8 dokładnie na
 *     krawędziach modułów. Bez żadnej potrzeby: następny krok i tak ładuje to
 *     z powrotem do canvasu.
 *
 * Test jest statyczny — czyta źródło modułu. Nie potrzebuje przeglądarki ani PDF-a,
 * więc nadaje się do ci-js.yml. Nie sprawdza, czy dekodowanie DZIAŁA (to wymaga
 * prawdziwego dokumentu), tylko czy nie odbieramy mu szansy już na wejściu.
 */
const fs = require('fs');
const path = require('path');

const PLIK = path.join(__dirname, '..', '..', 'modules', 'dr-import.js');
const src = fs.readFileSync(PLIK, 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nRenderowanie PDF przed odczytem kodu Aztec\n');

// ── Ustawienia dla ścieżki Aztec ─────────────────────────────────────────────
const mAztec = src.match(/PDF_AZTEC\s*=\s*\{([^}]*)\}/);
ok(!!mAztec, 'stała PDF_AZTEC istnieje');

if (mAztec) {
  const dpi = Number((mAztec[1].match(/dpi:\s*(\d+)/) || [])[1]);
  ok(dpi >= 300, `Aztec renderowany w ≥ 300 DPI (jest: ${dpi || '?'}) — przy 144 DPI moduł ma ~1 px`);

  const fmt = (mAztec[1].match(/format:\s*'([^']+)'/) || [])[1];
  const bezstratny = fmt === 'image/png' || fmt === 'image/webp';
  ok(bezstratny, `Aztec zapisywany bezstratnie (jest: ${fmt || '?'}) — JPEG dokłada artefakty DCT na krawędziach modułów`);

  ok(!/quality:/.test(mAztec[1]), 'ścieżka Aztec nie ustawia `quality` — to parametr kompresji stratnej');
}

// ── Ścieżka Aztec MUSI używać tych ustawień, nie OCR-owych ───────────────────
const wywolanieAztec = /_pdfPage1Blob\(\s*original\s*,\s*PDF_AZTEC\s*\)/.test(src);
ok(wywolanieAztec, 'próba Aztec renderuje PDF z ustawieniami PDF_AZTEC');

const kolejnosc = src.indexOf('PDF_AZTEC)') < src.indexOf('PDF_OCR)');
ok(kolejnosc, 'Aztec próbowany PRZED OCR — kod daje 100% pewności, OCR zgaduje');

// ── Regresja: konkretne wartości, które tu były ──────────────────────────────
ok(!/getViewport\(\s*\{\s*scale:\s*2(\.0)?\s*\}\s*\)/.test(src),
  'brak `scale: 2.0` (144 DPI) — wartość, która zabijała dekodowanie');

const mRender = src.match(/async function _pdfPage1Blob[\s\S]*?\n  \}/);
ok(mRender && !/toBlob\([^)]*'image\/jpeg'[^)]*0\.92/.test(mRender[0]),
  'render nie ma zaszytego na sztywno JPEG 0.92 — format przychodzi z parametru');

// ── OCR ma zostać lekki: to osobne zadanie, z limitami API ───────────────────
const mOcr = src.match(/PDF_OCR\s*=\s*\{([^}]*)\}/);
ok(!!mOcr, 'stała PDF_OCR istnieje — OCR ma własne, lżejsze ustawienia');
if (mOcr) {
  const dpiOcr = Number((mOcr[1].match(/dpi:\s*(\d+)/) || [])[1]);
  ok(dpiOcr > 0 && dpiOcr < 300,
    `OCR renderowany oszczędniej niż Aztec (jest: ${dpiOcr || '?'} DPI) — 300-DPI PNG bije w limity API`);
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
