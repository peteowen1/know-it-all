// The decisions behind syncing, kept free of the browser so they can be tested
// in Node (scripts/test-logic.mjs) and shared with the Worker.
//
// The sync unit is one localStorage key. A "snapshot" is { key: rawString } for
// every synced key; a server "entry" is { value: rawString | null, updatedAt }.
// A null value is a deletion, carried so a round finished on the phone does not
// reappear on the laptop.

import { mergeProgress } from './transfer.js';

// Everything the app saves starts with this. Keys outside it (the sync
// bookkeeping itself, anything a browser extension adds) never leave the device.
export const SYNC_PREFIX = 'sqt_v4_';

// Which screen is open is about this device, not about your progress: syncing
// it would yank the laptop to whatever tab the phone was last on.
const LOCAL_ONLY = new Set(['sqt_v4_live_tab']);

export const KEY_PATTERN = /^sqt_v4_[A-Za-z0-9_.-]{1,80}$/;
export const isSyncedKey = (k) => KEY_PATTERN.test(k) && !LOCAL_ONLY.has(k);

/** Keys whose current value differs from the last value both sides agreed on. */
export function diffSnapshot(current, shadow) {
  const changes = {};
  for (const [k, v] of Object.entries(current)) if (shadow[k] !== v) changes[k] = v;
  for (const k of Object.keys(shadow)) if (!(k in current) && shadow[k] !== null) changes[k] = null;
  return changes;
}

/**
 * Which server entries to write into this browser: those newer than what this
 * device last wrote or received for that key, and not already identical.
 *
 * Plain last-writer-wins per key. `mergeProgress` is NOT used here because it
 * adds totals together, which is right for two separate histories and wrong
 * for two copies of one: every round trip would double "questions answered".
 */
export function planPull(server, localUpdated, current) {
  const apply = {};
  for (const [k, entry] of Object.entries(server)) {
    if (!isSyncedKey(k)) continue;
    if ((entry.updatedAt || 0) <= (localUpdated[k] || 0)) continue;
    const mine = k in current ? current[k] : null;
    if (mine !== entry.value) apply[k] = entry.value;
  }
  return apply;
}

// The keys that together are "your progress" in the sense mergeProgress
// understands, mapped to its field names.
const PROFILE = { stats: 'sqt_v4_stats', vault: 'sqt_v4_missed', recentIds: 'sqt_v4_recent', games: 'sqt_v4_games' };
const WEEKLY = 'sqt_v4_weekly';

const parse = (raw, fallback) => {
  try {
    const v = raw == null ? null : JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

/** Has this snapshot got anything worth merging, or is it a fresh browser? */
export function hasProgress(snapshot) {
  const stats = parse(snapshot[PROFILE.stats], {});
  const vault = parse(snapshot[PROFILE.vault], []);
  const games = parse(snapshot[PROFILE.games], {});
  return (stats.totalAnswered || 0) > 0 || (Array.isArray(vault) && vault.length > 0) || Object.keys(games).length > 0;
}

/**
 * Combine two genuinely separate histories: this browser's, and one arriving
 * from elsewhere (the account on first sign-in, or the old github.io copy).
 * Used once per pairing, never on routine syncs.
 *
 * Returns the raw strings to write locally. Progress keys are merged so no
 * device's work is lost; everything else (settings, rounds in progress) takes
 * the incoming copy where both have one, since that is the device just left.
 */
export function mergeSnapshots(local, incoming) {
  const writes = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (isSyncedKey(k) && v !== null && v !== undefined) writes[k] = v;
  }
  if (!hasProgress(local)) return writes;
  if (!hasProgress(incoming)) {
    // Nothing to merge: keep local progress, still take incoming rounds.
    for (const key of Object.values(PROFILE)) delete writes[key];
    delete writes[WEEKLY];
    return writes;
  }

  const side = (snap) => ({
    stats: parse(snap[PROFILE.stats], {}),
    vault: [].concat(parse(snap[PROFILE.vault], [])),
    recentIds: [].concat(parse(snap[PROFILE.recentIds], [])),
    games: parse(snap[PROFILE.games], {})
  });
  try {
    const merged = mergeProgress(side(local), side(incoming));
    for (const [field, key] of Object.entries(PROFILE)) writes[key] = JSON.stringify(merged[field]);
  } catch {
    // Unreadable data on one side: keep the incoming copy rather than half a merge.
    return writes;
  }
  // First score per week, so on a clash keep the one already here.
  writes[WEEKLY] = JSON.stringify({ ...parse(incoming[WEEKLY], {}), ...parse(local[WEEKLY], {}) });
  return writes;
}
