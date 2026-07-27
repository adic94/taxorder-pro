-- schema_v48_ROLLBACK: odwrócenie migracji pakietów modułów
-- UWAGA: usuwa dane! Uruchamiać tylko w awaryjnym rollbacku.
-- wrangler d1 execute taxorder-pro --remote --file=worker/schema_v48_ROLLBACK.sql

DROP TABLE IF EXISTS usage_snapshots;
DROP TABLE IF EXISTS company_packages;
