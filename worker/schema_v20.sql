-- schema v20: Dokumenty — daty ważności, numery dokumentów
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v20.sql

ALTER TABLE documents ADD COLUMN expiry_date  TEXT;
ALTER TABLE documents ADD COLUMN doc_number   TEXT;

CREATE INDEX IF NOT EXISTS idx_docs_expiry ON documents(expiry_date);
