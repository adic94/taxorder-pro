-- ROLLBACK migration_v54.
--
-- Przywraca strukturę sprzed migracji: `nr_rej NOT NULL`, bez kolumny `ocr_fields`.
-- To cofnięcie do znanej usterki (orphan-upload bez nr_rej znów będzie padał na
-- NOT NULL), nie do stanu poprawnego — uruchamiaj tylko, gdy migracja coś zepsuła.
--
-- ⚠️ ODWZOROWANIE JEST STRATNE w dwóch miejscach:
--   1. `ocr_fields` PRZEPADA — jeśli w międzyczasie coś tam zapisano (import z agenta
--      folder-monitor), ta treść znika bezpowrotnie.
--   2. Wiersze z `nr_rej IS NULL` dostają pusty string zamiast NULL (COALESCE),
--      żeby sam ROLLBACK nie padł na przywracany NOT NULL — to NIE jest to samo,
--      co miały przed migracją (przed migracją takie wiersze nie mogły istnieć wcale).
-- Zrób kopię przed uruchomieniem:
--   wrangler d1 execute taxorder-pro --remote --command="SELECT * FROM documents" --json

CREATE TABLE IF NOT EXISTS documents_stare (
  id          TEXT    PRIMARY KEY,
  nr_rej      TEXT    NOT NULL,
  company_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL DEFAULT 'application/octet-stream',
  r2_key      TEXT    NOT NULL UNIQUE,
  uploaded_at TEXT    DEFAULT (datetime('now')),
  vin                    TEXT,
  doc_type               TEXT DEFAULT 'inne',
  detected_vin           TEXT,
  vehicle_id             TEXT,
  uploaded_by            TEXT,
  file_size              INTEGER DEFAULT 0,
  notes                  TEXT,
  expiry_date            TEXT,
  doc_number             TEXT,
  workflow_status        TEXT DEFAULT 'nowy',
  workflow_template_id   TEXT,
  workflow_assigned_to   TEXT,
  workflow_assigned_name TEXT,
  workflow_due_date      TEXT,
  workflow_priority      TEXT DEFAULT 'normal'
);

INSERT INTO documents_stare
  (id, nr_rej, company_id, name, mime_type, r2_key, uploaded_at,
   vin, doc_type, detected_vin, vehicle_id, uploaded_by, file_size, notes,
   expiry_date, doc_number,
   workflow_status, workflow_template_id, workflow_assigned_to,
   workflow_assigned_name, workflow_due_date, workflow_priority)
  SELECT
    id, COALESCE(nr_rej, ''), company_id, name, mime_type, r2_key, uploaded_at,
    vin, doc_type, detected_vin, vehicle_id, uploaded_by, file_size, notes,
    expiry_date, doc_number,
    workflow_status, workflow_template_id, workflow_assigned_to,
    workflow_assigned_name, workflow_due_date, workflow_priority
  FROM documents;

DROP INDEX IF EXISTS idx_documents_company;
DROP INDEX IF EXISTS idx_documents_vin;
DROP INDEX IF EXISTS idx_documents_vehicle_id;
DROP TABLE documents;
ALTER TABLE documents_stare RENAME TO documents;
