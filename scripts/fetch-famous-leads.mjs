// Fetches the links in the opening section of each Who am I person's English
// Wikipedia article, and the Wikidata id of every linked page. The opening
// names what a person is best known for (Laura Prepon: That '70s Show and
// Orange Is the New Black), where ranking their works by fame alone picked a
// guest spot in House. Read by scripts/lib/famousWorks.mjs.
//
// Only people with a works clue among each board's top 15, and musicians. Every response is
// saved raw: one file per person under data-raw/famous/leads/, one per batch
// of 50 titles under data-raw/famous/leads-qids/. A rerun fetches only what
// is not on disk, so a stopped run resumes.
//
//   node scripts/fetch-famous-leads.mjs   # after fetch-famous-works.mjs
//   npm run data:famous                   # then rebuild the clues

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { MUSICIAN } from './lib/famousWorks.mjs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';
const LEADS = 'data-raw/famous/leads';
const QIDS = 'data-raw/famous/leads-qids';
const PARALLEL = 3;
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    // The API answers some failures (missingtitle, maxlag) with a 200 and an
    // "error" key; saved, they would be skipped as done on every rerun.
    if (res.ok && text.trimStart().startsWith('{') && !('error' in JSON.parse(text))) return text;
    if (attempt === tries) throw new Error(`${res.status} after ${attempt} tries: ${text.slice(0, 200)}`);
    console.warn(`  ${res.status}, retrying: ${text.slice(0, 80)}`);
    await sleep(5000 * attempt);
  }
}

// The people: top 15 per board with a works clue, and their enwiki titles.
// Musicians too, clue or not: their band's works can give them one
// (scripts/fetch-famous-bands.mjs).
const famous = JSON.parse(readFileSync('src/data/famous.json', 'utf8'));
const ids = new Set();
for (const b of famous.names) for (const p of b.people.slice(0, 15)) if (p.known || MUSICIAN.test(p.description)) ids.add(p.id);
const titles = new Map();
// entities/ and entities-vital/ hold build-famous.mjs's trimmed entities
// ({id: {title}}); entities-prefix/ the raw wbgetentities responses, gzipped.
for (const dir of ['entities', 'entities-prefix', 'entities-vital']) {
  for (const f of readdirSync(`data-raw/famous/${dir}`)) {
    const buf = readFileSync(`data-raw/famous/${dir}/${f}`);
    const j = JSON.parse((f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
    for (const [id, e] of Object.entries(j.entities || j)) {
      const title = e.title || e.sitelinks?.enwiki?.title;
      if (ids.has(id) && title) titles.set(id, title);
    }
  }
}
console.log(`${ids.size} people, ${titles.size} with an enwiki title`);

mkdirSync(LEADS, { recursive: true });
const todo = [...titles].filter(([id]) => !existsSync(`${LEADS}/${id}.json`)).slice(0, limit);
console.log(`${todo.length} openings to fetch`);
const t0 = Date.now();
let done = 0;
async function worker() {
  while (todo.length) {
    const [id, title] = todo.shift();
    const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&section=0&prop=links&page=${encodeURIComponent(title)}`;
    writeFileSync(`${LEADS}/${id}.json`, await get(url));
    if (++done % 200 === 0) console.log(`  ${done} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
console.log(`openings: ${done} fetched in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// Linked titles to Wikidata ids, 50 per call. Each batch file's own response
// lists the titles it answered (normalized/redirects/pages), so a rerun skips them.
mkdirSync(QIDS, { recursive: true });
const known = new Set();
for (const f of readdirSync(QIDS)) for (const t of JSON.parse(readFileSync(`${QIDS}/${f}`, 'utf8')).asked || []) known.add(t);
const linked = new Set();
for (const f of readdirSync(LEADS)) {
  for (const l of JSON.parse(readFileSync(`${LEADS}/${f}`, 'utf8')).parse?.links || []) if (l.ns === 0 && l.exists) linked.add(l.title);
}
const ask = [...linked].filter((t) => !known.has(t));
console.log(`${linked.size} linked titles, ${ask.length} to resolve`);
let n = readdirSync(QIDS).length;
for (let i = 0; i < ask.length; i += 50) {
  const batch = ask.slice(i, i + 50);
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(batch.join('|'))}`;
  // The response as received, with the titles asked alongside for resuming.
  writeFileSync(`${QIDS}/${String(n++).padStart(4, '0')}.json`, `{"asked":${JSON.stringify(batch)},"response":${await get(url)}}`);
}
console.log(`ids: ${Math.ceil(ask.length / 50)} batches in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
