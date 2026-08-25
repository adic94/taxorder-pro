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
const RANGA = { DR: 4, ZSI: 3, MyCar: 2, ORLEN: 1 };
function ustaw(k, pole, wartosc, zrodlo) {
  if (wartosc == null || wartosc === '' || String(wartosc).trim() === '') return;
  const w = String(wartosc).trim();
  const rec = flota.get(k);
  const zr = zrodlaKomorek.get(k);
  const stare = rec[pole];
  const zrodloStare = zr[pole];

  if (stare != null && stare !== '' && zrodloStare && zrodloStare !== zrodlo) {
    const norm = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(',', '.');
    if (norm(stare) !== norm(w)) {
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

  const rekordy = [...flota.values()].sort((a, b) => String(a.nrRej).localeCompare(String(b.nrRej), 'pl'));
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
    { header: 'Rodzaj', key: 'rodzaj', width: 16 },
    { header: 'Przeznaczenie', key: 'przeznaczenie', width: 18 },
    { header: 'VIN', key: 'vin', width: 19 },
    { header: 'Rok', key: 'rokProd', width: 7 },
    { header: 'Kategoria', key: 'kategoria', width: 10 },
    { header: 'DMC [kg]', key: 'dmc', width: 10 },
    { header: 'DMC zespołu', key: 'dmcZespolu', width: 12 },
    { header: 'Ładowność', key: 'ladownosc', width: 11 },
    { header: 'Osie', key: 'liczbaOsi', width: 6 },
    { header: 'Zawieszenie', key: 'zawieszenie', width: 14 },
    { header: 'EURO', key: 'normaEuro', width: 9 },
    { header: 'Paliwo', key: 'paliwo', width: 9 },
    { header: 'Poj. [cm3]', key: 'pojemnosc', width: 10 },
    { header: 'Moc', key: 'moc', width: 8 },
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

  await out.xlsx.writeFile(cel);

  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     arkusze: Flota (${rekordy.length}), Pokrycie źródeł, ` +
    `${rozbieznosci.length ? `Rozbieżności (${rozbieznosci.length}), ` : ''}` +
    `${kartyBezPojazdu.length ? `Karty bez pojazdu (${kartyBezPojazdu.length})` : ''}\n`));

  const waz = rozbieznosci.filter(r => ['dmc', 'liczbaOsi', 'normaEuro', 'kategoria'].includes(r.pole));
  if (waz.length) {
    console.log(Y(`  ⚠ ${waz.length} rozbieżności w polach wpływających na PODATEK`) +
      D(' — arkusz „Rozbieżności", wiersze pogrubione.\n'));
  }
})().catch(e => { console.error(R(`\n  Błąd: ${e.message}\n`)); process.exitCode = 1; });
