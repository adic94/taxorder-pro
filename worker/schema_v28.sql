-- Schema v28: Moduł tachografów cyfrowych DDD
-- Analiza czasu pracy kierowców i naruszenia EU 561/2006

CREATE TABLE IF NOT EXISTS tachograph_files (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  file_key TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'card', -- 'card' (karta kierowcy) | 'vu' (jednostka pojazdu)
  card_number TEXT,
  driver_surname TEXT,
  driver_firstname TEXT,
  driver_birth_date TEXT,
  card_expiry TEXT,
  period_start TEXT,  -- YYYY-MM-DD
  period_end TEXT,    -- YYYY-MM-DD
  driver_id TEXT,     -- FK do tabeli drivers (opcjonalnie)
  vehicle_id TEXT,    -- FK do tabeli vehicles (dla pliku VU)
  parse_status TEXT DEFAULT 'pending', -- 'ok' | 'partial' | 'error'
  parse_error TEXT,
  violations_count INTEGER DEFAULT 0,
  activities_count INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  uploaded_at TEXT DEFAULT (datetime('now')),
  uploaded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tacho_files_company ON tachograph_files(company_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tacho_files_driver ON tachograph_files(company_id, driver_surname, driver_firstname);

CREATE TABLE IF NOT EXISTS tachograph_activities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  file_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,   -- YYYY-MM-DD
  start_time TEXT NOT NULL,      -- HH:MM
  end_time TEXT,                 -- HH:MM
  duration_min INTEGER DEFAULT 0,
  activity_type TEXT NOT NULL,   -- 'driving' | 'rest' | 'work' | 'availability'
  driving_status TEXT DEFAULT 'single', -- 'single' | 'crew'
  FOREIGN KEY (file_id) REFERENCES tachograph_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tacho_act_file ON tachograph_activities(file_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_tacho_act_company_date ON tachograph_activities(company_id, activity_date);

CREATE TABLE IF NOT EXISTS tachograph_violations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  file_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor', -- 'minor' | 'serious' | 'very_serious' | 'most_serious'
  description TEXT,
  regulation TEXT,     -- np. '561/2006 Art. 6 ust. 1'
  actual_value INTEGER,  -- faktyczny czas w minutach
  limit_value INTEGER,   -- limit w minutach
  FOREIGN KEY (file_id) REFERENCES tachograph_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tacho_viol_file ON tachograph_violations(file_id);
CREATE INDEX IF NOT EXISTS idx_tacho_viol_company ON tachograph_violations(company_id, violation_date DESC);
CREATE INDEX IF NOT EXISTS idx_tacho_viol_severity ON tachograph_violations(company_id, severity);

CREATE TABLE IF NOT EXISTS tachograph_vehicles_used (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  file_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  vehicle_reg TEXT,
  vin TEXT,
  first_use TEXT,
  last_use TEXT,
  FOREIGN KEY (file_id) REFERENCES tachograph_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tacho_veh_file ON tachograph_vehicles_used(file_id);
