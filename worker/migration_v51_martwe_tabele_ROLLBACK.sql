-- ROLLBACK dla migration_v51_martwe_tabele.sql
--
-- Zdejmuje kolumny dodane tamtą migracją i indeksy na nich oparte. Kolejność ma
-- znaczenie: najpierw indeksy, potem kolumny — DROP COLUMN na kolumnie objętej
-- indeksem kończy się błędem.
--
-- ⚠️ DROP COLUMN USUWA DANE Z TEJ KOLUMNY BEZPOWROTNIE. W chwili tworzenia tego pliku
-- wszystkie sześć tabel miało zero wierszy (zmierzone na produkcyjnym D1 27.08), więc
-- wycofanie było bezstratne. Jeśli uruchamiasz to PÓŹNIEJ, sprawdź najpierw, czy przez
-- ten czas nic się nie zapisało — te kolumny są tym, do czego pisze aplikacja.
--
-- SQLite obsługuje `ALTER TABLE ... DROP COLUMN` od 3.35; jeśli D1 odmówi, wycofanie
-- wymaga przebudowy tabeli (CREATE ... AS SELECT + DROP + RENAME).

DROP INDEX IF EXISTS idx_msg_parent;
DROP INDEX IF EXISTS idx_dws_work_date;
DROP INDEX IF EXISTS idx_sent_departure;
DROP INDEX IF EXISTS idx_edo_sent_date;

ALTER TABLE cmr_documents DROP COLUMN cmr_number;
ALTER TABLE cmr_documents DROP COLUMN sender_name;
ALTER TABLE cmr_documents DROP COLUMN sender_address;
ALTER TABLE cmr_documents DROP COLUMN sender_country;
ALTER TABLE cmr_documents DROP COLUMN receiver_country;
ALTER TABLE cmr_documents DROP COLUMN loading_place;
ALTER TABLE cmr_documents DROP COLUMN delivery_place;
ALTER TABLE cmr_documents DROP COLUMN cargo_description;
ALTER TABLE cmr_documents DROP COLUMN declared_value_pln;
ALTER TABLE sent_records DROP COLUMN sent_number;
ALTER TABLE sent_records DROP COLUMN goods_name;
ALTER TABLE sent_records DROP COLUMN cn_code;
ALTER TABLE sent_records DROP COLUMN mass_kg;
ALTER TABLE sent_records DROP COLUMN value_pln;
ALTER TABLE sent_records DROP COLUMN transport_type;
ALTER TABLE sent_records DROP COLUMN loading_place;
ALTER TABLE sent_records DROP COLUMN delivery_place;
ALTER TABLE sent_records DROP COLUMN departure_date;
ALTER TABLE sent_records DROP COLUMN expected_delivery_date;
ALTER TABLE messages DROP COLUMN body;
ALTER TABLE messages DROP COLUMN parent_id;
ALTER TABLE messages DROP COLUMN vehicle_reg;
ALTER TABLE edoreczenia_items DROP COLUMN title;
ALTER TABLE edoreczenia_items DROP COLUMN reference_number;
ALTER TABLE edoreczenia_items DROP COLUMN sender_name;
ALTER TABLE edoreczenia_items DROP COLUMN receiver_name;
ALTER TABLE edoreczenia_items DROP COLUMN sent_date;
ALTER TABLE edoreczenia_items DROP COLUMN deadline_date;
ALTER TABLE edoreczenia_items DROP COLUMN delivered_at;
ALTER TABLE edoreczenia_items DROP COLUMN edo_box_id;
ALTER TABLE edoreczenia_items DROP COLUMN description;
ALTER TABLE edoreczenia_items DROP COLUMN notes;
ALTER TABLE driver_work_sessions DROP COLUMN work_date;
ALTER TABLE driver_work_sessions DROP COLUMN work_duration_mins;
ALTER TABLE driver_work_sessions DROP COLUMN break_duration_mins;
ALTER TABLE driver_work_sessions DROP COLUMN mileage_km;
ALTER TABLE driver_work_sessions DROP COLUMN route_description;
ALTER TABLE driver_work_sessions DROP COLUMN status;
ALTER TABLE report_configs DROP COLUMN filter_col;
ALTER TABLE report_configs DROP COLUMN filter_val;
ALTER TABLE report_configs DROP COLUMN sort_col;
ALTER TABLE report_configs DROP COLUMN row_limit;
