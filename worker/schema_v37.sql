-- schema_v37: Clerk auth integration — kolumna clerk_user_id w tabeli users
ALTER TABLE users ADD COLUMN clerk_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
