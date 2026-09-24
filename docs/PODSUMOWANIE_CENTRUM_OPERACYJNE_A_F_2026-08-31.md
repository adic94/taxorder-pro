# TaxOrder Pro — podsumowanie centrum operacyjnego A–F

## Wynik

TaxOrder Pro otrzymał wspólną oś operacji nad istniejącymi modułami, bez przepisywania dojrzałych funkcji flotowych. Zlecenie, plan, realizacja kierowcy, POD, rozliczenie, import, ERP i automatyzacje używają teraz wersjonowanych kontraktów oraz identyfikatorów korelacyjnych.

| Faza | Dostarczony rezultat | Migracja |
|---|---|---|
| A | audyt kompletności, benchmark PasCom/rynku, ADR i kontrakty | brak |
| B | oś operacji, zdarzenia, komendy, wersje i konflikty | v54 |
| C | workbench, Gantt/mapa, preview/commit, PWA kierowcy | v54 |
| D | POD, SLA, dowody, koszty i szkic Route Billing | v55 |
| E | adapter registry, run queue, mapowania, dry-run, import/eksport, ERPNext | v56 |
| F | automatyzacje paliwo/GPS, serwis, leasing, FNOL i dokumenty ERP | v57 |

## Granice bezpieczeństwa

- tenant pochodzi z uwierzytelnionego użytkownika, nie z parametru URL;
- komendy i importy są idempotentne;
- nowe reguły zaczynają jako `dry_run`;
- aktywacja reguły wymaga kierownika;
- sekrety integracji pozostają w Cloudflare Secrets;
- enova365 i Comarch są wyłączone do zatwierdzenia konfiguracji;
- brak odpowiedzi ERP nie jest traktowany jako sukces;
- XLSM jest odczytywany bez wykonywania makr;
- migracje v54–v57 nie są częścią automatycznego globa `schema_v*.sql`.

## Stan jakości

Pełny `npm run audit:all` po fazie F: 34/34 bramki i 341/0 asercji. Po dodaniu preflightu wydania obowiązuje ponowne wykonanie audytu. Test UAT znajduje się w `tests/e2e/operations-center-acceptance.spec.js` i wymaga osobnego tenanta testowego oraz `TEST_TOKEN` albo `TEST_EMAIL`/`TEST_PASS`.

## Świadomie niewykonane

- brak migracji zdalnego D1;
- brak wdrożenia Workera/Pages;
- brak aktywacji reguł produkcyjnych;
- brak zapisania kluczy enova365, Comarch lub ERPNext;
- brak pierwszej transmisji dokumentu do ERP.

Te działania wymagają przejścia runbooka i decyzji właściciela systemu.
