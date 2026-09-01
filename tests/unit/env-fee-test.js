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
  wytnij(/function\s+envFeeRateEuro\s*\([\s\S]*?\n\}/, 'envFeeRateEuro'),
  wytnij(/function\s+envFeeVehicleClass\s*\([\s\S]*?\n\}/, 'envFeeVehicleClass'),
  wytnij(/function\s+envFeeRateSetForYear\s*\([\s\S]*?\n\}/, 'envFeeRateSetForYear'),
  wytnij(/function\s+computeEnvironmentalFee\s*\([\s\S]*?\n\}/, 'computeEnvironmentalFee'),
].join('\n');

/** Buduje moduł z podstawionym zestawem stawek (produkcyjny jest celowo pusty). */
function zbuduj(zestawy) {
  // eslint-disable-next-line no-new-func
  return new Function(`
    const ENV_FEE_RATE_SETS = ${JSON.stringify(zestawy)};
    ${zrodloFunkcji}
    return { computeEnvironmentalFee, normalizeEuroNorm, envFeeRateEuro, envFeeRateSetForYear, envFeeVehicleClass };
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
  // Klucz stawki ma TRZY części — `paliwo|norma|klasa` — bo tyle wymiarów ma
  // Tabela D obwieszczenia. Fikcyjne stawki, ale kształt klucza produkcyjny.
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY ZESTAW TESTOWY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: { diesel: 0.84, petrol: 0.75 },
    // Klucz to 'EURO 5', mimo że pojazd niżej ma 'EURO 6' — tabela (jak produkcyjna)
    // nie ma wiersza EURO 6, więc to jednocześnie test przeliczenia litry→Mg
    // I test mapowania envFeeRateEuro('EURO 6') -> 'EURO 5'.
    stawki: { 'diesel|EURO 5|powyzej_3_5t': 10, 'petrol|EURO 4|osobowy': 20 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    // 840 kg = 0.84 Mg × 10 = 8.40 -- euro pojazdu 'EURO 6' musi trafić w wiersz 'EURO 5'
    { nr_rej: 'WX1', fuel_type: 'diesel', liters: 1000, euro: 'EURO 6', dmc: 18000, rodzaj: 'samochód ciężarowy' },
    // 1500 kg = 1.5 Mg × 20 = 30.00
    { nr_rej: 'WX2', fuel_type: 'pb95',   liters: 2000, euro: 'euro4',  dmc: 1800,  rodzaj: 'samochód osobowy' },
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
    gestosc_kg_na_litr: { diesel: 0.84 }, stawki: { 'diesel|EURO 6|powyzej_3_5t': 10 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'BEZ-EURO', fuel_type: 'diesel', liters: 1000, euro: '', dmc: 18000, rodzaj: 'samochód ciężarowy' },
  ] });
  if (r.ok && r.razem_pln === 0 && r.nieustalone?.length === 1 && r.nieustalone[0].brakuje.includes('norma EURO')) {
    ok('pojazd bez normy EURO trafia na listę „nieustalone", nie dostaje stawki z domysłu');
  } else {
    bad(`pojazd bez normy EURO obsłużony niepoprawnie: ${JSON.stringify(r.nieustalone)}`,
      'Przypisanie mu dowolnej stawki byłoby zgadywaniem o skutkach finansowych.');
  }
}

// ── 4b. KLASA POJAZDU to trzeci wymiar stawki — różnica sięga 60% ────────────
// ON EURO 5 wg Tabeli D: osobowy 5,76 zł/Mg, powyżej 3,5 t 9,19 zł/Mg. Wzięcie
// stawki „osobowej" dla ciężarówki zaniża należność wobec urzędu o ~40%, a wynik
// wygląda wiarygodnie. Dlatego brak możliwości ustalenia klasy = odmowa, nie domysł.
{
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: { diesel: 1.0 },
    stawki: { 'diesel|EURO 5|osobowy': 5.76, 'diesel|EURO 5|powyzej_3_5t': 9.19 },
  }];
  const { computeEnvironmentalFee, envFeeVehicleClass } = zbuduj(zestaw);

  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'CIEZ', fuel_type: 'diesel', liters: 1000, euro: 'EURO 5', dmc: 18000, rodzaj: 'samochód ciężarowy' },
    { nr_rej: 'OSOB', fuel_type: 'diesel', liters: 1000, euro: 'EURO 5', dmc: 1800,  rodzaj: 'samochód osobowy' },
  ] });
  const ciez = r.pozycje?.find(p => p.nr_rej === 'CIEZ');
  const osob = r.pozycje?.find(p => p.nr_rej === 'OSOB');
  if (ciez?.stawka === 9.19 && osob?.stawka === 5.76) {
    ok('ta sama norma i paliwo, różne klasy → różne stawki (9,19 vs 5,76 zł/Mg)');
  } else {
    bad(`klasa pojazdu nie wpłynęła na stawkę: ciężarowy=${ciez?.stawka}, osobowy=${osob?.stawka}`,
      'Bez trzeciego wymiaru klucza ciężarówka dostaje stawkę osobowego — zaniżenie o ~40%.');
  }

  // Bez DMC nie ma jak rozstrzygnąć progu 3,5 t
  const bezDmc = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'BEZ-DMC', fuel_type: 'diesel', liters: 1000, euro: 'EURO 5', rodzaj: 'samochód ciężarowy' },
  ] });
  if (bezDmc.nieustalone?.[0]?.brakuje?.some(b => /klasa pojazdu/.test(b))) {
    ok('pojazd bez DMC nie dostaje klasy z domysłu — trafia na „nieustalone"');
  } else {
    bad(`pojazd bez DMC obsłużony niepoprawnie: ${JSON.stringify(bezDmc.nieustalone)}`);
  }

  if (envFeeVehicleClass({ dmc: 3500, rodzaj: 'samochód ciężarowy' }) === 'do_3_5t_inny_niz_osobowy'
      && envFeeVehicleClass({ dmc: 3501, rodzaj: 'samochód ciężarowy' }) === 'powyzej_3_5t') {
    ok('próg 3,5 t rozstrzygnięty na granicy zgodnie z Tabelą D (3500 = „do", 3501 = „powyżej")');
  } else {
    bad('próg 3,5 t źle rozstrzygnięty na granicy');
  }
}

// ── 4c. TABELA nie ma wiersza EURO 6 — mapowanie jest w LOOKUPIE, nie w danych ──
// Tabela D kończy się na EURO 5. Ustalone z właścicielem 01.09.2026: „EURO 5
// i nowsze zastosujmy według przepisu" — więc EURO 6 dostaje stawkę wiersza
// EURO 5, ale przez `envFeeRateEuro()` w czasie wyszukania, nie przez dopisanie
// zmyślonego wiersza „EURO 6" do samej tabeli (który wyglądałby jak odczyt z PDF-a).
{
  const mSets2 = src.match(/const\s+ENV_FEE_RATE_SETS\s*=\s*(\[[\s\S]*?\n\];)/);
  const prod = mSets2 ? eval(mSets2[1].replace(/;$/, '')) : []; // eslint-disable-line no-eval
  const zEuro6 = prod.flatMap(z => Object.keys(z.stawki || {})).filter(k => /EURO 6/.test(k));
  if (zEuro6.length === 0) {
    ok('tabela stawek nadal nie ma wiersza EURO 6 — mapowanie żyje wyłącznie w envFeeRateEuro()');
  } else {
    bad(`w kodzie są stawki EURO 6: ${zEuro6.slice(0, 3).join(', ')}`,
      'Tabela D nie ma wiersza EURO 6 — dopisanie go tutaj wyglądałoby jak odczyt z PDF-a,\n      ' +
      'a to interpretacja przez envFeeRateEuro(). Trzymaj mapowanie w kodzie, nie w danych.');
  }
}

// ── 4d. envFeeRateEuro — EURO 5 i nowsze mapują się na wiersz EURO 5 ─────────
{
  const { envFeeRateEuro } = zbuduj([]);
  const przypadki = [['EURO 5', 'EURO 5'], ['EURO 6', 'EURO 5'], ['EURO 4', 'EURO 4'],
    ['PRZED_EURO', 'PRZED_EURO'], [null, null]];
  const zle = przypadki.filter(([we, ocz]) => envFeeRateEuro(we) !== ocz);
  if (zle.length) bad(`envFeeRateEuro źle mapuje: ${zle.map(z => JSON.stringify(z[0])).join(', ')}`);
  else ok('envFeeRateEuro: EURO 5 i wyższe -> wiersz EURO 5, niższe normy i PRZED_EURO bez zmian');
}

// ── 4e. CNG wyrażamy w kg — bez gęstości, `liters` traktowane wprost jako masa ──
// Ustalone z właścicielem 01.09.2026. CNG sprzedaje się na kg; przeliczenie
// litry×gęstość byłoby dla niego bez sensu, więc gałąź CNG pomija gęstość
// całkowicie i dzieli wprost przez 1000 (kg -> Mg).
{
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: {}, // celowo BEZ cng_fabryczny — CNG nie powinno jej szukać
    stawki: { 'cng_fabryczny|EURO 5|osobowy': 10 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  // 500 "litrow" wejsciowych dla CNG = 500 kg = 0.5 Mg x 10 = 5.00 zl.
  // paliwo_stawka podane jawnie -- patrz ZNALEZISKO w komentarzu produkcyjnym:
  // samo fuel_type='cng' normalizuje się (przez co2FactorFor) do 'cng', a Tabela D
  // rozróżnia fabryczne/przebudowane pod innymi kluczami, więc bez jawnego
  // paliwo_stawka funkcja SŁUSZNIE odmawia (sekcja 4f niżej to sprawdza).
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'CNG1', fuel_type: 'cng', paliwo_stawka: 'cng_fabryczny', liters: 500, euro: 'EURO 5', dmc: 1800, rodzaj: 'samochód osobowy' },
  ] });
  const poz = r.pozycje?.find(p => p.nr_rej === 'CNG1');
  if (r.ok && poz && Math.abs(poz.mg - 0.5) < 0.001 && Math.abs(poz.pln - 5) < 0.001) {
    ok('CNG: wartość z fuel_fills.liters potraktowana wprost jako kg, bez szukania gęstości');
  } else {
    bad(`CNG policzone błędnie: ${JSON.stringify(r)}`,
      'Dla CNG mg powinno wyjść z liters/1000 (kg->Mg), bez mnożenia przez gęstość.');
  }
}

// ── 4f. CNG bez jawnego rodzaju instalacji ODMAWIA, nie zgaduje ─────────────
// `co2FactorFor` normalizuje CNG do klucza 'cng', ale Tabela D ma dwa różne
// wiersze (fabryczny/przebudowany) pod innymi kluczami. System dziś nigdzie nie
// zapisuje rodzaju instalacji, więc samo fuel_type='cng' (bez paliwo_stawka)
// MUSI trafić na `nieustalone` z jawnym powodem, nie zgadnąć jednej z dwóch stawek.
{
  const zestaw = [{
    rok: 2026, zrodlo: 'FIKCYJNY', jednostka_stawki: 'pln_na_Mg',
    gestosc_kg_na_litr: {},
    stawki: { 'cng_fabryczny|EURO 5|osobowy': 10, 'cng_przebudowany|EURO 5|osobowy': 15 },
  }];
  const { computeEnvironmentalFee } = zbuduj(zestaw);
  const r = computeEnvironmentalFee({ year: 2026, pozycje: [
    { nr_rej: 'CNG2', fuel_type: 'cng', liters: 500, euro: 'EURO 5', dmc: 1800, rodzaj: 'samochód osobowy' },
  ] });
  if (r.ok && r.nieustalone?.length === 1 && r.nieustalone[0].brakuje.some(b => /instalacji CNG/.test(b))) {
    ok('CNG bez rodzaju instalacji trafia na „nieustalone" z jawnym powodem, nie dostaje zgadniętej stawki');
  } else {
    bad(`CNG bez rodzaju instalacji obsłużony niepoprawnie: ${JSON.stringify(r.nieustalone)}`,
      'Dwie różne stawki (fabryczny/przebudowany) — zgadnięcie jednej byłoby błędem finansowym.');
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

// ── 6. WEWNĘTRZNA SPÓJNOŚĆ TABELI STAWEK ─────────────────────────────────────
// Jedyna weryfikacja stawek dostępna BEZ dostępu do PDF-a obwieszczenia — a dostęp
// bywa zablokowany polityką sieci (zmierzone 27.08: api.sejm.gov.pl,
// dziennikustaw.gov.pl, monitorpolski.gov.pl i eli.gov.pl odpowiadają 403 na CONNECT).
//
// Udokumentowany tryb awarii przy wyciąganiu Tabeli D to PRZESUNIĘCIE WIERSZA
// o jeden: w M.P. 2025 poz. 769 jedna komórka ma separator dziesiętny w postaci
// KROPKI („10.01"), reszta przecinki, więc regex wymagający przecinka pominął wiersz
// i przypisał mu wartości następnego. Kwota wychodzi wtedy sensowna i całkowicie zła.
{
  // Ta sama ścieżka ekstrakcji co w sekcji 1 (`mSets` jest w zasięgu zewnętrznym),
  // żeby bramka nie miała drugiej, mogącej się rozjechać kopii odczytu.
  const zestaw = mSets ? eval(mSets[1])[0] : null; // eslint-disable-line no-eval
  const ORDER = ['PRZED_EURO', 'EURO 1', 'EURO 2', 'EURO 3', 'EURO 4', 'EURO 5'];

  // [a] Kształt klucza: dokładnie trzy części, znane słowniki paliw i klas.
  const PALIWA = ['bs', 'lpg', 'cng_fabryczny', 'cng_przebudowany', 'on', 'bd'];
  const KLASY  = ['osobowy', 'do_3_5t_inny_niz_osobowy', 'powyzej_3_5t', 'autobus_powyzej_3_5t'];
  const zle = Object.keys(zestaw?.stawki || {}).filter(k => {
    const cz = k.split('|');
    return cz.length !== 3 || !PALIWA.includes(cz[0]) || !ORDER.includes(cz[1]) || !KLASY.includes(cz[2]);
  });
  if (zle.length) bad(`klucze stawek poza słownikiem: ${zle.slice(0, 4).join(', ')}`);
  else ok(`wszystkie ${Object.keys(zestaw?.stawki || {}).length} kluczy stawek ma kształt paliwo|norma|klasa`);

  // [b] Monotoniczność: im wyższa norma EURO, tym niższa stawka. Przesunięcie
  // wiersza o jeden niemal na pewno tę własność łamie.
  const grupy = {};
  for (const [k, v] of Object.entries(zestaw?.stawki || {})) {
    const [p, n, kl] = k.split('|');
    (grupy[`${p}|${kl}`] ||= {})[n] = v;
  }
  const naruszenia = [];
  let serie = 0;
  for (const [g, m] of Object.entries(grupy)) {
    const obecne = ORDER.filter(n => m[n] !== undefined);
    if (obecne.length < 2) continue;
    serie++;
    for (let i = 1; i < obecne.length; i++)
      if (m[obecne[i]] > m[obecne[i - 1]])
        naruszenia.push(`${g}: ${obecne[i - 1]}=${m[obecne[i - 1]]} → ${obecne[i]}=${m[obecne[i]]}`);
  }
  if (naruszenia.length)
    bad(`stawka rośnie wraz z normą EURO w ${naruszenia.length} miejscach`, naruszenia.slice(0, 3).join(' | '));
  else ok(`monotoniczność stawek zachowana w ${serie} seriach paliwo×klasa`);

  // [c] Trzy kotwice odczytane z Tabeli D i zapisane NIEZALEŻNIE w CLAUDE.md.
  // Jedyny punkt zaczepienia o źródło, jaki mamy bez PDF-a.
  const KOTWICE = {
    'on|EURO 5|osobowy': 5.76,
    'on|EURO 5|do_3_5t_inny_niz_osobowy': 6.82,
    'on|EURO 5|powyzej_3_5t': 9.19,
  };
  const rozjazd = Object.entries(KOTWICE).filter(([k, v]) => zestaw?.stawki?.[k] !== v);
  if (rozjazd.length)
    bad(`kotwice ON EURO 5 nie zgadzają się ze źródłem: ${rozjazd.map(([k, v]) => `${k} = ${zestaw?.stawki?.[k]} zamiast ${v}`).join('; ')}`);
  else ok('trzy kotwice ON EURO 5 (5,76 / 6,82 / 9,19 zł/Mg) zgodne z odczytem Tabeli D');

  // [d] Znana luka: autobusy powyżej 3,5 t mają WYŁĄCZNIE wiersz PRZED_EURO.
  // Nie wiadomo, czy to wierne odwzorowanie Tabeli D, czy luka ekstrakcji.
  // Asercja utrwala stan, żeby zmiana nie przeszła niezauważona — w OBIE strony:
  // uzupełnienie luki też ma zmusić do świadomej aktualizacji tego wpisu.
  const autobusy = Object.keys(zestaw?.stawki || {}).filter(k => k.endsWith('|autobus_powyzej_3_5t'));
  const autobusyEuro = autobusy.filter(k => !k.includes('|PRZED_EURO|'));
  if (autobusyEuro.length === 0)
    ok(`autobusy >3,5 t: nadal tylko ${autobusy.length} wiersze PRZED_EURO — luka niezmieniona (do sprawdzenia w PDF-ie)`);
  else
    bad(`autobusy >3,5 t dostały stawki EURO (${autobusyEuro.length}) — zweryfikuj w Tabeli D i zaktualizuj ten wpis`);
}

console.log(`\n${'─'.repeat(52)}\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
