-- ⚠️ PRZESTARZAŁE — NIE UŻYWAJ TEGO PLIKU.
-- To bootstrap z pierwszej wersji projektu: 7 tabel (users, sessions, vehicles,
-- company_states, user_prefs, documents, push_subscriptions). Baza ma dziś
-- 49 plików schema_v*.sql (kolejne migracje) plus kilka migration_v*.sql
-- (przebudowy strukturalne) — wdrożenie samym tym plikiem da bazę bez firm,
-- KSeF, tachografów, rezerwacji floty i dziesiątek innych tabel; Worker
-- zacznie padać na "no such table" przy pierwszym użyciu czegokolwiek poza
-- podstawowym CRUD-em pojazdów.
-- Pełna procedura inicjalizacji: CLOUDFLARE_DEPLOY.md, Krok 4.
--
-- TaxOrder Pro — Cloudflare D1 Schema (wersja pierwotna, zachowana jako archiwum)

-- ===================== UŻYTKOWNICY =====================
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    UNIQUE NOT NULL COLLATE NOCASE,
  name        TEXT    NOT NULL,
  password_hash TEXT  NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'viewer',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ===================== SESJE =====================
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

-- ===================== POJAZDY =====================
CREATE TABLE IF NOT EXISTS vehicles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id        TEXT    NOT NULL,
  nr_rej            TEXT    NOT NULL,
  axles_count       INTEGER DEFAULT 2,
  suspension_type   TEXT    DEFAULT 'pneumatyczne',
  dmc_zespolu       INTEGER DEFAULT 0,
  miesiace_podatku  INTEGER DEFAULT 12,
  dt1_category      TEXT,
  dt1_tax_amount    REAL,
  data              TEXT    NOT NULL DEFAULT '{}',
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(company_id, nr_rej)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);

-- ===================== STANY FIRM =====================
CREATE TABLE IF NOT EXISTS company_states (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT    UNIQUE NOT NULL,
  tax_year     TEXT    DEFAULT '2026',
  selected_ids TEXT    DEFAULT '[]',
  taxpayer     TEXT    DEFAULT '{}',
  updated_at   TEXT    DEFAULT (datetime('now'))
);

-- ===================== PREFERENCJE UŻYTKOWNIKA =====================
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  col_order   TEXT,
  col_visible TEXT,
  col_widths  TEXT,
  density     TEXT    DEFAULT 'normal',
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ===================== DOKUMENTY (metadane; pliki w R2) =====================
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT    PRIMARY KEY,
  nr_rej      TEXT    NOT NULL,
  company_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL DEFAULT 'application/octet-stream',
  r2_key      TEXT    NOT NULL UNIQUE,
  uploaded_at TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_vehicle ON documents(company_id, nr_rej);

-- ===================== PUSH SUBSCRIPTIONS =====================
-- Subskrypcje Web Push per urządzenie+firma (nie wymagają Worker auth — używają Supabase session)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  TEXT    NOT NULL,
  endpoint    TEXT    NOT NULL UNIQUE,
  p256dh      TEXT    NOT NULL,
  auth_key    TEXT    NOT NULL,
  label       TEXT,
  updated_at  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_company ON push_subscriptions(company_id);

-- ===================== DANE STARTOWE — ADMINISTRATOR =====================
-- Hasło administratora ustawia się przez Worker (PBKDF2 + sól per-użytkownik, patrz worker/index.js hashPwd).
-- Publiczny endpoint /api/auth/setup został usunięty (był tylko jednorazowym narzędziem bootstrapowym, ryzyko bezpieczeństwa jako trwały publiczny endpoint).
-- Aby zresetować hasło administratora ręcznie: zaloguj się jako admin i użyj panelu Użytkownicy,
-- albo (awaryjnie, z dostępem do `wrangler`) tymczasowo dodaj lokalnie endpoint debug/skrypt Node wołający hashPwd() i wklej wynik:
--   wrangler d1 execute taxorder-pro --command="UPDATE users SET password_hash='<hash>', salt='<sól>' WHERE email='adamus1000@gmail.com'" --remote
INSERT OR IGNORE INTO users(email, name, password_hash, role)
VALUES('adamus1000@gmail.com', 'Administrator', '__HASH_PLACEHOLDER__', 'admin');
