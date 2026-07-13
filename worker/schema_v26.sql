-- TaxOrder Pro — Schema v26
-- 8 nowych tabel: transport_orders, driver_schedules, audit_logs,
-- fuel_card_imports, tco_config, budget_annual, approval_levels, gps_positions
-- Łącznie: 57 tabel

CREATE TABLE IF NOT EXISTS transport_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT,
  vehicle_id TEXT,
  nr_rej TEXT,
  origin TEXT,
  destination TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  actual_start TEXT,
  actual_end TEXT,
  distance_km REAL,
  cargo_desc TEXT,
  cargo_weight_kg REAL,
  status TEXT DEFAULT 'planned',
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  branch_id TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS driver_schedules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  driver_name TEXT,
  vehicle_id TEXT,
  nr_rej TEXT,
  scheduled_date TEXT NOT NULL,
  shift_type TEXT DEFAULT 'day',
  start_time TEXT,
  end_time TEXT,
  route TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  user_id TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fuel_card_imports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  filename TEXT,
  card_provider TEXT DEFAULT 'other',
  imported_at TEXT DEFAULT (datetime('now')),
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS tco_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  nr_rej TEXT,
  purchase_price REAL,
  purchase_date TEXT,
  expected_life_years INTEGER DEFAULT 5,
  residual_value REAL DEFAULT 0,
  depreciation_method TEXT DEFAULT 'linear',
  monthly_leasing REAL,
  co2_g_per_km REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS budget_annual (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  category TEXT NOT NULL,
  planned_amount REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, year, category)
);

CREATE TABLE IF NOT EXISTS approval_levels (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  min_amount REAL NOT NULL DEFAULT 0,
  max_amount REAL,
  approver_email TEXT NOT NULL,
  approver_name TEXT,
  entity_types TEXT DEFAULT 'all',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, level)
);

CREATE TABLE IF NOT EXISTS gps_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  nr_rej TEXT,
  lat REAL,
  lng REAL,
  speed REAL,
  odometer REAL,
  heading REAL,
  ignition INTEGER DEFAULT 0,
  recorded_at TEXT NOT NULL,
  source TEXT DEFAULT 'webhook',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transport_orders_company ON transport_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_schedules_company ON driver_schedules(company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gps_positions_vehicle ON gps_positions(company_id, vehicle_id, recorded_at);
