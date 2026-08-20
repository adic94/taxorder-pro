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
const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const nr  = process.argv[2] || '';
const woj = process.argv[3] || '14';
const rok = new Date().getFullYear() - 1;

// Pola, na których nam zależy — pogrupowane wg tego, co z nimi zrobimy.
const SZUKANE = {
  'DT-1 — krytyczne': [/^liczba-osi/i, /osi/i, /zawiesz/i, /pneumat/i],
  'DT-1 — masy':      [/masa/i, /dopuszczalna/i, /^dmc/i],
  'identyfikacja':    [/^vin/i, /rejestracyj/i, /^marka/i, /^model/i, /^rok/i, /kategoria/i],
};

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

  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } });
  } catch (e) {
    console.log(R(`  Brak połączenia: ${e.message}`));
    console.log(D('  Jeśli to sieć firmowa albo proxy — spróbuj z innej.\n'));
    process.exitCode = 2; return;
  }

  const tresc = await r.text();
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
  if (!r.ok) {
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
