#!/usr/bin/env node
// Builds src/data/famous.json: famous people grouped by the first name they go
// by, for the "Famous first names" game. Run with `npm run data:famous`.
//
// Fame comes first, names second. The obvious route — ask Wikidata for people
// whose given name is Tom — fails twice: Wikidata files Tom Cruise under
// "Thomas", and its query service silently omits some entities entirely (Tom
// Cruise and Tom Holland both came back empty on 2026-09-23 while the entity
// API had them). Its search index can match "given name Thomas" but returns
// 74,860 people in no useful order, with Cruise at 344th.
//
// So instead:
//   1. Wikimedia's monthly top-1000 most-read English Wikipedia articles,
//      2016 to last complete month. Summed views across those lists is the fame
//      score, which is what a pub quiz means by famous.
//   2. Resolve each article to Wikidata and keep humans (P31 = Q5).
//   3. Group by the first word of the article title — the name the public uses.
//
// Every fetch is cached under data-raw/, so an interrupted run resumes and a
// re-run with a different grouping rule costs no network at all.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';
const RAW = 'data-raw/famous';
const START_YEAR = 2016;
const MIN_PEOPLE_PER_NAME = 12; // a prompt needs enough answers to be a game
const KEEP_PER_NAME = 40;

mkdirSync(`${RAW}/top`, { recursive: true });
mkdirSync(`${RAW}/entities`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    await sleep(1000 * 2 ** i);
  }
  throw new Error(`failed after ${tries} tries: ${url}`);
}
const cached = async (path, fetcher) => {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const data = await fetcher();
  writeFileSync(path, JSON.stringify(data));
  return data;
};

// --------------------------------------------------------------- 1. top lists
const now = new Date();
const months = [];
for (let y = START_YEAR; y <= now.getFullYear(); y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === now.getFullYear() && m >= now.getMonth() + 1) break; // incomplete month
    months.push([y, String(m).padStart(2, '0')]);
  }
}

const views = new Map(); // article title -> summed views
const monthsSeen = new Map(); // article title -> months in the top 1000
let t0 = Date.now();
for (const [y, m] of months) {
  const data = await cached(`${RAW}/top/${y}-${m}.json`, () =>
    getJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/all-days`)
  );
  for (const a of data?.items?.[0]?.articles || []) {
    if (a.article.includes(':') || a.article === 'Main_Page') continue;
    views.set(a.article, (views.get(a.article) || 0) + a.views);
    monthsSeen.set(a.article, (monthsSeen.get(a.article) || 0) + 1);
  }
}
console.log(`top lists: ${months.length} months, ${views.size} distinct articles (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// ---------------------------------------------------------- 2. which are people
// wbgetentities by enwiki title, 50 per call. Cached per batch of titles.
const titles = [...views.keys()].sort();
const people = [];
t0 = Date.now();
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const data = await cached(`${RAW}/entities/${String(i / 50).padStart(4, '0')}.json`, async () => {
    const url =
      'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&sites=enwiki' +
      '&props=claims|descriptions|sitelinks|labels&languages=en&sitefilter=enwiki&titles=' +
      encodeURIComponent(batch.join('|'));
    const j = await getJson(url);
    // The API reports bad parameters as HTTP 200 with an `error` body. Throw,
    // or `cached` would save an empty batch and every later run would reuse it.
    // (That happened on the first run: normalize=1 is single-title only, and
    // all 519 batches were cached empty.)
    if (!j || j.error) throw new Error(`wbgetentities: ${j?.error?.info || 'no response'}`);
    // Keep only what is needed from claims; full claims are ~200 kB per batch.
    const slim = {};
    for (const [id, e] of Object.entries(j?.entities || {})) {
      if (e.missing !== undefined) continue;
      const claim = (p) => (e.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value);
      slim[id] = {
        id,
        title: e.sitelinks?.enwiki?.title,
        label: e.labels?.en?.value,
        description: e.descriptions?.en?.value,
        instanceOf: claim('P31').map((v) => v?.id),
        sex: claim('P21').map((v) => v?.id)[0] || null,
        born: claim('P569').map((v) => v?.time)[0] || null,
        died: claim('P570').map((v) => v?.time)[0] || null,
        occupations: claim('P106').map((v) => v?.id),
        citizenship: claim('P27').map((v) => v?.id)
      };
    }
    return slim;
  });
  for (const e of Object.values(data)) {
    if (!e.instanceOf.includes('Q5') || !e.title) continue;
    const key = e.title.replace(/ /g, '_');
    people.push({ ...e, views: views.get(key) || 0, monthsInTop: monthsSeen.get(key) || 0 });
  }
  if (i % 2000 === 0) process.stdout.write(`  entities ${i}/${titles.length}\r`);
}
console.log(`people: ${people.length} of ${titles.length} articles (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// --------------------------------------------------------------- 3. group
// The title minus any "(singer)"-style disambiguator is the public name.
// First token is the prompt; names that are a single token (Madonna, Pelé,
// Zendaya) have no first name to be asked about and drop out.
const displayName = (p) => p.title.replace(/\s*\(.*\)$/, '');
const groups = new Map();
for (const p of people) {
  const name = displayName(p);
  const parts = name.split(' ');
  if (parts.length < 2) continue;
  // "Emma of Normandy", "John the Baptist": no surname to type.
  if (parts[1] === 'of' || parts[1] === 'the') continue;
  const first = parts[0];
  if (!/^\p{Lu}[\p{L}'-]+$/u.test(first)) continue; // "J.", "50", "Al-"
  if (!groups.has(first)) groups.set(first, []);
  groups.get(first).push({
    id: p.id,
    name,
    rest: parts.slice(1).join(' '),
    description: p.description || '',
    born: p.born ? Number(p.born.slice(1, 5)) : null,
    died: p.died ? Number(p.died.slice(1, 5)) : null,
    sex: p.sex === 'Q6581072' ? 'f' : p.sex === 'Q6581097' ? 'm' : null,
    views: p.views,
    monthsInTop: p.monthsInTop
  });
}

const names = [...groups.entries()]
  .filter(([, list]) => list.length >= MIN_PEOPLE_PER_NAME)
  .map(([first, list]) => ({
    first,
    total: list.length,
    people: list.sort((a, b) => b.views - a.views).slice(0, KEEP_PER_NAME)
  }))
  .sort((a, b) => b.total - a.total);

console.log(`names with >= ${MIN_PEOPLE_PER_NAME} famous people: ${names.length}`);
console.log(names.slice(0, 25).map((n) => `${n.first} ${n.total}`).join(', '));
const noDesc = names.flatMap((n) => n.people).filter((p) => !p.description).length;
console.log(`people kept: ${names.reduce((n, x) => n + x.people.length, 0)}, without description: ${noDesc}`);

if (names.length < 20) throw new Error(`only ${names.length} usable names — a source or the join is broken`);

writeFileSync(
  'src/data/famous.json',
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    source: `English Wikipedia monthly top-1000 pageviews ${START_YEAR}-${months.at(-1).join('-')}`,
    names
  })
);
console.log('wrote src/data/famous.json');
