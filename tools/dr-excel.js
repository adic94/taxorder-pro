#!/usr/bin/env node
/**
 * Excel ze WSZYSTKIMI polami dowodu rejestracyjnego — z pochodzeniem każdej wartości.
 *
 *     node tools/dr-excel.js <dane1.json> [dane2.json ...] [--wyjscie plik.xlsx]
 *
 * WIELE ŹRÓDEŁ NARAZ. Rekordy z kolejnych plików są SCALANE po numerze rejestracyjnym.
 * Gdy dwa źródła podają tę samą wartość — nic się nie dzieje. Gdy podają RÓŻNE, wygrywa
 * źródło wyżej w hierarchii (Aztec > CEPiK > zestawienie > OCR > nazwa pliku), ale
 * rozbieżność trafia na osobny arkusz „Konflikty". Ciche wybranie jednej wartości byłoby
 * najgorszym możliwym zachowaniem: różnica między DMC z dowodu a DMC z zestawienia
 * prowadzonego ręcznie to albo błąd przepisania, albo nieaktualny dowód — i jedno,
 * i drugie trzeba obejrzeć, a nie uśrednić.
 *
 * WEJŚCIE: tablica JSON, jeden obiekt na pojazd. Klucze pól zgodne z katalogiem
 * `modules/dr-fields.js`. Dodatkowo, opcjonalnie:
 *     _zrodlo   — źródło CAŁEGO rekordu:  'aztec' | 'cepik' | 'ocr' | 'folder'
 *     _zrodla   — źródło POJEDYNCZYCH pól: { dmcKg: 'cepik', liczbaOsi: 'ocr' }
 *     _plik     — ścieżka dokumentu źródłowego
 * `_zrodla` ma pierwszeństwo przed `_zrodlo`.
 *
 * ══ DLACZEGO POCHODZENIE JEST W ARKUSZU, A NIE TYLKO W LOGU ══
 *
 * Dane DR pochodzą z trzech źródeł o DRASTYCZNIE różnej wiarygodności:
 *
 *     Aztec  — odczyt z kodu 2D, wartość PEWNA
 *     CEPiK  — rejestr państwowy, wartość urzędowa
 *     OCR    — rozpoznanie ze skanu przez model językowy; MOŻE BYĆ ZMYŚLONA
 *
 * Arkusz, w którym „3500" z kodu Aztec wygląda identycznie jak „3500" zgadnięte przez
 * model z rozmytego skanu, jest gorszy niż brak arkusza: wygląda wiarygodnie i nikt go
 * nie zakwestionuje. Przy DMC i liczbie osi to wprost przekłada się na kwotę podatku
 * wobec urzędu. Dlatego każda komórka niesie kolor źródła, a osobny arkusz pokazuje
 * pokrycie pole po polu.
 *
 * DANE OSOBOWE. Arkusz zawiera VIN-y, numery rejestracyjne i dane właścicieli —
 * z definicji, bo taki jest jego cel. Zapis do drzewa repozytorium jest ODMAWIANY.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const DR = require(path.join(__dirname, '..', 'modules', 'dr-fields.js'));

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const POKAZ = argv.includes('--pokaz');
// `--zrodlo <nazwa>` nadaje zrodlo rekordom, ktore go nie maja. Bez tego pliki z cudzych
// pipeline'ow dostaja domyslna range „folder" — NAJNIZSZA — wiec przegrywaja z kazdym innym
// zrodlem nawet wtedy, gdy niosa lepsze dane. Dotyczy WSZYSTKICH plikow w tym wywolaniu.
const iz = argv.indexOf('--zrodlo');
const ZRODLO_DOMYSLNE = iz >= 0 ? argv[iz + 1] : null;
// `--zarzad <plik.xlsx>` — DRUGI skoroszyt, prezentacyjny, z TYCH SAMYCH scalonych
// danych. Nie zastępuje technicznego: tamten służy do pracy nad jakością (Konflikty,
// Odrzucone, Pokrycie), ten do pokazania ludziom i do wczytania przez inny program.
//
// DLACZEGO OSOBNY PLIK, A NIE DODATKOWE ARKUSZE. Odbiorcy są różni i mają sprzeczne
// potrzeby. Zarząd potrzebuje liczb, na których da się oprzeć decyzję — a więc też
// UCZCIWEJ informacji, ile z nich jest pewnych. Inny program potrzebuje stabilnych
// nagłówków i jednego wiersza na pojazd, bez scalonych komórek i bez kolorów niosących
// znaczenie. Arkusze diagnostyczne w tym samym pliku zachęcałyby do wklejenia całości
// do prezentacji razem z „447 odrzuconych wartości", co czyta się jak awaria, a jest
// normalną pracą filtrów.
const izar = argv.indexOf('--zarzad');
const WYJSCIE_ZARZAD = izar >= 0 ? argv[izar + 1] : null;
const iw = argv.indexOf('--wyjscie');
// `iw >= 0` JEST KONIECZNE. Bez tego przy braku --wyjscie mamy iw === -1, wiec iw+1 === 0
// i filtr wyrzuca argument numer 0 — czyli jedyny podany plik wejsciowy. Objawialo sie to
// wypisaniem instrukcji uzycia przy poprawnym wywolaniu.
// KAZDY parametr przyjmujacy wartosc musi byc tu wykluczony, inaczej jego wartosc
// wyladuje na liscie plikow wejsciowych i skrypt zglosi „nie ma takiego pliku"
// przy poprawnym wywolaniu. Dodajac nowy parametr z wartoscia — dopisz go tutaj.
const wejscia = argv.filter((a, i) => !a.startsWith('--')
  && !(iw >= 0 && i === iw + 1) && !(iz >= 0 && i === iz + 1) && !(izar >= 0 && i === izar + 1));
const wejscie = wejscia[0];
const wyjscie = (iw >= 0 ? argv[iw + 1] : null) || path.join(
  process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'taxorder-backupy',
  `dowody-rejestracyjne-${new Date().toISOString().slice(0, 10)}.xlsx`);

// Komunikat ma mowic, CO jest nie tak. Wypisanie instrukcji uzycia przy istniejacym,
// ale literowkowym argumencie kaze szukac bledu w skladni polecenia, a nie w sciezce.
const brakujace = wejscia.filter(w => !fs.existsSync(w));
if (wejscie && brakujace.length) {
  console.error(R(`\n  Nie ma takich plikow (${brakujace.length}):`));
  for (const b of brakujace) console.error(`     ${b}`);
  console.error(D('\n  Jesli to placeholder w rodzaju <plik>.json — podmien na prawdziwa sciezke.'));
  console.error(D('  Szukanie kandydatow:'));
  console.error(D('     Get-ChildItem "$env:USERPROFILE\\Documents\\taxorder-backupy" -Filter *.json'));
  console.error('');
  process.exit(2);
}
if (!wejscie) {
  console.error(`\nUżycie: node tools/dr-excel.js <dane1.json> [dane2.json ...] [--wyjscie plik.xlsx]\n`);
  console.error(`Wejście: tablica JSON, jeden obiekt na pojazd, klucze wg modules/dr-fields.js`);
  console.error(`Opcjonalnie w rekordzie: _zrodlo, _zrodla, _plik\n`);
  process.exit(2);
}

// ── Strażnik: arkusz z danymi osobowymi NIE trafia do repozytorium ────────────
// `.gitignore` chroni wyłącznie pliki wewnątrz drzewa i tylko gdy reguła powstała
// ZANIM plik się pojawił — reguła nie działa wstecz. Ostrzeżenie na terminalu ginie
// w wyjściu przebiegu; odmowa nie ginie.
/**
 * `--pokaz` — co naprawde jest w pliku JSON, zanim go scalimy.
 *
 * Pliki z cudzych pipeline'ow (checkpointy, wyniki OCR) maja wlasny ksztalt: bywaja
 * obiektem zamiast tablicy, trzymaja rekordy pod dowolnym kluczem, uzywaja innych nazw
 * pol. Scalanie na slepo daje arkusz z pustymi kolumnami i zadnego sygnalu, ze cos poszlo
 * nie tak — bo brak danych wyglada identycznie jak brak dopasowania.
 *
 * Ten sam wzorzec co `xlsx-import --pokaz`: najpierw obejrzyj, potem uzyj.
 */
function trybPokaz(sciezki) {
  for (const sc of sciezki) {
    console.log(B(`\n  ${path.basename(sc)}`));
    let d;
    try { d = JSON.parse(fs.readFileSync(sc, 'utf8')); }
    catch (e) { console.log(R(`     nie jest poprawnym JSON-em: ${e.message}\n`)); continue; }

    let rek = d, podKluczem = null;
    if (!Array.isArray(d)) {
      const kandydat = ['rekordy', 'pojazdy', 'data', 'results', 'items', 'wyniki', 'documents']
        .find(k => Array.isArray(d[k]));
      if (kandydat) { rek = d[kandydat]; podKluczem = kandydat; }
      else {
        const tablice = Object.entries(d).filter(([, v]) => Array.isArray(v) && v.length);
        if (tablice.length === 1) { rek = tablice[0][1]; podKluczem = tablice[0][0]; }
      }
    }
    if (!Array.isArray(rek)) {
      console.log(Y('     nie tablica rekordow.') + D(`  klucze najwyzszego poziomu: ${Object.keys(d).slice(0, 12).join(', ')}`));
      console.log(D('     Wskaz podtablice recznie albo przeksztalc plik.\n'));
      continue;
    }
    console.log(D(`     ${rek.length} rekordow` + (podKluczem ? ` (pod kluczem "${podKluczem}")` : '')));

    // Zbieramy WSZYSTKIE klucze wystepujace w rekordach, nie tylko z pierwszego —
    // pipeline'y czesto pomijaja puste pola, wiec pierwszy rekord nie opisuje calosci.
    const licznik = {};
    for (const r of rek.slice(0, 500)) {
      if (r && typeof r === 'object') for (const k of Object.keys(r)) licznik[k] = (licznik[k] || 0) + 1;
    }
    const znane = new Set(DR.klucze());
    const wszystkie = Object.keys(licznik).sort((a, b) => licznik[b] - licznik[a]);
    const pasuje = wszystkie.filter(k => znane.has(k));
    const obce   = wszystkie.filter(k => !znane.has(k) && !k.startsWith('_'));

    console.log(`     ${pasuje.length ? G('✓') : R('✗')} pol zgodnych z katalogiem: ${pasuje.length}`);
    for (const k of pasuje) {
      const pole = DR.wgKlucza[k];
      console.log(`        ${(pole.kod + ' ' + k).padEnd(28)} ${String(licznik[k]).padStart(4)} rekordow` +
        (pole.dt1 ? Y('   DT-1') : ''));
    }
    if (obce.length) console.log(D(`     pola spoza katalogu (${obce.length}): ${obce.slice(0, 14).join(', ')}${obce.length > 14 ? '…' : ''}`));
    const zeZrodlem = rek.filter(r => r && (r._zrodlo || r._zrodla)).length;
    console.log(D(`     rekordow z oznaczonym zrodlem: ${zeZrodlem}/${rek.length}` +
      (zeZrodlem ? '' : '  — dostana domyslne "folder", najnizsza range')));
  }
  console.log('');
}

// PODGLAD PRZED STRAZNIKAMI ZAPISU. `--pokaz` niczego nie zapisuje, wiec sprawdzanie
// katalogu docelowego i drzewa repozytorium jest dla niego bez znaczenia — a wykonane
// wczesniej BLOKOWALOBY podglad, gdy domyslny katalog nie istnieje.
if (POKAZ) { trybPokaz(wejscia); process.exit(0); }

const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel}`) + ' leży w drzewie repozytorium.');
  console.error('  Arkusz zawiera VIN-y, numery rejestracyjne i dane właścicieli.');
  console.error('  Wskaż lokalizację poza repo, np. ~/Documents/taxorder-backupy/\n');
  process.exit(2);
}
if (!fs.existsSync(path.dirname(cel))) {
  console.error(R(`\n  Katalog docelowy nie istnieje: ${path.dirname(cel)}\n`));
  process.exit(2);
}

const ZRODLA = {
  aztec:       { etykieta: 'Aztec (pewne)',     kolor: 'FFC6EFCE', ranga: 4 },
  cepik:       { etykieta: 'CEPiK (urzędowe)',  kolor: 'FFBDD7EE', ranga: 3 },
  zestawienie: { etykieta: 'zestawienie (ręcz.)', kolor: 'FFD9E1F2', ranga: 2 },
  ocr:         { etykieta: 'OCR (do sprawdz.)', kolor: 'FFFFE699', ranga: 1 },
  folder:      { etykieta: 'nazwa pliku',       kolor: 'FFE7E6E6', ranga: 0 },
};
const zrodloPola = (rek, klucz) =>
  (rek._zrodla && rek._zrodla[klucz]) || rek._zrodlo || ZRODLO_DOMYSLNE || null;

/**
 * Numer rejestracyjny z nazwy pliku — TYLKO gdy wygląda jak polska tablica.
 *
 * Checkpointy OCR bywają kluczowane ścieżką skanu, a nie numerem rejestracyjnym.
 * Zgadywanie numeru z dowolnego fragmentu nazwy byłoby zmyślaniem danych, więc wzorzec
 * jest wąski: pierwsza litera musi być literą wyróżnika województwa, całość ma zawierać
 * cyfrę i mieścić się w 4–8 znakach. Rekord rozpoznany tą drogą dostaje źródło `folder`
 * — najniższą rangę w scalaniu — więc przegrywa z każdym innym źródłem tego samego pola.
 */
const LITERY_WOJ = 'BCDEFGKLNOPRSTWZ';
function nrZNazwyPliku(nazwa) {
  const baza = path.basename(String(nazwa)).replace(/\.[a-z0-9]+$/i, '').toUpperCase();
  for (const kandydat of baza.split(/[^A-Z0-9]+/)) {
    if (kandydat.length < 4 || kandydat.length > 8) continue;
    if (!LITERY_WOJ.includes(kandydat[0])) continue;
    if (!/[0-9]/.test(kandydat) || !/^[A-Z]{1,3}[A-Z0-9]{3,7}$/.test(kandydat)) continue;
    return kandydat;
  }
  return null;
}

/**
 * Numer rejestracyjny CZYTANY WPROST Z TREŚCI OCR — w przeciwieństwie do wyżej,
 * ten nie miał ŻADNEJ kontroli kształtu. `nrZNazwyPliku` ogranicza się do 4–8 znaków,
 * ale to ograniczenie dotyczyło WYŁĄCZNIE ścieżki „numer zgadnięty z nazwy pliku" —
 * `rek.nrRej` odczytane wprost z pola OCR szło do scalania bez sprawdzenia w ogóle.
 *
 * Realny skutek na pełnym zbiorze: 11/100 wierszy w „Spoza zestawienia" miało
 * „numer rejestracyjny" długości 10 znaków — fragmenty VIN-u (`WDBUF70J41`,
 * prefiks `WDB` to Mercedes) i fragmenty ŚCIEŻKI PLIKU (`KRAJU2022-`, `WKOŁO2824-`).
 * Każdy taki wpis tworzy w arkuszu pojazd-widmo z kompletem pól, nieodróżnialny
 * od prawdziwego wiersza.
 *
 * Polska tablica: 2–3 znaki wyróżnika + do 5 znaków numeru, całość 4–8 znaków.
 * Rekord z numerem POZA tym kształtem traktujemy tak samo, jak brak numeru —
 * nie zgadujemy, czy to literówka, czy śmieć; po prostu nie wchodzi do scalania.
 */
function wygladaJakTablica(nr) {
  const n = String(nr).toUpperCase().replace(/[\s-]/g, '');
  return n.length >= 4 && n.length <= 8 && /^[A-Z]{1,3}[A-Z0-9]{2,7}$/.test(n) && /[0-9]/.test(n);
}

/** Checkpoint OCR kluczowany ścieżką pliku -> tablica rekordów. */
function zCheckpointu(wpisy, sciezka) {
  const out = [];
  let bezNumeru = 0, zNazwy = 0, zlyKsztalt = 0;
  for (const [klucz, wartosc] of wpisy) {
    // Wartość bywa opakowana — checkpoint zapisuje czasem {pola:{…}, ok:true}.
    const rek = wartosc.pola || wartosc.fields || wartosc.dane || wartosc;
    if (!rek || typeof rek !== 'object' || Array.isArray(rek)) { bezNumeru++; continue; }
    let nr = rek.nrRej || rek.numerRejestracyjny || rek.nr_rej;
    let zrodloNr = null;
    // Numer odczytany WPROST z tresci OCR nie mial zadnej kontroli ksztaltu — w
    // przeciwienstwie do numeru zgadywanego z nazwy pliku nizej. Fragment VIN-u
    // albo sciezki pliku przechodzil jako "numer rejestracyjny" bez zadnego sygnalu.
    if (nr && !wygladaJakTablica(nr)) { nr = null; zlyKsztalt++; }
    if (!nr) { nr = nrZNazwyPliku(klucz); if (nr) { zNazwy++; zrodloNr = 'folder'; } }
    if (!nr) { bezNumeru++; continue; }
    // Sciezka skanu zostaje przy rekordzie: przy pojezdzie-widmie to jedyny sposob,
    // zeby otworzyc dokument i sprawdzic, czy numer zostal zle odczytany.
    out.push(zrodloNr
      ? { ...rek, nrRej: nr, _plik: rek._plik || klucz, _zrodlaNrZNazwy: true }
      : { ...rek, nrRej: nr, _plik: rek._plik || klucz });
  }
  const nazwa = path.basename(sciezka);
  console.log(D(`  ${nazwa}: checkpoint kluczowany ścieżką pliku — ${out.length} rekordów` +
    (zNazwy ? `, w tym ${zNazwy} z numerem odczytanym z nazwy pliku` : '') +
    (zlyKsztalt ? `, odrzucono ${zlyKsztalt} numerów o nieprawidłowym kształcie (fragment VIN/ścieżki)` : '') +
    (bezNumeru ? `, pominięto ${bezNumeru} bez numeru rejestracyjnego` : '')));
  return out;
}

function wczytaj(sciezka) {
  let d;
  try { d = JSON.parse(fs.readFileSync(sciezka, 'utf8')); }
  catch (e) { console.error(R(`\n  ${path.basename(sciezka)} nie jest poprawnym JSON-em: ${e.message}\n`)); process.exit(2); }
  if (Array.isArray(d)) return d;

  const zPola = d.rekordy || d.pojazdy || d.data;
  if (Array.isArray(zPola)) return zPola;

  // Kształt „obiekt kluczowany ścieżką pliku" — tak zapisuje checkpoint ekstrakcji DR.
  // Wcześniej narzędzie odmawiało tu pracy, przez co WYNIKI OCR w ogóle nie trafiały
  // do arkusza, mimo że były policzone. Odmowa była słuszna wtedy, gdy alternatywą było
  // zgadywanie; teraz kształt jest rozpoznawany jawnie i raportowany.
  const wpisy = Object.entries(d).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  if (wpisy.length) return zCheckpointu(wpisy, sciezka);

  console.error(R(`\n  ${path.basename(sciezka)}: oczekiwano tablicy rekordów albo obiektu`));
  console.error(R('  kluczowanego ścieżką pliku. Znaleziono ani jedno, ani drugie.\n'));
  process.exit(2);
}

// Numer rejestracyjny bywa zapisany ze spacjami i małymi literami — do dopasowania
// normalizujemy, ale W ARKUSZU zostaje wartość ze źródła o najwyższej randze.
const kluczScalania = (r) => String(r.nrRej ?? '').toUpperCase().replace(/[\s-]/g, '');

/**
 * Wartosc pasuje do typu pola — inaczej NIE trafia do arkusza.
 *
 * PO CO. Pierwsze scalenie danych z OCR ujawnilo wartosci wlozone w niewlasciwe pola:
 *
 *     F.1 (maksymalna masa, kg)  ->  "2023.05.11"      data zamiast kilogramow
 *     F.3 (masa zespolu, kg)     ->  "m.p."            skrot z formularza
 *     J   (kategoria)            ->  "m.p."
 *
 * Model jezykowy czytajacy skan potrafi przypisac wartosc do sasiedniego pola. Arkusz,
 * ktory to przyjmuje, wyglada na kompletny i jest fałszywy — a przy DMC i liczbie osi
 * przeklada sie wprost na kwote podatku. Odrzucenie zostawia pole PUSTE, co jest widoczne
 * w arkuszu Pokrycie; przyjecie smiecia nie jest widoczne nigdzie.
 *
 * Zakresy pochodza z katalogu (`modules/dr-fields.js`), zeby nie powstala kolejna kopia.
 */
function wartoscPasuje(pole, v) {
  const t = String(v).trim();
  if (!t) return { ok: false, powod: 'puste' };

  if (pole.typ === 'liczba') {
    // Data w polu liczbowym to najczestszy blad OCR — rozpoznajemy ja ZANIM sprobujemy
    // sparsowac, bo „2023.05.11" po usunieciu kropek daje wiarygodnie wygladajace 20230511.
    if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(t)) {
      return { ok: false, powod: 'data w polu liczbowym' };
    }
    const n = Number(t.replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return { ok: false, powod: 'nie jest liczba' };
    if (pole.zakres && (n < pole.zakres[0] || n > pole.zakres[1])) {
      return { ok: false, powod: `poza zakresem ${pole.zakres[0]}–${pole.zakres[1]}` };
    }
    return { ok: true, wartosc: n };
  }

  if (pole.typ === 'data') {
    if (!/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(t)) {
      return { ok: false, powod: 'nie wyglada na date' };
    }
    return { ok: true, wartosc: t };
  }

  // Skroty z formularzy („m.p." = miejsce puste, „---", „b/d") niosa informacje „brak",
  // a nie wartosc. Wpuszczone do arkusza udaja dane.
  if (/^(m\.?\s*p\.?|---+|-|b\/?d|brak|n\/?d|nie dotyczy)$/i.test(t)) {
    return { ok: false, powod: 'oznaczenie braku danych' };
  }

  // Nazwa MODELU AI zamiast wartosci pola. Znaleziono na pelnym zbiorze: gdy model
  // jezykowy nie odczytal np. D.3 (model pojazdu), gdzies w checkpoint DALEJ ladowala
  // wartosc typu "cf-workers-ai-llama-3.2-11b" — metadane "ktory model czytal skan",
  // nie dana pojazdu. 30/100 wierszy w "Spoza zestawienia" mialo to w polu Model.
  // Sprawdzamy KAZDE pole tekstowe, nie tylko `model` — kontaminacja moze trafic gdziekolwiek.
  if (/^(cf-workers-ai|@cf\/|llama[-\s]?\d|groq|gpt-\d|claude-\d)/i.test(t)) {
    return { ok: false, powod: 'nazwa modelu AI zamiast wartosci' };
  }

  // ETYKIETA=WARTOSC sklejone w jeden string. Istniejaca regula nizej lapala TYLKO kod
  // rubryki w NAWIASIE ("Zamieszenie inne - (V.9) ..."), nie ten wzorzec — znaleziony
  // osobno na pelnym zbiorze: "D.1=KIA", "D.2=C.2", "RODZAJ POJAZDU = SAMOCHOD". Model
  // przepisal etykiete razem z wartoscia zamiast samej wartosci. Nie probujemy odzyskac
  // czesci po "=" — to byloby cichym zgadywaniem, dokladnie to, czego ten plik unika
  // wszedzie indziej (patrz komentarz przy `konflikty` wyzej).
  if (/[A-ZŁŚĆŻŹŃÓĘĄ.\d\s]{2,40}=/i.test(t)) {
    return { ok: false, powod: 'etykieta=wartosc sklejone (zawiera znak =)' };
  }

  // Nazwa FOLDERU zamiast marki pojazdu. "archiwum" to najczestszy artefakt — pliki
  // przeniesione do podfolderu `archiwum/` w strukturze projektu, ktorego nazwa trafila
  // do pola marka zamiast prawdziwej marki auta. 22/100 w "Spoza zestawienia" mialo to.
  if (pole.klucz === 'marka' && /^(archiwum|dokumentacja|skany?|kopia|stary|nowy|backup)$/i.test(t)) {
    return { ok: false, powod: 'nazwa folderu zamiast marki pojazdu' };
  }

  // FRAGMENT INSTRUKCJI Z PROMPTU zamiast wartosci — model odbil czesc WLASNEGO polecenia
  // (worker/index.js DR_POLA_OCR), nie dane z dokumentu. Rozne od "etykieta=wartosc"
  // wyzej: tu nie ma znaku "=", a fragment bywa KROTSZY niz limit 60 znakow, wiec
  // przechodzil. Znalezione na pelnym zbiorze: `przeznaczenie` dla dwoch pojazdow mialo
  // „RODZAJ POJAZDU / PRZEZNACZENIE z sekcji bezowej, np SAMOCHOD" (59 znakow — obcięty
  // fragment prawdziwej instrukcji, ktora jest dluzsza). To pole DT-1: decyduje o
  // zwolnieniu (pojazd specjalny), wiec smiec tutaj nie jest kosmetyczny.
  const FRAGMENTY_PROMPTU = [
    'z sekcji bezowej', 'zoltej tabeli', 'adnotacjach urzedowych', 'puste jesli',
    'nie zgaduj', 'skonczony zbior', 'krotki kod techniczny', 'dokladnie 17 znakow',
  ];
  const tNorm = t.toLowerCase();
  if (FRAGMENTY_PROMPTU.some(f => tNorm.includes(f))) {
    return { ok: false, powod: 'fragment instrukcji promptu zamiast wartosci' };
  }

  // --- POLA TEKSTOWE TEZ WYMAGAJA KONTROLI ------------------------------------------
  // Do 21.08 kazda niepusta wartosc tekstowa wchodzila do arkusza. Pierwsze scalenie na
  // pelnym zbiorze pokazalo, co przez to przechodzi:
  //
  //     przeznaczenie = „2 3 MAR 2004"
  //     przeznaczenie = „Zamieszenie inne - (V.9) Pozion przys. Spalin - Euro VI D-4"
  //
  // Pierwsze to data z sasiedniej rubryki, drugie to sklejka ETYKIET z formularza, nie
  // wartosc. Oba wygladaja jak dane i oba trafialyby do deklaracji DT-1.
  //
  // Pola dlugie z natury (nazwiska, adresy, VIN, nr homologacji) sa z tych regul wylaczone.
  const DLUGIE = new Set(['posiadacz', 'wlasciciel', 'adresWlasciciela', 'nrHomolog', 'typ', 'okresWaznosci']);
  if (!DLUGIE.has(pole.klucz)) {
    if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(t)) {
      return { ok: false, powod: 'data w polu tekstowym' };
    }
    // „2 3 MAR 2004" — dzien i rok wokol skrotu miesiaca, w dowolnym rozstrzeleniu.
    if (/\b(STY|LUT|MAR|KWI|MAJ|CZE|LIP|SIE|WRZ|PAZ|PAŹ|LIS|GRU|JAN|FEB|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b[\s.]*\d{4}/i.test(t)) {
      return { ok: false, powod: 'data slowna w polu tekstowym' };
    }
    // Odwolanie do kodu rubryki w TRESCI wartosci znaczy, ze model przepisal etykiete.
    if (/\((?:[A-Z]\.?\d(?:\.\d)?)\)/.test(t)) {
      return { ok: false, powod: 'etykieta rubryki zamiast wartosci' };
    }
    if (t.length > 60) return { ok: false, powod: 'tekst dluzszy niz 60 znakow' };
  }

  // --- DZIEDZINA ZAMKNIETA ----------------------------------------------------------
  // Niektore pola maja skonczony zbior dopuszczalnych wartosci (kategoria homologacyjna,
  // rodzaj zawieszenia). Reguly ogolne ich nie chronia: „SIA MTOILET" w polu J jest
  // krotkie, nie jest data i nie zawiera kodu rubryki — a to nazwa spolki z sasiedniej
  // rubryki, ktora w arkuszu wygladala jak kategoria pojazdu.
  if (pole.domena) {
    const n = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // `d.includes(n)` (domena zawiera nasz fragment) jest bezpieczne tylko przy fragmencie
    // dlugim na tyle, zeby nie trafic przypadkiem. Znalezione na pelnym zbiorze: pojedyncza
    // litera „R" (smiec z OCR, prawdopodobnie urwany kod paliwa/homologacji) przechodzila
    // test zawieszenia, bo „ROWNOWAZNE" zawiera literke R — smiec dlugosci 1 wygladal w
    // arkuszu jak prawdziwa odpowiedz. Kierunek `n.includes(d)` (nasz tekst zawiera CALE
    // slowo domeny) nie ma tego problemu — domena ma z gory znane, wystarczajaco dlugie slowa.
    const trafienie = pole.domenaLuzna
      ? pole.domena.find(d => n.includes(d) || (n.length >= 4 && d.includes(n)))
      : pole.domena.find(d => d === n);
    if (!trafienie) {
      // Pola bez kodu z dyrektywy maja kod „—", wiec komunikat nazywa je po nazwie.
      return { ok: false, powod: `spoza dopuszczalnych wartosci pola ${pole.kod === '—' ? pole.nazwa.toLowerCase() : pole.kod}` };
    }
    // Zapis normalizujemy do postaci z katalogu tylko przy dziedzinie SCISLEJ; przy luznej
    // zostawiamy tekst zrodla, bo niesie wiecej niz sam symbol.
    return { ok: true, wartosc: pole.domenaLuzna ? t : trafienie };
  }
  return { ok: true, wartosc: t };
}

const konflikty = [];
const odrzucone = [];
const scalone = new Map();

for (const sciezka of wejscia) {
  for (const rek of wczytaj(sciezka)) {
    const k = kluczScalania(rek);
    if (!k) continue;                       // bez numeru nie ma po czym scalać
    if (!scalone.has(k)) scalone.set(k, { _zrodla: {}, _plik: rek._plik, _uzyte: new Set(), _zNazwy: false });
    const cel = scalone.get(k);
    if (rek._zrodlaNrZNazwy) cel._zNazwy = true;
    if (!cel._plik && rek._plik) cel._plik = rek._plik;

    for (const p of DR.POLA) {
      const surowa = rek[p.klucz];
      if (surowa == null || surowa === '') continue;
      const sprawdz = wartoscPasuje(p, surowa);
      if (!sprawdz.ok) {
        odrzucone.push({ nrRej: rek.nrRej || k, kod: p.kod, pole: p.nazwa, dt1: p.dt1,
          wartosc: String(surowa).slice(0, 40), powod: sprawdz.powod,
          zrodlo: zrodloPola(rek, p.klucz) || 'folder' });
        continue;
      }
      const v = sprawdz.wartosc;
      const z = zrodloPola(rek, p.klucz) || 'folder';
      const rangaNowa = ZRODLA[z]?.ranga ?? 0;
      const zStare = cel._zrodla[p.klucz];
      const rangaStara = zStare ? (ZRODLA[zStare]?.ranga ?? 0) : -1;

      // Porównanie zachowawcze: różnica w zapisie („18 000" vs „18000", wielkość liter)
      // nie jest konfliktem. Różnica wartości — jest, i musi być widoczna.
      const norm = (x) => String(x).trim().toUpperCase().replace(/\s+/g, '').replace(',', '.');
      if (zStare && norm(cel[p.klucz]) !== norm(v)) {
        konflikty.push({
          nrRej: cel.nrRej || k, kod: p.kod, pole: p.nazwa, dt1: p.dt1,
          a: cel[p.klucz], zrodloA: zStare, b: v, zrodloB: z,
          wybrano: rangaNowa > rangaStara ? z : zStare,
        });
      }
      cel._uzyte.add(z);
      if (rangaNowa > rangaStara) { cel[p.klucz] = v; cel._zrodla[p.klucz] = z; }
    }
  }
}

const rekordy = [...scalone.values()];

/**
 * Pojazdy, o ktorych wie WYLACZNIE OCR albo nazwa pliku.
 *
 * PO CO. Pierwsze scalenie na pelnym zbiorze dalo 916 pojazdow przy flocie liczacej 816.
 * Setka nadwyzki nie wzięła się z nikąd: numer rejestracyjny czytany z NAZWY PLIKU bywa
 * przeklamany (jedna litera, jedna cyfra), a kazde takie przeklamanie tworzy pojazd,
 * ktory nie istnieje — z kompletem pol, wygladajacy w arkuszu jak kazdy inny wiersz.
 *
 * Wierszy NIE USUWAMY: czesc z nich to moga byc pojazdy faktycznie nowe, jeszcze
 * nieobecne w zestawieniu. Ale musza byc WYMIENIONE Z NAZWY, zeby dalo sie je obejrzec,
 * zamiast rozplynac sie w 916 wierszach.
 */
const spozaZestawienia = rekordy.filter(r => {
  const uzyte = [...(r._uzyte || [])];
  return uzyte.length > 0 && uzyte.every(z => (ZRODLA[z]?.ranga ?? 0) <= 1);
});

/**
 * Skoroszyt PREZENTACYJNY — dla zarządu i do wczytania przez inny program.
 *
 * Cztery arkusze, każdy z jednym odbiorcą na uwadze:
 *   Podsumowanie   — liczby, na których da się oprzeć decyzję, RAZEM z informacją,
 *                    ile z nich jest pewnych
 *   Flota          — jeden wiersz na pojazd, stabilne nagłówki, bez scalonych komórek
 *                    i bez znaczenia niesionego kolorem → nadaje się do importu
 *   Podatek DT-1   — status podatkowy per pojazd
 *   Jakość danych  — skąd pochodzi to, co widać, i czego brakuje
 *
 * ⚠️ ARKUSZ NIE UDAJE PEWNOŚCI, KTÓREJ NIE MA. Kuszące byłoby pokazać zarządowi
 * same wypełnione wiersze — wygląda lepiej. Ale część danych pochodzi z OCR skanów,
 * a numer rejestracyjny czytany z nazwy pliku bywa przekłamany o jeden znak i tworzy
 * pojazd, który nie istnieje. Dlatego każdy wiersz niesie kolumnę „Pewność", a
 * Podsumowanie podaje, ile pojazdów zna WYŁĄCZNIE OCR. Deklaracja podatkowa oparta
 * na takim wierszu wygląda wiarygodnie i nikt jej nie zakwestionuje poza urzędem.
 */
async function zapiszDlaZarzadu(cel, rekordy, dt1Wiersze, konflikty, odrzucone, spozaZestawienia) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TaxOrder Pro';
  wb.created = new Date();

  const NAGL = { bold: true, color: { argb: 'FFFFFFFF' } };
  const TLO_NAGL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  const stylujNaglowek = (ws) => {
    ws.getRow(1).font = NAGL;
    ws.getRow(1).fill = TLO_NAGL;
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(1).height = 28;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  // Pewność wiersza: czy pojazd jest potwierdzony przez źródło inne niż OCR/nazwa pliku.
  const spozaSet = new Set(spozaZestawienia.map(r => r.nrRej));
  const pewnosc = (r) => {
    if (r._zNazwy) return 'NISKA — numer z nazwy pliku';
    if (spozaSet.has(r.nrRej)) return 'ŚREDNIA — tylko OCR';
    return 'wysoka';
  };

  // ── 1. Podsumowanie ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Podsumowanie');
  ws.columns = [{ width: 46 }, { width: 16 }, { width: 62 }];
  const sekcja = (t) => {
    const r = ws.addRow([t]);
    r.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
    ws.addRow([]);
  };
  const poz = (etykieta, wartosc, komentarz) => {
    const r = ws.addRow([etykieta, wartosc, komentarz || '']);
    r.getCell(2).alignment = { horizontal: 'right' };
    r.getCell(3).font = { size: 9, color: { argb: 'FF808080' } };
    return r;
  };

  const tytul = ws.addRow(['Flota — stan danych z dowodów rejestracyjnych']);
  tytul.font = { bold: true, size: 15 };
  ws.addRow([`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`]).font = { size: 9, color: { argb: 'FF808080' } };
  ws.addRow([]);

  sekcja('FLOTA');
  poz('Pojazdów łącznie', rekordy.length);
  poz('— potwierdzonych zestawieniem', rekordy.length - spozaZestawienia.length);
  poz('— znanych wyłącznie z OCR lub nazwy pliku', spozaZestawienia.length,
    'Numer czytany z nazwy pliku bywa przekłamany — te wiersze wymagają potwierdzenia');
  ws.addRow([]);

  sekcja('PODATEK OD ŚRODKÓW TRANSPORTOWYCH (DT-1)');
  const podlega = dt1Wiersze.filter(w => w._podlega);
  const zwolnione = dt1Wiersze.filter(w => w.status.startsWith('zwolniony'));
  const wymaga12t = dt1Wiersze.filter(w => w._wymaga12t);
  const brak12t = wymaga12t.filter(w => w.braki);
  const nieDaSie = dt1Wiersze.filter(w => w.status === 'NIE DA SIE USTALIC');
  poz('Podlega podatkowi (kategoria ustalona)', podlega.length);
  poz('Zwolnionych jako pojazdy specjalne', zwolnione.length);
  poz('Od 12 t — wymaga liczby osi i zawieszenia', wymaga12t.length,
    'Poniżej 12 t kategorię wyznacza sama DMC — te pola nie są tam potrzebne');
  poz('— z brakami w tych polach', brak12t.length).getCell(2).font =
    { bold: true, color: { argb: brak12t.length ? 'FFC00000' : 'FF008000' } };
  poz('Bez DMC — kategorii nie da się ustalić', nieDaSie.length,
    'Bez masy całkowitej nie ma podstawy wymiaru — wymaga uzupełnienia ręcznego')
    .getCell(2).font = { bold: true, color: { argb: nieDaSie.length ? 'FFC00000' : 'FF008000' } };
  ws.addRow([]);

  sekcja('CO JESZCZE WYMAGA UWAGI');
  poz('Rozbieżności między źródłami', konflikty.length,
    'Ta sama rubryka odczytana różnie z różnych dokumentów');
  poz('— w polach wpływających na podatek', konflikty.filter(k => k.dt1).length,
    'Te obejrzeć przed złożeniem deklaracji');
  poz('Wartości odrzuconych przez filtry', odrzucone.length,
    'NIE są to braki danych — to wartości, które model wstawił w złe pole i zostały zatrzymane');
  ws.addRow([]);
  const nota = ws.addRow(['Dane pochodzą ze skanów dowodów rejestracyjnych, kodów Aztec i zestawienia floty.']);
  nota.font = { italic: true, size: 9, color: { argb: 'FF808080' } };
  ws.addRow(['Kolumna „Pewność" w arkuszu Flota mówi, na ile źródło danego wiersza jest wiarygodne.'])
    .font = { italic: true, size: 9, color: { argb: 'FF808080' } };

  // ── 2. Flota — do wczytania przez inny program ─────────────────────────────
  const wf = wb.addWorksheet('Flota');
  wf.columns = [
    { header: 'Nr rejestracyjny', key: 'nrRej', width: 16 },
    { header: 'Marka', key: 'marka', width: 16 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Typ (D.2)', key: 'typ', width: 16 },
    { header: 'Rodzaj pojazdu', key: 'rodzaj', width: 24 },
    { header: 'VIN', key: 'vin', width: 20 },
    { header: 'Data 1. rejestracji', key: 'dataRej', width: 16 },
    { header: 'Rok produkcji', key: 'rokProd', width: 13 },
    { header: 'Kategoria (J)', key: 'kategoria', width: 13 },
    { header: 'DMC [kg]', key: 'dmcKg', width: 11 },
    { header: 'DMC zespołu [kg]', key: 'dmcZespolu', width: 15 },
    { header: 'Masa własna [kg]', key: 'masaWlKg', width: 15 },
    { header: 'Liczba osi', key: 'liczbaOsi', width: 10 },
    { header: 'Zawieszenie', key: 'zawieszenie', width: 18 },
    { header: 'Paliwo', key: 'paliwo', width: 10 },
    { header: 'Pojemność [cm3]', key: 'pojSilnika', width: 14 },
    { header: 'Moc [kW]', key: 'mocKW', width: 10 },
    { header: 'Miejsca siedzące', key: 'miejscaSied', width: 14 },
    { header: 'Norma EURO', key: 'normaEuro', width: 12 },
    { header: 'Nr homologacji', key: 'nrHomolog', width: 22 },
    { header: 'Pewność', key: 'pewnosc', width: 26 },
  ];
  for (const r of [...rekordy].sort((a, b) => String(a.nrRej).localeCompare(String(b.nrRej), 'pl'))) {
    wf.addRow({
      nrRej: r.nrRej || '', marka: r.marka || '', model: r.model || '', typ: r.typ || '',
      rodzaj: r.przeznaczenie || '', vin: r.vin || '', dataRej: r.dataRej || '',
      rokProd: r.rokProd ?? '', kategoria: r.kategoria || '',
      dmcKg: r.dmcKg ?? '', dmcZespolu: r.dmcZespolu ?? '', masaWlKg: r.masaWlKg ?? '',
      liczbaOsi: r.liczbaOsi ?? '', zawieszenie: r.zawieszenie || '', paliwo: r.paliwo || '',
      pojSilnika: r.pojSilnika ?? '', mocKW: r.mocKW ?? '', miejscaSied: r.miejscaSied ?? '',
      normaEuro: r.normaEuro || '', nrHomolog: r.nrHomolog || '', pewnosc: pewnosc(r),
    });
  }
  stylujNaglowek(wf);
  wf.autoFilter = { from: 'A1', to: { row: 1, column: wf.columns.length } };

  // ── 3. Podatek DT-1 ────────────────────────────────────────────────────────
  const wd = wb.addWorksheet('Podatek DT-1');
  wd.columns = [
    { header: 'Nr rejestracyjny', key: 'nrRej', width: 16 },
    { header: 'Marka', key: 'marka', width: 16 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Rodzaj pojazdu', key: 'rodzaj', width: 24 },
    { header: 'DMC [kg]', key: 'dmc', width: 11 },
    { header: 'DMC zespołu [kg]', key: 'dmcZesp', width: 15 },
    { header: 'Liczba osi', key: 'osie', width: 10 },
    { header: 'Zawieszenie', key: 'zawieszenie', width: 18 },
    { header: 'Kategoria DT-1', key: 'kat', width: 14 },
    { header: 'Możliwe kategorie (brak osi)', key: 'katWarianty', width: 26 },
    { header: 'Status', key: 'status', width: 26 },
    { header: 'Czego brakuje', key: 'braki', width: 34 },
  ];
  for (const w of [...dt1Wiersze].sort((a, b) => String(a.nrRej).localeCompare(String(b.nrRej), 'pl'))) {
    const row = wd.addRow(w);
    if (w.status === 'NIE DA SIE USTALIC') row.getCell('status').font = { bold: true, color: { argb: 'FFC00000' } };
    else if (w._niepewny) row.getCell('status').font = { color: { argb: 'FFBF8F00' } };
    else if (w.status.startsWith('zwolniony')) row.getCell('status').font = { color: { argb: 'FF008000' } };
  }
  stylujNaglowek(wd);
  wd.autoFilter = { from: 'A1', to: { row: 1, column: wd.columns.length } };

  // ── 4. Jakość danych ───────────────────────────────────────────────────────
  const wj = wb.addWorksheet('Jakość danych');
  wj.columns = [
    { header: 'Pole', key: 'pole', width: 40 },
    { header: 'Wypełnionych', key: 'ile', width: 13 },
    { header: 'Pokrycie', key: 'proc', width: 11 },
    { header: 'Wpływa na podatek', key: 'dt1', width: 18 },
  ];
  for (const p of DR.POLA) {
    const ile = rekordy.filter(r => r[p.klucz] != null && r[p.klucz] !== '').length;
    wj.addRow({
      pole: `${p.kod ? p.kod + ' — ' : ''}${p.nazwa}`,
      ile, proc: rekordy.length ? Math.round(ile / rekordy.length * 100) / 100 : 0,
      dt1: p.dt1 ? 'TAK' : '',
    });
  }
  wj.getColumn('proc').numFmt = '0%';
  stylujNaglowek(wj);
  wj.autoFilter = { from: 'A1', to: { row: 1, column: wj.columns.length } };

  await wb.xlsx.writeFile(cel);
  console.log(`  ${G('✓')} skoroszyt dla zarządu: ${cel}`);
  console.log(D('     arkusze: Podsumowanie, Flota, Podatek DT-1, Jakość danych\n'));
}

(async () => {
  console.log(B(`\n  Excel z dowodów rejestracyjnych — ${rekordy.length} pojazdów\n`));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TaxOrder Pro';
  wb.created = new Date();

  // ── Arkusz 1: dane ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Pojazdy', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const kolumny = DR.POLA;

  ws.columns = [
    ...kolumny.map(p => ({ header: DR.naglowek(p), key: p.klucz, width: Math.min(38, Math.max(12, DR.naglowek(p).length + 2)) })),
    { header: 'Plik źródłowy', key: '_plik', width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: 'top' };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const pokrycie = Object.fromEntries(kolumny.map(p => [p.klucz, { razem: 0, wg: {} }]));

  for (const rek of rekordy) {
    const wiersz = ws.addRow({
      ...Object.fromEntries(kolumny.map(p => [p.klucz, rek[p.klucz] ?? ''])),
      _plik: rek._plik ? path.basename(String(rek._plik)) : '',
    });
    kolumny.forEach((p, i) => {
      const v = rek[p.klucz];
      if (v == null || v === '') return;
      pokrycie[p.klucz].razem++;
      const z = zrodloPola(rek, p.klucz);
      if (z) {
        pokrycie[p.klucz].wg[z] = (pokrycie[p.klucz].wg[z] || 0) + 1;
        const def = ZRODLA[z];
        if (def) wiersz.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.kolor } };
      }
      if (p.typ === 'liczba') {
        const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (Number.isFinite(n)) wiersz.getCell(i + 1).value = n;
      }
    });
  }

  // ── Arkusz 2: pokrycie — gdzie są dziury i skąd pochodzi to, co jest ────────
  const wp = wb.addWorksheet('Pokrycie');
  wp.columns = [
    { header: 'Kod', key: 'kod', width: 8 },
    { header: 'Pole', key: 'nazwa', width: 38 },
    { header: 'DT-1', key: 'dt1', width: 7 },
    { header: 'Wypełnione', key: 'n', width: 12 },
    { header: '%', key: 'proc', width: 8 },
    ...Object.entries(ZRODLA).map(([k, v]) => ({ header: v.etykieta, key: k, width: 17 })),
  ];
  wp.getRow(1).font = { bold: true };
  for (const p of kolumny) {
    const st = pokrycie[p.klucz];
    const w = wp.addRow({
      kod: p.kod, nazwa: p.nazwa, dt1: p.dt1 ? 'TAK' : '',
      n: st.razem, proc: rekordy.length ? Math.round(st.razem / rekordy.length * 100) / 100 : 0,
      ...Object.fromEntries(Object.keys(ZRODLA).map(k => [k, st.wg[k] || 0])),
    });
    w.getCell('proc').numFmt = '0%';
    // Pole DT-1 z niskim pokryciem to nie kosmetyka — to brak podstawy do wyliczenia podatku.
    if (p.dt1 && st.razem / (rekordy.length || 1) < 0.5) {
      w.getCell('nazwa').font = { color: { argb: 'FF9C0006' }, bold: true };
    }
  }
  wp.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wp.columns.length } };

  // ── Arkusz 3: konflikty ────────────────────────────────────────────────────
  //
  // Rozbieżność między źródłami to informacja, nie usterka do ukrycia. Różne DMC
  // w dowodzie i w zestawieniu oznacza albo błąd przepisania, albo nieaktualny dowód —
  // i jedno, i drugie trzeba obejrzeć. Ciche wybranie jednej wartości zabrałoby jedyny
  // sygnał, że coś się nie zgadza.
  if (konflikty.length) {
    const wk = wb.addWorksheet('Konflikty');
    wk.columns = [
      { header: 'Nr rej.', key: 'nrRej', width: 12 },
      { header: 'Kod', key: 'kod', width: 8 },
      { header: 'Pole', key: 'pole', width: 34 },
      { header: 'DT-1', key: 'dt1', width: 7 },
      { header: 'Wartość A', key: 'a', width: 22 },
      { header: 'Źródło A', key: 'zrodloA', width: 16 },
      { header: 'Wartość B', key: 'b', width: 22 },
      { header: 'Źródło B', key: 'zrodloB', width: 16 },
      { header: 'Użyto', key: 'wybrano', width: 16 },
    ];
    wk.getRow(1).font = { bold: true };
    // Najpierw pola podatkowe — tam rozbieżność kosztuje pieniądze.
    for (const k of konflikty.sort((x, y) => (y.dt1 - x.dt1) || String(x.nrRej).localeCompare(String(y.nrRej)))) {
      const w = wk.addRow({ ...k, dt1: k.dt1 ? 'TAK' : '' });
      if (k.dt1) w.getCell('pole').font = { color: { argb: 'FF9C0006' }, bold: true };
      for (const [kol, zr] of [['zrodloA', k.zrodloA], ['zrodloB', k.zrodloB], ['wybrano', k.wybrano]]) {
        const def = ZRODLA[zr];
        if (def) w.getCell(kol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.kolor } };
      }
    }
    wk.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wk.columns.length } };
  }

  // ── Arkusz: odrzucone ──────────────────────────────────────────────────────
  //
  // Odrzucona wartosc MUSI byc widoczna. Ciche pominiecie zamienia jeden problem (smiec
  // w arkuszu) na drugi (puste pole bez wyjasnienia) — a przy 128 rozbieznosciach w polach
  // DT-1 czlowiek musi wiedziec, CZY danych nie bylo, czy zostaly odrzucone i dlaczego.
  if (odrzucone.length) {
    const wo = wb.addWorksheet('Odrzucone');
    wo.columns = [
      { header: 'Nr rej.', key: 'nrRej', width: 12 },
      { header: 'Kod', key: 'kod', width: 8 },
      { header: 'Pole', key: 'pole', width: 34 },
      { header: 'DT-1', key: 'dt1', width: 7 },
      { header: 'Odrzucona wartość', key: 'wartosc', width: 26 },
      { header: 'Powód', key: 'powod', width: 30 },
      { header: 'Źródło', key: 'zrodlo', width: 16 },
    ];
    wo.getRow(1).font = { bold: true };
    for (const o of odrzucone.sort((a, b) => (b.dt1 - a.dt1) || String(a.nrRej).localeCompare(String(b.nrRej)))) {
      const w = wo.addRow({ ...o, dt1: o.dt1 ? 'TAK' : '' });
      if (o.dt1) w.getCell('pole').font = { color: { argb: 'FF9C0006' }, bold: true };
      const def = ZRODLA[o.zrodlo];
      if (def) w.getCell('zrodlo').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.kolor } };
    }
    wo.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wo.columns.length } };
  }

  // ── Arkusz: DT-1 — kto podlega podatkowi i czego do niego brakuje ──────────
  //
  // PO CO. Raport pokrycia mowi „liczba osi 68/916" i brzmi to jak katastrofa. Ale
  // `TaxEngine.getCat()` potrzebuje liczby osi WYLACZNIE dla pojazdow od 12 t; ponizej
  // progu decyduje sama DMC i rodzaj. Pytanie „ile brakuje do policzenia podatku" ma
  // wiec zupelnie inna odpowiedz niz „ile pol jest pustych" — i tylko to pierwsze
  // mowi, ile pracy zostalo.
  //
  // Kategorie liczy PRODUKCYJNY `modules/tax-engine.js`, zaladowany przez `window`-shim,
  // a nie kopia progow przepisana tutaj. Progi 3,5 t / 7 t / 12 t, zwolnienie pojazdow
  // specjalnych i obsluga leasingu maja jedno zrodlo prawdy; druga kopia rozjechalaby sie
  // z silnikiem i pokazywala podatek inny niz aplikacja.
  const shim = { window: {} };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'modules', 'tax-engine.js'), 'utf8'))(shim.window);
  const TaxEngine = shim.window.TaxEngine;

  const dt1Wiersze = rekordy.map(r => {
    const v = {
      dmc: r.dmcKg ?? null, dmcMax: r.dmcKg2 ?? null, dmcZespolu: r.dmcZespolu ?? 0,
      typ: r.przeznaczenie || r.typ || '', przeznaczenie: r.przeznaczenie || '',
      osie: r.liczbaOsi, miejsca: r.miejscaSied, rok: r.rokProd,
    };
    const maDmc = r.dmcKg != null || r.dmcKg2 != null;
    const tonaz = ((r.dmcZespolu || 0) > 0 ? r.dmcZespolu : (r.dmcKg ?? r.dmcKg2 ?? 0)) / 1000;
    const specjalny = /specjaln/i.test(v.typ) || /specjaln/i.test(v.przeznaczenie);
    const cat = maDmc ? TaxEngine.getCat(v) : null;

    // Czego brakuje — pytamy o to, co silnik FAKTYCZNIE czyta przy tym tonazu.
    const braki = [];
    if (!maDmc) braki.push('F.1 DMC');
    if (!r.przeznaczenie && !r.typ) braki.push('rodzaj pojazdu');
    if (maDmc && !specjalny && tonaz >= 12) {
      if (r.liczbaOsi == null) braki.push('L liczba osi');
      if (!r.zawieszenie) braki.push('zawieszenie');
    }

    // CICHY DOMYSLNY WYBOR — `TaxEngine.getCat()` ma `parseInt(v.osie) || 2` (linie 88 i 199).
    // Brak liczby osi NIE jest bledem: po cichu staje sie dwojka. Dla pojazdu od 12 t daje
    // to D8 zamiast D9/D10, czyli INNA STAWKE — a wynik wyglada tak samo wiarygodnie.
    // Zamiast wypisac jedna kategorie i udawac, ze jest ustalona, pokazujemy WSZYSTKIE,
    // ktore wychodza przy prawdopodobnych liczbach osi. Kolumna z trzema kategoriami
    // krzyczy „to nie jest ustalone" mocniej niz przypis w innym arkuszu.
    let katWarianty = '';
    if (maDmc && !specjalny && tonaz >= 12 && r.liczbaOsi == null) {
      const mozliwe = [...new Set([1, 2, 3, 4]
        .map(n => TaxEngine.getCat({ ...v, osie: n }))
        .filter(Boolean))];
      if (mozliwe.length > 1) katWarianty = mozliwe.join(' / ');
    }

    let status;
    if (specjalny) status = 'zwolniony (specjalny)';
    else if (!maDmc) status = 'NIE DA SIE USTALIC';
    else if (cat) status = braki.length ? `${cat} — niepewna` : cat;
    else status = 'ponizej progu / brak podatku';

    return {
      nrRej: r.nrRej, marka: r.marka || '', model: r.model || '',
      rodzaj: r.przeznaczenie || r.typ || '', dmc: r.dmcKg ?? null,
      dmcZesp: r.dmcZespolu ?? null, osie: r.liczbaOsi ?? null,
      zawieszenie: r.zawieszenie || '', kat: cat || '', status,
      katWarianty, braki: braki.join(', '), _wymaga12t: maDmc && !specjalny && tonaz >= 12,
      _katNiepewna: katWarianty !== '',
      _podlega: !!cat, _niepewny: braki.length > 0 && !specjalny,
    };
  });

  const wd = wb.addWorksheet('DT-1');
  wd.columns = [
    { header: 'Nr rej.', key: 'nrRej', width: 12 },
    { header: 'Marka', key: 'marka', width: 16 },
    { header: 'Model', key: 'model', width: 18 },
    { header: 'Rodzaj / przeznaczenie', key: 'rodzaj', width: 26 },
    { header: 'F.1 DMC (kg)', key: 'dmc', width: 13 },
    { header: 'F.3 DMC zespolu', key: 'dmcZesp', width: 16 },
    { header: 'L osie', key: 'osie', width: 8 },
    { header: 'Zawieszenie', key: 'zawieszenie', width: 22 },
    { header: 'Kategoria DT-1', key: 'kat', width: 14 },
    { header: 'Możliwe kategorie (brak osi)', key: 'katWarianty', width: 26 },
    { header: 'Status', key: 'status', width: 26 },
    { header: 'Czego brakuje', key: 'braki', width: 34 },
  ];
  wd.getRow(1).font = { bold: true };
  // Najpierw to, co wymaga uwagi: niepewne, potem podlegajace, potem reszta.
  for (const w of dt1Wiersze.sort((a, b) =>
    (Number(b._niepewny) - Number(a._niepewny)) || (Number(b._podlega) - Number(a._podlega)) ||
    String(a.nrRej).localeCompare(String(b.nrRej)))) {
    const wiersz = wd.addRow(w);
    if (w.braki) wiersz.getCell('braki').font = { color: { argb: 'FF9C0006' }, bold: true };
    if (w.status === 'NIE DA SIE USTALIC') wiersz.getCell('status').font = { color: { argb: 'FF9C0006' }, bold: true };
    if (w.katWarianty) {
      // Kategoria pokazana w kolumnie obok jest WYNIKIEM DOMYSLNEJ DWOJKI, nie odczytu.
      wiersz.getCell('kat').font = { color: { argb: 'FF9C0006' }, bold: true };
      wiersz.getCell('katWarianty').font = { color: { argb: 'FF9C0006' }, bold: true };
    }
  }
  wd.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wd.columns.length } };

  // ── Arkusz: pojazdy znane wylacznie z OCR / nazwy pliku ────────────────────
  if (spozaZestawienia.length) {
    const wz = wb.addWorksheet('Spoza zestawienia');
    wz.columns = [
      { header: 'Nr rej.', key: 'nrRej', width: 12 },
      { header: 'Numer z nazwy pliku', key: 'zNazwy', width: 20 },
      { header: 'Wypełnionych pól', key: 'ile', width: 17 },
      { header: 'Marka', key: 'marka', width: 18 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Plik źródłowy', key: 'plik', width: 60 },
    ];
    wz.getRow(1).font = { bold: true };
    for (const r of spozaZestawienia.sort((a, b) => String(a.nrRej).localeCompare(String(b.nrRej)))) {
      wz.addRow({
        nrRej: r.nrRej, zNazwy: r._zNazwy ? 'TAK' : '',
        ile: DR.POLA.filter(p => r[p.klucz] != null && r[p.klucz] !== '').length,
        marka: r.marka || '', model: r.model || '', plik: r._plik || '',
      });
    }
    wz.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wz.columns.length } };
  }

  // ── Arkusz 4: legenda ──────────────────────────────────────────────────────
  const wl = wb.addWorksheet('Legenda');
  wl.columns = [{ header: '', key: 'a', width: 26 }, { header: '', key: 'b', width: 78 }];
  wl.addRow({ a: 'ŹRÓDŁA DANYCH', b: '' }).font = { bold: true };
  for (const [k, v] of Object.entries(ZRODLA)) {
    const r = wl.addRow({ a: v.etykieta, b: {
      aztec: 'Odczyt z kodu 2D na dowodzie. Wartość PEWNA — nie wymaga sprawdzenia.',
      cepik: 'Centralna Ewidencja Pojazdów. Dane urzędowe.',
      ocr:   'Rozpoznanie ze skanu przez model językowy. MOŻE BYĆ ZMYŚLONA — sprawdź przed użyciem do DT-1.',
      zestawienie:'Arkusz prowadzony ręcznie. Bywa aktualniejszy niż stary dowód, bywa też przepisany z błędem.',
      folder:'Wywnioskowane z nazwy pliku lub folderu. Orientacyjne.',
    }[k] });
    r.getCell('a').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: v.kolor } };
  }
  wl.addRow({});
  wl.addRow({ a: 'KOLUMNA DT-1', b: 'Pole wpływa na wymiar podatku od środków transportowych.' });
  wl.addRow({ a: '', b: 'Pola DT-1 wypełnione w mniej niż połowie rekordów są w arkuszu Pokrycie na czerwono.' });
  wl.addRow({});
  wl.addRow({ a: 'ARKUSZ ODRZUCONE', b: 'Wartości, które NIE PASOWAŁY do typu pola i nie trafiły do arkusza.' }).font = { bold: true };
  wl.addRow({ a: '', b: 'Np. data w polu masy, „m.p." w polu liczbowym, wartość poza sensownym zakresem.' });
  wl.addRow({ a: '', b: 'Odrzucenie zostawia pole PUSTE — widać to w Pokryciu. Przyjęcie śmiecia nie widać nigdzie.' });
  wl.addRow({ a: '', b: 'Jeśli odrzucona wartość jest jednak poprawna — popraw ją w źródle, nie w arkuszu.' });
  wl.addRow({});
  wl.addRow({ a: 'ARKUSZ KONFLIKTY', b: 'Pola, w których źródła podały RÓŻNE wartości.' }).font = { bold: true };
  wl.addRow({ a: '', b: 'Wygrywa źródło wyżej w hierarchii, ale rozbieżność zostaje widoczna.' });
  wl.addRow({ a: '', b: 'Hierarchia: Aztec > CEPiK > zestawienie > OCR > nazwa pliku.' });
  wl.addRow({ a: '', b: 'Konflikt w polu DT-1 obejrzyj ręcznie — to jest kwota wobec urzędu.' });
  wl.addRow({});
  wl.addRow({ a: 'DO WERYFIKACJI', b: 'Kody wpisane z wiedzy ogólnej, nie z odczytu Dz.U. — sprawdź w rozporządzeniu:' }).font = { bold: true };
  for (const k of DR.doWeryfikacji()) wl.addRow({ a: '', b: k });
  wl.addRow({});
  wl.addRow({ a: 'DANE OSOBOWE', b: 'Arkusz zawiera VIN-y, numery rejestracyjne i dane właścicieli.' });
  wl.addRow({ a: '', b: 'Trzymaj poza repozytorium. Nie wysyłaj do zewnętrznych serwisów.' });

  await wb.xlsx.writeFile(cel);

  if (WYJSCIE_ZARZAD) await zapiszDlaZarzadu(WYJSCIE_ZARZAD, rekordy, dt1Wiersze, konflikty, odrzucone, spozaZestawienia);

  // ── Podsumowanie na terminal ───────────────────────────────────────────────
  const dt1Slabe = kolumny.filter(p => p.dt1 && pokrycie[p.klucz].razem / (rekordy.length || 1) < 0.5);
  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     źródeł: ${wejscia.length}  |  pojazdów po scaleniu: ${rekordy.length}  |  pól: ${kolumny.length}`));
  console.log(D(`     arkusze: Pojazdy, Pokrycie${konflikty.length ? ', Konflikty' : ''}${odrzucone.length ? ', Odrzucone' : ''}` +
    `${spozaZestawienia.length ? ', Spoza zestawienia' : ''}, DT-1, Legenda\n`));

  // Podsumowanie DT-1 PRZED reszta ostrzezen: to jest liczba, ktora mowi, ile pracy zostalo.
  {
    const podlega = dt1Wiersze.filter(w => w._podlega);
    const wymaga12t = dt1Wiersze.filter(w => w._wymaga12t);
    const brak12t = wymaga12t.filter(w => w.braki);
    const nieDaSie = dt1Wiersze.filter(w => w.status === 'NIE DA SIE USTALIC');
    const zwolnione = dt1Wiersze.filter(w => w.status.startsWith('zwolniony'));

    console.log(B('\n  DT-1 — ile pracy faktycznie zostalo:\n'));
    console.log(`   ${String(podlega.length).padStart(4)}  pojazdow podlega podatkowi (kategoria ustalona)`);
    console.log(`   ${String(zwolnione.length).padStart(4)}  zwolnionych jako specjalne`);
    console.log(`   ${String(wymaga12t.length).padStart(4)}  od 12 t — tylko TE potrzebuja liczby osi i zawieszenia`);
    console.log(`   ${(brak12t.length ? R : G)(String(brak12t.length).padStart(4))}  z nich ma braki w tych polach`);
    if (nieDaSie.length) console.log(`   ${R(String(nieDaSie.length).padStart(4))}  bez DMC — kategorii nie da sie ustalic wcale`);

    // Najwazniejsza liczba w calym raporcie: ile kwot stoi na CICHYM DOMYSLE.
    const naDomysle = dt1Wiersze.filter(w => w._katNiepewna);
    if (naDomysle.length) {
      console.log(R(`\n   ${String(naDomysle.length).padStart(4)}  pojazdow od 12 t BEZ liczby osi — ich kategoria to DOMYSL, nie odczyt`));
      console.log(D('         `TaxEngine.getCat()` ma `parseInt(v.osie) || 2` (tax-engine.js:88 i :199),'));
      console.log(D('         wiec brak osi po cichu staje sie dwojka. Dla pojazdu od 12 t to D8'));
      console.log(D('         zamiast D9/D10 — inna stawka, a wynik wyglada tak samo wiarygodnie.'));
      const przyklady = naDomysle.slice(0, 3).map(w => `${w.nrRej} → ${w.katWarianty}`);
      console.log(D(`         np. ${przyklady.join(' | ')}`));
      console.log(D('         Arkusz DT-1, kolumna „Możliwe kategorie (brak osi)" — na czerwono.'));
    }
    console.log(D('\n     Liczba osi „68/916" w raporcie pokrycia myli: silnik czyta ja WYLACZNIE'));
    console.log(D('     dla pojazdow od 12 t. Ponizej progu decyduje sama DMC i rodzaj pojazdu.'));
    console.log(D('     Arkusz DT-1 wymienia braki per pojazd, wiec da sie je uzupelnic recznie.\n'));
  }

  if (spozaZestawienia.length) {
    const zNazwy = spozaZestawienia.filter(r => r._zNazwy).length;
    console.log(Y(`  ${spozaZestawienia.length} pojazdow zna WYLACZNIE OCR albo nazwa pliku` +
      (zNazwy ? `, w tym ${zNazwy} z numerem odczytanym z nazwy pliku` : '')));
    console.log(D('     Numer czytany z nazwy pliku bywa przeklamany o jedna litere lub cyfre,'));
    console.log(D('     a kazde takie przeklamanie tworzy pojazd, ktory nie istnieje — z kompletem'));
    console.log(D('     pol, nieodroznialny w arkuszu od prawdziwego wiersza.'));
    console.log(D('     Wierszy nie usuwam (czesc moze byc nowa): patrz arkusz „Spoza zestawienia".\n'));
  }

  if (odrzucone.length) {
    const odt1 = odrzucone.filter(o => o.dt1);
    console.log(Y(`  ${odrzucone.length} wartości ODRZUCONYCH jako niepasujące do typu pola` +
      (odt1.length ? R(`, w tym ${odt1.length} w polach DT-1`) : '')));
    const wgPowodu = {};
    for (const o of odrzucone) wgPowodu[o.powod] = (wgPowodu[o.powod] || 0) + 1;
    for (const [powod, n] of Object.entries(wgPowodu).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`     ${String(n).padStart(5)}  ${powod}`);
    }
    console.log(D('\n     To NIE są braki danych — to wartości, które model wstawił w złe pole.'));
    console.log(D('     Patrz arkusz Odrzucone.\n'));
  }

  if (konflikty.length) {
    const kdt1 = konflikty.filter(k => k.dt1);
    console.log(Y(`  ${konflikty.length} rozbieżności między źródłami` +
      (kdt1.length ? R(`, w tym ${kdt1.length} w polach DT-1`) : '')));
    for (const k of kdt1.slice(0, 5)) {
      console.log(`     ${String(k.nrRej).padEnd(10)} ${(k.kod + ' ' + k.pole).padEnd(30)} ` +
        `${k.zrodloA}=${k.a}  vs  ${k.zrodloB}=${k.b}`);
    }
    if (kdt1.length > 5) console.log(D(`     …i ${kdt1.length - 5} więcej — patrz arkusz Konflikty`));
    console.log(D('\n     Rozbieżność w polu DT-1 to albo błąd przepisania, albo nieaktualny dowód.'));
    console.log(D('     Obejrzyj przed użyciem do deklaracji.\n'));
  }

  if (dt1Slabe.length) {
    console.log(Y(`  ${dt1Slabe.length} pól DT-1 wypełnionych w mniej niż połowie rekordów:`));
    for (const p of dt1Slabe) {
      const n = pokrycie[p.klucz].razem;
      console.log(`     ${(p.kod + ' ' + p.nazwa).padEnd(44)} ${n}/${rekordy.length}`);
    }
    console.log(D('\n     Bez tych pól nie da się wyliczyć podatku dla tych pojazdów.'));
    console.log(D('     Arkusz Pokrycie pokazuje, z jakiego źródła pochodzi to, co JEST.\n'));
  } else {
    console.log(G('  Wszystkie pola DT-1 wypełnione w ponad połowie rekordów.\n'));
  }
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
