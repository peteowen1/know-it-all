// Every game in Know-It-All, played or planned. The home screen renders this
// list; `status: 'ready'` makes a card playable, anything else shows it as
// coming so the roadmap is visible in the app itself.
//
// `tab` is the App tab a ready game opens. Adding a game = one entry here plus
// one branch in App.jsx.

export const SECTIONS = [
  { id: 'weekend', title: 'The weekend paper', blurb: 'General knowledge, the way the Saturday quiz asks it.' },
  { id: 'geo', title: 'Geography', blurb: 'Flags, capitals and how many people live where.' },
  { id: 'pop', title: 'Pop culture', blurb: 'Charts, box office, awards and famous faces, by year or decade.' },
  { id: 'lab', title: 'The lab', blurb: 'New kinds of trivia game. Rough edges expected.' }
];

export const GAMES = [
  // ---------------------------------------------------------------- weekend
  { id: 'quiz', section: 'weekend', tab: 'quiz', status: 'ready', icon: '📰', title: 'Weekend quiz', blurb: '1,040 questions in eight categories. Pick length, categories and difficulty.' },
  { id: 'daily', section: 'weekend', tab: 'daily', status: 'ready', icon: '☀️', title: 'Daily five', blurb: 'Same five questions for everyone today.' },
  { id: 'vault', section: 'weekend', tab: 'vault', status: 'ready', icon: '🎯', title: 'Revision vault', blurb: 'Everything you missed, back on a spaced schedule.' },
  { id: 'decks', section: 'weekend', tab: 'flashcards', status: 'ready', icon: '🗂️', title: 'Flashcard decks', blurb: 'Quick-fire lists: elements, monarchs, wedding anniversaries.' },

  // -------------------------------------------------------------------- geo
  { id: 'flags', section: 'geo', tab: 'flags', status: 'ready', icon: '🏳️', title: 'Flags', blurb: '197 flags. Wrong ones come back until they stick.' },
  { id: 'capitals', section: 'geo', tab: 'capitals', status: 'ready', icon: '🏛️', title: 'Capitals', blurb: 'Both directions. Trap answers like Sydney and Abidjan are marked wrong.' },
  { id: 'population', section: 'geo', tab: 'population', status: 'ready', icon: '👥', title: 'Population: higher or lower', blurb: 'Chain as many right calls as you can. One miss ends it.' },

  // -------------------------------------------------------------------- pop
  { id: 'first-names', section: 'pop', tab: 'first-names', status: 'soon', icon: '🌟', title: 'Famous first names', blurb: 'Given "Tom", fill a board of the fifteen most famous Toms. Easy mode gives hints.' },
  { id: 'music-years', section: 'pop', status: 'soon', icon: '🎵', title: 'Chart toppers by year', blurb: 'Biggest-selling and most-streamed artists and songs, by year or decade.' },
  { id: 'film-years', section: 'pop', status: 'soon', icon: '🎬', title: 'Films by year', blurb: 'Best Picture winners and box-office number ones.' },
  { id: 'tv-years', section: 'pop', status: 'soon', icon: '📺', title: 'TV by year', blurb: 'Emmy and Golden Globe winners for drama and comedy.' },

  // -------------------------------------------------------------------- lab
  { id: 'connections', section: 'lab', status: 'soon', icon: '🧩', title: 'Four by four', blurb: 'Sixteen trivia answers, four hidden groups. Connections, but for quiz knowledge.' },
  { id: 'timeline', section: 'lab', status: 'soon', icon: '⏳', title: 'Timeline', blurb: 'Put five events, films or inventions in order. Closer orders score partial points.' },
  { id: 'year-guess', section: 'lab', status: 'soon', icon: '📅', title: 'Name the year', blurb: 'Three clues from one year. Scored on how many years you are off.' },
  { id: 'pointless', section: 'lab', status: 'soon', icon: '🎯', title: 'Obscure-est', blurb: 'Any right answer scores, but rarer right answers score more.' },
  { id: 'missing-link', section: 'lab', status: 'soon', icon: '🔗', title: 'Missing link', blurb: 'What connects these four? Answer early for more points.' }
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
