// Pure logic for Timeline: drawing a fair round and scoring an ordering.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

const ROUND_SIZE = 5;
const MAX_PER_KIND = 2;
const ATTEMPTS = 50;
// When the data cannot satisfy the strict rules (too few kinds, or no five
// distinct years inside one window), the rules widen instead of the game
// failing: first more cards of one kind, then a wider window for hard mode,
// then a smaller gap between years for easy mode.
const KIND_LIMITS = [MAX_PER_KIND, 3, ROUND_SIZE];
const WINDOWS = [12, 20, 40, Infinity];
// Easy mode's eight-year gap is the last thing to give way.
const GAPS = { easy: [8, 4, 1], hard: [1] };

/**
 * Five events with distinct years, no more than two of any kind, so a round
 * mixes songs, films, leaders and births rather than being five Oscar winners.
 *
 *   easy  every pair at least 8 years apart: order by rough era
 *   hard  all within a 12-year window: order by knowing the actual years
 *
 * Returns the events in a shuffled starting order. If the strict rules cannot
 * be met (a tiny or lopsided event list) it relaxes the per-kind limit, then
 * the window, then the gap, and only throws when there are not five events
 * with distinct years at all.
 */
export function buildRound(events, { difficulty = 'easy', seed = Date.now() } = {}) {
  const rand = makeRng(hashString(`timeline:${seed}`));
  for (const minGap of GAPS[difficulty] || GAPS.easy) {
    for (const window of difficulty === 'hard' ? WINDOWS : [Infinity]) {
      for (const maxPerKind of KIND_LIMITS) {
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
          const round = drawRound(events, { rand, minGap, window, maxPerKind });
          if (round) return round;
        }
      }
    }
  }
  throw new Error('could not draw a timeline round');
}

function drawRound(events, { rand, minGap, window, maxPerKind }) {
  let pool = shuffle(events, rand);
  if (window !== Infinity && pool.length) {
    const anchor = pool[0].year;
    pool = pool.filter((e) => e.year >= anchor && e.year <= anchor + window);
  }
  const picked = [];
  const perKind = {};
  for (const e of pool) {
    if ((perKind[e.kind] || 0) >= maxPerKind) continue;
    if (picked.some((p) => Math.abs(p.year - e.year) < minGap)) continue;
    picked.push(e);
    perKind[e.kind] = (perKind[e.kind] || 0) + 1;
    if (picked.length === ROUND_SIZE) return shuffle(picked, rand);
  }
  return null;
}

/**
 * Partial credit: of the 10 pairs among five cards, how many are in the right
 * relative order. Swapping two neighbours costs one pair; reversing the whole
 * list scores zero. Returns { correct, total }.
 */
export function scoreOrder(order) {
  let correct = 0;
  let total = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      total++;
      if (order[i].year < order[j].year) correct++;
    }
  }
  return { correct, total };
}
