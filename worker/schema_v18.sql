-- schema v18: Klucze API — dostęp programistyczny bez sesji przeglądarki
-- Bezpieczne: CREATE TABLE IF NOT EXISTS
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v18.sql

CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,
  scope       TEXT NOT NULL DEFAULT 'read' CHECK(scope IN ('read','read_write')),
  active      INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_apikeys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash    ON api_keys(key_hash);
