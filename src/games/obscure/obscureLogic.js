// Pure logic for Obscure-est: picking a game's categories and scoring a guess.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { matchChartGuess } from '../charts/chartLogic.js';

export const ROUNDS = 5;
const KINDS = ['geo', 'people', 'music', 'film'];

/**
 * Five categories: one from each area, then one more from anywhere. Songs are
 * half the categories, so drawing at random would make most games about music.
 */
export function pickCategories(categories, seed) {
  const rand = makeRng(hashString(`obscure:${seed}`));
  const chosen = [];
  for (const kind of KINDS) {
    const pool = categories.filter((c) => c.kind === kind);
    if (pool.length) chosen.push(pool[Math.floor(rand() * pool.length)]);
  }
  const rest = shuffle(categories.filter((c) => !chosen.includes(c)), rand);
  while (chosen.length < ROUNDS && rest.length) chosen.push(rest.shift());
  return shuffle(chosen, rand);
}

// "The Gambia" for Gambia, "St Lucia" for Saint Lucia, "Dr Zhivago" for
// Doctor Zhivago: a leading "The" is optional, and "St" and "Dr" are the full
// words, on both sides (a playtest, 2026-10-19, had all three rejected).
const tidy = (s) =>
  s
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/\bSt\b\.?/gi, 'Saint')
    .replace(/\bDr\b\.?/gi, 'Doctor');

/**
 * Every spelling of an answer, tidied. A country named for two places also
 * takes its first ("Trinidad", "Antigua", "Bosnia", "Saint Kitts").
 */
function spellings(accept, geo) {
  const out = new Set(accept.map(tidy));
  if (geo) for (const a of [...out]) if (/ and /.test(a)) out.add(a.split(/ and /)[0]);
  return [...out];
}

/**
 * Score a guess against a category: the answer's score (1-100) if it is on
 * the list, 0 if not. Uses the chart boards' matching, so typos, "The" and
 * surnames alone behave the same way everywhere.
 */
export function scoreGuess(category, guess) {
  const geo = category.kind === 'geo';
  const items = category.answers.map((a, i) => ({ id: a.text, rank: i + 1, label: a.text, answers: spellings(a.accept, geo) }));
  const m = matchChartGuess(tidy(guess), items);
  if (!m || m.ambiguous) return { answer: null, score: 0, ambiguous: Boolean(m?.ambiguous) };
  const answer = category.answers.find((a) => a.text === m.item.id);
  return { answer, score: answer.score };
}
