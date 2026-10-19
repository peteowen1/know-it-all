# Know-It-All: next steps

The living queue. Each item is marked OPEN until it ships or is dropped; delete
it then (decisions worth keeping go in the commit or PR). Started 2026-10-18.
Older reviews: `REVIEW-2026-10-17.md`, `PLAYTEST-2026-10-01.md`,
`OVERNIGHT-2026-10-18.md`.

## Needs Pete

(nothing waiting)

## Data

- OPEN **Old Wikidata batches saved trimmed**: `data-raw/famous/entities/*.json`
  (519 batches) and the first 201 of `entities-vital/` were saved slimmed, before
  the save-raw rule. New batches are raw. Refetching them is about 750 requests;
  only worth it if a field we dropped is wanted.

## Build

- OPEN **Replays add to lifetime totals**: an earlier day's Daily five, and
  every replayed daily game round, adds to total quizzes, answered and best
  scores on the Progress page each time (`App.jsx` `handleComplete`,
  `onRoundComplete`). The streak is not affected. The comment says counting is
  deliberate; Pete to decide whether replays should count.
- OPEN **Daily five open past midnight**: its save slot is chosen each render
  (`App.jsx` `saveSlot`), so after midnight yesterday's round starts saving to
  `daily_past` and its subtitle says it does not count. Low impact; the tick
  still goes to the right day.





## Check

- OPEN **Download sizes**: the 2026-10-19 famous-people fill-in took
  `famous.json` from 273 to 602 KB gzipped (Famous first names, Who am I) and
  `obscure.json` from 177 to 323 KB (Obscure-est, Missing link, Odd one out);
  the question bank is about 835 KB, loaded when a quiz opens. Each loads only
  when its game opens. Slimming people past each board's top 15 is not simple,
  because the era filter picks a different top 15. Revisit if loading feels slow.
