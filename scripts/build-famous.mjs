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
// Extra people fetched per name so that leaving notorious people out (step 5)
// still leaves 40, rather than shrinking boards below the 15 the game shows:
// trimming first dropped 8 boards, Carlos among them.
const SPARE_PER_NAME = 25;

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

const groups = new Map();
for (const p of people) {
  const name = displayName(p);
  const parts = name.split(' ');
  if (parts.length < 2) continue;
  // "Emma of Normandy", "John the Baptist": no surname to type.
  if (parts[1] === 'of' || parts[1] === 'the') continue;
  const first = parts[0];
  if (!/^\p{Lu}[\p{L}'-]+$/u.test(first)) continue; // "J.", "50", "Al-"
  const board = boardOf.get(first) || first;
  if (!groups.has(board)) groups.set(board, []);
  groups.get(board).push({
    id: p.id,
    title: p.title,
    first,
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
  const wiki = shortDesc[p.title];
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
// Pageviews make serial killers and murder victims "famous", and easy mode
// printed clues like "American serial killer". Pete chose (2026-10-01) to
// leave out people known mainly for violent or sexual crimes, or for being
// their victims; the board fills from the next most famous. Fraudsters and
// other non-violent offenders stay (Abagnale, Bankman-Fried). Also dropped:
// articles about a trial rather than a person ("Michael Peterson trial").
const NOTORIOUS = /\b(serial killer|spree killer|mass (murderer|shooter)|murderer|murdered|killer of|assassin|rapist|sex(ual)? (offender|abuser|predator)|child (molester|sex)|pedophile|paedophile|terrorist|hijacker|mobster|gangster|drug (lord|trafficker)|cult (leader|founder)|murder victim|victim of)\b|(?<!wrongfully )convicted of (murder|rape)/i;
// Descriptions that mention a crime without being about a criminal: a
// "criminal defense attorney", the nurse who "helped stop a serial killer".
const NOT_NOTORIOUS = /defen[cs]e (attorney|lawyer)|helped (stop|catch)/i;
// Pete's calls on individual people live in scripts/famous-left-out.csv: its
// `decision` column overrides the rule ("in" keeps someone the rule would
// drop, "out" drops someone it would keep). The file is rewritten each build
// with everyone the rule catches plus everyone with a decision, keeping the
// decisions, so it is always the current list to comb through.
const REVIEW_CSV = 'scripts/famous-left-out.csv';
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
    const byRule = (NOTORIOUS.test(p.description) && !NOT_NOTORIOUS.test(p.description)) || /\btrial\b/i.test(p.name);
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

writeFileSync(
  'src/data/famous.json',
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    source: `English Wikipedia monthly top-1000 pageviews ${START_YEAR}-${months.at(-1).join('-')}`,
    names
  })
);
console.log('wrote src/data/famous.json');
