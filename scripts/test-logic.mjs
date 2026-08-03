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

// ------------------------------------------------------------------ report
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  x ${f}`));
  process.exit(1);
}
console.log('Logic tests OK.\n');
