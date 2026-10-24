# Know-It-All: next steps

The living queue. Each item is marked OPEN until it ships or is dropped; delete
it then (decisions worth keeping go in the commit or PR). Started 2026-10-18.
Older reviews: `REVIEW-2026-10-17.md`, `PLAYTEST-2026-10-01.md`,
`OVERNIGHT-2026-10-18.md`.

## Needs Pete

- Nothing waiting.

## Data

- OPEN **Old Wikidata batches saved trimmed**: `data-raw/famous/entities/*.json`
  (519 batches) and the first 201 of `entities-vital/` were saved slimmed, before
  the save-raw rule. New batches are raw. Refetching them is about 750 requests;
  only worth it if a field we dropped is wanted.

## Build

- OPEN **Four by four tricks**: hidden words, traps and red herrings (#56) and
  fill-the-gap groups (2026-10-20: 30 puzzles from 20 phrases, 17 with a
  famous-surname red herring) live in `scripts/fbf-variety.mjs`, which reruns
  after any Four by four rebuild and only tops up. Traps are all "Famous X"
  puzzles. A herring surname is capped at two puzzles from now on (Sally Field
  was already in three). Gold, Silver, ___ Cake and ___mark found no fit in the
  10 new slots; they are there for the next top-up.

## Check

- OPEN **Who am I works clues**: 2,779 of 4,455 top-15 people have one
  (2026-10-24); the answer is always one of them. Works the person's Wikipedia
  opening links come first (#72); a kind it backs none of is passed over (#76)
  unless Wikidata lists the work among their notable works (#80). Band members
  get their band's works when the opening links the band, released in their
  years and not covers (`scripts/fetch-famous-bands.mjs`): Marc Bolan "Recorded
  Electric Warrior and Hot Love". Known misses: Dave Mustaine gets Kill 'Em All
  (fired months before it, same year); some actors still get a late-career
  film second (Sally Field: Forrest Gump and The Amazing Spider-Man). Raw data
  is `data-raw/famous/works-v2`, `bands/` and `leads/`. New top-15 people:
  `npm run data:famous`, then `node scripts/fetch-famous-works.mjs`,
  `node scripts/fetch-famous-bands.mjs` and `node scripts/fetch-famous-leads.mjs`,
  then `npm run data:famous` again.

- OPEN **Download sizes**: three games load a small file of their own, built by
  `scripts/build-game-slices.mjs` (#73, #78), and Google's sign-in script waits
  for the account menu (#79). On a slow phone (Lighthouse mobile) on
  2026-10-24: Clue ladder 4.36 s to its first screen (was 8.42 s), Who am I
  3.65 s (7.25 s), Odd one out 2.09 s (5.10 s). Still loading the full files,
  gzipped: `famous.json` 670 KB (Famous first names), `obscure.json` 334 KB
  (Obscure-est, Missing link), the question bank about 835 KB (quizzes).
  Revisit if one of those feels slow.
