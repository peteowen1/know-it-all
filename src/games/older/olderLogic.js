// Pure logic for Who's older?: two famous people, was the second born before
// or after the first? A right call moves the second across and brings in a
// new one, so a run is a chain. No React; scripts/test-logic.mjs covers it.

/** How many of the most-read people each setting draws from. */
export const POOLS = { household: 400, known: 1500 };

/**
 * Wikipedia's short description without the years in it, which would give
 * the answer away: "English footballer (born 1995)" -> "English footballer",
 * "President of the United States from 1825 to 1829" -> "President of the
 * United States". Anything left with a digit in it goes too.
 */
export function describe(description = '') {
  let s = description
    .replace(/\s*\([^)]*\d[^)]*\)/g, '')
    .replace(/,?\s+(?:from|since|in|between|during|until|until|of|c\.|circa|born|died|d\.)?\s*(?:the\s+)?\d.*$/i, '')
    .replace(/\s*\d{1,4}(?:s|st|nd|rd|th)?\b.*$/, '')
    .replace(/[\s,;:–-]+$/, '')
    .trim();
  if (/\d/.test(s)) s = '';
  return s;
}

/** 1946 -> "1946", -100 -> "100 BC". */
export const formatYear = (y) => (y < 0 ? `${-y} BC` : String(y));

/**
 * The year gaps a pick may have, by run length: wide gaps first, closer
 * calls as the run grows. Never the same year (the data has only the year,
 * so it cannot say who came first), and never centuries apart: Caesar
 * against Taylor Swift is not a question.
 */
export function gapRange(run) {
  if (run < 3) return [15, 40];
  if (run < 7) return [6, 25];
  if (run < 12) return [2, 15];
  return [1, 10];
}

/**
 * The next person to compare against `current`: someone not yet in this run,
 * born a different year, within the run's gap range. Falls back to any
 * unseen person within 60 years, then null (the run has used everyone).
 */
export function nextPerson(current, pool, rand, { seen = new Set(), run = 0 } = {}) {
  const open = pool.filter((p) => p.id !== current.id && !seen.has(p.id) && p.born !== current.born);
  const [lo, hi] = gapRange(run);
  const gap = (p) => Math.abs(p.born - current.born);
  for (const fits of [(p) => gap(p) >= lo && gap(p) <= hi, (p) => gap(p) <= 60]) {
    const choices = open.filter(fits);
    if (choices.length) return choices[Math.floor(rand() * choices.length)];
  }
  return null;
}

/** A run's first pair: a random person who has someone to compare with. */
export function firstPair(pool, rand) {
  for (let tries = 0; tries < 30; tries++) {
    const left = pool[Math.floor(rand() * pool.length)];
    const right = nextPerson(left, pool, rand, { seen: new Set([left.id]) });
    if (right) return { left, right };
  }
  return null;
}

/** Was `right` born before `left`? The answer the "Before" button gives. */
export const bornBefore = (right, left) => right.born < left.born;
