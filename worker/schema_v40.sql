-- schema_v40: Brakujące tabele dla modułów fleet-reservations, trip-private, geofencing

-- Rezerwacje pojazdów (fleet-reservations.js)
CREATE TABLE IF NOT EXISTS reservations (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  nr_rej     TEXT NOT NULL,
  user_name  TEXT NOT NULL,
  start      TEXT NOT NULL,
  end        TEXT,
  status     TEXT DEFAULT 'confirmed',
  notes      TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_res_co_start ON reservations(company_id, start);
CREATE INDEX IF NOT EXISTS idx_res_co_reg   ON reservations(company_id, nr_rej);

-- Przejazdy prywatne / służbowe (trip-private.js)
CREATE TABLE IF NOT EXISTS trips (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id     TEXT NOT NULL,
  trip_date      TEXT NOT NULL,
  category       TEXT DEFAULT 'business',
  vehicle_reg    TEXT,
  driver_name    TEXT,
  start_time     TEXT,
  end_time       TEXT,
  start_location TEXT,
  end_location   TEXT,
  distance_km    REAL DEFAULT 0,
  cost_fuel      REAL DEFAULT 0,
  purpose        TEXT,
  notes          TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_trips_co_date ON trips(company_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_co_reg  ON trips(company_id, vehicle_reg);

-- Strefy geofencing (geofencing.js)
CREATE TABLE IF NOT EXISTS geofences (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  zone_type   TEXT DEFAULT 'circle',
  center_lat  REAL DEFAULT 0,
  center_lon  REAL DEFAULT 0,
  radius_m    INTEGER DEFAULT 500,
  color       TEXT DEFAULT '#2563eb',
  alert_enter INTEGER DEFAULT 0,
  alert_exit  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_gf_co ON geofences(company_id, active);

-- Zdarzenia geofencing (wejście/wyjście)
CREATE TABLE IF NOT EXISTS geofence_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id  TEXT NOT NULL,
  geofence_id TEXT,
  event_type  TEXT,
  vehicle_reg TEXT,
  driver      TEXT,
  event_time  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  lat         REAL,
  lon         REAL
);
CREATE INDEX IF NOT EXISTS idx_gfe_co_time ON geofence_events(company_id, event_time);
CREATE INDEX IF NOT EXISTS idx_gfe_gfid    ON geofence_events(geofence_id);
