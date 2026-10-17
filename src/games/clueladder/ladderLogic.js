// Pure logic for Clue ladder: mask the answer out of a question's explanation
// and hook, choose a spread of questions, and check typed guesses.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';
import { rowMatches } from '../lists/listMatch.js';

export const ROUNDS = 5;
export const RUNGS = 4;
export const MASK = '▢▢▢';
export const MIN_WORDS = 12;

/** Points for getting it on rung 1..4: 4, 3, 2, 1. */
export const ladderPoints = (rung) => Math.max(0, RUNGS + 1 - rung);

const SKIP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'de', 'la', 'le', 'von', 'van']);
const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

/** A word with a plural ending removed, for comparing forms. */
function stem(w) {
  let s = w;
  if (s.length > 3) s = s.replace(/s$/, '');
  if (s.length > 3) s = s.replace(/e$/, '');
  return s;
}

/** The words of an answer that must be hidden (normalised, without "the", "of" and so on). */
function answerWords(answer) {
  return normalise(answer)
    .split(' ')
    .filter((w) => w && !SKIP_WORDS.has(w));
}

const sameWord = (token, word) => {
  if (token === word) return true;
  if (word.length < 3 || token.length < 3) return false;
  // Longer words also catch their derived forms: "Sahara" hides "Saharan".
  if (word.length >= 4 && token.startsWith(word)) return true;
  return stem(token) === stem(word);
};

/**
 * `text` with every word of `answer` replaced by ▢▢▢. Case, accents, plurals
 * and possessives ("Newton's", "Newtons") are all caught.
 */
export function maskText(text, answer) {
  const words = answerWords(answer);
  return text.replace(TOKEN, (tok) => {
    const parts = normalise(tok).split(' ').filter(Boolean); // "Newton's" -> newton, s
    const joined = parts.join('');
    const hit = words.some((w) => sameWord(joined, w) || parts.some((p) => p.length > 1 && sameWord(p, w)));
    return hit ? MASK : tok;
  });
}

const NUMBER_WORDS = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)( |$)/;
const isNumberish = (answer) => (!/\p{L}/u.test(answer) && /\d/.test(answer)) || NUMBER_WORDS.test(normalise(answer));

const countWords = (s) => s.split(/\s+/).filter((w) => w && w !== MASK && /[\p{L}\p{N}]/u.test(w)).length;

/**
 * The ladder text for one question, or null if it does not make a fair one:
 * the masked explanation must keep at least 12 words and not still hold the answer.
 */
export function buildRung(q) {
  if (!q || !q.answer || !q.explanation || !q.hook || !q.distractors || q.distractors.length < 3) return null;
  if (isNumberish(q.answer) || /^\d/.test(q.answer.trim())) return null;
  const words = answerWords(q.answer);
  if (words.length === 0) return null;
  const explanation = maskText(q.explanation, q.answer);
  const hook = maskText(q.hook, q.answer);
  if (countWords(explanation) < MIN_WORDS) return null;
  const left = ` ${normalise(explanation)} `;
  if (left.includes(` ${normalise(q.answer)} `)) return null;
  if (words.some((w) => left.includes(` ${w} `))) return null;
  return { explanation, hook };
}

/** The questions that make a fair ladder. */
export function eligibleQuestions(all) {
  return all.filter((q) => buildRung(q));
}

/**
 * Five questions, taking one category at a time in turn, so the round is a mix.
 * Returns [{ id, options }] with the options already shuffled.
 */
export function pickRounds(all, { seed, count = ROUNDS } = {}) {
  const rng = makeRng(hashString(String(seed)));
  const byCat = new Map();
  for (const q of eligibleQuestions(all)) {
    if (!byCat.has(q.category)) byCat.set(q.category, []);
    byCat.get(q.category).push(q);
  }
  const cats = shuffle([...byCat.keys()], rng).map((c) => shuffle(byCat.get(c), rng));
  const picked = [];
  for (let i = 0; picked.length < count && cats.some((c) => c.length); i++) {
    const c = cats[i % cats.length];
    if (c.length) picked.push(c.shift());
  }
  return picked.map((q) => ({ id: q.id, options: shuffle([q.answer, ...q.distractors.slice(0, 3)], rng) }));
}

/** Other spellings of an answer: "Mount Everest (Sagarmatha)" also accepts "Mount Everest". */
function acceptedForms(answer) {
  const forms = new Set([answer, answer.replace(/\s*\([^)]*\)/g, '').trim()]);
  for (const part of answer.split(/\s+\/\s+/)) forms.add(part.trim());
  return [...forms].filter(Boolean);
}

const dropThe = (s) => normalise(s).replace(/^the /, '');

/** Is the typed guess this question's answer? Ignores case, punctuation and a leading "The"; allows small typos. */
export function guessIsRight(guess, answer) {
  const g = dropThe(guess);
  if (!g) return false;
  return rowMatches(g, { accept: acceptedForms(answer).map(dropThe) });
}
