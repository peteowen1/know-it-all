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
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  x ${f}`));
  process.exit(1);
}
console.log('Lib tests OK.\n');
