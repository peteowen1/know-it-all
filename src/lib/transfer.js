// Moving data in and out of the app: progress codes between devices, and
// challenge links that reproduce one exact round for someone else.
//
// Everything here is base64url over JSON. No compression library: the payloads
// are small, and a dependency whose only job is shortening a string the user
// pastes once is not worth the bundle weight or the supply-chain surface.

const b64encode = (str) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64decode = (str) => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

// ---------------------------------------------------------------- progress

const PROGRESS_FORMAT = 1;

/**
 * Pack progress into a code the user can paste on another device.
 *
 * Versioned so a future format change can be detected and rejected with a clear
 * message rather than silently importing garbage into someone's stats.
 */
export function exportProgress({ stats, vault, recentIds }) {
  return b64encode(
    JSON.stringify({
      v: PROGRESS_FORMAT,
      // Truncated: the recent list is only used to avoid repeats, and carrying
      // all 350 ids roughly triples the length of the code for little benefit.
      r: recentIds.slice(0, 120),
      s: stats,
      k: vault
    })
  );
}

/**
 * Unpack a progress code.
 *
 * Returns `{ ok: false, error }` rather than throwing, because the input is
 * hand-pasted and being wrong is the expected case, not an exceptional one.
 */
export function importProgress(code) {
  let parsed;
  try {
    parsed = JSON.parse(b64decode(code.trim()));
  } catch {
    return { ok: false, error: 'That does not look like a progress code. Check it copied in full.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That code is not readable.' };
  }
  if (parsed.v !== PROGRESS_FORMAT) {
    return { ok: false, error: `That code is from a different version of the app (format ${parsed.v}).` };
  }
  if (!parsed.s || typeof parsed.s !== 'object' || Array.isArray(parsed.s)) {
    return { ok: false, error: 'That code is missing its statistics.' };
  }
  return {
    ok: true,
    data: {
      stats: parsed.s,
      vault: Array.isArray(parsed.k) ? parsed.k : [],
      recentIds: Array.isArray(parsed.r) ? parsed.r.filter((x) => typeof x === 'string') : []
    }
  };
}

/**
 * Merge an imported profile into the local one, taking the better of each.
 *
 * Deliberately non-destructive: importing on a device you have already played
 * on must never lose work, because the user cannot tell in advance which device
 * holds more progress and there is no undo.
 */
export function mergeProgress(local, incoming) {
  const stats = {
    ...local.stats,
    highScore: Math.max(local.stats.highScore || 0, incoming.stats.highScore || 0),
    bestPercentage: Math.max(local.stats.bestPercentage || 0, incoming.stats.bestPercentage || 0),
    totalQuizzes: (local.stats.totalQuizzes || 0) + (incoming.stats.totalQuizzes || 0),
    totalAnswered: (local.stats.totalAnswered || 0) + (incoming.stats.totalAnswered || 0),
    totalCorrect: (local.stats.totalCorrect || 0) + (incoming.stats.totalCorrect || 0),
    streak: Math.max(local.stats.streak || 0, incoming.stats.streak || 0),
    lastPlayDate:
      (local.stats.lastPlayDate || '') > (incoming.stats.lastPlayDate || '')
        ? local.stats.lastPlayDate
        : incoming.stats.lastPlayDate,
    categoryStats: mergeCounts(local.stats.categoryStats, incoming.stats.categoryStats),
    difficultyStats: mergeCounts(local.stats.difficultyStats, incoming.stats.difficultyStats)
  };

  // On a vault clash keep whichever copy is further behind — the lower box and
  // the earlier due date. Importing should never mark something as better known
  // than the pessimistic evidence supports.
  const byId = new Map(local.vault.map((e) => [e.id, e]));
  for (const entry of incoming.vault) {
    const mine = byId.get(entry.id);
    if (!mine) {
      byId.set(entry.id, entry);
      continue;
    }
    byId.set(entry.id, {
      ...mine,
      box: Math.min(mine.box ?? 0, entry.box ?? 0),
      due: (mine.due || '') < (entry.due || '') ? mine.due : entry.due,
      lapses: Math.max(mine.lapses || 0, entry.lapses || 0),
      reps: Math.max(mine.reps || 0, entry.reps || 0)
    });
  }

  return {
    stats,
    vault: [...byId.values()],
    recentIds: [...new Set([...local.recentIds, ...incoming.recentIds])].slice(0, 350)
  };
}

function mergeCounts(a = {}, b = {}) {
  const out = { ...a };
  for (const [key, val] of Object.entries(b)) {
    const mine = out[key] || { total: 0, correct: 0 };
    out[key] = { total: mine.total + (val.total || 0), correct: mine.correct + (val.correct || 0) };
  }
  return out;
}

// ---------------------------------------------------------------- challenges

/**
 * A challenge is the question ids plus the seed, in the URL fragment.
 *
 * The fragment specifically, not the query string: fragments are never sent to
 * the server, which keeps this working as a purely static site and means the
 * challenge never appears in any access log.
 */
export function encodeChallenge(questions, seed) {
  return b64encode(JSON.stringify({ v: 1, s: seed, q: questions.map((q) => q.id) }));
}

export function decodeChallenge(fragment) {
  if (!fragment) return null;
  try {
    const parsed = JSON.parse(b64decode(fragment));
    if (parsed?.v !== 1 || !Array.isArray(parsed.q) || !parsed.q.length) return null;
    return { seed: Number(parsed.s) || 0, ids: parsed.q.filter((x) => typeof x === 'string') };
  } catch {
    return null;
  }
}

export function challengeUrl(questions, seed) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#c=${encodeChallenge(questions, seed)}`;
}

/** Read a challenge from the current URL, if there is one. */
export function readChallengeFromUrl() {
  const match = window.location.hash.match(/^#c=(.+)$/);
  return match ? decodeChallenge(match[1]) : null;
}

export function clearChallengeFromUrl() {
  // replaceState rather than assigning location.hash: assigning would add a
  // history entry, so Back would drop the user into the challenge again.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
