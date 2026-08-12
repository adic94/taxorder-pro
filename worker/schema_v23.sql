-- Schema v23: Oddziały (branches) — podział floty i archiwum kosztów
CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now')),
  UNIQUE(company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);


CREATE INDEX IF NOT EXISTS idx_vehicles_branch ON vehicles(branch_id);

-- ALTER-y ADD COLUMN przeniesione do CREATE TABLE w plikach zrodlowych tabel.
-- NIE przywracaj ich tutaj: padaly przy kazdym powtorzeniu ('duplicate column name'),
-- a import D1 z --file jest transakcyjny per plik — jeden taki blad wycofywal CALY
-- ten plik razem z tabelami, ktore zaklada, wiec stawaly sie nie do odtworzenia.
