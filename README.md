# Know-It-All

Trivia training, live at https://peteowen1.github.io/know-it-all/ (formerly
Saturday Quiz Trainer). The home screen lists every game, played or planned:

- **Weekend quiz**: 1,040 general-knowledge questions across eight categories,
  each with an explanation and a memory hook, plus a revision vault.
- **Geography**: flags, capitals (both directions) and population
  higher-or-lower, over 197 sovereign states (territories optional).
- **Coming**: famous first names, chart toppers / films / TV by year, and lab
  games (four-by-four groups, timeline, name the year, missing link).

The game list lives in `src/games/registry.js`.

Runs entirely in the browser. No account, no server, no data leaves the device.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run validate` | Checks the question bank. Fails on template filler, duplicate stems, recycled distractors, thin categories. |
| `npm run build` | Validates, then builds to `dist/`. |
| `npm run build:only` | Builds without validating (CI runs the two steps separately). |
| `npm run lint` | oxlint. |
| `npm run preview` | Serves the built `dist/` locally. |

## Question data

One JSON file per category under `src/data/questions/`. Each entry:

```json
{
  "id": "aus_001",
  "category": "aus_history",
  "difficulty": "easy",
  "question": "Who served as Australia's first Prime Minister?",
  "answer": "Edmund Barton",
  "distractors": ["Alfred Deakin", "Chris Watson", "George Reid"],
  "explanation": "Barton led the first federal ministry from 1 January 1901 and quit politics in 1903 to become a founding justice of the High Court…",
  "hook": "Barton was first into the Lodge and first onto the High Court bench."
}
```

**The correct answer is stored as text, never as an index.** The previous version
of this project stored `answer: 0` for all 999 questions and never shuffled the
options, so the correct answer was always option A. Storing the answer as a
string makes that class of bug impossible to express: option order is decided at
render time by `src/lib/quizBuilder.js`.

`explanation` must teach something beyond the answer. `hook` is a memory aid
shown *after* answering. Neither may restate the question — `npm run validate`
enforces both, along with a blocklist of template phrases.

### Adding questions

1. Append to the relevant file in `src/data/questions/`.
2. Run `npm run validate`. Fix whatever it reports.
3. Category counts must stay at 100+, and each difficulty tier at 15%+ of the bank.

## How the engine works

- **`src/lib/rng.js`** — FNV-1a hash plus mulberry32, and a real Fisher-Yates
  shuffle.
- **`src/lib/quizBuilder.js`** — builds a round. Option order is seeded on
  `(question id, quiz seed)` so it stays fixed for the length of the quiz but
  differs next time. Two hard constraints — no repeated id, no repeated stem
  within a round — plus a soft preference for questions absent from the last
  ~350 seen, which yields once the unseen pool runs dry.
- **`src/lib/dates.js`** — local calendar days. Streaks and the daily quiz must
  not use `toISOString()`: it is UTC, which would roll the day over at 10-11am
  in Australia rather than at midnight.
- **`src/data/questionBank.js`** — loads and indexes the eight JSON files.

Everything persists to `localStorage` under a versioned key prefix (`sqt_v4_*`).
Bumping the version changes the prefix, so entries written by an older schema are
orphaned — never read again — rather than parsed into a shape the current code
does not expect. They are not deleted; only the Reset button does that. Values
are shape-checked on read, because `JSON.parse` succeeding does not mean the
result is the type the caller expects.

## Country data

`npm run data:countries` rebuilds `src/data/countries.json` from
[mledoze/countries](https://github.com/mledoze/countries) (names, capitals,
regions) and World Bank `SP.POP.TOTL` (population). It prints coverage and fails
if the join breaks. Raw responses are saved to `data-raw/` (gitignored). Extra
accepted capitals (La Paz, Mbabane...) are in `ACCEPT_ALSO` in the script.

Flags are SVGs from the `flag-icons` package, because Windows does not draw
flag emoji.

Per-game progress (`sqt_v4_games`) lives in `src/lib/gameStats.js` and travels
in the progress code alongside the weekend-quiz stats.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which validates,
lints, builds and publishes `dist/` to GitHub Pages. `vite.config.js` sets
`base: './'` so the build works from a project subpath.

To set it up on a fresh repo:

```bash
gh repo create <name> --public --source=. --push
# then: Settings → Pages → Source: GitHub Actions
```

The site is installable to a phone home screen (`public/manifest.webmanifest`)
and works offline after the first visit (`public/sw.js`).

## Branch convention

Work on `dev`; merge to `main` by pull request after review.
