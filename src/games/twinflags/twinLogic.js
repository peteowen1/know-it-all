// Pure logic for Twin flags: two near-identical flags, "which is X?".
import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { TWIN_TABLE } from './twinTable.js';

export const ROUNDS = 10;
// Pairs rated below this in flagLookalikes.json are not close enough to be a fair "twin".
export const THRESHOLD = 0.8;

export const pairKey = (a, b) => [a, b].sort().join('-');

/** Similarity of two flags (0-1) from the look-alike map, in either direction. */
export function similarity(lookalikes, a, b) {
  const find = (x, y) => (lookalikes[x] || []).find((e) => e[0] === y)?.[1] ?? 0;
  return Math.max(find(a, b), find(b, a));
}

/** Table pairs that are similar enough and whose countries both exist. */
export function eligiblePairs(lookalikes, nameOf, table = TWIN_TABLE, threshold = THRESHOLD) {
  return table
    .filter(([a, b]) => nameOf[a] && nameOf[b] && similarity(lookalikes, a, b) >= threshold)
    .map(([a, b, how]) => ({ key: pairKey(a, b), a, b, how, similarity: similarity(lookalikes, a, b) }));
}

/**
 * ROUNDS rounds. Each: { id, left, right, ask, how }. `ask` is the code to find; which side
 * it sits on is random. A country appears at most twice per game where the pool allows.
 */
export function buildRounds(pairs, { seed, count = ROUNDS } = {}) {
  const rng = makeRng(hashString(String(seed ?? Date.now())));
  const used = new Map();
  const picked = [];
  const rest = [];
  for (const p of shuffle(pairs, rng)) {
    const ok = (used.get(p.a) || 0) < 2 && (used.get(p.b) || 0) < 2;
    if (ok && picked.length < count) {
      picked.push(p);
      used.set(p.a, (used.get(p.a) || 0) + 1);
      used.set(p.b, (used.get(p.b) || 0) + 1);
    } else rest.push(p);
  }
  for (const p of rest) if (picked.length < count) picked.push(p);
  return picked.map((p) => {
    const ask = rng() < 0.5 ? p.a : p.b;
    const other = ask === p.a ? p.b : p.a;
    const askLeft = rng() < 0.5;
    return { id: p.key, left: askLeft ? ask : other, right: askLeft ? other : ask, ask, how: p.how };
  });
}
