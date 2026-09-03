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
 * ✅ ZWERYFIKOWANE U ŹRÓDŁA 25.08.2026 — wszystkie `pewne: false` zamknięte.
 * Źródło: rozporządzenie MI z 8.11.2024, **Dz.U. 2024 poz. 1709**, załącznik nr 3
 * lit. C „Oznaczenia kodów zastosowanych we wzorze dowodu rejestracyjnego"
 * (str. 26 dokumentu). Status aktu: obowiązujący (API ELI, sprawdzone).
 *
 * ⚠️ SKĄD POBRAĆ, gdyby ktoś wracał do tematu: **NIE z ISAP** — adres
 * `isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20240001709/O/D20241709.pdf`
 * przekierowuje sam na siebie w nieskończoność (302 → identyczny URL), niezależnie
 * od User-Agenta, więc `curl` i podobne odbijają się od niego. Działa natomiast
 * bezpośredni serwis Dziennika Ustaw:
 *     https://dziennikustaw.gov.pl/D2024000170901.pdf        (9,5 MB, 102 strony)
 *     https://api.sejm.gov.pl/eli/acts/DU/2024/1709          (metadane, status aktu)
 *
 * DWA POLA OKAZAŁY SIĘ NIEISTNIEJĄCE w polskim wzorze — patrz komentarze przy
 * `predkoscMax` i `normaEuro`. To drugie ma skutek pomiarowy: prompt OCR kazał
 * modelowi szukać kodu, którego na dokumencie nie ma.
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
    { kod: 'C.2.3', klucz: 'adresWlasciciela', nazwa: 'Właściciel — adres',                  typ: 'tekst',  pewne: true,  dt1: false, aztec: false, cepik: [], osobowe: true },
    { kod: 'D.1',   klucz: 'marka',            nazwa: 'Marka',                               typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['marka'] },
    { kod: 'D.2',   klucz: 'typ',              nazwa: 'Typ, wariant, wersja',                typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['typ'] },
    { kod: 'D.3',   klucz: 'model',            nazwa: 'Model',                               typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['model'] },
    { kod: 'E',     klucz: 'vin',              nazwa: 'VIN / nr nadwozia, podwozia lub ramy', typ: 'tekst', pewne: true,  dt1: false, aztec: true,  cepik: ['vin'], osobowe: true },
    { kod: 'F.1',   klucz: 'dmcKg',            nazwa: 'Maksymalna masa całkowita',           typ: 'liczba', zakres: [100, 100000], pewne: true,  dt1: true,  aztec: true,  cepik: ['max-masa-calkowita'], jednostka: 'kg' },
    { kod: 'F.2',   klucz: 'dmcKg2',           nazwa: 'Dopuszczalna masa całkowita',         typ: 'liczba', zakres: [100, 100000], pewne: true,  dt1: true,  aztec: true,  cepik: ['dopuszczalna-masa-calkowita'], jednostka: 'kg' },
    { kod: 'F.3',   klucz: 'dmcZespolu',       nazwa: 'Dopuszczalna masa całkowita zespołu', typ: 'liczba', zakres: [100, 200000], pewne: true,  dt1: true,  aztec: true,  cepik: ['dopuszczalna-masa-calkowita-zespolu-pojazdow'], jednostka: 'kg' },
    { kod: 'G',     klucz: 'masaWlKg',         nazwa: 'Masa własna',                         typ: 'liczba', zakres: [100, 100000], pewne: true,  dt1: false, aztec: true,  cepik: ['masa-wlasna', 'masa-pojazdu-gotowego-do-jazdy'], jednostka: 'kg' },
    { kod: 'H',     klucz: 'okresWaznosci',    nazwa: 'Okres ważności dowodu',               typ: 'tekst',  pewne: true,  dt1: false, aztec: false, cepik: [] },
    { kod: 'I',     klucz: 'dataWydania',      nazwa: 'Data wydania dowodu',                 typ: 'data',   pewne: true,  dt1: false, aztec: true,  cepik: [] },
    // DZIEDZINA ZAMKNIETA. Kategoria homologacyjna to skonczony zbior symboli z dyrektywy
    // 2007/46/WE — nie ma tu miejsca na wariacje. Bez tej listy do pola J trafialo, co
    // popadlo: w realnym zbiorze OCR wstawil tam „SIA MTOILET", czyli NAZWE SPOLKI
    // z sasiedniej rubryki. Krotka, bez daty, bez kodu rubryki — zadna z regul ogolnych
    // jej nie zatrzymala, a w arkuszu wygladala jak kategoria.
    { kod: 'J',     klucz: 'kategoria',        nazwa: 'Kategoria pojazdu',                   typ: 'tekst',  pewne: true,  dt1: true,  aztec: true,  cepik: ['kategoria-pojazdu'],
      domena: ['M1', 'M2', 'M3', 'N1', 'N2', 'N3', 'O1', 'O2', 'O3', 'O4',
               'L1E', 'L2E', 'L3E', 'L4E', 'L5E', 'L6E', 'L7E',
               'T1', 'T2', 'T3', 'T4', 'T5', 'C1', 'C2', 'C3', 'C4', 'C5', 'R1', 'R2', 'R3', 'R4',
               'S1', 'S2', 'T', 'C', 'R', 'S', 'L'] },
    { kod: 'K',     klucz: 'nrHomolog',        nazwa: 'Numer świadectwa homologacji',        typ: 'tekst',  pewne: true,  dt1: false, aztec: false, cepik: [] },
    { kod: 'L',     klucz: 'liczbaOsi',        nazwa: 'Liczba osi',                          typ: 'liczba', zakres: [1, 10], pewne: true,  dt1: true,  aztec: true,  cepik: ['liczba-osi'] },
    { kod: 'O.1',   klucz: 'dmcPrzyczHam',     nazwa: 'Masa przyczepy z hamulcem',           typ: 'liczba', zakres: [0, 100000], pewne: true,  dt1: true,  aztec: false, cepik: ['max-masa-calkowita-przyczepy-z-hamulcem'], jednostka: 'kg' },
    { kod: 'O.2',   klucz: 'dmcPrzyczNieham',  nazwa: 'Masa przyczepy bez hamulca',          typ: 'liczba', zakres: [0, 100000], pewne: true,  dt1: false, aztec: false, cepik: ['max-masa-calkowita-przyczepy-bez-hamulca'], jednostka: 'kg' },
    { kod: 'P.1',   klucz: 'pojSilnika',       nazwa: 'Pojemność silnika',                   typ: 'liczba', zakres: [50, 30000], pewne: true,  dt1: false, aztec: true,  cepik: ['pojemnosc-skokowa-silnika'], jednostka: 'cm3' },
    { kod: 'P.2',   klucz: 'mocKW',            nazwa: 'Maksymalna moc netto silnika',        typ: 'liczba', zakres: [1, 2000], pewne: true,  dt1: false, aztec: true,  cepik: ['moc-netto-silnika'], jednostka: 'kW' },
    { kod: 'P.3',   klucz: 'paliwo',           nazwa: 'Rodzaj paliwa',                       typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: ['rodzaj-paliwa'] },
    { kod: 'S.1',   klucz: 'miejscaSied',      nazwa: 'Liczba miejsc siedzących',            typ: 'liczba', zakres: [1, 100], pewne: true,  dt1: true,  aztec: true,  cepik: ['liczba-miejsc-siedzacych'] },
    { kod: 'S.2',   klucz: 'miejscaStoj',      nazwa: 'Liczba miejsc stojących',             typ: 'liczba', zakres: [0, 200], pewne: true,  dt1: false, aztec: false, cepik: ['liczba-miejsc-stojacych'] },
    // Q — POTWIERDZONE przy weryfikacji, wcześniej w katalogu NIEOBECNE. Dotyczy
    // wyłącznie motocykli i motorowerów, więc dla naszej floty marginalne, ale
    // pilnuje, żeby litera „Q" nie została wzięta za coś innego.
    { kod: 'Q',     klucz: 'mocDoMasy',        nazwa: 'Stosunek mocy do masy własnej',       typ: 'tekst',  pewne: true,  dt1: false, aztec: false, cepik: [], jednostka: 'kW/kg' },
    // ⛔ „T" NIE JEST KODEM POLSKIEGO DOWODU. Zweryfikowane 25.08 w Dz.U. 2024
    // poz. 1709 zał. 3 lit. C: lista kodów idzie A, B, C.*, D.*, E, F.*, G, H, I,
    // J, K, L, O.*, P.*, Q, S.*, X — bez „T". Prędkość maksymalna pojawia się
    // w rozporządzeniu tylko przy TARCZACH prędkości (zał. 15), nie jako rubryka
    // dowodu. Pole zostaje w katalogu, bo bywa w danych z innych źródeł (CEPiK,
    // zestawienia), ale `kod: null` — nie ma czego szukać na dokumencie.
    { kod: null,    klucz: 'predkoscMax',      nazwa: 'Prędkość maksymalna (spoza wzoru DR)', typ: 'liczba', zakres: [10, 400], pewne: true, dt1: false, aztec: false, cepik: [], jednostka: 'km/h' },
    // ⛔ „V.9" NIE ISTNIEJE W POLSKIM WZORZE — ani jako kod, ani w ogóle: ciągi
    // „V.9", „EURO" i „emisj" NIE WYSTĘPUJĄ w całym Dz.U. 2024 poz. 1709 (102 strony,
    // sprawdzone wyszukiwaniem pełnotekstowym). To kod z wzorów niektórych innych
    // państw UE, nie z naszego.
    //
    // ⚠️ TO MA SKUTEK POMIAROWY, NIE TYLKO PORZĄDKOWY: `DR_POLA_OCR` w worker/index.js
    // każe modelowi szukać „V.9 — poziom emisji spalin", czyli rubryki, której na
    // dokumencie NIE MA. Zmierzone pokrycie `normaEuro`: 1/54 w przebiegu RapidOCR,
    // 55/916 w pełnym zbiorze i to wyłącznie z zestawienia, nie z OCR. Norma EURO
    // na polskim dowodzie bywa w ADNOTACJACH URZĘDOWYCH — i tylko tam ma sens jej
    // szukać. `kod: null`, bo litera do wyszukania nie istnieje.
    { kod: null,    klucz: 'normaEuro',        nazwa: 'Norma emisji spalin (adnotacje urzędowe)', typ: 'tekst', pewne: true, dt1: true, aztec: false, cepik: [] },
    { kod: 'X',     klucz: 'nextInspection',   nazwa: 'Termin następnego badania techn.',    typ: 'data',   pewne: true,  dt1: false, aztec: false, cepik: [] },

    // Pola BEZ oznaczenia literowego, obecne na polskim wzorze i istotne dla nas.
    // `rodzajPojazdu` decyduje o ZWOLNIENIU z DT-1 (pojazd specjalny) — patrz TaxEngine.
    // NAZWA `przeznaczenie`, NIE `rodzajPojazdu` — tak nazywa to prompt OCR w worker/index.js.
    // Katalog ma opisywać stan faktyczny kodu, a nie narzucać mu nowe nazewnictwo: zmiana
    // klucza w promptcie to zmiana kontraktu z modelem, osobna decyzja i osobny pomiar.
    // To pole decyduje o ZWOLNIENIU z DT-1 (pojazd specjalny) — patrz TaxEngine.getCat().
    { kod: '—', klucz: 'przeznaczenie',    nazwa: 'Rodzaj pojazdu / przeznaczenie', typ: 'tekst',  pewne: true,  dt1: true,  aztec: false, cepik: ['rodzaj-pojazdu', 'przeznaczenie-pojazdu'] },
    // DWA RÓŻNE POLA, nie dwie nazwy jednego. Ładunek Aztec niesie rok PIERWSZEJ
    // REJESTRACJI (pozycja 56); prompt OCR pyta o rok PRODUKCJI. Pojazd sprowadzony
    // z zagranicy ma je różne, czasem o kilka lat — sklejenie ich zafałszowałoby wiek floty.
    { kod: '—', klucz: 'rokPierwszejRej', nazwa: 'Rok pierwszej rejestracji',      typ: 'liczba', zakres: [1900, 2100], pewne: true,  dt1: false, aztec: true,  cepik: [] },
    { kod: '—', klucz: 'rokProd',         nazwa: 'Rok produkcji',                  typ: 'liczba', zakres: [1900, 2100], pewne: true,  dt1: false, aztec: false, cepik: ['rok-produkcji'] },
    { kod: '—', klucz: 'seriaDr',       nazwa: 'Seria i numer dowodu',            typ: 'tekst',  pewne: true,  dt1: false, aztec: true,  cepik: [], osobowe: true },
    // Dla DT-1 licza sie trzy stany, nie dowolny opis: pneumatyczne, uznane za rownowazne
    // pneumatycznemu, oraz wszystko inne. `dopasujDomene` porownuje po fragmencie, bo
    // zrodla pisza to rozmaicie („zawieszenie pneumatyczne", „PNEUM.", „rownowazne").
    { kod: '—', klucz: 'zawieszenie',   nazwa: 'Rodzaj zawieszenia',              typ: 'tekst',  pewne: true,  dt1: true,  aztec: false, cepik: ['rodzaj-zawieszenia'],
      domena: ['PNEUMATYCZNE', 'ROWNOWAZNE', 'MECHANICZNE', 'RESOROWE', 'INNE'], domenaLuzna: true },
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
    doWeryfikacji: () => POLA.filter(p => !p.pewne).map(p => `${p.kod  } ${  p.nazwa}`),
    naglowek:    (p) => p.kod === '—' ? p.nazwa : `${p.kod} — ${p.nazwa}`,
  };
});
