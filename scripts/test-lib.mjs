#!/usr/bin/env node
// Tests for the shared storage layer and the generated bank counts. Run by
// `npm test` after scripts/test-logic.mjs.
//
// Two things are checked here because nothing else would notice them break:
//   - bankStats.json is what the first screen shows instead of loading the
//     question bank, so it must match the bank exactly;
//   - every storage key is built from one prefix, and changing it silently
//     orphans every saved player, so a drift between the key builders, the
//     sync pattern and the stored data fails the build.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { computeBankStats } from './build-bank-stats.mjs';
import { STORAGE_PREFIX, storageKey, getStored, setStored, removeStored, clearAllStored, onDirty } from '../src/lib/storage.js';
import { isSyncedKey, mergeSnapshots } from '../src/lib/syncCore.js';
import { loadLive, saveLive } from '../src/lib/persist.js';
import { shareText } from '../src/lib/share.js';
import { markDailyDone, dailyDoneToday, onDailyDone, firstFinish } from '../src/lib/dailyDone.js';
import { advanceStreak } from '../src/lib/streak.js';
import { requestedDay, searchWithDay, pastDays, savedFor, saveSlotFor } from '../src/lib/day.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

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

// A minimal localStorage, installed fresh for each storage test.
function fakeStorage() {
  const map = new Map();
  const store = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    }
  };
  Object.defineProperty(store, 'map', { value: map });
  return store;
}

// ------------------------------------------------------------------ bank stats
const QDIR = new URL('../src/data/questions/', import.meta.url);
const stats = JSON.parse(read('../src/data/bankStats.json'));

test('bankStats.json matches the question files', () => {
  assert.deepEqual(stats, computeBankStats(), 'bankStats.json is stale: run npm run data:bankstats');
});
test('bankStats totals add up', () => {
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(stats.byCategory), stats.total);
  assert.equal(sum(stats.byDifficulty), stats.total);
  assert.ok(stats.total > 0 && stats.countryCount > 0);
});
test('bankStats counts every question by an independent recount', () => {
  let total = 0;
  for (const f of readdirSync(QDIR).filter((n) => n.endsWith('.json'))) {
    total += JSON.parse(readFileSync(new URL(f, QDIR), 'utf8')).length;
  }
  assert.equal(stats.total, total);
});
test('questionBank.js imports every question file', () => {
  const imported = [...read('../src/data/questionBank.js').matchAll(/from '\.\/questions\/([^']+\.json)'/g)].map((m) => m[1]).sort();
  const onDisk = readdirSync(QDIR).filter((n) => n.endsWith('.json')).sort();
  assert.deepEqual(imported, onDisk);
});
test('bankStats country count is the sovereign states in countries.json', () => {
  const { countries } = JSON.parse(read('../src/data/countries.json'));
  assert.equal(stats.countryCount, countries.filter((c) => c.sovereign).length);
});

// ------------------------------------------------------------------ storage prefix
test('the storage prefix is the one existing players already have', () => {
  assert.equal(STORAGE_PREFIX, 'sqt_v4_');
  assert.equal(storageKey('stats'), 'sqt_v4_stats');
});
test('the sync pattern agrees with the prefix', () => {
  for (const name of ['stats', 'missed', 'recent', 'games', 'weekly', 'setup', 'answerMode', 'rounds', 'live_quiz_quiz', 'live_sim_weekly']) {
    assert.equal(isSyncedKey(storageKey(name)), true, name);
  }
  assert.equal(isSyncedKey('sqt_v3_stats'), false);
  assert.equal(isSyncedKey('kia_sync'), false);
  assert.equal(isSyncedKey(STORAGE_PREFIX), false);
});
test('which screen is open stays on the device', () => {
  assert.equal(isSyncedKey(storageKey('live_tab')), false);
});
test('merging progress writes keys under the prefix', () => {
  const stat = (n) =>
    JSON.stringify({ totalAnswered: n, totalCorrect: 1, highScore: 1, bestPercentage: 1, totalQuizzes: 1, categoryStats: {}, difficultyStats: {}, streak: 0 });
  const writes = mergeSnapshots({ [storageKey('stats')]: stat(5) }, { [storageKey('stats')]: stat(7), [storageKey('weekly')]: '{}' });
  assert.ok(Object.keys(writes).length > 0);
  for (const k of Object.keys(writes)) assert.ok(k.startsWith(STORAGE_PREFIX), k);
  assert.ok(storageKey('missed') in writes && storageKey('weekly') in writes);
});
test('no source file spells out the prefix itself', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
      if (e.isDirectory()) {
        if (e.name !== 'data') walk(path);
      } else if (/\.(js|jsx)$/.test(e.name) && e.name !== 'storage.js') {
        if (/['"`]sqt_v\d/.test(readFileSync(path, 'utf8'))) offenders.push(e.name);
      }
    }
  };
  walk(new URL('../src/', import.meta.url));
  assert.deepEqual(offenders, []);
});

// ------------------------------------------------------------------ storage behaviour
test('setStored and getStored round-trip under the prefixed key', () => {
  globalThis.localStorage = fakeStorage();
  setStored('stats', { a: 1 });
  assert.equal(localStorage.getItem('sqt_v4_stats'), '{"a":1}');
  assert.deepEqual(getStored('stats', null), { a: 1 });
});
test('getStored falls back on missing, unparseable and invalid values', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(getStored('nothing', 'fb'), 'fb');
  localStorage.setItem('sqt_v4_bad', '{nope');
  assert.equal(getStored('bad', 'fb'), 'fb');
  localStorage.setItem('sqt_v4_null', 'null');
  assert.equal(getStored('null', 'fb', (v) => v !== null && typeof v === 'object'), 'fb');
});
test('setStored survives storage that throws', () => {
  globalThis.localStorage = {
    ...fakeStorage(),
    setItem: () => {
      throw new Error('quota');
    }
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.doesNotThrow(() => setStored('stats', {}));
  } finally {
    console.warn = warn;
  }
});
test('saves tell sync which key changed', () => {
  globalThis.localStorage = fakeStorage();
  const seen = [];
  onDirty((k) => seen.push(k));
  setStored('setup', {});
  saveLive('quiz_quiz', { ids: [], seed: 1 });
  removeStored('setup');
  onDirty(null);
  assert.deepEqual(seen, ['sqt_v4_setup', 'sqt_v4_live_quiz_quiz', 'sqt_v4_setup']);
});
test('persist.js keeps live state under live_ keys and deletes on null', () => {
  globalThis.localStorage = fakeStorage();
  saveLive('tab', 'vault');
  assert.equal(localStorage.getItem('sqt_v4_live_tab'), '"vault"');
  assert.equal(loadLive('tab'), 'vault');
  assert.equal(loadLive('missing'), undefined);
  saveLive('tab', null);
  assert.equal(localStorage.getItem('sqt_v4_live_tab'), null);
});
test('reset clears every version of the app keys and nothing else', () => {
  globalThis.localStorage = fakeStorage();
  for (const k of ['sqt_v4_stats', 'sqt_v3_old', 'gw_legacy', 'kia_sync', 'other']) localStorage.setItem(k, '1');
  clearAllStored();
  assert.deepEqual([...localStorage.map.keys()].sort(), ['kia_sync', 'other']);
});

// ------------------------------------------------------------------ report
test('daily done: marked for today only, and a new day starts clear', () => {
  markDailyDone('odd-one-out', '2026-10-18');
  markDailyDone('daily', '2026-10-18');
  assert.deepEqual([...dailyDoneToday('2026-10-18')].sort(), ['daily', 'odd-one-out']);
  assert.equal(dailyDoneToday('2026-10-19').size, 0);
  markDailyDone('daily', '2026-10-19');
  assert.deepEqual([...dailyDoneToday('2026-10-19')], ['daily']);
});

test('streak: same day no change, next day +1, a gap restarts at 1', () => {
  assert.deepEqual(advanceStreak({ streak: 4, lastPlayDate: '2026-10-18' }, '2026-10-18', '2026-10-17'), { streak: 4, lastPlayDate: '2026-10-18' });
  assert.deepEqual(advanceStreak({ streak: 4, lastPlayDate: '2026-10-17' }, '2026-10-18', '2026-10-17'), { streak: 5, lastPlayDate: '2026-10-18' });
  assert.deepEqual(advanceStreak({ streak: 4, lastPlayDate: '2026-10-15' }, '2026-10-18', '2026-10-17'), { streak: 1, lastPlayDate: '2026-10-18' });
  assert.deepEqual(advanceStreak({}, '2026-10-18', '2026-10-17'), { streak: 1, lastPlayDate: '2026-10-18' });
});

test('daily done: listeners hear a newly finished round once', () => {
  const heard = [];
  const off = onDailyDone((tab, date) => heard.push(`${tab} ${date}`));
  markDailyDone('scramble-test', '2026-10-22');
  markDailyDone('scramble-test', '2026-10-22');
  off();
  markDailyDone('other-test', '2026-10-22');
  assert.deepEqual(heard, ['scramble-test 2026-10-22']);
});

test("daily done: an earlier day's board finished later keeps today's tick", () => {
  markDailyDone('earlier-test', '2026-10-22');
  markDailyDone('earlier-test', '2026-10-15');
  assert.ok(dailyDoneToday('2026-10-22').has('earlier-test'));
});

test('day: only a real past day from the address counts', () => {
  assert.equal(requestedDay('?day=2026-10-17', '2026-10-18'), '2026-10-17');
  assert.equal(requestedDay('?day=2026-10-18', '2026-10-18'), null); // today is the normal daily
  assert.equal(requestedDay('?day=2026-10-19', '2026-10-18'), null); // no peeking ahead
  assert.equal(requestedDay('?day=2026-02-30', '2026-10-18'), null);
  assert.equal(requestedDay('?day=2025-12-31', '2026-10-18'), null); // before FIRST_DAY
  assert.equal(requestedDay('?day=17-10-2026', '2026-10-18'), null);
  assert.equal(requestedDay('', '2026-10-18'), null);
  assert.equal(searchWithDay('?x=1&day=2026-10-17', null), '?x=1');
  assert.equal(searchWithDay('', '2026-10-17'), '?day=2026-10-17');
  assert.deepEqual(pastDays(3, '2026-11-01'), ['2026-10-31', '2026-10-30', '2026-10-29']);
});

test("day saves: an earlier day never shows or overwrites today's round", () => {
  const now = '2026-10-19';
  const todays = { daily: true, date: now };
  const friday = { daily: true, date: '2026-10-17' };
  const random = { daily: false, date: '2026-10-18' };
  // What shows: each address sees only its own day's daily.
  assert.equal(savedFor(null, todays, friday, now), todays);
  assert.equal(savedFor('2026-10-17', todays, friday, now), friday);
  assert.equal(savedFor('2026-10-16', todays, friday, now), null); // another earlier day: setup
  assert.equal(savedFor(null, friday, null, now), null); // a daily left unfinished overnight: setup
  assert.equal(savedFor(null, random, null, now), random); // a random round resumes any day
  // Where writes go: a new earlier-day round to the past slot, today's and random ones to today's.
  assert.equal(saveSlotFor(friday, null, now), 'past');
  assert.equal(saveSlotFor(todays, '2026-10-17', now), 'today');
  assert.equal(saveSlotFor(random, '2026-10-17', now), 'today'); // Random started from an earlier day
  assert.equal(saveSlotFor(null, '2026-10-17', now), 'past'); // reset clears the board on screen
  assert.equal(saveSlotFor(null, null, now), 'today');
});

test("totals: only the first finish of a day's round counts", () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(firstFinish('timeline', '2026-10-19', '2026-10-19'), true);
  assert.equal(firstFinish('timeline', '2026-10-19', '2026-10-19'), false); // today's again
  assert.equal(firstFinish('timeline', '2026-10-17', '2026-10-19'), true); // an earlier day, once
  assert.equal(firstFinish('timeline', '2026-10-17', '2026-10-19'), false);
  assert.equal(firstFinish('who-am-i', '2026-10-19', '2026-10-19'), true); // each game separately
  assert.equal(firstFinish('timeline', '2026-09-01', '2026-10-19'), false); // past the fortnight kept
  // Old entries are pruned as new ones are added.
  firstFinish('daily', '2026-11-10', '2026-11-10');
  assert.deepEqual(Object.keys(getStored('daily_counted', {})), ['daily:2026-11-10']);
});

test('daily done: a round from yesterday does not tick today', () => {
  markDailyDone('timeline', '2026-10-20');
  assert.ok(!dailyDoneToday('2026-10-21').has('timeline'));
});

test('share text: game and day, score, squares, link without https', () => {
  assert.equal(
    shareText({ game: 'Daily five', day: '18 Oct', score: '4 / 5', squares: [true, true, false, true, true], url: 'https://quiz.peteowen.dev/daily-five' }),
    'Know-It-All · Daily five · 18 Oct\n4 / 5\n🟩🟩🟥🟩🟩\nquiz.peteowen.dev/daily-five'
  );
  assert.equal(shareText({ game: 'Odd one out', score: '3 / 5' }), 'Know-It-All · Odd one out\n3 / 5');
});

console.log(`\n${pass} passed, ${failures.length} failed`);

if (failures.length) {
  failures.forEach((f) => console.error(`  x ${f}`));
  process.exit(1);
}
console.log('Lib tests OK.\n');
