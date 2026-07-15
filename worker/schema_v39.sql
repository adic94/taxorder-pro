-- schema_v39: Plany budzetowe floty (migracja z localStorage do D1)

CREATE TABLE IF NOT EXISTS budget_plans (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  year       INTEGER NOT NULL,
  fuel       REAL DEFAULT 0,
  service    REAL DEFAULT 0,
  insur      REAL DEFAULT 0,
  tax        REAL DEFAULT 0,
  fines      REAL DEFAULT 0,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(company_id, year)
);
CREATE INDEX IF NOT EXISTS idx_bp_company_year ON budget_plans(company_id, year);
