#!/usr/bin/env node
/**
 * Bramka: wbudowane stawki DT-1 zgadzają się z uchwałą, na którą się powołują.
 *
 * DLACZEGO. `modules/gminy-rates.js` deklaruje w interfejsie „przywraca stawkę
 * Warszawa 2026" i „max MF 2026". To są kwoty, które trafiają do deklaracji
 * podatkowej — a nikt nigdy nie sprawdził ich wobec źródła. Liczba wpisana
 * z pamięci wygląda w arkuszu identycznie jak odczytana z uchwały.
 *
 * ŹRÓDŁO (zweryfikowane 25.08.2026 odczytem PDF-a):
 *   Uchwała nr XXIX/1065/2025 Rady m.st. Warszawy z 20 listopada 2025 r.
 *   w sprawie określenia wysokości stawek podatku od środków transportowych
 *   na 2026 rok.
 *   § 1 — stawki podstawowe, § 2 — pojazdy wyprodukowane w 2024 r. albo nowsze,
 *   § 3 — napędy wodorowy / hybrydowy / elektryczny / CNG / LNG (~40% niżej).
 *
 * Ta bramka NIE sprawdza całej uchwały — tylko te pozycje, których odpowiedniki
 * istnieją w SCHEMA. Rozjazd którejkolwiek z nich znaczy, że kwota w deklaracji
 * przestała odpowiadać przepisowi.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'modules', 'gminy-rates.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStawki DT-1 — zgodność z uchwałą XXIX/1065/2025 (Warszawa, 2026)\n');

const mSchema = src.match(/const SCHEMA = \[([\s\S]*?)\n\s*\];/);
ok(!!mSchema, mSchema ? 'znaleziono SCHEMA w gminy-rates.js'
                      : 'BRAK SCHEMA — zmieniła się struktura modułu stawek');
if (!mSchema) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }

const wpisy = [...mSchema[1].matchAll(/key:\s*'([a-z0-9_]+)'[^}]*?default:\s*(\d+)/g)];
const stawki = Object.fromEntries(wpisy.map(m => [m[1], Number(m[2])]));
ok(wpisy.length > 20, `SCHEMA ma ${wpisy.length} pozycji`);

// § 1 (stawki podstawowe) i § 2 (rok produkcji ≥ 2024), przepisane z uchwały.
//
// ⚠️ DO 26.08 TA LISTA MIAŁA 11 POZYCJI — same pojazdy PONIŻEJ 12 ton. Stawki
// od 12 t, czyli NAJWYŻSZE (do 4 296 zł), nie były sprawdzone z żadnym źródłem.
// Uzupełnione odczytem pełnego tekstu uchwały z PDF-a, punkt po punkcie.
//
// Sprawdzone przy okazji i warte zapamiętania: **uchwała NIE różnicuje stawek
// po RODZAJU ZAWIESZENIA**. Ustawa dopuszcza taki podział dla pojazdów od 12 t
// (pneumatyczne albo uznane za równoważne kontra inne systemy), ale Warszawa
// z niego nie skorzystała — zero wystąpień słów „zawieszenie" i „pneumatyczne"
// w całym tekście. Struktura SCHEMA (klucz: rodzaj + osie + masa) jest więc
// poprawna, a brak wymiaru zawieszenia NIE jest luką.
const UCHWALA = {
  // § 1 pkt 1 — ciężarowy poniżej 12 t
  car_lt55_old: 840,  car_lt55_new: 744,     // 3,5–5,5 t
  car_55_90_old: 1128, car_55_90_new: 1008,  // 5,5–9 t
  car_90_12_old: 1488, car_90_12_new: 1344,  // 9–12 t
  // § 1 pkt 2 — ciężarowy o DWÓCH osiach, od 12 t
  car_2ax_lt13: 1200, car_2ax_13_14: 1488, car_2ax_14_15: 1680, car_2ax_ge15: 2184,
  // § 1 pkt 3 — ciężarowy o TRZECH osiach
  car_3ax_lt17: 1488, car_3ax_17_19: 1704, car_3ax_19_21: 1872,
  car_3ax_21_23: 2136, car_3ax_ge23: 2760,
  // § 1 pkt 4 — ciężarowy o CZTERECH lub więcej osiach
  car_4ax_lt25: 1488, car_4ax_25_27: 1824, car_4ax_27_29: 2880, car_4ax_ge29: 4296,
  // § 1 pkt 5–7 — ciągnik siodłowy/balastowy
  ct_lt12_old: 1392,  ct_lt12_new: 1248,     // 3,5–12 t zespołu
  ct_2ax_lt18: 1128, ct_2ax_18_25: 1680, ct_2ax_25_31: 2232,
  ct_2ax_31_36: 3384, ct_2ax_gt36: 3384,
  ct_3ax_le36: 2784, ct_3ax_36_40: 2832, ct_3ax_ge40: 4200,
  // § 1 pkt 8–11 — przyczepa i naczepa
  tr_7_12_old: 1248,  tr_7_12_new: 1128,     // 7–12 t zespołu
  tr_1ax_lt18: 744, tr_1ax_18_25: 840, tr_1ax_25_36: 984, tr_1ax_gt36: 1128,
  tr_2ax_lt28: 1488, tr_2ax_28_33: 1776, tr_2ax_33_38: 2256, tr_2ax_ge38: 2976,
  tr_3ax_le36: 1872, tr_3ax_36_38: 2040, tr_3ax_ge38: 2232,
  // § 1 pkt 12 — autobus (oba progi poniżej 30 miejsc mają tę samą stawkę)
  bus_lt30: 1488, bus_ge30: 1872,
  bus_any_new: 1320,                          // § 2 pkt 4 — rok ≥ 2024
};

const rozjazdy = [];
for (const [k, v] of Object.entries(UCHWALA)) {
  if (stawki[k] === undefined) rozjazdy.push(`${k}: BRAK klucza w SCHEMA (uchwała: ${v} zł)`);
  else if (stawki[k] !== v) rozjazdy.push(`${k}: kod ${stawki[k]} zł, uchwała ${v} zł`);
}
ok(rozjazdy.length === 0,
  rozjazdy.length
    ? `stawki rozjechały się z uchwałą (${rozjazdy.length}):\n      ${rozjazdy.join('\n      ')}`
    : `${Object.keys(UCHWALA).length} stawek zgodnych z uchwałą co do złotówki`);

// § 3 — napędy alternatywne. Kluczy jeszcze NIE MA i to jest świadome: dodanie
// ich wymaga też logiki w tax-engine, która rozpozna rodzaj paliwa. Ta asercja
// nie każe ich dodać — pilnuje, żeby po dodaniu miały WŁAŚCIWE kwoty, a nie
// przepisane z pamięci.
const PAR3 = { car_lt55_alt: 504, car_55_90_alt: 672, car_90_12_alt: 888, ct_lt12_alt: 840, bus_alt: 888 };
const zlePar3 = Object.entries(PAR3)
  .filter(([k, v]) => stawki[k] !== undefined && stawki[k] !== v)
  .map(([k, v]) => `${k}: kod ${stawki[k]} zł, uchwała § 3 ${v} zł`);
ok(zlePar3.length === 0,
  zlePar3.length
    ? `stawki § 3 (napędy alternatywne) niezgodne:\n      ${zlePar3.join('\n      ')}`
    : (Object.keys(PAR3).some(k => stawki[k] !== undefined)
        ? 'stawki § 3 (napędy alternatywne) zgodne z uchwałą'
        : 'stawek § 3 jeszcze nie ma w SCHEMA — patrz komentarz w tym pliku'));

// Stawka nie może być zerowa ani ujemna — to nie jest „brak", tylko zwolnienie,
// a zwolnienia rozstrzyga TaxEngine, nie tabela kwot.
const zle = wpisy.filter(m => Number(m[2]) <= 0).map(m => m[1]);
ok(zle.length === 0,
  zle.length ? `stawki zerowe lub ujemne: ${zle.join(', ')}` : 'każda stawka jest dodatnia');

// ── WIDEŁKI USTAWOWE ─────────────────────────────────────────────────────────
// Rada gminy uchwala stawkę w widełkach DWUSTRONNYCH: górna granica z obwieszczenia
// Ministra Finansów (Monitor Polski) dla wszystkich pojazdów, a dla pojazdów OD 12 t
// dodatkowo stawka MINIMALNA z załączników do ustawy (związanie prawem unijnym).
// Ta flota ma 28 pojazdów od 12 t, więc dolne ograniczenie jej dotyczy — i to przy
// pozycjach o najwyższych kwotach.
{
  console.log('');
  // Moduł jest przeglądarkowy (IIFE na `window`), więc uruchamiamy go w atrapie okna.
  const okno = { localStorage: { getItem: () => '{}', setItem: () => {} }, console };
  // eslint-disable-next-line no-new-func
  const GR = new Function('window', 'localStorage', 'esc', `${src}; return window.GminyRates;`)(
    okno, okno.localStorage, x => String(x)
  );

  ok(typeof GR?.sprawdzWidelki === 'function', 'moduł eksportuje sprawdzWidelki()');
  ok(Array.isArray(GR?.LIMITY_USTAWOWE), 'moduł eksportuje LIMITY_USTAWOWE');

  // [1] BRAK DANYCH TO NIE JEST ZGODNOŚĆ — najważniejsza asercja tej sekcji.
  // Gdyby pusta tablica limitów dawała `ok: true`, kontrola orzekałaby, że każda
  // stawka jest legalna. To ta sama zasada, co odmowa przy braku gęstości paliw.
  const pusty = GR.sprawdzWidelki({ car_4ax_ge29: 999999 }, 2026);
  ok(pusty.ok === false, 'brak odczytanych widełek → ODMOWA orzeczenia, nie zielone światło');
  ok(pusty.powod === 'BRAK_LIMITOW', 'odmowa niesie powód BRAK_LIMITOW, nie samo `false`');

  // [2] Kontrola działa, gdy dane są — na syntetycznych widełkach.
  // Bez tego [1] przechodziłoby także dla funkcji, która ZAWSZE odmawia.
  const zBudkami = new Function('window', 'localStorage', 'esc', `
    ${src.replace(/widelki: \{\},/, "widelki: { car_4ax_ge29: { max: 4296, min: 3000 }, bus_lt30: { max: 2000, min: null } },")
         .replace(/zrodlo: '',/, "zrodlo: 'TEST — widełki syntetyczne',")};
    return window.GminyRates;`)(okno, okno.localStorage, x => String(x));

  const ponad = zBudkami.sprawdzWidelki({ car_4ax_ge29: 5000 }, 2026);
  ok(ponad.naruszenia.some(n => n.rodzaj.includes('powyżej')),
    'stawka ponad maksimum ustawowe zostaje wykryta');

  const ponizej = zBudkami.sprawdzWidelki({ car_4ax_ge29: 2500 }, 2026);
  ok(ponizej.naruszenia.some(n => n.rodzaj.includes('poniżej')),
    'stawka poniżej minimum (pojazd od 12 t) zostaje wykryta');

  const wSam = zBudkami.sprawdzWidelki({ car_4ax_ge29: 4000 }, 2026);
  ok(wSam.ok === true && wSam.naruszenia.length === 0,
    'stawka wewnątrz widełek przechodzi bez zastrzeżeń');

  // Pozycja bez minimum (poniżej 12 t) nie może dostać naruszenia „poniżej minimum".
  const bezMin = zBudkami.sprawdzWidelki({ bus_lt30: 1 }, 2026);
  ok(!bezMin.naruszenia.some(n => n.rodzaj.includes('poniżej')),
    'pozycja bez stawki minimalnej nie jest karana za niską kwotę');

  // [3] Pozycja spoza widełek trafia na `nieustalone`, nie jest cicho przepuszczana.
  const nieznana = zBudkami.sprawdzWidelki({ tr_1ax_lt18: 700 }, 2026);
  ok(nieznana.nieustalone.some(n => n.key === 'tr_1ax_lt18') && nieznana.ok === false,
    'pozycja bez odczytanych widełek trafia na „nieustalone", a wynik nie jest ok');
}

// ── ETYKIETA WBUDOWANYCH STAWEK ──────────────────────────────────────────────
// Interfejs opisywał wiersz Warszawy jako „wbudowane (max MF 2026)", czyli mówił
// użytkownikowi, że to MAKSYMALNE stawki Ministra Finansów. To nieprawda: to stawki
// z uchwały Rady m.st. Warszawy, zweryfikowane wyżej co do złotówki. Gmina uchwala
// stawki W WIDEŁKACH, więc jej stawki nie są tożsame z górną granicą — a użytkownik
// z innej gminy, przekonany że widzi maksimum, użyłby ich jako bezpiecznego domyślnego.
ok(!/max MF/.test(src), 'brak mylącej etykiety „max MF" przy stawkach z uchwały Warszawy');
ok(/uchwała XXIX\/1065\/2025|uchwala XXIX\/1065\/2025/.test(src),
  'wbudowane stawki opisane swoim faktycznym źródłem (uchwała Warszawy)');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
