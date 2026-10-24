// Fetches the bands each Who am I musician played in (member of, P463, or the
// band's has part, P527) and the songs and albums credited to those bands
// (P175), each with its Wikipedia sitelink count. Wikidata credits a band's
// hits to the band, so 144 of 508 top-15 musicians had no works clue: Marc
// Bolan (T. Rex), Jim Morrison (The Doors), Chris Martin (Coldplay)
// (2026-10-24). Then the English labels of each band's best-known works.
//
// Only top-15 people whose description makes them a musician (famousWorks.mjs
// MUSICIAN). Every response is saved raw under data-raw/famous/bands/;
// bands-index.json records which people each file answered for, so a rerun
// fetches only people not yet on disk. Labels go with the works labels.
// Read by scripts/lib/famousWorks.mjs.
//
//   node scripts/fetch-famous-bands.mjs   # after fetch-famous-works.mjs
//   npm run data:famous                   # build the clues

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { get, sparql, sleep, nextName } from './lib/fetchRaw.mjs';
import { MUSICIAN } from './lib/famousWorks.mjs';

const TOP = 15;
const PEOPLE_PER_QUERY = 25;
const WORKS_KEPT = 8; // per band, for the label fetch (some are ruled out by date)
const RAW = 'data-raw/famous/bands';
const RAW_LABELS = 'data-raw/famous/works-labels';
const INDEX = 'data-raw/famous/bands-index.json';

// With the membership's start and end (P580, P582) and each work's release
// date (P577), so a later member is not credited with the band's earlier
// hits: Brian Johnson joined AC/DC after Highway to Hell. And the band's
// formation (P571), as a work out before the band was formed is a cover:
// White Christmas for the Beach Boys. The work's best-ranked performer only
// (wdt:, unlike fetch-famous-works.mjs): a cover is a normal-rank performer
// on the original, so every statement gave the Bee Gees Strawberry Fields
// Forever. runLast: without it the service looks up sitelinks first and
// times out.
const query = (ids) => `SELECT DISTINCT ?person ?band ?formed ?start ?end ?work ?date ?links WHERE {
  VALUES ?person { ${ids.map((i) => 'wd:' + i).join(' ')} }
  { ?person p:P463 ?m . ?m ps:P463 ?band . }
  UNION { ?band p:P527 ?m . ?m ps:P527 ?person . }
  OPTIONAL { ?m pq:P580 ?start }
  OPTIONAL { ?m pq:P582 ?end }
  ?band wdt:P31/wdt:P279* wd:Q215380 .
  OPTIONAL { ?band wdt:P571 ?formed }
  ?work wdt:P175 ?band .
  OPTIONAL { ?work wdt:P577 ?date }
  ?work wikibase:sitelinks ?links . hint:Prior hint:runLast true .
}`;

/** As in fetch-famous-works.mjs: save, index, and split a batch that times out. */
async function saveBatch(ids, name, index) {
  try {
    const text = await sparql(query(ids), ids.length > 1 ? 2 : 3);
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

const famous = JSON.parse(readFileSync('src/data/famous.json', 'utf8'));
const ids = [...new Set(famous.names.flatMap((b) => b.people.slice(0, TOP).filter((p) => MUSICIAN.test(p.description)).map((p) => p.id)))].sort();
console.log(`${ids.length} musicians from ${famous.names.length} boards`);

mkdirSync(RAW, { recursive: true });
mkdirSync(RAW_LABELS, { recursive: true });

const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
const done = new Set(Object.values(index).flat());
const todo = ids.filter((id) => !done.has(id));
console.log(`bands: ${todo.length} people to fetch, ${ids.length - todo.length} already on disk`);
for (let i = 0; i < todo.length; i += PEOPLE_PER_QUERY) {
  const t = Date.now();
  const rows = await saveBatch(todo.slice(i, i + PEOPLE_PER_QUERY), nextName(RAW), index);
  console.log(`bands ${i / PEOPLE_PER_QUERY + 1}/${Math.ceil(todo.length / PEOPLE_PER_QUERY)}: ${rows} rows, ${Date.now() - t} ms`);
  await sleep(1000);
}

// Each band's best-known works, to label.
const best = new Map();
for (const f of Object.keys(index)) {
  for (const row of JSON.parse(readFileSync(`${RAW}/${f}`, 'utf8')).results.bindings) {
    const band = row.band.value.split('/').pop();
    if (!best.has(band)) best.set(band, new Map());
    best.get(band).set(row.work.value.split('/').pop(), +row.links.value);
  }
}
const labelled = new Set(readdirSync(RAW_LABELS).flatMap((f) => Object.keys(JSON.parse(readFileSync(`${RAW_LABELS}/${f}`, 'utf8')).entities || {})));
const works = [...new Set([...best.values()].flatMap((ws) => [...ws].sort((a, b) => b[1] - a[1]).slice(0, WORKS_KEPT).map((w) => w[0])))]
  .filter((w) => !labelled.has(w))
  .sort();
console.log(`labels: ${works.length} works to fetch, ${labelled.size} already on disk`);
for (let i = 0; i < works.length; i += 50) {
  const text = await get(
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions|sitelinks&sitefilter=enwiki&languages=en&ids=' +
      works.slice(i, i + 50).join('|')
  );
  writeFileSync(`${RAW_LABELS}/${nextName(RAW_LABELS)}.json`, text);
  await sleep(300);
}
