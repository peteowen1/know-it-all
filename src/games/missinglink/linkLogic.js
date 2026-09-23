// Pure logic for Missing link: four clues revealed one at a time, rarest
// first; pick the link from four options.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';

export const ROUNDS = 5;
export const CLUES = 4;

// Categories whose ids share a prefix are the same kind of link ("borders-",
// "songs-"), which makes the best wrong options.
const family = (id) => id.split('-')[0];

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
  const clues = [];
  for (const t of targets) {
    const best = category.answers
      .filter((a) => !used.has(a.text))
      .sort((a, b) => Math.abs(a.score - t) - Math.abs(b.score - t))[0];
    used.add(best.text);
    clues.push({ text: clueText(category, best), answer: best.text });
  }
  return clues;
}

/**
 * Would `category` also fit a clue as the player sees it? Then it would be a
 * second right option. Checked on the displayed text as well as the identity:
 * a people clue shows only "Scott", which fits Tony Scott as well as Tim Scott,
 * so "a famous Tony" must not be offered beside it.
 */
function fitsAny(category, clues) {
  const shown = new Set(clues.map((c) => normalise(c.text)));
  const ids = new Set(clues.map((c) => normalise(c.answer)));
  return category.answers.some(
    (a) => ids.has(normalise(a.text)) || shown.has(normalise(clueText(category, a))) || a.accept.some((x) => shown.has(normalise(x)))
  );
}

/**
 * Five rounds, one category each, drawn so the kinds vary. Each round's three
 * wrong options come from the same family where possible and are checked not
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
    const others = categories.filter((c) => c.id !== cat.id && !fitsAny(c, clues));
    const same = shuffle(others.filter((c) => family(c.id) === family(cat.id)), rand);
    const rest = shuffle(others.filter((c) => family(c.id) !== family(cat.id) && c.kind === cat.kind), rand);
    const decoys = [...same, ...rest].slice(0, 3);
    if (decoys.length < 3) continue;
    const options = shuffle([cat, ...decoys], rand).map((c) => c.prompt);
    rounds.push({ id: cat.id, link: cat.prompt, clues, options, correctIndex: options.indexOf(cat.prompt) });
    usedKinds.push(cat.kind);
  }
  return rounds;
}
