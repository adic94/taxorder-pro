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
 * a nie ma go w Aztec). Wyjatek: pola DT-1 MUSZA byc w promptcie — patrz [2].
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

// --- [2] prompt OCR: JEDNA definicja pól, komplet DT-1, brak drugiej kopii ---
// Do 21.08 prompt DR istniał w DWÓCH kopiach — `handleAIOCR` (20 pól) i `handleDrOcr`
// (16 pól, bez przeznaczenia, bez F.2, bez O.1/O.2). Który handler obsłużył dokument,
// taki zestaw pól wracał, bez śladu w odpowiedzi. Teraz jest stała `DR_POLA_OCR`.
//
// Ta sekcja NIE MOŻE się „pomijać". Wcześniejsza wersja szukała literału JSON regexem
// i przy nietrafieniu wypisywała „pomijam" — czyli po każdej zmianie kształtu promptu
// przestawała mierzyć cokolwiek i nadal świeciła na zielono.
const mPola = WORKER.match(/const DR_POLA_OCR\s*=\s*\{([\s\S]*?)\n\};/);
ok(!!mPola, mPola
  ? 'DR_POLA_OCR znalezione w worker/index.js'
  : 'BRAK stałej DR_POLA_OCR — prompt OCR wrócił do literału i może się rozjechać');
if (mPola) {
  const kluczePromptu = [...mPola[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map(m => m[1]);
  const obce = [...new Set(kluczePromptu.filter(k => !znane.has(k)))];
  ok(obce.length === 0,
    obce.length
      ? `prompt OCR żąda pól spoza katalogu: ${obce.join(', ')}`
      : `wszystkie ${kluczePromptu.length} pól z promptu OCR jest w katalogu`);

  // Pole DT-1, o które prompt nie pyta, jest NIE DO ZDOBYCIA z OCR — a jego brak
  // objawia się pustą kolumną w arkuszu, nie błędem. Tak zniknęło `zawieszenie`:
  // 0/916 pojazdów, z żadnego źródła, bo nikt o nie nie prosił.
  const wPromptcie = new Set(kluczePromptu);
  const brakDt1 = DR.dt1().filter(f => !wPromptcie.has(f.klucz)).map(f => `${f.kod} ${f.klucz}`);
  ok(brakDt1.length === 0,
    brakDt1.length
      ? `prompt OCR nie pyta o pola DT-1: ${brakDt1.join(', ')} — bez nich nie da się wyliczyć podatku`
      : `prompt OCR pyta o wszystkie ${DR.dt1().length} pól DT-1`);

  // Prompt NIE MOŻE podawać kodu rubryki dla pola, które takiego kodu nie ma.
  //
  // Do 25.08 prompt kazał modelowi szukać „V.9 — poziom emisji spalin". Ta rubryka
  // NIE ISTNIEJE w polskim wzorze (zweryfikowane w Dz.U. 2024 poz. 1709 — patrz
  // nagłówek modules/dr-fields.js). Kazanie modelowi szukać nieistniejącego kodu
  // to nie tylko zmarnowane pole: model, któremu podaje się kod, szuka czegoś
  // pasującego do wzorca i w razie potrzeby dopasuje sąsiednią wartość.
  //
  // Katalog oznacza takie pola przez `kod: null`. Ta asercja pilnuje, żeby prompt
  // nie zaczął ich znowu opisywać kodem literowym.
  const bezKodu = DR.POLA.filter(f => f.kod === null).map(f => f.klucz);
  const wierszePromptu = mPola[1].split('\n');
  const zKodemMimoBraku = bezKodu.filter(klucz => {
    const w = wierszePromptu.find(l => new RegExp(`^\\s*${klucz}\\s*:`).test(l));
    // Kod rubryki na POCZĄTKU opisu, np. „V.9 — ...", „A — ...", „F.1 — ..."
    return w && /:\s*'[A-Z]{1,3}(\.\d)?\s*[—-]/.test(w);
  });
  ok(zKodemMimoBraku.length === 0,
    zKodemMimoBraku.length
      ? `prompt podaje kod rubryki dla pól, które go NIE MAJĄ: ${zKodemMimoBraku.join(', ')} — model będzie szukał nieistniejącej rubryki`
      : `żadne z ${bezKodu.length} pól bez kodu rubryki nie jest opisane kodem w promptcie`);
}

// Druga kopia listy pól DR w promptcie = ten sam rozjazd, który właśnie usunęliśmy.
//
// Sam `{"nrRej":` NIE WYSTARCZY jako sygnał: worker ma prompty do polisy, faktury
// paliwowej i faktury serwisowej, które też pytają o numer rejestracyjny i są w porządku.
// Pierwsza wersja tej asercji zgłaszała je jako regres — fałszywy alarm w bramce jest
// gorszy niż jej brak, bo uczy ignorowania czerwonego wyniku.
// Kopią promptu DR jest dopiero literał, który obok `nrRej` niesie pola karty pojazdu.
const POLA_TYLKO_DR = ['dmcKg', 'liczbaOsi', 'masaWlKg', 'nrHomolog'];
const kopieDr = [];
for (const m of WORKER.matchAll(/\{"nrRej":/g)) {
  const fragment = WORKER.slice(m.index, m.index + 3000);
  const koniec = fragment.indexOf('\n');
  const literal = koniec > 0 ? fragment.slice(0, koniec) : fragment;
  if (POLA_TYLKO_DR.filter(k => literal.includes(`"${k}"`)).length >= 2) {
    kopieDr.push(WORKER.slice(0, m.index).split('\n').length);
  }
}
ok(kopieDr.length === 0,
  kopieDr.length === 0
    ? 'brak drugiego literału z listą pól DR — jedno źródło prawdy'
    : `lista pól DR powtórzona w literale, linia(e): ${kopieDr.join(', ')} — druga kopia promptu wróciła`);

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
// Katalog nie może udawać pewności, której nie ma. Do 25.08 test wymagał, żeby
// ISTNIAŁY pola `pewne: false` — chronił przed hurtowym oznaczeniem wszystkiego
// jako sprawdzone. Ale weryfikacja u źródła FAKTYCZNIE nastąpiła (Dz.U. 2024
// poz. 1709, zał. 3 lit. C), więc warunek w tej postaci zaczął padać dokładnie
// za wykonanie pracy, o którą prosił.
//
// Nowy warunek pilnuje tego samego, tylko właściwie: albo są pola jawnie oznaczone
// do weryfikacji, albo katalog CYTUJE ŹRÓDŁO, na podstawie którego je zamknięto.
// Samo oznaczenie wszystkiego jako `pewne: true` bez podania aktu nadal nie przejdzie.
const zrodloWKatalogu = /Dz\.?\s*U\.?\s*20\d\d\s*poz\.\s*\d+/i.test(
  fs.readFileSync(path.join(ROOT, 'modules', 'dr-fields.js'), 'utf8')
);
ok(DR.doWeryfikacji().length > 0 || zrodloWKatalogu,
  DR.doWeryfikacji().length
    ? `${DR.doWeryfikacji().length} kodów jawnie oznaczonych do weryfikacji w Dz.U. — katalog nie udaje pewności`
    : (zrodloWKatalogu
        ? 'wszystkie kody pewne, a katalog podaje akt prawny, z którego je zweryfikowano'
        : 'wszystkie kody oznaczone jako pewne, ale katalog NIE PODAJE aktu — czym to poparte?'));

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
