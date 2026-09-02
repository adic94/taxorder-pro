-- Migracja v56: nr faktury zakupu i dostawca dla opon w magazynie.
-- `tires` (schema_v2) nie miała pola na powiązanie zakupu z fakturą/dostawcą —
-- zgłoszenie użytkownika: przy dodawaniu opony do magazynu nie da się zapisać,
-- z jakiej faktury i od jakiego dostawcy pochodzi.
--
-- Nazwa `migration_v56_`, nie `schema_v56_` — nocny automat uruchamia
-- wyłącznie `schema_v*.sql`. Uruchomienie tego pliku jest ręczne i świadome,
-- zgodnie z konwencją migracji strukturalnych w tym projekcie.
--
-- ALTER ADD COLUMN jest przyrostowy — bezpieczny także wtedy, gdy tabela ma
-- już wiersze (istniejące opony po prostu dostają NULL w obu kolumnach).
ALTER TABLE tires ADD COLUMN nr_faktury TEXT;
ALTER TABLE tires ADD COLUMN dostawca TEXT;
