---
id: ADR-004
title: Nullish coalescing (??) zamiast OR (||) dla pól numerycznych
date: 2024-10-01
status: zaakceptowane
---

## Kontekst

Pola numeryczne takie jak `dmc` (dopuszczalna masa całkowita) mogą legalnie wynosić `0`. Użycie `||` powoduje że `0 || fallback` wybiera `fallback` zamiast `0` — błędna klasyfikacja podatkowa.

Konkretny bug: pojazd z `dmc=0` traktowany jak brak danych → błędna kategoria DT-1.

## Decyzja

Dla wszystkich pól numerycznych używamy `??` (nullish coalescing):

```javascript
// ŹLE — dmc=0 wybiera fallback
const dT = (v.dmc || v.dmcMax || 0) / 1000;

// DOBRZE — dmc=0 jest respektowane
const dT = (v.dmc ?? v.dmcMax ?? 0) / 1000;
```

Dotyczy: `dmc`, `dmcMax`, `rok`, `osie`, `miejsca`, `miesiacePodatku`.

## Konsekwencje

- Fix zaaplikowany w: `modules/tax-engine.js`, `modules/cf-cloud.js`, `modules/gminy-rates.js`, `modules/fleet-cloud.js`
- Przy code review: każdy `||` przy polu numerycznym → podejrzany, wymaga sprawdzenia
