-- TaxOrder Pro — D1 Schema v3 (Faza 2: Zlecenia serwisowe, Protokoły zdawczo-odbiorcze)
-- Uruchom: wrangler d1 execute taxorder-pro --file=worker/schema_v3.sql --remote

-- ===================== ZLECENIA SERWISOWE =====================
CREATE TABLE IF NOT EXISTS service_orders (
  id                TEXT    PRIMARY KEY,
  company_id        TEXT    NOT NULL,
  nr_rej            TEXT    NOT NULL,
  typ               TEXT,
  opis              TEXT,
  zglaszajacy       TEXT,
  status            TEXT    NOT NULL DEFAULT 'ZGLOSZONE',
  autoryzowal       TEXT,
  data_autoryzacji  TEXT,
  powod_odrzucenia  TEXT,
  koszt_szacowany   REAL,
  warsztat          TEXT,
  data_realizacji   TEXT,
  km_realizacji     INTEGER,
  koszt_rzeczywisty REAL,
  nastepny_termin   TEXT,
  nastepny_km       INTEGER,
  uwagi             TEXT,
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_so_company ON service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_so_vehicle ON service_orders(company_id, nr_rej);
CREATE INDEX IF NOT EXISTS idx_so_status  ON service_orders(company_id, status);

-- ===================== PROTOKOŁY ZDAWCZO-ODBIORCZE =====================
CREATE TABLE IF NOT EXISTS handover_protocols (
  id                  TEXT    PRIMARY KEY,
  company_id          TEXT    NOT NULL,
  nr_rej              TEXT    NOT NULL,
  typ                 TEXT    NOT NULL DEFAULT 'WYDANIE',
  data                TEXT    DEFAULT (datetime('now')),
  osoba_wydajaca      TEXT,
  osoba_odbierajaca   TEXT,
  stan_licznika       INTEGER,
  stan_paliwa         TEXT,
  wyposazenie         TEXT    DEFAULT '[]',
  uszkodzenia_opis    TEXT,
  uwagi               TEXT,
  podpis_wydajacy     TEXT,
  podpis_odbierajacy  TEXT,
  created_at          TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hp_company ON handover_protocols(company_id);
CREATE INDEX IF NOT EXISTS idx_hp_vehicle ON handover_protocols(company_id, nr_rej);

CREATE TABLE IF NOT EXISTS protocol_photos (
  id          TEXT    PRIMARY KEY,
  protocol_id TEXT    NOT NULL REFERENCES handover_protocols(id) ON DELETE CASCADE,
  r2_key      TEXT    NOT NULL UNIQUE,
  mime_type   TEXT    NOT NULL DEFAULT 'image/jpeg',
  uploaded_at TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pp ON protocol_photos(protocol_id);
