#!/usr/bin/env node
// Tests for Match the curve's round building and reveal text, on the real data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCurveRounds, monthName, peakNote, MIN_GAP, PER_ROUND, ROUNDS } from '../src/games/curves/curveLogic.js';

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

const data = JSON.parse(readFileSync(new URL('../src/data/curves.json', import.meta.url), 'utf8'));
const monthIndex = (ym) => +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1;

test('every curve is full length, scaled to 99 at its peak month', () => {
  assert.ok(data.people.length >= 100, `only ${data.people.length} people`);
  for (const p of data.people) {
    assert.equal(p.s.length, data.months, p.name);
    assert.equal(Math.max(...p.s), 99, p.name);
    assert.equal(p.s[monthIndex(p.peak) - monthIndex(data.from)], 99, `${p.name} peak month`);
  }
});

test('reasons are short and only on the month they explain', () => {
  const reasons = JSON.parse(readFileSync(new URL('./curve-reasons.json', import.meta.url), 'utf8'));
  const byId = new Map(data.people.map((p) => [p.id, p]));
  for (const r of reasons) {
    assert.ok(r.why.split(' ').length <= 8, `${r.name}: ${r.why}`);
    const p = byId.get(r.id);
    if (p) assert.equal(p.why, p.peak === r.peak ? r.why : undefined, r.name);
  }
  assert.ok(data.people.filter((p) => p.why).length >= 200);
});

test('a full game, the same for the same seed', () => {
  const a = buildCurveRounds(data.people, { seed: 'x' });
  assert.equal(a.length, ROUNDS);
  assert.deepEqual(buildCurveRounds(data.people, { seed: 'x' }), a);
  assert.notDeepEqual(buildCurveRounds(data.people, { seed: 'y' }), a);
});

test('across 300 seeds: five rounds, nobody twice, peaks far apart, curves a shuffle of the names', () => {
  for (let s = 0; s < 300; s++) {
    const rounds = buildCurveRounds(data.people, { seed: `d${s}` });
    assert.equal(rounds.length, ROUNDS, `seed d${s}`);
    const ids = rounds.flatMap((r) => r.people.map((p) => p.id));
    assert.equal(new Set(ids).size, ROUNDS * PER_ROUND, `seed d${s} repeats a person`);
    for (const r of rounds) {
      assert.deepEqual([...r.order].sort(), [0, 1, 2, 3], `seed d${s} order`);
      const peaks = r.people.map((p) => monthIndex(p.peak));
      for (let i = 0; i < peaks.length; i++)
        for (let j = i + 1; j < peaks.length; j++) assert.ok(Math.abs(peaks[i] - peaks[j]) >= MIN_GAP, `seed d${s}: ${r.people[i].name} and ${r.people[j].name}`);
    }
  }
});

test('the reveal names the peak month, and a death only in the peak year', () => {
  assert.equal(monthName('2022-09'), 'September 2022');
  assert.equal(peakNote({ peak: '2022-09', died: 2022 }), 'Peak September 2022 (died 2022)');
  assert.equal(peakNote({ peak: '2022-09', died: 2019 }), 'Peak September 2022');
  assert.equal(peakNote({ peak: '2022-09' }), 'Peak September 2022');
  assert.equal(peakNote({ peak: '2022-09', died: 2022, why: 'Died aged 96' }), 'Peak September 2022: Died aged 96');
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`curves: ${pass} passed`);
