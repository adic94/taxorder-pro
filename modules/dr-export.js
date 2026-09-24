/**
 * TaxOrderDrExport — eksport danych z dowodów rejestracyjnych do jednego pliku XLSX,
 * wywoływany z UI (pasek akcji masowych, karta "Eksport DR" w Kopii zapasowej).
 *
 * Używa `modules/dr-merge-core.js` (ta sama logika co `tools/dr-excel.js`) — więc
 * walidacja wartości i wykrywanie konfliktów są identyczne w CLI i w przeglądarce.
 *
 * ⚠️ OGRANICZENIE DANYCH ŹRÓDŁOWYCH. Produkcyjna baza (`vehicles.data`) trzyma tylko
 * OSTATECZNĄ, scaloną wartość każdego pola — `handleDrSave` (worker/index.js:3876)
 * nadpisuje blob i nie zachowuje, z jakiego źródła (Aztec/CEPiK/OCR) pochodziła, ani
 * odrzuconych/konfliktowych wartości. Dlatego pojazd bez żadnego dokumentu audytowego
 * (patrz niżej) pokazuje w eksporcie WYŁĄCZNIE źródło „baza danych" — to nie jest błąd
 * eksportu, to prawdziwy stan systemu. Arkusz Legenda tłumaczy to wprost.
 *
 * ŚLAD ŹRÓDEŁ NA PRZYSZŁOŚĆ. Od tej zmiany `dr-import.js`/`aztec-scanner.js` (i docelowo
 * `bulk-import.js`) po każdym zatwierdzonym zapisie DR wysyłają dodatkowo mały JSON —
 * "dokument audytowy ekstrakcji" — przez already-istniejący magazyn `/api/docs`
 * (bez migracji schematu D1). `emitAuditSidecar()` niżej jest jedynym miejscem, które
 * go tworzy; ten sam moduł go tu czyta przy eksporcie. Pojazdy przetworzone PRZED tą
 * zmianą nie mają retroaktywnie takiej historii.
 */
(function () {
  'use strict';

  const API = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok = () => localStorage.getItem('cf_token') || '';
  const company = () => localStorage.getItem('cf_company') || '';

  const DOC_TYPE_AUDYT = 'dr-extraction-audit';

  /**
   * Mapa: klucz z katalogu `modules/dr-fields.js` → nazwa właściwości na obiekcie
   * pojazdu w pamięci przeglądarki (`window.vehs`) / w `vehicles.data`.
   *
   * ZWERYFIKOWANE grepem po `modules/vehicle-detail.js` i `worker/index.js:3910-3924`
   * (`handleDrSave`), NIE zgadywane. `null` = pole katalogu DR nie ma dziś potwierdzonego,
   * trwałego miejsca zapisu w schemacie pojazdu — eksport zostawia je puste zamiast
   * zgadywać, zgodnie z zasadą całego tego narzędzia ("nie zgaduj braków").
   *
   * Dwie rzeczy WARTE zapamiętania, znalezione przy budowie tej mapy (nie naprawiane
   * tutaj — to already-istniejące zachowanie `handleDrSave`, nie coś wprowadzonego
   * przez eksport):
   *   - F.1 (`dmcKg`) i F.2 (`dmcKg2`) to w katalogu DWA RÓŻNE pola, ale
   *     `handleDrSave` czyta tylko `fields.dmcKg` i zapisuje je RAZEM do `data.dmc`
   *     ORAZ `data.dmcMax` — `fields.dmcKg2` nigdy nie jest odczytywane. Eksport mapuje
   *     `dmcKg` → `dmcMax` (pole faktycznie używane w karcie pojazdu) i zostawia
   *     `dmcKg2` bez mapowania.
   *   - D.2 (`typ`) bywa zapisywane przez `handleDrSave` do `data.model`, NIE do
   *     `data.typ` (`worker/index.js:3911`) — mimo że karta pojazdu ma OSOBNE pola
   *     `.typ` i `.model`. Eksport mapuje `typ`→`v.typ` i `model`→`v.model` zgodnie
   *     z katalogiem DR; rozjazd między D.2 a tym, gdzie faktycznie ląduje po imporcie
   *     Aztec/OCR, zostaje widoczny jako ewentualny KONFLIKT w arkuszu, nie jest cicho
   *     naprawiany tutaj.
   */
  const KLUCZ_DO_POLA_POJAZDU = {
    nrRej: 'nrRej', dataRej: 'dataRej',
    posiadacz: null, wlasciciel: 'wlasciciel', adresWlasciciela: null,
    marka: 'marka', typ: 'typ', model: 'model', vin: 'vin',
    dmcKg: 'dmcMax', dmcKg2: null, dmcZespolu: 'dmcZespolu', masaWlKg: 'masaWlasna',
    okresWaznosci: null, dataWydania: null,
    kategoria: 'katPojazdu', nrHomolog: null, liczbaOsi: 'osie',
    dmcPrzyczHam: null, dmcPrzyczNieham: null,
    pojSilnika: 'pojSilnika', mocKW: 'mocKW', paliwo: 'paliwo',
    miejscaSied: 'miejscaSied', miejscaStoj: 'miejscaStoj',
    mocDoMasy: null, predkoscMax: null, normaEuro: null, nextInspection: 'nextInspection',
    przeznaczenie: 'przeznaczenie', rokPierwszejRej: null, rokProd: null,
    seriaDr: null, zawieszenie: null, nipWlasciciela: null,
  };

  /** Źródła rozszerzone o "baza danych" — ranga między `folder` i `ocr`: wartość już
   * scalona przez kogoś wcześniej jest wiarygodniejsza niż zgadywanie z nazwy pliku,
   * ale gdy dokument audytowy pokazuje realny odczyt Aztec/CEPiK/OCR — TEN wygrywa,
   * a rozjazd trafia do arkusza Konflikty zamiast zniknąć po cichu. */
  function zrodlaRozszerzone() {
    const bazowe = window.DrMergeCore.ZRODLA;
    return {
      ...bazowe,
      baza: { etykieta: 'baza danych (zapis obecny)', kolor: 'FFE2E2E2', ranga: (bazowe.ocr.ranga + bazowe.folder.ranga) / 2 },
    };
  }

  function vehicleToZrodloRekord(v) {
    const rek = { _zrodlo: 'baza', _plik: `pojazd #${v.id ?? v.nrRej}` };
    for (const [klucz, pole] of Object.entries(KLUCZ_DO_POLA_POJAZDU)) {
      if (!pole) continue;
      const wartosc = v[pole];
      if (wartosc != null && wartosc !== '') rek[klucz] = wartosc;
    }
    if (!rek.nrRej && v.nrRej) rek.nrRej = v.nrRej;
    return rek;
  }

  async function fetchWszystkieDokumenty() {
    const q = new URLSearchParams({ company: company() });
    const r = await fetch(`${API()}/api/docs?${q}`, { headers: { Authorization: `Bearer ${tok()}` } });
    if (!r.ok) return [];
    try { return await r.json(); } catch { return []; }
  }

  async function pobierzZawartoscJson(r2Key) {
    const r = await fetch(`${API()}/api/docs/file/${encodeURIComponent(r2Key)}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    });
    if (!r.ok) return null;
    try { return await r.json(); } catch { return null; }
  }

  /** Dokument audytowy → rekord źródłowy dla `scalRekordy` (per-pole źródło z `_zrodla`). */
  function audytDoRekordu(nrRej, audyt) {
    if (!audyt || !audyt.pola) return null;
    const rek = { nrRej, _zrodla: {}, _plik: 'dokument audytowy ekstrakcji' };
    for (const [klucz, wpis] of Object.entries(audyt.pola)) {
      if (!wpis || wpis.wartosc == null || wpis.wartosc === '') continue;
      rek[klucz] = wpis.wartosc;
      if (wpis.zrodlo) rek._zrodla[klucz] = wpis.zrodlo;
    }
    return Object.keys(rek._zrodla).length ? rek : null;
  }

  /**
   * Zbiera rekordy źródłowe dla wskazanych pojazdów: bieżący zapis w bazie + wszystkie
   * dokumenty audytowe (`dr-extraction-audit`) powiązane po VIN lub numerze rejestr.
   */
  async function zbierzRekordyZrodlowe(pojazdy) {
    const wszystkieDokumenty = await fetchWszystkieDokumenty();
    const audytoweWgVin = new Map();
    const audytoweWgNrRej = new Map();
    const dopisz = (mapa, klucz, d) => {
      if (!mapa.has(klucz)) mapa.set(klucz, []);
      mapa.get(klucz).push(d);
    };
    for (const d of wszystkieDokumenty) {
      if (d.doc_type !== DOC_TYPE_AUDYT) continue;
      if (d.vin) dopisz(audytoweWgVin, d.vin, d);
      if (d.nr_rej) dopisz(audytoweWgNrRej, d.nr_rej, d);
    }

    const rekordy = [];
    for (const v of pojazdy) {
      rekordy.push(vehicleToZrodloRekord(v));
      const dokumenty = [
        ...(v.vin ? (audytoweWgVin.get(v.vin) || []) : []),
        ...(v.nrRej ? (audytoweWgNrRej.get(v.nrRej) || []) : []),
      ];
      const unikalne = [...new Map(dokumenty.map(d => [d.id, d])).values()];
      for (const d of unikalne) {
        const tresc = await pobierzZawartoscJson(d.r2_key);
        const rek = audytDoRekordu(v.nrRej, tresc);
        if (rek) rekordy.push(rek);
      }
    }
    return rekordy;
  }

  /** Wywoływane po zatwierdzonym zapisie DR (dr-import.js, aztec-scanner.js, docelowo
   * bulk-import.js) — dopisuje ślad źródeł bez zmiany schematu D1 (reużywa `/api/docs`). */
  async function emitAuditSidecar({ vin, nrRej, pola, odrzucone }) {
    if (!nrRej && !vin) return { ok: false, error: 'brak nrRej/vin' };
    const payload = { pola: pola || {}, odrzucone: odrzucone || [], ts: new Date().toISOString() };
    const plik = new File(
      [JSON.stringify(payload)],
      `dr-audyt-${(nrRej || vin || 'pojazd').replace(/[^A-Z0-9]/gi, '')}-${Date.now()}.json`,
      { type: 'application/json' }
    );
    const fd = new FormData();
    fd.append('file', plik);
    fd.append('company', company());
    fd.append('doc_type', DOC_TYPE_AUDYT);
    if (nrRej) fd.append('nrRej', nrRej);
    if (vin) fd.append('vin', vin);
    fd.append('notes', 'Automatyczny ślad źródeł pól DR — generowane po zatwierdzeniu przez człowieka.');
    try {
      const r = await fetch(`${API()}/api/docs/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${tok()}` }, body: fd,
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function budujArkuszePojazdy(DR, rekordy, zrodla) {
    return rekordy.map(r => {
      const wiersz = {};
      for (const p of DR.POLA) wiersz[DR.naglowek(p)] = r[p.klucz] ?? '';
      wiersz['Plik źródłowy'] = r._plik || '';
      return wiersz;
    });
  }

  function budujArkuszPokrycie(DR, pokrycie, rekordy, zrodla) {
    return DR.POLA.map(p => {
      const st = pokrycie[p.klucz] || { razem: 0, wg: {} };
      const wiersz = {
        'Kod': p.kod || '', 'Pole': p.nazwa, 'DT-1': p.dt1 ? 'TAK' : '',
        'Wypełnione': st.razem, '%': rekordy.length ? Math.round((st.razem / rekordy.length) * 100) : 0,
      };
      for (const [k, def] of Object.entries(zrodla)) wiersz[def.etykieta] = st.wg[k] || 0;
      return wiersz;
    });
  }

  function budujArkuszKonflikty(konflikty) {
    return konflikty
      .sort((a, b) => (b.dt1 - a.dt1) || String(a.nrRej).localeCompare(String(b.nrRej)))
      .map(k => ({
        'Nr rej.': k.nrRej, 'Kod': k.kod, 'Pole': k.pole, 'DT-1': k.dt1 ? 'TAK' : '',
        'Wartość A': k.a, 'Źródło A': k.zrodloA, 'Wartość B': k.b, 'Źródło B': k.zrodloB, 'Użyto': k.wybrano,
      }));
  }

  function budujArkuszOdrzucone(odrzucone) {
    return odrzucone
      .sort((a, b) => (b.dt1 - a.dt1) || String(a.nrRej).localeCompare(String(b.nrRej)))
      .map(o => ({
        'Nr rej.': o.nrRej, 'Kod': o.kod, 'Pole': o.pole, 'DT-1': o.dt1 ? 'TAK' : '',
        'Odrzucona wartość': o.wartosc, 'Powód': o.powod, 'Źródło': o.zrodlo,
      }));
  }

  function budujArkuszDt1(dt1Wiersze) {
    return [...dt1Wiersze]
      .sort((a, b) => (Number(b._niepewny) - Number(a._niepewny)) || (Number(b._podlega) - Number(a._podlega)) || String(a.nrRej).localeCompare(String(b.nrRej)))
      .map(w => ({
        'Nr rej.': w.nrRej, 'Marka': w.marka, 'Model': w.model, 'Rodzaj / przeznaczenie': w.rodzaj,
        'F.1 DMC (kg)': w.dmc, 'F.3 DMC zespołu': w.dmcZesp, 'L osie': w.osie, 'Zawieszenie': w.zawieszenie,
        'Kategoria DT-1': w.kat, 'Możliwe kategorie (brak osi)': w.katWarianty, 'Status': w.status, 'Czego brakuje': w.braki,
      }));
  }

  function budujArkuszLegenda(DR, zrodla) {
    const wiersze = [];
    wiersze.push(['ŹRÓDŁA DANYCH', '']);
    const opisy = {
      aztec: 'Odczyt z kodu 2D na dowodzie. Wartość PEWNA.',
      cepik: 'Centralna Ewidencja Pojazdów. Dane urzędowe.',
      zestawienie: 'Arkusz prowadzony ręcznie.',
      ocr: 'Rozpoznanie ze skanu przez model językowy. MOŻE BYĆ ZMYŚLONA.',
      baza: 'Bieżąca wartość w bazie produkcyjnej — już wcześniej scalona przez kogoś/coś. Nie wiadomo z jakiego pierwotnego źródła, dopóki nie istnieje dokument audytowy dla tego pojazdu.',
      folder: 'Wywnioskowane z nazwy pliku. Orientacyjne.',
    };
    for (const [k, def] of Object.entries(zrodla)) wiersze.push([def.etykieta, opisy[k] || '']);
    wiersze.push(['', '']);
    wiersze.push(['WAŻNE OGRANICZENIE', 'Produkcyjna baza trzyma tylko ostateczną wartość każdego pola — bez historii źródeł.']);
    wiersze.push(['', 'Pojazd bez dokumentu audytowego pokaże wyłącznie źródło "baza danych", nie prawdziwy Aztec/CEPiK/OCR.']);
    wiersze.push(['', 'Dokumenty audytowe zaczęły powstawać dopiero od tej zmiany — starsze pojazdy nie mają historii wstecznie.']);
    wiersze.push(['', '']);
    wiersze.push(['POLA BEZ MIEJSCA ZAPISU W BIEŻĄCYM SYSTEMIE', '']);
    for (const [klucz, pole] of Object.entries(KLUCZ_DO_POLA_POJAZDU)) {
      if (pole !== null) continue;
      const p = DR.wgKlucza[klucz];
      wiersze.push(['', `${DR.naglowek(p)} — nie jest dziś trwale zapisywane w karcie pojazdu; wypełni się tylko z dokumentu audytowego, jeśli taki istnieje.`]);
    }
    wiersze.push(['', '']);
    wiersze.push(['KOLUMNA DT-1', 'Pole wpływa na wymiar podatku od środków transportowych.']);
    wiersze.push(['ARKUSZ ODRZUCONE', 'Wartości, które NIE PASOWAŁY do typu pola — pole zostało PUSTE, nie zgadywane.']);
    wiersze.push(['ARKUSZ KONFLIKTY', 'Pola, w których różne źródła podały różne wartości. Wygrywa wyższa ranga, rozbieżność zostaje widoczna.']);
    wiersze.push(['', '']);
    wiersze.push(['DANE OSOBOWE', 'Plik zawiera VIN-y, numery rejestracyjne i dane właścicieli. Nie umieszczaj go w repozytorium.']);
    return wiersze;
  }

  async function eksportuj(pojazdy, etykieta) {
    if (!window.XLSX) { window.toast?.('⚠ Brak biblioteki XLSX'); return; }
    if (!window.DrFields || !window.DrMergeCore) { window.toast?.('⚠ Katalog pól DR nie jest załadowany'); return; }
    if (!pojazdy.length) { window.toast?.('Brak pojazdów do eksportu'); return; }
    if (!confirm(
      'Plik będzie zawierał VIN-y, numery rejestracyjne i dane właścicieli.\n' +
      'Nie umieszczaj go w repozytorium ani nie wysyłaj do zewnętrznych serwisów.\n\nKontynuować?'
    )) return;

    window.toast?.('Zbieram dane źródłowe…');
    const DR = window.DrFields;
    const Core = window.DrMergeCore;
    const zrodla = zrodlaRozszerzone();

    let rekordyZrodlowe;
    try {
      rekordyZrodlowe = await zbierzRekordyZrodlowe(pojazdy);
    } catch (e) {
      window.toast?.('Błąd pobierania dokumentów audytowych: ' + e.message, 'error');
      return;
    }

    const { rekordy, konflikty, odrzucone, pokrycie } = Core.scalRekordy(rekordyZrodlowe, { zrodla, zrodloDomyslne: 'baza' });

    let dt1Wiersze = [];
    if (window.TaxEngine) {
      dt1Wiersze = Core.budujDt1Wiersze(rekordy, window.TaxEngine);
    } else {
      window.toast?.('⚠ TaxEngine niedostępny — arkusz DT-1 pominięty', 'error');
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budujArkuszePojazdy(DR, rekordy, zrodla)), 'Pojazdy');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budujArkuszPokrycie(DR, pokrycie, rekordy, zrodla)), 'Pokrycie');
    if (konflikty.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budujArkuszKonflikty(konflikty)), 'Konflikty');
    if (odrzucone.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budujArkuszOdrzucone(odrzucone)), 'Odrzucone');
    if (dt1Wiersze.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budujArkuszDt1(dt1Wiersze)), 'DT-1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(budujArkuszLegenda(DR, zrodla)), 'Legenda');

    XLSX.writeFile(wb, `dowody-rejestracyjne-${etykieta}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    window.toast?.(`✓ Wyeksportowano ${rekordy.length} pojazdów (${konflikty.length} konfliktów, ${odrzucone.length} odrzuconych wartości)`);
  }

  function exportSelected() {
    const sel = (typeof getSel === 'function') ? getSel() : [];
    if (!sel.length) { window.toast?.('Zaznacz przynajmniej jeden pojazd'); return; }
    return eksportuj(sel, 'zaznaczone');
  }

  function exportAll() {
    const all = window.vehs || [];
    return eksportuj(all, 'cala-flota');
  }

  window.TaxOrderDrExport = { exportSelected, exportAll, emitAuditSidecar, DOC_TYPE_AUDYT };
})();
