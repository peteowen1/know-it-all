#!/usr/bin/env node
// Gives Four by four puzzles some trickery, in place, after a build or patch:
//   hidden   one group swapped for a hidden-word group ("Films hiding an
//            animal": RAMbo, DOGma, Lawrence of Arabia)
//   trap     a new puzzle where four tiles from four different groups look
//            like a fifth group and are not one (Black, White, Green, Brown as
//            Famous Jacks, Bettys, Evas and Gordons)
//   decoy    one tile swapped for a red herring that also fits a second group
//            (Jordan, a Famous Eddie and a country that borders Iraq) while the
//            puzzle keeps exactly one solution
// The 2026-10-19 playtest found every puzzle the same shape: two "Hits by", a
// "Famous X" and one other, with no traps.
//
// Puzzles a daily round has used or is about to use are left alone, so today's
// puzzle and the last month's archive do not change under anyone. The daily
// index is the game's own (FourByFour.jsx), so the file keeps its length.
// Run from the repo root: `node scripts/fbf-variety.mjs`.

import { readFileSync } from 'node:fs';
import {
  loadSources, buildGroups, countryLookup, indexByLabel, tileFits, isFair, norm, TRAPS, MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL
} from './lib/fbfGroups.mjs';
import { makeRng, hashString, shuffle } from '../src/lib/rng.js';
import { addDaysToKey } from '../src/lib/dates.js';
import { writeData } from './lib/output.mjs';

const FILE = 'src/data/fourbyfour.json';
// A quarter of the puzzles each, where the data allows.
const SHARE = 0.25;
// Days whose puzzle stays as it is: the last month, today and the next two
// (today in Sydney can be tomorrow in UTC).
const KEEP_FROM = '2026-09-19';
const KEEP_TO = '2026-10-21';

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const n = data.puzzles.length;
const src = loadSources();
const groups = buildGroups(src);
const byLabel = indexByLabel(groups);
const lookup = countryLookup(src.countries);
const rng = makeRng(hashString('fbf-variety-v1'));

const dailyIndex = (date) => hashString(`fourbyfour:${date}`) % n;
const kept = new Set();
for (let d = KEEP_FROM; d <= KEEP_TO; d = addDaysToKey(d, 1)) kept.add(dailyIndex(d));

// The same reuse caps as the build: no tile in more than 3 puzzles, no group in more than 5.
const itemUse = new Map();
const labelUse = new Map();
const bump = (m, k, by) => m.set(k, (m.get(k) || 0) + by);
const count = (p, by) => {
  for (const g of p.groups) {
    bump(labelUse, g.label, by);
    for (const t of g.items) bump(itemUse, norm(t), by);
  }
};
data.puzzles.forEach((p) => count(p, 1));
const itemFree = (t) => (itemUse.get(norm(t)) || 0) < MAX_PUZZLES_PER_ITEM;
const labelFree = (l) => (labelUse.get(l) || 0) < MAX_PUZZLES_PER_LABEL;
const fair = (p) => isFair(p, byLabel, lookup);
const tiles = (p) => new Set(p.groups.flatMap((g) => g.items).map(norm));
const sortLevels = (p) => p.groups.sort((a, b) => a.level - b.level);

/** Swap the puzzle's most common kind of group ("Famous X", "Hits by") for a hidden-word group. */
function addHidden(p) {
  const hidden = shuffle(groups.filter((g) => g.type.startsWith('hidden-') && labelFree(g.label)), rng);
  const out = shuffle(p.groups.filter((g) => /^(Famous |Hits by )/.test(g.label)), rng);
  for (const old of out) {
    for (const h of hidden) {
      const rest = tiles({ groups: p.groups.filter((g) => g !== old) });
      const items = shuffle(h.pool.filter((t) => !rest.has(norm(t)) && itemFree(t)), rng).slice(0, 4);
      if (items.length < 4) continue;
      const trial = { groups: p.groups.map((g) => (g === old ? { label: h.label, level: h.level, items } : g)) };
      if (!fair(trial)) continue;
      return trial;
    }
  }
  return null;
}

/** A new puzzle whose four groups each carry one tile of a theme: the trap. */
function makeTrap() {
  for (const [theme, words] of shuffle(Object.entries(TRAPS), rng)) {
    // Theme tiles come from a group's pool, its well-known end: a first-name
    // group's top twelve gave Jared Taylor and Lawrence Sawyer.
    const carriers = [];
    for (const g of groups) {
      if (!labelFree(g.label)) continue;
      for (const t of g.pool) if (words.includes(norm(t)) && itemFree(t)) carriers.push({ g, t });
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      const picked = [];
      for (const c of shuffle(carriers, rng)) {
        if (picked.some((x) => x.g === c.g || norm(x.t) === norm(c.t))) continue;
        picked.push(c);
        if (picked.length === 4) break;
      }
      if (picked.length < 4) break;
      const used = new Set(picked.map((c) => norm(c.t)));
      const built = [];
      for (const { g, t } of picked) {
        // Three more tiles, none of them from the theme, so the trap is
        // exactly four and every tile is in its own group only.
        const more = shuffle(g.pool, rng).filter((x) => {
          const k = norm(x);
          if (used.has(k) || words.includes(k) || !itemFree(x)) return false;
          return picked.every((o) => o.g === g || !tileFits(o.g, x, lookup));
        });
        if (more.length < 3) break;
        for (const x of more.slice(0, 3)) used.add(norm(x));
        built.push({ label: g.label, items: shuffle([t, ...more.slice(0, 3)], rng) });
      }
      if (built.length < 4) continue;
      // Most trap groups are first-name groups, all level 2. Spread them over
      // the four colours so the solved rows still look like four bands.
      const levels = shuffle([1, 2, 3, 4], rng);
      const p = { groups: built.map((g, i) => ({ ...g, level: levels[i] })), trap: { theme, tiles: picked.map((c) => c.t) } };
      if (!fair(p)) continue;
      sortLevels(p);
      return p;
    }
  }
  return null;
}

/**
 * Swap one tile for a red herring: a tile from group A's pool that also fits
 * group B in the same puzzle. B still has its own four, so the puzzle keeps one
 * solution, but a player sees five candidates for B. Not between two first-name
 * groups: two Wilsons are a coin toss, not a clue.
 */
// Every red herring the data offers: x is in A's pool and fits B too,
// recognisably (in B's own pool, or a country B's rule names).
const DECOYS = [];
for (const ga of groups) {
  for (const gb of groups) {
    if (ga === gb || (ga.type === 'first-name' && gb.type === 'first-name') || gb.type.startsWith('hidden-')) continue;
    for (const x of ga.pool) {
      if (!tileFits(gb, x, lookup) || (!gb.pool.some((y) => norm(y) === norm(x)) && !gb.rule)) continue;
      DECOYS.push({ ga, gb, x });
    }
  }
}

function addDecoy(p) {
  const labels = new Set(p.groups.map((g) => g.label));
  // A already in the puzzle; B is in it too, or comes in for one of its
  // "Famous X" or "Hits by" groups.
  for (const { ga, gb, x } of shuffle(DECOYS.filter((d) => labels.has(d.ga.label)), rng)) {
    if (tiles(p).has(norm(x)) || !itemFree(x)) continue;
    const a = p.groups.find((g) => g.label === ga.label);
    const swaps = labels.has(gb.label)
      ? [null]
      : labelFree(gb.label) ? shuffle(p.groups.filter((g) => g !== a && /^(Famous |Hits by )/.test(g.label)), rng) : [];
    for (const old of swaps) {
      let base = p.groups;
      if (old) {
        const rest = tiles({ groups: p.groups.filter((g) => g !== old) });
        const items = shuffle(gb.pool.filter((t) => norm(t) !== norm(x) && !rest.has(norm(t)) && itemFree(t)), rng).slice(0, 4);
        if (items.length < 4) continue;
        base = p.groups.map((g) => (g === old ? { label: gb.label, level: gb.level, items } : g));
      }
      for (const out of shuffle(a.items, rng)) {
        const trial = {
          groups: base.map((g) => (g.label === a.label ? { ...g, items: g.items.map((t) => (t === out ? x : t)) } : g)),
          decoy: { tile: x, also: gb.label }
        };
        if (fair(trial)) return trial;
      }
    }
  }
  return null;
}

const open = shuffle([...Array(n).keys()].filter((i) => !kept.has(i)), rng);
const target = Math.round(n * SHARE);
const done = { trap: 0, hidden: 0, decoy: 0 };
const misses = { trap: 0, hidden: 0, decoy: 0 };
// Each open puzzle gets one kind, taking turns, until each kind reaches its share.
let turn = 0;
for (const i of open) {
  const kinds = ['trap', 'hidden', 'decoy'].filter((k) => done[k] < target);
  if (!kinds.length) break;
  const p = data.puzzles[i];
  if (p.trap || p.decoy || p.groups.some((g) => byLabel.get(g.label)?.type.startsWith('hidden-'))) continue;
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[(turn + k) % kinds.length];
    const next = kind === 'trap' ? makeTrap() : kind === 'hidden' ? addHidden(p) : addDecoy(p);
    if (!next) {
      misses[kind]++;
      continue;
    }
    count(p, -1);
    count(next, 1);
    sortLevels(next);
    data.puzzles[i] = next;
    done[kind]++;
    turn++;
    break;
  }
}

const unfair = data.puzzles.map((p, i) => [i, p]).filter(([, p]) => !fair(p)).map(([i]) => i);
console.log(`${n} puzzles, ${kept.size} kept for recent and coming days; target ${target} of each kind`);
console.log(`added: trap ${done.trap}, hidden ${done.hidden}, decoy ${done.decoy}; no fit found: trap ${misses.trap}, hidden ${misses.hidden}, decoy ${misses.decoy}`);
for (const p of data.puzzles.filter((x) => x.trap).slice(0, 3)) console.log(`  trap ${p.trap.theme}: ${p.trap.tiles.join(', ')} in ${p.groups.map((g) => g.label).join(' / ')}`);
for (const p of data.puzzles.filter((x) => x.decoy).slice(0, 5)) console.log(`  decoy ${p.decoy.tile}: also ${p.decoy.also}`);
if (unfair.length) {
  console.error(`puzzles without exactly one fair solution: ${unfair.join(', ')}`);
  process.exit(1);
}
writeData('fourbyfour.json', data);
