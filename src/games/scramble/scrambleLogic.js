// Pure logic for Scramble: turn a country or capital into shuffled letter
// tiles, and check a typed answer. No React, no JSON import, so
// scripts/test-scramble.mjs can run it directly.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise, editDistance } from '../names/nameMatch.js';
import { rowMatches } from '../lists/listMatch.js';
import { countryPool, countryInText } from '../geo/geoPool.js';

export const ROUNDS = 10;
export const MAX_LETTERS = 14;
export const MIN_LETTERS = 4;
export const MAX_POINTS = 2;

const LETTER = /\p{L}/u;
const SEPARATOR = /[ '’-]/u;
// Letters, spaces, hyphens and apostrophes only: "Washington D.C." is not a good puzzle.
const PLAIN = /^\p{L}[\p{L} '’-]*$/u;

/** Points: 2 clean, 1 after a hint or a wrong guess, 0 skipped. */
export const pointsFor = ({ hinted, skipped }) => (skipped ? 0 : hinted ? 1 : 2);

const letterCount = (text) => [...text].filter((ch) => LETTER.test(ch)).length;

/** Can this answer be a puzzle? 4 to 14 letters in all. */
export function isPuzzleWord(text) {
  if (!text || !PLAIN.test(text.trim())) return false;
  const n = letterCount(text);
  return n >= MIN_LETTERS && n <= MAX_LETTERS;
}

// Shuffles tried per word, keeping the one that gives least away.
const SHUFFLES = 200;

/**
 * How much a shuffled word still shows of the real one: letters left in their
 * own place, plus neighbouring tiles that are neighbours in the word too
 * ("hoetosL" for Lesotho keeps "oto"). 0 is a clean scramble.
 */
export function giveaway(word, tiles) {
  const w = [...word.toLowerCase()];
  const t = [...tiles.toLowerCase()];
  const pairs = new Set(w.slice(1).map((ch, i) => w[i] + ch));
  return t.filter((ch, i) => ch === w[i]).length + t.slice(1).filter((ch, i) => pairs.has(t[i] + ch)).length;
}

/**
 * Shuffle the letters inside each word. Spaces, hyphens and apostrophes stay
 * where they are, and each word is moved off its original order whenever it
 * has two different letters to swap. Of up to 200 shuffles the one with the
 * lowest `giveaway` is kept: the 2026-10-19 playtest scored 19 and 20 of 20,
 * with a fifth of the letters left in place. Returns null if nothing could
 * move (every word is one repeated letter).
 */
export function scrambleText(text, rand) {
  let changed = false;
  const out = [...text]
    .reduce((pieces, ch) => {
      const last = pieces.at(-1);
      if (last && !SEPARATOR.test(ch) && !SEPARATOR.test(last[0])) last.push(ch);
      else pieces.push([ch]);
      return pieces;
    }, [])
    .map((chars) => {
      const word = chars.join('');
      if (SEPARATOR.test(chars[0]) || new Set(chars.map((c) => c.toLowerCase())).size < 2) return word;
      let next = null;
      let best = Infinity;
      for (let tries = 0; tries < SHUFFLES && best > 0; tries++) {
        const trial = shuffle(chars, rand);
        if (trial.join('') === word) continue;
        const score = giveaway(word, trial.join(''));
        if (score < best) [next, best] = [trial, score];
      }
      if (!next) next = [...chars.slice(1), chars[0]];
      changed = true;
      return next.join('');
    })
    .join('');
  return changed ? out : null;
}

/** Every spelling of an answer the player may type. Two-letter codes are not names. */
function acceptList(country, mode) {
  if (mode === 'capitals') return [...country.capitals, ...(country.capitalsAlsoAccepted || [])];
  return [country.name, country.officialName, ...(country.altNames || []).filter((a) => a.length > 2)].filter(Boolean);
}

/** The puzzle answer for a country, or null when it does not make a fair puzzle. */
export function answerFor(country, mode) {
  const answer = mode === 'capitals' ? country.capitals?.[0] : country.name;
  if (!isPuzzleWord(answer)) return null;
  // Singapore, Monaco, and Tunis, Kuwait City, San Salvador: the hint "Capital
  // of <country>" would hand over the capital, or most of it.
  if (mode === 'capitals' && sharesWord(answer, country.name)) return null;
  return answer;
}

const words = (s) => normalise(s).split(' ').filter((w) => w.length >= 4);
function sharesWord(capital, countryName) {
  const inName = words(countryName);
  return words(capital).some((w) => inName.some((n) => n.startsWith(w.slice(0, 4)) || w.startsWith(n.slice(0, 4))));
}

export const hintFor = (country, mode) =>
  mode === 'capitals' ? `Capital of ${countryInText(country.name)}` : `Country in ${country.region}`;

/**
 * Is the typed text one of the accepted spellings? Uses the same typed-answer
 * matcher as Fill the list: one typo allowed from five letters, two from nine.
 */
// "The Gambia" for Gambia, "St John's" for Saint John's: a leading "The" is
// optional and "St" is "Saint", on both sides.
const tidy = (s) => normalise(s).replace(/^the /, '').replace(/\bst\b/g, 'saint');

export function isCorrect(guess, round) {
  const g = tidy(guess);
  const accept = round.accept.map(tidy);
  if (rowMatches(g, { accept }, { exact: true })) return true;
  // A typo allowance must not turn a different real name into a right answer
  // (Australia for Austria, Zambia for Gambia, Kingston for Kingstown).
  if (round.reject?.some((r) => tidy(r) === g)) return false;
  return rowMatches(g, { accept });
}

// The game gets longer as it goes: of ten rounds, 2 short words, then 3 of
// 6-7 letters, 3 of 8-9 and 2 of 10-14. A band without enough places (a small
// region) is filled from the others.
const BANDS = [
  { most: 5, share: 0.2 },
  { most: 7, share: 0.3 },
  { most: 9, share: 0.3 },
  { most: MAX_LETTERS, share: 0.2 }
];
const bandOf = (answer) => BANDS.findIndex((b) => letterCount(answer) <= b.most);

/**
 * `count` rounds for a mode and region, shortest words first, in a seeded
 * order within each length. Each round is plain JSON so it can be saved with
 * the game.
 */
export function buildScrambleRounds(countries, { mode = 'countries', region = 'World', seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`scramble:${mode}:${region}:${seed}`));
  const pool = countryPool(countries, { region, needs: mode === 'capitals' ? 'capitals' : null });
  // Every other name of the same kind: a guess equal to one of these is wrong
  // even when it is within a typo of this round's answer.
  const allNames = countries.flatMap((c) => acceptList(c, mode));
  const playable = shuffle(pool, rand).filter((c) => answerFor(c, mode));
  const want = BANDS.map((b) => Math.round(b.share * count));
  const picked = [];
  for (const c of playable) {
    const band = bandOf(answerFor(c, mode));
    if (want[band] > 0) {
      want[band]--;
      picked.push(c);
    }
  }
  // Short of a band: the rest of the places, in their shuffled order.
  for (const c of playable) if (picked.length < count && !picked.includes(c)) picked.push(c);
  const ordered = picked.map((c, i) => ({ c, i, band: bandOf(answerFor(c, mode)) })).sort((a, b) => a.band - b.band || a.i - b.i).map((x) => x.c);
  // Spares, should a picked word not scramble (one repeated letter).
  ordered.push(...playable.filter((c) => !picked.includes(c)));

  const rounds = [];
  for (const c of ordered) {
    if (rounds.length === count) break;
    const answer = answerFor(c, mode);
    const tiles = scrambleText(answer, rand);
    if (!tiles) continue;
    const accept = acceptList(c, mode);
    const own = new Set(accept.map(normalise));
    const target = normalise(answer);
    const reject = [...new Set(allNames.filter((n) => !own.has(normalise(n)) && editDistance(normalise(n), target, 2) <= 2))];
    rounds.push({ key: c.code, answer, tiles, accept, reject, hint: hintFor(c, mode), fact: factFor(c, mode, countries) });
  }
  return rounds;
}

/** "2.6 million", "1.4 billion", "34,000": a population said out loud. */
export function peopleText(n) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e7) return `${Math.round(n / 1e6)} million`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)} million`;
  if (n >= 1e4) return Math.round(n / 1000).toLocaleString('en-GB') + ',000';
  return Math.round(n).toLocaleString('en-GB');
}

const listText = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * "speaks French", or null. The data lists languages in no useful order
 * (Belgium: German, French, Dutch), so a country with three or more is left
 * out rather than named by two minor ones. Two kinds of one language
 * (Norwegian Bokmål and Nynorsk) read as the one.
 */
function languagesText(languages = []) {
  if (!languages.length || languages.length > 2) return null;
  const first = languages.map((l) => l.split(' ')[0]);
  if (languages.length === 2 && first[0] === first[1]) return `speaks ${first[0]}`;
  return `speaks ${listText(languages)}`;
}

/**
 * What the answer is, shown once the round is over, right or wrong, so a
 * miss still teaches something:
 *   countries  "Gabon: in Middle Africa, capital Libreville, 2.6 million
 *              people, speaks French, borders Cameroon, Congo and Equatorial Guinea."
 *   capitals   "Libreville is the capital of Gabon, in Middle Africa, a country
 *              of 2.6 million people."
 * Any piece the data lacks is left out. Up to three neighbours are named;
 * more than that are counted.
 */
export function factFor(country, mode, countries) {
  const region = country.subregion || country.region;
  const where = region && (/^(Caribbean|Antarctic)$/.test(region) ? `the ${region}` : region);
  const people = country.population ? `${peopleText(country.population)} people` : null;
  const capital = country.capitals?.[0];
  if (mode === 'capitals') {
    const ofPeople = people && country.sovereign ? `, a country of ${people}` : '';
    return `${capital} is the capital of ${countryInText(country.name)}${where ? `, in ${where}` : ''}${ofPeople}.`;
  }
  const byIso3 = new Map(countries.map((c) => [c.iso3, c.name]));
  const borders = (country.borders || []).map((b) => byIso3.get(b)).filter(Boolean);
  const parts = [
    where && `in ${where}`,
    capital && capital !== country.name && `capital ${capital}`,
    people,
    languagesText(country.languages),
    borders.length > 3 ? `borders ${borders.length} countries` : borders.length && `borders ${listText(borders.map((b) => countryInText(b)))}`
  ].filter(Boolean);
  return `${countryInText(country.name, { start: true })}: ${parts.join(', ')}.`;
}
