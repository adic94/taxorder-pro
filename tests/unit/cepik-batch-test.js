#!/usr/bin/env node
/**
 * Strażnik: zapytania do CEPiK mieszczą się w limitach, a budżet żądań jest policzalny.
 *
 * DLACZEGO ISTNIEJE — dwie realne awarie w jednym dniu, obie ciche.
 *
 * (1) Narzędzie zalewało publiczne API państwowe: odstęp między żądaniami stał na końcu
 *     pętli po województwach, więc wykonywał się WYŁĄCZNIE po sukcesie, a każde pudło
 *     szło natychmiast. Przy włączonym fallbacku po 16 województwach dawało to do 16
 *     żądań pod rząd bez żadnej przerwy. Serwer odpowiedział HTTP 429 i miał rację.
 *
 * (2) Tablica województw miała 15 unikalnych kodów zamiast 16 — litera `C` wskazywała
 *     łódzkie (to samo, co `E`), więc kujawsko-pomorskie (04) nie występowało nigdzie.
 *     Pojazdy na tablicach C były nieosiągalne także przez fallback „po wszystkich".
 *     Objaw był niemy: CEPiK na zły kod województwa zwraca pusty wynik, nie błąd.
 *
 * (3) Okno dat: CEPiK przyjmuje NAJWYŻEJ DWA LATA i mówi to wprost — „Błędny zakres dat.
 *     Maksymalny zakres lat to: 2". Wersja pytająca o 30 lat dostawała HTTP 400 na KAŻDE
 *     zapytanie, więc nie mogła znaleźć niczego. Test pilnuje, żeby generator okien nigdy
 *     nie wyprodukował okna dłuższego niż limit — niezależnie od tego, ile lat wstecz
 *     ktoś zażąda.
 *
 * Test czyta PRODUKCYJNY plik i wyciąga z niego funkcję `okna()` oraz tablicę województw.
 * Kopia tych rzeczy w teście rozjechałaby się z kodem i ukryła dokładnie to, co ma wykryć
 * — ten projekt ma już trzy takie precedensy (tablice CO2, listy źródeł raportów, ZXing).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PLIK = path.join(ROOT, 'tools', 'cepik-batch.js');
const src = fs.readFileSync(PLIK, 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik zapytań do CEPiK — limity API i budżet żądań\n');

// --- [1] limit okna jest zapisany jako stała, nie rozsiany po kodzie ---------------
const mMax = src.match(/const OKNO_MAX\s*=\s*(\d+)/);
ok(!!mMax, 'OKNO_MAX zdefiniowane w tools/cepik-batch.js');
const OKNO_MAX = mMax ? Number(mMax[1]) : NaN;
ok(OKNO_MAX === 2, `OKNO_MAX = ${OKNO_MAX} (CEPiK: „Maksymalny zakres lat to: 2")`);

// --- [2] generator okien NIGDY nie przekracza limitu ------------------------------
const mOkna = src.match(/function okna\([\s\S]*?\n}/);
ok(!!mOkna, 'funkcja okna() wyekstrahowana z pliku produkcyjnego');
if (mOkna && Number.isFinite(OKNO_MAX)) {
  const okna = new Function('OKNO_MAX', `${mOkna[0]}; return okna;`)(OKNO_MAX);
  const ROK = 2026;

  let zaDlugie = null, zaKrotkiZasieg = null, odwrocone = null;
  for (let lat = 1; lat <= 40; lat++) {
    const w = okna(ROK, lat);
    for (const [od, do_] of w) {
      if (do_ - od + 1 > OKNO_MAX) zaDlugie = zaDlugie || `--lata ${lat}: okno ${od}–${do_}`;
      if (do_ < od) odwrocone = odwrocone || `--lata ${lat}: okno ${od}–${do_}`;
    }
    // Zasięg wstecz musi faktycznie sięgać żądanej liczby lat — inaczej „--lata 30"
    // obiecywałoby pokrycie, którego nie daje, i znów mielibyśmy ciche zero.
    const najstarszy = Math.min(...w.map(x => x[0]));
    if (najstarszy > ROK - lat + 1) zaKrotkiZasieg = zaKrotkiZasieg || `--lata ${lat}: sięga tylko do ${najstarszy}`;
  }
  ok(!zaDlugie, zaDlugie ? `okno dłuższe niż ${OKNO_MAX} lata — CEPiK odrzuci je z HTTP 400 (${zaDlugie})` : `żadne okno nie przekracza ${OKNO_MAX} lat (sprawdzone --lata 1..40)`);
  ok(!odwrocone, odwrocone ? `okno z datą końcową przed początkową (${odwrocone})` : 'żadne okno nie jest odwrócone');
  ok(!zaKrotkiZasieg, zaKrotkiZasieg ? `zasięg krótszy niż deklarowany (${zaKrotkiZasieg})` : 'zasięg wstecz zgadza się z --lata');

  // Budżet: liczba okien musi rosnąć liniowo, żeby rachunek w bannerze był prawdziwy.
  ok(okna(ROK, 30).length === 15, `--lata 30 to ${okna(ROK, 30).length} okien na pojazd (oczekiwane 15)`);
}

// --- [3] tablica województw: 16 kodów, żaden zdublowany ---------------------------
const mWoj = src.match(/const WOJ\s*=\s*\{([\s\S]*?)\};/);
ok(!!mWoj, 'tablica WOJ wyekstrahowana z pliku produkcyjnego');
if (mWoj) {
  const pary = [...mWoj[1].matchAll(/([A-Z])\s*:\s*'(\d{2})'/g)].map(m => [m[1], m[2]]);
  const kody = pary.map(p => p[1]);
  const unikalne = new Set(kody);
  ok(pary.length === 16, `${pary.length} liter w tablicy (oczekiwane 16)`);

  const dubel = kody.filter((k, i) => kody.indexOf(k) !== i);
  ok(unikalne.size === 16,
    unikalne.size === 16
      ? '16 unikalnych kodów — każde województwo osiągalne'
      : `tylko ${unikalne.size} unikalnych kodów; zdublowane: ${[...new Set(dubel)].join(', ')} — jedno województwo jest NIEOSIĄGALNE, także przez --fallback-woj`);

  // Kody TERYT województw to parzyste 02..32. Literówka w cyfrze dałaby pusty wynik,
  // nie błąd — czyli wyglądałaby jak „pojazdu nie ma w rejestrze".
  const zle = kody.filter(k => { const n = Number(k); return n < 2 || n > 32 || n % 2 !== 0; });
  ok(zle.length === 0, zle.length ? `kody spoza zakresu TERYT 02–32: ${zle.join(', ')}` : 'wszystkie kody mieszczą się w TERYT 02–32 (parzyste)');
}

// --- [4] odstęp obowiązuje po KAŻDYM żądaniu, nie tylko po udanym -----------------
const mFn = src.match(/async function zadanieZOdstepem\([\s\S]*?\n}/);
ok(!!mFn, 'zadanieZOdstepem() istnieje — odstęp jest własnością warstwy żądania');
if (mFn) {
  const ciało = mFn[0];
  // Sen musi stać PRZED jakimkolwiek wyjściem z funkcji, inaczej ścieżka błędu go ominie.
  const poz = ciało.indexOf('await spij(ODSTEP)');
  const pierwszyReturn = ciało.search(/\breturn\b/);
  ok(poz > 0 && poz < pierwszyReturn,
    poz > 0 && poz < pierwszyReturn
      ? 'odstęp wykonuje się przed każdym wyjściem z funkcji'
      : 'odstęp stoi za jakimś `return` — ścieżka błędu go ominie i narzędzie znów zaleje API');
  ok(/429/.test(ciało) && /Math\.pow|\*\s*3/.test(ciało),
    'HTTP 429 uruchamia wycofywanie, a nie przerwanie przebiegu');
}

// --- [5] domyślny zakres nie mnoży żądań po cichu ---------------------------------
const mLata = src.match(/const ZAKRES_LAT\s*=\s*Number\(par\('--lata',\s*(\d+)\)\)/);
ok(!!mLata, 'domyślna wartość --lata odczytana z kodu');
if (mLata) {
  const dom = Number(mLata[1]);
  ok(dom <= OKNO_MAX,
    dom <= OKNO_MAX
      ? `domyślnie ${dom} lata = jedno okno na pojazd (876 pojazdów → 876 żądań)`
      : `domyślnie ${dom} lat = ${Math.ceil(dom / OKNO_MAX)} okien na pojazd — domyślny przebieg wysyłałby ${Math.ceil(dom / OKNO_MAX)}× więcej żądań, niż wynika z liczby pojazdów`);
}
const mFallback = src.match(/const FALLBACK_WOJ\s*=\s*argv\.includes/);
ok(!!mFallback,
  mFallback
    ? 'fallback po województwach jest opt-in (--fallback-woj), nie domyślny'
    : 'fallback po województwach nie jest za flagą — mnoży żądania ×16 bez wiedzy uruchamiającego');

console.log(`\n  ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
