-- ROLLBACK migration_v52.
--
-- SQLite nie usunie kolumny bez przebudowy tabeli, a przebudowa przy pustej tabeli
-- jest bezpieczna. Gdyby tabela miała już wiersze — NIE URUCHAMIAJ tego pliku bez
-- kopii: `SELECT * FROM company_packages` do pliku, dopiero potem przebudowa.
--
-- Wycofanie przywraca stan sprzed migracji, czyli odczyt padający na `no such column:
-- active` i cichy `allowed=['*']`. To jest cofnięcie do znanego, udokumentowanego długu,
-- nie do stanu poprawnego.

DROP INDEX IF EXISTS idx_company_packages_active;

CREATE TABLE IF NOT EXISTS company_packages_v33_tmp (
  company_id TEXT PRIMARY KEY,
  package_name TEXT DEFAULT 'enterprise',
  modules_add TEXT DEFAULT '[]',
  modules_remove TEXT DEFAULT '[]',
  valid_until TEXT,
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);

INSERT INTO company_packages_v33_tmp
  (company_id, package_name, modules_add, modules_remove, valid_until, notes, updated_at, updated_by)
  SELECT company_id, package_name, modules_add, modules_remove, valid_until, notes, updated_at, updated_by
  FROM company_packages;

DROP TABLE company_packages;
ALTER TABLE company_packages_v33_tmp RENAME TO company_packages;
