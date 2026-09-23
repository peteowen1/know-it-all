// Per-game progress for everything outside the weekend quiz: flags, capitals,
// higher-or-lower and whatever comes next. Pure functions over a plain object
// so they can be tested and merged without React.
//
// Shape, keyed by game id:
//   { flags: { plays, best, bestPct, bestRun, lastPlayed,
//              items: { AU: { seen, correct } } } }
//
// `items` is keyed by whatever the game asks about (a country code today, a
// film or artist id later). It is what lets a game lean on your weak spots.

const EMPTY_GAME = { plays: 0, best: 0, bestPct: 0, bestRun: 0, lastPlayed: null, items: {} };

export function gameEntry(stats, gameId) {
  return { ...EMPTY_GAME, ...(stats?.[gameId] || {}) };
}

/**
 * Fold one finished round into the stats.
 *
 * `answers` is `[{ key, correct }]`. `run` is for streak-style games
 * (higher-or-lower) where the score IS the run length; quiz-style games leave it
 * out.
 */
export function recordRound(stats, gameId, { score, total, answers = [], run = 0, date = null }) {
  const prev = gameEntry(stats, gameId);
  const items = { ...prev.items };
  for (const { key, correct } of answers) {
    const it = items[key] || { seen: 0, correct: 0 };
    items[key] = { seen: it.seen + 1, correct: it.correct + (correct ? 1 : 0) };
  }
  const pct = total ? Math.round((score / total) * 100) : 0;
  return {
    ...stats,
    [gameId]: {
      plays: prev.plays + 1,
      best: Math.max(prev.best, score),
      bestPct: Math.max(prev.bestPct, pct),
      bestRun: Math.max(prev.bestRun, run),
      lastPlayed: date,
      items
    }
  };
}

/**
 * Draw weight per item for the next round: higher means more likely to come up.
 *
 * Unseen items get a small boost so a new player works through the whole set
 * rather than meeting France five times. Items you keep missing get pulled
 * forward in proportion to how often you miss them; items you always get right
 * fade back to the baseline of 1 but never to zero, so they still turn up now
 * and then.
 */
export function itemWeights(stats, gameId, keys) {
  const { items } = gameEntry(stats, gameId);
  const out = {};
  for (const k of keys) {
    const it = items[k];
    if (!it || !it.seen) {
      out[k] = 1.5;
      continue;
    }
    const missRate = 1 - it.correct / it.seen;
    out[k] = 1 + 3 * missRate;
  }
  return out;
}

/** The `n` items missed most often, worst first. Only items seen twice or more. */
export function weakestItems(stats, gameId, n = 10) {
  const { items } = gameEntry(stats, gameId);
  return Object.entries(items)
    .filter(([, v]) => v.seen >= 2 && v.correct < v.seen)
    .sort((a, b) => a[1].correct / a[1].seen - b[1].correct / b[1].seen || b[1].seen - a[1].seen)
    .slice(0, n)
    .map(([key, v]) => ({ key, ...v }));
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Shape-check imported game stats. Anything malformed is dropped, not trusted. */
export function coerceGameStats(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [gameId, g] of Object.entries(raw)) {
    if (!g || typeof g !== 'object') continue;
    const items = {};
    for (const [k, v] of Object.entries(g.items || {})) {
      if (v && typeof v === 'object') items[k] = { seen: num(v.seen), correct: Math.min(num(v.correct), num(v.seen)) };
    }
    out[gameId] = {
      plays: num(g.plays),
      best: num(g.best),
      bestPct: num(g.bestPct),
      bestRun: num(g.bestRun),
      lastPlayed: typeof g.lastPlayed === 'string' ? g.lastPlayed : null,
      items
    };
  }
  return out;
}

/**
 * Merge two devices' game stats. Counts add, bests take the max. Adding counts
 * double-counts if the same code is imported twice; that matches how the
 * weekend-quiz totals already merge, and over-weighting a miss is harmless.
 */
export function mergeGameStats(a = {}, b = {}) {
  const out = { ...(a || {}) };
  for (const [gameId, g] of Object.entries(b || {})) {
    const mine = gameEntry(out, gameId);
    const items = { ...mine.items };
    for (const [k, v] of Object.entries(g.items || {})) {
      const m = items[k] || { seen: 0, correct: 0 };
      items[k] = { seen: m.seen + v.seen, correct: m.correct + v.correct };
    }
    out[gameId] = {
      plays: mine.plays + g.plays,
      best: Math.max(mine.best, g.best),
      bestPct: Math.max(mine.bestPct, g.bestPct),
      bestRun: Math.max(mine.bestRun, g.bestRun),
      lastPlayed: (mine.lastPlayed || '') > (g.lastPlayed || '') ? mine.lastPlayed : g.lastPlayed,
      items
    };
  }
  return out;
}
