import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from '../data/questionBank.js';
import { CATEGORY_LIST } from '../data/categories.js';
import { hashString, makeRng, shuffle } from './rng.js';
import { localDateKey } from './dates.js';

// A "quiz" is a list of question ids plus a seed. Options are materialised from
// (question id, seed) so a question's A/B/C/D order is stable for the length of
// the quiz but different next time you meet it.

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };

/**
 * Turn a stored question into what the UI renders: four options in a shuffled
 * order, plus the index of the correct one.
 */
export function materialise(question, seed = 0) {
  const rng = makeRng(hashString(`${question.id}:${seed}`));
  const options = shuffle([question.answer, ...question.distractors], rng);
  return {
    ...question,
    options,
    correctIndex: options.indexOf(question.answer)
  };
}

/**
 * Good Weekend quizzes ramp: gentle at the start, brutal at the end. Sorting the
 * selection by difficulty reproduces that feel instead of scattering hard ones
 * randomly through the set.
 */
function rampByDifficulty(questions) {
  return [...questions].sort(
    (a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 1) - (DIFFICULTY_RANK[b.difficulty] ?? 1)
  );
}

/**
 * Build a quiz.
 *
 * Two hard constraints, both enforced unconditionally in tryAdd and therefore
 * impossible for the algorithm to violate:
 *  - a question id appears at most once in a round;
 *  - no two questions in a round share a normalised stem.
 *
 * Plus one soft preference: ids in `recentIds` are skipped so you don't see the
 * same 25 every Saturday, but this yields once the unseen pool runs dry rather
 * than returning a short round.
 */
export function buildQuiz({
  count = 25,
  categories = 'all',
  difficulty = 'all',
  recentIds = [],
  seed = Date.now()
} = {}) {
  const rng = makeRng(hashString(String(seed)));
  const catIds =
    categories === 'all' || !categories?.length
      ? CATEGORY_LIST.map((c) => c.id)
      : [].concat(categories);

  const matchesDifficulty = (q) => difficulty === 'all' || q.difficulty === difficulty;

  const recent = new Set(recentIds);
  const chosen = [];
  const usedIds = new Set();
  const usedStems = new Set();

  const normStem = (q) => q.question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const tryAdd = (q) => {
    if (usedIds.has(q.id)) return false;
    const stem = normStem(q);
    if (usedStems.has(stem)) return false;
    usedIds.add(q.id);
    usedStems.add(stem);
    chosen.push(q);
    return true;
  };

  // Pass 1: even spread across the selected categories, preferring unseen.
  const perCategory = Math.floor(count / catIds.length);
  if (perCategory > 0) {
    for (const catId of shuffle(catIds, rng)) {
      const pool = (QUESTIONS_BY_CATEGORY[catId] || []).filter(matchesDifficulty);
      const unseen = shuffle(pool.filter((q) => !recent.has(q.id)), rng);
      const seen = shuffle(pool.filter((q) => recent.has(q.id)), rng);
      let added = 0;
      for (const q of [...unseen, ...seen]) {
        if (added >= perCategory) break;
        if (tryAdd(q)) added++;
      }
    }
  }

  // Pass 2: top up the remainder (count doesn't divide evenly, or a thin
  // category ran dry) from anywhere in scope.
  if (chosen.length < count) {
    const pool = ALL_QUESTIONS.filter(
      (q) => catIds.includes(q.category) && matchesDifficulty(q) && !usedIds.has(q.id)
    );
    const unseen = shuffle(pool.filter((q) => !recent.has(q.id)), rng);
    const seen = shuffle(pool.filter((q) => recent.has(q.id)), rng);
    for (const q of [...unseen, ...seen]) {
      if (chosen.length >= count) break;
      tryAdd(q);
    }
  }

  return {
    seed,
    questions: rampByDifficulty(chosen.slice(0, count)).map((q) => materialise(q, seed))
  };
}

/**
 * The daily quiz is stable across reloads because it is seeded off the date
 * rather than the clock. The date must be LOCAL: seeded off UTC it would roll
 * over mid-morning in Australia, so opening it at breakfast would still serve
 * yesterday's five questions.
 */
export function buildDailyQuiz(count = 5, dateKey = localDateKey()) {
  return buildQuiz({ count, seed: hashString(`daily:${dateKey}`) });
}

/** Re-drill the questions you got wrong. Fresh option order each attempt. */
export function buildRevisionQuiz(questionIds, seed = Date.now()) {
  const rng = makeRng(hashString(String(seed)));
  const questions = shuffle(
    questionIds.map((id) => ALL_QUESTIONS.find((q) => q.id === id)).filter(Boolean),
    rng
  );
  return { seed, questions: questions.map((q) => materialise(q, seed)) };
}

/**
 * Reproduce someone else's round exactly.
 *
 * Question order and option order both come from the shared seed, so two people
 * comparing scores answered the identical paper — otherwise the comparison is
 * meaningless. Unknown ids are dropped rather than failing the whole challenge,
 * so a link still works after a question has been removed from the bank.
 */
export function buildChallengeQuiz(ids, seed) {
  const questions = ids.map((id) => ALL_QUESTIONS.find((q) => q.id === id)).filter(Boolean);
  return {
    seed,
    questions: questions.map((q) => materialise(q, seed)),
    missing: ids.length - questions.length
  };
}
