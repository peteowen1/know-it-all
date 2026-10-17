// Pure logic for Clue ladder: mask the answer out of a question's explanation
// and hook, choose a spread of questions, and check typed guesses.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';
import { rowMatches } from '../lists/listMatch.js';
import { CLUE_LADDER_SKIP } from '../../data/clueLadderSkip.js';

// Questions a playtest found unfair as ladders, kept out by id.
const SKIP = new Set(CLUE_LADDER_SKIP);

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
  // Kept to four letters or more, or "Andes" would come down to "and".
  if (s.length > 4) s = s.replace(/e$/, '');
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
  // The first clue has to hold a blank to fill. An explanation that never
  // names the answer ("Bloomer edited The Lily..." for "Newspaper editor")
  // leaves nothing to guess until the question itself appears.
  if (!explanation.includes(MASK)) return null;
  // And the blanks have to be the answer: every distinctive word of it must
  // appear in the first clue as itself (or its plural). Otherwise "Buckingham
  // Palace" blanks only the "Palace" of Kensington Palace, "Adrian IV" blanks
  // the Adrian of Adrian VI, and a definition answer blanks one stray word.
  const tokens = normalise(q.explanation).split(' ');
  const core = words.filter((w) => !GENERIC.has(w));
  // A one-letter answer ("N") would blank every stray letter in the text.
  if (core.some((w) => w.length < 2)) return null;
  if (!core.every((w) => tokens.some((t) => t === w || (w.length > 3 && stem(t) === stem(w))))) return null;
  if (SKIP.has(q.id)) return null;
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

// Words a person naturally leaves off: "gum" for "The gum tree", "Everest" for
// "Mount Everest", "Pacific" for "Pacific Ocean".
const GENERIC = new Set(['tree', 'trees', 'river', 'mount', 'mountain', 'mountains', 'lake', 'ocean', 'sea', 'island', 'islands', 'desert', 'city']);

/** The answer's forms with generic words removed, when something distinctive is left. */
function shortForms(answer) {
  const out = new Set();
  for (const f of acceptedForms(answer)) {
    const words = dropThe(f).replace(/^an? /, '').split(' ');
    const kept = words.filter((w) => !GENERIC.has(w));
    if (kept.length && kept.length < words.length) out.add(kept.join(' '));
  }
  return [...out];
}

/** Every answer and distractor in the bank, normalised: the wrong answers a typo allowance must not land on. */
export function knownAnswers(questions) {
  const known = new Set();
  for (const q of questions) for (const o of [q.answer, ...q.distractors]) for (const f of acceptedForms(o)) known.add(dropThe(f));
  return known;
}

// Henry VII and Henry VIII, Vitamin C and D, "About 55 per cent": one character
// apart and both real answers, so these must be typed exactly.
// A leading "A" ("A coolibah tree") is the article, not a letter.
const needsExact = (answer) => /\d|\b[IVXLC]+\b|\b[A-Z]\b/.test(answer.replace(/^an? /i, ''));

/**
 * Is the typed guess this question's answer? Ignores case, punctuation and a
 * leading "The", and allows small typos, except where a typo could land on a
 * different real answer: a guess that is exactly another option or another
 * answer in the bank (`known`) is wrong, and so is one within a typo of this
 * question's own distractors.
 */
export function guessIsRight(guess, answer, distractors = [], known = new Set()) {
  const g = dropThe(guess);
  if (!g) return false;
  const accept = acceptedForms(answer).map(dropThe);
  if (accept.includes(g)) return true;
  if (needsExact(answer) || known.has(g)) return false;
  if (rowMatches(g, { accept: distractors.flatMap(acceptedForms).map(dropThe) })) return false;
  return rowMatches(g, { accept: [...accept, ...shortForms(answer)] });
}
