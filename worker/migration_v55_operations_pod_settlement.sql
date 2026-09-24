-- TaxOrder Pro — migration_v55: POD, kompletność, SLA i rozliczenie operacji.
-- Wymaga migration_v54_operations_axis.sql. Migracja ręczna, niewdrożona automatycznie.

CREATE TABLE operation_pod_policies (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'transport',
  proof_type TEXT NOT NULL CHECK(proof_type IN ('signature','photo','document','location','form','cmr','other')),
  min_count INTEGER NOT NULL DEFAULT 1 CHECK(min_count >= 0),
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  sla_minutes INTEGER,
  allowed_sources TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id,operation_type,proof_type)
);

CREATE TABLE operation_settlements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  settlement_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','exported','rejected')),
  currency TEXT NOT NULL DEFAULT 'PLN',
  planned_distance_km REAL,
  actual_distance_km REAL,
  planned_cost_pln REAL NOT NULL DEFAULT 0,
  actual_cost_pln REAL NOT NULL DEFAULT 0,
  revenue_net_pln REAL NOT NULL DEFAULT 0,
  margin_pln REAL NOT NULL DEFAULT 0,
  margin_pct REAL NOT NULL DEFAULT 0,
  client_name TEXT,
  client_nip TEXT,
  route_invoice_id TEXT,
  prepared_by TEXT,
  approved_by TEXT,
  prepared_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id,operation_id),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TABLE operation_cost_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  cost_type TEXT NOT NULL CHECK(cost_type IN ('fuel','toll','driver','depreciation','service','other')),
  source_type TEXT,
  source_id TEXT,
  planned_amount_pln REAL NOT NULL DEFAULT 0,
  actual_amount_pln REAL NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE,
  FOREIGN KEY(settlement_id) REFERENCES operation_settlements(id) ON DELETE CASCADE
);

INSERT INTO operation_pod_policies(id,company_id,operation_type,proof_type,min_count,required,sla_minutes,allowed_sources)
SELECT lower(hex(randomblob(16))), company_id, 'transport', 'signature', 1, 1, 120, '["smart_form","protocol","upload"]'
FROM operation_records GROUP BY company_id;

INSERT INTO operation_pod_policies(id,company_id,operation_type,proof_type,min_count,required,sla_minutes,allowed_sources)
SELECT lower(hex(randomblob(16))), company_id, 'transport', 'document', 1, 1, 240, '["document","smart_form","upload"]'
FROM operation_records GROUP BY company_id;

CREATE INDEX idx_operation_pod_policy ON operation_pod_policies(company_id,operation_type,active);
CREATE INDEX idx_operation_settlement_operation ON operation_settlements(company_id,operation_id,status);
CREATE INDEX idx_operation_cost_items_settlement ON operation_cost_items(company_id,settlement_id,cost_type);

