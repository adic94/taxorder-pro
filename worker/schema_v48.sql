-- schema_v48: Pakiety modułów + snapshoty użycia (egzekwowanie licencji serwerowo)
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v48.sql
-- Rollback: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v48_ROLLBACK.sql

-- ─── PAKIETY MODUŁÓW PER FIRMA ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_packages (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id     TEXT NOT NULL UNIQUE,
  package_name   TEXT NOT NULL DEFAULT 'basic',   -- 'basic' | 'professional' | 'enterprise'
  modules_add    TEXT NOT NULL DEFAULT '[]',        -- JSON: dodatkowe moduły poza pakietem
  modules_remove TEXT NOT NULL DEFAULT '[]',        -- JSON: moduły wyłączone z pakietu
  valid_until    TEXT,                              -- NULL = bezterminowo
  notes          TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cp_company ON company_packages(company_id, active);

-- ─── SNAPSHOTY UŻYCIA (miesięczne zliczanie per moduł) ───────────────────────
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id            TEXT NOT NULL DEFAULT (lower(hex(randomblob(10)))),
  company_id    TEXT NOT NULL,
  period        TEXT NOT NULL,                     -- YYYY-MM
  module        TEXT NOT NULL,                     -- np. 'ai', 'ksef', 'cepik'
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (company_id, period, module)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ump_lookup ON usage_snapshots(company_id, period, module);
