-- migration_v50 ROLLBACK: esg_targets z modelu v41 (metric_key) z powrotem na v35 (sztywne kolumny)
--
-- Uruchom:
--   wrangler d1 execute taxorder-pro --remote --file=worker/migration_v50_esg_targets_ROLLBACK.sql
--
-- ⚠ ROLLBACK JEST STRATNY. Model v35 ma miejsce tylko na cztery metryki. Wiersze o kluczach
-- spoza listy poniżej (np. co2_per_km, accidents_per_1m_km, training_hours, fuel_cost_pln,
-- mileage_km, diversity_score) NIE MAJĄ gdzie się zapisać i zostaną utracone. Jeśli po
-- migracji ktoś zdążył dodać takie cele, najpierw je wyeksportuj:
--   wrangler d1 execute taxorder-pro --remote --json --command "SELECT * FROM esg_targets"
--
-- Stratne jest też scalanie opisów: v41 trzyma description per metryka, v35 jeden `notes`
-- na cały rok — zostaje jeden z nich (MAX), reszta przepada.
--
-- Rozważ najpierw D1 Time Travel (okno 30 dni) — cofa całą bazę bez utraty danych:
--   wrangler d1 time-travel restore taxorder-pro --timestamp=<przed migracją>

CREATE TABLE IF NOT EXISTS esg_targets_v35 (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  co2_target_kg REAL,
  fuel_target_l REAL,
  ev_percentage_target REAL,
  electric_km_target REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Odwrotność rozbicia: wiele wierszy metryk -> jeden wiersz na (firma, rok).
-- CO2 wraca z ton na kilogramy (×1000).
INSERT INTO esg_targets_v35 (company_id, year, co2_target_kg, fuel_target_l, ev_percentage_target, electric_km_target, notes)
SELECT company_id, year,
       MAX(CASE WHEN metric_key = 'co2_total_tonnes'   THEN target_value * 1000.0 END),
       MAX(CASE WHEN metric_key = 'fuel_consumption_l' THEN target_value END),
       MAX(CASE WHEN metric_key = 'ev_share_pct'       THEN target_value END),
       MAX(CASE WHEN metric_key = 'electric_km'        THEN target_value END),
       MAX(description)
FROM esg_targets
GROUP BY company_id, year;

DROP INDEX IF EXISTS idx_esg_co_metric;
DROP INDEX IF EXISTS idx_esg_co_year;
DROP TABLE esg_targets;
ALTER TABLE esg_targets_v35 RENAME TO esg_targets;

-- v35 miał ten indeks jako UNIQUE — odtwarzamy wiernie.
CREATE UNIQUE INDEX IF NOT EXISTS idx_esg_co_year ON esg_targets(company_id, year);
