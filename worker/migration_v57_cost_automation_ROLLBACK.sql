DROP TABLE IF EXISTS erp_exchange_documents;
DROP TABLE IF EXISTS insurance_fnol_cases;
DROP TABLE IF EXISTS leasing_payment_installments;
DROP TABLE IF EXISTS leasing_payment_schedules;
DROP TABLE IF EXISTS fuel_fraud_alerts;
DROP TABLE IF EXISTS automation_actions;
DROP TABLE IF EXISTS automation_executions;
DROP TABLE IF EXISTS automation_rules;
DELETE FROM integration_adapters WHERE adapter_key IN('enova365','comarch');
