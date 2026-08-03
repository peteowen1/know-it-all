// Calendar-day helpers.
//
// These must be LOCAL dates, not UTC. `new Date().toISOString()` is always UTC,
// which puts the day boundary at 10am or 11am for an Australian user rather than
// midnight. That is wrong twice over: a streak could increment twice within one
// local day, and the daily quiz would roll over mid-morning — so someone opening
// it at breakfast would still be shown yesterday's questions.

/** YYYY-MM-DD in the user's own timezone. */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The local calendar day before `date`.
 *
 * Built by decrementing the date component rather than subtracting 24 hours,
 * because a daylight-saving transition makes some local days 23 or 25 hours
 * long and a fixed subtraction lands on the wrong day at the boundary.
 */
export function previousDateKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return localDateKey(d);
}
