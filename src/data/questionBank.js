import { CATEGORY_LIST } from './categories';
import ausHistory from './questions/ausHistory.json';
import geography from './questions/geography.json';
import science from './questions/science.json';
import artsLit from './questions/artsLit.json';
import language from './questions/language.json';
import mythology from './questions/mythology.json';
import sports from './questions/sports.json';
import popCulture from './questions/popCulture.json';
import foodDrink from './questions/foodDrink.json';
import worldLeaders from './questions/worldLeaders.json';

// Source of truth is the JSON, one file per category. Questions store the
// correct answer as a STRING plus three distractors — never an index. The old
// schema stored `answer: 0` for all 999 questions, so the correct answer was
// always option A. Making the answer a string means position is decided at
// render time and an index-0 bias is not expressible.

const FILES = [
  ausHistory,
  geography,
  science,
  artsLit,
  language,
  mythology,
  sports,
  popCulture,
  foodDrink,
  worldLeaders
];

// The counts shown on the first screen live in bankStats.json (built by
// scripts/build-bank-stats.mjs) so nothing there has to load this file.
export const ALL_QUESTIONS = FILES.flat();

const QUESTIONS_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export const QUESTIONS_BY_CATEGORY = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.id, ALL_QUESTIONS.filter((q) => q.category === c.id)])
);

export function getQuestion(id) {
  return QUESTIONS_BY_ID.get(id);
}
