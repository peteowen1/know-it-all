#!/usr/bin/env node
// Question-bank validator. Run with `npm run validate`.
//
// This exists because the bank it replaced shipped with the correct answer at
// option A for every single question, machine-generated template text in place
// of most explanations, and one recycled set of wrong answers reused across
// dozens of questions. Each of those is now a hard failure here.
//
// The data that had those faults was deleted in the same commit that added this
// file, so the specific counts are not checkable from the working tree — see
// commit 6dc4630 if you need the numbers.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const QDIR = join(HERE, '..', 'src', 'data', 'questions');

const VALID_CATEGORIES = [
  'aus_history', 'geography', 'science', 'arts_lit',
  'language', 'mythology', 'sports', 'pop_culture'
];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// Phrases that only ever appear in machine-generated filler.
const TEMPLATE_PHRASES = [
  'is the primary answer associated with',
  'is the official capital city and seat of government',
  'Trivia Focus:',
  'Remember **',
  'is the correct answer',
  'This is a well-known fact',
  'associated with this question',
  'is recognized as:',
  'is the answer to this question'
];

const MIN_EXPLANATION_WORDS = 12;
const MIN_HOOK_WORDS = 4;
const TARGET_TOTAL = 1000;

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const normStem = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------------------------------------------------------------- load
const files = readdirSync(QDIR).filter((f) => f.endsWith('.json')).sort();
const all = [];
for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(QDIR, file), 'utf8'));
  } catch (e) {
    fail(file, `not valid JSON — ${e.message}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    fail(file, 'top level must be an array');
    continue;
  }
  parsed.forEach((q, i) => all.push({ ...q, __file: file, __index: i }));
}

// ---------------------------------------------------------------- per question
const seenIds = new Map();
const seenStems = new Map();
const distractorSets = new Map();

for (const q of all) {
  const id = q.id || `${q.__file}[${q.__index}]`;

  for (const field of ['id', 'category', 'difficulty', 'question', 'answer', 'explanation', 'hook']) {
    if (typeof q[field] !== 'string' || !q[field].trim()) fail(id, `missing or empty "${field}"`);
  }
  if (!VALID_CATEGORIES.includes(q.category)) fail(id, `unknown category "${q.category}"`);
  if (!VALID_DIFFICULTIES.includes(q.difficulty)) fail(id, `unknown difficulty "${q.difficulty}"`);

  // Distractors
  if (!Array.isArray(q.distractors) || q.distractors.length !== 3) {
    fail(id, `needs exactly 3 distractors, got ${q.distractors?.length ?? 'none'}`);
  } else {
    const opts = [q.answer, ...q.distractors].map((o) => String(o).trim().toLowerCase());
    if (new Set(opts).size !== 4) fail(id, 'answer and distractors are not all distinct');
    if (q.distractors.some((d) => typeof d !== 'string' || !d.trim())) {
      fail(id, 'a distractor is empty or not a string');
    }
    // A distractor much longer than the others gives the answer away, and so
    // does an answer that is the longest option — a classic tell.
    const lens = [q.answer, ...q.distractors].map((o) => String(o).length);
    if (lens[0] > Math.max(...lens.slice(1)) * 2.2 && lens[0] > 24) {
      warn(id, 'correct answer is much longer than every distractor (giveaway)');
    }
    const key = [...q.distractors].map((d) => d.toLowerCase()).sort().join('|');
    distractorSets.set(key, [...(distractorSets.get(key) || []), id]);
  }

  // Question shape
  if (q.question && !q.question.trim().endsWith('?')) fail(id, 'question does not end in "?"');
  if (q.question && /^What is:|'\?\?|\?\?/.test(q.question)) fail(id, 'malformed template-shaped stem');
  if (q.question && words(q.question) < 5) fail(id, 'question stem is suspiciously short');

  // Explanation + hook must be real writing, and must not merely restate.
  for (const [field, min] of [['explanation', MIN_EXPLANATION_WORDS], ['hook', MIN_HOOK_WORDS]]) {
    const v = q[field];
    // Deliberately a failure rather than a `continue`. The required-field loop
    // above already rejects a non-string here, so this is unreachable today —
    // but skipping instead of failing would make the template-phrase and length
    // checks silently depend on that other loop never being edited. This script
    // is the only thing standing between a bad edit and shipping filler text,
    // so it must not rely on a second piece of code staying in sync.
    if (typeof v !== 'string') {
      fail(id, `${field} is not a string, so it could not be checked`);
      continue;
    }
    for (const phrase of TEMPLATE_PHRASES) {
      if (v.includes(phrase)) fail(id, `${field} contains template phrase "${phrase}"`);
    }
    if (words(v) < min) fail(id, `${field} is too short (${words(v)} words, need ${min}+)`);
    if (q.question && normStem(v).includes(normStem(q.question).slice(0, 40))) {
      fail(id, `${field} just restates the question`);
    }
  }
  // An explanation that is only the answer echoed back teaches nothing.
  if (q.explanation && q.answer && normStem(q.explanation) === normStem(q.answer)) {
    fail(id, 'explanation is just the answer');
  }

  // Uniqueness
  if (q.id) {
    if (seenIds.has(q.id)) fail(q.id, `duplicate id (also in ${seenIds.get(q.id)})`);
    else seenIds.set(q.id, q.__file);
  }
  if (q.question) {
    const stem = normStem(q.question);
    if (seenStems.has(stem)) fail(id, `duplicate question stem (also ${seenStems.get(stem)})`);
    else seenStems.set(stem, id);
  }
}

// ---------------------------------------------------------------- bank-wide
// Two questions legitimately sharing three plausible wrong answers is fine and
// happens naturally — "Adelaide / Perth / Sydney" suits any number of distinct
// city questions. Piling many questions onto one set is not fine: that is how
// the previous bank ended up with the same three wrong answers under dozens of
// questions, making the right one guessable without knowing anything.
//
// So this checks two different things. Per-set depth catches one set being
// leaned on. The bank-wide share catches the subtler regression a per-set
// threshold would miss entirely: a generator recycling sets two at a time
// across many different combinations never trips any single set's limit, but
// drives the overall proportion of duplicated sets up.
let questionsInSharedSets = 0;
for (const [key, ids] of distractorSets) {
  if (ids.length >= 2) questionsInSharedSets += ids.length;
  if (ids.length > 3) {
    fail(ids[0], `distractor set reused by ${ids.length} questions [${key}] — recycled wrong answers`);
  } else if (ids.length === 3) {
    warn(ids[0], `distractor set reused 3x [${key}]`);
  }
}

const MAX_SHARED_SHARE = 0.08;
const sharedShare = all.length ? questionsInSharedSets / all.length : 0;
if (sharedShare > MAX_SHARED_SHARE) {
  fail(
    'bank',
    `${questionsInSharedSets} of ${all.length} questions (${(sharedShare * 100).toFixed(1)}%) ` +
      `share a distractor set with another question, above the ${MAX_SHARED_SHARE * 100}% ceiling ` +
      '— wrong answers are being recycled'
  );
}

// Same correct answer appearing over and over is a content smell.
const answerCounts = new Map();
for (const q of all) {
  if (!q.answer) continue;
  const k = q.answer.toLowerCase();
  answerCounts.set(k, (answerCounts.get(k) || 0) + 1);
}
for (const [ans, n] of answerCounts) {
  if (n > 4) warn('bank', `answer "${ans}" is correct for ${n} questions`);
}

// Coverage
const byCat = {};
const byDiff = {};
for (const q of all) {
  byCat[q.category] = (byCat[q.category] || 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
}
if (all.length < TARGET_TOTAL) fail('bank', `only ${all.length} questions, need ${TARGET_TOTAL}+`);
for (const c of VALID_CATEGORIES) {
  if ((byCat[c] || 0) < 100) fail('bank', `category "${c}" has only ${byCat[c] || 0} questions (need 100+)`);
}
for (const d of VALID_DIFFICULTIES) {
  const share = (byDiff[d] || 0) / (all.length || 1);
  if (share < 0.15) fail('bank', `difficulty "${d}" is only ${(share * 100).toFixed(1)}% of the bank (need 15%+)`);
}

// ---------------------------------------------------------------- report
console.log(`\nQuestion bank: ${all.length} questions across ${files.length} files`);
console.log('  by category:  ' + VALID_CATEGORIES.map((c) => `${c}=${byCat[c] || 0}`).join('  '));
console.log('  by difficulty: ' + VALID_DIFFICULTIES.map((d) => `${d}=${byDiff[d] || 0}`).join('  '));
console.log(
  `  distractor reuse: ${questionsInSharedSets} questions share a set with another ` +
    `(${(sharedShare * 100).toFixed(1)}%, ceiling ${MAX_SHARED_SHARE * 100}%)`
);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.slice(0, 40).forEach((w) => console.log('  ! ' + w));
  if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
}

if (errors.length) {
  console.error(`\nFAILED — ${errors.length} error(s):`);
  errors.slice(0, 60).forEach((e) => console.error('  x ' + e));
  if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
  process.exit(1);
}

console.log('\nOK — bank is valid.\n');
