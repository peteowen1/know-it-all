-- Leaderboards (docs/plans/LEADERBOARDS.md).

-- Google's first name, kept only as the default nickname.
ALTER TABLE users ADD COLUMN given_name TEXT;

-- What others see: a nickname the person picks, never their email. `public`
-- is the opt-in to appear on public boards (off unless they switch it on).
CREATE TABLE IF NOT EXISTS profiles (
  sub TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- One row per finished round a signed-in player posted. `round_id` comes from
-- the round's clock, so the same round can never be posted twice. `board` is
-- the game and every setting that changes what is asked; `day` is set for a
-- daily round (its puzzle's date) and `late` when it was first played after
-- that day; `week` is the Monday of the week it was played, for weekly boards.
-- `active_ms` pauses while the player is away (friends' boards); `wall_ms`
-- never pauses (public boards).
CREATE TABLE IF NOT EXISTS results (
  sub TEXT NOT NULL,
  round_id TEXT NOT NULL,
  board TEXT NOT NULL,
  day TEXT,
  late INTEGER NOT NULL DEFAULT 0,
  week TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER,
  active_ms INTEGER NOT NULL,
  wall_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (sub, round_id)
);
CREATE INDEX IF NOT EXISTS results_day ON results (board, day);
CREATE INDEX IF NOT EXISTS results_week ON results (board, week);
CREATE INDEX IF NOT EXISTS results_board ON results (board, score DESC, active_ms);

-- Invites: a friend code (one per person; a friend link is the same code in a
-- URL) or a named group. Joining a friend code makes the two people friends
-- both ways; joining a group puts you on its board.
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('friend', 'group')),
  owner TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS invites_one_friend_code ON invites (owner) WHERE kind = 'friend';

CREATE TABLE IF NOT EXISTS members (
  code TEXT NOT NULL,
  sub TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (code, sub)
);
CREATE INDEX IF NOT EXISTS members_sub ON members (sub);

-- Someone you unfriended cannot rejoin through your friend code.
CREATE TABLE IF NOT EXISTS blocks (
  owner TEXT NOT NULL,
  blocked TEXT NOT NULL,
  PRIMARY KEY (owner, blocked)
);

-- Recent invite previews and joins, to cap guessing at codes (30 an hour).
CREATE TABLE IF NOT EXISTS invite_tries (
  sub TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invite_tries_sub ON invite_tries (sub, at);
