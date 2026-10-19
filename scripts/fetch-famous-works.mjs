// Fetches what each Who am I person is known for: their notable works (P800),
// the films they are in (P161), songs and albums they perform (P175), books
// they wrote (P50), films they directed (P57), things they created (P170) and
// teams they played for (P54), each with its Wikipedia sitelink count as a
// measure of fame. Then the English labels and descriptions of the works.
//
// Only each board's top 15 (the people Who am I uses). Every response is saved
// raw under data-raw/famous/works*/. works-index.json records which people each
// works file answered for (a person with no works leaves no row to tell), and
// a label file's own response lists the works it covers, so a rerun fetches
// only people and works not yet on disk: a stopped run resumes, and new top-15
// people are added. Read by scripts/build-famous.mjs.
//
//   npm run data:famous                   # new top-15 people appear
//   node scripts/fetch-famous-works.mjs   # fetch their works
//   npm run data:famous                   # and build the clues

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';
const TOP = 15;
const PEOPLE_PER_QUERY = 50;
const WORKS_KEPT = 4; // per person and property, for the label fetch
const RAW = 'data-raw/famous/works';
const RAW_LABELS = 'data-raw/famous/works-labels';
const INDEX = 'data-raw/famous/works-index.json';
const WORK_PROPS = ['P800', 'P161', 'P175', 'P50', 'P57', 'P170', 'P54'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, init = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers } });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith('{')) return text;
    if (attempt === tries) throw new Error(`${res.status} after ${attempt} tries: ${text.slice(0, 200)}`);
    console.warn(`  ${res.status}, retrying: ${text.slice(0, 80)}`);
    await sleep(5000 * attempt);
  }
}

const sparql = (ids, tries) =>
  get(
    'https://query.wikidata.org/sparql',
    {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent(query(ids))
    },
    tries
  );

/**
 * Saves one batch's response as `name`.json and records its people in the
 * index straight after, so a stop between the two only refetches them. A
 * batch the service times out on (someone credited on thousands of works) is
 * split in half (`name`-0, `name`-1), down to single people; a single person
 * who still times out is logged and left out of the index, to retry next run.
 */
async function saveBatch(ids, name, index) {
  try {
    const text = await sparql(ids, ids.length > 1 ? 2 : 3);
    writeFileSync(`${RAW}/${name}.json`, text);
    index[`${name}.json`] = ids;
    writeFileSync(INDEX, JSON.stringify(index));
    return JSON.parse(text).results.bindings.length;
  } catch (err) {
    if (ids.length === 1) {
      console.warn(`  skipped ${ids[0]}, will retry next run: ${err.message.slice(0, 80)}`);
      return 0;
    }
    console.warn(`  splitting ${name} (${ids.length} people)`);
    const half = Math.ceil(ids.length / 2);
    return (await saveBatch(ids.slice(0, half), `${name}-0`, index)) + (await saveBatch(ids.slice(half), `${name}-1`, index));
  }
}

function query(ids) {
  // Forward properties are the person's own claims; the rest point at them.
  const branch = (p) =>
    p === 'P800' || p === 'P54' ? `{ ?person wdt:${p} ?work . BIND("${p}" AS ?prop) }` : `{ ?work wdt:${p} ?person . BIND("${p}" AS ?prop) }`;
  // runLast: without it the service looks up sitelinks first and times out.
  return `SELECT ?person ?prop ?work ?links WHERE {
  VALUES ?person { ${ids.map((i) => 'wd:' + i).join(' ')} }
  ${WORK_PROPS.map(branch).join('\n  UNION ')}
  ?work wikibase:sitelinks ?links . hint:Prior hint:runLast true .
}`;
}

const famous = JSON.parse(readFileSync('src/data/famous.json', 'utf8'));
const ids = [...new Set(famous.names.flatMap((b) => b.people.slice(0, TOP).map((p) => p.id)))].sort();
console.log(`${ids.length} people from ${famous.names.length} boards`);

mkdirSync(RAW, { recursive: true });
mkdirSync(RAW_LABELS, { recursive: true });

// File names only need to be new: the next number after any on disk.
const nextName = (dir) => String(readdirSync(dir).reduce((n, f) => Math.max(n, parseInt(f, 10) + 1 || 0), 0)).padStart(4, '0');

const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
const done = new Set(Object.values(index).flat());
const todo = ids.filter((id) => !done.has(id));
console.log(`works: ${todo.length} people to fetch, ${ids.length - todo.length} already on disk`);
for (let i = 0; i < todo.length; i += PEOPLE_PER_QUERY) {
  const t = Date.now();
  const rows = await saveBatch(todo.slice(i, i + PEOPLE_PER_QUERY), nextName(RAW), index);
  console.log(`works ${i / PEOPLE_PER_QUERY + 1}/${Math.ceil(todo.length / PEOPLE_PER_QUERY)}: ${rows} rows, ${Date.now() - t} ms`);
  await sleep(1000);
}

// The best-known works of each person and property, to label.
const best = new Map();
for (const f of Object.keys(index)) {
  for (const row of JSON.parse(readFileSync(`${RAW}/${f}`, 'utf8')).results.bindings) {
    const key = `${row.person.value}|${row.prop.value}`;
    if (!best.has(key)) best.set(key, []);
    best.get(key).push([row.work.value.split('/').pop(), +row.links.value]);
  }
}
const labelled = new Set(readdirSync(RAW_LABELS).flatMap((f) => Object.keys(JSON.parse(readFileSync(`${RAW_LABELS}/${f}`, 'utf8')).entities || {})));
const works = [...new Set([...best.values()].flatMap((ws) => ws.sort((a, b) => b[1] - a[1]).slice(0, WORKS_KEPT).map((w) => w[0])))]
  .filter((w) => !labelled.has(w))
  .sort();
console.log(`labels: ${works.length} works to fetch, ${labelled.size} already on disk`);
for (let i = 0; i < works.length; i += 50) {
  const text = await get(
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions|sitelinks&sitefilter=enwiki&languages=en&ids=' +
      works.slice(i, i + 50).join('|')
  );
  writeFileSync(`${RAW_LABELS}/${nextName(RAW_LABELS)}.json`, text);
  if (i % 1000 === 0) console.log(`labels ${i / 50 + 1}/${Math.ceil(works.length / 50)}`);
  await sleep(300);
}
