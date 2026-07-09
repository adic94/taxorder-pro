-- Historia deklaracji DT-1 — archiwum złożonych/wygenerowanych deklaracji per firma per rok
CREATE TABLE IF NOT EXISTS dt1_declarations (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  rok          INTEGER NOT NULL,
  total_tax    REAL NOT NULL DEFAULT 0,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  gmina        TEXT,
  created_by   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  pdf_r2_key   TEXT,
  notes        TEXT,
  vehicles_json TEXT  -- JSON snapshot listy pojazdów z kwotami
);
CREATE INDEX IF NOT EXISTS idx_dt1decl_company ON dt1_declarations(company_id, rok DESC);

-- Webhooki wychodzące — powiadomienia do zewnętrznych systemów (Teams/Slack/własna aplikacja)
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  events      TEXT NOT NULL DEFAULT 'alert',  -- JSON array: ["alert","dt1_generated","inspection_due"]
  secret      TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  last_fired_at  TEXT,
  last_status    INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhooks_company ON webhooks(company_id);
