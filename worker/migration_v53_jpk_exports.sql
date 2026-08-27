-- migration_v53: jpk_exports — handler i front mówią jednym słownikiem, tabela innym
--
-- ZNALEZIONE 27.08 przy audycie zapytań składanych dynamicznie (nazwa tabeli w zmiennej,
-- więc strażnik kolumn ich nie sprawdzał — `const TABLE='jpk_exports'` w handleJpk).
--
-- STAN PRZED, potwierdzony `SELECT sql FROM sqlite_master` na PRODUKCYJNYM D1:
--   tabela ma  export_type, period_from, period_to, xml_hash, sent_at, notes, created_at
--   INSERT ma  jpk_type, year, month, quarter, period_label, r2_key, row_count
-- Siedem kolumn INSERT-a nie istnieje. Ten INSERT (index.js:12560) jest jako JEDYNY
-- w handlerze BEZ `.catch()`, więc `POST /api/jpk/generate` pada 500 przy każdym
-- wywołaniu — eksport JPK nigdy nie zadziałał. `SELECT COUNT(*) FROM jpk_exports` = 0
-- potwierdza to niezależnie: nic nigdy nie zapisało wiersza.
--
-- KIERUNEK NAPRAWY: tabela ustępuje handlerowi, nie odwrotnie. Rozstrzyga to, że
-- słownikiem handlera mówi też FRONT (`modules/jpk.js:68,69` czyta `e.jpk_type`
-- i `e.period_label`) oraz ścieżka pobrania (`rec.r2_key`, index.js:12566). Kolumn
-- `export_type`/`period_from`/`period_to` nie czyta ani nie pisze NIC.
--
-- DLACZEGO PRZEBUDOWA, A NIE `ALTER ADD COLUMN` jak w migration_v51:
-- ścieżka przyrostowa jest tu zamknięta — `export_type`, `period_from` i `period_to`
-- są NOT NULL bez wartości domyślnej, a INSERT handlera ich nie wypełnia, więc nawet
-- po dodaniu siedmiu brakujących kolumn nadal padałby. Drugie wyjście — dopisanie
-- handlerowi tych trzech pól — dałoby DWIE kolumny na tę samą treść (`jpk_type`
-- obok `export_type`), czyli dokładnie ten wzorzec, który w tym projekcie rozjeżdżał
-- się już pięć razy (wskaźniki CO2, źródła kreatora raportów, prompt DR).
--
-- ⚠️ PRZEBUDOWA NIE ZAKŁADA PUSTEJ TABELI. Istniejące wiersze są PRZENOSZONE
-- z odwzorowaniem starego słownika na nowy (export_type→jpk_type, rok z period_from,
-- period_label sklejone z zakresu). Na produkcji jest ich zero, ale plik ma być
-- poprawny także tam, gdzie ktoś zdążył coś zapisać.
--
-- Nazwa `migration_v53_`, nie `schema_v53_`, jest celowa — nocny automat uruchamia glob
-- `schema_v*.sql`, a migracje strukturalne trzymamy poza nim. Uruchomienie jest ręczne:
--   wrangler d1 execute taxorder-pro --remote --file=worker/migration_v53_jpk_exports.sql

CREATE TABLE IF NOT EXISTS jpk_exports_v53 (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  jpk_type        TEXT NOT NULL,              -- 'JPK_V7M'|'JPK_V7K'|'JPK_FA'|'JPK_MAG'|'SAF_T'
  year            INTEGER NOT NULL,
  month           INTEGER,                    -- NULL dla okresów kwartalnych i rocznych
  quarter         INTEGER,                    -- NULL dla okresów miesięcznych
  period_label    TEXT,                       -- etykieta okresu pokazywana w UI
  status          TEXT DEFAULT 'ready',       -- 'ready'|'submitted'|'accepted'|'error'
  r2_key          TEXT,                       -- klucz pliku XML w R2; bez niego pobranie jest niemożliwe
  file_size_bytes INTEGER,
  row_count       INTEGER,
  xml_hash        TEXT,                       -- zachowane z poprzedniej struktury
  sent_at         TEXT,                       -- zachowane z poprzedniej struktury
  notes           TEXT,                       -- zachowane z poprzedniej struktury
  created_at      TEXT DEFAULT (datetime('now'))
);

INSERT INTO jpk_exports_v53
  (id, company_id, jpk_type, year, month, quarter, period_label,
   status, file_size_bytes, xml_hash, sent_at, notes, created_at)
  SELECT
    id,
    company_id,
    export_type,
    CAST(substr(period_from, 1, 4) AS INTEGER),
    NULL,
    NULL,
    period_from || ' – ' || period_to,
    status,
    file_size_bytes,
    xml_hash,
    sent_at,
    notes,
    created_at
  FROM jpk_exports;

DROP TABLE jpk_exports;
ALTER TABLE jpk_exports_v53 RENAME TO jpk_exports;

CREATE INDEX IF NOT EXISTS idx_jpk_exports_company ON jpk_exports(company_id, created_at DESC);
