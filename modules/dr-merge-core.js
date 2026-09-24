/**
 * DR-MERGE-CORE — wspólna logika scalania i walidacji danych z dowodów rejestracyjnych.
 *
 * PO CO TEN PLIK. Do 24.09 ta logika żyła wyłącznie w `tools/dr-excel.js` (skrypt CLI,
 * Node + exceljs) i działała tylko na doraźnych plikach JSON z dysku, nigdy na
 * produkcyjnej bazie. Eksport DR z poziomu UI (`modules/dr-export.js`) potrzebuje
 * DOKŁADNIE tej samej logiki — walidacji wartości, rang źródeł, wykrywania konfliktów —
 * żeby arkusz z przeglądarki i arkusz z CLI mówiły to samo. Ten plik jest izomorficzny
 * (Node przez `module.exports`, przeglądarka przez `window.DrMergeCore`, wzorem
 * `modules/dr-fields.js`) i jest teraz JEDYNYM miejscem tej logiki — `tools/dr-excel.js`
 * go wymaga zamiast trzymać własną kopię.
 *
 * Cały kod niżej to PRZENIESIENIE (nie przepisanie) z `tools/dr-excel.js` — komentarze
 * wyjaśniające POWODY poszczególnych reguł odrzucania zostały tam, ten plik ma tylko
 * skróty odsyłające do oryginalnego uzasadnienia.
 */
(function (factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof window !== 'undefined') window.DrMergeCore = core;
})(function () {
  const DR = (typeof module === 'object' && module.exports)
    ? require('./dr-fields.js')
    : window.DrFields;

  // Hierarchia domyślna: Aztec > CEPiK > zestawienie > OCR > nazwa pliku.
  // NIE ZMIENIAĆ bez sprawdzenia `tools/dr-excel.js` — zachowanie CLI musi zostać
  // identyczne po refaktorze. Wywołujący (np. eksport z UI) może podać własną mapę
  // źródeł przez `opts.zrodla`, np. dokładając tier „baza danych" — patrz
  // `modules/dr-export.js`.
  const ZRODLA = {
    aztec:       { etykieta: 'Aztec (pewne)',       kolor: 'FFC6EFCE', ranga: 4 },
    cepik:       { etykieta: 'CEPiK (urzędowe)',    kolor: 'FFBDD7EE', ranga: 3 },
    zestawienie: { etykieta: 'zestawienie (ręcz.)', kolor: 'FFD9E1F2', ranga: 2 },
    ocr:         { etykieta: 'OCR (do sprawdz.)',   kolor: 'FFFFE699', ranga: 1 },
    folder:      { etykieta: 'nazwa pliku',         kolor: 'FFE7E6E6', ranga: 0 },
  };

  const LITERY_WOJ = 'BCDEFGKLNOPRSTWZ';

  /** Numer rejestracyjny z nazwy pliku — tylko gdy wygląda jak polska tablica. */
  function nrZNazwyPliku(nazwa) {
    const baza = String(nazwa).replace(/^.*[\\/]/, '').replace(/\.[a-z0-9]+$/i, '').toUpperCase();
    for (const kandydat of baza.split(/[^A-Z0-9]+/)) {
      if (kandydat.length < 4 || kandydat.length > 8) continue;
      if (!LITERY_WOJ.includes(kandydat[0])) continue;
      if (!/[0-9]/.test(kandydat) || !/^[A-Z]{1,3}[A-Z0-9]{3,7}$/.test(kandydat)) continue;
      return kandydat;
    }
    return null;
  }

  /** Czy tekst wygląda jak polska tablica rejestracyjna (kontrola kształtu numeru). */
  function wygladaJakTablica(nr) {
    const n = String(nr).toUpperCase().replace(/[\s-]/g, '');
    return n.length >= 4 && n.length <= 8 && /^[A-Z]{1,3}[A-Z0-9]{2,7}$/.test(n) && /[0-9]/.test(n);
  }

  /**
   * Wartość pasuje do typu pola — inaczej NIE trafia do arkusza. Zob. uzasadnienie
   * pełne (przykłady z produkcyjnego zbioru) w historii `tools/dr-excel.js`.
   */
  function wartoscPasuje(pole, v) {
    const t = String(v).trim();
    if (!t) return { ok: false, powod: 'puste' };

    if (pole.typ === 'liczba') {
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

    if (/^(m\.?\s*p\.?|---+|-|b\/?d|brak|n\/?d|nie dotyczy)$/i.test(t)) {
      return { ok: false, powod: 'oznaczenie braku danych' };
    }

    if (/^(cf-workers-ai|@cf\/|llama[-\s]?\d|groq|gpt-\d|claude-\d)/i.test(t)) {
      return { ok: false, powod: 'nazwa modelu AI zamiast wartosci' };
    }

    if (/[A-ZŁŚĆŻŹŃÓĘĄ.\d\s]{2,40}=/i.test(t)) {
      return { ok: false, powod: 'etykieta=wartosc sklejone (zawiera znak =)' };
    }

    if (pole.klucz === 'marka' && /^(archiwum|dokumentacja|skany?|kopia|stary|nowy|backup)$/i.test(t)) {
      return { ok: false, powod: 'nazwa folderu zamiast marki pojazdu' };
    }

    const FRAGMENTY_PROMPTU = [
      'z sekcji bezowej', 'zoltej tabeli', 'adnotacjach urzedowych', 'puste jesli',
      'nie zgaduj', 'skonczony zbior', 'krotki kod techniczny', 'dokladnie 17 znakow',
    ];
    const tNorm = t.toLowerCase();
    if (FRAGMENTY_PROMPTU.some(f => tNorm.includes(f))) {
      return { ok: false, powod: 'fragment instrukcji promptu zamiast wartosci' };
    }

    const DLUGIE = new Set(['posiadacz', 'wlasciciel', 'adresWlasciciela', 'nrHomolog', 'typ', 'okresWaznosci']);
    if (!DLUGIE.has(pole.klucz)) {
      if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(t)) {
        return { ok: false, powod: 'data w polu tekstowym' };
      }
      if (/\b(STY|LUT|MAR|KWI|MAJ|CZE|LIP|SIE|WRZ|PAZ|PAŹ|LIS|GRU|JAN|FEB|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b[\s.]*\d{4}/i.test(t)) {
        return { ok: false, powod: 'data slowna w polu tekstowym' };
      }
      if (/\((?:[A-Z]\.?\d(?:\.\d)?)\)/.test(t)) {
        return { ok: false, powod: 'etykieta rubryki zamiast wartosci' };
      }
      if (t.length > 60) return { ok: false, powod: 'tekst dluzszy niz 60 znakow' };
    }

    if (pole.domena) {
      const n = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const trafienie = pole.domenaLuzna
        ? pole.domena.find(d => n.includes(d) || (n.length >= 4 && d.includes(n)))
        : pole.domena.find(d => d === n);
      if (!trafienie) {
        return { ok: false, powod: `spoza dopuszczalnych wartosci pola ${pole.kod === '—' ? pole.nazwa.toLowerCase() : pole.kod}` };
      }
      return { ok: true, wartosc: pole.domenaLuzna ? t : trafienie };
    }
    return { ok: true, wartosc: t };
  }

  const kluczScalania = (r) => String(r.nrRej ?? '').toUpperCase().replace(/[\s-]/g, '');
  const zrodloPola = (rek, klucz, zrodloDomyslne) =>
    (rek._zrodla && rek._zrodla[klucz]) || rek._zrodlo || zrodloDomyslne || null;

  /**
   * Scala tablicę surowych rekordów (jeden obiekt na "wpis z jednego źródła o jednym
   * pojeździe") po numerze rejestracyjnym, waliduje każde pole przez `wartoscPasuje`,
   * wykrywa konflikty między źródłami i liczy pokrycie per pole.
   *
   * @param {Array<object>} rekordy — każdy z: pola DR wg kluczy `modules/dr-fields.js`,
   *   opcjonalnie `_zrodlo` (źródło całego rekordu), `_zrodla` (źródło per pole,
   *   nadpisuje `_zrodlo`), `_plik` (ścieżka/etykieta dokumentu źródłowego).
   * @param {object} [opts]
   * @param {object} [opts.zrodla] — mapa definicji źródeł (etykieta/kolor/ranga);
   *   domyślnie `ZRODLA` z tego modułu. Wywołujący może dołożyć własne tiery
   *   (np. „baza danych") bez zmiany domyślnej hierarchii CLI.
   * @param {string} [opts.zrodloDomyslne] — źródło dla rekordów bez `_zrodlo`/`_zrodla`.
   * @param {number} [opts.progNiskiejPewnosci] — ranga, poniżej/na której pojazd trafia
   *   do `spozaZestawienia` (domyślnie ranga `ocr` z `opts.zrodla`).
   */
  function scalRekordy(rekordy, opts = {}) {
    const zrodla = opts.zrodla || ZRODLA;
    const progNiskiejPewnosci = opts.progNiskiejPewnosci ?? (zrodla.ocr ? zrodla.ocr.ranga : 1);
    const konflikty = [];
    const odrzucone = [];
    const scalone = new Map();

    for (const rek of rekordy) {
      const k = kluczScalania(rek);
      if (!k) continue;
      // `nrRej` na `cel` NIE jest ustawiane tutaj celowo — jak w oryginale, zostaje
      // wypełnione przez pętlę pól niżej (kod 'A', pierwsze w DR.POLA), więc przechodzi
      // przez `wartoscPasuje`. Do tego czasu `cel.nrRej` jest `undefined`, stąd fallback
      // do `k` w `odrzucone`/`konflikty` poniżej.
      if (!scalone.has(k)) scalone.set(k, { _zrodla: {}, _plik: rek._plik, _uzyte: new Set(), _zNazwy: false });
      const cel = scalone.get(k);
      if (rek._zrodlaNrZNazwy) cel._zNazwy = true;
      if (!cel._plik && rek._plik) cel._plik = rek._plik;

      for (const p of DR.POLA) {
        const surowa = rek[p.klucz];
        if (surowa == null || surowa === '') continue;
        const sprawdz = wartoscPasuje(p, surowa);
        if (!sprawdz.ok) {
          odrzucone.push({
            nrRej: rek.nrRej || k, kod: p.kod, pole: p.nazwa, dt1: p.dt1,
            wartosc: String(surowa).slice(0, 40), powod: sprawdz.powod,
            zrodlo: zrodloPola(rek, p.klucz, opts.zrodloDomyslne) || 'folder',
          });
          continue;
        }
        const v = sprawdz.wartosc;
        const z = zrodloPola(rek, p.klucz, opts.zrodloDomyslne) || 'folder';
        const rangaNowa = zrodla[z]?.ranga ?? 0;
        const zStare = cel._zrodla[p.klucz];
        const rangaStara = zStare ? (zrodla[zStare]?.ranga ?? 0) : -1;

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

    const wynik = [...scalone.values()];
    const spozaZestawienia = wynik.filter(r => {
      const uzyte = [...(r._uzyte || [])];
      return uzyte.length > 0 && uzyte.every(z => (zrodla[z]?.ranga ?? 0) <= progNiskiejPewnosci);
    });

    const pokrycie = Object.fromEntries(DR.POLA.map(p => [p.klucz, { razem: 0, wg: {} }]));
    for (const rek of wynik) {
      for (const p of DR.POLA) {
        const v = rek[p.klucz];
        if (v == null || v === '') continue;
        pokrycie[p.klucz].razem++;
        const z = rek._zrodla[p.klucz];
        if (z) pokrycie[p.klucz].wg[z] = (pokrycie[p.klucz].wg[z] || 0) + 1;
      }
    }

    return { rekordy: wynik, konflikty, odrzucone, spozaZestawienia, pokrycie, zrodla };
  }

  /**
   * Buduje wiersze statusu DT-1 (kategoria, co brakuje, czy podlega podatkowi) —
   * przeniesione один-do-jednego z `tools/dr-excel.js`. `TaxEngine` jest wstrzykiwany:
   * w Node to `modules/tax-engine.js` załadowany przez window-shim (patrz
   * `tools/dr-excel.js`), w przeglądarce to już załadowany `window.TaxEngine` —
   * jedno źródło progów podatkowych, bez kopii.
   */
  function budujDt1Wiersze(rekordy, TaxEngine) {
    return rekordy.map(r => {
      const v = {
        dmc: r.dmcKg ?? null, dmcMax: r.dmcKg2 ?? null, dmcZespolu: r.dmcZespolu ?? 0,
        typ: r.przeznaczenie || r.typ || '', przeznaczenie: r.przeznaczenie || '',
        osie: r.liczbaOsi, miejsca: r.miejscaSied, rok: r.rokProd,
      };
      const maDmc = r.dmcKg != null || r.dmcKg2 != null;
      const tonaz = ((r.dmcZespolu || 0) > 0 ? r.dmcZespolu : (r.dmcKg ?? r.dmcKg2 ?? 0)) / 1000;
      const specjalny = /specjaln/i.test(v.typ) || /specjaln/i.test(v.przeznaczenie);
      const cat = maDmc ? TaxEngine.getCat(v) : null;

      const braki = [];
      if (!maDmc) braki.push('F.1 DMC');
      if (!r.przeznaczenie && !r.typ) braki.push('rodzaj pojazdu');
      if (maDmc && !specjalny && tonaz >= 12) {
        if (r.liczbaOsi == null) braki.push('L liczba osi');
        if (!r.zawieszenie) braki.push('zawieszenie');
      }

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
  }

  return {
    ZRODLA,
    nrZNazwyPliku,
    wygladaJakTablica,
    wartoscPasuje,
    kluczScalania,
    zrodloPola,
    scalRekordy,
    budujDt1Wiersze,
  };
});
