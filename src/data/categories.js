// Category metadata. `id` must match the `category` field in the question JSON;
// the validator enforces that, so adding a category here without questions (or
// vice versa) fails the build rather than silently rendering an empty filter.

export const CATEGORY_LIST = [
  {
    id: 'aus_history',
    name: 'Australian History & Politics',
    short: 'Aus History',
    icon: '🇦🇺',
    color: '#3b82f6',
    blurb: 'Federation, prime ministers, the Dismissal, state emblems and the referendum record.'
  },
  {
    id: 'geography',
    name: 'World Geography & Places',
    short: 'Geography',
    icon: '🗺️',
    color: '#10b981',
    blurb: 'Capitals, rivers, borders, flags, highest and deepest — the quiz-setter staples.'
  },
  {
    id: 'science',
    name: 'Science & Nature',
    short: 'Science',
    icon: '🔬',
    color: '#8b5cf6',
    blurb: 'Elements, anatomy, astronomy, collective nouns of the animal kingdom.'
  },
  {
    id: 'arts_lit',
    name: 'Literature & The Arts',
    short: 'Arts & Lit',
    icon: '🎭',
    color: '#ec4899',
    blurb: 'Shakespeare, Booker and Nobel winners, opening lines, painters and their periods.'
  },
  {
    id: 'language',
    name: 'Words & Etymology',
    short: 'Language',
    icon: '💬',
    color: '#f59e0b',
    blurb: 'Word origins, Latin tags, collective nouns, phobias and borrowed phrases.'
  },
  {
    id: 'mythology',
    name: 'Myth, Religion & Ancient World',
    short: 'Myth & Ancient',
    icon: '🏛️',
    color: '#6366f1',
    blurb: 'Greek and Norse gods, the labours of Heracles, Rome, Egypt and the wonders.'
  },
  {
    id: 'sports',
    name: 'Sport, Aussie & World',
    short: 'Sport',
    icon: '🏆',
    color: '#ef4444',
    blurb: 'Ashes, Olympics, Melbourne Cup, grand slams and the numbers that stick.'
  },
  {
    id: 'pop_culture',
    name: 'Film, Music & Popular Culture',
    short: 'Pop Culture',
    icon: '🎬',
    color: '#14b8a6',
    blurb: 'Oscars, Beatles, Bond, television firsts and the songs everyone half-knows.'
  }
];

export const CATEGORIES = Object.fromEntries(CATEGORY_LIST.map((c) => [c.id, c]));

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', hint: 'Warm-ups — questions 1-8 of a Saturday quiz.', color: '#22c55e' },
  { id: 'medium', label: 'Medium', hint: 'The bulk of the paper — solid general knowledge.', color: '#f59e0b' },
  { id: 'hard', label: 'Hard', hint: 'The back end. Where the quiz is actually won.', color: '#ef4444' }
];

export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id);
