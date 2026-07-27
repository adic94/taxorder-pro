-- schema_v46: Driver PWA, HR, Winiety, Środki Trwałe, Rating Przewoźników
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v46.sql

-- ─── DRIVER PWA — TRASY KIEROWCY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_trips (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id  TEXT NOT NULL,
  driver_id   TEXT,
  driver_name TEXT,
  vehicle_id  TEXT,
  vehicle_reg TEXT,
  start_km    INTEGER,
  end_km      INTEGER,
  start_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  end_at      TEXT,
  notes       TEXT,
  status      TEXT DEFAULT 'active',   -- active | completed
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_dt_company ON driver_trips(company_id, driver_id, start_at DESC);

-- ─── MODUŁ HR — URLOPY ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_leaves (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id   TEXT NOT NULL,
  driver_id    TEXT,
  driver_name  TEXT NOT NULL,
  leave_type   TEXT DEFAULT 'annual',  -- annual | sick | unpaid | other
  from_date    TEXT NOT NULL,
  to_date      TEXT NOT NULL,
  days_count   INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'pending', -- pending | approved | rejected
  approved_by  TEXT,
  notes        TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hr_leaves ON hr_leaves(company_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_driver ON hr_leaves(company_id, driver_name, from_date);

-- ─── MODUŁ HR — BADANIA LEKARSKIE + PSYCHOTECHNICZNE ────────────────────────
CREATE TABLE IF NOT EXISTS hr_medical_exams (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id   TEXT NOT NULL,
  driver_id    TEXT,
  driver_name  TEXT NOT NULL,
  exam_type    TEXT DEFAULT 'periodic', -- periodic | admission | night | psycho
  exam_date    TEXT NOT NULL,
  valid_until  TEXT NOT NULL,
  notes        TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hr_exams ON hr_medical_exams(company_id, exam_type, valid_until);

-- ─── WINIETY I e-TOLL ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vignettes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id      TEXT NOT NULL,
  vehicle_id      TEXT,
  vehicle_reg     TEXT NOT NULL,
  country         TEXT NOT NULL,           -- AT | CZ | CH | HU | RO | BG | SK | SI | DE | FR
  vignette_type   TEXT DEFAULT 'annual',   -- annual | monthly | 10day | weekly
  valid_from      TEXT NOT NULL,
  valid_until     TEXT NOT NULL,
  amount_pln      REAL,
  receipt_number  TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vig_company ON vignettes(company_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_vig_vehicle ON vignettes(vehicle_id, valid_until);

CREATE TABLE IF NOT EXISTS etoll_devices (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id      TEXT NOT NULL,
  vehicle_id      TEXT,
  vehicle_reg     TEXT NOT NULL,
  obu_number      TEXT,
  obu_type        TEXT DEFAULT 'viabox',   -- viabox | visatoll | etoll_go
  active          INTEGER DEFAULT 1,
  balance_pln     REAL DEFAULT 0,
  last_top_up_at  TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_etoll_company ON etoll_devices(company_id);

-- ─── ŚRODKI TRWAŁE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id            TEXT NOT NULL,
  vehicle_id            TEXT,
  name                  TEXT NOT NULL,
  asset_number          TEXT,               -- numer inwentarzowy
  purchase_date         TEXT,
  purchase_value        REAL NOT NULL,      -- wartość nabycia
  residual_value        REAL DEFAULT 0,     -- wartość rezydualna
  useful_life_years     INTEGER DEFAULT 5,
  depreciation_method   TEXT DEFAULT 'linear', -- linear | diminishing
  depreciation_rate     REAL DEFAULT 20,    -- % rocznie
  current_book_value    REAL,               -- wartość bilansowa
  status                TEXT DEFAULT 'active', -- active | disposed | written_off
  disposal_date         TEXT,
  disposal_value        REAL,
  notes                 TEXT,
  created_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_fa_company ON fixed_assets(company_id, status);

CREATE TABLE IF NOT EXISTS fixed_asset_depreciation (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id          TEXT NOT NULL,
  asset_id            TEXT NOT NULL,
  period              TEXT NOT NULL,         -- YYYY-MM
  depreciation_amount REAL NOT NULL,
  book_value_after    REAL NOT NULL,
  created_at          TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_fad_asset ON fixed_asset_depreciation(asset_id, period);

-- ─── RATING PRZEWOŹNIKÓW ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_ratings (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id            TEXT NOT NULL,
  carrier_name          TEXT NOT NULL,
  carrier_nip           TEXT,
  carrier_email         TEXT,
  carrier_phone         TEXT,
  rating_punctuality    INTEGER DEFAULT 3,  -- 1–5
  rating_quality        INTEGER DEFAULT 3,
  rating_price          INTEGER DEFAULT 3,
  rating_communication  INTEGER DEFAULT 3,
  rating_overall        REAL,               -- avg wyliczane przy save
  blacklisted           INTEGER DEFAULT 0,
  blacklist_reason      TEXT,
  orders_count          INTEGER DEFAULT 0,
  last_order_at         TEXT,
  notes                 TEXT,
  created_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cr_company ON carrier_ratings(company_id, blacklisted);

CREATE TABLE IF NOT EXISTS carrier_rating_history (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
  company_id            TEXT NOT NULL,
  carrier_id            TEXT NOT NULL,
  order_reference       TEXT,
  rating_punctuality    INTEGER,
  rating_quality        INTEGER,
  rating_price          INTEGER,
  rating_communication  INTEGER,
  comment               TEXT,
  rated_by              TEXT,
  rated_at              TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_crh_carrier ON carrier_rating_history(carrier_id, rated_at DESC);
