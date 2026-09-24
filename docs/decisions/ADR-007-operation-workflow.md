# ADR-007: Zlecenie jako korzeń operacji

Status: Proposed

## Kontekst

`transport_orders`, `driver_trips`, dokumenty, Smart Forms, koszty i faktury mają oddzielne cykle. Prosty select statusu nie chroni kolejności ani historii.

## Decyzja

Rozszerzyć `transport_orders` jako korzeń pierwszego pionu. Dodać typ operacji, przystanki, zadania, wymagania, dowody, wyjątki, rozliczenie i niezmienną oś zdarzeń. Stan bieżący jest projekcją audytowanych komend/zdarzeń.

## Reguły

- komendy walidują dozwolone przejście i rolę;
- każde zdarzenie ma tenant, użytkownika/automat, korelację i idempotency key;
- anulowanie nie usuwa historii;
- wyjątek może ominąć bramkę wyłącznie z uprawnieniem i uzasadnieniem.

## Odrzucone

- nowa równoległa tabela `operations` bez adaptera;
- dalsze rozszerzanie dowolnych statusów tekstowych;
- event sourcing całego TaxOrder od razu.

## Kryterium akceptacji

Jedno zlecenie zachowuje identyfikator i pełną oś od utworzenia do rozliczenia.
