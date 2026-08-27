-- migration_v51 — sześć tabel dostało w schema_v35 kształt, którego nie używa żaden kod
--
-- CO TO NAPRAWIA. `cmr_documents`, `sent_records`, `messages`, `edoreczenia_items`,
-- `driver_work_sessions` i `report_configs` mają w schemacie inne nazwy kolumn niż te,
-- których żądają handlery w `worker/index.js` — a front wysyła dokładnie te same nazwy
-- co handlery. Kod front↔backend zgadza się ze sobą, odmieńcem jest schemat, więc te
-- funkcje NIGDY NIE DZIAŁAŁY: POST padał na „no such column", lista wracała pusta przez
-- `.catch()`. Pełny inwentarz: docs/ROZJAZD-KOLUMN.md.
--
-- DLACZEGO `ALTER ADD COLUMN`, A NIE PRZEBUDOWA TABEL. Dodawanie kolumn jest
-- przyrostowe i poprawne niezależnie od tego, czy tabele mają wiersze. Przebudowa
-- (CREATE ... AS SELECT + DROP + RENAME) byłaby czystsza, ale w razie pomyłki kasuje
-- dane. Zmierzone na produkcyjnym D1 27.08: WSZYSTKIE SZEŚĆ TABEL MA ZERO WIERSZY,
-- więc ryzyko jest zerowe w obie strony — wybieram wariant, który zostaje bezpieczny
-- także wtedy, gdy ktoś uruchomi ten plik później, na bazie z danymi.
--
-- STARE KOLUMNY ZOSTAJĄ NIETKNIĘTE. `document_number`, `notification_number`,
-- `planned_start`, `received_at`, `content_summary`, `session_date` i pozostałe mają
-- zero wystąpień w workerze ORAZ we froncie (zmierzone), więc nic ich nie czyta.
-- Usunięcie ich wymaga przebudowy tabeli — osobna decyzja, nie przy okazji.
--
-- ⚠️ NAZWA `migration_v51_`, NIE `schema_v51_`, JEST CELOWA. Nocny automat uruchamia
-- glob `worker/schema_v*.sql`; migracje strukturalne trzymamy poza nim, żeby ALTER-y
-- nie wykonywały się same co noc. Ten plik stosuje się RĘCZNIE:
--     wrangler d1 execute taxorder-pro --remote --file=worker/migration_v51_martwe_tabele.sql
-- Wycofanie: worker/migration_v51_martwe_tabele_ROLLBACK.sql

-- ── CMR (list przewozowy) ────────────────────────────────────────────────────
ALTER TABLE cmr_documents ADD COLUMN cmr_number TEXT;
ALTER TABLE cmr_documents ADD COLUMN sender_name TEXT;
ALTER TABLE cmr_documents ADD COLUMN sender_address TEXT;
ALTER TABLE cmr_documents ADD COLUMN sender_country TEXT;
ALTER TABLE cmr_documents ADD COLUMN receiver_country TEXT;
ALTER TABLE cmr_documents ADD COLUMN loading_place TEXT;
ALTER TABLE cmr_documents ADD COLUMN delivery_place TEXT;
ALTER TABLE cmr_documents ADD COLUMN cargo_description TEXT;
ALTER TABLE cmr_documents ADD COLUMN declared_value_pln REAL;

-- ── SENT (elektroniczny nadzór transportu) ───────────────────────────────────
ALTER TABLE sent_records ADD COLUMN sent_number TEXT;
ALTER TABLE sent_records ADD COLUMN goods_name TEXT;
ALTER TABLE sent_records ADD COLUMN cn_code TEXT;
ALTER TABLE sent_records ADD COLUMN mass_kg REAL;
ALTER TABLE sent_records ADD COLUMN value_pln REAL;
ALTER TABLE sent_records ADD COLUMN transport_type TEXT;
ALTER TABLE sent_records ADD COLUMN loading_place TEXT;
ALTER TABLE sent_records ADD COLUMN delivery_place TEXT;
ALTER TABLE sent_records ADD COLUMN departure_date TEXT;
ALTER TABLE sent_records ADD COLUMN expected_delivery_date TEXT;

-- ── Wiadomości ───────────────────────────────────────────────────────────────
-- `parent_id` jest tu istotne: bez niego wątkowanie nie działa wcale, a handler
-- `GET /api/messages/:id/thread` odwołuje się do niego wprost.
ALTER TABLE messages ADD COLUMN body TEXT;
ALTER TABLE messages ADD COLUMN parent_id TEXT;
ALTER TABLE messages ADD COLUMN vehicle_reg TEXT;

-- ── e-Doręczenia ─────────────────────────────────────────────────────────────
ALTER TABLE edoreczenia_items ADD COLUMN title TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN reference_number TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN sender_name TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN receiver_name TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN sent_date TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN deadline_date TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN delivered_at TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN edo_box_id TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN description TEXT;
ALTER TABLE edoreczenia_items ADD COLUMN notes TEXT;

-- ── Czas pracy kierowcy ──────────────────────────────────────────────────────
ALTER TABLE driver_work_sessions ADD COLUMN work_date TEXT;
ALTER TABLE driver_work_sessions ADD COLUMN work_duration_mins INTEGER;
ALTER TABLE driver_work_sessions ADD COLUMN break_duration_mins INTEGER;
ALTER TABLE driver_work_sessions ADD COLUMN mileage_km REAL;
ALTER TABLE driver_work_sessions ADD COLUMN route_description TEXT;
ALTER TABLE driver_work_sessions ADD COLUMN status TEXT;

-- ── Kreator raportów — zapisane konfiguracje ─────────────────────────────────
ALTER TABLE report_configs ADD COLUMN filter_col TEXT;
ALTER TABLE report_configs ADD COLUMN filter_val TEXT;
ALTER TABLE report_configs ADD COLUMN sort_col TEXT;
ALTER TABLE report_configs ADD COLUMN row_limit INTEGER;

-- Indeksy pod zapytania, które handlery faktycznie wykonują.
CREATE INDEX IF NOT EXISTS idx_msg_parent      ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_dws_work_date   ON driver_work_sessions(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_sent_departure  ON sent_records(company_id, departure_date);
CREATE INDEX IF NOT EXISTS idx_edo_sent_date   ON edoreczenia_items(company_id, sent_date);
