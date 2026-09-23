// Pure logic for Timeline: drawing a fair round and scoring an ordering.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

export const ROUND_SIZE = 5;
const MAX_PER_KIND = 2;

/**
 * Five events with distinct years, no more than two of any kind, so a round
 * mixes songs, films, leaders and births rather than being five Oscar winners.
 *
 *   easy  every pair at least 8 years apart: order by rough era
 *   hard  all within a 12-year window: order by knowing the actual years
 *
 * Returns the events in a shuffled starting order.
 */
export function buildRound(events, { difficulty = 'easy', seed = Date.now() } = {}) {
  const rand = makeRng(hashString(`timeline:${seed}`));
  for (let attempt = 0; attempt < 50; attempt++) {
    let pool = shuffle(events, rand);
    if (difficulty === 'hard') {
      const anchor = pool[0].year;
      pool = pool.filter((e) => e.year >= anchor && e.year <= anchor + 12);
    }
    const minGap = difficulty === 'hard' ? 1 : 8;
    const picked = [];
    const perKind = {};
    for (const e of pool) {
      if ((perKind[e.kind] || 0) >= MAX_PER_KIND) continue;
      if (picked.some((p) => Math.abs(p.year - e.year) < minGap)) continue;
      picked.push(e);
      perKind[e.kind] = (perKind[e.kind] || 0) + 1;
      if (picked.length === ROUND_SIZE) return shuffle(picked, rand);
    }
  }
  throw new Error('could not draw a timeline round');
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
