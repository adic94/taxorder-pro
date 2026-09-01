// Bramka: DT-1 — zapis PDF w programie + śledzenie wysyłki przez ePUAP + organ
// podatkowy dobierany wg gminy siedziby (nie hardkodowany per spółka).
//
// Sprawdza trzy rzeczy, które łatwo cicho zepsuć przy tej klasie zmian:
// 1. Migracja rzeczywiście dokłada obie kolumny (epuap_sent_at/epuap_reference).
// 2. Trasy PDF (`GET`/`POST .../pdf`) i `PUT` (ePUAP) w handlerze workera nie
//    kolidują z trasą "GET po samym id" — precedens z tego projektu (JPK,
//    dokumenty) pokazuje, że brakujący warunek `!sub` cicho przechwytuje
//    żądania do subtrasy jako zwykłe pobranie rekordu.
// 3. `GminyRates.getUrzad()` zwraca zweryfikowany adres dla Warszawy
//    niezależnie od wielkości liter, a `null` dla gminy spoza słownika —
//    brak danych ma zostać brakiem danych, nie zgadniętym adresem.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', msg); }
}

// ── [1] Migracja dokłada obie kolumny ────────────────────────────────────
const migPath = path.join(__dirname, '..', '..', 'worker', 'migration_v55_dt1_epuap.sql');
const mig = fs.readFileSync(migPath, 'utf8');
ok(/ALTER TABLE dt1_declarations ADD COLUMN epuap_sent_at/i.test(mig),
  'migracja v55 musi dodawać kolumnę epuap_sent_at');
ok(/ALTER TABLE dt1_declarations ADD COLUMN epuap_reference/i.test(mig),
  'migracja v55 musi dodawać kolumnę epuap_reference');

// ── [2] Trasy w handleDt1Declarations nie kolidują ze sobą ───────────────
const workerSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'worker', 'index.js'), 'utf8');
const startMarker = 'async function handleDt1Declarations(';
const startIdx = workerSrc.indexOf(startMarker);
ok(startIdx !== -1, 'handleDt1Declarations musi istnieć w worker/index.js');
let handlerSrc = '';
if (startIdx !== -1) {
  // Kolejna funkcja najwyższego poziomu wyznacza koniec — handler nie ma
  // zagnieżdżonych `async function` na tym poziomie wcięcia.
  const nextFn = workerSrc.indexOf('\nasync function ', startIdx + startMarker.length);
  handlerSrc = workerSrc.slice(startIdx, nextFn !== -1 ? nextFn : undefined);
}

ok(/req\.method === 'PUT' && declId && !sub/.test(handlerSrc),
  'PUT (oznaczenie ePUAP) musi wymagać braku sub — inaczej koliduje z /pdf');
ok(/req\.method === 'POST' && declId && sub === 'pdf'/.test(handlerSrc),
  'brak trasy POST .../pdf (zapis wygenerowanego PDF do R2)');
ok(/req\.method === 'GET' && declId && sub === 'pdf'/.test(handlerSrc),
  'brak trasy GET .../pdf (pobranie zapisanego PDF)');
ok(/req\.method === 'GET' && declId && !sub/.test(handlerSrc),
  'GET po samym id musi mieć warunek !sub — inaczej przechwytuje żądania do /pdf jako zwykły rekord');
ok(/epuap_sent_at.*RRRR-MM-DD|\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(handlerSrc),
  'PUT musi walidować format daty epuap_sent_at zamiast przyjmować dowolny tekst');
ok(handlerSrc.includes("`dt1/${company}/${declId}.pdf`"),
  'klucz R2 dla PDF musi być scope\'owany po company_id — bez tego to potencjalny wyciek między najemcami');

// ── [3] GminyRates.getUrzad — organ wg gminy, wielkość liter obojętna ────
const gminyPath = path.join(__dirname, '..', '..', 'modules', 'gminy-rates.js');
const gminySrc = fs.readFileSync(gminyPath, 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(gminySrc, sandbox);
const GminyRates = sandbox.window.GminyRates;
ok(!!GminyRates && typeof GminyRates.getUrzad === 'function', 'GminyRates.getUrzad musi być wyeksportowane');

if (GminyRates) {
  const adresWarszawa = GminyRates.getUrzad('Warszawa');
  ok(typeof adresWarszawa === 'string' && adresWarszawa.includes('OBOZOWA 57'),
    'adres organu dla Warszawy musi zgadzać się z wzorcową deklaracją (ul. Obozowa 57)');
  ok(GminyRates.getUrzad('WARSZAWA') === adresWarszawa,
    'wyszukiwanie musi być niewrażliwe na wielkość liter (miasto w danych firm bywa caps-lock)');
  ok(GminyRates.getUrzad('  Warszawa  ') === adresWarszawa,
    'wyszukiwanie musi tolerować białe znaki wokół nazwy gminy');
  ok(GminyRates.getUrzad('Nieznana Gmina XYZ') === null,
    'gmina spoza słownika musi dać null — brak danych, nie zgadnięty adres');
  ok(GminyRates.getUrzad('') === null && GminyRates.getUrzad(undefined) === null,
    'pusta/undefined gmina musi dać null, nie rzucać wyjątku');
}

// ── [4] app.js woła wspólną funkcję rozstrzygającą organ, nie duplikuje logiki ──
const appSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
ok(/function _dt1ResolveOrgan\(/.test(appSrc),
  'brak _dt1ResolveOrgan — organ nie powinien być duplikowany osobno w dwóch miejscach generowania DT-1');
const resolveCalls = (appSrc.match(/_dt1ResolveOrgan\(/g) || []).length;
ok(resolveCalls >= 3, // definicja + 2 wywołania (generujDt1PerFirma, generujDt1Multi)
  `_dt1ResolveOrgan powinno być użyte w OBU miejscach budujących taxpayerData (znaleziono ${resolveCalls} wystąpień)`);

console.log(`Wynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
