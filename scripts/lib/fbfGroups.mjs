// The candidate groups for Four by four, and the check that no tile in a
// puzzle fits two of its groups. Shared by scripts/build-fourbyfour.mjs (which
// uses it to build) and scripts/test-logic.mjs (which uses it to prove the
// shipped puzzles are clean), so the two can never disagree about what
// "belongs to a group" means.
//
// A group has two ways to claim a tile:
//   members  the full set of strings it accepts ("Capitals in Western Europe")
//   rule     optional: a test on the country a tile names, for the groups
//            that are about countries. Catches a tile the member list does
//            not spell the same way, and the loose reading of "landlocked".
//            Or a test on the tile's own text (via 'text'), for the hidden
//            word groups: any tile with a hidden animal fits "Films hiding an
//            animal", film or not.
// A tile fits a group if either says yes.

import { readFileSync } from 'node:fs';
import { pluralName } from '../../src/games/names/nameMatch.js';

// Reuse caps, so no tile or group turns up in dozens of puzzles.
export const MAX_PUZZLES_PER_ITEM = 3;
export const MAX_PUZZLES_PER_LABEL = 5;
export const MAX_LEN = 26; // longer tiles do not fit a phone-width grid
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fits = (s) => s.length <= MAX_LEN;
// "Birdman or (The Unexpected Virtue of Ignorance)" loses its subtitle, and
// then the dangling "or" with it.
export const cleanTitle = (t) => t.split(' / ')[0].replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+or$/i, '').trim();

/** Reads every source file the groups are made from. `root` is the repo root. */
export function loadSources(root = '.') {
  const load = (p) => JSON.parse(readFileSync(`${root}/${p}`, 'utf8'));
  return {
    countries: load('src/data/countries.json').countries.filter((c) => c.sovereign),
    famous: load('src/data/famous.json').names,
    music: load('src/data/charts/music.json').years,
    films: load('src/data/charts/films.json'),
    tv: load('src/data/charts/tv.json')
  };
}

const COLOURS = /\b(red|blue|green|yellow|black|white|pink|purple|orange)\b/i;
// "One" and the ordinals are left out on purpose: "No One", "One More Time"
// and "The First Time" are not a number in the way "Seven Nation Army" is.
const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|twelve|hundred|thousand|million)\b|\d/i;
const ANIMALS = /\b(dog|dogs|cat|cats|bird|birds|bear|bears|wolf|wolves|lion|lions|horse|horses|fish|monkey|tiger|snake|bee|bees|butterfly|eagle|dove|swan|fox|rabbit|duck|mouse|spider|crow|hawk|pony|hound|panther|rooster|elephant|pig|cow|frog|bat|shark)\b/i;
const DAYS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
// May and March are left out: they read as verbs as often as months.
const MONTHS = /\b(january|february|april|june|july|august|september|october|november|december)\b/i;
// "Toy Story 4", "Men in Black II", "Rocky III", "Mad Max 2": a sequel number on the end.
const SEQUEL = /\s(2|3|4|5|6|7|8|9|II|III|IV|VI|VII|VIII)$/;
const hasColour = (t) => COLOURS.test(t);
const hasNumber = (t) => NUMBER_WORDS.test(t);

// Hidden words: ARMenia, CHINa, waSHINgton, RAMbo, DOGma, CATch Me If You
// Can, phONE, ofTEN (2026-10-19 playtest: the groups were all plain lists).
// "Ear", "eye", "ant", "bee", "hen" and "brow" are left out: they hide in so
// many words ("year", "want", "been", "when", every Brown) that nobody would
// see them as a clue.
export const HIDDEN = {
  'a body part': ['arm', 'leg', 'hip', 'lip', 'rib', 'toe', 'chin', 'shin', 'neck', 'chest', 'knee', 'heel', 'hand', 'foot', 'nose',
    'palm', 'skin', 'liver', 'heart', 'thumb', 'spine', 'lung', 'ankle', 'elbow', 'wrist', 'tongue', 'tooth'],
  'an animal': ['cat', 'dog', 'rat', 'ram', 'bat', 'owl', 'ape', 'cow', 'pig', 'emu', 'yak', 'elk', 'fox', 'hare', 'lion', 'bear',
    'wolf', 'mole', 'deer', 'goat', 'toad', 'crab', 'lamb', 'seal', 'swan', 'mule', 'mink', 'puma', 'newt', 'wren', 'crow', 'hawk',
    'dove', 'moth', 'slug', 'frog', 'boar'],
  'a number': ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
};
// "Sixteen", "Seventy", "Fourth": a number word, not one hiding in another.
const NUMBERISH = /^(one|two|three|four|five|six|seven|eight|nine|ten)(s|th|ths|teen|teens|ty|ties|fold)?$/;
// Compounds that say the word outright rather than hide it: a pussycat is a
// cat, a cowboy works with cows, a heartache is in the heart.
const PLAIN = /^(pussycats?|cow(boy|girl)s?|heart\w*|\w*hearts?|\w*hearted|foot\w+|hand(y|s|ful|made)|\w*skinny)$/;
const wordsOf = (t) => norm(t).split(' ').filter(Boolean);
/** Does any word of `t` contain one of `parts`, hidden or plain? The loose test a player applies. */
export const holdsWord = (t, parts) => wordsOf(t).some((w) => parts.some((p) => w.includes(p)));
/**
 * The word of `t` that hides one of `parts` where a player will see it, or
 * null: inside a longer word, not the word itself or its plural, and for a
 * three-letter part at the start or end of the word (RAMbo, ofTEN), not lost
 * in the middle.
 */
export const hidingWord = (t, parts, numbers = false) =>
  wordsOf(t).find((w) =>
    !(numbers && NUMBERISH.test(w)) &&
    !PLAIN.test(w) &&
    parts.some((p) => w !== p && w !== `${p}s` && w !== `${p}es` && (p.length >= 4 ? w.includes(p) : w.startsWith(p) || w.endsWith(p)))
  ) ?? null;

/**
 * Every candidate group: { type, label, level, members, pool, rule }.
 *   members  the full set, which the overlap check tests against
 *   pool     the recognisable part tiles are drawn from (default: all of it).
 *            "Famous Ruths" drawn from the top 12 gave Ruth Codd; drawn from
 *            the top 6 it gives names people know.
 *   level    difficulty, 1 (easy, yellow) to 4 (hard, purple)
 *   rule     { via: 'name' | 'capital', test(country) }, or null
 */
export function buildGroups({ countries, famous, music, films, tv }) {
  const groups = [];
  const add = (type, label, level, members, pool = members, rule = null) => {
    const m = [...new Set(members.filter(Boolean))];
    const pl = [...new Set(pool.filter(Boolean))].filter(fits);
    if (pl.length >= 4) groups.push({ type, label, level, members: m, pool: pl, rule });
  };

  // ---------------------------------------------------------------- geography
  const bySub = {};
  for (const c of countries) (bySub[c.subregion] ||= []).push(c);
  for (const [sub, list] of Object.entries(bySub)) {
    add('capitals', `Capitals in ${sub}`, 1, list.map((c) => c.capitals[0]), undefined,
      { via: 'capital', test: (c) => c.subregion === sub });
  }
  const byCode3 = new Map(countries.map((c) => [c.iso3, c]));
  for (const c of countries) {
    const n = c.borders.map((b) => byCode3.get(b)?.name).filter(Boolean);
    if (n.length >= 5) add('borders', `Borders ${c.name}`, 2, n, undefined, { via: 'name', test: (x) => x.borders.includes(c.iso3) });
  }
  const byRegion = {};
  for (const c of countries) (byRegion[c.region] ||= []).push(c);
  // Loose on purpose: "Landlocked in Asia" is also claimed by Slovakia or
  // Rwanda, because a player who spots "landlocked" will not stop to check the
  // continent. The 21 puzzles the 2026-10-17 review found were all this.
  for (const [region, list] of Object.entries(byRegion)) {
    add('landlocked', `Landlocked in ${region}`, 3, list.filter((c) => c.landlocked).map((c) => c.name), undefined,
      { via: 'name', test: (c) => c.landlocked });
  }
  const wordRule = (re) => ({ via: 'name', test: (c) => re.test(c.name) });
  add('wordplay', 'Countries ending in -land', 2, countries.filter((c) => /land$/i.test(c.name)).map((c) => c.name), undefined, wordRule(/land$/i));
  add('wordplay', 'Countries ending in -stan', 1, countries.filter((c) => /stan$/i.test(c.name)).map((c) => c.name), undefined, wordRule(/stan$/i));
  add('wordplay', 'Countries with "Guinea" in the name', 3, countries.filter((c) => /Guinea/.test(c.name)).map((c) => c.name), undefined, wordRule(/Guinea/));
  // The capital IS the country's name, give or take "City": Luxembourg,
  // Monaco, Mexico City, Kuwait City, Vatican City. The old rule (same first
  // five letters) also took Andorra la Vella, Tunis and Sao Tome, so a player
  // who knew those capitals rejected right tiles.
  const sameName = (c) => {
    const cap = norm(c.capitals[0] || '');
    const name = norm(c.name);
    return cap === name || cap === `${name} city` || name === `${cap} city`;
  };
  add('wordplay', "Capital has the country's name", 4, countries.filter(sameName).map((c) => c.name), undefined, { via: 'name', test: sameName });
  // Nigeria hides Niger, Romania hides Oman, Somalia hides Mali. Only the
  // longer name counts as a member; the hidden one is the answer to nothing.
  const hides = (c) => countries.some((o) => o !== c && norm(o.name).length >= 4 && norm(c.name).includes(norm(o.name)) && norm(c.name) !== norm(o.name));
  add('wordplay-hidden', 'Countries whose name hides another country', 4, countries.filter(hides).map((c) => c.name), undefined, { via: 'name', test: hides });

  // Albania, Algeria, Armenia, Indonesia: the first and last letters match.
  const bookends = (c) => {
    const n = norm(c.name).replace(/ /g, '');
    return n.length > 3 && n[0] === n.at(-1);
  };
  add('wordplay', 'Countries that start and end with the same letter', 4, countries.filter(bookends).map((c) => c.name), undefined, { via: 'name', test: bookends });

  // ------------------------------------------------------------------- people
  // "Famous Toms" shown as surnames only: Cruise, Hanks, Hardy, Holland.
  // Names that are usually a family name written first (Lee Jung-jae, Kim
  // Jong-un) are skipped: "Famous Lees: Sun-kyun, Jung-jae" is not a first-name
  // group at all.
  const FAMILY_NAME_FIRST = new Set(['Lee', 'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Ma', 'Nguyen']);
  // Louis and Louise both pluralise to 'Louises'; the less famous board says it plainly.
  const usedLabels = new Set();
  for (const n of famous) {
    if (FAMILY_NAME_FIRST.has(n.first)) continue;
    const modern = n.people.filter((p) => p.born == null || p.born >= 1940);
    // Regnal numerals ("III" for Charles III) are not surnames.
    const surnames = modern.map((p) => p.rest).filter((r) => !/\s/.test(r) && r.length >= 3 && !/^[IVXLC]+$/.test(r));
    // Checked against everyone on the list, drawn from the six best known.
    // Merged-spelling boards ("Billy / Billie") read "Famous Billys & Billies".
    const names = (n.spellings || [n.first]).map(pluralName);
    let label = `Famous ${names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`}`;
    if (usedLabels.has(label)) label = `Famous people called ${(n.spellings || [n.first]).join(' or ')}`;
    usedLabels.add(label);
    if (surnames.length >= 8) add('first-name', label, 2, surnames, surnames.slice(0, 6));
  }

  // -------------------------------------------------------------------- music
  const hitsBy = {};
  for (const list of Object.values(music)) {
    for (const s of list.slice(0, 40)) {
      for (const a of s.artists || [s.artist]) (hitsBy[a] ||= new Set()).add(cleanTitle(s.title));
    }
  }
  for (const [a, songs] of Object.entries(hitsBy)) {
    // Fewer chart hits means a harder group: eight or more is easy, five is hard.
    if (songs.size >= 5) add('artist', `Hits by ${a}`, songs.size >= 8 ? 1 : songs.size >= 6 ? 2 : 3, [...songs]);
  }
  for (let d = 1960; d <= 2020; d += 10) {
    const ones = Object.entries(music).filter(([y]) => y >= d && y < d + 10).map(([, l]) => cleanTitle(l[0].title));
    add('number-ones', `Billboard year-end #1s, ${d}s`, 3, ones);
  }
  // "Mony Mony", "Bye Bye Bye", "Bills, Bills, Bills", "Baby-Baby-Baby". Any
  // separator counts, so a hyphenated title can't sit outside the group while
  // plainly belonging to it.
  const allHits = [...new Set(Object.values(music).flatMap((l) => l.slice(0, 40).map((s) => cleanTitle(s.title))))];
  add('wordplay-music', 'Hits with a repeated word', 4, allHits.filter((t) => /\b(\w{2,})\b[^a-z0-9]+\1\b/i.test(t)));
  add('wordplay-music', 'Hits with a colour in the title', 4, allHits.filter(hasColour));
  add('wordplay-music', 'Hits with a number in the title', 4, allHits.filter(hasNumber));
  add('wordplay-music', 'Hits with an animal in the title', 4, allHits.filter((t) => ANIMALS.test(t)));
  add('wordplay-music', 'Hits with a day of the week in the title', 4, allHits.filter((t) => DAYS.test(t)));
  add('wordplay-music', 'Hits with a month in the title', 4, allHits.filter((t) => MONTHS.test(t)));

  // -------------------------------------------------------------------- films
  const filmsBy = {};
  for (const chart of [films.boxOffice, films.bestPicture]) {
    for (const list of Object.values(chart)) {
      for (const f of list) for (const d of f.artists || [f.artist]) (filmsBy[d] ||= new Set()).add(cleanTitle(f.title));
    }
  }
  for (const [d, set] of Object.entries(filmsBy)) {
    if (d !== 'Unknown director' && set.size >= 5) add('director', `Directed by ${d}`, set.size >= 8 ? 2 : 3, [...set]);
  }
  for (let d = 1930; d <= 2020; d += 10) {
    const wins = Object.entries(films.bestPicture).filter(([y]) => y >= d && y < d + 10).map(([, l]) => cleanTitle(l[0].title));
    add('best-picture', `Best Picture winners, ${d}s`, 3, wins);
  }
  const allFilms = [...new Set([films.boxOffice, films.bestPicture].flatMap((c) => Object.values(c).flat().map((f) => cleanTitle(f.title))))];
  // Titles that BEGIN with a digit, across every film in the charts, not just
  // titles that are only a number ("10", "300", "2012", "1917": four tiles, so
  // 72 puzzles showed the same four). Dropped if fewer than 12 exist.
  const numeric = allFilms.filter((t) => /^\d/.test(t));
  if (numeric.length >= 12) add('wordplay-film', 'Films starting with a number', 4, numeric);
  add('wordplay-film', 'Films with a colour in the title', 4, allFilms.filter(hasColour));
  add('wordplay-film', 'Films with an animal in the title', 4, allFilms.filter((t) => ANIMALS.test(t)));
  add('wordplay-film', 'Films numbered as sequels', 4, allFilms.filter((t) => SEQUEL.test(t) && !/^\d/.test(t)));

  // ------------------------------------------------------------ hidden words
  // Drawn from what hides the word well (hidingWord), checked against anything
  // that holds it at all (holdsWord), so "Top Cat" can't sit in another group
  // of a puzzle that has "Films hiding an animal".
  const places = [...new Set(countries.flatMap((c) => [c.name, c.capitals[0]]))];
  for (const [what, parts] of Object.entries(HIDDEN)) {
    const numbers = what === 'a number';
    const rule = { via: 'text', test: (t) => holdsWord(t, parts) };
    for (const [type, label, list] of [
      ['hidden-geo', `Countries and capitals hiding ${what}`, places],
      ['hidden-film', `Films hiding ${what}`, allFilms],
      ['hidden-music', `Hits hiding ${what}`, allHits]
    ]) {
      // One title per hiding word and two per hidden word, so a group is
      // never Batman, Batman Returns, Batman Forever and The Batman, or four
      // songs that all hide "one".
      const words = new Set();
      const perPart = new Map();
      const pool = [];
      for (const t of list) {
        const w = hidingWord(t, parts, numbers);
        const part = w && parts.find((p) => w.includes(p));
        if (!w || words.has(w) || (perPart.get(part) || 0) >= 2) continue;
        words.add(w);
        perPart.set(part, (perPart.get(part) || 0) + 1);
        pool.push(t);
      }
      add(type, label, 4, list.filter((t) => holdsWord(t, parts)), pool, rule);
    }
  }

  // ----------------------------------------------------------------------- tv
  const winsOn = {};
  for (const key of ['emmyDrama', 'emmyComedy', 'globeDrama', 'globeComedy']) {
    for (const list of Object.values(tv[key])) (winsOn[list[0].artist] ||= new Set()).add(list[0].title);
  }
  for (const [net, shows] of Object.entries(winsOn)) {
    if (shows.size >= 4) add('network', `Emmy or Globe winners on ${net}`, 3, [...shows]);
  }
  return groups;
}

/**
 * Looks up a tile's text among the countries (by name) and capitals. Returns
 * a function (text, via) -> countries that text names in that role.
 */
export function countryLookup(countries) {
  const byName = new Map();
  const byCapital = new Map();
  const push = (m, k, c) => m.set(k, [...(m.get(k) || []), c]);
  for (const c of countries) {
    push(byName, norm(c.name), c);
    for (const cap of c.capitals) push(byCapital, norm(cap), c);
  }
  return (text, via) => (via === 'capital' ? byCapital : byName).get(norm(text)) || [];
}

/** Does `text` fit `group`, by its member list or its country rule? */
export function tileFits(group, text, lookup) {
  group.memberKeys ||= new Set(group.members.map(norm));
  if (group.memberKeys.has(norm(text))) return true;
  if (group.rule?.via === 'text') return group.rule.test(text);
  return !!group.rule && lookup(text, group.rule.via).some(group.rule.test);
}

/**
 * How many ways the sixteen tiles split into the puzzle's four groups, each
 * tile into a group it fits, stopping at `limit`. A fair puzzle has exactly
 * one. A red herring (Purple Rain, a Prince hit that also has a colour in the
 * title) fits two groups and is still fair when the count stays at one: the
 * colour group already has its four without it.
 */
export function countSolutions(puzzle, groupsByLabel, lookup, limit = 2) {
  const defs = puzzle.groups.map((g) => groupsByLabel.get(g.label));
  const tiles = puzzle.groups.flatMap((g, own) =>
    g.items.map((t) => puzzle.groups.map((_, i) => i).filter((i) => i === own || (defs[i] && tileFits(defs[i], t, lookup))))
  );
  const room = puzzle.groups.map((g) => g.items.length);
  let found = 0;
  const place = (k) => {
    if (k === tiles.length) return void found++;
    for (const i of tiles[k]) {
      if (!room[i]) continue;
      room[i]--;
      place(k + 1);
      room[i]++;
      if (found >= limit) return;
    }
  };
  place(0);
  return found;
}

/**
 * Is this puzzle fair: one solution, and any tile that fits a second group is
 * the puzzle's named red herring (`puzzle.decoy`), so no overlap gets in by
 * accident?
 */
export function isFair(puzzle, groupsByLabel, lookup) {
  const stray = findOverlaps(puzzle, groupsByLabel, lookup).filter((h) => h.tile !== puzzle.decoy?.tile || h.other !== puzzle.decoy?.also);
  return stray.length === 0 && countSolutions(puzzle, groupsByLabel, lookup) === 1;
}

// Traps: four tiles from four different groups that look like a fifth group
// and are not one (Black, White, Green and Brown as Famous Jacks, Bettys, Evas
// and Gordons). The label is never a group, so the four can't be submitted.
export const TRAPS = {
  colours: ['black', 'white', 'green', 'brown', 'grey', 'gray', 'pink', 'rose', 'blue', 'gold', 'silver'],
  birds: ['swift', 'crowe', 'crow', 'hawk', 'bird', 'finch', 'robin', 'wren', 'swan', 'drake', 'crane', 'jay', 'starling', 'sparrow', 'parrot', 'nightingale', 'martin'],
  jobs: ['cooper', 'smith', 'taylor', 'baker', 'butler', 'carpenter', 'mason', 'turner', 'fisher', 'hunter', 'miller', 'porter', 'cook', 'potter', 'archer', 'weaver', 'shepherd', 'thatcher', 'sawyer', 'barber']
};

/**
 * Every tile that fits a group other than its own, in one puzzle of
 * { groups: [{ label, items }] }. Returns [{ tile, own, other }].
 */
export function findOverlaps(puzzle, groupsByLabel, lookup) {
  const hits = [];
  for (const g of puzzle.groups) {
    for (const item of g.items) {
      for (const o of puzzle.groups) {
        if (o === g) continue;
        const og = groupsByLabel.get(o.label);
        if (og && tileFits(og, item, lookup)) hits.push({ tile: item, own: g.label, other: o.label });
      }
    }
  }
  return hits;
}

/** label -> group, for findOverlaps. Throws on a duplicate label. */
export function indexByLabel(groups) {
  const m = new Map();
  for (const g of groups) {
    if (m.has(g.label)) throw new Error(`two Four by four groups share the label "${g.label}"`);
    m.set(g.label, g);
  }
  return m;
}
