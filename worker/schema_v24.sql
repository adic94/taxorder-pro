-- Schema v24: Paliwo (tabela), Budżety, Usterki, Czas pracy, Tachograf,
--             Konta GL, Subskrypcje raportów, Tokeny pojazdów

-- ─── PALIWO ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_fills (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id   TEXT NOT NULL,
  nr_rej       TEXT NOT NULL,
  branch_id    INTEGER REFERENCES branches(id),
  driver_name  TEXT,
  fill_date    TEXT NOT NULL,
  liters       REAL NOT NULL,
  price_per_liter REAL,
  total_cost   REAL,
  odometer     INTEGER,
  station      TEXT,
  card_no      TEXT,
  full_tank    INTEGER DEFAULT 1,
  fuel_type    TEXT DEFAULT 'diesel',
  co2_kg       REAL,
  gl_account   TEXT,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fuel_fills_company  ON fuel_fills(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_fills_vehicle  ON fuel_fills(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_fuel_fills_date     ON fuel_fills(fill_date);
CREATE INDEX IF NOT EXISTS idx_fuel_fills_branch   ON fuel_fills(branch_id);

-- ─── BUDŻETY ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT NOT NULL,
  branch_id    INTEGER REFERENCES branches(id),
  nr_rej       TEXT,
  year         INTEGER NOT NULL,
  month        INTEGER,
  category     TEXT NOT NULL,
  amount       REAL NOT NULL,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_budgets_company ON budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year    ON budgets(company_id, year);

-- ─── USTERKI (zgłoszenia kierowców) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faults (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  nr_rej           TEXT NOT NULL,
  branch_id        INTEGER REFERENCES branches(id),
  reported_by      TEXT,
  report_date      TEXT NOT NULL,
  description      TEXT NOT NULL,
  severity         TEXT DEFAULT 'low',
  status           TEXT DEFAULT 'open',
  resolved_by      TEXT,
  resolved_at      TEXT,
  service_order_id TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_faults_company ON faults(company_id);
CREATE INDEX IF NOT EXISTS idx_faults_vehicle ON faults(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_faults_status  ON faults(company_id, status);

-- ─── CZAS PRACY KIEROWCÓW ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_shifts (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  driver_name      TEXT NOT NULL,
  nr_rej           TEXT,
  branch_id        INTEGER REFERENCES branches(id),
  shift_date       TEXT NOT NULL,
  start_time       TEXT,
  end_time         TEXT,
  break_minutes    INTEGER DEFAULT 0,
  work_minutes     INTEGER,
  overtime_minutes INTEGER DEFAULT 0,
  shift_type       TEXT DEFAULT 'normal',
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_company ON driver_shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver  ON driver_shifts(company_id, driver_name);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_date    ON driver_shifts(shift_date);

-- ─── ARCHIWUM TACHOGRAFU ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tacho_records (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id    TEXT NOT NULL,
  nr_rej        TEXT NOT NULL,
  driver_name   TEXT,
  download_date TEXT NOT NULL,
  period_from   TEXT,
  period_to     TEXT,
  file_name     TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tacho_company ON tacho_records(company_id);
CREATE INDEX IF NOT EXISTS idx_tacho_vehicle ON tacho_records(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_tacho_date    ON tacho_records(download_date);

-- ─── KONTA GL (mapowanie kosztów na konta księgowe) ──────────────────────────
CREATE TABLE IF NOT EXISTS gl_accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  TEXT NOT NULL,
  cost_type   TEXT NOT NULL,
  gl_account  TEXT NOT NULL,
  description TEXT,
  UNIQUE(company_id, cost_type)
);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_company ON gl_accounts(company_id);

-- ─── SUBSKRYPCJE RAPORTÓW EMAIL ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT NOT NULL,
  email        TEXT NOT NULL,
  report_type  TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER DEFAULT 1,
  active       INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, email, report_type)
);
CREATE INDEX IF NOT EXISTS idx_report_subs_company ON report_subscriptions(company_id);

-- ─── TOKENY POJAZDÓW (formularz kierowcy bez logowania) ──────────────────────
CREATE TABLE IF NOT EXISTS vehicle_tokens (
  token      TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  nr_rej     TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicle_tokens_vehicle ON vehicle_tokens(company_id, nr_rej);

-- ALTER-y ADD COLUMN przeniesione do CREATE TABLE w plikach zrodlowych tabel.
-- NIE przywracaj ich tutaj: padaly przy kazdym powtorzeniu ('duplicate column name'),
-- a import D1 z --file jest transakcyjny per plik — jeden taki blad wycofywal CALY
-- ten plik razem z tabelami, ktore zaklada, wiec stawaly sie nie do odtworzenia.
