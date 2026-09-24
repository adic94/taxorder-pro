# ADR-009: Wspólna platforma integracyjna

Status: Proposed

## Kontekst

Integracje paliwowe, GPS, folder monitor, webhooki i importy mają własne logi, retry i deduplikację.

## Decyzja

Wprowadzić rejestr adapterów, kanoniczny envelope, run/item/error, kolejkę, checkpoint, idempotencję i dead-letter queue. Adapter normalizuje dane, ale zapis domenowy wykonuje serwis TaxOrder z RBAC i audytem.

## Reguły

- sekrety są referencją do bezpiecznego magazynu;
- retry tylko dla błędu przejściowego;
- walidacja przechodzi do `waiting_user`;
- każdy rekord zachowuje external ID i wersję schematu;
- webhook weryfikuje podpis/replay i pozwala na allowlistę hostów.

## Pierwszy adapter

ERPNext sandbox, ponieważ ma dostępne API i nie wymaga ingerencji w system klienta. Wynik ma ustalić kontrakt dla enova365 i Comarch, nie uzależnić domeny od ERPNext.

## Kryterium akceptacji

Powtórzenie tego samego runu nie duplikuje danych, a operator widzi stan każdej pozycji i naprawialny błąd.
