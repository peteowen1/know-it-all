#!/usr/bin/env node
// Builds src/data/timeline.json: dated one-line events for the Timeline game,
// drawn from data the other games already use. Run with `npm run data:timeline`
// after any of those sources is rebuilt.
//
// Every event is a sentence plus a year. Only facts a quiz-goer could date
// roughly are used: chart and box-office number ones, Best Picture and Emmy
// winners, leaders taking office, and births of the best-known people.
// Built offline so the game does not ship the full chart files (~1.4 MB).

import { readFileSync } from 'node:fs';
import { dataFile, writeData } from './lib/output.mjs';

const load = (p) => JSON.parse(readFileSync(dataFile(p), 'utf8'));
const music = load('charts/music.json').years;
const films = load('charts/films.json');
const tv = load('charts/tv.json');
const lists = load('lists.json').lists;
const famous = load('famous.json').names;

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
// Award clues say which year they mean: Oscars are dated by the films' year
// (the ceremony is the next spring), Emmys by the ceremony. The one
// exception is the 2023 Emmys, held in January 2024 after the strikes: that
// clue says so. A playtester
// answered 2015 for Birdman (ceremony year) and was marked wrong.
// Before 1934 the awards ran on split seasons (Wings is 1927/28, Cavalcade
// 1932/33), so those winners have no single right year; they are left out.
for (const [y, list] of Object.entries(films.bestPicture)) {
  if (Number(y) < 1934) continue;
  add('oscars', Number(y), `${list[0].title} wins Best Picture (films of that year; ceremony the next spring)`);
}
// A show that won more than once ("The Sopranos", 2004 and 2007) had two right
// years for one clue. Only its first win is kept (see byText below), so the
// clue says "its first".
// Emmy years whose ceremony fell in a later year: the 75th, moved by the
// 2023 writers' and actors' strikes to 15 January 2024.
const EMMY_HELD_LATE = { 2023: 'January 2024' };
for (const [key, label] of [['emmyDrama', 'Outstanding Drama'], ['emmyComedy', 'Outstanding Comedy']]) {
  const wins = {};
  for (const list of Object.values(tv[key])) wins[list[0].title] = (wins[list[0].title] || 0) + 1;
  const seen = new Set();
  for (const [y, list] of Object.entries(tv[key])) {
    const t = list[0].title;
    // Skipped here as well as by byText: the 2023 wording differs, so a
    // repeat win that year (Succession) would not match its first.
    if (seen.has(t)) continue;
    seen.add(t);
    const when = EMMY_HELD_LATE[y] ? `the ${y} awards, held ${EMMY_HELD_LATE[y]}` : 'ceremony that year';
    add('tv', Number(y), `${t} wins ${wins[t] > 1 ? 'its first' : 'the'} Emmy for ${label} Series (${when})`);
  }
}

// Leaders taking office. A returning leader's later terms are skipped: "Rudd
// becomes PM" twice in one pool is a trap with two right years.
const office = { auPM: 'Prime Minister of Australia', usPres: 'President of the United States', ukPM: 'UK Prime Minister' };
for (const [key, title] of Object.entries(office)) {
  const seen = new Set();
  for (const t of lists[key].terms) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    // The UK list starts in 1900, so its first row is Salisbury's third term
    // (1895); he first became Prime Minister in 1885.
    if (key === 'ukPM' && t.from < 1900) continue;
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

writeData('timeline.json', { events: out });
