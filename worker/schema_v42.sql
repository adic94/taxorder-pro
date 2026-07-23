-- schema_v42: Kolejka importu dokumentów (Monitor folderów)
-- Wypełniana przez lokalny agent Node.js (tools/folder-watcher/)
-- Pobierana przez frontend poprzez /api/folder-monitor/queue

CREATE TABLE IF NOT EXISTS folder_monitor_queue (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id   TEXT NOT NULL,
  filename     TEXT NOT NULL,
  doc_type     TEXT NOT NULL,           -- polisa | dr | paliwo | serwis
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | ocr_done | imported | skipped | error
  ocr_result   TEXT,                    -- JSON z wynikiem OCR
  ocr_model    TEXT,                    -- model który dał wynik
  error_msg    TEXT,
  agent_name   TEXT,                    -- identyfikator agenta (hostname)
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fmq_company    ON folder_monitor_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fmq_company_dt ON folder_monitor_queue(company_id, doc_type);
