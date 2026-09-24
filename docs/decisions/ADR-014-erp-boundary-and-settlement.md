# ADR-014: Granica rozliczenia i ERP

Status: Proposed

## Kontekst

TaxOrder ma TCO, faktury, KSeF, JPK i windykację, ale nie powinien stać się pełną księgowością.

## Decyzja

TaxOrder jest źródłem prawdy planu i wykonania operacji oraz kosztu operacyjnego przed księgowaniem. ERP jest źródłem prawdy dokumentu zaksięgowanego, rozrachunku, płatności i księgi. Synchronizacja używa wersjonowanego dokumentu wymiany i uzgodnienia zwrotnego.

## Stany

`draft → approved → ready_for_export → exported → accepted_by_erp → posted → paid`, z `rejected/reconciliation_required` jako wyjątkami. Brak odpowiedzi ERP nie może oznaczać sukcesu.

## Reguły

- nie wysyłać dwa razy tej samej wersji;
- korekta tworzy nową wersję/dokument korygujący;
- identyfikator ERP i checksum są zapisane;
- TaxOrder nie edytuje zaksięgowanego dokumentu bez procesu korekty.

## Kryterium akceptacji

Jedno rozliczenie można uzgodnić od zlecenia do numeru w ERP i płatności, bez podwójnego księgowania i bez ukrytego nadpisania.
