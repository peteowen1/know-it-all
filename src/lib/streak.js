// The streak: days in a row with something finished, a quiz or any daily
// round. Pure, so scripts/test-lib.mjs can check the day arithmetic.

/**
 * The streak after finishing something on `today`. A second finish the same
 * day changes nothing; the day after the last one adds one; a gap restarts
 * at one.
 */
export function advanceStreak({ streak = 0, lastPlayDate = null }, today, yesterday) {
  if (lastPlayDate === today) return { streak, lastPlayDate };
  return { streak: lastPlayDate === yesterday ? streak + 1 : 1, lastPlayDate: today };
}
