-- Schema v34: KSeF, Inspekcje, Wymiana floty, Szkolenia, Limity, Parking, Wynajem wewn., Carpooling, RODO, Waluty

CREATE TABLE IF NOT EXISTS ksef_invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  local_invoice_id TEXT,              -- route_invoices.id
  invoice_number TEXT NOT NULL,
  ksef_number TEXT,                   -- numer KSeF po akceptacji
  ksef_status TEXT DEFAULT 'pending', -- 'pending'|'sent'|'accepted'|'rejected'
  ksef_date TEXT,
  qr_code TEXT,
  upo_url TEXT,                       -- URL do UPO (Urzędowe Poświadczenie Odbioru)
  error_message TEXT,
  seller_nip TEXT,
  buyer_nip TEXT,
  gross_pln REAL,
  xml_payload TEXT,                   -- opcjonalnie — przechowaj wygenerowany XML
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ksef_company ON ksef_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_ksef_status  ON ksef_invoices(ksef_status);

CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  inspection_date TEXT NOT NULL,
  inspector_name TEXT,
  mileage_km INTEGER,
  overall_status TEXT DEFAULT 'ok',   -- 'ok'|'warning'|'fail'
  checklist TEXT DEFAULT '[]',        -- JSON [{item,status,note}]
  photo_urls TEXT DEFAULT '[]',       -- JSON array URL R2
  notes TEXT,
  next_inspection_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_insp_company ON vehicle_inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_insp_vehicle ON vehicle_inspections(vehicle_id);

CREATE TABLE IF NOT EXISTS fleet_renewal_plan (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  current_age_months INTEGER,
  current_mileage_km INTEGER,
  renewal_reason TEXT,                -- 'age'|'mileage'|'cost'|'manual'
  planned_replacement_date TEXT,
  replacement_budget_pln REAL,
  replacement_vehicle_desc TEXT,
  status TEXT DEFAULT 'planned',      -- 'planned'|'in_progress'|'done'|'cancelled'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_renewal_company ON fleet_renewal_plan(company_id);

CREATE TABLE IF NOT EXISTS driver_training_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  record_type TEXT DEFAULT 'training', -- 'training'|'medical'|'psycho'|'license_renewal'
  title TEXT NOT NULL,
  provider TEXT,
  start_date TEXT,
  end_date TEXT,
  valid_until TEXT,
  cost_pln REAL DEFAULT 0,
  certificate_number TEXT,
  result TEXT DEFAULT 'passed',       -- 'passed'|'failed'|'pending'
  notes TEXT,
  document_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dtr_company ON driver_training_records(company_id);
CREATE INDEX IF NOT EXISTS idx_dtr_driver  ON driver_training_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_dtr_expiry  ON driver_training_records(valid_until);

CREATE TABLE IF NOT EXISTS fleet_limits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  limit_scope TEXT NOT NULL,          -- 'vehicle'|'driver'
  scope_id TEXT,                      -- vehicle_id lub driver_id
  scope_label TEXT,                   -- nr rej. lub imię kierowcy
  period TEXT DEFAULT 'monthly',      -- 'daily'|'weekly'|'monthly'|'annual'
  fuel_limit_liters REAL,
  fuel_limit_pln REAL,
  mileage_limit_km INTEGER,
  private_mileage_limit_km INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_limits_scope ON fleet_limits(company_id, limit_scope, scope_id, period);

CREATE TABLE IF NOT EXISTS parking_spots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  spot_number TEXT NOT NULL,
  location TEXT,
  spot_type TEXT DEFAULT 'standard',  -- 'standard'|'ev'|'bus'|'disabled'|'reserved'
  assigned_vehicle_id TEXT,
  assigned_vehicle_reg TEXT,
  assigned_from TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_parking_company ON parking_spots(company_id);

CREATE TABLE IF NOT EXISTS internal_rentals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  renter_department TEXT NOT NULL,
  renter_person TEXT,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT,
  mileage_start INTEGER,
  mileage_end INTEGER,
  purpose TEXT,
  cost_rate_pln_per_km REAL DEFAULT 0.89, -- stawka ryczałtowa
  cost_rate_pln_per_day REAL DEFAULT 0,
  distance_km REAL,
  total_cost_pln REAL,
  status TEXT DEFAULT 'active',       -- 'active'|'returned'|'invoiced'
  invoice_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_irent_company ON internal_rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_irent_vehicle ON internal_rentals(vehicle_id);

CREATE TABLE IF NOT EXISTS carpooling_trips (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  trip_date TEXT NOT NULL,
  departure_time TEXT,
  origin TEXT,
  destination TEXT,
  available_seats INTEGER DEFAULT 3,
  distance_km REAL,
  cost_pln REAL DEFAULT 0,
  participants TEXT DEFAULT '[]',     -- JSON [{name,department,pickup_point}]
  status TEXT DEFAULT 'open',         -- 'open'|'full'|'completed'|'cancelled'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cpool_company ON carpooling_trips(company_id);
CREATE INDEX IF NOT EXISTS idx_cpool_date    ON carpooling_trips(trip_date);

CREATE TABLE IF NOT EXISTS gdpr_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  record_type TEXT NOT NULL,          -- 'consent'|'request'|'deletion'|'export'|'breach'
  subject_type TEXT DEFAULT 'driver', -- 'driver'|'employee'|'client'
  subject_name TEXT,
  subject_email TEXT,
  description TEXT,
  legal_basis TEXT,                   -- np. 'art. 6 ust. 1 lit. b RODO'
  retention_days INTEGER,             -- ile dni przechowujemy dane
  retention_until TEXT,
  status TEXT DEFAULT 'active',       -- 'active'|'fulfilled'|'deleted'|'expired'
  handled_by TEXT,
  handled_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gdpr_company ON gdpr_records(company_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_type    ON gdpr_records(record_type);

CREATE TABLE IF NOT EXISTS currency_rates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,        -- 'EUR'|'USD'|'GBP'|'CZK'|'DKK' itd.
  rate_to_pln REAL NOT NULL,          -- 1 waluta = X PLN
  rate_date TEXT NOT NULL,
  source TEXT DEFAULT 'manual',       -- 'manual'|'nbp'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cur_co_code_date ON currency_rates(company_id, currency_code, rate_date);
CREATE INDEX IF NOT EXISTS idx_cur_company ON currency_rates(company_id);
