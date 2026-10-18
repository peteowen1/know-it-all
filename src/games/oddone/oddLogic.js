// Pure logic for Odd one out: three answers that share a category and one that
// does not. Built from the Obscure-est categories (src/data/obscure.json), so it
// needs no data of its own. No React, no JSON import: scripts/test-odd-one.mjs
// runs it on the real file.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise } from '../names/nameMatch.js';

export const ROUNDS = 5;

// Category ids share a prefix by kind ("borders-CN", "songs-Madonna"): the odd
// one comes from a sibling of the same kind, so it looks like it belongs.
const family = (id) => id.split('-')[0];

// "A famous Tom" shows full names, so the odd one would be plain to see.
const SKIP_FAMILIES = new Set(['name']);

// Only well-known answers (score 1 is the most obvious, 100 the deepest cut),
// so the round is about spotting the link, not knowing an obscure B-side.
const WELL_KNOWN = 60;
const wellKnown = (category) => category.answers.filter((a) => a.score <= WELL_KNOWN);

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
 * `count` rounds, kinds varied. Each round: three well-known answers from one
 * category, one well-known answer from a sibling category that is not in the
 * first, checked so that no other category groups a different three.
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
    const pool = wellKnown(cat);
    if (pool.length < 3) continue;
    const three = shuffle(pool, rand).slice(0, 3).map((a) => a.text);
    if (new Set(three.map(normalise)).size < 3) continue;
    const siblings = shuffle(usable.filter((c) => c.id !== cat.id && family(c.id) === family(cat.id)), rand);
    for (const sib of siblings) {
      const odd = shuffle(wellKnown(sib), rand).find((a) => !inCategory(cat, a.text) && !three.some((t) => normalise(t) === normalise(a.text)))?.text;
      if (!odd) continue;
      const items = [...three, odd];
      if (hasSecondTrio(usable, cat, items, odd)) continue;
      const options = shuffle(items, rand);
      rounds.push({ id: cat.id, link: cat.prompt, oddLink: sib.prompt, odd, options, oddIndex: options.indexOf(odd) });
      usedKinds.push(cat.kind);
      break;
    }
  }
  return rounds;
}
