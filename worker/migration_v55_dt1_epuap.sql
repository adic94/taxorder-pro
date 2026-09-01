-- Migracja v55: śledzenie wysyłki DT-1 przez ePUAP + realny zapis PDF do R2.
-- `dt1_declarations` (schema_v14) miała już `pdf_r2_key`, ale nic go nigdy nie
-- ustawiało — generator PDF tylko pobierał plik do przeglądarki, nie zapisywał
-- go w programie. Ta migracja dokłada wyłącznie dwie kolumny na datę i numer
-- referencyjny wysyłki przez ePUAP; zapis samego PDF do R2 nie wymaga zmiany
-- schematu (kolumna już istniała).
--
-- Nazwa `migration_v55_`, nie `schema_v55_` — nocny automat uruchamia
-- wyłącznie `schema_v*.sql`. Uruchomienie tego pliku jest ręczne i świadome,
-- zgodnie z konwencją migracji strukturalnych w tym projekcie.
--
-- ALTER ADD COLUMN jest przyrostowy — bezpieczny także wtedy, gdy tabela ma
-- już wiersze (istniejące deklaracje po prostu dostają NULL w obu kolumnach).
ALTER TABLE dt1_declarations ADD COLUMN epuap_sent_at TEXT;
ALTER TABLE dt1_declarations ADD COLUMN epuap_reference TEXT;
