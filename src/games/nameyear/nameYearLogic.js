// Pure logic for Name the year: three clues from one year, guess the year.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

export const ROUNDS = 5;

/**
 * Points for a guess: 10 for the exact year, two fewer per year out, none from
 * five years away. Close counts, which is the point of the game.
 */
export function yearPoints(guess, year) {
  const off = Math.abs(Number(guess) - year);
  return Number.isFinite(off) ? Math.max(0, 10 - 2 * off) : 0;
}

/**
 * Five rounds, each a year with three clues of three different kinds (a song,
 * a film or award, a leader or birth), so no single clue type gives it away.
 * Years are at least three apart, so two rounds never share clues.
 */
export function buildYearRounds(events, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`nameyear:${seed}`));
  const byYear = {};
  for (const e of events) (byYear[e.year] ||= []).push(e);
  const usable = Object.keys(byYear)
    .map(Number)
    .filter((y) => new Set(byYear[y].map((e) => e.kind)).size >= 3);
  const years = [];
  for (const y of shuffle(usable, rand)) {
    if (years.some((p) => Math.abs(p - y) < 3)) continue;
    years.push(y);
    if (years.length === count) break;
  }
  return years.map((year) => {
    const clues = [];
    const kinds = new Set();
    for (const e of shuffle(byYear[year], rand)) {
      if (kinds.has(e.kind)) continue;
      kinds.add(e.kind);
      clues.push(e);
      if (clues.length === 3) break;
    }
    return { year, clues, options: yearOptions(year, rand) };
  });
}

/**
 * Four choices for easy mode: the year and three others within six years,
 * at least two apart from each other so the options are distinguishable.
 */
export function yearOptions(year, rand) {
  const offsets = shuffle([-6, -4, -2, 2, 4, 6, -5, -3, 3, 5], rand);
  const picked = [year];
  for (const o of offsets) {
    const y = year + o;
    if (y > 2026 || picked.some((p) => Math.abs(p - y) < 2)) continue;
    picked.push(y);
    if (picked.length === 4) break;
  }
  // Near the present only earlier years exist, and the two-apart rule can run
  // out of room (2025 came back with three options). Fill from the nearest
  // unused years, one apart if need be.
  for (let d = 1; picked.length < 4 && d <= 12; d++) {
    for (const y of [year - d, year + d]) {
      if (picked.length < 4 && y <= 2026 && !picked.includes(y)) picked.push(y);
    }
  }
  return picked.sort((a, b) => a - b);
}
