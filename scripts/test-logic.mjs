#!/usr/bin/env node
// Logic tests for the scheduling and transfer modules. Run with `npm test`.
//
// These import the real source files rather than reimplementing them. An
// earlier version of these checks lived in a scratch directory and duplicated
// the logic, which meant they proved nothing about the shipped code and did not
// run in CI — a reviewer correctly pointed out the repo had no tests at all.
//
// Node cannot resolve the app's JSON imports, so only the pure modules are
// covered here: scheduler, transfer and dates. Those are where the subtle
// correctness lives; the React layer is covered by the build and by use.

import assert from 'node:assert/strict';
import {
  INTERVALS, GRADUATED_BOX, newEntry, normaliseVault, isDue,
  promote, recordMiss, recordHit, describeDue, vaultSummary
} from '../src/lib/scheduler.js';
import {
  exportProgress, importProgress, mergeProgress, encodeChallenge, decodeChallenge
} from '../src/lib/transfer.js';
import { localDateKey, previousDateKey, addDaysToKey, daysBetween } from '../src/lib/dates.js';
import { countryPool, pickDistractors, buildGeoRound, nextChallenger, formatPopulation } from '../src/games/geo/geoPool.js';
import { recordItems, recordRound, itemWeights, weakestItems, mergeGameStats, coerceGameStats } from '../src/lib/gameStats.js';
import { makeRng } from '../src/lib/rng.js';
import { normalise, editDistance, matchGuess } from '../src/games/names/nameMatch.js';
import { topSongs, topArtists, matchChartGuess, buildChartQuiz, decadesOf } from '../src/games/charts/chartLogic.js';
import { readFileSync } from 'node:fs';

const { years: MUSIC } = JSON.parse(readFileSync(new URL('../src/data/charts/music.json', import.meta.url), 'utf8'));
const LOOKALIKES = JSON.parse(readFileSync(new URL('../src/data/flagLookalikes.json', import.meta.url), 'utf8'));
const { countries: COUNTRIES } = JSON.parse(readFileSync(new URL('../src/data/countries.json', import.meta.url), 'utf8'));

let pass = 0;
const failures = [];
const test = (name, fn) => {
  try {
    fn();
    pass++;
  } catch (err) {
    failures.push(`${name}\n    ${err.message.split('\n')[0]}`);
  }
};

// ------------------------------------------------------------------ dates
test('addDaysToKey crosses month end', () => assert.equal(addDaysToKey('2026-01-31', 1), '2026-02-01'));
test('addDaysToKey crosses year end', () => assert.equal(addDaysToKey('2026-12-31', 1), '2027-01-01'));
test('addDaysToKey handles leap day', () => assert.equal(addDaysToKey('2028-02-28', 1), '2028-02-29'));
test('addDaysToKey skips absent leap day', () => assert.equal(addDaysToKey('2026-02-28', 1), '2026-03-01'));
test('addDaysToKey spans 60 days over new year', () => assert.equal(addDaysToKey('2026-12-01', 60), '2027-01-30'));
test('daysBetween is signed', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);
  assert.equal(daysBetween('2026-01-08', '2026-01-01'), -7);
});
test('previousDateKey steps back one local day', () =>
  assert.equal(previousDateKey(new Date(2026, 0, 1)), '2025-12-31'));
test('localDateKey is local, not UTC', () => {
  // 9am local on 3 Aug is 2 Aug in UTC for any timezone east of GMT+9. The key
  // must follow the local calendar or streaks and the daily quiz roll over
  // mid-morning rather than at midnight.
  assert.equal(localDateKey(new Date(2026, 7, 3, 9, 0, 0)), '2026-08-03');
});

// -------------------------------------------------------------- scheduler
test('a miss enters the vault due tomorrow, not today', () => {
  const v = recordMiss([], 'q1', '2026-01-01');
  assert.equal(v.length, 1);
  assert.equal(isDue(v[0], '2026-01-01'), false);
  assert.equal(isDue(v[0], '2026-01-02'), true);
});

test('answering early does not advance the schedule', () => {
  const v = recordMiss([], 'q1', '2026-01-01');
  const after = recordHit(v, 'q1', '2026-01-01');
  assert.equal(after[0].box, 0);
  assert.equal(after[0].due, v[0].due);
});

test('full ladder promotes through every interval then graduates', () => {
  let v = recordMiss([], 'q1', '2026-01-01');
  let day = '2026-01-02';
  for (let i = 0; i < GRADUATED_BOX - 1; i++) {
    v = recordHit(v, 'q1', day);
    assert.equal(v[0].box, i + 1, `box after ${i + 1} correct`);
    assert.equal(daysBetween(day, v[0].due), INTERVALS[i + 1], `interval at box ${i + 1}`);
    day = v[0].due;
  }
  v = recordHit(v, 'q1', day);
  assert.equal(v.length, 0, 'graduates out of the vault');
});

test('a lapse resets to box 0 however far it had climbed', () => {
  let v = [{ id: 'q2', box: 3, due: '2026-01-01', lapses: 0, reps: 5, added: '2025-12-01' }];
  v = recordMiss(v, 'q2', '2026-02-01');
  assert.equal(v[0].box, 0);
  assert.equal(v[0].lapses, 1);
  assert.equal(daysBetween('2026-02-01', v[0].due), INTERVALS[0]);
});

test('a correct answer for a question not in the vault does not add it', () =>
  assert.equal(recordHit([], 'never-missed', '2026-01-01').length, 0));

test('promote returns null at graduation rather than an out-of-range box', () =>
  assert.equal(promote({ ...newEntry('q', '2026-01-01'), box: GRADUATED_BOX - 1 }, '2026-01-01'), null));

test('long-overdue entries are still due', () => assert.equal(isDue({ due: '2025-06-01' }, '2026-01-01'), true));

test('normaliseVault migrates the legacy string[] format', () => {
  const v = normaliseVault(['a', 'b'], '2026-01-01');
  assert.equal(v.length, 2);
  assert.equal(v[0].id, 'a');
  assert.equal(v[0].due, '2026-01-01', 'migrated entries are due immediately');
});

test('normaliseVault dedupes and rejects unusable entries', () => {
  const v = normaliseVault(['a', 'a', null, 42, {}, { id: 'b' }], '2026-01-01');
  assert.deepEqual(v.map((e) => e.id), ['a', 'b']);
});

test('normaliseVault repairs a due date that is a string but not a date', () => {
  // Left alone, this makes daysBetween return NaN and `NaN >= 0` is false, so
  // the entry would never come up for revision again.
  const [entry] = normaliseVault([{ id: 'q', due: 'soon' }], '2026-01-01');
  assert.equal(entry.due, '2026-01-01');
  assert.equal(isDue(entry, '2026-01-01'), true);
});

test('normaliseVault clamps an out-of-range box', () =>
  assert.equal(normaliseVault([{ id: 'q', box: 99 }], '2026-01-01')[0].box, GRADUATED_BOX));

test('vaultSummary counts due and struggling entries', () => {
  const s = vaultSummary(
    [
      { id: 'a', box: 0, due: '2025-01-01', lapses: 3 },
      { id: 'b', box: 1, due: '2099-01-01', lapses: 0 }
    ],
    '2026-01-01'
  );
  assert.equal(s.total, 2);
  assert.equal(s.due, 1);
  assert.equal(s.struggling, 1);
});

test('describeDue reads sensibly at each scale', () => {
  assert.equal(describeDue({ due: '2026-01-01' }, '2026-01-01'), 'due now');
  assert.equal(describeDue({ due: '2026-01-02' }, '2026-01-01'), 'due tomorrow');
  assert.match(describeDue({ due: '2026-03-02' }, '2026-01-01'), /months/);
});

// --------------------------------------------------------------- transfer
const laptop = {
  stats: {
    highScore: 20, bestPercentage: 80, totalQuizzes: 4, totalAnswered: 100, totalCorrect: 70,
    streak: 3, lastPlayDate: '2026-01-05',
    categoryStats: { science: { total: 20, correct: 15 } }, difficultyStats: {}
  },
  vault: [{ id: 'q1', box: 3, due: '2026-03-01', lapses: 0, reps: 3 }],
  recentIds: ['a', 'b']
};

test('progress survives a round trip', () => {
  const r = importProgress(exportProgress(laptop));
  assert.equal(r.ok, true);
  assert.equal(r.data.stats.totalAnswered, 100);
  assert.deepEqual(r.data.vault, laptop.vault);
});

for (const [label, code] of [
  ['garbage', 'not-a-real-code'],
  ['empty string', ''],
  ['wrong format version', Buffer.from(JSON.stringify({ v: 99, s: {} })).toString('base64url')],
  ['missing stats', Buffer.from(JSON.stringify({ v: 1, k: [] })).toString('base64url')],
  ['stats as an array', Buffer.from(JSON.stringify({ v: 1, s: [] })).toString('base64url')]
]) {
  test(`import rejects ${label}`, () => assert.equal(importProgress(code).ok, false));
}

test('import coerces numeric fields sent as strings', () => {
  // The critical one: `+` on a string concatenates, so 500 + "50" is "50050",
  // and every later quiz would keep concatenating onto the result.
  const code = Buffer.from(
    JSON.stringify({ v: 1, s: { totalAnswered: '50', totalCorrect: null, highScore: 'x' }, k: [], r: [] })
  ).toString('base64url');
  const r = importProgress(code);
  assert.equal(r.ok, true);
  assert.equal(r.data.stats.totalAnswered, 0);
  const merged = mergeProgress(laptop, r.data);
  assert.equal(typeof merged.stats.totalAnswered, 'number');
  assert.equal(merged.stats.totalAnswered, 100);
});

test('merge does not throw on null vault entries or null count maps', () => {
  const nasty = {
    stats: { categoryStats: null, difficultyStats: { easy: null } },
    vault: [null, 42, { id: 'q9', box: 0, due: '2026-01-01' }],
    recentIds: []
  };
  const merged = mergeProgress(laptop, nasty);
  assert.deepEqual(merged.vault.map((e) => e.id).sort(), ['q1', 'q9']);
});

test('merge is additive on totals and keeps the best score', () => {
  const phone = {
    stats: {
      highScore: 24, bestPercentage: 96, totalQuizzes: 2, totalAnswered: 50, totalCorrect: 40,
      streak: 1, lastPlayDate: '2026-01-09',
      categoryStats: { science: { total: 10, correct: 9 }, sports: { total: 5, correct: 2 } },
      difficultyStats: {}
    },
    vault: [{ id: 'q1', box: 1, due: '2026-01-10', lapses: 1, reps: 1 }],
    recentIds: ['b', 'c']
  };
  const m = mergeProgress(laptop, phone);
  assert.equal(m.stats.totalAnswered, 150);
  assert.equal(m.stats.highScore, 24);
  assert.equal(m.stats.lastPlayDate, '2026-01-09', 'keeps the later play date');
  assert.equal(m.stats.categoryStats.science.total, 30);
  const q1 = m.vault.find((e) => e.id === 'q1');
  assert.equal(q1.box, 1, 'clash keeps the LOWER box');
  assert.equal(q1.due, '2026-01-10', 'clash keeps the EARLIER due date');
  assert.equal(q1.lapses, 1, 'clash keeps the HIGHER lapse count');
  assert.deepEqual(m.recentIds, ['a', 'b', 'c']);
});

test('merging an empty profile never loses local work', () => {
  const m = mergeProgress(laptop, { stats: {}, vault: [], recentIds: [] });
  assert.equal(m.vault.length, 1);
  assert.equal(m.stats.totalAnswered, 100);
});

test('a challenge round trips its ids and seed', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const decoded = decodeChallenge(encodeChallenge(questions, 12345));
  assert.deepEqual(decoded.ids, ['a', 'b', 'c']);
  assert.equal(decoded.seed, 12345, 'the seed must survive or option order will not match');
});

test('decodeChallenge rejects junk rather than throwing', () => {
  assert.equal(decodeChallenge('####'), null);
  assert.equal(decodeChallenge(''), null);
});

// -------------------------------------------------------------- countries
test('country table: 197 sovereign states, every one with a capital and region', () => {
  const s = COUNTRIES.filter((c) => c.sovereign);
  assert.equal(s.length, 197);
  assert.deepEqual(s.filter((c) => !c.capitals.length || !c.region).map((c) => c.name), []);
});
test('country table: capitals a quiz would mark right', () => {
  const cap = (code) => COUNTRIES.find((c) => c.code === code).capitals[0];
  assert.equal(cap('AU'), 'Canberra');
  assert.equal(cap('TR'), 'Ankara');
  assert.equal(cap('CA'), 'Ottawa');
  assert.equal(cap('UA'), 'Kyiv');
});
test('country table: population plausible (China and India over 1.3bn, Nauru under 20k)', () => {
  const pop = (code) => COUNTRIES.find((c) => c.code === code).population;
  assert.ok(pop('CN') > 1.3e9 && pop('IN') > 1.3e9);
  assert.ok(pop('NR') < 20000);
});

// --------------------------------------------------------------- geo pool
const WORLD = countryPool(COUNTRIES);
test('countryPool region filter', () => {
  const eu = countryPool(COUNTRIES, { region: 'Europe' });
  assert.ok(eu.length > 40 && eu.every((c) => c.region === 'Europe'));
});
test('countryPool `needs` drops countries missing that field only', () => {
  const p = countryPool(COUNTRIES, { needs: 'population' });
  assert.ok(!p.some((c) => c.code === 'TW'));
  assert.ok(WORLD.some((c) => c.code === 'TW'));
});
test('pickDistractors: three distinct, none the target, neighbours first', () => {
  const chad = WORLD.find((c) => c.code === 'TD');
  const d = pickDistractors(chad, WORLD, makeRng(1));
  assert.equal(d.length, 3);
  assert.equal(new Set(d.map((c) => c.code)).size, 3);
  assert.ok(!d.includes(chad));
  assert.ok(d.every((c) => c.subregion === chad.subregion));
});
test('pickDistractors de-duplicates on the displayed label', () => {
  const a = { code: 'A', name: 'Same', subregion: 's', region: 'r' };
  const b = { code: 'B', name: 'Same', subregion: 's', region: 'r' };
  const others = ['C', 'D', 'E'].map((code) => ({ code, name: code, subregion: 's', region: 'r' }));
  const d = pickDistractors(a, [a, b, ...others], makeRng(2));
  assert.ok(!d.includes(b));
});
test('buildGeoRound: no repeats, correctIndex points at the target, seeded', () => {
  const r1 = buildGeoRound(WORLD, { count: 50, seed: 42 });
  const r2 = buildGeoRound(WORLD, { count: 50, seed: 42 });
  assert.equal(new Set(r1.map((q) => q.target.code)).size, 50);
  assert.ok(r1.every((q) => q.options[q.correctIndex] === q.target && q.options.length === 4));
  assert.deepEqual(r1.map((q) => q.target.code), r2.map((q) => q.target.code));
});
test('buildGeoRound: count beyond the pool returns the whole pool', () => {
  const oc = countryPool(COUNTRIES, { region: 'Oceania' });
  assert.equal(buildGeoRound(oc, { count: Infinity, seed: 1 }).length, oc.length);
});
test('buildGeoRound: weights pull missed countries forward', () => {
  const weights = Object.fromEntries(WORLD.map((c) => [c.code, c.code === 'TD' ? 50 : 1]));
  let hits = 0;
  for (let s = 0; s < 200; s++) {
    if (buildGeoRound(WORLD, { count: 5, seed: s, weights }).some((q) => q.target.code === 'TD')) hits++;
  }
  // Unweighted, Chad is in about 5/197 = 2.5% of rounds. At weight 50 against
  // 196 others it is about 68% (each draw ~20%, five draws). Measured: 144/200.
  assert.ok(hits > 110, `Chad drawn in only ${hits} of 200 weighted rounds`);
});
test('nextChallenger never offers a near-tie', () => {
  const pool = countryPool(COUNTRIES, { needs: 'population' });
  const rand = makeRng(7);
  for (const c of pool.slice(0, 40)) {
    const n = nextChallenger(c, pool, rand);
    const ratio = Math.max(n.population, c.population) / Math.min(n.population, c.population);
    assert.ok(ratio >= 1.15, `${c.name} vs ${n.name}: ${ratio}`);
  }
});
test('formatPopulation', () => {
  assert.equal(formatPopulation(1406585000), '1.41 billion');
  assert.equal(formatPopulation(27614411), '27.6 million');
  assert.equal(formatPopulation(341784857), '342 million');
  assert.equal(formatPopulation(12025), '12,025');
});

// ------------------------------------------------------------- game stats
test('recordRound accumulates plays, bests and per-item counts', () => {
  let g = recordRound({}, 'flags', { score: 3, total: 4, answers: [{ key: 'AU', correct: true }, { key: 'TD', correct: false }] });
  g = recordRound(g, 'flags', { score: 1, total: 4, answers: [{ key: 'TD', correct: false }] });
  assert.equal(g.flags.plays, 2);
  assert.equal(g.flags.bestPct, 75);
  assert.deepEqual(g.flags.items.TD, { seen: 2, correct: 0 });
});
test('itemWeights: always-missed > unseen > always-right, none zero', () => {
  const g = { flags: { items: { TD: { seen: 3, correct: 0 }, AU: { seen: 3, correct: 3 } } } };
  const w = itemWeights(g, 'flags', ['TD', 'AU', 'FR']);
  assert.ok(w.TD > w.FR && w.FR > w.AU && w.AU > 0);
});
test('weakestItems ignores items seen once', () => {
  const g = { flags: { items: { TD: { seen: 1, correct: 0 }, RO: { seen: 2, correct: 0 } } } };
  assert.deepEqual(weakestItems(g, 'flags').map((x) => x.key), ['RO']);
});
test('mergeGameStats adds counts and keeps bests', () => {
  const a = { flags: { plays: 2, best: 8, bestPct: 80, bestRun: 0, lastPlayed: '2026-09-01', items: { AU: { seen: 2, correct: 1 } } } };
  const b = { flags: { plays: 1, best: 9, bestPct: 90, bestRun: 0, lastPlayed: '2026-09-02', items: { AU: { seen: 1, correct: 1 } } } };
  const m = mergeGameStats(a, b);
  assert.equal(m.flags.plays, 3);
  assert.equal(m.flags.bestPct, 90);
  assert.deepEqual(m.flags.items.AU, { seen: 3, correct: 2 });
});
test('coerceGameStats rejects junk and string numbers', () => {
  const c = coerceGameStats({ flags: { plays: '5', items: { AU: { seen: 2, correct: 9 } } }, bad: null });
  assert.equal(c.flags.plays, 0);
  assert.deepEqual(c.flags.items.AU, { seen: 2, correct: 2 });
  assert.equal(c.bad, undefined);
});
test('progress code carries game stats; a code without them still imports', () => {
  const games = { flags: { plays: 1, best: 5, bestPct: 50, bestRun: 0, lastPlayed: null, items: {} } };
  const profile = { stats: {}, vault: [], recentIds: [], games };
  const back = importProgress(exportProgress(profile));
  assert.equal(back.data.games.flags.plays, 1);
  const old = importProgress(exportProgress({ stats: {}, vault: [], recentIds: [] }));
  assert.ok(old.ok);
  assert.equal(mergeProgress(profile, old.data).games.flags.plays, 1);
});

// ------------------------------------------------------------ name match
const TOMS = [
  { id: 'hanks', name: 'Tom Hanks', rest: 'Hanks', views: 900 },
  { id: 'jones', name: 'Tom Jones', rest: 'Jones', views: 500 },
  { id: 'jones2', name: 'Tom Jones', rest: 'Jones', views: 10 },
  { id: 'hiddleston', name: 'Tom Hiddleston', rest: 'Hiddleston', views: 400 },
  { id: 'delonge', name: 'Tom DeLonge', rest: 'DeLonge', views: 50 }
];
const ROBERTS = [{ id: 'deniro', name: 'Robert De Niro', rest: 'De Niro', views: 1 }];
test('normalise strips accents, case and punctuation', () => assert.equal(normalise(' Beyoncé Knowles-Carter '), 'beyonce knowles carter'));
test('editDistance caps early', () => {
  assert.equal(editDistance('hiddlestone', 'hiddleston'), 1);
  assert.equal(editDistance('abc', 'xyzxyz'), 3);
});
test('matchGuess: surname, full name and case all find the person', () => {
  for (const g of ['hanks', 'Tom Hanks', 'HANKS']) assert.equal(matchGuess(g, 'Tom', TOMS).person.id, 'hanks');
});
test('matchGuess: one typo allowed on long guesses, none on short', () => {
  assert.equal(matchGuess('Hiddlestone', 'Tom', TOMS).person.id, 'hiddleston');
  assert.equal(matchGuess('Hank', 'Tom', TOMS), null);
});
test('matchGuess: multi-word and joined surnames', () => {
  assert.equal(matchGuess('de niro', 'Robert', ROBERTS).person.id, 'deniro');
  assert.equal(matchGuess('deniro', 'Robert', ROBERTS).person.id, 'deniro');
  assert.equal(matchGuess('niro', 'Robert', ROBERTS).person.id, 'deniro');
  assert.equal(matchGuess('de longe', 'Tom', TOMS).person.id, 'delonge');
});
test('matchGuess: repeated surname finds the next most famous, then reports already found', () => {
  assert.equal(matchGuess('jones', 'Tom', TOMS).person.id, 'jones');
  assert.equal(matchGuess('jones', 'Tom', TOMS, new Set(['jones'])).person.id, 'jones2');
  assert.equal(matchGuess('jones', 'Tom', TOMS, new Set(['jones', 'jones2'])).alreadyFound, true);
});
test('matchGuess: nonsense and one-letter guesses match nothing', () => {
  assert.equal(matchGuess('zzzzzz', 'Tom', TOMS), null);
  assert.equal(matchGuess('h', 'Tom', TOMS), null);
});

// ------------------------------------------------------------ flag look-alikes
const ALL = countryPool(COUNTRIES, { territories: true });
const byCode = (c) => ALL.find((x) => x.code === c);
test('look-alikes: the pairs everyone confuses are measured as close', () => {
  const top = (c, n = 5) => LOOKALIKES[c].slice(0, n).map(([code]) => code);
  assert.ok(top('MC').includes('ID') && top('MC').includes('PL'), 'Monaco ~ Indonesia, Poland');
  assert.ok(top('TD').includes('RO'), 'Chad ~ Romania');
  assert.ok(top('IE').includes('CI'), 'Ireland ~ Ivory Coast');
  assert.ok(top('SI').includes('RU') && top('SI').includes('SK'), 'Slovenia ~ Russia, Slovakia');
});
test('hard flags: Monaco gets look-alikes, never identical Indonesia', () => {
  const mc = WORLD.find((c) => c.code === 'MC');
  for (let seed = 0; seed < 30; seed++) {
    const d = pickDistractors(mc, WORLD, makeRng(seed), (c) => c.name, { lookalikes: LOOKALIKES, hard: true }).map((c) => c.code);
    assert.ok(!d.includes('ID'), 'identical flag offered');
    const close = LOOKALIKES.MC.filter(([c, s]) => s < 0.99 && WORLD.some((w) => w.code === c)).slice(0, 5).map(([c]) => c);
    assert.ok(d.every((c) => close.includes(c)), `not look-alikes: ${d}`);
  }
});
test('normal flags: identical flags excluded even with territories on', () => {
  const fr = byCode('FR');
  for (let seed = 0; seed < 50; seed++) {
    const d = pickDistractors(fr, ALL, makeRng(seed), (c) => c.code, { lookalikes: LOOKALIKES }).map((c) => c.code);
    for (const same of ['GF', 'GP', 'MQ', 'RE', 'YT']) assert.ok(!d.includes(same), `${same} offered for France`);
  }
});
test('recordItems updates items without counting a play', () => {
  const g = recordItems({}, 'flags', [{ key: 'MC', correct: false }]);
  assert.equal(g.flags.plays, 0);
  assert.deepEqual(g.flags.items.MC, { seen: 1, correct: 0 });
});

// ----------------------------------------------------------------- charts
test('music data: every year 1959-2025 has a full, ordered top 10', () => {
  for (let y = 1959; y <= 2025; y++) {
    const ranks = (MUSIC[y] || []).slice(0, 10).map((e) => e.rank);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `year ${y}`);
  }
});
test('music data: known year-end number ones', () => {
  assert.equal(MUSIC[1965][0].title, 'Wooly Bully');
  assert.equal(MUSIC[1985][0].title, 'Careless Whisper');
  assert.equal(MUSIC[2012][0].title, 'Somebody That I Used to Know');
});
test('music data: merged artist cells carried down (1994 #10 is Ace of Base)', () => {
  assert.equal(MUSIC[1994][9].artist, 'Ace of Base');
});
test('topSongs for one year is that year, in order', () => {
  const b = topSongs(MUSIC, 1985, 1985, 10);
  assert.equal(b.length, 10);
  assert.equal(b[0].label, 'Careless Whisper');
  assert.deepEqual(b.map((x) => x.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
test('topArtists: 1980s led by the acts a quiz would expect', () => {
  const top5 = topArtists(MUSIC, 1980, 1989, 5).map((a) => a.label);
  assert.ok(top5.includes('Madonna') && top5.includes('Michael Jackson'), top5.join(', '));
});
test('matchChartGuess: song title, artist, "the", brackets and typos', () => {
  const b = topSongs(MUSIC, 1965, 1965, 10);
  assert.equal(matchChartGuess('wooly bully', b).item.rank, 1);
  assert.equal(matchChartGuess('Rolling Stones', b).item.label, "(I Can't Get No) Satisfaction");
  assert.equal(matchChartGuess('satisfaction', b).item.rank, 3);
  assert.equal(matchChartGuess('zzzz', b), null);
});
test('matchChartGuess: an artist with two songs finds the next on a repeat', () => {
  const b = topSongs(MUSIC, 1994, 1994, 10);
  const first = matchChartGuess('ace of base', b);
  const second = matchChartGuess('ace of base', b, new Set([first.item.id]));
  assert.notEqual(first.item.id, second.item.id);
});
test('buildChartQuiz: correct option is the real answer, options distinct', () => {
  const qs = buildChartQuiz(MUSIC, { from: 1959, to: 2025, count: 20, seed: 5 });
  assert.equal(qs.length, 20);
  for (const q of qs) {
    assert.equal(new Set(q.options).size, 4, q.prompt);
    if (q.kind === 'year-of-song') assert.equal(q.options[q.correctIndex], String(q.year));
    else assert.ok(q.options[q.correctIndex].includes(MUSIC[q.year][0].title));
  }
});

test('buildChartQuiz: a short decade still gets a full round (2020s)', () => {
  const qs = buildChartQuiz(MUSIC, { from: 2020, to: 2029, count: 10, seed: 1 });
  assert.equal(qs.length, 10);
  assert.equal(new Set(qs.map((q) => q.key)).size, 10, 'a question repeated');
});
test('buildChartQuiz: year decoys stay inside the data', () => {
  for (let seed = 0; seed < 20; seed++) {
    for (const q of buildChartQuiz(MUSIC, { from: 2020, to: 2029, count: 10, seed })) {
      if (q.kind === 'year-of-song') assert.ok(q.options.every((y) => MUSIC[y]), q.options.join(','));
    }
  }
});
test('decadesOf drops the one-year 1950s', () => {
  const d = decadesOf(MUSIC);
  assert.equal(d[0], 1960);
  assert.ok(d.includes(2020));
});
// ------------------------------------------------------------------ report
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  x ${f}`));
  process.exit(1);
}
console.log('Logic tests OK.\n');
