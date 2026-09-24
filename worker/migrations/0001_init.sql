-- Accounts are Google accounts: `sub` is Google's permanent id for the person,
-- stable even if they change their email address.
CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,
  email TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

-- Only a SHA-256 of each session token is stored, so a leaked copy of this
-- table cannot be replayed as a login.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_sub ON sessions (sub);

-- One row per saved browser key. `value` is the raw string the app keeps in
-- localStorage; NULL means the key was deleted (a finished round), and is kept
-- so the deletion reaches the other devices instead of being resurrected.
CREATE TABLE IF NOT EXISTS kv (
  sub TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (sub, key)
);

-- One-off parcels carrying progress from the old github.io address to this
-- one. Read once, then deleted; expired ones are swept on every write.
CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
