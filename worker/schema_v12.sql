-- Karty flotowe — paliwowe, opłat drogowych, parkingowe
-- Migracja z localStorage ('dt1_karty') do D1, wielodostępność dla firmy
CREATE TABLE IF NOT EXISTS fleet_cards (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  card_no     TEXT NOT NULL,
  pin         TEXT,
  nr_rej      TEXT,
  type        TEXT NOT NULL DEFAULT 'PALIWOWA' CHECK(type IN ('PALIWOWA','OPŁATY','PARKING','INNA')),
  provider    TEXT,
  limit_pln   REAL,
  expires     TEXT,
  status      TEXT NOT NULL DEFAULT 'AKTYWNA' CHECK(status IN ('AKTYWNA','ZABLOKOWANA','NIEAKTYWNA')),
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fleet_cards_company ON fleet_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_cards_nr_rej  ON fleet_cards(company_id, nr_rej);
