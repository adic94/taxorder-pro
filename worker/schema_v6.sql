-- Klucze API — uwierzytelnianie maszyna-maszyna dla integracji zewnętrznych (Tekom, ORLEN, enova365, skrypty).
-- Token ma wysoką entropię (256 bit), więc wystarczy prosty SHA-256 do lookupu po key_hash —
-- w przeciwieństwie do haseł użytkowników (PBKDF2 + sól) tu nie ma sensu wolne hashowanie ani sól.
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scope        TEXT NOT NULL DEFAULT 'read' CHECK(scope IN ('read','read_write')),
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_apikeys_company ON api_keys(company_id);
