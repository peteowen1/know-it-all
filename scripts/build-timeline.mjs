#!/usr/bin/env node
// Builds src/data/timeline.json: dated one-line events for the Timeline game,
// drawn from data the other games already use. Run with `npm run data:timeline`
// after any of those sources is rebuilt.
//
// Every event is a sentence plus a year. Only facts a quiz-goer could date
// roughly are used: chart and box-office number ones, Best Picture and Emmy
// winners, leaders taking office, and births of the best-known people.
// Built offline so the game does not ship the full chart files (~1.4 MB).

import { readFileSync, writeFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const music = load('src/data/charts/music.json').years;
const films = load('src/data/charts/films.json');
const tv = load('src/data/charts/tv.json');
const lists = load('src/data/lists.json').lists;
const famous = load('src/data/famous.json').names;

const events = [];
const add = (kind, year, text) => {
  if (Number.isFinite(year) && text) events.push({ kind, year, text });
};
const short = (s) => s.split(' / ')[0];

// Chart and box-office number ones, and the Oscar and Emmy winners.
for (const [y, list] of Object.entries(music)) {
  add('music', Number(y), `"${short(list[0].title)}" (${list[0].artist}) is Billboard's biggest song of the year`);
}
for (const [y, list] of Object.entries(films.boxOffice)) {
  add('film', Number(y), `${list[0].title} is the year's top-grossing new film`);
}
for (const [y, list] of Object.entries(films.bestPicture)) {
  add('oscars', Number(y), `${list[0].title} wins Best Picture (for that year's films)`);
}
for (const [key, label] of [['emmyDrama', 'Outstanding Drama'], ['emmyComedy', 'Outstanding Comedy']]) {
  for (const [y, list] of Object.entries(tv[key])) add('tv', Number(y), `${list[0].title} wins the Emmy for ${label} Series`);
}

// Leaders taking office. A returning leader's later terms are skipped: "Rudd
// becomes PM" twice in one pool is a trap with two right years.
const office = { auPM: 'Prime Minister of Australia', usPres: 'President of the United States', ukPM: 'UK Prime Minister' };
for (const [key, title] of Object.entries(office)) {
  const seen = new Set();
  for (const t of lists[key].terms) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    add('leaders', t.from, `${t.name} becomes ${title}`);
  }
}

// Births of lastingly famous people: at most two per first name, and only
// those in Wikipedia's monthly top 1,000 for two years or more. One news spike
// is not enough ("Christopher Scarver is born" slipped through before this).
for (const n of famous) {
  for (const p of n.people.filter((x) => x.born && x.born >= 1900 && x.monthsInTop >= 24).slice(0, 2)) {
    add('people', p.born, `${p.name} is born`);
  }
}

// One event per text: the same sentence twice with two years would be unfair.
const byText = new Map();
for (const e of events) if (!byText.has(e.text)) byText.set(e.text, e);
const out = [...byText.values()].sort((a, b) => a.year - b.year);

const byKind = {};
for (const e of out) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
console.log(`${out.length} events, ${out[0].year}-${out.at(-1).year}: ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (out.length < 500) throw new Error('too few events; a source is missing');

writeFileSync('src/data/timeline.json', JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), events: out }));
console.log('wrote src/data/timeline.json');
