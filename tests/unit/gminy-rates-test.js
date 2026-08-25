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
const UCHWALA = {
  car_lt55_old: 840,  car_lt55_new: 744,     // ciężarowy 3,5–5,5 t
  car_55_90_old: 1128, car_55_90_new: 1008,  // ciężarowy 5,5–9 t
  car_90_12_old: 1488, car_90_12_new: 1344,  // ciężarowy 9–12 t
  ct_lt12_old: 1392,  ct_lt12_new: 1248,     // ciągnik siodłowy 3,5–12 t
  tr_7_12_old: 1248,  tr_7_12_new: 1128,     // przyczepa/naczepa 7–12 t
  bus_any_new: 1320,                          // autobus, rok ≥ 2024
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

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
