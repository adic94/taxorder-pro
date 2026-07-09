-- schema v17: Profil Zaufany (login.gov.pl) — powiązanie konta TaxOrder z PZ sub
-- Bezpieczne: CREATE/ALTER z IF NOT EXISTS / ignoruje duplikaty kolumny
-- Uruchom: .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_v17.sql

ALTER TABLE users ADD COLUMN pz_sub TEXT;
CREATE INDEX IF NOT EXISTS idx_users_pz_sub ON users(pz_sub);
