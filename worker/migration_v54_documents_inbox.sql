-- migration_v54: documents.nr_rej NOT NULL blokuje dokładnie ten przypadek,
-- po który jest "skrzynka dokumentów" — plik wgrany, zanim wiadomo, do którego pojazdu należy.
--
-- STAN PRZED, potwierdzony `SELECT sql FROM sqlite_master` na PRODUKCYJNYM D1:
--   documents.nr_rej TEXT NOT NULL  (z schema_v1, nigdy nie poluzowane)
-- `POST /api/docs/upload` (worker/index.js) i `POST /api/folder-monitor/ingest`
-- oba pozwalają wgrać dokument BEZ dopasowanego pojazdu — front (`_submitGlobalUpload`
-- w modules/document-manager.js) wprost dopuszcza `nrRej: veh?.nrRej || ''` i binduje
-- to jako `nrRej || null`. Przy pustym `nrRej` ten INSERT narusza NOT NULL i pada.
--
-- Zmierzone na produkcji: `documents` ma DOKŁADNIE 1 wiersz, zero z pustym nr_rej —
-- zgodne z tym, że próba wgrania orphan-dokumentu (nowy pojazd, VIN jeszcze nierozpoznany)
-- nigdy się nie powiodła, nie z tym, że nikt tego nie próbował. `folder_monitor_queue`
-- ma 0 wierszy — druga ścieżka (agent Node.js + `/api/folder-monitor/ingest`) nie miała
-- tej samej usterki (OCR działa niezależnie od zapisu do `documents`), ale do tej pory
-- W OGÓLE nie zapisywała oryginalnego pliku do R2/`documents` — po zatwierdzeniu w kolejce
-- dane trafiały do pojazdu, a sam skan znikał. Naprawione w tym samym PR co ta migracja
-- (`handleFmIngest` w worker/index.js).
--
-- DRUGA ZMIANA W TEJ MIGRACJI: kolumna `ocr_fields` (JSON pełnego wyniku ekstrakcji —
-- dla DR to 23 pola z DR_POLA_OCR, dla faktur wynik `extractInvoiceData`). Bez tego
-- pole odczytane raz przez OCR nie jest nigdzie queryowalne — żeby zbudować z danych
-- w chmurze coś w rodzaju `tools/dr-excel.js` (dziś to lokalny skrypt czytający skany
-- z dysku właściciela, nie z D1/R2), dane muszą najpierw trafiać do jednej kolumny,
-- a nie ginąć po zamknięciu karty importu.
--
-- DLACZEGO PRZEBUDOWA, A NIE SAM `ALTER TABLE ... ADD COLUMN ocr_fields`:
-- SQLite nie potrafi zdjąć NOT NULL przez ALTER — stąd rebuild jak w migration_v53.
-- Przebudowa NIE zakłada pustej tabeli: jedyny istniejący wiersz jest przenoszony
-- z `ocr_fields` = NULL (dla niego i tak nic nie było wykryte OCR-em).
--
-- Nazwa `migration_v54_`, nie `schema_v54_`, jest celowa — nocny automat uruchamia
-- glob `schema_v*.sql`, migracje strukturalne trzymamy poza nim. Uruchomienie ręczne:
--   wrangler d1 execute taxorder-pro --remote --file=worker/migration_v54_documents_inbox.sql

CREATE TABLE IF NOT EXISTS documents_v54 (
  id                     TEXT    PRIMARY KEY,
  nr_rej                 TEXT,                                    -- było NOT NULL — orphan-dokument (VIN nierozpoznany) musi móc istnieć
  company_id             TEXT    NOT NULL,
  name                   TEXT    NOT NULL,
  mime_type              TEXT    NOT NULL DEFAULT 'application/octet-stream',
  r2_key                 TEXT    NOT NULL UNIQUE,
  uploaded_at            TEXT    DEFAULT (datetime('now')),
  vin                    TEXT,
  doc_type               TEXT    DEFAULT 'inne',
  detected_vin           TEXT,
  vehicle_id             TEXT,
  uploaded_by            TEXT,
  file_size              INTEGER DEFAULT 0,
  notes                  TEXT,
  expiry_date            TEXT,
  doc_number             TEXT,
  ocr_fields             TEXT,                                    -- JSON pełnego wyniku ekstrakcji (DR_POLA_OCR / faktura) — NOWE
  workflow_status        TEXT    DEFAULT 'nowy',
  workflow_template_id   TEXT,
  workflow_assigned_to   TEXT,
  workflow_assigned_name TEXT,
  workflow_due_date      TEXT,
  workflow_priority      TEXT    DEFAULT 'normal'
);

INSERT INTO documents_v54
  (id, nr_rej, company_id, name, mime_type, r2_key, uploaded_at,
   vin, doc_type, detected_vin, vehicle_id, uploaded_by, file_size, notes,
   expiry_date, doc_number, ocr_fields,
   workflow_status, workflow_template_id, workflow_assigned_to,
   workflow_assigned_name, workflow_due_date, workflow_priority)
  SELECT
    id, nr_rej, company_id, name, mime_type, r2_key, uploaded_at,
    vin, doc_type, detected_vin, vehicle_id, uploaded_by, file_size, notes,
    expiry_date, doc_number, NULL,
    workflow_status, workflow_template_id, workflow_assigned_to,
    workflow_assigned_name, workflow_due_date, workflow_priority
  FROM documents;

DROP TABLE documents;
ALTER TABLE documents_v54 RENAME TO documents;

CREATE INDEX IF NOT EXISTS idx_documents_company    ON documents(company_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_vin         ON documents(vin);
CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id  ON documents(vehicle_id);
