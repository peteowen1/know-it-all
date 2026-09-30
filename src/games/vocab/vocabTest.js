// Word play test mode: an adaptive test that estimates how rare a word you
// reliably know.
//
// Each word carries a frequency on the Zipf scale (log10 of uses per billion
// words: 4 is "ban", 2 is "loquacious", 1 is very rare; see
// scripts/build-vocab-freq.py). The player's level `theta` is the Zipf value
// at which they know a word half the time. Words more common than theta are
// mostly known, rarer ones mostly not:
//
//   P(right) = guess + (1 - guess) * logistic(SLOPE * (zipf - theta))
//
// `guess` is the chance of getting the question right by luck. After every
// answer the belief about theta is updated on a grid (Bayes' rule), and the
// next question is the word whose Zipf is closest to the current estimate,
// which is where an answer tells us most.
//
// SLOPE and the prior are assumptions, not fitted: there is no data from real
// players yet. SLOPE 2.5 means a word one Zipf step more common than your
// level is known about 92% of the time.

import { makeRng, hashString } from '../../lib/rng.js';
import { roundContext, roundFor } from './vocabLogic.js';

export const TEST_LENGTH = 20;
// Simulated players: the stated ± on the level is about 0.37 at 10 questions
// and 0.24 at 20; at 5 it is 0.56, too loose to be worth a number.
export const TEST_LENGTHS = [10, 20];
export const SLOPE = 2.5;
const PRIOR_MEAN = 3;
const PRIOR_SD = 1.2;
const GRID = Array.from({ length: 121 }, (_, i) => i * 0.05); // Zipf 0 to 6
const TYPES = ['meaning', 'syn', 'ant'];

const logistic = (x) => 1 / (1 + Math.exp(-x));
const choose = (n, k) => (k === 0 ? 1 : (n * choose(n - 1, k - 1)) / k);

/** Chance of a right answer by luck: 1 in 4 options, or 1 in C(5, k) sets of k synonyms. */
export const guessRate = (round) => (round.type === 'syn' ? 1 / choose(round.options.length, round.pick) : 1 / round.options.length);

export const pRight = (theta, zipf, guess) => guess + (1 - guess) * logistic(SLOPE * (zipf - theta));

/**
 * How rare the round is: the rarest word you must know to be sure of it.
 * Synonyms need every right word; opposites need the prompt and the answer;
 * meanings need only the defined word.
 */
export function roundZipf(round, zipfOf) {
  if (round.type === 'meaning') return zipfOf.get(round.target);
  return Math.min(...[round.target, ...round.answer].map((w) => zipfOf.get(w)));
}

export function prior() {
  const w = GRID.map((t) => Math.exp(-0.5 * ((t - PRIOR_MEAN) / PRIOR_SD) ** 2));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

/** Bayes' rule on the grid for one answer. */
export function update(post, zipf, guess, right) {
  const w = post.map((p, i) => {
    const pr = pRight(GRID[i], zipf, guess);
    return p * (right ? pr : 1 - pr);
  });
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

/** Posterior mean and standard deviation of the level. */
export function estimate(post) {
  const mean = post.reduce((s, p, i) => s + p * GRID[i], 0);
  const sd = Math.sqrt(post.reduce((s, p, i) => s + p * (GRID[i] - mean) ** 2, 0));
  return { level: mean, sd };
}

/**
 * The range a level can honestly be given as a number: just inside the
 * rarest and commonest words in the set. Outside it the estimate is
 * extrapolation, so it is shown as off the scale instead.
 */
export function scaleBounds(groups) {
  const z = groups.flatMap((g) => g.words.map((w) => w[2]));
  return { lowest: Math.min(...z) + 0.2, highest: Math.max(...z) - 0.2 };
}

/** A level as shown to the player: a number, or which end of the scale it is off. */
export function formatLevel(level, { lowest, highest }) {
  if (level < lowest) return 'off the top of the scale';
  if (level > highest) return 'below the bottom of the scale';
  return `level ${level.toFixed(1)}`;
}

/** Everything the test needs about the data, built once. */
export function testContext(vocab) {
  const zipfOf = new Map();
  for (const g of vocab.groups) for (const [w, , z] of g.words) zipfOf.set(w, z);
  return { ...roundContext(vocab), zipfOf };
}

/**
 * The next question, given the current estimate and the families already used.
 * Aims at the estimate, with a little jitter so two tests at the same level
 * do not ask the same words.
 */
export function nextRound(ctx, { level, usedGroups, index, seed, recent = new Set() }) {
  const rand = makeRng(hashString(`vocabtest:${seed}:${index}`));
  const type = TYPES[index % TYPES.length];
  const cands = [];
  for (const g of ctx.all) {
    if (usedGroups.includes(g.id)) continue;
    if (type === 'ant' && !ctx.byId.has(g.ant)) continue;
    // Words met recently count as a whole Zipf step further away, so the test
    // prefers fresh words at the same level without ever running dry.
    for (const [w, , z] of g.words) cands.push({ g, w, gap: Math.abs(z - level) + rand() * 0.3 + (recent.has(w) ? 1 : 0) });
  }
  cands.sort((a, b) => a.gap - b.gap);
  // A round's difficulty is its rarest needed word, which can sit below the
  // word it was built around, so build a few and keep the one nearest the level.
  let best = null;
  for (const c of cands.slice(0, 12)) {
    const r = roundFor(type, c.g, c.w, ctx, rand);
    if (!r) continue;
    const round = { ...r, id: `${type}:${c.g.id}:${c.w}`, zipf: roundZipf(r, ctx.zipfOf) };
    if (!best || Math.abs(round.zipf - level) < Math.abs(best.zipf - level)) best = round;
  }
  return best;
}

/** A fresh test: its seed, length and first question, asked at the prior's level. */
export function newTest(ctx, length = TEST_LENGTH, recent = new Set()) {
  const seed = `${Date.now()}`;
  const first = nextRound(ctx, { level: PRIOR_MEAN, usedGroups: [], index: 0, seed, recent });
  return { seed, length, rounds: [first], answers: [], picked: [] };
}

/** Replay a finished test's answers into a level. */
export function scoreAnswers(answers) {
  let post = prior();
  for (const a of answers) post = update(post, a.zipf, a.guess, a.right);
  return estimate(post);
}

/**
 * Plain words for a level: roughly how often a word that rare turns up.
 * A Zipf of z is 10^z uses per billion words, so one use per 10^(9-z) words;
 * a typical novel is about 90,000 words.
 */
export function describeLevel(level) {
  const novels = 10 ** (9 - level) / 90000;
  if (novels < 1) return 'words that turn up several times in a typical novel';
  if (novels < 1.5) return 'words that turn up about once in a typical novel';
  return `words that turn up about once in every ${novels < 20 ? Math.round(novels) : Math.round(novels / 10) * 10} novels`;
}

