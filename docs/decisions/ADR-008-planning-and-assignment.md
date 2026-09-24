# ADR-008: Planowanie i wersjonowany przydział

Status: Proposed

## Kontekst

Kalendarze i Gantt istnieją, ale przydział nie uwzględnia wspólnie dostępności, konfliktów, kwalifikacji, ładowności i okien czasowych.

## Decyzja

Plan jest wersjonowanym draftem. Detektor konfliktów działa deterministycznie. Użytkownik przegląda plan, poprawia go i wykonuje atomowy `commit`. Automatyczny planner jest późniejszą strategią korzystającą z tych samych kontraktów, nie osobnym modelem.

## Pierwsze ograniczenia

- nakładanie czasu pojazdu/kierowcy;
- rezerwacja, serwis i wyłączenie zasobu;
- zmiana kierowcy, urlop i czas pracy;
- ładowność/objętość;
- wymagane kompetencje/wyposażenie;
- okna czasowe i czas dojazdu.

## Kryterium akceptacji

Commit albo zapisuje całą wersję planu, albo nic; każdy override konfliktu ma autora i powód.
