-- Kierowcy — kartoteka per firma, migracja z localStorage do D1
CREATE TABLE IF NOT EXISTS drivers (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  license_no     TEXT,
  license_expiry TEXT,
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  -- Przeniesione z ALTER-ow w schema_v30.sql (patrz komentarz w tamtych plikach).
  cpc_card_number TEXT,
  -- Przeniesione z ALTER-ow w schema_v30.sql.
  cpc_expiry_date TEXT,  -- YYYY-MM-DD
  cpc_training_hours INTEGER DEFAULT 0,  -- z 35h co 5 lat
  cpc_training_deadline TEXT  -- data kolejnego bloku szkoleniowego
);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_company_name ON drivers(company_id, name);
