#!/usr/bin/env node
// Tests for Scramble's pure logic (src/games/scramble/scrambleLogic.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRng } from '../src/lib/rng.js';
import {
  isPuzzleWord, scrambleText, buildScrambleRounds, isCorrect, pointsFor, answerFor, hintFor, factFor, peopleText, giveaway, ROUNDS
} from '../src/games/scramble/scrambleLogic.js';

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

const countries = JSON.parse(readFileSync(new URL('../src/data/countries.json', import.meta.url), 'utf8')).countries;
const sorted = (s) => [...s.replace(/[^\p{L}]/gu, '').toLowerCase()].sort().join('');
const SEP = /[ '’-]/;

test('word length rules', () => {
  assert.equal(isPuzzleWord('Peru'), true);
  assert.equal(isPuzzleWord('Fiji'), true);
  assert.equal(isPuzzleWord('Oman'), true);
  assert.equal(isPuzzleWord('Rio'), false); // under 4 letters
  assert.equal(isPuzzleWord('Bosnia and Herzegovina'), false); // 20 letters
  assert.equal(isPuzzleWord('Washington D.C.'), false);
  assert.equal(isPuzzleWord('Sri Lanka'), true);
  assert.equal(isPuzzleWord('Abcdefghijklmn'), true); // exactly 14
  assert.equal(isPuzzleWord('Abcdefghijklmno'), false); // 15
});

test('scramble keeps separators and letters, and moves every word', () => {
  for (let seed = 1; seed < 200; seed++) {
    const rand = makeRng(seed);
    for (const text of ['Sri Lanka', 'Guinea-Bissau', "Côte d'Ivoire", 'Peru', 'Chad', 'Mali']) {
      const out = scrambleText(text, rand);
      assert.notEqual(out, text);
      assert.equal(sorted(out), sorted(text));
      [...text].forEach((ch, i) => {
        if (SEP.test(ch)) assert.equal([...out][i], ch);
      });
      const a = text.split(SEP);
      const b = out.split(SEP);
      a.forEach((w, i) => {
        if (new Set(w.toLowerCase()).size > 1) assert.notEqual(b[i], w);
      });
    }
  }
});

test('a word of one repeated letter cannot be scrambled', () => {
  assert.equal(scrambleText('aaaa', makeRng(1)), null);
});

test('rounds: 10 distinct, valid, deterministic by seed', () => {
  for (const mode of ['countries', 'capitals']) {
    const a = buildScrambleRounds(countries, { mode, seed: 'x' });
    const b = buildScrambleRounds(countries, { mode, seed: 'x' });
    const c = buildScrambleRounds(countries, { mode, seed: 'y' });
    assert.equal(a.length, ROUNDS);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.equal(new Set(a.map((r) => r.key)).size, ROUNDS);
    for (const r of a) {
      assert.ok(isPuzzleWord(r.answer), r.answer);
      assert.equal(sorted(r.tiles), sorted(r.answer));
      assert.notEqual(r.tiles, r.answer);
      assert.ok(isCorrect(r.answer, r));
    }
  }
});

test('every region has enough rounds in both modes', () => {
  for (const region of ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania']) {
    for (const mode of ['countries', 'capitals']) {
      const rounds = buildScrambleRounds(countries, { mode, region, seed: 1 });
      assert.equal(rounds.length, ROUNDS, `${region} ${mode}`);
    }
  }
});

test('only sovereign countries are used', () => {
  const sov = new Set(countries.filter((c) => c.sovereign).map((c) => c.code));
  for (const mode of ['countries', 'capitals']) {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const r of buildScrambleRounds(countries, { mode, seed })) assert.ok(sov.has(r.key), r.key);
    }
  }
});

test('answer matching: alternative names, other capitals, small typos', () => {
  const find = (name) => countries.find((c) => c.name === name);
  const us = { accept: ['United States', ...find('United States').altNames] };
  assert.ok(isCorrect('usa', us));
  assert.ok(isCorrect('United States of America', us));
  assert.ok(!isCorrect('Canada', us));
  const za = { accept: find('South Africa').capitals };
  assert.ok(isCorrect('cape town', za));
  assert.ok(isCorrect('Pretorya', za));
  assert.ok(!isCorrect('Durban', za));
  assert.ok(!isCorrect('', za));
});

test('country answers do not accept two-letter codes', () => {
  for (const r of buildScrambleRounds(countries, { mode: 'countries', seed: 3 })) {
    assert.ok(r.accept.every((a) => a.length > 2));
  }
});

test('capitals that equal the country name are skipped', () => {
  const sg = countries.find((c) => c.code === 'SG');
  assert.ok(sg);
  assert.equal(answerFor(sg, 'capitals'), null);
});

test('points and hints', () => {
  assert.equal(pointsFor({ hinted: false, skipped: false }), 2);
  assert.equal(pointsFor({ hinted: true, skipped: false }), 1);
  assert.equal(pointsFor({ hinted: true, skipped: true }), 0);
  assert.equal(hintFor({ name: 'Kenya', region: 'Africa', subregion: 'Eastern Africa' }, 'capitals'), 'A capital in Eastern Africa');
  assert.equal(hintFor({ name: 'Kenya', region: 'Africa', subregion: 'Eastern Africa' }, 'countries'), 'A country in Eastern Africa');
  assert.equal(hintFor({ name: 'Jamaica', region: 'Americas', subregion: 'Caribbean' }, 'countries'), 'A country in the Caribbean');
  // A hint never holds its own answer: Australia, New Zealand and Micronesia fall back to Oceania.
  for (const c of countries) {
    for (const mode of ['countries', 'capitals']) {
      const answer = answerFor(c, mode);
      if (answer) assert.ok(!hintFor(c, mode).toLowerCase().includes(answer.toLowerCase()), `${answer}: ${hintFor(c, mode)}`);
    }
  }
  assert.equal(hintFor(countries.find((c) => c.code === 'AU'), 'countries'), 'A country in Oceania');
});

test('optional "The", St for Saint, and the common English names', () => {
  const r = (accept) => ({ accept, reject: [] });
  assert.ok(isCorrect('The Gambia', r(['Gambia'])));
  assert.ok(isCorrect("St John's", r(["Saint John's"])));
  assert.ok(isCorrect('Austria', r(['Austria'])));
  assert.ok(!isCorrect('Australia', { accept: ['Austria'], reject: ['Australia'] }));
});

test('the fact after a round: Gabon in both modes, word for word', () => {
  const gabon = countries.find((c) => c.code === 'GA');
  assert.equal(factFor(gabon, 'countries', countries), 'Gabon: in Middle Africa, capital Libreville, 2.6 million people, speaks French, borders Cameroon, the Congo and Equatorial Guinea.');
  assert.equal(factFor(gabon, 'capitals', countries), 'Libreville is the capital of Gabon, in Middle Africa, a country of 2.6 million people.');
  const cn = countries.find((c) => c.code === 'CN');
  assert.match(factFor(cn, 'countries', countries), /borders 14 countries/, 'Hong Kong and Macau are not borders');
  assert.doesNotMatch(factFor(countries.find((c) => c.code === 'LK'), 'countries', countries), /borders/, 'no land border with India');
  assert.deepEqual([1.42e9, 123.4e6, 2593130, 403123, 9492].map(peopleText), ['1.4 billion', '123 million', '2.6 million', '403,000', '9,492']);
});

test('every round in every mode and region has a fact naming its answer, with no gaps', () => {
  const bad = [];
  for (const mode of ['countries', 'capitals']) {
    for (const region of ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania']) {
      for (const r of buildScrambleRounds(countries, { mode, region, seed: 'f', count: 300 })) {
        if (!r.fact || /undefined|null|NaN|, [,.]|: \./.test(r.fact) || !r.fact.toLowerCase().includes(r.answer.toLowerCase())) bad.push(`${mode} ${r.answer}: ${r.fact}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

test('the tiles give little away: kept letters and pairs under 8% of letters across 200 games (about 40% before 2026-10-20)', () => {
  assert.equal(giveaway('Lesotho', 'hoetosL'), 1); // "to" kept from "oto"
  assert.equal(giveaway('Cuba', 'abuC'), 0);
  let shown = 0;
  let letters = 0;
  for (let s = 0; s < 200; s++) {
    for (const r of buildScrambleRounds(countries, { seed: `g${s}` })) {
      shown += giveaway(r.answer, r.tiles);
      letters += r.answer.replace(/[^\p{L}]/gu, '').length;
    }
  }
  assert.ok(shown / letters < 0.08, `${shown} of ${letters}`);
});

test('words get longer through the game, in every region and mode', () => {
  const len = (r) => r.answer.replace(/[^\p{L}]/gu, '').length;
  for (const mode of ['countries', 'capitals']) {
    for (const region of ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania']) {
      for (const seed of [1, 2, 3]) {
        const r = buildScrambleRounds(countries, { mode, region, seed });
        // Bands, not exact lengths: Asia has too few 10-letter capitals to end on two.
        const band = (x) => (len(x) <= 5 ? 0 : len(x) <= 7 ? 1 : len(x) <= 9 ? 2 : 3);
        assert.ok(r.every((x, i) => i === 0 || band(r[i - 1]) <= band(x)), `${mode} ${region}: ${r.map(len)}`);
        assert.ok(len(r[0]) <= 5 && len(r.at(-1)) >= 9, `${mode} ${region}: ${r.map(len)}`);
      }
    }
  }
});

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`scramble: ${pass} passed`);
