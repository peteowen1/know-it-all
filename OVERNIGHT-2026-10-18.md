# Overnight run, 2026-10-18

Pete was asleep. Work went on `dev` as local commits (PR #37 is open from `dev`; pushing would have added to it). No merges to `main`.

## Needs Pete
1. **Merge PR #37** (per-screen addresses). CI passes, reviewed. Then I push the 10 local commits below as one PR.
2. **Obscure-est / Famous first names miss famous people.** The famous list is "most-read Wikipedia pages each month since 2016", capped at 40 people per name. So Mark Twain, Bob Hope, Frank Zappa, Jason Derulo, Emma Bunton score "not on the list: 0" (65 such flags), and 43 well-known songs are missing (Purple Rain, Gin and Juice) because the song lists are year-end Billboard charts only. Options: raise the cap and add older fame, or leave it.
3. **Region names follow REST Countries, not the UN.** "Western Europe" leaves out Austria (REST says Central Europe), Cyprus sits in Southern Europe, not Western Asia. Players who learned UN regions get marked wrong. Options: switch the whole app to UN M49, or keep REST.

## Done (local commits on dev, all reviewed by Sonnet, tests and build pass)
- a0e5dab Challenge links start from the site root
- da82aa4 + e12c720 Sync: a second open tab follows sign-in, sign-out and pushes; in-flight requests dropped if the account changed
- 187b9af README: bank size, game list, addresses
- dcb96f1 Scramble: Turkey, The Gambia, St John's, Kiev, Ulaanbaatar, Nay Pyi Taw, Britain, Deutschland
- 2bb3cf2 Four by four + Films by year: 40 director credits corrected, Birdman, a clearer label, South Sudan to Eastern Africa; 31 of 243 puzzles patched in place (today's untouched)
- 0f292d0 Timeline: 7 events with no single right year dropped
- 96d63e0 Obscure-est: South Sudan / Juba to Eastern Africa
- 45101b9 Obscure-est + Missing link: 21 wrong films/songs removed, a duplicate merged

## Playtest results (Haiku, high effort)
| Game | Checked | Flags | Real after checking |
|---|---|---|---|
| Four by four | 243 puzzles | 15 | 10 (4 wrong director tiles in 9 puzzles, Birdman x3, label x2, Juba) |
| Scramble | 439 rounds | 24 | 9 missing spellings |
| Twin flags | 42 pairs | 0 | 0 |
| Timeline | 535 events | 9 | 7 |
| Fill the list | 117 rows | 0 | 0 |
| Obscure-est / Missing link | 402 categories | 149 | 22 fixed; 108 are the "missing famous answer" decision above |

## Not done / follow-ups
- Films by year boards for 1927-1932 Best Picture are labelled by the first year of each split season.
- Two-tab sync not tested with a real sign-in (no signing in from here).

## Notes
- Every flag was checked against the code or data before acting; several were wrong (Lou Grant, Taxi, same-title films, two "duplicate" people who are different people).
- Python heredocs turned `\b` into backspace bytes once; fixed, scanned, saved as a memory.
- Data builds that fetch (obscure, famous, films) were patched in place, with the fix also in the build script so a rebuild keeps it.
