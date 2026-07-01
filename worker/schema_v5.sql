-- TaxOrder Pro — D1 Schema v5 (sól per użytkownik dla hashowania haseł)
-- Uruchom: wrangler d1 execute taxorder-pro --file=worker/schema_v5.sql --remote
--
-- Kolumna NULLABLE celowo: istniejące konta mają salt=NULL ("legacy"), co worker/index.js
-- interpretuje jako "zweryfikuj starą stałą solą, a po udanym logowaniu domigruj losową solą".
-- Zero przestoju, brak wymuszonego resetu haseł.
ALTER TABLE users ADD COLUMN salt TEXT;
