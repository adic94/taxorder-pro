---
description: Pełny audyt projektu – składnia, XSS, i18n, cache, izolacja tenantów, martwy kod
argument-hint: [opcjonalnie: obszar, np. "worker" albo "moduly"]
allowed-tools: Bash(npm run *), Bash(node *), Bash(grep *), Bash(rg *), Bash(git status*), Bash(git log*), Read, Glob, Grep
---

Przeprowadź audyt projektu TaxOrder. Zakres: $ARGUMENTS (pusty = całość).

## 1. Audyty automatyczne

Uruchom `npm run audit:all` i `npm run migration-check`. Zaraportuj wynik każdego.

## 2. Izolacja tenantów

Każde zapytanie do tabeli tenantowej musi mieć `company_id`. Przeskanuj
`worker/index.js` pod kątem `SELECT`/`UPDATE`/`DELETE` bez tego filtru.

Pomiń tabele globalne: `users`, `sessions`, `error_logs`, `companies`.

Uwaga na dwa wzorce, które **są** bezpieczne i nie powinny trafić do raportu:
- poprzedzający `SELECT ... WHERE id=? AND company_id=?` z `404` przy braku wiersza
- kolekcja zbudowana wcześniej z zapytania ze scopem (np. `vehMap` w synchronizacji TEKOM)

Ostatni pomiar: 625 zapytań, 99,4% ze scopem. Spadek poniżej tego = regres.

## 3. Bezpieczeństwo

- sekrety w kodzie frontendowym (`app.js`, `modules/`, `config/`) – klucze API,
  tokeny, hasła. `app.js` jest serwowany publicznie z Cloudflare Pages.
- endpointy bez sprawdzenia sesji – szukaj tras w routerze bez `if (!user)`
- IDOR: operacje po `id` bez `company_id` w `WHERE`

## 4. Martwy kod

- moduły ładowane w `index.html`, które wołają nieistniejące globalne obiekty
  (historycznie: `window.supabaseClient`)
- moduły w `modules/` nieładowane nigdzie
- tabele w `worker/*.sql` bez odwołań w `worker/index.js`

## 5. Spójność schematu

Znajdź tabele zdefiniowane w więcej niż jednym pliku `worker/schema*.sql`.
`CREATE TABLE IF NOT EXISTS` wykonuje pierwszą definicję i **po cichu ignoruje
drugą** – jeśli się różnią, kolumny z drugiej nigdy nie powstały.
Ostatni pomiar: 20 zdublowanych tabel.

## Raport

Tabela: obszar → wynik → dowód (fragment outputu, nie parafraza).
Każde znalezisko z propozycją poprawki. **Nie naprawiaj nic bez mojej zgody.**
Jeśli czegoś nie da się sprawdzić bez dostępu do bazy – napisz to wprost.
