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
//   gap      one group swapped for a fill-the-gap group ("Red ___": Herring,
//            Carpet, Card, Tape), with a famous surname that also fits ("Rose",
//            a Famous Justin) as its red herring where the data allows
// The 2026-10-19 playtest found every puzzle the same shape: two "Hits by", a
// "Famous X" and one other, with no traps.
//
// Puzzles a daily round has used or is about to use are left alone, so today's
// puzzle and the last month's archive do not change under anyone. The daily
// index is the game's own (FourByFour.jsx), so the file keeps its length.
// Puzzles that already have a trick keep it, and each kind counts what the
// file already holds towards its share, so a rerun only tops up.
// Run from the repo root: `node scripts/fbf-variety.mjs [kind ...]` (all kinds
// by default; `gap` alone added the fill-the-gap groups on 2026-10-20, and
// topped them up to 30 after the phrase list doubled the same day).

import { readFileSync } from 'node:fs';
import {
  loadSources, buildGroups, countryLookup, indexByLabel, tileFits, isFair, norm, cleanTitle, hidingWord, HIDDEN, TRAPS, GAP_HERRINGS, MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL
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
const KEEP_TO = '2026-10-23';

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
// A gap's red herring surname in at most two puzzles, so the same few people
// (Sally Field, Victoria Wood) are not the herring every time.
const MAX_PER_HERRING = 2;
const herringUse = new Map();
for (const p of data.puzzles) if (p.decoy && /___/.test(p.decoy.also)) bump(herringUse, norm(p.decoy.tile), 1);
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

/**
 * Swap a "Famous X" or "Hits by" group for a fill-the-gap group. First tries a
 * red herring: a famous surname that also completes the phrase, brought in
 * with its first-name group (or swapped into it, if the puzzle has it). With
 * `herring` false, a plain gap group is enough.
 */
function addGap(p, herring = true) {
  const swappable = (q, keep) => shuffle(q.groups.filter((g) => g !== keep && /^(Famous |Hits by )/.test(g.label)), rng);
  const fill = (q, old, g, also = []) => {
    const rest = tiles({ groups: q.groups.filter((x) => x !== old) });
    const items = shuffle(g.pool.filter((t) => !rest.has(norm(t)) && !also.includes(norm(t)) && itemFree(t)), rng).slice(0, 4 - also.length);
    return items.length < 4 - also.length ? null : q.groups.map((x) => (x === old ? { label: g.label, level: g.level, items: [...also.map((a) => g.pool.find((t) => norm(t) === a)), ...items] } : x));
  };
  for (const gap of shuffle(groups.filter((g) => g.type === 'gap' && labelFree(g.label)), rng)) {
    for (const old of swappable(p)) {
      const withGap = fill(p, old, gap);
      if (!withGap) continue;
      const base = { groups: withGap };
      // The herring: a surname of the gap's own list, from a first-name group.
      const herrings = !herring ? [] : gap.members.filter((w) => GAP_HERRINGS.has(norm(w)) && itemFree(w) && (herringUse.get(norm(w)) || 0) < MAX_PER_HERRING && !tiles(base).has(norm(w)));
      for (const w of shuffle(herrings, rng)) {
        for (const owner of shuffle(groups.filter((g) => g.type === 'first-name' && g.pool.some((t) => norm(t) === norm(w))), rng)) {
          const there = base.groups.find((g) => g.label === owner.label);
          const options = there
            ? there.items.map((out) => base.groups.map((g) => (g === there ? { ...g, items: g.items.map((t) => (t === out ? owner.pool.find((x) => norm(x) === norm(w)) : t)) } : g)))
            : labelFree(owner.label) ? swappable(base, base.groups.find((g) => g.label === gap.label)).map((o) => fill(base, o, owner, [norm(w)])).filter(Boolean) : [];
          for (const groupsTried of options) {
            const trial = { groups: groupsTried, decoy: { tile: owner.pool.find((x) => norm(x) === norm(w)), also: gap.label } };
            if (fair(trial)) {
              bump(herringUse, norm(w), 1);
              return trial;
            }
          }
        }
      }
      if (!herring && fair(base)) return base;
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
// Which chart groups each recording or film belongs to, so a red herring is
// one song in two groups, not two songs that share a title: Bruno Mars's
// "Just the Way You Are" is not Billy Joel's (review, 2026-10-19).
const decade = (y) => `${Math.floor(y / 10) * 10}s`;
const records = [];
for (const [y, list] of Object.entries(src.music)) {
  list.slice(0, 40).forEach((s, i) => {
    const labels = new Set((s.artists || [s.artist]).map((a) => `Hits by ${a}`));
    if (i === 0) labels.add(`Billboard year-end #1s, ${decade(y)}`);
    records.push({ title: norm(cleanTitle(s.title)), labels });
  });
}
for (const [chart, best] of [[src.films.boxOffice, false], [src.films.bestPicture, true]]) {
  for (const [y, list] of Object.entries(chart)) {
    list.forEach((f, i) => {
      const labels = new Set((f.artists || [f.artist]).map((d) => `Directed by ${d}`));
      if (best && i === 0) labels.add(`Best Picture winners, ${decade(y)}`);
      records.push({ title: norm(cleanTitle(f.title)), labels });
    });
  }
}
const CHART = new Set(['artist', 'number-ones', 'director', 'best-picture']);
const oneThing = (ga, gb, x) => {
  const need = [ga, gb].filter((g) => CHART.has(g.type)).map((g) => g.label);
  return need.length < 2 || records.some((r) => r.title === norm(x) && need.every((l) => r.labels.has(l)));
};

// A tile that plainly hides a hidden-word group's word, as a red herring for
// it: in one word where a player will see it (Moscow), or across a space
// ("How Low" hides an owl). Not one lost mid-word: "Education" holds a cat
// that nobody would offer.
function plainlyHides(gb, x) {
  const what = gb.label.split(' hiding ')[1];
  const parts = HIDDEN[what];
  const w = hidingWord(x, parts, what === 'a number');
  if (w) return parts.find((p) => w.includes(p));
  const words = norm(x).split(' ');
  if (words.some((w) => parts.some((p) => w.includes(p)))) return null;
  return parts.find((p) => words.join('').includes(p)) ?? null;
}

// Every red herring the data offers: x is in A's pool and fits B too,
// recognisably (in B's own pool, a country B's rule names, or a word B's
// tiles hide, among its own kind). Not into a landlocked group: its loose rule takes Chad for
// "Landlocked in Europe", right for keeping tiles apart and wrong to tell a
// player.
const DECOYS = [];
for (const ga of groups) {
  for (const gb of groups) {
    if (ga === gb || (ga.type === 'first-name' && gb.type === 'first-name') || gb.type === 'landlocked') continue;
    const hidden = gb.type.startsWith('hidden-');
    for (const x of ga.pool) {
      if (!tileFits(gb, x, lookup)) continue;
      // For a hidden-word group, the same kind of thing too: a hit for "Hits
      // hiding", not the TV show China Beach.
      const hides = hidden && gb.members.some((y) => norm(y) === norm(x)) ? plainlyHides(gb, x) : null;
      if (hidden ? !hides : !gb.pool.some((y) => norm(y) === norm(x)) && !gb.rule) continue;
      if (!oneThing(ga, gb, x)) continue;
      DECOYS.push({ ga, gb, x, hides });
    }
  }
}

function addDecoy(p, only = () => true) {
  const labels = new Set(p.groups.map((g) => g.label));
  // A already in the puzzle; B is in it too, or comes in for one of its
  // "Famous X" or "Hits by" groups.
  for (const { ga, gb, x, hides } of shuffle(DECOYS.filter((d) => labels.has(d.ga.label) && only(d)), rng)) {
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
          // The hidden word itself, for the end screen: "heel" in The Elephant Man.
          decoy: { tile: x, also: gb.label, ...(hides && { hides }) }
        };
        if (fair(trial)) return trial;
      }
    }
  }
  return null;
}

const open = shuffle([...Array(n).keys()].filter((i) => !kept.has(i)), rng);
const KINDS = process.argv.length > 2 ? process.argv.slice(2) : ['trap', 'hidden', 'decoy', 'gap'];
// A gap group gives itself away once seen, so fewer of them: about one in eight
// (one in twelve until the phrase list doubled, 2026-10-20).
const targets = { trap: Math.round(n * SHARE), hidden: Math.round(n * SHARE), decoy: Math.round(n * SHARE), gap: Math.round(n / 8) };
const kindOf = (p) => {
  const types = p.groups.map((g) => byLabel.get(g.label)?.type || '');
  return p.trap ? 'trap' : types.includes('gap') ? 'gap' : types.some((t) => t.startsWith('hidden-')) ? 'hidden' : p.decoy ? 'decoy' : null;
};
const done = { trap: 0, hidden: 0, decoy: 0, gap: 0 };
for (const p of data.puzzles) if (kindOf(p)) done[kindOf(p)]++;
const before = { ...done };
const misses = { trap: 0, hidden: 0, decoy: 0, gap: 0 };
// Each open puzzle gets one kind, taking turns, until each kind reaches its share.
let turn = 0;
for (const i of open) {
  const kinds = KINDS.filter((k) => done[k] < targets[k]);
  if (!kinds.length) break;
  const p = data.puzzles[i];
  if (kindOf(p)) continue;
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[(turn + k) % kinds.length];
    const next = kind === 'trap' ? makeTrap() : kind === 'hidden' ? addHidden(p) : kind === 'gap' ? addGap(p) || addGap(p, false) : addDecoy(p);
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

// A hidden-word puzzle can take a red herring for its own hidden word too: a
// fifth tile that also hides it ("How Low" hides an owl, Pete 2026-10-19).
let hiddenDecoys = 0;
for (const i of KINDS.includes('hidden') ? open : []) {
  const p = data.puzzles[i];
  const h = p.groups.find((g) => byLabel.get(g.label)?.type.startsWith('hidden-'));
  if (!h || p.decoy || p.trap) continue;
  const next = addDecoy(p, (d) => d.gb.label === h.label);
  if (!next) continue;
  count(p, -1);
  count(next, 1);
  sortLevels(next);
  data.puzzles[i] = next;
  hiddenDecoys++;
}
console.log(`red herrings for a hidden word: ${hiddenDecoys}`);

// The word each tile of a hidden-word group hides, for the screen that shows
// the solved group: "Ramallah (ram)". The 2026-10-20 playtest found the
// hidden words were never shown. Display only, so it is set on every puzzle,
// the kept days too, and a rerun sets the same thing.
for (const p of data.puzzles) {
  for (const g of p.groups) {
    if (!byLabel.get(g.label)?.type.startsWith('hidden-')) continue;
    const parts = HIDDEN[g.label.replace(/^.* hiding /, '')];
    // Every part in the title, spaces dropped ("How Low" hides an owl), less
    // any inside a longer one found: Slumdog Millionaire is "dog, lion".
    g.hides = g.items.map((t) => {
      const found = parts.filter((w) => norm(t).replace(/ /g, '').includes(w));
      return found.filter((w) => !found.some((x) => x !== w && x.includes(w))).join(', ') || null;
    });
  }
}

const unfair = data.puzzles.map((p, i) => [i, p]).filter(([, p]) => !fair(p)).map(([i]) => i);
console.log(`${n} puzzles, ${kept.size} kept for recent and coming days; targets ${JSON.stringify(targets)}`);
for (const k of KINDS) console.log(`  ${k}: ${before[k]} already, ${done[k] - before[k]} added, no fit found ${misses[k]} times`);
for (const p of data.puzzles.filter((x) => kindOf(x) === 'gap').slice(0, 8)) {
  const g = p.groups.find((x) => byLabel.get(x.label)?.type === 'gap');
  console.log(`  gap ${g.label}: ${g.items.join(', ')}${p.decoy ? ` (red herring ${p.decoy.tile})` : ''}`);
}
for (const p of data.puzzles.filter((x) => x.trap).slice(0, 3)) console.log(`  trap ${p.trap.theme}: ${p.trap.tiles.join(', ')} in ${p.groups.map((g) => g.label).join(' / ')}`);
for (const p of data.puzzles.filter((x) => x.decoy).slice(0, 5)) console.log(`  decoy ${p.decoy.tile}: also ${p.decoy.also}`);
if (unfair.length) {
  console.error(`puzzles without exactly one fair solution: ${unfair.join(', ')}`);
  process.exit(1);
}
writeData('fourbyfour.json', data);
