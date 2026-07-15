-- schema_v38: Delegacje + Inwentaryzacja floty (migracja z localStorage do D1)

CREATE TABLE IF NOT EXISTS delegations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver TEXT NOT NULL,
  nr_rej TEXT,
  destination TEXT,
  purpose TEXT,
  date_from TEXT NOT NULL,
  date_to TEXT,
  country TEXT DEFAULT 'Polska',
  km_driven REAL DEFAULT 0,
  km_rate REAL DEFAULT 0.89,
  diet_days REAL DEFAULT 0,
  diet_rate REAL DEFAULT 45,
  hotel_cost REAL DEFAULT 0,
  other_costs REAL DEFAULT 0,
  total_pln REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_del_company ON delegations(company_id);
CREATE INDEX IF NOT EXISTS idx_del_date    ON delegations(date_from);
CREATE INDEX IF NOT EXISTS idx_del_status  ON delegations(status);
CREATE INDEX IF NOT EXISTS idx_del_driver  ON delegations(driver);

CREATE TABLE IF NOT EXISTS fleet_inventory_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',        -- 'active'|'completed'|'cancelled'
  checked_vehicles TEXT DEFAULT '[]',  -- JSON [nrRej, ...]
  notes TEXT DEFAULT '{}',             -- JSON {nrRej: {lokalizacja, uwagi}}
  vehicle_count INTEGER DEFAULT 0,
  checked_count INTEGER DEFAULT 0,
  completed_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_fis_company ON fleet_inventory_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_fis_status  ON fleet_inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_fis_date    ON fleet_inventory_sessions(session_date);
