-- Rezerwacje pojazdów (Kalendarz floty) — migracja z localStorage do D1
-- Używa nr_rej (zamiast vehicle.id) jako stabilnego klucza identyfikacji pojazdu
CREATE TABLE IF NOT EXISTS reservations (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  nr_rej      TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  start       TEXT NOT NULL,
  end         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reserv_company ON reservations(company_id, start, end);
