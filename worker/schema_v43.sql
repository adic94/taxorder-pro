-- schema_v43: Obieg dokumentów — workflow templates, historia statusów, nowe kolumny w documents

-- Szablony workflow per firma (admin definiuje ścieżki zatwierdzeń)
CREATE TABLE IF NOT EXISTS doc_workflow_templates (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  doc_types   TEXT DEFAULT '[]',  -- JSON array typów, np. ["oc","ac","przeglad"]
  statuses    TEXT NOT NULL,       -- JSON: [{id,label,color,order,is_final}]
  is_default  INTEGER DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Nowe kolumny workflow na tabeli documents

-- Audit trail — pełna historia zmian statusu
CREATE TABLE IF NOT EXISTS doc_status_history (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id      TEXT NOT NULL,
  doc_id          TEXT NOT NULL,
  doc_name        TEXT,
  doc_type        TEXT,
  status_from     TEXT,
  status_to       TEXT NOT NULL,
  assigned_to     TEXT,
  assigned_name   TEXT,
  comment         TEXT,
  changed_by      TEXT,
  changed_by_name TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_dsh_company    ON doc_status_history(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsh_doc        ON doc_status_history(doc_id);
CREATE INDEX IF NOT EXISTS idx_dwt_company    ON doc_workflow_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_docs_wf_status ON documents(company_id, workflow_status);
CREATE INDEX IF NOT EXISTS idx_docs_wf_assign ON documents(company_id, workflow_assigned_to);

-- ALTER-y ADD COLUMN przeniesione do CREATE TABLE w plikach zrodlowych tabel.
-- NIE przywracaj ich tutaj: padaly przy kazdym powtorzeniu ('duplicate column name'),
-- a import D1 z --file jest transakcyjny per plik — jeden taki blad wycofywal CALY
-- ten plik razem z tabelami, ktore zaklada, wiec stawaly sie nie do odtworzenia.
