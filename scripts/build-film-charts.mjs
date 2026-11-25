#!/usr/bin/env node
// Builds src/data/charts/films.json: two charts keyed by year, for the Films by
// year game. Run with `npm run data:films`.
//
//   boxOffice    top 10 films released each year, 1970 to last year, from the
//                "Highest-grossing films" table on Wikipedia's "YYYY in film"
//                pages. Worldwide gross from 1988 (kept as `gross`), US gross
//                for 1980 to 1987, and North American rentals in the 1970s,
//                which is what those pages list.
//   bestPicture  every Academy Award for Best Picture winner (rank 1) and the
//                other nominees (rank 2+), from the award's Wikipedia page.
//
// Each film's `artist` is its director, from Wikidata via the film's Wikipedia
// link, because "who directed it" is what a quiz asks and typing "Spielberg"
// should find his films. Raw wikitext and Wikidata responses are cached under
// data-raw/charts/, so a re-run costs no network.

import { wikitext, tableRows, tableStarts, plain, links, isBold, wikidataByTitle, wikidataLabels } from './lib/wikitable.mjs';
import { fromRoot, writeData } from './lib/output.mjs';
import { DIRECTOR_FIX } from './lib/directorFix.mjs';

const RAW = fromRoot('data-raw/charts/films');
const FIRST_BOX = 1970;
const LAST = new Date().getFullYear() - 1;

const filmLink = (cell) => links(cell).find((l) => !/^(File|Image):/i.test(l.target));

// From 1988 the pages list worldwide gross; before that, US gross or rentals,
// which are not comparable, so those years get no `gross`.
const FIRST_WORLDWIDE = 1988;

/**
 * Worldwide gross in US dollars from the table's last cell, as written:
 * "$618,638,999", "{{US$|1280802282|long=no}}", "{{nts|prefix=$|763455561}}",
 * "$2.1 billion", or a "{{#expr:...}}" sum or difference. Comments and
 * references go first (they carry other figures). Null if none is found.
 */
export function grossOf(cell) {
  const s = cell.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/\{\{(?:refn|efn)[^{}]*\}\}/g, '');
  const expr = s.match(/#expr:([^}]*)/);
  if (expr) {
    // Signed: 1991's Beauty and the Beast subtracts its re-release takings.
    const parts = expr[1].replace(/,/g, '').match(/[+-]?\d+/g) || [];
    const sum = parts.map(Number).reduce((a, b) => a + b, 0);
    return sum >= 1e6 ? sum : null;
  }
  const big = s.replace(/,/g, '').match(/\d{7,}/);
  if (big) return Number(big[0]);
  const short = s.replace(/,/g, '').match(/\$\s*([\d.]+)\s*(billion|million)/i);
  return short ? Math.round(Number(short[1]) * (/b/i.test(short[2]) ? 1e9 : 1e6)) : null;
}

// ------------------------------------------------------------ box office
const boxOffice = {};
const problems = [];
for (let y = FIRST_BOX; y <= LAST; y++) {
  const text = await wikitext(`${y} in film`, `${RAW}/in-film/${y}.txt`);
  const at = text.search(/==\s*Highest-grossing films/i);
  if (at < 0) {
    problems.push(`${y}: no highest-grossing section`);
    continue;
  }
  const rows = [];
  for (const cells of tableRows(text, at)) {
    const rank = Number(plain(cells[0]).replace(/[^0-9]/g, ''));
    if (!rank || rank > 10 || cells.length < 3) continue;
    const link = filmLink(cells[1]);
    const gross = y >= FIRST_WORLDWIDE ? grossOf(cells[cells.length - 1]) : null;
    if (y >= FIRST_WORLDWIDE && !gross) problems.push(`${y} #${rank}: no gross`);
    rows.push({ rank, title: plain(cells[1]).replace(/\s*†\s*$/, ''), link: link?.target, studio: plain(cells[2]), ...(gross && { gross }) });
  }
  if (rows.length < 10) problems.push(`${y}: ${rows.length} box-office rows`);
  boxOffice[y] = rows;
}

// ---------------------------------------------------------- best picture
const bpText = await wikitext('Academy Award for Best Picture', `${RAW}/best-picture.txt`);
const bestPicture = {};
// Only the per-decade nominee tables have a "Year of film release" column;
// other tables on the page (records, multiple winners) would add duplicate
// or wrong rows. (Keying on "Producer(s)" missed the 1920s-40s tables, whose
// column is "Film studio".)
for (const start of tableStarts(bpText)) {
  if (!/Year of film release/.test(bpText.slice(start, start + 600))) continue;
  for (const cells of tableRows(bpText, start)) {
    if (cells.length < 2) continue;
    const year = Number(plain(cells[0]).match(/\b(19|20)\d{2}\b/)?.[0]);
    if (!year) continue;
    const link = filmLink(cells[1]);
    if (!link) continue;
    const list = (bestPicture[year] ||= []);
    if (list.some((x) => x.link === link.target)) continue;
    list.push({ title: plain(cells[1]), link: link.target, won: isBold(cells[1]) });
  }
}
for (const [year, list] of Object.entries(bestPicture)) {
  // Winner first, then nominees in the order listed.
  list.sort((a, b) => Number(b.won) - Number(a.won));
  list.forEach((f, i) => (f.rank = i + 1));
  const winners = list.filter((f) => f.won).length;
  if (winners !== 1) problems.push(`Best Picture ${year}: ${winners} winners marked`);
}

// ------------------------------------------------------------- directors
const allFilms = [...Object.values(boxOffice), ...Object.values(bestPicture)].flat();
const byTitle = await wikidataByTitle(allFilms.map((f) => f.link).filter(Boolean), ['P57'], `${RAW}/wikidata`);
// Wikidata keys by the article's canonical title; a link may use a redirect or
// different capitalisation, so also match case-insensitively on first letter.
const lookup = (t) => byTitle.get(t) || byTitle.get(t?.[0]?.toUpperCase() + t?.slice(1));
const directorIds = allFilms.flatMap((f) => lookup(f.link)?.claims.P57 || []);
const names = await wikidataLabels(directorIds);

let noDirector = 0;
const finish = (f) => {
  const listed = (lookup(f.link)?.claims.P57 || []).map((id) => names.get(id)).filter(Boolean);
  // A fix only trims a credit list it belongs to: titles repeat (A Star Is
  // Born, 1937 and 2018), and the other film's directors must not change.
  const fix = DIRECTOR_FIX[f.title];
  const directors = fix && listed.length > fix.length && fix.every((d) => listed.includes(d)) ? fix : listed;
  if (!directors.length) noDirector++;
  return {
    rank: f.rank,
    title: f.title,
    artist: directors.join(' & ') || 'Unknown director',
    ...(directors.length > 1 ? { artists: directors } : {}),
    ...(f.studio ? { studio: f.studio } : {}),
    ...(f.gross ? { gross: f.gross } : {})
  };
};
const out = { boxOffice: {}, bestPicture: {} };
for (const [y, list] of Object.entries(boxOffice)) out.boxOffice[y] = list.map(finish);
for (const [y, list] of Object.entries(bestPicture)) out.bestPicture[y] = list.map(finish);

// ------------------------------------------------------------------ report
const bpYears = Object.keys(out.bestPicture).map(Number);
console.log(`box office: ${Object.keys(out.boxOffice).length} years; best picture: ${bpYears.length} years (${Math.min(...bpYears)}-${Math.max(...bpYears)})`);
for (const y of [1977, 1997, 2019, LAST]) {
  console.log(`${y} box office: ${out.boxOffice[y]?.slice(0, 3).map((f) => `${f.title} (${f.artist})`).join(' | ')}`);
}
for (const y of [1972, 1994, 2019]) {
  console.log(`${y} best picture: ${out.bestPicture[y]?.map((f) => f.title).join(', ')}`);
}
console.log(`films without a director: ${noDirector} of ${allFilms.length}`);
console.log(problems.length ? `problems:\n  ${problems.join('\n  ')}` : 'no parsing problems');
if (problems.length > 5 || noDirector > allFilms.length * 0.05) throw new Error('too many gaps; check the parser');

writeData('charts/films.json', out);
