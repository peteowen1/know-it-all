// Pure logic for Match the curve: four famous people and four readership
// curves; match each name to its curve. Built from src/data/curves.json
// (scripts/build-curves.mjs). No React, no JSON import:
// scripts/test-curves.mjs runs it on the real file.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

export const ROUNDS = 5;
export const PER_ROUND = 4;
// Peaks at least this many months apart, so every curve in a round can be
// told from the others by when it peaked.
export const MIN_GAP = 18;

const monthIndex = (ym) => +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1;

/**
 * A day's rounds, the same for the same seed. No person twice in a game.
 * Returns [{ people: [{ id, name, what, died?, peak, s }], order }], where
 * `people` is the order the names show in and `order` the order the curves
 * show in, as indexes into `people`.
 */
export function buildCurveRounds(people, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`curves:${seed}`));
  const pool = shuffle(people, rand);
  const used = new Set();
  const rounds = [];
  for (let start = 0; start < pool.length && rounds.length < count; start++) {
    if (used.has(pool[start].id)) continue;
    const pick = [pool[start]];
    for (const p of pool) {
      if (pick.length === PER_ROUND) break;
      if (used.has(p.id) || pick.includes(p)) continue;
      if (pick.every((q) => Math.abs(monthIndex(q.peak) - monthIndex(p.peak)) >= MIN_GAP)) pick.push(p);
    }
    if (pick.length < PER_ROUND) continue;
    for (const p of pick) used.add(p.id);
    rounds.push({ people: pick, order: shuffle([0, 1, 2, 3], rand) });
  }
  return rounds;
}

/** "September 2022" from "2022-09". */
export const monthName = (ym) =>
  `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

/** What the reveal says under a curve: its peak, and a death that year. */
export const peakNote = (p) => `Peak ${monthName(p.peak)}${p.died === +p.peak.slice(0, 4) ? ` (died ${p.died})` : ''}`;
