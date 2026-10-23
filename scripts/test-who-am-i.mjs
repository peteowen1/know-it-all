#!/usr/bin/env node
// Tests for Who am I's round building and guess matching, on the real data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWhoRounds, guessIsRight, knownFor, whoPoints, ROUNDS } from '../src/games/whoami/whoLogic.js';
import { normalise } from '../src/games/names/nameMatch.js';
import { worksClue } from './lib/famousWorks.mjs';

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

test('across 300 seeds: every answer has a works clue, without their name in it', () => {
  const problems = [];
  for (let s = 0; s < 300; s++) {
    for (const r of buildWhoRounds(names, { seed: `k${s}` })) {
      if (!/^(Starred in|Recorded|Played for|Directed|Wrote|Created|Known for) /.test(r.known || '')) problems.push(`${r.name}: "${r.known}"`);
      // A name word, or a longer one with an ending: "Browns" for Jim Brown.
      const nameWords = normalise(r.name).split(' ').filter((w) => w.length > 2 && !['and', 'the', 'von', 'van', 'des'].includes(w));
      const clueWords = normalise(r.known || '').split(' ');
      if (clueWords.some((c) => nameWords.some((n) => c === n || (n.length >= 4 && c.startsWith(n))))) problems.push(`${r.name}: name in "${r.known}"`);
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

test('the works clue puts works the Wikipedia opening names first (Laura Prepon)', () => {
  const person = { id: 'Q1', name: 'Laura Prepon', description: 'American actress' };
  const rows = new Map([['Q1', [
    { prop: 'P161', work: 'Qhouse', links: 90 },
    { prop: 'P161', work: 'Qhimym', links: 80 },
    { prop: 'P161', work: 'Q70s', links: 40 },
    { prop: 'P161', work: 'Qoitnb', links: 30 },
    { prop: 'P161', work: 'Qseason', links: 20 }
  ]]]);
  const labels = new Map([['Qhouse', { label: 'House M.D.', description: '' }], ['Qhimym', { label: 'How I Met Your Mother', description: '' }], ['Q70s', { label: "That '70s Show", description: '' }]]);
  // Orange Is the New Black has no fetched label: its article title stands in.
  const titles = new Map([['Qoitnb', 'Orange Is the New Black (TV series)'], ['Qseason', 'Dancing with the Stars season 12']]);
  assert.equal(worksClue(person, { rows, labels }), 'Starred in House M.D. and How I Met Your Mother');
  const lead = new Map([['Q1', new Set(['Q70s', 'Qoitnb', 'Qseason'])]]);
  assert.equal(worksClue(person, { rows, labels, lead, titles }), "Starred in That '70s Show and Orange Is the New Black");
});

test('club names read plainly, women\'s sides kept as such', () => {
  const person = { id: 'Q2', name: 'Ellen White', description: 'English footballer' };
  const rows = new Map([['Q2', [{ prop: 'P54', work: 'Qa', links: 9 }, { prop: 'P54', work: 'Qc', links: 8 }]]]);
  const labels = new Map([['Qa', { label: 'Arsenal W.F.C.', description: '' }], ['Qc', { label: 'Chelsea F.C. Women', description: '' }]]);
  assert.equal(worksClue(person, { rows, labels }), 'Played for Arsenal Women and Chelsea Women');
});

test('no works clue the Wikipedia opening backs none of, no national tennis side, no slur', () => {
  const person = { id: 'Q3', name: 'Karen Carpenter', description: 'American singer' };
  const rows = new Map([['Q3', [{ prop: 'P175', work: 'Qs', links: 9 }]]]);
  const labels = new Map([['Qs', { label: 'Looking for Love', description: '' }]]);
  assert.equal(worksClue(person, { rows, labels }), 'Recorded Looking for Love');
  assert.equal(worksClue(person, { rows, labels, lead: new Map([['Q3', new Set()]]) }), null);
  const tennis = { id: 'Q4', name: 'Ivan Lendl', description: 'tennis player' };
  const tRows = new Map([['Q4', [{ prop: 'P800', work: 'Qd', links: 9 }]]]);
  assert.equal(worksClue(tennis, { rows: tRows, labels: new Map([['Qd', { label: 'Czechoslovakia Davis Cup team', description: '' }]]) }), null);
  const writer = { id: 'Q5', name: 'Dick Gregory', description: 'American writer' };
  const wRows = new Map([['Q5', [{ prop: 'P50', work: 'Qb', links: 9 }]]]);
  assert.equal(worksClue(writer, { rows: wRows, labels: new Map([['Qb', { label: 'Nigger', description: '' }]]) }), null);
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`who-am-i: ${pass} passed`);
