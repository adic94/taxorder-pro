-- ROLLBACK migration_v57_protocol_diagram.sql
CREATE TABLE handover_protocols_v57_rollback (
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
INSERT INTO handover_protocols_v57_rollback (id,company_id,nr_rej,typ,data,osoba_wydajaca,osoba_odbierajaca,stan_licznika,stan_paliwa,wyposazenie,uszkodzenia_opis,uwagi,podpis_wydajacy,podpis_odbierajacy,created_at)
  SELECT id,company_id,nr_rej,typ,data,osoba_wydajaca,osoba_odbierajaca,stan_licznika,stan_paliwa,wyposazenie,uszkodzenia_opis,uwagi,podpis_wydajacy,podpis_odbierajacy,created_at FROM handover_protocols;
DROP TABLE handover_protocols;
ALTER TABLE handover_protocols_v57_rollback RENAME TO handover_protocols;
CREATE INDEX IF NOT EXISTS idx_hp_company ON handover_protocols(company_id);
CREATE INDEX IF NOT EXISTS idx_hp_vehicle ON handover_protocols(company_id, nr_rej);
