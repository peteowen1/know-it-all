#!/usr/bin/env node
// Tests for Odd one out's round building, on the real Obscure-est categories.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOddRounds, hasSecondTrio, ROUNDS } from '../src/games/oddone/oddLogic.js';
import { normalise } from '../src/games/names/nameMatch.js';

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

const { categories } = JSON.parse(readFileSync(new URL('../src/data/obscure.json', import.meta.url), 'utf8'));
const byId = new Map(categories.map((c) => [c.id, c]));
const has = (cat, text) => cat.answers.some((a) => [a.text, ...(a.accept || [])].some((x) => normalise(x) === normalise(text)));

test('a full set of rounds, the same for the same seed', () => {
  const a = buildOddRounds(categories, { seed: 'x' });
  assert.equal(a.length, ROUNDS);
  assert.deepEqual(buildOddRounds(categories, { seed: 'x' }), a);
});

test('across 200 seeds: exactly one answer is outside the link, and no second trio', () => {
  const problems = [];
  for (let s = 0; s < 200; s++) {
    for (const r of buildOddRounds(categories, { seed: `s${s}` })) {
      const cat = byId.get(r.id);
      const outside = r.options.filter((o) => !has(cat, o));
      if (outside.length !== 1 || outside[0] !== r.odd) problems.push(`${r.id}: ${r.options.join(', ')}`);
      if (r.options[r.oddIndex] !== r.odd) problems.push(`${r.id}: oddIndex wrong`);
      if (new Set(r.options.map(normalise)).size !== 4) problems.push(`${r.id}: repeated option`);
      if (hasSecondTrio(categories, cat, r.options, r.odd)) problems.push(`${r.id}: second trio with ${r.odd}`);
    }
  }
  assert.deepEqual(problems.slice(0, 5), []);
});

test('rounds vary in kind and never use the famous-names categories', () => {
  const r = buildOddRounds(categories, { seed: 'kinds' });
  assert.ok(new Set(r.map((x) => byId.get(x.id).kind)).size >= 3);
  for (let s = 0; s < 50; s++) for (const x of buildOddRounds(categories, { seed: `n${s}` })) assert.ok(!x.id.startsWith('name-'), x.id);
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`odd-one-out: ${pass} passed`);
