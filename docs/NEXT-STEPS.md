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
  fill-the-gap groups (2026-10-20: 20 puzzles, 11 with a famous-surname red
  herring) live in `scripts/fbf-variety.mjs`, which reruns after any Four by
  four rebuild and only tops up. Traps are all "Famous X" puzzles, and Sally
  Field and Victoria Wood are each the herring three times; widen the
  phrase list (`GAPS` in `scripts/lib/fbfGroups.mjs`) if they feel samey.

## Check

- OPEN **Who am I works clues**: 2,969 of 4,455 top-15 people have one; the
  answer is always one of them. Singers in bands get thin clues (Marc Bolan:
  "Zip Gun Boogie", as Wikidata credits the hits to T. Rex), and teams rank by
  Wikipedia coverage, not by when they played (Wembanyama: ASVEL before the
  Spurs). New top-15 people: `npm run data:famous`, then
  `node scripts/fetch-famous-works.mjs`, then `npm run data:famous` again.

- OPEN **Download sizes**: the 2026-10-19 famous-people fill-in took
  `famous.json` from 273 to 602 KB gzipped (678 KB with the 2026-10-20 works
  clues) (Famous first names, Who am I) and
  `obscure.json` from 177 to 323 KB (Obscure-est, Missing link, Odd one out);
  the question bank is about 835 KB, loaded when a quiz opens. Each loads only
  when its game opens. Slimming people past each board's top 15 is not simple,
  because the era filter picks a different top 15. Revisit if loading feels slow.
