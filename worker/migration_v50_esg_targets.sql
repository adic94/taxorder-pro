-- migration_v50 (JEDNORAZOWA, NIE schema_vN — patrz niżej): esg_targets — przebudowa z modelu v35 (sztywne kolumny) na v41 (metric_key)
--
-- Uruchom (RĘCZNIE, jednorazowo):
--   wrangler d1 execute taxorder-pro --remote --file=worker/migration_v50_esg_targets.sql
--
-- DLACZEGO `migration_`, A NIE `schema_v50.sql`: nocny workflow uruchamia KAŻDY plik
-- pasujący do `worker/schema_v*.sql`, co noc. Ta nazwa jest więc obietnicą: „plik jest
-- idempotentny, można go puszczać w kółko". Ten plik taki NIE jest — robi DROP TABLE
-- i RENAME, a przy drugim uruchomieniu wywala się na braku kolumny `co2_target_kg`
-- (D1 wycofa go w całości, więc bez szkody, ale co noc raportowałby błąd).
-- Migracje strukturalne (rebuild / DROP / ALTER) nazywaj `migration_vNN_opis.sql`,
-- żeby nie trafiły do automatu. Dla przypomnienia, ile kosztuje pomyłka w tym miejscu:
-- pliki `schema_vNN_ROLLBACK.sql` też pasowały do tego globa i kasowały tabele co noc.
--
-- DLACZEGO: produkcyjne D1 stoi na strukturze z schema_v35 (potwierdzone PRAGMA table_info
-- 11.08.2026). schema_v41 miał ją przedefiniować, ale użył CREATE TABLE IF NOT EXISTS,
-- co na istniejącej tabeli jest CICHYM NO-OPEM. Backend (worker/index.js: POST/PUT
-- /api/esg-targets/targets) i modules/esg-report.js są napisane pod model v41 — piszą
-- kolumny metric_key/target_value/unit/lower_is_better/description, których w bazie NIE MA.
-- Skutek: każda próba dodania celu ESG kończy się 500 (zapytanie nie ma .catch()).
--
-- UWAGA — DWIE PUŁAPKI, dla których nie wystarczy ponowne uruchomienie schema_v41.sql:
--
--   1. SQLite nie zmieni struktury tabeli w miejscu. Konieczna jest pełna przebudowa:
--      nowa tabela -> przepisanie danych -> DROP -> RENAME.
--
--   2. schema_v35 tworzy indeks **UNIQUE** idx_esg_co_year (company_id, year), a model v41
--      wymaga WIELU wierszy na ten sam rok (po jednym na metrykę). schema_v41 deklaruje
--      indeks o TEJ SAMEJ nazwie, ale bez UNIQUE — więc CREATE INDEX IF NOT EXISTS też był
--      no-opem. Gdyby zostawić stary indeks, nowy model byłby zablokowany przy drugiej
--      metryce w roku. Poniżej jest jawny DROP INDEX.
--
-- PRZED URUCHOMIENIEM: sprawdź, ile jest danych do przeniesienia —
--   wrangler d1 execute taxorder-pro --remote --command "SELECT COUNT(*) FROM esg_targets"
-- Przy zerze migracja jest bezstratna z definicji. Przy niezerowej liczbie: D1 Time Travel
-- pozwala cofnąć bazę do punktu sprzed migracji (okno 30 dni) — zanotuj czas uruchomienia.

CREATE TABLE IF NOT EXISTS esg_targets_v50 (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id      TEXT NOT NULL,
  metric_key      TEXT NOT NULL,
  year            INTEGER NOT NULL,
  target_value    REAL NOT NULL,
  unit            TEXT,
  lower_is_better INTEGER DEFAULT 1,
  description     TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Przepisanie danych: jeden wiersz v35 rozpada się na maks. 4 wiersze v41, po jednym na
-- wypełnioną kolumnę celu. Klucze metryk muszą się zgadzać z METRIC_LBL w esg-report.js
-- oraz z `actuals` zwracanymi przez handleEsgTargets, inaczej UI nie zestawi celu z realizacją.

-- CO2: v35 trzyma KILOGRAMY, metryka co2_total_tonnes oczekuje TON (backend liczy co2/1000).
-- Bez dzielenia cele byłyby zawyżone 1000×.
INSERT INTO esg_targets_v50 (company_id, metric_key, year, target_value, unit, lower_is_better, description)
SELECT company_id, 'co2_total_tonnes', year, co2_target_kg / 1000.0, 't', 1, notes
FROM esg_targets WHERE co2_target_kg IS NOT NULL;

INSERT INTO esg_targets_v50 (company_id, metric_key, year, target_value, unit, lower_is_better, description)
SELECT company_id, 'fuel_consumption_l', year, fuel_target_l, 'l', 1, notes
FROM esg_targets WHERE fuel_target_l IS NOT NULL;

-- Udział EV: im WIĘCEJ, tym lepiej — jedyna metryka z lower_is_better = 0.
INSERT INTO esg_targets_v50 (company_id, metric_key, year, target_value, unit, lower_is_better, description)
SELECT company_id, 'ev_share_pct', year, ev_percentage_target, '%', 0, notes
FROM esg_targets WHERE ev_percentage_target IS NOT NULL;

-- electric_km_target nie ma odpowiednika w METRIC_LBL (esg-report.js). Zachowujemy dane pod
-- surowym kluczem — UI pokaże go bez ładnej etykiety, ale nic nie ginie. Jeśli ta metryka ma
-- być wspierana, dopisz 'electric_km' do METRIC_LBL i zmień klucz poniżej.
INSERT INTO esg_targets_v50 (company_id, metric_key, year, target_value, unit, lower_is_better, description)
SELECT company_id, 'electric_km', year, electric_km_target, 'km', 0, notes
FROM esg_targets WHERE electric_km_target IS NOT NULL;

-- Stary UNIQUE(company_id, year) MUSI zniknąć — patrz pułapka 2 w nagłówku.
DROP INDEX IF EXISTS idx_esg_co_year;
DROP TABLE esg_targets;
ALTER TABLE esg_targets_v50 RENAME TO esg_targets;

CREATE INDEX IF NOT EXISTS idx_esg_co_year ON esg_targets(company_id, year);
CREATE INDEX IF NOT EXISTS idx_esg_co_metric ON esg_targets(company_id, metric_key, year);
