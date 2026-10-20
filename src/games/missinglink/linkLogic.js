// Pure logic for Missing link: four clues revealed one at a time, rarest
// first; pick the link from four options.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';

export const ROUNDS = 5;
export const CLUES = 4;

// Categories whose ids share a prefix are the same kind of link ("borders-",
// "songs-"), which makes the best wrong options.
const family = (id) => id.split('-')[0];

/**
 * A category's continent (most of its answers' `region`) and era (the middle
 * year of its well-known answers), or null where obscure.json has neither.
 */
const placeCache = new WeakMap();
function place(category) {
  let p = placeCache.get(category);
  if (!p) {
    const counts = {};
    for (const a of category.answers) if (a.region) counts[a.region] = (counts[a.region] || 0) + 1;
    const years = category.answers.filter((a) => a.year && a.score <= 60).map((a) => a.year).sort((x, y) => x - y);
    p = { region: Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0] || null, era: years.length ? years[years.length >> 1] : null };
    placeCache.set(category, p);
  }
  return p;
}

/**
 * How far a wrong option sits from the link, in steps; 0 is closest. Another
 * continent is 1 step; for songs and films, a step per full 15 years between
 * eras. The 2026-10-19 playtest found geography and film links guessable at
 * clue 1: over 400 games, clue 1 alone ruled out all three wrong options in
 * 208 of 436 geography rounds and 193 of 427 film rounds.
 */
export function optionDistance(link, other) {
  const a = place(link);
  const b = place(other);
  if (a.region && b.region) return a.region === b.region ? 0 : 1;
  if (a.era && b.era) return Math.floor(Math.abs(a.era - b.era) / 15);
  return 0;
}

/** Points for guessing right after seeing `shown` clues: 4, 3, 2, 1. */
export const linkPoints = (shown) => Math.max(0, CLUES + 1 - shown);

/**
 * The text shown for a clue. People are shown by surname ("Cruise"), since
 * "Tom Cruise" would give away "a famous person called Tom".
 */
function clueText(category, answer) {
  if (category.kind === 'people') return answer.accept[1] || answer.text;
  return answer.text;
}

/**
 * Four clues spread across the category from rarest to most obvious: one near
 * each of scores 100, 70, 40 and 1. Starting with the deep cut is what makes
 * an early guess worth more.
 */
function pickClues(category) {
  const targets = [100, 70, 40, 1];
  const used = new Set();
  const shown = new Set();
  const clues = [];
  for (const t of targets) {
    const best = category.answers
      // A surname clue can shrink to "I" (Mary I), "B" (Max B) or "Ng": a
      // fragment that tells the player nothing. Clues are 3+ characters.
      // Two clues must also read differently: two Smiths both show "Smith".
      .filter((a) => !used.has(a.text) && clueText(category, a).length >= 3 && !shown.has(normalise(clueText(category, a))))
      .sort((a, b) => Math.abs(a.score - t) - Math.abs(b.score - t))[0];
    if (!best) return null; // too few distinct clues: the caller tries another category
    used.add(best.text);
    shown.add(normalise(clueText(category, best)));
    clues.push({ text: clueText(category, best), answer: best.text });
  }
  return clues;
}

/** Do two clues read the same once case, accents and punctuation are ignored? */
export const hasRepeatedClue = (clues) => new Set(clues.map((c) => normalise(c.text))).size < clues.length;

/**
 * Would `category` also fit a clue as the player sees it? Then it would be a
 * second right option. Checked on the displayed text as well as the identity:
 * a people clue shows only "Scott", which fits Tony Scott as well as Tim Scott,
 * so "a famous Tony" must not be offered beside it.
 */
function fitsAny(category, clues) {
  const shown = new Set(clues.map((c) => normalise(c.text)));
  const ids = new Set(clues.map((c) => normalise(c.answer)));
  const { identities, displays } = normalisedAnswers(category);
  return identities.some((x) => ids.has(x)) || displays.some((x) => shown.has(x));
}

/**
 * Every answer of a category, normalised once. fitsAny runs against all ~400
 * categories for each round, and normalising their ~6,000 answers afresh
 * every time made building one game take about 60 ms.
 */
const normalisedCache = new WeakMap();
function normalisedAnswers(category) {
  let n = normalisedCache.get(category);
  if (!n) {
    n = {
      identities: category.answers.map((a) => normalise(a.text)),
      displays: category.answers.flatMap((a) => [normalise(clueText(category, a)), ...a.accept.map(normalise)])
    };
    normalisedCache.set(category, n);
  }
  return n;
}

/**
 * Five rounds, one category each, drawn so the kinds vary. Each round's three
 * wrong options come from the same family where possible, closest first, and are checked not
 * to fit ANY of the four clues, so exactly one option is right however many
 * clues the player has seen.
 */
export function buildLinkRounds(categories, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`missinglink:${seed}`));
  const rounds = [];
  const usedKinds = [];
  for (const cat of shuffle(categories, rand)) {
    if (rounds.length === count) break;
    // No kind twice until every kind has had a turn.
    if (usedKinds.includes(cat.kind) && new Set(usedKinds).size < 4) continue;
    const clues = pickClues(cat);
    if (!clues || hasRepeatedClue(clues)) continue;
    const others = categories.filter((c) => c.id !== cat.id && !fitsAny(c, clues));
    // Closest first (same continent, nearby era), in a seeded order within each step.
    const same = shuffle(others.filter((c) => family(c.id) === family(cat.id)), rand)
      .map((c, i) => ({ c, i, steps: optionDistance(cat, c) }))
      .sort((x, y) => x.steps - y.steps || x.i - y.i)
      .map((x) => x.c);
    const rest = shuffle(others.filter((c) => family(c.id) !== family(cat.id) && c.kind === cat.kind), rand);
    const decoys = [...same, ...rest].slice(0, 3);
    if (decoys.length < 3) continue;
    const options = shuffle([cat, ...decoys], rand).map((c) => c.prompt);
    rounds.push({ id: cat.id, link: cat.prompt, clues, options, correctIndex: options.indexOf(cat.prompt) });
    usedKinds.push(cat.kind);
  }
  return rounds;
}
