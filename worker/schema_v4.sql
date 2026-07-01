-- TaxOrder Pro — D1 Schema v4 (Faza 3+4: Moduł CFM, Fakturowanie)
-- Uruchom: wrangler d1 execute taxorder-pro --file=worker/schema_v4.sql --remote

-- ===================== KLIENCI CFM (zewnętrzni, spoza COMPANIES) =====================
CREATE TABLE IF NOT EXISTS cfm_clients (
  id                TEXT    PRIMARY KEY,
  company_id        TEXT    NOT NULL,
  nazwa             TEXT    NOT NULL,
  nip               TEXT,
  regon             TEXT,
  ulica             TEXT,
  kod               TEXT,
  miasto            TEXT,
  email             TEXT,
  telefon           TEXT,
  osoba_kontaktowa  TEXT,
  uwagi             TEXT,
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cfmc_company ON cfm_clients(company_id);

-- ===================== KONTRAKTY CFM (1 pojazd = 1 kontrakt) =====================
CREATE TABLE IF NOT EXISTS cfm_contracts (
  id                      TEXT    PRIMARY KEY,
  company_id              TEXT    NOT NULL,
  nr_rej                  TEXT    NOT NULL,
  client_type             TEXT    NOT NULL,   -- COMPANY | EXTERNAL
  client_ref              TEXT    NOT NULL,
  client_name_cache       TEXT,
  typ_umowy               TEXT,               -- NAJEM | LEASING
  data_od                 TEXT,
  data_do                 TEXT,
  stawka_miesieczna       REAL,
  dzien_platnosci         INTEGER DEFAULT 10,
  refakturowanie_kosztow  INTEGER DEFAULT 1,
  status                  TEXT    DEFAULT 'AKTYWNY',  -- AKTYWNY | ZAKONCZONY
  uwagi                   TEXT,
  created_at              TEXT    DEFAULT (datetime('now')),
  updated_at              TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cfmk_company ON cfm_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_cfmk_client  ON cfm_contracts(company_id, client_type, client_ref);
CREATE INDEX IF NOT EXISTS idx_cfmk_vehicle ON cfm_contracts(company_id, nr_rej);

-- ===================== FAKTURY CFM (zbiorcze per klient+okres) =====================
CREATE TABLE IF NOT EXISTS cfm_invoices (
  id                  TEXT    PRIMARY KEY,
  company_id          TEXT    NOT NULL,
  client_type         TEXT    NOT NULL,
  client_ref          TEXT    NOT NULL,
  client_name_cache   TEXT,
  nr_faktury          TEXT    NOT NULL,
  okres               TEXT    NOT NULL,        -- 'YYYY-MM'
  data_wystawienia    TEXT,
  termin_platnosci    TEXT,
  pozycje             TEXT    NOT NULL DEFAULT '[]',
  suma_netto          REAL,
  suma_vat            REAL,
  suma_brutto         REAL,
  status              TEXT    DEFAULT 'WYSTAWIONA',   -- WYSTAWIONA | OPLACONA | ANULOWANA
  ksef_status         TEXT    DEFAULT 'NIEWYSLANA',
  created_at          TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cfmf_company ON cfm_invoices(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfmf_unique ON cfm_invoices(company_id, client_type, client_ref, okres)
  WHERE status != 'ANULOWANA';
