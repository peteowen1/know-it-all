// Credited directors for films where Wikidata's P57 also lists people who were
// not the credited director: uncredited or replaced directors, second-unit or
// sequence directors, editors, producers. Four by four builds "Directed by X"
// groups from these credits, so an extra name put No Time to Die among Sam
// Mendes films and Woodstock among Martin Scorsese's (a 2026-10-18 playtest).
//
// Checked by hand against each film's on-screen director credit. Genuine
// co-directors (the Coens, the Russos, Pixar and Disney pairs) are left alone.
// Keyed by film title as it appears in src/data/charts/films.json; a fix is
// used only where the listed credits contain all of its names and more.
export const DIRECTOR_FIX = {
  Woodstock: ['Michael Wadleigh'],
  'The Towering Inferno': ['John Guillermin'],
  'Superman II': ['Richard Lester'],
  'A Fish Called Wanda': ['Charles Crichton'],
  'Space Jam': ['Joe Pytka'],
  'The Jungle Book': ['Jon Favreau'],
  'Toy Story 4': ['Josh Cooley'],
  'No Time to Die': ['Cary Joji Fukunaga'],
  'A Minecraft Movie': ['Jared Hess'],
  Wings: ['William A. Wellman'],
  'All Quiet on the Western Front': ['Lewis Milestone'],
  'The Front Page': ['Lewis Milestone'],
  'One Hour with You': ['Ernst Lubitsch'],
  'Flirtation Walk': ['Frank Borzage'],
  'The House of Rothschild': ['Alfred L. Werker'],
  'The Thin Man': ['W. S. Van Dyke'],
  'Viva Villa!': ['Jack Conway'],
  'Broadway Melody of 1936': ['Roy Del Ruth'],
  'Naughty Marietta': ['W. S. Van Dyke'],
  'Anthony Adverse': ['Mervyn LeRoy'],
  'San Francisco': ['W. S. Van Dyke'],
  'A Tale of Two Cities': ['Jack Conway'],
  'The Good Earth': ['Sidney Franklin'],
  'In Old Chicago': ['Henry King'],
  'Lost Horizon': ['Frank Capra'],
  'A Star Is Born': ['William A. Wellman'],
  'Gone with the Wind': ['Victor Fleming'],
  'The Wizard of Oz': ['Victor Fleming'],
  'The Pied Piper': ['Irving Pichel'],
  'The Ox-Bow Incident': ['William A. Wellman'],
  'Watch on the Rhine': ['Herman Shumlin'],
  'Since You Went Away': ['John Cromwell'],
  'Mister Roberts': ['John Ford', 'Mervyn LeRoy'],
  'Around the World in 80 Days': ['Michael Anderson'],
  Gigi: ['Vincente Minnelli'],
  'The Defiant Ones': ['Stanley Kramer'],
  'The Longest Day': ['Ken Annakin', 'Bernhard Wicki'],
  'Mutiny on the Bounty': ['Lewis Milestone'],
  Awakenings: ['Penny Marshall'],
  'Slumdog Millionaire': ['Danny Boyle']
};
