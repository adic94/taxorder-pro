-- ROLLBACK v55. Eksportuj rozliczenia przed uruchomieniem; operation_proofs z v54 zostają.
DROP INDEX IF EXISTS idx_operation_cost_items_settlement;
DROP INDEX IF EXISTS idx_operation_settlement_operation;
DROP INDEX IF EXISTS idx_operation_pod_policy;
DROP TABLE IF EXISTS operation_cost_items;
DROP TABLE IF EXISTS operation_settlements;
DROP TABLE IF EXISTS operation_pod_policies;
