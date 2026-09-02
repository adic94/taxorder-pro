-- ROLLBACK migration_v56_tires_faktura.sql
-- SQLite nie usuwa kolumn przez ALTER w starszych wersjach silnika używanych
-- przez D1 bez przebudowy tabeli — rollback to CREATE+COPY+DROP+RENAME,
-- tak samo jak przy innych przebudowach w tym projekcie (patrz migration_v53).
CREATE TABLE tires_v56_rollback (
  id                  TEXT    PRIMARY KEY,
  company_id          TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'MAGAZYN',
  nr_rej              TEXT,
  pozycja             TEXT,
  rozmiar             TEXT,
  marka               TEXT,
  dot                 TEXT,
  bieznik_mm          REAL,
  sezon               TEXT,
  lokalizacja_magazyn TEXT,
  data_zakupu         TEXT,
  uwagi               TEXT,
  historia            TEXT    NOT NULL DEFAULT '[]',
  created_at          TEXT    DEFAULT (datetime('now')),
  updated_at          TEXT    DEFAULT (datetime('now')),
  branch_id INTEGER
);
INSERT INTO tires_v56_rollback (id,company_id,status,nr_rej,pozycja,rozmiar,marka,dot,bieznik_mm,sezon,lokalizacja_magazyn,data_zakupu,uwagi,historia,created_at,updated_at,branch_id)
  SELECT id,company_id,status,nr_rej,pozycja,rozmiar,marka,dot,bieznik_mm,sezon,lokalizacja_magazyn,data_zakupu,uwagi,historia,created_at,updated_at,branch_id FROM tires;
DROP TABLE tires;
ALTER TABLE tires_v56_rollback RENAME TO tires;
CREATE INDEX IF NOT EXISTS idx_tires_company ON tires(company_id);
