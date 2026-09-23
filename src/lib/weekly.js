// Pure selection for the Saturday paper, apart from quizBuilder.js (which loads
// the question bank) so scripts/test-logic.mjs can test it directly.

import { hashString, makeRng, shuffle } from './rng.js';

/**
 * Eight easy warm-ups, ten medium, seven hard: the shape of the real thing.
 */
export const WEEKLY_SHAPE = { easy: 8, medium: 10, hard: 7 };
export const WEEKLY_MAX_PER_CATEGORY = 3;

/**
 * Pick the week's 25 questions, in paper order. No category supplies more than
 * three, so a weak subject costs a few points rather than a third of the
 * paper. Each slot takes the category used least so far, ties broken by a
 * shuffle seeded on the week, so everyone gets the same paper.
 *
 * `byCategory` is { categoryId: question[] }.
 */
export function pickWeekly(byCategory, weekKey) {
  const seed = hashString(`weekly:${weekKey}`);
  const rng = makeRng(seed);
  const ids = Object.keys(byCategory).sort();
  const perCat = {};
  const chosen = [];
  for (const [difficulty, n] of Object.entries(WEEKLY_SHAPE)) {
    const pools = {};
    for (const id of ids) pools[id] = shuffle(byCategory[id].filter((q) => q.difficulty === difficulty), rng);
    const order = shuffle(ids, rng);
    for (let i = 0; i < n; i++) {
      const cat = order
        .filter((id) => pools[id].length && (perCat[id] || 0) < WEEKLY_MAX_PER_CATEGORY)
        .sort((a, b) => (perCat[a] || 0) - (perCat[b] || 0))[0];
      if (!cat) break;
      chosen.push(pools[cat].shift());
      perCat[cat] = (perCat[cat] || 0) + 1;
    }
  }
  return { seed, questions: chosen };
}
