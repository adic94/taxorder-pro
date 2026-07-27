-- schema_v44: Harmonogram importu paliw, Windykacja, Panel zewnętrzny
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v44.sql

-- ─── HARMONOGRAM IMPORTU PALIW ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_import_schedules (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  provider       TEXT NOT NULL,          -- 'orlen' | 'bp' | 'shell' | 'lotos' | 'circle_k' | 'custom'
  csv_url        TEXT,                   -- opcjonalny URL do pobrania CSV
  last_run_at    TEXT,
  last_run_status TEXT,                  -- 'ok' | 'error' | 'pending'
  last_row_count INTEGER DEFAULT 0,
  active         INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_fis_company ON fuel_import_schedules(company_id, active);

CREATE TABLE IF NOT EXISTS fuel_import_log (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id     TEXT NOT NULL,
  schedule_id    TEXT,
  schedule_name  TEXT,
  run_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  status         TEXT,                   -- 'ok' | 'error' | 'partial'
  rows_imported  INTEGER DEFAULT 0,
  rows_skipped   INTEGER DEFAULT 0,
  error_msg      TEXT
);
CREATE INDEX IF NOT EXISTS idx_fil_company  ON fuel_import_log(company_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_fil_schedule ON fuel_import_log(schedule_id);

-- ─── WINDYKACJA AUTOMATYCZNA ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_collection (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id       TEXT NOT NULL,
  debtor_name      TEXT NOT NULL,
  debtor_email     TEXT,
  debtor_phone     TEXT,
  invoice_number   TEXT NOT NULL,
  invoice_date     TEXT,
  due_date         TEXT NOT NULL,
  amount_pln       REAL NOT NULL,
  currency         TEXT DEFAULT 'PLN',
  status           TEXT DEFAULT 'active',  -- 'active' | 'paid' | 'disputed' | 'written_off'
  reminder_count   INTEGER DEFAULT 0,
  last_reminder_at TEXT,
  next_reminder_at TEXT,
  notes            TEXT,
  created_by       TEXT,
  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_dc_company ON debt_collection(company_id, status, next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_dc_due     ON debt_collection(company_id, due_date);

CREATE TABLE IF NOT EXISTS debt_reminders (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id TEXT NOT NULL,
  debt_id    TEXT NOT NULL,
  sent_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  channel    TEXT DEFAULT 'email',        -- 'email' | 'manual'
  subject    TEXT,
  body       TEXT,
  status     TEXT DEFAULT 'sent'          -- 'sent' | 'failed' | 'pending'
);
CREATE INDEX IF NOT EXISTS idx_dr_company ON debt_reminders(company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_debt    ON debt_reminders(debt_id);

-- ─── PANEL ZEWNĘTRZNY — TOKENY DOSTĘPU ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS external_access_tokens (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id        TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_email      TEXT,
  access_type       TEXT DEFAULT 'client',    -- 'client' | 'carrier'
  allowed_resources TEXT DEFAULT '[]',        -- JSON: ['orders','documents','invoices']
  expires_at        TEXT,
  active            INTEGER DEFAULT 1,
  last_used_at      TEXT,
  created_by        TEXT,
  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_eat_company ON external_access_tokens(company_id, active);
CREATE INDEX IF NOT EXISTS idx_eat_token   ON external_access_tokens(token, active);
