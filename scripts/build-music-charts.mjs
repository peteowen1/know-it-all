#!/usr/bin/env node
// Builds src/data/charts/music.json: the Billboard Year-End Hot 100 for every
// year from 1959 (the first full year of the Hot 100). Run with
// `npm run data:music`.
//
// Source: the English Wikipedia pages "Billboard Year-End Hot 100 singles of
// YYYY", read as wikitext through the MediaWiki API. The year-end chart blends
// sales, airplay and (since 2012) streaming, which is what "biggest song of the
// year" means in a quiz.
//
// Artists are taken from the wikilinks in the artist cell, not by splitting the
// text, because splitting on "and" breaks "Sam the Sham and the Pharaohs" and
// "Hootie & the Blowfish" while the links name each act exactly once.
//
// Raw wikitext is cached per year in data-raw/charts/, so a parser change
// re-runs in a second without touching the network.

import { mkdirSync, writeFileSync } from 'node:fs';
import { wikitext, tableRows, plain, links } from './lib/wikitable.mjs';

const RAW = 'data-raw/charts/billboard';
const FIRST = 1959;
const LAST = new Date().getFullYear() - (new Date().getMonth() < 11 ? 1 : 0); // year-end lands in December

mkdirSync('src/data/charts', { recursive: true });

function parseYear(text, year) {
  if (text.indexOf('{|') < 0) throw new Error(`${year}: no table`);
  const entries = [];
  for (const cells of tableRows(text)) {
    if (cells.length < 3) continue;
    const rank = Number(plain(cells[0]).replace(/[^0-9]/g, ''));
    if (!rank) continue;
    // Double A-sides are written "Song A" / "Song B": keep both as answers.
    const titles = plain(cells[1]).split(/"\s*\/\s*"/).map((t) => t.replace(/^"|"$/g, '').trim()).filter(Boolean);
    const linked = links(cells[2]).map((l) => l.text);
    const artistLine = plain(cells[2]);
    const artists = linked.length ? [...new Set(linked)] : [artistLine];
    // `titles` and `artists` are written only when they add something, which
    // keeps the file about a third smaller; readers default them from
    // `title` and `artist`.
    entries.push({
      rank,
      title: titles.join(' / '),
      ...(titles.length > 1 ? { titles } : {}),
      artist: artistLine,
      ...(artists.length === 1 && artists[0] === artistLine ? {} : { artists })
    });
  }
  return entries;
}

// ------------------------------------------------------------------ build
const years = {};
const problems = [];
for (let y = FIRST; y <= LAST; y++) {
  const text = await wikitext(`Billboard Year-End Hot 100 singles of ${y}`, `${RAW}/${y}.txt`);
  const entries = parseYear(text, y);
  const ranks = new Set(entries.map((e) => e.rank));
  // Some years list ties or fewer than 100 rows; flag anything that looks
  // like a parsing failure rather than a real quirk.
  if (entries.length < 95 || !ranks.has(1) || !ranks.has(10)) problems.push(`${y}: ${entries.length} rows`);
  const badArtist = entries.filter((e) => !e.artist || !e.title).length;
  if (badArtist) problems.push(`${y}: ${badArtist} rows missing title or artist`);
  years[y] = entries.sort((a, b) => a.rank - b.rank);
}

const n = Object.keys(years).length;
console.log(`${n} years (${FIRST}-${LAST}), ${Object.values(years).reduce((s, e) => s + e.length, 0)} chart rows`);
for (const y of [1965, 1985, 1997, 2012, LAST]) {
  console.log(`${y}: ${years[y].slice(0, 3).map((e) => `${e.title} — ${(e.artists || [e.artist]).join(' + ')}`).join(' | ')}`);
}
console.log(problems.length ? `problems:\n  ${problems.join('\n  ')}` : 'no parsing problems');
if (problems.length > 3) throw new Error(`${problems.length} years look mis-parsed`);

writeFileSync(
  'src/data/charts/music.json',
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    source: 'Billboard Year-End Hot 100, via English Wikipedia',
    years
  })
);
console.log('wrote src/data/charts/music.json');
