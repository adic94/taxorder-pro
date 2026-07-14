-- TaxOrder Pro — Schema v27
-- Integracje zewnętrzne: Shell Flota, DKV, Navifleet GPS
-- Łącznie: 59 tabel

CREATE TABLE IF NOT EXISTS integration_settings (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id  TEXT NOT NULL,
  provider    TEXT NOT NULL,
  config      TEXT NOT NULL DEFAULT '{}',
  last_sync   TEXT,
  last_sync_count  INTEGER DEFAULT 0,
  last_sync_status TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_sync_log (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  provider         TEXT NOT NULL,
  synced_at        TEXT DEFAULT (datetime('now')),
  records_imported INTEGER DEFAULT 0,
  records_skipped  INTEGER DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'ok',
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_co ON integration_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_co ON integration_sync_log(company_id, provider, synced_at);
