#!/usr/bin/env node
/**
 * Bramka: podstawą podatku DT-1 jest F.2, nie F.1.
 *
 * DLACZEGO. Na dowodzie rejestracyjnym stoją obok siebie DWIE RÓŻNE WIELKOŚCI,
 * nie dwa odczyty tej samej:
 *
 *   F.1  Maksymalna masa całkowita              — możliwości konstrukcji
 *   F.2  Dopuszczalna masa całkowita            — masa ZAREJESTROWANA w kraju
 *   F.3  Dopuszczalna masa całkowita zespołu    — z przyczepą
 *
 * Ustawa o podatkach i opłatach lokalnych posługuje się terminem „dopuszczalna
 * masa całkowita", czyli F.2. Nazwy pól wzięte z `modules/dr-fields.js`, który
 * był weryfikowany wobec Dziennika Ustaw.
 *
 * ZMIERZONE NA PRAWDZIWYM DOKUMENCIE (WA1697F, ponowny OCR 26.08): F.1 = 37 000,
 * F.2 = 32 000. Volvo FMX 8x4 jest sztywną ciężarówką, a te nie przekraczają
 * w Polsce 32 t — więc to F.2 opisuje pojazd, jakim on jeździ. Produkcyjne D1
 * ma tam 32 000, czyli ktokolwiek je wypełniał, sięgnął po właściwą rubrykę.
 *
 * Prompt OCR mówił wcześniej wprost „jesli dwie wartosci wybierz WIEKSZA",
 * czyli kazał modelowi wpisać do pola podatkowego wartość TECHNICZNĄ.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const worker = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');
const wylicz = fs.readFileSync(path.join(ROOT, 'tools', 'dt1-wyliczenie.js'), 'utf8');
const katalog = fs.readFileSync(path.join(ROOT, 'modules', 'dr-fields.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nPodstawa podatku DT-1: F.2 (dopuszczalna), nie F.1 (techniczna)\n');

// [1] Katalog pól musi rozróżniać obie wielkości — to on jest źródłem prawdy
//     o tym, co która rubryka znaczy.
const f1 = /kod: 'F\.1',[^\n]*nazwa: '([^']+)'/.exec(katalog);
const f2 = /kod: 'F\.2',[^\n]*nazwa: '([^']+)'/.exec(katalog);
ok(!!f1 && !!f2, f1 && f2 ? `katalog: F.1 = „${f1[1]}", F.2 = „${f2[1]}"`
                          : 'BRAK definicji F.1 albo F.2 w modules/dr-fields.js');
if (f1 && f2) {
  ok(/maksymaln/i.test(f1[1]) && /dopuszczaln/i.test(f2[1]) && !/zespo/i.test(f2[1]),
    /maksymaln/i.test(f1[1]) && /dopuszczaln/i.test(f2[1]) && !/zespo/i.test(f2[1])
      ? 'F.1 opisana jako maksymalna, F.2 jako dopuszczalna'
      : `nazwy rubryk się rozjechały: F.1 = „${f1[1]}", F.2 = „${f2[1]}"`);
}

// [2] Prompt OCR nie może kazać wybierać WIĘKSZEJ z dwóch wartości — to
//     dosłownie instrukcja „weź masę techniczną zamiast zarejestrowanej".
const zlaInstrukcja = /dmcKg:\s*'[^']*WIEKSZ|dmcKg:\s*'[^']*WIĘKSZ/i.test(worker);
ok(!zlaInstrukcja, zlaInstrukcja
  ? 'prompt każe wybrać WIĘKSZĄ wartość — to wskazuje F.1, czyli masę techniczną'
  : 'prompt nie każe wybierać większej z dwóch mas');

const opisF2 = /dmcKg2:\s*'([^']+)'/.exec(worker);
ok(!!opisF2 && /dopuszczaln/i.test(opisF2[1]),
  opisF2 && /dopuszczaln/i.test(opisF2[1])
    ? 'prompt opisuje F.2 jako masę DOPUSZCZALNĄ'
    : `prompt opisuje F.2 jako „${opisF2 ? opisF2[1] : 'BRAK'}" — to inna wielkość`);

// [3] Wyliczenie musi SIĘGAĆ po F.2 i mieć jawny warunek pierwszeństwa.
ok(/kol\('F\.2/.test(wylicz), /kol\('F\.2/.test(wylicz)
  ? 'wyliczenie czyta kolumnę F.2 z arkusza'
  : 'wyliczenie NIE czyta F.2 — podstawą zostaje masa techniczna');

const maWybor = /const uzyjF2 =[\s\S]{0,200}f2 <= f1/.test(wylicz);
ok(maWybor, maWybor
  ? 'F.2 ma pierwszeństwo, ale tylko gdy nie przekracza F.1'
  : 'brak warunku pierwszeństwa F.2 z kontrolą F.2 <= F.1');

// [4] ⚠️ NAJWAŻNIEJSZA ASERCJA. Bez kontroli „F.2 <= F.1" bramka byłaby groźna:
//     OCR potrafi wstawić do F.2 zupełnie obcą liczbę. Zmierzone na trzech
//     Sprinterach — F.2 = 37 000 przy F.1 = 3 500 / 5 500. Ślepe pierwszeństwo
//     F.2 wpisałoby do deklaracji masę DZIESIĘCIOKROTNIE zawyżoną, a pojazd
//     przeskoczyłby z kategorii D1 (840 zł) do przedziału 37-tonowego.
//     Odtwarzamy tu samą decyzję, nie cały skrypt.
const wybierz = (f1v, f2v) => {
  const uzyjF2 = f2v != null && f2v > 0 && (f1v == null || f2v <= f1v);
  return uzyjF2 ? f2v : f1v;
};
const PRZYPADKI = [
  [37000, 32000, 32000, 'WA1697F — Volvo FMX 8x4, F.2 niższa i to ona jest podstawą'],
  [28500, 26000, 26000, 'WW6202Y — F.2 niższa'],
  [ 5500, 37000,  5500, 'WL9652T — F.2 absurdalna, zostaje F.1'],
  [ 3500, 37000,  3500, 'WZ720CS — Sprinter nie waży 37 t'],
  [ 9500,  9500,  9500, 'obie równe — bez znaczenia, którą weźmiemy'],
  [ 9500,  null,  9500, 'brak F.2 — zostaje F.1'],
  [ null,  9500,  9500, 'brak F.1 — zostaje F.2'],
  [ 9500,     0,  9500, 'F.2 zerowa to brak danych, nie masa zerowa'],
];
const zle = PRZYPADKI.filter(([a, b, oczek]) => wybierz(a, b) !== oczek)
  .map(([a, b, oczek, opis]) => `${opis}: F.1=${a} F.2=${b} → ${wybierz(a, b)}, oczekiwano ${oczek}`);
ok(zle.length === 0,
  zle.length ? `zła podstawa w ${zle.length} przypadkach:\n      ${zle.join('\n      ')}`
             : `${PRZYPADKI.length} przypadków wyboru podstawy rozstrzygniętych poprawnie`);

// [5] Sprzeczność F.2 > F.1 musi być ZGŁOSZONA, nie tylko cicho pominięta —
//     inaczej zły odczyt zostaje w danych i wróci przy kolejnym przebiegu.
const zglasza = /F\.2 \(\$\{f2\} kg\) większe niż F\.1/.test(wylicz);
ok(zglasza, zglasza
  ? 'sprzeczność F.2 > F.1 trafia do uwag pojazdu'
  : 'sprzeczność F.2 > F.1 jest pomijana po cichu');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
