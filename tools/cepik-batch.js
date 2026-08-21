#!/usr/bin/env node
/**
 * Pobiera dane DR z rejestru panstwowego dla CALEJ floty.
 *
 *     node tools/cepik-batch.js <zrodlo-numerow.json> --wyjscie <cepik.json>
 *
 * DLACZEGO TO ISTNIEJE. Pomiar sonda (21.08) wykazal, ze api.cepik.gov.pl zwraca 68 pol
 * i pokrywa 9 z 10 pol DT-1 — w tym LICZBE OSI i RODZAJ ZAWIESZENIA, ktorych nie ma ani
 * w zestawieniu, ani w wynikach OCR, ani w kodach Aztec (0% odczytu). Brakuje wylacznie
 * normy EURO, a ta jest w zestawieniu.
 *
 * Zestawienie danych na 876 pojazdach przed uruchomieniem tego narzedzia:
 *
 *     liczba osi        51/876      z OCR
 *     zawieszenie        0/876      znikad
 *     kategoria         47/876      z OCR
 *
 * CEPiK jest rejestrem panstwowym: nie zmysla pol, nie zalezy od jakosci skanu i nie
 * wymaga, zeby kod Aztec sie odczytal. Dane stad sa URZEDOWE, nie rozpoznane.
 *
 * BEZ POSWIADCZEN. Endpoint /pojazdy jest publiczny — zmierzone, nie zalozone (HTTP 200
 * bez naglowka Authorization). Sekrety CEPIK_KEY/CEPIK_SECRET nie sa do tego potrzebne.
 *
 * GRZECZNOSC WOBEC API PUBLICZNEGO. Domyslnie jedno zadanie na 350 ms, sekwencyjnie.
 * To nie jest ostroznosc na wyrost: to darmowe API panstwowe, a my odpytujemy setki razy
 * pod rzad. Checkpoint zapisywany na biezaco, wiec przerwanie nie kosztuje calego przebiegu.
 */
const fs = require('fs');
const path = require('path');
const DR = require(path.join(__dirname, '..', 'modules', 'dr-fields.js'));
const { pobierz } = require(path.join(__dirname, 'lib', 'cepik-http.js'));

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const argv = process.argv.slice(2);
const par = (f, dom) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dom; };
const wejscie = argv.find(a => !a.startsWith('--') && /\.json$/i.test(a));
const wyjscie = par('--wyjscie');
const ODSTEP  = Number(par('--odstep', 350));
const LIMIT   = Number(par('--limit', 0));          // 0 = bez ograniczenia

if (!wejscie || !fs.existsSync(wejscie) || !wyjscie) {
  console.error('\nUzycie: node tools/cepik-batch.js <zrodlo-numerow.json> --wyjscie <cepik.json>');
  console.error('        [--odstep 350] [--limit 20]\n');
  console.error('Zrodlo numerow: tablica rekordow z polem nrRej (np. zestawienie.json).');
  console.error('`--limit` ogranicza liczbe pojazdow — uzyj na poczatku, zeby zmierzyc tempo.\n');
  process.exit(2);
}

// Arkusz wynikowy niesie dane pojazdow, wiec nie moze wyladowac w repozytorium.
const ROOT = path.resolve(__dirname, '..');
const cel = path.resolve(wyjscie);
if (cel === ROOT || cel.startsWith(ROOT + path.sep)) {
  console.error(R(`\n  ODMOWA: ${cel} lezy w drzewie repozytorium.`));
  console.error('  Plik zawiera dane pojazdow. Wskaz lokalizacje poza repo.\n');
  process.exit(2);
}

/**
 * Kod wojewodztwa z prefiksu numeru rejestracyjnego. CEPiK wymaga go jako parametru,
 * a bledny kod daje PUSTY WYNIK, nie blad — czyli wyglada jak „pojazdu nie ma w rejestrze".
 * Dlatego przy pudle probujemy pozostalych kodow, zamiast uznac brak danych.
 */
const WOJ = {
  B:'20', C:'10', D:'02', E:'10', F:'08', G:'22', K:'12', L:'06',
  N:'28', O:'16', P:'30', R:'18', S:'24', T:'26', W:'14', Z:'32',
};
const ALL_WOJ = [...new Set(Object.values(WOJ))];
const wojZNumeru = (nr) => WOJ[String(nr).trim().toUpperCase()[0]] || '14';

/** Odpowiedz CEPiK -> rekord w nazwach katalogu. Mapowanie z modules/dr-fields.js. */
function zmapuj(attrs) {
  const rek = {};
  for (const pole of DR.POLA) {
    for (const nazwa of pole.cepik || []) {
      const v = attrs[nazwa];
      // „---" i puste to oznaczenia braku w formularzu CEPiK, nie wartosci.
      if (v == null || v === '' || /^-+$/.test(String(v).trim())) continue;
      rek[pole.klucz] = v;
      break;
    }
  }
  return rek;
}

const spij = (ms) => new Promise(r => setTimeout(r, ms));

async function jedenPojazd(nr, rok) {
  const kody = [wojZNumeru(nr), ...ALL_WOJ.filter(w => w !== wojZNumeru(nr))];
  for (const woj of kody) {
    const u = new URL('https://api.cepik.gov.pl/pojazdy');
    u.searchParams.set('wojewodztwo', woj);
    u.searchParams.set('numer-rejestracyjny', nr);
    u.searchParams.set('data-od', `${rok - 30}0101`);
    u.searchParams.set('data-do', `${rok}1231`);
    u.searchParams.set('limit', '1');
    u.searchParams.set('pokaz-wszystkie-pola', 'true');

    const r = await pobierz(u);
    if (r.status < 200 || r.status >= 300) {
      if (r.status === 429) return { blad: 'HTTP 429 — limit zapytan; zwieksz --odstep' };
      continue;                                  // 4xx dla zlego wojewodztwa — probuj dalej
    }
    let d; try { d = JSON.parse(r.tresc); } catch { continue; }
    const rek = Array.isArray(d?.data) ? d.data[0] : d?.data;
    if (rek?.attributes) return { attrs: rek.attributes, woj };
    await spij(ODSTEP);
  }
  return { brak: true };
}

(async () => {
  let zrodlo = JSON.parse(fs.readFileSync(wejscie, 'utf8'));
  if (!Array.isArray(zrodlo)) zrodlo = zrodlo.rekordy || zrodlo.pojazdy || zrodlo.data || [];
  const numery = [...new Set(zrodlo.map(r => String(r?.nrRej ?? '').toUpperCase().replace(/[\s-]/g, '')).filter(Boolean))];
  const doPobrania = LIMIT ? numery.slice(0, LIMIT) : numery;

  console.log(B(`\n  CEPiK — pobieranie danych DR dla ${doPobrania.length} pojazdow\n`));
  console.log(D(`  odstep ${ODSTEP} ms miedzy zadaniami; szacowany czas: ~${Math.ceil(doPobrania.length * ODSTEP / 60000)} min`));
  console.log(D('  Checkpoint zapisywany na biezaco — przerwanie nie kosztuje calego przebiegu.\n'));

  // Wznawianie: rekordy juz pobrane zostaja, dopytujemy tylko brakujace.
  let wynik = [];
  if (fs.existsSync(cel)) {
    try { wynik = JSON.parse(fs.readFileSync(cel, 'utf8')); } catch { wynik = []; }
    if (wynik.length) console.log(D(`  Wznawiam: ${wynik.length} rekordow juz w pliku.\n`));
  }
  const gotowe = new Set(wynik.map(r => r.nrRej));
  const rok = new Date().getFullYear();
  let znalezione = 0, puste = 0, bledy = 0, i = 0;

  for (const nr of doPobrania) {
    i++;
    if (gotowe.has(nr)) continue;
    let r;
    try { r = await jedenPojazd(nr, rok); }
    catch (e) { r = { blad: e.message }; }

    if (r.attrs) {
      wynik.push({ nrRej: nr, ...zmapuj(r.attrs), _zrodlo: 'cepik' });
      znalezione++;
    } else if (r.brak) { puste++; }
    else { bledy++; if (bledy <= 3) console.log(R(`  ${nr}: ${r.blad}`)); }

    if (i % 10 === 0 || i === doPobrania.length) {
      fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
      if (process.stderr.isTTY) {
        process.stderr.write(`\r  ${i}/${doPobrania.length}  znalezione ${znalezione}  bez wyniku ${puste}  bledy ${bledy}   `);
      }
    }
    await spij(ODSTEP);
  }
  fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
  if (process.stderr.isTTY) process.stderr.write('\r' + ' '.repeat(72) + '\r');

  // Pokrycie pol DT-1 — po to caly ten przebieg.
  const dt1 = DR.dt1();
  console.log(B('\n  Pokrycie pol DT-1 z rejestru:\n'));
  for (const p of dt1) {
    const n = wynik.filter(r => r[p.klucz] != null && r[p.klucz] !== '').length;
    const proc = wynik.length ? Math.round(n / wynik.length * 100) : 0;
    const znak = proc >= 80 ? G('✓') : proc >= 30 ? Y('~') : R('✗');
    console.log(`   ${znak} ${(p.kod + ' ' + p.nazwa).padEnd(42)} ${String(n).padStart(4)}/${wynik.length}  ${String(proc).padStart(3)}%`);
  }
  console.log(`\n  ${G('✓')} zapisano: ${cel}`);
  console.log(D(`     znalezione ${znalezione} | bez wyniku ${puste} | bledy ${bledy}\n`));
  console.log(D(`  Dalej:  node tools/dr-excel.js <zestawienie.json> ${path.basename(cel)}\n`));
})().catch(e => { console.error(R(`\n  Blad: ${e.message}\n`)); process.exitCode = 1; });
