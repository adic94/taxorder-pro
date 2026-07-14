-- Schema v29: Kary pieniężne PLN w naruszeniach tachografu
ALTER TABLE tachograph_violations ADD COLUMN penalty_pln INTEGER DEFAULT 0;
