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
  return addDaysKey(-1, date);
}

/** The local date `days` from `date`, as a YYYY-MM-DD key. */
export function addDaysKey(days, date = new Date()) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/**
 * Add days to a YYYY-MM-DD key, returning a key.
 *
 * Takes the key rather than a Date so scheduling is a pure function of the day
 * it is given. Computing from `new Date()` instead would make the scheduler
 * untestable and would quietly ignore any date passed to it.
 */
export function addDaysToKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

/**
 * Whole days from `fromKey` to `toKey`, both YYYY-MM-DD.
 *
 * Parsed as local noon rather than midnight: a date-only string given to the
 * Date constructor is treated as UTC, and midnight UTC can fall on the previous
 * local day. Noon leaves twelve hours of slack either side, which no timezone
 * offset or DST shift can cross.
 */
export function daysBetween(fromKey, toKey) {
  const parse = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86400000);
}

/**
 * The Saturday on or before `date`, as a local date key. The weekly paper is
 * keyed by it, so a new paper appears at local midnight on Saturday.
 */
export function saturdayKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); // getDay: 6 = Saturday
  return localDateKey(d);
}
