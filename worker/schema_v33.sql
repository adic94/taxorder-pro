-- Schema v33: System pakietów i uprawnień modułów per firma/użytkownik

-- Pakiety firm (jeden rekord per firma)
CREATE TABLE IF NOT EXISTS company_packages (
  company_id TEXT PRIMARY KEY,
  package_name TEXT DEFAULT 'enterprise',   -- 'basic' | 'pro' | 'enterprise' | 'custom'
  modules_add TEXT DEFAULT '[]',            -- JSON: moduły dodane ponad pakiet
  modules_remove TEXT DEFAULT '[]',         -- JSON: moduły zablokowane z pakietu
  valid_until TEXT,                         -- NULL = bezterminowo
  notes TEXT,                               -- np. "Klient Premium, kontrakt do 2026"
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Uprawnienia modułów per użytkownik (delta od firmy)
CREATE TABLE IF NOT EXISTS user_module_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  -- NULL = dziedzicz z firmy | JSON array = nadpisz listę
  allowed_modules TEXT DEFAULT NULL,
  -- Zawsze odejmowane od zestawu firmy (explicit deny)
  denied_modules TEXT DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ump_co_user ON user_module_permissions(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ump_company ON user_module_permissions(company_id);
