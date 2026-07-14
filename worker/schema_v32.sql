-- Schema v32: Ubezpieczenia, Faktury zleceń, KPI agregacje, konfiguracja Zapier/Make

-- Polisy ubezpieczeniowe
CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  policy_number TEXT NOT NULL,
  policy_type TEXT DEFAULT 'OC',        -- 'OC' | 'AC' | 'NNW' | 'Assistance' | 'GAP'
  insurer TEXT,
  start_date TEXT,
  end_date TEXT NOT NULL,
  premium_pln REAL DEFAULT 0,
  sum_insured_pln REAL,
  deductible_pln REAL DEFAULT 0,
  broker TEXT,
  broker_contact TEXT,
  auto_renew INTEGER DEFAULT 0,
  document_url TEXT,
  status TEXT DEFAULT 'active',         -- 'active' | 'expired' | 'cancelled'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ins_pol_company ON insurance_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_ins_pol_vehicle ON insurance_policies(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ins_pol_end     ON insurance_policies(end_date);

-- Roszczenia ubezpieczeniowe
CREATE TABLE IF NOT EXISTS insurance_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  policy_id TEXT,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  claim_date TEXT NOT NULL,
  description TEXT,
  claim_number TEXT,
  claim_amount_pln REAL DEFAULT 0,
  settled_amount_pln REAL,
  status TEXT DEFAULT 'open',           -- 'open' | 'in_progress' | 'settled' | 'rejected'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ins_claims_company ON insurance_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_ins_claims_vehicle ON insurance_claims(vehicle_id);

-- Faktury zleceń transportowych
CREATE TABLE IF NOT EXISTS route_invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  order_id TEXT,
  order_title TEXT,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_nip TEXT,
  invoice_date TEXT DEFAULT (date('now')),
  due_date TEXT,
  net_pln REAL DEFAULT 0,
  vat_rate REAL DEFAULT 0.23,
  vat_pln REAL DEFAULT 0,
  gross_pln REAL DEFAULT 0,
  cost_pln REAL DEFAULT 0,
  margin_pln REAL DEFAULT 0,
  margin_pct REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',          -- 'draft' | 'sent' | 'paid' | 'overdue'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_route_inv_company ON route_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_route_inv_status  ON route_invoices(status);

-- Konfiguracja Zapier / Make
CREATE TABLE IF NOT EXISTS zapier_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  target TEXT NOT NULL,                 -- 'zapier' | 'make'
  webhook_url TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_sent_at TEXT,
  last_status INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapier_cfg_co_target ON zapier_config(company_id, target);
