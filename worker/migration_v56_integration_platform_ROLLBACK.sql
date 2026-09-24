-- Bezpieczny rollback fazy E. Nie dotyka danych biznesowych ani starych integracji v27.
DROP TABLE IF EXISTS integration_schedules;
DROP TABLE IF EXISTS integration_run_items;
DROP TABLE IF EXISTS integration_runs;
DROP TABLE IF EXISTS integration_mapping_profiles;
DROP TABLE IF EXISTS integration_adapters;
