#!/usr/bin/env node
// Tests for Who am I's round building and guess matching, on the real data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWhoRounds, guessIsRight, knownFor, whoPoints, ROUNDS } from '../src/games/whoami/whoLogic.js';
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

const { names } = JSON.parse(readFileSync(new URL('../src/data/famous.json', import.meta.url), 'utf8'));
const bornOf = new Map(names.flatMap((n) => n.people.map((p) => [p.id, p.born])));

test('points run 4, 3, 2, 1', () => assert.deepEqual([1, 2, 3, 4].map(whoPoints), [4, 3, 2, 1]));

test('the first clue drops the years and blanks the name', () => {
  assert.equal(knownFor({ rest: 'Cruise', description: 'American actor and film producer (born 1962)' }, 'Tom'), 'American actor and film producer');
  assert.equal(knownFor({ rest: 'Bronson', description: 'American actor (1921–2003)' }, 'Charles'), 'American actor');
  assert.equal(knownFor({ rest: 'Lincoln', description: 'President of the United States, Lincoln era' }, 'Abraham'), 'President of the United States, … era');
});

test('a full game, the same for the same seed, from different first names', () => {
  const a = buildWhoRounds(names, { seed: 'x' });
  assert.equal(a.length, ROUNDS);
  assert.deepEqual(buildWhoRounds(names, { seed: 'x' }), a);
  assert.equal(new Set(a.map((r) => r.first)).size, ROUNDS);
});

test('across 300 seeds: four distinct options, the answer among them, no birth year or name in the first clue', () => {
  const problems = [];
  for (let s = 0; s < 300; s++) {
    for (const r of buildWhoRounds(names, { seed: `s${s}` })) {
      if (new Set(r.options).size !== 4 || r.options[r.answerIndex] !== r.name) problems.push(`${r.name}: options`);
      const decoysBornSameYear = r.optionIds.filter((id) => id !== r.id && bornOf.get(id) === r.born);
      if (decoysBornSameYear.length) problems.push(`${r.name}: ${decoysBornSameYear.join(', ')} born the same year`);
      // Years in office are fair clues ("President of Peru from 2016 to 2018");
      // the birth year is the second clue, so it must not appear in the first.
      if (r.knownFor.includes(String(r.born))) problems.push(`${r.name}: birth year in "${r.knownFor}"`);
      const surname = normalise(r.name.slice(r.first.length)).split(' ').filter((w) => w.length > 2);
      if (surname.some((w) => normalise(r.knownFor).split(' ').includes(w))) problems.push(`${r.name}: name in "${r.knownFor}"`);
    }
  }
  assert.deepEqual(problems.slice(0, 5), []);
});

test('typed guesses: surname, full name, a small typo; not someone else', () => {
  const r = { id: 'Q37079', name: 'Tom Cruise', first: 'Tom' };
  assert.ok(guessIsRight('Cruise', r));
  assert.ok(guessIsRight('tom cruise', r));
  assert.ok(guessIsRight('Cruse', r), 'one typo allowed from five letters');
  assert.ok(!guessIsRight('Crus', r), 'no typo allowance under five letters');
  assert.ok(!guessIsRight('Hanks', r));
  assert.ok(guessIsRight('Schwarzeneger', { id: 'x', name: 'Arnold Schwarzenegger', first: 'Arnold' }));
  const ali = { id: 'y', name: 'Muhammad Ali', first: 'Muhammad', spellings: ['Muhammad', 'Mohamed', 'Mohammed'] };
  assert.ok(guessIsRight('Mohamed Ali', ali), 'the other spelling of a merged first name');
});

test('no first clue is mostly blanks', () => {
  const bad = [];
  for (let s = 0; s < 300; s++) {
    for (const r of buildWhoRounds(names, { seed: `b${s}` })) {
      if ((r.knownFor.match(/…/g) || []).length > 1 || r.knownFor.replace(/[^\p{L}]/gu, '').length < 12) bad.push(`${r.name}: ${r.knownFor}`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`who-am-i: ${pass} passed`);
