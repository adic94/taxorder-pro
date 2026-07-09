-- Error log — frontendowe błędy JS wysyłane przez modules/error-tracker.js
CREATE TABLE IF NOT EXISTS error_logs (
  id           TEXT PRIMARY KEY,
  created_at   TEXT DEFAULT (datetime('now')),
  url          TEXT,
  error_msg    TEXT NOT NULL,
  error_stack  TEXT,
  error_type   TEXT DEFAULT 'uncaught',   -- 'uncaught' | 'promise' | 'manual'
  user_agent   TEXT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_id   TEXT,
  app_version  TEXT,
  analyzed     INTEGER NOT NULL DEFAULT 0,
  analysis     TEXT,
  github_issue_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_errlogs_created  ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errlogs_analyzed ON error_logs(analyzed);
CREATE INDEX IF NOT EXISTS idx_errlogs_company  ON error_logs(company_id);
