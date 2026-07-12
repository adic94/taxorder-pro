-- TaxOrder Pro — D1 Schema v22
-- company_id na użytkownikach — wymagane dla RBAC (non-admin ograniczeni do własnej firmy)
-- Bezpieczne: ALTER TABLE jest idempotentne jeśli kolumna już istnieje (D1 ignoruje błąd DUPLICATE COLUMN)
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v22.sql

ALTER TABLE users ADD COLUMN company_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
