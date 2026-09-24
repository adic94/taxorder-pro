#!/usr/bin/env node
/**
 * Bramka: skrzynka dokumentów (modules/bulk-import.js) nie wysyła surowych PDF-ów
 * do API wizyjnego, nie zapisuje bez zatwierdzenia człowieka, i karmi eksport DR
 * (modules/dr-export.js) śladem źródeł.
 *
 * DLACZEGO. Przed tą zmianą `_apiClassify(item.file)`/`_apiExtract(item.file, ...)`
 * base64-owały SUROWY plik — dla PDF-a to strumień PDF z `mimeType:'application/pdf'`,
 * wysyłany do modelu WIZYJNEGO, który oczekuje obrazu (worker/index.js:13444/13476,
 * `_bulkGroqVision`). Większość realnych dokumentów flotowych to skany PDF, więc
 * AI OCR w skrzynce był dla nich cichym zgadywaniem/błędem, nie ekstrakcją.
 * Drugi problem: "Zapisz dopasowane" zapisywało WSZYSTKO ze statusem "matched" —
 * w tym dopasowania z niskopewnego AI OCR — bez pokazania człowiekowi, co dokładnie
 * poleci do bazy.
 *
 * Test jest statyczny (czyta źródło) — nie wymaga przeglądarki ani AI.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'modules', 'bulk-import.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nSkrzynka dokumentów — render PDF, bramka zatwierdzenia, ślad źródeł DR\n');

// [1] Renderowanie PDF do obrazu PRZED wysłaniem do API wizyjnego.
const maRenderPdf = /function _pdfPageBlob\(/.test(src) && /function _fileForApi\(/.test(src);
ok(maRenderPdf, maRenderPdf ? 'istnieją _pdfPageBlob i _fileForApi (render PDF→obraz)'
                              : 'BRAK renderu PDF — sprawdź, czy ktoś nie usunął _fileForApi/_pdfPageBlob');

// [2] Stary wzorzec (surowy plik prosto do _apiClassify/_apiExtract) NIE MOŻE wrócić.
const staryWzorzecClassify = /_apiClassify\(item\.file\)/.test(src);
const staryWzorzecExtract  = /_apiExtract\(item\.file,/.test(src);
ok(!staryWzorzecClassify && !staryWzorzecExtract,
  (!staryWzorzecClassify && !staryWzorzecExtract)
    ? '_processItem nie wywołuje już _apiClassify/_apiExtract z surowym item.file'
    : 'REGRESJA: _processItem znów woła _apiClassify/_apiExtract(item.file) — PDF-y znów pójdą jako surowe bajty');

// [3] _apiClassify/_apiExtract przyjmują (blob, mimeType, …) — obraz, nie plik wprost.
const classifySig = /async function _apiClassify\(blob, mimeType/.test(src);
const extractSig  = /async function _apiExtract\(blob, mimeType/.test(src);
ok(classifySig && extractSig, (classifySig && extractSig)
  ? '_apiClassify/_apiExtract mają sygnaturę (blob, mimeType, …)'
  : 'sygnatura _apiClassify/_apiExtract się zmieniła — sprawdź zgodność z _fileForApi');

// [4] Wielostronicowy PDF: próba ostatniej strony, gdy strona 1 nic nie dała.
const probaOstatniejStrony = /_pdfPageCount\(item\.file\)/.test(src) && /_fileForApi\(item\.file, strony\)/.test(src);
ok(probaOstatniejStrony, probaOstatniejStrony
  ? 'przy braku dopasowania na stronie 1 próbuje ostatniej strony PDF-a'
  : 'BRAK próby kolejnej strony — wielostronicowe PDF-y z danymi poza stroną 1 nie zostaną rozpoznane');

// [5] Twarda bramka preview/approve przed zapisem.
const maModalZatwierdzenia = /bi-confirm-modal/.test(src);
const maDoSaveAll = /async function _doSaveAll\(\)/.test(src);
const przyciskWolaSaveAll = /onclick="BulkImport\._saveAll\(\)"/.test(src);
ok(maModalZatwierdzenia && maDoSaveAll, (maModalZatwierdzenia && maDoSaveAll)
  ? '_saveAll pokazuje modal potwierdzenia (bi-confirm-modal), właściwy zapis jest w _doSaveAll'
  : 'REGRESJA: brak modalu zatwierdzenia — "Zapisz dopasowane" znów zapisze bez pytania');
ok(przyciskWolaSaveAll, przyciskWolaSaveAll
  ? 'przycisk "Zapisz dopasowane" w UI woła _saveAll (bramkę), nie _doSaveAll bezpośrednio'
  : 'przycisk UI omija bramkę zatwierdzenia i woła zapis wprost');

// _doSaveAll musi być wywoływane (jako BulkImport._doSaveAll()) WYŁĄCZNIE z onclick
// wewnątrz modalu zatwierdzenia — dokładnie raz. Liczymy tylko FAKTYCZNE wywołania
// (z prefiksem obiektu), nie wzmianki w komentarzach czy nazwę w liście eksportu.
const wywolaniaDoSaveAll = (src.match(/BulkImport\._doSaveAll\(\)/g) || []).length;
ok(wywolaniaDoSaveAll === 1, wywolaniaDoSaveAll === 1
  ? 'BulkImport._doSaveAll() wywoływane dokładnie raz — z przycisku "Zatwierdź i zapisz" w modalu'
  : `BulkImport._doSaveAll() wywoływane ${wywolaniaDoSaveAll}x — spodziewano się dokładnie 1 (tylko z modalu zatwierdzenia); sprawdź, czy coś nie omija bramki`);

// [6] Zapis DR w bulk-import emituje ślad źródeł dla eksportu (modules/dr-export.js).
const funkcjaSaveDoc = (src.match(/async function _saveDoc\(item\)[\s\S]*?\n  \}/) || [''])[0];
const emitujeAudyt = /window\.TaxOrderDrExport[\s\S]{0,200}emitAuditSidecar\(/.test(funkcjaSaveDoc);
ok(!!funkcjaSaveDoc && emitujeAudyt, (funkcjaSaveDoc && emitujeAudyt)
  ? '_saveDoc emituje dokument audytowy (dr-extraction-audit) po zapisie DR'
  : 'BRAK emisji śladu źródeł w _saveDoc — eksport DR nie zobaczy tych dokumentów jako źródła');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
