-- schema_v46_ROLLBACK: odwrócenie migracji Driver PWA, HR, Winiety, Środki Trwałe, Rating Przewoźników
-- Uruchom: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v46_ROLLBACK.sql
--
-- ⚠️  UTRACISZ: wszystkie rekordy z poniższych tabel (trasy kierowców, urlopy,
--     badania lekarskie, winiety, urządzenia eToll, środki trwałe, ratingi przewoźników).

DROP INDEX IF EXISTS idx_crh_carrier;
DROP INDEX IF EXISTS idx_cr_company;
DROP INDEX IF EXISTS idx_fad_asset;
DROP INDEX IF EXISTS idx_fa_company;
DROP INDEX IF EXISTS idx_etoll_company;
DROP INDEX IF EXISTS idx_vig_vehicle;
DROP INDEX IF EXISTS idx_vig_company;
DROP INDEX IF EXISTS idx_hr_exams;
DROP INDEX IF EXISTS idx_hr_leaves_driver;
DROP INDEX IF EXISTS idx_hr_leaves;
DROP INDEX IF EXISTS idx_dt_company;

DROP TABLE IF EXISTS carrier_rating_history;
DROP TABLE IF EXISTS carrier_ratings;
DROP TABLE IF EXISTS fixed_asset_depreciation;
DROP TABLE IF EXISTS fixed_assets;
DROP TABLE IF EXISTS etoll_devices;
DROP TABLE IF EXISTS vignettes;
DROP TABLE IF EXISTS hr_medical_exams;
DROP TABLE IF EXISTS hr_leaves;
DROP TABLE IF EXISTS driver_trips;
