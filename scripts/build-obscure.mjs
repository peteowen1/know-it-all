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

import { readFileSync, writeFileSync } from 'node:fs';

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
  const uniq = [...new Map(answers.map((a) => [a.text, a])).values()];
  if (uniq.length < min) return;
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
const country = (c) => ({ text: c.name, accept: [c.officialName, ...c.altNames.filter((a) => a.length > 3)], fame: c.population ?? 0 });
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
    n.people.map((p) => ({ text: p.name, accept: [p.rest], fame: p.views })),
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
const filmsBy = {};
for (const [chart, weight] of [[films.boxOffice, 1], [films.bestPicture, 0]]) {
  for (const list of Object.values(chart)) {
    for (const f of list) {
      for (const d of f.artists || [f.artist]) {
        if (d === 'Unknown director') continue;
        const cur = ((filmsBy[d] ||= {})[f.title] ||= { text: f.title, fame: 0 });
        cur.fame += weight * (11 - f.rank);
      }
    }
  }
}
for (const [director, fs] of Object.entries(filmsBy)) {
  add(`films-${director}`, `A film directed by ${director}`, 'film', Object.values(fs), 6);
}

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
