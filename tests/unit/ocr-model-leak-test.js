#!/usr/bin/env node
/**
 * Bramka: identyfikator modelu AI nie może wejść do pola pojazdu.
 *
 * DLACZEGO. Pojazd WE129YG (Isuzu D-Max) miał w polu „model" wartość
 * `qwen/qwen3.6-27b`. W checkpointcie ekstrakcji DR takich rekordów jest
 * 109 z 1318 — 8% zbioru. Dominująca wartość to `cf-workers-ai-llama-3.2-11b`,
 * czyli DOSŁOWNIE literał, który `worker/index.js` składa przy odpowiedzi
 * z warstwy CF. Model językowy nie zna tego napisu, więc to nie halucynacja,
 * tylko wyciek koperty odpowiedzi (`{ok, fields, model}`) do pól pojazdu.
 *
 * Awaria jest CICHA i wygląda wiarygodnie: rekord WE129YG miał poprawny VIN,
 * homologację i masy (1835 + 1160 ≈ 3000), więc nic nie sygnalizowało błędu
 * poza samą wartością pola.
 *
 * Ta bramka pilnuje dwóch rzeczy naraz, bo wzorzec ma dwa sposoby zawodzenia:
 *   [1] za wąski  — przestaje łapać identyfikatory modeli;
 *   [2] za szeroki — zaczyna kasować pola urzędowe. Ta strona jest groźniejsza:
 *       kuszący wzorzec „vendor/model" (`^[\w.-]+\/[\w.-]+$`) skasowałby numer
 *       homologacji `e4*2007/46*0413*14` i D.2 w postaci `ATFS-87C/1`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nWyciek identyfikatora modelu AI do pól pojazdu\n');

const m = src.match(/const _WZORZEC_MODELU_AI = (\/.*\/i);/);
ok(!!m, m ? 'znaleziono _WZORZEC_MODELU_AI w worker/index.js'
          : 'BRAK _WZORZEC_MODELU_AI — bramka OCR zniknęła z Workera');
if (!m) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }

let RE;
try { RE = eval(m[1]); } catch { RE = null; }
ok(RE instanceof RegExp, RE ? 'wzorzec jest poprawnym wyrażeniem regularnym' : 'wzorzec nie kompiluje się');
if (!RE) { console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`); process.exit(1); }

// [1] Musi łapać identyfikatory, które REALNIE wystąpiły w naszych danych,
//     plus kilka z rodzin, których dziś nie używamy, ale możemy jutro.
const MODELE = [
  'cf-workers-ai-llama-3.2-11b',   // ← 106 z 109 zanieczyszczonych rekordów
  'qwen/qwen3.6-27b',              // ← WE129YG
  'qwen/qwen3.6-27b-text',
  '@cf/meta/llama-3.2-11b-vision-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'mistral-large-latest',
  'deepseek-chat',
];
const nieZlapane = MODELE.filter(x => !RE.test(x));
ok(nieZlapane.length === 0,
  nieZlapane.length ? `wzorzec NIE łapie: ${nieZlapane.join(', ')}`
                    : `${MODELE.length} identyfikatorów modeli rozpoznanych`);

// [2] I NIE MOŻE kasować wartości urzędowych. Wszystkie poniżej pochodzą
//     z realnych rekordów DR — nie są wymyślone na potrzeby testu.
const URZEDOWE = [
  'e4*2007/46*0413*14',        // K — numer homologacji, zawiera „2007/46"
  'e24*2007/46*0390*10',
  '2007/46',                   // sam fragment dyrektywy
  'ATFS -87C',                 // D.2 — typ/wariant/wersja
  'SZN1E',
  'N1G',                       // J — kategoria homologacyjna
  'MPATFS87JKT001530',         // E — VIN
  'Sprinter 3,5T 2.2 CDI',     // D.3 — model handlowy
  'Atego 2-G',
  'TGL 8.190-M',
  'GUN126L (EU N)',
  'Proace MAX',
  'Amarok II 3.0 TDI',
  'ML75E16',
  'Daily 35C14',
  'Outlander MAX 6x6 XU+1000T',
];
const skasowane = URZEDOWE.filter(x => RE.test(x));
ok(skasowane.length === 0,
  skasowane.length ? `wzorzec ZA SZEROKI — kasuje pola urzędowe: ${skasowane.join(', ')}`
                   : `${URZEDOWE.length} wartości urzędowych przechodzi nietkniętych`);

// [3] Bramka musi być WYWOŁANA, nie tylko zadeklarowana. Sama stała nic nie robi.
const uzyta = /_WZORZEC_MODELU_AI\.test\(/.test(src);
ok(uzyta, uzyta ? 'wzorzec jest faktycznie używany (.test(...))'
                : 'wzorzec zadeklarowany, ale NIGDZIE NIE UŻYTY — nic nie filtruje');

// [4] I musi stać w _sanitizeOcrFields — jedynym wąskim gardle wszystkich
//     warstw kaskady OCR. W pojedynczym handlerze ominęłyby ją pozostałe.
const wSanitize = /function _sanitizeOcrFields\([\s\S]{0,900}?_WZORZEC_MODELU_AI/.test(src);
ok(wSanitize, wSanitize ? 'bramka stoi w _sanitizeOcrFields (wspólne wąskie gardło)'
                        : 'bramki NIE MA w _sanitizeOcrFields — część warstw kaskady ją ominie');

// ── Druga klasa zanieczyszczenia: model przepisał OPIS POLA z promptu ────────
//
// W raporcie DR znalezione trzy: paliwo = „P.3 — D lub B lub G", nrHomolog =
// „K — nr homologacji np e32*IV18/858*NI15391", model = „D.3 — model np ACTROS
// lub SPRINTER". Prompt wysyła `JSON.stringify(DR_POLA_OCR)`, więc opis stoi
// modelowi przed oczami.
console.log('\nEcho opisu pola z promptu\n');

const mFn = src.match(/function _echoOpisuPola[\s\S]*?\n}/);
const mPola = src.match(/const DR_POLA_OCR = \{[\s\S]*?\n\};/);
ok(!!mFn && !!mPola, mFn && mPola ? 'znaleziono _echoOpisuPola i DR_POLA_OCR'
                                  : 'BRAK _echoOpisuPola albo DR_POLA_OCR w Workerze');
if (mFn && mPola) {
  const { DR_POLA_OCR, _echoOpisuPola } =
    new Function(`${mPola[0]}\n${mFn[0]}\nreturn { DR_POLA_OCR, _echoOpisuPola };`)();

  // Każde pole musi odrzucać własny opis — inaczej bramka nie działa dla
  // tego pola i nikt się o tym nie dowie.
  const nieOdrzucone = Object.entries(DR_POLA_OCR)
    .filter(([k, opis]) => !_echoOpisuPola(opis, opis)).map(([k]) => k);
  ok(nieOdrzucone.length === 0,
    nieOdrzucone.length ? `pola, których własny opis przechodzi: ${nieOdrzucone.join(', ')}`
                        : `wszystkie ${Object.keys(DR_POLA_OCR).length} pól odrzuca własny opis`);

  // ⚠️ TA ASERCJA JEST NAJWAŻNIEJSZA W PLIKU. Opisy pól Z ZAŁOŻENIA wymieniają
  // poprawne odpowiedzi — `zawieszenie` podaje „pneumatyczne", `przeznaczenie`
  // podaje „SAMOCHOD CIEZAROWY", a `vin` i `nrHomolog` niosą przykłady, które
  // realny pojazd może mieć naprawdę. Wersja reguły oparta na „wartość ZAWIERA
  // SIĘ w opisie" kasowała cztery z tych wartości. Jeśli ta asercja zacznie
  // padać, ktoś właśnie tak regułę „uogólnił".
  const POPRAWNE = [
    ['paliwo', 'D'], ['paliwo', 'B'], ['paliwo', 'G'], ['paliwo', 'ON'],
    ['model', 'ACTROS'], ['model', 'SPRINTER'], ['model', 'Sprinter 3,5T 2.2 CDI'],
    ['marka', 'MAN'], ['marka', 'SCANIA'],
    ['kategoria', 'N1'], ['kategoria', 'N1G'], ['kategoria', 'M1'],
    ['nrHomolog', 'e32*IV18/858*NI15391'],   // ← DOSŁOWNIE przykład z promptu
    ['nrHomolog', 'e4*2007/46*0413*14'],
    ['vin', 'WMA29VUZ7R9018317'],            // ← DOSŁOWNIE przykład z promptu
    ['typ', 'TGE140'], ['typ', 'R490'],
    ['przeznaczenie', 'SAMOCHOD CIEZAROWY'], // ← wymienione w opisie pola
    ['przeznaczenie', 'SAMOCHOD SPECJALNY'],
    ['zawieszenie', 'pneumatyczne'],         // ← wymienione w opisie pola
    ['zawieszenie', 'rownowazne pneumatycznemu'], ['zawieszenie', 'inne'],
    ['normaEuro', 'EURO 6'], ['normaEuro', 'EURO VI'],
    ['rokProd', '2019'], ['dataRej', '23.01.2020'], ['liczbaOsi', '2'],
  ];
  const skasowaneOk = POPRAWNE.filter(([k, v]) => _echoOpisuPola(v, DR_POLA_OCR[k]))
    .map(([k, v]) => `${k}="${v}"`);
  ok(skasowaneOk.length === 0,
    skasowaneOk.length ? `reguła ZA SZEROKA — kasuje poprawne odczyty: ${skasowaneOk.join(', ')}`
                       : `${POPRAWNE.length} poprawnych odczytów przechodzi nietkniętych`);

  // I musi być faktycznie wywołana w _sanitizeOcrFields.
  const woh = /function _sanitizeOcrFields[\s\S]{0,1600}?_echoOpisuPola\(/.test(src);
  ok(woh, woh ? '_echoOpisuPola wywoływane w _sanitizeOcrFields'
              : '_echoOpisuPola zadeklarowane, ale nieużywane w _sanitizeOcrFields');
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
