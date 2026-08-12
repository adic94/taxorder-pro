-- TaxOrder Pro — D1 Schema v2 (Faza 1: Szkody, Magazyn Opon)
-- Uruchom: wrangler d1 execute taxorder-pro --file=worker/schema_v2.sql --remote

-- ===================== SZKODY (DAMAGE REPORTS) =====================
CREATE TABLE IF NOT EXISTS damage_reports (
  id              TEXT    PRIMARY KEY,
  company_id      TEXT    NOT NULL,
  nr_rej          TEXT    NOT NULL,
  opis            TEXT,
  przyczyna       TEXT,
  data_zdarzenia  TEXT,
  status          TEXT    NOT NULL DEFAULT 'ZGLOSZONA',
  koszt           REAL,
  zglaszajacy     TEXT,
  uwagi           TEXT,
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')),
  -- Przeniesione z ALTER-ow w schema_v23.sql, schema_v24.sql (patrz komentarz w tamtych plikach).
  branch_id INTEGER,
  gl_account TEXT
);
CREATE INDEX IF NOT EXISTS idx_damage_vehicle ON damage_reports(company_id, nr_rej);

-- Zdjęcia szkody (metadane; pliki w R2 pod kluczem damage/{company}/{nrRej}/{damageId}/{photoId})
CREATE TABLE IF NOT EXISTS damage_photos (
  id          TEXT    PRIMARY KEY,
  damage_id   TEXT    NOT NULL REFERENCES damage_reports(id) ON DELETE CASCADE,
  r2_key      TEXT    NOT NULL UNIQUE,
  mime_type   TEXT    NOT NULL DEFAULT 'image/jpeg',
  uploaded_at TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_damage_photos ON damage_photos(damage_id);

-- ===================== OPONY — MAGAZYN I CYKL ŻYCIA =====================
CREATE TABLE IF NOT EXISTS tires (
  id                  TEXT    PRIMARY KEY,
  company_id          TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'MAGAZYN',
  nr_rej              TEXT,
  pozycja             TEXT,
  rozmiar             TEXT,
  marka               TEXT,
  dot                 TEXT,
  bieznik_mm          REAL,
  sezon               TEXT,
  lokalizacja_magazyn TEXT,
  data_zakupu         TEXT,
  uwagi               TEXT,
  historia            TEXT    NOT NULL DEFAULT '[]',
  created_at          TEXT    DEFAULT (datetime('now')),
  updated_at          TEXT    DEFAULT (datetime('now')),
  -- Przeniesione z ALTER-ow w schema_v23.sql (patrz komentarz w tamtych plikach).
  branch_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tires_company ON tires(company_id);
CREATE INDEX IF NOT EXISTS idx_tires_vehicle ON tires(company_id, nr_rej);
