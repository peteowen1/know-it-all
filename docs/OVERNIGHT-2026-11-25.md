# Overnight run, 2026-11-25

Rules this run never breaks:

1. Nothing merges to `main` overnight. Fixes go to `dev`, get reviewed, and
   wait in one open PR for Pete in the morning.
2. No change to how sync stores or merges progress (`src/lib/sync*.js`,
   `worker/`) without Pete: the account-switching fix stays a question.
3. Every fix gets a test or a real check before it counts as done.

## Done

- Hand-over retry can no longer merge twice: `collectHandoff` undoes a
  part-written parcel before rethrowing (`src/lib/handoff.js`).
- Obscure-est accepts "The 1" and "W.": the matcher takes one-character
  guesses, exact only (`chartLogic.js` `matchChartGuess`).
- "Despacito" credits the original, not "Despacito (Remix)": among equally
  close open titles, the one whose full title is the guess wins.
- The Vault counts only questions still in the bank, and a drill whose due
  questions were all removed opens the Vault instead of an empty round.
