// Answer matching for Fill the list, kept apart from the component so the
// component file exports only components (fast refresh) and tests can import it.

import { normalise, editDistance } from '../names/nameMatch.js';

/**
 * Is `guess` this row's answer? Full name, Wikidata's label, or surname, with
 * one typo allowed from five letters and two from nine.
 */
export function rowMatches(guess, row) {
  const g = normalise(guess);
  if (!g) return false;
  const tolerance = g.length >= 9 ? 2 : g.length >= 5 ? 1 : 0;
  return row.accept.some((a) => {
    const f = normalise(a);
    return f === g || (tolerance > 0 && editDistance(g, f, tolerance) <= tolerance);
  });
}
