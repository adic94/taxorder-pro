-- TaxOrder Pro — migration_v56: wspólna platforma integracji/importu (faza E).
-- Wymaga migration_v54_operations_axis.sql. Migracja ręczna, niewdrożona automatycznie.

CREATE TABLE integration_adapters (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  adapter_key TEXT NOT NULL,
  name TEXT NOT NULL,
  adapter_version TEXT NOT NULL DEFAULT '1.0',
  direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK(direction IN ('inbound','outbound','bidirectional')),
  capabilities TEXT NOT NULL DEFAULT '[]',
  config TEXT NOT NULL DEFAULT '{}',
  secret_ref TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','active','degraded','disabled')),
  last_health_at TEXT,
  last_health_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id,adapter_key)
);

CREATE TABLE integration_mapping_profiles (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_format TEXT NOT NULL CHECK(source_format IN ('csv','txt','xls','xlsx','xlsm','xml','json','api')),
  mapping TEXT NOT NULL DEFAULT '{}',
  transforms TEXT NOT NULL DEFAULT '{}',
  options TEXT NOT NULL DEFAULT '{}',
  dedupe_strategy TEXT NOT NULL DEFAULT 'external_id' CHECK(dedupe_strategy IN ('external_id','content_hash','none')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id,name)
);

CREATE TABLE integration_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  adapter_id TEXT,
  profile_id TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('import','export','sync','health')),
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','waiting_user','retry','dead_letter','completed','cancelled')),
  idempotency_key TEXT NOT NULL,
  source_name TEXT,
  source_format TEXT,
  source_hash TEXT,
  cursor TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  applied_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  report TEXT NOT NULL DEFAULT '{}',
  requested_by TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id,idempotency_key),
  FOREIGN KEY(adapter_id) REFERENCES integration_adapters(id) ON DELETE SET NULL,
  FOREIGN KEY(profile_id) REFERENCES integration_mapping_profiles(id) ON DELETE SET NULL
);

CREATE TABLE integration_run_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  row_no INTEGER NOT NULL,
  source_key TEXT,
  canonical_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('valid','invalid','duplicate','applied','failed','skipped')),
  payload TEXT,
  validation_errors TEXT NOT NULL DEFAULT '[]',
  target_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id,row_no),
  FOREIGN KEY(run_id) REFERENCES integration_runs(id) ON DELETE CASCADE
);

CREATE TABLE integration_schedules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  adapter_id TEXT,
  profile_id TEXT,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('import','export','sync')),
  operation TEXT NOT NULL,
  schedule_kind TEXT NOT NULL DEFAULT 'daily' CHECK(schedule_kind IN ('hourly','daily','weekly','monthly')),
  schedule_value TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  export_format TEXT CHECK(export_format IN ('csv','txt','xls','xlsx','xlsm','xml','json')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  last_run_at TEXT,
  next_run_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(adapter_id) REFERENCES integration_adapters(id) ON DELETE SET NULL,
  FOREIGN KEY(profile_id) REFERENCES integration_mapping_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_integration_adapters_company ON integration_adapters(company_id,status);
CREATE INDEX idx_integration_profiles_company ON integration_mapping_profiles(company_id,entity_type,active);
CREATE INDEX idx_integration_runs_queue ON integration_runs(company_id,status,next_retry_at,created_at);
CREATE INDEX idx_integration_run_items_run ON integration_run_items(company_id,run_id,status);
CREATE INDEX idx_integration_schedules_due ON integration_schedules(enabled,next_run_at);

-- ERPNext jest adapterem referencyjnym. secret_ref wskazuje nazwę sekretu Workera;
-- żaden token, hasło ani klucz API nie jest zapisywany w D1.
INSERT OR IGNORE INTO integration_adapters
  (id,company_id,adapter_key,name,capabilities,config,secret_ref,status)
SELECT 'adapter_erpnext_' || id, id, 'erpnext', 'ERPNext Sandbox',
       '["health","pull","push","reconcile"]',
       '{"mode":"sandbox","base_url":"","api_version":"v2"}',
       'ERPNEXT_API_TOKEN', 'inactive'
FROM companies;
