// Every game in Know-It-All. The home screen renders this list, grouped by
// SECTIONS, so a game appears on the hub the moment it has an entry here.
//
// Adding a game = one entry here plus one branch in App.jsx. Fields:
//   tab           the App tab the card opens
//   icon          a lucide icon NAME (resolved by components/ui/Icon.jsx)
//   recordFormat  (entry, ctx) => string | null, the one-line record on the card.
//                 `entry` is gameEntry(gameStats, id); `ctx` carries what the
//                 non-game cards need: { quizStats, vaultDue, weeklyScore }.
//
// Record lines follow one pattern, "N played · best X", with the unit spelled out.

export const SECTIONS = [
  { id: 'weekend', accent: 'var(--accent-weekend)', title: 'The weekend paper', blurb: 'General knowledge, the way the Saturday quiz asks it.' },
  { id: 'geo', accent: 'var(--accent-geo)', title: 'Geography', blurb: 'Flags, capitals and how many people live where.' },
  { id: 'pop', accent: 'var(--accent-pop)', title: 'Pop culture', blurb: 'Charts, box office, awards and famous faces, by year or decade.' },
  { id: 'words', accent: 'var(--accent-words)', title: 'Words', blurb: 'Build your vocabulary: synonyms, opposites and meanings.' },
  { id: 'lab', accent: 'var(--accent-lab)', title: 'The lab', blurb: 'New kinds of trivia game. Rough edges expected.' }
];

const played = (e) => `${e.plays} played`;
// Percentage games: "12 played · best 80%".
const byPct = (e) => (e.plays ? `${played(e)} · best ${e.bestPct}%` : null);
// Points games: the maximum is rounds x points per round, stated per game.
const byPoints = (max) => (e) => (e.plays ? `${played(e)} · best ${e.best} of ${max} points` : null);

export const GAMES = [
  // ---------------------------------------------------------------- weekend
  {
    id: 'weekly', section: 'weekend', tab: 'weekly', icon: 'Newspaper', title: 'The Saturday paper',
    blurb: 'Twenty-five questions, easy to hard. New every Saturday.',
    recordFormat: (_e, { weeklyScore }) => (weeklyScore ? `This week: ${weeklyScore.score}/${weeklyScore.total}` : 'This week\'s paper is out')
  },
  {
    id: 'quiz', section: 'weekend', tab: 'quiz', icon: 'CircleHelp', title: 'Weekend quiz',
    // A literal, not bankStats.json: scripts/test-logic.mjs imports this file in
    // Node, which cannot import JSON without an import attribute. Update it when
    // the bank passes the next hundred (4,753 on 2026-10-18).
    blurb: '4,700+ questions. Choose length, categories and difficulty.',
    recordFormat: (_e, { quizStats }) => (quizStats?.totalQuizzes ? `${quizStats.totalQuizzes} played · best ${quizStats.bestPercentage}%` : null)
  },
  {
    id: 'daily', section: 'weekend', tab: 'daily', icon: 'Sun', title: 'Daily five',
    blurb: 'The same five questions for everyone today.',
    recordFormat: () => null
  },
  {
    id: 'lists', section: 'weekend', tab: 'lists', icon: 'ScrollText', title: 'Fill the list',
    blurb: 'Name every PM or president in order, with years as clues.',
    recordFormat: byPct
  },
  {
    id: 'vault', section: 'weekend', tab: 'vault', icon: 'Target', title: 'Revision vault',
    blurb: 'Everything you missed, back on a spaced schedule.',
    // Only a count is available here, so no overdue vs due-today split.
    recordFormat: (_e, { vaultDue }) => (vaultDue ? `${vaultDue} due` : null)
  },
  {
    id: 'decks', section: 'weekend', tab: 'flashcards', icon: 'Layers', title: 'Flashcard decks',
    blurb: 'Quick-fire lists: elements, monarchs, anniversaries.',
    recordFormat: () => null
  },

  // -------------------------------------------------------------------- geo
  {
    id: 'flags', section: 'geo', tab: 'flags', icon: 'Flag', title: 'Flags',
    blurb: 'Name the flag. Misses come back until they stick.',
    recordFormat: byPct
  },
  {
    id: 'capitals', section: 'geo', tab: 'capitals', icon: 'Landmark', title: 'Capitals',
    blurb: 'Both directions. Trap answers like Sydney are marked wrong.',
    recordFormat: byPct
  },
  {
    id: 'population', section: 'geo', tab: 'population', icon: 'Users', title: 'Higher or lower',
    blurb: 'Population, area or GDP: chain right calls. One miss ends the run.',
    // Each measure keeps its own record (HigherLower.jsx MEASURES); the card
    // shows the best run for every measure played.
    recordFormat: (e, { gameStats = {} } = {}) => {
      const runs = [['population', 'population'], ['higher-lower-area', 'area'], ['higher-lower-gdp', 'GDP'], ['higher-lower-gdp-head', 'GDP a person']]
        .map(([id, label]) => [label, gameStats[id]])
        .filter(([, g]) => g?.plays);
      if (!runs.length) return null;
      if (runs.length === 1 && runs[0][0] === 'population') return `${played(e)} · best run of ${e.bestRun}`;
      return `Best runs: ${runs.map(([label, g]) => `${label} ${g.bestRun}`).join(' · ')}`;
    }
  },

  // -------------------------------------------------------------------- pop
  {
    id: 'first-names', section: 'pop', tab: 'first-names', icon: 'UserRound', title: 'Famous first names',
    blurb: 'Given "Tom", name the fifteen most famous Toms.',
    recordFormat: (e) => (e.plays ? `${played(e)} · best ${e.bestPct}% of a board` : null)
  },
  {
    id: 'music-years', section: 'pop', tab: 'music-years', icon: 'Music', title: 'Chart toppers by year',
    blurb: 'Billboard year-end charts since 1959. By year or decade.',
    recordFormat: byPct
  },
  {
    id: 'film-years', section: 'pop', tab: 'film-years', icon: 'Film', title: 'Films by year',
    blurb: 'Box-office top 10s since 1970 and every Best Picture race.',
    recordFormat: byPct
  },
  {
    id: 'tv-years', section: 'pop', tab: 'tv-years', icon: 'Tv', title: 'TV by year',
    blurb: 'Emmy and Golden Globe races, back to the 1950s.',
    recordFormat: byPct
  },

  // ------------------------------------------------------------------ words
  {
    id: 'vocab', section: 'words', tab: 'vocab', icon: 'BookA', title: 'Word play',
    blurb: 'Synonyms, opposites and meanings, every answer explained.',
    recordFormat: byPct
  },

  // -------------------------------------------------------------------- lab
  {
    id: 'connections', section: 'lab', tab: 'connections', icon: 'LayoutGrid', title: 'Four by four',
    blurb: 'Sixteen answers, four hidden groups. Connections for quizzers.',
    recordFormat: byPct
  },
  {
    id: 'timeline', section: 'lab', tab: 'timeline', icon: 'Hourglass', title: 'Timeline',
    blurb: 'Put five songs, films, leaders and births in order.',
    recordFormat: byPct
  },
  {
    id: 'year-guess', section: 'lab', tab: 'year-guess', icon: 'CalendarDays', title: 'Name the year',
    blurb: 'Three clues from one year. Close guesses still score.',
    recordFormat: byPoints(50)
  },
  {
    id: 'pointless', section: 'lab', tab: 'pointless', icon: 'Gem', title: 'Obscure-est',
    blurb: 'Rarer right answers score more. Bhutan beats India.',
    recordFormat: byPoints(500)
  },
  {
    id: 'missing-link', section: 'lab', tab: 'missing-link', icon: 'Link', title: 'Missing link',
    blurb: 'Four clues, rarest first. Name the link early to score more.',
    recordFormat: byPoints(20)
  },
  {
    id: 'clue-ladder', section: 'lab', tab: 'clue-ladder', icon: 'Lightbulb', title: 'Clue ladder',
    blurb: 'Clues get easier as you climb. Name it early for more points.',
    recordFormat: byPoints(20)
  },
  {
    id: 'twin-flags', section: 'lab', tab: 'twin-flags', icon: 'Eye', title: 'Twin flags',
    blurb: 'Two flags that look almost the same. Which one is it?',
    recordFormat: byPoints(10)
  },
  {
    id: 'scramble', section: 'lab', tab: 'scramble', icon: 'Shuffle', title: 'Scramble',
    blurb: 'Unscramble the letters of a country or a capital city.',
    recordFormat: byPoints(20)
  }
];
