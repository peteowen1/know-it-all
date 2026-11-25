-- Which write made each version of a key, so a device whose reply was lost
-- can tell that the copy now on the server was built on its own write, and
-- not add its plays in a second time. `wid` is a random id the device picks
-- per key per push. Rows older than 60 days are swept on each write: a reply
-- lost for longer than that is not worth keeping a history for.
CREATE TABLE IF NOT EXISTS kv_writes (
  sub TEXT NOT NULL,
  key TEXT NOT NULL,
  wid TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (sub, key, wid)
);
CREATE INDEX IF NOT EXISTS kv_writes_age ON kv_writes (sub, updated_at);
