// Answers kept out of Obscure-est (and so Missing link) categories, by category
// id. A 2026-10-18 fact check found director categories holding films the
// director was not credited on: Wikidata's P57 includes uncredited, replaced
// and producing directors (Pinky is Elia Kazan's, not John Ford's). The cached
// filmographies do not hold each film's other directors, so these are listed
// by hand, each checked against the film's on-screen credit.
//
// Not listed, because the flag was a same-title mix-up: Milestone did direct
// Les Misérables (1952) and Seven Sinners (1925), McCarey Indiscreet (1931),
// and Van Dyke Dr. Kildare's Victory.
export const OBSCURE_EXCLUDE = {
  'films-Ron Howard': ['The Dark Tower', 'Made in America'],
  'films-Sam Mendes': ['No Time to Die'],
  'films-David Lean': ['The Greatest Story Ever Told'],
  'films-Richard Donner': ['Superman II'],
  'films-Leo McCarey': ['Love Happy'],
  'films-Sydney Pollack': ['The Swimmer', 'Breaking and Entering'],
  'films-John Ford': ['Pinky', 'The Adventures of Marco Polo'],
  'films-William A. Wellman': ['Tarzan Escapes', 'The Adventures of Tom Sawyer'],
  'films-William Wyler': ['Barbary Coast'],
  'films-Mervyn LeRoy': ['The Great Garrick', 'The Green Berets'],
  'films-Victor Fleming': ['The Great Waltz'],
  'films-Martin Scorsese': ['Woodstock'],
  'films-George Cukor': ['Lust for Life', 'Manhattan Melodrama', 'The Adventures of Tom Sawyer', 'Song Without End'],
  // Found by an Odd one out playtest (2026-10-18): uncredited or replaced.
  'films-John Huston': ['A Farewell to Arms'],
  'films-George Stevens': ['Hollywood Party'],
  'films-Sam Wood': ['The Great Moment', 'The Cat and the Fiddle'],
  // A double A-side ("How Do U Want It / California Love") carries both sides'
  // artists; Dr. Dre is on California Love only.
  'songs-Dr. Dre': ['How Do U Want It']
};
