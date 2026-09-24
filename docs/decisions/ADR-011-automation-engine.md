# ADR-011: Automatyzacje zdarzenie–warunek–akcja

Status: Proposed

## Kontekst

Alerty, cron, powiadomienia i workflow istnieją, lecz reguły są zaszyte w handlerach.

## Decyzja

Wprowadzić wersjonowane reguły: trigger, warunki, akcje, approval gate, SLA, eskalacja i audyt. Akcja wywołuje publiczną komendę domenową, nie wykonuje dowolnego SQL ani kodu użytkownika.

## Bezpieczeństwo

- domyślny dry-run dla nowej reguły;
- kill switch per reguła i firma;
- limity wykonania i ochrona przed pętlą;
- finanse, prawo i kadry wymagają bramki zgodnej z polityką;
- explainable log: które warunki zadziałały.

## Kryterium akceptacji

Operator potrafi wyjaśnić każde wykonanie, zatrzymać regułę i bezpiecznie ponowić akcję idempotentną.
