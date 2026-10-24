// Fetches the awards each Who am I person received (P166) where Wikidata
// says which work it was for (P1686), with the award's Wikipedia sitelink
// count as a measure of how major it is. An actor's opening links most of
// their films, so it cannot tell a signature role from a cameo: Diane Keaton
// was "Starred in The Godfather and The Godfather Part II", not Annie Hall
// (2026-10-24).
//
// Only each board's top 15. Every response is saved raw under
// data-raw/famous/awards/; awards-index.json records which people each file
// answered for, so a rerun fetches only people not yet on disk. Read by
// scripts/lib/famousWorks.mjs.
//
//   node scripts/fetch-famous-awards.mjs   # after fetch-famous-works.mjs
//   npm run data:famous                    # build the clues

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { sparql, sleep, nextName } from './lib/fetchRaw.mjs';

const TOP = 15;
const PEOPLE_PER_QUERY = 100;
const RAW = 'data-raw/famous/awards';
const INDEX = 'data-raw/famous/awards-index.json';

// The award's English name too: some awards say nothing good about the work
// (the Golden Raspberry, for the worst).
const query = (ids) => `SELECT ?person ?award ?awardLabel ?awardLinks ?work ?date WHERE {
  VALUES ?person { ${ids.map((i) => 'wd:' + i).join(' ')} }
  ?person p:P166 ?st . ?st ps:P166 ?award ; pq:P1686 ?work .
  OPTIONAL { ?st pq:P585 ?date }
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  ?award wikibase:sitelinks ?awardLinks .
  OPTIONAL { ?award rdfs:label ?awardLabel . FILTER(lang(?awardLabel) = 'en') }
}`;

const famous = JSON.parse(readFileSync('src/data/famous.json', 'utf8'));
const ids = [...new Set(famous.names.flatMap((b) => b.people.slice(0, TOP).map((p) => p.id)))].sort();
console.log(`${ids.length} people from ${famous.names.length} boards`);

mkdirSync(RAW, { recursive: true });
const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
const done = new Set(Object.values(index).flat());
const todo = ids.filter((id) => !done.has(id));
console.log(`awards: ${todo.length} people to fetch, ${ids.length - todo.length} already on disk`);
for (let i = 0; i < todo.length; i += PEOPLE_PER_QUERY) {
  const batch = todo.slice(i, i + PEOPLE_PER_QUERY);
  const text = await sparql(query(batch), 3);
  const name = `${nextName(RAW)}.json`;
  writeFileSync(`${RAW}/${name}`, text);
  index[name] = batch;
  writeFileSync(INDEX, JSON.stringify(index));
  console.log(`awards ${i / PEOPLE_PER_QUERY + 1}/${Math.ceil(todo.length / PEOPLE_PER_QUERY)}: ${JSON.parse(text).results.bindings.length} rows`);
  await sleep(500);
}
