// Leaderboards: nicknames, posted results, boards, and friend and group
// invites (docs/plans/LEADERBOARDS.md, migration 0003_boards.sql). Every
// handler here takes the signed-in `sub`; the router checks sign-in first.

const DAY_MS = 86_400_000;
const BOARD_LIMIT = 50;
const MAX_GROUPS_OWNED = 20;
const MAX_MEMBERSHIPS = 100;
const MAX_RESULTS_PER_DAY = 1000;
// No 0/O or 1/I/L: a code is read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const NICKNAME = /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{0,23}$/u;
const BOARD = /^[A-Za-z0-9][A-Za-z0-9 _:.&'()-]{0,119}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROUND_ID = /^[A-Za-z0-9_-]{8,40}$/;
const CODE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Days since 1970 for a YYYY-MM-DD date, or NaN. */
const dayNumber = (d) => (DATE.test(d) ? Date.parse(`${d}T00:00:00Z`) / DAY_MS : NaN);
const dateOf = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** The Monday on or before a YYYY-MM-DD date (weekly boards start on Monday). */
export function mondayOf(date) {
  const n = dayNumber(date);
  const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7; // Monday 0
  return dateOf(n - weekday);
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...b].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

// ------------------------------------------------------------------ profile

/** The profile, created on first use with the Google first name as nickname. */
async function ensureProfile(env, sub) {
  const row = await env.DB.prepare('SELECT nickname, public FROM profiles WHERE sub = ?').bind(sub).first();
  if (row) return { nickname: row.nickname, public: Boolean(row.public) };
  const user = await env.DB.prepare('SELECT given_name FROM users WHERE sub = ?').bind(sub).first();
  const given = (user?.given_name || '').trim().slice(0, 24);
  const nickname = NICKNAME.test(given) ? given : 'Player';
  await env.DB.prepare('INSERT OR IGNORE INTO profiles (sub, nickname, public, updated_at) VALUES (?, ?, 0, ?)')
    .bind(sub, nickname, Date.now()).run();
  return { nickname, public: false };
}

/** This person's friend code, made on first ask. */
async function friendCode(env, sub) {
  const row = await env.DB.prepare("SELECT code FROM invites WHERE owner = ? AND kind = 'friend'").bind(sub).first();
  if (row) return row.code;
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const res = await env.DB.prepare("INSERT OR IGNORE INTO invites (code, kind, owner, name, created_at) VALUES (?, 'friend', ?, NULL, ?)")
      .bind(code, sub, Date.now()).run();
    if (res.meta.changes) return code;
    // Lost a race to another request for this person: use theirs.
    const again = await env.DB.prepare("SELECT code FROM invites WHERE owner = ? AND kind = 'friend'").bind(sub).first();
    if (again) return again.code;
  }
  throw new Error('Could not make a friend code.');
}

export async function profileGet(env, sub) {
  const profile = await ensureProfile(env, sub);
  return { ...profile, friendCode: await friendCode(env, sub) };
}

export async function profilePut(env, sub, body) {
  await ensureProfile(env, sub);
  const sets = [];
  const args = [];
  if (body?.nickname !== undefined) {
    const nick = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    if (!NICKNAME.test(nick)) return { status: 400, error: 'A nickname is 1 to 24 letters, numbers, spaces or . \' _ -, starting with a letter or number.' };
    sets.push('nickname = ?');
    args.push(nick);
  }
  if (body?.public !== undefined) {
    if (typeof body.public !== 'boolean') return { status: 400, error: 'public must be true or false.' };
    sets.push('public = ?');
    args.push(body.public ? 1 : 0);
  }
  if (sets.length) {
    await env.DB.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated_at = ? WHERE sub = ?`).bind(...args, Date.now(), sub).run();
  }
  return { body: await profileGet(env, sub) };
}

// ------------------------------------------------------------------ results

/**
 * Post a finished round. The same round id is stored once; posting it again
 * changes nothing. `date` is the player's local date when they finished (for
 * the week and lateness); it must be within two days of the server's.
 */
export async function resultPost(env, sub, body) {
  const { roundId, board, day = null, date, score, total = null, activeMs, wallMs } = body || {};
  if (!ROUND_ID.test(roundId || '')) return { status: 400, error: 'Bad round id.' };
  if (!BOARD.test(board || '')) return { status: 400, error: 'Bad board.' };
  if (day !== null && !DATE.test(day)) return { status: 400, error: 'Bad day.' };
  const today = Math.floor(Date.now() / DAY_MS);
  const played = dayNumber(date);
  if (!(Math.abs(played - today) <= 2)) return { status: 400, error: 'Bad date.' };
  if (day !== null && !(dayNumber(day) <= played)) return { status: 400, error: 'A daily round cannot be from the future.' };
  if (!isInt(score, 0, 100000) || (total !== null && !isInt(total, 0, 100000))) return { status: 400, error: 'Bad score.' };
  if (!isInt(activeMs, 0, 24 * 3600_000) || !isInt(wallMs, activeMs, 30 * DAY_MS)) return { status: 400, error: 'Bad time.' };

  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM results WHERE sub = ? AND created_at > ?')
    .bind(sub, Date.now() - DAY_MS).first();
  if ((recent?.n || 0) >= MAX_RESULTS_PER_DAY) return { status: 429, error: 'Too many results today.' };

  await ensureProfile(env, sub);
  const late = day !== null && dayNumber(day) < played ? 1 : 0;
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO results (sub, round_id, board, day, late, week, score, total, active_ms, wall_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(sub, roundId, board, day, late, mondayOf(date), score, total, activeMs, wallMs, Date.now()).run();
  return { body: { stored: Boolean(res.meta.changes), late: Boolean(late) } };
}

// ------------------------------------------------------------------ boards

/** Whether `sub` may see group `code`'s board (its owner or a member). */
async function inGroup(env, sub, code) {
  const row = await env.DB.prepare(
    `SELECT 1 AS x FROM invites WHERE code = ?1 AND kind = 'group' AND owner = ?2
     UNION SELECT 1 FROM members m JOIN invites i ON i.code = m.code WHERE m.code = ?1 AND i.kind = 'group' AND m.sub = ?2`
  ).bind(code, sub).first();
  return Boolean(row);
}

/**
 * A board: each person's best result (more points, then less time), best
 * first, up to 50. `period` is `day:YYYY-MM-DD`, `week:YYYY-MM-DD` (a Monday)
 * or `all`. `scope` is `friends` (you and your friends), `group:CODE`, `public`
 * (people who opted in; ranked by time that never pauses) or `me`.
 */
export async function boardGet(env, sub, params) {
  const board = params.get('board') || '';
  const period = params.get('period') || 'all';
  const scope = params.get('scope') || 'friends';
  if (!BOARD.test(board)) return { status: 400, error: 'Bad board.' };

  let periodSql = '';
  const periodArgs = [];
  const [kind, value] = period.split(':');
  if (kind === 'day' && DATE.test(value || '')) {
    periodSql = 'AND r.day = ?';
    periodArgs.push(value);
  } else if (kind === 'week' && DATE.test(value || '') && mondayOf(value) === value) {
    periodSql = 'AND r.week = ?';
    periodArgs.push(value);
  } else if (period !== 'all') return { status: 400, error: 'Bad period.' };

  let scopeSql;
  const scopeArgs = [];
  if (scope === 'me') {
    scopeSql = 'SELECT ? AS sub';
    scopeArgs.push(sub);
  } else if (scope === 'friends') {
    scopeSql = `SELECT ? AS sub
      UNION SELECT m.sub FROM invites i JOIN members m ON m.code = i.code WHERE i.kind = 'friend' AND i.owner = ?
      UNION SELECT i.owner FROM invites i JOIN members m ON m.code = i.code WHERE i.kind = 'friend' AND m.sub = ?`;
    scopeArgs.push(sub, sub, sub);
  } else if (scope.startsWith('group:') && CODE.test(scope.slice(6))) {
    const code = scope.slice(6);
    if (!(await inGroup(env, sub, code))) return { status: 403, error: 'You are not in that group.' };
    scopeSql = `SELECT owner AS sub FROM invites WHERE code = ? AND kind = 'group' UNION SELECT sub FROM members WHERE code = ?`;
    scopeArgs.push(code, code);
  } else if (scope === 'public') {
    scopeSql = 'SELECT sub FROM profiles WHERE public = 1';
  } else return { status: 400, error: 'Bad scope.' };

  const time = scope === 'public' ? 'wall_ms' : 'active_ms';
  // Plain ? parameters, bound in the order they appear: scope, board, period.
  const sql = `WITH scope AS (${scopeSql}),
    best AS (
      SELECT r.sub, r.score, r.total, r.${time} AS ms, r.late,
        ROW_NUMBER() OVER (PARTITION BY r.sub ORDER BY r.score DESC, r.${time} ASC, r.created_at ASC) AS n
      FROM results r JOIN scope s ON s.sub = r.sub
      WHERE r.board = ? ${periodSql}
    )
    SELECT b.sub, COALESCE(p.nickname, 'Player') AS nickname, b.score, b.total, b.ms, b.late
    FROM best b LEFT JOIN profiles p ON p.sub = b.sub
    WHERE b.n = 1 ORDER BY b.score DESC, b.ms ASC LIMIT ${BOARD_LIMIT}`;
  const { results } = await env.DB.prepare(sql).bind(...scopeArgs, board, ...periodArgs).all();
  return {
    body: {
      board,
      period,
      scope,
      time: scope === 'public' ? 'wall' : 'active',
      rows: results.map((r, i) => ({ rank: i + 1, nickname: r.nickname, score: r.score, total: r.total, ms: r.ms, late: Boolean(r.late), me: r.sub === sub }))
    }
  };
}

// ------------------------------------------------------------------ invites

/** Your groups (owned or joined) and your friends' nicknames. */
export async function invitesGet(env, sub) {
  const groups = await env.DB.prepare(
    `SELECT i.code, i.name, i.owner = ?1 AS owned,
       (SELECT COUNT(*) FROM members m2 WHERE m2.code = i.code) + 1 AS people
     FROM invites i WHERE i.kind = 'group' AND (i.owner = ?1 OR EXISTS (SELECT 1 FROM members m WHERE m.code = i.code AND m.sub = ?1))
     ORDER BY i.created_at LIMIT ${MAX_MEMBERSHIPS}`
  ).bind(sub).all();
  const friends = await env.DB.prepare(
    `SELECT COALESCE(p.nickname, 'Player') AS nickname,
       (SELECT code FROM invites WHERE owner = f.other AND kind = 'friend') AS code
     FROM (
       SELECT m.sub AS other FROM invites i JOIN members m ON m.code = i.code WHERE i.kind = 'friend' AND i.owner = ?1
       UNION SELECT i.owner AS other FROM invites i JOIN members m ON m.code = i.code WHERE i.kind = 'friend' AND m.sub = ?1
     ) f LEFT JOIN profiles p ON p.sub = f.other ORDER BY nickname LIMIT ${MAX_MEMBERSHIPS}`
  ).bind(sub).all();
  return {
    body: {
      friendCode: await friendCode(env, sub),
      groups: groups.results.map((g) => ({ code: g.code, name: g.name, owned: Boolean(g.owned), people: g.people })),
      // Each friend's own code: the handle for removing them.
      friends: friends.results.map((f) => ({ nickname: f.nickname, code: f.code }))
    }
  };
}

export async function groupCreate(env, sub, body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 40) return { status: 400, error: 'A group name is 1 to 40 characters.' };
  const owned = await env.DB.prepare("SELECT COUNT(*) AS n FROM invites WHERE owner = ? AND kind = 'group'").bind(sub).first();
  if ((owned?.n || 0) >= MAX_GROUPS_OWNED) return { status: 429, error: `You can own up to ${MAX_GROUPS_OWNED} groups.` };
  await ensureProfile(env, sub);
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const res = await env.DB.prepare("INSERT OR IGNORE INTO invites (code, kind, owner, name, created_at) VALUES (?, 'group', ?, ?, ?)")
      .bind(code, sub, name, Date.now()).run();
    if (res.meta.changes) return { body: { code, name } };
  }
  throw new Error('Could not make a group code.');
}

/** What an invite is, before joining it: shown so joining is a choice. */
export async function invitePreview(env, sub, code) {
  if (!CODE.test(code)) return { status: 404, error: 'No such invite.' };
  const row = await env.DB.prepare(
    `SELECT i.kind, i.name, i.owner, COALESCE(p.nickname, 'Player') AS nickname,
       EXISTS (SELECT 1 FROM members m WHERE m.code = i.code AND m.sub = ?2) AS joined
     FROM invites i LEFT JOIN profiles p ON p.sub = i.owner WHERE i.code = ?1`
  ).bind(code, sub).first();
  if (!row) return { status: 404, error: 'No such invite.' };
  return { body: { code, kind: row.kind, name: row.kind === 'group' ? row.name : row.nickname, yours: row.owner === sub, joined: Boolean(row.joined) } };
}

export async function inviteJoin(env, sub, code) {
  const preview = await invitePreview(env, sub, code);
  if (preview.error) return preview;
  if (preview.body.yours) return { status: 400, error: 'That is your own invite.' };
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE sub = ?').bind(sub).first();
  if ((n?.n || 0) >= MAX_MEMBERSHIPS) return { status: 429, error: 'You are in too many groups and friendships.' };
  await ensureProfile(env, sub);
  await env.DB.prepare('INSERT OR IGNORE INTO members (code, sub, joined_at) VALUES (?, ?, ?)').bind(code, sub, Date.now()).run();
  return { body: { ...preview.body, joined: true } };
}

/** Leave a group, or unfriend (either side of the friendship). Owners delete a group they own. */
export async function inviteLeave(env, sub, code) {
  if (!CODE.test(code)) return { status: 404, error: 'No such invite.' };
  const inv = await env.DB.prepare('SELECT kind, owner FROM invites WHERE code = ?').bind(code).first();
  if (!inv) return { status: 404, error: 'No such invite.' };
  if (inv.kind === 'group' && inv.owner === sub) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM members WHERE code = ?').bind(code),
      env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(code)
    ]);
  } else {
    await env.DB.prepare('DELETE FROM members WHERE code = ? AND sub = ?').bind(code, sub).run();
  }
  return { body: { ok: true } };
}

/** Unfriend: `code` is the friend's own friend code. Ends it both ways, whoever joined whom. */
export async function friendRemove(env, sub, code) {
  if (!CODE.test(code)) return { status: 404, error: 'No such friend.' };
  // Either they joined my code, or I joined theirs.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM members WHERE code = ? AND sub = ? AND code IN (SELECT code FROM invites WHERE kind = 'friend')").bind(code, sub),
    env.DB.prepare("DELETE FROM members WHERE code = (SELECT code FROM invites WHERE owner = ? AND kind = 'friend') AND sub IN (SELECT owner FROM invites WHERE code = ? AND kind = 'friend')").bind(sub, code)
  ]);
  return { body: { ok: true } };
}

/** Everything about this person on the boards: run with Reset and delete-my-data. */
export function deleteBoardData(env, sub) {
  return [
    env.DB.prepare('DELETE FROM results WHERE sub = ?').bind(sub),
    env.DB.prepare('DELETE FROM members WHERE sub = ?').bind(sub),
    env.DB.prepare('DELETE FROM members WHERE code IN (SELECT code FROM invites WHERE owner = ?)').bind(sub),
    env.DB.prepare('DELETE FROM invites WHERE owner = ?').bind(sub),
    env.DB.prepare('DELETE FROM profiles WHERE sub = ?').bind(sub)
  ];
}
