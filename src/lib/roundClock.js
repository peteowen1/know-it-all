// A round's clock. Two times come out of it:
//
//   active  time on screen: it pauses while the page is hidden (another tab,
//           the phone locked) and while an answer is being shown, so it
//           measures thinking. Personal and friends' boards use it.
//   wall    from the round's start to its finish, never paused. Public boards
//           will use it (docs/plans/LEADERBOARDS.md).
//
// The clock is plain JSON kept in the round's own saved state, written only
// when it pauses, resumes or finishes, never on a tick. No React here.

/** A random id for the round, so a result can never be posted twice. */
export function roundId() {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_');
}

export const newClock = (now = Date.now()) => ({ id: roundId(), startedAt: now, activeMs: 0, runningSince: now });

const running = (c) => c.runningSince != null;

/** Stop counting active time; wall time carries on. */
export const pauseClock = (c, now = Date.now()) =>
  running(c) ? { ...c, activeMs: c.activeMs + Math.max(0, now - c.runningSince), runningSince: null } : c;

export const resumeClock = (c, now = Date.now()) => (running(c) ? c : { ...c, runningSince: now });

/**
 * Picking a saved round back up: time since the last save is not counted
 * (the app was closed, or the page hidden, and the save on hide was the last
 * word on it).
 */
export const reopenClock = (c, now = Date.now()) => (running(c) ? { ...c, runningSince: now } : c);

export const activeMs = (c, now = Date.now()) => c.activeMs + (running(c) ? Math.max(0, now - c.runningSince) : 0);

/** The two times for a finished round. */
export const finishClock = (c, now = Date.now()) => ({ roundId: c.id, activeMs: activeMs(c, now), wallMs: Math.max(0, now - c.startedAt) });

/** 83000 -> "1:23", 3723000 -> "1:02:03". */
export function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A clock read back from storage, or null if it is not one. */
export function validClock(c) {
  return c && typeof c === 'object' && typeof c.id === 'string' && Number.isFinite(c.startedAt) && Number.isFinite(c.activeMs) &&
    (c.runningSince == null || Number.isFinite(c.runningSince))
    ? c
    : null;
}
