-- schema_v45: KSeF offline queue + config table + new columns on ksef_invoices
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v45.sql

-- Offline queue: when KSeF is down, store here and retry with exponential backoff
CREATE TABLE IF NOT EXISTS ksef_offline_queue (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id      TEXT NOT NULL,
  invoice_id      TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  xml_payload     TEXT NOT NULL,
  attempt_count   INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  error_last      TEXT,
  status          TEXT DEFAULT 'queued',  -- queued | failed_permanent
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- KSeF config per company (token is sensitive — never returned in GET responses)
CREATE TABLE IF NOT EXISTS ksef_config (
  company_id        TEXT PRIMARY KEY,
  nip               TEXT,
  env               TEXT DEFAULT 'test',   -- 'test' | 'prod'
  token             TEXT,                  -- KSeF session token
  token_expires_at  TEXT,
  auto_send_enabled INTEGER DEFAULT 0,
  last_sync_at      TEXT,
  updated_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Kolumny na ksef_invoices przeniesione do CREATE TABLE w schema_v34.sql.
-- NIE przywracaj tu ALTER-ów: padały na produkcji ('duplicate column name: upo_r2_key'),
-- a import D1 z --file jest transakcyjny per plik, więc jeden taki błąd wycofywał CAŁY
-- ten plik i obie tabele wyżej nigdy nie powstawały. Potwierdzone w logu nocnego
-- przebiegu (run 31565799753, 12.08) oraz sekcją [2] raportu d1-schema-diff.

CREATE INDEX IF NOT EXISTS idx_ksef_queue ON ksef_offline_queue(company_id, status, next_retry_at);
-- Indeks zawężony do kolumn z pierwotnego CREATE TABLE (schema_v34). Pierwotnie
-- obejmował też retry_count — kolumnę dodawaną ALTER-em w tym samym pliku, więc na
-- bazie, gdzie ALTER nie przeszedł, ten CREATE INDEX wywracał plik po raz drugi.
-- Zawężenie działa na obu stanach bazy; kolumny wiodące zapytania pozostają pokryte.
CREATE INDEX IF NOT EXISTS idx_ksef_retry ON ksef_invoices(company_id, ksef_status);
