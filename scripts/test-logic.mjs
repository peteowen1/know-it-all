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
import { localDateKey, previousDateKey, addDaysToKey, daysBetween, saturdayKey } from '../src/lib/dates.js';
import { countryPool, pickDistractors, buildGeoRound, nextChallenger, formatPopulation, countryInText } from '../src/games/geo/geoPool.js';
import { recordItems, recordRound, itemWeights, weakestItems, mergeGameStats, coerceGameStats } from '../src/lib/gameStats.js';
import { makeRng } from '../src/lib/rng.js';
import { rowMatches } from '../src/games/lists/listMatch.js';
import { buildRound, scoreOrder } from '../src/games/timeline/timelineLogic.js';
import { buildYearRounds, yearPoints } from '../src/games/nameyear/nameYearLogic.js';
import { pickCategories, scoreGuess } from '../src/games/obscure/obscureLogic.js';
import { buildLinkRounds, linkPoints, hasRepeatedClue } from '../src/games/missinglink/linkLogic.js';
import { buildVocabRounds, isCorrect, explainRound, indexGroups } from '../src/games/vocab/vocabLogic.js';
import { testContext, nextRound, prior, update, estimate, guessRate, TEST_LENGTH, describeLevel, scaleBounds, formatLevel } from '../src/games/vocab/vocabTest.js';
import { pickWeekly, WEEKLY_SHAPE, WEEKLY_MAX_PER_CATEGORY } from '../src/lib/weekly.js';
import { readdirSync } from 'node:fs';
import { normalise, editDistance, matchGuess, romanToInt } from '../src/games/names/nameMatch.js';
import { topSongs, topArtists, matchChartGuess, buildChartQuiz, decadesOf } from '../src/games/charts/chartLogic.js';
import { readFileSync } from 'node:fs';
import { pathForTab, tabForPath } from '../src/lib/route.js';
import { GAMES } from '../src/games/registry.js';
import { diffSnapshot, planPull, mergeSnapshots, rebaseSnapshots, tombstoneWrites, hasProgress, isSyncedKey } from '../src/lib/syncCore.js';
import {
  loadSources, buildGroups, countryLookup, findOverlaps, indexByLabel, tileFits, MAX_PUZZLES_PER_ITEM, MAX_PUZZLES_PER_LABEL
} from './lib/fbfGroups.mjs';
import { finishAccepts, sharedForms } from './lib/listAccept.mjs';
import { leftOutByRule } from './lib/famousRules.mjs';
import { ROOT, SHIPPED, dataFile, slim, extraKeys } from './lib/output.mjs';

const { years: MUSIC } = JSON.parse(readFileSync(new URL('../src/data/charts/music.json', import.meta.url), 'utf8'));
const FILMS = JSON.parse(readFileSync(new URL('../src/data/charts/films.json', import.meta.url), 'utf8'));
const TV = JSON.parse(readFileSync(new URL('../src/data/charts/tv.json', import.meta.url), 'utf8'));
const FBF = JSON.parse(readFileSync(new URL('../src/data/fourbyfour.json', import.meta.url), 'utf8'));
const LISTS = JSON.parse(readFileSync(new URL('../src/data/lists.json', import.meta.url), 'utf8')).lists;
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

test('answering early restarts the wait without climbing a box', () => {
  const v = [{ id: 'q1', box: 2, due: '2026-01-06', lapses: 0, reps: 2, added: '2025-12-01' }];
  const after = recordHit(v, 'q1', '2026-01-03');
  assert.equal(after[0].box, 2);
  assert.equal(after[0].due, '2026-01-10', 'today plus the box 2 interval of 7 days');
  assert.equal(after[0].reps, 3);
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
test('matchGuess: a merged-spelling board accepts either spelling, and the spelling each person uses', () => {
  const BILLYS = [
    { id: 'eilish', rest: 'Eilish', first: 'Billie', views: 9 },
    { id: 'joel', rest: 'Joel', first: 'Billy', views: 8 }
  ];
  for (const g of ['eilish', 'Billie Eilish', 'billy eilish']) assert.equal(matchGuess(g, ['Billy', 'Billie'], BILLYS).person.id, 'eilish', g);
  for (const g of ['joel', 'Billy Joel']) assert.equal(matchGuess(g, ['Billy', 'Billie'], BILLYS).person.id, 'joel', g);
  // A plain string still works for boards that were never merged.
  assert.equal(matchGuess('joel', 'Billy', BILLYS).person.id, 'joel');
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
test('matchGuess: nonsense and stray letters match nothing', () => {
  assert.equal(matchGuess('zzzzzz', 'Tom', TOMS), null);
  assert.equal(matchGuess('h', 'Tom', TOMS), null);
});
test('matchGuess: regnal numerals by numeral, number, ordinal or word', () => {
  const LIZ = [{ id: 'e1', name: 'Elizabeth I', rest: 'I', views: 5 }, { id: 'e2', name: 'Elizabeth II', rest: 'II', views: 9 }];
  for (const g of ['I', '1', '1st', 'first', 'the first', 'Elizabeth I']) assert.equal(matchGuess(g, 'Elizabeth', LIZ)?.person.id, 'e1', g);
  for (const g of ['ii', '2', '2nd', 'second']) assert.equal(matchGuess(g, 'Elizabeth', LIZ)?.person.id, 'e2', g);
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
// ------------------------------------------------------------------ films
test('films: box office has a full top 10 every year 1970 onward', () => {
  for (const [y, list] of Object.entries(FILMS.boxOffice)) {
    assert.deepEqual(list.map((f) => f.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `year ${y}`);
  }
});
test('films: known box-office number ones and directors', () => {
  assert.equal(FILMS.boxOffice[1977][0].title, 'Star Wars');
  assert.equal(FILMS.boxOffice[1997][0].title, 'Titanic');
  assert.equal(FILMS.boxOffice[1997][0].artist, 'James Cameron');
});
test('films: exactly one Best Picture winner a year, known winners right', () => {
  for (const [y, list] of Object.entries(FILMS.bestPicture)) {
    assert.equal(list[0].rank, 1, `year ${y}`);
    assert.equal(new Set(list.map((f) => f.title)).size, list.length, `duplicate nominee in ${y}`);
  }
  assert.equal(FILMS.bestPicture[1972][0].title, 'The Godfather');
  assert.equal(FILMS.bestPicture[1994][0].title, 'Forrest Gump');
  assert.equal(FILMS.bestPicture[2019][0].title, 'Parasite');
});
test('films: Best Picture quiz wrong answers are that year\'s nominees', () => {
  const words = { best: (y) => `${y}?`, whichYear: (l) => l, winner: (l) => l, runnerUp: 'x' };
  const qs = buildChartQuiz(FILMS.bestPicture, { from: 1990, to: 1999, count: 10, seed: 2, words, sameYearDistractors: true });
  for (const q of qs.filter((x) => x.kind === 'song-of-year')) {
    const nominees = FILMS.bestPicture[q.year].map((f) => `"${f.title}" — ${f.artist}`);
    assert.ok(q.options.every((o) => nominees.includes(o)), `${q.year}: ${q.options}`);
  }
});
test('topSongs "winners" decade board lists one winner per year', () => {
  const b = topSongs(FILMS.bestPicture, 1990, 1999, 10, { decadeBoard: 'winners' });
  assert.equal(b.length, 10);
  assert.equal(b[4].label, 'Forrest Gump');
});

// --------------------------------------------------------------------- tv
test('tv: known winners', () => {
  assert.equal(TV.emmyDrama[2010][0].title, 'Mad Men');
  assert.equal(TV.emmyComedy[1996][0].title, 'Frasier');
  assert.equal(TV.globeDrama[2011][0].title, 'Homeland');
});
test('tv: season suffixes stripped, networks present, one winner a year', () => {
  for (const [award, years] of Object.entries(TV).filter(([k]) => k !== 'builtAt')) {
    for (const [y, list] of Object.entries(years)) {
      assert.equal(list[0].rank, 1, `${award} ${y}`);
      for (const s of list) {
        assert.ok(!/season/i.test(s.title), `${award} ${y}: ${s.title}`);
        assert.ok(s.artist && s.artist !== 'Unknown network', `${award} ${y}: ${s.title} has no network`);
      }
    }
  }
});
test('winners decade board: a repeat winner takes one slot listing its years', () => {
  const b = topSongs(TV.emmyComedy, 1990, 1999, 10, { decadeBoard: 'winners' });
  const frasier = b.filter((x) => x.label === 'Frasier');
  assert.equal(frasier.length, 1);
  assert.ok(frasier[0].sub.includes('1994') && frasier[0].sub.includes('1998'), frasier[0].sub);
  assert.equal(new Set(b.map((x) => x.id)).size, b.length);
});
test('which-year quiz never offers a repeat winner\'s other winning year', () => {
  const words = { best: (y) => `${y}`, whichYear: (l) => l, winner: (l) => l, runnerUp: 'x' };
  for (let seed = 0; seed < 30; seed++) {
    for (const q of buildChartQuiz(TV.emmyComedy, { from: 1990, to: 1999, count: 10, seed, words, sameYearDistractors: true })) {
      if (q.kind !== 'year-of-song') continue;
      const title = TV.emmyComedy[q.year][0].title;
      const right = q.options.filter((y) => TV.emmyComedy[y]?.[0].title === title);
      assert.equal(right.length, 1, `${title}: ${q.options}`);
    }
  }
});

// ------------------------------------------------------------ four by four
test('four by four: every puzzle has 4 groups of 4 and 16 distinct tiles', () => {
  assert.ok(FBF.puzzles.length >= 100, `only ${FBF.puzzles.length} puzzles`);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const [i, p] of FBF.puzzles.entries()) {
    assert.equal(p.groups.length, 4, `puzzle ${i}`);
    for (const g of p.groups) assert.equal(g.items.length, 4, `puzzle ${i} ${g.label}`);
    const tiles = p.groups.flatMap((g) => g.items.map(norm));
    assert.equal(new Set(tiles).size, 16, `puzzle ${i} repeats a tile`);
    assert.deepEqual(p.groups.map((g) => g.level), [...p.groups.map((g) => g.level)].sort(), `puzzle ${i} not in difficulty order`);
  }
});

// ---------------------------------------------------------- fill the list
test('lists: Australian PMs run Barton to the present, numbered once per person', () => {
  const t = LISTS.auPM.terms;
  assert.equal(t[0].name, 'Edmund Barton');
  assert.equal(t[0].number, 1);
  const rudd = t.filter((x) => x.name === 'Kevin Rudd');
  assert.deepEqual(rudd.map((x) => x.number), [26, 26]);
  assert.equal(t.find((x) => x.name === 'Tony Abbott').number, 28);
  assert.equal(new Set(t.map((x) => x.name)).size, 31);
});
test('lists: US presidents number each non-consecutive term (Cleveland, Trump)', () => {
  const t = LISTS.usPres.terms;
  assert.deepEqual(t.filter((x) => x.name === 'Grover Cleveland').map((x) => x.number), [22, 24]);
  assert.ok(t.every((x) => x.number), 'an unnumbered row slipped in');
  assert.equal(t[0].name, 'George Washington');
});
test('lists: UK list includes the PM in office on 1 January 1900 (Salisbury)', () => {
  assert.ok(LISTS.ukPM.terms[0].name.includes('Salisbury') || LISTS.ukPM.terms[0].name.includes('Gascoyne-Cecil'), LISTS.ukPM.terms[0].name);
});
test('lists: terms are in date order', () => {
  for (const [k, l] of Object.entries(LISTS)) {
    const years = l.terms.map((x) => x.from);
    assert.deepEqual(years, [...years].sort((a, b) => a - b), k);
  }
});
test('rowMatches exact (as you type): a typo or half-typed name never locks a row', () => {
  const row = { accept: ['Julia Gillard', 'Gillard'] };
  assert.ok(rowMatches('Gillard', row, { exact: true }));
  assert.ok(rowMatches('julia gillard', row, { exact: true }));
  for (const g of ['Gilard', 'Gillar', 'Gill']) assert.ok(!rowMatches(g, row, { exact: true }), g);
});
test('rowMatches: full name, surname, and a typo', () => {
  const row = LISTS.auPM.terms.find((x) => x.name === 'Julia Gillard');
  for (const g of ['Julia Gillard', 'gillard', 'Gilard']) assert.ok(rowMatches(g, row), g);
  assert.ok(!rowMatches('Rudd', row));
});

// ---------------------------------------------------------- saturday paper
test('saturdayKey: the Saturday on or before the date, local time', () => {
  assert.equal(saturdayKey(new Date(2026, 8, 23, 9)), '2026-09-19'); // Wednesday
  assert.equal(saturdayKey(new Date(2026, 8, 26, 0, 5)), '2026-09-26'); // Saturday just after midnight
  assert.equal(saturdayKey(new Date(2026, 8, 25, 23, 55)), '2026-09-19'); // Friday night
  assert.equal(saturdayKey(new Date(2027, 0, 1, 12)), '2026-12-26'); // across new year
});
const BY_CAT = {};
for (const f of readdirSync(new URL('../src/data/questions/', import.meta.url))) {
  for (const q of JSON.parse(readFileSync(new URL(`../src/data/questions/${f}`, import.meta.url), 'utf8'))) (BY_CAT[q.category] ||= []).push(q);
}
test('weekly paper: 25 questions, 8/10/7 in order, at most 3 per category, no repeats', () => {
  for (const week of ['2026-09-19', '2026-09-26', '2027-01-02']) {
    const { questions } = pickWeekly(BY_CAT, week);
    assert.equal(questions.length, 25, week);
    const diffs = questions.map((q) => q.difficulty);
    assert.deepEqual(diffs, [...Array(WEEKLY_SHAPE.easy).fill('easy'), ...Array(WEEKLY_SHAPE.medium).fill('medium'), ...Array(WEEKLY_SHAPE.hard).fill('hard')], week);
    const per = {};
    for (const q of questions) per[q.category] = (per[q.category] || 0) + 1;
    assert.ok(Math.max(...Object.values(per)) <= WEEKLY_MAX_PER_CATEGORY, JSON.stringify(per));
    assert.equal(new Set(questions.map((q) => q.id)).size, 25);
  }
});
test('weekly paper: every Saturday for the next two years is a full 25', () => {
  const short = [];
  for (let w = 0; w < 104; w++) {
    const key = addDaysToKey('2026-09-19', 7 * w);
    const n = pickWeekly(BY_CAT, key).questions.length;
    if (n !== 25) short.push(`${key}: ${n}`);
  }
  assert.deepEqual(short, []);
});
test('weekly paper: same week, same paper; next week, a different one', () => {
  const a = pickWeekly(BY_CAT, '2026-09-19').questions.map((q) => q.id);
  assert.deepEqual(pickWeekly(BY_CAT, '2026-09-19').questions.map((q) => q.id), a);
  assert.notDeepEqual(pickWeekly(BY_CAT, '2026-09-26').questions.map((q) => q.id), a);
});
// --------------------------------------------------------------- timeline
const TL = JSON.parse(readFileSync(new URL('../src/data/timeline.json', import.meta.url), 'utf8')).events;
test('timeline: rounds have 5 distinct years, at most 2 per kind, easy gaps of 8+', () => {
  for (let s = 0; s < 200; s++) {
    for (const difficulty of ['easy', 'hard']) {
      const r = buildRound(TL, { difficulty, seed: s });
      assert.equal(r.length, 5);
      const years = r.map((e) => e.year).sort((a, b) => a - b);
      assert.equal(new Set(years).size, 5, `seed ${s} ${difficulty} repeats a year`);
      const kinds = {};
      for (const e of r) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      assert.ok(Math.max(...Object.values(kinds)) <= 2, JSON.stringify(kinds));
      if (difficulty === 'easy') for (let i = 1; i < 5; i++) assert.ok(years[i] - years[i - 1] >= 8, years.join(','));
      else assert.ok(years[4] - years[0] <= 12, years.join(','));
    }
  }
});
test('timeline: scoring counts correctly ordered pairs', () => {
  const ev = (year) => ({ year });
  assert.deepEqual(scoreOrder([1, 2, 3, 4, 5].map(ev)), { correct: 10, total: 10 });
  assert.deepEqual(scoreOrder([5, 4, 3, 2, 1].map(ev)), { correct: 0, total: 10 });
  assert.deepEqual(scoreOrder([2, 1, 3, 4, 5].map(ev)), { correct: 9, total: 10 });
});
test('matchChartGuess: leading abbreviation and pre-colon title (E.T., Rambo)', () => {
  const films = [
    { id: 'et', rank: 1, label: 'E.T. the Extra-Terrestrial', answers: ['E.T. the Extra-Terrestrial', 'Steven Spielberg'] },
    { id: 'rambo', rank: 2, label: 'Rambo: First Blood Part II', answers: ['Rambo: First Blood Part II', 'George P. Cosmatos'] },
    { id: 'tg', rank: 3, label: 'Top Gun', answers: ['Top Gun', 'Tony Scott'] }
  ];
  for (const g of ['E.T.', 'ET', 'e.t', 'E.T. the Extra-Terrestrial']) assert.equal(matchChartGuess(g, films)?.item.id, 'et', g);
  assert.equal(matchChartGuess('Rambo', films)?.item.id, 'rambo');
  assert.equal(matchChartGuess('Top', films), null);
});
test('matchChartGuess: a short name shared by several films is ambiguous, not a free fill', () => {
  const board = topSongs(FILMS.boxOffice, 2010, 2019, 20);
  // Two Star Wars films on the 2010s board and no plain "Star Wars": ambiguous.
  assert.ok(matchChartGuess('Star Wars', board)?.ambiguous);
  assert.equal(matchChartGuess('Star Wars: The Last Jedi', board)?.item.label, 'Star Wars: The Last Jedi');
  // "Avengers" IS The Avengers (2012). Typing it again reports it as found
  // rather than quietly filling Infinity War or Endgame.
  const first = matchChartGuess('Avengers', board);
  assert.equal(first?.item.label, 'The Avengers');
  assert.equal(matchChartGuess('Avengers', board, new Set([first.item.id]))?.alreadyFound, true);
});
// ---------------------------------------------------------- name the year
test('name the year: points fall by two per year out', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9].map((d) => yearPoints(1990 + d, 1990)), [10, 8, 6, 2, 0, 0]);
  assert.equal(yearPoints('', 1990), 0);
});
test('name the year: 5 rounds, 3 clues of 3 kinds from the right year, 4 options incl. the answer', () => {
  for (let s = 0; s < 200; s++) {
    const rounds = buildYearRounds(TL, { seed: s });
    assert.equal(rounds.length, 5);
    for (const r of rounds) {
      assert.equal(r.clues.length, 3);
      assert.equal(new Set(r.clues.map((c) => c.kind)).size, 3);
      assert.ok(r.clues.every((c) => c.year === r.year));
      assert.equal(new Set(r.options).size, 4);
      assert.ok(r.options.includes(r.year));
    }
    const ys = rounds.map((r) => r.year).sort((a, b) => a - b);
    for (let i = 1; i < 5; i++) assert.ok(ys[i] - ys[i - 1] >= 3, ys.join(','));
  }
});
test('matchChartGuess: a shared short name resolves once only one is left to find', () => {
  const board = topSongs(FILMS.boxOffice, 2000, 2009, 20);
  const lotr = board.filter((x) => x.label.startsWith('The Lord of the Rings'));
  assert.ok(lotr.length >= 2, 'expected several Lord of the Rings films on the 2000s board');
  assert.ok(matchChartGuess('Lord of the Rings', board)?.ambiguous);
  const found = new Set(lotr.slice(0, -1).map((x) => x.id));
  assert.equal(matchChartGuess('Lord of the Rings', board, found)?.item.id, lotr.at(-1).id);
});
test('timeline: only a reversed order scores 0 or 1 of 10', () => {
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  for (const p of perms([1, 2, 3, 4, 5])) {
    const { correct } = scoreOrder(p.map((year) => ({ year })));
    // Reversed with at most one adjacent pair swapped.
    const displaced = p.filter((v, i) => v !== 5 - i).length;
    if (correct <= 1) assert.ok(displaced <= 2, p.join(','));
  }
});
// ------------------------------------------------------------- obscure-est
const OBS = JSON.parse(readFileSync(new URL('../src/data/obscure.json', import.meta.url), 'utf8')).categories;
test('obscure: every category scores 1 (most obvious) to 100 (rarest), answers distinct', () => {
  for (const c of OBS) {
    assert.equal(c.answers[0].score, 1, c.id);
    assert.equal(c.answers.at(-1).score, 100, c.id);
    assert.equal(new Set(c.answers.map((a) => a.text)).size, c.answers.length, c.id);
  }
});
test('obscure: rarity is sensible (China: India obvious, Bhutan rare)', () => {
  const china = OBS.find((c) => c.id === 'borders-CN');
  const s = (name) => scoreGuess(china, name).score;
  assert.ok(s('India') < 10 && s('Bhutan') > 90, `India ${s('India')}, Bhutan ${s('Bhutan')}`);
  assert.equal(s('Japan'), 0);
});
test('obscure: famous-person categories accept a surname alone', () => {
  const toms = OBS.find((c) => c.id === 'name-Tom');
  assert.equal(scoreGuess(toms, 'Hanks').answer?.text, 'Tom Hanks');
  const johns = OBS.find((c) => c.id === 'name-John');
  assert.equal(scoreGuess(johns, 'Washington').answer?.text, 'John David Washington');
});
test('obscure: a shared name keeps the more famous rarity (Anne Hathaway)', () => {
  // Two Anne Hathaways: the actress and Shakespeare's wife. Last-write-wins
  // once scored a shared name as the rarer person (George Floyd scored 100,
  // before he left the data as a murder victim on 2026-10-01).
  const annes = OBS.find((c) => c.id.startsWith('name-Anne'));
  assert.ok(scoreGuess(annes, 'Anne Hathaway').score < 50, String(scoreGuess(annes, 'Anne Hathaway').score));
});
// Anchors set before the full filmographies were built (2026-10-01): famous
// films a director made must score, and their best-known film must sit at the
// obvious end, not the rare end where Casablanca used to be.
test('obscure: film lists are full filmographies, ranked by fame', () => {
  const film = (d) => OBS.find((c) => c.id === `films-${d}`);
  for (const [d, title] of [['Steven Spielberg', 'Catch Me If You Can'], ['Michael Curtiz', 'White Christmas'],
    ['Ernst Lubitsch', 'The Shop Around the Corner'], ['George Lucas', 'A New Hope']]) {
    assert.ok(scoreGuess(film(d), title).score > 0, `${title} not accepted for ${d}`);
  }
  for (const [d, title] of [['Michael Curtiz', 'Casablanca'], ['Steven Spielberg', 'Jurassic Park'], ['John Ford', 'The Searchers']]) {
    assert.ok(scoreGuess(film(d), title).score <= 20, `${title} scored ${scoreGuess(film(d), title).score} for ${d}`);
  }
});
test('obscure: a game has five distinct categories covering all four areas', () => {
  for (let s = 0; s < 100; s++) {
    const cats = pickCategories(OBS, s);
    assert.equal(new Set(cats.map((c) => c.id)).size, 5);
    for (const k of ['geo', 'people', 'music', 'film']) assert.ok(cats.some((c) => c.kind === k), k);
  }
});
// ------------------------------------------------------------ missing link
test('missing link: points 4, 3, 2, 1 by clues seen', () => {
  assert.deepEqual([1, 2, 3, 4].map(linkPoints), [4, 3, 2, 1]);
});
test('missing link: 5 rounds, 4 distinct clues, exactly one option fits', () => {
  // Normalising is the slow part, so each string is normalised once.
  const memo = new Map();
  const norm = (s) => (memo.has(s) ? memo.get(s) : (memo.set(s, normalise(s)), memo.get(s)));
  for (let s = 0; s < 150; s++) {
    const rounds = buildLinkRounds(OBS, { seed: s });
    assert.equal(rounds.length, 5);
    for (const r of rounds) {
      assert.equal(new Set(r.clues.map((c) => c.answer)).size, 4, r.id);
      assert.equal(new Set(r.options).size, 4, r.id);
      assert.equal(r.options[r.correctIndex], r.link);
      // No wrong option fits any clue, by identity or by the text shown
      // (a surname clue "Scott" fits a famous Tony as well as a famous Tim).
      for (const [i, opt] of r.options.entries()) {
        if (i === r.correctIndex) continue;
        const cat = OBS.find((c) => c.prompt === opt);
        const hit = cat.answers.some((a) =>
          r.clues.some((c) => norm(c.answer) === norm(a.text) || a.accept.some((x) => norm(x) === norm(c.text)))
        );
        assert.ok(!hit, `${r.id}: "${opt}" also fits a clue`);
      }
    }
  }
});
test('missing link: people clues are surnames, not giveaway full names', () => {
  for (let s = 0; s < 60; s++) {
    for (const r of buildLinkRounds(OBS, { seed: s }).filter((x) => x.id.startsWith('name-'))) {
      const first = r.id.slice(5);
      assert.ok(r.clues.every((c) => !c.text.startsWith(first + ' ')), r.clues.map((c) => c.text).join(','));
    }
  }
});
// ------------------------------------------------------------------ sync
{
  const stats = (n) => JSON.stringify({ totalAnswered: n, totalCorrect: n / 2, totalQuizzes: 1, highScore: n, categoryStats: { geo: { total: n, correct: 1 } } });

  test('sync: the open tab and non-app keys never leave the device', () => {
    assert.equal(isSyncedKey('sqt_v4_live_tab'), false);
    assert.equal(isSyncedKey('kia_sync'), false);
    assert.equal(isSyncedKey('sqt_v3_stats'), false);
    assert.equal(isSyncedKey('sqt_v4_stats'), true);
    assert.equal(isSyncedKey('sqt_v4_live_sim_weekly'), true);
  });

  test('sync: diff reports changed, added and deleted keys only', () => {
    const d = diffSnapshot({ sqt_v4_a: '1', sqt_v4_b: '2', sqt_v4_new: 'x' }, { sqt_v4_a: '1', sqt_v4_b: 'old', sqt_v4_gone: 'y' });
    assert.deepEqual(d, { sqt_v4_b: '2', sqt_v4_new: 'x', sqt_v4_gone: null });
  });

  test('sync: pull takes only keys newer than this device last saw', () => {
    const server = {
      sqt_v4_stats: { value: 'new', updatedAt: 200 },
      sqt_v4_setup: { value: 'server', updatedAt: 50 },
      sqt_v4_live_quiz_quiz: { value: null, updatedAt: 300 }
    };
    const apply = planPull(server, { sqt_v4_stats: 100, sqt_v4_setup: 100 }, {
      sqt_v4_stats: 'old', sqt_v4_setup: 'mine', sqt_v4_live_quiz_quiz: 'round'
    });
    assert.deepEqual(apply, { sqt_v4_stats: 'new', sqt_v4_live_quiz_quiz: null });
  });

  test('sync: pull keeps a local edit made after the server copy and not yet sent', () => {
    const server = { sqt_v4_setup: { value: 'server', updatedAt: 200 }, sqt_v4_stats: { value: 'new', updatedAt: 200 } };
    const apply = planPull(server, {}, { sqt_v4_setup: 'mine', sqt_v4_stats: 'old' }, { sqt_v4_setup: 250, sqt_v4_stats: 150 });
    assert.deepEqual(apply, { sqt_v4_stats: 'new' });
  });

  test('sync: first sign-in copies server deletions except progress keys', () => {
    const server = {
      sqt_v4_live_quiz_quiz: { value: null, updatedAt: 9 },
      sqt_v4_stats: { value: null, updatedAt: 9 },
      sqt_v4_setup: { value: '{}', updatedAt: 9 },
      sqt_v4_live_gone_elsewhere: { value: null, updatedAt: 9 }
    };
    const local = { sqt_v4_live_quiz_quiz: 'round', sqt_v4_stats: stats(5), sqt_v4_setup: '{}' };
    assert.deepEqual(tombstoneWrites(server, local), { sqt_v4_live_quiz_quiz: null });
  });

  test('sync: pull never writes the device-only tab key even if the server has it', () =>
    assert.deepEqual(planPull({ sqt_v4_live_tab: { value: '"vault"', updatedAt: 9 } }, {}, {}), {}));

  test('sync: routine round trips never double the totals', () => {
    // Phone pushes, laptop pulls, laptop pushes back, phone pulls: the plain
    // last-writer-wins path must copy stats, never add them.
    let server = {};
    const phone = { sqt_v4_stats: stats(40) };
    for (const [k, v] of Object.entries(diffSnapshot(phone, {}))) server[k] = { value: v, updatedAt: 1 };
    const laptop = {};
    Object.assign(laptop, planPull(server, {}, laptop));
    for (const [k, v] of Object.entries(diffSnapshot(laptop, laptop))) server[k] = { value: v, updatedAt: 2 };
    Object.assign(phone, planPull(server, { sqt_v4_stats: 1 }, phone));
    assert.equal(JSON.parse(laptop.sqt_v4_stats).totalAnswered, 40);
    assert.equal(JSON.parse(phone.sqt_v4_stats).totalAnswered, 40);
  });

  test('sync: first sign-in with progress on both sides merges them once', () => {
    const w = mergeSnapshots(
      { sqt_v4_stats: stats(10), sqt_v4_missed: '[]', sqt_v4_weekly: '{"2026-09-19":{"score":20,"total":25}}' },
      { sqt_v4_stats: stats(30), sqt_v4_missed: '[{"id":"q1","box":0,"due":"2026-09-25"}]', sqt_v4_weekly: '{"2026-09-19":{"score":5,"total":25},"2026-09-12":{"score":9,"total":25}}', sqt_v4_setup: '{"count":10}' }
    );
    const s = JSON.parse(w.sqt_v4_stats);
    assert.equal(s.totalAnswered, 40);
    assert.equal(s.categoryStats.geo.total, 40);
    assert.equal(JSON.parse(w.sqt_v4_missed).length, 1);
    const weekly = JSON.parse(w.sqt_v4_weekly);
    assert.equal(weekly['2026-09-19'].score, 20, 'first score kept, not the other device');
    assert.equal(weekly['2026-09-12'].score, 9);
    assert.equal(w.sqt_v4_setup, '{"count":10}');
  });

  test('sync: a fresh browser takes the account as-is, no merge', () => {
    const incoming = { sqt_v4_stats: stats(30), sqt_v4_live_sim_weekly: '{"i":7}' };
    assert.equal(hasProgress({}), false);
    assert.deepEqual(mergeSnapshots({ sqt_v4_setup: '{}' }, incoming), incoming);
  });

  test('sync: an empty account keeps local progress but takes its rounds', () => {
    const w = mergeSnapshots({ sqt_v4_stats: stats(10) }, { sqt_v4_stats: stats(0), sqt_v4_live_quiz_quiz: '{"ids":["a"]}' });
    assert.equal(w.sqt_v4_stats, undefined);
    assert.equal(w.sqt_v4_live_quiz_quiz, '{"ids":["a"]}');
  });

  test('sync: signing back in to the same account never doubles the totals', () => {
    const base = { sqt_v4_stats: stats(40), sqt_v4_setup: '{"count":10}' };
    // Nothing played anywhere since: nothing to write.
    assert.deepEqual(rebaseSnapshots({ ...base }, { ...base }, base), {});
    // Played on the phone since, not here: take the account's copy.
    const w = rebaseSnapshots({ ...base }, { ...base, sqt_v4_stats: stats(60) }, base);
    assert.equal(JSON.parse(w.sqt_v4_stats).totalAnswered, 60);
  });

  test('sync: re-sign-in keeps what was played here while signed out', () => {
    const base = { sqt_v4_stats: stats(40) };
    assert.deepEqual(rebaseSnapshots({ sqt_v4_stats: stats(50) }, { ...base }, base), {}, 'local copy stays and is pushed');
  });

  test('sync: re-sign-in with play on both sides adds only the new play', () => {
    const base = { sqt_v4_stats: stats(40), sqt_v4_games: '{"geo":{"plays":3,"best":5,"items":{"fr":{"seen":2,"correct":1}}}}' };
    const local = { sqt_v4_stats: stats(50), sqt_v4_games: '{"geo":{"plays":4,"best":9,"items":{"fr":{"seen":3,"correct":2}}}}' };
    const server = { sqt_v4_stats: stats(60), sqt_v4_games: '{"geo":{"plays":5,"best":6,"items":{"fr":{"seen":2,"correct":1}}}}' };
    const w = rebaseSnapshots(local, server, base);
    const st = JSON.parse(w.sqt_v4_stats);
    assert.equal(st.totalAnswered, 70, '60 on the account plus 10 played here');
    assert.equal(st.categoryStats.geo.total, 70);
    const geo = JSON.parse(w.sqt_v4_games).geo;
    assert.equal(geo.plays, 6);
    assert.equal(geo.best, 9);
    assert.deepEqual(geo.items.fr, { seen: 3, correct: 2 });
  });

  test('sync: re-sign-in copies a deletion made on the account', () => {
    const base = { sqt_v4_live_quiz_quiz: 'round', sqt_v4_stats: stats(5) };
    assert.deepEqual(rebaseSnapshots({ ...base }, { sqt_v4_live_quiz_quiz: null, sqt_v4_stats: stats(5) }, base), { sqt_v4_live_quiz_quiz: null });
  });

  test('sync: unreadable data on one side does not throw', () =>
    assert.doesNotThrow(() => mergeSnapshots({ sqt_v4_stats: stats(5) }, { sqt_v4_stats: '{bad', sqt_v4_missed: 'null', sqt_v4_games: '{"geo":{}}' })));
}


// -------------------------------------------------------------- addresses
{
  test('route: every game and screen has an address that leads back to it', () => {
    const tabs = [...GAMES.map((g) => g.tab), 'home', 'analytics', 'settings', 'revision', 'challenge'];
    for (const tab of tabs) assert.equal(tabForPath(pathForTab(tab)), tab, tab);
    assert.equal(new Set(tabs.map(pathForTab)).size, new Set(tabs).size, 'two screens share an address');
  });
  test('route: readable names, home at /, trailing slash and case ignored', () => {
    assert.equal(pathForTab('daily'), '/daily-five');
    assert.equal(pathForTab('home'), '/');
    assert.equal(tabForPath('/'), 'home');
    assert.equal(tabForPath('/Clue-Ladder/'), 'clue-ladder');
    assert.equal(tabForPath('/%'), '%');
  });
}


test('countries that take "the" in a sentence', () => {
  assert.equal(countryInText('Marshall Islands'), 'the Marshall Islands');
  assert.equal(countryInText('Bahamas', { start: true }), 'The Bahamas');
  assert.equal(countryInText('United States'), 'the United States');
  assert.equal(countryInText('France'), 'France');
  assert.equal(countryInText('Isle of Man'), 'Isle of Man');
});

// ---------------------------------------------------------- famous first names
{
  const FAMOUS = JSON.parse(readFileSync(new URL('../src/data/famous.json', import.meta.url), 'utf8')).names;
  // Pete's per-person calls: "in" keeps someone the rule would leave out.
  const keptByPete = new Set(
    readFileSync(new URL('./famous-left-out.csv', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((l) => /,in,Q\d+$/.test(l))
      .map((l) => l.match(/(Q\d+)$/)[1])
  );
  test('famous: nobody is on the boards twice (2026-10-18: Luis Suárez was, via two titles)', () => {
    const seen = new Map();
    const twice = [];
    for (const n of FAMOUS) for (const p of n.people) {
      if (seen.has(p.id)) twice.push(`${p.name} on ${seen.get(p.id)} and ${n.first}`);
      seen.set(p.id, n.first);
    }
    assert.deepEqual(twice, []);
  });
  test('famous: every board has at least 12 people', () =>
    assert.deepEqual(FAMOUS.filter((n) => n.people.length < 12).map((n) => `${n.first} ${n.people.length}`), []));
  test("famous: nobody Pete's rule leaves out is on a board, unless he kept them", () => {
    const hits = FAMOUS.flatMap((n) => n.people.filter((p) => leftOutByRule(p.description, p.name) && !keptByPete.has(p.id)).map((p) => `${p.name}: ${p.description}`));
    assert.deepEqual(hits, []);
  });
  test('famous: the rule keeps the cases it once got wrong', () => {
    for (const d of ['American criminal-justice activist', 'American criminal profiler, forensic linguist, and author', 'American wrongly convicted of murder (1941–2013)', 'American con artist'])
      assert.equal(leftOutByRule(d, ''), false, d);
    for (const d of ['English criminal (born 1952)', 'Austrian war criminal', 'American serial killer', 'American man convicted of murder and previously wrongly convicted of rape'])
      assert.equal(leftOutByRule(d, ''), true, d);
  });
}


// -------------------------------------------------------------- word play
const VOCAB_DATA = JSON.parse(readFileSync(new URL('../src/data/vocab.json', import.meta.url), 'utf8'));
const VOCAB = VOCAB_DATA.groups;
test('vocab: every word appears once, opposites and near links point at real families of the same kind', () => {
  const seen = new Set();
  const ids = new Map(VOCAB.map((g) => [g.id, g]));
  for (const g of VOCAB) {
    assert.ok(g.words.length >= 3, `${g.id} has fewer than 3 words`);
    for (const [w, d, z] of g.words) {
      assert.ok(!seen.has(w), `${w} appears twice`);
      assert.ok(d && d.length > 5, `${w} has no definition`);
      assert.ok(typeof z === 'number' && z >= 1 && z < 7, `${w}: no frequency (run scripts/build-vocab.py)`);
      seen.add(w);
    }
    if (g.ant) {
      assert.ok(ids.has(g.ant), `${g.id}: unknown opposite ${g.ant}`);
      // Hand-written opposites must be paired both ways; WordNet ones may be one-way.
      if (!g.src) assert.equal(ids.get(g.ant).ant, g.id, `${g.id} <-> ${g.ant} opposites not paired both ways`);
      assert.equal(ids.get(g.ant).pos, g.pos, `${g.id}: opposite is a different part of speech`);
    }
    for (const n of g.near || []) assert.ok(ids.has(n), `${g.id}: unknown near ${n}`);
  }
});
test('vocab: the clash table is current (rerun scripts/build-vocab.py after editing vocab.json)', () => {
  assert.equal(VOCAB_DATA.clash.n, VOCAB.length, 'clash table size does not match the families');
  const { byId, clashes } = indexGroups(VOCAB_DATA);
  // two pairs the first review found by hand and the vectors also mark
  assert.ok(clashes(byId.get('candid'), byId.get('concise')), 'blunt/terse families not marked');
  assert.ok(clashes(byId.get('talkative'), byId.get('concise')), 'loquacious/laconic families not marked');
  assert.ok(!clashes(byId.get('talkative'), byId.get('huge')), 'unrelated families marked');
});
test('vocab: 60 games per type build full rounds with exactly the right answers from one family', () => {
  const { byId, familyOf } = indexGroups(VOCAB_DATA);
  for (const type of ['mixed', 'syn', 'ant', 'meaning']) {
    for (let s = 0; s < 60; s++) {
      const rounds = buildVocabRounds(VOCAB_DATA, { seed: s, type });
      assert.equal(rounds.length, 10, `${type} seed ${s}: ${rounds.length} rounds`);
      assert.equal(new Set(rounds.map((r) => r.group)).size, 10, 'a family repeated in one game');
      for (const r of rounds) {
        assert.equal(new Set(r.options).size, r.options.length, 'duplicate option');
        const fams = r.options.map((w) => byId.get(familyOf.get(w)));
        const g = byId.get(r.group);
        if (r.type === 'syn') {
          assert.equal(fams.filter((f) => f.id === g.id).length, r.pick, 'synonym count');
          // Decoys come from distinct, unrelated families: no second pair.
          const others = fams.filter((f) => f.id !== g.id);
          assert.equal(new Set(others.map((f) => f.id)).size, others.length, 'two decoys from one family');
        } else if (r.type === 'ant') {
          assert.equal(fams.filter((f) => f.id === g.ant).length, 1, 'exactly one opposite');
          assert.equal(fams.filter((f) => f.id === g.id).length, 1, 'one synonym trap');
        } else {
          assert.equal(fams.filter((f) => f.id === g.id || g.near.has(f.id)).length, 1, 'only the defined word fits');
        }
        assert.ok(isCorrect(r, r.answer));
        assert.ok(!isCorrect(r, r.options.filter((w) => !r.answer.includes(w)).slice(0, r.pick)));
      }
    }
  }
});
test('vocab: wrong options never clash with the right answers (or the opposite, in opposites questions) or each other', () => {
  const { byId, familyOf, clashes } = indexGroups(VOCAB_DATA);
  let rounds = 0;
  for (const level of ['easy', 'all', 'hard']) {
    for (const type of ['syn', 'ant', 'meaning']) {
      for (let s = 0; s < 15; s++) {
        for (const r of buildVocabRounds(VOCAB_DATA, { seed: s, type, level, count: 20 })) {
          rounds++;
          const g = byId.get(r.group);
          // The opposite family matters only in an opposites question: a wrong
          // option near "reveal" is harmless when asking for synonyms of "conceal".
          const keep = new Set(r.type === 'ant' ? [g.id, g.ant] : [g.id]);
          const decoys = [...new Set(r.options.map((w) => familyOf.get(w)))].filter((id) => !keep.has(id)).map((id) => byId.get(id));
          for (const d of decoys) {
            for (const k of keep) assert.ok(!clashes(d, byId.get(k)), `${r.id}: ${d.id} clashes with ${k}`);
            for (const e of decoys) if (e !== d) assert.ok(!clashes(d, e), `${r.id}: decoys ${d.id} and ${e.id} clash`);
          }
        }
      }
    }
  }
  assert.ok(rounds >= 2700, `only ${rounds} rounds checked`);
});
test('vocab: missed words get a reserved share of each game, even among thousands of words', () => {
  let hits = 0;
  for (let s = 0; s < 100; s++) {
    if (buildVocabRounds(VOCAB_DATA, { seed: s, type: 'meaning', review: new Set(['pusillanimous']) }).some((r) => r.target === 'pusillanimous')) hits++;
  }
  assert.ok(hits > 80, `missed word came up in ${hits}/100 games`);
});
test('vocab: the reveal marks the synonym trap and the opposite', () => {
  const r = buildVocabRounds(VOCAB_DATA, { seed: 3, type: 'ant' })[0];
  const roles = explainRound(r, VOCAB_DATA).options.map((o) => o.role).sort();
  assert.deepEqual(roles.filter((x) => x !== 'unrelated'), ['opposite', 'trap']);
});

// Anchors chosen before looking at the output: plain words are common, the
// famously obscure ones rare, and the test recovers the level of a player who
// knows exactly the words down to a known rarity.
test('vocab test: word frequencies put plain words above obscure ones', () => {
  const z = new Map(VOCAB.flatMap((g) => g.words.map(([w, , f]) => [w, f])));
  for (const w of ['ban', 'expand']) assert.ok(z.get(w) > 3.5, `${w} ${z.get(w)}`);
  for (const w of ['pusillanimous', 'sedulous', 'prolix']) assert.ok(z.get(w) < 2, `${w} ${z.get(w)}`);
  assert.ok(z.get('open-handed') < 3, 'hyphenated override applied');
});
const simulate = (cutoff, seed) => {
  const ctx = testContext(VOCAB_DATA);
  const rand = makeRng(seed);
  let post = prior(), used = [], est = estimate(post);
  for (let i = 0; i < TEST_LENGTH; i++) {
    const r = nextRound(ctx, { level: est.level, usedGroups: used, index: i, seed });
    assert.ok(r, `ran out of questions at ${i}`);
    assert.ok(!used.includes(r.group), 'family repeated in a test');
    used.push(r.group);
    const g = guessRate(r);
    post = update(post, r.zipf, g, r.zipf >= cutoff || rand() < g);
    est = estimate(post);
  }
  return est.level;
};
test('vocab test: recovers a simulated player level, and a wider vocabulary scores higher', () => {
  const mean = (c) => Array.from({ length: 25 }, (_, k) => simulate(c, k + 1)).reduce((a, b) => a + b, 0) / 25;
  const m = [1.5, 2, 2.5, 3, 3.5].map(mean);
  [1.5, 2, 2.5, 3, 3.5].forEach((c, i) => assert.ok(Math.abs(m[i] - c) < 0.3, `cutoff ${c} estimated ${m[i].toFixed(2)}`));
  for (let i = 1; i < m.length; i++) assert.ok(m[i] > m[i - 1], 'level not monotonic in vocabulary');
});
test('vocab test: guess rates and plain-words level', () => {
  assert.equal(guessRate({ type: 'meaning', options: [1, 2, 3, 4], pick: 1 }), 0.25);
  assert.equal(guessRate({ type: 'syn', options: [1, 2, 3, 4, 5], pick: 2 }), 0.1);
  assert.match(describeLevel(2), /about once in every 110 novels/);
});
test('vocab test: a level outside the words in the set is shown as off the scale, not a number', () => {
  const b = scaleBounds(VOCAB);
  assert.equal(formatLevel(2.34, b), 'level 2.3');
  assert.equal(formatLevel(5.2, b), 'below the bottom of the scale');
  assert.equal(formatLevel(0.4, b), 'off the top of the scale');
});


// ----------------------------------------------------------- data hygiene
// Junk that reached players before 2026-10-01: wiki markup left in titles
// ("[[I Do", "| Chariots of Fire"), quotation authors in definitions
// ("; - G.K.Chesterton"), and a one-word prime minister ("David") from a
// vandalised Wikidata item. Every string in every data file is checked.
test('data: no wiki markup, stray pipes or quotation leftovers in any data file', () => {
  const bad = [];
  const walk = (file, v, path) => {
    if (typeof v === 'string') {
      if (/\[\[|\]\]|\{\{|\}\}|^\s*\||;\s*;|;\s*-\s*[A-Z]/.test(v)) bad.push(`${file}${path}: ${v.slice(0, 60)}`);
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(file, x, `${path}/${k}`);
  };
  const files = ['charts/music.json', 'charts/films.json', 'charts/tv.json', 'timeline.json', 'lists.json', 'famous.json',
    'fourbyfour.json', 'obscure.json', 'vocab.json'];
  for (const f of files) walk(f, JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8')), '');
  assert.equal(bad.length, 0, `${bad.length} junk strings, first: ${bad[0]}`);
});
test('data: every prime minister and president has a full name', () => {
  for (const [key, l] of Object.entries(LISTS)) {
    for (const t of l.terms) assert.ok(/\S+ \S+/.test(t.name), `${key}: "${t.name}" (${t.from}) is not a full name`);
  }
});

// ------------------------------------------------------ four by four (P6)
// The groups and the overlap check come from the same module the builder uses,
// so "belongs to a group" means one thing in both places.
const FBF_SRC = loadSources(ROOT);
const FBF_GROUPS = buildGroups(FBF_SRC);
const FBF_BY_LABEL = indexByLabel(FBF_GROUPS);
const FBF_LOOKUP = countryLookup(FBF_SRC.countries);
test('four by four: every tile belongs to its own group (2026-10-18: No Time to Die was a Mendes film)', () => {
  const wrong = [];
  for (const [i, p] of FBF.puzzles.entries()) {
    for (const g of p.groups) {
      const def = FBF_BY_LABEL.get(g.label);
      if (def) for (const t of g.items) if (!tileFits(def, t, FBF_LOOKUP)) wrong.push(`#${i} "${t}" is not in ${g.label}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('four by four: no tile fits a second group in its puzzle (2026-10-17: 21 hits in 10 puzzles)', () => {
  const unknown = new Set();
  const hits = [];
  for (const [i, p] of FBF.puzzles.entries()) {
    for (const g of p.groups) if (!FBF_BY_LABEL.has(g.label)) unknown.add(g.label);
    for (const h of findOverlaps(p, FBF_BY_LABEL, FBF_LOOKUP)) hits.push(`#${i} "${h.tile}" (${h.own}) also fits ${h.other}`);
  }
  // A label the builder no longer makes would be skipped silently by the check.
  assert.equal(unknown.size, 0, `labels the builder does not know: ${[...unknown].join('; ')}`);
  assert.equal(hits.length, 0, `${hits.length} overlaps, first: ${hits[0]}`);
});
test('four by four: the overlap check catches landlocked decoys and capitals that are also countries', () => {
  const puzzle = (...groups) => ({ groups: groups.map(([label, items]) => ({ label, items })) });
  // Slovakia is landlocked; a player who sees "Landlocked in Asia" will try it.
  const slovakia = puzzle(['Borders Poland', ['Slovakia', 'Germany', 'Ukraine', 'Belarus']], ['Landlocked in Asia', ['Laos', 'Nepal', 'Bhutan', 'Mongolia']]);
  assert.deepEqual(findOverlaps(slovakia, FBF_BY_LABEL, FBF_LOOKUP).map((h) => h.tile), ['Slovakia', 'Belarus']);
  // A tile that is a capital in one group and a country name in another.
  const lux = puzzle(['Capitals in Western Europe', ['Luxembourg', 'Paris', 'Berlin', 'Vaduz']], ['Borders Belgium', ['France', 'Germany', 'Luxembourg', 'Netherlands']]);
  assert.ok(findOverlaps(lux, FBF_BY_LABEL, FBF_LOOKUP).some((h) => h.tile === 'Luxembourg'));
  // A clean puzzle reports nothing.
  const clean = puzzle(['Borders Poland', ['Germany', 'Ukraine', 'Lithuania', 'Russia']], ['Landlocked in Asia', ['Laos', 'Nepal', 'Bhutan', 'Mongolia']]);
  assert.deepEqual(findOverlaps(clean, FBF_BY_LABEL, FBF_LOOKUP), []);
});
test('four by four: no tile in more than 3 puzzles, no group in more than 5', () => {
  const item = new Map();
  const label = new Map();
  for (const p of FBF.puzzles) {
    for (const g of p.groups) {
      label.set(g.label, (label.get(g.label) || 0) + 1);
      for (const t of g.items) item.set(t.toLowerCase(), (item.get(t.toLowerCase()) || 0) + 1);
    }
  }
  const over = (m, cap) => [...m].filter(([, n]) => n > cap).map(([k, n]) => `${k} ${n}`);
  assert.deepEqual(over(item, MAX_PUZZLES_PER_ITEM), []);
  assert.deepEqual(over(label, MAX_PUZZLES_PER_LABEL), []);
});
test('four by four: the number-title group draws on every film that starts with a number (or is dropped)', () => {
  const g = FBF_GROUPS.find((x) => x.label === 'Films starting with a number');
  if (g) {
    assert.ok(g.members.length >= 12, `${g.members.length} titles`);
    assert.ok(g.members.every((t) => /^\d/.test(t)), 'a title does not start with a digit');
  }
  assert.ok(!FBF_GROUPS.some((x) => x.label === 'Films with a number for a title'), 'old four-title group is back');
});

// ------------------------------------------------------- fill the list (P6)
test('lists: no answer fits two different people (Johnson, Adams, Harrison, Bush, Roosevelt)', () => {
  for (const [key, l] of Object.entries(LISTS)) {
    const shared = sharedForms(l.terms);
    assert.deepEqual(shared, [], `${key}: ${shared.map((s) => `"${s.form}" -> ${s.people.join(' / ')}`).join('; ')}`);
  }
});
test('lists: a bare surname shared by two presidents belongs to the earlier; the later needs a first name', () => {
  const row = (name) => LISTS.usPres.terms.find((t) => t.name === name);
  const pairs = [['Adams', 'John Adams', 'John Quincy Adams', 'Quincy Adams'], ['Harrison', 'William Henry Harrison', 'Benjamin Harrison', 'Benjamin Harrison'],
    ['Johnson', 'Andrew Johnson', 'Lyndon B. Johnson', 'Lyndon Johnson'], ['Roosevelt', 'Theodore Roosevelt', 'Franklin D. Roosevelt', 'Franklin Roosevelt'],
    ['Bush', 'George H. W. Bush', 'George W. Bush', 'W. Bush']];
  for (const [surname, earlier, later, laterShort] of pairs) {
    assert.ok(rowMatches(surname, row(earlier), { exact: true }), `${surname} -> ${earlier}`);
    assert.ok(!rowMatches(surname, row(later), { exact: true }), `${surname} must not fill ${later}`);
    assert.ok(rowMatches(laterShort, row(later), { exact: true }), `${laterShort} -> ${later}`);
    assert.ok(rowMatches(later, row(later), { exact: true }), later);
  }
  const bushes = ['George H. W. Bush', 'George W. Bush'].map(row);
  assert.ok(!bushes.some((b) => rowMatches('George Bush', b, { exact: true })), '"George Bush" fits a Bush row');
});
test('lists: Douglas-Home answers (Home, Douglas-Home, Alec Douglas-Home); Lloyd George by his usual name', () => {
  const row = (name) => LISTS.ukPM.terms.find((t) => t.name === name);
  for (const g of ['Home', 'Douglas-Home', 'douglas home', 'Alec Douglas-Home']) assert.ok(rowMatches(g, row('Alec Douglas-Home'), { exact: true }), g);
  assert.ok(rowMatches('Lloyd George', row('David Lloyd George'), { exact: true }));
  assert.ok(rowMatches('Law', row('Bonar Law'), { exact: true }));
  assert.ok(!rowMatches('Law', row('Alec Douglas-Home'), { exact: true }));
});
test('finishAccepts: shared single words go to the earlier person, shared first-and-last forms to nobody, whole names stay', () => {
  const out = finishAccepts([
    { name: 'Tom Hale', accept: ['Tom Hale', 'Hale'] },
    { name: 'Tom Ray Hale', accept: ['Tom Ray Hale', 'Hale'] },
    { name: 'Hale Rib', accept: ['Hale Rib', 'Tom Hale'] },
    { name: 'Ann Lee Ford', accept: ['Ann Lee Ford', 'Ford'] },
    { name: 'Ann Mae Ford', accept: ['Ann Mae Ford', 'Ford'] }
  ]);
  // "Tom Hale" is also the first-and-last form of Tom Ray Hale and an answer
  // listed on Hale Rib: it stays with the person it is the whole name of.
  // "Ann Ford" is nobody's whole name and would fit both Anns: neither keeps it.
  assert.deepEqual(out.map((t) => t.accept), [['Tom Hale', 'Hale'], ['Tom Ray Hale'], ['Hale Rib'], ['Ann Lee Ford', 'Ford'], ['Ann Mae Ford']]);
  assert.deepEqual(sharedForms(out), []);
  assert.deepEqual(finishAccepts(out), out, 'not idempotent');
});

// ------------------------------------------------------------ name the year
test('name the year: options never run past the newest year in the events', () => {
  const kinds = ['song', 'film', 'leader'];
  const events = (last) => {
    const out = [];
    for (let y = last - 30; y <= last; y++) for (const kind of kinds) out.push({ year: y, kind, text: `${kind} ${y}` });
    return out;
  };
  for (const last of [2015, 2026, 2031]) {
    const ev = events(last);
    let sawLast = false;
    for (let s = 0; s < 300; s++) {
      for (const r of buildYearRounds(ev, { seed: s })) {
        assert.equal(new Set(r.options).size, 4, `${r.year}: ${r.options}`);
        assert.ok(Math.max(...r.options) <= last, `${last}: option ${Math.max(...r.options)} is after the data`);
        if (r.options.includes(last)) sawLast = true;
      }
    }
    assert.ok(sawLast, `${last} never offered`);
  }
});

// -------------------------------------------------------------- names (P6)
test('nameMatch: Roman numerals beyond xvi (Louis XVIII, John XXIII) give 18th/eighteenth/twenty third', () => {
  assert.deepEqual([romanToInt('xviii'), romanToInt('XXIII'), romanToInt('xl'), romanToInt('xcix'), romanToInt('ii')], [18, 23, 40, 99, 2]);
  for (const bad of ['', 'iiii', 'vv', 'ic', 'c', 'm', 'l', 'cd', 'mcm', 'abc']) assert.equal(romanToInt(bad), 0, bad);
  const people = [{ id: 'louis', first: 'Louis', rest: 'XVIII', views: 1 }, { id: 'john', first: 'John', rest: 'XXIII', views: 1 }];
  for (const g of ['18', '18th', 'eighteenth', 'the eighteenth', 'XVIII']) assert.equal(matchGuess(g, 'Louis', people)?.person.id, 'louis', g);
  for (const g of ['23', '23rd', 'twenty-third', 'the twenty third']) assert.equal(matchGuess(g, 'John', people)?.person.id, 'john', g);
  // The older numerals still work, and "Agent M" is not a thousandth anything.
  assert.equal(matchGuess('the sixteenth', 'Louis', [{ id: 'l16', first: 'Louis', rest: 'XVI', views: 1 }])?.person.id, 'l16');
  assert.equal(matchGuess('1000', 'Agent', [{ id: 'm', first: 'Agent', rest: 'M', views: 1 }]), null);
});

// ------------------------------------------------------------ timeline (P6)
test('timeline: 3,000 seeds on both difficulties draw 5 distinct years with no failure', () => {
  for (const difficulty of ['easy', 'hard']) {
    for (let s = 0; s < 3000; s++) {
      const round = buildRound(TL, { difficulty, seed: s });
      assert.equal(round.length, 5, `${difficulty} ${s}`);
      assert.equal(new Set(round.map((e) => e.year)).size, 5, `${difficulty} ${s}`);
      const kinds = {};
      for (const e of round) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      assert.ok(Math.max(...Object.values(kinds)) <= 2, `${difficulty} ${s}: ${JSON.stringify(kinds)}`);
      if (difficulty === 'hard') assert.ok(Math.max(...round.map((e) => e.year)) - Math.min(...round.map((e) => e.year)) <= 12, `hard ${s}`);
    }
  }
});
test('timeline: sparse or lopsided events widen the rules instead of throwing', () => {
  // One kind only: the two-per-kind rule cannot hold, so it relaxes.
  const oneKind = Array.from({ length: 40 }, (_, i) => ({ year: 1980 + i, kind: 'song', text: `s${i}` }));
  for (const difficulty of ['easy', 'hard']) {
    for (let s = 0; s < 50; s++) assert.equal(new Set(buildRound(oneKind, { difficulty, seed: s }).map((e) => e.year)).size, 5);
  }
  // Hard mode with years spread too thin for a 12-year window: the window widens.
  const sparse = [1900, 1930, 1960, 1990, 2020, 2025].map((year, i) => ({ year, kind: ['song', 'film', 'leader', 'birth', 'song', 'film'][i], text: `e${year}` }));
  for (let s = 0; s < 50; s++) assert.equal(buildRound(sparse, { difficulty: 'hard', seed: s }).length, 5);
  // Easy mode with years closer than eight apart: the gap shrinks.
  const dense = Array.from({ length: 8 }, (_, i) => ({ year: 2000 + i, kind: ['song', 'film', 'leader', 'birth'][i % 4], text: `d${i}` }));
  assert.equal(buildRound(dense, { difficulty: 'easy', seed: 1 }).length, 5);
  // Fewer than five distinct years can never make a round.
  assert.throws(() => buildRound(dense.slice(0, 4), { seed: 1 }), /could not draw/);
});

// ------------------------------------------------------- missing link (P6)
test('missing link: no round shows two clues that read the same', () => {
  const firsts = ['Al', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal'];
  const answers = (surnames) => surnames.map((s, i) => ({
    text: `${firsts[i]} ${s}`,
    accept: [`${firsts[i]} ${s}`, s],
    score: Math.round(1 + (99 * i) / (surnames.length - 1))
  }));
  // The answers nearest the 100 and 70 targets are both Smiths, so a careless pick shows "Smith" twice.
  const dupes = answers(['Brown', 'Jones', 'Wyatt', 'Jones', 'Kemp', 'Smith', 'Lane', 'Smith']);
  const cats = [{ id: 'name-0', prompt: 'A famous person called Zed', kind: 'people', answers: dupes }];
  for (let k = 1; k <= 6; k++) {
    cats.push({ id: `name-${k}`, prompt: `A famous person called N${k}`, kind: 'people', answers: answers(['Ng', 'Poe', 'Quinn', 'Rowe', 'Shaw', 'Teal', 'Ure', 'Vance'].map((x) => `${x}${k}`)) });
  }
  let sawDupeCategory = false;
  for (let s = 0; s < 200; s++) {
    for (const r of buildLinkRounds(cats, { seed: s, count: 3 })) {
      assert.ok(!hasRepeatedClue(r.clues), `${r.id} seed ${s}: ${r.clues.map((c) => c.text)}`);
      if (r.id === 'name-0') sawDupeCategory = true;
    }
  }
  assert.ok(sawDupeCategory, 'the duplicate-surname category was never drawn');
  assert.ok(hasRepeatedClue([{ text: 'Smith' }, { text: 'smith.' }, { text: 'Jones' }]));
  // The shipped categories too.
  for (let s = 0; s < 300; s++) for (const r of buildLinkRounds(OBS, { seed: s })) assert.ok(!hasRepeatedClue(r.clues), `${r.id} seed ${s}`);
});

// ----------------------------------------------------- shipped fields (P6)
test('data: shipped files carry only fields something reads (lib/output.mjs SHIPPED)', () => {
  for (const rel of Object.keys(SHIPPED)) {
    const data = JSON.parse(readFileSync(dataFile(rel), 'utf8'));
    assert.deepEqual(extraKeys(data, SHIPPED[rel]), [], `${rel} has unread fields; run node scripts/slim-data.mjs`);
  }
  // slim() drops what the list leaves out and nothing else.
  assert.deepEqual(slim({ a: 1, b: [{ c: 2, d: 3 }], e: 4 }, { a: true, b: { c: true } }), { a: 1, b: [{ c: 2 }] });
});

// ------------------------------------------------------------------ report
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  x ${f}`));
  process.exit(1);
}
console.log('Logic tests OK.\n');
