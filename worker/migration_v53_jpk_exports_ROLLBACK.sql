-- ROLLBACK migration_v53.
--
-- Przywraca strukturę sprzed migracji, czyli stan, w którym `POST /api/jpk/generate`
-- pada 500. To cofnięcie do znanej awarii, nie do stanu poprawnego — uruchamiaj tylko,
-- gdy migracja sama coś zepsuła.
--
-- ⚠️ ODWZOROWANIE JEST STRATNE. Stara struktura nie ma gdzie trzymać `r2_key`,
-- `row_count`, `month` ani `quarter` — te wartości PRZEPADAJĄ. Utrata `r2_key` oznacza,
-- że plików XML leżących w R2 nie da się już powiązać z wierszem. Zrób kopię przed
-- uruchomieniem:
--   wrangler d1 execute taxorder-pro --remote --command="SELECT * FROM jpk_exports" --json

CREATE TABLE IF NOT EXISTS jpk_exports_stare (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  export_type TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  status TEXT DEFAULT 'generated',
  file_size_bytes INTEGER,
  xml_hash TEXT,
  sent_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO jpk_exports_stare
  (id, company_id, export_type, period_from, period_to, status,
   file_size_bytes, xml_hash, sent_at, notes, created_at)
  SELECT
    id,
    company_id,
    jpk_type,
    COALESCE(period_label, CAST(year AS TEXT)),
    COALESCE(period_label, CAST(year AS TEXT)),
    status,
    file_size_bytes,
    xml_hash,
    sent_at,
    notes,
    created_at
  FROM jpk_exports;

DROP INDEX IF EXISTS idx_jpk_exports_company;
DROP TABLE jpk_exports;
ALTER TABLE jpk_exports_stare RENAME TO jpk_exports;
