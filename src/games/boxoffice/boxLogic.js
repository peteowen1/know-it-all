// Pure logic for Box office: two hit films, did the second make more or less
// than the first? Same chain as Who's older? (src/games/older/olderLogic.js).
// No React; scripts/test-logic.mjs covers it.

/**
 * Every film with a worldwide gross: each year's top 10 from 1988 (earlier
 * pages give US gross or rentals only, so they have none; see
 * scripts/build-film-charts.mjs).
 */
export function filmPool(boxOffice) {
  const out = [];
  for (const [year, list] of Object.entries(boxOffice)) {
    for (const f of list) if (f.gross) out.push({ id: `${year}:${f.rank}`, title: f.title, year: Number(year), gross: f.gross, director: f.artist });
  }
  return out;
}

/** 1843201268 -> "$1.84 billion", 618638999 -> "$619 million". */
export function formatGross(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)} billion`;
  return `$${Math.round(n / 1e6)} million`;
}

/**
 * How far apart two grosses may be, as the bigger over the smaller, by run
 * length: an easy call first (one made 1.5 to 4 times the other), closer
 * calls as the run grows.
 */
export function ratioRange(run) {
  if (run < 3) return [1.5, 4];
  if (run < 7) return [1.25, 2.5];
  if (run < 12) return [1.1, 1.6];
  return [1.03, 1.3];
}

/**
 * How many years apart two films may be. Grosses are not adjusted for
 * inflation, so across decades the newer film nearly always made more: with
 * no limit it was the answer in 73% of 5,797 dealt pairs. Within 4 years it
 * is 61% of 5,364, about the same on easy and hard calls; narrower windows
 * barely move it (3 years: 59%), since takings did grow year on year
 * (simulated 2026-11-26).
 */
export const YEAR_WINDOW = 4;

const ratio = (a, b) => Math.max(a.gross, b.gross) / Math.min(a.gross, b.gross);

/**
 * The next film to compare with `current`: not yet in this run, a different
 * gross, released within YEAR_WINDOW years of it (any year if none is
 * left), inside the run's ratio range. Falls back to the closest of those
 * above the range's floor, then the closest of any; null once all are used.
 */
export function nextFilm(current, pool, rand, { seen = new Set(), run = 0, years = YEAR_WINDOW } = {}) {
  const unseen = pool.filter((f) => f.id !== current.id && !seen.has(f.id) && f.gross !== current.gross);
  const near = unseen.filter((f) => Math.abs(f.year - current.year) <= years);
  const open = near.length ? near : unseen;
  const [lo, hi] = ratioRange(run);
  const inside = open.filter((f) => ratio(f, current) >= lo && ratio(f, current) <= hi);
  if (inside.length) return inside[Math.floor(rand() * inside.length)];
  const closest = (list) => list.reduce((best, f) => (!best || ratio(f, current) < ratio(best, current) ? f : best), null);
  return closest(open.filter((f) => ratio(f, current) >= lo)) || closest(open);
}

/** A run's first pair. */
export function firstFilms(pool, rand) {
  const left = pool[Math.floor(rand() * pool.length)];
  const right = nextFilm(left, pool, rand, { seen: new Set([left.id]) });
  return right ? { left, right } : null;
}

/** Did `right` make more than `left`? */
export const madeMore = (right, left) => right.gross > left.gross;
