import { localDateKey, addDaysToKey, daysBetween } from './dates';

// Spaced repetition for the weakness vault.
//
// The previous behaviour removed a question the first time you got it right.
// That is close to worthless for retention: answering correctly once, minutes
// after reading the explanation, mostly measures short-term memory. The whole
// point of a *trainer* is that the question comes back later, when you have had
// time to forget it.
//
// This is a Leitner box system rather than full SM-2. SM-2's ease factors are
// tuned for decks reviewed daily over years; for a general knowledge quiz played
// when someone feels like it, fixed expanding intervals are easier to reason
// about and behave sanely when you skip a fortnight.

// Days until a question returns, per box. Getting it right moves you up one box;
// getting it wrong drops you to box 0 regardless of how far you had climbed,
// because a lapse means you never really had it.
export const INTERVALS = [1, 3, 7, 21, 60];

// Clearing the last box graduates the question out of the vault entirely.
export const GRADUATED_BOX = INTERVALS.length;

export function newEntry(id, today = localDateKey()) {
  return { id, box: 0, due: addDaysToKey(today, INTERVALS[0]), lapses: 0, reps: 0, added: today };
}

/**
 * Accepts either the current entry format or the original `string[]` of ids and
 * returns entries. Migration happens on read rather than through a storage
 * version bump, because bumping the version would silently discard a vault the
 * user has been building up — the opposite of what a revision tool should do.
 */
export function normaliseVault(raw, today = localDateKey()) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (seen.has(item)) continue;
      seen.add(item);
      // Migrated entries are due immediately: they were previously "things I got
      // wrong and never revisited", so there is no reason to defer them.
      out.push({ ...newEntry(item, today), due: today });
      continue;
    }
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({
        id: item.id,
        box: Number.isInteger(item.box) ? Math.max(0, Math.min(item.box, GRADUATED_BOX)) : 0,
        due: typeof item.due === 'string' ? item.due : today,
        lapses: Number.isInteger(item.lapses) ? item.lapses : 0,
        reps: Number.isInteger(item.reps) ? item.reps : 0,
        added: typeof item.added === 'string' ? item.added : today
      });
    }
  }
  return out;
}

export function isDue(entry, today = localDateKey()) {
  return daysBetween(entry.due, today) >= 0;
}

export function dueEntries(vault, today = localDateKey()) {
  // Longest-overdue first, so a backlog is worked off oldest-first rather than
  // in whatever order the vault happens to be stored in.
  return vault.filter((e) => isDue(e, today)).sort((a, b) => daysBetween(b.due, a.due));
}

/**
 * Correct answer. Returns the updated entry, or null once it graduates — the
 * caller drops nulls, which is how a question leaves the vault for good.
 */
export function promote(entry, today = localDateKey()) {
  const box = entry.box + 1;
  if (box >= GRADUATED_BOX) return null;
  return { ...entry, box, due: addDaysToKey(today, INTERVALS[box]), reps: entry.reps + 1 };
}

/** Wrong answer. Back to the start, and count the lapse. */
export function demote(entry, today = localDateKey()) {
  return {
    ...entry,
    box: 0,
    due: addDaysToKey(today, INTERVALS[0]),
    lapses: entry.lapses + 1,
    reps: entry.reps + 1
  };
}

/** Record a miss: new questions enter at box 0, known ones lapse back to it. */
export function recordMiss(vault, id, today = localDateKey()) {
  const existing = vault.find((e) => e.id === id);
  if (!existing) return [...vault, newEntry(id, today)];
  return vault.map((e) => (e.id === id ? demote(e, today) : e));
}

/** Record a hit. Only moves a question on if it was actually due. */
export function recordHit(vault, id, today = localDateKey()) {
  const existing = vault.find((e) => e.id === id);
  if (!existing) return vault;
  // Answering it early — because it turned up in a normal quiz — should not
  // advance the schedule, or the intervals stop meaning anything.
  if (!isDue(existing, today)) return vault;
  const next = promote(existing, today);
  return next ? vault.map((e) => (e.id === id ? next : e)) : vault.filter((e) => e.id !== id);
}

/** Human-readable description of when a question is next due. */
export function describeDue(entry, today = localDateKey()) {
  const days = daysBetween(today, entry.due);
  if (days <= 0) return 'due now';
  if (days === 1) return 'due tomorrow';
  if (days < 7) return `due in ${days} days`;
  if (days < 14) return 'due in a week';
  if (days < 45) return `due in ${Math.round(days / 7)} weeks`;
  return `due in ${Math.round(days / 30)} months`;
}

export function vaultSummary(vault, today = localDateKey()) {
  const due = dueEntries(vault, today);
  return {
    total: vault.length,
    due: due.length,
    struggling: vault.filter((e) => e.lapses >= 2).length,
    nextDue: vault.length
      ? vault.reduce((soonest, e) => (daysBetween(e.due, soonest) > 0 ? e.due : soonest), vault[0].due)
      : null
  };
}
