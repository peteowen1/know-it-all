#!/usr/bin/env node
// Tests for Clue ladder's pure logic (masking, fair-ladder filter, picking, guess matching).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { maskText, buildRung, pickRounds, guessIsRight, knownAnswers, ladderPoints, eligibleQuestions, MASK } from '../src/games/clueladder/ladderLogic.js';

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
  const base = { explanation: 'word '.repeat(20) + 'Paris 1066 206', hook: 'hook here', distractors: ['a', 'b', 'c'] };
  assert.equal(buildRung({ ...base, answer: '1066' }), null);
  assert.equal(buildRung({ ...base, answer: '206' }), null);
  assert.notEqual(buildRung({ ...base, answer: 'Paris' }), null);
});
test('skips a question that points at options not yet shown', () => {
  const base = { explanation: 'word '.repeat(20) + 'Dutch', hook: 'hook here', answer: 'Dutch', distractors: ['a', 'b', 'c'] };
  assert.notEqual(buildRung({ ...base, question: 'Which language is spoken in Amsterdam?' }), null);
  assert.equal(buildRung({ ...base, question: 'Which of these is a Germanic language?' }), null);
  assert.equal(buildRung({ ...base, question: 'Which language is NOT Romance?' }), null);
});
test('rejects an explanation with no blank to fill', () => {
  const q = { answer: 'Newspaper editor', hook: 'h', distractors: ['a', 'b', 'c'], explanation: 'Bloomer edited The Lily, a women2019s paper, and printed pictures of the outfit designed by Elizabeth Smith Miller.' };
  assert.equal(buildRung(q), null);
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

test('no distractor anywhere in the bank is accepted as the answer', () => {
  const known = knownAnswers(ALL);
  const wrong = ALL.filter(buildRung).flatMap((q) => q.distractors.filter((d) => guessIsRight(d, q.answer, q.distractors, known)).map((d) => `${q.id}: ${d}`));
  assert.deepEqual(wrong, []);
});

test('generic words can be left off', () => {
  assert.ok(guessIsRight('gum', 'The gum tree'));
  assert.ok(guessIsRight('Everest', 'Mount Everest'));
  assert.ok(guessIsRight('pacific', 'Pacific Ocean'));
  assert.ok(guessIsRight('coolibah', 'A coolibah tree'));
  assert.ok(!guessIsRight('tree', 'The gum tree'));
  assert.ok(!guessIsRight('wattle', 'The gum tree', ['The wattle', 'The boab', 'The banksia']));
});

test('one-character-apart answers need exact typing', () => {
  assert.equal(guessIsRight('Henry VII', 'Henry VIII'), false);
  assert.equal(guessIsRight('Vitamin D', 'Vitamin C'), false);
  assert.equal(guessIsRight('henry viii', 'Henry VIII'), true);
});

test('every answer is accepted as typed', () => {
  const known = knownAnswers(ALL);
  const rejected = ALL.filter(buildRung).filter((q) => !guessIsRight(q.answer, q.answer, q.distractors, known)).map((q) => q.id);
  assert.deepEqual(rejected, []);
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`clue-ladder: ${pass} passed`);
