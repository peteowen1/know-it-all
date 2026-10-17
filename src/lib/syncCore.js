// The decisions behind syncing, kept free of the browser so they can be tested
// in Node (scripts/test-logic.mjs) and shared with the Worker.
//
// The sync unit is one localStorage key. A "snapshot" is { key: rawString } for
// every synced key; a server "entry" is { value: rawString | null, updatedAt }.
// A null value is a deletion, carried so a round finished on the phone does not
// reappear on the laptop.

import { mergeProgress } from './transfer.js';
import { STORAGE_PREFIX, storageKey } from './storage.js';

// Everything the app saves starts with STORAGE_PREFIX. Keys outside it (the sync
// bookkeeping itself, anything a browser extension adds) never leave the device.

// Which screen is open is about this device, not about your progress: syncing
// it would yank the laptop to whatever tab the phone was last on.
const LOCAL_ONLY = new Set([storageKey('live_tab')]);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KEY_PATTERN = new RegExp(`^${escapeRegExp(STORAGE_PREFIX)}[A-Za-z0-9_.-]{1,80}$`);
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
export function planPull(server, localUpdated, current, touched = {}) {
  const apply = {};
  for (const [k, entry] of Object.entries(server)) {
    if (!isSyncedKey(k)) continue;
    if ((entry.updatedAt || 0) <= (localUpdated[k] || 0)) continue;
    // Written here after the server copy was made, and not yet sent: keep it.
    if ((touched[k] || 0) > (entry.updatedAt || 0)) continue;
    const mine = k in current ? current[k] : null;
    if (mine !== entry.value) apply[k] = entry.value;
  }
  return apply;
}

/**
 * Deletions on the server that this browser should copy on a first sign-in.
 * Progress keys are left alone: a reset elsewhere must not wipe the history
 * this browser is bringing to the merge.
 */
export function tombstoneWrites(server, local) {
  const writes = {};
  const progress = new Set([...Object.values(PROFILE), WEEKLY]);
  for (const [k, e] of Object.entries(server)) {
    if (e.value === null && isSyncedKey(k) && k in local && !progress.has(k)) writes[k] = null;
  }
  return writes;
}

// The keys that together are "your progress" in the sense mergeProgress
// understands, mapped to its field names.
const PROFILE = {
  stats: storageKey('stats'),
  vault: storageKey('missed'),
  recentIds: storageKey('recent'),
  games: storageKey('games')
};
const WEEKLY = storageKey('weekly');

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

const minus = (a, b) => Math.max(0, (Number(a) || 0) - (Number(b) || 0));

function subtractCounts(now, base) {
  const out = {};
  for (const [k, v] of Object.entries(now && typeof now === 'object' ? now : {})) {
    if (!v || typeof v !== 'object') continue;
    const b = (base && base[k]) || {};
    out[k] = { total: minus(v.total, b.total), correct: minus(v.correct, b.correct) };
  }
  return out;
}

/**
 * What this device added on top of `base`: the counters with the base taken
 * off, bests and lists left whole (mergeProgress takes the max or the union of
 * those, so leaving them whole is harmless).
 */
function progressSince(side, base) {
  const s = side.stats;
  const b = base.stats;
  const games = {};
  for (const [id, g] of Object.entries(side.games || {})) {
    if (!g || typeof g !== 'object') continue;
    const bg = (base.games || {})[id] || {};
    const items = {};
    for (const [k, v] of Object.entries(g.items || {})) {
      const bi = (bg.items || {})[k] || {};
      items[k] = { seen: minus(v.seen, bi.seen), correct: minus(v.correct, bi.correct) };
    }
    games[id] = { ...g, plays: minus(g.plays, bg.plays), items };
  }
  return {
    ...side,
    stats: {
      ...s,
      totalQuizzes: minus(s.totalQuizzes, b.totalQuizzes),
      totalAnswered: minus(s.totalAnswered, b.totalAnswered),
      totalCorrect: minus(s.totalCorrect, b.totalCorrect),
      categoryStats: subtractCounts(s.categoryStats, b.categoryStats),
      difficultyStats: subtractCounts(s.difficultyStats, b.difficultyStats)
    },
    games
  };
}

/**
 * Signing back in to an account this device was synced with before. Its local
 * copy is that account's copy (`base`, the last one both sides agreed on) plus
 * whatever was played here since, so merging it as a separate history would
 * count the account's totals twice.
 *
 * Per key: unchanged here since the base, take the account's copy; unchanged
 * on the account, keep this device's; changed on both, progress keys add only
 * what was played here since the base, and anything else takes the account's.
 *
 * `server` is { key: rawString | null } (null for a deletion). Returns the
 * writes to apply locally, null meaning remove.
 */
export function rebaseSnapshots(local, server, base) {
  const writes = {};
  const both = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(server), ...Object.keys(base)]);
  for (const k of keys) {
    if (!isSyncedKey(k)) continue;
    const l = local[k] ?? null;
    const s = server[k] ?? null;
    const b = base[k] ?? null;
    if (l === b) {
      if (s !== l) writes[k] = s;
    } else if (s !== b && s !== l) {
      both.push(k);
      writes[k] = s;
    }
  }
  const progressKeys = new Set(Object.values(PROFILE));
  if (both.some((k) => progressKeys.has(k))) {
    const side = (snap) => ({
      stats: parse(snap[PROFILE.stats], {}),
      vault: [].concat(parse(snap[PROFILE.vault], [])),
      recentIds: [].concat(parse(snap[PROFILE.recentIds], [])),
      games: parse(snap[PROFILE.games], {})
    });
    try {
      const merged = mergeProgress(progressSince(side(local), side(base)), side(server));
      for (const [field, key] of Object.entries(PROFILE)) if (both.includes(key)) writes[key] = JSON.stringify(merged[field]);
    } catch {
      // Unreadable data: the account's copy, already in `writes`, stands.
    }
  }
  if (both.includes(WEEKLY)) {
    writes[WEEKLY] = JSON.stringify({ ...parse(server[WEEKLY], {}), ...parse(local[WEEKLY], {}) });
  }
  return writes;
}
