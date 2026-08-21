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
 * GRZECZNOSC WOBEC API PUBLICZNEGO. Domyslnie jedno zadanie na 900 ms, sekwencyjnie,
 * z odstepem PO KAZDYM zadaniu — takze po nieudanym — i z wykladniczym wycofywaniem przy
 * HTTP 429. To nie jest ostroznosc na wyrost: pierwsza wersja (350 ms, odstep pomijany przy
 * bledzie, fallback po 16 wojewodztwach) dostala 429 po kilku pojazdach i miala to zasluzone.
 * Checkpoint zapisywany na biezaco, wiec przerwanie nie kosztuje calego przebiegu.
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
// 900 ms, nie 350. Pierwsza wersja z 350 ms dostala HTTP 429 po kilku pojazdach —
// bo fallback mnozyl liczbe zadan sesnastokrotnie, a odstep byl pomijany przy bledzie.
const ODSTEP  = Number(par('--odstep', 900));
const LIMIT   = Number(par('--limit', 0));          // 0 = bez ograniczenia
// Fallback po 16 wojewodztwach jest WYLACZONY domyslnie: kosztuje szesnascie zadan na
// kazdy pojazd, ktorego nie ma w rejestrze pod wlasciwym kodem. Wlacz swiadomie, gdy
// przebieg bez niego zostawi duzo „bez wyniku".
const FALLBACK_WOJ = argv.includes('--fallback-woj');
// ILE LAT WSTECZ PRZESZUKAC. Uwaga: to NIE jest szerokosc jednego zapytania.
//
// CEPiK przyjmuje okno o dlugosci NAJWYZEJ DWOCH LAT. Powiedzial to sam, dokladnie tymi
// slowami: „Bledny zakres dat. Maksymalny zakres lat to: 2". Pojedyncze zapytanie o 30 lat
// dostaje HTTP 400 — czyli poprzednia wersja z `--lata 30` nie mogla znalezc NICZEGO,
// bo kazde jej zapytanie bylo odrzucane, zanim ktokolwiek zdazyl pomyslec o wojewodztwie.
//
// Pokrycie N lat kosztuje wiec ceil(N/2) OKIEN NA KAZDY POJAZD. Przy 876 pojazdach:
//
//     --lata  2   ->    876 zadan   ~13 min
//     --lata 10   ->  4 380 zadan   ~66 min
//     --lata 30   -> 13 140 zadan   ~3,5 h
//
// Dlatego domyslnie 2 lata (jedno okno) i jawny budzet wypisywany przed startem.
// Zwiekszaj swiadomie, patrzac na ten rachunek — nie „na wszelki wypadek".
const ZAKRES_LAT = Number(par('--lata', 2));
const OKNO_MAX = 2;                                   // twardy limit CEPiK, nie nasz wybor

/** Okna po <=2 lata, od najswiezszego wstecz. Zwraca pary [rokOd, rokDo]. */
function okna(rok, lat) {
  const w = [];
  for (let gora = rok; gora > rok - lat; gora -= OKNO_MAX) {
    w.push([Math.max(gora - (OKNO_MAX - 1), rok - lat + 1), gora]);
  }
  return w;
}
// Preflight: jeden numer rejestracyjny, kilka szerokosci okna dat. Cztery zadania zamiast
// osmiuset — odpowiada na pytanie „czemu zero wynikow" ZANIM ruszy caly przebieg.
const SPRAWDZ = par('--sprawdz');

if (!SPRAWDZ && (!wejscie || !fs.existsSync(wejscie) || !wyjscie)) {
  console.error('\nUzycie: node tools/cepik-batch.js <zrodlo-numerow.json> --wyjscie <cepik.json>');
  console.error('        [--odstep 900] [--limit 20] [--fallback-woj] [--lata 30]\n');
  console.error('Zanim uruchomisz caly przebieg:  node tools/cepik-batch.js --sprawdz <NR-REJ>');
  console.error('Zrodlo numerow: tablica rekordow z polem nrRej (np. zestawienie.json).');
  console.error('`--limit` ogranicza liczbe pojazdow — uzyj na poczatku, zeby zmierzyc tempo.\n');
  process.exit(2);
}

// Arkusz wynikowy niesie dane pojazdow, wiec nie moze wyladowac w repozytorium.
const ROOT = path.resolve(__dirname, '..');
const cel = wyjscie ? path.resolve(wyjscie) : null;
if (cel && (cel === ROOT || cel.startsWith(ROOT + path.sep))) {
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
  B:'20', C:'04', D:'02', E:'10', F:'08', G:'22', K:'12', L:'06',
  N:'28', O:'16', P:'30', R:'18', S:'24', T:'26', W:'14', Z:'32',
};
const ALL_WOJ = [...new Set(Object.values(WOJ))];
// C mialo tu '04'? Do 21.08 mialo '10' — czyli to samo co E (lodzkie), a kod 04
// (kujawsko-pomorskie) NIE WYSTEPOWAL W OGOLE. Kazdy pojazd na tablicach C byl wiec
// nieosiagalny takze przez fallback po „wszystkich" wojewodztwach: lista miala 15 kodow,
// nie 16, i brakowalo dokladnie tego jednego. Objaw byl niemy — CEPiK na zly kod zwraca
// pusty wynik, nie blad, wiec wygladalo to jak „pojazdu nie ma w rejestrze".
// Asercja jest tu po to, zeby literowka w tablicy nie mogla sie powtorzyc po cichu.
if (ALL_WOJ.length !== 16) {
  console.error(R(`\n  BLAD W TABLICY WOJEWODZTW: ${ALL_WOJ.length} unikalnych kodow zamiast 16.`));
  console.error('  Dwie litery wskazuja ten sam kod — jedno wojewodztwo jest nieosiagalne.\n');
  process.exit(2);
}
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

/**
 * Jedno zadanie z ODSTEPEM PO KAZDYM, bez wyjatkow, oraz z wycofywaniem przy 429.
 *
 * PIERWSZA WERSJA ZALEWALA API. Przy nietrafionym wojewodztwie robila `continue`, ktore
 * PRZESKAKIWALO odstep — a fallback probuje do 16 kodow, wiec na jeden pojazd szlo do
 * 16 zadan pod rzad bez zadnej przerwy. Serwer odpowiedzial HTTP 429 po kilku pojazdach
 * i mial racje. To jest darmowe API panstwowe; zalewanie go jest nasza wina, nie jego
 * ograniczeniem.
 *
 * 429 nie jest tez powodem do poddania sie: to prosba o zwolnienie. Wycofujemy sie
 * wykladniczo i probujemy dalej, zamiast tracic caly przebieg.
 */
async function zadanieZOdstepem(u, proba = 0) {
  const r = await pobierz(u);
  await spij(ODSTEP);
  if (r.status === 429) {
    if (proba >= 4) return { ...r, poddajemy: true };
    const czekaj = ODSTEP * Math.pow(3, proba + 1);
    if (process.stderr.isTTY) process.stderr.write(`\r  429 — czekam ${Math.round(czekaj / 1000)}s…${' '.repeat(30)}`);
    await spij(czekaj);
    return zadanieZOdstepem(u, proba + 1);
  }
  return r;
}

async function jedenPojazd(nr, rok) {
  // Wlasciwe wojewodztwo NAJPIERW; pozostale tylko gdy trzeba i tylko przy wlaczonym
  // fallbacku. Bez tego kazdy pojazd spoza rejestru kosztuje sesnascie zadan zamiast jednego.
  const kody = FALLBACK_WOJ
    ? [wojZNumeru(nr), ...ALL_WOJ.filter(w => w !== wojZNumeru(nr))]
    : [wojZNumeru(nr)];
  let ostatniBlad = null;

  for (const woj of kody) {
   for (const [od, do_] of okna(rok, ZAKRES_LAT)) {
    const u = new URL('https://api.cepik.gov.pl/pojazdy');
    u.searchParams.set('wojewodztwo', woj);
    u.searchParams.set('numer-rejestracyjny', nr);
    u.searchParams.set('data-od', `${od}0101`);
    u.searchParams.set('data-do', `${do_}1231`);
    u.searchParams.set('limit', '1');
    u.searchParams.set('pokaz-wszystkie-pola', 'true');

    const r = await zadanieZOdstepem(u);
    if (r.poddajemy) return { blad: 'HTTP 429 mimo wycofywania — zwieksz --odstep' };

    if (r.status < 200 || r.status >= 300) {
      // CEPiK zwraca BARDZO dobre komunikaty bledu (wskazal nam kiedys dokladnie zly
      // parametr). Przemilczenie ich zamienia diagnozowalny problem w „brak wyniku".
      try {
        const d = JSON.parse(r.tresc);
        const e = d?.errors?.[0];
        if (e) ostatniBlad = `HTTP ${r.status}: ${e['error-reason'] || e['error-result'] || ''}`.slice(0, 160);
      } catch { ostatniBlad = `HTTP ${r.status}`; }
      continue;
    }
    let d; try { d = JSON.parse(r.tresc); } catch { ostatniBlad = 'odpowiedz nie jest JSON-em'; continue; }
    const rek = Array.isArray(d?.data) ? d.data[0] : d?.data;
    if (rek?.attributes) return { attrs: rek.attributes, woj, okno: [od, do_] };
   }
  }
  return ostatniBlad ? { blad: ostatniBlad } : { brak: true };
}

/**
 * PREFLIGHT — jeden numer, kilka szerokosci okna dat.
 *
 * Powod: `data-od`/`data-do` w CEPiK filtruja po DACIE REJESTRACJI. Okno, ktore nie obejmuje
 * roku rejestracji pojazdu, daje PUSTY WYNIK bez zadnego bledu — dokladnie tak samo, jak
 * pojazd nieobecny w rejestrze. Tych dwoch przypadkow nie da sie odroznic po odpowiedzi,
 * wiec caly przebieg na 876 pojazdach moze zwrocic zero i niczego nie wyjasnic.
 *
 * Cztery zadania odpowiadaja na to pytanie przed uruchomieniem osmiuset.
 */
async function preflight(nr) {
  const woj = wojZNumeru(nr);
  const rok = new Date().getFullYear();
  console.log(B(`\n  Preflight dla ${nr} — wojewodztwo ${woj}\n`));

  /** Jedno zapytanie o konkretne okno [od, do] (lata kalendarzowe). */
  async function pytaj(od, do_, zNumerem = true) {
    const u = new URL('https://api.cepik.gov.pl/pojazdy');
    u.searchParams.set('wojewodztwo', woj);
    if (zNumerem) u.searchParams.set('numer-rejestracyjny', nr);
    u.searchParams.set('data-od', `${od}0101`);
    u.searchParams.set('data-do', `${do_}1231`);
    u.searchParams.set('limit', '1');
    u.searchParams.set('pokaz-wszystkie-pola', 'true');

    const r = await zadanieZOdstepem(u);
    if (r.status < 200 || r.status >= 300) {
      let powod = `HTTP ${r.status}`;
      try {
        const e = JSON.parse(r.tresc)?.errors?.[0];
        if (e) powod += `: ${e['error-reason'] || e['error-result'] || ''}`;
      } catch { /* nie JSON — sam status musi wystarczyc */ }
      return { blad: powod.slice(0, 130) };
    }
    let d; try { d = JSON.parse(r.tresc); } catch { return { blad: 'odpowiedz nie jest JSON-em' }; }
    const rek = Array.isArray(d?.data) ? d.data[0] : d?.data;
    return rek?.attributes ? { attrs: rek.attributes } : { brak: true };
  }

  const pokaz = (od, do_, w) => {
    const lat = do_ - od + 1;
    const et = `${od}–${do_}  (${lat === 1 ? '1 rok kalendarzowy' : `${lat} lata kalendarzowe`})`.padEnd(34);
    if (w.blad) console.log(`   ${R('✗')} ${et} ${w.blad}`);
    else if (w.brak) console.log(`   ${Y('·')} ${et} HTTP 200, ale zero rekordow`);
    else console.log(`   ${G('✓')} ${et} REKORD ZNALEZIONY, pol: ${Object.keys(w.attrs).length}`);
  };

  // DRABINKA. Okna opisane FAKTYCZNYM zakresem dat, nie „liczba lat wstecz".
  // Poprzednia wersja etykietowala je liczba lat wstecz i przez to KLAMALA: „okno 1 lat"
  // wysylalo 2025-01-01..2026-12-31, czyli DWA lata kalendarzowe, a „okno 2 lat" wysylalo
  // trzy. Wygladalo to, jakby limit dwuletni byl lamany takze przez okno dwuletnie —
  // a to okno jest w porzadku i wlasnie takie generuje `okna()` dla przebiegu wsadowego.
  const proby = [
    [rok, rok],          // 1 rok kalendarzowy
    [rok - 1, rok],      // 2 lata — tyle, ile deklaruje limit; TEGO uzywa przebieg wsadowy
    [rok - 2, rok],      // 3 lata — celowo za szerokie, potwierdza ze limit nadal obowiazuje
  ];

  let trafienie = null;
  for (const [od, do_] of proby) {
    const w = await pytaj(od, do_);
    pokaz(od, do_, w);
    if (w.attrs && !trafienie) trafienie = { attrs: w.attrs, okno: [od, do_] };
  }

  console.log('');
  if (!trafienie) {
    console.log(R('  Zadne okno nie zwrocilo rekordu.'));

    // PROBA KONTROLNA — to samo zapytanie BEZ filtra po numerze rejestracyjnym.
    // Rozstrzyga pytanie, ktorego przebieg wsadowy nie potrafi zadac: czy endpoint
    // z tymi parametrami zwraca COKOLWIEK.
    const k = await pytaj(rok - 1, rok, false);
    console.log(B('\n  Proba kontrolna bez filtra po numerze rejestracyjnym:'));
    if (k.attrs) {
      console.log(`   ${G('✓')} endpoint zwraca rekordy dla wojewodztwa ${woj}.`);
      console.log(D('  Czyli parametry sa dobre, a problemem jest sam numer:'));
      console.log(D(`    • sprawdz pisownie ${nr} (bez spacji, wielkimi literami)`));
      console.log(D(`    • pojazd moze byc zarejestrowany poza wojewodztwem ${woj} — uruchom z --fallback-woj`));
      console.log(D('    • pojazd moze byc wyrejestrowany albo zarejestrowany poza Polska\n'));
    } else {
      console.log(`   ${R('✗')} endpoint nie zwraca nic takze bez filtra  (${k.blad || 'zero rekordow'})`);
      console.log(D('  Czyli problem NIE jest w numerze rejestracyjnym, tylko w parametrach'));
      console.log(D('  albo w dostepie. Nie uruchamiaj przebiegu na calej flocie — nic nie znajdzie.\n'));
    }
    return;
  }

  const { attrs, okno } = trafienie;
  const opis = ['marka', 'model', 'rodzaj-pojazdu'].map(k => attrs[k]).filter(Boolean).join(' · ');
  console.log(G(`  Dziala. Najwezsze okno z trafieniem: ${okno[0]}–${okno[1]}.`));
  if (opis) console.log(D(`  Rekord dotyczy: ${opis}`));

  const rokZ = (v) => { const m = String(v || '').match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };
  const pierwsza = rokZ(attrs['data-pierwszej-rejestracji-w-kraju'] || attrs['data-pierwszej-rejestracji']);
  const ostatnia = rokZ(attrs['data-ostatniej-rejestracji-w-kraju']);

  console.log(B('\n  Daty w znalezionym rekordzie:\n'));
  for (const [k, v] of Object.entries(attrs)) {
    if (!/data|rok/i.test(k) || v == null || v === '' || /^-+$/.test(String(v).trim())) continue;
    const r2 = rokZ(v);
    const w = r2 != null && r2 >= okno[0] && r2 <= okno[1];
    console.log(`   ${w ? G('◄') : ' '} ${k.padEnd(38)} ${String(v).slice(0, 30)}`);
  }

  // ZAPYTANIE ROZSTRZYGAJACE — po KTOREJ dacie filtruje okno.
  //
  // To nie jest ciekawostka, tylko liczba zadan na cala flote. Jesli okno patrzy na date
  // OSTATNIEJ operacji, jedno swieze okno zlapie kazdy pojazd, ktory mial ostatnio
  // jakakolwiek zmiane w rejestrze. Jesli patrzy na date PIERWSZEJ rejestracji, trzeba
  // siegac wstecz az do rocznika najstarszego pojazdu — a kazde dwa lata to osobne okno
  // na KAZDY pojazd.
  //
  // Rozstrzygamy jednym zapytaniem o okno, ktore zawiera date pierwszej rejestracji,
  // ale NIE zawiera daty ostatniej operacji. Trafienie = filtr widzi pierwsza rejestracje.
  if (pierwsza == null || ostatnia == null || pierwsza === ostatnia) {
    console.log(Y('\n  Ten pojazd nie rozstrzyga, po ktorej dacie filtruje okno.'));
    console.log(D(`  Pierwsza rejestracja i ostatnia operacja sa w tym samym roku (${pierwsza ?? '?'}),`));
    console.log(D('  wiec kazde okno obejmuje albo obie, albo zadna.'));
    console.log(D('  Uruchom preflight na STARSZYM pojezdzie — takim, ktory jest w flocie od lat.'));
    console.log(D('  Dopiero wtedy bedzie wiadomo, jakie --lata ustawic na caly przebieg.\n'));
    return;
  }

  const rozOd = pierwsza - 1, rozDo = pierwsza;   // 2 lata kalendarzowe, bez roku ostatniej operacji
  console.log(B(`\n  Zapytanie rozstrzygajace — okno ${rozOd}–${rozDo}:`));
  console.log(D(`  zawiera pierwsza rejestracje (${pierwsza}), nie zawiera ostatniej operacji (${ostatnia}).`));
  const roz = await pytaj(rozOd, rozDo);
  pokaz(rozOd, rozDo, roz);

  console.log('');
  if (roz.attrs) {
    console.log(G('  WERDYKT: okno widzi date PIERWSZEJ REJESTRACJI.'));
    console.log(D('  Przebieg musi siegnac wstecz do rocznika najstarszego pojazdu floty.'));
    console.log(D('  Kazde 2 lata zakresu to jedno dodatkowe okno NA KAZDY pojazd — patrz budzet,'));
    console.log(D('  ktory narzedzie wypisuje przed startem. Zacznij od malego --limit.\n'));
  } else {
    console.log(G('  WERDYKT: okno NIE widzi daty pierwszej rejestracji.'));
    console.log(D(`  Trafienie bierze sie z daty ostatniej operacji (${ostatnia}), wiec swieze okno`));
    console.log(D('  wystarczy dla kazdego pojazdu z niedawna zmiana w rejestrze — a to jest tanie:'));
    console.log(D('  jedno okno na pojazd. Domyslne --lata 2 jest wlasciwe.\n'));
  }
  console.log(D('  Caly przebieg (zacznij od --limit 20, zobacz budzet zadan):'));
  console.log(D('    node tools/cepik-batch.js <zrodlo.json> --wyjscie <cepik.json> --limit 20\n'));
}

// `else`, nie `return` — top-level `return` jest legalny w CommonJS, ale eslint parsuje
// plik jako skrypt i zglasza blad. Bramka `npm run lint` ma zostac zielona.
if (SPRAWDZ) {
  preflight(SPRAWDZ).catch(e => { console.error(R(`\n  ${e.message}\n`)); process.exitCode = 1; });
} else (async () => {
  let zrodlo = JSON.parse(fs.readFileSync(wejscie, 'utf8'));
  if (!Array.isArray(zrodlo)) zrodlo = zrodlo.rekordy || zrodlo.pojazdy || zrodlo.data || [];
  const numery = [...new Set(zrodlo.map(r => String(r?.nrRej ?? '').toUpperCase().replace(/[\s-]/g, '')).filter(Boolean))];
  const doPobrania = LIMIT ? numery.slice(0, LIMIT) : numery;

  // BUDZET ZADAN, JAWNIE. Liczba pojazdow nie jest juz liczba zadan: limit dwuletniego
  // okna w CEPiK sprawia, ze kazdy pojazd kosztuje ceil(lat/2) zapytan, a `--fallback-woj`
  // mnozy to razy szesnascie. Bez tego rachunku przed oczami latwo uruchomic przebieg na
  // kilkanascie tysiecy zadan przeciwko darmowemu API panstwowemu — juz raz to zrobilismy.
  const oknaNaPojazd = okna(new Date().getFullYear(), ZAKRES_LAT).length;
  const mnoznikWoj = FALLBACK_WOJ ? ALL_WOJ.length : 1;
  const maxZadan = doPobrania.length * oknaNaPojazd * mnoznikWoj;
  const minut = Math.ceil(maxZadan * ODSTEP / 60000);

  console.log(B(`\n  CEPiK — pobieranie danych DR dla ${doPobrania.length} pojazdow\n`));
  console.log(D(`  zakres ${ZAKRES_LAT} lat = ${oknaNaPojazd} okien po <=2 lata na pojazd` +
    (FALLBACK_WOJ ? `, x${mnoznikWoj} wojewodztw (--fallback-woj)` : '')));
  console.log(D(`  odstep ${ODSTEP} ms; NAJWYZEJ ${maxZadan} zadan, czyli do ~${minut} min`));
  if (maxZadan > 3000) {
    console.log(Y(`\n  To duzo jak na publiczne API. Rozwaz mniejszy --lata albo przebieg na raty.`));
  }
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
  const powody = {};

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
    else { bledy++; powody[r.blad] = (powody[r.blad] || 0) + 1; }

    if (i % 10 === 0 || i === doPobrania.length) {
      fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
      if (process.stderr.isTTY) {
        process.stderr.write(`\r  ${i}/${doPobrania.length}  znalezione ${znalezione}  bez wyniku ${puste}  bledy ${bledy}   `);
      }
    }
    // Bez odstepu w TEJ petli. `zadanieZOdstepem` spi po KAZDYM zadaniu, wiec drugi
    // odstep tutaj podwajalby tempo i `--odstep 900` znaczyloby w praktyce 1800 ms.
    // Flaga ma znaczyc to, co mowi: jedno zadanie na ODSTEP.
  }
  fs.writeFileSync(cel, JSON.stringify(wynik, null, 2), 'utf8');
  if (process.stderr.isTTY) process.stderr.write('\r' + ' '.repeat(72) + '\r');

  // Powody niepowodzen ZANIM pokazemy pokrycie. Tabela samych zer nic nie mowi;
  // komunikat serwera mowi wszystko — a CEPiK zwraca bardzo dobre komunikaty.
  if (Object.keys(powody).length) {
    console.log(B('\n  Dlaczego sie nie udalo:\n'));
    for (const [p, n] of Object.entries(powody).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`   ${String(n).padStart(4)}×  ${p}`);
    }
  }

  if (!wynik.length) {
    console.log(R('\n  ZERO rekordow — pokrycie pol nie ma tu czego pokazac.'));
    console.log(D('  Sprawdz komunikaty wyzej. Najczestsze przyczyny:'));
    console.log(D('    • HTTP 429 — zwieksz --odstep (domyslnie 900 ms)'));
    console.log(D('    • zly zakres dat — sprobuj --lata 5'));
    console.log(D('    • pojazd zarejestrowany w innym wojewodztwie — --fallback-woj'));
    console.log(D('  Zacznij od jednego pojazdu:  node tools/cepik-probe.js <NR-REJ> <KOD-WOJ>\n'));
    return;
  }

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
