// "How it works" for each game's start screen, keyed by game id (registry.js).
// Three short parts: what you do, how it scores, and where the answers come
// from, so a player can tell why an answer counted or did not. Shown by
// GameSetup behind the "?" button; keep each part to a sentence or two.

export const HOW_IT_WORKS = {
  lists: {
    play: 'Name every office holder in order. Each box shows the years in office as a clue; type a surname into any box and right answers lock in.',
    score: 'One point per name. Leaders who returned for a second term appear once for each term.',
    source: 'Wikidata lists of office holders, rebuilt with the site, so a new leader appears without anyone editing a list.'
  },
  flags: {
    play: 'Name the country from its flag. Pick from four options, or answer in your head, reveal, and mark yourself.',
    score: 'One point per right answer. Flags you miss come back more often in later rounds.',
    source: 'Every UN member and widely recognised country, from REST Countries; regions follow the UN geoscheme.'
  },
  capitals: {
    play: 'Name the capital of the country shown. Pick from four options, or answer in your head, reveal, and mark yourself.',
    score: 'One point per right answer. Capitals you miss come back more often in later rounds.',
    source: 'REST Countries, with second capitals accepted where a country has two (Bolivia, Eswatini, Sri Lanka). Regions follow the UN geoscheme.'
  },
  population: {
    play: 'Two countries: does the second have more people than the first, or fewer?',
    score: 'Your run is how many you get right in a row. One miss ends it.',
    source: 'World Bank population estimates, the latest year with figures for nearly every country.'
  },
  'first-names': {
    play: 'Name the fifteen most famous people with the first name shown. Type surnames only.',
    score: 'Your score is how much of the board you fill. Famous people beyond the fifteen count as bonus answers.',
    source: "Fame is the total views of each person's English Wikipedia page since 2016, for people who reached a monthly top 1000 or are on Wikipedia's list of the most important people. People known mainly for violent crimes, or as their victims, are left out."
  },
  'music-years': {
    play: "Fill a year's top 10 or a decade's top 20 by typing song titles, or take the multiple-choice quiz.",
    score: 'The board scores the share of songs you find. In a decade board a song ranks by its chart points summed across the years it charted.',
    source: 'Billboard Hot 100 year-end charts from 1959, via Wikipedia.'
  },
  'film-years': {
    play: "Fill a year's box-office top 10 or its Best Picture nominees by typing titles, or take the multiple-choice quiz.",
    score: 'The board scores the share of films you find.',
    source: "Each year's top 10 releases from Wikipedia's 'year in film' pages (worldwide gross from the 1980s, North American rentals in the 1970s), and Best Picture winners and nominees by film year. Before 1934 the awards ran on split seasons, so those years are labelled by the season they started in."
  },
  'tv-years': {
    play: "Fill a year's Emmy or Golden Globe winners and nominees for best drama and comedy series, or take the quiz.",
    score: 'The board scores the share of shows you find.',
    source: 'Emmy and Golden Globe lists back to the 1950s, via Wikipedia. Emmys are dated by the ceremony year.'
  },
  vocab: {
    play: 'Pick words that mean the same, the opposite of a word, or the word for a meaning.',
    score: 'One point per right answer. Words you miss come back more often.',
    source: 'A hand-checked word list in families of related words, each with its meaning.'
  },
  connections: {
    play: 'Sixteen answers hide four groups of four. Pick four that belong together. Four mistakes and you are out.',
    score: 'Solved or not, and how many mistakes it took. Today\'s puzzle counts once; replays are for fun.',
    source: 'Built from the flags, capitals, charts, films, TV and famous-names data, and checked so that no answer fits two groups in its puzzle.'
  },
  timeline: {
    play: 'Five events. Put them in order, oldest at the top.',
    score: 'Every pair of events you have the right way round scores.',
    source: 'Number-one songs and films, Best Picture and Emmy winners, leaders taking office and famous births, from the same data as the other games. Events without a single clear year are left out.'
  },
  'year-guess': {
    play: 'Three clues from one year. Type the year.',
    score: 'The exact year scores 10, and two fewer for every year out.',
    source: 'The same events as Timeline.'
  },
  pointless: {
    play: 'Give one right answer for each category, the rarer the better.',
    score: 'Any right answer scores; the rarer it is, the more it scores, up to 100. A wrong or unlisted answer scores nothing.',
    source: 'Rarity is measured, not guessed: population for countries and capitals, Wikipedia readership for people, chart points for songs, box office for films.'
  },
  'missing-link': {
    play: 'Four clues appear one at a time, rarest first. Pick what links them.',
    score: '4 points after one clue, down to 1 after all four. A wrong guess scores nothing.',
    source: 'The same categories as Obscure-est.'
  },
  'clue-ladder': {
    play: 'A fact with the answer blanked out, then a memory hook, then the question, then four options. Fill the blanks as early as you can.',
    score: '4 points on the first clue, then 3, 2, and 1 for the options. Small typos are fine, and you can leave off words like "the" or "mount".',
    source: 'The weekend quiz questions, using only those whose first clue holds the answer, after a playtest removed rounds that gave nothing to go on.'
  },
  'twin-flags': {
    play: 'Two flags that look almost the same. Pick the one for the country named.',
    score: 'One point per right answer. After each round a tip says how to tell the pair apart.',
    source: 'Pairs picked by comparing the flag images pixel by pixel for colour and layout, each with a hand-written tip.'
  },
  scramble: {
    play: "Unscramble the letters into a country or a capital.",
    score: '2 points, or 1 if you use the hint, or 0 if you skip. A leading "The" and small typos are fine.',
    source: 'Country names and capitals from the flags data, with common other spellings accepted (Turkey, Kiev).'
  }
};
