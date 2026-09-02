-- schema_v41: Tabele dla 8 modułów szarej strefy

-- ⚠️ ZDUBLOWANA DEFINICJA (audyt 02.09.2026): `predictive_alerts` istnieje już
-- w schema_v35.sql z INNYM zestawem kolumn. `CREATE TABLE IF NOT EXISTS` wykonuje
-- pierwszą napotkaną definicję (v35, bo pliki idą numerycznie) i CICHO IGNORUJE tę.
-- Kod w worker/index.js jest pisany pod v35. Prawdziwe źródło to schema_v35.sql.
CREATE TABLE IF NOT EXISTS predictive_alerts (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id       TEXT NOT NULL,
  vehicle_reg      TEXT NOT NULL,
  alert_type       TEXT NOT NULL,
  trigger_type     TEXT DEFAULT 'mileage',
  interval_km      INTEGER,
  interval_days    INTEGER,
  last_service_date TEXT,
  last_service_km  INTEGER,
  current_km       INTEGER,
  predicted_due_date TEXT,
  predicted_due_km INTEGER,
  status           TEXT DEFAULT 'ok',
  active           INTEGER DEFAULT 1,
  notes            TEXT,
  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pred_co        ON predictive_alerts(company_id, active);
CREATE INDEX IF NOT EXISTS idx_pred_co_reg    ON predictive_alerts(company_id, vehicle_reg);

CREATE TABLE IF NOT EXISTS video_telematics_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  vehicle_reg     TEXT NOT NULL,
  driver_name     TEXT,
  event_type      TEXT NOT NULL,
  severity        TEXT DEFAULT 'medium',
  event_at        TEXT NOT NULL,
  speed_kmh       REAL,
  location        TEXT,
  clip_url        TEXT,
  camera_position TEXT DEFAULT 'front',
  device_id       TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vt_co         ON video_telematics_events(company_id, event_at);
CREATE INDEX IF NOT EXISTS idx_vt_co_reg     ON video_telematics_events(company_id, vehicle_reg);

-- ⚠️ ZDUBLOWANA DEFINICJA (audyt 02.09.2026): `gdpr_records` istnieje już
-- w schema_v34.sql z INNYM zestawem kolumn. `CREATE TABLE IF NOT EXISTS` wykonuje
-- pierwszą napotkaną definicję (v34) i CICHO IGNORUJE tę. Kod w worker/index.js
-- jest pisany pod v34. Prawdziwe źródło to schema_v34.sql.
CREATE TABLE IF NOT EXISTS gdpr_records (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id     TEXT NOT NULL,
  record_type    TEXT NOT NULL,
  subject_type   TEXT DEFAULT 'driver',
  subject_name   TEXT NOT NULL,
  subject_email  TEXT,
  description    TEXT,
  legal_basis    TEXT,
  retention_days INTEGER,
  retention_until TEXT,
  status         TEXT DEFAULT 'active',
  handled_by     TEXT,
  notes          TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_gdpr_co       ON gdpr_records(company_id, status);
CREATE INDEX IF NOT EXISTS idx_gdpr_co_type  ON gdpr_records(company_id, record_type);

CREATE TABLE IF NOT EXISTS esg_targets (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  metric_key      TEXT NOT NULL,
  year            INTEGER NOT NULL,
  target_value    REAL NOT NULL,
  unit            TEXT,
  lower_is_better INTEGER DEFAULT 1,
  description     TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_esg_co_year   ON esg_targets(company_id, year);

CREATE TABLE IF NOT EXISTS carpooling_trips (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id     TEXT NOT NULL,
  driver_id      TEXT,
  driver_name    TEXT NOT NULL,
  vehicle_id     TEXT,
  vehicle_reg    TEXT,
  trip_date      TEXT NOT NULL,
  departure_time TEXT,
  origin         TEXT,
  destination    TEXT,
  available_seats INTEGER DEFAULT 3,
  distance_km    REAL DEFAULT 0,
  cost_pln       REAL DEFAULT 0,
  participants   TEXT,
  status         TEXT DEFAULT 'open',
  notes          TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cp_co_date    ON carpooling_trips(company_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_cp_co_status  ON carpooling_trips(company_id, status);

CREATE TABLE IF NOT EXISTS internal_rentals (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id            TEXT NOT NULL,
  vehicle_id            TEXT,
  vehicle_reg           TEXT,
  renter_department     TEXT NOT NULL,
  renter_person         TEXT,
  start_datetime        TEXT NOT NULL,
  end_datetime          TEXT,
  mileage_start         INTEGER,
  mileage_end           INTEGER,
  purpose               TEXT,
  cost_rate_pln_per_km  REAL DEFAULT 0.89,
  cost_rate_pln_per_day REAL DEFAULT 0,
  distance_km           REAL DEFAULT 0,
  total_cost_pln        REAL DEFAULT 0,
  status                TEXT DEFAULT 'active',
  invoice_number        TEXT,
  notes                 TEXT,
  created_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_irent_co       ON internal_rentals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_irent_co_start ON internal_rentals(company_id, start_datetime);

-- ⚠️ ZDUBLOWANA DEFINICJA (audyt 02.09.2026): `disposal_records` istnieje już
-- w schema_v35.sql z INNYM zestawem kolumn. `CREATE TABLE IF NOT EXISTS` wykonuje
-- pierwszą napotkaną definicję (v35) i CICHO IGNORUJE tę. Kod w worker/index.js
-- jest pisany pod v35. Prawdziwe źródło to schema_v35.sql.
CREATE TABLE IF NOT EXISTS disposal_records (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  vehicle_reg     TEXT NOT NULL,
  reason          TEXT NOT NULL,
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  mileage_final_km INTEGER,
  book_value_pln  REAL,
  sale_price_pln  REAL,
  buyer_name      TEXT,
  buyer_nip       TEXT,
  document_number TEXT,
  status          TEXT DEFAULT 'in_progress',
  notes           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_disp_co        ON disposal_records(company_id, status);
CREATE INDEX IF NOT EXISTS idx_disp_co_reg    ON disposal_records(company_id, vehicle_reg);

-- ⚠️ ZDUBLOWANA DEFINICJA (audyt 02.09.2026): `warranties_recalls` istnieje już
-- w schema_v35.sql z INNYM zestawem kolumn. `CREATE TABLE IF NOT EXISTS` wykonuje
-- pierwszą napotkaną definicję (v35) i CICHO IGNORUJE tę. Kod w worker/index.js
-- jest pisany pod v35. Prawdziwe źródło to schema_v35.sql.
CREATE TABLE IF NOT EXISTS warranties_recalls (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  vehicle_reg     TEXT NOT NULL,
  record_type     TEXT NOT NULL,
  title           TEXT NOT NULL,
  provider        TEXT,
  recall_number   TEXT,
  start_date      TEXT,
  end_date        TEXT,
  mileage_limit_km INTEGER,
  recall_status   TEXT DEFAULT 'open',
  cost_pln        REAL DEFAULT 0,
  description     TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_warr_co        ON warranties_recalls(company_id, record_type);
CREATE INDEX IF NOT EXISTS idx_warr_co_reg    ON warranties_recalls(company_id, vehicle_reg);
CREATE INDEX IF NOT EXISTS idx_warr_co_status ON warranties_recalls(company_id, recall_status);
