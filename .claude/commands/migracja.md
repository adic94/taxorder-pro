---
description: Nowa migracja D1 z rollbackiem i weryfikacją
argument-hint: <co ma robić, np. "tabela cennikow najmu">
allowed-tools: Bash(ls *), Bash(grep *), Bash(node *), Read, Glob, Grep, Write
disable-model-invocation: true
---

Przygotuj migrację: $ARGUMENTS

**Nie uruchamiaj jej na zdalnej bazie.** Przygotuj pliki, pokaż mi, czekaj na decyzję.

## Kroki

**1. Numer** — `ls worker/schema_v*.sql | sort -V | tail -3`. Weź kolejny wolny.

**2. Kolizje nazw** — sprawdź, czy tabela nie jest już zdefiniowana w innym pliku.
`CREATE TABLE IF NOT EXISTS` wykonuje pierwszą definicję i **po cichu ignoruje
drugą**, więc duplikat oznacza kolumny, które nigdy nie powstaną. Mamy już
20 takich przypadków — nie dokładaj kolejnego.

**3. `worker/schema_vN.sql`**
- `CREATE TABLE IF NOT EXISTS` — bezpieczne przy ponownym uruchomieniu
- `company_id TEXT NOT NULL` w każdej tabeli tenantowej
- indeks na `company_id` i na kolumnach filtrowanych
- `created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))`
- seed przez `INSERT OR IGNORE`, nigdy `INSERT`
- komentarz na górze: po co ta migracja i jak ją uruchomić

**4. `worker/schema_vN_ROLLBACK.sql`** — obowiązkowo. W komentarzu napisz wprost:
co ginie po wycofaniu, a co zostaje. Wskaż Time Travel D1 jako wariant bez utraty
danych (`wrangler d1 time-travel info` / `restore`).

**5. Weryfikacja** — zapytanie sprawdzające, czy migracja się udała
(liczba wierszy, obecność kolumn).

## Pokaż mi

Oba pliki, zapytanie weryfikacyjne i **jedno zdanie o tym, co się stanie,
jeśli migracja pójdzie w połowie**. D1 nie ma transakcji DDL.
