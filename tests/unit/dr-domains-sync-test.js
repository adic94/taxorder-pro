#!/usr/bin/env node
/**
 * Bramka: dziedzina kategorii homologacyjnej NIE MOŻE się rozjechać między
 * katalogiem `modules/dr-fields.js` (JS, źródło prawdy) a parserem OCR
 * `ocr-service/extractors/rapid_fields.py` (Python).
 *
 * DLACZEGO KOPIA W OGÓLE ISTNIEJE: katalog jest w JS, parser w Pythonie —
 * importu między nimi nie ma, a serwis OCR jest budowany z samego katalogu
 * `ocr-service/`, więc `modules/dr-fields.js` nie trafia nawet do jego obrazu
 * Dockera. Kopia jest więc konieczna; ta bramka sprawia, że jest BEZPIECZNA.
 *
 * DLACZEGO TO WAŻNE: ten projekt ma udokumentowaną historię cicho rozjeżdżających
 * się list — dwie tablice wskaźników CO2, dwie listy źródeł kreatora raportów,
 * dwie deklaracje wersji ZXing, dwa prompty DR. KAŻDY z tych przypadków objawił
 * się BŁĘDNYMI DANYMI, nie błędem wykonania. Kategoria pojazdu jest polem DT-1,
 * więc rozjazd tutaj kończy się złą kategorią podatkową.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PLIK_JS = path.join(ROOT, 'modules', 'dr-fields.js');
const PLIK_PY = path.join(ROOT, 'ocr-service', 'extractors', 'rapid_fields.py');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nSpójność dziedzin DR — katalog JS vs parser OCR (Python)\n');

// ── Wyciągnij `domena` pola „J" z dr-fields.js ──────────────────────────────
const zrodloJs = fs.readFileSync(PLIK_JS, 'utf8');
// Kotwica jawna: kod 'J' + klucz 'kategoria'. Brak dopasowania to PORAŻKA,
// nie pominięcie — cicha zmiana struktury katalogu przestałaby być wykrywana.
const mJ = zrodloJs.match(/kod:\s*'J'[\s\S]{0,400}?domena:\s*\[([\s\S]*?)\]/);
ok(!!mJ, mJ ? 'znaleziono `domena` pola J w dr-fields.js'
            : 'NIE znaleziono `domena` pola J w dr-fields.js — zmieniła się struktura katalogu?');
if (!mJ) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }

const domenaJs = [...mJ[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
ok(domenaJs.length > 10, `dziedzina JS ma ${domenaJs.length} pozycji`);

// ── Wyciągnij KATEGORIE z rapid_fields.py ───────────────────────────────────
const zrodloPy = fs.readFileSync(PLIK_PY, 'utf8');
const mPy = zrodloPy.match(/^KATEGORIE\s*=\s*\[([\s\S]*?)\]/m);
ok(!!mPy, mPy ? 'znaleziono `KATEGORIE` w rapid_fields.py'
              : 'NIE znaleziono `KATEGORIE` w rapid_fields.py');
if (!mPy) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }

const domenaPy = [...mPy[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
ok(domenaPy.length > 10, `dziedzina Python ma ${domenaPy.length} pozycji`);

// ── Porównanie ──────────────────────────────────────────────────────────────
const zbJs = new Set(domenaJs), zbPy = new Set(domenaPy);
const brakWPy = domenaJs.filter(k => !zbPy.has(k));
const brakWJs = domenaPy.filter(k => !zbJs.has(k));

ok(brakWPy.length === 0,
  brakWPy.length
    ? `w rapid_fields.py BRAKUJE: ${brakWPy.join(', ')} — dopisz je tam`
    : 'każda kategoria z katalogu JS jest w parserze Python');

ok(brakWJs.length === 0,
  brakWJs.length
    ? `w dr-fields.js BRAKUJE: ${brakWJs.join(', ')} — katalog jest źródłem prawdy, dopisz TAM`
    : 'parser Python nie ma kategorii spoza katalogu JS');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
