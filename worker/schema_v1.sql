-- TaxOrder Pro — D1 Schema v1 (schemat bazowy)
-- Tabele utworzone przy pierwszym wdrożeniu (odtworzone z D1 przez migration-check.js).
-- NIE uruchamiaj ręcznie jeśli baza już istnieje — użyj IF NOT EXISTS poniżej.
-- Uruchom: wrangler d1 execute taxorder-pro --file=worker/schema_v1.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'viewer',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    DEFAULT (datetime('now')),
  salt          TEXT,
  extra_permissions TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS vehicles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id       TEXT    NOT NULL,
  nr_rej           TEXT    NOT NULL,
  axles_count      INTEGER DEFAULT 2,
  suspension_type  TEXT    DEFAULT 'pneumatyczne',
  dmc_zespolu      INTEGER DEFAULT 0,
  miesiace_podatku INTEGER DEFAULT 12,
  dt1_category     TEXT,
  dt1_tax_amount   REAL,
  data             TEXT    NOT NULL DEFAULT '{}',
  updated_at       TEXT    DEFAULT (datetime('now')),
  -- Przeniesione z ALTER-ow w schema_v23.sql (patrz komentarz w tamtych plikach).
  branch_id INTEGER,
  -- Przeniesione z ALTER-ow w schema_v30.sql.
  tacho_calibration_date TEXT,  -- data ostatniej kalibracji
  tacho_calibration_next TEXT,  -- = calibration_date + 2 lata
  tacho_vu_last_download TEXT,  -- data ostatniego pobrania VU (limit 90 dni)
  UNIQUE(company_id, nr_rej)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT    PRIMARY KEY,
  nr_rej      TEXT    NOT NULL,
  company_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL DEFAULT 'application/octet-stream',
  r2_key      TEXT    NOT NULL UNIQUE,
  uploaded_at TEXT    DEFAULT (datetime('now')),
  -- Przeniesione z ALTER-ow w schema_v43.sql (patrz komentarz w tamtych plikach).
  workflow_status TEXT DEFAULT 'nowy',
  workflow_template_id TEXT,
  workflow_assigned_to TEXT,
  workflow_assigned_name TEXT,
  workflow_due_date TEXT,
  workflow_priority TEXT DEFAULT 'normal'
);

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  col_order  TEXT,
  col_visible TEXT,
  col_widths TEXT,
  density    TEXT    DEFAULT 'normal',
  updated_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_states (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT    UNIQUE NOT NULL,
  tax_year   TEXT    DEFAULT '2026',
  selected_ids TEXT  DEFAULT '[]',
  taxpayer   TEXT    DEFAULT '{}',
  updated_at TEXT    DEFAULT (datetime('now'))
);
