-- ─── SYSTEM POWIADOMIEŃ — TaxOrder Pro v8 ────────────────────────────────────

-- Typy alertów (wbudowane + własne per firma)
CREATE TABLE IF NOT EXISTS alert_types (
  id            TEXT PRIMARY KEY,
  company_id    TEXT,      -- NULL = wbudowany systemowy; wartość = własny firmy
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK(category IN ('dokumenty','serwis','wyposazenie','wlasny')),
  trigger_time  INTEGER NOT NULL DEFAULT 1,  -- alert wg daty (0/1)
  trigger_km    INTEGER NOT NULL DEFAULT 0,  -- alert wg przebiegu (0/1)
  default_days  TEXT NOT NULL DEFAULT '[30,14,7]', -- JSON array progów dni
  default_km    INTEGER,                     -- próg km przed terminem
  icon          TEXT DEFAULT 'ti-bell',
  sort_order    INTEGER DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Wbudowane typy alertów (seeded)
INSERT OR IGNORE INTO alert_types(id,company_id,name,category,trigger_time,trigger_km,default_days,default_km,icon,sort_order) VALUES
-- Dokumenty & Ubezpieczenia
('oc',            NULL,'Ubezpieczenie OC',                    'dokumenty',1,0,'[30,14,7]',NULL,'ti-shield',1),
('ac',            NULL,'Ubezpieczenie AC',                    'dokumenty',1,0,'[30,14,7]',NULL,'ti-shield-check',2),
('przeglad_tech', NULL,'Przegląd techniczny',                 'dokumenty',1,0,'[30,14,7]',NULL,'ti-tool',3),
('udt',           NULL,'Badanie UDT',                         'dokumenty',1,0,'[30,14,7]',NULL,'ti-crane',4),
('tacho',         NULL,'Legalizacja tachografu',              'dokumenty',1,0,'[30,14,7]',NULL,'ti-clock',5),
('tacho_naprawa', NULL,'Naprawa tachografu',                  'dokumenty',1,0,'[30,14,7]',NULL,'ti-clock-edit',6),
-- Serwis
('olej',          NULL,'Wymiana oleju silnikowego',           'serwis',   1,1,'[30,14,7]',500, 'ti-droplet',10),
('rozrzad',       NULL,'Wymiana rozrządu',                    'serwis',   1,1,'[60,30,14]',2000,'ti-refresh',11),
('hamulce',       NULL,'Przegląd hamulców',                   'serwis',   1,1,'[30,14,7]',500, 'ti-disc',12),
('filtry',        NULL,'Wymiana filtrów (powietrze/kabina)',   'serwis',   1,1,'[30,14,7]',500, 'ti-filter',13),
('opony_zmiana',  NULL,'Zmiana opon sezonowych',              'serwis',   1,0,'[30,14,7]',NULL,'ti-circle-dot',14),
('serwis_ogolny', NULL,'Przegląd serwisowy (ogólny)',         'serwis',   1,1,'[30,14,7]',1000,'ti-settings',15),
-- Wyposażenie & Zabudowa
('gasnica',       NULL,'Legalizacja gaśnicy',                 'wyposazenie',1,0,'[30,14,7]',NULL,'ti-flame',20),
('apteczka',      NULL,'Ważność apteczki',                    'wyposazenie',1,0,'[30,14,7]',NULL,'ti-heart',21),
('zabudowa_asen', NULL,'Przegląd zabudowy asenizacyjnej',     'wyposazenie',1,1,'[30,14,7]',2000,'ti-recycle',22),
('winda_hydr',    NULL,'Przegląd windy hydraulicznej',        'wyposazenie',1,1,'[30,14,7]',NULL,'ti-lift',23),
('dach_wywrotka', NULL,'Przegląd wywrotki/zabudowy',          'wyposazenie',1,1,'[30,14,7]',NULL,'ti-truck-loading',24);

-- Preferencje powiadomień — per użytkownik × typ alertu
CREATE TABLE IF NOT EXISTS notification_prefs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type_id TEXT NOT NULL REFERENCES alert_types(id) ON DELETE CASCADE,
  enabled       INTEGER NOT NULL DEFAULT 1,
  channels      TEXT NOT NULL DEFAULT '{"push":true,"email":false,"sms":false}',
  threshold_days TEXT,     -- JSON array nadpisuje default; NULL = użyj default z alert_types
  threshold_km  INTEGER,   -- nadpisuje default; NULL = użyj default z alert_types
  quiet_from    TEXT DEFAULT '22:00',
  quiet_to      TEXT DEFAULT '07:00',
  UNIQUE(user_id, alert_type_id)
);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_prefs(user_id);

-- Historia wysłanych powiadomień + acknowledge + snooze
CREATE TABLE IF NOT EXISTS notification_log (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id     TEXT NOT NULL,
  user_id        INTEGER REFERENCES users(id),
  alert_type_id  TEXT,
  vehicle_nr_rej TEXT,
  label          TEXT NOT NULL,
  detail         TEXT,
  days_until     INTEGER,
  km_until       INTEGER,
  channel        TEXT NOT NULL, -- 'push','email','sms','inapp'
  sent_at        TEXT DEFAULT (datetime('now')),
  acknowledged_at TEXT,
  snoozed_until  TEXT,
  snooze_days    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notif_log_company ON notification_log(company_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_user    ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_vehicle ON notification_log(vehicle_nr_rej);

-- Szablony konserwacji — zestaw elementów przypisywany do pojazdów en masse
CREATE TABLE IF NOT EXISTS maintenance_templates (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  items       TEXT NOT NULL DEFAULT '[]',
  -- JSON: [{typeId,label,intervalDays,intervalKm,defaultThresholdDays,defaultThresholdKm}]
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_maint_tpl_company ON maintenance_templates(company_id);

-- Dodatkowe uprawnienia użytkowników (admin może nadać innym użytkownikom)
-- Możliwe wartości: 'manage_alert_types','manage_templates','manage_notifications','manage_roles'
ALTER TABLE users ADD COLUMN extra_permissions TEXT DEFAULT '[]';
