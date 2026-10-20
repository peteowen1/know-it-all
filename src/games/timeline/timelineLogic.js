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
// Births bunch in the 1960s to 1980s (about 70 events a decade against 34 in
// the 2020s), so a plain shuffle made two cards in five come from those three
// decades. Each event is weighted 1 / max(events in its decade, FULL_DECADE):
// every decade with at least that many events is drawn equally often, and a
// thin early decade keeps the chance its few events had.
const FULL_DECADE = 25;

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
  const perDecade = {};
  for (const e of events) perDecade[decade(e)] = (perDecade[decade(e)] || 0) + 1;
  const weights = events.map((e) => 1 / Math.max(perDecade[decade(e)], FULL_DECADE));
  for (const minGap of GAPS[difficulty] || GAPS.easy) {
    for (const window of difficulty === 'hard' ? WINDOWS : [Infinity]) {
      for (const maxPerKind of KIND_LIMITS) {
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
          const round = drawRound(events, { rand, weights, minGap, window, maxPerKind });
          if (round) return round;
        }
      }
    }
  }
  throw new Error('could not draw a timeline round');
}

const decade = (e) => Math.floor(e.year / 10);

/** A shuffle where heavier events tend to come first (Efraimidis-Spirakis keys). */
function weightedShuffle(events, weights, rand) {
  return events
    .map((e, i) => ({ e, key: Math.pow(rand(), 1 / weights[i]) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.e);
}

function drawRound(events, { rand, weights, minGap, window, maxPerKind }) {
  let pool = weightedShuffle(events, weights, rand);
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

/**
 * Another event from the same year, shown under a card placed wrong so the
 * year sticks: "Same year: Star Wars is the top-grossing film". A different
 * kind first (a president gets a film or a song, not another president), the
 * same kind if that is all the year has, and null when the year has nothing
 * else. Picked by the event's own text, so a card always gets the same partner.
 */
export function sameYear(event, events) {
  const others = events.filter((e) => e.year === event.year && e.text !== event.text);
  const pool = others.some((e) => e.kind !== event.kind) ? others.filter((e) => e.kind !== event.kind) : others;
  return pool.length ? pool[hashString(event.text) % pool.length] : null;
}
