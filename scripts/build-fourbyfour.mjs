#!/usr/bin/env node
// Builds src/data/fourbyfour.json: Connections-style puzzles made from the
// data the other games already use. Run with `npm run data:fourbyfour` after
// any of the source files change.
//
// A puzzle is four groups of four. Every group comes from a generator
// ("hits by Madonna", "capitals in South America", "famous Toms"), and each
// generator knows its FULL membership, not just the four tiles shown. A
// puzzle is kept only if every tile belongs to exactly one of its four groups'
// full memberships: "Jordan" may appear as a Michael or as a country, but
// never in a puzzle that has both groups, because then it has two right
// answers.
//
// Built offline rather than in the browser so the game stays a few kilobytes
// and so the puzzles can be read and checked before they ship.

import { readFileSync, writeFileSync } from 'node:fs';
import { makeRng, hashString, shuffle } from '../src/lib/rng.js';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const countries = load('src/data/countries.json').countries.filter((c) => c.sovereign);
const famous = load('src/data/famous.json').names;
const music = load('src/data/charts/music.json').years;
const films = load('src/data/charts/films.json');
const tv = load('src/data/charts/tv.json');

const COUNT = 400;
const MAX_LEN = 26; // longer tiles do not fit a phone-width grid
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fits = (s) => s.length <= MAX_LEN;
const cleanTitle = (t) => t.split(' / ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * Every candidate group: { type, label, level, members, pool }.
 *   members  the full set, which the overlap check tests against
 *   pool     the recognisable part tiles are drawn from (default: all of it).
 *            "Famous Ruths" drawn from the top 12 gave Ruth Codd; drawn from
 *            the top 6 it gives names people know.
 *   level    difficulty, 1 (easy, yellow) to 4 (hard, purple)
 */
const groups = [];
const add = (type, label, level, members, pool = members) => {
  const m = [...new Set(members.filter(Boolean))];
  const pl = [...new Set(pool.filter(Boolean))].filter(fits);
  if (pl.length >= 4) groups.push({ type, label, level, members: m, pool: pl });
};

// ------------------------------------------------------------------ geography
const bySub = {};
for (const c of countries) (bySub[c.subregion] ||= []).push(c);
for (const [sub, list] of Object.entries(bySub)) {
  add('capitals', `Capitals in ${sub}`, 1, list.map((c) => c.capitals[0]));
}
const byCode3 = new Map(countries.map((c) => [c.iso3, c]));
for (const c of countries) {
  const n = c.borders.map((b) => byCode3.get(b)?.name).filter(Boolean);
  if (n.length >= 5) add('borders', `Borders ${c.name}`, 2, n);
}
const byRegion = {};
for (const c of countries) (byRegion[c.region] ||= []).push(c);
for (const [region, list] of Object.entries(byRegion)) {
  add('landlocked', `Landlocked in ${region}`, 3, list.filter((c) => c.landlocked).map((c) => c.name));
}
add('wordplay', 'Countries ending in -land', 2, countries.filter((c) => /land$/i.test(c.name)).map((c) => c.name));
add('wordplay', 'Countries ending in -stan', 1, countries.filter((c) => /stan$/i.test(c.name)).map((c) => c.name));
add('wordplay', 'Countries with "Guinea" in the name', 3, countries.filter((c) => /Guinea/.test(c.name)).map((c) => c.name));
// Capital named after its country: Mexico City, Kuwait City, Singapore, Tunis.
add(
  'wordplay',
  'Capital shares the country\'s name',
  4,
  countries.filter((c) => norm(c.capitals[0] || '').startsWith(norm(c.name).slice(0, 5))).map((c) => c.name)
);

// ----------------------------------------------------------------- people
// "Famous Toms" shown as surnames only: Cruise, Hanks, Hardy, Holland.
// Names that are usually a family name written first (Lee Jung-jae, Kim
// Jong-un) are skipped: "Famous Lees: Sun-kyun, Jung-jae" is not a first-name
// group at all.
const FAMILY_NAME_FIRST = new Set(['Lee', 'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Ma', 'Nguyen']);
for (const n of famous) {
  if (FAMILY_NAME_FIRST.has(n.first)) continue;
  const modern = n.people.filter((p) => p.born == null || p.born >= 1940);
  const surnames = modern.map((p) => p.rest).filter((r) => !/\s/.test(r) && r.length >= 3);
  // Checked against everyone on the list, drawn from the six best known.
  if (surnames.length >= 8) add('first-name', `Famous ${n.first}s`, 2, surnames, surnames.slice(0, 6));
}

// ------------------------------------------------------------------ music
const hitsBy = {};
for (const list of Object.values(music)) {
  for (const s of list.slice(0, 40)) {
    for (const a of s.artists || [s.artist]) (hitsBy[a] ||= new Set()).add(cleanTitle(s.title));
  }
}
for (const [a, songs] of Object.entries(hitsBy)) {
  if (songs.size >= 5) add('artist', `Hits by ${a}`, songs.size >= 8 ? 1 : 2, [...songs]);
}
for (let d = 1960; d <= 2020; d += 10) {
  const ones = Object.entries(music).filter(([y]) => y >= d && y < d + 10).map(([, l]) => cleanTitle(l[0].title));
  add('number-ones', `Billboard year-end #1s, ${d}s`, 3, ones);
}
// "Mony Mony", "Bye Bye Bye", "Bills, Bills, Bills".
const allHits = [...new Set(Object.values(music).flatMap((l) => l.slice(0, 40).map((s) => cleanTitle(s.title))))];
add('wordplay-music', 'Hits with a repeated word', 4, allHits.filter((t) => /\b(\w{2,})\b[ ,!]+\1\b/i.test(t)));

// ------------------------------------------------------------------ films
const filmsBy = {};
for (const chart of [films.boxOffice, films.bestPicture]) {
  for (const list of Object.values(chart)) {
    for (const f of list) for (const d of f.artists || [f.artist]) (filmsBy[d] ||= new Set()).add(cleanTitle(f.title));
  }
}
for (const [d, set] of Object.entries(filmsBy)) {
  if (d !== 'Unknown director' && set.size >= 5) add('director', `Directed by ${d}`, 2, [...set]);
}
for (let d = 1930; d <= 2020; d += 10) {
  const wins = Object.entries(films.bestPicture).filter(([y]) => y >= d && y < d + 10).map(([, l]) => cleanTitle(l[0].title));
  add('best-picture', `Best Picture winners, ${d}s`, 3, wins);
}
const allFilms = [...new Set([films.boxOffice, films.bestPicture].flatMap((c) => Object.values(c).flat().map((f) => cleanTitle(f.title))))];
add('wordplay-film', 'Films with a number for a title', 4, allFilms.filter((t) => /^\d+$/.test(t)));

// --------------------------------------------------------------------- tv
const winsOn = {};
for (const key of ['emmyDrama', 'emmyComedy', 'globeDrama', 'globeComedy']) {
  for (const list of Object.values(tv[key])) (winsOn[list[0].artist] ||= new Set()).add(list[0].title);
}
for (const [net, shows] of Object.entries(winsOn)) {
  if (shows.size >= 4) add('network', `Emmy or Globe winners on ${net}`, 3, [...shows]);
}

// ------------------------------------------------------------------ build
const memberSets = groups.map((g) => new Set(g.members.map(norm)));
const puzzles = [];
const seen = new Set();
const rand = makeRng(hashString('fourbyfour-v1'));
let tries = 0;
while (puzzles.length < COUNT && tries < 200000) {
  tries++;
  // Four different types, so a puzzle mixes geography, music, film and people
  // rather than being four flavours of one thing.
  const picked = [];
  const types = new Set();
  for (const i of shuffle(groups.map((_, i) => i), rand)) {
    if (types.has(groups[i].type)) continue;
    picked.push(i);
    types.add(groups[i].type);
    if (picked.length === 4) break;
  }
  if (picked.length < 4) continue;
  const levels = new Set(picked.map((i) => groups[i].level));
  if (levels.size < 3) continue; // want a spread from easy to hard
  // Wordplay groups are few (a handful against hundreds of artist and name
  // groups), so random draws almost never pick one. Force one into every
  // other puzzle, since the trick group is what makes the game.
  if (puzzles.length % 2 === 0 && !picked.some((i) => groups[i].level === 4)) continue;

  const tiles = [];
  let ok = true;
  for (const i of picked) {
    const within = new Set();
    const choices = shuffle(groups[i].pool, rand).filter((m) => {
      // Exactly one group: this tile must not belong to any other picked group.
      const k = norm(m);
      // Also distinct within its own group: "Wild, Wild West" (1988) and "Wild
      // Wild West" (1999) are different songs but identical tiles.
      if (within.has(k)) return false;
      within.add(k);
      return picked.every((j) => j === i || !memberSets[j].has(k)) && !tiles.some((t) => norm(t.text) === k);
    });
    if (choices.length < 4) {
      ok = false;
      break;
    }
    for (const text of choices.slice(0, 4)) tiles.push({ text, group: i });
  }
  if (!ok) continue;
  const key = picked.slice().sort().join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  puzzles.push({
    groups: picked
      .map((i) => ({ label: groups[i].label, level: groups[i].level, items: tiles.filter((t) => t.group === i).map((t) => t.text) }))
      .sort((a, b) => a.level - b.level)
  });
}

const byType = {};
for (const g of groups) byType[g.type] = (byType[g.type] || 0) + 1;
console.log(`candidate groups: ${groups.length} (${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(', ')})`);
console.log(`puzzles: ${puzzles.length} after ${tries} tries`);
for (const p of puzzles.slice(0, 3)) {
  console.log('\n' + p.groups.map((g) => `  [${g.level}] ${g.label}: ${g.items.join(', ')}`).join('\n'));
}
if (puzzles.length < 100) throw new Error('too few valid puzzles');
writeFileSync('src/data/fourbyfour.json', JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), puzzles }));
console.log('\nwrote src/data/fourbyfour.json');
