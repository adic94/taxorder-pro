#!/usr/bin/env node
/**
 * Strażnik: każdy skrypt ładowany z CDN ma `integrity` (SRI).
 *
 * PO CO. `index.html` ładuje dziewięć bibliotek z trzech obcych hostów (cdnjs, unpkg,
 * jsdelivr). Bez `integrity` przeglądarka wykona DOWOLNĄ treść, którą ten host odda —
 * podmieniony plik, przejęte konto pakietu, incydent u dostawcy CDN. Skrypt działa
 * w origin aplikacji, gdzie w `localStorage` leży token sesji.
 *
 * SRI to jedyne zabezpieczenie, jakie mamy na tej ścieżce: nie hostujemy tych plików
 * u siebie i nie mamy CSP, które ograniczałoby `script-src` do haszy.
 *
 * ZNANY WYJĄTEK, KTÓREGO NIE DA SIĘ ZAMKNĄĆ Z KONTENERA — patrz niżej. Lista może
 * wyłącznie MALEĆ. Dopisanie do niej czegokolwiek, żeby uciszyć test, jest tym samym
 * co usunięcie testu.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/**
 * Chart.js — jedyny skrypt bez `integrity`, stan zastany.
 *
 * Dlaczego nie naprawiony: hasz trzeba policzyć z DOKŁADNIE tego pliku, który serwuje
 * cdnjs. Z kontenera deweloperskiego `cdnjs.cloudflare.com` jest niedostępny (proxy, 403),
 * a npm dla `chart.js@4.4.1` wysyła `dist/chart.umd.js` — plik NIEMINIFIKOWANY, czyli
 * inny niż `chart.umd.min.js` z cdnjs. Hasza nie da się więc policzyć nawet pośrednio.
 *
 * Zgadnięcie hasza jest gorsze niż jego brak: przy niezgodności przeglądarka ODMAWIA
 * wykonania skryptu, więc wszystkie wykresy w aplikacji przestają działać natychmiast.
 *
 * DO ZAMKNIĘCIA na maszynie z dostępem do sieci:
 *   curl -s https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js \
 *     | openssl dgst -sha384 -binary | openssl base64 -A
 * i wkleić wynik jako integrity="sha384-<wynik>" crossorigin="anonymous".
 */
const ZNANE_BEZ_SRI = ['cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'];

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik SRI — skrypty z CDN muszą mieć integrity\n');

// Każdy <script ... src="https://..."> — bierzemy cały tag, żeby sprawdzić atrybuty.
const tagi = HTML.match(/<script\b[^>]*\bsrc="https:\/\/[^"]+"[^>]*>/g) || [];
ok(tagi.length > 0, `znaleziono skrypty z CDN (${tagi.length})`);

const bez = [];
for (const tag of tagi) {
  const url = (tag.match(/src="(https:\/\/[^"]+)"/) || [])[1];
  if (!/\bintegrity=/.test(tag)) bez.push(url.replace(/^https:\/\//, ''));
}

const nowe = bez.filter(u => !ZNANE_BEZ_SRI.includes(u));
const zamkniete = ZNANE_BEZ_SRI.filter(u => !bez.includes(u));

ok(nowe.length === 0,
  nowe.length
    ? `NOWY skrypt z CDN bez integrity: ${nowe.join(', ')} — policz hasz i dodaj, nie dopisuj do wyjątków`
    : `żaden nowy skrypt nie doszedł bez integrity (${tagi.length - bez.length}/${tagi.length} zabezpieczonych)`);

// Lista wyjątków może tylko maleć — jeśli ktoś zamknął lukę, ma ją usunąć z listy,
// żeby wyjątek nie został na zawsze.
ok(zamkniete.length === 0,
  zamkniete.length
    ? `${zamkniete.join(', ')} ma już integrity — USUŃ z ZNANE_BEZ_SRI w tym pliku`
    : 'lista znanych wyjątków zgodna ze stanem faktycznym');

// `crossorigin` jest wymagany, żeby SRI w ogóle zadziałało dla zasobów z obcego origin.
const zSriBezCors = tagi.filter(t => /\bintegrity=/.test(t) && !/\bcrossorigin=/.test(t));
ok(zSriBezCors.length === 0,
  zSriBezCors.length
    ? `${zSriBezCors.length} skrypt(ów) ma integrity BEZ crossorigin — SRI wtedy nie działa`
    : 'każdy skrypt z integrity ma też crossorigin (bez tego SRI jest bezużyteczne)');

if (bez.length) {
  console.log(`\n  Otwarta luka (${bez.length}): ${bez.join(', ')}`);
  console.log('  Komentarz przy ZNANE_BEZ_SRI zawiera polecenie do policzenia hasza.');
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
