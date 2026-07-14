-- Schema v35: TCO, Zatwierdzenia, Serwis predykcyjny, Części, Gwarancje, Czas pracy,
--             Scoring, Dostawcy, Likwidacja, ESG, Raporty, CMR, SENT, Wiadomości, QR, JPK

CREATE TABLE IF NOT EXISTS tco_cost_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  category TEXT NOT NULL,   -- 'fuel'|'service'|'insurance'|'leasing'|'tax'|'tires'|'tolls'|'fines'|'other'
  amount_pln REAL NOT NULL DEFAULT 0,
  description TEXT,
  source_table TEXT,         -- 'fuel_entries'|'service_orders'|'insurance_policies' itd. (opcjonalne)
  source_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tco_company  ON tco_cost_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_tco_vehicle  ON tco_cost_entries(vehicle_reg);
CREATE INDEX IF NOT EXISTS idx_tco_date     ON tco_cost_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_tco_category ON tco_cost_entries(category);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  request_type TEXT NOT NULL,   -- 'rental'|'expense'|'purchase'|'disposal'|'trip'|'other'
  title TEXT NOT NULL,
  requester_id TEXT,
  requester_name TEXT,
  amount_pln REAL,
  description TEXT,
  attachments TEXT DEFAULT '[]', -- JSON URLs
  steps TEXT DEFAULT '[]',       -- JSON [{role, user_id, user_name, status, note, decided_at}]
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'
  priority TEXT DEFAULT 'normal',-- 'low'|'normal'|'high'|'urgent'
  due_date TEXT,
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appr_company   ON approval_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_appr_status    ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_appr_requester ON approval_requests(requester_id);

CREATE TABLE IF NOT EXISTS predictive_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT NOT NULL,
  alert_type TEXT NOT NULL,     -- 'oil_change'|'tires'|'brake_fluid'|'inspection'|'belt'|'coolant'|'battery'|'custom'
  trigger_type TEXT DEFAULT 'mileage', -- 'mileage'|'date'
  interval_km INTEGER,
  interval_days INTEGER,
  last_service_km INTEGER,
  last_service_date TEXT,
  current_km INTEGER,
  predicted_due_date TEXT,
  predicted_due_km INTEGER,
  status TEXT DEFAULT 'ok',     -- 'ok'|'soon'|'overdue'
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pred_company ON predictive_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_pred_status  ON predictive_alerts(status);
-- spare_parts already exists from schema_v25; sku column added via schema_v35_sku.sql

CREATE TABLE IF NOT EXISTS spare_part_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  part_id TEXT NOT NULL,
  part_name TEXT,
  transaction_type TEXT NOT NULL, -- 'in'|'out'|'adjustment'|'return'
  qty REAL NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  service_order_id TEXT,
  unit_price_pln REAL,
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spt_company ON spare_part_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_spt_part    ON spare_part_transactions(part_id);

CREATE TABLE IF NOT EXISTS warranties_recalls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT NOT NULL,
  record_type TEXT NOT NULL,     -- 'warranty'|'recall'|'extended_warranty'
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT,                 -- producent lub serwis
  start_date TEXT,
  end_date TEXT,
  mileage_limit_km INTEGER,
  recall_number TEXT,            -- numer kampanii producenta
  recall_status TEXT DEFAULT 'open', -- 'open'|'scheduled'|'completed'
  cost_pln REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_warr_company ON warranties_recalls(company_id);
CREATE INDEX IF NOT EXISTS idx_warr_vehicle ON warranties_recalls(vehicle_reg);

CREATE TABLE IF NOT EXISTS driver_work_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  vehicle_reg TEXT,
  session_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  break_minutes INTEGER DEFAULT 0,
  work_type TEXT DEFAULT 'driving', -- 'driving'|'loading'|'waiting'|'other'
  distance_km REAL,
  notes TEXT,
  source TEXT DEFAULT 'manual', -- 'manual'|'tachograph'|'gps'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dws_company ON driver_work_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_dws_driver  ON driver_work_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_dws_date    ON driver_work_sessions(session_date);

CREATE TABLE IF NOT EXISTS driver_behavior_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'hard_brake'|'hard_accel'|'speeding'|'sharp_turn'|'idle'|'phone'|'seatbelt'
  severity TEXT DEFAULT 'medium', -- 'low'|'medium'|'high'|'critical'
  value REAL,                -- np. prędkość w km/h, G-force
  location TEXT,
  penalty_points INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dbe_company ON driver_behavior_events(company_id);
CREATE INDEX IF NOT EXISTS idx_dbe_driver  ON driver_behavior_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_dbe_date    ON driver_behavior_events(event_date);

CREATE TABLE IF NOT EXISTS supplier_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other', -- 'fuel'|'service'|'insurance'|'tires'|'parts'|'leasing'|'rental'|'other'
  nip TEXT,
  address TEXT,
  city TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  rating INTEGER DEFAULT 3,       -- 1-5
  payment_terms_days INTEGER DEFAULT 30,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_supp_company ON supplier_records(company_id);

CREATE TABLE IF NOT EXISTS disposal_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT NOT NULL,
  reason TEXT NOT NULL,          -- 'sale'|'scrap'|'transfer'|'lease_end'|'accident_total_loss'
  start_date TEXT NOT NULL,
  end_date TEXT,
  mileage_final_km INTEGER,
  book_value_pln REAL,
  sale_price_pln REAL,
  buyer_name TEXT,
  buyer_nip TEXT,
  document_number TEXT,
  status TEXT DEFAULT 'in_progress', -- 'in_progress'|'completed'|'cancelled'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_disp_company ON disposal_records(company_id);

CREATE TABLE IF NOT EXISTS esg_targets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  co2_target_kg REAL,
  fuel_target_l REAL,
  ev_percentage_target REAL,
  electric_km_target REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_esg_co_year ON esg_targets(company_id, year);

CREATE TABLE IF NOT EXISTS report_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_table TEXT NOT NULL,    -- 'vehicles'|'fuel_entries'|'service_orders' itd.
  columns TEXT DEFAULT '[]',     -- JSON [col_name, ...]
  filters TEXT DEFAULT '[]',     -- JSON [{col, op, val}]
  group_by TEXT,
  sort_by TEXT,
  sort_dir TEXT DEFAULT 'DESC',
  created_by TEXT,
  is_public INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rpt_company ON report_configs(company_id);

CREATE TABLE IF NOT EXISTS cmr_documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  document_number TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  vehicle_reg TEXT,
  driver_name TEXT,
  shipper_name TEXT,
  shipper_address TEXT,
  receiver_name TEXT,
  receiver_address TEXT,
  origin_place TEXT,
  destination_place TEXT,
  goods_description TEXT,
  gross_weight_kg REAL,
  packages_count INTEGER,
  special_instructions TEXT,
  status TEXT DEFAULT 'draft',   -- 'draft'|'in_transit'|'delivered'|'cancelled'
  delivered_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cmr_company ON cmr_documents(company_id);

CREATE TABLE IF NOT EXISTS sent_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  notification_number TEXT,      -- nadany przez PUESC
  vehicle_reg TEXT NOT NULL,
  driver_name TEXT,
  goods_type TEXT NOT NULL,      -- 'paliwa'|'alkohole'|'tytoń'|'susz_tytoniowy'|'inne'
  sender_nip TEXT,
  sender_name TEXT,
  receiver_nip TEXT,
  receiver_name TEXT,
  origin_country TEXT DEFAULT 'PL',
  destination_country TEXT DEFAULT 'PL',
  planned_start TEXT,
  planned_end TEXT,
  status TEXT DEFAULT 'draft',   -- 'draft'|'sent'|'completed'|'cancelled'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sent_company ON sent_records(company_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  from_user_name TEXT,
  to_user_id TEXT,               -- NULL = broadcast
  to_vehicle_id TEXT,            -- opcjonalne: wiadomość powiązana z pojazdem
  subject TEXT,
  content TEXT NOT NULL,
  read_at TEXT,
  read_by TEXT DEFAULT '[]',     -- JSON [user_id, ...]
  priority TEXT DEFAULT 'normal',-- 'low'|'normal'|'high'|'urgent'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_company ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_msg_to      ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_msg_from    ON messages(from_user_id);

CREATE TABLE IF NOT EXISTS vehicle_qr_scans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT NOT NULL,
  scanned_by_name TEXT,
  action TEXT DEFAULT 'view',    -- 'view'|'report_issue'|'checkin'|'checkout'
  issue_description TEXT,
  latitude REAL,
  longitude REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qr_company ON vehicle_qr_scans(company_id);
CREATE INDEX IF NOT EXISTS idx_qr_vehicle ON vehicle_qr_scans(vehicle_reg);

CREATE TABLE IF NOT EXISTS jpk_exports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  export_type TEXT NOT NULL,     -- 'JPK_V7M'|'JPK_V7K'|'JPK_FA'|'JPK_MAG'|'SAF_T'
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  status TEXT DEFAULT 'generated', -- 'generated'|'sent'|'accepted'|'error'
  file_size_bytes INTEGER,
  xml_hash TEXT,
  sent_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jpk_company ON jpk_exports(company_id);

CREATE TABLE IF NOT EXISTS edoreczenia_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  direction TEXT NOT NULL,       -- 'incoming'|'outgoing'
  sender TEXT,
  recipient TEXT,
  subject TEXT NOT NULL,
  upo_id TEXT,                   -- Unique Proof of Delivery
  status TEXT DEFAULT 'new',     -- 'new'|'read'|'replied'|'archived'
  received_at TEXT,
  content_summary TEXT,
  attachments TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edor_company ON edoreczenia_items(company_id);
