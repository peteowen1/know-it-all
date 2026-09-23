// Pure logic for the geography games: which countries are in play, how a round
// is drawn, and which wrong answers sit next to the right one. No React, no
// JSON import, so scripts/test-logic.mjs can exercise it directly.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

// Look-alike score at or above which two flags render the same.
export const IDENTICAL = 0.99;

export const REGIONS = ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

/**
 * Countries eligible for a game.
 *
 * `needs` names the field the game asks about, so a country missing it (Taiwan
 * has no World Bank population) drops out of that game only, rather than
 * showing up as "population: null".
 */
export function countryPool(countries, { region = 'World', territories = false, needs = null } = {}) {
  return countries.filter(
    (c) =>
      (territories || c.sovereign) &&
      (region === 'World' || c.region === region) &&
      (needs === null || (Array.isArray(c[needs]) ? c[needs].length > 0 : c[needs] != null))
  );
}

/**
 * Three wrong answers for `target`, drawn from `pool`.
 *
 * Neighbours make the question: a random wrong flag from another continent is
 * a free point, while Chad beside Romania or Indonesia beside Monaco is the
 * question a quiz-setter would actually ask. So distractors come from the same
 * subregion first, then the same region, then anywhere, until there are three.
 *
 * `labelOf` maps a country to the text shown on its option. Options are
 * de-duplicated on that label (with territories on, Jamaica and Norfolk Island
 * both have a capital called Kingston), because two identical options with one
 * marked wrong is a broken question.
 *
 * `lookalikes` (flags only) does two things. It always removes flags that
 * render identically to the target — France and French Guiana, Monaco and
 * Indonesia — because a question with two indistinguishable options has no
 * right answer. With `hard`, it also puts look-alike flags first: three drawn
 * at random from the five closest, so Monaco does not always bring the same
 * three.
 */
export function pickDistractors(target, pool, rand, labelOf = (c) => c.name, { lookalikes = null, hard = false } = {}) {
  const identical = new Set(
    (lookalikes?.[target.code] || []).filter(([, score]) => score >= IDENTICAL).map(([code]) => code)
  );
  const others = pool.filter((c) => c.code !== target.code && !identical.has(c.code));
  const useLookalikes = Boolean(lookalikes && hard);
  const tiers = [
    ...(useLookalikes ? [lookalikeTier(target, others, lookalikes, rand)] : []),
    others.filter((c) => c.subregion === target.subregion),
    others.filter((c) => c.subregion !== target.subregion && c.region === target.region),
    others.filter((c) => c.region !== target.region)
  ];
  const seen = new Set([labelOf(target)]);
  const picked = [];
  for (const [t, tier] of tiers.entries()) {
    // The look-alike tier is already in the order it should be used.
    for (const c of useLookalikes && t === 0 ? tier : shuffle(tier, rand)) {
      if (picked.length === 3) return picked;
      const label = labelOf(c);
      if (seen.has(label)) continue;
      seen.add(label);
      picked.push(c);
    }
  }
  return picked;
}

function lookalikeTier(target, others, lookalikes, rand) {
  const inPool = new Map(others.map((c) => [c.code, c]));
  const close = (lookalikes[target.code] || [])
    .filter(([code]) => inPool.has(code))
    .slice(0, 5)
    .map(([code]) => inPool.get(code));
  return shuffle(close, rand);
}

/** Flags that render the same as this one, for the "identical to" note. */
export function identicalFlags(target, lookalikes, byCode) {
  return (lookalikes?.[target.code] || [])
    .filter(([code, score]) => score >= IDENTICAL && byCode.get(code)?.sovereign)
    .map(([code]) => byCode.get(code).name);
}

/**
 * A round of `count` questions. Each has the target, its options in a seeded
 * order, and the index of the correct option.
 *
 * `weights` optionally biases the draw toward countries the player keeps
 * missing: a country with weight 3 is three times as likely to be drawn as one
 * with weight 1. Sampling is without replacement, so a round never repeats.
 */
export function buildGeoRound(pool, { count = 10, seed = Date.now(), labelOf, weights = null, lookalikes = null, hard = false } = {}) {
  const rand = makeRng(hashString(String(seed)));
  const bag = pool.map((c) => ({ c, w: Math.max(weights?.[c.code] ?? 1, 0.01) }));
  const chosen = [];
  while (chosen.length < count && bag.length) {
    const total = bag.reduce((n, x) => n + x.w, 0);
    let r = rand() * total;
    let i = 0;
    while (i < bag.length - 1 && (r -= bag[i].w) > 0) i++;
    chosen.push(bag.splice(i, 1)[0].c);
  }
  return chosen.map((target) => {
    const options = shuffle([target, ...pickDistractors(target, pool, rand, labelOf, { lookalikes, hard })], rand);
    return { target, options, correctIndex: options.indexOf(target) };
  });
}

/**
 * Pairs for higher-or-lower. Each step keeps the previous right-hand country
 * as the new left-hand one, so the chain reads as a run.
 *
 * Pairs closer than `minGap` (as a ratio) are skipped: 10.21m vs 10.19m is a
 * coin flip that teaches nothing, and World Bank estimates are not that exact.
 */
export function nextChallenger(current, pool, rand, { field = 'population', minGap = 1.15 } = {}) {
  const ok = pool.filter((c) => {
    if (c.code === current.code || c[field] == null) return false;
    const ratio = Math.max(c[field], current[field]) / Math.min(c[field], current[field]);
    return ratio >= minGap;
  });
  return ok.length ? ok[Math.floor(rand() * ok.length)] : null;
}

/** 1406585000 -> "1.41 billion", 27614411 -> "27.6 million", 12025 -> "12,025". */
export function formatPopulation(n) {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} million`;
  return n.toLocaleString('en-AU');
}
