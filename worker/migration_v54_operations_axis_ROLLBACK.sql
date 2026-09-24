-- ROLLBACK v54. Usuwa wyłącznie nakładkę operacyjną; transport_orders pozostaje.
-- Zdarzenia, POD i dane utworzone już po migracji zostaną utracone — wykonaj eksport
-- tabel operation_* przed użyciem rollbacku.

DROP TRIGGER IF EXISTS operation_command_apply;
DROP TRIGGER IF EXISTS operation_command_version_guard;
DROP TRIGGER IF EXISTS transport_order_operation_status_sync;
DROP TRIGGER IF EXISTS transport_order_operation_create;
DROP INDEX IF EXISTS idx_operation_events_operation;
DROP INDEX IF EXISTS idx_operation_proofs_operation;
DROP INDEX IF EXISTS idx_operation_assignments_operation;
DROP INDEX IF EXISTS idx_operation_assignments_resource;
DROP INDEX IF EXISTS idx_operation_requirements_operation;
DROP INDEX IF EXISTS idx_operation_tasks_operation;
DROP INDEX IF EXISTS idx_operation_stops_operation;
DROP INDEX IF EXISTS idx_operation_records_company_state;
DROP TABLE IF EXISTS operation_events;
DROP TABLE IF EXISTS operation_commands;
DROP TABLE IF EXISTS operation_proofs;
DROP TABLE IF EXISTS operation_assignments;
DROP TABLE IF EXISTS operation_requirements;
DROP TABLE IF EXISTS operation_tasks;
DROP TABLE IF EXISTS operation_stops;
DROP TABLE IF EXISTS operation_records;
