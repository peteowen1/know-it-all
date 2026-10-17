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
// answers. Group definitions and the overlap check live in lib/fbfGroups.mjs so
// the tests run the very same check on the shipped file.
//
// Reuse is capped (MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL): before the
// caps "Singapore" appeared in 49 puzzles, "Vatican City" in 45, and the four
// number-title films in 72. The build reads only files already in src/data, so
// it needs no network.
//
// Built offline rather than in the browser so the game stays a few kilobytes
// and so the puzzles can be read and checked before they ship.

import { makeRng, hashString, shuffle } from '../src/lib/rng.js';
import { loadSources, buildGroups, countryLookup, findOverlaps, indexByLabel, tileFits, norm, MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL } from './lib/fbfGroups.mjs';
import { writeData } from './lib/output.mjs';

// ------------------------------------------------------------------ build
const COUNT = 400;

const src = loadSources();
const groups = buildGroups(src);
const byLabel = indexByLabel(groups);
const lookup = countryLookup(src.countries);
const puzzles = [];
const seen = new Set();
const itemUse = new Map();
const labelUse = new Map();
const rand = makeRng(hashString('fourbyfour-v1'));
// A group is open while it is under its label cap and still has four tiles
// that are under their own cap. Recomputed after every puzzle that is kept.
const exhausted = new Set();
const refreshExhausted = () => {
  exhausted.clear();
  groups.forEach((g, i) => {
    if ((labelUse.get(g.label) || 0) >= MAX_PUZZLES_PER_LABEL) exhausted.add(i);
    else if (g.pool.filter((m) => (itemUse.get(norm(m)) || 0) < MAX_PUZZLES_PER_ITEM).length < 4) exhausted.add(i);
  });
};
const open = (i) => !exhausted.has(i);
const byType = new Map();
groups.forEach((g, i) => byType.set(g.type, [...(byType.get(g.type) || []), i]));
const pickFrom = (t, already) => {
  const pickable = byType.get(t).filter((i) => open(i) && !already.includes(i));
  return pickable[Math.floor(rand() * pickable.length)];
};
let tries = 0;
while (puzzles.length < COUNT && tries < 200000) {
  tries++;
  // Four different types, so a puzzle mixes geography, music, film and people
  // rather than being four flavours of one thing. Types are drawn evenly, not
  // in proportion to how many groups they have: with 250 artist and name
  // groups against a handful of wordplay ones, drawing groups at random almost
  // never picked a wordplay group, and the trick group is what makes the game.
  // A type whose groups have all hit a cap drops out. Once fewer than four
  // types are left a puzzle may take two groups of one type ("Hits by A" next
  // to "Hits by B"), which the overlap check already handles.
  const types = [...byType.keys()].filter((t) => byType.get(t).some(open));
  const perType = types.length >= 4 ? 1 : 2;
  if (types.reduce((n, t) => n + Math.min(perType, byType.get(t).filter(open).length), 0) < 4) break;
  const picked = [];
  const taken = (t) => picked.filter((i) => groups[i].type === t).length;
  for (const t of shuffle(types, rand).slice(0, 4)) picked.push(pickFrom(t, picked));
  while (picked.length < 4) {
    const more = types.filter((t) => taken(t) < perType && byType.get(t).some((i) => open(i) && !picked.includes(i)));
    picked.push(pickFrom(more[Math.floor(rand() * more.length)], picked));
  }
  const levels = new Set(picked.map((i) => groups[i].level));
  if (levels.size < 3) continue; // want a spread from easy to hard

  const tiles = [];
  let ok = true;
  for (const i of picked) {
    const within = new Set();
    const choices = shuffle(groups[i].pool, rand).filter((m) => {
      const k = norm(m);
      // Distinct within its own group: "Wild, Wild West" (1988) and "Wild
      // Wild West" (1999) are different songs but identical tiles.
      if (within.has(k)) return false;
      within.add(k);
      if ((itemUse.get(k) || 0) >= MAX_PUZZLES_PER_ITEM) return false;
      // Exactly one group: this tile must not fit any other picked group,
      // by its member list or by the country it names.
      return picked.every((j) => j === i || !tileFits(groups[j], m, lookup)) && !tiles.some((t) => norm(t.text) === k);
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
  for (const t of tiles) itemUse.set(norm(t.text), (itemUse.get(norm(t.text)) || 0) + 1);
  for (const i of picked) labelUse.set(groups[i].label, (labelUse.get(groups[i].label) || 0) + 1);
  refreshExhausted();
  puzzles.push({
    groups: picked
      .map((i) => ({ label: groups[i].label, level: groups[i].level, items: tiles.filter((t) => t.group === i).map((t) => t.text) }))
      .sort((a, b) => a.level - b.level)
  });
}

// Belt and braces: the checker the tests use, run on what was just built.
// Order is by type draw, so wordplay puzzles would bunch together: shuffle.
puzzles.splice(0, puzzles.length, ...shuffle(puzzles, rand));
const bad = puzzles.map((p, i) => [i, findOverlaps(p, byLabel, lookup)]).filter(([, h]) => h.length);
if (bad.length) throw new Error(`puzzle ${bad[0][0]} has a tile in two groups: ${JSON.stringify(bad[0][1][0])}`);

console.log(`candidate groups: ${groups.length} (${[...byType].map(([t, g]) => `${t} ${g.length}`).join(', ')})`);
console.log(`puzzles: ${puzzles.length} after ${tries} tries`);
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(', ');
console.log(`most reused tiles: ${top(itemUse)}; most reused groups: ${top(labelUse)}`);
for (const p of puzzles.slice(0, 3)) {
  console.log('\n' + p.groups.map((g) => `  [${g.level}] ${g.label}: ${g.items.join(', ')}`).join('\n'));
}
if (puzzles.length < 100) throw new Error('too few valid puzzles');
writeData('fourbyfour.json', { puzzles });
