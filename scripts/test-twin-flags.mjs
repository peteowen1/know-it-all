#!/usr/bin/env node
// Tests for the Twin flags logic (src/games/twinflags/twinLogic.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRounds, eligiblePairs, similarity, pairKey, ROUNDS, THRESHOLD } from '../src/games/twinflags/twinLogic.js';
import { TWIN_TABLE } from '../src/games/twinflags/twinTable.js';

const json = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const lookalikes = json('../src/data/flagLookalikes.json');
const nameOf = Object.fromEntries(json('../src/data/countries.json').countries.map((c) => [c.code, c.name]));

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

const pairs = eligiblePairs(lookalikes, nameOf);

test('table has 60-80 pairs, all with real countries and a sentence', () => {
  assert.ok(TWIN_TABLE.length >= 60 && TWIN_TABLE.length <= 80, `${TWIN_TABLE.length}`);
  for (const [a, b, how] of TWIN_TABLE) {
    assert.ok(nameOf[a] && nameOf[b], `${a}-${b} unknown code`);
    assert.ok(how && how.length > 20, `${a}-${b} no sentence`);
    assert.notEqual(a, b);
  }
});

test('table has no duplicate pairs', () => {
  const keys = TWIN_TABLE.map(([a, b]) => pairKey(a, b));
  assert.equal(new Set(keys).size, keys.length);
});

test('every eligible pair meets the similarity threshold', () => {
  for (const p of pairs) assert.ok(similarity(lookalikes, p.a, p.b) >= THRESHOLD, p.key);
});

test('enough eligible pairs for several varied games', () => {
  assert.ok(pairs.length >= 25, `${pairs.length}`);
});

test('a game has 10 rounds with no repeated pair', () => {
  const rounds = buildRounds(pairs, { seed: 'a' });
  assert.equal(rounds.length, ROUNDS);
  assert.equal(new Set(rounds.map((r) => r.id)).size, ROUNDS);
});

test('each round shows its pair, asks for one of them, and has a sentence', () => {
  for (const r of buildRounds(pairs, { seed: 'b' })) {
    assert.ok(r.ask === r.left || r.ask === r.right);
    assert.notEqual(r.left, r.right);
    assert.equal(pairKey(r.left, r.right), r.id);
    assert.ok(r.how);
  }
});

test('same seed gives the same game, different seed a different one', () => {
  const ids = (s) => buildRounds(pairs, { seed: s }).map((r) => r.id + r.ask + r.left).join();
  assert.equal(ids('x'), ids('x'));
  assert.notEqual(ids('x'), ids('y'));
});

test('the asked-for flag lands on both sides across games', () => {
  let left = 0;
  let total = 0;
  for (let s = 0; s < 40; s++) {
    for (const r of buildRounds(pairs, { seed: `s${s}` })) {
      total++;
      if (r.ask === r.left) left++;
    }
  }
  assert.ok(left / total > 0.4 && left / total < 0.6, `${left}/${total}`);
});

test('no country appears more than twice in a game', () => {
  for (let s = 0; s < 20; s++) {
    const count = {};
    for (const r of buildRounds(pairs, { seed: `c${s}` })) for (const c of [r.left, r.right]) count[c] = (count[c] || 0) + 1;
    assert.ok(Math.max(...Object.values(count)) <= 2, `seed ${s}`);
  }
});

test('no country in two rounds in a row across 200 games', () => {
  for (let s = 0; s < 200; s++) {
    const rounds = buildRounds(pairs, { seed: `row${s}` });
    for (let i = 1; i < rounds.length; i++) {
      const prev = [rounds[i - 1].left, rounds[i - 1].right];
      assert.ok(!prev.includes(rounds[i].left) && !prev.includes(rounds[i].right), `seed ${s} round ${i + 1}`);
    }
  }
});

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${pass + failures.length}\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`ok ${pass} twin-flags tests passed (${pairs.length} eligible pairs)`);
