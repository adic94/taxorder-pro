# Wycofanie zmian — audyt 26.07.2026

Każda zmiana z tego wdrożenia ma ścieżkę odwrotu. Poziomy uporządkowane
**od najszybszego i najmniej inwazyjnego** — zacznij od góry.

---

## Poziom 0 — kill switch w przeglądarce (5 sekund, bez deployu)

Jeśli po wdrożeniu lista firm zachowuje się źle (znikają firmy, złe dane,
zła firma po zalogowaniu) — **nie cofaj deployu**. Otwórz konsolę
przeglądarki (F12) i wpisz:

```javascript
localStorage.setItem('taxorder_companies_source','local'); location.reload();
```

Aplikacja wraca do listy firm zaszytej w `app.js` — dokładnie stan sprzed v44.
Reszta systemu (pojazdy, DT-1, dokumenty) działa bez zmian.

Powrót do wersji z bazy:

```javascript
localStorage.removeItem('taxorder_companies_source'); location.reload();
```

Jeśli nie chcesz przeładowywać strony, jest jeszcze wariant w locie:

```javascript
restoreLocalCompanies();
```

> Kill switch działa **per przeglądarka**. Jeśli problem dotyczy wszystkich
> użytkowników, przejdź do poziomu 1 lub 2.

---

## Poziom 1 — cofnięcie frontendu (2 minuty)

Cloudflare Pages trzyma poprzednie wdrożenia.

**Panel Cloudflare** → Workers & Pages → `taxorder-pro` → Deployments →
znajdź wdrożenie sprzed zmiany → **Rollback**.

Albo przez gita:

```powershell
git revert 960ca2f          # cofa "firmy jako dane w D1"
git push origin main
```

Baza zostaje nietknięta — tabele `companies` i `user_company_access` po prostu
przestają być używane.

---

## Poziom 2 — cofnięcie Workera (2 minuty)

```powershell
$env:Path = "C:\Users\acichocki\node\node-v24.16.0-win-x64;" + $env:Path
.\node_modules\.bin\wrangler.cmd deployments list
.\node_modules\.bin\wrangler.cmd rollback [ID_WERSJI]
```

Bez argumentu `wrangler rollback` cofa do poprzedniej wersji.

> Po cofnięciu Workera `/api/companies` zwróci 404. To bezpieczne —
> `hydrateCompaniesFromApi()` złapie błąd i zostawi listę lokalną.

---

## Poziom 3 — cofnięcie migracji bazy (ostateczność)

**Najpierw kopia zapasowa:**

```powershell
.\tools\db\backup-companies.ps1
```

Skrypt zrzuci obie tabele do JSON-a i pokaże punkt przywracania Time Travel.

### Wariant A — Time Travel (zalecany, nic nie tracisz)

D1 pozwala cofnąć całą bazę do punktu w czasie, do 30 dni wstecz:

```powershell
.\node_modules\.bin\wrangler.cmd d1 time-travel info taxorder-pro
.\node_modules\.bin\wrangler.cmd d1 time-travel restore taxorder-pro --timestamp=2026-07-26T10:00:00Z
```

> ⚠️ Cofa **całą bazę**, nie tylko nowe tabele. Wszystko zapisane po tym
> znaczniku czasu zniknie — także pojazdy i dokumenty. Używaj tylko wtedy,
> gdy migracja faktycznie coś popsuła.

### Wariant B — usunięcie samych nowych tabel

```powershell
.\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v44_ROLLBACK.sql
```

**Utracisz:** firmy dodane po migracji przez „Dodaj firmę" (nie ma ich
w literale `COMPANIES`!) oraz wszystkie nadane dostępy użytkownik ↔ firma.

**Nie utracisz:** pojazdów, dokumentów, deklaracji DT-1, polis — te tabele
wiążą się z firmą przez tekstowe `company_id`, bez klucza obcego, więc
usunięcie `companies` ich nie rusza.

---

## Poziom 4 — cofnięcie poprawki IDOR

Poprawka jest **zawężająca**: dodaje `AND company_id=?` do `PATCH` i `DELETE`
na `/api/folder-monitor/queue/:id`.

Nie powinna niczego zepsuć — używa tego samego fallbacku `user.company_id ||
'mtoilet'` co endpoint `GET` tej samej kolejki, więc użytkownicy z pustym
`company_id` (kolumna jest nullable od schema_v22) zachowują dostęp.

Jeśli mimo to ktoś zgłosi 404 przy oznaczaniu dokumentów z monitora folderów:
sprawdź, do jakiej firmy należy jego wpis w kolejce.

```sql
SELECT id, company_id, filename, status FROM folder_monitor_queue
WHERE id = '<id_z_bledu>';
```

Cofnięcie tej jednej poprawki bez ruszania reszty:

```powershell
git revert 481a6cb --no-commit
git checkout HEAD -- sw.js CLAUDE.md docs/
git commit -m "revert: cofnij poprawke IDOR w kolejce monitora"
```

---

## Czego **nie** trzeba cofać

| Zmiana | Dlaczego bezpieczna |
|--------|---------------------|
| `sw.js` — dodany `bulk-import.js` | Brakujący wpis w cache; usunięcie tylko przywróci błąd |
| `CLAUDE.md` | Dokumentacja, zero wpływu na działanie |
| `docs/AUDYT_2026-07-26.md` | Nowy plik |
| `rate-reader.js` | Ciche `return null` → `console.warn`. Logika bez zmian |
| `config/supabase-config.js` usunięty | Plik nie był ładowany w `index.html`. Odzyskanie: `git checkout 481a6cb~1 -- config/supabase-config.js` |

---

## Kolejność diagnozy

```
Coś nie działa po wdrożeniu
        │
        ├─ Dotyczy listy firm / przełączania firmy?
        │     └─ Poziom 0 (kill switch) → potwierdź, że to ta zmiana
        │           ├─ Pomogło  → Poziom 1 lub 2, zgłoś co się działo
        │           └─ Nie pomogło → to nie firmy, szukaj dalej
        │
        ├─ 404 przy oznaczaniu dokumentów z monitora folderów?
        │     └─ Poziom 4
        │
        └─ Błędy 500 z Workera?
              └─ Poziom 2 (rollback Workera), potem sprawdź error_logs
```

---

## Weryfikacja przed mergem

```powershell
$env:TEST_EMAIL="..." ; $env:TEST_PASS="..."
node tools/autotest/verify-v44.js
```

Sprawdza: czy Worker ma nowy kod, czy seed firm doszedł do bazy, czy NIP
i organ podatkowy mToilet się zgadzają (kluczowe dla DT-1), czy walidacja
i poprawka IDOR działają. Kod wyjścia `1` = nie mergować.
