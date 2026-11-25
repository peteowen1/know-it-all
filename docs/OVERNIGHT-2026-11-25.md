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
- Lint: the two old warnings are gone (`preloadFlags` has its own file).
- `npm update` within the allowed ranges (React 19.3, Vite 8.3, wrangler
  4.168, lucide-react 1.80, oxlint 1.95): build, lint and all tests pass.
  The newer oxlint adds 14 React warnings, queued in NEXT-STEPS.
- Review: one Sonnet reviewer, 0 important findings.
- PR #88 opened, not merged. The first CI run failed at `npm ci`: the lockfile
  from `npm update` was missing the `@types/node` 18 copy the cloudflare SDK
  pins. Fixed with `npm install` in 6eff055; CI build passed.

## Needs Pete

- Merge #88.
- Account switching mixes progress (NEXT-STEPS "Needs Pete").
- Silence the three new React lint rules, or leave the 14 warnings.
