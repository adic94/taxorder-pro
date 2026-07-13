-- Schema v25: Funkcje managera floty
-- driver_profiles, vehicle_reservations, fleet_policies, approvals,
-- spare_parts, service_contracts, supplier_invoices

-- ─── KARTOTEKA KIEROWCÓW ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_profiles (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  branch_id       INTEGER REFERENCES branches(id),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  employee_id     TEXT,
  email           TEXT,
  phone           TEXT,
  birth_date      TEXT,
  license_number  TEXT,
  license_categories TEXT,       -- JSON: ["B","C","CE"]
  license_expiry  TEXT,
  medical_expiry  TEXT,
  psychotech_expiry TEXT,
  assigned_nr_rej TEXT,
  status          TEXT DEFAULT 'active',   -- active, inactive, suspended
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dp_company  ON driver_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_dp_status   ON driver_profiles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_dp_license  ON driver_profiles(license_expiry);

-- ─── REZERWACJE POJAZDÓW ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_reservations (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  nr_rej           TEXT NOT NULL,
  driver_name      TEXT NOT NULL,
  driver_id        TEXT REFERENCES driver_profiles(id),
  date_from        TEXT NOT NULL,
  date_to          TEXT NOT NULL,
  purpose          TEXT,
  destination      TEXT,
  expected_km      INTEGER,
  actual_km        INTEGER,
  status           TEXT DEFAULT 'pending',  -- pending, approved, rejected, completed, cancelled
  approved_by      TEXT,
  approved_at      TEXT,
  rejection_reason TEXT,
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vr_company ON vehicle_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_vr_vehicle ON vehicle_reservations(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_vr_dates   ON vehicle_reservations(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_vr_status  ON vehicle_reservations(company_id, status);

-- ─── POLITYKI FLOTOWE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet_policies (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id                  TEXT NOT NULL UNIQUE,
  service_approval_threshold  REAL DEFAULT 2000,
  damage_approval_threshold   REAL DEFAULT 500,
  mileage_approval_threshold  REAL DEFAULT 1000,
  fuel_norm_diesel            REAL DEFAULT 8.0,
  fuel_norm_petrol            REAL DEFAULT 9.0,
  max_private_km              INTEGER DEFAULT 0,
  reservation_requires_approval INTEGER DEFAULT 1,
  license_alert_days          INTEGER DEFAULT 30,
  medical_alert_days          INTEGER DEFAULT 30,
  updated_at                  TEXT DEFAULT (datetime('now'))
);

-- ─── KOLEJKA ZATWIERDZEŃ ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  record_type      TEXT NOT NULL,  -- service_order, damage_report, mileage_claim, fine, reservation
  record_id        TEXT NOT NULL,
  nr_rej           TEXT,
  amount           REAL,
  description      TEXT,
  requested_by     TEXT,
  status           TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_by      TEXT,
  decided_at       TEXT,
  rejection_reason TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_approvals_company ON approvals(company_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status  ON approvals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_record  ON approvals(record_type, record_id);

-- ─── MAGAZYN CZĘŚCI ZAMIENNYCH ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id          TEXT NOT NULL,
  part_number         TEXT,
  name                TEXT NOT NULL,
  category            TEXT,           -- filtry, hamulce, oleje, opony, elektrika, inne
  compatible_models   TEXT,           -- JSON array of vehicle types/models
  quantity            INTEGER DEFAULT 0,
  min_quantity        INTEGER DEFAULT 1,
  unit                TEXT DEFAULT 'szt',
  unit_price          REAL,
  supplier            TEXT,
  location            TEXT,
  notes               TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sp_company  ON spare_parts(company_id);
CREATE INDEX IF NOT EXISTS idx_sp_category ON spare_parts(company_id, category);
CREATE INDEX IF NOT EXISTS idx_sp_low      ON spare_parts(company_id, quantity, min_quantity);

-- ─── TRANSAKCJE MAGAZYNOWE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  TEXT NOT NULL,
  part_id     TEXT NOT NULL REFERENCES spare_parts(id),
  nr_rej      TEXT,
  qty_change  INTEGER NOT NULL,   -- +dodanie, -pobranie
  reason      TEXT,
  user_name   TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spt_part ON spare_parts_transactions(part_id);

-- ─── KONTRAKTY Z SERWISAMI ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_contracts (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id        TEXT NOT NULL,
  workshop_name     TEXT NOT NULL,
  nip               TEXT,
  address           TEXT,
  contact_person    TEXT,
  phone             TEXT,
  email             TEXT,
  hourly_rate       REAL,
  parts_discount    REAL DEFAULT 0,  -- %
  contract_from     TEXT,
  contract_to       TEXT,
  services_covered  TEXT,            -- JSON: ["oil","brakes","tires"]
  payment_days      INTEGER DEFAULT 14,
  notes             TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sc_company ON service_contracts(company_id);

-- ─── FAKTURY OD DOSTAWCÓW ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id          TEXT NOT NULL,
  invoice_number      TEXT NOT NULL,
  supplier_name       TEXT NOT NULL,
  invoice_date        TEXT NOT NULL,
  due_date            TEXT,
  invoice_type        TEXT DEFAULT 'service',  -- fuel, service, parts, insurance, other
  total_net           REAL,
  total_vat           REAL,
  total_gross         REAL,
  status              TEXT DEFAULT 'pending',  -- pending, approved, paid, rejected
  service_contract_id TEXT REFERENCES service_contracts(id),
  gl_account          TEXT,
  notes               TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_si_company ON supplier_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_si_status  ON supplier_invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_si_date    ON supplier_invoices(invoice_date);

CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  TEXT NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  nr_rej      TEXT,
  description TEXT NOT NULL,
  quantity    REAL DEFAULT 1,
  unit_price  REAL,
  total       REAL,
  cost_type   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sii_invoice ON supplier_invoice_items(invoice_id);
