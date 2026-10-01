#!/usr/bin/env node
// Builds src/data/obscure.json: categories for Obscure-est, where any right
// answer scores but rarer right answers score more. Run with
// `npm run data:obscure` after the source data is rebuilt.
//
// Each category lists every valid answer with a score from 1 (the answer
// everyone gives) to 100 (the deepest cut). "Rare" is measured, not guessed,
// from the data behind each category:
//   countries and capitals  population (India is obvious, Bhutan is not)
//   famous people           English Wikipedia readership
//   songs                   summed year-end chart points
//   films                   summed box-office points (Best Picture nominees
//                           that never made the top 10 count as obscure)
// Scores are ranks within the category, so they mean the same everywhere.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { UA } from './lib/wikitable.mjs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const countries = load('src/data/countries.json').countries.filter((c) => c.sovereign);
const famous = load('src/data/famous.json').names;
const music = load('src/data/charts/music.json').years;
const films = load('src/data/charts/films.json');

const categories = [];

/**
 * `answers` is [{ text, accept, fame }], higher fame = more obvious. Scores
 * run 1 (most famous) to 100 (least), spread evenly by rank.
 */
const add = (id, prompt, kind, answers, min = 6) => {
  // Same text twice (two different George Floyds in the people data) keeps the
  // more famous one: last-write-wins scored the famous George Floyd 100.
  const byText = new Map();
  for (const a of answers) {
    const cur = byText.get(a.text);
    if (!cur || a.fame > cur.fame) byText.set(a.text, { ...a, accept: [...new Set([...(cur?.accept || []), ...(a.accept || [])])] });
  }
  const uniq = [...byText.values()];
  if (uniq.length < min) return;
  // An accepted name that is another answer's own name would score the wrong
  // one ("Congo" for DR Congo when the Republic of the Congo is also listed).
  const names = new Set(uniq.map((a) => a.text.toLowerCase()));
  for (const a of uniq) a.accept = (a.accept || []).filter((x) => x === a.text || !names.has(x.toLowerCase()));
  const sorted = uniq.sort((a, b) => b.fame - a.fame);
  const n = sorted.length;
  categories.push({
    id,
    prompt,
    kind,
    answers: sorted.map((a, i) => ({
      text: a.text,
      accept: [...new Set([a.text, ...(a.accept || [])])],
      score: n === 1 ? 50 : 1 + Math.round((99 * i) / (n - 1))
    }))
  });
};

// ------------------------------------------------------------------ geography
// Short alternative names are mostly ISO codes ("CD", "TZA") that nobody
// types, but all-capital initialisms people do use are kept: "DRC", "UAE",
// "USA". Former and short names players reach for are added by hand; "Congo"
// for DR Congo is dropped again in any category that also has the Republic
// of the Congo (see add()).
const EXTRA_NAMES = { 'DR Congo': ['Congo', 'Zaire'], Congo: ['Congo-Brazzaville', 'Republic of the Congo'] };
const PEOPLE_USE = new Set(['DRC', 'UAE', 'USA', 'UK']);
const country = (c) => ({
  text: c.name,
  accept: [c.officialName, ...c.altNames.filter((a) => a.length > 3 || PEOPLE_USE.has(a)), ...(EXTRA_NAMES[c.name] || [])],
  fame: c.population ?? 0
});
const byIso3 = new Map(countries.map((c) => [c.iso3, c]));
for (const c of countries) {
  const n = c.borders.map((b) => byIso3.get(b)).filter(Boolean);
  add(`borders-${c.code}`, `A country that borders ${c.name}`, 'geo', n.map(country));
}
const bySub = {};
for (const c of countries) (bySub[c.subregion] ||= []).push(c);
for (const [sub, list] of Object.entries(bySub)) {
  add(`in-${sub}`, `A country in ${sub}`, 'geo', list.map(country));
  add(
    `cap-${sub}`,
    `A capital city in ${sub}`,
    'geo',
    list.filter((c) => c.capitals[0]).map((c) => ({ text: c.capitals[0], accept: [...c.capitals, ...c.capitalsAlsoAccepted], fame: c.population ?? 0 }))
  );
}
const byRegion = {};
for (const c of countries) (byRegion[c.region] ||= []).push(c);
for (const [region, list] of Object.entries(byRegion)) {
  add(`landlocked-${region}`, `A landlocked country in ${region}`, 'geo', list.filter((c) => c.landlocked).map(country), 5);
}

// ------------------------------------------------------------------ people
for (const n of famous) {
  if (n.people.length < 15) continue;
  add(
    `name-${n.first}`,
    `A famous person called ${n.first}`,
    'people',
    // Surname alone, including the last word of a longer one ("Washington"
    // for John David Washington), as in the famous-names game.
    n.people.map((p) => {
      const last = p.rest.split(' ').at(-1);
      return { text: p.name, accept: [p.rest, ...(last.length >= 3 ? [last] : [])], fame: p.views };
    }),
    15
  );
}

// ------------------------------------------------------------------ music
const songsBy = {};
for (const list of Object.values(music)) {
  for (const s of list) {
    for (const a of s.artists || [s.artist]) {
      const title = s.title.split(' / ')[0];
      const cur = ((songsBy[a] ||= {})[title] ||= { text: title, accept: s.titles || [], fame: 0 });
      cur.fame += 101 - s.rank;
    }
  }
}
for (const [artist, songs] of Object.entries(songsBy)) {
  add(`songs-${artist}`, `A hit song by ${artist}`, 'music', Object.values(songs), 8);
}

// ------------------------------------------------------------------ films
// "A film directed by X" used to list only X's films from our box-office
// top-10s and Best Picture nominees: 22 Spielberg films, 7 Curtiz. So right
// answers such as Catch Me If You Can scored 0 as "not on the list", and
// Casablanca counted as a deep cut. Now each director's full feature-film
// list comes from Wikidata (films whose director, P57, is them), and fame is
// the number of Wikipedia language editions with an article on the film,
// which puts Schindler's List and Jurassic Park at the obvious end and
// Firelight at the rare end. Directors are those with 5+ films in our charts.
const chartFilms = {};
for (const chart of [films.boxOffice, films.bestPicture]) {
  for (const list of Object.values(chart)) {
    for (const f of list) for (const d of f.artists || [f.artist]) if (d !== 'Unknown director') chartFilms[d] = (chartFilms[d] || 0) + 1;
  }
}
const directors = Object.keys(chartFilms).filter((d) => chartFilms[d] >= 5);

const FILM_CACHE = 'data-raw/obscure/filmographies-v2'; // v2: with aliases
mkdirSync(FILM_CACHE, { recursive: true });
const wd = async (params) => {
  const url = `https://www.wikidata.org/w/api.php?format=json&${new URLSearchParams(params)}`;
  for (let i = 0; i < 4; i++) {
    // A dropped connection throws rather than returning a bad status; retry both.
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      if (j.error) throw new Error(`wikidata: ${j.error.info}`);
      return j;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`wikidata: failed after retries: ${url}`);
};
const directedBy = async (qid) =>
  (await wd({ action: 'query', list: 'search', srsearch: `haswbstatement:P57=${qid}`, srlimit: 500, srprop: '' })).query.search.map((r) => r.title);
// Feature films only: film, animated film, TV film. Not shorts, series,
// episodes, franchises or unfinished projects.
const FILM_TYPES = new Set(['Q11424', 'Q202866', 'Q506240', 'Q24869', 'Q1054574', 'Q130232', 'Q2484376']);
const NOT_A_FILM = new Set(['Q24862', 'Q5398426', 'Q21191270', 'Q24856', 'Q18011171', 'Q18011172', 'Q13593818']);
const thisYear = new Date().getFullYear();

async function filmography(name) {
  const path = `${FILM_CACHE}/${name.replace(/[^\w]+/g, '_')}.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  // The person, not a namesake: of the top search hits, the one credited as
  // director on the most items ("John Ford" also names a 17th-century poet).
  const hits = (await wd({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: 4 })).search;
  let best = { qid: null, ids: [] };
  for (const h of hits) {
    const ids = await directedBy(h.id);
    if (ids.length > best.ids.length) best = { qid: h.id, ids };
  }
  const out = [];
  for (let i = 0; i < best.ids.length; i += 50) {
    const j = await wd({ action: 'wbgetentities', ids: best.ids.slice(i, i + 50).join('|'), props: 'claims|sitelinks|labels|aliases', languages: 'en' });
    for (const e of Object.values(j.entities)) {
      const types = (e.claims?.P31 || []).map((c) => c.mainsnak.datavalue?.value.id);
      const year = Number((e.claims?.P577 || [])[0]?.mainsnak.datavalue?.value.time?.slice(1, 5)) || null;
      out.push({ id: e.id, title: e.sitelinks?.enwiki?.title || null, label: e.labels?.en?.value || null, aliases: (e.aliases?.en || []).map((a) => a.value), types, year, editions: Object.keys(e.sitelinks || {}).length });
    }
  }
  // Never cache an empty answer: a search index that briefly returns nothing
  // would otherwise drop the director's category until the file is deleted.
  if (!out.length) throw new Error(`no films found for ${name}; not caching, re-run to retry`);
  const result = { name, qid: best.qid, films: out };
  writeFileSync(path, JSON.stringify(result));
  return result;
}

const filmStats = [];
for (const d of directors) {
  const f = await filmography(d);
  const kept = f.films.filter(
    (x) => x.title && x.year && x.year <= thisYear && x.types.some((t) => FILM_TYPES.has(t)) && !x.types.some((t) => NOT_A_FILM.has(t))
  );
  const answers = kept.map((x) => {
    const shown = x.title.replace(/\s*\([^)]*\)$/, ''); // "Jaws (film)" -> "Jaws"
    // Other titles count too: "A New Hope", US "Sorcerer's Stone", "E.T.".
    return { text: shown, accept: [shown, x.label, shown.replace(/^The /, ''), ...(x.aliases || [])].filter(Boolean), fame: x.editions };
  });
  filmStats.push(`${d} ${answers.length}`);
  add(`films-${d}`, `A film directed by ${d}`, 'film', answers, 6);
}
console.log(`films: ${directors.length} directors; feature films each: ${filmStats.join(', ')}`);

const byKind = {};
for (const c of categories) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
console.log(`${categories.length} categories: ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const id of ['borders-CN', 'name-Tom', 'songs-Madonna', 'films-Steven Spielberg']) {
  const c = categories.find((x) => x.id === id);
  if (c) console.log(`${c.prompt}: obvious ${c.answers.slice(0, 2).map((a) => `${a.text}=${a.score}`).join(', ')} … rare ${c.answers.slice(-2).map((a) => `${a.text}=${a.score}`).join(', ')}`);
}
if (categories.length < 100) throw new Error('too few categories');
writeFileSync('src/data/obscure.json', JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), categories }));
console.log('wrote src/data/obscure.json');
