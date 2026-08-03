-- schema_v49: user_prefs_kv — cross-device synchronizacja preferencji UI
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v49.sql
-- Rollback: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v49_ROLLBACK.sql

-- Istniejącej tabeli user_prefs (col_order/col_visible/col_widths/density) NIE ruszamy.
-- Nowa tabela obsługuje preferencje KV z podziałem globalny / per-firma.
--
-- company_id = ''        → preferencja globalna (theme, sidebar, tryb widoku)
-- company_id = 'mtoilet' → preferencja dla konkretnej firmy (filtry, układ kolumn)

CREATE TABLE IF NOT EXISTS user_prefs_kv (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT    NOT NULL DEFAULT '',
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_upkv_user_co ON user_prefs_kv(user_id, company_id);
