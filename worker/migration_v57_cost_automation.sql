-- TaxOrder Pro — migration_v57: automatyzacje kosztowe (faza F).
-- Wymaga v56. Migracja ręczna, niewdrożona automatycznie.

CREATE TABLE automation_rules (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, rule_key TEXT NOT NULL, name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, trigger_type TEXT NOT NULL, condition_config TEXT NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL, approval_required INTEGER NOT NULL DEFAULT 1 CHECK(approval_required IN(0,1)),
  mode TEXT NOT NULL DEFAULT 'dry_run' CHECK(mode IN('dry_run','active','disabled')),
  max_actions_per_run INTEGER NOT NULL DEFAULT 100, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(company_id,rule_key,version)
);

CREATE TABLE automation_executions (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, rule_id TEXT NOT NULL, rule_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN('running','dry_run','waiting_approval','completed','failed','cancelled','limit_reached')),
  correlation_id TEXT NOT NULL, trigger_payload TEXT NOT NULL DEFAULT '{}', explanation TEXT NOT NULL DEFAULT '{}',
  matched_count INTEGER NOT NULL DEFAULT 0, action_count INTEGER NOT NULL DEFAULT 0,
  started_by TEXT, started_at TEXT NOT NULL DEFAULT(datetime('now')), finished_at TEXT,
  UNIQUE(company_id,correlation_id), FOREIGN KEY(rule_id) REFERENCES automation_rules(id)
);

CREATE TABLE automation_actions (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, execution_id TEXT NOT NULL, action_key TEXT NOT NULL,
  action_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','waiting_approval','approved','applied','rejected','failed','cancelled')),
  payload TEXT NOT NULL DEFAULT '{}', result TEXT NOT NULL DEFAULT '{}', approved_by TEXT, approved_at TEXT, applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(company_id,action_key),
  FOREIGN KEY(execution_id) REFERENCES automation_executions(id) ON DELETE CASCADE
);

CREATE TABLE fuel_fraud_alerts (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, fuel_fill_id TEXT NOT NULL, vehicle_reg TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN('low','medium','high','critical')), score INTEGER NOT NULL,
  reason_codes TEXT NOT NULL DEFAULT '[]', evidence TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN('open','investigating','confirmed','dismissed')),
  automation_action_id TEXT, reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(company_id,fuel_fill_id), FOREIGN KEY(automation_action_id) REFERENCES automation_actions(id)
);

CREATE TABLE leasing_payment_schedules (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, vehicle_id TEXT, vehicle_reg TEXT, contract_ref TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN', principal_amount REAL NOT NULL, annual_interest_pct REAL NOT NULL,
  annual_margin_pct REAL NOT NULL DEFAULT 0, installment_count INTEGER NOT NULL, residual_amount REAL NOT NULL DEFAULT 0,
  first_due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','active','completed','cancelled')),
  version INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'automation', created_by TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(company_id,contract_ref,version)
);

CREATE TABLE leasing_payment_installments (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, schedule_id TEXT NOT NULL, installment_no INTEGER NOT NULL,
  due_date TEXT NOT NULL, opening_balance REAL NOT NULL, principal_amount REAL NOT NULL, interest_amount REAL NOT NULL,
  margin_amount REAL NOT NULL, net_amount REAL NOT NULL, vat_amount REAL NOT NULL DEFAULT 0, gross_amount REAL NOT NULL,
  closing_balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN('planned','due','paid','overdue','cancelled')),
  paid_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(schedule_id,installment_no),
  FOREIGN KEY(schedule_id) REFERENCES leasing_payment_schedules(id) ON DELETE CASCADE
);

CREATE TABLE insurance_fnol_cases (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, claim_id TEXT NOT NULL, insurer_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','submitted','acknowledged','additional_info','accepted','rejected','closed')),
  incident_data TEXT NOT NULL DEFAULT '{}', parties TEXT NOT NULL DEFAULT '[]', injuries TEXT NOT NULL DEFAULT '[]',
  police_data TEXT NOT NULL DEFAULT '{}', evidence_refs TEXT NOT NULL DEFAULT '[]', validation_errors TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT, acknowledged_at TEXT, updated_at TEXT NOT NULL DEFAULT(datetime('now')), created_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(company_id,claim_id), FOREIGN KEY(claim_id) REFERENCES insurance_claims(id) ON DELETE CASCADE
);

CREATE TABLE erp_exchange_documents (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, settlement_id TEXT, adapter_key TEXT NOT NULL,
  document_type TEXT NOT NULL, document_version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','approved','ready_for_export','exported','accepted_by_erp','posted','paid','rejected','reconciliation_required')),
  idempotency_key TEXT NOT NULL, checksum TEXT NOT NULL, payload TEXT NOT NULL, erp_document_id TEXT,
  erp_document_number TEXT, exported_at TEXT, reconciled_at TEXT, error_message TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(company_id,idempotency_key), UNIQUE(company_id,adapter_key,erp_document_id),
  FOREIGN KEY(settlement_id) REFERENCES operation_settlements(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO integration_adapters(id,company_id,adapter_key,name,capabilities,config,secret_ref,status)
SELECT 'adapter_enova365_'||id,id,'enova365','enova365','["health","push","reconcile"]','{"mode":"disabled_until_approved","contract_version":"1.0"}','ENOVA365_API_TOKEN','inactive' FROM companies;
INSERT OR IGNORE INTO integration_adapters(id,company_id,adapter_key,name,capabilities,config,secret_ref,status)
SELECT 'adapter_comarch_'||id,id,'comarch','Comarch ERP XL / Optima','["health","push","reconcile"]','{"mode":"disabled_until_approved","contract_version":"1.0"}','COMARCH_ERP_API_TOKEN','inactive' FROM companies;

INSERT OR IGNORE INTO automation_rules(id,company_id,rule_key,name,trigger_type,condition_config,action_type,approval_required,mode)
SELECT 'rule_fuel_gps_'||id,id,'fuel_gps_anomaly','Paliwo ↔ GPS','scheduled','{"gps_window_hours":24,"repeat_fill_hours":8,"high_liters":120,"score_threshold":40}','create_fuel_alert',0,'dry_run' FROM companies;
INSERT OR IGNORE INTO automation_rules(id,company_id,rule_key,name,trigger_type,condition_config,action_type,approval_required,mode)
SELECT 'rule_service_auth_'||id,id,'service_authorization','Serwis ↔ autoryzacja','service_order_changed','{"amount_threshold":2000}','request_approval',1,'dry_run' FROM companies;
INSERT OR IGNORE INTO automation_rules(id,company_id,rule_key,name,trigger_type,condition_config,action_type,approval_required,mode)
SELECT 'rule_leasing_'||id,id,'leasing_schedule','Leasing ↔ harmonogram','manual','{}','generate_installments',1,'dry_run' FROM companies;
INSERT OR IGNORE INTO automation_rules(id,company_id,rule_key,name,trigger_type,condition_config,action_type,approval_required,mode)
SELECT 'rule_fnol_'||id,id,'claim_fnol','Szkoda ↔ FNOL','insurance_claim_created','{}','create_fnol_case',1,'dry_run' FROM companies;

CREATE INDEX idx_automation_rules_company ON automation_rules(company_id,enabled,mode);
CREATE INDEX idx_automation_exec_company ON automation_executions(company_id,started_at DESC);
CREATE INDEX idx_automation_actions_status ON automation_actions(company_id,status,created_at);
CREATE INDEX idx_fuel_fraud_status ON fuel_fraud_alerts(company_id,status,severity);
CREATE INDEX idx_leasing_installments_due ON leasing_payment_installments(company_id,status,due_date);
CREATE INDEX idx_fnol_status ON insurance_fnol_cases(company_id,status,updated_at);
CREATE INDEX idx_erp_exchange_status ON erp_exchange_documents(company_id,status,adapter_key);
