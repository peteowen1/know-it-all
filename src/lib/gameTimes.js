// Best timed result per game: { [gameId]: { score, total, activeMs, wallMs, date } }.
//
// Kept apart from game stats on purpose: coerceGameStats keeps only the fields
// it knows, so an older open tab would strip a time stored there and sync the
// loss back. Two devices' copies merge by keeping the better result.

/** Better means more points, then less active time. */
export function isBetter(a, b) {
  if (!b) return true;
  if (!a) return false;
  return a.score !== b.score ? a.score > b.score : a.activeMs < b.activeMs;
}

const validEntry = (e) =>
  e && typeof e === 'object' && Number.isFinite(e.score) && Number.isFinite(e.activeMs) && Number.isFinite(e.wallMs);

/** Read back from storage: anything malformed is dropped, not trusted. */
export function coerceTimes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [game, e] of Object.entries(raw)) {
    if (validEntry(e)) out[game] = { score: e.score, total: Number.isFinite(e.total) ? e.total : null, activeMs: e.activeMs, wallMs: e.wallMs, date: typeof e.date === 'string' ? e.date : null };
  }
  return out;
}

/** Fold a finished round in; returns the same object if it is not a best. */
export function recordTime(times, gameId, { score, total = null, activeMs, wallMs, date = null }) {
  const entry = { score, total, activeMs, wallMs, date };
  return validEntry(entry) && isBetter(entry, times[gameId]) ? { ...times, [gameId]: entry } : times;
}

/** Merge two devices' best times: the better result per game. */
export function mergeTimes(a, b) {
  const x = coerceTimes(a);
  const y = coerceTimes(b);
  const out = { ...x };
  for (const [game, e] of Object.entries(y)) if (isBetter(e, out[game])) out[game] = e;
  return out;
}
