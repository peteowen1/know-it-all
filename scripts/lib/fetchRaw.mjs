// Shared by the scripts that fetch from Wikidata and save each response raw.

import { readdirSync } from 'node:fs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The response text of a JSON request, retried with a growing wait. */
export async function get(url, init = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers } });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith('{')) return text;
    if (attempt === tries) throw new Error(`${res.status} after ${attempt} tries: ${text.slice(0, 200)}`);
    console.warn(`  ${res.status}, retrying: ${text.slice(0, 80)}`);
    await sleep(5000 * attempt);
  }
}

export const sparql = (query, tries) =>
  get(
    'https://query.wikidata.org/sparql',
    {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent(query)
    },
    tries
  );

// File names only need to be new: the next number after any on disk.
export const nextName = (dir) => String(readdirSync(dir).reduce((n, f) => Math.max(n, parseInt(f, 10) + 1 || 0), 0)).padStart(4, '0');
