---
description: Runbook wdrożenia – kopia, migracje, deploy, weryfikacja
argument-hint: [opcjonalnie: numer schematu, np. "v48"]
allowed-tools: Bash(npm run *), Bash(node *), Bash(git status*), Bash(git log*), Read, Glob, Grep
disable-model-invocation: true
---

Przeprowadź mnie przez wdrożenie: $ARGUMENTS

**Zatrzymaj się przed każdym krokiem dotykającym produkcji i poczekaj na moje "tak".**
Nie uruchamiaj `wrangler deploy` ani migracji `--remote` z własnej inicjatywy.

## Kolejność – ma znaczenie

**1. Stan wyjściowy**
`git status`, `git log --oneline main..HEAD`. Potwierdź, że drzewo jest czyste.

**2. Sekrety** – czy wszystko, czego wymaga nowy kod, jest ustawione?
Sprawdź w kodzie odwołania do `env.*` dodane w tej gałęzi i wypisz, które
wymagają `wrangler secret put`. Sam ich nie ustawiaj.

**3. Kopia zapasowa** – `.\tools\db\backup-companies.ps1` przed każdą migracją.

**4. Migracje** – po kolei, rosnąco, każda osobno, z weryfikacją po każdej.
Zapytanie sprawdzające po każdym pliku.

**5. Deploy Workera** – dopiero po migracjach. Baza musi być gotowa, zanim
nowy kod zacznie o nią pytać.

**6. Weryfikacja** – `npm run verify:v44`, potem `npm run test:e2e`.

**7. Merge** – dopiero gdy wszystko powyżej przeszło.

## Przy każdym kroku podaj

Dokładne polecenie, oczekiwany wynik i **co zrobić, jeśli się nie powiedzie**.
Ścieżka wycofania: `docs/ROLLBACK_v44.md`.

## Pamiętaj

- `MODULE_ENFORCEMENT=off` przy pierwszym wdrożeniu licencji – mapa
  `MODULE_ROUTES` nie była testowana na żywym API
- kill switch listy firm: `localStorage.setItem('taxorder_companies_source','local')`
- D1 nie ma transakcji DDL – migracja może pójść w połowie
