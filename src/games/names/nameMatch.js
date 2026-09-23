// Matching a typed guess against famous people with a given first name. Pure,
// so scripts/test-logic.mjs covers it.

/** "Beyoncé Knowles-Carter" -> "beyonce knowles carter". */
export function normalise(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic edit distance, capped: returns `cap + 1` as soon as it is exceeded. */
export function editDistance(a, b, cap = 2) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The forms of a person's name a player might type, all normalised: everything
 * after the first name ("de niro"), the same without spaces ("deniro"), the
 * whole name, and the last word on its own ("niro", "jordan" for Michael B.
 * Jordan). The last word is skipped when it is under three letters, so a bare
 * initial or particle never counts as a name.
 */
export function acceptedForms(first, person) {
  const rest = normalise(person.rest);
  const words = rest.split(' ').filter((w) => w.length > 1);
  const forms = new Set([rest, normalise(`${first} ${person.rest}`), rest.replace(/ /g, '')]);
  const last = words.at(-1);
  if (last && last.length >= 3) forms.add(last);
  return forms;
}

/**
 * Which person, if any, a guess names.
 *
 * Exact match on any accepted form wins. Otherwise one typo is allowed on
 * guesses of 5+ letters and two on 9+, so "Hiddlestone" finds Hiddleston but
 * "Hay" does not find "Hayes". When a guess matches several people (two Toms
 * called Jones), the most famous one not already found is returned, so typing
 * it again finds the next.
 */
export function matchGuess(guess, first, people, foundIds = new Set()) {
  const g = normalise(guess).replace(new RegExp(`^${normalise(first)} `), '');
  if (g.length < 2) return null;
  const tolerance = g.length >= 9 ? 2 : g.length >= 5 ? 1 : 0;

  let best = null;
  for (const p of people) {
    let dist = Infinity;
    for (const f of acceptedForms(first, p)) {
      dist = Math.min(dist, f === g ? 0 : tolerance ? editDistance(g, f, tolerance) : Infinity);
      if (dist === 0) break;
    }
    if (dist > tolerance) continue;
    const taken = foundIds.has(p.id);
    const score = [taken ? 1 : 0, dist, -p.views]; // untaken, closest, most famous
    if (!best || compare(score, best.score) < 0) best = { person: p, score, taken };
  }
  return best ? { person: best.person, alreadyFound: best.taken } : null;
}

const compare = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
