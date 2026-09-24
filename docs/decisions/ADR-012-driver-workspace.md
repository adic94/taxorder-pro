# ADR-012: Jedna przestrzeń pracy kierowcy

Status: Proposed

## Kontekst

PWA ma trasy, skan dokumentu i komunikator, a panel kierowcy pokazuje zlecenia i usterki. Nie ma jednego dispatchu ani wspólnej osi z operacją.

## Decyzja

PWA staje się widokiem przypisanych operacji. Kierowca może przyjąć/odrzucić zadanie, zobaczyć przystanki, nawigować, zmieniać dozwolone statusy, zgłosić wyjątek i zebrać POD. `driver_trips` zostaje zaadaptowane do czasu migracji.

## Offline

- cache tylko minimalnych danych zadania;
- lokalna kolejka podpisanych komend z idempotency key;
- jawny stan synchronizacji;
- konflikt nie jest automatycznie nadpisywany;
- brak sekretów i zbędnych danych osobowych offline.

## Kryterium akceptacji

Kierowca kończy przydzielone zlecenie przy chwilowej utracie sieci, a po synchronizacji nie powstają duplikaty ani niedozwolone przejścia.
