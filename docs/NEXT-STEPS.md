# Know-It-All: next steps

The living queue. Each item is marked OPEN until it ships or is dropped; delete
it then (decisions worth keeping go in the commit or PR). Started 2026-10-18.
Older reviews: `REVIEW-2026-10-17.md`, `PLAYTEST-2026-10-01.md`,
`OVERNIGHT-2026-10-18.md`.

## Needs Pete

- OPEN **Famous people still missing**: names that are neither in a monthly
  Wikipedia top 1000 nor on the vital-articles lists (Jason Derulo, Emma Bunton,
  Billy Idol) score "not on the list". Widening further means a new candidate
  source (for example, every person with that first name, ranked by views),
  which is thousands more page-view requests. Worth it?

## Data

- OPEN **Obscure-est song lists** come only from Billboard year-end Hot 100s, so
  43 famous songs are missing (Purple Rain, Gin and Juice, Where Is the Love?).
  Option: add weekly Hot 100 peaks or another chart source.
- OPEN **Films by year, Best Picture 1927-1932**: split seasons are labelled by
  the year they started (1928 board = 1928/29). Timeline already leaves them
  out; Films by year still shows them under one year.
- OPEN **Timeline skew** (review E4): heavy in the 1960s to 1980s (about 70
  events a decade) against about 34 in the 2020s. Needs new event sources.
- OPEN **Old Wikidata batches saved trimmed**: `data-raw/famous/entities/*.json`
  (519 batches) and the first 201 of `entities-vital/` were saved slimmed, before
  the save-raw rule. New batches are raw. Refetching them is about 750 requests;
  only worth it if a field we dropped is wanted.

## Build


- OPEN **Dated daily addresses** (`/daily-five/2026-10-18`) and an archive of
  past dailies. Addresses are one level deep today because the build loads its
  files by relative path; a second level needs an absolute base or a redirect.
- OPEN **Product ideas** from the review (N7 to N13): share grid, Today row,
  one streak across games, fewer tabs.

## Check

- OPEN **Two open tabs and sync** (da82aa4, e12c720): the fixes were reviewed
  but never run with a real sign-in. Test once by hand: sign in, open a second
  tab, sign out in one, play in the other, sign back in; totals must not double.
- OPEN **Download sizes**: Famous first names grew to about 270 KB gzipped
  (2026-10-18); the question bank is about 835 KB, loaded when a quiz opens.
  A split was costed and judged not worth it; revisit if loading feels slow.
