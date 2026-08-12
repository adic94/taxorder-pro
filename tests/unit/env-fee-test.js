/**
 * Opłata za korzystanie ze środowiska — eksploatacja pojazdów.
 *
 * Ten test pilnuje jednej rzeczy przede wszystkim: przy braku danych wyliczenie
 * musi ODMÓWIĆ, a nie zwrócić zero. Cicha zerowa należność wobec urzędu
 * marszałkowskiego jest gorsza niż błąd — to dokładnie ta klasa awarii, którą
 * naprawialiśmy w CO2, ESG i JPK („wiarygodnie wyglądające zera").
 *
 * Pilnuje też obu pułapek jednostek: stawka jest na Mg, a dane są w litrach,
 * więc przeliczenie wymaga gęstości — różnej dla każdego paliwa.
 *
 * Uruchom: node tests/unit/env-fee-test.js
 */
const fs = require('fs');
const path = require('path');

const WORKER = path.join(__dirname, '..', '..', 'worker', 'index.js');
const src = fs.readFileSync(WORKER, 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, hint) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (hint) console.log(`      ${hint}`); };

// ── wyciągnij funkcje wprost z kodu produkcyjnego ────────────────────────────
function wytnij(wzor, etykieta) {
  const m = src.match(wzor);
  if (!m) { bad(`nie znaleziono ${etykieta} w worker/index.js`); process.exit(1); }
  return m[0];
}
const zrodloFunkcji = [
  wytnij(/const\s+CO2_FACTOR_SETS\s*=\s*\[[\s\S]*?\n\];/, 'CO2_FACTOR_SETS'),
  wytnij(/function\s+co2FactorSetFor\s*\([\s\S]*?\n\}/, 'co2FactorSetFor'),
  wytnij(/function\s+co2FactorFor\s*\([\s\S]*?\n\}/, 'co2FactorFor'),
  wytnij(/function\s+normalizeEuroNorm\s*\([\s\S]*?\n\}/, 'normalizeEuroNorm'),
  wytnij(/function\s+envFeeRateSetForYear\s*\([\s\S]*?\n\}/, 'envFeeRateSetForYear'),
  wytnij(/function\s+computeEnvironmentalFee\s*\([\s\S]*?\n\}/, 'computeEnvironmentalFee'),
].join('\n');

/** Buduje moduł z podstawionym zestawem stawek (produkcyjny jest celowo pusty). */
function zbuduj(zestawy) {
  // eslint-disable-next-line no-new-func
  return new Function(`
    const ENV_FEE_RATE_SETS = ${JSON.stringify(zestawy)};
    ${zrodloFunkcji}
    return { computeEnvironmentalFee, normalizeEuroNorm, envFeeRateSetForYear };
  `)();
}

console.log('\nOpłata środowiskowa — eksploatacja pojazdów\n');

// ── 1. produkcyjna lista jest pusta i to jest ZAMIERZONE ─────────────────────
const mSets = src.match(/const\s+ENV_FEE_RATE_SETS\s*=\s*(\[[\s\S]*?\]);/);
if (!mSets) {
  bad('nie znaleziono ENV_FEE_RATE_SETS');
} else {
  const prod = eval(mSets[1]); // eslint-disable-line no-eval
  const braki = [];
  for (const s of prod) {
    if (!s.rok) braki.push('zestaw bez roku');
    if (!s.zrodlo) braki.push(`zestaw ${s.rok} bez pola "zrodlo"`);
    if (!s.jednostka_stawki) braki.push(`zestaw ${s.rok} bez pola "jednostka_stawki"`);
    if (!s.gestosc_kg_na_litr) braki.push(`zestaw ${s.rok} bez gęstości paliw — stawka jest na Mg, dane w litrach`);
  }
  if (braki.length) {
    bad(`zestawy stawek niekompletne: ${braki.length}`,
      'Kto wpisuje stawki, deklaruje też gęstość i źródło — inaczej nie da się\n      ' +
      'odtworzyć wyliczenia ani sprawdzić podstawy prawnej.\n      ' + braki.join('\n      '));
  } else {
    ok(`zestawy stawek mają komplet metadanych (${prod.length} w kodzie)`);
  }
}

// ── 2. brak stawek → ODMOWA, nie zero ────────────────────────────────────────
{
  const { computeEnvironmentalFee } = zbuduj([]);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [{ nr_rej: 'WX1', fuel_type: 'diesel', liters: 1000, euro: 'EURO 6' }] });
  if (r.ok === false && r.powod === 'BRAK_STAWEK' && r.razem_pln === undefined) {
    ok('brak stawek → jawna odmowa (BRAK_STAWEK), bez kwoty');
  } else {
    bad(`brak stawek dał wynik zamiast odmowy: ${JSON.stringify(r).slice(0, 120)}`,
      'Zerowa należność wobec urzędu marszałkowskiego wygląda wiarygodnie i nikt jej nie zakwestionuje.\n' +
      '      To najgorszy możliwy tryb awarii tej funkcji.');
  }
}

// ── 3. przeliczenie litry → Mg przez gęstość ─────────────────────────────────
{
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY ZESTAW TESTOWY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: { diesel: 0.84, petrol: 0.75 },
    stawki: { 'diesel|EURO 6': 10, 'petrol|EURO 4': 20 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'WX1', fuel_type: 'diesel', liters: 1000, euro: 'EURO 6' },   // 840 kg = 0.84 Mg × 10 = 8.40
    { nr_rej: 'WX2', fuel_type: 'pb95',   liters: 2000, euro: 'euro4' },    // 1500 kg = 1.5 Mg × 20 = 30.00
  ] });
  const suma = Math.round((r.razem_pln || 0) * 100) / 100;
  if (r.ok && Math.abs(suma - 38.40) < 0.001) {
    ok(`litry → Mg przez gęstość, suma ${suma} zł zgodna z ręcznym wyliczeniem`);
  } else {
    bad(`błędne przeliczenie: ${suma} zł zamiast 38.40`,
      'Sprawdź kolejność: litry × gęstość [kg/l] ÷ 1000 = Mg, dopiero potem × stawka [zł/Mg].');
  }
  // pb95 musi trafić w `petrol` — ta sama normalizacja co przy CO2
  if (r.pozycje?.some(p => p.paliwo === 'petrol')) ok('pb95 rozpoznane jako benzyna (wspólna normalizacja z CO2)');
  else bad('pb95 nie trafiło w kategorię petrol — normalizacja paliw się rozjechała');
}

// ── 4. brak normy EURO nie może dostać stawki domyślnej ──────────────────────
{
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: { diesel: 0.84 }, stawki: { 'diesel|EURO 6': 10 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'BEZ-EURO', fuel_type: 'diesel', liters: 1000, euro: '' },
  ] });
  if (r.ok && r.razem_pln === 0 && r.nieustalone?.length === 1 && r.nieustalone[0].brakuje.includes('norma EURO')) {
    ok('pojazd bez normy EURO trafia na listę „nieustalone", nie dostaje stawki z domysłu');
  } else {
    bad(`pojazd bez normy EURO obsłużony niepoprawnie: ${JSON.stringify(r.nieustalone)}`,
      'Przypisanie mu dowolnej stawki byłoby zgadywaniem o skutkach finansowych.');
  }
}

// ── 5. normalizacja normy EURO ───────────────────────────────────────────────
{
  const { normalizeEuroNorm } = zbuduj([]);
  const przypadki = [['EURO 6', 'EURO 6'], ['euro6', 'EURO 6'], ['EU5', 'EURO 5'], ['Euro-3', 'EURO 3'], ['', null], ['brak', null]];
  const zle = przypadki.filter(([we, ocz]) => normalizeEuroNorm(we) !== ocz);
  if (zle.length) bad(`normalizacja EURO zawodzi dla: ${zle.map(z => JSON.stringify(z[0])).join(', ')}`);
  else ok('normalizacja normy EURO obsługuje warianty zapisu z danych');
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
