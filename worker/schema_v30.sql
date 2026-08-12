-- Schema v30: CPC kierowcy, kalibracja tachografów pojazdów, konfiguracja integracji Flespi/Teltonika

-- CPC / Kwalifikacja zawodowa kierowcy (Dyrektywa 2003/59/WE)

-- Kalibracja tachografu i ostatnie pobranie VU (Rozp. 165/2014 Art. 23)

-- Konfiguracja zewnętrznych integracji tachograficznych (Flespi, Teltonika TachoSync itp.)
CREATE TABLE IF NOT EXISTS tacho_integrations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  provider TEXT NOT NULL,         -- 'flespi' | 'teltonika_tacho' | 'generic_http'
  config TEXT NOT NULL DEFAULT '{}',  -- JSON: token, device_ids, server_url, channel_id
  enabled INTEGER DEFAULT 1,
  last_sync TEXT,
  sync_error TEXT,
  files_synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tacho_int_co_prov ON tacho_integrations(company_id, provider);
CREATE INDEX IF NOT EXISTS idx_tacho_int_company ON tacho_integrations(company_id);

-- ALTER-y ADD COLUMN przeniesione do CREATE TABLE w plikach zrodlowych tabel.
-- NIE przywracaj ich tutaj: padaly przy kazdym powtorzeniu ('duplicate column name'),
-- a import D1 z --file jest transakcyjny per plik — jeden taki blad wycofywal CALY
-- ten plik razem z tabelami, ktore zaklada, wiec stawaly sie nie do odtworzenia.
