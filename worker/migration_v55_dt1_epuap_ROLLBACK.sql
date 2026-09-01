-- ROLLBACK migration_v55_dt1_epuap.sql
ALTER TABLE dt1_declarations DROP COLUMN epuap_sent_at;
ALTER TABLE dt1_declarations DROP COLUMN epuap_reference;
