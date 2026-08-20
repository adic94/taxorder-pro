/**
 * KATALOG PÓL DOWODU REJESTRACYJNEGO — jedno źródło prawdy.
 *
 * Oznaczenia literowe pochodzą z rozporządzenia w sprawie rejestracji i oznaczania
 * pojazdów (wzór dowodu rejestracyjnego) i są wspólne dla całej UE (dyrektywa 1999/37/WE).
 *
 * PO CO TEN PLIK. Lista pól DR żyła dotąd w CZTERECH niezależnych kopiach:
 *   1. `_DR_NEW` w worker/index.js          — pozycje w ładunku Aztec
 *   2. prompt OCR w worker/index.js         — nazwy w JSON-ie żądanym od modelu
 *   3. `modules/cepik-xml.js`               — warianty nazw z eksportu CEPiK
 *   4. skrypt budujący Excel                — kolumny arkusza
 * Ten projekt przerabiał rozjazd takich kopii trzykrotnie (dwie tablice wskaźników CO2,
 * dwie listy źródeł kreatora raportów, dwie deklaracje wersji ZXing) i za każdym razem
 * kosztowało to ciche złe dane, nie błąd. Cztery kopie to kwestia czasu.
 *
 * ⚠️ ZAKRES PEWNOŚCI. Kody oznaczone `pewne: true` to standardowe oznaczenia obecne
 * w każdym wzorze DR w UE. Pozostałe (`pewne: false`) wymagają sprawdzenia w aktualnym
 * tekście rozporządzenia — wpisałem je z wiedzy ogólnej, a nie z odczytu Dz.U., i tak
 * należy je traktować, dopóki ktoś nie zweryfikuje ich u źródła.
 *
 * `dt1: true` oznacza pole wpływające na wymiar podatku od środków transportowych.
 */
(function (factory) {
  const katalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = katalog;
  if (typeof window !== 'undefined') window.DrFields = katalog;
})(function () {

  // kod    — oznaczenie z wzoru DR
  // klucz  — nazwa używana wewnątrz aplikacji (musi zgadzać się z _DR_NEW i promptem OCR)
  // aztec  — czy pole występuje w ładunku kodu Aztec
  // cepik  — warianty nazw w odpowiedzi API/eksportu CEPiK (puste = nieznane)
  const POLA = [
    { kod: 'A',     klucz: 'nrRej',            nazwa: 'Numer rejestracyjny',                 typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['numer-rejestracyjny'] },
    { kod: 'B',     klucz: 'dataRej',          nazwa: 'Data pierwszej rejestracji',          typ: 'data',   pewne: true,  dt1: false, aztec: true,  cepik: ['data-pierwszej-rejestracji'] },
    { kod: 'C.1.1', klucz: 'posiadacz',        nazwa: 'Posiadacz — nazwisko lub nazwa',      typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: [], osobowe: true },
    { kod: 'C.2.1', klucz: 'wlasciciel',       nazwa: 'Właściciel — nazwisko lub nazwa',     typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: [], osobowe: true },
    { kod: 'C.2.3', klucz: 'adresWlasciciela', nazwa: 'Właściciel — adres',                  typ: 'tekst',  pewne: false, dt1: false, aztec: false, cepik: [], osobowe: true },
    { kod: 'D.1',   klucz: 'marka',            nazwa: 'Marka',                               typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['marka'] },
    { kod: 'D.2',   klucz: 'typ',              nazwa: 'Typ, wariant, wersja',                typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['typ'] },
    { kod: 'D.3',   klucz: 'model',            nazwa: 'Model',                               typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['model'] },
    { kod: 'E',     klucz: 'vin',              nazwa: 'VIN / nr nadwozia, podwozia lub ramy', typ: 'tekst', pewne: true,  dt1: false, aztec: true,  cepik: ['vin'], osobowe: true },
    { kod: 'F.1',   klucz: 'dmcKg',            nazwa: 'Maksymalna masa całkowita',           typ: 'liczba', pewne: true,  dt1: true,  aztec: true,  cepik: ['dopuszczalna-masa-calkowita'], jednostka: 'kg' },
    { kod: 'F.2',   klucz: 'dmcKg2',           nazwa: 'Dopuszczalna masa całkowita',         typ: 'liczba', pewne: true,  dt1: true,  aztec: true,  cepik: [], jednostka: 'kg' },
    { kod: 'F.3',   klucz: 'dmcZespolu',       nazwa: 'Dopuszczalna masa całkowita zespołu', typ: 'liczba', pewne: true,  dt1: true,  aztec: true,  cepik: [], jednostka: 'kg' },
    { kod: 'G',     klucz: 'masaWlKg',         nazwa: 'Masa własna',                         typ: 'liczba', pewne: true,  dt1: false, aztec: true,  cepik: ['masa-wlasna'], jednostka: 'kg' },
    { kod: 'H',     klucz: 'okresWaznosci',    nazwa: 'Okres ważności dowodu',               typ: 'tekst',  pewne: false, dt1: false, aztec: false, cepik: [] },
    { kod: 'I',     klucz: 'dataWydania',      nazwa: 'Data wydania dowodu',                 typ: 'data',   pewne: true,  dt1: false, aztec: true,  cepik: [] },
    { kod: 'J',     klucz: 'kategoria',        nazwa: 'Kategoria pojazdu',                   typ: 'tekst',  pewne: true,  dt1: true,  aztec: true,  cepik: ['kategoria'] },
    { kod: 'K',     klucz: 'nrHomolog',        nazwa: 'Numer świadectwa homologacji',        typ: 'tekst',  pewne: true,  dt1: false, aztec: false, cepik: [] },
    { kod: 'L',     klucz: 'liczbaOsi',        nazwa: 'Liczba osi',                          typ: 'liczba', pewne: true,  dt1: true,  aztec: true,  cepik: ['liczba-osi'] },
    { kod: 'O.1',   klucz: 'dmcPrzyczHam',     nazwa: 'Masa przyczepy z hamulcem',           typ: 'liczba', pewne: true,  dt1: true,  aztec: false, cepik: [], jednostka: 'kg' },
    { kod: 'O.2',   klucz: 'dmcPrzyczNieham',  nazwa: 'Masa przyczepy bez hamulca',          typ: 'liczba', pewne: true,  dt1: false, aztec: false, cepik: [], jednostka: 'kg' },
    { kod: 'P.1',   klucz: 'pojSilnika',       nazwa: 'Pojemność silnika',                   typ: 'liczba', pewne: true,  dt1: false, aztec: true,  cepik: ['pojemnosc-silnika'], jednostka: 'cm3' },
    { kod: 'P.2',   klucz: 'mocKW',            nazwa: 'Maksymalna moc netto silnika',        typ: 'liczba', pewne: true,  dt1: false, aztec: true,  cepik: ['moc-silnika'], jednostka: 'kW' },
    { kod: 'P.3',   klucz: 'paliwo',           nazwa: 'Rodzaj paliwa',                       typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['rodzaj-paliwa'] },
    { kod: 'S.1',   klucz: 'miejscaSied',      nazwa: 'Liczba miejsc siedzących',            typ: 'liczba', pewne: true,  dt1: true,  aztec: true,  cepik: ['liczba-miejsc-ogolem'] },
    { kod: 'S.2',   klucz: 'miejscaStoj',      nazwa: 'Liczba miejsc stojących',             typ: 'liczba', pewne: false, dt1: false, aztec: false, cepik: [] },
    { kod: 'T',     klucz: 'predkoscMax',      nazwa: 'Prędkość maksymalna',                 typ: 'liczba', pewne: false, dt1: false, aztec: false, cepik: [], jednostka: 'km/h' },
    { kod: 'V.9',   klucz: 'normaEuro',        nazwa: 'Norma emisji spalin (EURO)',          typ: 'tekst',  pewne: false, dt1: true,  aztec: false, cepik: [] },
    { kod: 'X',     klucz: 'nextInspection',   nazwa: 'Termin następnego badania techn.',    typ: 'data',   pewne: false, dt1: false, aztec: false, cepik: [] },

    // Pola BEZ oznaczenia literowego, obecne na polskim wzorze i istotne dla nas.
    // `rodzajPojazdu` decyduje o ZWOLNIENIU z DT-1 (pojazd specjalny) — patrz TaxEngine.
    // NAZWA `przeznaczenie`, NIE `rodzajPojazdu` — tak nazywa to prompt OCR w worker/index.js.
    // Katalog ma opisywać stan faktyczny kodu, a nie narzucać mu nowe nazewnictwo: zmiana
    // klucza w promptcie to zmiana kontraktu z modelem, osobna decyzja i osobny pomiar.
    // To pole decyduje o ZWOLNIENIU z DT-1 (pojazd specjalny) — patrz TaxEngine.getCat().
    { kod: '—', klucz: 'przeznaczenie',    nazwa: 'Rodzaj pojazdu / przeznaczenie', typ: 'tekst',  pewne: true,  dt1: true,  aztec: false, cepik: ['rodzaj-pojazdu'] },
    // DWA RÓŻNE POLA, nie dwie nazwy jednego. Ładunek Aztec niesie rok PIERWSZEJ
    // REJESTRACJI (pozycja 56); prompt OCR pyta o rok PRODUKCJI. Pojazd sprowadzony
    // z zagranicy ma je różne, czasem o kilka lat — sklejenie ich zafałszowałoby wiek floty.
    { kod: '—', klucz: 'rokPierwszejRej', nazwa: 'Rok pierwszej rejestracji',      typ: 'liczba', pewne: true,  dt1: false, aztec: true,  cepik: [] },
    { kod: '—', klucz: 'rokProd',         nazwa: 'Rok produkcji',                  typ: 'liczba', pewne: true,  dt1: false, aztec: false, cepik: ['rok-produkcji'] },
    { kod: '—', klucz: 'seriaDr',       nazwa: 'Seria i numer dowodu',            typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: [], osobowe: true },
    { kod: '—', klucz: 'zawieszenie',   nazwa: 'Rodzaj zawieszenia',              typ: 'tekst',  pewne: true,  dt1: true,  aztec: false, cepik: [] },
    { kod: '—', klucz: 'nipWlasciciela',nazwa: 'NIP właściciela',                 typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: [], osobowe: true },
  ];

  const wgKlucza = Object.fromEntries(POLA.map(p => [p.klucz, p]));

  return {
    POLA,
    wgKlucza,
    klucze:      () => POLA.map(p => p.klucz),
    dt1:         () => POLA.filter(p => p.dt1),
    osobowe:     () => POLA.filter(p => p.osobowe).map(p => p.klucz),
    zAztec:      () => POLA.filter(p => p.aztec).map(p => p.klucz),
    doWeryfikacji: () => POLA.filter(p => !p.pewne).map(p => p.kod + ' ' + p.nazwa),
    naglowek:    (p) => p.kod === '—' ? p.nazwa : `${p.kod} — ${p.nazwa}`,
  };
});
