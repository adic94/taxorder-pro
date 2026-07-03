-- Web Push Notifications — subskrypcje przeglądarek
-- Jeden rekord = jedna subskrypcja (endpoint jest unikalny per przeglądarka/urządzenie).
-- p256dh i auth_key to klucze szyfrowania RFC 8291 (aes128gcm).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id  TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth_key    TEXT NOT NULL,
  label       TEXT,               -- np. "Adam — Chrome na laptopie"
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_company ON push_subscriptions(company_id);
