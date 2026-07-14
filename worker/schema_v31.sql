-- Schema v31: Jazda prywatna/służbowa, Geofencing, Smart Forms, Wynagrodzenia, Koszty tras, EV ładowanie

-- Przejazdy — rejestr z kategoryzacją prywatna/służbowa (GDPR)
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  driver_id TEXT,
  driver_name TEXT,
  trip_date TEXT NOT NULL,                    -- YYYY-MM-DD
  start_time TEXT,                            -- HH:MM
  end_time TEXT,
  start_location TEXT,
  end_location TEXT,
  distance_km REAL DEFAULT 0,
  fuel_liters REAL DEFAULT 0,
  category TEXT DEFAULT 'business',           -- 'business' | 'private'
  purpose TEXT,                               -- cel podróży
  notes TEXT,
  confirmed INTEGER DEFAULT 0,               -- kierowca potwierdził
  confirmed_at TEXT,
  source TEXT DEFAULT 'manual',              -- 'manual' | 'gps' | 'driver_app'
  gps_track TEXT,                            -- JSON array [{lat,lon,ts}]
  cost_fuel REAL DEFAULT 0,
  cost_toll REAL DEFAULT 0,
  cost_total REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver  ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date    ON trips(trip_date);

-- Strefy geofencing
CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT DEFAULT 'circle',           -- 'circle' | 'polygon'
  center_lat REAL,
  center_lon REAL,
  radius_m INTEGER DEFAULT 500,
  polygon_coords TEXT,                       -- JSON [[lat,lon], ...]
  alert_enter INTEGER DEFAULT 1,
  alert_exit INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  color TEXT DEFAULT '#2563eb',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_geofences_company ON geofences(company_id);

-- Zdarzenia geofencing (wjazd/wyjazd)
CREATE TABLE IF NOT EXISTS geofence_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  geofence_id TEXT NOT NULL,
  geofence_name TEXT,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  driver_name TEXT,
  event_type TEXT NOT NULL,                  -- 'enter' | 'exit'
  event_time TEXT DEFAULT (datetime('now')),
  lat REAL,
  lon REAL,
  speed_kmh REAL,
  notified INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gf_events_company   ON geofence_events(company_id);
CREATE INDEX IF NOT EXISTS idx_gf_events_geofence  ON geofence_events(geofence_id);
CREATE INDEX IF NOT EXISTS idx_gf_events_time      ON geofence_events(event_time);

-- Szablony Smart Forms
CREATE TABLE IF NOT EXISTS smart_form_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',           -- 'vehicle_check' | 'incident' | 'delivery' | 'general'
  fields TEXT NOT NULL DEFAULT '[]',         -- JSON schema pól formularza
  active INTEGER DEFAULT 1,
  require_signature INTEGER DEFAULT 0,
  require_photo INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sft_company ON smart_form_templates(company_id);

-- Wypełnione formularze Smart Forms
CREATE TABLE IF NOT EXISTS smart_form_submissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_name TEXT,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  driver_id TEXT,
  driver_name TEXT,
  submitted_by TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  data TEXT NOT NULL DEFAULT '{}',           -- JSON odpowiedzi
  signature_data TEXT,                       -- base64 PNG
  photos TEXT DEFAULT '[]',                  -- JSON array URL do R2
  status TEXT DEFAULT 'submitted',           -- 'submitted' | 'reviewed' | 'action_required'
  reviewer_notes TEXT,
  location_lat REAL,
  location_lon REAL
);
CREATE INDEX IF NOT EXISTS idx_sfs_company  ON smart_form_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_sfs_template ON smart_form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_sfs_vehicle  ON smart_form_submissions(vehicle_id);

-- Wynagrodzenia kierowców (rozliczenia na podstawie danych tachografu)
CREATE TABLE IF NOT EXISTS driver_wages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  period_month TEXT NOT NULL,               -- YYYY-MM
  base_salary REAL DEFAULT 0,
  driving_hours REAL DEFAULT 0,
  work_hours REAL DEFAULT 0,
  total_hours REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  night_hours REAL DEFAULT 0,
  distance_km REAL DEFAULT 0,
  daily_allowances REAL DEFAULT 0,          -- diety
  night_bonus REAL DEFAULT 0,
  overtime_bonus REAL DEFAULT 0,
  eco_bonus REAL DEFAULT 0,                 -- premia eco-driving
  penalty_deduction REAL DEFAULT 0,         -- potrącenie za naruszenia
  gross_total REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  net_total REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',              -- 'draft' | 'approved' | 'paid'
  notes TEXT,
  calculated_at TEXT DEFAULT (datetime('now')),
  approved_at TEXT,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wages_company ON driver_wages(company_id);
CREATE INDEX IF NOT EXISTS idx_wages_driver  ON driver_wages(driver_id);
CREATE INDEX IF NOT EXISTS idx_wages_period  ON driver_wages(period_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wages_uniq ON driver_wages(company_id, driver_name, period_month);

-- Stawki wynagrodzeń per kierowca
CREATE TABLE IF NOT EXISTS driver_wage_rates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  hourly_rate REAL DEFAULT 0,               -- PLN/h podstawowa
  night_rate_mult REAL DEFAULT 1.2,         -- mnożnik nocna
  overtime_rate_mult REAL DEFAULT 1.5,      -- mnożnik nadgodziny
  daily_allowance REAL DEFAULT 45.0,        -- dieta krajowa (urzędowa 2024)
  foreign_allowance REAL DEFAULT 52.0,      -- dieta zagraniczna (EUR przeliczone)
  tax_rate REAL DEFAULT 0.12,               -- zaliczka PIT
  valid_from TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wage_rates_company ON driver_wage_rates(company_id);

-- Ładowanie pojazdów EV (sesje ładowania)
CREATE TABLE IF NOT EXISTS ev_charging_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  session_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  charger_type TEXT,                        -- 'AC_slow' | 'AC_fast' | 'DC_fast' | 'DC_rapid'
  energy_kwh REAL DEFAULT 0,
  cost_pln REAL DEFAULT 0,
  cost_per_kwh REAL DEFAULT 0,
  charged_from_pct INTEGER,
  charged_to_pct INTEGER,
  range_after_km INTEGER,
  provider TEXT,                            -- np. 'Orlen Charge', 'GreenWay', 'home'
  home_charging INTEGER DEFAULT 0,          -- ładowanie domowe (refundacja)
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ev_charge_company ON ev_charging_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_ev_charge_vehicle ON ev_charging_sessions(vehicle_id);

-- Profile kosztów tras (kalkulator)
CREATE TABLE IF NOT EXISTS route_cost_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Domyślny',
  fuel_price_pln REAL DEFAULT 6.50,
  fuel_norm_l100 REAL DEFAULT 8.0,
  toll_rate_per_km REAL DEFAULT 0.0,
  driver_cost_per_km REAL DEFAULT 1.20,     -- koszt kierowcy / km
  depreciation_per_km REAL DEFAULT 0.35,    -- amortyzacja / km
  other_per_km REAL DEFAULT 0.10,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rcp_company ON route_cost_profiles(company_id);

-- Integracje GPS (Teltonika, Webfleet, Samsara)
CREATE TABLE IF NOT EXISTS gps_integrations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  provider TEXT NOT NULL,                   -- 'teltonika' | 'webfleet' | 'samsara' | 'navifleet'
  config TEXT NOT NULL DEFAULT '{}',        -- JSON: api_url, token, account_id
  enabled INTEGER DEFAULT 1,
  last_sync TEXT,
  sync_error TEXT,
  vehicles_tracked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_int_co_prov ON gps_integrations(company_id, provider);
CREATE INDEX IF NOT EXISTS idx_gps_int_company ON gps_integrations(company_id);
