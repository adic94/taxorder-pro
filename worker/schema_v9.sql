-- Schema v9: user_id na push_subscriptions (powiązanie subskrypcji z userem dla per-user prefs)
ALTER TABLE push_subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
