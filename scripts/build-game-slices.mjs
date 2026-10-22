#!/usr/bin/env node
// Writes the small data files two Lab games load instead of the big shared
// ones. At Lighthouse's mobile setting (1.6 Mbps, CPU 4x slower) Clue ladder
// took 8.4 s to its first screen, loading all 4,753 questions (835 KB gzipped)
// to use the 1,328 that make a ladder, and Who am I 7.3 s, loading 17,445
// people to use each first name's top 15 (2026-10-22).
//
//   src/data/clueLadder.json  the questions that make a fair ladder, in bank
//                             order, and every answer and distractor in the
//                             bank (the typo check needs them all)
//   src/data/whoAmI.json      each first name's top 15, the fields Who am I reads
//
// Run by `npm run validate` and `npm run build`, so neither can go stale;
// scripts/test-lib.mjs checks both against their sources.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eligibleQuestions, knownAnswers } from '../src/games/clueladder/ladderLogic.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'data');
const read = (rel) => readFileSync(join(DATA, rel), 'utf8');

/**
 * Every question, in the order src/data/questionBank.js joins the files.
 * Order matters: pickRounds deals categories in the order it meets them, so
 * a different order would change every day's ladder. The order is read from
 * questionBank.js itself (node cannot import it: it imports JSON bare).
 */
export function bankQuestions() {
  const src = read('questionBank.js');
  const paths = new Map([...src.matchAll(/^import (\w+) from '\.\/(questions\/\w+\.json)';\r?$/gm)].map((m) => [m[1], m[2]]));
  const files = src.match(/const FILES = \[([^\]]*)\]/)[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (!files.length || files.some((f) => !paths.has(f))) throw new Error('could not read the FILES order from questionBank.js');
  return files.flatMap((f) => JSON.parse(read(paths.get(f))));
}

// The fields ClueLadder.jsx and ladderLogic.js read.
const LADDER_FIELDS = ['id', 'category', 'question', 'answer', 'distractors', 'explanation', 'hook'];

export function computeClueLadder() {
  const all = bankQuestions();
  return {
    questions: eligibleQuestions(all).map((q) => Object.fromEntries(LADDER_FIELDS.map((k) => [k, q[k]]))),
    known: [...knownAnswers(all)]
  };
}

// Who am I uses each board's top 15 (whoLogic.js TOP) and these fields.
const WHO_TOP = 15;
const WHO_FIELDS = ['id', 'name', 'rest', 'first', 'description', 'born', 'known'];

export function computeWhoAmI() {
  const { names } = JSON.parse(read('famous.json'));
  return {
    names: names.map((b) => ({
      first: b.first,
      ...(b.spellings ? { spellings: b.spellings } : {}),
      people: b.people.slice(0, WHO_TOP).map((p) => Object.fromEntries(WHO_FIELDS.filter((k) => k in p).map((k) => [k, p[k]])))
    }))
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [file, data] of [['clueLadder.json', computeClueLadder()], ['whoAmI.json', computeWhoAmI()]]) {
    const text = JSON.stringify(data);
    writeFileSync(join(DATA, file), text);
    console.log(`${file}: ${text.length.toLocaleString('en-US')} bytes`);
  }
}
