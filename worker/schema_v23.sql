-- Schema v23: Oddziały (branches) — podział floty i archiwum kosztów
CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now')),
  UNIQUE(company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);

ALTER TABLE vehicles       ADD COLUMN branch_id INTEGER REFERENCES branches(id);
ALTER TABLE service_orders ADD COLUMN branch_id INTEGER;
ALTER TABLE fines          ADD COLUMN branch_id INTEGER;
ALTER TABLE damage_reports ADD COLUMN branch_id INTEGER;
ALTER TABLE tires          ADD COLUMN branch_id INTEGER;
ALTER TABLE mileage_claims ADD COLUMN branch_id INTEGER;
ALTER TABLE policies       ADD COLUMN branch_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_vehicles_branch ON vehicles(branch_id);
