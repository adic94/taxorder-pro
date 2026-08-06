-- schema_v45_ROLLBACK: odwrócenie migracji KSeF offline queue + config
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v45_ROLLBACK.sql
--
-- ⚠️  UTRACISZ: wszystkie rekordy ksef_offline_queue i ksef_config.
--     Kolumny dodane do ksef_invoices (upo_r2_key, upo_reference_number,
--     upo_timestamp, sent_at, accepted_at, retry_count) NIE zostaną usunięte —
--     SQLite nie gwarantuje DROP COLUMN bez przebudowy tabeli; usuń je ręcznie
--     przez CREATE TABLE ... AS SELECT bez tych kolumn + DROP + RENAME, jeśli niezbędne.

DROP INDEX IF EXISTS idx_ksef_retry;
DROP INDEX IF EXISTS idx_ksef_queue;
DROP TABLE IF EXISTS ksef_config;
DROP TABLE IF EXISTS ksef_offline_queue;
