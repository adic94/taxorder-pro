-- schema_v49 ROLLBACK
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v49_ROLLBACK.sql

DROP INDEX IF EXISTS idx_upkv_user_co;
DROP TABLE IF EXISTS user_prefs_kv;
