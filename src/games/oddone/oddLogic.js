// Pure logic for Odd one out: three answers that share a category and one that
// does not. Built from the Obscure-est categories (src/data/obscure.json), so it
// needs no data of its own. No React, no JSON import: scripts/test-odd-one.mjs
// runs it on the real file.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';

export const ROUNDS = 5;

// Category ids share a prefix by kind ("borders-CN", "songs-Madonna"): the odd
// one comes from a sibling of the same kind, so it looks like it belongs.
// Country categories count as one family (a landlocked round can take its odd
// one from "A country in Western Africa"); capitals stay apart, being cities.
export const family = (id) => {
  const f = id.split('-')[0];
  return f === 'borders' || f === 'in' || f === 'landlocked' ? 'country' : f;
};

// "A famous Tom" shows full names, so the odd one would be plain to see.
export const SKIP_FAMILIES = new Set(['name']);

// Only well-known answers (score 1 is the most obvious, 100 the deepest cut),
// so the round is about spotting the link, not knowing an obscure B-side.
export const WELL_KNOWN = 60;
const wellKnown = (category) => category.answers.filter((a) => a.score <= WELL_KNOWN);

// Countries (and their capitals) that the UN subregions put somewhere many
// people would not: Iran in Southern Asia (most say the Middle East), Harare
// in Eastern Africa (most say Southern Africa), Hungary in Eastern Europe
// (Central). In a region round they could make a second answer right, so
// region rounds leave them out, as one of the three and as the odd one. The
// 2026-10-22 count: 230 of 1,270 region rounds in 2,000 games turned on one.
// Typing games keep them: there an arguable answer is only a missed chance.
export const ARGUABLE_REGION = new Set([
  'Iran', 'Tehran', 'Afghanistan', 'Kabul', 'Mexico', 'Mexico City', 'Sudan', 'Khartoum',
  'Angola', 'Luanda', 'Mozambique', 'Maputo', 'Madagascar', 'Antananarivo', 'Malawi', 'Lilongwe',
  'Zambia', 'Lusaka', 'Zimbabwe', 'Harare', 'Czechia', 'Prague', 'Hungary', 'Budapest',
  'Poland', 'Warsaw', 'Austria', 'Vienna', 'Slovenia', 'Ljubljana', 'Croatia', 'Zagreb',
  'Serbia', 'Belgrade', 'Bosnia and Herzegovina', 'Sarajevo', 'Albania', 'Tirana',
  'North Macedonia', 'Skopje', 'United Kingdom', 'London', 'Ireland', 'Dublin', 'Azerbaijan', 'Baku',
]);
const isRegionRound = (category) => /^(in|cap)-/.test(category.id);

// Every name each category accepts, normalised once: membership is checked
// against all ~500 categories for every candidate round.
const memberCache = new WeakMap();
function members(category) {
  let set = memberCache.get(category);
  if (!set) {
    set = new Set(category.answers.flatMap((a) => [a.text, ...(a.accept || [])].map(normalise)));
    memberCache.set(category, set);
  }
  return set;
}
const inCategory = (category, text) => members(category).has(normalise(text));

/**
 * Would some OTHER category make a different trio, one that includes the odd
 * answer? Then the player could fairly pick a different odd one out. Example:
 * three countries bordering China plus Bangladesh is unfair if three of the
 * four, Bangladesh among them, also border India.
 */
export function hasSecondTrio(categories, target, items, odd) {
  return categories.some(
    (c) => c.id !== target.id && inCategory(c, odd) && items.filter((x) => inCategory(c, x)).length >= 3
  );
}

/**
 * How far an odd one sits from the other three, in steps; 0 is closest. A
 * country or capital on another continent is 1 step (the 2026-10-19 playtest
 * found 79% of geography odd ones on another continent: France's neighbours
 * and Sudan). A song or film is a step per full ten years from the three's
 * middle year (59% of song odd ones were over 15 years away). Answers without
 * the data are 0 steps, as before.
 */
export function distance(three, odd) {
  if (odd.region && three.every((a) => a.region)) {
    const counts = {};
    for (const a of three) counts[a.region] = (counts[a.region] || 0) + 1;
    const main = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    return odd.region === main ? 0 : 1;
  }
  if (odd.year && three.every((a) => a.year)) {
    const middle = three.map((a) => a.year).sort((x, y) => x - y)[1];
    return Math.floor(Math.abs(odd.year - middle) / 10);
  }
  return 0;
}

/**
 * `count` rounds, kinds varied. Each round: three well-known answers from one
 * category, one well-known answer from a sibling category that is not in the
 * first and is as close to the three as any (see `distance`), checked so that
 * no other category groups a different three.
 * Returns [{ id, link, oddLink, odd, options, oddIndex }].
 */
export function buildOddRounds(categories, { seed = Date.now(), count = ROUNDS } = {}) {
  const rand = makeRng(hashString(`oddone:${seed}`));
  const usable = categories.filter((c) => !SKIP_FAMILIES.has(family(c.id)));
  const kinds = new Set(usable.map((c) => c.kind));
  const rounds = [];
  const usedKinds = [];
  for (const cat of shuffle(usable, rand)) {
    if (rounds.length === count) break;
    // No kind twice until every kind has had a turn.
    if (usedKinds.includes(cat.kind) && new Set(usedKinds).size < kinds.size) continue;
    const region = isRegionRound(cat);
    const fair = (a) => !region || !ARGUABLE_REGION.has(a.text);
    const pool = wellKnown(cat).filter(fair);
    if (pool.length < 3) continue;
    const picks = shuffle(pool, rand).slice(0, 3);
    const three = picks.map((a) => a.text);
    if (new Set(three.map(normalise)).size < 3) continue;
    // Every candidate from every sibling, closest first, in a seeded order
    // within each step.
    const candidates = shuffle(usable.filter((c) => c.id !== cat.id && family(c.id) === family(cat.id)), rand)
      .flatMap((sib) =>
        shuffle(wellKnown(sib), rand)
          .filter((a) => fair(a) && !inCategory(cat, a.text) && !three.some((t) => normalise(t) === normalise(a.text)))
          .map((a) => ({ sib, odd: a.text, steps: distance(picks, a) }))
      )
      .map((c, i) => ({ ...c, i }))
      .sort((x, y) => x.steps - y.steps || x.i - y.i);
    for (const { sib, odd } of candidates) {
      const items = [...three, odd];
      // Against every category, the famous-names ones too: "A famous person
      // called Charles" accepts Spain, France and Austria, for the kings.
      if (hasSecondTrio(categories, cat, items, odd)) continue;
      const options = shuffle(items, rand);
      rounds.push({ id: cat.id, link: cat.prompt, oddLink: sib.prompt, odd, options, oddIndex: options.indexOf(odd) });
      usedKinds.push(cat.kind);
      break;
    }
  }
  return rounds;
}
