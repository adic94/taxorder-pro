/**
 * Każda wartość `fuel_type`, którą aplikacja potrafi ZAPISAĆ, musi trafiać we wskaźnik
 * CO2 — a nie w cichy `default`.
 *
 * Powód powstania: formularz tankowania (index.html, select #fm-ftype) zapisuje
 * `pb95`, `pb98`, `cng`, `elektryk`, a backendowa tablica CO2_EMISSION_FACTORS miała
 * klucze `petrol`/`gasoline`/`electric`. Wyszukiwanie było po równości, więc wszystkie
 * cztery lądowały na `default: 2.5`:
 *     benzyna  2,5 zamiast 2,31   (+8%)
 *     CNG      2,5 zamiast 2,04   (+23%)
 *     ELEKTRYK 2,5 zamiast 0      (pojazd bezemisyjny liczony jak spalinowy)
 * Nic tego nie sygnalizowało — wynik wyglądał wiarygodnie. To ta sama klasa co
 * „ciche zera" w raportach ESG.
 *
 * Uruchom: node tests/unit/co2-factors-test.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WORKER = path.join(ROOT, 'worker', 'index.js');
const INDEX = path.join(ROOT, 'index.html');
const FRONT = path.join(ROOT, 'modules', 'co2-report.js');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, hint) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (hint) console.log(`      ${hint}`); };

const src = fs.readFileSync(WORKER, 'utf8');

// ── tablica wskaźników i normalizator, wprost z kodu produkcyjnego ────────────
const mFactors = src.match(/const\s+CO2_EMISSION_FACTORS\s*=\s*(\{[^}]*\})\s*;/);
if (!mFactors) { bad('nie znaleziono CO2_EMISSION_FACTORS w worker/index.js'); process.exit(1); }
const CO2_EMISSION_FACTORS = eval('(' + mFactors[1] + ')'); // eslint-disable-line no-eval

const mNorm = src.match(/function\s+co2FactorFor\s*\([\s\S]*?\n\}/);
let co2FactorFor;
if (mNorm) {
  co2FactorFor = eval('(' + mNorm[0] + ')'); // eslint-disable-line no-eval
} else {
  // Kod sprzed naprawy nie ma normalizatora — odtwarzamy ówczesne wyszukiwanie,
  // żeby test mierzył FAKTYCZNE zachowanie, a nie brak funkcji.
  co2FactorFor = ft => {
    const k = String(ft ?? '').toLowerCase();
    const f = CO2_EMISSION_FACTORS[k];
    return f === undefined
      ? { factor: CO2_EMISSION_FACTORS.default, key: 'default', matched: false }
      : { factor: f, key: k, matched: true };
  };
}

// ── wartości, które aplikacja realnie zapisuje ───────────────────────────────
const html = fs.readFileSync(INDEX, 'utf8');
const sel = html.match(/<select[^>]*id="fm-ftype"[\s\S]*?<\/select>/);
const zUI = sel ? [...sel[0].matchAll(/value="([^"]+)"/g)].map(m => m[1]) : [];
// Warianty z importów paliwa, OCR dowodów i starszych danych.
const zDanych = ['diesel', 'benzyna', 'elektryczny', 'hybryda', 'ON', 'Diesel', 'LPG'];

if (zUI.length >= 5) ok(`odczytano ${zUI.length} wartości z formularza: ${zUI.join(', ')}`);
else bad(`z formularza #fm-ftype odczytano tylko ${zUI.length} wartości — ekstrakcja zepsuta`);

const nietrafione = [];
for (const v of [...zUI, ...zDanych]) {
  const r = co2FactorFor(v);
  if (!r.matched) nietrafione.push(`${v} → default ${r.factor}`);
}
if (nietrafione.length) {
  bad(`wartości cicho lądujące na default: ${nietrafione.length}`,
    'Każda z nich zawyża albo zaniża CO2 bez żadnego sygnału:\n      ' + nietrafione.join('\n      '));
} else {
  ok('każda zapisywana wartość fuel_type trafia we wskaźnik, żadna nie leci na default');
}

// ── pojazd elektryczny nie może emitować ─────────────────────────────────────
const elektryczne = ['elektryk', 'elektryczny', 'electric', 'EV', 'BEV'];
const emitujace = elektryczne.filter(v => co2FactorFor(v).factor !== 0);
if (emitujace.length) {
  bad(`pojazd elektryczny liczony jako emitujący: ${emitujace.join(', ')}`,
    'Wskaźnik dla energii elektrycznej w tym modelu wynosi 0 — inaczej flota EV zawyża raport ESG.');
} else {
  ok('wszystkie warianty „elektryczny" dają wskaźnik 0');
}

// ── front nie może mieć własnej tablicy ──────────────────────────────────────
const front = fs.readFileSync(FRONT, 'utf8');
if (/EMISSION_FACTORS\s*=\s*\{/.test(front)) {
  bad('modules/co2-report.js ma własną tablicę wskaźników',
    'Kilogramy liczy backend, więc druga tablica po stronie frontu może tylko pokazać\n' +
    '      wskaźnik, z którego te kilogramy NIE wynikają. Front ma używać pola `ef` z odpowiedzi.');
} else {
  ok('front nie duplikuje tablicy wskaźników (używa `ef` z backendu)');
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
