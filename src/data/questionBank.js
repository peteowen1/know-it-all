import { CATEGORIES, CATEGORY_LIST } from './categories';
import ausHistory from './questions/ausHistory.json';
import geography from './questions/geography.json';
import science from './questions/science.json';
import artsLit from './questions/artsLit.json';
import language from './questions/language.json';
import mythology from './questions/mythology.json';
import sports from './questions/sports.json';
import popCulture from './questions/popCulture.json';

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
  popCulture
];

export const ALL_QUESTIONS = FILES.flat();

export const QUESTIONS_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export const QUESTIONS_BY_CATEGORY = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.id, ALL_QUESTIONS.filter((q) => q.category === c.id)])
);

export const BANK_STATS = {
  total: ALL_QUESTIONS.length,
  byCategory: Object.fromEntries(
    CATEGORY_LIST.map((c) => [c.id, QUESTIONS_BY_CATEGORY[c.id].length])
  ),
  byDifficulty: ALL_QUESTIONS.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
    return acc;
  }, {})
};

export function getQuestion(id) {
  return QUESTIONS_BY_ID.get(id);
}

export function categoryOf(question) {
  return (
    CATEGORIES[question?.category] || {
      id: 'unknown',
      name: 'General Knowledge',
      short: 'General',
      icon: '❓',
      color: '#6b7280'
    }
  );
}

export { CATEGORIES, CATEGORY_LIST };
