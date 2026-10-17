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
function acceptedForms(first, person) {
  const rest = normalise(person.rest);
  const words = rest.split(' ').filter((w) => w.length > 1);
  const forms = new Set([rest, normalise(`${first} ${person.rest}`), rest.replace(/ /g, '')]);
  const last = words.at(-1);
  if (last && last.length >= 3) forms.add(last);
  // Monarchs and popes: "Elizabeth I" is also "1", "1st", "first" and
  // "the first"; "Louis XVIII" is also "18", "18th", "eighteenth". The numeral
  // itself is already accepted as `rest`.
  const n = romanToInt(rest);
  if (n) for (const f of [String(n), ordinal(n), ordinalWord(n), `the ${ordinalWord(n)}`]) forms.add(f);
  return forms;
}

/**
 * The value of a Roman numeral from 1 to 99 (any valid one: "xviii", "xxiii",
 * "xl"), or 0 if the text is not one. Larger numerals and the single letters
 * l, c, d and m are refused: nobody is "the hundredth", and a person whose
 * name ends in "D" or "M" ("Agent M") is not a numbered monarch.
 */
export function romanToInt(text) {
  const t = text.toLowerCase();
  if (t.length === 1 && !'ivx'.includes(t)) return 0;
  const m = /^(?:(x[cl]|l?x{0,3}))(ix|iv|v?i{0,3})$/.exec(t);
  if (!m || !t) return 0;
  const tens = { '': 0, x: 10, xx: 20, xxx: 30, xl: 40, l: 50, lx: 60, lxx: 70, lxxx: 80, xc: 90 }[m[1]];
  const ones = { '': 0, i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }[m[2]];
  return tens + ones;
}

const ONES = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const CARDINAL_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINAL_TENS = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];
/** 1..99 as an ordinal word, spaced the way normalise() writes it: "twenty third". */
function ordinalWord(n) {
  if (n < 20) return ONES[n];
  return n % 10 ? `${CARDINAL_TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : ORDINAL_TENS[n / 10];
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/**
 * Which person, if any, a guess names.
 *
 * Exact match on any accepted form wins. Otherwise one typo is allowed on
 * guesses of 5+ letters and two on 9+, so "Hiddlestone" finds Hiddleston but
 * "Hay" does not find "Hayes". When a guess matches several people (two Toms
 * called Jones), the most famous one not already found is returned, so typing
 * it again finds the next.
 *
 * `first` is the board's first name, or a list of spellings for a board that
 * merges them ("Billy", "Billie"). A typed first name in any of those
 * spellings is stripped, and each person's own spelling counts as their name.
 */
export function matchGuess(guess, first, people, foundIds = new Set()) {
  const spellings = [].concat(first).map(normalise);
  let g = normalise(guess);
  for (const s of spellings) if (g.startsWith(`${s} `)) g = g.slice(s.length + 1);
  // One character is allowed ("I" for Elizabeth I) but only ever matches
  // exactly: tolerance is zero below five characters.
  if (!g) return null;
  const tolerance = g.length >= 9 ? 2 : g.length >= 5 ? 1 : 0;

  let best = null;
  for (const p of people) {
    let dist = Infinity;
    for (const f of acceptedForms(p.first || [].concat(first)[0], p)) {
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

/**
 * A first name in the plural: "Toms", but "Carloses", "Jameses", "Maxes".
 * A bare "+s" gave "Famous Carloss" on the board title and in Four by four.
 */
export const pluralName = (name) => (/(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`);
