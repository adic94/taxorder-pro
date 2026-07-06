-- Mandaty i naruszenia — ewidencja per firma/pojazd/kierowca, migracja z localStorage do D1
CREATE TABLE IF NOT EXISTS fines (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  nr_rej       TEXT,
  driver_name  TEXT,
  type         TEXT NOT NULL DEFAULT 'inne',
  date         TEXT NOT NULL,
  amount       REAL,
  deadline     TEXT,
  description  TEXT,
  fine_no      TEXT,
  issuer       TEXT,
  points       INTEGER,
  notes        TEXT,
  paid         INTEGER NOT NULL DEFAULT 0,
  paid_date    TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fines_company ON fines(company_id);
CREATE INDEX IF NOT EXISTS idx_fines_nrrej   ON fines(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_fines_unpaid  ON fines(company_id, paid, deadline);
