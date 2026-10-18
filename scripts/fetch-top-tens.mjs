#!/usr/bin/env node
// Saves the raw wikitext of "List of Billboard Hot 100 top-ten singles in YYYY"
// for 1958 to last year into data-raw/charts/billboard-top10/, one file per
// year, exactly as received. Years already saved are skipped, and requests are
// paced a second apart. scripts/lib/topTens.mjs parses them; build-obscure.mjs
// uses the result.

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { wikitext } from './lib/wikitable.mjs';
import { TOP10_RAW, TOP10_PAGE, parseTopTens } from './lib/topTens.mjs';

const FIRST = 1958;
const LAST = new Date().getFullYear() - 1;
let fetched = 0;
for (let y = FIRST; y <= LAST; y++) {
  const path = join(TOP10_RAW, `${y}.txt`);
  const cached = existsSync(path);
  const text = await wikitext(TOP10_PAGE(y), path);
  const n = parseTopTens(text).length;
  console.log(`${y}: ${n} top-ten singles${cached ? ' (saved earlier)' : ''}`);
  if (n < 20) console.warn(`  ${y}: only ${n} parsed; check the page layout`);
  if (!cached) {
    fetched++;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.log(`Done: ${fetched} pages fetched.`);
