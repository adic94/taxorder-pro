---
description: Bramka przed mergem do main – testy, regresy, ryzyko produkcyjne
allowed-tools: Bash(npm run *), Bash(node *), Bash(git diff*), Bash(git log*), Bash(git status*), Read, Glob, Grep
---

Sprawdź, czy ta gałąź nadaje się do merge'a.

**Merge do `main` wdraża produkcję czterech firm.** Push `worker/**` uruchamia
`deploy-worker.yml`. Traktuj to poważnie.

## 1. Zakres zmian

`git diff main --stat` i `git log --oneline main..HEAD`. Wypisz, co się zmieniło.
Zaznacz osobno pliki, które dotykają produkcji: `worker/**`, `wrangler.toml`,
`worker/schema*.sql`.

## 2. Testy

- `npm run audit:all` – musi przejść
- `npm run test:e2e` – jeśli zmieniał się `app.js`, `index.html` albo moduły
- `node --check` na każdym zmienionym pliku `.js`

## 3. Regresy, których szukam w pierwszej kolejności

- **zawężenie uprawnień** – czy poprawka bezpieczeństwa nie odcina kogoś
  legalnego? `users.company_id` jest nullable, konwencja to `|| 'mtoilet'`
- **Service Worker** – nowy skrypt w `index.html` bez wpisu w `STATIC_ASSETS`
  albo bez podbicia `CACHE_NAME`
- **i18n** – nowe klucze w mniej niż 7 językach
- **licencja** – nowy płatny endpoint bez wpisu w `MODULE_ROUTES`
- **migracja** – nowy `schema_vN.sql` bez pliku `_ROLLBACK.sql`

## 4. Odwracalność

Dla każdej zmiany zachowania: czy jest kill switch, fallback albo rollback?
Zmiana bez ścieżki odwrotu nie przechodzi.

## Werdykt

**Jednoznaczny: mergować czy nie.** Jeśli nie – lista blokerów.
Nie łagodź wniosku. Wolę wiedzieć, że coś jest zepsute, niż zepsuć produkcję.
