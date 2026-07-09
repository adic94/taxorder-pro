-- TaxOrder Pro — D1 Schema v16
-- Klucze API (api_keys) — uwierzytelnianie dla integracji zewnętrznych
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v16.sql

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT    PRIMARY KEY,         -- crypto.randomUUID()
  company_id   TEXT    NOT NULL,            -- klucz związany z JEDNĄ firmą
  name         TEXT    NOT NULL,
  key_hash     TEXT    NOT NULL UNIQUE,     -- SHA-256(token) — bez soli, token ma 256 bit entropii
  scope        TEXT    NOT NULL DEFAULT 'read' CHECK(scope IN ('read','read_write')),
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT    DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_apikeys_company  ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_keyhash  ON api_keys(key_hash);
