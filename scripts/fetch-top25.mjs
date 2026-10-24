#!/usr/bin/env node
// Saves Wikipedia's weekly Top 25 Report pages around each Match the curve
// peak (src/data/curves.json), raw, one file per page in data-raw/famous/top25/.
// The report says in a sentence why each of the week's most-read articles was
// read, which is where scripts/curve-reasons.json's reasons come from: a pilot
// on 21 peaks found 18 there (2026-10-25), against 6 in Portal:Current events.
//
//   node scripts/fetch-top25.mjs            # fetch what is missing
//   node scripts/fetch-top25.mjs --index    # also refresh the list of pages

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { get, sleep } from './lib/fetchRaw.mjs';

const DIR = 'data-raw/famous/top25';
const API = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2';
mkdirSync(DIR, { recursive: true });
const gz = (f) => JSON.parse(gunzipSync(readFileSync(f)));

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fileOf = (title) => `${DIR}/${encodeURIComponent(title.split('/')[1]).replace(/[%*]/g, '~')}.json.gz`;

/** Every weekly page with its first day: "April 27 to May 3, 2025", "December 29, 2024 to January 4, 2025". */
export const weeks = () =>
  readdirSync(DIR)
    .filter((f) => f.startsWith('index-'))
    .flatMap((f) => gz(`${DIR}/${f}`).query.allpages.map((p) => p.title))
    .map((title) => {
      const m = title.match(/\/(\w+) (\d+)(?:, (\d{4}))? to .*?(\d{4})$/);
      if (m && MONTHS.includes(m[1])) return { title, start: Date.UTC(+(m[3] || m[4]), MONTHS.indexOf(m[1]), +m[2]) };
      // A few early pages put the day first: "24 to 30 January 2016".
      const d = title.match(/\/(\d+) to \d+ (\w+) (\d{4})$/);
      return d && MONTHS.includes(d[2]) ? { title, start: Date.UTC(+d[3], MONTHS.indexOf(d[2]), +d[1]) } : null;
    })
    .filter(Boolean);

/** The weeks that overlap a "YYYY-MM" month. */
export const weeksOf = (all, ym) => {
  const [y, m] = ym.split('-').map(Number);
  return all.filter((w) => w.start >= Date.UTC(y, m - 1, 1) - 6 * 864e5 && w.start < Date.UTC(y, m, 1));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--index') || !readdirSync(DIR).some((f) => f.startsWith('index-'))) {
    let cont = '';
    let n = 0;
    do {
      const text = await get(`${API}&list=allpages&apnamespace=4&aplimit=max&apprefix=${encodeURIComponent('Top 25 Report/')}${cont}`);
      writeFileSync(`${DIR}/index-${String(n++).padStart(2, '0')}.json.gz`, gzipSync(text));
      const j = JSON.parse(text);
      cont = j.continue ? `&apcontinue=${encodeURIComponent(j.continue.apcontinue)}` : '';
      await sleep(300);
    } while (cont);
  }
  const all = weeks();
  const { people } = JSON.parse(readFileSync('src/data/curves.json', 'utf8'));
  const need = [...new Set(people.flatMap((p) => weeksOf(all, p.peak).map((w) => w.title)))].filter((t) => !existsSync(fileOf(t)));
  console.log(`${all.length} weekly pages; ${need.length} to fetch for ${people.length} peaks`);
  for (let i = 0; i < need.length; i += 50) {
    const text = await get(`${API}&prop=revisions&rvprop=content|timestamp|ids&rvslots=main&titles=${encodeURIComponent(need.slice(i, i + 50).join('|'))}`);
    for (const pg of JSON.parse(text).query.pages) writeFileSync(fileOf(pg.title), gzipSync(JSON.stringify(pg)));
    await sleep(500);
  }
  console.log('done');
}
