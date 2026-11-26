// The app's side of the leaderboards (worker/boards.js has the server's).
// Everything here needs a signed-in player; signed out, the calls are skipped.
//
// A finished round is posted once. If the post fails (offline, a server
// hiccup) it waits in a small outbox on this device and is sent on the next
// round or the next visit. The outbox key is outside the synced prefix, so it
// never travels to other devices (and each device posts its own rounds).

import { getEmail } from './sync.js';
import { localDateKey } from './dates.js';

export const OUTBOX = 'kia_board_outbox';
const OUTBOX_MAX = 50;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const signedIn = () => Boolean(getEmail());

// ------------------------------------------------------------------ results

// The day each posted round was for, so its results screen can show that
// day's board (kept for this visit only).
const dayOfRound = new Map();
export const roundDay = (roundId) => dayOfRound.get(roundId) ?? null;

function readOutbox() {
  try {
    const list = JSON.parse(localStorage.getItem(OUTBOX) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeOutbox(list) {
  try {
    if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-OUTBOX_MAX)));
    else localStorage.removeItem(OUTBOX);
  } catch (err) {
    console.warn('Could not keep a round to post later.', err);
  }
}

/**
 * A board key the server accepts (worker/boards.js BOARD): accents dropped
 * and anything else outside its characters turned into "-". Famous first
 * names keys carry names like "José" and "Sean / Shaun / Shawn". Used both
 * for posting and for reading, so a board is always found under one key.
 */
export function boardKey(raw) {
  const key = String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _:.&'()-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 120);
  return key || 'board';
}

// One send at a time: two overlapping sends would each write back their own
// view of the outbox, and the later one could drop a round the other added.
let sending = Promise.resolve();

/** Send waiting rounds. A round the server refuses as bad is dropped, not retried forever. */
export function flushOutbox() {
  sending = sending.then(sendWaiting, sendWaiting);
  return sending;
}

async function sendWaiting() {
  if (!signedIn()) return;
  const me = getEmail();
  // Ids settled this pass (posted, or refused as bad). The outbox is read
  // again at the end, so a round added meanwhile is kept.
  const settled = new Set();
  for (const { account, ...r } of readOutbox()) {
    // Played under another account (since switched): never posted as this
    // one; it waits in case that account signs in here again.
    if (account !== me) continue;
    try {
      await api('results', { method: 'POST', body: r });
      settled.add(r.roundId);
    } catch (err) {
      if (err.status === 400) {
        console.warn('A round was refused by the leaderboard and dropped.', err.message);
        settled.add(r.roundId);
      }
    }
  }
  if (settled.size) writeOutbox(readOutbox().filter((r) => !settled.has(r.roundId)));
}

// When each round of this visit was last sent, so its board waits for it.
const posted = new Map();
export const roundPosted = (roundId) => posted.get(roundId) ?? Promise.resolve();

/**
 * Post a finished round: `time` from roundClock's finishClock (with its
 * board), `day` for a daily round. Signed out, nothing is sent: rounds played
 * signed out are personal only.
 */
export function postResult({ time, day = null, score, total = null }) {
  if (!signedIn() || !time?.roundId || !time.board) return;
  if (day) dayOfRound.set(time.roundId, day);
  const round = {
    account: getEmail(),
    roundId: time.roundId,
    board: boardKey(time.board),
    day,
    date: localDateKey(),
    score,
    total,
    activeMs: Math.round(time.activeMs),
    wallMs: Math.max(Math.round(time.wallMs), Math.round(time.activeMs))
  };
  writeOutbox([...readOutbox().filter((r) => r.roundId !== round.roundId), round]);
  posted.set(round.roundId, flushOutbox().catch(() => {}));
}

// ------------------------------------------------------------------ reading

/** Monday of this week (local), the key of the weekly boards. */
export function thisWeek(date = localDateKey()) {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

export const getBoard = (board, period, scope) =>
  api(`boards?board=${encodeURIComponent(board)}&period=${encodeURIComponent(period)}&scope=${encodeURIComponent(scope)}`);

export const getProfile = () => api('profile');
export const saveProfile = (changes) => api('profile', { method: 'PUT', body: changes });
export const newFriendCode = () => api('profile/friend-code', { method: 'POST' });
export const getInvites = () => api('invites');
export const createGroup = (name) => api('invites', { method: 'POST', body: { name } });
export const previewInvite = (code) => api(`invites/${encodeURIComponent(code)}`);
export const joinInvite = (code) => api(`invites/${encodeURIComponent(code)}/join`, { method: 'POST' });
export const leaveInvite = (code) => api(`invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
export const removeFriend = (code) => api(`friends/${encodeURIComponent(code)}`, { method: 'DELETE' });

/** "ABCD2345" -> "ABCD-2345", easier to read aloud; and back. */
export const showCode = (code) => (code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code || '');
export const readCode = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The link that opens the app on a friend invite. */
export const inviteLink = (code) => `${window.location.origin}/friends?invite=${code}`;

/** Open the Friends screen from anywhere (App follows the address). */
export function openFriends() {
  window.history.pushState(null, '', '/friends');
  window.dispatchEvent(new PopStateEvent('popstate'));
}
