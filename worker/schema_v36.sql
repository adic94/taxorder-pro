-- schema_v36: telematyka wideo + kolumna sku w spare_parts
-- Dodaj sku do spare_parts (istniejąca tabela z v25, bez tej kolumny)
CREATE INDEX IF NOT EXISTS idx_parts_sku ON spare_parts(sku);

-- schema_v36: tabela zdarzeń telematyki wideo (ADAS)
CREATE TABLE IF NOT EXISTS video_telematics_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  vehicle_reg TEXT,
  driver_name TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  event_at TEXT NOT NULL,
  speed_kmh REAL,
  location TEXT,
  clip_url TEXT,
  camera_position TEXT,
  device_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vte_company ON video_telematics_events(company_id);
CREATE INDEX IF NOT EXISTS idx_vte_vehicle ON video_telematics_events(vehicle_reg);
CREATE INDEX IF NOT EXISTS idx_vte_event_at ON video_telematics_events(event_at);

-- ALTER-y ADD COLUMN przeniesione do CREATE TABLE w plikach zrodlowych tabel.
-- NIE przywracaj ich tutaj: padaly przy kazdym powtorzeniu ('duplicate column name'),
-- a import D1 z --file jest transakcyjny per plik — jeden taki blad wycofywal CALY
-- ten plik razem z tabelami, ktore zaklada, wiec stawaly sie nie do odtworzenia.
