# Plan: sign in with Google, progress syncs automatically

Status: SHIPPED 2026-09-24 (PRs #16, #17). Live at https://quiz.peteowen.dev.
Pete confirmed the phone-to-laptop hand-over and sign-in work on real devices.
The github.io copy now only hands progress over and redirects.

## Why

Phone and laptop keep separate progress, and a quiz started on one cannot be
finished on the other. The manual progress code (`src/components/ProgressTransfer.jsx`)
moves stats but not in-progress rounds, and needs copying by hand every time.

## What the user sees

- Signed out: the app works exactly as before, on this device only.
- "Sign in with Google" in the header. After signing in once per device,
  everything syncs; the header shows Synced / Syncing / Offline.
- Opening the laptop after the phone: same stats, same Vault, same round in
  progress at the same question. Switching back to an open tab also syncs.
- Sign out: stops syncing; local progress stays on the device.
- Reset while signed in clears every device (the confirm says so).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Accounts | Google sign-in (ID-token flow) | No passwords; the Worker checks Google's signature itself, no client secret |
| Hosting | One Cloudflare Worker at `quiz.peteowen.dev` serving `dist/` and `/api/*` | Same site as the API, so a normal cookie works on iPhone Safari; avoids GitHub Pages + Cloudflare proxy certificate trouble |
| Session | Worker's own random token, HttpOnly SameSite=Lax cookie, 180 days sliding; only its SHA-256 stored | Google tokens last 1 hour; page scripts can never read the cookie |
| Storage | D1 | Consistent reads; KV can lag ~60 s between regions |
| Sync unit | One `localStorage` key under `sqt_v4_`, except `sqt_v4_live_tab` | Every save in the app already goes through two functions (`save` in `src/App.jsx`, `saveLive` in `src/lib/persist.js`), so no game needed changing |
| Clash rule | Newest copy of each key wins; server caps timestamps at its own clock | See below |
| Old address | github.io copy posts its progress to `/api/handoff` once, then always redirects | Browsers keep each site's storage separate |

### The clash rule — the part that matters

`mergeProgress` ADDS totals, which is right for two separate histories and
wrong for two copies of one: using it on routine syncs would double
"questions answered" every round trip. So routine syncs are plain
newest-wins per key (`planPull` in `src/lib/syncCore.js`), and
`mergeSnapshots` runs only when two separate histories meet: first sign-in
on a device that already has progress, and the github.io hand-over.

Accepted loss case: both devices change the same key while both offline;
the older change to that key is dropped.

## Where things are

- `worker/index.js` — API; `worker/google.js` — token check; `worker/migrations/0001_init.sql`
- `src/lib/syncCore.js` — pure decisions (tested); `src/lib/sync.js` — browser side
- `src/lib/handoff.js` — github.io → quiz.peteowen.dev move
- `src/lib/syncConfig.js` — Google client ID and the app address (one place, shared by Worker and app)
- `src/components/AccountButton.jsx`, `src/Root.jsx` (remounts the app after a pull)
- `wrangler.toml`; deploy job `cloudflare` in `.github/workflows/deploy.yml`

## Verified locally (2026-09-24)

- `npm test`: 118 pass, 9 of them sync (incl. no double counting over round trips).
- 20 API checks against `wrangler dev`: auth required, older write ignored,
  deletions stored, fast clock capped, bad key 400, cross-site write 403,
  fake Google token 401, hand-over single-use and CORS-limited to github.io,
  sign-out clears the session.
- In Chrome with a seeded session: opening pulled server progress (tab stayed
  local); the app pushed its keys; a newer server change arrived on switching
  back to the tab and the header updated without a reload.

Not yet verified: a real Google sign-in, and iPhone behaviour on switch-away.

## Steps that need Pete

1. Google Cloud Console → Credentials → OAuth client ID → Web application.
   Authorised JavaScript origins: `https://quiz.peteowen.dev`,
   `http://localhost:8787`, `http://localhost:5173`. No redirect URIs.
   Paste the client ID into `GOOGLE_CLIENT_ID` in `src/lib/syncConfig.js`.
2. Cloudflare API token: the one in `CLOUDFLARE_API_TOKEN` gets "Authentication
   error 10000" on D1. It needs Account → D1: Edit, Account → Workers Scripts:
   Edit, Zone (peteowen.dev) → Workers Routes: Edit and DNS: Edit. Then add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   (`293a12bb23f882f48029d3fe35c6ec5a`) as GitHub repo secrets for the deploy job.

## Then

1. ~~Create D1~~ done 2026-09-24: `know-it-all`, id `3725bf64-65ca-4989-b04d-3e8e1e7317e5`, region OC.
2. Review gate, PR to `main`, CI deploys both copies.
3. Open the old github.io address once on each device; re-add the iPhone
   home-screen icon from `quiz.peteowen.dev`.

## Next session (written 2026-09-25)

Where it stands: shipped in PRs #16–#19, live at https://quiz.peteowen.dev.
Pete's phone and laptop (desktop `Know-It-All.url` shortcut) are both signed
in and syncing; the github.io hand-over worked on his phone.

Queued, in order:
1. **iPhone switch-away check** (Pete, 1 minute): answer a question, switch
   apps at once, open the laptop. The only behaviour not seen on a real device.
2. **Hide or guard the manual progress-code card when signed in** (~20 min).
   Pasting a code between two devices on the same account adds the same games
   twice (`mergeProgress` sums totals). Today only the card's text warns.
3. **Rate-limit `/api/handoff`** (~30 min, low priority). Anyone can create
   parcels (≤512 KB, expire in 15 min); nothing stops a flood filling D1.
   Parcels are only accepted from the old address, so it is a storage-cost
   risk, not a data risk.

Deliberately not done:
- Clash when both devices edit the same item while both offline: the older
  edit is dropped. Accepted for a one-person app.
- The github.io copy stays deployed so old bookmarks and home-screen icons
  still arrive; do not delete the Pages deploy.

Corrected during the session: the first build stamped every upload with the
time of the first unsent change and accepted forged hand-over links; review
caught both plus five more (fixed in 6aa330d). The first deploy failed on
Node 20 (fixed in #17); nothing went live broken because Pages waits for the
Cloudflare job.
