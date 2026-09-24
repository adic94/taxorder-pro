# ADR-006: Wspólny model kontrahenta

Status: Proposed

## Kontekst

Klient CFM, dostawca, przewoźnik, warsztat, leasingodawca i ubezpieczyciel są dziś osobnymi rekordami lub tekstem. Powoduje to duplikaty kontaktów, NIP, dokumentów i identyfikatorów ERP.

## Decyzja

Wprowadzić kanoniczne `party` z wieloma rolami, kontaktami, adresami i identyfikatorami zewnętrznymi. Istniejące tabele pozostają w okresie przejściowym i dostają mapowanie do `party`; nie wykonujemy jednorazowego automatycznego scalania bez raportu konfliktów.

## Konsekwencje

- jeden kontrahent może być jednocześnie klientem i dostawcą;
- NIP nie może być jedynym kluczem, bo występują podmioty zagraniczne i osoby;
- scalenie wymaga narzędzia przeglądu duplikatów;
- moduły domenowe zachowują własne dane specyficzne dla roli.

## Odrzucone

- pozostawienie izolowanych kartotek;
- użycie `cfm_clients` jako tabeli nadrzędnej;
- budowa pełnego CRM.

## Kryterium akceptacji

Ta sama organizacja ma jeden rekord bazowy i wiele ról, a stare API działa przez warstwę zgodności bez utraty danych.
