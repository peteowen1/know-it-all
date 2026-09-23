// Pure logic for the "by year" games: build a board or a quiz from a chart
// keyed by year. Written against a generic shape so films and TV can reuse it:
//
//   years: { 1997: [{ rank, title, titles?, artist, artists? }] }
//
// For music, `artists` are the credited acts; for films it would be the
// director or studio. No React, no JSON import — scripts/test-logic.mjs covers it.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';
import { normalise, editDistance } from '../names/nameMatch.js';

/** Points for a chart position: #1 = 100, #100 = 1. */
const points = (rank) => 101 - rank;

const yearsIn = (years, from, to) =>
  Object.keys(years).map(Number).filter((y) => y >= from && y <= to).sort((a, b) => a - b);

/**
 * The top `size` songs over a span. For a single year that is simply the
 * chart. For a decade, a song's points are summed across the years it charted
 * (a hit straddling New Year counts in both), which ranks a long-running hit
 * above a brief one — the same logic as Billboard's own decade-end lists.
 */
export function topSongs(years, from, to, size) {
  const byKey = new Map();
  for (const y of yearsIn(years, from, to)) {
    for (const e of years[y]) {
      const key = `${normalise(e.title)}|${normalise(e.artist)}`;
      const cur = byKey.get(key) || { ...e, points: 0, years: [] };
      cur.points += points(e.rank);
      cur.years.push(y);
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.points - a.points || a.rank - b.rank)
    .slice(0, size)
    .map((e, i) => ({
      id: `song:${normalise(e.title)}|${normalise(e.artist)}`,
      rank: i + 1,
      label: e.title,
      sub: e.artist,
      hint: e.artist,
      // Typing either the song or any credited artist finds it.
      answers: [...(e.titles || [e.title]), ...(e.artists || [e.artist])],
      years: e.years
    }));
}

/**
 * The biggest acts over a span, by summed points of every song they are
 * credited on. A featured artist gets full credit: "Puff Daddy featuring 112"
 * counts for 112 as well, which is how a pub quiz would count it.
 */
export function topArtists(years, from, to, size) {
  const byArtist = new Map();
  for (const y of yearsIn(years, from, to)) {
    for (const e of years[y]) {
      for (const a of e.artists || [e.artist]) {
        const key = normalise(a);
        const cur = byArtist.get(key) || { name: a, points: 0, songs: [] };
        cur.points += points(e.rank);
        cur.songs.push({ title: e.title, rank: e.rank, year: y });
        byArtist.set(key, cur);
      }
    }
  }
  return [...byArtist.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, size)
    .map((a, i) => {
      const best = [...a.songs].sort((x, y) => x.rank - y.rank)[0];
      return {
        id: `artist:${normalise(a.name)}`,
        rank: i + 1,
        label: a.name,
        sub: `${a.songs.length} song${a.songs.length === 1 ? '' : 's'} · biggest "${best.title}"`,
        hint: `"${best.title}"`,
        answers: [a.name]
      };
    });
}

/** Accepted spellings of one answer: as written, without "The", without brackets. */
function forms(answer) {
  const n = normalise(answer);
  const out = new Set([n]);
  out.add(n.replace(/^the /, ''));
  // "Cheerleader (Felix Jaehn Remix)" -> "cheerleader"
  const noBrackets = normalise(answer.replace(/\([^)]*\)/g, ''));
  if (noBrackets) out.add(noBrackets);
  out.add(n.replace(/ /g, ''));
  return out;
}

/**
 * Which board item a guess names, if any.
 *
 * Same tolerance as famous names: none under five letters, one typo from five,
 * two from nine. If a guess fits several items (an artist with two songs on
 * the board), the highest-ranked one not yet found is returned, so typing the
 * artist again finds the next.
 */
export function matchChartGuess(guess, items, foundIds = new Set()) {
  const g = normalise(guess);
  if (g.length < 2) return null;
  const tolerance = g.length >= 9 ? 2 : g.length >= 5 ? 1 : 0;
  let best = null;
  for (const item of items) {
    let dist = Infinity;
    for (const a of item.answers) {
      for (const f of forms(a)) {
        const d = f === g ? 0 : tolerance ? editDistance(g, f, tolerance) : Infinity;
        dist = Math.min(dist, d);
      }
    }
    if (dist > tolerance) continue;
    const taken = foundIds.has(item.id);
    const score = [taken ? 1 : 0, dist, item.rank];
    if (!best || cmp(score, best.score) < 0) best = { item, score, taken };
  }
  return best ? { item: best.item, alreadyFound: best.taken } : null;
}

const cmp = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

/**
 * Quiz questions, alternating two kinds:
 *   - "Biggest song of 1997?"  four songs; the wrong ones are top-10 hits from
 *     within three years, so the era is right and the question is about the year.
 *   - "'Wooly Bully' was the biggest song of which year?"  four nearby years.
 * Each has `prompt`, `options` (strings), `correctIndex` and `explain`.
 */
export function buildChartQuiz(years, { from, to, count = 10, seed = Date.now() } = {}) {
  const rand = makeRng(hashString(`chartquiz:${seed}`));
  const span = yearsIn(years, from, to);
  const all = yearsIn(years, -Infinity, Infinity);
  // Each year can be asked both ways. Years are used once each first; only a
  // span shorter than `count` (the 2020s so far) asks a year twice, once per
  // kind, so a short decade still gets a full round rather than six questions.
  const kinds = ['song-of-year', 'year-of-song'];
  const firstPass = shuffle(span, rand).map((year, i) => [year, kinds[i % 2]]);
  const secondPass = shuffle(firstPass, rand).map(([year, kind]) => [year, kinds[1 - kinds.indexOf(kind)]]);
  const picked = [...firstPass, ...secondPass].slice(0, count);
  return picked.map(([year, kind]) => {
    const top = years[year][0];
    const label = (e) => `"${e.title}" — ${e.artist}`;
    if (kind === 'song-of-year') {
      const nearby = yearsIn(years, year - 3, year + 3).filter((y) => y !== year);
      const pool = nearby.flatMap((y) => years[y].slice(0, 10)).filter((e) => normalise(e.title) !== normalise(top.title));
      const wrong = [];
      const seen = new Set([normalise(top.title)]);
      for (const e of shuffle(pool, rand)) {
        if (wrong.length === 3) break;
        if (seen.has(normalise(e.title))) continue;
        seen.add(normalise(e.title));
        wrong.push(e);
      }
      const options = shuffle([top, ...wrong], rand);
      return {
        kind: 'song-of-year',
        year,
        prompt: `Biggest song of ${year}?`,
        options: options.map(label),
        correctIndex: options.indexOf(top),
        explain: `${label(top)} was Billboard's year-end number one for ${year}.`,
        key: `song:${year}`
      };
    }
    // Decoy years come from the data, so 2025's options never include 2027.
    const decoys = shuffle(all.filter((y) => y !== year).sort((a, b) => Math.abs(a - year) - Math.abs(b - year)).slice(0, 6), rand).slice(0, 3);
    const options = shuffle([year, ...decoys], rand);
    return {
      kind: 'year-of-song',
      year,
      prompt: `${label(top)} was the biggest song of which year?`,
      options: options.map(String),
      correctIndex: options.indexOf(year),
      explain: `Year-end number one for ${year}. Runner-up: ${label(years[year][1])}.`,
      key: `year:${year}`
    };
  });
}

/**
 * Decades with at least `minYears` years of data, e.g. [1960, ..., 2020].
 * The 1950s (only 1959) is left out: one year is not a decade, and its
 * "decade" board and quiz would really be a single year.
 */
export function decadesOf(years, minYears = 5) {
  const count = {};
  for (const y of Object.keys(years)) {
    const d = Math.floor(Number(y) / 10) * 10;
    count[d] = (count[d] || 0) + 1;
  }
  return Object.keys(count).map(Number).filter((d) => count[d] >= minYears).sort((a, b) => a - b);
}
