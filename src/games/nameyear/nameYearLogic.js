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
 * Points for a round. In hard mode a first guess that scores nothing earns a
 * second try ("Later than 1950"), worth half points, rounded down.
 */
export function roundPoints(guess, year, retried = false) {
  const p = yearPoints(guess, year);
  return retried ? Math.floor(p / 2) : p;
}

/** Does a hard-mode first guess earn a second try? Only when it scores 0. */
export const earnsRetry = (guess, year) => yearPoints(guess, year) === 0;

/**
 * One thing that happened in the year the player guessed, so a miss still
 * teaches something: { year, text }. A year the timeline has nothing for
 * gives the nearest year that has (`year` then differs from the guess). The
 * round's own year is never used: its events are the clues, and nor is a
 * year on the other side of the answer from the guess. Null when the
 * guess is the answer or nothing is near.
 */
export function guessedYearFact(guess, answer, events) {
  const g = Number(guess);
  if (!Number.isInteger(g) || g === answer) return null;
  const byYear = new Map();
  for (const e of events) if (e.year !== answer) (byYear.get(e.year) || byYear.set(e.year, []).get(e.year)).push(e);
  for (let d = 0; d <= 10; d++) {
    // Nearer the answer first: it says more about the gap.
    for (const y of g < answer ? [g + d, g - d] : [g - d, g + d]) {
      const list = byYear.get(y);
      // Never past the answer: "In 2014" for a 2012 guess at 2013 misleads.
      if (list && (y - answer) * (g - answer) > 0) return { year: y, text: list[hashString(`nameyear-fact:${g}`) % list.length].text };
    }
  }
  return null;
}

/**
 * Five rounds, each a year with three clues of three different kinds (a song,
 * a film or award, a leader or birth), so no single clue type gives it away.
 * Years are at least three apart, so two rounds never share clues.
 */
export function buildYearRounds(events, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`nameyear:${seed}`));
  // The last year with any event, so answer options never run past the data
  // (a literal 2026 here would let 2027 appear in the options as soon as the
  // timeline gains a 2027 event, and cap the options a year too early).
  const lastYear = Math.max(...events.map((e) => e.year));
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
    return { year, clues, options: yearOptions(year, rand, lastYear) };
  });
}

/**
 * Four choices for easy mode: the year and three others within six years,
 * at least two apart from each other so the options are distinguishable.
 * None is later than `lastYear`, the newest year the timeline has.
 */
function yearOptions(year, rand, lastYear) {
  const offsets = shuffle([-6, -4, -2, 2, 4, 6, -5, -3, 3, 5], rand);
  const picked = [year];
  for (const o of offsets) {
    const y = year + o;
    if (y > lastYear || picked.some((p) => Math.abs(p - y) < 2)) continue;
    picked.push(y);
    if (picked.length === 4) break;
  }
  // Near the present only earlier years exist, and the two-apart rule can run
  // out of room (2025 came back with three options). Fill from the nearest
  // unused years, one apart if need be.
  for (let d = 1; picked.length < 4 && d <= 12; d++) {
    for (const y of [year - d, year + d]) {
      if (picked.length < 4 && y <= lastYear && !picked.includes(y)) picked.push(y);
    }
  }
  return picked.sort((a, b) => a - b);
}
