#!/usr/bin/env node
// Tests for Clue ladder's pure logic (masking, fair-ladder filter, picking, guess matching).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { maskText, buildRung, pickRounds, guessIsRight, ladderPoints, eligibleQuestions, MASK } from '../src/games/clueladder/ladderLogic.js';

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

const dir = new URL('../src/data/questions/', import.meta.url);
const ALL = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('points run 4,3,2,1', () => assert.deepEqual([1, 2, 3, 4].map(ladderPoints), [4, 3, 2, 1]));

test('masks case, plurals and possessives', () => {
  assert.equal(
    maskText("Newton set out gravity. Newton's laws; two Newtons. NEWTON!", 'Newton'),
    `${MASK} set out gravity. ${MASK} laws; two ${MASK}. ${MASK}!`
  );
});
test('masks every word of a multi-word answer but not "the"', () => {
  assert.equal(
    maskText('The Great Barrier Reef is huge, said the reefs guide.', 'The Great Barrier Reef'),
    `The ${MASK} ${MASK} ${MASK} is huge, said the ${MASK} guide.`
  );
});
test('masks accented forms', () => assert.equal(maskText('Beyoncé sang', 'Beyonce'), `${MASK} sang`));
test('leaves unrelated words alone', () => assert.equal(maskText('Cat sat on a mat', 'Dog'), 'Cat sat on a mat'));

test('skips numeric and year answers', () => {
  const base = { explanation: 'word '.repeat(20), hook: 'hook here', distractors: ['a', 'b', 'c'] };
  assert.equal(buildRung({ ...base, answer: '1066' }), null);
  assert.equal(buildRung({ ...base, answer: '206' }), null);
  assert.notEqual(buildRung({ ...base, answer: 'Paris' }), null);
});
test('rejects an explanation that is too short once masked', () => {
  const q = { answer: 'Paris', hook: 'h', distractors: ['a', 'b', 'c'], explanation: 'Paris is the capital of France and Paris is big.' };
  assert.equal(buildRung(q), null);
});

test('typed guesses: case, punctuation, "The", typos', () => {
  assert.ok(guessIsRight('  THE nile!! ', 'Nile'));
  assert.ok(guessIsRight('nile', 'The Nile'));
  assert.ok(guessIsRight('Mississipi', 'Mississippi'));
  assert.ok(guessIsRight('Mount Everest', 'Mount Everest (Sagarmatha)'));
  assert.ok(!guessIsRight('Amazon', 'Nile'));
  assert.ok(!guessIsRight('', 'Nile'));
  assert.ok(!guessIsRight('Cat', 'Car'));
});

test('real bank: enough fair questions across categories, none leaking the answer', () => {
  const ok = eligibleQuestions(ALL);
  console.log(`  eligible: ${ok.length} of ${ALL.length}; categories: ${new Set(ok.map((q) => q.category)).size}`);
  assert.ok(ok.length >= 50, `only ${ok.length} eligible of ${ALL.length}`);
  assert.ok(new Set(ok.map((q) => q.category)).size >= 5);
  for (const q of ok) {
    const { explanation } = buildRung(q);
    // Whole-word check on the normalised text, so "Au" does not trip over "aurum".
    const flat = ` ${explanation.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
    const ans = q.answer.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    assert.ok(!flat.includes(` ${ans} `), q.id);
  }
});
test('pickRounds: 5 distinct, mixed, deterministic, options hold the answer', () => {
  const a = pickRounds(ALL, { seed: 'x' });
  const b = pickRounds(ALL, { seed: 'x' });
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
  assert.equal(new Set(a.map((r) => r.id)).size, 5);
  const byId = new Map(ALL.map((q) => [q.id, q]));
  assert.ok(new Set(a.map((r) => byId.get(r.id).category)).size >= 4);
  for (const r of a) {
    assert.equal(r.options.length, 4);
    assert.ok(r.options.includes(byId.get(r.id).answer));
  }
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`clue-ladder: ${pass} passed`);
