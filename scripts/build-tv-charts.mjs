#!/usr/bin/env node
// Builds src/data/charts/tv.json: winners and nominees for four TV awards,
// keyed by year, for the TV by year game. Run with `npm run data:tv`.
//
//   emmyDrama    Primetime Emmy, Outstanding Drama Series
//   emmyComedy   Primetime Emmy, Outstanding Comedy Series
//   globeDrama   Golden Globe, Best Television Series – Drama
//   globeComedy  Golden Globe, Best Television Series – Musical or Comedy
//
// Read from each award's Wikipedia page. Winners are the bold row; `rank` 1 is
// the winner and 2+ the other nominees in the order listed. Each show is
// credited to its network (the last column on every one of these tables),
// so "HBO" is an accepted answer for any HBO show on a board.
//
// Years are as the page labels them: the Emmy ceremony year, and for the
// Globes the year of television honoured (the 2010 row is the 68th Globes,
// held January 2011).

import { mkdirSync, writeFileSync } from 'node:fs';
import { wikitext, tableRows, tableStarts, plain, isBold } from './lib/wikitable.mjs';

const RAW = 'data-raw/charts/tv';
const PAGES = {
  emmyDrama: 'Primetime Emmy Award for Outstanding Drama Series',
  emmyComedy: 'Primetime Emmy Award for Outstanding Comedy Series',
  globeDrama: 'Golden Globe Award for Best Television Series – Drama',
  globeComedy: 'Golden Globe Award for Best Television Series – Musical or Comedy'
};

mkdirSync('src/data/charts', { recursive: true });

// The show is whatever comes before the line break; the season note after it
// ("<br/><small>(Season 3)</small>") is sometimes the only link in the cell,
// so taking the first link gave "Season 3" as a title for 1975 and 1977.
// A trailing bracketed note with no link in it ("(comedy series)") goes too.
const cleanTitle = (cell) => {
  const head = cell.split(/<br\s*\/?>|<small>/i)[0].replace(/\s*\([^()[\]]*\)\s*('*)\s*$/, '$1');
  return plain(head)
    .replace(/\s*\(?(season|series) \d+\)?\s*$/i, '')
    .trim();
};

const out = {};
const problems = [];
for (const [key, page] of Object.entries(PAGES)) {
  const text = await wikitext(page, `${RAW}/${key}.txt`);
  const years = {};
  for (const start of tableStarts(text)) {
    // Winner tables have a Program column; others (records, most wins) do not.
    if (!/!\s*(width="[^"]*"\s*\|)?\s*Program/.test(text.slice(start, start + 500))) continue;
    for (const cells of tableRows(text, start)) {
      if (cells.length < 3) continue;
      const year = Number(plain(cells[0]).match(/\b(19|20)\d{2}\b/)?.[0]);
      if (!year) continue;
      const title = cleanTitle(cells[1]);
      if (!title) continue;
      const list = (years[year] ||= []);
      if (list.some((x) => x.title === title)) continue;
      // 1950s simulcasts list two networks ("KTTV, CBS"). Each is an answer.
      const artist = plain(cells[cells.length - 1]) || 'Unknown network';
      const networks = artist.split(/\s*[,/]\s*|\s+and\s+/).filter(Boolean);
      list.push({ title, artist, ...(networks.length > 1 ? { artists: networks } : {}), won: isBold(cells[1]) });
    }
  }
  const clean = {};
  for (const [y, list] of Object.entries(years)) {
    const winners = list.filter((s) => s.won).length;
    if (winners !== 1) {
      // Ties and years with no award exist (the Globes had several winners
      // some early years); skip rather than guess which one to ask about.
      problems.push(`${key} ${y}: ${winners} winners`);
      continue;
    }
    list.sort((a, b) => Number(b.won) - Number(a.won));
    clean[y] = list.map((s, i) => ({ rank: i + 1, title: s.title, artist: s.artist, ...(s.artists ? { artists: s.artists } : {}) }));
  }
  out[key] = clean;
  const ys = Object.keys(clean).map(Number);
  console.log(`${key}: ${ys.length} years (${Math.min(...ys)}-${Math.max(...ys)})`);
}

for (const [key, y] of [['emmyDrama', 2010], ['emmyComedy', 1996], ['globeDrama', 2011], ['globeComedy', 2021]]) {
  console.log(`${key} ${y}: ${out[key][y]?.map((s) => `${s.title} (${s.artist})`).join(', ')}`);
}
console.log(problems.length ? `skipped (not exactly one winner): ${problems.length}\n  ${problems.join('\n  ')}` : 'no skipped years');
if (Object.values(out).some((c) => Object.keys(c).length < 40)) throw new Error('an award has under 40 years; check the parser');

writeFileSync('src/data/charts/tv.json', JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), ...out }));
console.log('wrote src/data/charts/tv.json');
