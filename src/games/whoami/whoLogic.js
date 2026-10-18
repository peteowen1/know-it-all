// Pure logic for Who am I: a famous person in three clues, vague to plain,
// then four names to choose from. Built from the Famous first names data
// (src/data/famous.json). No React, no JSON import: scripts/test-who-am-i.mjs
// runs it on the real file.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise, matchGuess } from '../names/nameMatch.js';

export const ROUNDS = 5;
export const RUNGS = 4; // three clues, then the options

/** A birth year as shown: 1962, or "83 BC" for a negative (BC) year. */
export const yearText = (y) => (y < 0 ? `${-y} BC` : String(y));

/** Points for getting it on rung 1..4: 4, 3, 2, 1. */
export const whoPoints = (rung) => Math.max(0, RUNGS + 1 - rung);

// Only each board's best-known people: the fifteen Famous first names shows.
const TOP = 15;

/**
 * What they are known for, with the years taken out (those are the second
 * clue) and any word of their own name blanked: "American actor and film
 * producer (born 1962)" becomes "American actor and film producer".
 */
export function knownFor(person, first) {
  const nameWords = new Set(normalise(`${first} ${person.rest}`).split(' ').filter((w) => w.length > 2));
  return person.description
    // Bracketed years anywhere: "Belgian chemist (1863–1944); inventor of
    // Bakelite", "Roman politician and general (83–30 BC)".
    .replace(/\s*\([^)]*\d[^)]*\)/g, '')
    .replace(/[\p{L}'-]+/gu, (w) => (nameWords.has(normalise(w)) ? '…' : w))
    .trim();
}

/** A person makes a fair round: a description worth reading and a birth year. */
// Blanking a monarch's name can leave nothing to go on ("… … … from 1745 to
// 1765" for Francis I, Holy Roman Emperor), so a clue with more than one
// blank, or under a dozen real letters, is skipped.
const usable = (person, first) => {
  const clue = knownFor(person, first);
  return person.born && (clue.match(/…/g) || []).length <= 1 && clue.replace(/[^\p{L}]/gu, '').length >= 12;
};

/**
 * `count` rounds from different first names. Each: the person, their first
 * name and clues, and four full names to choose from (the person and three
 * others with the same first name, so the last clue does not give it away).
 */
export function buildWhoRounds(names, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`whoami:${seed}`));
  const rounds = [];
  for (const board of shuffle(names, rand)) {
    if (rounds.length === count) break;
    const first = board.spellings ? board.spellings[0] : board.first;
    const top = board.people.slice(0, TOP);
    const candidates = shuffle(top.filter((p) => usable(p, p.first || first)), rand);
    const person = candidates[0];
    if (!person) continue;
    // Two different people can share a name (two Graham Greenes): each option
    // must read differently, so only one name per option.
    const seen = new Set([normalise(person.name)]);
    // A decoy born the same year could fit every clue (Sara Gilbert and Sara
    // Ramirez: both American actresses born in 1975), so none is.
    const others = shuffle(top.filter((p) => p.id !== person.id && p.born !== person.born), rand)
      .filter((p) => !seen.has(normalise(p.name)) && seen.add(normalise(p.name)))
      .slice(0, 3);
    if (others.length < 3) continue;
    const picked = shuffle([person, ...others], rand);
    const options = picked.map((p) => p.name);
    rounds.push({
      id: person.id,
      name: person.name,
      first: person.first || first,
      // Every spelling on a merged board, so "Mohamed Ali" counts for Muhammad Ali.
      spellings: board.spellings || [board.first],
      knownFor: knownFor(person, person.first || first),
      born: person.born,
      description: person.description,
      options,
      // Who each option is: two people can share a name (two Brian Coxes).
      optionIds: picked.map((p) => p.id),
      answerIndex: options.indexOf(person.name)
    });
  }
  return rounds;
}

/**
 * Is a typed guess this round's person? The same matcher as Famous first
 * names: surname alone ("Cruise"), full name, small typos from five letters.
 */
export function guessIsRight(guess, round) {
  const person = { id: round.id, rest: round.name.slice(round.first.length).trim(), first: round.first, views: 0 };
  const hit = matchGuess(guess, round.spellings || round.first, [person]);
  return Boolean(hit) || normalise(guess) === normalise(round.name);
}
