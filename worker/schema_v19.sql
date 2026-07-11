-- schema v19: Smart Document System — rozszerza documents o VIN, klasyfikację, vehicle_id
-- Bezpieczne: ALTER TABLE ignoruje błąd jeśli kolumna już istnieje (D1 nie obsługuje IF NOT EXISTS dla ADD COLUMN)
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v19.sql

ALTER TABLE documents ADD COLUMN vin           TEXT;
ALTER TABLE documents ADD COLUMN doc_type      TEXT DEFAULT 'inne';
ALTER TABLE documents ADD COLUMN detected_vin  TEXT;
ALTER TABLE documents ADD COLUMN vehicle_id    TEXT;
ALTER TABLE documents ADD COLUMN uploaded_by   TEXT;
ALTER TABLE documents ADD COLUMN file_size     INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN notes         TEXT;

CREATE INDEX IF NOT EXISTS idx_docs_vin      ON documents(vin);
CREATE INDEX IF NOT EXISTS idx_docs_type     ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_company  ON documents(company_id);
