// Each screen has its own address, so a game can be bookmarked or shared and
// the browser's Back button steps back through screens.
//
// Addresses are one level deep (/clue-ladder, never /games/clue-ladder): the
// build uses relative asset paths (base './' in vite.config.js), which resolve
// correctly from one level down but not from two.

// Where a tab id would make a poor address, the address uses the name people
// see. Every other tab id is its own address.
const SLUGS = {
  home: '',
  weekly: 'saturday-paper',
  quiz: 'weekend-quiz',
  daily: 'daily-five',
  flashcards: 'decks',
  connections: 'four-by-four',
  pointless: 'obscurest',
  analytics: 'progress'
};
const TAB_FOR_SLUG = new Map(Object.entries(SLUGS).map(([tab, slug]) => [slug, tab]));

/** The address for a tab, e.g. 'daily' -> '/daily-five'. */
export const pathForTab = (tab) => `/${Object.hasOwn(SLUGS, tab) ? SLUGS[tab] : tab}`;

/**
 * The tab an address names, e.g. '/daily-five' -> 'daily'. An address that
 * names no tab comes back as itself; App sends unknown tabs home.
 */
export function tabForPath(pathname) {
  let slug = pathname;
  try {
    slug = decodeURIComponent(pathname);
  } catch {
    // A malformed address ('/%') names no tab; it falls through to home.
  }
  slug = slug.replace(/^\/+|\/+$/g, '').toLowerCase();
  return TAB_FOR_SLUG.get(slug) ?? slug;
}
