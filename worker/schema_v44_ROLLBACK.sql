-- schema_v44_ROLLBACK.sql — wycofanie migracji schema_v44
--
-- Uruchom TYLKO jeśli chcesz cofnąć wprowadzenie firm do D1:
--   wrangler d1 execute taxorder-pro --remote --file=worker/schema_v44_ROLLBACK.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CO SIĘ STANIE PO URUCHOMIENIU
--
-- Aplikacja wróci do listy firm zaszytej w `app.js` (literał COMPANIES).
-- `hydrateCompaniesFromApi()` dostanie błąd z /api/companies, złapie go
-- i zostawi listę lokalną — czyli dokładnie stan sprzed migracji.
--
-- ⚠️  UTRACISZ:
--   • firmy dodane po migracji przez „Dodaj firmę" (nie ma ich w literale!)
--   • wszystkie nadane dostępy użytkownik ↔ firma
--
-- ✅ NIE UTRACISZ:
--   • pojazdów, dokumentów, deklaracji DT-1, polis — te tabele nie są ruszane.
--     Wiążą się z firmą przez tekstowe `company_id`, nie przez klucz obcy.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ZRÓB KOPIĘ PRZED URUCHOMIENIEM (patrz tools/db/backup-companies.ps1):
--
--   wrangler d1 execute taxorder-pro --remote --json ^
--     --command "SELECT * FROM companies" > backup_companies.json
--   wrangler d1 execute taxorder-pro --remote --json ^
--     --command "SELECT * FROM user_company_access" > backup_access.json
--
-- Alternatywa bez utraty danych: zamiast DROP użyj Time Travel D1, który
-- pozwala przywrócić bazę do punktu w czasie (do 30 dni wstecz):
--
--   wrangler d1 time-travel info    taxorder-pro
--   wrangler d1 time-travel restore taxorder-pro --timestamp=<ISO8601>
--
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS user_company_access;
DROP TABLE IF EXISTS companies;

-- Indeksy znikają razem z tabelami — poniższe tylko na wypadek osieroconych wpisów.
DROP INDEX IF EXISTS idx_uca_user;
DROP INDEX IF EXISTS idx_uca_company;
DROP INDEX IF EXISTS idx_comp_active;
