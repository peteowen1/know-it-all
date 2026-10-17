#!/usr/bin/env node
// Repairs src/data/fourbyfour.json in place after a source fix (a wrong
// director credit, a mangled title, a relabelled group), without rebuilding.
//
// A rebuild reshuffles every puzzle, which changes the puzzle on every day,
// today's included. This keeps each puzzle where it is and swaps only the tiles
// that no longer belong to their group, for another member that keeps the
// puzzle free of double-fit tiles (the same check the build and tests use).
// Run from the repo root: `node scripts/patch-fourbyfour.mjs`.

import { readFileSync } from 'node:fs';
import { loadSources, buildGroups, countryLookup, findOverlaps, indexByLabel, tileFits, norm, MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL } from './lib/fbfGroups.mjs';
import { makeRng, hashString, shuffle } from '../src/lib/rng.js';
import { writeData } from './lib/output.mjs';

// Labels renamed in lib/fbfGroups.mjs since the file was built.
const RENAMED = { 'Countries with another country inside': 'Countries whose name hides another country' };

const FILE = 'src/data/fourbyfour.json';
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const src = loadSources();
const byLabel = indexByLabel(buildGroups(src));
const lookup = countryLookup(src.countries);

// The build's reuse caps still hold: no tile in more than 3 puzzles, no group
// in more than 5 (the tests check the shipped file).
const labelUse = new Map();
const itemUse = new Map();
const bump = (m, k, by) => m.set(k, (m.get(k) || 0) + by);
for (const p of data.puzzles) {
  for (const g of p.groups) {
    bump(labelUse, RENAMED[g.label] || g.label, 1);
    for (const t of g.items) bump(itemUse, t.toLowerCase(), 1);
  }
}
const itemFree = (t) => (itemUse.get(t.toLowerCase()) || 0) < MAX_PUZZLES_PER_ITEM;

/** A group with four tiles (same level if possible) that keeps the puzzle free of double fits. */
function replaceGroup(p, old, idx) {
  const rng = makeRng(hashString(`${idx}:${old.label}`));
  const inPuzzle = new Set(p.groups.flatMap((x) => x.items).map(norm));
  const labels = new Set(p.groups.map((x) => x.label));
  // Same level first, then the least-used groups.
  const options = shuffle([...byLabel.values()].filter((d) => !labels.has(d.label) && (labelUse.get(d.label) || 0) < MAX_PUZZLES_PER_LABEL), rng)
    .sort((a, b) => Number(b.level === old.level) - Number(a.level === old.level) || (labelUse.get(a.label) || 0) - (labelUse.get(b.label) || 0));
  for (const d of options) {
    const items = shuffle(d.pool.filter((t) => !inPuzzle.has(norm(t)) && itemFree(t)), rng).slice(0, 4);
    if (items.length < 4) continue;
    const fresh = { label: d.label, level: d.level, items };
    const trial = { groups: p.groups.map((x) => (x === old ? fresh : x)) };
    if (findOverlaps(trial, byLabel, lookup).length) continue;
    bump(labelUse, d.label, 1);
    bump(labelUse, old.label, -1);
    for (const t of items) bump(itemUse, t.toLowerCase(), 1);
    for (const t of old.items) bump(itemUse, t.toLowerCase(), -1);
    return fresh;
  }
  return null;
}

let swapped = 0;
const stuck = [];
data.puzzles.forEach((p, idx) => {
  for (const g of p.groups) g.label = RENAMED[g.label] || g.label;
  for (const g of p.groups) {
    const def = byLabel.get(g.label);
    if (!def) {
      // The group itself is gone (a director left with too few films once a
      // false credit was removed): put in another group of the same level.
      const fresh = replaceGroup(p, g, idx);
      if (fresh) {
        console.log(`puzzle ${idx}: group "${g.label}" -> "${fresh.label}": ${fresh.items.join(', ')}`);
        Object.assign(g, fresh);
        swapped += 4;
      } else stuck.push(`puzzle ${idx}: no group "${g.label}" any more, and no replacement`);
      continue;
    }
    g.items = g.items.map((item) => {
      if (tileFits(def, item, lookup)) return item;
      const inPuzzle = new Set(p.groups.flatMap((x) => x.items).map(norm));
      // A corrected spelling of the same tile ("Birdman or" -> "Birdman") first.
      const pool = shuffle(def.pool, makeRng(hashString(`${idx}:${g.label}:${item}`)));
      pool.sort((a, b) => Number(norm(item).startsWith(norm(b))) - Number(norm(item).startsWith(norm(a))));
      for (const cand of pool) {
        if (inPuzzle.has(norm(cand)) || !itemFree(cand)) continue;
        const trial = { groups: p.groups.map((x) => (x === g ? { ...x, items: x.items.map((t) => (t === item ? cand : t)) } : x)) };
        if (findOverlaps(trial, byLabel, lookup).length) continue;
        console.log(`puzzle ${idx} [${g.label}]: ${item} -> ${cand}`);
        swapped++;
        bump(itemUse, item.toLowerCase(), -1);
        bump(itemUse, cand.toLowerCase(), 1);
        return cand;
      }
      stuck.push(`puzzle ${idx} [${g.label}]: no replacement for ${item}`);
      return item;
    });
  }
  // A tile with no free replacement: swap its whole group instead.
  for (const g of p.groups) {
    const def = byLabel.get(g.label);
    if (!def || g.items.every((t) => tileFits(def, t, lookup))) continue;
    const fresh = replaceGroup(p, g, idx);
    if (!fresh) continue;
    console.log(`puzzle ${idx}: group "${g.label}" -> "${fresh.label}": ${fresh.items.join(', ')}`);
    Object.assign(g, fresh);
    swapped += 4;
    for (let i = stuck.length - 1; i >= 0; i--) if (stuck[i].startsWith(`puzzle ${idx} [`)) stuck.splice(i, 1);
  }
  // Groups are stored easiest first; the game reveals them in this order.
  p.groups.sort((a, b) => a.level - b.level);
});

const overlaps = data.puzzles.flatMap((p, idx) => findOverlaps(p, byLabel, lookup).map((o) => `puzzle ${idx}: ${o.tile} fits ${o.own} and ${o.other}`));
console.log(`swapped ${swapped} tiles; stuck ${stuck.length}; overlaps ${overlaps.length}`);
for (const line of [...stuck, ...overlaps]) console.log('  ' + line);
if (stuck.length || overlaps.length) process.exit(1);
writeData('fourbyfour.json', data);
