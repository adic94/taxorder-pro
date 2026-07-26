-- schema_v44: Firmy jako dane, nie kod — tabela companies + dostępy per użytkownik
--
-- KONTEKST: do tej pory lista firm była zahardkodowana w app.js (obiekt COMPANIES).
-- Uniemożliwiało to onboarding nowego najemcy bez deployu. Ta migracja przenosi
-- firmy do D1 i zasiewa tabelę obecnymi sześcioma, żeby zachować pełną zgodność
-- wsteczną — app.js nadal ma literał jako fallback, gdy API nie odpowie.
--
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v44.sql

-- ===================== FIRMY (NAJEMCY) =====================
CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,              -- slug, np. 'mtoilet' — używany jako company_id wszędzie
  short_name  TEXT NOT NULL,
  name        TEXT NOT NULL,
  nip         TEXT,
  regon       TEXT,
  krs         TEXT,
  ulica       TEXT,
  dom         TEXT,
  lokal       TEXT,
  kod         TEXT,
  miasto      TEXT,
  woj         TEXT,
  organ       TEXT,                          -- organ podatkowy właściwy dla DT-1
  color       TEXT DEFAULT '#185FA5',
  wlasciciel  TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ===================== DOSTĘPY UŻYTKOWNIK ↔ FIRMA =====================
-- Zastępuje martwą tabelę Supabase 'user_company_access'.
-- Brak wiersza = brak dostępu. users.company_id pozostaje firmą domyślną.
CREATE TABLE IF NOT EXISTS user_company_access (
  user_id     INTEGER NOT NULL,
  company_id  TEXT    NOT NULL,
  can_view    INTEGER NOT NULL DEFAULT 1,
  can_edit    INTEGER NOT NULL DEFAULT 0,
  granted_by  TEXT,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_uca_user    ON user_company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uca_company ON user_company_access(company_id);
CREATE INDEX IF NOT EXISTS idx_comp_active ON companies(active, short_name);

-- ===================== SEED — obecne firmy z app.js =====================
-- INSERT OR IGNORE: bezpieczne przy ponownym uruchomieniu, nie nadpisuje zmian.
INSERT OR IGNORE INTO companies (id,short_name,name,nip,regon,krs,ulica,dom,lokal,kod,miasto,woj,organ,color,wlasciciel) VALUES
('mtoilet','mToilet','MTOILET SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','5361938486','367263453','0000766937','TORUŃSKA','31','','03-226','WARSZAWA','MAZOWIECKIE','Prezydent m.st. Warszawy — Dzielnica Białołęka','#185FA5','mToilet'),
('gcon','G-CON','G-CON SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','5223036167','362307353','0000572114','EUGENIUSZA BOCHEŃSKIEGO "DUBAŃCA"','6','','04-478','WARSZAWA','MAZOWIECKIE','Prezydent m.st. Warszawy — Dzielnica Rembertów','#3B6D11','GCON'),
('grental','G-Rental','G-RENTAL SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','9522192210','381803583','0000765416','EUGENIUSZA BOCHEŃSKIEGO "DUBAŃCA"','6','','04-478','WARSZAWA','MAZOWIECKIE','Prezydent m.st. Warszawy — Dzielnica Rembertów','#BA7517','GRENTAL'),
('kjrsupply','KJR Supply','KJR SUPPLY SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','5223116423','369535413','0000722764','MAGENTA','142','','04-429','WARSZAWA','MAZOWIECKIE','Prezydent m.st. Warszawy — Dzielnica Wawer','#7C3AED','KJR Supply'),
('nwkinvest','NWK Invest','NWK INVEST SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','5361920285','362208763','0000573479','MACIEJKI','3','','05-140','JACHRANKA','MAZOWIECKIE','Burmistrz Gminy Serock','#A32D2D','NWK Invest'),
('wolund','Wolund','WOLUND SYNERGY SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','5253006751','','0001111249','ADAMA MICKIEWICZA','37','58','01-625','WARSZAWA','MAZOWIECKIE','Prezydent m.st. Warszawy — Dzielnica Żoliborz','#0891B2','Wolund');
