-- schema v21: Polisy ubezpieczeniowe + Harmonogram serwisowy + Rozliczenia km
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v21.sql

-- Historia polis ubezpieczeniowych (OC/AC/NNW) per pojazd
CREATE TABLE IF NOT EXISTS policies (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  nr_rej       TEXT NOT NULL,
  vin          TEXT,
  type         TEXT NOT NULL DEFAULT 'oc' CHECK(type IN ('oc','ac','nnw','assistance','inne')),
  policy_number TEXT,
  insurer      TEXT,
  premium      REAL,
  installments INTEGER DEFAULT 1,
  start_date   TEXT,
  end_date     TEXT,
  notes        TEXT,
  doc_id       TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_policies_vehicle  ON policies(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_policies_end      ON policies(end_date);

-- Harmonogram serwisowy — interwały km/miesiące per pojazd
CREATE TABLE IF NOT EXISTS service_schedules (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL,
  nr_rej         TEXT NOT NULL,
  name           TEXT NOT NULL,
  interval_km    INTEGER,
  interval_months INTEGER,
  last_km        INTEGER,
  last_date      TEXT,
  next_km        INTEGER,
  next_date      TEXT,
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sched_vehicle ON service_schedules(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_sched_next    ON service_schedules(next_km, next_date);

-- Rozliczenia km pracowniczych (delegacje, ryczałt)
CREATE TABLE IF NOT EXISTS mileage_claims (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  nr_rej       TEXT,
  driver_name  TEXT NOT NULL,
  claim_date   TEXT NOT NULL,
  km_start     INTEGER,
  km_end       INTEGER,
  km_total     INTEGER,
  purpose      TEXT,
  rate         REAL  DEFAULT 0.89,
  amount       REAL,
  status       TEXT  DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
  notes        TEXT,
  approved_by  TEXT,
  approved_at  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_claims_company ON mileage_claims(company_id, claim_date);
CREATE INDEX IF NOT EXISTS idx_claims_driver  ON mileage_claims(driver_name);
CREATE INDEX IF NOT EXISTS idx_claims_status  ON mileage_claims(status);
