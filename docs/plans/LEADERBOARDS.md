# Timed rounds and leaderboards

Pete, 2026-11-26: "most games should have a time to them as well so can have
leaderboard and compete with friends". His answers:

- **Which games:** every game, random rounds too.
- **Ranking:** score first, then time.
- **Friends:** invite link, friend code and groups, all three.
- **Names:** a nickname you pick, defaulting to your Google first name. Email is never shown.
- **Two clocks (his idea):** friends and personal boards use time that pauses
  when you switch away; public boards use time that never stops.

## Rules this work never breaks

1. A replay never posts a better time: times pass through `handleGameRound`
   after the `firstFinish` gate, and the server keys results by round id.
2. No save on a clock tick. The clock lives in the round's saved state and is
   saved only on an answer, on hide and on finish (a saved round is a synced
   key; a write a second would push every 1.5 s).
3. Nothing about a person leaves the device unless they chose to post it, and
   Reset or delete-my-data clears it on the server too.

## Phase 1: the clock (shipped: #96, #97, 2026-11-26)

- `src/lib/roundClock.js`: a round's clock `{ id, startedAt, activeMs,
  runningSince }`. `activeMs` pauses when the page is hidden; wall time is
  `now - startedAt` and never pauses.
- A ticking pill in the play header (a child component, as `QuizTimer`
  does), so the game itself never re-renders each second.
- The clock stops while an answer is showing, so the time measures thinking,
  not reading the explanation.
- Best times in their own key (`game_times`), not in game stats:
  `coerceGameStats` drops unknown fields, so an old open tab would strip them
  and sync the loss back. Merge rule: better score, then shorter time.
- On every game except the weekend quiz and Daily five (they show their own
  timer; not yet joined to best times) and Word play's adaptive test (a
  level, not a score). A chart or list board left part-way records no time;
  a streak game left mid-run records its run so far, with its time.
- Not yet played in a browser by a session: Chrome could not reach the local
  server on 2026-11-26. Pete played Scramble and Clue ladder and said it looks good.

## Phase 2: boards (server)

- New D1 tables, not the sync store: `profiles(sub, nickname)`,
  `results(sub, game, board, period, round_id, score, active_ms, wall_ms,
  started_at, finished_at)` unique on `(sub, round_id)`, `invites(code, kind,
  owner, name)`, `members(code, sub)`.
- **A board key per game**: every setting that changes what is asked (map
  view, people pool, measure, region, decade) lives in `registry.js`, so
  "every game" means many small boards. Random-round boards need a period
  (a week?) or the top never moves: **ask Pete when Phase 2 starts.**
- **Friends:** a link is a code in a URL; a group is a code with a name. One
  `invites` table covers all three. Joining needs a tap from the signed-in
  person, never just opening the link.
- **Public boards:** the server stamps start and finish, so the round must
  start online. The score is still whatever the app reports; the server
  cannot check it. Opt-in: **ask Pete when Phase 3 starts.**
- **Privacy:** the footer's "nothing else is collected" must change; delete
  my data clears nickname, results and memberships; every board read has a
  limit.

## Open questions for Pete (ask at the phase, not before)

- Random boards: weekly, monthly or all-time?
- Public boards: opt-in per person?
- A late first play of an earlier day's daily round: does it post to that
  day's board?
