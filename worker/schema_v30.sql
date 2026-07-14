-- Schema v30: CPC kierowcy, kalibracja tachografów pojazdów, konfiguracja integracji Flespi/Teltonika

-- CPC / Kwalifikacja zawodowa kierowcy (Dyrektywa 2003/59/WE)
ALTER TABLE drivers ADD COLUMN cpc_card_number TEXT;
ALTER TABLE drivers ADD COLUMN cpc_expiry_date TEXT;            -- YYYY-MM-DD
ALTER TABLE drivers ADD COLUMN cpc_training_hours INTEGER DEFAULT 0;   -- z 35h co 5 lat
ALTER TABLE drivers ADD COLUMN cpc_training_deadline TEXT;     -- data kolejnego bloku szkoleniowego

-- Kalibracja tachografu i ostatnie pobranie VU (Rozp. 165/2014 Art. 23)
ALTER TABLE vehicles ADD COLUMN tacho_calibration_date TEXT;   -- data ostatniej kalibracji
ALTER TABLE vehicles ADD COLUMN tacho_calibration_next TEXT;   -- = calibration_date + 2 lata
ALTER TABLE vehicles ADD COLUMN tacho_vu_last_download TEXT;   -- data ostatniego pobrania VU (limit 90 dni)

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
