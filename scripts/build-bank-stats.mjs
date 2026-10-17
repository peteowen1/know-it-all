#!/usr/bin/env node
// Writes src/data/bankStats.json: the question and country counts the first
// screen needs, so the app shell never has to load the 900 KB question bank
// just to say "1,500+ questions". Run by `npm run validate` and `npm run build`
// so the file cannot go stale; scripts/test-lib.mjs checks it against the bank.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_LIST } from '../src/data/categories.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QDIR = join(ROOT, 'src', 'data', 'questions');
const OUT = join(ROOT, 'src', 'data', 'bankStats.json');

/** Counts straight from the question JSON and countries.json. */
export function computeBankStats() {
  const questions = readdirSync(QDIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(QDIR, f), 'utf8')));
  const countries = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'countries.json'), 'utf8')).countries;

  const byCategory = Object.fromEntries(CATEGORY_LIST.map((c) => [c.id, 0]));
  const byDifficulty = {};
  for (const q of questions) {
    byCategory[q.category] = (byCategory[q.category] || 0) + 1;
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
  }
  return {
    total: questions.length,
    byCategory,
    byDifficulty,
    // Sovereign states: what the flag and capital games ask about.
    countryCount: countries.filter((c) => c.sovereign).length
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const stats = computeBankStats();
  writeFileSync(OUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(`bankStats.json: ${stats.total} questions, ${stats.countryCount} countries`);
}
