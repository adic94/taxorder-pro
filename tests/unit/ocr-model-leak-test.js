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

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
