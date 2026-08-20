#!/usr/bin/env node
/**
 * Strażnik: katalog pól DR jest JEDYNYM źródłem prawdy — kopie się nie rozjeżdżają.
 *
 * DLACZEGO ISTNIEJE. Lista pól dowodu rejestracyjnego żyła w czterech niezależnych
 * miejscach: mapa `_DR_NEW` (pozycje w ładunku Aztec), prompt OCR (nazwy w żądanym
 * JSON-ie), mapowanie CEPiK i skrypt budujący Excel. Ten projekt przerabiał rozjazd
 * takich kopii trzykrotnie — dwie tablice wskaźników CO2, dwie listy źródeł kreatora
 * raportów, dwie deklaracje wersji ZXing — i za każdym razem objawiało się to CICHYMI
 * ZŁYMI DANYMI, nie błędem. Przy czterech kopiach to była kwestia czasu.
 *
 * Test pilnuje, żeby każdy klucz używany w kodzie produkcyjnym istniał w katalogu.
 * Nie wymusza kierunku odwrotnego: katalog może zawierać pola, których jeszcze nie
 * wyciągamy z żadnego źródła (np. `zawieszenie` — jest na dowodzie, liczy się dla DT-1,
 * a nie ma go ani w Aztec, ani w dzisiejszym promptcie).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DR = require(path.join(ROOT, 'modules', 'dr-fields.js'));
const WORKER = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik katalogu pól DR — jedno źródło prawdy\n');

const znane = new Set(DR.klucze());
ok(DR.POLA.length > 25, `katalog ma ${DR.POLA.length} pól`);

// --- [1] każdy klucz z mapy Aztec istnieje w katalogu ------------------------
const mDrNew = WORKER.match(/const _DR_NEW\s*=\s*\{([\s\S]*?)\};/);
ok(!!mDrNew, '_DR_NEW znalezione w worker/index.js');
if (mDrNew) {
  const kluczeAztec = [...mDrNew[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]);
  const obce = kluczeAztec.filter(k => !znane.has(k));
  ok(obce.length === 0,
    obce.length
      ? `_DR_NEW używa kluczy spoza katalogu: ${obce.join(', ')} — dopisz je do modules/dr-fields.js`
      : `wszystkie ${kluczeAztec.length} kluczy z _DR_NEW jest w katalogu`);

  // Katalog deklaruje, KTÓRE pola niesie Aztec. Rozjazd w tę stronę znaczy, że katalog
  // obiecuje dane, których ładunek nie zawiera — albo odwrotnie.
  const deklarowane = new Set(DR.zAztec());
  const brakWKat = kluczeAztec.filter(k => !deklarowane.has(k));
  const nadmiar  = [...deklarowane].filter(k => !kluczeAztec.includes(k));
  ok(brakWKat.length === 0 && nadmiar.length === 0,
    (brakWKat.length || nadmiar.length)
      ? `flaga \`aztec\` rozjechana z _DR_NEW — brakuje: [${brakWKat}], nadmiar: [${nadmiar}]`
      : 'flaga `aztec` w katalogu zgadza się z _DR_NEW co do zbioru');
}

// --- [2] pola żądane w promptcie OCR istnieją w katalogu ---------------------
// Prompt prosi model o JSON o konkretnych kluczach. Klucz spoza katalogu oznacza pole,
// którego nie umiemy potem umieścić w arkuszu — trafi do wyniku i zniknie.
const mPrompt = WORKER.match(/Zwroc WYLACZNIE JSON bez markdown:\s*\n?\s*`?\s*\{([\s\S]{0,4000}?)\}`/);
if (mPrompt) {
  const kluczePromptu = [...mPrompt[1].matchAll(/"([a-zA-Z][a-zA-Z0-9]*)"\s*:/g)].map(m => m[1]);
  const obce = [...new Set(kluczePromptu.filter(k => !znane.has(k)))];
  ok(obce.length === 0,
    obce.length
      ? `prompt OCR żąda pól spoza katalogu: ${obce.join(', ')}`
      : `wszystkie ${kluczePromptu.length} pól z promptu OCR jest w katalogu`);
} else {
  console.log('  \x1b[2m(nie znalazłem bloku JSON w promptcie — pomijam; zmienił się kształt promptu)\x1b[0m');
}

// --- [3] pola osobowe są oznaczone -------------------------------------------
// Od tej flagi zależy maskowanie w narzędziach i w eksporcie. Pominięcie oznaczenia
// wypuszcza VIN albo dane właściciela do logu, który ktoś wklei do zgłoszenia.
const MUSZA_BYC_OSOBOWE = ['vin', 'wlasciciel', 'posiadacz', 'nipWlasciciela', 'seriaDr'];
const oznaczone = new Set(DR.osobowe());
const brakOznaczenia = MUSZA_BYC_OSOBOWE.filter(k => !oznaczone.has(k));
ok(brakOznaczenia.length === 0,
  brakOznaczenia.length
    ? `pola bez flagi \`osobowe\`: ${brakOznaczenia.join(', ')} — nie zostaną zamaskowane`
    : 'VIN, właściciel, posiadacz, NIP i seria dowodu oznaczone jako dane osobowe');

// --- [4] pola DT-1 kompletne --------------------------------------------------
// Bez nich nie da się policzyć podatku. Ich brak w katalogu oznacza, że nie zbieramy
// czegoś, co decyduje o kwocie należnej urzędowi.
const MUSZA_BYC_DT1 = ['dmcKg', 'liczbaOsi', 'zawieszenie', 'kategoria', 'przeznaczenie'];
const dt1 = new Set(DR.dt1().map(p => p.klucz));
const brakDt1 = MUSZA_BYC_DT1.filter(k => !dt1.has(k));
ok(brakDt1.length === 0,
  brakDt1.length
    ? `pola wpływające na DT-1 nieoznaczone: ${brakDt1.join(', ')}`
    : 'DMC, liczba osi, zawieszenie, kategoria i rodzaj pojazdu oznaczone jako DT-1');

// --- [5] uczciwość katalogu ---------------------------------------------------
// Pola wpisane z wiedzy ogólnej, a nie z odczytu rozporządzenia, mają to zadeklarowane.
// Gdyby ktoś oznaczył wszystko jako pewne, katalog przestałby ostrzegać.
ok(DR.doWeryfikacji().length > 0,
  DR.doWeryfikacji().length
    ? `${DR.doWeryfikacji().length} kodów jawnie oznaczonych do weryfikacji w Dz.U. — katalog nie udaje pewności`
    : 'wszystkie kody oznaczone jako pewne — czy na pewno ktoś je sprawdził u źródła?');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
