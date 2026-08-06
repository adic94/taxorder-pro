-- schema_v47_ROLLBACK: odwrócenie migracji Harmonogram importu paliw, Windykacja, Panel zewnętrzny
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v47_ROLLBACK.sql
--
-- ⚠️  UTRACISZ: wszystkie harmonogramy importu paliw, logi importu,
--     rekordy windykacyjne z przypomnieniami oraz tokeny dostępu panelu zewnętrznego.

DROP INDEX IF EXISTS idx_eat_token;
DROP INDEX IF EXISTS idx_eat_company;
DROP INDEX IF EXISTS idx_dr_debt;
DROP INDEX IF EXISTS idx_dr_company;
DROP INDEX IF EXISTS idx_dc_due;
DROP INDEX IF EXISTS idx_dc_company;
DROP INDEX IF EXISTS idx_fil_schedule;
DROP INDEX IF EXISTS idx_fil_company;
DROP INDEX IF EXISTS idx_fis_company;

DROP TABLE IF EXISTS external_access_tokens;
DROP TABLE IF EXISTS debt_reminders;
DROP TABLE IF EXISTS debt_collection;
DROP TABLE IF EXISTS fuel_import_log;
DROP TABLE IF EXISTS fuel_import_schedules;
