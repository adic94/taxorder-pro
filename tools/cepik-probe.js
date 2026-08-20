#!/usr/bin/env node
/**
 * Sonda CEPiK: czy API wymaga autoryzacji i JAKIE POLA zwraca.
 *
 *     node tools/cepik-probe.js                 # dowolny pojazd z woj. mazowieckiego
 *     node tools/cepik-probe.js WGM8172K 14     # konkretny numer i województwo
 *
 * PO CO. `POST /api/cepik/token` zwraca 503 „CEPiK nie jest skonfigurowany" — sekrety
 * CEPIK_KEY/CEPIK_SECRET nigdy nie zostały ustawione na Workerze. Zanim ktokolwiek
 * wystąpi o poświadczenia, trzeba odpowiedzieć na dwa pytania, i oba tanio:
 *
 *   1. Czy `api.cepik.gov.pl/pojazdy` w ogóle wymaga tokenu? To API OTWARTYCH DANYCH.
 *      Jeśli działa bez autoryzacji, cały mechanizm tokenu jest w tej ścieżce zbędny
 *      i naprawa jest w kodzie, nie we wniosku o dostęp.
 *   2. Czy zwraca pola potrzebne do DT-1 — LICZBĘ OSI i RODZAJ ZAWIESZENIA?
 *      `_qavParseCepik` w app.js wyciąga dziś markę, model, VIN, rok, DMC, paliwo
 *      i kategorię. Osi i zawieszenia NIE wyciąga — i nie wiadomo, czy dlatego, że ich
 *      nie ma, czy dlatego, że nikt ich nie zmapował. Zapytanie idzie z
 *      `pokaz-wszystkie-pola=true`, więc lista pól rozstrzyga to jednoznacznie.
 *
 * DLACZEGO NIE Z KONSOLI PRZEGLĄDARKI. CSP aplikacji ma `connect-src` bez
 * `api.cepik.gov.pl`, więc przeglądarka zablokuje żądanie zanim wyjdzie. Node nie
 * podlega CSP.
 *
 * Nie wypisuje danych osobowych pojazdu — wyłącznie NAZWY pól i garść wartości
 * technicznych (masy, osie), które danymi osobowymi nie są.
 */
const https = require('node:https');

/**
 * Żądanie HTTPS z kontrolą uzgadniania TLS.
 *
 * `fetch` nie pozwala ustawić parametrów TLS, a serwery administracji publicznej bywają
 * skonfigurowane na wysłużonych zestawach szyfrów. CEPiK oferuje klucz Diffie-Hellmana
 * słabszy niż minimum Node'a (`ERR_SSL_DH_KEY_TOO_SMALL`) — połączenie nie dochodzi
 * do skutku, choć DNS i port 443 działają.
 */
function zadanieHttps(url, opcjeTls = {}) {
  return new Promise((res, rej) => {
    const req = https.get(url, { headers: { Accept: 'application/vnd.api+json' }, ...opcjeTls }, (r) => {
      let buf = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { buf += c; });
      r.on('end', () => res({ status: r.statusCode, tresc: buf }));
    });
    req.on('error', rej);
    req.setTimeout(25000, () => { req.destroy(new Error('ETIMEDOUT')); });
  });
}

// Zestaw wymuszający ECDHE — wymianę klucza na krzywych eliptycznych. Omija słaby parametr
// DH CAŁKOWICIE, zamiast go tolerować, więc uzgadnianie zostaje mocne. Serwer obsługujący
// ECDHE (praktycznie każdy z ostatniej dekady) połączy się tą drogą bez żadnego ustępstwa.
const SZYFRY_ECDHE = [
  'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES256-SHA384', 'ECDHE-RSA-AES128-SHA256',
].join(':');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

/**
 * `--slaby-tls` — OSTATECZNOŚĆ, świadomie NIEDOMYŚLNA.
 *
 * Obniża poziom bezpieczeństwa OpenSSL, żeby zaakceptować słaby parametr Diffie-Hellmana,
 * zamiast go omijać przez ECDHE. Wtedy uzgadnianie jest podatne na atak pośrednika:
 * ktoś w drodze mógłby PODMIENIĆ ODPOWIEDŹ, a odpowiedź to dane pojazdu, które trafiają
 * do deklaracji podatkowej.
 *
 * Dla samego rozpoznania NAZW PÓL ryzyko jest znikome — nie wysyłamy poświadczeń, a wynik
 * i tak weryfikuje człowiek. Do POBIERANIA DANYCH tą drogą nie należy tego używać.
 * Dlatego flaga jest jawna: narzędzie mówi, że opcja istnieje i ile kosztuje, ale decyzji
 * nie podejmuje za człowieka.
 */
const SLABY_TLS = process.argv.includes('--slaby-tls');
// `slice(2)` JEST KONIECZNE: argv[0] to sciezka node'a, argv[1] to sciezka skryptu.
// Przy dodawaniu --slaby-tls zamienilem process.argv[2] na filter(...)[0] i zgubilem
// slice — przez co sciezka skryptu poszla do CEPiK jako kod wojewodztwa, a serwer
// odpowiedzial HTTP 400. Blad byl widoczny dopiero w URL-u, nie w kodzie.
const wolne = process.argv.slice(2).filter(a => !a.startsWith('--'));
const nr  = wolne[0] || '';
const woj = wolne[1] || '14';
const rok = new Date().getFullYear() - 1;

// Pola, na których nam zależy — pogrupowane wg tego, co z nimi zrobimy.
const SZUKANE = {
  'DT-1 — krytyczne': [/^liczba-osi/i, /osi/i, /zawiesz/i, /pneumat/i],
  'DT-1 — masy':      [/masa/i, /dopuszczalna/i, /^dmc/i],
  'identyfikacja':    [/^vin/i, /rejestracyj/i, /^marka/i, /^model/i, /^rok/i, /kategoria/i],
};

// Walidacja PRZED wyslaniem. Bledny argument ma sie zatrzymac tutaj, z czytelnym
// komunikatem, a nie wrocic jako HTTP 400 z serwera — tam wyglada na awarie API.
if (!/^\d{2}$/.test(woj)) {
  console.error(R(`\n  Kod wojewodztwa musi byc dwucyfrowy, dostalem: "${woj}"`));
  console.error(D('  Mazowieckie = 14. Pelna lista kodow w app.js (ALL_WOJ_CODES).\n'));
  process.exit(2);
}
if (nr && !/^[A-Za-z0-9]{3,10}$/.test(nr.replace(/\s/g, ''))) {
  console.error(R(`\n  To nie wyglada na numer rejestracyjny: "${nr}"`));
  console.error(D('  Uzycie: node tools/cepik-probe.js [NR-REJ] [KOD-WOJ] [--slaby-tls]\n'));
  process.exit(2);
}

const url = new URL('https://api.cepik.gov.pl/pojazdy');
url.searchParams.set('wojewodztwo', woj);
url.searchParams.set('data-od', `${rok}0101`);
url.searchParams.set('data-do', `${rok}1231`);
url.searchParams.set('limit', '1');
url.searchParams.set('pokaz-wszystkie-pola', 'true');
if (nr) url.searchParams.set('numer-rejestracyjny', nr);

(async () => {
  console.log(B('\n  Sonda CEPiK — autoryzacja i dostępne pola\n'));
  console.log(D(`  ${url.toString().replace(/numer-rejestracyjny=[^&]*/, 'numer-rejestracyjny=***')}\n`));

  let r, sciezka = 'domyślna';
  try {
    r = await zadanieHttps(url);
  } catch (e0) {
    // Błąd uzgadniania TLS — jedyny rodzaj, przy którym ponawianie ma sens.
    //
    // SPRAWDZAMY KOD *ORAZ* TREŚĆ. `https.get` zgłasza słaby parametr DH jako `EPROTO`,
    // a konkret („dh key too small") siedzi dopiero w komunikacie. Pierwsza wersja tego
    // warunku patrzyła wyłącznie na kod i przez to NIE PONAWIAŁA — u użytkownika sonda
    // poddawała się na `EPROTO`, mimo że miała dokładnie na taki przypadek obejście.
    const err0 = e0.cause || e0;
    const kod0 = err0.code || e0.code || '';
    const opis0 = `${kod0} ${err0.message || ''} ${e0.message || ''}`;
    const doPonowienia = /EPROTO|ERR_SSL|DH_KEY_TOO_SMALL|dh key too small|SSLV3_ALERT|WRONG_VERSION|UNSUPPORTED_PROTOCOL|HANDSHAKE/i;
    if (!doPonowienia.test(opis0)) {
      var e = e0; r = null;
    } else {
      console.log(Y(`  Serwer nie uzgodnił połączenia domyślnymi ustawieniami (${kod0 || 'błąd TLS'}).`));
      console.log(D('  Ponawiam z wymuszonym ECDHE — omija słaby parametr DH, nie osłabia szyfrowania.\n'));
      try { r = await zadanieHttps(url, { ciphers: SZYFRY_ECDHE }); sciezka = 'ECDHE'; }
      catch (e1) {
        if (SLABY_TLS) {
          console.log(R('  ECDHE też nie przeszło. Ponawiam z OBNIŻONYM poziomem bezpieczeństwa'));
          console.log(R('  (--slaby-tls) — uzgadnianie podatne na podmianę odpowiedzi.\n'));
          try { r = await zadanieHttps(url, { ciphers: 'DEFAULT@SECLEVEL=0', minDHSize: 512 }); sciezka = 'SECLEVEL=0'; }
          catch (e2) { var e = e2; r = null; }
        } else { var e = e1; r = null; }
      }
    }
  }
  if (!r) {
    // `fetch failed` to opakowanie Node'a — prawdziwa przyczyna siedzi w `cause`
    // i bez niej komunikat nie niesie żadnej informacji diagnostycznej.
    // `fetch` opakowuje blad w `cause`, `https.get` rzuca go wprost. Po przejsciu na
    // https odczyt wylacznie z `cause` chybial i gubil podpowiedz — sprawdzamy oba miejsca.
    const c = e.cause || {};
    const kod = e.code || c.code || c.errno || e.errno || '';
    console.log(R(`  Brak połączenia: ${kod || e.message}`));
    if (c.message && c.message !== e.message) console.log(D(`     ${c.message}`));

    const PODPOWIEDZI = {
      ENOTFOUND:    'Nazwa nie rozwiązuje się w DNS. Serwer DNS w sieci firmowej może blokować domeny .gov.pl.',
      EAI_AGAIN:    'Chwilowa awaria DNS albo brak dostępu do serwera nazw.',
      ECONNREFUSED: 'Host odpowiada, ale odrzuca połączenie na tym porcie.',
      ECONNRESET:   'Połączenie zerwane w trakcie — typowe dla firewalla inspekcjonującego ruch TLS.',
      ETIMEDOUT:    'Brak odpowiedzi. Ruch prawdopodobnie odcięty po cichu.',
      CERT_HAS_EXPIRED: 'Certyfikat wygasł albo firewall podstawia własny.',
      UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Łańcuch certyfikatów nie do zweryfikowania — zwykle firewall z własnym CA.',
      DEPTH_ZERO_SELF_SIGNED_CERT: 'Certyfikat samopodpisany — ruch przechodzi przez proxy inspekcjonujące TLS.',
      EPROTO: 'Błąd protokołu TLS. Serwer i klient nie dogadali się co do wersji albo zestawu szyfrów.',
    };
    if (PODPOWIEDZI[kod]) console.log(Y(`     ${PODPOWIEDZI[kod]}`));

    console.log(D('\n  Sprawdź po kolei — pierwsze, które zadziała, wskaże warstwę problemu:'));
    console.log(D('     Resolve-DnsName api.cepik.gov.pl'));
    console.log(D('     Test-NetConnection api.cepik.gov.pl -Port 443'));
    console.log(D('     curl.exe -sI "https://api.cepik.gov.pl/pojazdy?wojewodztwo=14&limit=1"'));
    console.log(D('\n  Jeśli DNS nie rozwiązuje albo port 443 jest zamknięty — to sieć, nie API.'));
    console.log(D('  Spróbuj z innej sieci (np. hotspot z telefonu), żeby to rozstrzygnąć.'));
    if (/EPROTO|SSL|TLS|HANDSHAKE|DH/i.test(`${kod} ${c.message || ''} ${e.message || ''}`) && !SLABY_TLS) {
      console.log(Y('\n  To jest błąd UZGADNIANIA TLS, nie sieci — DNS i port 443 działają.'));
      console.log(Y('  Ostateczność, jeśli ECDHE nie wystarczyło:'));
      console.log(`      ${B('node tools/cepik-probe.js --slaby-tls')}`);
      console.log(D('  Obniża poziom bezpieczeństwa, żeby zaakceptować słaby parametr serwera.'));
      console.log(D('  Do rozpoznania NAZW PÓL to akceptowalne; do pobierania danych — nie.'));
    }
    console.log('');
    process.exitCode = 2; return;
  }

  if (sciezka !== 'domyślna') console.log(D(`  (połączono ścieżką ${sciezka})\n`));
  const tresc = r.tresc;
  let dane = null;
  try { dane = JSON.parse(tresc); } catch { /* nie-JSON — obsłużone niżej */ }

  // ── Pytanie 0: czy to w ogóle odpowiedź CEPiK ─────────────────────────────
  //
  // KOLEJNOŚĆ MA ZNACZENIE. Proxy firmowe i firewalle oddają własne 401/403 z treścią,
  // która nie jest JSON-em API. Sprawdzenie autoryzacji PRZED tym testem daje werdykt
  // „wymaga autoryzacji" tam, gdzie żądanie w ogóle nie dotarło do CEPiK — i wysyła
  // człowieka po poświadczenia, których nie potrzebuje.
  //
  // Ten błąd wystąpił przy pierwszym uruchomieniu tego pliku: kontener oddał
  // `403 Host not in allowlist`, a sonda uznała to za wymóg autoryzacji CEPiK.
  // Ta sama pomyłka co w cf-ocr-test.js — tam już naprawiona, tu powtórzona.
  const wygladaNaCepik = dane !== null || /^\s*[{[]/.test(tresc);
  if (!wygladaNaCepik) {
    console.log(R(`  Odpowiedź NIE pochodzi z API CEPiK (HTTP ${r.status}).`));
    console.log(D(`     ${tresc.slice(0, 160).replace(/\s+/g, ' ')}`));
    console.log(Y('\n  To nie jest informacja o autoryzacji ani o polach — żądanie nie dotarło'));
    console.log(Y('  do CEPiK. Coś przechwytuje ruch (proxy, firewall, sieć firmowa).'));
    console.log(Y('  Z tego przebiegu NIE DA SIĘ wyciągnąć żadnego wniosku.\n'));
    process.exitCode = 2; return;
  }

  // ── Pytanie 1: autoryzacja ────────────────────────────────────────────────
  if (r.status === 401 || r.status === 403) {
    console.log(Y(`  WYMAGA AUTORYZACJI (HTTP ${r.status}).`));
    console.log(D('  Trzeba wystąpić o poświadczenia i ustawić je jako sekrety Workera:'));
    console.log(D('    wrangler secret put CEPIK_KEY'));
    console.log(D('    wrangler secret put CEPIK_SECRET'));
    console.log(D(`\n  Odpowiedź serwera: ${tresc.slice(0, 200)}\n`));
    process.exitCode = 1; return;
  }
  // `r.status`, NIE `r.ok`. `.ok` istnieje wylacznie w odpowiedzi `fetch`; po przejsciu
  // na `https.get` obiekt go NIE MA, wiec `!r.ok` bylo ZAWSZE prawdziwe i sonda wchodzila
  // w galaz bledu nawet przy HTTP 200 — wypisujac surowa odpowiedz zamiast analizy pol.
  // Czwarty blad tej samej klasy w tej sesji: zmiana ksztaltu obiektu psuje zalozenie
  // w innym miejscu. Po kazdej takiej zmianie trzeba przejsc WSZYSTKIE odwolania.
  if (r.status < 200 || r.status >= 300) {
    console.log(R(`  HTTP ${r.status}`));
    console.log(D(`  ${tresc.slice(0, 300)}\n`));
    process.exitCode = 1; return;
  }
  if (!dane) {
    console.log(R('  HTTP 200, ale treść nie jest poprawnym JSON-em.'));
    console.log(D(`  ${tresc.slice(0, 200)}\n`));
    process.exitCode = 2; return;
  }

  console.log(G('  ✓ DZIAŁA BEZ AUTORYZACJI') + D(`  (HTTP ${r.status})`));
  console.log(D('    Mechanizm tokenu w /api/cepik/token jest dla tej ścieżki zbędny —'));
  console.log(D('    naprawa jest w kodzie, nie we wniosku o dostęp.\n'));

  // ── Pytanie 2: pola ───────────────────────────────────────────────────────
  const rekord = Array.isArray(dane?.data) ? dane.data[0] : dane?.data;
  const attrs = rekord?.attributes;
  if (!attrs) {
    console.log(Y('  Odpowiedź bez rekordów — zmień województwo albo rok.'));
    console.log(D(`  Klucze najwyższego poziomu: ${Object.keys(dane).join(', ')}\n`));
    process.exitCode = 1; return;
  }

  const pola = Object.keys(attrs).sort();
  console.log(B(`  Zwrócone pola (${pola.length}):\n`));

  const uzyte = new Set();
  for (const [grupa, wzorce] of Object.entries(SZUKANE)) {
    const trafione = pola.filter(p => wzorce.some(w => w.test(p)));
    trafione.forEach(p => uzyte.add(p));
    console.log(`  ${B(grupa)}`);
    if (!trafione.length) { console.log(R('     — brak\n')); continue; }
    for (const p of trafione) {
      const v = attrs[p];
      const pokaz = /vin|rejestracyj/i.test(p) ? D('(ukryte)')
                  : (v == null || v === '') ? D('(puste)') : String(v).slice(0, 40);
      console.log(`     ${p.padEnd(42)} ${pokaz}`);
    }
    console.log('');
  }

  const reszta = pola.filter(p => !uzyte.has(p));
  if (reszta.length) {
    console.log(D(`  Pozostałe ${reszta.length} pól:`));
    console.log(D('     ' + reszta.join(', ') + '\n'));
  }

  // ── Werdykt ───────────────────────────────────────────────────────────────
  const maOsie = pola.some(p => /osi/i.test(p));
  const maDmc  = pola.some(p => /dopuszczalna-masa|^dmc/i.test(p));
  const maZaw  = pola.some(p => /zawiesz|pneumat/i.test(p));

  console.log(B('  ' + '─'.repeat(60)));
  console.log(`\n  DMC: ${maDmc ? G('jest') : R('brak')}   ` +
              `liczba osi: ${maOsie ? G('jest') : R('brak')}   ` +
              `zawieszenie: ${maZaw ? G('jest') : R('brak')}\n`);

  if (maDmc && maOsie) {
    console.log(G('  CEPiK POKRYWA DT-1 w podstawowym zakresie.'));
    console.log(D('  Warto zbudować sterownik wsadowy po flocie — dane z rejestru zamiast'));
    console.log(D('  rozpoznawania ze skanów. `_cepikFetchOne()` w app.js ma już cache,'));
    console.log(D('  fallback po latach i po 16 województwach oraz ograniczanie tempa.\n'));
  } else if (maDmc) {
    console.log(Y('  CEPiK daje DMC, ale nie liczbę osi.'));
    console.log(D('  I tak wygrana: DMC to główny czynnik DT-1, a OCR dostarczył go dla'));
    console.log(D('  98 z 1318 pojazdów. OCR zostaje do osi i zawieszenia — ułamek pracy.\n'));
  } else {
    console.log(R('  CEPiK nie zwraca pól DT-1 tą ścieżką.'));
    console.log(D('  Zamykamy wątek i wracamy do OCR — ale wiedząc dlaczego.\n'));
  }
})();
