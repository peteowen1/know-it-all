# Know-It-All: next steps

The living queue. Each item is marked OPEN until it ships or is dropped; delete
it then (decisions worth keeping go in the commit or PR). Started 2026-10-18.
Older reviews: `REVIEW-2026-10-17.md`, `PLAYTEST-2026-10-01.md`,
`OVERNIGHT-2026-10-18.md`.

## Needs Pete

- OPEN **Match the curve in Today?** Live in the Lab since 2026-10-24 (#83,
  #84) but not in the Today tabs (`TODAY_TABS` in `GameHub.jsx`). Play it,
  then add it or say what felt off.

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

- OPEN **Match the curve reasons**: 236 of 281 peaks have a line saying why
  (`scripts/curve-reasons.json`, checked by hand from Wikipedia's weekly Top 25
  Report, saved raw in `data-raw/famous/top25/`). 45 have none and show the
  month only. A reason is dropped when the person's peak month moves, so after
  `npm run data:famous` and `npm run data:curves`, run
  `node scripts/fetch-top25.mjs` and write lines for the new peaks. Tried and
  dropped: Portal:Current events explained 6 of 21 pilot peaks (no film or TV
  releases); the Top 25 Report explained 18.

- OPEN **Who am I works clues**: 2,779 of 4,455 top-15 people have one
  (2026-10-24); the answer is always one of them. Works the person's Wikipedia
  opening links come first (#72); a kind it backs none of is passed over (#76)
  unless Wikidata lists the work among their notable works (#80). Band members
  get their band's works when the opening links the band, released in their
  years and not covers (`scripts/fetch-famous-bands.mjs`): Marc Bolan "Recorded
  Electric Warrior and Hot Love". The second work is one they won a major
  award for, if any (`scripts/fetch-famous-awards.mjs`; 15+ sitelinks, no
  Razzies or fan votes): Diane Keaton "The Godfather and Annie Hall". Known
  misses: Dave Mustaine gets Kill 'Em All (fired months before it); about 15
  of the 243 award picks are weaker (Gene Kelly: Invitation to the Dance, not
  Singin' in the Rain); Wikidata ties Sally Field's Oscars to no film, so she
  gets Brothers & Sisters. Raw data is `data-raw/famous/works-v2`, `bands/`,
  `awards/` and `leads/`. New top-15 people: `npm run data:famous`, then
  `node scripts/fetch-famous-works.mjs`, `fetch-famous-bands.mjs`,
  `fetch-famous-awards.mjs` and `fetch-famous-leads.mjs`, then
  `npm run data:famous` again.

- OPEN **Download sizes**: three games load a small file of their own, built by
  `scripts/build-game-slices.mjs` (#73, #78), and Google's sign-in script waits
  for the account menu (#79). On a slow phone (Lighthouse mobile) on
  2026-10-24: Clue ladder 4.36 s to its first screen (was 8.42 s), Who am I
  3.65 s (7.25 s), Odd one out 2.09 s (5.10 s). Still loading the full files,
  gzipped: `famous.json` 670 KB (Famous first names), `obscure.json` 334 KB
  (Obscure-est, Missing link), the question bank about 835 KB (quizzes).
  Revisit if one of those feels slow.
