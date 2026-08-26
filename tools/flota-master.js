#!/usr/bin/env node
/**
 * ARKUSZ MASTER — jedna tabela floty z WSZYSTKICH źródeł, z widocznym pochodzeniem.
 *
 * Łączy cztery niezależne zbiory po numerze rejestracyjnym:
 *
 *   DR     — dowody rejestracyjne (nasz OCR + kody Aztec). Dane URZĘDOWE: DMC,
 *            liczba osi, kategoria, VIN. Podstawa DT-1.
 *   ZSI    — ewidencja operacyjna. Jedyne źródło NORMY EURO i przebiegów, plus
 *            kierowca, oddział, terminy OC/AC/przeglądu, koszty napraw.
 *   MyCar  — telematyka (Tekom). Numer karty paliwowej, polisa, urządzenie GPS,
 *            status eToll, umowa leasingowa.
 *   ORLEN  — wyciąg kart flotowych. Ważność, status, blokady, typ limitu.
 *
 * ⚠️ DLACZEGO KAŻDA KOMÓRKA MA ŹRÓDŁO. Te zbiory NIE ZGADZAJĄ SIĘ ze sobą — i to
 * jest normalne, bo powstały w różnym czasie i do różnych celów. ZSI może mieć DMC
 * wpisane ręcznie, dowód ma urzędowe. Arkusz, który cicho wybiera jedną wartość,
 * ukrywa pytanie „która jest prawdziwa" — a przy DMC to pytanie o kwotę podatku.
 * Dlatego rozbieżności trafiają na osobny arkusz, a nie znikają.
 *
 * PIERWSZEŃSTWO przy scalaniu (malejąco): DR → ZSI → MyCar → ORLEN. Dowód
 * rejestracyjny jest dokumentem urzędowym; reszta to ewidencje pomocnicze.
 *
 *     node tools/flota-master.js --wyjscie <plik.xlsx>
 *
 * Ścieżki źródeł są w SCIEZKI niżej — zmień je, jeśli pliki leżą gdzie indziej.
 * Brakujące źródło jest POMIJANE z ostrzeżeniem, nie przerywa pracy: lepszy arkusz
 * z trzech zbiorów niż brak arkusza.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const DOM = process.env.USERPROFILE || process.env.HOME || '.';
const SCIEZKI = {
  dr:    path.join(DOM, 'Documents', 'taxorder-backupy', 'Flota - raport dla zarzadu 2026-08-25.xlsx'),
  zsi:   path.join(DOM, 'Desktop', 'Dokumentacja pojazdów', 'Pulpit', 'Brak VIN w ZSI.xlsx'),
  mycar: path.join(DOM, 'Downloads', 'mycar-10-2025-nowe.xls'),
  orlen: path.join(DOM, 'Downloads', 'orlen flota numery kart_CSV.csv'),
  d1osie: path.join(DOM, 'Documents', 'taxorder-backupy', 'd1-osie-2026-08-26.json'),
};

const argv = process.argv.slice(2);
const iw = argv.indexOf('--wyjscie');
const wyjscie = (iw >= 0 ? argv[iw + 1] : null) || path.join(
  DOM, 'Documents', 'taxorder-backupy', `Flota MASTER ${new Date().toISOString().slice(0, 10)}.xlsx`);

const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} leży w drzewie repozytorium (dane pojazdów, VIN-y, kierowcy).\n`));
  process.exit(2);
}

/**
 * Klucz scalania. Numery bywają zapisane różnie w każdym systemie („WA 4956G",
 * „WA4956G", „wa-4956g”) — bez normalizacji ten sam pojazd rozpadłby się na trzy
 * wiersze, a arkusz pokazałby trzykrotnie zawyżoną flotę.
 */
const klucz = (n) => String(n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const flota = new Map();
const zrodlaKomorek = new Map();   // klucz → { pole: 'DR' | 'ZSI' | ... }
const rozbieznosci = [];
const statystyki = {};

/** Wpisuje wartość, jeśli lepsza rangą; rozbieżność zapisuje zamiast ukrywać. */
// „D1" to produkcyjna baza aplikacji. Stoi NAD dowodem, ale wnosi DOKŁADNIE
// JEDNO POLE — liczbę osi — i tylko tam, gdzie różni się od domyślnych dwóch.
//
// Dlaczego nad dowodem: te wartości ktoś RĘCZNIE POPRAWIŁ (korekta osi 02.08.2026),
// a nasze dane DR to OCR skanu, który liczby osi prawie nigdy nie odczytuje.
// Zmierzone: z 28 pojazdów od 12 t aż 17 nie ma liczby osi z żadnego dokumentu,
// a od 12 t stawka OD NIEJ ZALEŻY — brak zrzuca pojazd do stawki dwuosiowej.
//
// ⚠️ Dlaczego TYLKO osie, skoro D1 ma komplet pól: reszta jego danych nie jest
// lepsza od dokumentu, a `suspension_type` jest wręcz szkodliwe — ma wartość
// „pneumatyczne" przy WSZYSTKICH 217 pojazdach, łącznie z motocyklem, osobówką
// i przyczepą z myjką ciśnieniową. To wartość wpisana hurtem, nie pomiar.
// Wciągnięcie jej wypełniłoby 945 pól wiarygodnie wyglądającą nieprawdą.
const RANGA = { D1: 5, DR: 4, ZSI: 3, MyCar: 2, ORLEN: 1 };
function ustaw(k, pole, wartosc, zrodlo) {
  if (wartosc == null || wartosc === '' || String(wartosc).trim() === '') return;
  const w = String(wartosc).trim();
  const rec = flota.get(k);
  const zr = zrodlaKomorek.get(k);
  const stare = rec[pole];
  const zrodloStare = zr[pole];

  if (stare != null && stare !== '' && zrodloStare && zrodloStare !== zrodlo) {
    const norm = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(',', '.');
    // ZERO TO BRAK DANYCH, NIE INNA WARTOŚĆ. ZSI zapisuje nieznane DMC jako „0"
    // (30 ze 181 wierszy). Raportowanie tego jako rozbieżności zasypywało listę:
    // 28 z 43 „konfliktów podatkowych" to było „DR=1887 vs ZSI=0", czyli brak
    // danych po jednej stronie. Prawdziwy sygnał — 5 przypadków, gdzie obie
    // strony mają wartość i się różnią — ginął w szumie.
    const puste = (x) => { const s = String(x).trim(); return s === '' || s === '0' || Number(s) === 0; };
    if (norm(stare) !== norm(w) && !puste(stare) && !puste(w)) {
      rozbieznosci.push({ nr: rec.nrRej, pole, a: stare, zrodloA: zrodloStare, b: w, zrodloB: zrodlo,
        wybrano: (RANGA[zrodlo] ?? 0) > (RANGA[zrodloStare] ?? 0) ? zrodlo : zrodloStare });
    }
  }
  if (stare == null || stare === '' || (RANGA[zrodlo] ?? 0) > (RANGA[zrodloStare] ?? 0)) {
    rec[pole] = w;
    zr[pole] = zrodlo;
  }
}

function wiersz(k, nrOryginalny) {
  if (!flota.has(k)) {
    flota.set(k, { nrRej: nrOryginalny, _zrodla: new Set() });
    zrodlaKomorek.set(k, {});
  }
  return flota.get(k);
}

(async () => {
  console.log(B('\n  Arkusz MASTER floty — scalanie źródeł\n'));

  // ── 1. DR — dowody rejestracyjne ───────────────────────────────────────────
  if (fs.existsSync(SCIEZKI.dr)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SCIEZKI.dr);
    const ws = wb.getWorksheet('Flota');
    const dt = wb.getWorksheet('Podatek DT-1');
    const dtMap = new Map();
    dt?.eachRow((r, i) => { if (i > 1) dtMap.set(klucz(r.getCell(1).value), { kat: r.getCell(9).value, status: r.getCell(10).value, braki: r.getCell(11).value }); });
    let n = 0;
    ws?.eachRow((r, i) => {
      if (i === 1) return;
      const nr = String(r.getCell(1).value || '').trim();
      const k = klucz(nr);
      if (!k) return;
      n++;
      const rec = wiersz(k, nr); rec._zrodla.add('DR');
      const kol = ['marka', 'model', 'typ', 'rodzaj', 'vin', 'dataRej', 'rokProd', 'kategoria',
                   'dmc', 'dmcZespolu', 'masaWlasna', 'liczbaOsi', 'zawieszenie', 'paliwo',
                   'pojemnosc', 'moc', 'miejsca', 'normaEuro', 'nrHomolog'];
      kol.forEach((pole, idx) => ustaw(k, pole, r.getCell(idx + 2).value, 'DR'));
      rec.pewnoscDR = String(r.getCell(21).value || '');
      const d = dtMap.get(k);
      if (d) { rec.dt1Kategoria = d.kat || ''; rec.dt1Status = d.status || ''; rec.dt1Braki = d.braki || ''; }
    });
    statystyki.DR = n;
    console.log(`  ${G('✓')} DR    — ${n} pojazdów`);
  } else console.log(`  ${Y('·')} DR    — pominięte (brak ${SCIEZKI.dr})`);

  // ── 2. ZSI — ewidencja operacyjna ──────────────────────────────────────────
  if (fs.existsSync(SCIEZKI.zsi)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SCIEZKI.zsi);
    let n = 0;
    for (const ws of wb.worksheets) {
      // `row.values` bywa TABLICĄ RZADKĄ — puste komórki zostawiają dziury, przez
      // które `.map` przechodzi bez wywołania funkcji, a `findIndex` dostaje potem
      // `undefined`. Budujemy gęstą tablicę jawnie, komórka po komórce.
      const naglowki = [];
      for (let c = 1; c <= ws.columnCount; c++) naglowki[c - 1] = String(ws.getRow(1).getCell(c).value ?? '').trim();
      const idx = (nazwa) => naglowki.findIndex(h => h.toLowerCase() === nazwa.toLowerCase()) + 1;
      const iNr = idx('Nr rej.');
      if (iNr < 1) continue;
      ws.eachRow((r, i) => {
        if (i === 1) return;
        const nr = String(r.getCell(iNr).value || '').trim();
        const k = klucz(nr);
        if (!k) return;
        n++;
        const rec = wiersz(k, nr); rec._zrodla.add('ZSI');
        const mapa = {
          marka: 'Marka', model: 'Model', rokProd: 'Rok prod.', rodzaj: 'Typ',
          przeznaczenie: 'Przeznaczenie', dmc: 'DMC', normaEuro: 'EURO', ladownosc: 'Ładowność',
        };
        for (const [pole, kol] of Object.entries(mapa)) { const c = idx(kol); if (c >= 1) ustaw(k, pole, r.getCell(c).value, 'ZSI'); }
        // Pola WYŁĄCZNIE z ZSI — bez rangowania, bo nikt inny ich nie dostarcza
        const tylkoZsi = {
          oddzial: 'Kod odd.', aktywny: 'Aktywny', przebieg: 'Stan licznika', wlascicielZsi: 'Właściciel',
          kierowca: 'Kierowca', viatoll: 'Viatoll', normaSpalania: 'Norma spalania',
          zuzycieFakt: 'Faktyczne zużycie l/100 km', kosztNapraw: 'Koszty napraw za okres',
          statusWlasnosci: 'Status własności', statusUzytkowania: 'Status użytkowania',
          oc: 'OC', ac: 'AC', tachograf: 'Tachograf', udt: 'UDT', przeglad: 'Przegląd',
          kartaOrlenZsi: 'Karta ORLEN', nrPodwozia: 'Nr podwozia', uwagi: 'Uwagi',
        };
        for (const [pole, kol] of Object.entries(tylkoZsi)) {
          const c = idx(kol);
          if (c >= 1) { const v = r.getCell(c).value; if (v != null && v !== '') rec[pole] = String(v).trim(); }
        }
      });
    }
    statystyki.ZSI = n;
    console.log(`  ${G('✓')} ZSI   — ${n} pojazdów`);
  } else console.log(`  ${Y('·')} ZSI   — pominięte`);

  // ── 3. MyCar (Tekom) — UTF-16LE TSV mimo rozszerzenia .xls ─────────────────
  if (fs.existsSync(SCIEZKI.mycar)) {
    const tekst = fs.readFileSync(SCIEZKI.mycar).toString('utf16le');
    const linie = tekst.split(/\r?\n/).filter(x => x.trim());
    const nagl = linie[0].replace(/^﻿/, '').split('\t').map(x => x.trim());
    const iNr = nagl.indexOf('Numer rejestracyjny');
    let n = 0;
    for (const l of linie.slice(1)) {
      const c = l.split('\t');
      const nr = (c[iNr] || '').trim();
      const k = klucz(nr);
      if (!k) continue;
      n++;
      const rec = wiersz(k, nr); rec._zrodla.add('MyCar');
      const we = (kol) => { const i = nagl.indexOf(kol); return i >= 0 ? (c[i] || '').trim() : ''; };
      ustaw(k, 'marka', we('Marka'), 'MyCar');
      ustaw(k, 'model', we('Model'), 'MyCar');
      ustaw(k, 'vin', we('Nr VIN'), 'MyCar');
      ustaw(k, 'rokProd', we('Rok produkcji'), 'MyCar');
      ustaw(k, 'pojemnosc', we('Pojemność silnika'), 'MyCar');
      ustaw(k, 'moc', we('Moc silnika'), 'MyCar');
      ustaw(k, 'dataRej', we('Data pierwszej rejestracji'), 'MyCar');
      const tylkoMyCar = {
        kartaPaliwowa: 'Nr karty paliwowej', polisa: 'Numer polisy ubezpieczeniowej',
        wlascicielMyCar: 'Właściciel pojazdu', nadwozie: 'Nadwozie', naped: 'Rodzaj napędu',
        dataZakupu: 'Data zakupu pojazdu', montazGps: 'Data montażu GPS',
        tachografMyCar: 'Tachograf', leasingDo: 'Czas trwania umowy leasingowej',
        grupa: 'Grupa', etollRejestracja: 'Rejestracja eToll', etollWysylanie: 'Wysyłanie do eToll',
        urzadzenieGps: 'Numer seryjny urządzenia',
      };
      for (const [pole, kol] of Object.entries(tylkoMyCar)) { const v = we(kol); if (v) rec[pole] = v; }
    }
    statystyki.MyCar = n;
    console.log(`  ${G('✓')} MyCar — ${n} pojazdów`);
  } else console.log(`  ${Y('·')} MyCar — pominięte`);

  // ── 4. ORLEN — wyciąg kart flotowych ───────────────────────────────────────
  const kartyBezPojazdu = [];
  if (fs.existsSync(SCIEZKI.orlen)) {
    const buf = fs.readFileSync(SCIEZKI.orlen);
    let tekst = buf.toString('utf8');
    if (tekst.includes('�')) tekst = buf.toString('latin1');
    const linie = tekst.split(/\r?\n/).filter(x => x.trim());
    const nagl = linie[0].replace(/^﻿/, '').split(';').map(x => x.trim());
    const iRej = nagl.indexOf('Rejestracja');
    let n = 0, bez = 0;
    for (const l of linie.slice(1)) {
      const c = l.split(';');
      const nr = (c[iRej] || '').trim();
      const k = klucz(nr);
      const we = (kol) => { const i = nagl.indexOf(kol); return i >= 0 ? (c[i] || '').trim() : ''; };
      if (!k) { bez++; kartyBezPojazdu.push({ karta: we('Numer karty'), status: we('Status'), typ: we('Typ samochodu'), waznosc: we('Data ważności') }); continue; }
      n++;
      const rec = wiersz(k, nr); rec._zrodla.add('ORLEN');
      rec.kartaNumer = we('Numer karty');
      rec.kartaStatus = we('Status');
      rec.kartaWaznosc = we('Data ważności');
      rec.kartaBlokada = we('Blokada') === '1' || we('Blokada Floty') === '1' ? 'TAK' : '';
      rec.kartaTypSamochodu = we('Typ samochodu');
      rec.kartaUmowa = we('Numer umowy');
    }
    statystyki.ORLEN = n;
    console.log(`  ${G('✓')} ORLEN — ${n} kart przypisanych do pojazdu, ${bez} bez numeru rejestracyjnego`);
  } else console.log(`  ${Y('·')} ORLEN — pominięte`);

  // ── D1: liczba osi z produkcyjnej bazy ─────────────────────────────────────
  // Jedno pole, świadomie. Uzasadnienie przy stałej RANGA wyżej.
  //
  // Uwaga na pułapkę: NIE używaj do tego `dt1-verify-d1.json`. Ten plik pochodzi
  // sprzed korekty osi z 02.08.2026 i przeczy dzisiejszej bazie w 11 z 16
  // pojazdów ciężkich (WA2609J ma tam 2 osie zamiast 4) — wczytanie go
  // COFNĘŁOBY tamte poprawki, i to bez żadnego widocznego objawu.
  if (fs.existsSync(SCIEZKI.d1osie)) {
    const dane = JSON.parse(fs.readFileSync(SCIEZKI.d1osie, 'utf8'));
    let n = 0, nowe = 0, nT = 0;
    for (const [nr, osie] of Object.entries(dane.osie || {})) {
      const k = klucz(nr);
      const rec = flota.get(k);
      if (!rec) continue;             // pojazd spoza dokumentacji — nie tworzymy wiersza
      if (!rec.liczbaOsi) nowe++;
      ustaw(k, 'liczbaOsi', String(osie), 'D1');
      rec._zrodla.add('D1');
      n++;
    }
    // Rodzaj pojazdu — decyduje, którą GAŁĘZIĄ idzie wyliczenie. Przyczepa
    // dwuosiowa 12–28 t to D14 (1488 zł), a ciężarówka dwuosiowa powyżej 15 t
    // to D8 (2184 zł): zła gałąź daje kwotę wiarygodną z wyglądu i o 700 zł
    // nietrafioną. Zmierzone na WA995AL — 22-tonowej przyczepie ANDRE, którą
    // mój arkusz liczył jak ciężarówkę, bo w dokumencie rodzaj był nieczytelny.
    for (const [nr, typ] of Object.entries(dane.typ || {})) {
      const k = klucz(nr);
      if (!flota.has(k)) continue;
      ustaw(k, 'rodzaj', typ, 'D1');
      flota.get(k)._zrodla.add('D1');
      nT++;
    }
    statystyki.D1 = n + nT;
    console.log(`  ${G('✓')} D1 — liczba osi dla ${n} pojazdów (${nowe} nie miało jej z żadnego dokumentu), rodzaj dla ${nT}`);
  } else console.log(`  ${Y('·')} D1 — pominięte (brak ${path.basename(SCIEZKI.d1osie)})`);

  const rekordy = [...flota.values()].sort((a, b) => String(a.nrRej).localeCompare(String(b.nrRej), 'pl'));

  // ══ WIERSZE DR, KTÓRE SAME SOBIE PRZECZĄ ═══════════════════════════════════
  //
  // Dowód rejestracyjny jest dokumentem urzędowym i dlatego ma najwyższe
  // pierwszeństwo. ALE nasze dane DR to OCR SKANÓW tego dokumentu — a OCR bywa
  // przekłamany. Ślepe pierwszeństwo wpisuje wtedy błąd do deklaracji, i to
  // z pełnym autorytetem „danych urzędowych".
  //
  // Zmierzone 25.08 na realnych rozbieżnościach z ZSI:
  //   WA5718C — marka „LONDAIS" (śmieć), DMC 2080; ZSI: Iveco ML75E16, 7500.
  //             Samo oznaczenie modelu ML75E16 znaczy 7,5 t — DR się myli.
  //   WA6441C — Mercedes ATEGO z kategorią M1 (samochód OSOBOWY) i DMC 3500.
  //             Atego jest ciężarówką 7,5–16 t. Kategoria przeczy pojazdowi.
  //   WL1668N — model „SPRZEDANY". To status rekordu, nie model pojazdu.
  //
  // Te sygnały są WEWNĘTRZNE — widać je bez porównywania ze źródłem zewnętrznym,
  // więc działają też dla pojazdów, których nie ma w ZSI.
  const STATUS_ZAMIAST_MODELU = /^(sprzedany|zbyty|zlomowany|skasowany|wyrejestrowany|likwidacja|brak)$/i;
  const CIEZAROWE_MODELE = /\b(atego|actros|axor|arocs|tgl|tgm|tgs|tgx|eurocargo|daily|sprinter|crafter|master|movano|ducato|cf\d*|xf\d*|lf\d*|fh\d*|fm\d*|fl\d*)\b/i;
  const podejrzane = [];
  for (const r of rekordy) {
    const zr = zrodlaKomorek.get(klucz(r.nrRej)) || {};
    const powody = [];

    if (r.model && STATUS_ZAMIAST_MODELU.test(String(r.model).trim()))
      powody.push(`model „${r.model}" to status rekordu, nie model pojazdu`);

    // Marka bez samogłoski albo z cyframi — typowy kształt śmiecia z OCR
    if (r.marka && zr.marka === 'DR') {
      const m = String(r.marka).trim();
      if (m.length >= 4 && !/[AEIOUYĄĘÓ]/i.test(m)) powody.push(`marka „${m}" nie wygląda na nazwę`);
      // Marka będąca TABLICĄ REJESTRACYJNĄ — odczyt z nazwy folderu, nie z dowodu.
      // WGM77268 ma markę „WW699AN", WGM85789 markę „WW225AR”. Oba to numery
      // pojazdu PO PRZEREJESTROWANIU, wzięte z nazwy katalogu ze skanami.
      const mk = m.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^[A-Z]{2,3}[A-Z0-9]{3,6}$/.test(mk) && /\d/.test(mk) && mk !== klucz(r.nrRej))
        powody.push(`marka „${m}" wygląda na tablicę rejestracyjną, nie markę`);
    }

    // Kategoria homologacyjna kontra rodzaj pojazdu: M1 to samochód OSOBOWY.
    const kat = String(r.kategoria || '').toUpperCase();
    const dmcN = Number(String(r.dmc || '').replace(/[^\d]/g, ''));
    if (/^M1/.test(kat)) {
      if (CIEZAROWE_MODELE.test(String(r.model || '')))
        powody.push(`kategoria M1 (osobowy) przy modelu „${r.model}" — to pojazd ciężarowy`);
      else if (Number.isFinite(dmcN) && dmcN > 3500)
        powody.push(`kategoria M1 (osobowy) przy DMC ${dmcN} kg`);
    }

    // Numer homologacji to długi kod urzędowy — „2" nim nie jest
    if (r.nrHomolog && zr.nrHomolog === 'DR' && String(r.nrHomolog).trim().length <= 3)
      powody.push(`nr homologacji „${r.nrHomolog}" jest za krótki`);

    // ── Reguły dopisane po ręcznej kontroli trzech pojazdów, które wypadły
    //    z opodatkowania. Pierwsze trzy są czysto logiczne: nie wymagają
    //    wiedzy o modelach, więc nie zestarzeją się razem z flotą.

    // 1. DMC zespołu jest MNIEJSZE niż DMC samego pojazdu — niemożliwe, bo
    //    zespół to pojazd plus przyczepa. WA6441C miał „125" przy DMC 3500,
    //    WA5289C „2370" przy 3500. To odczyt sąsiedniej rubryki, nie masa.
    const dmcZesp = Number(String(r.dmcZespolu || '').replace(/[^\d]/g, ''));
    if (Number.isFinite(dmcN) && dmcN > 0 && Number.isFinite(dmcZesp) && dmcZesp > 0 && dmcZesp < dmcN)
      powody.push(`DMC zespołu ${dmcZesp} kg jest mniejsze niż DMC pojazdu ${dmcN} kg`);

    // 2. Liczba osi spoza zakresu spotykanego w tej flocie. Sprinter z „5"
    //    albo „4" osiami to odczyt z innego pola — a od 12 t liczba osi
    //    WPROST wyznacza stawkę, więc błąd tutaj zmienia kwotę podatku.
    const osieN = Number(String(r.liczbaOsi || '').replace(/[^\d]/g, ''));
    if (Number.isFinite(osieN) && osieN > 0 && (osieN > 4 || (osieN > 2 && dmcN > 0 && dmcN <= 3500)))
      powody.push(`${osieN} osi przy DMC ${dmcN || '?'} kg — nie pasuje do tego pojazdu`);

    // 3. Oznaczenie modelu niesie tonaż („Sprinter 5.5T", „TGL 8", „ML75E16"),
    //    a DMC mówi co innego. Producent nie nazywa auta masą, której nie ma.
    const mTonaz = String(r.model || '').match(/\b(\d{1,2})[.,]?(\d)?\s*T\b/i);
    if (mTonaz && Number.isFinite(dmcN) && dmcN > 0) {
      const zModelu = (Number(mTonaz[1]) + (mTonaz[2] ? Number(mTonaz[2]) / 10 : 0)) * 1000;
      if (zModelu >= 2000 && Math.abs(zModelu - dmcN) > 500)
        powody.push(`model mówi ${zModelu} kg, a DMC ${dmcN} kg`);
    }

    // 5. Identyfikator modelu AI zamiast wartości pola. WE129YG (Isuzu D-Max)
    //    miał model „qwen/qwen3.6-27b"; w checkpointcie DR takich rekordów
    //    jest 109 z 1318. Worker filtruje to od teraz u źródła, ale dane już
    //    zebrane pozostają zanieczyszczone — arkusz nie może ich przemilczeć.
    for (const [pole, wart] of Object.entries(r)) {
      if (pole.startsWith('_') || typeof wart !== 'string') continue;
      if (/^(cf-workers-ai|@cf\/)|\b(llama-?[0-9]|qwen[0-9]?|gpt-[0-9]|claude-[0-9]|gemma-?[0-9]|mistral-|pixtral|deepseek)/i.test(wart.trim()))
        powody.push(`pole „${pole}" zawiera identyfikator modelu AI („${wart.trim().slice(0, 30)}"), nie dane pojazdu`);
    }

    // 4. Paliwo przeczy oznaczeniu silnika. CDI/TDI/HDI/dCi/JTD to fabryczne
    //    oznaczenia DIESLA — „Benzyna" przy nich (WB7521S) to zły odczyt,
    //    a paliwo wybiera stawkę § 3 uchwały i wskaźnik CO2.
    if (/benzyn|^pb|\bLPG\b/i.test(String(r.paliwo || '')) &&
        /\b(cdi|tdi|hdi|dci|jtd|bluetec|d-4d|crdi)\b/i.test(String(r.model || '')))
      powody.push(`paliwo „${r.paliwo}" przy silniku „${r.model}" — to oznaczenie diesla`);

    if (powody.length) podejrzane.push({ nr: r.nrRej, marka: r.marka || '', model: r.model || '',
      kategoria: r.kategoria || '', dmc: r.dmc || '', zrodla: [...r._zrodla].join(', '), powody: powody.join('; ') });
  }

  console.log(D(`\n     po scaleniu: ${rekordy.length} pojazdów, ${rozbieznosci.length} rozbieżności\n`));

  // ══ SKOROSZYT ══════════════════════════════════════════════════════════════
  const out = new ExcelJS.Workbook();
  out.creator = 'TaxOrder Pro';
  const naglowek = (ws, kolor = 'FF1F4E79') => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kolor } };
    ws.getRow(1).height = 30;
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
  };

  // ── Arkusz: Flota (wszystko) ───────────────────────────────────────────────
  const wf = out.addWorksheet('Flota');
  wf.columns = [
    { header: 'Nr rejestracyjny', key: 'nrRej', width: 16 },
    { header: 'Źródła', key: 'zrodla', width: 20 },
    { header: 'Marka', key: 'marka', width: 15 },
    { header: 'Model', key: 'model', width: 18 },
    // ── DANE HOMOLOGACYJNE I URZĘDOWE Z DOWODU ──────────────────────────────
    // Dowód rejestracyjny jest dokumentem urzędowym i to on rozstrzyga wymiar
    // podatku — ewidencje operacyjne (ZSI, MyCar) są pomocnicze. Dlatego pola
    // z dowodu stoją NA POCZĄTKU tabeli, z kodami rubryk w nagłówku, i mają
    // pierwszeństwo przy scalaniu (patrz RANGA).
    //
    // D.2 (typ/wariant/wersja) i K (nr świadectwa homologacji) były do 25.08
    // ZBIERANE, ale NIE WYŚWIETLANE — razem z G, S.1 i datą pierwszej rejestracji.
    // Pięć pól z dowodu ginęło po drodze, w tym oba homologacyjne.
    { header: 'D.2 Typ / wariant / wersja', key: 'typ', width: 20 },
    { header: 'Rodzaj', key: 'rodzaj', width: 16 },
    { header: 'Przeznaczenie', key: 'przeznaczenie', width: 18 },
    { header: 'E VIN', key: 'vin', width: 19 },
    { header: 'K Nr homologacji', key: 'nrHomolog', width: 24 },
    { header: 'J Kategoria', key: 'kategoria', width: 11 },
    { header: 'B Data 1. rej.', key: 'dataRej', width: 13 },
    { header: 'Rok', key: 'rokProd', width: 7 },
    { header: 'F.1 DMC [kg]', key: 'dmc', width: 12 },
    { header: 'F.3 DMC zespołu', key: 'dmcZespolu', width: 14 },
    { header: 'G Masa własna', key: 'masaWlasna', width: 13 },
    { header: 'Ładowność', key: 'ladownosc', width: 11 },
    { header: 'L Osie', key: 'liczbaOsi', width: 8 },
    { header: 'Zawieszenie', key: 'zawieszenie', width: 14 },
    { header: 'EURO', key: 'normaEuro', width: 9 },
    { header: 'P.3 Paliwo', key: 'paliwo', width: 11 },
    { header: 'P.1 Poj. [cm3]', key: 'pojemnosc', width: 12 },
    { header: 'P.2 Moc [kW]', key: 'moc', width: 12 },
    { header: 'S.1 Miejsca', key: 'miejsca', width: 11 },
    { header: 'Oddział', key: 'oddzial', width: 9 },
    { header: 'Kierowca', key: 'kierowca', width: 22 },
    { header: 'Właściciel', key: 'wlascicielZsi', width: 14 },
    { header: 'Własność', key: 'statusWlasnosci', width: 11 },
    { header: 'Przebieg [km]', key: 'przebieg', width: 12 },
    { header: 'Zużycie l/100', key: 'zuzycieFakt', width: 12 },
    { header: 'Karta ORLEN', key: 'kartaNumer', width: 20 },
    { header: 'Karta status', key: 'kartaStatus', width: 12 },
    { header: 'Karta ważna do', key: 'kartaWaznosc', width: 13 },
    { header: 'Karta (MyCar)', key: 'kartaPaliwowa', width: 16 },
    { header: 'Polisa', key: 'polisa', width: 18 },
    { header: 'OC do', key: 'oc', width: 12 },
    { header: 'AC do', key: 'ac', width: 12 },
    { header: 'Przegląd do', key: 'przeglad', width: 12 },
    { header: 'Tachograf', key: 'tachograf', width: 12 },
    { header: 'UDT', key: 'udt', width: 12 },
    { header: 'Leasing do', key: 'leasingDo', width: 13 },
    { header: 'GPS (urządzenie)', key: 'urzadzenieGps', width: 16 },
    { header: 'eToll', key: 'etollRejestracja', width: 9 },
    { header: 'Viatoll', key: 'viatoll', width: 8 },
    { header: 'DT-1 kategoria', key: 'dt1Kategoria', width: 13 },
    { header: 'DT-1 status', key: 'dt1Status', width: 22 },
    { header: 'DT-1 braki', key: 'dt1Braki', width: 26 },
    { header: 'Uwagi', key: 'uwagi', width: 30 },
  ];
  for (const r of rekordy) wf.addRow({ ...r, zrodla: [...r._zrodla].join(', ') });
  naglowek(wf);

  // ── Arkusz: DR do weryfikacji — wiersze, które same sobie przeczą ─────────
  if (podejrzane.length) {
    const wsp = out.addWorksheet('DR do weryfikacji');
    wsp.columns = [
      { header: 'Nr rejestracyjny', key: 'nr', width: 16 },
      { header: 'Marka', key: 'marka', width: 18 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Kategoria', key: 'kategoria', width: 11 },
      { header: 'DMC', key: 'dmc', width: 10 },
      { header: 'Źródła', key: 'zrodla', width: 18 },
      { header: 'Co się nie zgadza', key: 'powody', width: 68 },
    ];
    podejrzane.forEach(p => { const r = wsp.addRow(p); r.getCell('powody').font = { color: { argb: 'FFC00000' } }; });
    naglowek(wsp, 'FF9C0006');
  }

  // ── Arkusz: Podstawa DT-1 — skąd pochodzi każda wartość podatkowa ─────────
  //
  // PO CO OSOBNY ARKUSZ. Dowód rejestracyjny jest dokumentem urzędowym i to on
  // rozstrzyga wymiar podatku. Ale gdy dowodu brakuje, scalanie bierze wartość
  // z ewidencji operacyjnej — i w tabeli „Flota" wygląda ona IDENTYCZNIE jak
  // urzędowa. To nie jest to samo ryzyko: DMC przepisane ręcznie do ZSI trafia
  // do deklaracji na tych samych prawach co odczyt z dowodu, tylko bez podstawy.
  //
  // Ten arkusz nie ocenia, która wartość jest lepsza — pokazuje, KTÓRA JEST
  // Z CZEGO, żeby dało się to sprawdzić przed złożeniem deklaracji.
  const POLA_DT1 = [
    ['dmc', 'F.1 DMC'], ['liczbaOsi', 'L Liczba osi'], ['zawieszenie', 'Zawieszenie'],
    ['kategoria', 'J Kategoria'], ['normaEuro', 'EURO'], ['nrHomolog', 'K Homologacja'],
    ['typ', 'D.2 Typ'],
  ];
  const wpd = out.addWorksheet('Podstawa DT-1');
  wpd.columns = [
    { header: 'Nr rejestracyjny', key: 'nrRej', width: 16 },
    ...POLA_DT1.map(([k, n]) => ({ header: n, key: k, width: 16 })),
    { header: 'Pól spoza dowodu', key: 'spoza', width: 16 },
  ];
  let zSpozaDowodu = 0;
  for (const r of rekordy) {
    const k = klucz(r.nrRej);
    const zr = zrodlaKomorek.get(k) || {};
    const w = { nrRej: r.nrRej };
    let n = 0;
    for (const [pole] of POLA_DT1) {
      const zrodlo = zr[pole];
      const ma = r[pole] != null && r[pole] !== '';
      w[pole] = !ma ? '—' : (zrodlo || '?');
      if (ma && zrodlo && zrodlo !== 'DR') n++;
    }
    w.spoza = n || '';
    if (n) zSpozaDowodu++;
    const row = wpd.addRow(w);
    for (const [pole] of POLA_DT1) {
      const c = row.getCell(pole);
      const v = String(c.value || '');
      if (v === 'DR') c.font = { color: { argb: 'FF008000' } };
      else if (v === '—') c.font = { color: { argb: 'FFBFBFBF' } };
      else c.font = { bold: true, color: { argb: 'FFC00000' } };   // wartość spoza dowodu
    }
    if (n) row.getCell('spoza').font = { bold: true, color: { argb: 'FFC00000' } };
  }
  naglowek(wpd, 'FF7B3F00');

  // ── Arkusz: Pokrycie źródeł ────────────────────────────────────────────────
  const wp = out.addWorksheet('Pokrycie źródeł');
  wp.columns = [
    { header: 'Kombinacja źródeł', key: 'komb', width: 34 },
    { header: 'Pojazdów', key: 'ile', width: 11 },
    { header: 'Co to znaczy', key: 'opis', width: 70 },
  ];
  const komb = {};
  for (const r of rekordy) { const s = [...r._zrodla].sort().join(' + '); komb[s] = (komb[s] || 0) + 1; }
  const opisy = {
    'DR': 'Tylko dowód rejestracyjny — brak w ewidencji operacyjnej i telematyce',
    'ZSI': 'Tylko ewidencja ZSI — brak dowodu i telematyki',
    'MyCar': 'Tylko telematyka — pojazd może być spoza floty albo numer się nie zgadza',
    'ORLEN': 'Karta paliwowa bez dopasowanego pojazdu w żadnym innym źródle',
  };
  Object.entries(komb).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => wp.addRow({ komb: k, ile: v, opis: opisy[k] || 'Dane z kilku źródeł — najpełniejszy obraz' }));
  naglowek(wp, 'FF375623');

  // ── Arkusz: Rozbieżności ───────────────────────────────────────────────────
  if (rozbieznosci.length) {
    const wr = out.addWorksheet('Rozbieżności');
    wr.columns = [
      { header: 'Nr rejestracyjny', key: 'nr', width: 16 },
      { header: 'Pole', key: 'pole', width: 16 },
      { header: 'Wartość A', key: 'a', width: 24 },
      { header: 'Źródło A', key: 'zrodloA', width: 10 },
      { header: 'Wartość B', key: 'b', width: 24 },
      { header: 'Źródło B', key: 'zrodloB', width: 10 },
      { header: 'Wzięto', key: 'wybrano', width: 10 },
    ];
    const WAZNE = new Set(['dmc', 'liczbaOsi', 'normaEuro', 'kategoria', 'zawieszenie']);
    for (const k of rozbieznosci) {
      const r = wr.addRow(k);
      if (WAZNE.has(k.pole)) { r.font = { bold: true }; r.getCell('pole').font = { bold: true, color: { argb: 'FFC00000' } }; }
    }
    naglowek(wr, 'FF833C00');
  }

  // ── Arkusz: Karty bez pojazdu ──────────────────────────────────────────────
  if (kartyBezPojazdu.length) {
    const wk = out.addWorksheet('Karty bez pojazdu');
    wk.columns = [
      { header: 'Numer karty', key: 'karta', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Typ samochodu', key: 'typ', width: 20 },
      { header: 'Ważna do', key: 'waznosc', width: 13 },
    ];
    kartyBezPojazdu.forEach(k => wk.addRow(k));
    naglowek(wk, 'FF7030A0');
  }

  // ── Arkusz: Ten sam pojazd pod dwiema tablicami ────────────────────────────
  //
  // Pojazd przerejestrowany zostaje w danych DWA RAZY — pod starym i nowym
  // numerem — bo scalanie idzie po numerze rejestracyjnym, a ten się zmienił.
  // Podatek liczony per wiersz płaci się wtedy dwa razy za jedno auto.
  //
  // ZMIERZONE, nie przewidziane: Sprinter o VIN W1V9071551N140624 występuje
  // pod TRZEMA tablicami (WL1814U, WZ494CU, WWE5XF3) i każda dostała 840 zł.
  //
  // Rozstrzyga VIN, nie nazwa folderu ani podobieństwo modelu. VIN jest
  // przypisany do nadwozia na stałe i nie zmienia się przy przerejestrowaniu —
  // to jedyna cecha, która przeżywa zmianę tablicy.
  const wgVin = new Map();
  for (const r of rekordy) {
    const vin = String(r.vin || '').trim().toUpperCase();
    if (vin.length !== 17) continue;   // krótszy VIN to zły odczyt, nie tożsamość
    if (!wgVin.has(vin)) wgVin.set(vin, []);
    wgVin.get(vin).push(r);
  }
  const duplikaty = [...wgVin.entries()].filter(([, lista]) => lista.length > 1);
  if (duplikaty.length) {
    const wd = out.addWorksheet('Ten sam VIN');
    wd.columns = [
      { header: 'VIN', key: 'vin', width: 20 },
      { header: 'Tablice', key: 'tablice', width: 34 },
      { header: 'Ile razy', key: 'ile', width: 9 },
      { header: 'Marka', key: 'marka', width: 16 },
      { header: 'Model', key: 'model', width: 22 },
      { header: 'DMC [kg]', key: 'dmc', width: 10 },
      { header: 'Rok', key: 'rok', width: 7 },
      { header: 'Źródła', key: 'zrodla', width: 26 },
    ];
    for (const [vin, lista] of duplikaty.sort((a, b) => b[1].length - a[1].length)) {
      const w = wd.addRow({
        vin, tablice: lista.map(x => x.nrRej).join(', '), ile: lista.length,
        marka: lista.find(x => x.marka)?.marka || '',
        model: lista.find(x => x.model)?.model || '',
        dmc: lista.find(x => x.dmc)?.dmc || '',
        rok: lista.find(x => x.rok)?.rok || '',
        zrodla: [...new Set(lista.flatMap(x => [...x._zrodla]))].join(', '),
      });
      if (lista.length > 2) w.font = { bold: true, color: { argb: 'FFC00000' } };
    }
    naglowek(wd, 'FFC00000');
  }

  await out.xlsx.writeFile(cel);

  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     arkusze: Flota (${rekordy.length}), ${podejrzane.length ? `DR do weryfikacji (${podejrzane.length}), ` : ''}Podstawa DT-1, Pokrycie źródeł, ` +
    `${rozbieznosci.length ? `Rozbieżności (${rozbieznosci.length}), ` : ''}` +
    `${kartyBezPojazdu.length ? `Karty bez pojazdu (${kartyBezPojazdu.length})` : ''}\n`));

  if (duplikaty.length) {
    const ileWierszy = duplikaty.reduce((a, [, l]) => a + l.length, 0);
    console.log(R(`  \u26a0 ${duplikaty.length} pojazd\u00f3w wyst\u0119puje pod WI\u0118CEJ NI\u017b JEDN\u0104 TABLIC\u0104`) +
      D(` (${ileWierszy} wierszy) \u2014 arkusz \u201eTen sam VIN\u201d.`));
    console.log(D('     To przerejestrowania. Podatek liczony per wiersz p\u0142aci si\u0119 za jedno auto dwa razy.'));
    console.log(D('     VIN nie zmienia si\u0119 przy zmianie tablicy \u2014 dlatego rozstrzyga on, nie nazwa folderu.\n'));
  }

  if (podejrzane.length) {
    console.log(R(`  \u26a0 ${podejrzane.length} wierszy DR PRZECZY SAMYM SOBIE`) +
      D(' \u2014 arkusz \u201eDR do weryfikacji\u201d.'));
    console.log(D('     Dow\u00f3d jest dokumentem urz\u0119dowym, ale nasze dane DR to OCR jego skanu.'));
    console.log(D('     Kategoria M1 przy Sprinterze 5,5 t decyduje o tym, czy podatek si\u0119 nale\u017cy.\n'));
  }

  if (zSpozaDowodu) {
    console.log(Y(`  ⚠ ${zSpozaDowodu} pojazdów ma pole podatkowe SPOZA dowodu rejestracyjnego`) +
      D(' — arkusz „Podstawa DT-1”, wartości czerwone.'));
    console.log(D('     Dowód jest dokumentem urzędowym; ewidencja operacyjna nie jest podstawą wymiaru.\n'));
  }

  const waz = rozbieznosci.filter(r => ['dmc', 'liczbaOsi', 'normaEuro', 'kategoria'].includes(r.pole));
  if (waz.length) {
    console.log(Y(`  ⚠ ${waz.length} rozbieżności w polach wpływających na PODATEK`) +
      D(' — arkusz „Rozbieżności", wiersze pogrubione.\n'));
  }
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
