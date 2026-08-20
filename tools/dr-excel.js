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
const iw = argv.indexOf('--wyjscie');
// `iw >= 0` JEST KONIECZNE. Bez tego przy braku --wyjscie mamy iw === -1, wiec iw+1 === 0
// i filtr wyrzuca argument numer 0 — czyli jedyny podany plik wejsciowy. Objawialo sie to
// wypisaniem instrukcji uzycia przy poprawnym wywolaniu.
const wejscia = argv.filter((a, i) => !a.startsWith('--') && !(iw >= 0 && i === iw + 1));
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
  (rek._zrodla && rek._zrodla[klucz]) || rek._zrodlo || null;

function wczytaj(sciezka) {
  let d;
  try { d = JSON.parse(fs.readFileSync(sciezka, 'utf8')); }
  catch (e) { console.error(R(`\n  ${path.basename(sciezka)} nie jest poprawnym JSON-em: ${e.message}\n`)); process.exit(2); }
  if (!Array.isArray(d)) d = d.rekordy || d.pojazdy || d.data;
  if (!Array.isArray(d)) { console.error(R(`\n  ${path.basename(sciezka)}: oczekiwano tablicy rekordów.\n`)); process.exit(2); }
  return d;
}

// Numer rejestracyjny bywa zapisany ze spacjami i małymi literami — do dopasowania
// normalizujemy, ale W ARKUSZU zostaje wartość ze źródła o najwyższej randze.
const kluczScalania = (r) => String(r.nrRej ?? '').toUpperCase().replace(/[\s-]/g, '');

const konflikty = [];
const scalone = new Map();

for (const sciezka of wejscia) {
  for (const rek of wczytaj(sciezka)) {
    const k = kluczScalania(rek);
    if (!k) continue;                       // bez numeru nie ma po czym scalać
    if (!scalone.has(k)) scalone.set(k, { _zrodla: {}, _plik: rek._plik });
    const cel = scalone.get(k);
    if (!cel._plik && rek._plik) cel._plik = rek._plik;

    for (const p of DR.POLA) {
      const v = rek[p.klucz];
      if (v == null || v === '') continue;
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
      if (rangaNowa > rangaStara) { cel[p.klucz] = v; cel._zrodla[p.klucz] = z; }
    }
  }
}

const rekordy = [...scalone.values()];

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

  // ── Podsumowanie na terminal ───────────────────────────────────────────────
  const dt1Slabe = kolumny.filter(p => p.dt1 && pokrycie[p.klucz].razem / (rekordy.length || 1) < 0.5);
  console.log(`  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     źródeł: ${wejscia.length}  |  pojazdów po scaleniu: ${rekordy.length}  |  pól: ${kolumny.length}`));
  console.log(D(`     arkusze: Pojazdy, Pokrycie${konflikty.length ? ', Konflikty' : ''}, Legenda\n`));

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
