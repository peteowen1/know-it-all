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
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fromRoot, writeData } from './lib/output.mjs';
import { leftOutByRule } from './lib/famousRules.mjs';
import { loadWorks, worksClue } from './lib/famousWorks.mjs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';
const RAW = fromRoot('data-raw/famous');
const START_YEAR = 2016;
const MIN_PEOPLE_PER_NAME = 12; // a prompt needs enough answers to be a game
const KEEP_PER_NAME = 60;
// Extra people fetched per name so that leaving notorious people out (step 5)
// still leaves a full list, rather than shrinking boards below the 15 the game shows:
// trimming first dropped 8 boards, Carlos among them.
const SPARE_PER_NAME = 25;

mkdirSync(`${RAW}/top`, { recursive: true });
mkdirSync(`${RAW}/entities`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    await sleep(1000 * 2 ** i);
  }
  throw new Error(`failed after ${tries} tries: ${url}`);
}
// Raw responses are saved as returned (gzipped) and everything is derived on
// reading, so a different cut of the data never needs a second scrape.
const cachedRaw = async (path, fetcher) => {
  if (existsSync(path)) return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
  const data = await fetcher();
  writeFileSync(path, gzipSync(JSON.stringify(data)));
  return data;
};
const fileSafe = (title) => encodeURIComponent(title).replace(/[%*]/g, '~');
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
// wbgetentities by enwiki title, 50 per call. Cached per batch of titles, in
// `dir`, keyed by position in the sorted list, so each source keeps its own
// folder (adding titles to one list must not shift the other's batches).
function slimEntities(j) {
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
}

// `byContent` names each batch's cache file after its titles rather than its
// position, so a list that grows between runs never reads another batch's file.
async function peopleAmong(list, dir, { byContent = false } = {}) {
  mkdirSync(`${RAW}/${dir}`, { recursive: true });
  const out = [];
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const base = `${RAW}/${dir}/${byContent ? createHash('sha1').update(batch.join('|')).digest('hex').slice(0, 16) : String(i / 50).padStart(4, '0')}`;
    // Batches from runs before 2026-10-18 were saved already slimmed (.json);
    // newer ones keep the whole response (.raw.json.gz).
    const data = existsSync(`${base}.json`)
      ? JSON.parse(readFileSync(`${base}.json`, 'utf8'))
      : slimEntities(await cachedRaw(`${base}.raw.json.gz`, async () => {
          const url =
            'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&sites=enwiki' +
            '&props=claims|descriptions|sitelinks|labels&languages=en&sitefilter=enwiki&titles=' +
            encodeURIComponent(batch.join('|'));
          const j = await getJson(url);
          // The API reports bad parameters as HTTP 200 with an `error` body. Throw,
          // or the cache would save an empty batch and every later run would reuse it.
          if (!j || j.error) throw new Error(`wbgetentities: ${j?.error?.info || 'no response'}`);
          return j;
        }));
    for (const e of Object.values(data)) if (e.instanceOf.includes('Q5') && e.title) out.push(e);
    if (i % 2000 === 0) process.stdout.write(`  ${dir} ${i}/${list.length}\r`);
  }
  return out;
}

t0 = Date.now();
const titles = [...views.keys()].sort();
const fromTop = await peopleAmong(titles, 'entities');

// Long-run fame. The monthly top 1000 only sees people who spike: Mark Twain
// draws over a million reads a year but never makes a month's top 1000, so he
// was missing from the Marks while Mark Kerr (one film, 2025) was 6th. Wikipedia's
// own lists of the most important people (Vital articles, levels 4 and 5) add
// the steady ones.
// Every page under these roots is read: at level 4 the parent page holds the
// links, at level 5 (~15,000 people, which is where Bob Hope and Frank Zappa
// are) the section pages do. Wikipedia's API rate-limits bursts, so requests
// are spaced out; the list is cached once fetched.
const VITAL_ROOTS = ['Vital articles/Level 4/People', 'Vital articles/Level 5/People'];
const vitalTitles = await cached(`${RAW}/vital-people.json`, async () => {
  const api = async (params) => {
    await sleep(400);
    const j = await getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`);
    if (!j || j.error) throw new Error(`vital articles: ${j?.error?.info || 'no response'}`);
    return j;
  };
  const pages = [];
  for (const root of VITAL_ROOTS) {
    const j = await api({ action: 'query', list: 'allpages', apnamespace: '4', apprefix: root, aplimit: 'max' });
    pages.push(...j.query.allpages.map((p) => p.title));
  }
  const found = new Set();
  for (const page of pages) {
    let cont = {};
    do {
      const j = await api({ action: 'query', prop: 'links', titles: page, plnamespace: '0', pllimit: 'max', ...cont });
      for (const p of Object.values(j.query?.pages || {})) for (const l of p.links || []) found.add(l.title);
      cont = j.continue || null;
    } while (cont);
  }
  if (found.size < 5000) throw new Error(`only ${found.size} vital articles found in ${pages.length} pages; the page layout may have changed`);
  return [...found].sort();
});
const seenTitle = new Set(fromTop.map((e) => e.title));
const fromVital = (await peopleAmong(vitalTitles.filter((t) => !views.has(t.replace(/ /g, '_'))), 'entities-vital')).filter((e) => !seenTitle.has(e.title));

// Fame: every candidate's total English Wikipedia reads over the whole window,
// month by month. Summing only the months someone was in the top 1000 scored a
// one-month spike above decades of steady reading. One request per person
// (~1.5 s, network-bound), so 16 run at once (about 10 a second, well under
// the pageviews API limit) and every total is saved as it
// arrives: a run stopped part way keeps what it fetched.
// The title minus any "(singer)"-style disambiguator is the public name.
// First token is the prompt; names that are a single token (Madonna, Pelé,
// Zendaya) have no first name to be asked about and drop out.
const displayName = (p) => p.title.replace(/\s*\(.*\)$/, '');
// Spellings that sound the same share one board, so Billie Eilish counts as a
// famous Billy. Nicknames do not (Bill Gates is not a Billy, Kate is not
// Catherine): the public knows each person by one form. John and Jon stay
// apart because John alone has ~150 people and no Jon would make its top 15.
const SAME_SOUND = [
  ['Billy', 'Billie'], ['Sean', 'Shaun', 'Shawn'], ['Stephen', 'Steven'], ['Sarah', 'Sara'],
  ['Mohamed', 'Mohammed', 'Muhammad'], ['Catherine', 'Katherine', 'Kathryn'], ['Brian', 'Bryan'],
  ['Eric', 'Erik'], ['Anne', 'Ann'], ['Philip', 'Phillip'], ['Jeffrey', 'Geoffrey'], ['Alan', 'Allan', 'Allen'],
  ['Matthew', 'Mathew'], ['Nicholas', 'Nicolas']
];
const boardOf = new Map(SAME_SOUND.flatMap((g) => g.map((n) => [n, g[0]])));

// Words that lead a name without being a first name: titles and honorifics
// ("The Buddha", "Princess Margaret", "Abu Bakr", "Ma Rainey"), and family
// names written first ("Wang Jianlin", "Park Chung Hee", "Ma Long"), which the
// vital articles brought in. Lee and Kim stay: both are common first names too
// (Kim Kardashian), so those boards mix the two, as they always have.
const NOT_FIRST_NAMES = new Set([
  'The', 'King', 'Queen', 'Prince', 'Princess', 'Emperor', 'Empress', 'Pope', 'Saint', 'St.', 'Sir', 'Lord', 'Lady',
  'Duke', 'Duchess', 'Abu', 'Ibn', 'Ma', 'Mother', 'Sister', 'Brother', 'Father', 'General', 'President',
  'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Hu', 'Zhu', 'Gao', 'Lin',
  'Guo', 'Luo', 'Liang', 'Song', 'Zheng', 'Xie', 'Tang', 'Feng', 'Deng', 'Cao', 'Xi', 'Mao', 'Jiang', 'Yuan',
  'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Shin', 'Nguyen', 'Tran'
]);

/** The board a person goes on, or null if their name has no first name to ask about. */
const boardFor = (p) => {
  const parts = displayName(p).split(' ');
  if (parts.length < 2) return null;
  // "Emma of Normandy", "John the Baptist": no surname to type.
  if (parts[1] === 'of' || parts[1] === 'the') return null;
  if (!/^\p{Lu}[\p{L}'-]+$/u.test(parts[0])) return null; // "J.", "50", "Al-"
  if (NOT_FIRST_NAMES.has(parts[0])) return null;
  return boardOf.get(parts[0]) || parts[0];
};

// One request per person, saved as returned in data-raw/famous/pageviews/
// (one gzipped file per article: every monthly row with all its fields), so
// the fame window or any other cut can change without fetching again. A file
// is fetched again only once a newer complete month exists than its last row.
const PV_DIR = `${RAW}/pageviews`;
mkdirSync(PV_DIR, { recursive: true });
const [fy, fm] = months[0];
const [ly, lm] = months.at(-1);
const through = `${ly}-${lm}`;
const lastDay = new Date(Number(ly), Number(lm), 0).getDate();
const pvPath = (title) => `${PV_DIR}/${fileSafe(title)}.json.gz`;
const readPv = (title) => (existsSync(pvPath(title)) ? JSON.parse(gunzipSync(readFileSync(pvPath(title))).toString('utf8')) : null);
const lastRow = (pv) => {
  const t = pv?.items?.at(-1)?.timestamp;
  return t ? `${t.slice(0, 4)}-${t.slice(4, 6)}` : null;
};
const fetchPv = async (title) => {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/${fy}${fm}0100/${ly}${lm}${lastDay}00`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  // A 404 (no views recorded) is an answer too; save it so it is not re-asked.
  const body = res.status === 404 ? { status: 404, items: [] } : res.ok ? await res.json() : null;
  if (!body) throw new Error(`pageviews ${res.status}: ${title}`);
  writeFileSync(pvPath(title), gzipSync(JSON.stringify(body)));
};
// Steady fame that both sources above miss: Jason Derulo, Emma Bunton and
// Billy Idol never top a month and are not vital articles. For every first
// name with a board (each spelling of a shared board), Wikipedia's title
// search for "Jason " lists up to 100 pages starting with it, ranked by how
// much each is read and linked (Derulo 5th, Bunton 7th, Idol 15th). Each
// response is saved raw in data-raw/famous/prefix/.
const PREFIX_DIR = `${RAW}/prefix`;
mkdirSync(PREFIX_DIR, { recursive: true });
const earlyBoards = new Map();
for (const e of [...fromTop, ...fromVital]) {
  const b = boardFor(e);
  if (b) earlyBoards.set(b, (earlyBoards.get(b) || 0) + 1);
}
const prefixTitles = new Set();
for (const [b, n] of earlyBoards) {
  if (n < MIN_PEOPLE_PER_NAME) continue;
  for (const spelling of SAME_SOUND.find((g) => g[0] === b) || [b]) {
    const j = await cachedRaw(`${PREFIX_DIR}/${fileSafe(spelling)}.json.gz`, async () => {
      await sleep(300);
      const r = await getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', list: 'prefixsearch', pssearch: `${spelling} `, pslimit: 'max', psnamespace: '0', format: 'json' })}`);
      if (!r || r.error) throw new Error(`prefixsearch ${spelling}: ${r?.error?.info || 'no response'}`);
      return r;
    });
    // Past the exact matches the search pads with loose ones ("Email" for Emma).
    for (const x of j.query?.prefixsearch || []) if (x.title.startsWith(`${spelling} `)) prefixTitles.add(x.title);
  }
}
const knownTitles = new Set([...fromTop, ...fromVital].map((e) => e.title));
const vitalSet = new Set(vitalTitles);
const fromPrefix = (
  await peopleAmong(
    [...prefixTitles].filter((t) => !knownTitles.has(t) && !views.has(t.replace(/ /g, '_')) && !vitalSet.has(t)).sort(),
    'entities-prefix',
    { byContent: true }
  )
).filter((e) => !knownTitles.has(e.title));
console.log(`title search: ${prefixTitles.size} titles for ${[...earlyBoards.values()].filter((n) => n >= MIN_PEOPLE_PER_NAME).length} names, ${fromPrefix.length} new people`);

const boardSize = new Map();
for (const e of [...fromTop, ...fromVital, ...fromPrefix]) {
  const b = boardFor(e);
  if (b) boardSize.set(b, (boardSize.get(b) || 0) + 1);
}
const candidates = [...fromTop, ...fromVital, ...fromPrefix].filter((e) => (boardSize.get(boardFor(e)) || 0) >= MIN_PEOPLE_PER_NAME);
const todo = candidates.map((e) => e.title).filter((t) => {
  const pv = readPv(t);
  return !pv || (pv.status !== 404 && lastRow(pv) < through);
});
console.log(`page views to fetch: ${todo.length} of ${candidates.length} candidates (about ${Math.ceil(todo.length / 200)} min at 5 at a time)`);
if (process.env.COUNT_ONLY) process.exit(0);
let done = 0;
// Wikimedia rate-limited 16 at once (429 after ~400), so 5 at a time.
for (let i = 0; i < todo.length; i += 5) {
  const batch = todo.slice(i, i + 5);
  // A failed request is retried with backoff; one that keeps failing stops the
  // run, and everything saved so far stays.
  await Promise.all(batch.map(async (t) => {
    for (let k = 0; k < 6; k++) {
      try { return await fetchPv(t); } catch (err) { if (k === 5) throw err; await sleep(/ 429:/.test(err.message) ? 60000 : 1000 * 2 ** k); }
    }
  }));
  done += batch.length;
  if (done % 400 < 5) process.stdout.write(`  page views ${done}/${todo.length} (${((Date.now() - t0) / 60000).toFixed(1)} min)\r`);
}

// The fame window: every month from FAME_FROM to the last complete month.
// Set FAME_FROM=2021-10 (say) for the last five years; the default is the whole
// span the top lists cover.
const FAME_FROM = process.env.FAME_FROM || `${START_YEAR}-01`;
const fromMonth = FAME_FROM.replace('-', '');
const fame = (title) => (readPv(title)?.items || []).reduce((sum, x) => (x.timestamp.slice(0, 6) >= fromMonth ? sum + x.views : sum), 0);
// One entry per person: two titles can lead to the same Wikidata item (a top
// list's "Luis Suárez" and a vital article's link), which put him on the Luis
// board twice. The better-read title is kept.
const byId = new Map();
for (const e of candidates) {
  const key = e.title.replace(/ /g, '_');
  const p = { ...e, views: fame(e.title), monthsInTop: monthsSeen.get(key) || 0 };
  if (!byId.has(e.id) || p.views > byId.get(e.id).views) byId.set(e.id, p);
}
const people = [...byId.values()];
console.log(`people: ${fromTop.length} from the top lists + ${fromVital.length} vital articles + ${fromPrefix.length} from title search; ${todo.length} fetched; fame = views ${FAME_FROM} to ${through} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);


// --------------------------------------------------------------- 3. group

const wikidataYear = (t) => (t ? (t[0] === '-' ? -1 : 1) * Number(t.slice(1, 5)) : null);

const groups = new Map();
for (const p of people) {
  const board = boardFor(p);
  if (!board) continue;
  const name = displayName(p);
  const parts = name.split(' ');
  const first = parts[0];
  if (!groups.has(board)) groups.set(board, []);
  groups.get(board).push({
    id: p.id,
    title: p.title,
    first,
    name,
    rest: parts.slice(1).join(' '),
    description: p.description || '',
    // Wikidata times are "+1962-07-03T..." or "-0083-01-14T..." (BC): keep the
    // sign, or Mark Antony is born in AD 83.
    born: wikidataYear(p.born),
    died: wikidataYear(p.died),
    sex: p.sex === 'Q6581072' ? 'f' : p.sex === 'Q6581097' ? 'm' : null,
    views: p.views,
    monthsInTop: p.monthsInTop
  });
}

const names = [...groups.entries()]
  .filter(([, list]) => list.length >= MIN_PEOPLE_PER_NAME)
  .map(([board, list]) => {
    // Spellings on a merged board, commonest first; a board label like
    // "Billy / Billie". A single-spelling board is labelled by that name.
    const counts = {};
    for (const p of list) counts[p.first] = (counts[p.first] || 0) + 1;
    const spellings = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const people = list.sort((a, b) => b.views - a.views).slice(0, KEEP_PER_NAME + SPARE_PER_NAME);
    if (spellings.length === 1) for (const p of people) delete p.first;
    return {
      first: spellings.length > 1 ? spellings.join(' / ') : board,
      ...(spellings.length > 1 ? { spellings } : {}),
      total: list.length,
      people
    };
  })
  .sort((a, b) => b.total - a.total);

// ------------------------------------------------------- 4. descriptions
// Wikidata's English descriptions are edited with little oversight: on
// 2026-10-01 Carlos Vela's read "Mexican footballer (born 2024)" and Carlos
// Queiroz's had been replaced with a Spanish joke. English Wikipedia's own
// short descriptions are set on the article and watched far more closely, so
// they come first; Wikidata's is the fallback. A "born YYYY" in a Wikidata
// fallback that disagrees with the structured birth date is corrected from
// it. Wikipedia's text is never rewritten: checked on 2026-10-01, where the
// two disagreed it was usually the structured date that was wrong.
const kept = names.flatMap((n) => n.people);
// Cached per title, and only titles not yet in the cache are fetched, so a
// change to who is kept never leaves newcomers on Wikidata's text. A title
// Wikipedia has no description for is stored as null so it is not re-asked.
const DESC_CACHE = `${RAW}/enwiki-descriptions.json`;
const shortDesc = existsSync(DESC_CACHE) ? JSON.parse(readFileSync(DESC_CACHE, 'utf8')) : {};
const toFetch = kept.map((p) => p.title).filter((t) => !(t in shortDesc));
for (let i = 0; i < toFetch.length; i += 50) {
  const batch = toFetch.slice(i, i + 50);
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&prop=description&format=json&formatversion=2&titles=' +
    encodeURIComponent(batch.join('|'));
  const j = await getJson(url);
  if (!j || j.error) throw new Error(`enwiki descriptions: ${j?.error?.info || 'no response'}`);
  const got = {};
  for (const page of j.query?.pages || []) got[page.title] = page.description || null;
  // Titles come back normalised ("Carlos_Vela" -> "Carlos Vela"); map those back.
  for (const n of j.query?.normalized || []) got[n.from] = got[n.to] ?? null;
  for (const t of batch) shortDesc[t] = got[t] ?? null;
  writeFileSync(DESC_CACHE, JSON.stringify(shortDesc));
}
if (toFetch.length) console.log(`fetched ${toFetch.length} Wikipedia descriptions`);
const descStats = { enwiki: 0, wikidata: 0, none: 0, yearFixed: 0 };
for (const p of kept) {
  // A title that resolves to a disambiguation page (Luis Suárez) brings back
  // that page's description; Wikidata's is used instead.
  const wiki = /^topics referred to by the same term/i.test(shortDesc[p.title] || '') ? null : shortDesc[p.title];
  if (wiki) { p.description = wiki; descStats.enwiki++; }
  else if (p.description) descStats.wikidata++;
  else descStats.none++;
  const said = /\bborn (\d{4})\b/.exec(p.description);
  if (!wiki && said && p.born && Number(said[1]) !== p.born) {
    p.description = p.description.replace(said[0], `born ${p.born}`);
    descStats.yearFixed++;
  }
  delete p.title;
}
console.log('descriptions from:', descStats);

// ---------------------------------------------------------- 5. who to leave out
// The rule (Pete, 2026-10-01: people known mainly for violent or sexual crimes,
// or as their victims) lives in lib/famousRules.mjs, shared with the tests.
// Also dropped: articles about a trial or case rather than a person.
// Pete's calls on individual people live in scripts/famous-left-out.csv: its
// `decision` column overrides the rule ("in" keeps someone the rule would
// drop, "out" drops someone it would keep). The file is rewritten each build
// with everyone the rule catches plus everyone with a decision, keeping the
// decisions, so it is always the current list to comb through.
const REVIEW_CSV = fromRoot('scripts/famous-left-out.csv');
const parseCsvLine = (line) => {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  return [...out, cur];
};
const decisions = new Map();
if (existsSync(REVIEW_CSV)) {
  const [head, ...lines] = readFileSync(REVIEW_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(head);
  for (const line of lines) {
    const row = Object.fromEntries(parseCsvLine(line).map((v, i) => [cols[i], v.trim()]));
    if (row.id && /^(in|out)$/i.test(row.decision)) decisions.set(row.id, row.decision.toLowerCase());
  }
}
const reviewRows = [];
let leftOut = 0;
for (const n of names) {
  const before = n.people.length;
  n.people = n.people.filter((p) => {
    const byRule = leftOutByRule(p.description, p.name);
    const decision = decisions.get(p.id) || '';
    if (byRule || decision) reviewRows.push({ id: p.id, name: p.name, board: n.first, description: p.description, views: p.views, rule: byRule ? 'left out' : 'kept', decision });
    const out = decision ? decision === 'out' : byRule;
    if (out) leftOut++;
    return !out;
  });
  n.total -= before - n.people.length;
  n.people = n.people.slice(0, KEEP_PER_NAME);
}
// A name left with too few people after that is no longer a game.
for (let i = names.length - 1; i >= 0; i--) if (names[i].total < MIN_PEOPLE_PER_NAME) names.splice(i, 1);
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const cols = ['name', 'board', 'description', 'views', 'rule', 'decision', 'id'];
writeFileSync(
  REVIEW_CSV,
  [cols.join(','), ...reviewRows.sort((a, b) => b.views - a.views).map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n'
);
console.log(`left out as notorious: ${leftOut} (${decisions.size} of Pete's decisions applied); review list: ${REVIEW_CSV}`);

console.log(`names with >= ${MIN_PEOPLE_PER_NAME} famous people: ${names.length}`);
console.log(names.slice(0, 25).map((n) => `${n.first} ${n.total}`).join(', '));
const noDesc = names.flatMap((n) => n.people).filter((p) => !p.description).length;
console.log(`people kept: ${names.reduce((n, x) => n + x.people.length, 0)}, without description: ${noDesc}`);

if (names.length < 20) throw new Error(`only ${names.length} usable names — a source or the join is broken`);

// Who am I's third clue, for the top 15 of each name (the people it uses):
// best-known works from the raw files scripts/fetch-famous-works.mjs saves.
// Run that first for any new top-15 people.
const works = loadWorks(RAW);
let withWorks = 0;
for (const n of names) {
  for (const p of n.people.slice(0, 15)) {
    const known = worksClue(p, works);
    if (known) (p.known = known), withWorks++;
  }
}
console.log(`works clues: ${withWorks} of ${names.reduce((s, n) => s + Math.min(15, n.people.length), 0)} top-15 people`);
// data-raw is not in git: on a machine without the works files every clue
// would vanish and Who am I would have no rounds. 2,972 on 2026-10-20.
if (withWorks < 2500) throw new Error(`only ${withWorks} works clues; run node scripts/fetch-famous-works.mjs first`);

writeData('famous.json', {
  source: `English Wikipedia pageviews ${FAME_FROM} to ${through}, every month, for people in a monthly top 1000, in Wikipedia's vital articles, or with an article titled by the first name`,
  names
});
